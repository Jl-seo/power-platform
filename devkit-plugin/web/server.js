#!/usr/bin/env node
/**
 * DevKit Web — Admin Console + L3 Canvas viewer.
 *
 * 단일 Express 서버에 두 영역을 묶었다.
 *   /            — 진입 화면 (Admin / Canvas 링크)
 *   /admin       — Admin Console (화이트리스트·정책·감사로그·비용)
 *   /canvas      — L3 Canvas 뷰어 (ERD·화면·워크플로우)
 *   /api/*       — JSON API (아래 라우트 참조)
 *
 * 인증은 W4 1차에서 stub. 운영 환경에선 Entra ID + MFA 필수.
 *
 * 환경 변수:
 *   PORT                  (default 5173)
 *   DEVKIT_TELEMETRY_LOG  (default ~/.devkit/telemetry.log)
 *   DEVKIT_TRUSTGATE_LOG  (default ~/.devkit/trust-gate.log)
 *   DEVKIT_DATA_DIR       (default ./examples — IR JSON 검색 루트)
 */

import express from "express";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import http from "node:http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PUBLIC_DIR = join(__dirname, "public");
const TELEMETRY_LOG = process.env.DEVKIT_TELEMETRY_LOG ?? join(homedir(), ".devkit", "telemetry.log");
const TRUSTGATE_LOG = process.env.DEVKIT_TRUSTGATE_LOG ?? join(homedir(), ".devkit", "trust-gate.log");
const POLICIES_FILE = process.env.DEVKIT_POLICIES_FILE ?? join(homedir(), ".devkit", "policies.json");
const DATA_DIR = resolve(process.env.DEVKIT_DATA_DIR ?? join(ROOT, "examples"));
const TEMPLATES_INDEX = join(ROOT, "references", "templates", "index.yaml");
const SCHEMA_PATH = join(ROOT, "schemas", "ir.schema.json");
const RENDER_ERD = join(ROOT, "bin", "render-erd.js");
const RENDER_BPMN = join(ROOT, "bin", "render-bpmn.js");
const CRITIC = join(ROOT, "bin", "critic.js");

const DEFAULT_POLICIES = {
  trustGate: {
    sandbox:  { gate: "없음", note: "내 작업방 — 자유롭게 실험" },
    team:     { gate: "자동 점검 + AI 셀프 리뷰", note: "팀 IR 머지 시" },
    prod:     { gate: "보안 점검 + 사람 1명 리뷰", note: "실서비스 배포" },
    external: { gate: "보안팀 자동 알림 + 컴플라이언스 점검", note: "외부 노출" },
  },
  enforcement: "W1~W4 로그 only — 차단 없음. W5+ 차단 강도 격상 예정.",
  secrets: "도구 차원 평문 저장 금지. Key Vault 참조만 허용.",
};

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(PUBLIC_DIR));

// 친근한 URL: /admin → admin.html, /canvas → canvas.html, /dashboard → dashboard.html
app.get("/admin", (_req, res) => res.sendFile(join(PUBLIC_DIR, "admin.html")));
app.get("/canvas", (_req, res) => res.sendFile(join(PUBLIC_DIR, "canvas.html")));
app.get("/dashboard", (_req, res) => res.sendFile(join(PUBLIC_DIR, "dashboard.html")));

// ---------------- API: templates / whitelist ----------------
app.get("/api/templates", async (_req, res) => {
  try {
    if (!existsSync(TEMPLATES_INDEX)) return res.json({ templates: [] });
    const raw = await readFile(TEMPLATES_INDEX, "utf8");
    res.type("text/plain").send(raw);
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
});

// ---------------- API: policies (read + write) ----------------
async function loadPolicies() {
  if (!existsSync(POLICIES_FILE)) return { ...DEFAULT_POLICIES };
  try {
    return { ...DEFAULT_POLICIES, ...JSON.parse(await readFile(POLICIES_FILE, "utf8")) };
  } catch {
    return { ...DEFAULT_POLICIES };
  }
}
async function savePolicies(p) {
  await mkdir(dirname(POLICIES_FILE), { recursive: true });
  await writeFile(POLICIES_FILE, JSON.stringify(p, null, 2) + "\n", "utf8");
}

app.get("/api/policies", async (_req, res) => {
  res.json(await loadPolicies());
});

app.post("/api/policies", async (req, res) => {
  try {
    const incoming = req.body ?? {};
    // 단순 화이트리스트 머지: 알려진 키만 받기
    const next = await loadPolicies();
    if (incoming.trustGate && typeof incoming.trustGate === "object") {
      for (const k of ["sandbox", "team", "prod", "external"]) {
        const s = incoming.trustGate[k];
        if (!s) continue;
        next.trustGate[k] = {
          gate: String(s.gate ?? next.trustGate[k]?.gate ?? ""),
          note: String(s.note ?? next.trustGate[k]?.note ?? ""),
        };
      }
    }
    if (typeof incoming.enforcement === "string") next.enforcement = incoming.enforcement;
    if (typeof incoming.secrets === "string") next.secrets = incoming.secrets;
    await savePolicies(next);
    res.json({ ok: true, policies: next });
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
});

// ---------------- API: audit (감사 로그 — ndjson 끝에서부터) ----------------
async function tailNdjson(path, n = 100) {
  if (!existsSync(path)) return [];
  const raw = await readFile(path, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean).slice(-n);
  return lines.map((l) => {
    try { return JSON.parse(l); }
    catch { return { _raw: l, _parseError: true }; }
  });
}

app.get("/api/audit", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit ?? "100", 10) || 100, 1000);
  try {
    const [telemetry, trustGate] = await Promise.all([
      tailNdjson(TELEMETRY_LOG, limit),
      tailNdjson(TRUSTGATE_LOG, limit),
    ]);
    res.json({ telemetry, trustGate });
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
});

// ---------------- API: cost (스텁 — 텔레메트리에서 토큰 합산) ----------------
app.get("/api/cost", async (_req, res) => {
  const events = await tailNdjson(TELEMETRY_LOG, 1000);
  const byTeam = {};
  for (const e of events) {
    const p = e?.payload ?? {};
    const team = p?.team ?? "unknown";
    const tok = (p?.prompt_tokens ?? 0) + (p?.completion_tokens ?? 0);
    byTeam[team] = (byTeam[team] || 0) + tok;
  }
  res.json({
    note: "텔레메트리 이벤트의 prompt_tokens + completion_tokens 합산. 실 운영 시 모델 단가 매핑 필요.",
    byTeam,
    totalTokens: Object.values(byTeam).reduce((a, b) => a + b, 0),
    sampleSize: events.length,
  });
});

// ---------------- API: list IR files ----------------
async function findIrFiles(dir) {
  const out = [];
  async function walk(d) {
    let entries;
    try { entries = await readdir(d, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) await walk(p);
      else if (ent.isFile() && ent.name.endsWith(".ir.json")) out.push(p);
    }
  }
  await walk(dir);
  return out.map((p) => relative(ROOT, p));
}

app.get("/api/ir/list", async (_req, res) => {
  try {
    const files = await findIrFiles(DATA_DIR);
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
});

// ---------------- API: get IR + render diagrams + critic ----------------
app.get("/api/ir/load", async (req, res) => {
  const rel = String(req.query.path ?? "");
  const abs = resolve(ROOT, rel);
  if (!abs.startsWith(ROOT)) return res.status(400).json({ error: "path escape" });
  if (!existsSync(abs)) return res.status(404).json({ error: "not found" });
  try {
    const ir = JSON.parse(await readFile(abs, "utf8"));
    const erd = spawnSync(process.execPath, [RENDER_ERD, abs], { encoding: "utf8" });
    const bpmn = spawnSync(process.execPath, [RENDER_BPMN, abs], { encoding: "utf8" });
    const critique = spawnSync(process.execPath, [CRITIC, abs], { encoding: "utf8" });
    res.json({
      ir,
      erd_mermaid: (erd.stdout || "").trim(),
      bpmn_mermaid: (bpmn.stdout || "").trim(),
      critique: critique.stdout ? JSON.parse(critique.stdout) : null,
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
});

// IR 부분 patch — JSON Patch 적용 + 검증 + 저장 + 라이브 broadcast.
app.post("/api/ir/patch", async (req, res) => {
  const rel = String(req.body?.artifact_path ?? "");
  const patch = req.body?.patch;
  if (!rel || !Array.isArray(patch)) return res.status(400).json({ error: "artifact_path + patch[] 필요" });
  const abs = resolve(ROOT, rel);
  if (!abs.startsWith(ROOT)) return res.status(400).json({ error: "path escape" });
  if (!existsSync(abs)) return res.status(404).json({ error: "not found" });
  try {
    const ir = JSON.parse(await readFile(abs, "utf8"));
    const { default: jsonpatch } = await import("fast-json-patch");
    const next = jsonpatch.applyPatch(structuredClone(ir), patch, true, false).newDocument;
    // 스키마 검증
    const { default: Ajv } = await import("ajv/dist/2020.js");
    const { default: addFormats } = await import("ajv-formats");
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(JSON.parse(await readFile(SCHEMA_PATH, "utf8")));
    const valid = validate(next);
    if (!valid) {
      return res.status(400).json({ error: "schema invalid", details: validate.errors });
    }
    await writeFile(abs, JSON.stringify(next, null, 2) + "\n", "utf8");
    broadcast({ type: "ir-patched", artifact_path: rel });
    res.json({ ok: true, ir: next });
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
});

// ---------------- API: dashboard ----------------
app.get("/api/dashboard", async (_req, res) => {
  try {
    const events = await tailNdjson(TELEMETRY_LOG, 1000);
    // Top 사용: tool_name 또는 feature 별 카운트
    const usage = {};
    for (const e of events) {
      const p = e.payload || {};
      const key = p.feature || p.tool_name || p.event || "(기타)";
      usage[key] = (usage[key] || 0) + 1;
    }
    // 품질: critique 이벤트의 overall 점수 시계열 + 게이트별 pass/fail 카운트
    const quality = { critiqueSeries: [], gatePass: { gate1: 0, gate2: 0, gate3: 0 }, gateFail: { gate1: 0, gate2: 0, gate3: 0 } };
    for (const e of events) {
      const p = e.payload || {};
      if (p.event === "devkit.critique" || p.dimensions) {
        if (typeof p.overall === "number") quality.critiqueSeries.push({ at: e.at, overall: p.overall });
      }
      if (p.gate1_compile === "pass") quality.gatePass.gate1++;
      else if (p.gate1_compile === "fail") quality.gateFail.gate1++;
      if (p.gate2_schema === "pass") quality.gatePass.gate2++;
      else if (p.gate2_schema === "fail") quality.gateFail.gate2++;
      if (p.gate3_golden === "pass") quality.gatePass.gate3++;
      else if (p.gate3_golden === "fail") quality.gateFail.gate3++;
    }
    // 비용: 팀별 토큰
    const cost = {};
    for (const e of events) {
      const p = e.payload || {};
      const team = p.team || "(미분류)";
      const tok = (p.prompt_tokens ?? 0) + (p.completion_tokens ?? 0);
      cost[team] = (cost[team] || 0) + tok;
    }
    res.json({
      sampleSize: events.length,
      usage,
      quality,
      cost,
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message) });
  }
});

// ---------------- WebSocket: presence + ADR co-edit ----------------
// 본격 CRDT(yjs 등) 대신 단순 broadcast + room state.
// 한 artifact_path 당 한 room. 서버는 마지막 ADR 추가만 동기화 (시연용).
const rooms = new Map(); // path -> Set<ws>

function broadcast(message, except) {
  const payload = JSON.stringify(message);
  for (const set of rooms.values()) {
    for (const ws of set) {
      if (ws !== except && ws.readyState === 1) ws.send(payload);
    }
  }
}

function joinRoom(ws, path) {
  if (!rooms.has(path)) rooms.set(path, new Set());
  rooms.get(path).add(ws);
  ws._room = path;
  // 현재 인원 수 알림
  const count = rooms.get(path).size;
  for (const peer of rooms.get(path)) {
    if (peer.readyState === 1) peer.send(JSON.stringify({ type: "presence", count, path }));
  }
}

function leaveRoom(ws) {
  const path = ws._room;
  if (!path) return;
  const set = rooms.get(path);
  if (!set) return;
  set.delete(ws);
  for (const peer of set) {
    if (peer.readyState === 1) peer.send(JSON.stringify({ type: "presence", count: set.size, path }));
  }
}

// ---------------- start ----------------
const PORT = process.env.PORT ?? 5173;
const ENABLE_LISTEN = !process.argv.includes("--smoke");

if (ENABLE_LISTEN) {
  const server = http.createServer(app);
  // WS는 옵셔널: ws 패키지 없으면 그냥 HTTP만
  try {
    const { WebSocketServer } = await import("ws");
    const wss = new WebSocketServer({ server, path: "/ws" });
    wss.on("connection", (ws, req) => {
      const url = new URL(req.url, "http://localhost");
      const path = url.searchParams.get("path") || "(unspecified)";
      joinRoom(ws, path);
      ws.on("message", (raw) => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }
        // 클라이언트 cursor / 자유 broadcast
        broadcast({ ...msg, _from: "peer" }, ws);
      });
      ws.on("close", () => leaveRoom(ws));
    });
    process.stdout.write("[devkit-web] WebSocket presence enabled at /ws\n");
  } catch {
    process.stdout.write("[devkit-web] WebSocket disabled (ws not installed)\n");
  }
  server.listen(PORT, () => {
    process.stdout.write(`[devkit-web] listening on http://localhost:${PORT}\n`);
    process.stdout.write(`[devkit-web]   /admin      — 관리 화면\n`);
    process.stdout.write(`[devkit-web]   /canvas     — 화면 미리보기 + 편집\n`);
    process.stdout.write(`[devkit-web]   /dashboard  — 대시보드 3장\n`);
  });
} else {
  // Smoke: 자기 점검 — public 파일 + API 라우트 등록 확인
  const required = ["index.html", "admin.html", "canvas.html", "dashboard.html", "app.css"];
  let fail = false;
  for (const f of required) {
    if (!existsSync(join(PUBLIC_DIR, f))) {
      process.stderr.write(`[devkit-web] smoke FAIL: missing public/${f}\n`);
      fail = true;
    }
  }
  if (fail) process.exit(1);
  process.stdout.write("[devkit-web] smoke: public files ok\n");
  process.stdout.write("[devkit-web] smoke: routes registered\n");
  process.stdout.write("[devkit-web] smoke: ALL PASS\n");
}

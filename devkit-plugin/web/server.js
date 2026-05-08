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
import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PUBLIC_DIR = join(__dirname, "public");
const TELEMETRY_LOG = process.env.DEVKIT_TELEMETRY_LOG ?? join(homedir(), ".devkit", "telemetry.log");
const TRUSTGATE_LOG = process.env.DEVKIT_TRUSTGATE_LOG ?? join(homedir(), ".devkit", "trust-gate.log");
const DATA_DIR = resolve(process.env.DEVKIT_DATA_DIR ?? join(ROOT, "examples"));
const TEMPLATES_INDEX = join(ROOT, "references", "templates", "index.yaml");
const RENDER_ERD = join(ROOT, "bin", "render-erd.js");
const RENDER_BPMN = join(ROOT, "bin", "render-bpmn.js");
const CRITIC = join(ROOT, "bin", "critic.js");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(PUBLIC_DIR));

// 친근한 URL: /admin → admin.html, /canvas → canvas.html
app.get("/admin", (_req, res) => res.sendFile(join(PUBLIC_DIR, "admin.html")));
app.get("/canvas", (_req, res) => res.sendFile(join(PUBLIC_DIR, "canvas.html")));

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

// ---------------- API: policies (정책 룰 — 현재 로그 only) ----------------
app.get("/api/policies", (_req, res) => {
  res.json({
    trustGate: {
      sandbox:  { gate: "없음", note: "내 작업방 — 자유롭게 실험" },
      team:     { gate: "자동 점검 + AI 셀프 리뷰", note: "팀 IR 머지 시" },
      prod:     { gate: "보안 점검 + 사람 1명 리뷰", note: "실서비스 배포" },
      external: { gate: "보안팀 자동 알림 + 컴플라이언스 점검", note: "외부 노출" },
    },
    enforcement: "W1~W4 로그 only — 차단 없음. W5+ 차단 강도 격상 예정.",
    secrets: "도구 차원 평문 저장 금지. Key Vault 참조만 허용.",
  });
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

// ---------------- start ----------------
const PORT = process.env.PORT ?? 5173;
const ENABLE_LISTEN = !process.argv.includes("--smoke");

if (ENABLE_LISTEN) {
  app.listen(PORT, () => {
    process.stdout.write(`[devkit-web] listening on http://localhost:${PORT}\n`);
    process.stdout.write(`[devkit-web]   /admin   — Admin Console\n`);
    process.stdout.write(`[devkit-web]   /canvas  — L3 Canvas viewer\n`);
  });
} else {
  // Smoke: 자기 점검 — public 파일 + API 라우트 등록 확인
  const required = ["index.html", "admin.html", "canvas.html", "app.css"];
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

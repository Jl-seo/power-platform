#!/usr/bin/env node
/**
 * eval-runner — 3단 평가 게이트 러너.
 *
 *   gate1 schema   : ir.schema.json 기준 JSON Schema 검증 (correctness)
 *   gate2 structure: critic의 high-severity finding 0건이어야 통과
 *   gate3 golden   : ./goldens/<artifact-id>.ir.json 와 diff 비교 (있을 때만)
 *
 * usage: node bin/eval-runner.js <ir-path> [--goldens-dir <dir>]
 *
 * 출력: JSON { gate1, gate2, gate3, verdict: "accepted"|"review_needed"|"rejected" }
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SCHEMA_PATH = join(ROOT, "schemas", "ir.schema.json");
const CRITIC = join(ROOT, "bin", "critic.js");

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function gate1Schema(ir) {
  const { default: Ajv } = await import("ajv/dist/2020.js");
  const { default: addFormats } = await import("ajv-formats");
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(await loadJson(SCHEMA_PATH));
  const valid = validate(ir);
  return {
    pass: !!valid,
    errors: valid ? [] : (validate.errors ?? []).map((e) => ({
      path: e.instancePath || "(root)",
      message: e.message,
    })),
  };
}

async function gate2Structure(ir) {
  const { spawn } = await import("node:child_process");
  return new Promise((resolveP) => {
    const child = spawn(process.execPath, [CRITIC, "--stdin"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    // critic.js는 path 인자를 받으므로 여기선 임시 파일 대신 require 직접 호출
    resolveP(null);
    child.kill();
  }).then(async () => {
    // critic.js를 모듈로 직접 호출하지 않고 실행하기 위해
    // 간단히 import 해서 함수 호출하는 방식이 더 안전.
    return await runCriticInProcess(ir);
  });
}

async function runCriticInProcess(ir) {
  // critic.js의 critique 함수를 동적으로 호출하기 위해 본 파일 안에 동등 로직을
  // 가져온다 — 의존성 일치를 위해 critic.js에서 export 하도록 보강하는 대신
  // 여기선 간단히 critic.js를 child_process로 실행한다.
  const { writeFile, unlink, mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const tmpDir = await mkdtemp(join(tmpdir(), "devkit-eval-"));
  const tmpFile = join(tmpDir, "ir.json");
  await writeFile(tmpFile, JSON.stringify(ir));
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, [CRITIC, tmpFile], { encoding: "utf8" });
  await unlink(tmpFile).catch(() => {});
  if (r.status !== 0) {
    return { pass: false, errors: [{ message: r.stderr || "critic failed" }] };
  }
  const result = JSON.parse(r.stdout);
  const high = (result.findings || []).filter((f) => f.severity === "high");
  return {
    pass: high.length === 0,
    overall: result.overall,
    dimensions: result.dimensions,
    high_findings: high,
  };
}

async function gate3Golden(ir, goldensDir) {
  const id = ir?.artifact?.id;
  if (!id) return { pass: false, skipped: true, reason: "artifact.id 없음" };
  const goldenPath = join(goldensDir, `${id}.ir.json`);
  if (!existsSync(goldenPath)) {
    return { pass: true, skipped: true, reason: `${basename(goldenPath)} 없음 — 회귀 비교 생략` };
  }
  const golden = await loadJson(goldenPath);
  const { default: jsonpatch } = await import("fast-json-patch");
  const patch = jsonpatch.compare(golden, ir);
  // 단순 정책: golden과 동등(no patch)이면 통과. patch 있으면 review_needed.
  return {
    pass: patch.length === 0,
    patch_size: patch.length,
    patch,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const irPath = args[0];
  if (!irPath) {
    process.stderr.write("usage: eval-runner.js <ir-path> [--goldens-dir <dir>]\n");
    process.exit(2);
  }
  const goldensDirIdx = args.indexOf("--goldens-dir");
  const goldensDir = goldensDirIdx >= 0 ? args[goldensDirIdx + 1] : join(ROOT, "goldens");

  const ir = await loadJson(irPath);
  const gate1 = await gate1Schema(ir);
  const gate2 = await runCriticInProcess(ir);
  const gate3 = await gate3Golden(ir, goldensDir);

  let verdict;
  if (!gate1.pass) verdict = "rejected";
  else if (!gate2.pass) verdict = "review_needed";
  else if (!gate3.pass && !gate3.skipped) verdict = "review_needed";
  else verdict = "accepted";

  const out = { gate1, gate2, gate3, verdict };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  process.exit(verdict === "accepted" ? 0 : verdict === "review_needed" ? 1 : 2);
}

main().catch((err) => {
  process.stderr.write(`${err.stack || err}\n`);
  process.exit(1);
});

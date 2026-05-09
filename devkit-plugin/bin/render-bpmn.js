#!/usr/bin/env node
/**
 * render-bpmn — IR workflows[] 를 Mermaid sequenceDiagram 코드로 변환.
 *
 * 진정한 BPMN XML 대신 사용자가 한눈에 보기 좋은 sequence를 사용한다.
 *
 * usage: node bin/render-bpmn.js <ir-path>
 *
 * 출력: stdout — 워크플로우당 한 ```mermaid 블록.
 */

import { readFile } from "node:fs/promises";

function actorOf(action) {
  // "재고.차감" → "재고", "SMS.send" → "SMS"
  if (typeof action !== "string") return "시스템";
  const dot = action.indexOf(".");
  return dot > 0 ? action.slice(0, dot) : action;
}

function verbOf(action) {
  if (typeof action !== "string") return String(action);
  const dot = action.indexOf(".");
  return dot > 0 ? action.slice(dot + 1) : action;
}

function safe(s) {
  return String(s).replace(/[\r\n]+/g, " ").replace(/"/g, "'");
}

// sequenceDiagram의 participant 식별자는 ASCII alphanumeric 권장.
// 한글/특수문자는 ASCII 별칭으로 매핑하고 ` as "한글"` 표기로 표시.
const PALIAS = new Map();
function pid(name) {
  const raw = String(name);
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) return raw;
  if (PALIAS.has(raw)) return PALIAS.get(raw);
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
  const alias = `p_${(h >>> 0).toString(36)}`;
  PALIAS.set(raw, alias);
  return alias;
}
function declareParticipant(name) {
  const id = pid(name);
  const raw = String(name);
  if (id === raw) return `  participant ${id}`;
  return `  participant ${id} as "${raw.replace(/"/g, "'")}"`;
}

function renderWorkflow(wf) {
  const lines = [];
  lines.push(`%% workflow: ${safe(wf.id ?? "(unnamed)")}`);
  lines.push("sequenceDiagram");
  lines.push(declareParticipant("사용자"));
  // 액터 수집
  const actors = new Set();
  for (const s of wf.steps ?? []) {
    actors.add(actorOf(s.action));
  }
  for (const a of actors) {
    lines.push(declareParticipant(a));
  }
  // 트리거
  const trigger = wf.trigger ?? "(트리거 없음)";
  const firstActor = [...actors][0] || "시스템";
  lines.push(`  ${pid("사용자")}->>+${pid(firstActor)}: ${safe(trigger)}`);
  // 스텝
  let prev = firstActor;
  for (const s of wf.steps ?? []) {
    const target = actorOf(s.action);
    const v = verbOf(s.action);
    lines.push(`  ${pid(prev)}->>+${pid(target)}: ${safe(v)}`);
    lines.push(`  ${pid(target)}-->>-${pid(prev)}: 결과`);
    prev = target;
  }
  return "```mermaid\n" + lines.join("\n") + "\n```\n";
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    process.stderr.write("usage: render-bpmn.js <ir-path>\n");
    process.exit(2);
  }
  const ir = JSON.parse(await readFile(path, "utf8"));
  const wfs = ir.workflows ?? [];
  if (wfs.length === 0) {
    process.stdout.write("(워크플로우 없음)\n");
    return;
  }
  process.stdout.write(wfs.map(renderWorkflow).join("\n"));
}

main().catch((err) => {
  process.stderr.write(`${err.stack || err}\n`);
  process.exit(1);
});

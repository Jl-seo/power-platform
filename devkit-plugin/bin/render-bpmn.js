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

function renderWorkflow(wf) {
  const lines = [];
  lines.push(`%% workflow: ${safe(wf.id ?? "(unnamed)")}`);
  lines.push("sequenceDiagram");
  lines.push("  participant 사용자");
  // 액터 수집
  const actors = new Set();
  for (const s of wf.steps ?? []) {
    actors.add(actorOf(s.action));
  }
  for (const a of actors) {
    lines.push(`  participant ${safe(a)}`);
  }
  // 트리거
  const trigger = wf.trigger ?? "(트리거 없음)";
  lines.push(`  사용자->>+${[...actors][0] || "시스템"}: ${safe(trigger)}`);
  // 스텝
  let prev = [...actors][0] || "시스템";
  for (const s of wf.steps ?? []) {
    const target = actorOf(s.action);
    const v = verbOf(s.action);
    lines.push(`  ${prev}->>+${target}: ${safe(v)}`);
    lines.push(`  ${target}-->>-${prev}: 결과`);
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

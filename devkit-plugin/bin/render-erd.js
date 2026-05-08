#!/usr/bin/env node
/**
 * render-erd — IR data 섹션을 Mermaid erDiagram 코드로 변환.
 *
 * usage: node bin/render-erd.js <ir-path>
 *
 * 출력: stdout 에 ```mermaid\n erDiagram\n ...\n``` 블록.
 *       사용자 화면에는 다이어그램 한 장으로 렌더된다 (L2 레이어).
 */

import { readFile } from "node:fs/promises";

const TYPE_MAP = {
  string: "string",
  number: "float",
  integer: "int",
  boolean: "bool",
  date: "date",
  datetime: "datetime",
  ref: "FK",
};

function safeName(s) {
  // Mermaid는 한글 엔티티명을 지원하지만 공백/특수문자 회피
  return String(s).replace(/\s+/g, "_");
}

function renderEntity(e) {
  const name = safeName(e.name);
  const lines = [`  ${name} {`];
  for (const f of e.fields ?? []) {
    const type = TYPE_MAP[f.type] || "string";
    const piiTag = f.pii ? " \"PII\"" : "";
    // PK는 이름이 'id'인 필드만, FK는 type=ref인 필드, 외에 마커 없음
    let marker = "";
    if (f.name === "id") marker = " PK";
    else if (f.type === "ref") marker = " FK";
    lines.push(`    ${type} ${safeName(f.name)}${marker}${piiTag}`);
  }
  lines.push(`  }`);
  return lines.join("\n");
}

function renderRelations(ir) {
  const lines = [];
  for (const e of ir.data?.entities ?? []) {
    for (const f of e.fields ?? []) {
      if (f.type === "ref" && f.ref) {
        // many-to-one: e --> f.ref
        lines.push(`  ${safeName(e.name)} }o--|| ${safeName(f.ref)} : "${safeName(f.name)}"`);
      }
    }
  }
  return lines.join("\n");
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    process.stderr.write("usage: render-erd.js <ir-path>\n");
    process.exit(2);
  }
  const ir = JSON.parse(await readFile(path, "utf8"));
  const entities = (ir.data?.entities ?? []).map(renderEntity).join("\n");
  const rels = renderRelations(ir);
  const block =
    "```mermaid\n" +
    "erDiagram\n" +
    (entities || "  %% (엔티티 없음)") +
    (rels ? "\n" + rels : "") +
    "\n```\n";
  process.stdout.write(block);
}

main().catch((err) => {
  process.stderr.write(`${err.stack || err}\n`);
  process.exit(1);
});

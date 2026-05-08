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
  ref: "string",  // 외래키 자체 타입은 referenced 엔티티의 PK 타입(보통 string). 마커 FK는 별도.
};

// 한글·특수문자가 포함된 식별자를 Mermaid가 안전하게 받도록 ASCII 별칭으로 변환.
// 동일 원본 → 동일 별칭이 되도록 단순 hash 사용.
const ALIAS = new Map();
function safeName(s) {
  const raw = String(s).replace(/\s+/g, "_");
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) return raw;
  if (ALIAS.has(raw)) return ALIAS.get(raw);
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
  const alias = `e_${(h >>> 0).toString(36)}`;
  ALIAS.set(raw, alias);
  return alias;
}
// 실제 한글 이름을 다이어그램 라벨로 보여주려면 별도 표기 필요 — Mermaid erDiagram은
// 식별자 바로 옆 `["라벨"]` 별칭을 지원한다. 첫 정의 시에만 적용한다.
const DEFINED_ALIAS = new Set();
function nameWithLabel(originalName) {
  const id = safeName(originalName);
  if (id === originalName) return id;
  if (DEFINED_ALIAS.has(id)) return id;
  DEFINED_ALIAS.add(id);
  return `${id}["${String(originalName).replace(/"/g, "'")}"]`;
}

function renderEntity(e) {
  const name = nameWithLabel(e.name);
  const lines = [`  ${name} {`];
  for (const f of e.fields ?? []) {
    const type = TYPE_MAP[f.type] || "string";
    const piiTag = f.pii ? " \"PII\"" : "";
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
        // many-to-one: e --> f.ref. 라벨은 컬럼 원래 이름(따옴표로 감싸기 — 한글 OK).
        const label = String(f.name).replace(/"/g, "'");
        lines.push(`  ${safeName(e.name)} }o--|| ${safeName(f.ref)} : "${label}"`);
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

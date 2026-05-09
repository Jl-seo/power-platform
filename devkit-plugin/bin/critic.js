#!/usr/bin/env node
/**
 * critic — IR 자가 비평 결정적 부분.
 *
 * 6 차원 점수(0~1)와 약점 항목을 JSON으로 출력. LLM은 이 결과를 받아
 * 사용자에게 1~3개 개선 제안 카드를 만든다.
 *
 * usage: node bin/critic.js <ir-path>
 *
 * dimensions:
 *   correctness     : 스키마 유효, 참조 무결성
 *   completeness    : 필수 IR 섹션 존재, 필드 RBAC 명시
 *   consistency     : roles 참조 일치, screens.binds → entities 일치
 *   security        : 평문 시크릿 X, PII 자동 분류, role 가드
 *   ux              : user 화면에 admin 필드 노출 X, 화면 이름 자연어
 *   maintainability : 엔티티당 필드 수 합리, 중복 필드명 X
 */

import { readFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(__dirname, "..", "schemas", "ir.schema.json");

const PII_HINTS = ["전화", "phone", "이메일", "email", "주민", "ssn", "주소", "address", "생년", "birth"];
const SECRET_HINTS = ["password", "token", "secret", "apikey", "api_key"];

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function getValidator() {
  const { default: Ajv } = await import("ajv/dist/2020.js");
  const { default: addFormats } = await import("ajv-formats");
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(await loadJson(SCHEMA_PATH));
}

function score(weight, weakness) {
  // weakness는 0..weight 사이로 누적. 점수 = 1 - weakness/weight (음수 방지).
  return Math.max(0, 1 - weakness / weight);
}

async function critique(ir) {
  const findings = []; // { dim, severity: 'low'|'med'|'high', message }
  const validate = await getValidator();
  const schemaValid = validate(ir);

  // ---- correctness ----
  let correctnessW = 0;
  if (!schemaValid) {
    correctnessW += 6;
    for (const e of validate.errors ?? []) {
      findings.push({
        dim: "correctness",
        severity: "high",
        message: `schema: ${e.instancePath || "(root)"} ${e.message}`,
      });
    }
  }
  // 참조 무결성: data.entities[].fields[].ref → 다른 엔티티
  const entityNames = new Set((ir.data?.entities ?? []).map((e) => e.name));
  for (const e of ir.data?.entities ?? []) {
    for (const f of e.fields ?? []) {
      if (f.type === "ref" && f.ref && !entityNames.has(f.ref)) {
        correctnessW += 2;
        findings.push({
          dim: "correctness",
          severity: "high",
          message: `참조 깨짐: ${e.name}.${f.name} → ${f.ref} (없는 엔티티)`,
        });
      }
    }
  }

  // ---- completeness ----
  let completenessW = 0;
  for (const required of ["spec", "roles", "data"]) {
    if (!ir[required]) {
      completenessW += 1.5;
      findings.push({
        dim: "completeness",
        severity: "med",
        message: `IR 섹션 누락: ${required}`,
      });
    }
  }
  for (const e of ir.data?.entities ?? []) {
    for (const f of e.fields ?? []) {
      if (!f.rbac && !["id"].includes(f.name)) {
        completenessW += 0.3;
        findings.push({
          dim: "completeness",
          severity: "low",
          message: `RBAC 미지정: ${e.name}.${f.name}`,
        });
      }
    }
  }

  // ---- consistency ----
  let consistencyW = 0;
  const roleIds = new Set((ir.roles?.roles ?? []).map((r) => r.id));
  // permissions에서 참조한 role이 정의돼 있는지
  const permTargets = ir.roles?.permissions ?? {};
  for (const [section, body] of Object.entries(permTargets)) {
    if (typeof body !== "object" || body === null) continue;
    for (const [target, ops] of Object.entries(body)) {
      if (typeof ops !== "object" || ops === null) continue;
      for (const [op, list] of Object.entries(ops)) {
        if (!Array.isArray(list)) continue;
        for (const r of list) {
          if (typeof r === "string" && !roleIds.has(r)) {
            consistencyW += 1;
            findings.push({
              dim: "consistency",
              severity: "high",
              message: `permissions.${section}.${target}.${op}에 미정의 role: ${r}`,
            });
          }
        }
      }
    }
  }
  // screens.binds → entities 일치
  for (const kind of ["admin", "user"]) {
    for (const s of ir.screens?.[kind] ?? []) {
      if (s.binds && !entityNames.has(s.binds)) {
        consistencyW += 1;
        findings.push({
          dim: "consistency",
          severity: "high",
          message: `screens.${kind}.${s.name}.binds → ${s.binds} (없는 엔티티)`,
        });
      }
    }
  }

  // ---- security ----
  let securityW = 0;
  // 평문 시크릿 검출
  for (const c of ir.deployment?.connections ?? []) {
    for (const [env, b] of Object.entries(c.bindings ?? {})) {
      const flat = JSON.stringify(b).toLowerCase();
      if (!flat.includes("keyvault") && SECRET_HINTS.some((h) => flat.includes(h))) {
        securityW += 3;
        findings.push({
          dim: "security",
          severity: "high",
          message: `평문 시크릿 의심: connection ${c.name} env ${env}`,
        });
      }
    }
  }
  for (const v of ir.deployment?.variables ?? []) {
    if (v.secret && (v.default || Object.values(v.overrides ?? {}).some(Boolean))) {
      securityW += 3;
      findings.push({
        dim: "security",
        severity: "high",
        message: `시크릿 변수에 평문 default/override: ${v.name}`,
      });
    }
  }
  // PII 자동 분류 누락
  for (const e of ir.data?.entities ?? []) {
    for (const f of e.fields ?? []) {
      const lc = (f.name || "").toLowerCase();
      const isPiiCandidate = PII_HINTS.some((h) => lc.includes(h.toLowerCase()));
      if (isPiiCandidate && !f.pii) {
        securityW += 1;
        findings.push({
          dim: "security",
          severity: "med",
          message: `PII 후보 미분류: ${e.name}.${f.name}`,
        });
      }
    }
  }

  // ---- ux ----
  let uxW = 0;
  // user 화면에 admin-only 필드 노출 여부 (RBAC write가 admin뿐인 필드)
  for (const s of ir.screens?.user ?? []) {
    const ent = (ir.data?.entities ?? []).find((e) => e.name === s.binds);
    if (!ent) continue;
    for (const fname of s.fields ?? []) {
      const f = (ent.fields ?? []).find((x) => x.name === fname);
      if (!f) continue;
      const writers = f.rbac?.write ?? [];
      const readers = f.rbac?.read ?? [];
      if (writers.length === 1 && writers[0] === "admin" && !readers.includes("user")) {
        uxW += 1;
        findings.push({
          dim: "ux",
          severity: "med",
          message: `user 화면에 admin-only 필드 노출: ${s.name}.${fname}`,
        });
      }
    }
  }

  // ---- maintainability ----
  let maintainW = 0;
  for (const e of ir.data?.entities ?? []) {
    const fields = e.fields ?? [];
    if (fields.length > 30) {
      maintainW += 2;
      findings.push({
        dim: "maintainability",
        severity: "med",
        message: `엔티티 ${e.name} 필드 ${fields.length}개 — 분할 검토`,
      });
    }
    const names = fields.map((f) => f.name);
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    for (const n of new Set(dup)) {
      maintainW += 2;
      findings.push({
        dim: "maintainability",
        severity: "high",
        message: `중복 필드명: ${e.name}.${n}`,
      });
    }
  }

  const dimensions = {
    correctness:     +score(8, correctnessW).toFixed(3),
    completeness:    +score(6, completenessW).toFixed(3),
    consistency:     +score(6, consistencyW).toFixed(3),
    security:        +score(6, securityW).toFixed(3),
    ux:              +score(4, uxW).toFixed(3),
    maintainability: +score(4, maintainW).toFixed(3),
  };
  const overall = +(
    Object.values(dimensions).reduce((a, b) => a + b, 0) /
    Object.keys(dimensions).length
  ).toFixed(3);

  // 가장 약한 차원 상위 N개 + 그 차원의 finding 1~2개
  const weakest = Object.entries(dimensions)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([dim, score]) => ({
      dim,
      score,
      examples: findings.filter((f) => f.dim === dim).slice(0, 2),
    }))
    .filter((w) => w.score < 1);

  return {
    schemaValid,
    overall,
    dimensions,
    weakest,
    findings,
  };
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    process.stderr.write("usage: critic.js <ir-path>\n");
    process.exit(2);
  }
  const ir = await loadJson(path);
  const result = await critique(ir);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(`${err.stack || err}\n`);
  process.exit(1);
});

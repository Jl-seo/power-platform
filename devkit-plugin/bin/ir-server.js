#!/usr/bin/env node
/**
 * DevKit IR Service — MCP server.
 *
 * Tools:
 *   read_ir       { artifact_path }                       -> IR JSON
 *   patch_ir      { artifact_path, patch: JsonPatch[] }   -> updated IR
 *   validate_ir   { artifact_path } | { ir }              -> { valid, errors }
 *   list_entities { artifact_path }                       -> entity names
 *   diff_ir       { artifact_path, candidate }            -> JsonPatch[]
 *
 * Storage: artifact_path는 워크스페이스 상대경로의 .ir.json 파일.
 *
 * CLI 모드:
 *   --smoke                    : 자체 점검 (의존성 + 샘플 IR 검증)
 *   --validate <path>          : 단일 IR 파일 검증
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SCHEMA_PATH = join(ROOT, "schemas", "ir.schema.json");

async function loadSchema() {
  const buf = await readFile(SCHEMA_PATH, "utf8");
  return JSON.parse(buf);
}

async function readIr(path) {
  const abs = resolve(process.cwd(), path);
  const buf = await readFile(abs, "utf8");
  return { abs, ir: JSON.parse(buf) };
}

async function writeIr(abs, ir) {
  await writeFile(abs, JSON.stringify(ir, null, 2) + "\n", "utf8");
}

async function getValidator() {
  const { default: Ajv } = await import("ajv/dist/2020.js");
  const { default: addFormats } = await import("ajv-formats");
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = await loadSchema();
  return ajv.compile(schema);
}

function summarizeErrors(errors) {
  if (!errors) return [];
  return errors.map((e) => ({
    path: e.instancePath || "(root)",
    message: e.message,
    keyword: e.keyword,
    params: e.params,
  }));
}

async function validateIr(ir) {
  const validate = await getValidator();
  const valid = validate(ir);
  return { valid, errors: summarizeErrors(validate.errors) };
}

async function applyPatch(ir, patch) {
  const { default: jsonpatch } = await import("fast-json-patch");
  const result = jsonpatch.applyPatch(structuredClone(ir), patch, true, false);
  return result.newDocument;
}

async function diffIr(ir, candidate) {
  const { default: jsonpatch } = await import("fast-json-patch");
  return jsonpatch.compare(ir, candidate);
}

function listEntities(ir) {
  return (ir?.data?.entities ?? []).map((e) => e.name);
}

async function runSmoke() {
  process.stdout.write("[devkit-ir] smoke: load schema... ");
  const schema = await loadSchema();
  process.stdout.write(`ok (${schema.title})\n`);

  process.stdout.write("[devkit-ir] smoke: load sample IR... ");
  const samplePath = join(ROOT, "examples", "lob", "order-app.ir.json");
  const { ir } = await readIr(samplePath);
  process.stdout.write(`ok (${ir.artifact.id})\n`);

  process.stdout.write("[devkit-ir] smoke: validate sample IR... ");
  const result = await validateIr(ir);
  if (!result.valid) {
    process.stderr.write(`FAIL\n${JSON.stringify(result.errors, null, 2)}\n`);
    process.exit(1);
  }
  process.stdout.write(`ok\n`);

  process.stdout.write("[devkit-ir] smoke: list_entities... ");
  process.stdout.write(`${listEntities(ir).join(", ")}\n`);

  process.stdout.write("[devkit-ir] smoke: apply minimal patch... ");
  const patched = await applyPatch(ir, [
    { op: "replace", path: "/artifact/version", value: "0.1.1" },
  ]);
  if (patched.artifact.version !== "0.1.1") {
    process.stderr.write(`FAIL\n`);
    process.exit(1);
  }
  process.stdout.write(`ok\n`);

  process.stdout.write("[devkit-ir] smoke: ALL PASS\n");
}

async function runValidate(path) {
  const { ir } = await readIr(path);
  const result = await validateIr(ir);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.valid ? 0 : 1);
}

// ---------- MCP server ----------

async function startMcp() {
  const { Server } = await import("@modelcontextprotocol/sdk/server/index.js");
  const { StdioServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/stdio.js"
  );
  const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
  } = await import("@modelcontextprotocol/sdk/types.js");

  const server = new Server(
    { name: "devkit-ir-service", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  const tools = [
    {
      name: "read_ir",
      description: "워크스페이스의 .ir.json 파일을 읽어 IR 객체를 반환한다.",
      inputSchema: {
        type: "object",
        required: ["artifact_path"],
        properties: { artifact_path: { type: "string" } },
      },
    },
    {
      name: "patch_ir",
      description:
        "IR에 JSON Patch(RFC6902)를 적용하고 파일에 저장. 부분 변경에 사용한다(전체 재생성 금지).",
      inputSchema: {
        type: "object",
        required: ["artifact_path", "patch"],
        properties: {
          artifact_path: { type: "string" },
          patch: { type: "array", items: { type: "object" } },
        },
      },
    },
    {
      name: "validate_ir",
      description:
        "IR을 ir.schema.json 기준 검증. artifact_path 또는 ir 인라인 객체를 받는다.",
      inputSchema: {
        type: "object",
        properties: {
          artifact_path: { type: "string" },
          ir: { type: "object" },
        },
      },
    },
    {
      name: "list_entities",
      description: "IR의 데이터 엔티티 이름 목록을 반환한다.",
      inputSchema: {
        type: "object",
        required: ["artifact_path"],
        properties: { artifact_path: { type: "string" } },
      },
    },
    {
      name: "diff_ir",
      description:
        "현재 IR과 candidate IR 사이의 JSON Patch 시퀀스를 계산한다.",
      inputSchema: {
        type: "object",
        required: ["artifact_path", "candidate"],
        properties: {
          artifact_path: { type: "string" },
          candidate: { type: "object" },
        },
      },
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      if (name === "read_ir") {
        const { ir } = await readIr(args.artifact_path);
        return { content: [{ type: "text", text: JSON.stringify(ir, null, 2) }] };
      }
      if (name === "patch_ir") {
        const { abs, ir } = await readIr(args.artifact_path);
        const next = await applyPatch(ir, args.patch);
        const result = await validateIr(next);
        if (!result.valid) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `validation failed after patch:\n${JSON.stringify(result.errors, null, 2)}`,
              },
            ],
          };
        }
        await writeIr(abs, next);
        return { content: [{ type: "text", text: JSON.stringify(next, null, 2) }] };
      }
      if (name === "validate_ir") {
        const ir = args.ir ?? (await readIr(args.artifact_path)).ir;
        const result = await validateIr(ir);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      if (name === "list_entities") {
        const { ir } = await readIr(args.artifact_path);
        return {
          content: [
            { type: "text", text: JSON.stringify(listEntities(ir), null, 2) },
          ],
        };
      }
      if (name === "diff_ir") {
        const { ir } = await readIr(args.artifact_path);
        const patch = await diffIr(ir, args.candidate);
        return { content: [{ type: "text", text: JSON.stringify(patch, null, 2) }] };
      }
      return {
        isError: true,
        content: [{ type: "text", text: `unknown tool: ${name}` }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `${err.name}: ${err.message}` }],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[devkit-ir] mcp stdio ready\n");
}

// ---------- entry ----------

const argv = process.argv.slice(2);
if (argv.includes("--smoke")) {
  runSmoke().catch((err) => {
    process.stderr.write(`[devkit-ir] smoke FAIL: ${err.stack || err}\n`);
    process.exit(1);
  });
} else if (argv.includes("--validate")) {
  const i = argv.indexOf("--validate");
  const path = argv[i + 1];
  if (!path) {
    process.stderr.write("usage: ir-server.js --validate <path>\n");
    process.exit(2);
  }
  runValidate(path).catch((err) => {
    process.stderr.write(`${err.stack || err}\n`);
    process.exit(1);
  });
} else {
  startMcp().catch((err) => {
    process.stderr.write(`[devkit-ir] mcp FAIL: ${err.stack || err}\n`);
    process.exit(1);
  });
}

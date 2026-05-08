// Chat 백엔드 — 사용자 메시지를 받아 Azure AI Foundry(또는 스텁)에 전달.
// LLM이 함수(tool) 호출을 요청하면 본 모듈이 우리 IR 도구를 실행해 결과를 다시 모델에 돌려준다.
// 전 단계가 끝나면 최종 자연어 응답을 반환. tool 호출 트레이스도 함께.
//
// LLM 어댑터:
//   AZURE_OPENAI_ENDPOINT       (예: https://<resource>.openai.azure.com)
//   AZURE_OPENAI_DEPLOYMENT     (모델 배포 이름, 예: gpt-4o)
//   AZURE_OPENAI_API_KEY        (또는 Entra ID 토큰 — 이번 1차에선 키)
//   AZURE_OPENAI_API_VERSION    (default 2024-08-01-preview)
//
// 위 4개 중 하나라도 빠지면 자동으로 Stub 모드로 동작 (시연/스크린샷용).

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SCHEMA_PATH = join(ROOT, "schemas", "ir.schema.json");
const RENDER_ERD = join(ROOT, "bin", "render-erd.js");
const RENDER_BPMN = join(ROOT, "bin", "render-bpmn.js");
const CRITIC = join(ROOT, "bin", "critic.js");
const EVAL = join(ROOT, "bin", "eval-runner.js");

const ENV = {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview",
};

export function modeStatus() {
  const live = ENV.endpoint && ENV.deployment && ENV.apiKey;
  return live
    ? { mode: "live", model: ENV.deployment }
    : { mode: "stub", model: "(스텁)" };
}

// ---------------- Tool 정의 (OpenAI 함수 호출 형식) ----------------
const TOOLS = [
  {
    type: "function",
    function: {
      name: "read_ir",
      description: "현재 설계도(IR)를 읽는다.",
      parameters: {
        type: "object",
        properties: { artifact_path: { type: "string" } },
        required: ["artifact_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "patch_ir",
      description:
        "설계도에 JSON Patch (RFC6902) 부분 수정을 적용한다. 절대 전체 재작성 금지.",
      parameters: {
        type: "object",
        properties: {
          artifact_path: { type: "string" },
          patch: { type: "array", items: { type: "object" } },
          summary: { type: "string", description: "사용자에게 보여줄 한 줄 요약" },
        },
        required: ["artifact_path", "patch"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "validate_ir",
      description: "현재 설계도를 형식 점검한다.",
      parameters: {
        type: "object",
        properties: { artifact_path: { type: "string" } },
        required: ["artifact_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_entities",
      description: "설계도의 표 목록을 반환한다.",
      parameters: {
        type: "object",
        properties: { artifact_path: { type: "string" } },
        required: ["artifact_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "render_erd",
      description: "표 다이어그램(Mermaid)을 생성한다.",
      parameters: {
        type: "object",
        properties: { artifact_path: { type: "string" } },
        required: ["artifact_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "render_bpmn",
      description: "자동화 흐름 다이어그램(Mermaid)을 생성한다.",
      parameters: {
        type: "object",
        properties: { artifact_path: { type: "string" } },
        required: ["artifact_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "critic",
      description: "설계도 자가 점검 (6 차원 점수).",
      parameters: {
        type: "object",
        properties: { artifact_path: { type: "string" } },
        required: ["artifact_path"],
      },
    },
  },
];

// ---------------- Tool 실행 ----------------
async function execTool(name, args, ctx) {
  const path = args.artifact_path || ctx.defaultPath;
  if (!path) return { error: "artifact_path 가 필요합니다." };
  const abs = resolve(ROOT, path);
  if (!abs.startsWith(ROOT)) return { error: "경로가 허용 범위 밖입니다." };

  if (name === "read_ir") {
    if (!existsSync(abs)) return { error: "파일 없음: " + path };
    return JSON.parse(await readFile(abs, "utf8"));
  }
  if (name === "patch_ir") {
    if (!Array.isArray(args.patch)) return { error: "patch[] 가 필요합니다." };
    if (!existsSync(abs)) return { error: "파일 없음: " + path };
    const ir = JSON.parse(await readFile(abs, "utf8"));
    const { default: jsonpatch } = await import("fast-json-patch");
    const next = jsonpatch.applyPatch(structuredClone(ir), args.patch, true, false).newDocument;
    // 검증
    const { default: Ajv } = await import("ajv/dist/2020.js");
    const { default: addFormats } = await import("ajv-formats");
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(JSON.parse(await readFile(SCHEMA_PATH, "utf8")));
    if (!validate(next)) return { error: "형식 점검 실패", details: validate.errors };
    await writeFile(abs, JSON.stringify(next, null, 2) + "\n", "utf8");
    if (ctx.broadcast) ctx.broadcast({ type: "ir-patched", artifact_path: path });
    return { ok: true, applied: args.patch.length, summary: args.summary || null };
  }
  if (name === "validate_ir") {
    if (!existsSync(abs)) return { error: "파일 없음" };
    const ir = JSON.parse(await readFile(abs, "utf8"));
    const { default: Ajv } = await import("ajv/dist/2020.js");
    const { default: addFormats } = await import("ajv-formats");
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(JSON.parse(await readFile(SCHEMA_PATH, "utf8")));
    return { valid: !!validate(ir), errors: validate.errors || [] };
  }
  if (name === "list_entities") {
    const ir = JSON.parse(await readFile(abs, "utf8"));
    return (ir.data?.entities || []).map((e) => e.name);
  }
  if (name === "render_erd") {
    const r = spawnSync(process.execPath, [RENDER_ERD, abs], { encoding: "utf8" });
    return { mermaid: (r.stdout || "").trim() };
  }
  if (name === "render_bpmn") {
    const r = spawnSync(process.execPath, [RENDER_BPMN, abs], { encoding: "utf8" });
    return { mermaid: (r.stdout || "").trim() };
  }
  if (name === "critic") {
    const r = spawnSync(process.execPath, [CRITIC, abs], { encoding: "utf8" });
    if (r.status !== 0) return { error: r.stderr || "critic failed" };
    return JSON.parse(r.stdout);
  }
  return { error: "알 수 없는 도구: " + name };
}

function briefForTool(name, args, result) {
  const summary = (() => {
    if (name === "read_ir") return `${args.artifact_path}`;
    if (name === "patch_ir") return `${(args.patch || []).length} 변경`;
    if (name === "validate_ir") return result.valid ? "통과" : "미통과";
    if (name === "list_entities") return Array.isArray(result) ? result.join(", ") : "";
    if (name === "critic") return result.overall != null ? `종합 ${(result.overall * 100).toFixed(0)}점` : "";
    return "";
  })();
  return summary;
}

// ---------------- Foundry (OpenAI-compatible) 호출 ----------------
async function callFoundry(messages) {
  const url = `${ENV.endpoint.replace(/\/$/, "")}/openai/deployments/${ENV.deployment}/chat/completions?api-version=${ENV.apiVersion}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": ENV.apiKey,
    },
    body: JSON.stringify({
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Foundry ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// ---------------- 시스템 프롬프트 ----------------
const SYSTEM_PROMPT = `당신은 사내 LOB 앱 빌더 DevKit의 AI 도우미입니다.

원칙:
1. 사용자에게 답할 때는 일반인 한국어만 사용. IR/RBAC/PII/JSON Patch 같은 약어는 풀어서.
   예: "설계도", "권한(누가 쓸 수 있는지)", "개인정보", "부분 수정".
2. 산출물을 바꾸려면 patch_ir 함수만 사용. 절대 "전체 다시 만들기" 금지 — 항상 부분 변경.
3. 모호하면 추정한 가정을 밝히고 한 가지만 묻는다. 한 번에 1~3개 질문, 4개 넘기지 마라.
4. 변경 후엔 critic 으로 자가 점검하고 약점이 있으면 사용자에게 짧은 카드로 알린다.
5. 사용자에게는 "되었어요" / "한 가지만 봐주세요" / "못 했어요" 의 3종 카드 형식 권장.

도구 사용:
- read_ir: 현재 설계도 읽기 (내용 큰 경우 list_entities 같이 활용)
- patch_ir: 부분 변경 (RFC6902 JSON Patch 배열)
- validate_ir: 형식 점검
- list_entities: 표 이름 목록
- render_erd / render_bpmn: 다이어그램 (사용자가 보고 있을 수 있음)
- critic: 자가 점검 (6 차원 점수)

응답은 짧고 명확하게.`;

// ---------------- 메인 진입점 ----------------
export async function chat({ history, artifactPath, broadcast }) {
  const ctx = { defaultPath: artifactPath, broadcast };
  const trace = [];

  // 살아있는 LLM 호출
  if (modeStatus().mode === "live") {
    const messages = [
      { role: "system", content: SYSTEM_PROMPT + (artifactPath ? `\n\n현재 설계도: ${artifactPath}` : "") },
      ...history,
    ];
    let safety = 6;
    while (safety-- > 0) {
      const resp = await callFoundry(messages);
      const choice = resp.choices?.[0];
      if (!choice) throw new Error("LLM 응답 없음");
      const msg = choice.message;
      messages.push(msg);
      if (msg.tool_calls && msg.tool_calls.length) {
        for (const tc of msg.tool_calls) {
          let args;
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch { args = {}; }
          let result;
          try { result = await execTool(tc.function.name, args, ctx); }
          catch (err) { result = { error: String(err.message) }; }
          trace.push({
            tool: tc.function.name,
            summary: argsSummary(tc.function.name, args),
            result_brief: briefForTool(tc.function.name, args, result),
          });
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result).slice(0, 4000),
          });
        }
        continue; // 다음 턴
      }
      // 더 이상 도구 호출 없음 → 최종 응답
      return { message: msg.content || "", trace };
    }
    return { message: "(도구 호출 한도 초과)", trace };
  }

  // 스텁 모드 — 결정론적 시연
  return stubChat({ history, artifactPath, ctx, trace });
}

function argsSummary(name, args) {
  if (name === "patch_ir") return `${(args.patch || []).length} 변경${args.summary ? ` · ${args.summary}` : ""}`;
  return args.artifact_path ? args.artifact_path.split("/").pop() : "";
}

// ---------------- 스텁 ----------------
async function stubChat({ history, artifactPath, ctx, trace }) {
  const last = (history[history.length - 1]?.content || "").trim();
  const path = artifactPath || "examples/lob/order-app.ir.json";

  // 결제 상태 추가 데모 (순서 중요: "상태" 키워드가 위 critic 루트와 겹치므로 먼저 검사)
  if (/(추가|넣어|만들어).*?(결제|상태|컬럼|항목|필드)/.test(last) ||
      /(결제|상태|컬럼|항목|필드).*?(추가|넣어|만들어)/.test(last)) {
    const ir = await execTool("read_ir", { artifact_path: path }, ctx);
    const idx = (ir.data?.entities || []).findIndex((e) => e.name === "주문");
    if (idx < 0) return { message: "주문 표를 찾지 못했어요. 표 이름을 알려주실래요?", trace };
    const patch = [
      { op: "add", path: `/data/entities/${idx}/fields/-`,
        value: { name: "결제상태", type: "string", required: true } },
    ];
    const r = await execTool("patch_ir", { artifact_path: path, patch, summary: "주문에 결제상태 추가" }, ctx);
    trace.push({ tool: "patch_ir", summary: "1 변경 · 주문에 결제상태 추가", result_brief: r.ok ? "ok" : "fail" });
    return { message: "주문 표에 결제상태 항목을 더했어요. 오른쪽 미리보기에서 확인하실 수 있어요.", trace };
  }

  // 표 목록
  if (/(표|엔티티|목록).*?(보여|뭐|있|줘)/.test(last) || /목록 보여/.test(last)) {
    const list = await execTool("list_entities", { artifact_path: path }, ctx);
    trace.push({ tool: "list_entities", summary: path, result_brief: Array.isArray(list) ? list.join(", ") : "?" });
    return { message: `표는 ${list.length}개 있어요: ${list.join(", ")}`, trace };
  }

  // 자가 점검 / 점검해줘
  if (/(점검|체크|괜찮|어떤지)/.test(last)) {
    const r = await execTool("critic", { artifact_path: path }, ctx);
    trace.push({ tool: "critic", summary: path, result_brief: r.overall ? `종합 ${(r.overall * 100).toFixed(0)}점` : "?" });
    return {
      message: `자가 점검 했어요. 종합 ${(r.overall * 100).toFixed(0)}점이에요.\n` +
               (r.weakest && r.weakest.length
                 ? `짚어볼 곳: ${r.weakest.map((w) => w.dim).join(", ")}`
                 : "특별히 짚을 곳은 없어요."),
      trace,
    };
  }

  // 기본 안내
  return {
    message:
      "🧪 시뮬레이션 모드예요 (Azure AI Foundry 키 없음).\n\n" +
      "지금 시연 가능한 명령:\n" +
      "• \"표 목록 보여줘\"\n" +
      "• \"주문에 결제상태 추가해줘\"\n" +
      "• \"점검해줘\"\n\n" +
      "실 LLM은 환경변수 4개를 채워주세요:\n" +
      "AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_DEPLOYMENT / AZURE_OPENAI_API_KEY / AZURE_OPENAI_API_VERSION",
    trace,
  };
}

// 대화하며 만들기 — 좌 채팅 / 우 미리보기.
// 사용자에게 보이는 모든 단어는 일반인 한국어. IR/RBAC/PII 등 약어는 풀어서.

const log = document.getElementById("chat-log");
const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const status = document.getElementById("chat-status");
const sendBtn = document.getElementById("chat-send");
const target = document.getElementById("ir-target");
const modePill = document.getElementById("chat-mode");
const previewFrame = document.getElementById("preview-frame");
const previewTabs = document.querySelectorAll(".preview-tabs .tab");

const FRAME_URL = {
  canvas: () => `/canvas`,
  dashboard: () => `/dashboard`,
  admin: () => `/admin`,
};

previewTabs.forEach((t) =>
  t.addEventListener("click", () => {
    previewTabs.forEach((x) => x.classList.toggle("is-active", x === t));
    previewFrame.src = FRAME_URL[t.dataset.frame]();
  }),
);

// 메시지 누적 (LLM 컨텍스트로 그대로 백엔드에 보냄)
const history = [];

function addMessage(role, text, kind) {
  const msg = document.createElement("div");
  msg.className = "msg " + (kind || (role === "user" ? "msg-user" : "msg-bot"));
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  msg.appendChild(bubble);
  log.appendChild(msg);
  log.scrollTop = log.scrollHeight;
  return bubble;
}

async function loadIrList() {
  try {
    const { files } = await (await fetch("/api/ir/list")).json();
    target.innerHTML = "";
    if (!files || files.length === 0) {
      target.innerHTML = `<option value="">설계도 없음 — 새로 만들어볼게요</option>`;
      return;
    }
    for (const f of files) {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      target.appendChild(opt);
    }
  } catch (err) {
    target.innerHTML = `<option>오류: ${err.message}</option>`;
  }
}
loadIrList();

async function detectMode() {
  try {
    const r = await (await fetch("/api/chat/mode")).json();
    modePill.hidden = false;
    modePill.textContent = r.mode === "live" ? `🤖 ${r.model || "Foundry"} 연결됨` : "🧪 시뮬레이션 모드";
    modePill.style.background = r.mode === "live" ? "#e8f5e9" : "#fff7e0";
    modePill.style.color = r.mode === "live" ? "#1f6f3d" : "#7a5b00";
  } catch {
    modePill.hidden = true;
  }
}
detectMode();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  sendBtn.disabled = true;
  status.textContent = "생각하는 중…";

  history.push({ role: "user", content: text });
  addMessage("user", text);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artifact_path: target.value || null,
        history,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      addMessage("bot", `❌ 오류: ${err}`);
    } else {
      const data = await res.json();
      // tool 호출 트레이스
      for (const step of data.trace || []) {
        addMessage("tool", `🔧 ${step.tool}(${step.summary || ""}) → ${step.result_brief || "ok"}`, "msg-tool");
      }
      // 본문 응답
      if (data.message) {
        history.push({ role: "assistant", content: data.message });
        addMessage("bot", data.message);
      }
      // 미리보기 갱신 (현재 탭이 canvas면 reload)
      const activeFrame = document.querySelector(".preview-tabs .tab.is-active")?.dataset.frame;
      if (activeFrame === "canvas" || activeFrame === "dashboard") {
        previewFrame.contentWindow?.location.reload();
      }
    }
  } catch (err) {
    addMessage("bot", `❌ 통신 오류: ${err.message}`);
  } finally {
    status.textContent = "";
    sendBtn.disabled = false;
    input.focus();
  }
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

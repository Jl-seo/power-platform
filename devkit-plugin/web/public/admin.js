// Admin Console — fetches /api/* and renders.
// 사용자에게 보이는 모든 단어는 일반인 한국어. IR/RBAC/PII 같은 약어 노출 금지.

const tabs = document.querySelectorAll(".tab");
const panes = document.querySelectorAll(".pane");
tabs.forEach((t) => t.addEventListener("click", () => activate(t.dataset.tab)));

function activate(name) {
  tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.tab === name));
  panes.forEach((p) => p.classList.toggle("is-active", p.id === `pane-${name}`));
}

// ---- 화이트리스트 (templates index.yaml — text/plain) ----
async function loadTemplates() {
  const el = document.getElementById("templates-list");
  try {
    const txt = await (await fetch("/api/templates")).text();
    // 간이 yaml 파싱: id/title/summary/tags 만 추출
    const blocks = txt.split(/\n  - id:/).slice(1);
    if (blocks.length === 0) {
      el.textContent = "등록된 템플릿이 없어요.";
      return;
    }
    el.innerHTML = "";
    for (const blk of blocks) {
      const id = (blk.match(/^\s*([a-z0-9-]+)/) || [])[1] || "(이름 없음)";
      const title = (blk.match(/title:\s*"([^"]+)"/) || [])[1] || "";
      const summary = (blk.match(/summary:\s*"([^"]+)"/) || [])[1] || "";
      const tags = (blk.match(/tags:\s*\[([^\]]+)\]/) || [])[1] || "";
      const card = document.createElement("div");
      card.className = "list-item";
      card.innerHTML =
        `<h4>${escapeHtml(title)} <span class="muted">(${escapeHtml(id)})</span></h4>` +
        `<div>${escapeHtml(summary)}</div>` +
        `<div class="tags">분류: ${escapeHtml(tags)}</div>`;
      el.appendChild(card);
    }
  } catch (err) {
    el.textContent = "불러오지 못했어요: " + err.message;
  }
}

// ---- 정책 (편집 가능) ----
const STAGE_ORDER = ["sandbox", "team", "prod", "external"];
const STAGE_LABEL = { sandbox: "내 작업방", team: "팀 공용", prod: "실서비스", external: "외부 노출" };
let policiesOriginal = null;

async function loadPolicies() {
  const form = document.getElementById("policies-form");
  try {
    const data = await (await fetch("/api/policies")).json();
    policiesOriginal = JSON.parse(JSON.stringify(data));
    renderPolicyForm(data);
  } catch (err) {
    form.textContent = "불러오지 못했어요: " + err.message;
  }
}

function renderPolicyForm(data) {
  const form = document.getElementById("policies-form");
  const stages = data.trustGate || {};
  form.innerHTML =
    STAGE_ORDER.map((k) => {
      const s = stages[k] || {};
      return `
      <div class="list-item">
        <h4>${STAGE_LABEL[k]}</h4>
        <label class="field"><span>점검 강도</span>
          <input data-stage="${k}" data-key="gate" value="${escapeHtml(s.gate || "")}" />
        </label>
        <label class="field"><span>설명 (사용자에게 보이는 한 줄)</span>
          <input data-stage="${k}" data-key="note" value="${escapeHtml(s.note || "")}" />
        </label>
      </div>`;
    }).join("") +
    `<div class="list-item"><h4>전반</h4>
      <label class="field"><span>적용 강도 한 줄 안내</span>
        <input id="enforcement" value="${escapeHtml(data.enforcement || "")}" />
      </label>
      <label class="field"><span>비밀번호/토큰 정책 한 줄</span>
        <input id="secrets" value="${escapeHtml(data.secrets || "")}" />
      </label>
    </div>`;
}

function collectPolicyForm() {
  const next = { trustGate: {} };
  for (const stage of STAGE_ORDER) {
    const gate = document.querySelector(`input[data-stage="${stage}"][data-key="gate"]`).value;
    const note = document.querySelector(`input[data-stage="${stage}"][data-key="note"]`).value;
    next.trustGate[stage] = { gate, note };
  }
  next.enforcement = document.getElementById("enforcement").value;
  next.secrets = document.getElementById("secrets").value;
  return next;
}

document.getElementById("policies-save").addEventListener("click", async () => {
  const status = document.getElementById("policies-status");
  status.textContent = "저장 중…";
  try {
    const next = collectPolicyForm();
    const r = await fetch("/api/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "저장 실패");
    policiesOriginal = JSON.parse(JSON.stringify(j.policies));
    status.textContent = "✅ 저장 완료";
    setTimeout(() => (status.textContent = ""), 2000);
  } catch (err) {
    status.textContent = "❌ " + err.message;
  }
});
document.getElementById("policies-reset").addEventListener("click", () => {
  if (policiesOriginal) renderPolicyForm(policiesOriginal);
});

// ---- 감사 로그 ----
async function loadAudit() {
  try {
    const data = await (await fetch("/api/audit?limit=100")).json();
    document.getElementById("trustgate-log").textContent =
      data.trustGate.length === 0
        ? "기록 없음"
        : data.trustGate.map(formatTg).join("\n");
    document.getElementById("telemetry-log").textContent =
      data.telemetry.length === 0
        ? "기록 없음"
        : data.telemetry.map(formatTm).join("\n");
  } catch (err) {
    document.getElementById("trustgate-log").textContent = "불러오지 못했어요: " + err.message;
  }
}

function formatTg(e) {
  const at = (e.at || "").replace("T", " ").replace("Z", "");
  return `[${at}] 도구=${e.tool || "?"}  위험=${e.risk || "none"}`;
}
function formatTm(e) {
  const at = (e.at || "").replace("T", " ").replace("Z", "");
  const p = e.payload || {};
  const tool = p.tool_name || p.feature || p.event || "(이벤트)";
  return `[${at}] ${tool}`;
}

// ---- 비용 ----
async function loadCost() {
  const el = document.getElementById("cost-content");
  try {
    const data = await (await fetch("/api/cost")).json();
    const rows = Object.entries(data.byTeam || {})
      .sort((a, b) => b[1] - a[1])
      .map(([team, tok]) => `<div class="list-item"><h4>${escapeHtml(team)}</h4>
                              <div>누적 토큰: <b>${tok.toLocaleString()}</b></div></div>`)
      .join("");
    el.innerHTML =
      `<div class="muted">${escapeHtml(data.note)}</div>` +
      `<div class="list-item"><h4>전체</h4>
        <div>누적 토큰: <b>${(data.totalTokens || 0).toLocaleString()}</b></div>
        <div class="muted">표본: 최근 ${data.sampleSize || 0}건</div></div>` +
      (rows || `<div class="muted">팀별 데이터 없음</div>`);
  } catch (err) {
    el.textContent = "불러오지 못했어요: " + err.message;
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

// 초기 로드
loadTemplates();
loadPolicies();
loadAudit();
loadCost();

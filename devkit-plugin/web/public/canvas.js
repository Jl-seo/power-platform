// L3 Canvas viewer — IR을 4 영역(한눈에/데이터/화면/자동화/자가점검)으로 분할 렌더.
// 일반인 한국어. 약어 노출 금지.

mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });

const tabs = document.querySelectorAll(".tab");
const panes = document.querySelectorAll(".pane");
tabs.forEach((t) => t.addEventListener("click", () => activate(t.dataset.tab)));
function activate(name) {
  tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.tab === name));
  panes.forEach((p) => p.classList.toggle("is-active", p.id === `pane-${name}`));
}

const sel = document.getElementById("ir-select");
document.getElementById("reload").addEventListener("click", () => loadIr(sel.value));
sel.addEventListener("change", () => loadIr(sel.value));

(async function init() {
  try {
    const { files } = await (await fetch("/api/ir/list")).json();
    sel.innerHTML = "";
    if (!files || files.length === 0) {
      sel.innerHTML = `<option>설계도가 없어요</option>`;
      return;
    }
    for (const f of files) {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      sel.appendChild(opt);
    }
    loadIr(sel.value);
  } catch (err) {
    sel.innerHTML = `<option>오류: ${err.message}</option>`;
  }
})();

async function loadIr(path) {
  if (!path) return;
  try {
    const data = await (await fetch(`/api/ir/load?path=${encodeURIComponent(path)}`)).json();
    if (data.error) throw new Error(data.error);
    renderOverview(data);
    await renderMermaid("erd", data.erd_mermaid);
    renderScreens(data.ir);
    await renderMermaid("bpmn", data.bpmn_mermaid);
    renderCritique(data.critique);
  } catch (err) {
    document.getElementById("overview-summary").textContent = "불러오지 못했어요: " + err.message;
  }
}

function renderOverview(data) {
  const el = document.getElementById("overview-summary");
  const ir = data.ir || {};
  const a = ir.artifact || {};
  const intent = ir.spec?.intent || "(설명 없음)";
  const entCount = (ir.data?.entities || []).length;
  const screenCount =
    (ir.screens?.user || []).length + (ir.screens?.admin || []).length;
  const wfCount = (ir.workflows || []).length;
  const score = data.critique?.overall;
  el.innerHTML = `
    <h2>${escapeHtml(a.id || "(이름 없음)")} <span class="muted">v${escapeHtml(a.version || "?")}</span></h2>
    <p>${escapeHtml(intent)}</p>
    <div class="score-grid">
      <div class="score"><div class="name">데이터 표</div><div class="val">${entCount}</div></div>
      <div class="score"><div class="name">화면</div><div class="val">${screenCount}</div></div>
      <div class="score"><div class="name">자동화</div><div class="val">${wfCount}</div></div>
    </div>
    ${score != null ? `<p class="muted">자가 점검 종합: <b>${(score * 100).toFixed(0)}점</b> / 100</p>` : ""}
  `;
}

async function renderMermaid(elId, raw) {
  const el = document.getElementById(elId);
  el.innerHTML = "";
  if (!raw) { el.textContent = "(없음)"; return; }
  // ```mermaid ... ``` 블록을 벗기기
  const m = raw.match(/```mermaid\s*([\s\S]*?)```/);
  const code = m ? m[1].trim() : raw.trim();
  try {
    const { svg } = await mermaid.render(`m-${elId}-${Date.now()}`, code);
    el.innerHTML = svg;
  } catch (err) {
    el.innerHTML = `<pre>렌더 실패: ${escapeHtml(err.message)}\n\n${escapeHtml(code)}</pre>`;
  }
}

function renderScreens(ir) {
  const userEl = document.getElementById("screens-user");
  const adminEl = document.getElementById("screens-admin");
  userEl.innerHTML = card(ir.screens?.user || []);
  adminEl.innerHTML = card(ir.screens?.admin || []);
}
function card(list) {
  if (list.length === 0) return `<div class="muted">없음</div>`;
  return list.map((s) => `
    <div class="screen-card">
      <div class="name">${escapeHtml(s.name || "(이름 없음)")}</div>
      <div class="binds">표: ${escapeHtml(s.binds || "-")}</div>
      ${s.fields ? `<ul>${s.fields.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>` : ""}
    </div>
  `).join("");
}

function renderCritique(c) {
  const el = document.getElementById("critique-summary");
  if (!c) { el.textContent = "자가 점검 결과가 없어요."; return; }
  const labelMap = {
    correctness: "정확성",
    completeness: "빠짐없음",
    consistency: "어긋남 없음",
    security: "보안",
    ux: "사용성",
    maintainability: "유지보수",
  };
  const dims = c.dimensions || {};
  const rows = Object.entries(dims).map(([k, v]) => {
    const cls = v >= 0.85 ? "good" : v >= 0.6 ? "warn" : "bad";
    return `<div class="score ${cls}">
      <div class="name">${labelMap[k] || k}</div>
      <div class="val">${(v * 100).toFixed(0)}</div>
    </div>`;
  }).join("");
  const weakest = (c.weakest || []).map((w) => `
    <div class="list-item"><h4>${labelMap[w.dim] || w.dim} (${(w.score * 100).toFixed(0)}점)</h4>
      ${(w.examples || []).map((e) => `<div>• ${escapeHtml(e.message)}</div>`).join("")}
    </div>`).join("");
  el.innerHTML = `
    <p>종합 <b>${(c.overall * 100).toFixed(0)}점</b> / 100</p>
    <div class="score-grid">${rows}</div>
    ${weakest ? `<h3 style="margin-top:18px">짚어볼 것</h3>${weakest}` : ""}
  `;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

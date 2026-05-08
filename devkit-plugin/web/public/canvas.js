// L3 Canvas viewer — IR을 4 영역(한눈에/데이터/화면/자동화/자가점검)으로 분할 렌더.
// 일반인 한국어. 약어 노출 금지.
// window.__DATA_CANVAS 가 있으면(데모 모드) fetch 대신 그 데이터를 사용한다.

const DEMO = !!window.__DATA_CANVAS;
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
    let files;
    if (DEMO) {
      files = window.__DATA_CANVAS.list?.files || [];
    } else {
      ({ files } = await (await fetch("/api/ir/list")).json());
    }
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
    if (DEMO) {
      // 미리보기 모드 안내 + 편집 버튼 비활성화
      const banner = document.createElement("div");
      banner.style.cssText = "padding:10px 24px;background:#fff7e0;color:#7a5b00;font-size:12px";
      banner.textContent = "🔍 미리보기 모드 — 변경/저장은 동작하지 않아요. 서버를 띄우면 모두 작동합니다.";
      document.body.insertBefore(banner, document.querySelector(".picker"));
      // 편집 버튼들 비활성화
      const disable = () => {
        document.querySelectorAll('button[data-act], #add-entity').forEach((b) => (b.disabled = true));
      };
      disable();
      // entitiesEdit가 다시 그려질 때마다 다시 비활성화
      const observer = new MutationObserver(disable);
      observer.observe(document.getElementById("entities-edit"), { childList: true });
    }
  } catch (err) {
    sel.innerHTML = `<option>오류: ${err.message}</option>`;
  }
})();

let currentPath = null;
let currentIr = null;

async function loadIr(path) {
  if (!path) return;
  currentPath = path;
  if (!DEMO) setupWebSocket(path);
  try {
    let data;
    if (DEMO) {
      data = window.__DATA_CANVAS.load?.[path];
      if (!data) throw new Error("미리보기 모드: 해당 설계도 데이터가 없어요");
    } else {
      data = await (await fetch(`/api/ir/load?path=${encodeURIComponent(path)}`)).json();
      if (data.error) throw new Error(data.error);
    }
    currentIr = data.ir;
    renderOverview(data);
    await renderMermaid("erd", data.erd_mermaid);
    renderEntitiesEdit(data.ir);
    renderScreens(data.ir);
    await renderMermaid("bpmn", data.bpmn_mermaid);
    renderCritique(data.critique);
  } catch (err) {
    document.getElementById("overview-summary").textContent = "불러오지 못했어요: " + err.message;
  }
}

// ---- WebSocket presence + 라이브 갱신 ----
let ws = null;
function setupWebSocket(path) {
  if (ws) try { ws.close(); } catch {}
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws?path=${encodeURIComponent(path)}`);
  ws.addEventListener("message", (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.type === "presence") {
      const pill = document.getElementById("presence");
      pill.hidden = false;
      pill.textContent = `👤 ${msg.count}명`;
    }
    if (msg.type === "ir-patched" && msg.artifact_path === currentPath) {
      // 다른 사용자가 변경 → 다시 불러오기
      loadIr(currentPath);
    }
  });
  ws.addEventListener("close", () => {
    document.getElementById("presence").hidden = true;
  });
}

// ---- 표·필드 편집 UI ----
function renderEntitiesEdit(ir) {
  const root = document.getElementById("entities-edit");
  const entities = ir.data?.entities || [];
  if (entities.length === 0) {
    root.innerHTML = `<div class="muted">표가 없어요. <b>+ 표 추가</b>로 시작하세요.</div>`;
    return;
  }
  root.innerHTML = entities.map((e, i) => `
    <div class="list-item">
      <div class="row-edit">
        <strong class="grow">${escapeHtml(e.name)} <span class="muted">(${(e.fields || []).length}개 항목)</span></strong>
        <button class="btn" data-act="rename-entity" data-idx="${i}">이름 바꾸기</button>
        <button class="btn" data-act="add-field" data-idx="${i}">+ 항목 추가</button>
        <button class="btn danger" data-act="delete-entity" data-idx="${i}">삭제</button>
      </div>
      ${(e.fields || []).map((f, j) => `
        <div class="row-edit">
          <span class="grow">${escapeHtml(f.name)} <span class="muted">(${escapeHtml(f.type)}${f.required ? ", 필수" : ""}${f.pii ? ", 개인정보" : ""})</span></span>
          <button class="btn danger" data-act="delete-field" data-idx="${i}" data-fidx="${j}">삭제</button>
        </div>
      `).join("")}
    </div>
  `).join("");

  root.querySelectorAll("button[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => handleEntityAction(btn));
  });
}

document.getElementById("add-entity").addEventListener("click", () => promptAddEntity());
document.getElementById("modal-ok").addEventListener("click", () => { /* form submit handled by native dialog */ });

async function handleEntityAction(btn) {
  const act = btn.dataset.act;
  const idx = +btn.dataset.idx;
  if (act === "rename-entity") {
    const cur = currentIr.data.entities[idx].name;
    const next = await openModal("표 이름 바꾸기", [
      { id: "name", label: "새 이름", type: "text", value: cur },
    ]);
    if (!next || !next.name || next.name === cur) return;
    await sendPatch([{ op: "replace", path: `/data/entities/${idx}/name`, value: next.name }], "이름을 바꿨어요.");
  } else if (act === "delete-entity") {
    if (!confirm(`표 "${currentIr.data.entities[idx].name}"을(를) 정말 지울까요?`)) return;
    await sendPatch([{ op: "remove", path: `/data/entities/${idx}` }], "표를 지웠어요.");
  } else if (act === "add-field") {
    const next = await openModal("항목 추가", [
      { id: "name", label: "이름", type: "text" },
      { id: "type", label: "형식", type: "select", options: ["string", "number", "integer", "boolean", "date", "datetime", "ref"], value: "string" },
      { id: "required", label: "필수?", type: "checkbox" },
      { id: "pii", label: "개인정보?", type: "checkbox" },
    ]);
    if (!next || !next.name) return;
    const field = { name: next.name, type: next.type };
    if (next.required) field.required = true;
    if (next.pii) field.pii = true;
    await sendPatch([{ op: "add", path: `/data/entities/${idx}/fields/-`, value: field }], "항목을 더했어요.");
  } else if (act === "delete-field") {
    const fidx = +btn.dataset.fidx;
    const fname = currentIr.data.entities[idx].fields[fidx].name;
    if (!confirm(`항목 "${fname}"을(를) 지울까요?`)) return;
    await sendPatch([{ op: "remove", path: `/data/entities/${idx}/fields/${fidx}` }], "항목을 지웠어요.");
  }
}

async function promptAddEntity() {
  const next = await openModal("표 추가", [
    { id: "name", label: "표 이름", type: "text" },
  ]);
  if (!next || !next.name) return;
  const idx = (currentIr.data?.entities || []).length;
  // 표가 0개일 수 있으므로 data/entities 자체가 없을 수 있다
  const ops = [];
  if (!currentIr.data) ops.push({ op: "add", path: "/data", value: { entities: [] } });
  if (!currentIr.data?.entities) ops.push({ op: "add", path: "/data/entities", value: [] });
  ops.push({
    op: "add",
    path: `/data/entities/${idx}`,
    value: { name: next.name, fields: [{ name: "id", type: "string", required: true }] },
  });
  await sendPatch(ops, "새 표를 만들었어요.");
}

async function sendPatch(patch, successMsg) {
  const status = document.getElementById("data-status");
  status.textContent = "저장 중…";
  try {
    const r = await fetch("/api/ir/patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artifact_path: currentPath, patch }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || (j.details ? JSON.stringify(j.details) : "저장 실패"));
    status.textContent = "✅ " + (successMsg || "저장 완료");
    await loadIr(currentPath);
    setTimeout(() => (status.textContent = ""), 2500);
  } catch (err) {
    status.textContent = "❌ " + err.message;
  }
}

// ---- 모달 ----
function openModal(title, fields) {
  const dlg = document.getElementById("modal");
  document.getElementById("modal-title").textContent = title;
  const body = document.getElementById("modal-body");
  body.innerHTML = fields.map((f) => {
    if (f.type === "select") {
      const opts = (f.options || []).map((o) => `<option value="${escapeHtml(o)}" ${o === f.value ? "selected" : ""}>${escapeHtml(o)}</option>`).join("");
      return `<label class="field"><span>${escapeHtml(f.label)}</span><select id="m-${f.id}">${opts}</select></label>`;
    } else if (f.type === "checkbox") {
      return `<label class="field"><span>${escapeHtml(f.label)}</span><input type="checkbox" id="m-${f.id}" ${f.value ? "checked" : ""} /></label>`;
    } else {
      return `<label class="field"><span>${escapeHtml(f.label)}</span><input id="m-${f.id}" value="${escapeHtml(f.value ?? "")}" /></label>`;
    }
  }).join("");
  return new Promise((resolveP) => {
    dlg.showModal();
    function onClose() {
      dlg.removeEventListener("close", onClose);
      if (dlg.returnValue !== "ok") return resolveP(null);
      const result = {};
      for (const f of fields) {
        const el = document.getElementById(`m-${f.id}`);
        result[f.id] = f.type === "checkbox" ? el.checked : el.value;
      }
      resolveP(result);
    }
    dlg.addEventListener("close", onClose);
  });
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

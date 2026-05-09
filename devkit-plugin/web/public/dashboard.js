// 대시보드 — Chart.js로 3장. Power BI 연동은 운영에서.
// window.__DATA_DASHBOARD 가 있으면(데모 모드) fetch 대신 그 데이터를 사용한다.

const DEMO = !!window.__DATA_DASHBOARD;
const HAS_CHART = typeof window.Chart !== "undefined";
const charts = {};

function fallback(id, labels, data, label = "") {
  const wrap = document.getElementById(id).closest(".canvas-wrap");
  if (!wrap) return;
  const total = data.reduce((a, b) => a + (Array.isArray(b) ? b.reduce((x,y)=>x+y,0) : b), 0);
  const rows = labels.map((l, i) => `<div>${l}: <b>${Array.isArray(data[i]) ? data[i].join(" / ") : data[i]}</b></div>`).join("");
  wrap.innerHTML = `<div class="muted" style="padding:8px">${label}</div>${rows}<div class="muted">합계: ${total}</div>`;
}

function makeBar(id, labels, data, color = "#1a73e8") {
  if (!HAS_CHART) return fallback(id, labels, data, "(차트 라이브러리 미로딩 — 표 형태로 표시)");
  const ctx = document.getElementById(id).getContext("2d");
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ data, backgroundColor: color, borderRadius: 6 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

function makeStackedBar(id, labels, datasets) {
  if (!HAS_CHART) {
    const data = labels.map((_, i) => datasets.map((d) => d.data[i]));
    return fallback(id, labels, data, "(차트 라이브러리 미로딩 — 표 형태로 표시)");
  }
  const ctx = document.getElementById(id).getContext("2d");
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

async function load() {
  try {
    const data = DEMO
      ? window.__DATA_DASHBOARD
      : await (await fetch("/api/dashboard")).json();
    document.getElementById("sample-size").textContent = `표본 ${data.sampleSize || 0}건`;

    // Top 사용
    const usage = data.usage || {};
    const topEntries = Object.entries(usage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    makeBar(
      "chart-usage",
      topEntries.map(([k]) => k),
      topEntries.map(([, v]) => v),
      "#1a73e8",
    );

    // 품질
    const q = data.quality || { gatePass: {}, gateFail: {} };
    const labels = ["1단계 (형식)", "2단계 (구조)", "3단계 (기준 비교)"];
    const passData = [q.gatePass?.gate1 || 0, q.gatePass?.gate2 || 0, q.gatePass?.gate3 || 0];
    const failData = [q.gateFail?.gate1 || 0, q.gateFail?.gate2 || 0, q.gateFail?.gate3 || 0];
    makeStackedBar("chart-quality", labels, [
      { label: "통과", data: passData, backgroundColor: "#1f9e5b", borderRadius: 6 },
      { label: "미통과", data: failData, backgroundColor: "#c43c2c", borderRadius: 6 },
    ]);

    // 비용
    const cost = data.cost || {};
    const teams = Object.entries(cost).sort((a, b) => b[1] - a[1]);
    makeBar(
      "chart-cost",
      teams.map(([k]) => k),
      teams.map(([, v]) => v),
      "#7a5b00",
    );
  } catch (err) {
    document.getElementById("sample-size").textContent = "불러오지 못했어요: " + err.message;
  }
}

document.getElementById("reload").addEventListener("click", load);
load();

// ====== 設定 ======
const SPREADSHEET_ID = "1yMlH-3wYk_ZJp1r--Fin1yKkDCJarlIZ_pAaaFlmbxM";
const KPI_GID = 0;              // KPI
const TREND_GID = 709246046;    // Trend

// 統一カラー
const COLORS = { cloud:"#3b82f6", zt:"#10b981", inc:"#ef4444", rest:"#64748b" };

// DOM 参照
let chartLineBar, pieCloud, pieZT, pieInc;
let years = [], cloud = [], zt = [], inc = [];
const yearSelect   = document.getElementById("yearSelect");
const wrapSeries   = document.getElementById("wrapSeries");
const wrapPies     = document.getElementById("wrapPies");

// ====== ユーティリティ ======
const csvUrl = gid => `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;

async function fetchCsv(url){
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  return text.trim().split(/\r?\n/).map(r =>
    r.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^"|"$/g, ""))
  );
}

function toPct(v){
  const n = Number(v);
  if (isNaN(n)) return "—%";
  const val = n <= 1 ? n * 100 : n;
  return Math.round(val * 10) / 10 + "%";
}

function norm(a){ return a.map(v => (Number(v) <= 1 ? Number(v) * 100 : Number(v))); }

function setLastUpdated(){
  const d = new Date(), z = n => String(n).padStart(2,"0");
  document.getElementById("lastUpdated").textContent =
    `最終更新: ${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
}

// ====== Chart.js プラグイン（円の中央に％） ======
const centerLabelPlugin = {
  id: 'centerLabel',
  beforeDraw(chart){
    if (chart.config.type !== 'pie') return;
    const { ctx, chartArea:{width, height} } = chart;
    const ds = chart.data.datasets?.[0]?.data || [];
    if (!ds.length) return;
    const val = Number(ds[0]) || 0; // 先頭=該当
    const text = (Math.round(val*10)/10) + '%';
    ctx.save();
    ctx.font = `600 ${Math.min(width, height) * 0.12}px "Noto Sans JP", system-ui`;
    ctx.fillStyle = '#e6ecff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const c0 = chart.getDatasetMeta(0).data[0];
    ctx.fillText(text, c0.x, c0.y);
    ctx.restore();
  }
};
Chart.register(centerLabelPlugin);

// ====== データ取得 ======
async function loadKpi(){
  const rows = await fetchCsv(csvUrl(KPI_GID));
  for (let i=1; i<rows.length; i++){
    const name = (rows[i][0]||"").toLowerCase();
    const val  = rows[i][1];
    if (name.includes("cloud") || name.includes("クラウド"))
      document.getElementById("cloudVal").textContent = toPct(val);
    else if (name.includes("zero") || name.includes("zt") || name.includes("ゼロ"))
      document.getElementById("ztVal").textContent = toPct(val);
    else if (name.includes("incident") || name.includes("被害") || name.includes("インシデント"))
      document.getElementById("incVal").textContent = toPct(val);
  }
}

async function loadTrend(){
  const rows = await fetchCsv(csvUrl(TREND_GID));
  years=[]; cloud=[]; zt=[]; inc=[];
  for (let i=1; i<rows.length; i++){
    if (!rows[i][0]) continue;
    years.push(rows[i][0]);
    cloud.push(Number(rows[i][1]||0));
    zt.push(Number(rows[i][2]||0));
    inc.push(Number(rows[i][3]||0));
  }
  // 年度プルダウン
  yearSelect.innerHTML = "";
  years.forEach(y => {
    const o = document.createElement("option");
    o.value = y; o.textContent = y;
    yearSelect.appendChild(o);
  });
  yearSelect.value = years[years.length-1];
}

// ====== 描画（折れ線・棒） ======
function renderSeries(type="line"){
  if (chartLineBar) chartLineBar.destroy();
  chartLineBar = new Chart(document.getElementById("chart"),{
    type,
    data:{
      labels: years,
      datasets: [
        {label:"クラウド普及率", data:norm(cloud), borderColor:COLORS.cloud, backgroundColor:COLORS.cloud+"80", borderWidth:2, tension:.3},
        {label:"ゼロトラスト導入率", data:norm(zt),    borderColor:COLORS.zt,   backgroundColor:COLORS.zt+"80",   borderWidth:2, tension:.3},
        {label:"インシデント経験企業割合", data:norm(inc),  borderColor:COLORS.inc,  backgroundColor:COLORS.inc+"80",  borderWidth:2, tension:.3}
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ display:false },
        tooltip:{ callbacks:{ label:(ctx)=> `${ctx.dataset.label}: ${(+ (ctx.parsed.y ?? ctx.parsed)).toFixed(1)}%` } }
      },
      scales:{ y:{ min:0, max:100, ticks:{ stepSize:20 } } }
    }
  });
}

// ====== 描画（円×3：該当 vs 非該当） ======
function renderPies(){
  const y   = yearSelect.value;
  const idx = years.indexOf(y);
  const vC  = idx>-1 ? (cloud[idx]<=1?cloud[idx]*100:cloud[idx]) : 0;
  const vZ  = idx>-1 ? (zt[idx]   <=1?zt[idx]*100:zt[idx])       : 0;
  const vI  = idx>-1 ? (inc[idx]  <=1?inc[idx]*100:inc[idx])     : 0;

  const mkCfg = (val, color, label) => ({
    type:"pie",
    data:{ labels:["該当","非該当"], datasets:[{ data:[val, Math.max(0, 100-val)], backgroundColor:[color, COLORS.rest], borderColor:"#0b1020" }] },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ display:false },
        tooltip:{ callbacks:{ label:(ctx)=> `${label}：${ctx.label} ${(+ctx.parsed).toFixed(1)}%` } }
      }
    }
  });

  if (pieCloud) pieCloud.destroy();
  if (pieZT)    pieZT.destroy();
  if (pieInc)   pieInc.destroy();

  pieCloud = new Chart(document.getElementById("pieCloud"), mkCfg(vC, COLORS.cloud, "クラウド普及率"));
  pieZT    = new Chart(document.getElementById("pieZT"),    mkCfg(vZ, COLORS.zt,    "ゼロトラスト導入率"));
  pieInc   = new Chart(document.getElementById("pieInc"),   mkCfg(vI, COLORS.inc,   "インシデント経験企業割合"));
}

// ====== 表示切替 ======
function switchMode(mode){
  const isPie = (mode === "pie");
  document.getElementById("btnLine").classList.toggle("active", mode==="line");
  document.getElementById("btnBar").classList.toggle("active",  mode==="bar");
  document.getElementById("btnPie").classList.toggle("active",  isPie);

  wrapSeries.style.display = isPie ? "none"  : "block";
  wrapPies.style.display   = isPie ? "grid"  : "none";
  yearSelect.disabled      = !isPie;

  if (isPie) renderPies(); else renderSeries(mode);
}

// ====== UI イベント ======
function setupUI(){
  document.getElementById("btnLine").addEventListener("click", ()=>switchMode("line"));
  document.getElementById("btnBar").addEventListener("click",  ()=>switchMode("bar"));
  document.getElementById("btnPie").addEventListener("click",  ()=>switchMode("pie"));
  yearSelect.addEventListener("change", ()=>{ if (document.getElementById("btnPie").classList.contains("active")) renderPies(); });
}

// ====== 初期化 ======
(async function init(){
  setLastUpdated();
  await loadKpi();
  await loadTrend();
  setupUI();
  switchMode("line");
})();

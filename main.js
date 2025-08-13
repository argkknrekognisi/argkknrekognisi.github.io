// main.js — Dashboard logic (works with 10-min cumulative rainfall)
// Put your own values here:
const PROJECT_URL = "https://scbekobcwdxrfvdiofjp.supabase.co";
const ANON_KEY    = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYmVrb2Jjd2R4cmZ2ZGlvZmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3MDg4ODgsImV4cCI6MjA3MDI4NDg4OH0.FTSxV5J-vPN59NCrplGRIEvk9NFZ3-0y8yya-YxKnjM";

// If your DB has a per-interval column, set to true (optional)
const HAS_INTERVAL_COLUMN = false;

// ------- Supabase client -------
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(PROJECT_URL, ANON_KEY);

// UI helpers
const pad2 = n => String(n).padStart(2,'0');
const clockFmt = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
const css = (v,f)=>getComputedStyle(document.body).getPropertyValue(v).trim()||f;
const gridColor = ()=> (css('--muted','#6b7280')) + '22';

function setStatus(online) {
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  if (!dot || !txt) return;
  dot.classList.toggle('online', online);
  dot.classList.toggle('offline', !online);
  txt.textContent = online ? 'ONLINE' : 'OFFLINE';
}

function showErrorBanner(msg) {
  let b = document.getElementById('errBanner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'errBanner';
    b.style.cssText = `
      position: fixed; left: 12px; right: 12px; bottom: 12px;
      background: #fee2e2; color:#991b1b; border:1px solid #fecaca;
      padding:10px 12px; border-radius:10px; box-shadow:0 10px 30px rgba(0,0,0,.15);
      font: 600 13px/1.3 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; z-index: 9999;
    `;
    document.body.appendChild(b);
  }
  b.textContent = msg;
  setTimeout(()=>{ if (b) b.remove(); }, 8000);
}

// Trend arrows
function setTrend(el, delta, eps=0.01){
  if (!el) return;
  el.classList.remove('up','down','steady');
  if (delta > eps) { el.textContent = '↑'; el.classList.add('up'); }
  else if (delta < -eps) { el.textContent = '↓'; el.classList.add('down'); }
  else { el.textContent = '→'; el.classList.add('steady'); }
}

// Live clock
(function startClock(){
  const el = document.getElementById("clock");
  if (!el) return;
  setInterval(()=> el.textContent = clockFmt(new Date()), 1000);
})();

// --------- Chart.js makers ---------
function mkLineChart(ctx, label) {
  const border = css('--value','#38bdf8');
  return new Chart(ctx, {
    type: "line",
    data: { labels: [], datasets: [{
      label, data: [], borderColor: border, backgroundColor: "rgba(56,189,248,0.18)",
      fill: true, tension: 0.25, pointRadius: 2
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: css('--text','#0f172a') } } },
      scales: {
        x: { ticks: { color: css('--muted','#6b7280') }, grid: { color: gridColor() } },
        y: { ticks: { color: css('--muted','#6b7280') }, grid: { color: gridColor() } }
      }
    }
  });
}

function mkRainChart(ctx) {
  const lineColor = css('--value','#38bdf8');
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        { type:'bar',  label:"Interval (mm / 10min)", data:[], backgroundColor:"rgba(56,189,248,0.35)", borderWidth:0, yAxisID:'y' },
        { type:'line', label:"Cumulative (mm)",       data:[], borderColor:lineColor, backgroundColor:"rgba(56,189,248,0.18)", fill:true, tension:0.25, pointRadius:2, yAxisID:'y' }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color: css('--text','#0f172a') } } },
      scales:{
        x:{ ticks:{ color: css('--muted','#6b7280') }, grid:{ color: gridColor() } },
        y:{ ticks:{ color: css('--muted','#6b7280') }, grid:{ color: gridColor() }, beginAtZero:true }
      }
    }
  });
}

// Make charts
const tempChart = mkLineChart(document.getElementById("tempChart").getContext("2d"), "°C");
const humChart  = mkLineChart(document.getElementById("humChart").getContext("2d"),  "%");
const presChart = mkLineChart(document.getElementById("presChart").getContext("2d"), "hPa");
const rainChart = mkRainChart(document.getElementById("rainChart").getContext("2d"));

// Append helpers (cap length 20)
function pushLinePoint(chart, ts, val){
  chart.data.labels.push(clockFmt(new Date(ts)));
  chart.data.datasets[0].data.push(val);
  if (chart.data.labels.length > 20) { chart.data.labels.shift(); chart.data.datasets[0].data.shift(); }
  chart.update();
}
function pushRainPoints(ts, cumulative, interval){
  const lbls = rainChart.data.labels;
  const dsI = rainChart.data.datasets[0];
  const dsC = rainChart.data.datasets[1];
  lbls.push(clockFmt(new Date(ts)));
  dsI.data.push(interval);
  dsC.data.push(cumulative);
  if (lbls.length > 20) { lbls.shift(); dsI.data.shift(); dsC.data.shift(); }
  rainChart.update();
}

// ---------- Resolve table name (underscore vs hyphen) ----------
let TABLE = 'weather_readings';
let resolvedTable = TABLE;

async function resolveTable() {
  const cols = HAS_INTERVAL_COLUMN
    ? "created_at, temperature, humidity, pressure, rainfall_mm, rainfall_mm_interval"
    : "created_at, temperature, humidity, pressure, rainfall_mm";

  // Try underscore
  let r = await supabase.from('weather_readings').select(cols).limit(1);
  if (!r.error) { resolvedTable = 'weather_readings'; return cols; }

  // Try hyphen fallback
  r = await supabase.from('weather-readings').select(cols).limit(1);
  if (!r.error) { resolvedTable = 'weather-readings'; return cols; }

  // If both failed, show error
  console.error("Initial SELECT failed:", r.error);
  showErrorBanner("Cannot read table. Check RLS policy (SELECT) & table name.");
  return cols; // still return the selection string
}

// ---------- Load initial data ----------
let lastTimestamp = null;
let prev = { temperature:null, humidity:null, pressure:null, rainfall_mm:null };

function renderTiles(row) {
  const upd = (id, v, f=2)=>{ const el=document.getElementById(id); if (el && v!=null) el.textContent = Number(v).toFixed(f); };
  const trend = (id, delta, eps)=> setTrend(document.getElementById(id), delta, eps);

  if (row.temperature != null) { trend('tTrend', row.temperature - (prev.temperature ?? row.temperature), 0.05); upd('t', row.temperature); prev.temperature = row.temperature; }
  if (row.humidity    != null) { trend('hTrend', row.humidity    - (prev.humidity    ?? row.humidity),    0.2 ); upd('h', row.humidity);     prev.humidity = row.humidity; }
  if (row.pressure    != null) { trend('pTrend', row.pressure    - (prev.pressure    ?? row.pressure),    0.3 ); upd('p', row.pressure);     prev.pressure = row.pressure; }
  if (row.rainfall_mm != null) { trend('rTrend', row.rainfall_mm - (prev.rainfall_mm ?? row.rainfall_mm), 0.01); const el=document.getElementById('r'); if (el) el.textContent=Number(row.rainfall_mm).toFixed(3); prev.rainfall_mm=row.rainfall_mm; }

  const ts = row.created_at ?? new Date().toISOString();
  const lu = document.getElementById('lastUpdated');
  if (lu) lu.textContent = `Last updated: ${new Date(ts).toLocaleDateString()} ${clockFmt(new Date(ts))}`;
}

// main flow
(async function boot() {
  const cols = await resolveTable();
  console.log("Using table:", resolvedTable);

  const { data: rows, error } = await supabase
    .from(resolvedTable)
    .select(cols)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Initial load error:", error);
    // RLS block?
    if (error.code === '42501' || error.code === 'PGRST301' || error.message?.toLowerCase().includes('permission')) {
      showErrorBanner("Anon cannot SELECT. Add SELECT policy on your table.");
    }
    setStatus(false);
  }

  if (rows?.length) {
    const ordered = rows.slice().reverse();
    let prevCum = null;
    ordered.forEach(r => {
      // derive interval if not present
      const cum = Number(r.rainfall_mm ?? 0);
      let interval = 0;
      if (HAS_INTERVAL_COLUMN && r.rainfall_mm_interval != null) {
        interval = Number(r.rainfall_mm_interval);
      } else if (prevCum == null) {
        interval = cum;                // window start
      } else {
        interval = Math.max(0, cum - prevCum);  // handle daily reset (drop to 0)
      }
      prevCum = cum;

      renderTiles(r);
      if (r.temperature != null) pushLinePoint(tempChart, r.created_at, Number(r.temperature));
      if (r.humidity    != null) pushLinePoint(humChart,  r.created_at, Number(r.humidity));
      if (r.pressure    != null) pushLinePoint(presChart, r.created_at, Number(r.pressure));
      pushRainPoints(r.created_at, cum, interval);

      lastTimestamp = r.created_at;
    });
    setStatus(true);
  }

  // Realtime subscription
  const channel = supabase.channel("weather-room");
  await channel
    .on("postgres_changes", { event: "INSERT", schema: "public", table: resolvedTable }, (payload) => {
      console.log("📥 Realtime event:", payload);
      const r = payload.new;
      const cum = Number(r.rainfall_mm ?? 0);
      let interval = 0;

      if (HAS_INTERVAL_COLUMN && r.rainfall_mm_interval != null) {
        interval = Number(r.rainfall_mm_interval);
      } else {
        const prevCum = prev.rainfall_mm == null ? 0 : Number(prev.rainfall_mm);
        // if reset happened, interval is cum (not negative)
        interval = Math.max(0, cum - prevCum);
      }

      renderTiles(r);
      if (r.temperature != null) pushLinePoint(tempChart, r.created_at, Number(r.temperature));
      if (r.humidity    != null) pushLinePoint(humChart,  r.created_at, Number(r.humidity));
      if (r.pressure    != null) pushLinePoint(presChart, r.created_at, Number(r.pressure));
      pushRainPoints(r.created_at, cum, interval);

      lastTimestamp = r.created_at;
      setStatus(true);
    })
    .subscribe((status) => console.log("Realtime status:", status));

  // Online/Offline watchdog — posts every 10 min, so give it time
  const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
  setInterval(() => {
    if (!lastTimestamp) return;
    const age = Date.now() - new Date(lastTimestamp).getTime();
    setStatus(age <= TIMEOUT_MS);
  }, 5000);

  // Retint on theme change (dark/light)
  const mo = new MutationObserver(() => {
    const text = css('--text','#0f172a');
    const muted = css('--muted','#6b7280');
    const grid = gridColor();
    [tempChart, humChart, presChart].forEach(ch => {
      ch.options.plugins.legend.labels.color = text;
      ch.options.scales.x.ticks.color = muted;
      ch.options.scales.x.grid.color = grid;
      ch.options.scales.y.ticks.color = muted;
      ch.options.scales.y.grid.color = grid;
      ch.update('none');
    });
    rainChart.options.plugins.legend.labels.color = text;
    rainChart.options.scales.x.ticks.color = muted;
    rainChart.options.scales.x.grid.color = grid;
    rainChart.options.scales.y.ticks.color = muted;
    rainChart.update('none');
  });
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();

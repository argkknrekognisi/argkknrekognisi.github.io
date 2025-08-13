// main.js — Dashboard with Cumulative + Interval + Rate (mm/h)
const PROJECT_URL = "https://scbekobcwdxrfvdiofjp.supabase.co";
const ANON_KEY    = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYmVrb2Jjd2R4cmZ2ZGlvZmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3MDg4ODgsImV4cCI6MjA3MDI4NDg4OH0.FTSxV5J-vPN59NCrplGRIEvk9NFZ3-0y8yya-YxKnjM";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(PROJECT_URL, ANON_KEY);

// ---------- UI helpers ----------
const pad2 = n => String(n).padStart(2,'0');
const clockFmt = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
const css = (v,f)=>getComputedStyle(document.body).getPropertyValue(v).trim()||f;
// Works with both HEX and HSL tokens
const gridColor = () => {
  const v = css('--muted','#6b7280');
  if (v.startsWith('hsl')) return v.replace(')', ' / 0.22)');
  return v + '22';
};
function setStatus(online){
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  if (!dot || !txt) return;
  dot.classList.toggle('online', online);
  dot.classList.toggle('offline', !online);
  txt.textContent = online ? 'ONLINE' : 'OFFLINE';
}
function setTrend(el, delta, eps=0.01){
  if (!el) return;
  el.classList.remove('up','down','steady');
  if (delta > eps) { el.textContent = '↑'; el.classList.add('up'); }
  else if (delta < -eps) { el.textContent = '↓'; el.classList.add('down'); }
  else { el.textContent = '→'; el.classList.add('steady'); }
}
(function(){ const el = document.getElementById("clock"); if (!el) return; setInterval(()=> el.textContent = clockFmt(new Date()), 1000); })();
function showErrorBanner(msg) {
  let b = document.getElementById('errBanner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'errBanner';
    b.style.cssText = `
      position: fixed; left: 12px; right: 12px; bottom: 12px;
      background:#fee2e2; color:#991b1b; border:1px solid #fecaca;
      padding:10px 12px; border-radius:10px; box-shadow:0 10px 30px rgba(0,0,0,.15);
      font: 600 13px/1.3 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; z-index:9999;
    `;
    document.body.appendChild(b);
  }
  b.textContent = msg;
  setTimeout(()=>{ try{ b.remove(); }catch{} }, 8000);
}

// ---------- Charts ----------
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
  const cumColor  = css('--value','#38bdf8');
  const rateColor = css('--accent','#10b981');
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        { type:'bar',  label:"Interval (mm)",    data:[], backgroundColor:"rgba(56,189,248,0.35)", borderWidth:0, yAxisID:'y' },
        { type:'line', label:"Cumulative (mm)",  data:[], borderColor:cumColor,  backgroundColor:"rgba(56,189,248,0.18)", fill:true,  tension:0.25, pointRadius:2, yAxisID:'y' },
        { type:'line', label:"Rate (mm/h)",      data:[], borderColor:rateColor, backgroundColor:"rgba(16,185,129,0.18)", fill:false, tension:0.25, pointRadius:2, yAxisID:'y2' }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color: css('--text','#0f172a') } } },
      scales:{
        x : { ticks:{ color: css('--muted','#6b7280') }, grid:{ color: gridColor() } },
        y : { position:'left',  ticks:{ color: css('--muted','#6b7280') }, grid:{ color: gridColor() }, beginAtZero:true, title:{ display:true, text:'mm' } },
        y2: { position:'right', ticks:{ color: css('--muted','#6b7280') }, grid:{ display:false }, beginAtZero:true, title:{ display:true, text:'mm/h' } }
      }
    }
  });
}

const tempChart = mkLineChart(document.getElementById("tempChart").getContext("2d"), "°C");
const humChart  = mkLineChart(document.getElementById("humChart").getContext("2d"),  "%");
const presChart = mkLineChart(document.getElementById("presChart").getContext("2d"), "hPa");
const rainChart = mkRainChart(document.getElementById("rainChart").getContext("2d"));

function tsOf(row){
  // Prefer device-provided 'ts', else fallback to 'created_at'
  return row.ts ?? row.created_at ?? new Date().toISOString();
}
function pushLinePoint(chart, ts, val){
  chart.data.labels.push(clockFmt(new Date(ts)));
  chart.data.datasets[0].data.push(val);
  if (chart.data.labels.length > 40) { chart.data.labels.shift(); chart.data.datasets[0].data.shift(); }
  chart.update();
}
function pushRainPoints(ts, cumulative, interval, rate){
  const lbls = rainChart.data.labels;
  const dsI = rainChart.data.datasets[0];
  const dsC = rainChart.data.datasets[1];
  const dsR = rainChart.data.datasets[2];
  lbls.push(clockFmt(new Date(ts)));
  dsI.data.push(interval);
  dsC.data.push(cumulative);
  dsR.data.push(rate);
  if (lbls.length > 40) { lbls.shift(); dsI.data.shift(); dsC.data.shift(); dsR.data.shift(); }
  rainChart.update();
}

// ---------- Table resolve (underscore vs hyphen) ----------
let resolvedTable = 'weather_readings';
async function resolveTable(selectCols) {
  let r = await supabase.from('weather_readings').select(selectCols).limit(1);
  if (!r.error) { resolvedTable = 'weather_readings'; return; }
  r = await supabase.from('weather-readings').select(selectCols).limit(1);
  if (!r.error) { resolvedTable = 'weather-readings'; return; }
  console.error('Table read error:', r.error);
  showErrorBanner('Cannot read table. Check RLS (SELECT) & table name.');
}

// ---------- Data flow ----------
let lastTimestamp = null;
let prev = { temperature:null, humidity:null, pressure:null, rainfall_mm:null, ts:null, rate:null };

(function startClock(){
  const el = document.getElementById("clock");
  if (!el) return;
  setInterval(()=> el.textContent = clockFmt(new Date()), 1000);
})();

function renderTiles(row, rate) {
  const upd = (id, v, f=2)=>{ const el=document.getElementById(id); if (el && v!=null) el.textContent = Number(v).toFixed(f); };
  const trend = (id, delta, eps)=> setTrend(document.getElementById(id), delta, eps);

  if (row.temperature != null) { trend('tTrend', row.temperature - (prev.temperature ?? row.temperature), 0.05); upd('t', row.temperature); prev.temperature = row.temperature; }
  if (row.humidity    != null) { trend('hTrend', row.humidity    - (prev.humidity    ?? row.humidity),    0.2 ); upd('h', row.humidity);     prev.humidity = row.humidity; }
  if (row.pressure    != null) { trend('pTrend', row.pressure    - (prev.pressure    ?? row.pressure),    0.3 ); upd('p', row.pressure);     prev.pressure = row.pressure; }
  if (row.rainfall_mm != null) { trend('rTrend', row.rainfall_mm - (prev.rainfall_mm ?? row.rainfall_mm), 0.01); upd('r', row.rainfall_mm, 3); prev.rainfall_mm=row.rainfall_mm; }
  if (rate            != null) { trend('rrTrend', rate - (prev.rate ?? rate), 0.01); upd('rr', rate, 3); prev.rate = rate; }

  const ts = tsOf(row);
  const lu = document.getElementById('lastUpdated');
  if (lu) lu.textContent = `Last updated: ${new Date(ts).toLocaleDateString()} ${clockFmt(new Date(ts))}`;
  prev.ts = ts;
}

function deriveIntervalAndRate(currCum, currTsISO, prevCum, prevTsISO, rateFromDB) {
  if (rateFromDB != null) {
    return { interval: null, rate: Number(rateFromDB) };
  }
  const curr = Number(currCum ?? 0);
  const prevC = Number(prevCum ?? 0);
  let interval = curr - prevC;
  if (interval < 0) interval = curr; // daily reset case
  let rate = 0;
  if (prevTsISO) {
    const dtMin = Math.max(0.001, (new Date(currTsISO) - new Date(prevTsISO)) / 60000);
    rate = Math.max(0, interval) * (60.0 / dtMin);
  }
  return { interval: Math.max(0, interval), rate };
}

(async function boot() {
  const cols = "created_at, ts, temperature, humidity, pressure, rainfall_mm, rainfall_rate_mmh";
  await resolveTable(cols);

  // initial load (last 40, newest→oldest)
  const { data: rows, error } = await supabase
    .from(resolvedTable)
    .select(cols)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    console.error("Initial load error:", error);
    if (error.code === '42501' || error.code === 'PGRST301' || (error.message||'').toLowerCase().includes('permission')) {
      showErrorBanner("Anon cannot SELECT. Add SELECT policy on your table.");
    }
    setStatus(false);
  }

  if (rows?.length) {
    const ordered = rows.slice().reverse();
    let prevCum = null, prevTs = null;
    ordered.forEach(r => {
      const ts = tsOf(r);
      const { interval, rate } = deriveIntervalAndRate(r.rainfall_mm, ts, prevCum, prevTs, r.rainfall_rate_mmh);
      renderTiles(r, rate);
      if (r.temperature != null) pushLinePoint(tempChart, ts, Number(r.temperature));
      if (r.humidity    != null) pushLinePoint(humChart,  ts, Number(r.humidity));
      if (r.pressure    != null) pushLinePoint(presChart, ts, Number(r.pressure));
      pushRainPoints(ts, Number(r.rainfall_mm || 0), interval ?? 0, rate ?? 0);
      prevCum = r.rainfall_mm ?? 0;
      prevTs = ts;
      lastTimestamp = ts;
    });
    setStatus(true);
  }

  // realtime
  const channel = supabase.channel("weather-room");
  await channel
    .on("postgres_changes", { event: "INSERT", schema: "public", table: resolvedTable }, (payload) => {
      const r = payload.new;
      const ts = tsOf(r);
      const { interval, rate } = deriveIntervalAndRate(r.rainfall_mm, ts, prev.rainfall_mm, prev.ts, r.rainfall_rate_mmh);
      renderTiles(r, rate);
      if (r.temperature != null) pushLinePoint(tempChart, ts, Number(r.temperature));
      if (r.humidity    != null) pushLinePoint(humChart,  ts, Number(r.humidity));
      if (r.pressure    != null) pushLinePoint(presChart, ts, Number(r.pressure));
      pushRainPoints(ts, Number(r.rainfall_mm || 0), interval ?? 0, rate ?? 0);
      lastTimestamp   = ts;
      prev.rainfall_mm = r.rainfall_mm;
      prev.ts          = ts;
      prev.rate        = rate;
      setStatus(true);
    })
    .subscribe((status)=>console.log("Realtime status:", status));

  // watchdog — mark offline if older than 3 min (since you post each minute)
  const TIMEOUT_MS = 3 * 60 * 1000;
  setInterval(() => {
    if (!lastTimestamp) return;
    const age = Date.now() - new Date(lastTimestamp).getTime();
    setStatus(age <= TIMEOUT_MS);
  }, 5000);

  // retint charts on theme change
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
    rainChart.options.scales.y.grid.color = grid;
    rainChart.options.scales.y2.ticks.color = muted;
    rainChart.update('none');
  });
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();

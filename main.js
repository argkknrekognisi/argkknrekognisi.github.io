import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== Supabase (PUT YOUR PROJECT URL + ANON KEY) =====
const supabase = createClient(
  "https://scbekobcwdxrfvdiofjp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYmVrb2Jjd2R4cmZ2ZGlvZmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3MDg4ODgsImV4cCI6MjA3MDI4NDg4OH0.FTSxV5J-vPN59NCrplGRIEvk9NFZ3-0y8yya-YxKnjM"
);
// ======================================================

let lastTimestamp = null;
let prev = { temperature: null, humidity: null, pressure: null, rainfall_mm: null };

// ---------- Utils ----------
const pad2 = n => String(n).padStart(2,'0');
const formatClock = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
const formatLocalTime = iso => { const d = new Date(iso); return `${d.toLocaleDateString()} ${formatClock(d)}`; };
function setTrend(el, delta, epsilon = 0.01) {
  el.classList.remove('up','down','steady');
  if (delta > epsilon) { el.textContent = '↑'; el.classList.add('up'); }
  else if (delta < -epsilon) { el.textContent = '↓'; el.classList.add('down'); }
  else { el.textContent = '→'; el.classList.add('steady'); }
}
function setStatus(online) {
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  if (online) { dot.classList.remove('offline'); dot.classList.add('online'); txt.textContent = 'ONLINE'; }
  else { dot.classList.remove('online'); dot.classList.add('offline'); txt.textContent = 'OFFLINE'; }
}

// ---------- Chart.js helpers ----------
function getCSS(varName, fallback){ return getComputedStyle(document.body).getPropertyValue(varName).trim() || fallback; }
function gridColor(){ return (getCSS('--muted','#6b7280')) + '22'; } // faint grid
function mkChart(ctx, label) {
  const border = getCSS('--value','#38bdf8');
  return new Chart(ctx, {
    type: "line",
    data: { labels: [], datasets: [{
      label, data: [], borderColor: border, backgroundColor: "rgba(56,189,248,0.18)",
      fill: true, tension: 0.25, pointRadius: 2
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: getCSS('--text','#0f172a') } } },
      scales: {
        x: { ticks: { color: getCSS('--muted','#6b7280') }, grid: { color: gridColor() } },
        y: { ticks: { color: getCSS('--muted','#6b7280') }, grid: { color: gridColor() } }
      }
    }
  });
}

// Create charts
const tempChart = mkChart(document.getElementById("tempChart").getContext("2d"), "°C");
const humChart  = mkChart(document.getElementById("humChart").getContext("2d"),  "%");
const presChart = mkChart(document.getElementById("presChart").getContext("2d"), "hPa");
const rainChart = mkChart(document.getElementById("rainChart").getContext("2d"), "mm");

// Append point helper (keeps last 20)
function pushPoint(chart, ts, val){
  chart.data.labels.push(formatClock(new Date(ts)));
  chart.data.datasets[0].data.push(val);
  if (chart.data.labels.length > 20) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update();
}

// ---------- Initial load (preload last 20) ----------
const { data: rows, error } = await supabase
  .from("weather_readings")          // if your table uses a hyphen: "weather-readings"
  .select("*")
  .order("created_at", { ascending: false })
  .limit(20);

if (error) console.error(error);

if (rows?.length) {
  rows.reverse().forEach(r => {
    render(r);
    if (r.temperature != null) pushPoint(tempChart, r.created_at, Number(r.temperature));
    if (r.humidity    != null) pushPoint(humChart,  r.created_at, Number(r.humidity));
    if (r.pressure    != null) pushPoint(presChart, r.created_at, Number(r.pressure));
    pushPoint(rainChart, r.created_at, Number(r.rainfall_mm ?? 0));
    lastTimestamp = r.created_at;
  });
  setStatus(true);
} else {
  setStatus(false);
}

// ---------- Realtime ----------
const channel = supabase.channel("weather-room");
await channel
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "weather_readings"       // or "weather-readings"
  }, (payload) => {
    const row = payload.new;
    if (row.created_at !== lastTimestamp) {
      render(row);
      if (row.temperature != null) pushPoint(tempChart, row.created_at, Number(row.temperature));
      if (row.humidity    != null) pushPoint(humChart,  row.created_at, Number(row.humidity));
      if (row.pressure    != null) pushPoint(presChart, row.created_at, Number(row.pressure));
      pushPoint(rainChart, row.created_at, Number(row.rainfall_mm ?? 0));
      lastTimestamp = row.created_at;
      setStatus(true);
    }
  })
  .subscribe(status => console.log("Realtime status:", status));

// ---------- Render ----------
function render(r) {
  if (r.temperature != null) {
    const el = document.getElementById("t");
    const trendEl = document.getElementById("tTrend");
    const prevVal = prev.temperature;
    el.textContent = Number(r.temperature).toFixed(2);
    if (prevVal != null) setTrend(trendEl, r.temperature - prevVal, 0.05);
    prev.temperature = r.temperature;
  }
  if (r.humidity != null) {
    const el = document.getElementById("h");
    const trendEl = document.getElementById("hTrend");
    const prevVal = prev.humidity;
    el.textContent = Number(r.humidity).toFixed(2);
    if (prevVal != null) setTrend(trendEl, r.humidity - prevVal, 0.2);
    prev.humidity = r.humidity;
  }
  if (r.pressure != null) {
    const el = document.getElementById("p");
    const trendEl = document.getElementById("pTrend");
    const prevVal = prev.pressure;
    el.textContent = Number(r.pressure).toFixed(2);
    if (prevVal != null) setTrend(trendEl, r.pressure - prevVal, 0.3);
    prev.pressure = r.pressure;
  }
  if (r.rainfall_mm != null) {
    const el = document.getElementById("r");
    const trendEl = document.getElementById("rTrend");
    const prevVal = prev.rainfall_mm;
    el.textContent = Number(r.rainfall_mm).toFixed(3);
    if (prevVal != null) setTrend(trendEl, r.rainfall_mm - prevVal, 0.01);
    prev.rainfall_mm = r.rainfall_mm;
  }

  const ts = r.created_at ?? new Date().toISOString();
  document.getElementById("lastUpdated").textContent = `Last updated: ${formatLocalTime(ts)}`;
}

// ---------- Live clock ----------
(function startClock(){
  const el = document.getElementById("clock");
  setInterval(() => el.textContent = formatClock(new Date()), 1000);
})();

// ---------- Online/Offline watchdog ----------
(function startWatchdog(){
  const TIMEOUT_MS = 120000; // 2 minutes
  setInterval(() => {
    if (!lastTimestamp) return;
    const age = Date.now() - new Date(lastTimestamp).getTime();
    setStatus(age <= TIMEOUT_MS);
  }, 5000);
})();

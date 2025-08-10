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
const formatLocalTime = iso => {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${formatClock(d)}`;
};
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

// ---------- Chart.js setup ----------
let chart;
let chartData = {
  labels: [],
  datasets: [{
    label: "Rainfall (mm)",
    data: [],
    borderColor: "#00ffc3",
    backgroundColor: "rgba(0,255,195,0.2)",
    fill: true,
    tension: 0.25
  }]
};
function initChart() {
  const ctx = document.getElementById("rainChart").getContext("2d");
  chart = new Chart(ctx, {
    type: "line",
    data: chartData,
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#f0f0f0" } }
      },
      scales: {
        x: { ticks: { color: "#aaa" } },
        y: { ticks: { color: "#aaa" } }
      }
    }
  });
}
initChart();

// ---------- Initial load (preload last 20) ----------
const { data: rows, error } = await supabase
  .from("weather_readings")          // if your table uses hyphen: "weather-readings"
  .select("*")
  .order("created_at", { ascending: false })
  .limit(20);

if (error) console.error(error);

if (rows?.length) {
  // Render oldest → newest
  rows.reverse().forEach(r => {
    render(r);
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
    table: "weather_readings"       // if hyphen table: "weather-readings"
  }, (payload) => {
    const row = payload.new;
    if (row.created_at !== lastTimestamp) {
      render(row);
      lastTimestamp = row.created_at;
      setStatus(true);
    }
  })
  .subscribe(status => console.log("Realtime status:", status));

// ---------- Render ----------
function render(r) {
  // Values + trends
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

  // Last updated
  const ts = r.created_at ?? new Date().toISOString();
  document.getElementById("lastUpdated").textContent = `Last updated: ${formatLocalTime(ts)}`;

  // Chart point (rainfall; 0 if null)
  if (chart) {
    chartData.labels.push(formatClock(new Date(ts)));
    chartData.datasets[0].data.push(r.rainfall_mm ?? 0);
    if (chartData.labels.length > 20) {
      chartData.labels.shift();
      chartData.datasets[0].data.shift();
    }
    chart.update();
  }
}

// ---------- Live clock ----------
(function startClock(){
  const el = document.getElementById("clock");
  setInterval(() => el.textContent = formatClock(new Date()), 1000);
})();

// ---------- Online/Offline watchdog ----------
(function startWatchdog(){
  // Mark OFFLINE if no new data > 120s
  const TIMEOUT_MS = 120000;
  setInterval(() => {
    if (!lastTimestamp) return;
    const age = Date.now() - new Date(lastTimestamp).getTime();
    setStatus(age <= TIMEOUT_MS);
  }, 5000);
})();

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== Supabase (PUT YOUR PROJECT URL + ANON KEY) =====
const supabase = createClient(
  "https://scbekobcwdxrfvdiofjp.supabase.co/rest/v1/weather_readings",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYmVrb2Jjd2R4cmZ2ZGlvZmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3MDg4ODgsImV4cCI6MjA3MDI4NDg4OH0.FTSxV5J-vPN59NCrplGRIEvk9NFZ3-0y8yya-YxKnjM"
);
// ======================================================

// set true if your table has rainfall_mm_interval
const HAS_INTERVAL_COLUMN = false;

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
function css(varName, fallback){ return getComputedStyle(document.body).getPropertyValue(varName).trim() || fallback; }
function gridColor(){ return (css('--muted','#6b7280')) + '22'; } // faint grid

// Rain chart with 2 datasets: cumulative line + per-interval bars
function mkRainChart(ctx) {
  const lineColor = css('--value','#38bdf8');
  return new Chart(ctx, {
    type: "bar", // base bar so interval draws under the line
    data: {
      labels: [],
      datasets: [
        {
          type: 'bar',
          label: "Interval (mm / 10min)",
          data: [],
          backgroundColor: "rgba(56,189,248,0.35)",
          borderWidth: 0,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: "Cumulative (mm)",
          data: [],
          borderColor: lineColor,
          backgroundColor: "rgba(56,189,248,0.18)",
          fill: true,
          tension: 0.25,
          pointRadius: 2,
          yAxisID: 'y',
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: css('--text','#0f172a') } } },
      scales: {
        x: { ticks: { color: css('--muted','#6b7280') }, grid: { color: gridColor() } },
        y: { ticks: { color: css('--muted','#6b7280') }, grid: { color: gridColor() }, beginAtZero: true }
      }
    }
  });
}

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

// Create charts
const tempChart = mkLineChart(document.getElementById("tempChart").getContext("2d"), "°C");
const humChart  = mkLineChart(document.getElementById("humChart").getContext("2d"),  "%");
const presChart = mkLineChart(document.getElementById("presChart").getContext("2d"), "hPa");
const rainChart = mkRainChart(document.getElementById("rainChart").getContext("2d"));

// Append point helper (keeps last 20)
function pushLinePoint(chart, ts, val){
  chart.data.labels.push(formatClock(new Date(ts)));
  chart.data.datasets[0].data.push(val);
  if (chart.data.labels.length > 20) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update();
}

function pushRainPoints(ts, cumulative, interval){
  const lbls = rainChart.data.labels;
  const dsInterval = rainChart.data.datasets[0];
  const dsCumul    = rainChart.data.datasets[1];
  lbls.push(formatClock(new Date(ts)));
  dsInterval.data.push(interval);
  dsCumul.data.push(cumulative);
  if (lbls.length > 20) {
    lbls.shift();
    dsInterval.data.shift();
    dsCumul.data.shift();
  }
  rainChart.update();
}

// ---------- Initial load (preload last 20) ----------
const selectCols = HAS_INTERVAL_COLUMN
  ? "created_at, temperature, humidity, pressure, rainfall_mm, rainfall_mm_interval"
  : "created_at, temperature, humidity, pressure, rainfall_mm";

const { data: rows, error } = await supabase
  .from("weather_readings")          // if your table uses a hyphen: "weather-readings"
  .select(selectCols)
  .order("created_at", { ascending: false })
  .limit(20);

if (error) console.error(error);

if (rows?.length) {
  const ordered = rows.slice().reverse();
  let prevCum = null;

  ordered.forEach(r => {
    let interval = 0;
    const cum = Number(r.rainfall_mm ?? 0);
    if (HAS_INTERVAL_COLUMN && r.rainfall_mm_interval != null) {
      interval = Number(r.rainfall_mm_interval);
    } else if (prevCum == null) {
      interval = cum;
    } else {
      interval = Math.max(0, cum - prevCum);
    }
    prevCum = cum;

    render(r);

    if (r.temperature != null) pushLinePoint(tempChart, r.created_at, Number(r.temperature));
    if (r.humidity    != null) pushLinePoint(humChart,  r.created_at, Number(r.humidity));
    if (r.pressure    != null) pushLinePoint(presChart, r.created_at, Number(r.pressure));
    pushRainPoints(r.created_at, cum, interval);

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
    const r = payload.new;
    const cum = Number(r.rainfall_mm ?? 0);
    let interval = 0;
    if (HAS_INTERVAL_COLUMN && r.rainfall_mm_interval != null) {
      interval = Number(r.rainfall_mm_interval);
    } else {
      const prevCum = prev.rainfall_mm == null ? 0 : Number(prev.rainfall_mm);
      interval = Math.max(0, cum - prevCum);
    }

    if (r.created_at !== lastTimestamp) {
      render(r);
      if (r.temperature != null) pushLinePoint(tempChart, r.created_at, Number(r.temperature));
      if (r.humidity    != null) pushLinePoint(humChart,  r.created_at, Number(r.humidity));
      if (r.pressure    != null) pushLinePoint(presChart, r.created_at, Number(r.pressure));
      pushRainPoints(r.created_at, cum, interval);
      lastTimestamp = r.created_at;
      setStatus(true);
    }
  })
  .subscribe(status => console.log("Realtime status:", status));

// ---------- Render tiles ----------
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
  const TIMEOUT_MS = 180000; // 3 minutes
  setInterval(() => {
    if (!lastTimestamp) return;
    const age = Date.now() - new Date(lastTimestamp).getTime();
    setStatus(age <= TIMEOUT_MS);
  }, 5000);
})();

// ---------- Retint on theme change ----------
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

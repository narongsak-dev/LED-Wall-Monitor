const apiBase = window.APP_CONFIG.apiBase;
let trendChart;
let reportPage = 1;

function renderClock() {
  const now = new Date();
  document.getElementById('live-date').textContent = now.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  document.getElementById('live-time').textContent = now.toLocaleTimeString('th-TH', { hour12: false });
}

function drawGauge(canvasId, value, min, max, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h - 10;
  const radius = 92;
  const start = Math.PI;
  const end = 2 * Math.PI;
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = start + (end - start) * ratio;

  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.strokeStyle = 'rgba(160,180,205,.25)';
  ctx.arc(cx, cy, radius, start, end, false);
  ctx.stroke();

  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, color);
  grad.addColorStop(1, '#d4fff5');
  ctx.beginPath();
  ctx.strokeStyle = grad;
  ctx.arc(cx, cy, radius, start, angle, false);
  ctx.stroke();

  const px = cx + Math.cos(angle) * radius;
  const py = cy + Math.sin(angle) * radius;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.fill();
}

async function loadLatest() {
  const res = await fetch(`${apiBase}/latest.php`, { cache: 'no-store' });
  const json = await res.json();
  const d = json.data;
  if (!d) return;

  document.getElementById('voltage-value').textContent = Number(d.voltage).toFixed(0);
  document.getElementById('current-value').textContent = Number(d.current).toFixed(1);
  document.getElementById('power-value').textContent = Number(d.power).toFixed(1);
  document.getElementById('temp-value').textContent = Number(d.temperature).toFixed(0);
  document.getElementById('latest-updated-text').textContent = d.reading_time;

  drawGauge('gaugeVoltage', Number(d.voltage), 180, 260, '#57ef9d');
  drawGauge('gaugeCurrent', Number(d.current), 0, 40, '#53d4ff');
  drawGauge('gaugePower', Number(d.power), 0, 8, '#57ef9d');
  drawGauge('gaugeTemp', Number(d.temperature), 0, 100, '#f2cf46');
}

async function loadTrend() {
  const metric = document.getElementById('metric-select').value;
  const range = document.querySelector('.range-btn.active').dataset.range;
  const res = await fetch(`${apiBase}/trend.php?metric=${encodeURIComponent(metric)}&range=${encodeURIComponent(range)}`);
  const json = await res.json();
  const labels = json.data.map(x => x.reading_time);
  const values = json.data.map(x => Number(x.value));

  const ctx = document.getElementById('trendChart');
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: metric,
        data: values,
        borderColor: '#70f0c0',
        backgroundColor: 'rgba(112,240,192,.20)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#dceeff' } } },
      scales: {
        x: { ticks: { color: '#cbd9ea', maxTicksLimit: 8 }, grid: { color: 'rgba(255,255,255,.05)' } },
        y: { ticks: { color: '#cbd9ea' }, grid: { color: 'rgba(255,255,255,.06)' } }
      }
    }
  });
}

async function loadReport(page = 1) {
  reportPage = page;
  const date = document.getElementById('report-date').value;
  const site = document.getElementById('report-site').value;
  const res = await fetch(`${apiBase}/report.php?page=${page}&date=${date}&site=${encodeURIComponent(site)}`);
  const json = await res.json();
  const tbody = document.getElementById('report-tbody');
  tbody.innerHTML = json.rows.map(r => `
    <tr>
      <td>${r.reading_time}</td>
      <td>${r.site_name}</td>
      <td>${Number(r.voltage).toFixed(0)}</td>
      <td>${Number(r.current).toFixed(1)}</td>
      <td>${Number(r.power).toFixed(1)}</td>
      <td>${Number(r.temperature).toFixed(0)}</td>
      <td>${Number(r.energy).toFixed(2)}</td>
    </tr>
  `).join('') || '<tr><td colspan="7">ไม่พบข้อมูล</td></tr>';

  document.getElementById('page-label').textContent = json.page;
  document.getElementById('page-total').textContent = json.total_pages;
  document.getElementById('current-page').textContent = json.page;
}

function bindEvents() {
  document.getElementById('metric-select').addEventListener('change', loadTrend);
  document.querySelectorAll('.range-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadTrend();
  }));

  document.getElementById('report-date').addEventListener('change', () => loadReport(1));
  document.getElementById('prev-page').addEventListener('click', () => loadReport(Math.max(1, reportPage - 1)));
  document.getElementById('next-page').addEventListener('click', () => loadReport(reportPage + 1));
  document.getElementById('export-csv').addEventListener('click', () => {
    const date = document.getElementById('report-date').value;
    const site = document.getElementById('report-site').value;
    window.location.href = `${apiBase}/export_csv.php?date=${date}&site=${encodeURIComponent(site)}`;
  });
  document.getElementById('export-btn').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'trend-chart.png';
    link.href = document.getElementById('trendChart').toDataURL('image/png');
    link.click();
  });
}

function init() {
  renderClock();
  setInterval(renderClock, 1000);
  document.getElementById('report-date').value = new Date().toISOString().slice(0, 10);
  bindEvents();
  loadLatest();
  loadTrend();
  loadReport(1);
  setInterval(loadLatest, 5000);
  setInterval(loadTrend, 60000);
}

document.addEventListener('DOMContentLoaded', init);

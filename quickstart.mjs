// Ecovolt quickstart: call a few endpoints and chart the results.
//
//   ECOVOLT_API_KEY=... ECOVOLT_SYSTEM_ID=... node quickstart.mjs   (Node 18+)
//
// Writes ecovolt-dashboard.html in the current folder; open it in a browser.
// Charts whose endpoints your key can't call are skipped.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API = process.env.ECOVOLT_API_URL ?? 'https://api.ecovolt.ai';
const SYSTEM_ID = process.env.ECOVOLT_SYSTEM_ID;
const KEY = process.env.ECOVOLT_API_KEY;
if (!SYSTEM_ID || !KEY) throw new Error('Set ECOVOLT_API_KEY and ECOVOLT_SYSTEM_ID');

const now = new Date();

async function get(path, days) {
  const url = new URL(path, API);
  if (days) {
    url.searchParams.set('from', new Date(now - days * 86_400_000).toISOString());
    url.searchParams.set('till', now.toISOString());
  }
  const res = await fetch(url, { headers: { 'x-api-key': KEY } });
  if (res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

// Customer keys use /directory; hackathon sandbox keys only have /sandbox-directory.
const directory =
  (await get(`/api/system/${SYSTEM_ID}/directory`)) ?? (await get(`/api/system/${SYSTEM_ID}/sandbox-directory`));
const { devices, rooms } = directory;
console.log(`${rooms.length} rooms, ${devices.length} devices`);

const charts = [];

// 1. Devices by type, straight from the Directory.
const typeCounts = Object.entries(
  devices.reduce((acc, d) => ({ ...acc, [d.deviceType]: (acc[d.deviceType] ?? 0) + 1 }), {})
).sort((a, b) => b[1] - a[1]);
charts.push({
  title: 'Devices by type',
  type: 'bar',
  labels: typeCounts.map(([t]) => t),
  values: typeCounts.map(([, n]) => n),
});

// 2. Daily energy for the whole system over the last 14 days.
const daily = await get(`/api/usage-history/date-range/system/${SYSTEM_ID}`, 14);
if (daily?.length) {
  charts.push({
    title: 'Daily energy, last 14 days (kWh)',
    type: 'bar',
    labels: daily.map((d) => d.date.slice(5, 10)),
    values: daily.map((d) => d.totalEnergyUsage),
  });
}

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ecovolt</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; background: #fafafa; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 16px; }
    .card { background: white; border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; }
  </style>
</head>
<body>
  <h1>Ecovolt</h1>
  <div class="grid">${charts.map((_, i) => `<div class="card"><canvas id="c${i}"></canvas></div>`).join('')}</div>
  <script>
    const charts = ${JSON.stringify(charts)};
    charts.forEach((c, i) => new Chart(document.getElementById('c' + i), {
      type: c.type,
      data: { labels: c.labels, datasets: [{ data: c.values, backgroundColor: '#16a34a', borderColor: '#16a34a' }] },
      options: {
        indexAxis: c.horizontal ? 'y' : 'x',
        plugins: { title: { display: true, text: c.title }, legend: { display: false } },
      },
    }));
  </script>
</body>
</html>`;

const out = resolve('ecovolt-dashboard.html');
writeFileSync(out, html);
console.log(`Saved ${out}`);

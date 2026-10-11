// Nikhil's dashboard: /api/dashboard?key=DASHBOARD_KEY&days=30
import { getMetrics } from '../lib/metrics.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (!process.env.DASHBOARD_KEY || req.query.key !== process.env.DASHBOARD_KEY) {
    return res.status(401).send('Unauthorised');
  }
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const data = await getMetrics(days);
  // Safe to inline: escape "<" so no value can close the script tag.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(page(json, days, req.query.key));
}

const page = (json, days, key) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aangan Enquiry Dashboard</title>
<style>
:root {
  color-scheme: light;
  --page: #f9f9f7; --surface: #fcfcfb; --ink: #0b0b0b; --ink-2: #52514e; --muted: #898781;
  --grid: #e1e0d9; --axis: #c3c2b7; --ring: rgba(11,11,11,0.10);
  --s1: #2a78d6; --s2: #eb6834;
  --good: #0ca30c; --good-text: #006300; --critical: #d03b3b; --warning: #fab219;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) {
    color-scheme: dark;
    --page: #0d0d0d; --surface: #1a1a19; --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
    --grid: #2c2c2a; --axis: #383835; --ring: rgba(255,255,255,0.10);
    --s1: #3987e5; --s2: #d95926; --good-text: #0ca30c;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --page: #0d0d0d; --surface: #1a1a19; --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
  --grid: #2c2c2a; --axis: #383835; --ring: rgba(255,255,255,0.10);
  --s1: #3987e5; --s2: #d95926; --good-text: #0ca30c;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--ink); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1180px; margin: 0 auto; padding: 24px 16px 48px; }
header { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; justify-content: space-between; margin-bottom: 20px; }
h1 { font-size: 22px; margin: 0; font-weight: 650; }
.sub { color: var(--ink-2); margin: 2px 0 0; }
.range { display: flex; border: 1px solid var(--ring); border-radius: 8px; overflow: hidden; background: var(--surface); }
.range a { padding: 6px 12px; color: var(--ink-2); text-decoration: none; font-weight: 500; }
.range a[aria-current] { background: var(--ink); color: var(--surface); }
.tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 12px; }
@media (max-width: 900px) { .tiles { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 520px) { .tiles { grid-template-columns: 1fr; } }
.tile, .card { background: var(--surface); border: 1px solid var(--ring); border-radius: 12px; padding: 16px; }
.tile .label { color: var(--ink-2); font-size: 13px; }
.tile .value { font-size: 32px; font-weight: 650; margin: 4px 0 2px; letter-spacing: -0.02em; }
.tile .note { color: var(--muted); font-size: 12.5px; }
.mini { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
.mini .value { font-size: 22px; }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 12px; margin-bottom: 12px; }
.card h2 { font-size: 15px; margin: 0 0 2px; font-weight: 600; }
.card .desc { color: var(--muted); font-size: 12.5px; margin: 0 0 10px; }
.legend { display: flex; gap: 14px; font-size: 12.5px; color: var(--ink-2); margin-bottom: 6px; }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
.chart { position: relative; width: 100%; }
.chart svg { display: block; width: 100%; overflow: visible; }
.tip { position: fixed; pointer-events: none; background: var(--ink); color: var(--surface); padding: 6px 9px; border-radius: 6px; font-size: 12.5px; white-space: nowrap; opacity: 0; transition: opacity .08s; z-index: 10; }
.status { display: inline-flex; align-items: center; gap: 6px; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--grid); white-space: nowrap; }
th { color: var(--muted); font-weight: 500; font-size: 12px; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
.scroll { overflow-x: auto; }
.pill { font-size: 12px; padding: 2px 8px; border-radius: 99px; border: 1px solid var(--ring); color: var(--ink-2); }
.empty { color: var(--muted); padding: 24px 0; text-align: center; }
footer { color: var(--muted); font-size: 12px; margin-top: 16px; }
</style>
</head>
<body>
<main>
  <header>
    <div>
      <h1>Aangan Studio · Phone enquiries</h1>
      <p class="sub">AI receptionist performance and running cost · <span id="gen"></span></p>
    </div>
    <nav class="range" aria-label="Date range">
      ${[7, 30, 90].map((d) => `<a href="?key=${encodeURIComponent(key)}&days=${d}"${d === days ? ' aria-current="page"' : ''}>${d} days</a>`).join('')}
    </nav>
  </header>

  <section class="tiles" id="tiles"></section>
  <section class="mini" id="mini"></section>

  <section class="grid2">
    <div class="card"><h2>Calls per day</h2><p class="desc">Every call answered by the AI, IST</p><div class="chart" id="c-day"></div></div>
    <div class="card"><h2>When calls arrive</h2><p class="desc">Calls by hour of day, IST — after-hours calls were the ones going unanswered</p>
      <div class="legend"><span><i style="background:var(--s1)"></i>Studio hours (10am–7pm)</span><span><i style="background:var(--s2)"></i>After hours</span></div>
      <div class="chart" id="c-hour"></div></div>
  </section>
  <section class="grid2">
    <div class="card"><h2>What the calls were</h2><p class="desc">AI outcome against Nikhil's qualification rubric</p><div class="chart" id="c-out"></div></div>
    <div class="card"><h2>Running cost per day (₹)</h2><p class="desc">Vaani voice minutes + Gemini analysis</p><div class="chart" id="c-cost"></div></div>
  </section>

  <section class="card">
    <h2>Recent calls</h2><p class="desc">Latest 25 in range</p>
    <div class="scroll"><table id="recent"></table></div>
  </section>
  <footer>Voice cost is estimated at the Vaani per-minute rate; Gemini cost from token usage. Times in IST.</footer>
</main>
<div class="tip" id="tip" role="status"></div>
<script>
const D = ${json};
const $ = (id) => document.getElementById(id);
const inr = (n, dp = 0) => n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: dp, minimumFractionDigits: dp });
const pct = (n) => n == null ? '—' : Math.round(n * 100) + '%';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtIST = (d, o) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...o });
const LABEL = { qualified: 'Qualified', needs_review: 'Needs a human', budget_review: 'Budget review', nurture: 'Not now (nurture)', declined: 'Not a fit', message: 'Message / non-enquiry' };

$('gen').textContent = 'last ' + D.days + ' days · updated ' + fmtIST(D.generatedAt, { dateStyle: 'medium', timeStyle: 'short' });

const k = D.kpis;
$('tiles').innerHTML = [
  ['Calls answered', k.calls, k.afterHours + ' after hours (' + pct(k.calls ? k.afterHours / k.calls : null) + ') — 0 missed'],
  ['Consultations booked', k.booked, pct(k.bookingRate) + ' of ' + k.enquiries + ' new enquiries'],
  ['Designer pickup (median)', k.medianPickupMin == null ? '—' : Math.round(k.medianPickupMin) + ' min', k.unaccepted + ' qualified lead' + (k.unaccepted === 1 ? '' : 's') + ' not yet accepted'],
  ['Cost to run', inr(k.totalCost), inr(k.costPerCall, 2) + ' per call · ' + inr(k.costPerBooked) + ' per booked consultation'],
].map(([l, v, n]) => '<div class="tile"><div class="label">' + l + '</div><div class="value">' + esc(v) + '</div><div class="note">' + esc(n) + '</div></div>').join('');

$('mini').innerHTML = [
  ['Qualified leads', k.qualified, ''],
  ['Avg call length', k.avgCallMin == null ? '—' : k.avgCallMin.toFixed(1) + ' min', ''],
  ['Guardrail breaches', k.breaches, k.breaches
    ? '<span class="status"><span class="dot" style="background:var(--critical)"></span>Review transcripts</span>'
    : '<span class="status"><span class="dot" style="background:var(--good)"></span>None — no prices quoted</span>'],
].map(([l, v, n]) => '<div class="tile"><div class="label">' + l + '</div><div class="value">' + esc(v) + '</div><div class="note">' + n + '</div></div>').join('');

// ---- charts -------------------------------------------------------------
const tip = $('tip');
function showTip(e, html) { tip.innerHTML = html; tip.style.opacity = 1; moveTip(e); }
function moveTip(e) { const x = Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8); tip.style.left = x + 'px'; tip.style.top = (e.clientY - tip.offsetHeight - 10) + 'px'; }
function hideTip() { tip.style.opacity = 0; }

function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
const NS = 'http://www.w3.org/2000/svg';
const el = (t, a, p) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); p && p.appendChild(n); return n; };
// Bar with a 4px rounded data-end, square at the baseline.
function barPath(x, y, w, h) { const r = Math.min(4, w / 2, h); return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z'; }

// Vertical bars. items: [{label, value, color, tip}]; fmt formats axis ticks.
// integer: counts get whole-number ticks (max at least 4, divisible by 4).
function vbars(host, items, { fmt = (v) => v, every = 1, ariaLabel, integer = false }) {
  const W = host.clientWidth, H = 200, m = { t: 8, r: 4, b: 26, l: 40 };
  host.innerHTML = '';
  const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, height: H, role: 'img', 'aria-label': ariaLabel }, host);
  const peak = Math.max(...items.map((d) => d.value), 0);
  const max = integer ? Math.max(4, Math.ceil(peak / 4) * 4) : niceMax(peak);
  const ih = H - m.t - m.b, iw = W - m.l - m.r, y = (v) => m.t + ih - (v / max) * ih;
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i, yy = y(v);
    el('line', { x1: m.l, x2: W - m.r, y1: yy, y2: yy, stroke: i ? 'var(--grid)' : 'var(--axis)', 'stroke-width': 1 }, svg);
    el('text', { x: m.l - 6, y: yy + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)' }, svg).textContent = fmt(v);
  }
  const step = iw / items.length, bw = Math.max(2, Math.min(28, step - 2));
  items.forEach((d, i) => {
    const x = m.l + i * step + (step - bw) / 2;
    if (d.value > 0) el('path', { d: barPath(x, y(d.value), bw, y(0) - y(d.value)), fill: d.color }, svg);
    if (i % every === 0) el('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--muted)' }, svg).textContent = d.label;
    const hit = el('rect', { x: m.l + i * step, y: m.t, width: step, height: ih, fill: 'transparent' }, svg);
    hit.addEventListener('mouseenter', (e) => showTip(e, d.tip));
    hit.addEventListener('mousemove', moveTip);
    hit.addEventListener('mouseleave', hideTip);
  });
}

// Horizontal bars with direct value labels (single series, no legend).
function hbars(host, items, ariaLabel) {
  const W = host.clientWidth, row = 30, m = { l: 150, r: 40 }, H = items.length * row;
  host.innerHTML = '';
  const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, height: H, role: 'img', 'aria-label': ariaLabel }, host);
  const max = Math.max(...items.map((d) => d.value), 1), iw = W - m.l - m.r;
  items.forEach((d, i) => {
    const yy = i * row, w = (d.value / max) * iw;
    el('text', { x: m.l - 10, y: yy + 19, 'text-anchor': 'end', 'font-size': 12.5, fill: 'var(--ink-2)' }, svg).textContent = d.label;
    el('line', { x1: m.l, x2: m.l, y1: yy + 4, y2: yy + row - 4, stroke: 'var(--axis)' }, svg);
    if (d.value > 0) {
      const h = 16, x = m.l, y0 = yy + 7, r = Math.min(4, w);
      el('path', { d: 'M' + x + ',' + y0 + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y0 + ' ' + (x + w) + ',' + (y0 + r) + 'V' + (y0 + h - r) + 'Q' + (x + w) + ',' + (y0 + h) + ' ' + (x + w - r) + ',' + (y0 + h) + 'H' + x + 'Z', fill: 'var(--s1)' }, svg);
    }
    el('text', { x: m.l + w + 6, y: yy + 19, 'font-size': 12.5, fill: 'var(--ink)', 'font-weight': 600 }, svg).textContent = d.value;
    const hit = el('rect', { x: 0, y: yy, width: W, height: row, fill: 'transparent' }, svg);
    hit.addEventListener('mouseenter', (e) => showTip(e, d.tip));
    hit.addEventListener('mousemove', moveTip);
    hit.addEventListener('mouseleave', hideTip);
  });
}

const shortDay = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const hourLabel = (h) => (h % 12 || 12) + (h < 12 ? 'a' : 'p');
const dayEvery = D.days <= 7 ? 1 : D.days <= 30 ? 5 : 15;

function draw() {
  vbars($('c-day'), D.byDay.map((d) => ({ label: shortDay(d.day), value: d.calls, color: 'var(--s1)',
    tip: '<b>' + shortDay(d.day) + '</b><br>' + d.calls + ' calls · ' + d.booked + ' booked' })), { every: dayEvery, ariaLabel: 'Calls per day', integer: true });
  vbars($('c-hour'), D.byHour.map((d) => ({ label: hourLabel(d.hour), value: d.calls, color: d.afterHours ? 'var(--s2)' : 'var(--s1)',
    tip: '<b>' + hourLabel(d.hour) + 'm</b> · ' + (d.afterHours ? 'after hours' : 'studio hours') + '<br>' + d.calls + ' calls' })), { every: 3, ariaLabel: 'Calls by hour of day', integer: true });
  hbars($('c-out'), D.outcomes.map((o) => ({ label: LABEL[o.outcome], value: o.calls,
    tip: '<b>' + LABEL[o.outcome] + '</b><br>' + o.calls + ' calls' })), 'Calls by outcome');
  vbars($('c-cost'), D.byDay.map((d) => ({ label: shortDay(d.day), value: d.cost, color: 'var(--s1)',
    tip: '<b>' + shortDay(d.day) + '</b><br>' + inr(d.cost, 2) + ' · ' + d.calls + ' calls' })), { every: dayEvery, fmt: (v) => '₹' + Math.round(v), ariaLabel: 'Running cost per day' });
}
draw();
let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(draw, 80); }).observe(document.querySelector('main'));

// ---- recent calls table ---------------------------------------------------
$('recent').innerHTML = D.recent.length ? '<thead><tr><th>When (IST)</th><th>Caller</th><th>Locality</th><th>Outcome</th><th>Consultation</th><th>Designer</th><th class="num">Cost</th><th>Guardrails</th></tr></thead><tbody>' +
  D.recent.map((r) => '<tr><td>' + esc(fmtIST(r.at, { dateStyle: 'medium', timeStyle: 'short' })) + (r.afterHours ? ' <span class="pill">after hours</span>' : '') + '</td>' +
    '<td>' + esc(r.caller || '—') + '</td><td>' + esc(r.locality || '—') + '</td><td>' + esc(LABEL[r.outcome] || r.outcome || '—') + '</td>' +
    '<td>' + (r.booked ? esc(fmtIST(r.booked, { dateStyle: 'medium', timeStyle: 'short' })) : '—') + '</td>' +
    '<td>' + esc(r.designer || '—') + (r.designer ? (r.accepted ? ' <span class="pill">accepted</span>' : ' <span class="pill">pending</span>') : '') + '</td>' +
    '<td class="num">' + inr(r.cost, 2) + '</td>' +
    '<td>' + (r.breach ? '<span class="status"><span class="dot" style="background:var(--critical)"></span>Breach</span>' : '<span class="status"><span class="dot" style="background:var(--good)"></span>OK</span>') + '</td></tr>').join('') + '</tbody>'
  : '<tbody><tr><td class="empty">No calls in this range yet.</td></tr></tbody>';
</script>
</body>
</html>`;

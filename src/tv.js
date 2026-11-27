// TV calendar: Brian's week with a red X through finished days, and today's appointments and tasks.
// Read-only. Connects with a 6-letter code (no sign-in on the TV), then updates live from Daybook.
import * as D from "./data.js";
import { BRIAN_TIMEZONE as TZ } from "./config.js";
import { esc, DAYS, MON, fmt12, wall, dayKey, hmOf, mins, addDays, weekdayOf, occurrences, slotsFor } from "./util.js";

const S = { settings: null, appts: [], logs: [], todos: [] };
const stage = document.getElementById("stage");
let started = false, unsubs = [], offline = !navigator.onLine;

/* fit the 1920×1080 design to any screen */
function fit() { const k = Math.min(innerWidth / 1920, innerHeight / 1080); stage.style.transform = `translate(-50%,-50%) scale(${k})`; }
addEventListener("resize", fit); fit();

/* ---------- connect this TV with a code ---------- */
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from(crypto.getRandomValues(new Uint32Array(6)), n => CODE_CHARS[n % CODE_CHARS.length]).join("");
async function showPairing(uid) {
  let code = ""; try { code = localStorage.getItem("daybook-tv-code") || ""; } catch {}
  for (let i = 0; i < 4; i++) {
    if (!code) { code = newCode(); try { localStorage.setItem("daybook-tv-code", code); } catch {} }
    try { await D.createPairing(code, uid); break; } catch { code = ""; }
  }
  stage.innerHTML = `<div class="pair"><h1>Connect this screen to Daybook</h1>
    <p>In Daybook, go to <b>Setup → Connect a TV</b> and type this code:</p>
    <div class="code">${esc(code.slice(0, 3))}-${esc(code.slice(3))}</div>
    <p>This screen changes by itself once it's connected.</p></div>`;
}
function start() {
  if (started) return; started = true;
  try { localStorage.removeItem("daybook-tv-code"); } catch {}
  ["settings", "appts", "logs", "todos"].forEach(n => unsubs.push(D.watch(n, d => { S[n] = d; render(); }, e => console.error(e))));
  render();
}
function stop() { started = false; unsubs.splice(0).forEach(f => f()); }
if (!D.configured) stage.innerHTML = `<div class="pair"><h1>Not set up yet</h1></div>`;
else {
  let devUnsub = null;
  D.onUser(u => {
    if (devUnsub) { devUnsub(); devUnsub = null; }
    if (!u) { stage.innerHTML = `<div class="pair"><p>Starting…</p></div>`; D.signInAnon().catch(() => { stage.innerHTML = `<div class="pair"><h1>Can't connect</h1><p>Check the internet, then reload this page.</p></div>`; }); return; }
    devUnsub = D.watchDevice(u.uid, ok => { if (ok) start(); else { stop(); showPairing(u.uid); } });
  });
}

/* ---------- weather (Beaverton, Fahrenheit) from Open-Meteo: free, no key ---------- */
const WX_URL = "https://api.open-meteo.com/v1/forecast?latitude=45.4871&longitude=-122.8037&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles&forecast_days=7";
let WX = null;
try { WX = JSON.parse(localStorage.getItem("daybook-tv-wx") || "null"); } catch {}
async function loadWeather() {
  try {
    const r = await fetch(WX_URL, { cache: "no-store" }); if (!r.ok) return;
    const j = await r.json(); if (!j.current || !j.daily) return;
    WX = { at: Date.now(), now: j.current, daily: j.daily };
    try { localStorage.setItem("daybook-tv-wx", JSON.stringify(WX)); } catch {}
    render();
  } catch {}
}
loadWeather(); setInterval(loadWeather, 20 * 60 * 1000);
// WMO weather codes -> words and an icon
function wxInfo(code) {
  const c = +code;
  if (c === 0) return ["Clear", "sun"]; if (c === 1) return ["Mostly clear", "sun"]; if (c === 2) return ["Partly cloudy", "part"]; if (c === 3) return ["Cloudy", "cloud"];
  if (c === 45 || c === 48) return ["Fog", "fog"];
  if (c >= 51 && c <= 57) return [c === 51 ? "Light drizzle" : c === 55 ? "Heavy drizzle" : c >= 56 ? "Freezing drizzle" : "Drizzle", "rain"];
  if (c >= 61 && c <= 67) return [c === 61 ? "Light rain" : c === 65 ? "Heavy rain" : c >= 66 ? "Freezing rain" : "Rain", "rain"];
  if (c >= 71 && c <= 77) return [c === 71 ? "Light snow" : c === 75 ? "Heavy snow" : "Snow", "snow"];
  if (c >= 80 && c <= 82) return [c === 82 ? "Heavy showers" : "Showers", "rain"];
  if (c === 85 || c === 86) return ["Snow showers", "snow"];
  if (c >= 95) return ["Thunderstorm", "storm"];
  return ["", "cloud"];
}
function wxIcon(kind, size, night) {
  const sun = `<circle cx="24" cy="24" r="9" fill="#f2b01e"/><g stroke="#f2b01e" stroke-width="3" stroke-linecap="round"><path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M38 10l-4 4M14 34l-4 4"/></g>`;
  const moon = `<path d="M30 8a16 16 0 1 0 10 26A13 13 0 0 1 30 8z" fill="#8a96a0"/>`;
  const cloud = (x = 0, y = 0, f = "#c9d3dc") => `<path transform="translate(${x} ${y})" d="M14 38h22a9 9 0 0 0 0-18 12 12 0 0 0-23-2A8 8 0 0 0 14 38z" fill="${f}" stroke="#7d8b97" stroke-width="2"/>`;
  const body = { sun: night ? moon : sun, part: `<g transform="translate(-6 -6) scale(.8)">${night ? moon : sun}</g>${cloud(2, 4)}`, cloud: cloud(),
    fog: `${cloud(0, -6)}<g stroke="#7d8b97" stroke-width="3" stroke-linecap="round"><path d="M8 40h32M12 46h24"/></g>`,
    rain: `${cloud(0, -6)}<g stroke="#1f5fd1" stroke-width="3" stroke-linecap="round"><path d="M16 38l-3 7M25 38l-3 7M34 38l-3 7"/></g>`,
    snow: `${cloud(0, -6)}<g fill="#1f5fd1"><circle cx="15" cy="41" r="2.5"/><circle cx="24" cy="44" r="2.5"/><circle cx="33" cy="41" r="2.5"/></g>`,
    storm: `${cloud(0, -6)}<path d="M25 32l-6 10h6l-4 8 10-12h-6l4-6z" fill="#f2b01e"/>` }[kind] || cloud();
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true" style="flex:none">${body}</svg>`;
}
const wxDay = k => { if (!WX) return null; const i = WX.daily.time.indexOf(k); return i < 0 ? null : { code: WX.daily.weather_code[i], hi: Math.round(WX.daily.temperature_2m_max[i]), lo: Math.round(WX.daily.temperature_2m_min[i]) }; };

/* ---------- the calendar ---------- */
const checks = () => (S.settings && Array.isArray(S.settings.checks)) ? S.settings.checks : [];
const partOfDay = h => h < 5 ? "Night" : h < 12 ? "Morning" : h < 17 ? "Afternoon" : h < 21 ? "Evening" : "Night";
const monthDay = k => { const [, m, d] = k.split("-").map(Number); return `${d} ${MON[m - 1]}`; };
function dayItems(k) {
  const appts = S.appts.filter(a => occurrences(a.date, a.repeat, k, k).length)
    .map(a => ({ sort: a.time || "00:00", tm: a.time ? fmt12(a.time) : "All day", what: a.title }));
  const todos = S.todos.filter(t => t.due === k && !t.done).map(t => ({ sort: "99", tm: "To do", what: t.text }));
  return appts.sort((a, b) => a.sort.localeCompare(b.sort)).concat(todos);
}
function render() {
  if (!started) return;
  const w = wall(TZ), tk = dayKey(w), nm = w.h * 60 + w.mi, name = (S.settings && S.settings.name) || "Brian";
  const sun = addDays(tk, -weekdayOf(tk)), days = Array.from({ length: 7 }, (_, i) => addDays(sun, i));
  const cell = k => {
    const items = dayItems(k), shown = items.slice(0, 5), done = k < tk, today = k === tk;
    return `<div class="day ${done ? "done" : ""} ${today ? "today" : ""}">
      <div style="display:flex;flex-direction:column;gap:2px"><span class="nm">${DAYS[weekdayOf(k)]}</span><span class="num">${+k.slice(8)}</span>${today ? `<span class="badge">Today</span>` : ""}
        ${!done && wxDay(k) ? (f => `<span class="fc" title="${esc(wxInfo(f.code)[0])}">${wxIcon(wxInfo(f.code)[1], 30)}<span>${f.hi}° / ${f.lo}°</span></span>`)(wxDay(k)) : ""}</div>
      ${shown.map(i => `<div class="it"><span class="tm">${esc(i.tm)}</span><span class="what">${esc(i.what)}</span></div>`).join("")}
      ${items.length > shown.length ? `<span class="more">+${items.length - shown.length} more</span>` : ""}
      ${done ? `<svg class="x" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M8 8 L92 92 M92 8 L8 92" vector-effect="non-scaling-stroke"/></svg>` : ""}</div>`;
  };
  // today's tasks: each pill/insulin/check time (ticked when logged), then to-dos due today or earlier
  const dayLogs = S.logs.filter(l => (l.local || "").startsWith(tk));
  const tasks = checks().flatMap(c => slotsFor(c, dayLogs, nm).map(s => ({ sort: s.t, what: c.name, when: fmt12(s.t), done: s.st === "done" })))
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .concat(S.todos.filter(t => !t.done && t.due && t.due <= tk).map(t => ({ what: t.text, when: t.due < tk ? "Overdue" : "", done: false })))
    .concat(S.todos.filter(t => (t.done && (t.doneAt || "").length && dayKey(wall(TZ, new Date(t.doneAt))) === tk) || (t.lastDone && dayKey(wall(TZ, new Date(t.lastDone))) === tk)).map(t => ({ what: t.text, when: "", done: true })));
  const todayAppts = dayItems(tk).filter(i => i.tm !== "To do");
  stage.innerHTML = `<div class="screen">
    <div class="left">
      <div class="top"><div><h1>${esc(name)}'s week</h1><p>${esc(monthDay(sun))} – ${esc(monthDay(days[6]))}</p></div>
        ${WX && Date.now() - WX.at < 6 * 3600e3 ? (() => { const [txt, kind] = wxInfo(WX.now.weather_code), d = wxDay(tk), night = w.h >= 18 || w.h < 7;
          return `<div class="wx">${wxIcon(kind, 72, night)}<span class="wxt">${Math.round(WX.now.temperature_2m)}°F</span><span class="wxd"><b>${esc(txt)}</b>${d ? `<br>High ${d.hi}° · Low ${d.lo}°` : ""}<br><span class="wxp">Beaverton</span></span></div>`; })() : ""}</div>
      <div class="week">${days.map(cell).join("")}</div>
    </div>
    <div class="right">
      <div><p class="big1">${DAYS[w.wd]}</p><p class="big2">${w.d} ${MON[w.mo - 1]} ${w.y}</p>
        <p class="clock">${esc(fmt12(hmOf(w)))}</p><p class="part">${partOfDay(w.h)}</p></div>
      <div style="display:flex;flex-direction:column;gap:10px"><h2>Appointments today</h2>
        ${todayAppts.length ? todayAppts.slice(0, 3).map(a => `<div class="appt"><span class="tm">${esc(a.tm)}</span><span class="what">${esc(a.what)}</span></div>`).join("") : `<p class="none">Nothing booked today.</p>`}</div>
      <div style="display:flex;flex-direction:column;gap:10px"><h2>Today's tasks</h2>
        ${tasks.length ? tasks.slice(0, 8).map(t => `<div class="task ${t.done ? "done" : ""}"><span class="box">${t.done ? "✓" : ""}</span><span class="tw">${esc(t.what)}</span><span class="tt">${esc(t.when)}</span></div>`).join("") : `<p class="none">No tasks today.</p>`}</div>
      <p class="love">Levi made this with love</p>
    </div></div>${offline ? `<div class="status">Offline: showing the last saved info</div>` : ""}`;
  // dim the screen at night (10 pm – 6 am Portland), and nudge it a few pixels so the TV doesn't burn in
  document.getElementById("night").style.opacity = (w.h >= 22 || w.h < 6) ? "0.6" : "0";
  stage.style.marginLeft = `${(w.mi % 5) - 2}px`; stage.style.marginTop = `${(w.mi % 3) - 1}px`;
}
setInterval(render, 30000);
addEventListener("online", () => { offline = false; render(); });
addEventListener("offline", () => { offline = true; render(); });

/* keep the screen awake where the browser allows it */
let lock = null;
async function wake() { try { if ("wakeLock" in navigator && !lock) { lock = await navigator.wakeLock.request("screen"); lock.addEventListener("release", () => { lock = null; }); } } catch {} }
document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
wake();
// reload once a day at 3 am to pick up app updates
setInterval(() => { const w = wall(TZ); if (w.h === 3 && w.mi === 0) location.reload(); }, 60000);

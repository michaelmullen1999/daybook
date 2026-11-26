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
      <div style="display:flex;flex-direction:column;gap:2px"><span class="nm">${DAYS[weekdayOf(k)]}</span><span class="num">${+k.slice(8)}</span>${today ? `<span class="badge">Today</span>` : ""}</div>
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
      <div class="top"><h1>${esc(name)}'s week</h1><p>${esc(monthDay(sun))} – ${esc(monthDay(days[6]))}</p></div>
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

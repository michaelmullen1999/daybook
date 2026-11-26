// Brian's tablet app
import * as D from "./data.js";
import { SHARED_WITH, BRIAN_TIMEZONE as TZ } from "./config.js";
import { $, esc, pad, DAYS, MON, mins, fmt12, wall, dayKey, hmOf, relDay, daysBetween, prettyDate, ago, slotsFor, valueText, zonedToDate, makeSheet, val, copyText, themeSwitch, nextDate, occurrences, repeatLabel, REPEAT_OPTIONS, tickTodo, addDays, drawReadings, inRangeText } from "./util.js";
themeSwitch();
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const native = Capacitor.isNativePlatform();
const S = { settings: null, appts: [], logs: [], hobbies: [], todos: [] };
const sheet = makeSheet();
const unsubs = [];
let user = null;

/* ---------- connect this device (no password: the family types its code on the family page) ---------- */
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from(crypto.getRandomValues(new Uint32Array(6)), n => CODE_CHARS[n % CODE_CHARS.length]).join("");
let deviceUnsub = null, started = false;
function gate(html) { $("app").hidden = true; $("gate").hidden = false; $("gate").innerHTML = html; }
async function showPairing(uid) {
  let code = ""; try { code = localStorage.getItem("daybook-code") || ""; } catch {}
  for (let i = 0; i < 4; i++) {
    if (!code) { code = newCode(); try { localStorage.setItem("daybook-code", code); } catch {} }
    try { await D.createPairing(code, uid); break; } catch (e) { if (i === 3) console.error(e); code = ""; }
  }
  gate(`<h1>Connect this device</h1>
    <p>On the family page, go to <b>People</b> and type this code:</p>
    <p style="font-size:clamp(44px,12vw,64px);font-weight:700;letter-spacing:.12em;margin:10px 0">${esc(code.slice(0, 3))}-${esc(code.slice(3))}</p>
    <p class="small">This screen moves on by itself once it's connected.</p>`);
}
function startApp() {
  if (started) { $("gate").hidden = true; $("app").hidden = false; return; }
  started = true; $("gate").hidden = true; $("app").hidden = false;
  try { localStorage.removeItem("daybook-code"); } catch {}
  const onErr = err => { console.error(err); $("offline").textContent = "Can't load the Daybook right now. Check the internet connection."; $("offline").hidden = false; };
  ["settings", "appts", "logs", "hobbies", "todos"].forEach(n => unsubs.push(D.watch(n, data => { S[n] = data; renderAll(); if (n === "settings" || n === "appts") scheduleSoon(); if (n === "logs" || n === "settings") setTimeout(runPendingAction, 0); }, onErr)));
  renderAll();
}
function stopApp() { started = false; unsubs.splice(0).forEach(f => f()); }
if (!D.configured) gate(`<h1>Not set up yet</h1><p>Add the Firebase details to <b>src/config.js</b> and rebuild.</p>`);
else D.onUser(u => {
  user = u;
  if (deviceUnsub) { deviceUnsub(); deviceUnsub = null; }
  if (!u) { gate(`<h1>Daybook</h1><p class="small">Starting…</p>`); D.signInAnon().catch(err => gate(`<h1>Daybook</h1><p>Can't connect. Check the internet and reopen the app.</p><p class="small">${esc(err.code || "")}</p>`)); return; }
  deviceUnsub = D.watchDevice(u.uid, ok => { if (ok) startApp(); else { stopApp(); showPairing(u.uid); } });
});

/* ---------- helpers ---------- */
const checks = () => (S.settings && Array.isArray(S.settings.checks)) ? S.settings.checks : [];
const now = () => wall(TZ); // always Portland time
const todayKey = () => dayKey(now());
const logTime = l => new Date(l.at);
const lastLog = id => S.logs.filter(l => l.check === id)[0]; // logs arrive newest first
const apptKey = a => `${a.date} ${a.time || "00:00"}`;

/* ---------- render ---------- */
function renderHeader() {
  const w = now(), h = w.h;
  const g = h < 5 ? "Hello" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  $("greet").textContent = `${g}, ${(S.settings && S.settings.name) || "Brian"}`;
  $("date").textContent = `${DAYS[w.wd]} ${w.d} ${MON[w.mo - 1]} ${w.y}`;
  $("clock").textContent = fmt12(hmOf(w));
}

function renderToday() {
  const w = now(), nm = w.h * 60 + w.mi, tk = dayKey(w);
  const dayLogs = S.logs.filter(l => (l.local || "").startsWith(tk));
  const all = checks().map(c => ({ c, slots: slotsFor(c, dayLogs, nm) }));
  const due = all.flatMap(x => x.slots.filter(s => s.st === "due").map(s => ({ c: x.c, s })));
  const later = all.flatMap(x => x.slots.filter(s => s.st === "later").map(s => ({ c: x.c, s }))).sort((a, b) => mins(a.s.t) - mins(b.s.t));
  const nx = $("next");
  if (due.length) { nx.className = "next due"; nx.innerHTML = `<b>Due now: ${due.map(d => esc(d.c.name)).join(", ")}</b><span>Scheduled ${due.map(d => fmt12(d.s.t)).join(", ")}</span>`; }
  else if (later.length) { const n = later[0], diff = mins(n.s.t) - nm; nx.className = "next"; nx.innerHTML = `<b>Next: ${esc(n.c.name)} at ${fmt12(n.s.t)}</b><span>in ${diff >= 60 ? Math.floor(diff / 60) + " h " : ""}${diff % 60} min</span>`; }
  else { nx.className = "next"; nx.innerHTML = checks().length ? `<b>All of today's checks are done or past.</b>` : `<b>No checks set yet.</b><span>The family will add them.</span>`; }

  let lo = 6 * 60; const hi = 24 * 60;
  checks().forEach(c => c.times.forEach(t => { const m = mins(t); if (m < lo) lo = Math.floor(m / 60) * 60; }));
  const pos = m => ((Math.min(Math.max(m, lo), hi) - lo) / (hi - lo) * 100).toFixed(2);
  const step = window.innerWidth < 600 ? 360 : 180, hrs = []; for (let m = lo; m <= hi; m += step) hrs.push(m);
  const nowLine = nm >= lo && nm <= hi ? `<div class="now" style="left:${pos(nm)}%"></div>` : "";
  $("timeline").innerHTML = all.length ? `<div class="tl-hours"><span></span><div class="track">${hrs.map(m => `<span class="hr${m === lo ? " first" : m === hi ? " last" : ""}" style="left:${pos(m)}%">${m === hi ? "12 am" : fmt12(pad(Math.floor(m / 60) % 24) + ":00").replace(":00", "")}</span>`).join("")}</div></div>` +
    all.map(x => `<div class="tl-row"><span class="nm">${esc(x.c.name)}</span><div class="track">${nowLine}${x.slots.map(s => `<span class="dot ${s.st}" style="left:${pos(mins(s.t))}%"></span>`).join("")}</div></div>`).join("") : "";

  $("checks").innerHTML = all.length ? all.map(x => {
    const ll = lastLog(x.c.id), isDue = x.slots.some(s => s.st === "due");
    const flag = ll ? inRangeText(ll.value, x.c) : "";
    const lastTxt = ll ? `Last logged ${ago(Date.now() - logTime(ll))} (${fmt12(ll.local.slice(11))}${valueText(ll, x.c.unit) ? ", " + esc(valueText(ll, x.c.unit)) : ""}${flag ? `, <span class="flag">${flag}</span>` : ""})` : "Not logged yet";
    return `<div class="item"><div><div class="t">${esc(x.c.name)}</div><div class="s ${isDue ? "duec" : ""}">${isDue ? "Due now. " : ""}${lastTxt}</div></div>
      <button class="pri" data-log="${esc(x.c.id)}">Log</button>
      <div class="slots">${x.slots.map(s => `<span class="chip ${s.st}">${fmt12(s.t)}${s.st === "done" ? " ✓" : s.st === "missed" ? " – missed" : ""}</span>`).join("")}</div></div>`;
  }).join("") : `<p class="empty">No checks set yet.</p>`;

  const up = upcomingAppts(tk).slice(0, 3);
  $("soonAppts").innerHTML = up.length ? up.map(a => apptRow(a, tk)).join("") : `<p class="empty">No appointments coming up.</p>`;

  const open = S.todos.filter(t => !t.done).sort(todoSort).slice(0, 5);
  $("todoPreview").innerHTML = open.length ? open.map(t => todoRow(t, tk)).join("") + (S.todos.filter(t => !t.done).length > 5 ? `<button class="link" data-tab="todo">See all</button>` : "") : `<p class="empty">Nothing on the list.</p>`;
  if (document.activeElement !== $("notes")) { try { $("notes").value = localStorage.getItem("daybook-notes") || ""; } catch {} }
}

const upcomingAppts = tk => S.appts.map(a => ({ ...a, start: a.date, date: nextDate(a.date, a.repeat, tk) })).filter(a => a.date >= tk).sort((a, b) => apptKey(a).localeCompare(apptKey(b)));
function apptRow(a, tk) {
  const p = prettyDate(a.date), rel = relDay(tk, a.date);
  const soon = rel === "Today" || rel === "Tomorrow";
  return `<div class="appt"><div class="d">${p.short}<small>${p.day.slice(0, 3)}${a.time ? " · " + fmt12(a.time) : ""}</small></div>
  <div><div class="t">${esc(a.title)}${a.repeat ? `<span class="rep">${esc(repeatLabel(a.repeat, a.start || a.date))}</span>` : ""}</div><div class="s ${soon ? "soon" : ""}">${rel}</div>
  ${a.where ? `<div class="s">${esc(a.where)}</div>` : ""}${a.with ? `<div class="s">With ${esc(a.with)}</div>` : ""}${a.notes ? `<div class="s">${esc(a.notes)}</div>` : ""}</div></div>`;
}
function renderAppts() {
  const tk = todayKey(), s = [...S.appts].sort((a, b) => apptKey(a).localeCompare(apptKey(b)));
  const up = upcomingAppts(tk), past = s.filter(a => !a.repeat && a.date < tk).reverse().slice(0, 15);
  $("apptList").innerHTML = up.length ? up.map(a => apptRow(a, tk)).join("") : `<p class="empty">Nothing booked.</p>`;
  $("pastList").innerHTML = past.length ? past.map(a => apptRow(a, tk)).join("") : `<p class="empty">None yet.</p>`;
}

const todoSort = (a, b) => (a.due || "9999").localeCompare(b.due || "9999") || (a.created || "").localeCompare(b.created || "");
function todoRow(t, tk) {
  const overdue = t.due && !t.done && t.due < tk;
  const meta = [t.due ? (overdue ? `Was due ${prettyDate(t.due).short}` : `Due ${relDay(tk, t.due).toLowerCase()}`) : "", t.repeat ? repeatLabel(t.repeat, t.due || tk) : "", t.by && t.by !== "Brian" ? `Added by ${t.by}` : ""].filter(Boolean).join(" · ");
  return `<div class="todo ${t.done ? "done" : ""}"><label><input type="checkbox" data-tick="${esc(t.id)}" ${t.done ? "checked" : ""}><span>${esc(t.text)}<span class="meta ${overdue ? "soon" : ""}">${esc(meta)}</span></span></label>
    <button class="link" data-tedit="${esc(t.id)}">Edit</button></div>`;
}
function renderTodos() {
  const tk = todayKey();
  const open = S.todos.filter(t => !t.done).sort(todoSort), done = S.todos.filter(t => t.done).sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || ""));
  $("todoList").innerHTML = open.length ? open.map(t => todoRow(t, tk)).join("") : `<p class="empty">Nothing on the list.</p>`;
  $("doneSum").textContent = `Done (${done.length})`;
  $("doneWrap").hidden = !done.length;
  $("doneList").innerHTML = done.map(t => todoRow(t, tk)).join("");
}

function renderHobbies() {
  const ae = document.activeElement; if (ae && ae.dataset && ae.dataset.hnote) return;
  const list = [...S.hobbies].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  $("hobList").innerHTML = list.length ? list.map(h => `<div class="hob"><div class="row"><span class="t">${esc(h.name)}</span>
    <span class="small">${h.last ? "Last done " + ago(Date.now() - new Date(h.last)) : "Not logged yet"}</span></div>
    <label for="hn-${esc(h.id)}">Where I left off</label><textarea id="hn-${esc(h.id)}" data-hnote="${esc(h.id)}" placeholder="Page number, next step, what I was making…">${esc(h.note)}</textarea>
    <div class="row-btns"><button class="pri" data-hdone="${esc(h.id)}">Did this today</button><button data-hdel="${esc(h.id)}">Remove</button></div></div>`).join("") : `<p class="empty">No hobbies yet. Add one.</p>`;
}

/* ---------- readings chart (Log tab) ---------- */
let chartDays = 7;
const wallMs = l => { const [d, t] = l.local.split(" "); const [y, m, dd] = d.split("-").map(Number); const [h, mi] = t.split(":").map(Number); return Date.UTC(y, m - 1, dd, h, mi); };
function renderCharts(tk) {
  const box = $("logCharts"); if (!box) return;
  const vc = checks().filter(c => c.value), ranged = vc.filter(c => (c.low !== "" && c.low != null) || (c.high !== "" && c.high != null));
  const list = ranged.length ? ranged : vc.slice(0, 1);
  if (!list.length) { box.innerHTML = ""; return; }
  const [y, m, d] = addDays(tk, -(chartDays - 1)).split("-").map(Number), fromMs = Date.UTC(y, m - 1, d), toMs = fromMs + chartDays * 864e5;
  box.innerHTML = list.map(c => {
    const hasRange = (c.low !== "" && c.low != null) || (c.high !== "" && c.high != null);
    return `<div class="chartbox"><div class="hd"><h3>${esc(c.name)}</h3>
      <div class="seg small-seg" role="group" aria-label="Chart length"><button data-days="7" aria-pressed="${chartDays === 7}">7 days</button><button data-days="14" aria-pressed="${chartDays === 14}">14 days</button></div></div>
      <svg class="chart" data-chart="${esc(c.id)}" role="img" aria-label="${esc(c.name)} readings chart"></svg>
      <p class="chartnote">${hasRange ? `Shaded band: your target, ${esc(c.low ?? "")}–${esc(c.high ?? "")} ${esc(c.unit || "")}.` : "Each dot is a reading."}</p></div>`;
  }).join("");
  const draw = () => list.forEach(c => {
    const svg = box.querySelector(`[data-chart="${CSS.escape(c.id)}"]`); if (!svg) return;
    const pts = S.logs.filter(l => l.check === c.id && l.local && !isNaN(parseFloat(l.value))).map(l => ({ t: wallMs(l), v: parseFloat(l.value), label: `${l.local.slice(5)}  ${l.value} ${c.unit || ""}` }));
    drawReadings(svg, pts, { low: c.low, high: c.high, unit: c.unit, fromMs, toMs });
  });
  draw();
  if (!box._ro) { box._ro = new ResizeObserver(() => box._redraw && box._redraw()); box._ro.observe(box); }
  box._redraw = draw;
}
document.addEventListener("click", e => { const b = e.target.closest("[data-days]"); if (!b) return; chartDays = +b.dataset.days; renderCharts(todayKey()); });

function renderLog() {
  const tk = todayKey(), by = {};
  renderCharts(tk);
  S.logs.forEach(l => { const k = (l.local || "").slice(0, 10); if (!k) return; const n = daysBetween(k, tk); if (n >= 0 && n <= 14) (by[k] = by[k] || []).push(l); });
  const keys = Object.keys(by).sort().reverse();
  $("logList").innerHTML = keys.length ? keys.map(k => { const p = prettyDate(k); return `<div class="day"><h3>${relDay(tk, k)} · ${p.long}</h3><table>${by[k].map(l => `<tr><td class="tm">${fmt12(l.local.slice(11))}</td><td>${esc(l.name)}${l.pending ? ` <span class="pend">(not sent yet)</span>` : ""}${l.note ? `<div class="small">${esc(l.note)}</div>` : ""}</td><td class="n">${esc(valueText(l))}${(() => { const c = checks().find(x => x.id === l.check); const f = c ? inRangeText(l.value, c) : ""; return f ? `<div class="flag small">${f}</div>` : ""; })()}</td><td style="width:1%"><button class="link" data-ldel="${esc(l.id)}">Delete</button></td></tr>`).join("")}</table></div>`; }).join("") : `<p class="empty">Nothing logged in the last 14 days.</p>`;
}

function renderSettings() {
  $("sharedWith").textContent = SHARED_WITH;
  $("who").textContent = "This device is connected to Brian's Daybook. The family can disconnect it from the family page.";
  renderReminderStatus();
}

function renderAll() {
  if ($("app").hidden) return;
  renderHeader(); renderToday(); renderTodos(); renderAppts(); renderHobbies(); renderLog(); renderSettings();
}

/* ---------- logging ---------- */
let undoId = null, toastT;
function toast(msg, id) { $("toastMsg").textContent = msg; undoId = id; $("toastUndo").hidden = !id; $("toast").classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => $("toast").classList.remove("on"), 9000); }
$("toastUndo").addEventListener("click", () => { if (undoId) D.deleteLog(undoId); $("toast").classList.remove("on"); });

function writeLog({ check, name, unit, value, note, time }) {
  const w = now(), t = time || hmOf(w);
  const [h, m] = t.split(":").map(Number), at = zonedToDate(TZ, w.y, w.mo, w.d, h, m);
  const l = { id: D.newId(), check, name, unit: unit || "", value: value ?? "", note: note || "", at: at.toISOString(), local: `${dayKey(w)} ${t}`, by: "Brian" };
  D.addLog(l); toast(`${name} logged at ${fmt12(t)}`, l.id);
}

function logSheet(id, prefill) {
  const c = checks().find(x => x.id === id); if (!c) return;
  const ll = lastLog(id), w = now();
  const recent = ll && (Date.now() - logTime(ll)) < (Number(c.warn) || 0) * 3600e3;
  sheet.open(`<h3>Log ${esc(c.name)}</h3>
   ${recent ? `<div class="warn"><b>Already logged ${ago(Date.now() - logTime(ll))}</b>, at ${fmt12(ll.local.slice(11))}${valueText(ll, c.unit) ? ` (${esc(valueText(ll, c.unit))})` : ""}. Check before you log it again.</div>` : ""}
   ${c.value ? `<label for="fVal">Reading or amount${c.unit ? ` (${esc(c.unit)})` : ""}</label><input id="fVal" inputmode="decimal" value="${esc(prefill || "")}">` : ""}
   <label for="fTime">Time</label><input id="fTime" type="time" value="${hmOf(w)}">
   <label for="fNote">Note (optional)</label><input id="fNote">
   <div class="acts"><button data-act="cancel">Cancel</button><button class="pri" data-act="save">${recent ? "Log it anyway" : "Save"}</button></div>`, () => {
    writeLog({ check: c.id, name: c.name, unit: c.unit, value: c.value ? val("fVal") : "", note: val("fNote"), time: $("fTime").value });
  });
}

function otherSheet() {
  const names = [...new Set([...checks().map(c => c.name), "Pills", "Blood sugar", "Blood pressure", "Weight"])];
  const w = now();
  sheet.open(`<h3>Log something else</h3>
   <label for="oN">What</label><input id="oN" list="oNames" placeholder="Pills, blood sugar…"><datalist id="oNames">${names.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
   <div class="two"><div><label for="oV">Reading or amount (optional)</label><input id="oV" inputmode="decimal"></div><div><label for="oU">Unit</label><input id="oU" placeholder="mg/dL, tablets"></div></div>
   <label for="oT">Time</label><input id="oT" type="time" value="${hmOf(w)}">
   <label for="oNote">Note (optional)</label><input id="oNote" placeholder="Which pills, how you felt…">
   <div class="acts"><button data-act="cancel">Cancel</button><button class="pri" data-act="save">Save</button></div>`, () => {
    const name = val("oN"); if (!name) { sheet.msg("Say what you're logging."); return false; }
    const c = checks().find(x => x.name.toLowerCase() === name.toLowerCase());
    if (c) { const ll = lastLog(c.id); if (ll && (Date.now() - logTime(ll)) < (Number(c.warn) || 0) * 3600e3 && !$("oN").dataset.ok) { $("oN").dataset.ok = "1"; sheet.msg(`${c.name} was already logged ${ago(Date.now() - logTime(ll))}. Tap Save again to log it anyway.`); return false; } }
    writeLog({ check: c ? c.id : "other", name: c ? c.name : name, unit: val("oU") || (c ? c.unit : ""), value: val("oV"), note: val("oNote"), time: $("oT").value });
  });
}

/* ---------- to-do and hobbies ---------- */
function todoSheet(id) {
  const t = S.todos.find(x => x.id === id); if (!t) return;
  sheet.open(`<h3>Edit to-do</h3><label for="tT">What</label><input id="tT" value="${esc(t.text)}">
   <div class="two"><div><label for="tD">Due date</label><input id="tD" type="date" value="${esc(t.due || "")}"></div>
   <div><label for="tR">Repeats</label><select id="tR">${REPEAT_OPTIONS(true, t.repeat)}</select></div></div>
   <p class="small">A repeating to-do moves to its next date when you tick it.</p>
   <div class="acts"><button data-act="delete">Delete</button><button data-act="cancel">Cancel</button><button class="pri" data-act="save">Save</button></div>`, mode => {
    if (mode === "delete") return D.deleteTodo(id);
    if (!val("tT")) { sheet.msg("Type what needs doing."); return false; }
    const rep = $("tR").value;
    D.saveTodo({ ...t, text: val("tT"), due: val("tD") || (rep ? todayKey() : ""), repeat: rep, done: rep ? false : t.done });
  });
}
function hobSheet() {
  sheet.open(`<h3>Add hobby</h3><label for="hN">Hobby</label><input id="hN" placeholder="Golf, reading, model trains…">
  <div class="acts"><button data-act="cancel">Cancel</button><button class="pri" data-act="save">Add</button></div>`, () => {
    if (!val("hN")) { sheet.msg("Type a hobby name."); return false; }
    D.saveHobby({ id: D.newId(), name: val("hN"), note: "", last: null });
  });
}

/* ---------- events ---------- */
function goTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.id === "t-" + name));
  document.querySelectorAll("nav button").forEach(x => x.setAttribute("aria-current", x.dataset.tab === name ? "true" : "false"));
  renderAll(); window.scrollTo(0, 0);
}
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return; const d = b.dataset;
  if (d.tab) goTab(d.tab);
  else if (d.log) logSheet(d.log);
  else if (d.tedit) todoSheet(d.tedit);
  else if (d.hdone) { const h = S.hobbies.find(x => x.id === d.hdone); if (h) { D.saveHobby({ ...h, last: new Date().toISOString() }); toast(`${h.name}: marked as done today`); } }
  else if (d.hdel) { if (b.textContent !== "Tap again to remove") { b.textContent = "Tap again to remove"; return; } D.deleteHobby(d.hdel); }
  else if (d.ldel) { if (b.textContent !== "Sure?") { b.textContent = "Sure?"; return; } D.deleteLog(d.ldel); }
});
document.addEventListener("change", e => {
  const id = e.target.dataset && e.target.dataset.tick; if (!id) return;
  const t = S.todos.find(x => x.id === id); if (!t) return;
  const r = tickTodo(t, e.target.checked, todayKey()); D.saveTodo(r.todo);
  if (r.next) toast(`Done. Next time: ${prettyDate(r.next).long}`);
});
$("todoForm").addEventListener("submit", e => {
  e.preventDefault(); const text = val("todoIn"); if (!text) return;
  D.saveTodo({ id: D.newId(), text, due: "", done: false, by: "Brian", created: new Date().toISOString() }); $("todoIn").value = "";
});
$("clearDone").addEventListener("click", e => { if (e.target.textContent !== "Tap again to clear") { e.target.textContent = "Tap again to clear"; return; } S.todos.filter(t => t.done).forEach(t => D.deleteTodo(t.id)); e.target.textContent = "Clear done items"; });
$("logOther").addEventListener("click", otherSheet);
$("addHob").addEventListener("click", hobSheet);
$("notes").addEventListener("input", e => { try { localStorage.setItem("daybook-notes", e.target.value); } catch {} });
let hobT = {};
document.addEventListener("input", e => {
  const id = e.target.dataset && e.target.dataset.hnote; if (!id) return;
  clearTimeout(hobT[id]); const v = e.target.value;
  hobT[id] = setTimeout(() => { const h = S.hobbies.find(x => x.id === id); if (h) D.saveHobby({ ...h, note: v }); }, 800);
});
$("copyLog").addEventListener("click", () => {
  const lines = [...S.logs].reverse().filter(l => Date.now() - logTime(l) < 14 * 864e5).map(l => `${l.local}  ${l.name}${valueText(l) ? ": " + valueText(l) : ""}${l.note ? ` (${l.note})` : ""}`);
  copyText(`Brian's log, last 14 days\n` + (lines.join("\n") || "Nothing logged."), "copyMsg");
});
window.addEventListener("online", () => $("offline").hidden = true);
window.addEventListener("offline", () => { $("offline").textContent = "No internet right now. Anything you log is saved and will send when you're back online."; $("offline").hidden = false; });
if (!navigator.onLine) $("offline").hidden = false;

/* ---------- reminders (Android notifications) ---------- */
const hash = s => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h) % 2000000000; };
let remState = { perm: "unknown", exact: "unknown", count: 0 };
async function renderReminderStatus() {
  $("remOn").checked = remWanted();
  if (!native) { $("remOn").disabled = true; $("remStatus").textContent = "Reminders only work in the installed Android app. In a web browser, keep your phone's own alarms."; return; }
  if (!remWanted()) { $("remStatus").textContent = "Reminders are off on this device."; $("remFix").hidden = true; $("remTest").hidden = true; return; }
  const ok = remState.perm === "granted";
  $("remStatus").textContent = !ok ? "Reminders are turned off. Tap below to allow them."
    : `Reminders are on (${remState.count} set).` + (remState.exact === "granted" ? "" : " They may arrive a few minutes late.");
  $("remFix").hidden = ok && remState.exact === "granted";
  $("remTest").hidden = !ok;
}
let schedT;
function scheduleSoon() { if (!native) return; clearTimeout(schedT); schedT = setTimeout(scheduleAll, 1500); }
const remWanted = () => { try { return localStorage.getItem("daybook-rem") !== "off"; } catch { return true; } };
async function scheduleAll() {
  try {
    if (!remWanted()) { await LocalNotifications.cancelAll(); remState.count = 0; remState.off = true; return renderReminderStatus(); }
    remState.off = false;
    const p = await LocalNotifications.checkPermissions(); remState.perm = p.display;
    if (p.display !== "granted") { const r = await LocalNotifications.requestPermissions(); remState.perm = r.display; }
    try { remState.exact = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm; } catch { remState.exact = "granted"; }
    if (remState.perm !== "granted") return renderReminderStatus();
    await LocalNotifications.createChannel({ id: "daybook", name: "Daybook reminders", importance: 5, vibration: true, visibility: 1 }).catch(() => {});
    await LocalNotifications.registerActionTypes({ types: [
      { id: "dbk-value", actions: [{ id: "reading", title: "Log it", input: true }] },
      { id: "dbk-taken", actions: [{ id: "taken", title: "Taken" }] }
    ] }).catch(() => {});
    await LocalNotifications.cancelAll();
    const list = [];
    const w = now(), dev = wall("");
    const shift = Math.round((Date.UTC(dev.y, dev.mo - 1, dev.d, dev.h, dev.mi) - Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi)) / 60000);
    checks().forEach(c => c.times.forEach(t => {
      const dm = ((mins(t) + shift) % 1440 + 1440) % 1440, h = Math.floor(dm / 60), m = dm % 60;
      list.push({ id: hash(`c|${c.id}|${t}`), title: c.name, body: c.value ? `Time for your ${c.name.toLowerCase()} (${fmt12(t)}). Tap "Log it" to type the number.` : `Time for your ${c.name.toLowerCase()} (${fmt12(t)}). Tap "Taken" when done.`, channelId: "daybook",
        schedule: { on: { hour: h, minute: m }, allowWhileIdle: true }, extra: { check: c.id }, actionTypeId: c.value ? "dbk-value" : "dbk-taken" });
    }));
    const soon = Date.now() + 60e3, limit = Date.now() + 60 * 864e5;
    const tk0 = todayKey();
    S.appts.flatMap(a => occurrences(a.date, a.repeat, tk0, addDays(tk0, 60)).map(date => ({ ...a, date, id: `${a.id}|${date}` }))).forEach(a => {
      const [y, mo, d] = a.date.split("-").map(Number), [h, mi] = (a.time || "09:00").split(":").map(Number);
      const when = zonedToDate(TZ, y, mo, d, h, mi);
      const pd = new Date(Date.UTC(y, mo - 1, d - 1)), eve = zonedToDate(TZ, pd.getUTCFullYear(), pd.getUTCMonth() + 1, pd.getUTCDate(), 18, 0);
      const before = a.time ? new Date(when.getTime() - 2 * 3600e3) : zonedToDate(TZ, y, mo, d, 8, 0);
      const label = `${a.title}${a.time ? " at " + fmt12(a.time) : ""}${a.where ? ", " + a.where : ""}`;
      if (eve > soon && eve < limit) list.push({ id: hash(`a|${a.id}|eve`), title: "Tomorrow", body: label, channelId: "daybook", schedule: { at: eve, allowWhileIdle: true } });
      if (before > soon && before < limit) list.push({ id: hash(`a|${a.id}|soon`), title: a.time ? "In 2 hours" : "Today", body: label, channelId: "daybook", schedule: { at: before, allowWhileIdle: true } });
    });
    if (list.length) await LocalNotifications.schedule({ notifications: list });
    remState.count = list.length;
  } catch (err) { console.error("reminders", err); }
  renderReminderStatus();
}
$("remOn").addEventListener("change", e => { try { localStorage.setItem("daybook-rem", e.target.checked ? "on" : "off"); } catch {} scheduleSoon(); renderReminderStatus(); });
if (native) {
  LocalNotifications.addListener("localNotificationActionPerformed", a => {
    const id = a.notification && a.notification.extra && a.notification.extra.check;
    pendingAction = { id, actionId: a.actionId, input: a.inputValue };
    runPendingAction();
  });
  $("remFix").addEventListener("click", async () => {
    if (remState.perm !== "granted") await scheduleAll();
    else { try { await LocalNotifications.changeExactNotificationSetting(); } catch {} setTimeout(scheduleAll, 1500); }
  });
  $("remTest").addEventListener("click", async () => {
    await LocalNotifications.schedule({ notifications: [{ id: 1, title: "Daybook", body: "Test reminder. Reminders are working.", channelId: "daybook", schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true } }] });
    toast("Test reminder in 5 seconds");
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleSoon(); });
}

/* ---------- buttons on reminders ("Taken" / "Log it") ---------- */
let pendingAction = null;
function runPendingAction() {
  if (!pendingAction) return;
  if (!started || !S.settings) return; // try again once the app has loaded
  const { id, actionId, input } = pendingAction; pendingAction = null;
  goTab("today");
  const c = checks().find(x => x.id === id); if (!c) return;
  const ll = lastLog(c.id), recent = ll && (Date.now() - logTime(ll)) < (Number(c.warn) || 0) * 3600e3;
  const num = input != null ? String(input).trim().replace(",", ".") : "";
  const quick = (actionId === "taken" && !c.value) || (actionId === "reading" && c.value && num !== "" && !isNaN(parseFloat(num)));
  if (quick && !recent) { writeLog({ check: c.id, name: c.name, unit: c.unit, value: c.value ? num : "", note: "" }); return; }
  setTimeout(() => logSheet(c.id, num), 300); // already logged recently, or nothing typed: show the full form with its warning
}

/* ---------- clock ---------- */
setInterval(() => { if (!sheet.isOpen()) renderAll(); else renderHeader(); }, 30000);

/* ---------- app updates (installed app only) ---------- */
const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
const SITE = "https://michaelmullen1999.github.io/daybook/";
const APK_URL = "https://github.com/michaelmullen1999/daybook/releases/latest/download/Daybook.apk";
let lastCheck = 0;
async function checkForUpdate(force) {
  if (!native || APP_VERSION === "dev") { $("verText").textContent = `Version ${APP_VERSION}.`; return null; }
  if (!force && Date.now() - lastCheck < 3600e3) return null;
  lastCheck = Date.now();
  try {
    const r = await fetch(SITE + "version.json?t=" + Date.now(), { cache: "no-store" });
    const { version } = await r.json();
    const newer = version && version !== APP_VERSION;
    $("update").hidden = !newer;
    $("verText").textContent = newer ? `Version ${APP_VERSION}. A newer version (${version}) is ready.` : `Version ${APP_VERSION}. You have the latest.`;
    return newer;
  } catch { $("verText").textContent = `Version ${APP_VERSION}. Couldn't check for updates (no internet?).`; return null; }
}
$("updateBtn").addEventListener("click", () => {
  $("updateMsg").textContent = "Opening the download. When it finishes, tap it, then tap Install.";
  window.location.href = APK_URL; // Capacitor opens outside links in the device browser, which downloads the new app
});
$("checkUpd").addEventListener("click", async () => {
  const n = await checkForUpdate(true);
  if (n === false) toast("You have the latest version");
  else if (n) toast("Update ready: see the banner at the top");
});
$("verText").textContent = `Version ${APP_VERSION}.`;
setTimeout(() => checkForUpdate(true), 3000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) checkForUpdate(false); });

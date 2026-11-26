// Daybook: Deborah's app (iPad/iPhone home screen) and the family page. Logs Brian's pills and insulin, appointments, notes, diary, care info.
import * as D from "./data.js";
import { BRIAN_TIMEZONE, FAMILY, OWNERS } from "./config.js";
import { $, esc, pad, DAYS, MON, mins, fmt12, wall, dayKey, hmOf, relDay, daysBetween, prettyDate, ago, slotsFor, valueText, zonedToDate, makeSheet, val, copyText, themeSwitch, nextDate, repeatLabel, REPEAT_OPTIONS, tickTodo, addDays, drawReadings, inRangeText } from "./util.js";
themeSwitch();
import { initCare } from "./care.js";
import { pandaFace, pandaWave, pandaHeart, emptyPanda } from "./panda.js";

const S = { settings: null, appts: [], logs: [], hobbies: [], todos: [], family: [], notes: [], care: [], diary: [] };
const sheet = makeSheet();
const unsubs = [];
let user = null;
const me = () => (user && user.displayName ? user.displayName.split(" ")[0] : (user && user.email ? user.email.split("@")[0] : "Family"));

/* ---------- sign-in (Google) ---------- */
function gate(html) { $("app").hidden = true; $("gate").hidden = false; $("gateExtras").hidden = false; $("gate").innerHTML = html; }
function showSignIn() {
  if (!D.configured) return gate(`<h1>Not set up yet</h1><p>Add the Firebase details to <b>src/config.js</b>. See the README.</p>`);
  gate(`<div class="gate-panda">${pandaWave(130)}</div><h1>Daybook</h1><p>Brian's pills, appointments, notes and care info. Sign in with your Google account.</p>
    <button class="pri" id="gBtn" style="width:100%;min-height:56px">Sign in with Google</button><p class="err" id="gErr"></p>`);
  $("gBtn").addEventListener("click", async () => {
    $("gErr").textContent = "";
    try { await D.signInGoogle(); } catch (e) { $("gErr").textContent = "Sign-in didn't work. Try again."; console.error(e); }
  });
}
function showNotAllowed() {
  gate(`<div class="gate-panda">${pandaFace(90)}</div><h1>Not on the family list yet</h1><p>You're signed in as <b>${esc(user.email || "")}</b>.</p>
    <p>Ask Levi or Nicole to add this email in Daybook, under <b>Setup</b>. Then reload this page.</p>
    <div class="row-btns"><button id="gOut">Use a different Google account</button></div>`);
  $("gOut").addEventListener("click", () => D.signOut());
}
D.onUser(u => {
  user = u; unsubs.splice(0).forEach(f => f());
  if (!u || u.isAnonymous) return showSignIn();
  $("gate").hidden = true; $("gateExtras").hidden = true; $("app").hidden = false;
  const onErr = err => {
    console.error(err);
    if (String(err.code).includes("permission")) return showNotAllowed();
    $("problem").textContent = "Can't reach the Daybook right now. Check your connection."; $("problem").hidden = false;
  };
  ["settings", "appts", "logs", "todos", "family", "notes", "care", "diary"].forEach(n => unsubs.push(D.watch(n, data => { S[n] = data; $("problem").hidden = true; if (!$("gate").hidden && n === "settings") { $("gate").hidden = true; $("gateExtras").hidden = true; $("app").hidden = false; } renderAll(); }, onErr)));
  renderAll();
});

/* ---------- helpers ---------- */
const checks = () => (S.settings && Array.isArray(S.settings.checks)) ? S.settings.checks : [];
const bw = () => wall(BRIAN_TIMEZONE);
const btk = () => dayKey(bw());
const apptKey = a => `${a.date} ${a.time || "00:00"}`;
const lastLog = id => S.logs.filter(l => l.check === id)[0];
const saveSettings = patch => D.saveSettings({ name: "Brian", checks: [], ...(S.settings || {}), ...patch });
let toastT, undoId = null;
function toast(msg, logId) { $("toastMsg").textContent = msg; undoId = logId || null; $("toastUndo").hidden = !undoId; $("toast").classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => $("toast").classList.remove("on"), logId ? 9000 : 5000); }
$("toastUndo").addEventListener("click", () => { if (undoId) D.deleteLog(undoId); $("toast").classList.remove("on"); });
const C = initCare({ S, D, sheet, toast, me: () => me(), today: () => btk() });

/* ---------- render ---------- */
function renderHeader() {
  const w = bw(), mine = wall(""), same = hmOf(w) === hmOf(mine);
  const g = w.h < 5 ? "Hello" : w.h < 12 ? "Good morning" : w.h < 17 ? "Good afternoon" : "Good evening";
  $("greet").textContent = `${g}, ${me()}`;
  $("date").textContent = `${DAYS[w.wd]} ${w.d} ${MON[w.mo - 1]}${same ? "" : " (Portland)"}`;
  $("clock").innerHTML = `${esc(fmt12(hmOf(w)))}${same ? "" : `<small>Your time: ${esc(fmt12(hmOf(mine)))}</small>`}`;
  $("who").textContent = `Signed in as ${user && user.email ? user.email : ""}.`;
}

function renderToday() {
  const w = bw(), nm = w.h * 60 + w.mi, tk = dayKey(w);
  const dayLogs = S.logs.filter(l => (l.local || "").startsWith(tk));
  const all = checks().map(c => ({ c, slots: slotsFor(c, dayLogs, nm) }));
  const due = all.flatMap(x => x.slots.filter(s => s.st === "due").map(s => ({ c: x.c, s })));
  const missed = all.flatMap(x => x.slots.filter(s => s.st === "missed").map(s => `${x.c.name} ${fmt12(s.t)}`));
  const later = all.flatMap(x => x.slots.filter(s => s.st === "later").map(s => ({ c: x.c, s }))).sort((a, b) => mins(a.s.t) - mins(b.s.t));
  const nx = $("ovNext");
  if (due.length) { nx.className = "next due"; nx.innerHTML = `<b>Due now: ${due.map(d => esc(d.c.name)).join(", ")}</b><span>${due.map(d => fmt12(d.s.t)).join(", ")}</span>${missed.length ? `<span>Missed earlier: ${esc(missed.join(", "))}</span>` : ""}`; }
  else if (missed.length) { nx.className = "next due"; nx.innerHTML = `<b>Missed today: ${esc(missed.join(", "))}</b><span>Log it below if it was taken.</span>`; }
  else if (later.length) { const n = later[0], diff = mins(n.s.t) - nm; nx.className = "next"; nx.innerHTML = `<b>Next: ${esc(n.c.name)} at ${fmt12(n.s.t)}</b><span>in ${diff >= 60 ? Math.floor(diff / 60) + " h " : ""}${diff % 60} min</span>`; }
  else { nx.className = "next"; nx.innerHTML = checks().length ? `<b>All of today's pills and checks are done.</b>` : `<b>No pills or checks set yet.</b><span>Add them under Setup.</span>`; }

  let lo = 6 * 60; const hi = 24 * 60;
  checks().forEach(c => c.times.forEach(t => { const m = mins(t); if (m < lo) lo = Math.floor(m / 60) * 60; }));
  const pos = m => ((Math.min(Math.max(m, lo), hi) - lo) / (hi - lo) * 100).toFixed(2);
  const step = window.innerWidth < 600 ? 360 : 180, hrs = []; for (let m = lo; m <= hi; m += step) hrs.push(m);
  const nowLine = nm >= lo && nm <= hi ? `<div class="now" style="left:${pos(nm)}%"></div>` : "";
  $("timeline").innerHTML = all.length ? `<div class="tl-hours"><span></span><div class="track">${hrs.map(m => `<span class="hr${m === lo ? " first" : m === hi ? " last" : ""}" style="left:${pos(m)}%">${m === hi ? "12 am" : fmt12(pad(Math.floor(m / 60) % 24) + ":00").replace(":00", "")}</span>`).join("")}</div></div>` +
    all.map(x => `<div class="tl-row"><span class="nm">${esc(x.c.name)}</span><div class="track">${nowLine}${x.slots.map(s => `<span class="dot ${s.st}" style="left:${pos(mins(s.t))}%"></span>`).join("")}</div></div>`).join("") : "";

  $("ovChecks").innerHTML = all.length ? all.map(x => {
    const ll = lastLog(x.c.id), isDue = x.slots.some(s => s.st === "due"), flag = ll ? inRangeText(ll.value, x.c) : "";
    const lastTxt = ll ? `Last ${esc(ago(Date.now() - new Date(ll.at)))} (${esc(fmt12(ll.local.slice(11)))}${valueText(ll, x.c.unit) ? ", " + esc(valueText(ll, x.c.unit)) : ""}${flag ? `, <span class="flag">${flag}</span>` : ""}${ll.by && ll.by !== "Brian" ? `, by ${esc(ll.by)}` : ""})` : "Not logged yet";
    return `<div class="item"><div><div class="t">${esc(x.c.name)}</div><div class="s ${isDue ? "duec" : ""}">${isDue ? "Due now. " : ""}${lastTxt}</div></div>
      <button class="pri" data-log="${esc(x.c.id)}">Log</button>
      <div class="slots">${x.slots.map(s => `<span class="chip ${s.st}">${fmt12(s.t)}${s.st === "done" ? " ✓" : s.st === "missed" ? " – missed" : ""}</span>`).join("")}</div></div>`;
  }).join("") : emptyPanda("No pills or checks set. Add them under Setup.");

  const up = upcomingAppts(tk).slice(0, 3);
  $("ovAppts").innerHTML = up.length ? up.map(a => apptRow(a, tk, true)).join("") : emptyPanda("Nothing booked.");
  const open = S.todos.filter(t => !t.done).sort(todoSort);
  $("ovTodos").innerHTML = open.length ? open.slice(0, 5).map(t => todoRow(t, tk)).join("") + (open.length > 5 ? `<button class="link" data-tab="todo">See all ${open.length}</button>` : "") : emptyPanda("Nothing to do.");
  C.renderTodayNotes(); C.renderTodayDiary();
}

/* ---------- logging (Deborah logs for Brian) ---------- */
function writeLog({ check, name, unit, value, note, time }) {
  const w = bw(), t = time || hmOf(w);
  const [h, m] = t.split(":").map(Number), at = zonedToDate(BRIAN_TIMEZONE, w.y, w.mo, w.d, h, m);
  const l = { id: D.newId(), check, name, unit: unit || "", value: value ?? "", note: note || "", at: at.toISOString(), local: `${dayKey(w)} ${t}`, by: me() };
  D.addLog(l); toast(`${name} logged at ${fmt12(t)}`, l.id);
}
const recentLog = c => { const ll = lastLog(c.id); return ll && (Date.now() - new Date(ll.at)) < (Number(c.warn) || 0) * 3600e3 ? ll : null; };
function logSheet(id) {
  const c = checks().find(x => x.id === id); if (!c) return;
  const ll = recentLog(c), w = bw();
  sheet.open(`<h3>Log ${esc(c.name)}</h3>
   ${ll ? `<div class="warn"><b>Already logged ${esc(ago(Date.now() - new Date(ll.at)))}</b>, at ${esc(fmt12(ll.local.slice(11)))}${valueText(ll, c.unit) ? ` (${esc(valueText(ll, c.unit))})` : ""}${ll.by ? ` by ${esc(ll.by)}` : ""}. Check before you log it again.</div>` : ""}
   ${c.value ? `<label for="fVal">Reading or amount${c.unit ? ` (${esc(c.unit)})` : ""}</label><input id="fVal" inputmode="decimal">` : ""}
   <label for="fTime">Time (Portland)</label><input id="fTime" type="time" value="${hmOf(w)}">
   <label for="fNote">Note (optional)</label><input id="fNote">
   <div class="acts"><button data-act="cancel">Cancel</button><button class="pri" data-act="save">${ll ? "Log it anyway" : "Save"}</button></div>`, () => {
    writeLog({ check: c.id, name: c.name, unit: c.unit, value: c.value ? val("fVal") : "", note: val("fNote"), time: $("fTime").value });
  });
}
function otherSheet() {
  const names = [...new Set([...checks().map(c => c.name), "Pills", "Blood sugar", "Blood pressure", "Weight"])], w = bw();
  sheet.open(`<h3>Log something else</h3>
   <label for="oN">What</label><input id="oN" list="oNames" placeholder="Pills, blood pressure…"><datalist id="oNames">${names.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
   <div class="two"><div><label for="oV">Reading or amount (optional)</label><input id="oV" inputmode="decimal"></div><div><label for="oU">Unit</label><input id="oU" placeholder="mg/dL, tablets"></div></div>
   <label for="oT">Time (Portland)</label><input id="oT" type="time" value="${hmOf(w)}">
   <label for="oNote">Note (optional)</label><input id="oNote" placeholder="Which pills, how he was…">
   <div class="acts"><button data-act="cancel">Cancel</button><button class="pri" data-act="save">Save</button></div>`, () => {
    const name = val("oN"); if (!name) { sheet.msg("Say what you're logging."); return false; }
    const c = checks().find(x => x.name.toLowerCase() === name.toLowerCase()), ll = c ? recentLog(c) : null;
    if (ll && !$("oN").dataset.ok) { $("oN").dataset.ok = "1"; sheet.msg(`${c.name} was already logged ${ago(Date.now() - new Date(ll.at))}. Tap Save again to log it anyway.`); return false; }
    writeLog({ check: c ? c.id : "other", name: c ? c.name : name, unit: val("oU") || (c ? c.unit : ""), value: val("oV"), note: val("oNote"), time: $("oT").value });
  });
}

/* ---------- readings charts ---------- */
let chartDays = 14;
function chartChecks() {
  const vc = checks().filter(c => c.value);
  const ranged = vc.filter(c => (c.low !== "" && c.low != null) || (c.high !== "" && c.high != null));
  return ranged.length ? ranged : vc.slice(0, 1);
}
const wallMs = l => { const [d, t] = l.local.split(" "); const [y, m, dd] = d.split("-").map(Number); const [h, mi] = t.split(":").map(Number); return Date.UTC(y, m - 1, dd, h, mi); };
function renderCharts(tk) {
  const box = $("ovCharts"); if (!box) return;
  const list = chartChecks();
  if (!list.length) { box.innerHTML = ""; return; }
  const [y, m, d] = addDays(tk, -(chartDays - 1)).split("-").map(Number), fromMs = Date.UTC(y, m - 1, d), toMs = fromMs + chartDays * 864e5;
  box.innerHTML = list.map(c => {
    const logs = S.logs.filter(l => l.check === c.id && l.local && !isNaN(parseFloat(l.value)) && wallMs(l) >= fromMs);
    const outs = logs.filter(l => inRangeText(l.value, c));
    const hasRange = (c.low !== "" && c.low != null) || (c.high !== "" && c.high != null);
    return `<div class="chartbox"><div class="hd"><h3>${esc(c.name)}, last ${chartDays} days</h3>
      <div class="seg small-seg" role="group" aria-label="Chart length"><button data-days="7" aria-pressed="${chartDays === 7}">7 days</button><button data-days="14" aria-pressed="${chartDays === 14}">14 days</button></div></div>
      <svg class="chart" data-chart="${esc(c.id)}" role="img" aria-label="${esc(c.name)} readings chart"></svg>
      <p class="chartnote">${hasRange ? `Shaded band: target ${esc(c.low ?? "")}–${esc(c.high ?? "")} ${esc(c.unit || "")}. ` : "Add a target range under Checks to see it here. "}${logs.length ? `${logs.length} readings` : "No readings yet"}${hasRange && logs.length ? `, <span class="${outs.length ? "flag" : ""}">${outs.length} outside target</span>` : ""}.</p></div>`;
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
document.addEventListener("click", e => { const b = e.target.closest("[data-days]"); if (!b) return; chartDays = +b.dataset.days; renderCharts(btk()); });

// Upcoming appointments, with repeating ones shown at their next date
const upcomingAppts = tk => S.appts.map(a => ({ ...a, start: a.date, date: nextDate(a.date, a.repeat, tk) })).filter(a => a.date >= tk).sort((a, b) => apptKey(a).localeCompare(apptKey(b)));
function apptRow(a, tk, edit) {
  const p = prettyDate(a.date), rel = relDay(tk, a.date), soon = rel === "Today" || rel === "Tomorrow";
  return `<div class="appt"><div class="d">${p.short}<small>${p.day.slice(0, 3)}${a.time ? " · " + fmt12(a.time) : ""}</small></div>
  <div><div class="t">${esc(a.title)}${a.repeat ? `<span class="rep">${esc(repeatLabel(a.repeat, a.start || a.date))}</span>` : ""}</div><div class="s ${soon ? "soon" : ""}">${rel}</div>
  ${a.where ? `<div class="s">${esc(a.where)}</div>` : ""}${a.with ? `<div class="s">With ${esc(a.with)}</div>` : ""}${a.notes ? `<div class="s">${esc(a.notes)}</div>` : ""}
  ${a.by ? `<div class="s">Added by ${esc(a.by)}</div>` : ""}</div>
  ${edit ? `<button data-eappt="${esc(a.id)}">Edit</button>` : ""}</div>`;
}
function renderAppts() {
  const tk = btk(), s = [...S.appts].sort((a, b) => apptKey(a).localeCompare(apptKey(b)));
  const up = upcomingAppts(tk), past = s.filter(a => !a.repeat && a.date < tk).reverse().slice(0, 20);
  $("apptList").innerHTML = up.length ? up.map(a => apptRow(a, tk, true)).join("") : emptyPanda("Nothing booked.");
  $("pastList").innerHTML = past.length ? past.map(a => apptRow(a, tk, true)).join("") : emptyPanda("None yet.");
}

const todoSort = (a, b) => (a.due || "9999").localeCompare(b.due || "9999") || (a.created || "").localeCompare(b.created || "");
function todoRow(t, tk) {
  const overdue = t.due && !t.done && t.due < tk;
  const meta = [t.due ? (overdue ? `Was due ${prettyDate(t.due).short}` : `Due ${relDay(tk, t.due).toLowerCase()}`) : "", t.repeat ? repeatLabel(t.repeat, t.due || tk) : "", t.lastDone ? `Last done ${ago(Date.now() - new Date(t.lastDone))}` : "", t.by ? `Added by ${t.by}` : "", t.done && t.doneAt ? `Done ${ago(Date.now() - new Date(t.doneAt))}` : ""].filter(Boolean).join(" · ");
  return `<div class="todo ${t.done ? "done" : ""}"><label><input type="checkbox" data-tick="${esc(t.id)}" ${t.done ? "checked" : ""}><span>${esc(t.text)}<span class="meta ${overdue ? "soon" : ""}">${esc(meta)}</span></span></label>
    <button class="link" data-tedit="${esc(t.id)}">Edit</button></div>`;
}
function renderTodos() {
  const tk = btk();
  const open = S.todos.filter(t => !t.done).sort(todoSort), done = S.todos.filter(t => t.done).sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || "")).slice(0, 30);
  $("todoList").innerHTML = open.length ? open.map(t => todoRow(t, tk)).join("") : emptyPanda("Nothing on his list.");
  $("doneSum").textContent = `Done (${done.length})`;
  $("doneList").innerHTML = done.map(t => todoRow(t, tk)).join("");
}

function renderChecks() {
  $("checkList").innerHTML = checks().length ? checks().map(c => `<div class="item"><div><div class="t">${esc(c.name)}</div><div class="s">${c.times.map(fmt12).join(", ")}${c.value ? ` · records ${esc(c.unit || "a number")}` : ""}${Number(c.warn) ? ` · warn within ${esc(c.warn)} h` : ""}${c.low !== "" && c.low != null || c.high !== "" && c.high != null ? ` · target ${esc(c.low ?? "")}–${esc(c.high ?? "")}` : ""}</div></div><button data-echeck="${esc(c.id)}">Edit</button></div>`).join("") : `<p class="empty">No checks yet.</p>`;
  $("seed").hidden = checks().length > 0;
  if (document.activeElement !== $("nameIn")) $("nameIn").value = (S.settings && S.settings.name) || "Brian";
}

function renderLog() {
  const tk = btk(), by = {};
  renderCharts(tk);
  S.logs.forEach(l => { const k = (l.local || "").slice(0, 10); if (!k) return; const n = daysBetween(k, tk); if (n >= 0 && n <= 14) (by[k] = by[k] || []).push(l); });
  const keys = Object.keys(by).sort().reverse();
  $("logList").innerHTML = keys.length ? keys.map(k => { const p = prettyDate(k); return `<div class="day"><h3>${relDay(tk, k)} · ${p.long}</h3><table>${by[k].map(l => `<tr><td class="tm">${fmt12(l.local.slice(11))}</td><td>${esc(l.name)}${l.note ? `<div class="small">${esc(l.note)}</div>` : ""}${l.by ? `<div class="small">by ${esc(l.by)}</div>` : ""}</td><td class="n">${esc(valueText(l))}${(() => { const c = checks().find(x => x.id === l.check); const f = c ? inRangeText(l.value, c) : ""; return f ? `<div class="flag small">${f}</div>` : ""; })()}</td><td style="width:1%"><button class="link" data-ldel="${esc(l.id)}">Delete</button></td></tr>`).join("")}</table></div>`; }).join("") : emptyPanda("Nothing logged in the last 14 days.");
}

function renderHobbies() {
  if (!$("hobList")) return;
  const list = [...S.hobbies].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  $("hobList").innerHTML = list.length ? list.map(h => `<div class="hob"><div class="row"><span class="t">${esc(h.name)}</span><span class="small">${h.last ? "Last done " + esc(ago(Date.now() - new Date(h.last))) : "Not logged yet"}</span></div>${h.note ? `<p style="margin:8px 0 0">${esc(h.note)}</p>` : ""}</div>`).join("") : `<p class="empty">No hobbies added yet.</p>`;
}

function renderPeople() {
  const fam = [...OWNERS.map(e => ({ id: e, owner: true })), ...S.family.filter(f => !OWNERS.includes(f.id))];
  $("famList").innerHTML = fam.map(f => `<div class="item"><div><div class="t" style="font-size:18px;overflow-wrap:anywhere">${esc(f.id)}</div><div class="s">${f.owner ? "Owner" : f.by ? "Added by " + esc(f.by) : ""}</div></div>${f.owner || (user && f.id === (user.email || "").toLowerCase()) ? "<span></span>" : `<button data-famdel="${esc(f.id)}">Remove</button>`}</div>`).join("");
}

function renderAll() {
  if ($("app").hidden) return;
  renderHeader(); renderToday(); renderAppts(); renderTodos(); renderChecks(); renderLog(); renderPeople();
  C.renderNotes(); C.renderDiary(); C.renderCare();
}

/* ---------- editors ---------- */
function apptSheet(id) {
  // a repeating appointment is edited from its first date
  const a = S.appts.find(x => x.id === id) || { date: btk(), time: "", title: "", where: "", with: "", notes: "" };
  sheet.open(`<h3>${id ? "Edit" : "Add"} appointment</h3>
   <label for="aT">What</label><input id="aT" value="${esc(a.title)}" placeholder="Diabetes clinic, dentist…">
   <div class="two"><div><label for="aD">Date</label><input id="aD" type="date" value="${esc(a.date)}"></div><div><label for="aH">Time (Brian's time)</label><input id="aH" type="time" value="${esc(a.time)}"></div></div>
   <label for="aR">Repeats</label><select id="aR">${REPEAT_OPTIONS(false, a.repeat)}</select>
   <label for="aW">Where</label><input id="aW" value="${esc(a.where)}">
   <label for="aWith">Going with</label><input id="aWith" list="fam" value="${esc(a.with)}"><datalist id="fam">${FAMILY.map(f => `<option value="${esc(f)}">`).join("")}</datalist>
   <label for="aN">Notes for Brian</label><textarea id="aN" placeholder="Bring readings, fast from midnight…">${esc(a.notes)}</textarea>
   <div class="acts">${id ? `<button data-act="delete">Delete</button>` : ""}<button data-act="cancel">Cancel</button><button class="pri" data-act="save">Save</button></div>`, mode => {
    if (mode === "delete") { D.deleteAppt(id); return toast("Appointment deleted"); }
    if (!val("aT") || !val("aD")) { sheet.msg("Add what it is and the date."); return false; }
    D.saveAppt({ id: id || D.newId(), title: val("aT"), date: val("aD"), time: val("aH"), repeat: $("aR").value, where: val("aW"), with: val("aWith"), notes: val("aN"), by: a.by || me() });
    toast(id ? "Appointment updated" : "Appointment added");
  });
}

function parseTimes(s) {
  const t = s.split(/[,\s]+/).filter(Boolean).map(x => { const m = x.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/i); if (!m) return null; let h = +m[1]; const mm = +(m[2] || 0), ap = (m[3] || "").toLowerCase(); if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0; return h < 24 && mm < 60 ? `${pad(h)}:${pad(mm)}` : null; });
  return t.length && !t.includes(null) ? [...new Set(t)].sort() : null;
}
function checkSheet(id) {
  const c = checks().find(x => x.id === id) || { name: "", times: ["08:00"], value: true, unit: "", warn: 2 };
  sheet.open(`<h3>${id ? "Edit" : "Add"} check</h3>
   <label for="cN">Name</label><input id="cN" value="${esc(c.name)}" placeholder="Blood sugar, insulin, morning pills…">
   <label for="cT">Times, Brian's time (comma between each)</label><input id="cT" value="${esc(c.times.join(", "))}" placeholder="08:00, 12:00, 18:00">
   <label class="inline"><input type="checkbox" id="cV" ${c.value ? "checked" : ""}>He records a number each time</label>
   <div class="two"><div><label for="cU">Unit</label><input id="cU" value="${esc(c.unit)}" placeholder="mg/dL, units"></div>
   <div><label for="cW">Warn if logged again within (hours)</label><input id="cW" type="number" min="0" step="0.5" value="${esc(c.warn)}"></div></div>
   <label>Target range from his doctor (optional)</label>
   <div class="two"><div><label class="small" for="cLo">Low</label><input id="cLo" type="number" inputmode="decimal" value="${esc(c.low ?? "")}" placeholder="e.g. 80"></div>
   <div><label class="small" for="cHi">High</label><input id="cHi" type="number" inputmode="decimal" value="${esc(c.high ?? "")}" placeholder="e.g. 180"></div></div>
   <p class="small">Readings outside this range are highlighted on the chart and in the log. Leave blank for no range.</p>
   <div class="acts">${id ? `<button data-act="delete">Delete</button>` : ""}<button data-act="cancel">Cancel</button><button class="pri" data-act="save">Save</button></div>`, mode => {
    if (mode === "delete") return saveSettings({ checks: checks().filter(x => x.id !== id) });
    const times = parseTimes(val("cT"));
    if (!val("cN") || !times) { sheet.msg("Add a name and times like 08:00, 6:30 pm."); return false; }
    const lo = val("cLo"), hi = val("cHi");
    if (lo !== "" && hi !== "" && +lo >= +hi) { sheet.msg("The low number should be smaller than the high number."); return false; }
    const n = { id: id || D.newId(), name: val("cN"), times, value: $("cV").checked, unit: val("cU"), warn: Number($("cW").value) || 0, low: lo === "" ? "" : +lo, high: hi === "" ? "" : +hi };
    saveSettings({ checks: id ? checks().map(x => x.id === id ? n : x) : checks().concat(n) });
    toast("Saved");
  });
}
function todoSheet(id) {
  const t = S.todos.find(x => x.id === id); if (!t) return;
  sheet.open(`<h3>Edit to-do</h3><label for="tT">What</label><input id="tT" value="${esc(t.text)}">
   <div class="two"><div><label for="tD">Due date</label><input id="tD" type="date" value="${esc(t.due || "")}"></div>
   <div><label for="tR">Repeats</label><select id="tR">${REPEAT_OPTIONS(true, t.repeat)}</select></div></div>
   <p class="small">A repeating to-do moves to its next date when it's ticked.</p>
   <div class="acts"><button data-act="delete">Delete</button><button data-act="cancel">Cancel</button><button class="pri" data-act="save">Save</button></div>`, mode => {
    if (mode === "delete") return D.deleteTodo(id);
    if (!val("tT")) { sheet.msg("Type what needs doing."); return false; }
    const rep = $("tR").value;
    D.saveTodo({ ...t, text: val("tT"), due: val("tD") || (rep ? btk() : ""), repeat: rep, done: rep ? false : t.done });
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
  if (d.tab) { goTab(d.tab); if (d.add) apptSheet(null); }
  else if (d.log) logSheet(d.log);
  else if (d.eappt) apptSheet(d.eappt);
  else if (d.echeck) checkSheet(d.echeck);
  else if (d.tedit) todoSheet(d.tedit);
  else if (d.ldel) { if (b.textContent !== "Sure?") { b.textContent = "Sure?"; return; } D.deleteLog(d.ldel); }
  else if (d.famdel) { if (b.textContent !== "Tap again to remove") { b.textContent = "Tap again to remove"; return; } D.removeFamily(d.famdel); toast("Removed"); }
});
$("famForm").addEventListener("submit", e => {
  e.preventDefault(); const em = val("famEmail").toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { $("famMsg").textContent = "Type a full email address."; return; }
  $("famMsg").textContent = ""; D.addFamily(em, me()); $("famEmail").value = ""; toast(`Added. ${em} can now sign in.`);
});
document.addEventListener("change", e => {
  const id = e.target.dataset && e.target.dataset.tick; if (!id) return;
  const t = S.todos.find(x => x.id === id); if (!t) return;
  const r = tickTodo(t, e.target.checked, btk()); D.saveTodo(r.todo);
  if (r.next) toast(`Done. Next time: ${prettyDate(r.next).long}`);
});
$("addAppt").addEventListener("click", () => apptSheet(null));
$("addCheck").addEventListener("click", () => checkSheet(null));
$("seed").addEventListener("click", () => saveSettings({ checks: [
  { id: D.newId(), name: "Blood sugar", times: ["07:30", "12:00", "18:00", "22:00"], value: true, unit: "mg/dL", warn: 1 },
  { id: D.newId(), name: "Insulin", times: ["07:30", "22:00"], value: true, unit: "units", warn: 4 }
] }));
$("nameSave").addEventListener("click", () => { if (val("nameIn")) { saveSettings({ name: val("nameIn") }); toast("Name saved"); } });
$("todoForm").addEventListener("submit", e => {
  e.preventDefault(); const text = val("todoIn"); if (!text) return;
  D.saveTodo({ id: D.newId(), text, due: "", done: false, by: me() || "Family", created: new Date().toISOString() }); $("todoIn").value = "";
  toast("To-do added");
});
$("copyLog").addEventListener("click", () => {
  const lines = [...S.logs].reverse().filter(l => Date.now() - new Date(l.at) < 14 * 864e5).map(l => `${l.local}  ${l.name}${valueText(l) ? ": " + valueText(l) : ""}${l.note ? ` (${l.note})` : ""}`);
  copyText(`Brian's log, last 14 days (his time)\n` + (lines.join("\n") || "Nothing logged."), "copyMsg");
});
$("signOut").addEventListener("click", () => D.signOut());
$("logOther").addEventListener("click", otherSheet);
window.addEventListener("online", () => $("offline").hidden = true);
window.addEventListener("offline", () => $("offline").hidden = false);
if (!navigator.onLine) $("offline").hidden = false;
// Pandas: next to the greeting and beside the love notes
$("hpanda").innerHTML = pandaFace(54);
document.querySelectorAll(".love").forEach(p => p.insertAdjacentHTML("afterbegin", pandaHeart(56)));
// Works offline and opens fast from the home screen
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
setInterval(() => { if (!sheet.isOpen()) renderAll(); else renderHeader(); }, 30000);

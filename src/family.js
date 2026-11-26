// Family page: Deborah, Nicole and Levi manage Brian's appointments, checks and to-dos.
import * as D from "./data.js";
import { BRIAN_TIMEZONE, FAMILY, OWNERS } from "./config.js";
import { $, esc, pad, DAYS, MON, mins, fmt12, wall, dayKey, hmOf, relDay, daysBetween, prettyDate, ago, slotsFor, valueText, makeSheet, val, copyText } from "./util.js";

const S = { settings: null, appts: [], logs: [], hobbies: [], todos: [], devices: [], family: [] };
const sheet = makeSheet();
const unsubs = [];
let user = null;
const me = () => (user && user.displayName ? user.displayName.split(" ")[0] : (user && user.email ? user.email.split("@")[0] : "Family"));

/* ---------- sign-in (Google) ---------- */
function gate(html) { $("app").hidden = true; $("gate").hidden = false; $("gate").innerHTML = html; }
function showSignIn() {
  if (!D.configured) return gate(`<h1>Not set up yet</h1><p>Add the Firebase details to <b>src/config.js</b>. See the README.</p>`);
  gate(`<h1>Brian's Daybook</h1><p>Family page. Sign in with your Google account.</p>
    <button class="pri" id="gBtn" style="width:100%;min-height:56px">Sign in with Google</button><p class="err" id="gErr"></p>`);
  $("gBtn").addEventListener("click", async () => {
    $("gErr").textContent = "";
    try { await D.signInGoogle(); } catch (e) { $("gErr").textContent = "Sign-in didn't work. Try again."; console.error(e); }
  });
}
function showNotAllowed() {
  gate(`<h1>Not on the family list yet</h1><p>You're signed in as <b>${esc(user.email || "")}</b>.</p>
    <p>Ask Levi or Nicole to add this email on the family page, under <b>People</b>. Then reload this page.</p>
    <div class="row-btns"><button id="gOut">Use a different Google account</button></div>`);
  $("gOut").addEventListener("click", () => D.signOut());
}
D.onUser(u => {
  user = u; unsubs.splice(0).forEach(f => f());
  if (!u || u.isAnonymous) return showSignIn();
  $("gate").hidden = true; $("app").hidden = false;
  const onErr = err => {
    console.error(err);
    if (String(err.code).includes("permission")) return showNotAllowed();
    $("problem").textContent = "Can't reach the Daybook right now. Check your connection."; $("problem").hidden = false;
  };
  ["settings", "appts", "logs", "hobbies", "todos", "devices", "family"].forEach(n => unsubs.push(D.watch(n, data => { S[n] = data; $("problem").hidden = true; if (!$("gate").hidden && n === "settings") { $("gate").hidden = true; $("app").hidden = false; } renderAll(); }, onErr)));
  renderAll();
});

/* ---------- helpers ---------- */
const checks = () => (S.settings && Array.isArray(S.settings.checks)) ? S.settings.checks : [];
const bw = () => wall(BRIAN_TIMEZONE);
const btk = () => dayKey(bw());
const apptKey = a => `${a.date} ${a.time || "00:00"}`;
const lastLog = id => S.logs.filter(l => l.check === id)[0];
const saveSettings = patch => D.saveSettings({ name: "Brian", checks: [], ...(S.settings || {}), ...patch });
let toastT;
function toast(msg) { $("toastMsg").textContent = msg; $("toast").classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => $("toast").classList.remove("on"), 5000); }

/* ---------- render ---------- */
function renderHeader() {
  const w = bw(), mine = wall("");
  $("date").textContent = `Brian's time: ${DAYS[w.wd]} ${w.d} ${MON[w.mo - 1]}`;
  $("clock").innerHTML = `${esc(fmt12(hmOf(w)))}<small>Your time: ${esc(fmt12(hmOf(mine)))}</small>`;
  $("who").textContent = `Signed in as ${user && user.email ? user.email : ""}.`;
}

function renderOverview() {
  const w = bw(), nm = w.h * 60 + w.mi, tk = dayKey(w);
  const dayLogs = S.logs.filter(l => (l.local || "").startsWith(tk));
  const all = checks().map(c => ({ c, slots: slotsFor(c, dayLogs, nm) }));
  const missed = all.flatMap(x => x.slots.filter(s => s.st === "missed").map(s => `${x.c.name} ${fmt12(s.t)}`));
  const last = S.logs[0];
  const nx = $("ovNext");
  nx.className = "next" + (missed.length ? " due" : "");
  nx.innerHTML = (missed.length ? `<b>Missed today: ${esc(missed.join(", "))}</b>` : `<b>${checks().length ? "Nothing missed today so far." : "No checks set yet. Add them under Checks."}</b>`) +
    `<span>${last ? `He last logged something ${esc(ago(Date.now() - new Date(last.at)))}.` : "Nothing logged yet."}</span>`;

  let lo = 6 * 60; const hi = 24 * 60;
  checks().forEach(c => c.times.forEach(t => { const m = mins(t); if (m < lo) lo = Math.floor(m / 60) * 60; }));
  const pos = m => ((Math.min(Math.max(m, lo), hi) - lo) / (hi - lo) * 100).toFixed(2);
  const step = window.innerWidth < 600 ? 360 : 180, hrs = []; for (let m = lo; m <= hi; m += step) hrs.push(m);
  const nowLine = `<div class="now" style="left:${pos(nm)}%"></div>`;
  $("timeline").innerHTML = all.length ? `<div class="tl-hours"><span></span><div class="track">${hrs.map(m => `<span class="hr${m === lo ? " first" : m === hi ? " last" : ""}" style="left:${pos(m)}%">${m === hi ? "12 am" : fmt12(pad(Math.floor(m / 60) % 24) + ":00").replace(":00", "")}</span>`).join("")}</div></div>` +
    all.map(x => `<div class="tl-row"><span class="nm">${esc(x.c.name)}</span><div class="track">${nowLine}${x.slots.map(s => `<span class="dot ${s.st}" style="left:${pos(mins(s.t))}%"></span>`).join("")}</div></div>`).join("") : "";

  $("ovChecks").innerHTML = all.length ? all.map(x => {
    const ll = lastLog(x.c.id);
    return `<div class="item"><div><div class="t">${esc(x.c.name)}</div><div class="s">${ll ? `Last: ${esc(ago(Date.now() - new Date(ll.at)))} (${esc(fmt12(ll.local.slice(11)))}${valueText(ll, x.c.unit) ? ", " + esc(valueText(ll, x.c.unit)) : ""})` : "Not logged yet"}</div></div><span></span>
      <div class="slots">${x.slots.map(s => `<span class="chip ${s.st}">${fmt12(s.t)}${s.st === "done" ? " ✓" : s.st === "missed" ? " – missed" : ""}</span>`).join("")}</div></div>`;
  }).join("") : `<p class="empty">No checks set.</p>`;

  const up = S.appts.filter(a => a.date >= tk).sort((a, b) => apptKey(a).localeCompare(apptKey(b))).slice(0, 3);
  $("ovAppts").innerHTML = up.length ? up.map(a => apptRow(a, tk, true)).join("") : `<p class="empty">Nothing booked.</p>`;
  const open = S.todos.filter(t => !t.done).sort(todoSort);
  $("ovTodos").innerHTML = open.length ? open.slice(0, 5).map(t => todoRow(t, tk)).join("") + (open.length > 5 ? `<button class="link" data-tab="todo">See all ${open.length}</button>` : "") : `<p class="empty">Nothing on his list.</p>`;
}

function apptRow(a, tk, edit) {
  const p = prettyDate(a.date), rel = relDay(tk, a.date), soon = rel === "Today" || rel === "Tomorrow";
  return `<div class="appt"><div class="d">${p.short}<small>${p.day.slice(0, 3)}${a.time ? " · " + fmt12(a.time) : ""}</small></div>
  <div><div class="t">${esc(a.title)}</div><div class="s ${soon ? "soon" : ""}">${rel}</div>
  ${a.where ? `<div class="s">${esc(a.where)}</div>` : ""}${a.with ? `<div class="s">With ${esc(a.with)}</div>` : ""}${a.notes ? `<div class="s">${esc(a.notes)}</div>` : ""}
  ${a.by ? `<div class="s">Added by ${esc(a.by)}</div>` : ""}</div>
  ${edit ? `<button data-eappt="${esc(a.id)}">Edit</button>` : ""}</div>`;
}
function renderAppts() {
  const tk = btk(), s = [...S.appts].sort((a, b) => apptKey(a).localeCompare(apptKey(b)));
  const up = s.filter(a => a.date >= tk), past = s.filter(a => a.date < tk).reverse().slice(0, 20);
  $("apptList").innerHTML = up.length ? up.map(a => apptRow(a, tk, true)).join("") : `<p class="empty">Nothing booked.</p>`;
  $("pastList").innerHTML = past.length ? past.map(a => apptRow(a, tk, true)).join("") : `<p class="empty">None yet.</p>`;
}

const todoSort = (a, b) => (a.due || "9999").localeCompare(b.due || "9999") || (a.created || "").localeCompare(b.created || "");
function todoRow(t, tk) {
  const overdue = t.due && !t.done && t.due < tk;
  const meta = [t.due ? (overdue ? `Was due ${prettyDate(t.due).short}` : `Due ${relDay(tk, t.due).toLowerCase()}`) : "", t.by ? `Added by ${t.by}` : "", t.done && t.doneAt ? `Done ${ago(Date.now() - new Date(t.doneAt))}` : ""].filter(Boolean).join(" · ");
  return `<div class="todo ${t.done ? "done" : ""}"><label><input type="checkbox" data-tick="${esc(t.id)}" ${t.done ? "checked" : ""}><span>${esc(t.text)}<span class="meta ${overdue ? "soon" : ""}">${esc(meta)}</span></span></label>
    <button class="link" data-tedit="${esc(t.id)}">Edit</button></div>`;
}
function renderTodos() {
  const tk = btk();
  const open = S.todos.filter(t => !t.done).sort(todoSort), done = S.todos.filter(t => t.done).sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || "")).slice(0, 30);
  $("todoList").innerHTML = open.length ? open.map(t => todoRow(t, tk)).join("") : `<p class="empty">Nothing on his list.</p>`;
  $("doneSum").textContent = `Done (${done.length})`;
  $("doneList").innerHTML = done.map(t => todoRow(t, tk)).join("");
}

function renderChecks() {
  $("checkList").innerHTML = checks().length ? checks().map(c => `<div class="item"><div><div class="t">${esc(c.name)}</div><div class="s">${c.times.map(fmt12).join(", ")}${c.value ? ` · records ${esc(c.unit || "a number")}` : ""}${Number(c.warn) ? ` · warn within ${esc(c.warn)} h` : ""}</div></div><button data-echeck="${esc(c.id)}">Edit</button></div>`).join("") : `<p class="empty">No checks yet.</p>`;
  $("seed").hidden = checks().length > 0;
  if (document.activeElement !== $("nameIn")) $("nameIn").value = (S.settings && S.settings.name) || "Brian";
}

function renderLog() {
  const tk = btk(), by = {};
  S.logs.forEach(l => { const k = (l.local || "").slice(0, 10); if (!k) return; const n = daysBetween(k, tk); if (n >= 0 && n <= 14) (by[k] = by[k] || []).push(l); });
  const keys = Object.keys(by).sort().reverse();
  $("logList").innerHTML = keys.length ? keys.map(k => { const p = prettyDate(k); return `<div class="day"><h3>${relDay(tk, k)} · ${p.long}</h3><table>${by[k].map(l => `<tr><td class="tm">${fmt12(l.local.slice(11))}</td><td>${esc(l.name)}${l.note ? `<div class="small">${esc(l.note)}</div>` : ""}</td><td class="n">${esc(valueText(l))}</td><td style="width:1%"><button class="link" data-ldel="${esc(l.id)}">Delete</button></td></tr>`).join("")}</table></div>`; }).join("") : `<p class="empty">Nothing logged in the last 14 days.</p>`;
}

function renderHobbies() {
  const list = [...S.hobbies].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  $("hobList").innerHTML = list.length ? list.map(h => `<div class="hob"><div class="row"><span class="t">${esc(h.name)}</span><span class="small">${h.last ? "Last done " + esc(ago(Date.now() - new Date(h.last))) : "Not logged yet"}</span></div>${h.note ? `<p style="margin:8px 0 0">${esc(h.note)}</p>` : ""}</div>`).join("") : `<p class="empty">No hobbies added yet.</p>`;
}

function renderPeople() {
  $("devList").innerHTML = S.devices.length ? S.devices.map(d => `<div class="item"><div><div class="t">${esc(d.name || "Brian's device")}</div><div class="s">Connected ${d.added ? esc(ago(Date.now() - new Date(d.added))) : ""}${d.by ? " by " + esc(d.by) : ""}</div></div><button data-devdel="${esc(d.id)}">Disconnect</button></div>`).join("") : `<p class="empty">No devices connected yet.</p>`;
  const fam = [...OWNERS.map(e => ({ id: e, owner: true })), ...S.family.filter(f => !OWNERS.includes(f.id))];
  $("famList").innerHTML = fam.map(f => `<div class="item"><div><div class="t" style="font-size:18px;overflow-wrap:anywhere">${esc(f.id)}</div><div class="s">${f.owner ? "Owner" : f.by ? "Added by " + esc(f.by) : ""}</div></div>${f.owner || (user && f.id === (user.email || "").toLowerCase()) ? "<span></span>" : `<button data-famdel="${esc(f.id)}">Remove</button>`}</div>`).join("");
}

function renderAll() {
  if ($("app").hidden) return;
  renderHeader(); renderOverview(); renderAppts(); renderTodos(); renderChecks(); renderLog(); renderHobbies(); renderPeople();
}

/* ---------- editors ---------- */
function apptSheet(id) {
  const a = S.appts.find(x => x.id === id) || { date: btk(), time: "", title: "", where: "", with: "", notes: "" };
  sheet.open(`<h3>${id ? "Edit" : "Add"} appointment</h3>
   <label for="aT">What</label><input id="aT" value="${esc(a.title)}" placeholder="Diabetes clinic, dentist…">
   <div class="two"><div><label for="aD">Date</label><input id="aD" type="date" value="${esc(a.date)}"></div><div><label for="aH">Time (Brian's time)</label><input id="aH" type="time" value="${esc(a.time)}"></div></div>
   <label for="aW">Where</label><input id="aW" value="${esc(a.where)}">
   <label for="aWith">Going with</label><input id="aWith" list="fam" value="${esc(a.with)}"><datalist id="fam">${FAMILY.map(f => `<option value="${esc(f)}">`).join("")}</datalist>
   <label for="aN">Notes for Brian</label><textarea id="aN" placeholder="Bring readings, fast from midnight…">${esc(a.notes)}</textarea>
   <div class="acts">${id ? `<button data-act="delete">Delete</button>` : ""}<button data-act="cancel">Cancel</button><button class="pri" data-act="save">Save</button></div>`, mode => {
    if (mode === "delete") { D.deleteAppt(id); return toast("Appointment deleted"); }
    if (!val("aT") || !val("aD")) { sheet.msg("Add what it is and the date."); return false; }
    D.saveAppt({ id: id || D.newId(), title: val("aT"), date: val("aD"), time: val("aH"), where: val("aW"), with: val("aWith"), notes: val("aN"), by: a.by || me() });
    toast(id ? "Appointment updated" : "Appointment added. It's on Brian's tablet now.");
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
   <div class="acts">${id ? `<button data-act="delete">Delete</button>` : ""}<button data-act="cancel">Cancel</button><button class="pri" data-act="save">Save</button></div>`, mode => {
    if (mode === "delete") return saveSettings({ checks: checks().filter(x => x.id !== id) });
    const times = parseTimes(val("cT"));
    if (!val("cN") || !times) { sheet.msg("Add a name and times like 08:00, 6:30 pm."); return false; }
    const n = { id: id || D.newId(), name: val("cN"), times, value: $("cV").checked, unit: val("cU"), warn: Number($("cW").value) || 0 };
    saveSettings({ checks: id ? checks().map(x => x.id === id ? n : x) : checks().concat(n) });
    toast("Saved. His reminders update next time the app is open.");
  });
}
function todoSheet(id) {
  const t = S.todos.find(x => x.id === id); if (!t) return;
  sheet.open(`<h3>Edit to-do</h3><label for="tT">What</label><input id="tT" value="${esc(t.text)}">
   <label for="tD">Due date (optional)</label><input id="tD" type="date" value="${esc(t.due || "")}">
   <div class="acts"><button data-act="delete">Delete</button><button data-act="cancel">Cancel</button><button class="pri" data-act="save">Save</button></div>`, mode => {
    if (mode === "delete") return D.deleteTodo(id);
    if (!val("tT")) { sheet.msg("Type what needs doing."); return false; }
    D.saveTodo({ ...t, text: val("tT"), due: val("tD") });
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
  else if (d.eappt) apptSheet(d.eappt);
  else if (d.echeck) checkSheet(d.echeck);
  else if (d.tedit) todoSheet(d.tedit);
  else if (d.ldel) { if (b.textContent !== "Sure?") { b.textContent = "Sure?"; return; } D.deleteLog(d.ldel); }
  else if (d.devdel) { if (b.textContent !== "Tap again to disconnect") { b.textContent = "Tap again to disconnect"; return; } D.removeDevice(d.devdel); toast("Device disconnected"); }
  else if (d.famdel) { if (b.textContent !== "Tap again to remove") { b.textContent = "Tap again to remove"; return; } D.removeFamily(d.famdel); toast("Removed"); }
});
$("devForm").addEventListener("submit", async e => {
  e.preventDefault(); $("devMsg").textContent = "";
  const code = val("devCode").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 6) { $("devMsg").textContent = "The code has 6 letters and numbers, like K7Q-4MX."; return; }
  try {
    const ok = await D.connectDevice(code, val("devName") || "Brian's device", me());
    if (ok) { $("devCode").value = ""; $("devName").value = ""; toast("Connected. Brian's app opens by itself."); }
    else $("devMsg").textContent = "No device is showing that code. Check it and try again.";
  } catch (err) { console.error(err); $("devMsg").textContent = "That didn't work. Check your connection and try again."; }
});
$("famForm").addEventListener("submit", e => {
  e.preventDefault(); const em = val("famEmail").toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { $("famMsg").textContent = "Type a full email address."; return; }
  $("famMsg").textContent = ""; D.addFamily(em, me()); $("famEmail").value = ""; toast(`Added. ${em} can now sign in.`);
});
document.addEventListener("change", e => {
  const id = e.target.dataset && e.target.dataset.tick; if (!id) return;
  const t = S.todos.find(x => x.id === id); if (t) D.saveTodo({ ...t, done: e.target.checked, doneAt: e.target.checked ? new Date().toISOString() : null });
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
  toast("Added to Brian's list");
});
$("copyLog").addEventListener("click", () => {
  const lines = [...S.logs].reverse().filter(l => Date.now() - new Date(l.at) < 14 * 864e5).map(l => `${l.local}  ${l.name}${valueText(l) ? ": " + valueText(l) : ""}${l.note ? ` (${l.note})` : ""}`);
  copyText(`Brian's log, last 14 days (his time)\n` + (lines.join("\n") || "Nothing logged."), "copyMsg");
});
$("signOut").addEventListener("click", () => D.signOut());
setInterval(() => { if (!sheet.isOpen()) renderAll(); else renderHeader(); }, 30000);

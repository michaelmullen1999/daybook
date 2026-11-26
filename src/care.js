// Deborah's notes (with photos), search, daily diary, care info sheet, pill stock,
// emergency screen, doctor report and backup.
import { emptyPanda, pandaFace } from "./panda.js";
import { $, esc, prettyDate, relDay, ago, addDays, daysBetween, copyText, val, fmt12, drawReadings, inRangeText, nextDate } from "./util.js";

export function initCare({ S, D, sheet, toast, me, today, goTab }) {
  const checks = () => (S.settings && Array.isArray(S.settings.checks)) ? S.settings.checks : [];
  const photo = id => (S.photos || []).find(p => p.id === id);

  /* ---------- quick notes ---------- */
  const thumbs = n => (n.photos || []).map(id => photo(id)).filter(Boolean)
    .map(p => `<button class="thumb" data-photo="${esc(p.id)}" aria-label="Open photo"><img alt="" src="${p.data.startsWith("data:image/") ? p.data : ""}"></button>`).join("");
  const noteCard = n => `<div class="note ${n.pinned ? "pinned" : ""} ${n.done ? "done" : ""}">
    <div class="ntext">${esc(n.text).replace(/\n/g, "<br>")}</div>
    ${(n.photos || []).length ? `<div class="thumbs">${thumbs(n)}</div>` : ""}
    <div class="nmeta">${n.pinned ? "📌 Pinned · " : ""}${esc(n.by || "")}${n.updated ? " · " + esc(ago(Date.now() - new Date(n.updated))) : ""}</div>
    <div class="nact">${n.done ? `<button class="link" data-nundo="${esc(n.id)}">Put back</button>` : `<button class="link" data-npin="${esc(n.id)}">${n.pinned ? "Unpin" : "Pin"}</button><button class="link" data-ndone="${esc(n.id)}">Done</button>`}<button class="link" data-nedit="${esc(n.id)}">Edit</button></div></div>`;
  const sortNotes = (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updated || "").localeCompare(a.updated || "");
  function renderNotes() {
    const open = S.notes.filter(n => !n.done).sort(sortNotes), done = S.notes.filter(n => n.done).sort(sortNotes).slice(0, 40);
    $("noteList").innerHTML = open.length ? open.map(noteCard).join("") : emptyPanda("No notes yet. Write one above.");
    $("noteDoneSum").textContent = `Done (${done.length})`;
    $("noteDone").innerHTML = done.map(noteCard).join("");
    renderPending(); renderSearch();
  }
  function renderTodayNotes() {
    const pinned = S.notes.filter(n => n.pinned && !n.done).sort(sortNotes);
    $("ovNotes").innerHTML = pinned.length ? `<div class="notes">${pinned.map(noteCard).join("")}</div>` : emptyPanda("Nothing pinned. Pin a note to keep it here.");
  }
  const saveNote = n => D.saveDoc("notes", { ...n, updated: new Date().toISOString() });
  function noteSheet(id) {
    const n = S.notes.find(x => x.id === id); if (!n) return;
    sheet.open(`<h3>Edit note</h3><textarea id="nT" rows="6">${esc(n.text)}</textarea>
      ${(n.photos || []).length ? `<p class="small">${n.photos.length} photo${n.photos.length > 1 ? "s" : ""}. Tap a photo on the note to view or remove it.</p>` : ""}
      <label class="inline"><input type="checkbox" id="nP" ${n.pinned ? "checked" : ""}> Pin to Today</label>
      <div class="acts"><button data-act="delete">Delete</button><button data-act="cancel">Cancel</button><button class="pri" data-act="save">Save</button></div>`, mode => {
      if (mode === "delete") { (n.photos || []).forEach(pid => D.removeDoc("photos", pid)); D.removeDoc("notes", id); return toast("Note deleted"); }
      if (!val("nT") && !(n.photos || []).length) { sheet.msg("The note is empty."); return false; }
      saveNote({ ...n, text: val("nT"), pinned: $("nP").checked });
    });
  }

  /* photos: shrunk on the device, then saved with the note (each well under 1 MB) */
  let pending = [];
  function renderPending() {
    $("notePhotos").innerHTML = pending.map((p, i) => `<span class="thumb"><img alt="" src="${p}"><button class="x" data-unphoto="${i}" aria-label="Remove photo">×</button></span>`).join("");
  }
  async function shrink(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      for (const [max, q] of [[1400, .72], [1100, .65], [900, .6], [700, .55]]) {
        const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const d = c.toDataURL("image/jpeg", q); if (d.length < 700000) return d;
      }
      throw new Error("too big");
    } finally { URL.revokeObjectURL(url); }
  }
  $("notePhotoIn").addEventListener("change", async e => {
    for (const f of [...e.target.files].slice(0, 4)) { try { pending.push(await shrink(f)); } catch { toast("Couldn't use that photo"); } }
    e.target.value = ""; renderPending();
  });
  $("noteForm").addEventListener("submit", e => {
    e.preventDefault(); const text = val("noteIn"); if (!text && !pending.length) return;
    const id = D.newId(), ids = pending.map(data => { const pid = D.newId(); D.saveDoc("photos", { id: pid, noteId: id, data, by: me(), created: new Date().toISOString() }); return pid; });
    saveNote({ id, text, photos: ids, pinned: $("notePin").checked, done: false, by: me(), created: new Date().toISOString() });
    $("noteIn").value = ""; $("notePin").checked = false; pending = []; renderPending(); toast("Note added");
  });
  function photoSheet(pid) {
    const p = photo(pid); if (!p) return;
    sheet.open(`<h3>Photo</h3><img class="bigphoto" alt="Photo from a note" src="${p.data.startsWith("data:image/") ? p.data : ""}">
      <div class="acts"><button data-act="delete">Remove photo</button><button class="pri" data-act="cancel">Close</button></div>`, mode => {
      if (mode !== "delete") return;
      const n = S.notes.find(x => (x.photos || []).includes(pid));
      if (n) saveNote({ ...n, photos: n.photos.filter(x => x !== pid) });
      D.removeDoc("photos", pid); toast("Photo removed");
    });
  }

  /* ---------- search ---------- */
  function renderSearch() {
    const q = ($("searchIn").value || "").trim().toLowerCase(), box = $("searchResults");
    if (q.length < 2) { box.innerHTML = ""; box.hidden = true; return; }
    const hit = s => String(s || "").toLowerCase().includes(q);
    const snip = s => { s = String(s || ""); const i = s.toLowerCase().indexOf(q); const a = Math.max(0, i - 40); return (a ? "…" : "") + s.slice(a, i + q.length + 60) + (i + q.length + 60 < s.length ? "…" : ""); };
    const res = [];
    S.notes.forEach(n => { if (hit(n.text)) res.push({ kind: "Note", text: snip(n.text), sub: n.done ? "Done" : n.pinned ? "Pinned" : "", act: `data-nedit="${esc(n.id)}"` }); });
    S.diary.forEach(d => { const all = [d.note, (d.tags || []).join(" "), d.mood, d.sleep].join(" "); if (hit(all)) res.push({ kind: "Diary", text: snip(d.note || (d.tags || []).join(", ")), sub: prettyDate(d.id).long, act: `data-dopen="${esc(d.id)}" data-gotab="diary"` }); });
    S.appts.forEach(a => { const all = [a.title, a.where, a.with, a.notes, a.questions, a.outcome].join(" "); if (hit(all)) res.push({ kind: "Appointment", text: a.title, sub: `${prettyDate(a.date).long}${a.outcome && hit(a.outcome) ? " · " + snip(a.outcome) : ""}`, act: `data-eappt="${esc(a.id)}"` }); });
    const c = care(); const careAll = [c.allergies, c.conditions, c.insurance, c.other, c.address, ...(c.meds || []).map(m => Object.values(m).join(" ")), ...(c.contacts || []).map(p => Object.values(p).join(" "))].join(" ");
    if (hit(careAll)) res.push({ kind: "Care info", text: snip(careAll), sub: "", act: `data-tab="care"` });
    S.todos.forEach(t => { if (hit(t.text)) res.push({ kind: "To-do", text: t.text, sub: t.done ? "Done" : "", act: `data-tedit="${esc(t.id)}"` }); });
    box.hidden = false;
    box.innerHTML = `<h2>${res.length} result${res.length === 1 ? "" : "s"}</h2>` + (res.length ? res.slice(0, 40).map(r => `<div class="item"><div><div class="t" style="font-size:17px"><span class="rep">${r.kind}</span> ${esc(r.text)}</div>${r.sub ? `<div class="s">${esc(r.sub)}</div>` : ""}</div><button ${r.act}>Open</button></div>`).join("") : emptyPanda("Nothing found."));
  }
  $("searchIn").addEventListener("input", renderSearch);

  /* ---------- daily diary ---------- */
  const MOOD = ["Good", "Mixed", "Hard"], LEVEL = ["Good", "OK", "Poor"];
  const TAGS = ["Confused", "Anxious", "Tired", "Low", "Restless", "Fall", "Wandered", "Good day out", "Visitors"];
  let diaryDate = null;
  const entry = k => S.diary.find(d => d.id === k) || { id: k, date: k, mood: "", sleep: "", eating: "", tags: [], note: "" };
  const chips = (field, opts, cur) => `<div class="chips" role="group" aria-label="${field}">${opts.map(o => `<button data-dfield="${field}" data-dval="${esc(o)}" aria-pressed="${cur === o}">${esc(o)}</button>`).join("")}</div>`;
  function renderDiary() {
    const tk = today(); if (!diaryDate) diaryDate = tk;
    const ae = document.activeElement; if (ae && ae.id === "dNote") return;
    const e = entry(diaryDate);
    $("diaryToday").innerHTML = `<div class="diary">
      <div class="dhead"><h2 style="margin:0">${diaryDate === tk ? "How's Brian today?" : `How was Brian on ${esc(prettyDate(diaryDate).long)}?`}</h2>
        <input type="date" id="dDate" value="${esc(diaryDate)}" max="${esc(tk)}" aria-label="Day"></div>
      <label>Mood</label>${chips("mood", MOOD, e.mood)}
      <div class="two"><div><label>Sleep</label>${chips("sleep", LEVEL, e.sleep)}</div><div><label>Eating</label>${chips("eating", LEVEL, e.eating)}</div></div>
      <label>Anything to note?</label><div class="chips">${TAGS.map(t => `<button data-dtag="${esc(t)}" aria-pressed="${(e.tags || []).includes(t)}">${esc(t)}</button>`).join("")}</div>
      <label for="dNote">Notes</label><textarea id="dNote" rows="4" placeholder="What happened, what helped, anything for the doctor…">${esc(e.note || "")}</textarea>
      <p class="small" id="dSaved">${e.updated ? `Saved ${esc(ago(Date.now() - new Date(e.updated)))}${e.by ? " by " + esc(e.by) : ""}.` : "Saves as you go."}</p></div>`;
    const past = S.diary.filter(d => d.id !== diaryDate).sort((a, b) => b.id.localeCompare(a.id)).slice(0, 30);
    $("diaryList").innerHTML = past.length ? past.map(d => `<div class="item"><div><div class="t" style="font-size:18px">${esc(relDay(tk, d.id))} · ${esc(prettyDate(d.id).long)}</div>
      <div class="s">${esc(diaryLine(d))}</div></div><button data-dopen="${esc(d.id)}">Open</button></div>`).join("") : emptyPanda("No earlier entries yet.");
  }
  const diaryLine = d => [d.mood && `Mood ${d.mood.toLowerCase()}`, d.sleep && `sleep ${d.sleep.toLowerCase()}`, d.eating && `eating ${d.eating.toLowerCase()}`, (d.tags || []).join(", "), d.note].filter(Boolean).join(" · ") || "Nothing filled in";
  function renderTodayDiary() {
    const tk = today(), d = S.diary.find(x => x.id === tk);
    $("ovDiary").innerHTML = d ? `<div class="item"><div><div class="s">${esc(diaryLine(d))}</div></div><button data-tab="diary">Open</button></div>`
      : `${emptyPanda("Nothing written yet today.")}<div class="row-btns"><button data-tab="diary">How's Brian today?</button></div>`;
  }
  let dT;
  const saveDiary = patch => {
    const e = { ...entry(diaryDate), ...patch, date: diaryDate, by: me(), updated: new Date().toISOString() };
    S.diary = S.diary.filter(x => x.id !== e.id).concat(e);
    D.saveDoc("diary", e);
  };

  /* ---------- care info sheet + pill stock ---------- */
  const care = () => S.care.find(c => c.id === "main") || { id: "main", conditions: "", allergies: "", insurance: "", other: "", dob: "", address: "", meds: [], contacts: [] };
  const saveCare = patch => D.saveDoc("care", { ...care(), ...patch, by: me(), updated: new Date().toISOString() });
  const TEXT = { conditions: ["Health conditions", "Diabetes (type 2), early dementia…"], allergies: ["Allergies", "Medicines or foods he must not have"], insurance: ["Insurance and ID numbers", "Medicare number, insurance plan, pharmacy…"], other: ["Other important things", "Routines, what calms him, care wishes, door codes…"] };
  const para = t => t ? `<p class="cval">${esc(t).replace(/\n/g, "<br>")}</p>` : `<p class="empty">Not filled in yet.</p>`;
  const telLink = p => { const n = String(p || "").replace(/[^\d+]/g, ""); return n ? `<a href="tel:${esc(n)}">${esc(p)}</a>` : esc(p || ""); };
  // Tablets left today, worked out from the count she entered and how many he takes a day
  function stockNow(m) {
    const st = parseFloat(m.stock), pd = parseFloat(m.perDay);
    if (isNaN(st) || isNaN(pd) || pd <= 0 || !m.stockDate) return null;
    const left = Math.max(0, st - pd * Math.max(0, daysBetween(m.stockDate, today())));
    return { left: Math.floor(left), days: Math.floor(left / pd) };
  }
  const stockText = m => { const s = stockNow(m); return s ? `${s.left} left · about ${s.days} day${s.days === 1 ? "" : "s"}` : ""; };
  const lowStock = () => (care().meds || []).map(m => ({ m, s: stockNow(m) })).filter(x => x.s && x.s.days <= (parseFloat(x.m.warnDays) || 7));
  function renderCare() {
    const c = care();
    const sec = (k, extraClass = "") => `<div class="csec ${extraClass}"><div class="chd"><h2>${TEXT[k][0]}</h2><button class="link noprint" data-cedit="${k}">Edit</button></div>${para(c[k])}</div>`;
    const low = new Set(lowStock().map(x => x.m));
    $("careSheet").innerHTML = `
      <div class="printhead"><h1>Brian: care information</h1><p class="small">Printed from Daybook${c.updated ? `, last updated ${esc(new Date(c.updated).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))}` : ""}.</p></div>
      <div class="csec"><div class="chd"><h2>About Brian</h2><button class="link noprint" data-cabout="1">Edit</button></div>
        ${c.dob || c.address ? `<p class="cval">${c.dob ? `Born ${esc(prettyDate(c.dob).long)} ${esc(c.dob.slice(0, 4))}` : ""}${c.dob && c.address ? "<br>" : ""}${esc(c.address || "")}</p>` : `<p class="empty">Add his date of birth and home address for the emergency screen.</p>`}</div>
      ${sec("allergies", c.allergies ? "alert" : "")}
      ${sec("conditions")}
      <div class="csec"><div class="chd"><h2>Medicines</h2><button class="link noprint" data-cmed="">Add</button></div>
        ${c.meds && c.meds.length ? `<table class="stack ctable"><thead><tr><th>Medicine</th><th>Dose</th><th>When</th><th>What for</th><th>Supply</th><th class="noprint"></th></tr></thead><tbody>${c.meds.map((m, i) => `<tr><td data-l="Medicine"><b>${esc(m.name)}</b></td><td data-l="Dose">${esc(m.dose)}</td><td data-l="When">${esc(m.when)}</td><td data-l="What for">${esc(m.for)}</td><td data-l="Supply" class="${low.has(m) ? "flag" : ""}">${esc(stockText(m))}</td><td class="noprint"><button class="link" data-cmed="${i}">Edit</button></td></tr>`).join("")}</tbody></table>` : emptyPanda("No medicines added yet.")}</div>
      <div class="csec"><div class="chd"><h2>Doctors and contacts</h2><button class="link noprint" data-ccon="">Add</button></div>
        ${c.contacts && c.contacts.length ? c.contacts.map((p, i) => `<div class="item"><div><div class="t" style="font-size:19px">${esc(p.name)}${p.role ? ` <span class="small">· ${esc(p.role)}</span>` : ""}</div>
          <div class="s">${[p.phone ? telLink(p.phone) : "", p.email ? esc(p.email) : "", p.address ? esc(p.address) : ""].filter(Boolean).join(" · ")}</div></div><button class="link noprint" data-ccon="${i}">Edit</button></div>`).join("") : emptyPanda("No contacts added yet.")}</div>
      ${sec("insurance")}
      ${sec("other")}
      ${c.updated ? `<p class="small noprint">Last updated ${esc(ago(Date.now() - new Date(c.updated)))}${c.by ? " by " + esc(c.by) : ""}.</p>` : ""}`;
  }
  function renderTodayStock() {
    const low = lowStock();
    $("ovStock").hidden = !low.length;
    $("ovStock").innerHTML = low.length ? `<b>Running low:</b> ${low.map(x => `${esc(x.m.name)} (${x.s.days <= 0 ? "out now" : `about ${x.s.days} day${x.s.days === 1 ? "" : "s"} left`})`).join(", ")}. <button class="link" data-tab="care">Update supply</button>` : "";
  }
  function careText(k) {
    sheet.open(`<h3>${TEXT[k][0]}</h3><textarea id="cTxt" rows="7" placeholder="${esc(TEXT[k][1])}">${esc(care()[k] || "")}</textarea>
      <div class="acts"><button data-act="cancel">Cancel</button><button class="pri" data-act="save">Save</button></div>`, () => { saveCare({ [k]: $("cTxt").value.trim() }); toast("Saved"); });
  }
  function careAbout() {
    const c = care();
    sheet.open(`<h3>About Brian</h3><label for="cDob">Date of birth</label><input id="cDob" type="date" value="${esc(c.dob || "")}">
      <label for="cAddr">Home address</label><textarea id="cAddr" rows="3">${esc(c.address || "")}</textarea>
      <div class="acts"><button data-act="cancel">Cancel</button><button class="pri" data-act="save">Save</button></div>`, () => { saveCare({ dob: val("cDob"), address: val("cAddr") }); toast("Saved"); });
  }
  function careItem(kind, idx) {
    const list = [...(care()[kind] || [])], i = idx === "" ? -1 : +idx, cur = i >= 0 ? list[i] : {};
    const F = kind === "meds" ? [["name", "Medicine", "Metformin"], ["dose", "Dose", "500 mg"], ["when", "When", "Morning and evening"], ["for", "What for", "Blood sugar"]]
      : [["name", "Name", "Dr Patel"], ["role", "Who they are", "GP, diabetes nurse, pharmacy…"], ["phone", "Phone", "(503) 555-0100"], ["email", "Email", ""], ["address", "Address", ""]];
    const s = kind === "meds" ? stockNow(cur) : null;
    sheet.open(`<h3>${i >= 0 ? "Edit" : "Add"} ${kind === "meds" ? "medicine" : "contact"}</h3>
      ${F.map(([f, l, ph]) => `<label for="ci-${f}">${l}</label><input id="ci-${f}" value="${esc(cur[f] || "")}" placeholder="${esc(ph)}" ${f === "phone" ? 'type="tel"' : f === "email" ? 'type="email"' : ""}>`).join("")}
      ${kind === "meds" ? `<label>Supply (optional, for the "running low" warning)</label>
        <div class="two"><div><label class="small" for="ci-stock">Tablets or doses left now</label><input id="ci-stock" type="number" inputmode="numeric" min="0" value="${s ? s.left : esc(cur.stock ?? "")}"></div>
        <div><label class="small" for="ci-perDay">Taken per day</label><input id="ci-perDay" type="number" inputmode="decimal" min="0" step="0.5" value="${esc(cur.perDay ?? "")}"></div></div>
        <label class="small" for="ci-warnDays">Warn when this many days are left</label><input id="ci-warnDays" type="number" inputmode="numeric" min="1" value="${esc(cur.warnDays ?? 7)}">
        <p class="small">After a refill, put the new count in "left now".</p>` : ""}
      <div class="acts">${i >= 0 ? `<button data-act="delete">Delete</button>` : ""}<button data-act="cancel">Cancel</button><button class="pri" data-act="save">Save</button></div>`, mode => {
      if (mode === "delete") { list.splice(i, 1); saveCare({ [kind]: list }); return toast("Deleted"); }
      const item = { ...cur, ...Object.fromEntries(F.map(([f]) => [f, val("ci-" + f)])) };
      if (!item.name) { sheet.msg("Add a name."); return false; }
      if (kind === "meds") {
        const st = val("ci-stock"), pd = val("ci-perDay");
        item.perDay = pd === "" ? "" : +pd; item.warnDays = +(val("ci-warnDays") || 7);
        const changed = st !== "" && (!s || +st !== s.left || item.perDay !== cur.perDay);
        if (st === "") { item.stock = ""; item.stockDate = ""; } else if (changed || !cur.stockDate) { item.stock = +st; item.stockDate = today(); }
      }
      if (i >= 0) list[i] = item; else list.push(item);
      saveCare({ [kind]: list }); toast("Saved");
    });
  }
  $("printCare").addEventListener("click", () => printAs("printing-care"));
  function printAs(cls) { document.body.classList.add(cls); try { window.print(); } finally { setTimeout(() => document.body.classList.remove(cls), 800); } }

  /* ---------- emergency screen ---------- */
  function openEmergency() {
    const c = care(), name = (S.settings && S.settings.name) || "Brian";
    const age = c.dob ? Math.floor(daysBetween(c.dob, today()) / 365.25) : null;
    sheet.open(`<div class="emerg">
      <a class="call911" href="tel:911">Call 911</a>
      <h3 style="margin-top:16px">${esc(name)}${age ? `, ${age}` : ""}</h3>
      ${c.address ? `<p class="cval">${esc(c.address).replace(/\n/g, "<br>")}</p>` : ""}
      <p class="small">Show this screen to the paramedics.</p>
      <h4>Allergies</h4>${c.allergies ? `<p class="cval flag">${esc(c.allergies).replace(/\n/g, "<br>")}</p>` : `<p class="cval">None recorded</p>`}
      <h4>Health conditions</h4>${para(c.conditions)}
      <h4>Medicines</h4>${(c.meds || []).length ? `<ul class="elist">${c.meds.map(m => `<li><b>${esc(m.name)}</b> ${esc(m.dose || "")}${m.when ? ` · ${esc(m.when)}` : ""}</li>`).join("")}</ul>` : `<p class="cval">None recorded</p>`}
      ${(() => { const l = S.logs.find(x => /insulin/i.test(x.name || "")); return l ? `<p class="small">Last insulin: ${esc(l.local)}${l.value ? `, ${esc(l.value)} ${esc(l.unit || "")}` : ""}</p>` : ""; })()}
      <h4>Contacts</h4>${(c.contacts || []).length ? `<ul class="elist">${c.contacts.map(p => `<li><b>${esc(p.name)}</b>${p.role ? ` (${esc(p.role)})` : ""}${p.phone ? ` · ${telLink(p.phone)}` : ""}</li>`).join("")}</ul>` : `<p class="cval">None recorded</p>`}
      ${c.other ? `<h4>Other important things</h4>${para(c.other)}` : ""}
      </div><div class="acts"><button class="pri" data-act="cancel">Close</button></div>`, () => {});
  }

  /* ---------- doctor report (last 30 days) ---------- */
  const wallMs = l => { const [d, t] = l.local.split(" "); const [y, m, dd] = d.split("-").map(Number); const [h, mi] = t.split(":").map(Number); return Date.UTC(y, m - 1, dd, h, mi); };
  function renderReport() {
    const c = care(), tk = today(), from = addDays(tk, -29), name = (S.settings && S.settings.name) || "Brian";
    const inP = l => l.local && l.local.slice(0, 10) >= from && l.local.slice(0, 10) <= tk;
    const logs = S.logs.filter(inP);
    const sections = checks().map(ch => {
      const ls = logs.filter(l => l.check === ch.id);
      // doses expected vs logged, day by day
      let expected = 0, got = 0;
      for (let k = from; k <= tk; k = addDays(k, 1)) { const n = ch.times.length; const day = ls.filter(l => l.local.startsWith(k)).length; expected += n; got += Math.min(n, day); }
      const nums = ls.map(l => parseFloat(l.value)).filter(v => !isNaN(v));
      const out = ls.filter(l => inRangeText(l.value, ch));
      const stats = nums.length ? `Average ${Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)} ${esc(ch.unit || "")} · lowest ${Math.min(...nums)} · highest ${Math.max(...nums)}${(ch.low !== "" && ch.low != null) || (ch.high !== "" && ch.high != null) ? ` · ${out.length} of ${nums.length} outside target (${esc(ch.low ?? "")}–${esc(ch.high ?? "")})` : ""}` : "";
      return `<div class="rsec"><h3>${esc(ch.name)}</h3><p>Logged ${got} of ${expected} scheduled times (${expected ? Math.round(got / expected * 100) : 0}%).${stats ? "<br>" + stats + "." : ""}</p>
        ${ch.value && nums.length ? `<svg class="chart rchart" data-rchart="${esc(ch.id)}" viewBox="0 0 700 220" width="700" height="220"></svg>` : ""}</div>`;
    }).join("");
    const dia = S.diary.filter(d => d.id >= from && d.id <= tk).sort((a, b) => a.id.localeCompare(b.id));
    const count = (f, v) => dia.filter(d => d[f] === v).length;
    const tagCounts = {}; dia.forEach(d => (d.tags || []).forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1));
    const appts = S.appts.filter(a => !a.repeat && a.date >= from && a.date <= tk && (a.outcome || a.notes)).sort((a, b) => a.date.localeCompare(b.date));
    const nextQ = S.appts.map(a => ({ ...a, date: nextDate(a.date, a.repeat, tk) })).filter(a => a.date >= tk && a.questions).sort((a, b) => a.date.localeCompare(b.date))[0];
    $("reportBody").innerHTML = `
      <h1>${esc(name)}: report for the doctor</h1>
      <p class="small">${esc(prettyDate(from).long)} to ${esc(prettyDate(tk).long)} ${esc(tk.slice(0, 4))} · made with Daybook${c.dob ? ` · born ${esc(prettyDate(c.dob).long)} ${esc(c.dob.slice(0, 4))}` : ""}</p>
      <div class="rgrid"><div class="rsec"><h3>Allergies</h3><p class="${c.allergies ? "flag" : ""}">${esc(c.allergies || "None recorded")}</p></div>
      <div class="rsec"><h3>Conditions</h3><p>${esc(c.conditions || "None recorded").replace(/\n/g, "<br>")}</p></div></div>
      <div class="rsec"><h3>Medicines</h3>${(c.meds || []).length ? `<ul class="elist">${c.meds.map(m => `<li><b>${esc(m.name)}</b> ${esc(m.dose || "")}${m.when ? ` · ${esc(m.when)}` : ""}${m.for ? ` · for ${esc(m.for)}` : ""}</li>`).join("")}</ul>` : "<p>None recorded</p>"}</div>
      ${sections || "<p>No checks set up.</p>"}
      <div class="rsec"><h3>Diary (${dia.length} days written)</h3>
        <p>${dia.length ? `Mood: good ${count("mood", "Good")}, mixed ${count("mood", "Mixed")}, hard ${count("mood", "Hard")} days. Sleep poor on ${count("sleep", "Poor")} nights. Eating poor on ${count("eating", "Poor")} days.` : "No entries."}
        ${Object.keys(tagCounts).length ? `<br>Noted: ${Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${esc(t.toLowerCase())} ${n}×`).join(", ")}.` : ""}</p>
        ${dia.filter(d => d.note).slice(-10).map(d => `<p class="rnote"><b>${esc(prettyDate(d.id).short)}</b> ${esc(d.note)}</p>`).join("")}</div>
      ${appts.length ? `<div class="rsec"><h3>Recent appointments</h3>${appts.map(a => `<p class="rnote"><b>${esc(prettyDate(a.date).short)} · ${esc(a.title)}</b>${a.outcome ? `<br>${esc(a.outcome)}` : ""}</p>`).join("")}</div>` : ""}
      ${nextQ ? `<div class="rsec"><h3>Questions for ${esc(nextQ.title)} (${esc(prettyDate(nextQ.date).long)})</h3><p>${esc(nextQ.questions).replace(/\n/g, "<br>")}</p></div>` : ""}`;
    const fromMs = (() => { const [y, m, d] = from.split("-").map(Number); return Date.UTC(y, m - 1, d); })();
    checks().forEach(ch => {
      const svg = document.querySelector(`[data-rchart="${CSS.escape(ch.id)}"]`); if (!svg) return;
      const pts = S.logs.filter(l => l.check === ch.id && inP(l) && !isNaN(parseFloat(l.value))).map(l => ({ t: wallMs(l), v: parseFloat(l.value), label: l.local }));
      drawReadings(svg, pts, { low: ch.low, high: ch.high, unit: ch.unit, fromMs, toMs: fromMs + 30 * 864e5 });
    });
  }
  $("printReport").addEventListener("click", () => printAs("printing-report"));
  $("copyReport").addEventListener("click", () => copyText($("reportBody").innerText, "reportMsg"));

  /* ---------- backup ---------- */
  async function backup() {
    const data = { app: "Daybook", made: new Date().toISOString(), by: me(), settings: S.settings, appts: S.appts, logs: S.logs, todos: S.todos, notes: S.notes, diary: S.diary, care: S.care, photos: S.photos, family: S.family };
    const name = `daybook-backup-${today()}.json`, file = new File([JSON.stringify(data, null, 1)], name, { type: "application/json" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: "Daybook backup" });
      else { const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
      D.saveSettings({ name: "Brian", checks: [], ...(S.settings || {}), lastBackup: new Date().toISOString(), lastBackupBy: me() });
      toast("Backup saved");
    } catch (e) { if (e && e.name !== "AbortError") toast("Backup didn't work. Try again."); }
  }
  $("backupBtn").addEventListener("click", backup);
  function renderBackup() {
    const lb = S.settings && S.settings.lastBackup;
    $("backupInfo").textContent = lb ? `Last backup ${ago(Date.now() - new Date(lb))}${S.settings.lastBackupBy ? " by " + S.settings.lastBackupBy : ""}.` : "No backup made yet.";
    const due = !lb || Date.now() - new Date(lb) > 30 * 864e5;
    $("ovBackup").hidden = !due || !(S.logs.length || S.notes.length || S.diary.length);
  }

  /* ---------- clicks ---------- */
  document.addEventListener("click", ev => {
    const b = ev.target.closest("button"); if (!b) return; const d = b.dataset;
    if (d.dfield) { const cur = entry(diaryDate)[d.dfield]; saveDiary({ [d.dfield]: cur === d.dval ? "" : d.dval }); renderDiary(); }
    else if (d.dtag) { const tags = new Set(entry(diaryDate).tags || []); tags.has(d.dtag) ? tags.delete(d.dtag) : tags.add(d.dtag); saveDiary({ tags: [...tags] }); renderDiary(); }
    else if (d.dopen) { diaryDate = d.dopen; if (d.gotab) goTab("diary"); renderDiary(); window.scrollTo(0, 0); }
    else if (d.nedit) noteSheet(d.nedit);
    else if (d.photo) photoSheet(d.photo);
    else if (d.unphoto !== undefined) { pending.splice(+d.unphoto, 1); renderPending(); }
    else if (d.npin) { const n = S.notes.find(x => x.id === d.npin); if (n) saveNote({ ...n, pinned: !n.pinned }); }
    else if (d.ndone) { const n = S.notes.find(x => x.id === d.ndone); if (n) { saveNote({ ...n, done: true, pinned: false }); toast("Note marked done"); } }
    else if (d.nundo) { const n = S.notes.find(x => x.id === d.nundo); if (n) saveNote({ ...n, done: false }); }
    else if (d.cedit) careText(d.cedit);
    else if (d.cabout) careAbout();
    else if (d.cmed !== undefined) careItem("meds", d.cmed);
    else if (d.ccon !== undefined) careItem("contacts", d.ccon);
    else if (d.emergency) openEmergency();
    else if (d.report) { goTab("report"); renderReport(); }
  });
  document.addEventListener("input", ev => {
    if (ev.target.id !== "dNote") return;
    clearTimeout(dT); const v = ev.target.value;
    dT = setTimeout(() => { saveDiary({ note: v }); const s = $("dSaved"); if (s) s.textContent = "Saved."; }, 700);
  });
  document.addEventListener("change", ev => { if (ev.target.id === "dDate" && ev.target.value) { diaryDate = ev.target.value > today() ? today() : ev.target.value; renderDiary(); } });
  $("copyDiary").addEventListener("click", () => {
    const tk = today();
    const lines = S.diary.filter(d => { const n = daysBetween(d.id, tk); return n >= 0 && n < 30; }).sort((a, b) => a.id.localeCompare(b.id)).map(d => `${d.id}  ${diaryLine(d)}`);
    copyText(`Brian's diary, last 30 days\n` + (lines.join("\n") || "No entries."), "diaryMsg");
  });

  return { renderNotes, renderTodayNotes, renderDiary, renderTodayDiary, renderCare, renderTodayStock, renderBackup, renderReport, care };
}

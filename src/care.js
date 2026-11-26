// Deborah's notes, daily diary and care info sheet.
import { emptyPanda } from "./panda.js";
import { $, esc, prettyDate, relDay, ago, addDays, daysBetween, copyText, val } from "./util.js";

export function initCare({ S, D, sheet, toast, me, today }) {
  /* ---------- quick notes ---------- */
  const noteCard = n => `<div class="note ${n.pinned ? "pinned" : ""} ${n.done ? "done" : ""}">
    <div class="ntext">${esc(n.text).replace(/\n/g, "<br>")}</div>
    <div class="nmeta">${n.pinned ? "📌 Pinned · " : ""}${esc(n.by || "")}${n.updated ? " · " + esc(ago(Date.now() - new Date(n.updated))) : ""}</div>
    <div class="nact">${n.done ? `<button class="link" data-nundo="${esc(n.id)}">Put back</button>` : `<button class="link" data-npin="${esc(n.id)}">${n.pinned ? "Unpin" : "Pin"}</button><button class="link" data-ndone="${esc(n.id)}">Done</button>`}<button class="link" data-nedit="${esc(n.id)}">Edit</button></div></div>`;
  const sortNotes = (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updated || "").localeCompare(a.updated || "");
  function renderNotes() {
    const open = S.notes.filter(n => !n.done).sort(sortNotes), done = S.notes.filter(n => n.done).sort(sortNotes).slice(0, 40);
    $("noteList").innerHTML = open.length ? open.map(noteCard).join("") : emptyPanda("No notes yet. Write one above.");
    $("noteDoneSum").textContent = `Done (${done.length})`;
    $("noteDone").innerHTML = done.map(noteCard).join("");
  }
  function renderTodayNotes() {
    const pinned = S.notes.filter(n => n.pinned && !n.done).sort(sortNotes);
    $("ovNotes").innerHTML = pinned.length ? `<div class="notes">${pinned.map(noteCard).join("")}</div>` : emptyPanda("Nothing pinned. Pin a note to keep it here.");
  }
  const saveNote = n => D.saveDoc("notes", { ...n, updated: new Date().toISOString() });
  function noteSheet(id) {
    const n = S.notes.find(x => x.id === id); if (!n) return;
    sheet.open(`<h3>Edit note</h3><textarea id="nT" rows="6">${esc(n.text)}</textarea>
      <label class="inline"><input type="checkbox" id="nP" ${n.pinned ? "checked" : ""}> Pin to Today</label>
      <div class="acts"><button data-act="delete">Delete</button><button data-act="cancel">Cancel</button><button class="pri" data-act="save">Save</button></div>`, mode => {
      if (mode === "delete") { D.removeDoc("notes", id); return toast("Note deleted"); }
      if (!val("nT")) { sheet.msg("The note is empty."); return false; }
      saveNote({ ...n, text: val("nT"), pinned: $("nP").checked });
    });
  }
  $("noteForm").addEventListener("submit", e => {
    e.preventDefault(); const text = val("noteIn"); if (!text) return;
    saveNote({ id: D.newId(), text, pinned: $("notePin").checked, done: false, by: me(), created: new Date().toISOString() });
    $("noteIn").value = ""; $("notePin").checked = false; toast("Note added");
  });

  /* ---------- daily diary ---------- */
  const MOOD = ["Good", "Mixed", "Hard"], LEVEL = ["Good", "OK", "Poor"];
  const TAGS = ["Confused", "Anxious", "Tired", "Low", "Restless", "Fall", "Wandered", "Good day out", "Visitors"];
  let diaryDate = null;
  const entry = k => S.diary.find(d => d.id === k) || { id: k, date: k, mood: "", sleep: "", eating: "", tags: [], note: "" };
  const chips = (field, opts, cur) => `<div class="chips" role="group" aria-label="${field}">${opts.map(o => `<button data-dfield="${field}" data-dval="${esc(o)}" aria-pressed="${cur === o}">${esc(o)}</button>`).join("")}</div>`;
  function renderDiary() {
    const tk = today(); if (!diaryDate) diaryDate = tk;
    const ae = document.activeElement; if (ae && ae.id === "dNote") return; // don't redraw while she's typing
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
    S.diary = S.diary.filter(x => x.id !== e.id).concat(e); // show it straight away
    D.saveDoc("diary", e);
  };
  document.addEventListener("click", ev => {
    const b = ev.target.closest("button"); if (!b) return; const d = b.dataset;
    if (d.dfield) { const cur = entry(diaryDate)[d.dfield]; saveDiary({ [d.dfield]: cur === d.dval ? "" : d.dval }); renderDiary(); }
    else if (d.dtag) { const tags = new Set(entry(diaryDate).tags || []); tags.has(d.dtag) ? tags.delete(d.dtag) : tags.add(d.dtag); saveDiary({ tags: [...tags] }); renderDiary(); }
    else if (d.dopen) { diaryDate = d.dopen; renderDiary(); window.scrollTo(0, 0); }
    else if (d.nedit) noteSheet(d.nedit);
    else if (d.npin) { const n = S.notes.find(x => x.id === d.npin); if (n) saveNote({ ...n, pinned: !n.pinned }); }
    else if (d.ndone) { const n = S.notes.find(x => x.id === d.ndone); if (n) { saveNote({ ...n, done: true, pinned: false }); toast("Note marked done"); } }
    else if (d.nundo) { const n = S.notes.find(x => x.id === d.nundo); if (n) saveNote({ ...n, done: false }); }
    else if (d.cedit) careText(d.cedit);
    else if (d.cmed !== undefined) careItem("meds", d.cmed);
    else if (d.ccon !== undefined) careItem("contacts", d.ccon);
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

  /* ---------- care info sheet ---------- */
  const care = () => S.care.find(c => c.id === "main") || { id: "main", conditions: "", allergies: "", insurance: "", other: "", meds: [], contacts: [] };
  const saveCare = patch => D.saveDoc("care", { ...care(), ...patch, by: me(), updated: new Date().toISOString() });
  const TEXT = { conditions: ["Health conditions", "Diabetes (type 2), early dementia…"], allergies: ["Allergies", "Medicines or foods he must not have"], insurance: ["Insurance and ID numbers", "Medicare number, insurance plan, pharmacy…"], other: ["Other important things", "Routines, what calms him, care wishes, door codes…"] };
  const para = t => t ? `<p class="cval">${esc(t).replace(/\n/g, "<br>")}</p>` : `<p class="empty">Not filled in yet.</p>`;
  const telLink = p => { const n = String(p || "").replace(/[^\d+]/g, ""); return n ? `<a href="tel:${esc(n)}">${esc(p)}</a>` : esc(p || ""); };
  function renderCare() {
    const c = care();
    const sec = (k, extraClass = "") => `<div class="csec ${extraClass}"><div class="chd"><h2>${TEXT[k][0]}</h2><button class="link noprint" data-cedit="${k}">Edit</button></div>${para(c[k])}</div>`;
    $("careSheet").innerHTML = `
      <div class="printhead"><h1>Brian: care information</h1><p class="small">Printed from Daybook${c.updated ? `, last updated ${esc(new Date(c.updated).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))}` : ""}.</p></div>
      ${sec("allergies", c.allergies ? "alert" : "")}
      ${sec("conditions")}
      <div class="csec"><div class="chd"><h2>Medicines</h2><button class="link noprint" data-cmed="">Add</button></div>
        ${c.meds && c.meds.length ? `<table class="stack ctable"><thead><tr><th>Medicine</th><th>Dose</th><th>When</th><th>What for</th><th class="noprint"></th></tr></thead><tbody>${c.meds.map((m, i) => `<tr><td data-l="Medicine"><b>${esc(m.name)}</b></td><td data-l="Dose">${esc(m.dose)}</td><td data-l="When">${esc(m.when)}</td><td data-l="What for">${esc(m.for)}</td><td class="noprint"><button class="link" data-cmed="${i}">Edit</button></td></tr>`).join("")}</tbody></table>` : emptyPanda("No medicines added yet.")}</div>
      <div class="csec"><div class="chd"><h2>Doctors and contacts</h2><button class="link noprint" data-ccon="">Add</button></div>
        ${c.contacts && c.contacts.length ? c.contacts.map((p, i) => `<div class="item"><div><div class="t" style="font-size:19px">${esc(p.name)}${p.role ? ` <span class="small">· ${esc(p.role)}</span>` : ""}</div>
          <div class="s">${[p.phone ? telLink(p.phone) : "", p.email ? esc(p.email) : "", p.address ? esc(p.address) : ""].filter(Boolean).join(" · ")}</div></div><button class="link noprint" data-ccon="${i}">Edit</button></div>`).join("") : emptyPanda("No contacts added yet.")}</div>
      ${sec("insurance")}
      ${sec("other")}
      ${c.updated ? `<p class="small noprint">Last updated ${esc(ago(Date.now() - new Date(c.updated)))}${c.by ? " by " + esc(c.by) : ""}.</p>` : ""}`;
  }
  function careText(k) {
    sheet.open(`<h3>${TEXT[k][0]}</h3><textarea id="cTxt" rows="7" placeholder="${esc(TEXT[k][1])}">${esc(care()[k] || "")}</textarea>
      <div class="acts"><button data-act="cancel">Cancel</button><button class="pri" data-act="save">Save</button></div>`, () => { saveCare({ [k]: $("cTxt").value.trim() }); toast("Saved"); });
  }
  function careItem(kind, idx) {
    const list = [...(care()[kind] || [])], i = idx === "" ? -1 : +idx, cur = i >= 0 ? list[i] : {};
    const F = kind === "meds" ? [["name", "Medicine", "Metformin"], ["dose", "Dose", "500 mg"], ["when", "When", "Morning and evening"], ["for", "What for", "Blood sugar"]]
      : [["name", "Name", "Dr Patel"], ["role", "Who they are", "GP, diabetes nurse, pharmacy…"], ["phone", "Phone", "(503) 555-0100"], ["email", "Email", ""], ["address", "Address", ""]];
    sheet.open(`<h3>${i >= 0 ? "Edit" : "Add"} ${kind === "meds" ? "medicine" : "contact"}</h3>
      ${F.map(([f, l, ph]) => `<label for="ci-${f}">${l}</label><input id="ci-${f}" value="${esc(cur[f] || "")}" placeholder="${esc(ph)}" ${f === "phone" ? 'type="tel"' : f === "email" ? 'type="email"' : ""}>`).join("")}
      <div class="acts">${i >= 0 ? `<button data-act="delete">Delete</button>` : ""}<button data-act="cancel">Cancel</button><button class="pri" data-act="save">Save</button></div>`, mode => {
      if (mode === "delete") { list.splice(i, 1); saveCare({ [kind]: list }); return toast("Deleted"); }
      const item = Object.fromEntries(F.map(([f]) => [f, val("ci-" + f)]));
      if (!item.name) { sheet.msg("Add a name."); return false; }
      if (i >= 0) list[i] = item; else list.push(item);
      saveCare({ [kind]: list }); toast("Saved");
    });
  }
  $("printCare").addEventListener("click", () => { document.body.classList.add("printing-care"); try { window.print(); } finally { setTimeout(() => document.body.classList.remove("printing-care"), 500); } });

  return { renderNotes, renderTodayNotes, renderDiary, renderTodayDiary, renderCare };
}

export const $ = id => document.getElementById(id);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const pad = n => String(n).padStart(2, "0");
export const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
export const MON = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const mins = s => { const [h, m] = String(s).split(":").map(Number); return h * 60 + (m || 0); };
export const fmt12 = s => { const m = mins(s), h = Math.floor(m / 60), mm = m % 60; return `${(h % 12) || 12}:${pad(mm)} ${h < 12 ? "am" : "pm"}`; };

// "Wall clock" in a time zone (or the device's own when tz is empty)
export function wall(tz, d = new Date()) {
  if (!tz) return { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), wd: d.getDay() };
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", weekday: "short", hourCycle: "h23" }).formatToParts(d).map(x => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, wd: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(p.weekday) };
}
// Real moment for a wall-clock time in a time zone
export function zonedToDate(tz, y, mo, d, h, mi) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const off = dt => { const w = wall(tz, new Date(dt)); return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi) - dt; };
  let t = guess - off(guess); t = guess - off(t);
  return new Date(t);
}
export const dayKey = w => `${w.y}-${pad(w.mo)}-${pad(w.d)}`;
export const hmOf = w => `${pad(w.h)}:${pad(w.mi)}`;
export const daysBetween = (a, b) => Math.round((Date.UTC(...b.split("-").map((x, i) => i === 1 ? x - 1 : +x)) - Date.UTC(...a.split("-").map((x, i) => i === 1 ? x - 1 : +x))) / 864e5);
export const relDay = (todayKey, key) => { const n = daysBetween(todayKey, key); return n === 0 ? "Today" : n === 1 ? "Tomorrow" : n === -1 ? "Yesterday" : n > 1 ? `In ${n} days` : `${-n} days ago`; };
export const prettyDate = key => { const [y, m, d] = key.split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); return { day: DAYS[dt.getUTCDay()], short: `${d} ${MON[m - 1].slice(0, 3)}`, long: `${DAYS[dt.getUTCDay()]} ${d} ${MON[m - 1]}` }; };
export const ago = ms => { const m = Math.round(ms / 60000); if (m < 1) return "just now"; if (m < 60) return `${m} min ago`; const h = Math.floor(m / 60), r = m % 60; if (h < 24) return `${h} h ${r ? r + " min " : ""}ago`; const d = Math.floor(h / 24); return d === 1 ? "yesterday" : `${d} days ago`; };

// Match a day's logs to the scheduled times (within 2 hours). nowMin = minutes past midnight.
export function slotsFor(check, dayLogs, nowMin) {
  const logs = dayLogs.filter(l => l.check === check.id).map(l => ({ l, m: mins(l.local.slice(11)), used: false }));
  return [...check.times].sort().map(t => {
    const sm = mins(t); let best = null;
    for (const x of logs) { if (x.used) continue; const dd = Math.abs(x.m - sm); if (dd <= 120 && (!best || dd < Math.abs(best.m - sm))) best = x; }
    if (best) { best.used = true; return { t, st: "done", log: best.l }; }
    if (nowMin >= sm - 30 && nowMin <= sm + 120) return { t, st: "due" };
    if (nowMin > sm + 120) return { t, st: "missed" };
    return { t, st: "later" };
  });
}
export const valueText = (l, unit) => (l.value !== "" && l.value != null) ? `${l.value} ${unit || l.unit || ""}`.trim() : "";

// Shared in-page sheet (dialog)
export function makeSheet() {
  let onSave = null;
  const ov = $("ov"), sheet = $("sheet");
  const close = () => { ov.classList.remove("on"); onSave = null; };
  ov.addEventListener("click", e => {
    const act = e.target.dataset && e.target.dataset.act;
    if (e.target === ov || act === "cancel") close();
    else if (act === "save" && onSave) { if (onSave() !== false) close(); }
    else if (act === "delete" && onSave) {
      if (e.target.textContent !== "Tap again to delete") { e.target.textContent = "Tap again to delete"; return; }
      onSave("delete"); close();
    }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && ov.classList.contains("on")) close(); });
  return {
    open(html, save) { const t = document.getElementById("toast"); if (t) t.classList.remove("on"); sheet.innerHTML = html; onSave = save; ov.classList.add("on"); const f = sheet.querySelector("input,textarea,select"); if (f) f.focus(); },
    isOpen: () => ov.classList.contains("on"),
    msg(text) { let w = sheet.querySelector(".warn.msg"); if (!w) { w = document.createElement("div"); w.className = "warn msg"; sheet.querySelector("h3").after(w); } w.textContent = text; }
  };
}
export const val = id => $(id).value.trim();
export async function copyText(text, msgEl) {
  try { await navigator.clipboard.writeText(text); $(msgEl).textContent = "Copied."; }
  catch { $(msgEl).textContent = "Couldn't copy on this device."; }
}

// Light / dark / auto switch (remembered on this device)
export function themeSwitch() {
  const get = () => { try { return localStorage.getItem("daybook-theme") || "auto"; } catch { return "auto"; } };
  const apply = t => {
    if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    document.querySelectorAll("[data-theme-set]").forEach(b => b.setAttribute("aria-pressed", b.dataset.themeSet === t ? "true" : "false"));
  };
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-theme-set]"); if (!b) return;
    try { localStorage.setItem("daybook-theme", b.dataset.themeSet); } catch {}
    apply(b.dataset.themeSet);
  });
  apply(get());
}

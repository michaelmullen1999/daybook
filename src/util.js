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

/* ---------- repeats ---------- */
export const addDays = (key, n) => { const [y, m, d] = key.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
export const weekdayOf = key => { const [y, m, d] = key.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
// Next date after `key` for a repeat. Monthly keeps the original day of the month (clamped for short months).
export function stepRepeat(key, rep, anchorDay) {
  if (rep === "daily") return addDays(key, 1);
  if (rep === "weekly") return addDays(key, 7);
  if (rep === "2weeks") return addDays(key, 14);
  if (rep === "monthly") {
    const [y, m] = key.split("-").map(Number), d0 = anchorDay || +key.slice(8);
    const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
    const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
    return `${ny}-${pad(nm)}-${pad(Math.min(d0, last))}`;
  }
  return null;
}
// First date on or after `fromKey` (the item's own date if it isn't repeating).
export function nextDate(startKey, rep, fromKey) {
  if (!rep || !startKey) return startKey;
  let k = startKey; const a = +startKey.slice(8);
  for (let i = 0; i < 2000 && k < fromKey; i++) k = stepRepeat(k, rep, a);
  return k;
}
export function occurrences(startKey, rep, fromKey, toKey) {
  const out = []; if (!startKey) return out;
  if (!rep) return startKey >= fromKey && startKey <= toKey ? [startKey] : out;
  let k = nextDate(startKey, rep, fromKey); const a = +startKey.slice(8);
  for (let i = 0; i < 400 && k <= toKey; i++) { out.push(k); k = stepRepeat(k, rep, a); }
  return out;
}
const ORD = n => n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");
export function repeatLabel(rep, key) {
  if (!rep || !key) return "";
  const wd = DAYS[weekdayOf(key)];
  return rep === "daily" ? "Every day" : rep === "weekly" ? `Every ${wd}` : rep === "2weeks" ? `Every other ${wd}` : rep === "monthly" ? `Every month on the ${ORD(+key.slice(8))}` : "";
}
export const REPEAT_OPTIONS = (withDaily, cur) => [["", "Doesn't repeat"], ...(withDaily ? [["daily", "Every day"]] : []), ["weekly", "Every week"], ["2weeks", "Every 2 weeks"], ["monthly", "Every month"]]
  .map(([v, t]) => `<option value="${v}" ${v === (cur || "") ? "selected" : ""}>${t}</option>`).join("");
// Tick a to-do: repeating ones move to their next date instead of being finished.
export function tickTodo(t, checked, todayKey) {
  if (checked && t.repeat) {
    const base = t.due || todayKey;
    let next = stepRepeat(base, t.repeat, +base.slice(8));
    while (next <= todayKey) next = stepRepeat(next, t.repeat, +base.slice(8));
    return { todo: { ...t, due: next, lastDone: new Date().toISOString(), done: false }, next };
  }
  return { todo: { ...t, done: checked, doneAt: checked ? new Date().toISOString() : null }, next: null };
}

/* ---------- readings chart ---------- */
// points: [{t: ms, v: number, label}], range: {low, high} (optional). Draws into an <svg> at its real size.
export function drawReadings(svg, points, { low, high, unit, fromMs, toMs }) {
  const W = svg.clientWidth || 600, H = svg.clientHeight || 260, narrow = W < 520;
  const padL = 44, padR = 12, padT = 14, padB = 30;
  const vals = points.map(p => p.v).concat([low, high].filter(x => x != null && x !== ""));
  let lo = Math.min(...vals, Infinity), hi = Math.max(...vals, -Infinity);
  if (!isFinite(lo)) { lo = 0; hi = 1; }
  const span = Math.max(hi - lo, 10); lo = Math.max(0, lo - span * 0.15); hi = hi + span * 0.15;
  const x = t => padL + (t - fromMs) / (toMs - fromMs) * (W - padL - padR);
  const y = v => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const step = (() => { const raw = (hi - lo) / (narrow ? 3 : 5); const p = 10 ** Math.floor(Math.log10(raw)); return [1, 2, 5, 10].map(m => m * p).find(s => s >= raw) || raw; })();
  let g = "";
  if (low !== "" && low != null && high !== "" && high != null) g += `<rect x="${padL}" y="${y(+high)}" width="${W - padL - padR}" height="${Math.max(0, y(+low) - y(+high))}" class="band"/>`;
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) g += `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end" class="ax">${Math.round(v)}</text>`;
  const days = Math.round((toMs - fromMs) / 864e5), every = narrow ? (days > 7 ? 4 : 2) : (days > 7 ? 2 : 1);
  for (let i = 0; i < days; i += every) { const t = fromMs + i * 864e5, dd = new Date(t); g += `<text x="${x(t + 432e5)}" y="${H - 8}" text-anchor="middle" class="ax">${DAYS[dd.getUTCDay()].slice(0, 3)} ${dd.getUTCDate()}</text>`; }
  const pts = points.filter(p => p.t >= fromMs && p.t <= toMs).sort((a, b) => a.t - b.t);
  if (pts.length > 1) g += `<polyline class="ln" points="${pts.map(p => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")}"/>`;
  const out = p => (low !== "" && low != null && p.v < +low) || (high !== "" && high != null && p.v > +high);
  g += pts.map(p => `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${out(p) ? 6 : 4.5}" class="${out(p) ? "pt out" : "pt"}"><title>${esc(p.label)}</title></circle>`).join("");
  if (!pts.length) g += `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="ax">No readings yet</text>`;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = g;
}
export const inRangeText = (v, c) => {
  const n = parseFloat(v); if (isNaN(n)) return "";
  if (c.low !== "" && c.low != null && n < +c.low) return "below target";
  if (c.high !== "" && c.high != null && n > +c.high) return "above target";
  return "";
};

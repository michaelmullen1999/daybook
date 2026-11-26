// Reminder sender. GitHub runs this every 5 minutes (see .github/workflows/reminders.yml).
// It reads Daybook's data with a private key (the FIREBASE_SA secret) and sends push reminders
// to every device that turned reminders on. Each reminder is sent once (remembered in reminderState/sent).
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { wall, dayKey, mins, fmt12, slotsFor, occurrences, addDays, daysBetween } from "../src/util.js";

const TZ = "America/Los_Angeles"; // Portland
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SA)) });
const db = getFirestore();
const all = async c => (await db.collection(c).get()).docs.map(d => ({ id: d.id, ...d.data() }));

const w = wall(TZ), tk = dayKey(w), nm = w.h * 60 + w.mi, tomorrow = addDays(tk, 1);
const [settingsDoc, appts, logs, tokens, diary, careDocs, stateDoc] = await Promise.all([
  db.doc("settings/main").get(), all("appts"),
  db.collection("logs").where("at", ">=", new Date(Date.now() - 2 * 864e5).toISOString()).get().then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
  all("pushTokens"), all("diary"), all("care"), db.doc("reminderState/sent").get()
]);
const settings = settingsDoc.exists ? settingsDoc.data() : {}, name = settings.name || "Brian";
const sent = stateDoc.exists ? (stateDoc.data().keys || {}) : {};
const out = [];
const remind = (key, title, body, tag) => { if (!sent[key]) out.push({ key, title, body, tag: tag || key }); };

// 1. Pills, insulin and readings: at the time, and a second nudge an hour later if still not logged
const dayLogs = logs.filter(l => (l.local || "").startsWith(tk));
for (const c of settings.checks || []) {
  const slots = slotsFor(c, dayLogs, nm);
  for (const s of slots) {
    if (s.st === "done") continue;
    const sm = mins(s.t);
    if (nm >= sm && nm < sm + 60) remind(`c|${c.id}|${tk}|${s.t}`, c.name, `Time for ${name}'s ${c.name.toLowerCase()} (${fmt12(s.t)}). Tap to log it.`, `c|${c.id}|${s.t}`);
    if (nm >= sm + 60 && nm < sm + 150) remind(`c2|${c.id}|${tk}|${s.t}`, `Not logged yet: ${c.name}`, `${name}'s ${c.name.toLowerCase()} for ${fmt12(s.t)} hasn't been logged.`, `c|${c.id}|${s.t}`);
  }
}
// 2. Appointments: 6 pm the evening before, and 2 hours before (8 am on the day if there's no time)
for (const a of appts) for (const d of occurrences(a.date, a.repeat, tk, tomorrow)) {
  const label = `${a.title}${a.time ? " at " + fmt12(a.time) : ""}${a.where ? ", " + a.where : ""}${a.with ? " (with " + a.with + ")" : ""}`;
  if (d === tomorrow && nm >= 18 * 60 && nm < 21 * 60) remind(`a-eve|${a.id}|${d}`, "Tomorrow", label + (a.questions ? " · Questions are ready in Daybook." : ""));
  if (d === tk) {
    const at = a.time ? mins(a.time) - 120 : 8 * 60;
    if (nm >= at && nm < at + 90) remind(`a-day|${a.id}|${d}`, a.time ? "In 2 hours" : "Today", label);
  }
}
// 3. Medicine running low: once a day around 9 am
const meds = ((careDocs.find(c => c.id === "main") || {}).meds) || [];
if (nm >= 9 * 60 && nm < 11 * 60) for (const m of meds) {
  const st = parseFloat(m.stock), pd = parseFloat(m.perDay);
  if (isNaN(st) || isNaN(pd) || pd <= 0 || !m.stockDate) continue;
  const days = Math.floor(Math.max(0, st - pd * Math.max(0, daysBetween(m.stockDate, tk))) / pd);
  if (days <= (parseFloat(m.warnDays) || 7)) remind(`s|${m.name}|${tk}`, `Running low: ${m.name}`, days <= 0 ? "It may have run out. Time to reorder." : `About ${days} day${days === 1 ? "" : "s"} left. Time to reorder.`);
}
// 4. Diary: 8 pm if nothing written today
if (nm >= 20 * 60 && nm < 22 * 60 && !diary.find(d => d.id === tk)) remind(`d|${tk}`, `How was ${name} today?`, "Add a quick line to the diary.");

console.log(`${tk} ${String(w.h).padStart(2, "0")}:${String(w.mi).padStart(2, "0")} Portland · ${out.length} to send · ${tokens.length} device(s)`);
if (out.length && tokens.length) {
  for (const r of out) {
    const res = await getMessaging().sendEachForMulticast({
      tokens: tokens.map(t => t.token),
      webpush: { headers: { Urgency: "high", TTL: "7200" }, data: { title: r.title, body: r.body, tag: r.tag, url: "./" } }
    });
    res.responses.forEach((x, i) => {
      if (!x.success && /registration-token-not-registered|invalid-argument|invalid-registration-token/.test(x.error?.code || "")) db.doc(`pushTokens/${tokens[i].id}`).delete().catch(() => {});
    });
    console.log(`  sent "${r.title}" to ${res.successCount}/${tokens.length}`);
    sent[r.key] = new Date().toISOString();
  }
}
// forget keys older than 4 days
for (const [k, v] of Object.entries(sent)) if (Date.now() - new Date(v) > 4 * 864e5) delete sent[k];
if (out.length && tokens.length) await db.doc("reminderState/sent").set({ keys: sent, updated: new Date().toISOString() });
process.exit(0);

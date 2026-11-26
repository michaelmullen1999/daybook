// Shared data layer (Firebase). Both Brian's app and the family page use this.
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously, signOut as fbSignOut, GoogleAuthProvider,
         signInWithPopup, signInWithRedirect, getRedirectResult,
         setPersistence, indexedDBLocalPersistence, browserLocalPersistence } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager,
         collection, doc, setDoc, getDoc, deleteDoc, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { firebaseConfig } from "./config.js";

export const configured = !String(firebaseConfig.apiKey).includes("PASTE_HERE");
let app, auth, db;
if (configured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  setPersistence(auth, indexedDBLocalPersistence).catch(() => setPersistence(auth, browserLocalPersistence).catch(() => {}));
  try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }) }); }
  catch (e) { db = initializeFirestore(app, {}); }
}

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
export function onUser(cb) { if (!configured) { cb(null); return () => {}; } return onAuthStateChanged(auth, cb); }
export const signInAnon = () => signInAnonymously(auth);
export async function signInGoogle() {
  const p = new GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
  try { await signInWithPopup(auth, p); }
  catch (e) { if (String(e.code).includes("popup")) await signInWithRedirect(auth, p); else throw e; }
}
if (configured) getRedirectResult(auth).catch(() => {});
export const signOut = () => fbSignOut(auth);

// watch("settings"|"appts"|"logs"|"hobbies"|"todos"|"devices"|"family", cb, onError) -> unsubscribe
export function watch(name, cb, onError) {
  let q;
  if (name === "settings") {
    return onSnapshot(doc(db, "settings", "main"), s => cb(s.exists() ? s.data() : null), onError);
  }
  if (name === "logs") {
    const since = new Date(Date.now() - 45 * 864e5).toISOString();
    q = query(collection(db, "logs"), where("at", ">=", since), orderBy("at", "desc"));
  } else {
    q = collection(db, name);
  }
  return onSnapshot(q, { includeMetadataChanges: false }, s =>
    cb(s.docs.map(d => ({ ...d.data(), id: d.id, pending: d.metadata.hasPendingWrites }))), onError);
}

// Writes are not awaited for the server, so they work offline and sync later.
const put = (col, obj) => { const { id, pending, ...rest } = obj; return setDoc(doc(db, col, id), rest); };
const quiet = p => { p.catch(err => console.error(err)); };
export const saveSettings = obj => quiet(setDoc(doc(db, "settings", "main"), obj));
export const addLog      = obj => quiet(put("logs", obj));
export const deleteLog   = id  => quiet(deleteDoc(doc(db, "logs", id)));
export const saveAppt    = obj => quiet(put("appts", obj));
export const deleteAppt  = id  => quiet(deleteDoc(doc(db, "appts", id)));
export const saveHobby   = obj => quiet(put("hobbies", obj));
export const deleteHobby = id  => quiet(deleteDoc(doc(db, "hobbies", id)));
export const saveTodo    = obj => quiet(put("todos", obj));
export const deleteTodo  = id  => quiet(deleteDoc(doc(db, "todos", id)));

// Device pairing
export const createPairing = (code, uid) => setDoc(doc(db, "pairing", code), { uid, created: new Date().toISOString() });
export const watchDevice = (uid, cb) => onSnapshot(doc(db, "devices", uid), s => cb(s.exists()), () => cb(false));
export async function connectDevice(code, name, by) {
  const s = await getDoc(doc(db, "pairing", code));
  if (!s.exists()) return false;
  const { uid } = s.data();
  await setDoc(doc(db, "devices", uid), { name, by, added: new Date().toISOString() });
  await deleteDoc(doc(db, "pairing", code)).catch(() => {});
  return true;
}
export const removeDevice = uid => quiet(deleteDoc(doc(db, "devices", uid)));
export const addFamily = (email, by) => quiet(setDoc(doc(db, "family", email.trim().toLowerCase()), { by, added: new Date().toISOString() }));
export const removeFamily = email => quiet(deleteDoc(doc(db, "family", email)));
// Generic documents (notes, diary, care sheet)
export const saveDoc = (col, obj) => quiet(put(col, obj));
export const removeDoc = (col, id) => quiet(deleteDoc(doc(db, col, id)));

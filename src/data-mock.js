// In-browser stand-in for Firebase, used only for local testing (npm run build -- --mock).
const KEY = "daybook-mock";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
const S = load() || { settings: null, appts: [], logs: [], hobbies: [], todos: [], devices: [], family: [] };
const subs = { settings: [], appts: [], logs: [], hobbies: [], todos: [], devices: [], family: [] };
const emit = n => { localStorage.setItem(KEY, JSON.stringify(S)); subs[n].forEach(f => f(n === "logs" ? [...S.logs].sort((a, b) => b.at.localeCompare(a.at)) : S[n])); };
export const configured = true;
export const newId = () => Math.random().toString(36).slice(2, 12);
export function onUser(cb) { setTimeout(() => cb({ uid: "mock", email: "nicole@example.com", displayName: "Nicole Test" }), 0); return () => {}; }
export const signInAnon = async () => {}; export const signInGoogle = async () => {}; export const signOut = async () => {};
export function watch(n, cb) { subs[n].push(cb); setTimeout(() => emit(n), 0); return () => {}; }
const up = (n, o) => { S[n] = S[n].filter(x => x.id !== o.id).concat(o); emit(n); };
const del = (n, id) => { S[n] = S[n].filter(x => x.id !== id); emit(n); };
export const saveSettings = o => { S.settings = o; emit("settings"); };
export const addLog = o => up("logs", o); export const deleteLog = id => del("logs", id);
export const saveAppt = o => up("appts", o); export const deleteAppt = id => del("appts", id);
export const saveHobby = o => up("hobbies", o); export const deleteHobby = id => del("hobbies", id);
export const saveTodo = o => up("todos", o); export const deleteTodo = id => del("todos", id);
export const createPairing = async () => {}; export const watchDevice = (uid, cb) => { setTimeout(() => cb(true), 0); return () => {}; };
export const connectDevice = async (code, name, by) => { up("devices", { id: "dev-" + code, name, by, added: new Date().toISOString() }); return true; };
export const removeDevice = id => del("devices", id);
export const addFamily = (email, by) => up("family", { id: email.toLowerCase(), by }); export const removeFamily = id => del("family", id);

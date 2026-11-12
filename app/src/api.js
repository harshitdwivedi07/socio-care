import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const BASE = process.env.EXPO_PUBLIC_API_URL;
// Phones: encrypted OS storage. Web: localStorage (less safe; keep the site XSS-free and HTTPS-only).
const store = Platform.OS === 'web'
  ? { get: async (k) => localStorage.getItem(k), set: async (k, v) => localStorage.setItem(k, v), del: async (k) => localStorage.removeItem(k) }
  : { get: SecureStore.getItemAsync, set: SecureStore.setItemAsync, del: SecureStore.deleteItemAsync };

export const kv = store;
let tokens = null;
let lost = () => {};
export const onLost = (fn) => { lost = fn; };
export async function loadTokens() {
  try { tokens = JSON.parse((await store.get('tokens')) || 'null'); } catch { tokens = null; }
  return !!tokens;
}
async function setTokens(t) {
  tokens = t;
  if (t) await store.set('tokens', JSON.stringify(t)); else await store.del('tokens');
}
async function raw(path, opts = {}) {
  const r = await fetch(BASE + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(tokens ? { Authorization: 'Bearer ' + tokens.access } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { r, j: await r.json().catch(() => ({})) };
}
export async function api(path, opts) {
  let { r, j } = await raw(path, opts);
  if (r.status === 401 && tokens?.refresh && !path.startsWith('/auth/')) {
    const rf = await raw('/auth/refresh', { method: 'POST', body: { refresh: tokens.refresh } });
    if (!rf.r.ok) { await setTokens(null); lost(); throw Object.assign(new Error('Please sign in again.'), { auth: true }); }
    await setTokens({ access: rf.j.access, refresh: rf.j.refresh });
    ({ r, j } = await raw(path, opts));
  }
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Please try again.');
  return j;
}
export async function signIn(mode, body) {
  const j = await api('/auth/' + mode, { method: 'POST', body });
  await setTokens({ access: j.access, refresh: j.refresh });
}
export async function signOut() {
  try { if (tokens) await api('/auth/logout', { method: 'POST', body: { refresh: tokens.refresh } }); } catch {}
  await setTokens(null);
}

// ─────────────────────────────────────────────────────────────
// serverConfig — which server this device talks to (device setting).
//
// localStorage 'pm-server' = { url, anonKey } (scope 'device' in the store
// registry: never synced, a restore leaves it alone). Without a saved value
// the build's defaults apply (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY),
// so moving from the test laptop to hosted Supabase needs no rebuild —
// only a new address here. A saved empty url means "no server".
// The anon (publishable) key is public by design; the server's secret key
// never goes here.
// ─────────────────────────────────────────────────────────────

import { notifyStoreChange } from '../utils/storeEvents.js';

export const SERVER_STORAGE_KEY = 'pm-server';

const local = () => (typeof localStorage === 'undefined' ? null : localStorage);

const buildEnv = () => {
  try {
    return import.meta.env || {};
  } catch {
    return {};
  }
};

/** Address and key from the build (.env), '' when not set. */
export const envServerDefaults = () => {
  const env = buildEnv();
  return { url: normalizeServerUrl(env.VITE_SUPABASE_URL || ''), anonKey: String(env.VITE_SUPABASE_ANON_KEY || '').trim() };
};

/** 'https://x.example.com/' → 'https://x.example.com'; '' when not an http(s) URL. */
export const normalizeServerUrl = (url) => {
  const text = String(url ?? '').trim();
  if (!text) return '';
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return '';
  }
};

/** { url, anonKey, source: 'device' | 'build' | 'none' } */
export const loadServerConfig = (storage = local()) => {
  try {
    const raw = storage?.getItem(SERVER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) || {};
      return {
        url: normalizeServerUrl(parsed.url),
        anonKey: typeof parsed.anonKey === 'string' ? parsed.anonKey.trim() : '',
        source: 'device',
      };
    }
  } catch {
    // corrupt value — fall back to the build's defaults
  }
  const env = envServerDefaults();
  return { ...env, source: env.url ? 'build' : 'none' };
};

export const isServerConfigured = (config = loadServerConfig()) => Boolean(config.url && config.anonKey);

/**
 * Check an address + key typed by a person. Returns { ok } or { ok: false,
 * code } with code 'url' | 'key' | 'https' (a page served over https can
 * only reach an https server).
 */
export const validateServerConfig = ({ url, anonKey }, { pageProtocol } = {}) => {
  const clean = normalizeServerUrl(url);
  if (!clean) return { ok: false, code: 'url' };
  if (!String(anonKey ?? '').trim()) return { ok: false, code: 'key' };
  const protocol = pageProtocol ?? (typeof location !== 'undefined' ? location.protocol : 'http:');
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(clean);
  if (protocol === 'https:' && clean.startsWith('http:') && !isLocal) return { ok: false, code: 'https' };
  return { ok: true };
};

/** Save the server for this device. Returns the stored config. */
export const saveServerConfig = ({ url, anonKey }, storage = local()) => {
  const value = { url: normalizeServerUrl(url), anonKey: String(anonKey ?? '').trim() };
  try {
    storage?.setItem(SERVER_STORAGE_KEY, JSON.stringify(value));
    notifyStoreChange(SERVER_STORAGE_KEY);
  } catch {
    // storage unavailable
  }
  return loadServerConfig(storage);
};

/** Forget the device's choice: the build's defaults apply again. */
export const resetServerConfig = (storage = local()) => {
  try {
    storage?.removeItem(SERVER_STORAGE_KEY);
    notifyStoreChange(SERVER_STORAGE_KEY);
  } catch {
    // ignore
  }
  return loadServerConfig(storage);
};

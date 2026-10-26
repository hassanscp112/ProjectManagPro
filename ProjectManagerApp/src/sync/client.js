// ─────────────────────────────────────────────────────────────
// client — the supabase-js client for the server this device is set to.
//
// Loaded on first use (devices without a server never download it). The
// sign-in token is kept in the sync database (IndexedDB 'pm-sync', kv
// 'auth:*') instead of localStorage, so it never ends up in a backup file.
// One client per server address; changing the address makes a new one.
// ─────────────────────────────────────────────────────────────

import { isServerConfigured, loadServerConfig } from './serverConfig.js';
import { createSupabaseTransport } from './transport.js';

let cached = null; // { url, anonKey, client, transport }

/** supabase-js auth storage on top of the sync database's kv. */
export const authStorage = (db) => ({
  getItem: async (key) => (await db.kvGet(`auth:${key}`)) ?? null,
  setItem: (key, value) => db.kvSet(`auth:${key}`, value),
  removeItem: (key) => db.kvDelete(`auth:${key}`),
});

/**
 * The client + transport for the configured server, or null when none is
 * set. `db` is the sync database (for the token).
 */
export const getConnection = async (db, config = loadServerConfig()) => {
  if (!isServerConfigured(config)) return null;
  if (cached && cached.url === config.url && cached.anonKey === config.anonKey) return cached;
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(config.url, config.anonKey, {
    auth: {
      storage: authStorage(db),
      storageKey: 'session',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  if (cached?.client && cached.client !== client) {
    try {
      cached.client.removeAllChannels();
      cached.client.auth.stopAutoRefresh();
    } catch {
      // the old client is going away anyway
    }
  }
  cached = { url: config.url, anonKey: config.anonKey, client, transport: createSupabaseTransport(client) };
  return cached;
};

/**
 * A throwaway client for testing an address before saving it (no session).
 * Returns { ok, info?, code? }.
 */
export const probeServer = async ({ url, anonKey }) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await client.rpc('server_info');
    if (error) {
      const message = String(error.message || '');
      if (/server_info|function|schema cache/i.test(message)) return { ok: false, code: 'noSchema' };
      if (/invalid api key|jwt|apikey|unauthorized/i.test(message) || Number(error.status) === 401) return { ok: false, code: 'badKey' };
      return { ok: false, code: 'unreachable', message };
    }
    if (data?.app !== 'projectmanager') return { ok: false, code: 'noSchema' };
    return { ok: true, info: data };
  } catch (error) {
    return { ok: false, code: 'unreachable', message: String(error?.message || error) };
  }
};

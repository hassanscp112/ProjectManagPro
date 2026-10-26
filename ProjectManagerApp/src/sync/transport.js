// ─────────────────────────────────────────────────────────────
// transport — every call to the server, through supabase-js. The engine
// and the account / history modules use only these functions, so tests
// swap in a fake (src/sync/__tests__/fakeServer.js) with the same shape.
//
// Errors are SyncError: `offline` when the server could not be reached,
// `auth` when the sign-in is no longer valid, `code` = the server's code
// (e.g. 'pm_not_allowed') for refusals.
// ─────────────────────────────────────────────────────────────

export class SyncError extends Error {
  constructor(message, { code = '', offline = false, auth = false, status = 0 } = {}) {
    super(message || code || 'sync error');
    this.name = 'SyncError';
    this.code = code;
    this.offline = offline;
    this.auth = auth;
    this.status = status;
  }
}

const NETWORK = /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|aborted/i;

/** A supabase-js error (or a thrown fetch error) as a SyncError. */
export const toSyncError = (error) => {
  if (error instanceof SyncError) return error;
  const message = String(error?.message || error || '');
  const status = Number(error?.status) || 0;
  const offline = NETWORK.test(message) || (typeof navigator !== 'undefined' && navigator.onLine === false);
  const auth = status === 401 || /jwt|token|not_signed_in|invalid claim/i.test(message) || error?.code === 'PGRST301';
  const code = (message.match(/\bpm_[a-z_]+/) || [])[0] || error?.code || '';
  return new SyncError(message, { code, offline, auth, status });
};

const unwrap = async (promise) => {
  let res;
  try {
    res = await promise;
  } catch (error) {
    throw toSyncError(error);
  }
  if (res?.error) throw toSyncError(res.error);
  return res?.data;
};

/** The transport for one supabase-js client. */
export const createSupabaseTransport = (client) => {
  const rpc = (fn, args) => unwrap(client.rpc(fn, args));
  return {
    client,

    serverInfo: () => rpc('server_info'),
    myAccess: () => rpc('my_access'),
    claimInvites: () => rpc('claim_invites'),
    bootstrapOrg: (name) => rpc('bootstrap_org', { p_name: name }),

    createProject: ({ orgId, name, contract, location, startDate, localId }) =>
      rpc('create_project', {
        p_org: orgId,
        p_name: name || '',
        p_contract: contract || '',
        p_location: location || '',
        p_start_date: startDate || null,
        p_local_id: localId || null,
      }),
    updateProject: (serverId, { name, contract, location, startDate }) =>
      unwrap(
        client
          .from('projects')
          .update({ name: name || '', contract: contract || '', location: location || '', start_date: startDate || null })
          .eq('id', serverId)
          .select('id')
      ),

    push: (payloads) => rpc('push_changes', { p_changes: payloads }),
    pull: (scope, cursor, limit) =>
      rpc('pull_items', {
        p_org: scope.orgId,
        p_project: scope.projectId || null,
        p_after_txid: String(cursor?.txid ?? '0'),
        p_after_seq: Number(cursor?.seq) || 0,
        p_limit: limit,
      }),

    // ── people ──
    listMembers: (serverId) =>
      unwrap(client.from('project_members').select('user_id, role, added_at, profile:profiles!project_members_user_id_fkey(name, email)').eq('project_id', serverId)),
    listOrgMembers: (orgId) =>
      unwrap(client.from('org_members').select('user_id, role, added_at, profile:profiles!org_members_user_id_fkey(name, email)').eq('org_id', orgId)),
    listInvites: (orgId) => unwrap(client.from('invites').select('id, project_id, email, role, created_at').eq('org_id', orgId).is('claimed_at', null)),
    inviteMember: ({ orgId, serverId, email, role }) =>
      rpc('invite_member', { p_org: orgId, p_project: serverId || null, p_email: email, p_role: role }),
    setMemberRole: (serverId, userId, role) => rpc('set_member_role', { p_project: serverId, p_user: userId, p_role: role }),
    removeMember: (serverId, userId) => rpc('remove_member', { p_project: serverId, p_user: userId }),
    setOrgRole: (orgId, userId, role) => rpc('set_org_role', { p_org: orgId, p_user: userId, p_role: role }),
    removeOrgMember: (orgId, userId) => rpc('remove_org_member', { p_org: orgId, p_user: userId }),
    cancelInvite: (id) => rpc('cancel_invite', { p_invite: id }),
    renameMe: (userId, name) => unwrap(client.from('profiles').update({ name }).eq('id', userId).select('id')),

    // ── history ──
    changes: ({ orgId, projectId, collection, itemIds, actor, from, to, beforeId, limit = 100 }) => {
      let q = client
        .from('changes')
        .select('id, collection, item_id, op, before, after, rev, outcome, note, actor, actor_name, device_id, client_at, server_at, restored_from')
        .eq('org_id', orgId)
        .order('id', { ascending: false })
        .limit(Math.min(Math.max(Number(limit) || 100, 1), 500));
      q = projectId ? q.eq('project_id', projectId) : q.is('project_id', null);
      if (collection) q = q.eq('collection', collection);
      if (itemIds?.length) q = q.in('item_id', itemIds);
      if (actor) q = q.eq('actor', actor);
      if (from) q = q.gte('server_at', from);
      if (to) q = q.lt('server_at', to);
      if (beforeId) q = q.lt('id', beforeId);
      return unwrap(q);
    },
    change: (id) =>
      unwrap(client.from('changes').select('id, org_id, project_id, collection, item_id, op, before, after, rev, outcome').eq('id', id).maybeSingle()),

    // ── files ──
    upload: async (path, blob, contentType) => {
      try {
        await unwrap(client.storage.from('files').upload(path, blob, { contentType: contentType || 'application/octet-stream', upsert: false }));
      } catch (error) {
        // already uploaded (a retry after a lost answer) counts as done
        if (error.status === 409 || /exists|duplicate/i.test(error.message)) return;
        throw error;
      }
    },
    download: (path) => unwrap(client.storage.from('files').download(path)),

    // ── live updates ──
    subscribe: (orgId, onChange) => {
      const channel = client
        .channel(`pm-items-${orgId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `org_id=eq.${orgId}` }, (payload) =>
          onChange(payload?.new?.project_id ?? payload?.old?.project_id ?? null)
        )
        .subscribe();
      return () => {
        client.removeChannel(channel);
      };
    },
  };
};

// ─────────────────────────────────────────────────────────────
// conflict — which version of a record wins when two devices changed it.
// The server decides (push_changes in supabase/migrations/…_sync.sql);
// this is the same rule in JS, for the device's own checks and the tests.
//
//   1. approved beats recorded (issued beats draft) — when neither side
//      is a deletion;
//   2. otherwise the higher rev wins (rev counts the versions a device
//      made);
//   3. on a tie the version already on the server stays.
// The losing version is never thrown away: the server keeps it in
// `changes` (outcome 'rejected').
// ─────────────────────────────────────────────────────────────

const STATUS_RANK = { approved: 2, issued: 2, recorded: 1, draft: 1 };

export const statusRank = (data) => (data && typeof data === 'object' ? STATUS_RANK[data.status] || 0 : 0);

/**
 * current / incoming: { data, deleted, rev }.
 * Returns { winner: 'current' | 'incoming', reason: 'status' | 'rev' | 'tie' }.
 */
export const pickWinner = (current, incoming) => {
  if (!current?.deleted && !incoming?.deleted) {
    const c = statusRank(current?.data);
    const i = statusRank(incoming?.data);
    if (c > 0 && i > 0 && c !== i) return { winner: i > c ? 'incoming' : 'current', reason: 'status' };
  }
  const cr = Number(current?.rev) || 0;
  const ir = Number(incoming?.rev) || 0;
  if (ir > cr) return { winner: 'incoming', reason: 'rev' };
  if (ir < cr) return { winner: 'current', reason: 'rev' };
  return { winner: 'current', reason: 'tie' };
};

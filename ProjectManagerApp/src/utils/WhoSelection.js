// ─────────────────────────────────────────────────────────────
// WhoSelection — pure helpers behind the shared WhoPicker.
//
// A "who" value attributes work or money to someone:
//   { kind: 'contractor', contractorId }   — orders
//   { kind: 'team', teamId }               — orders + planning
//   { kind: 'workers', workerIds: [] }     — orders + planning
//   { kind: 'count', count }               — planning (head count only)
//   { kind: 'none' }                       — orders
// Switching kinds carries over whatever still makes sense (loose →
// tight) and never blocks the user.
// ─────────────────────────────────────────────────────────────

/** A team's head count: its manual default size, else its member count. */
export const teamSizeOf = (team) => {
  if (!team) return 0;
  const size = Number(team.defaultSize);
  if (Number.isFinite(size) && size > 0) return size;
  return Array.isArray(team.memberWorkerIds) ? team.memberWorkerIds.length : 0;
};

/** Return the new who value after switching to `nextKind`. */
export const switchWhoKind = (who, nextKind, teams = []) => {
  const current = who && typeof who === 'object' ? who : { kind: 'none' };
  if (current.kind === nextKind) return current;
  const next = { kind: nextKind };

  if (nextKind === 'count') {
    let derived = Number(current.count);
    if (current.kind === 'workers') derived = (current.workerIds || []).length;
    else if (current.kind === 'team') derived = teamSizeOf(teams.find((tm) => tm.id === current.teamId));
    next.count = Number.isFinite(derived) && derived > 0 ? derived : 0;
  } else if (nextKind === 'team') {
    // Picked workers that are exactly one team's roster → preselect that team.
    if (current.kind === 'workers') {
      const ids = current.workerIds || [];
      const match = teams.find(
        (tm) =>
          Array.isArray(tm.memberWorkerIds) &&
          tm.memberWorkerIds.length === ids.length &&
          ids.every((id) => tm.memberWorkerIds.includes(id))
      );
      if (match) next.teamId = match.id;
    }
  } else if (nextKind === 'workers') {
    next.workerIds = [];
    // From a team → prefill its roster.
    if (current.kind === 'team') {
      const team = teams.find((tm) => tm.id === current.teamId);
      if (team && Array.isArray(team.memberWorkerIds)) next.workerIds = [...team.memberWorkerIds];
    }
  }
  return next;
};

/** Add or remove one worker; always returns a workers-kind value. */
export const toggleWhoWorker = (who, workerId) => {
  const ids = who && who.kind === 'workers' ? [...(who.workerIds || [])] : [];
  const idx = ids.indexOf(workerId);
  if (idx === -1) ids.push(workerId);
  else ids.splice(idx, 1);
  return { kind: 'workers', workerIds: ids };
};

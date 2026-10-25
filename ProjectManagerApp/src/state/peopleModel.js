// ─────────────────────────────────────────────────────────────
// peopleModel — team sizing rules for the People area (pure).
//
// A team's defaultSize is "automatic" while it equals its member count;
// typing another value makes it manual, clearing it returns to automatic.
// Registry CRUD stays in utils/Registries.js.
// Tested in __tests__/peopleModel.test.js.
// ─────────────────────────────────────────────────────────────

export const isAutoSized = (team) => team.defaultSize === team.memberWorkerIds.length;

/** Patch for adding/removing a member (automatic sizes follow the count). */
export const toggleMemberPatch = (team, workerId) => {
  const memberWorkerIds = team.memberWorkerIds.includes(workerId)
    ? team.memberWorkerIds.filter((id) => id !== workerId)
    : [...team.memberWorkerIds, workerId];
  return isAutoSized(team) ? { memberWorkerIds, defaultSize: memberWorkerIds.length } : { memberWorkerIds };
};

/** Patch for the size input: '' → back to automatic; a number → manual. */
export const sizePatch = (team, raw) => {
  if (raw === '') return { defaultSize: team.memberWorkerIds.length };
  const n = Number(raw);
  return { defaultSize: Number.isFinite(n) && n >= 0 ? n : team.defaultSize };
};

/** After a worker is deleted, automatic teams track their new member count. */
export const syncAutoTeams = (teamsBefore, teamsAfter) =>
  teamsAfter.map((after) => {
    const before = teamsBefore.find((t) => t.id === after.id);
    return before && isAutoSized(before) ? { ...after, defaultSize: after.memberWorkerIds.length } : after;
  });

/** How many teams list the worker as member or foreman. */
export const teamsUsingWorker = (teams = [], workerId) =>
  teams.filter((t) => t.memberWorkerIds.includes(workerId) || t.foremanWorkerId === workerId).length;

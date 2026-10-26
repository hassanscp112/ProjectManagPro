import { useCallback, useEffect, useState } from 'react';
import { currentActor, IDENTITY_STORAGE_KEY } from '../utils/Identity.js';
import { can } from '../utils/permissions.js';
import { onStoreChange } from '../utils/storeEvents.js';

const ACTOR_KEYS = [IDENTITY_STORAGE_KEY, 'pm-session'];

/** The current actor { id, name, role }, re-read when identity or the session changes. */
export function useActor() {
  const [actor, setActor] = useState(currentActor);
  useEffect(() => onStoreChange((key) => ACTOR_KEYS.includes(key) && setActor(currentActor())), []);
  return actor;
}

/**
 * `const allowed = useCan(); allowed('orders.approve')` — hide or disable
 * what the current user may not do (utils/permissions).
 */
export function useCan() {
  const actor = useActor();
  return useCallback((action) => can(actor.role, action), [actor.role]);
}

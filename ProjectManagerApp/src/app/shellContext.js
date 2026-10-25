import { createContext, useContext } from 'react';

/**
 * Shell-level actions any page can trigger:
 *   openSearch()          — open the Ctrl K palette
 *   setImmersive(on)      — phone: hide the bottom bar during a focused
 *                           task (e.g. filling an order form)
 */
export const ShellContext = createContext({ openSearch: () => {}, setImmersive: () => {} });

export const useShell = () => useContext(ShellContext);

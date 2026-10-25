import { createContext, useContext } from 'react';

/** Shell-level actions any page can trigger: { openSearch }. */
export const ShellContext = createContext({ openSearch: () => {} });

export const useShell = () => useContext(ShellContext);

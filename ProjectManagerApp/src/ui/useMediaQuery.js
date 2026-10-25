import { useCallback, useSyncExternalStore } from 'react';

/** Live CSS media query match, e.g. useMediaQuery('(max-width: 767px)'). */
export const useMediaQuery = (query) => {
  const subscribe = useCallback(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
};

/** Phone layout (matches the shell's bottom-bar breakpoint). */
export const usePhone = () => useMediaQuery('(max-width: 767px)');

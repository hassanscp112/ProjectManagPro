import { useEffect, useRef } from 'react';

/**
 * Ctrl/⌘ + key shortcut (e.g. useHotkey('k', openSearch)). Ignores
 * key repeats; always calls the latest handler.
 */
export const useHotkey = (key, handler) => {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.repeat || !(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      e.preventDefault();
      ref.current?.(e);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [key]);
};

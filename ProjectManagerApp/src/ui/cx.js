/** Join class names, skipping falsy values: cx('a', on && 'b') → 'a b'. */
export const cx = (...parts) => parts.filter(Boolean).join(' ');

// Numbers with a % sign or a +/- sign inside Arabic (right-to-left) text
// render reversed ("21%" → "%21", "-77.9" → "77.9-"). Wrapping them in a
// left-to-right isolate (U+2066 … U+2069) keeps them in natural order.
// Built with fromCharCode so the marks stay visible in source.

const LRI = String.fromCharCode(0x2066);
const PDI = String.fromCharCode(0x2069);

export const ltr = (text) => `${LRI}${text}${PDI}`;

/**
 * A signed amount inside words, e.g. '+26.5 مليون د.ع': only the signed
 * number is isolated, so the sign stays on the number and the words keep
 * the reading direction. `text` is the formatted absolute amount.
 */
export const signedAmount = (n, text) => {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return text.replace(/\d[\d.,]*/, (m) => ltr(`${sign}${m}`));
};

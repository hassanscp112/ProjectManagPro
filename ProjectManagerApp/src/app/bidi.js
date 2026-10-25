// Numbers with a % sign or a +/- sign inside Arabic (right-to-left) text
// render reversed ("21%" → "%21", "-77.9" → "77.9-"). Wrapping them in a
// left-to-right isolate (U+2066 … U+2069) keeps them in natural order.
// Built with fromCharCode so the marks stay visible in source.

const LRI = String.fromCharCode(0x2066);
const PDI = String.fromCharCode(0x2069);

export const ltr = (text) => `${LRI}${text}${PDI}`;

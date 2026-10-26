// ─────────────────────────────────────────────────────────────
// trades — the crews a building site is planned with.
//
// Every work type belongs to one trade; a project's crew limits and the
// resource leveling count crews per trade. Codes are data; labels come
// from the dictionaries (`planning.trade.<code>`).
// ─────────────────────────────────────────────────────────────

export const TRADES = [
  'general', // mobilization, handover, testing
  'earthworks', // excavation, backfill, site preparation (machines)
  'concrete', // formwork + rebar + concrete (the structure crew)
  'masonry', // block / brick walls
  'plaster', // internal and external plaster, screed
  'tiling', // floor / wall tiles, marble, roof tiles
  'painting',
  'carpentry', // doors, kitchens
  'aluminium', // windows, curtain walls
  'electrical',
  'plumbing',
  'hvac',
  'insulation', // waterproofing, thermal insulation
  'ceilings', // gypsum board / false ceilings
  'steel', // structural steel, sandwich panels
  'facade', // cladding, stone
  'external', // paving, fences, landscaping, sewer
  'systems', // lifts, fire, medical gas (specialist subcontractors)
];

export const isTrade = (code) => TRADES.includes(code);

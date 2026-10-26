// Display helpers shared by the wizard steps: names of sections, levels,
// items, level uses and trades in the UI language.

import { levelName } from '../../../utils/planning/autoPlan.js';
import { workTypeName } from '../../../utils/planning/WorkTypes.js';

export const sectionLabel = (template, key, lang) => {
  const section = (template?.sections || []).find((x) => x.key === key);
  if (!section) return key;
  return lang === 'en' ? section.nameEn || section.name || key : section.name || key;
};

export const levelLabel = (level, lang) => levelName(level, lang);

/** An item's name (template override, else its work type). */
export const itemLabel = (item, workTypes, lang) => {
  const wt = workTypes.get(item.workTypeId);
  if (lang === 'en') return item.nameEn || workTypeName(wt, 'en') || item.name || item.workTypeId;
  return item.name || workTypeName(wt, 'ar') || item.workTypeId;
};

/** "Name — level" for an item seen from elsewhere (links). */
export const itemLabelWithLevel = (item, plan, workTypes, lang) =>
  item.levelIndex === null ? itemLabel(item, workTypes, lang) : `${itemLabel(item, workTypes, lang)} — ${levelName(plan.levels[item.levelIndex], lang)}`;

export const tradeLabel = (t, trade) => t(`planning.trade.${trade}`);
export const levelUseLabel = (t, use) => t(`planning.use.${use}`);

/** Link as short text: "FS", "SS +3", "FS +7 cal." */
export const linkText = (t, link) => {
  const lag = Number(link.lag) || 0;
  const unit = link.lagUnit === 'cd' ? ` ${t('schedule.calendarDaysShort')}` : '';
  return `${link.type}${lag ? ` ${lag > 0 ? '+' : ''}${lag}${unit}` : ''}`;
};

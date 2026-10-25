import { useI18n } from '../i18n/useI18n.js';
import { cx } from './cx.js';
import s from './ProgressBar.module.css';

const clamp = (n) => Math.min(100, Math.max(0, Number(n) || 0));

/**
 * Horizontal progress bar (fills from the reading start: right in RTL).
 * `marker` draws a planned-value tick. `label` names it for screen
 * readers (defaults to "Progress").
 */
export function ProgressBar({ value, max = 100, marker, tone = 'accent', size = 'md', label, className }) {
  const { t } = useI18n();
  const pct = clamp((Number(value) / (Number(max) || 100)) * 100);
  const markerPct = marker === undefined || marker === null ? null : clamp(marker);
  return (
    <div
      role="progressbar"
      aria-label={label || t('ui.progress')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cx(s.track, size === 'lg' && s.lg, tone !== 'accent' && s[tone], className)}
    >
      <div className={s.fill} style={{ width: `${pct}%` }} />
      {markerPct !== null && (
        <span
          className={s.marker}
          style={{ insetInlineStart: `${markerPct}%` }}
          title={t('ui.plannedMarker', { value: Math.round(markerPct * 10) / 10 })}
        />
      )}
    </div>
  );
}

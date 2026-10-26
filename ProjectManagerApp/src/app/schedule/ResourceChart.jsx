import { useMemo, useState } from 'react';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { Table, usePhone } from '../../ui/index.js';
import { formatDay } from '../record/orderMeta.js';
import s from './Resources.module.css';

const PAD = { l: 40, r: 16, t: 22, b: 28 };

const niceMax = (n) => {
  if (n <= 5) return Math.max(1, Math.ceil(n));
  const p = 10 ** Math.floor(Math.log10(n));
  const f = n / p;
  return (f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
};

// A bar with rounded top corners, anchored to the baseline.
const barPath = (x, y, w, h) => {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

/**
 * Most of one resource in use per week against what the project has —
 * bars over the limit in the danger colour, the limit as a dashed line.
 * Time runs left → right in both languages; hover a week for its figures,
 * or open the table.
 */
export default function ResourceChart({ series, label, bucketDays = 7 }) {
  const { t, lang } = useI18n();
  const [active, setActive] = useState(null);
  // A narrower drawing on phones keeps the text readable.
  const phone = usePhone();
  const W = phone ? 380 : 760;
  const H = phone ? 240 : 220;
  const weeks = useMemo(() => series?.weeks || [], [series]);
  const cap = series?.capacity ?? null;

  const view = useMemo(() => {
    if (!weeks.length) return null;
    const plotW = W - PAD.l - PAD.r;
    const plotH = H - PAD.t - PAD.b;
    const max = niceMax(Math.max(1, cap ?? 0, ...weeks.map((w) => w.peak)));
    const bw = plotW / weeks.length;
    const y = (v) => PAD.t + plotH - (v / max) * plotH;
    const monthFmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-GB', { month: 'short', year: '2-digit' });
    // A label at the first bar of each month, thinned to about seven.
    const starts = weeks.map((w, i) => ({ i, month: w.from.slice(0, 7) })).filter((p, k, all) => k === 0 || p.month !== all[k - 1].month);
    const step = Math.max(1, Math.ceil(starts.length / (phone ? 4 : 7)));
    return {
      bw,
      y,
      base: PAD.t + plotH,
      grid: [...new Set([0, Math.round(max / 2), max])],
      xLabels: starts.filter((p, k) => k % step === 0).map((p) => ({ i: p.i, label: monthFmt.format(new Date(`${weeks[p.i].from}T00:00:00`)) })),
    };
  }, [weeks, cap, lang, phone, W, H]);

  if (!view) return <p className={s.muted}>{t('schedule.res.chartEmpty')}</p>;
  const x = (i) => PAD.l + i * view.bw;
  const gap = view.bw > 4 ? 2 : 0;
  const tip = active !== null ? weeks[active] : null;
  const peakAll = weeks.reduce((m, w) => Math.max(m, w.peak), 0);

  return (
    <div className={s.stack}>
      <div className={s.chart} dir="ltr" onPointerLeave={() => setActive(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className={s.svg} role="img" aria-label={t('schedule.res.chartAria', { name: label, peak: formatNumber(peakAll), cap: cap == null ? t('schedule.res.unlimited') : formatNumber(cap) })}>
          {view.grid.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={view.y(v)} y2={view.y(v)} className={s.gridLine} />
              <text x={PAD.l - 8} y={view.y(v) + 4} textAnchor="end" className={s.axisText}>
                {formatNumber(v)}
              </text>
            </g>
          ))}
          {view.xLabels.map((p) => (
            <text key={p.i} x={x(p.i) + view.bw / 2} y={H - 8} textAnchor="middle" className={s.axisText}>
              {p.label}
            </text>
          ))}
          {weeks.map((w, i) => {
            if (!(w.peak > 0)) return null;
            const top = view.y(w.peak);
            const over = cap != null && w.peak > cap;
            return <path key={w.from} d={barPath(x(i) + gap / 2, top, Math.max(1, view.bw - gap), view.base - top)} className={`${over ? s.barOver : s.bar} ${active === i ? s.barActive : ''}`} />;
          })}
          {cap != null && (
            <g>
              <line x1={PAD.l} x2={W - PAD.r} y1={view.y(cap)} y2={view.y(cap)} className={s.capLine} />
              <text x={W - PAD.r} y={view.y(cap) - 6} textAnchor="end" className={s.capText}>
                {t('schedule.res.capacityMark', { n: formatNumber(cap) })}
              </text>
            </g>
          )}
          {weeks.map((w, i) => (
            <rect key={`hit-${w.from}`} x={x(i)} y={PAD.t} width={view.bw} height={view.base - PAD.t} className={s.hit} onPointerEnter={() => setActive(i)} onClick={() => setActive(i)} />
          ))}
        </svg>
        {tip && (
          <div className={s.tip} style={{ left: `${Math.min(85, Math.max(15, ((x(active) + view.bw / 2) / W) * 100))}%` }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <strong>{t(bucketDays === 7 ? 'schedule.res.weekOf' : 'schedule.res.twoWeeksOf', { date: formatDay(tip.from) })}</strong>
            {t('schedule.res.tipUse', { n: formatNumber(tip.peak) })}
            {cap != null && ` · ${t('schedule.res.tipCap', { n: formatNumber(cap) })}`}
            {cap != null && tip.peak > cap && ` · ${t('schedule.res.tipOver', { n: formatNumber(tip.peak - cap) })}`}
          </div>
        )}
      </div>
      <details className={s.tableToggle}>
        <summary>{t('schedule.res.showTable')}</summary>
        <Table label={label} minWidth={320}>
          <thead>
            <tr>
              <th>{t(bucketDays === 7 ? 'schedule.res.week' : 'schedule.res.twoWeeks')}</th>
              <th className="ui-num">{t('schedule.res.inUse')}</th>
              <th className="ui-num">{t('schedule.res.available')}</th>
            </tr>
          </thead>
          <tbody>
            {weeks
              .filter((w) => w.peak > 0)
              .map((w) => (
                <tr key={w.from}>
                  <td>{formatDay(w.from)}</td>
                  <td className={`ui-num ${cap != null && w.peak > cap ? s.danger : ''}`}>{formatNumber(w.peak)}</td>
                  <td className="ui-num">{cap == null ? '—' : formatNumber(cap)}</td>
                </tr>
              ))}
          </tbody>
        </Table>
      </details>
    </div>
  );
}

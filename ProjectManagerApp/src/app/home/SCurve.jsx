import { useMemo } from 'react';
import { compactCurrency } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { niceCeil, todayIndex } from '../../state/homeModel.js';
import s from './Home.module.css';

const W = 760;
const H = 280;
const PAD = { l: 56, r: 16, t: 24, b: 32 };

const SERIES = [
  { key: 'pv', labelKey: 'dashboard.seriesPv', className: s.linePlanned },
  { key: 'ev', labelKey: 'dashboard.seriesEv', className: s.lineEarned },
  { key: 'ac', labelKey: 'dashboard.seriesAc', className: s.lineActual },
];

/**
 * Cumulative planned (PV) vs earned (EV) vs actual (AC) value per week, from
 * GanttEngine's sCurve points. Inline SVG; time runs left → right in both
 * languages (charts are read that way), with a "today" marker.
 */
export default function SCurve({ points, today }) {
  const { t, lang } = useI18n();

  const view = useMemo(() => {
    if (!points || points.length < 2) return null;
    const plotW = W - PAD.l - PAD.r;
    const plotH = H - PAD.t - PAD.b;
    const max = niceCeil(Math.max(1, ...points.flatMap((p) => [p.pv, p.ev, p.ac])));
    const x = (i) => PAD.l + (i / (points.length - 1)) * plotW;
    const y = (v) => PAD.t + plotH - (v / max) * plotH;
    const upTo = (key, last) =>
      points
        .slice(0, last + 1)
        .map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`)
        .join(' ');
    const ti = todayIndex(points, today);
    const monthFmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-GB', { month: 'short', year: '2-digit' });
    const step = Math.max(1, Math.floor(points.length / 6));
    const xLabels = points
      .map((p, i) => ({ i, label: monthFmt.format(new Date(`${p.date}T00:00:00`)) }))
      .filter((p) => p.i % step === 0);
    return {
      max,
      x,
      y,
      ti,
      xLabels,
      // Planned runs to the end; earned and actual stop at today (no future actuals).
      lines: {
        pv: upTo('pv', points.length - 1),
        ev: upTo('ev', ti >= 0 ? ti : points.length - 1),
        ac: upTo('ac', ti >= 0 ? ti : points.length - 1),
      },
      grid: [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: y(max * f), value: max * f })),
    };
  }, [points, today, lang]);

  if (!view) return <p className={s.muted}>{t('dashboard.scurveEmpty')}</p>;

  const short = (n) => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}${t('dashboard.unitBillion')}`;
    if (n >= 1e6) return `${Math.round(n / 1e6)}${t('dashboard.unitMillion')}`;
    if (n >= 1e3) return `${Math.round(n / 1e3)}${t('dashboard.unitThousand')}`;
    return String(Math.round(n));
  };
  const at = view.ti >= 0 ? points[view.ti] : points[points.length - 1];

  return (
    <div className={s.chart}>
      <div className={s.legend}>
        {SERIES.map((ser) => (
          <span key={ser.key} className={s.legendItem}>
            <svg width="20" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="20" y2="3" className={ser.className} />
            </svg>
            {t(ser.labelKey)}
          </span>
        ))}
      </div>
      <div dir="ltr">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={s.svg}
          role="img"
          aria-label={t('home.sCurveAria', { pv: compactCurrency(at.pv, lang), ev: compactCurrency(at.ev, lang), ac: compactCurrency(at.ac, lang) })}
        >
          {view.grid.map((g) => (
            <g key={g.value}>
              <line x1={PAD.l} x2={W - PAD.r} y1={g.y} y2={g.y} className={s.gridLine} />
              <text x={PAD.l - 8} y={g.y + 4} textAnchor="end" className={s.axisText}>
                {short(g.value)}
              </text>
            </g>
          ))}
          {view.xLabels.map((p) => (
            <text key={p.i} x={view.x(p.i)} y={H - 8} textAnchor="middle" className={s.axisText}>
              {p.label}
            </text>
          ))}
          {SERIES.map((ser) => (
            <polyline key={ser.key} points={view.lines[ser.key]} fill="none" className={ser.className} />
          ))}
          {view.ti >= 0 && (
            <g>
              <line x1={view.x(view.ti)} x2={view.x(view.ti)} y1={PAD.t} y2={H - PAD.b} className={s.todayLine} />
              <text x={view.x(view.ti)} y={PAD.t - 8} textAnchor="middle" className={s.todayText}>
                {t('dashboard.todayMarker')}
              </text>
              <circle cx={view.x(view.ti)} cy={view.y(at.pv)} r="4" className={s.dotPlanned} />
              <circle cx={view.x(view.ti)} cy={view.y(at.ev)} r="4.5" className={s.dotEarned} />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

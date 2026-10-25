import { useMemo } from 'react';
import './SCurveChart.css';
import { useI18n } from '../../i18n/useI18n.js';

// S-curve chart: cumulative Planned Value (PV) vs Earned Value (EV) vs
// Actual Cost (AC) over the project schedule. Pure inline SVG — no deps.
//
// The series come pre-computed from GanttEngine.buildSCurve (one point per
// week). We render three polylines + a "today" marker + axis labels.
const SERIES = [
  { key: 'pv', labelKey: 'dashboard.seriesPv', color: '#0a84ff' },   // blue
  { key: 'ev', labelKey: 'dashboard.seriesEv', color: '#30d158' },   // green
  { key: 'ac', labelKey: 'dashboard.seriesAc', color: '#ff9f0a' },   // orange
];

const SCurveChart = ({ points }) => {
  const { t } = useI18n();
  const view = useMemo(() => {
    if (!points || points.length < 2) return null;

    const W = 760;
    const H = 280;
    const padL = 64;   // room for currency labels (RTL: labels on the right)
    const padR = 16;
    const padT = 16;
    const padB = 36;   // room for date labels
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const maxY = Math.max(
      1,
      ...points.flatMap((p) => [p.pv, p.ev, p.ac])
    );
    // Round maxY up to a "nice" number for gridlines.
    const niceMax = niceCeil(maxY);

    const xFor = (i) => padL + (i / (points.length - 1)) * plotW;
    const yFor = (v) => padT + plotH - (v / niceMax) * plotH;

    const line = (key) =>
      points
        .map((p, i) => `${xFor(i).toFixed(1)},${yFor(p[key]).toFixed(1)}`)
        .join(' ');

    // Find today's position: the last point whose date <= today, else -1.
    const today = new Date().toISOString().split('T')[0];
    let todayIdx = -1;
    for (let i = 0; i < points.length; i++) {
      if (points[i].date <= today) todayIdx = i;
    }

    // 4 horizontal gridlines (0, ¼, ½, ¾, 1) → 5 labels
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      y: yFor(niceMax * f),
      label: niceMax * f,
    }));

    // X labels: show ~6 evenly spaced dates.
    const labelEvery = Math.max(1, Math.floor(points.length / 6));
    const xLabels = points
      .map((p, i) => ({ ...p, i }))
      .filter((p) => p.i % labelEvery === 0 || p.i === points.length - 1);

    return {
      W, H, padL, padR, padT, padB, plotW, plotH,
      niceMax, xFor, yFor, line, todayIdx, gridLines, xLabels,
    };
  }, [points]);

  if (!view) {
    return (
      <div className="scurve-empty">
        {t('dashboard.scurveEmpty')}
      </div>
    );
  }

  // Compact axis labels; unit suffix is language-aware (B/M/K vs مليار/مليون/ألف).
  const fmtShort = (n) => {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + t('dashboard.unitBillion');
    if (n >= 1e6) return (n / 1e6).toFixed(0) + t('dashboard.unitMillion');
    if (n >= 1e3) return (n / 1e3).toFixed(0) + t('dashboard.unitThousand');
    return String(Math.round(n));
  };

  return (
    <div className="scurve-wrap" dir="ltr">
      <svg viewBox={`0 0 ${view.W} ${view.H}`} className="scurve-svg" preserveAspectRatio="xMidYMid meet">
        {/* Horizontal gridlines + Y axis labels (on the right for RTL feel) */}
        {view.gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={view.padL} y1={g.y}
              x2={view.W - view.padR} y2={g.y}
              stroke="var(--border-soft)" strokeWidth="1" strokeDasharray="3 3"
            />
            <text
              x={view.W - view.padR + 4} y={g.y + 3}
              className="scurve-axis-y" textAnchor="start"
            >
              {fmtShort(g.label)}
            </text>
          </g>
        ))}

        {/* X axis date labels */}
        {view.xLabels.map((p) => (
          <text
            key={p.i}
            x={view.xFor(p.i)} y={view.H - view.padB + 16}
            className="scurve-axis-x" textAnchor="middle"
          >
            {p.date.slice(5)}
          </text>
        ))}

        {/* "Today" vertical marker */}
        {view.todayIdx >= 0 && (
          <g>
            <line
              x1={view.xFor(view.todayIdx)} y1={view.padT}
              x2={view.xFor(view.todayIdx)} y2={view.H - view.padB}
              stroke="#ff3b30" strokeWidth="1.5" strokeDasharray="4 3"
            />
            <text
              x={view.xFor(view.todayIdx)} y={view.padT - 4}
              className="scurve-today" textAnchor="middle"
            >
              {t('dashboard.todayMarker')}
            </text>
          </g>
        )}

        {/* The three series */}
        {SERIES.map((s) => (
          <polyline
            key={s.key}
            points={view.line(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="scurve-legend">
        {SERIES.map((s) => (
          <span key={s.key} className="scurve-legend-item">
            <span className="scurve-swatch" style={{ background: s.color }} />
            {t(s.labelKey)}
          </span>
        ))}
      </div>
    </div>
  );
};

// Round up to a "nice" axis maximum (1, 2, 5 × 10^n) so gridlines read well.
const niceCeil = (value) => {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const norm = value / base;
  let nice;
  if (norm <= 1) nice = 1;
  else if (norm <= 2) nice = 2;
  else if (norm <= 5) nice = 5;
  else nice = 10;
  return nice * base;
};

export default SCurveChart;

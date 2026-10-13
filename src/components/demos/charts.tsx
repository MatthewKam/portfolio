import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import './charts.css';

/**
 * Small chart kit for the analytics demos. Two series at most, colors from
 * --series-1/--series-2 (validated for color-blind separation in both themes).
 * Every chart has a legend, a hover/keyboard tooltip and a table view.
 */

export type Series = { label: string; values: number[] };
type Fmt = (n: number) => string;

const W = 640;
const H = 240;
const PAD = { l: 56, r: 16, t: 14, b: 28 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="ch-legend">
      {series.map((s, i) => (
        <li key={s.label}><span className={`ch-key ch-s${i + 1}`} aria-hidden="true" />{s.label}</li>
      ))}
    </ul>
  );
}

function TableView({ x, series, fmt, xHead }: { x: string[]; series: Series[]; fmt: Fmt; xHead: string }) {
  return (
    <details className="ch-table">
      <summary>Show as table</summary>
      <div className="ch-table-wrap">
        <table>
          <thead><tr><th scope="col">{xHead}</th>{series.map((s) => <th key={s.label} scope="col">{s.label}</th>)}</tr></thead>
          <tbody>
            {x.map((label, i) => (
              <tr key={label}><th scope="row">{label}</th>{series.map((s) => <td key={s.label}>{fmt(s.values[i])}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Shared hover/keyboard index for charts with one slot per x value. */
function useSlot(count: number, slotOf: (svgX: number) => number) {
  const [i, setI] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const x = ((e.clientX - box.left) / box.width) * W;
    setI(Math.max(0, Math.min(count - 1, slotOf(x))));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const d = e.key === 'ArrowRight' ? 1 : -1;
      setI((v) => Math.max(0, Math.min(count - 1, (v ?? (d > 0 ? -1 : count)) + d)));
    } else if (e.key === 'Escape') setI(null);
  };
  return {
    i, ref,
    svgProps: {
      ref, tabIndex: 0, onPointerMove: onMove, onPointerLeave: () => setI(null),
      onKeyDown: onKey, onBlur: () => setI(null),
    },
  };
}

function Tooltip({ x, y, title, series, i, fmt, total }: {
  x: number; y: number; title: string; series: Series[]; i: number; fmt: Fmt; total?: boolean;
}) {
  return (
    <div className="ch-tip" role="status" style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}>
      <strong>{title}</strong>
      {series.map((s, k) => (
        <span key={s.label}><span className={`ch-key ch-s${k + 1}`} aria-hidden="true" />{s.label}: {fmt(s.values[i])}</span>
      ))}
      {total && series.length > 1 && <span>Total: {fmt(series.reduce((a, s) => a + s.values[i], 0))}</span>}
    </div>
  );
}

function YAxis({ max, fmt }: { max: number; fmt: Fmt }) {
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  return (
    <>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} className={f === 0 ? 'ch-base' : 'ch-grid'} />
          <text x={PAD.l - 8} y={y(max * f)} dy="0.32em" textAnchor="end" className="ch-tick">{fmt(max * f)}</text>
        </g>
      ))}
    </>
  );
}

const showTick = (i: number, n: number) => n <= 8 || i % Math.ceil(n / 6) === 0 || i === n - 1;

export function LineChart({ title, x, series, fmt, xHead, desc }: {
  title: string; x: string[]; series: Series[]; fmt: Fmt; xHead: string; desc: string;
}) {
  const max = niceMax(Math.max(...series.flatMap((s) => s.values)));
  const step = (W - PAD.l - PAD.r) / Math.max(1, x.length - 1);
  const px = (i: number) => PAD.l + i * step;
  const py = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const { i, svgProps } = useSlot(x.length, (sx) => Math.round((sx - PAD.l) / step));

  return (
    <figure className="ch">
      <figcaption>{title}</figcaption>
      <Legend series={series} />
      <div className="ch-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${desc} Use left and right arrow keys to read values.`} {...svgProps}>
          <YAxis max={max} fmt={fmt} />
          {x.map((label, k) => showTick(k, x.length) && (
            <text key={label} x={px(k)} y={H - 8} textAnchor="middle" className="ch-tick">{label}</text>
          ))}
          {i !== null && <line x1={px(i)} x2={px(i)} y1={PAD.t} y2={H - PAD.b} className="ch-cross" />}
          {series.map((s, k) => (
            <path key={s.label} className={`ch-line ch-s${k + 1}`} d={s.values.map((v, j) => `${j ? 'L' : 'M'}${px(j)},${py(v)}`).join('')} />
          ))}
          {i !== null && series.map((s, k) => (
            <circle key={s.label} cx={px(i)} cy={py(s.values[i])} r={4.5} className={`ch-dot ch-s${k + 1}`} />
          ))}
        </svg>
        {i !== null && (
          <Tooltip x={px(i)} y={Math.min(...series.map((s) => py(s.values[i])))} title={`${xHead} ${x[i]}`} series={series} i={i} fmt={fmt} />
        )}
      </div>
      <TableView x={x} series={series} fmt={fmt} xHead={xHead} />
    </figure>
  );
}

export function StackedBars({ title, x, series, fmt, xHead, desc }: {
  title: string; x: string[]; series: Series[]; fmt: Fmt; xHead: string; desc: string;
}) {
  const totals = x.map((_, j) => series.reduce((a, s) => a + s.values[j], 0));
  const max = niceMax(Math.max(...totals));
  const slot = (W - PAD.l - PAD.r) / x.length;
  const barW = Math.min(34, slot * 0.62);
  const py = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const { i, svgProps } = useSlot(x.length, (sx) => Math.floor((sx - PAD.l) / slot));
  const GAP = 2;
  const R = 4;

  return (
    <figure className="ch">
      <figcaption>{title}</figcaption>
      <Legend series={series} />
      <div className="ch-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${desc} Use left and right arrow keys to read values.`} {...svgProps}>
          <YAxis max={max} fmt={fmt} />
          {x.map((label, j) => {
            const bx = PAD.l + j * slot + (slot - barW) / 2;
            let base = py(0);
            return (
              <g key={label} className={i === null || i === j ? '' : 'ch-dim'}>
                {series.map((s, k) => {
                  const h = py(0) - py(s.values[j]);
                  const top = base - h;
                  const last = k === series.length - 1;
                  // 2px surface gap between stacked segments; only the top segment gets rounded corners.
                  const y0 = top + (k > 0 ? GAP : 0);
                  const hh = Math.max(0, base - y0);
                  base = top;
                  if (hh <= 0) return null;
                  const r = last ? Math.min(R, hh) : 0;
                  return (
                    <path
                      key={s.label} className={`ch-bar ch-s${k + 1}`}
                      d={`M${bx},${y0 + hh} V${y0 + r} Q${bx},${y0} ${bx + r},${y0} H${bx + barW - r} Q${bx + barW},${y0} ${bx + barW},${y0 + r} V${y0 + hh} Z`}
                    />
                  );
                })}
                {showTick(j, x.length) && <text x={bx + barW / 2} y={H - 8} textAnchor="middle" className="ch-tick">{label}</text>}
              </g>
            );
          })}
        </svg>
        {i !== null && (
          <Tooltip x={PAD.l + i * slot + slot / 2} y={py(totals[i])} title={`${xHead} ${x[i]}`} series={series} i={i} fmt={fmt} total />
        )}
      </div>
      <TableView x={x} series={series} fmt={fmt} xHead={xHead} />
    </figure>
  );
}

/** Part-to-whole as labeled horizontal bars; values are shown, so no tooltip needed. */
export function ShareBars({ title, rows, fmt }: { title: string; rows: { label: string; value: number }[]; fmt: Fmt }) {
  const sum = rows.reduce((a, r) => a + r.value, 0);
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <figure className="ch">
      <figcaption>{title}</figcaption>
      <ul className="ch-share">
        {rows.map((r) => (
          <li key={r.label}>
            <span className="ch-share-label">{r.label}</span>
            <span className="ch-share-track"><span className="ch-share-fill ch-s1" style={{ width: `${(r.value / max) * 100}%` }} /></span>
            <span className="ch-share-val">{Math.round((r.value / sum) * 100)}% <small>{fmt(r.value)}</small></span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

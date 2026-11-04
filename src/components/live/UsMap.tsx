import type { PointerEvent, ReactNode } from 'react';
import type { Place } from './location';

/** The US map shared by the storm and data center views. */

export type UsMapData = { states: string; counties: Record<string, { n: string; d: string }> };
const VIEW_W = 975;
const VIEW_H = 610;

// One load for the whole session, whichever view asks first.
let mapRequest: Promise<UsMapData> | null = null;
export function loadMap(signal: AbortSignal) {
  mapRequest ??= fetch('/data/us-counties.json', { signal }).then((r) => {
    if (!r.ok) throw new Error('Map data missing');
    return r.json();
  }).catch((e) => { mapRequest = null; throw e; });
  return mapRequest;
}

export function UsMap({ map, label, children, tip, onPoint, you }: {
  map: UsMapData; label: string; children: ReactNode; tip: { x: number; y: number; text: ReactNode } | null; you: Place | null;
  onPoint?: (e: PointerEvent<SVGSVGElement>) => void;
}) {
  return (
    <div className="lv-us">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={label} onPointerMove={onPoint} onPointerLeave={onPoint}>
        <clipPath id="lv-us-clip"><path d={map.states} /></clipPath>
        <path d={map.states} className="lv-us-land" />
        {children}
        <path d={map.states} className="lv-us-lines" />
        {you && inLower48(you) && <circle cx={xy(you.lon, you.lat)[0]} cy={xy(you.lon, you.lat)[1]} r={8} className="lv-you" />}
      </svg>
      {tip && (
        <div className={`ch-tip ${tip.y < 35 ? 'lv-tip-under' : ''}`} role="status" style={{ left: `clamp(7rem, ${tip.x}%, calc(100% - 7rem))`, top: `${tip.y}%` }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}

// The conic projection behind the county map's lower 48, so NOAA's lat/lon shapes land on it.
const RAD = Math.PI / 180;
const n = (Math.sin(29.5 * RAD) + Math.sin(45.5 * RAD)) / 2;
const C = Math.cos(29.5 * RAD) ** 2 + 2 * n * Math.sin(29.5 * RAD);
const conic = (lon: number, lat: number) => {
  const rho = Math.sqrt(C - 2 * n * Math.sin(lat * RAD)) / n;
  const theta = n * (lon + 96) * RAD;
  return [rho * Math.sin(theta), -rho * Math.cos(theta)];
};
const [ORIGIN_X, ORIGIN_Y] = conic(-96.6, 38.7);
export function xy(lon: number, lat: number) {
  const [x, y] = conic(lon, lat);
  return [487.5 + 1300 * (x - ORIGIN_X), 305 - 1300 * (y - ORIGIN_Y)];
}
export const inLower48 = (p: Place) => p.us && p.lat > 24 && p.lat < 50 && p.lon > -126 && p.lon < -66;


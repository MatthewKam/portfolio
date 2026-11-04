import { useEffect, useMemo, useRef, useState } from 'react';
import { RangeChart, StackedBars, useWidth } from '../demos/charts';
import { placeId, usePlace } from './location';
import { Panel, PollStatus, Stat, Stats, Waiting } from './Panel';
import { getJson, usePolled } from './useLive';

/**
 * Open-Meteo weather for a handful of cities. Five years of daily history loads
 * once per city, and only the recent call polls, so changing range never waits
 * on the network. Everything is stored metric and converted when drawn.
 */

const CITIES = [
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'Chicago', lat: 41.88, lon: -87.63 },
  { name: 'Los Angeles', lat: 34.05, lon: -118.24 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'Tokyo', lat: 35.68, lon: 139.69 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
];
const RANGES = { month: '30 days', year: '1 year', five: '5 years' };
type Range = keyof typeof RANGES;
type Unit = 'F' | 'C';

// Conditions update every 15 minutes at the source, so 5 minutes catches each one soon after.
const RECENT_POLL_MS = 5 * 60_000;
const HISTORY_POLL_MS = 6 * 3_600_000;
const YEARS = 5;
const RECENT_DAYS = 14; // The archive runs about five days behind, so recent days come from the forecast API.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NARROW_PX = 520;
const FULL_MONTH_DAYS = 20; // Months with fewer recorded days are left blank in the grid.

type Daily = { time: string[]; temperature_2m_max: (number | null)[]; temperature_2m_min: (number | null)[]; precipitation_sum: (number | null)[] };
type Day = { date: string; high: number; low: number; rain: number };
type City = (typeof CITIES)[number];

function toDays(d: Daily): Day[] {
  return d.time.flatMap((date, i) => {
    const high = d.temperature_2m_max[i];
    const low = d.temperature_2m_min[i];
    return high === null || low === null ? [] : [{ date, high, low, rain: d.precipitation_sum[i] ?? 0 }];
  });
}

const VARS = 'daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto';
const dateShift = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

async function loadRecent(city: City, signal: AbortSignal) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&${VARS}`
    + `&current=temperature_2m,apparent_temperature,wind_speed_10m&past_days=${RECENT_DAYS}&forecast_days=7`;
  const r = await getJson<{ daily: Daily; current: { time: string; temperature_2m: number; apparent_temperature: number; wind_speed_10m: number } }>(url, signal);
  return { city: city.name, days: toDays(r.daily), current: r.current };
}

async function loadHistory(city: City, signal: AbortSignal) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${city.lat}&longitude=${city.lon}&${VARS}`
    + `&start_date=${dateShift(-YEARS * 365 - 1)}&end_date=${dateShift(-RECENT_DAYS + 7)}`;
  const r = await getJson<{ daily: Daily }>(url, signal);
  return { city: city.name, days: toDays(r.daily) };
}

// Parts, not new Date(iso): a date-only string parses as UTC and can land on the day before.
const parts = (iso: string) => iso.split('-').map(Number) as [number, number, number];
const fullDate = (iso: string) => { const [y, m, d] = parts(iso); return `${MONTHS[m - 1]} ${d}, ${y}`; };
const shortDate = (iso: string) => { const [, m, d] = parts(iso); return `${MONTHS[m - 1]} ${d}`; };
const monthYear = (iso: string) => { const [y, m] = parts(iso); return `${MONTHS[m - 1]} ’${String(y).slice(2)}`; };
const mean = (ns: number[]) => ns.reduce((a, n) => a + n, 0) / ns.length;
const midpoint = (d: Day) => (d.high + d.low) / 2;
const dayOfYear = (iso: string) => { const [y, m, d] = parts(iso); return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000); };

/** Groups days in order; a new bucket starts whenever `key` changes. */
function bucket(days: Day[], key: (d: Day, i: number) => string | number) {
  const out: { date: string; days: Day[] }[] = [];
  let last: string | number | undefined;
  days.forEach((d, i) => {
    const k = key(d, i);
    if (k !== last || !out.length) out.push({ date: d.date, days: [] });
    last = k;
    out[out.length - 1].days.push(d);
  });
  return out;
}

/** Each month against the average of that month across all the years shown. */
function Anomalies({ days, today, unit }: { days: Day[]; today: string; unit: Unit }) {
  const { years, cells, peak } = useMemo(() => {
    const seen: Record<string, number[]> = {};
    for (const d of days) {
      if (d.date > today) continue;
      (seen[d.date.slice(0, 7)] ??= []).push(midpoint(d));
    }
    const months = Object.entries(seen).filter(([, v]) => v.length >= FULL_MONTH_DAYS).map(([k, v]) => ({ y: +k.slice(0, 4), m: +k.slice(5), v: mean(v) }));
    const normal = MONTHS.map((_, i) => mean(months.filter((c) => c.m === i + 1).map((c) => c.v)));
    const cells: Record<string, number> = {};
    for (const c of months) cells[`${c.y}-${c.m}`] = c.v - normal[c.m - 1];
    const years = [...new Set(months.map((c) => c.y))].sort((a, b) => b - a);
    return { years, cells, peak: Math.max(1, ...Object.values(cells).map(Math.abs)) };
  }, [days, today]);
  const scale = unit === 'F' ? 1.8 : 1;

  return (
    <figure className="lv-anom">
      <figcaption>Warmer or colder than usual, by month</figcaption>
      <p className="lv-anom-note">°{unit} away from that month's average across these years.</p>
      <div className="lv-anom-wrap">
        <table>
          <thead><tr><td />{MONTHS.map((m) => <th key={m} scope="col" aria-label={m}>{m[0]}<span className="lv-rest">{m.slice(1)}</span></th>)}</tr></thead>
          <tbody>
            {years.map((y) => (
              <tr key={y}>
                <th scope="row">{y}</th>
                {MONTHS.map((m, i) => {
                  const v = cells[`${y}-${i + 1}`];
                  if (v === undefined) return <td key={m} />;
                  const n = Math.round(v * scale);
                  // A square root keeps mild months visible next to one extreme month.
                  const strength = n === 0 ? 0 : Math.round(Math.sqrt(Math.abs(v) / peak) * 70);
                  return (
                    <td key={m} title={`${m} ${y}: ${n > 0 ? '+' : ''}${n}°${unit}`} style={{ background: `color-mix(in srgb, var(${v >= 0 ? '--warm' : '--cool'}) ${strength}%, var(--mid))` }}>
                      {n > 0 ? '+' : n < 0 ? '−' : ''}{Math.abs(n)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="ch-legend lv-anom-key">
        <li><span className="lv-chip lv-cool" aria-hidden="true" />Colder</li>
        <li><span className="lv-chip" aria-hidden="true" />About usual</li>
        <li><span className="lv-chip lv-warm" aria-hidden="true" />Warmer</li>
      </ul>
    </figure>
  );
}

export default function Weather() {
  const [cityName, setCityName] = useState(CITIES[0].name);
  const [range, setRange] = useState<Range>('year');
  const [unit, setUnit] = useState<Unit>('F');
  const you = usePlace();
  const cities = you ? [{ name: you.name, lat: you.lat, lon: you.lon }, ...CITIES.filter((c) => c.name !== you.name)] : CITIES;
  const city = cities.find((c) => c.name === cityName) ?? cities[0];
  useEffect(() => { if (you) setCityName(you.name); }, [placeId(you)]);

  const recent = usePolled((s) => loadRecent(city, s), RECENT_POLL_MS, city.name);
  const history = usePolled((s) => loadHistory(city, s), HISTORY_POLL_MS, city.name);

  // While a new city loads the two calls land separately, so hold the last matching pair.
  const shown = useRef<{ recent: NonNullable<typeof recent.data>; history: Day[] } | null>(null);
  if (recent.data && history.data?.city === recent.data.city) shown.current = { recent: recent.data, history: history.data.days };
  else if (recent.data && history.failed && recent.data.city === city.name) shown.current = { recent: recent.data, history: [] };
  const view = shown.current;

  const days = useMemo(() => {
    if (!view) return [];
    const byDate = new Map(view.history.map((d) => [d.date, d]));
    for (const d of view.recent.days) byDate.set(d.date, d);
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [view]);

  const hasHistory = (view?.history.length ?? 0) > 0;
  const active: Range = hasHistory ? range : 'month';
  const today = view?.recent.current.time.slice(0, 10) ?? '';
  const temp = (c: number) => (unit === 'F' ? c * 1.8 + 32 : c);
  const deg = (c: number) => `${Math.round(temp(c))}°`;
  const fmtDeg = (n: number) => `${Math.round(n)}°`;
  const rainValue = (mm: number) => (unit === 'F' ? mm / 25.4 : mm);
  const fmtRain = (n: number) => (unit === 'F' ? `${n.toFixed(n < 10 ? 1 : 0)} in` : `${Math.round(n)} mm`);

  const [body, bodyW] = useWidth();
  const coarse = active === 'five' || (active === 'year' && bodyW < NARROW_PX);

  const chart = useMemo(() => {
    const window = active === 'month' ? 37 : active === 'year' ? 372 : Infinity;
    const slice = days.slice(-window);
    // A chart is only so wide: more days than pixels would be noise, so those views are weekly.
    const temps = coarse ? bucket(slice, (_, i) => Math.floor(i / 7)) : slice.map((d) => ({ date: d.date, days: [d] }));
    const rain = active === 'month' ? slice.map((d) => ({ date: d.date, days: [d] })) : bucket(slice, (d) => d.date.slice(0, 7));
    return { temps, rain };
  }, [days, active, coarse]);

  const stats = useMemo(() => {
    const past = days.filter((d) => d.date <= today);
    const week = past.slice(-7);
    if (!week.length) return null;
    const thisYear = +today.slice(0, 4);
    const doy = dayOfYear(today);
    // The same week of the calendar in earlier years, wrapping around New Year.
    const usual = past.filter((d) => {
      const gap = Math.abs(dayOfYear(d.date) - (doy - 3));
      return +d.date.slice(0, 4) < thisYear && Math.min(gap, 365 - gap) <= 3;
    });
    return {
      today: days.find((d) => d.date === today),
      gap: usual.length ? mean(week.map(midpoint)) - mean(usual.map(midpoint)) : null,
      rain: past.slice(-30).reduce((a, d) => a + d.rain, 0),
    };
  }, [days, today]);

  const now = view?.recent.current;
  const gap = stats?.gap === null || stats?.gap === undefined ? null : stats.gap * (unit === 'F' ? 1.8 : 1);
  const held = recent.pending || history.pending;

  return (
    <Panel
      title="Weather over time"
      lede="Current conditions refresh as the source publishes them, about every 15 minutes, on top of five years of daily records and a 7-day forecast."
      source="Open-Meteo"
      sourceHref="https://open-meteo.com/"
      status={<PollStatus updatedAt={recent.updatedAt} failed={recent.failed} />}
      controls={
        <>
          <label className="lv-select">
            <span className="visually-hidden">City</span>
            <select value={city.name} onChange={(e) => setCityName(e.target.value)}>
              {cities.map((c) => <option key={c.name}>{c.name}</option>)}
            </select>
          </label>
          <div className="lv-seg" role="group" aria-label="Time range">
            {(Object.keys(RANGES) as Range[]).map((r) => (
              <button key={r} type="button" aria-pressed={active === r} disabled={!hasHistory && r !== 'month'} onClick={() => setRange(r)}>{RANGES[r]}</button>
            ))}
          </div>
          <div className="lv-seg" role="group" aria-label="Units">
            {(['F', 'C'] as Unit[]).map((u) => (
              <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)}>°{u}</button>
            ))}
          </div>
        </>
      }
    >
      <div ref={body}>
      {!view || !now || !stats ? <Waiting failed={recent.failed} retry={recent.retry} what="the weather data" /> : (
        <div className={`lv-body ${held && view.recent.city !== city.name ? 'lv-held' : ''}`}>
          <Stats>
            <Stat
              label={`Now in ${view.recent.city}`} value={deg(now.temperature_2m)}
              detail={`Feels like ${deg(now.apparent_temperature)}, wind ${Math.round(unit === 'F' ? now.wind_speed_10m / 1.609 : now.wind_speed_10m)} ${unit === 'F' ? 'mph' : 'km/h'}`}
            />
            {stats.today && <Stat label="Today" value={`${deg(stats.today.high)} / ${deg(stats.today.low)}`} detail={`Reading from ${now.time.slice(11)} local time`} />}
            {gap !== null && <Stat label="Past 7 days" value={`${gap >= 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)}°`} detail="against this week in past years" />}
            <Stat label="Rain, past 30 days" value={fmtRain(rainValue(stats.rain))} />
          </Stats>
          <RangeChart
            title={`Daily highs and lows${coarse ? ', weekly average' : ''} (dashed is forecast)`}
            x={chart.temps.map((b) => fullDate(b.date))}
            ticks={chart.temps.map((b) => (active === 'month' ? shortDate(b.date) : monthYear(b.date)))}
            high={{ label: 'High', values: chart.temps.map((b) => temp(mean(b.days.map((d) => d.high)))) }}
            low={{ label: 'Low', values: chart.temps.map((b) => temp(mean(b.days.map((d) => d.low)))) }}
            split={chart.temps.findIndex((b) => b.date > today)}
            fmt={fmtDeg}
            xHead="Date"
            desc={`Daily high and low temperatures in ${view.recent.city}, with the coming week as a forecast.`}
          />
          <div className="lv-gap" />
          <div className="lv-split">
            <StackedBars
              title={`Rain ${active === 'month' ? 'per day' : 'per month'}, including the forecast`}
              x={chart.rain.map((b) => (active === 'month' ? shortDate(b.date) : monthYear(b.date)))}
              series={[{ label: 'Rain', values: chart.rain.map((b) => rainValue(b.days.reduce((a, d) => a + d.rain, 0))) }]}
              fmt={fmtRain}
              xHead="Date"
              desc={`Bars of rainfall in ${view.recent.city}.`}
            />
            {hasHistory
              ? <Anomalies days={days} today={today} unit={unit} />
              : <div className="lv-wait"><p>Five-year records aren't available right now, so this shows recent days only.</p></div>}
          </div>
        </div>
      )}
      </div>
    </Panel>
  );
}

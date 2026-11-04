import { useMemo, useState, type PointerEvent, type ReactNode } from 'react';
import { alertKey, fetchAlerts, KINDS, type Alert, type Kind, type RawAlert } from './alerts';
import { placeId, usePlace, type Place } from './location';
import { Here, Panel, PollStatus, Stat, Stats, Waiting } from './Panel';
import { getJson, useNow, usePolled } from './useLive';
import { inLower48, loadMap, UsMap, xy } from './UsMap';

/**
 * Storm watch, on the three timescales forecasts actually work at: alerts from
 * the National Weather Service now, two weeks of city forecasts, and NOAA's seasonal
 * odds. Only the open view fetches. No view names a storm further out than its
 * source does, because nobody can place a storm months ahead.
 */

const ALERTS_POLL_MS = 2 * 60_000;
const FORECAST_POLL_MS = 30 * 60_000;
const OUTLOOK_POLL_MS = 6 * 3_600_000;
const HOUR = 3_600_000;

/* ---------- Right now: active alerts ---------- */

async function loadAlerts(you: Place | null, signal: AbortSignal) {
  const [alerts, map, local] = await Promise.all([
    fetchAlerts(signal),
    loadMap(signal),
    // Losing this only loses the "your area" line, so it can't fail the whole view.
    you?.us ? getJson<{ features: RawAlert[] }>(`https://api.weather.gov/alerts/active?status=actual&point=${you.lat},${you.lon}`, signal).catch(() => null) : null,
  ]);
  const here = local && new Set(local.features.map(alertKey));
  return { alerts, map, here };
}

const when = (t: number) => new Date(t).toLocaleString([], { weekday: 'short', hour: 'numeric' });
function span(ms: number) {
  const h = Math.max(1, Math.round(ms / HOUR));
  return h < 48 ? `${h} hr` : `${Math.round(h / 24)} days`;
}

function NowView({ tabs }: { tabs: ReactNode }) {
  const you = usePlace();
  const { data, failed, updatedAt, retry } = usePolled((s) => loadAlerts(you, s), ALERTS_POLL_MS, placeId(you));
  const now = useNow(30_000);
  const [hover, setHover] = useState<{ x: number; y: number; fips: string } | null>(null);
  const alerts = useMemo(() => {
    const live = data?.alerts.filter((a) => a.end > now) ?? [];
    return live.sort((a, b) => Number(data?.here?.has(b.key)) - Number(data?.here?.has(a.key)));
  }, [data, now]);
  const mine = alerts.filter((a) => data?.here?.has(a.key));

  // A county under several alerts shows the most severe, because the list is sorted that way.
  const byCounty = useMemo(() => {
    const m = new Map<string, Alert[]>();
    for (const a of alerts) for (const f of a.fips) m.set(f, [...(m.get(f) ?? []), a]);
    return m;
  }, [alerts]);

  // Alerts are issued for forecast zones, and the map can only fill whole counties, so a
  // viewer can sit in a filled county without being under the alert. Say so rather than
  // leave the pin and the "no alerts" line looking like they disagree.
  const sameCounty = useMemo(() => {
    if (!you || !data || !inLower48(you)) return null;
    const [x, y] = xy(you.lon, you.lat);
    for (const [fips, list] of byCounty) {
      const county = data.map.counties[fips];
      if (county && contains(pathRings(county.d), x, y)) return { name: county.n, event: list[0].event };
    }
    return null;
  }, [byCounty, data, you]);

  const onPoint = (e: PointerEvent<SVGSVGElement>) => {
    const fips = e.type === 'pointerleave' ? undefined : (e.target as Element).getAttribute('data-fips') ?? undefined;
    if (!fips) return setHover(null);
    const box = e.currentTarget.getBoundingClientRect();
    setHover({ fips, x: ((e.clientX - box.left) / box.width) * 100, y: ((e.clientY - box.top) / box.height) * 100 });
  };

  const longest = alerts.reduce<Alert | null>((a, b) => (!a || b.end - b.start > a.end - a.start ? b : a), null);
  const shownKinds = (Object.keys(KINDS) as Kind[]).filter((k) => alerts.some((a) => a.kind === k));

  return (
    <Shell lede="Storm alerts in force across the US, down to the county, with when each one starts and ends. Checked every two minutes." source="National Weather Service" href="https://www.weather.gov/" status={<PollStatus updatedAt={updatedAt} failed={failed} />} tabs={tabs}>
      {!data ? <Waiting failed={failed} retry={retry} what="the National Weather Service" /> : (
        <div className="lv-body">
          <Stats>
            <Stat label="Storm alerts" value={alerts.length} detail={alerts.length ? `${alerts.filter((a) => a.start <= now).length} under way` : 'nothing active'} />
            <Stat label="Counties affected" value={byCounty.size.toLocaleString()} />
            {longest && <Stat label="Longest" value={span(longest.end - longest.start)} detail={longest.event} />}
          </Stats>
          {you && (
            <Here>
              {!you.us ? <>Storm alerts only cover the US, so there's nothing here for <b>{you.name}</b>.</>
                : !data.here ? <>Alerts for <b>{you.name}</b> aren't available right now.</>
                : mine.length ? <><b>{you.name}:</b> {mine.map((a) => `${a.event}, ${a.start <= now ? 'under way' : `from ${when(a.start)}`}, until ${when(a.end)}`).join('; ')}.</>
                : sameCounty ? <>No storm alerts for <b>{you.name}</b> right now, but a {sameCounty.event} covers other parts of {sameCounty.name} County.</>
                : <>No storm alerts for <b>{you.name}</b> right now.</>}
            </Here>
          )}
          <div className="lv-split lv-split-even">
            <div>
              <UsMap
                map={data.map} onPoint={onPoint} you={you}
                label={`US county map with ${byCounty.size} counties under storm alerts. The same alerts are listed beside it.`}
                tip={hover && byCounty.has(hover.fips) ? {
                  x: hover.x, y: hover.y,
                  text: <><strong>{data.map.counties[hover.fips]?.n} County</strong>{byCounty.get(hover.fips)?.map((a) => <span key={a.key}>{a.event}, until {when(a.end)}</span>)}</>,
                } : null}
              >
                {[...byCounty].reverse().map(([fips, list]) => {
                  const county = data.map.counties[fips];
                  return county && <path key={fips} d={county.d} data-fips={fips} className={`lv-county lv-k-${list[0].kind}`} />;
                })}
              </UsMap>
              {shownKinds.length > 0 && (
                <ul className="ch-legend lv-key">
                  {shownKinds.map((k) => <li key={k}><span className={`lv-chip lv-k-${k}`} aria-hidden="true" />{KINDS[k]}</li>)}
                </ul>
              )}
              <p className="lv-caveat">A county is filled when any part of it is under an alert.</p>
            </div>
            {alerts.length === 0 ? <div className="lv-wait"><p>No storm alerts are active in the US right now.</p></div> : (
              <ol className="lv-alerts">
                {alerts.map((a) => (
                  <li key={a.key} className={data.here?.has(a.key) ? 'lv-mine' : ''}>
                    <strong><i className={`lv-chip lv-k-${a.kind}`} aria-hidden="true" />{a.event}</strong>
                    <span className="lv-where" title={a.areas.join(', ')}>{[...new Set(a.areas)].join(', ')}</span>
                    <span className="lv-when">
                      {a.start <= now ? `Under way, ends ${when(a.end)}` : `${when(a.start)} to ${when(a.end)}`}
                      {' · '}{a.open ? 'at least ' : ''}{a.start <= now ? `${span(a.end - now)} left` : span(a.end - a.start)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ---------- Next two weeks: city forecasts ---------- */

const CITIES = [
  { name: 'Seattle', lat: 47.61, lon: -122.33 },
  { name: 'San Francisco', lat: 37.77, lon: -122.42 },
  { name: 'Los Angeles', lat: 34.05, lon: -118.24 },
  { name: 'Denver', lat: 39.74, lon: -104.99 },
  { name: 'Dallas', lat: 32.78, lon: -96.8 },
  { name: 'Minneapolis', lat: 44.98, lon: -93.27 },
  { name: 'Chicago', lat: 41.88, lon: -87.63 },
  { name: 'Atlanta', lat: 33.75, lon: -84.39 },
  { name: 'Miami', lat: 25.76, lon: -80.19 },
  { name: 'Washington, DC', lat: 38.91, lon: -77.04 },
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'Boston', lat: 42.36, lon: -71.06 },
];
const SNOW_IN = 0.1;
const RAIN_IN = 0.5;
const GUST_MPH = 40;
const FIRM_DAYS = 7; // Forecast skill for a specific day falls away after about a week.

type CityDay = { date: string; snow: number; rain: number; gust: number };
type Stormy = { kind: Kind; text: string; title: string };

function classify(d: CityDay): Stormy | null {
  if (d.snow >= SNOW_IN) return { kind: 'winter', text: d.snow.toFixed(1), title: `${d.snow.toFixed(1)} in of snow` };
  if (d.rain >= RAIN_IN) return { kind: 'flood', text: d.rain.toFixed(1), title: `${d.rain.toFixed(1)} in of rain` };
  if (d.gust >= GUST_MPH) return { kind: 'wind', text: String(Math.round(d.gust)), title: `gusts to ${Math.round(d.gust)} mph` };
  return null;
}

type ForecastRow = { daily: { time: string[]; snowfall_sum: (number | null)[]; precipitation_sum: (number | null)[]; wind_gusts_10m_max: (number | null)[] } };

async function loadForecast(you: Place | null, signal: AbortSignal) {
  const cities = you ? [{ name: you.name, lat: you.lat, lon: you.lon }, ...CITIES.filter((c) => c.name !== you.name)] : CITIES;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${cities.map((c) => c.lat).join(',')}&longitude=${cities.map((c) => c.lon).join(',')}`
    + '&daily=snowfall_sum,precipitation_sum,wind_gusts_10m_max&forecast_days=16&timezone=auto&precipitation_unit=inch&wind_speed_unit=mph';
  const rows = await getJson<ForecastRow[]>(url, signal);
  // Each city's days start in its own time zone, so keep only the dates all of them share.
  const shared = rows[0].daily.time.filter((date) => rows.every((r) => r.daily.time.includes(date)));
  return rows.map((r, i) => ({
    city: cities[i].name,
    days: shared.map((date): CityDay => {
      const j = r.daily.time.indexOf(date);
      return { date, snow: r.daily.snowfall_sum[j] ?? 0, rain: r.daily.precipitation_sum[j] ?? 0, gust: r.daily.wind_gusts_10m_max[j] ?? 0 };
    }),
  }));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${d}`; };

function ForecastView({ tabs }: { tabs: ReactNode }) {
  const you = usePlace();
  const { data, failed, updatedAt, retry } = usePolled((s) => loadForecast(you, s), FORECAST_POLL_MS, placeId(you));

  const summary = useMemo(() => {
    if (!data) return null;
    const runs = data.flatMap(({ city, days }) => {
      const start = days.findIndex((d) => classify(d));
      if (start < 0) return [];
      let end = start;
      while (end + 1 < days.length && classify(days[end + 1])) end++;
      return [{ city, start, end, kind: classify(days[start])?.kind as Kind, from: days[start].date, to: days[end].date }];
    }).sort((a, b) => a.start - b.start);
    const totals = data.map(({ city, days }) => ({ city, snow: days.reduce((a, d) => a + d.snow, 0) })).sort((a, b) => b.snow - a.snow);
    const gusts = data.flatMap(({ city, days }) => days.map((d) => ({ city, gust: d.gust, date: d.date }))).sort((a, b) => b.gust - a.gust);
    return { runs, snowiest: totals[0], gust: gusts[0], soon: runs.filter((r) => r.start < FIRM_DAYS).length };
  }, [data]);

  return (
    <Shell lede="Snow, heavy rain and strong wind for 12 US cities, west to east. A stretch of colored days shows how long a storm should last." source="Open-Meteo" href="https://open-meteo.com/" status={<PollStatus updatedAt={updatedAt} failed={failed} />} tabs={tabs}>
      {!data || !summary ? <Waiting failed={failed} retry={retry} what="the forecast" /> : (
        <div className="lv-body">
          <Stats>
            <Stat label="Places with a storm this week" value={`${summary.soon} of ${data.length}`} />
            <Stat label="Most snow ahead" value={summary.snowiest.snow > 0 ? `${summary.snowiest.snow.toFixed(1)} in` : 'None'} detail={summary.snowiest.snow > 0 ? summary.snowiest.city : 'in any of these cities'} />
            <Stat label="Strongest gust" value={`${Math.round(summary.gust.gust)} mph`} detail={`${summary.gust.city}, ${dayLabel(summary.gust.date)}`} />
          </Stats>
          {you && (() => {
            const run = summary.runs.find((r) => r.city === you.name);
            return (
              <Here>
                {run
                  ? <><b>{you.name}:</b> next stormy stretch {run.from === run.to ? `on ${dayLabel(run.from)}` : `from ${dayLabel(run.from)} to ${dayLabel(run.to)}`}, {run.end - run.start + 1} day{run.end > run.start ? 's' : ''}{run.start >= FIRM_DAYS ? ', though that far out it may change' : ''}.</>
                  : <>Nothing stormy in the forecast for <b>{you.name}</b>.</>}
              </Here>
            );
          })()}
          <div className="lv-grid-wrap" tabIndex={0} role="region" aria-label="Forecast by city and day">
            <table className="lv-grid">
              <thead>
                <tr>
                  <td />
                  {data[0].days.map((d, i) => {
                    const [, , day] = d.date.split('-').map(Number);
                    return <th key={d.date} scope="col" aria-label={dayLabel(d.date)} className={i >= FIRM_DAYS ? 'lv-later' : ''}>{i === 0 || day === 1 ? dayLabel(d.date) : day}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {data.map(({ city, days }) => (
                  <tr key={city} className={city === you?.name ? 'lv-mine' : ''}>
                    <th scope="row">{city}</th>
                    {days.map((d, i) => {
                      const s = classify(d);
                      return <td key={d.date} className={`${s ? `lv-k-${s.kind}` : ''} ${i >= FIRM_DAYS ? 'lv-later' : ''}`} title={s ? `${city}, ${dayLabel(d.date)}: ${s.title}` : undefined}>{s?.text}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="ch-legend lv-key">
            <li><span className="lv-chip lv-k-winter" aria-hidden="true" />Snow, inches</li>
            <li><span className="lv-chip lv-k-flood" aria-hidden="true" />Rain of {RAIN_IN}+ in, inches</li>
            <li><span className="lv-chip lv-k-wind" aria-hidden="true" />Gusts of {GUST_MPH}+, mph</li>
          </ul>
          <p className="lv-caveat">Days past the first week are faded: they show a possibility, not a date to plan around.</p>
          {summary.runs.length > 0 && (
            <div className="lv-feed">
              <h3>Next stormy stretch in each city</h3>
              <ol>
                {summary.runs.map((r) => (
                  <li key={r.city}>
                    <b>{r.city}</b>
                    <span>{r.from === r.to ? dayLabel(r.from) : `${dayLabel(r.from)} to ${dayLabel(r.to)}`}, {r.end - r.start + 1} day{r.end > r.start ? 's' : ''}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

/* ---------- This winter: NOAA seasonal odds ---------- */

const OUTLOOK = (measure: Measure, lead: number) => `https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/cpc_sea_${measure}_outlk/MapServer/${lead}/query`;
type Measure = 'temp' | 'precip';
const LEADS = [0, 1, 2]; // Layer numbers: the next three overlapping three-month seasons NOAA has published.

type OutlookFeature = {
  properties: { cat: string; prob: number; valid_seas: string };
  geometry: { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };
};

const seasonName = (code: string) => {
  const letters = code.split(' ')[0];
  const start = 'JFMAMJJASONDJF'.indexOf(letters);
  return `${MONTHS[start]}–${MONTHS[(start + 2) % 12]}`;
};

async function loadSeasons(signal: AbortSignal) {
  return Promise.all(LEADS.map(async (lead) => {
    const r = await getJson<{ features: OutlookFeature[] }>(`${OUTLOOK('temp', lead)}?where=1%3D1&outFields=valid_seas&returnGeometry=false&resultRecordCount=1&f=geojson`, signal);
    return seasonName(r.features[0].properties.valid_seas);
  }));
}

function outlookRings(g: OutlookFeature['geometry']) {
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return polygons.flat().filter((ring) => {
    // Alaska and Hawaii sit in insets on the map, so this projection would misplace them.
    const lat = ring.reduce((a, p) => a + p[1], 0) / ring.length;
    const lon = ring.reduce((a, p) => a + p[0], 0) / ring.length;
    return lat < 50 && lat > 24 && lon > -126;
  });
}

const pathRings = (d: string) => d.split('Z').filter(Boolean).map((r) => r.slice(1).split('L').map((p) => p.split(' ').map(Number)));

// Even-odd across all rings, so a hole cut out of a shape doesn't count as inside it.
function contains(rings: number[][][], lon: number, lat: number) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

async function loadOutlook(measure: Measure, lead: number, signal: AbortSignal) {
  const url = `${OUTLOOK(measure, lead)}?where=1%3D1&outFields=valid_seas,prob,cat&outSR=4326&f=geojson&geometryPrecision=2&maxAllowableOffset=0.1`;
  const [{ features }, map] = await Promise.all([getJson<{ features: OutlookFeature[] }>(url, signal), loadMap(signal)]);
  const shapes = features
    .filter((f) => f.properties.cat === 'Above' || f.properties.cat === 'Below')
    .sort((a, b) => a.properties.prob - b.properties.prob) // Stronger odds nest inside weaker ones.
    .map((f, i) => {
      const rings = outlookRings(f.geometry);
      const d = rings.map((ring) => `M${ring.map(([lon, lat]) => xy(lon, lat).map((v) => v.toFixed(1)).join(' ')).join('L')}Z`).join('');
      return { id: i, cat: f.properties.cat, prob: f.properties.prob, rings, d };
    });
  return { shapes, map };
}

function WinterView({ tabs }: { tabs: ReactNode }) {
  const [measure, setMeasure] = useState<Measure>('temp');
  const [lead, setLead] = useState(1);
  const seasons = usePolled(loadSeasons, OUTLOOK_POLL_MS);
  const { data, failed, pending, updatedAt, retry } = usePolled((s) => loadOutlook(measure, lead, s), OUTLOOK_POLL_MS, `${measure}-${lead}`);
  const words = measure === 'temp' ? { Above: 'warmer', Below: 'colder' } : { Above: 'wetter', Below: 'drier' };
  // Warm and dry share a color, cool and wet the other, so the map reads the same way in both modes.
  const warmSide = measure === 'temp' ? 'Above' : 'Below';
  const you = usePlace();
  const covered = you && inLower48(you);
  const odds = covered ? data?.shapes.filter((s) => contains(s.rings, you.lon, you.lat)).at(-1) : undefined;
  const season = seasons.data?.[LEADS.indexOf(lead)] ?? 'this season';

  return (
    <Shell
      lede="NOAA's odds for the months ahead. These show which way a season leans by region, not when or where a storm will hit: nobody can place one more than about a week out."
      source="NOAA Climate Prediction Center" href="https://www.cpc.ncep.noaa.gov/products/predictions/long_range/" status={<PollStatus updatedAt={updatedAt} failed={failed} />}
      tabs={tabs}
      extra={
        <>
          <div className="lv-seg" role="group" aria-label="Measure">
            <button type="button" aria-pressed={measure === 'temp'} onClick={() => setMeasure('temp')}>Temperature</button>
            <button type="button" aria-pressed={measure === 'precip'} onClick={() => setMeasure('precip')}>Rain & snow</button>
          </div>
          {seasons.data && (
            <div className="lv-seg" role="group" aria-label="Season">
              {seasons.data.map((name, i) => <button key={name} type="button" aria-pressed={lead === LEADS[i]} onClick={() => setLead(LEADS[i])}>{name}</button>)}
            </div>
          )}
        </>
      }
    >
      {!data ? <Waiting failed={failed} retry={retry} what="NOAA's outlook" /> : (
        <div className={`lv-body ${pending ? 'lv-held' : ''}`}>
          {you && (
            <Here>
              {!covered ? <>NOAA's map here covers the lower 48 states, so it can't say what to expect for <b>{you.name}</b>.</>
                : odds ? <><b>{you.name}:</b> a {odds.prob}% chance of a {words[odds.cat as 'Above' | 'Below']} than normal {season}.</>
                : <><b>{you.name}:</b> no clear lean for {season}. NOAA sees about equal odds either way.</>}
            </Here>
          )}
          <div className="lv-us-wide">
            <UsMap map={data.map} you={you} label={`Map of the lower 48 states showing where NOAA favors ${words.Above} or ${words.Below} than normal conditions.`} tip={null}>
              <g clipPath="url(#lv-us-clip)">
                {data.shapes.map((s) => (
                  <path key={s.id} d={s.d} className={`lv-odds ${s.cat === warmSide ? 'lv-odds-warm' : 'lv-odds-cool'}`} style={{ opacity: Math.min(0.85, (s.prob - 20) / 50) }}>
                    <title>{s.prob}% chance of {words[s.cat as 'Above' | 'Below']} than normal</title>
                  </path>
                ))}
              </g>
            </UsMap>
          </div>
          <ul className="ch-legend lv-key">
            <li><span className={`lv-chip ${measure === 'temp' ? 'lv-odds-warm' : 'lv-odds-cool'}`} aria-hidden="true" />Leaning {words.Above}</li>
            <li><span className={`lv-chip ${measure === 'temp' ? 'lv-odds-cool' : 'lv-odds-warm'}`} aria-hidden="true" />Leaning {words.Below}</li>
            <li><span className="lv-chip" aria-hidden="true" />No clear lean</li>
          </ul>
          <p className="lv-caveat">Deeper color means stronger odds, from about 33% to 60% or more. A lean isn't a promise, and Alaska and Hawaii aren't drawn in this view.</p>
        </div>
      )}
    </Shell>
  );
}

/* ---------- The panel ---------- */

function Shell({ lede, source, href, status, tabs, extra, children }: {
  lede: string; source: string; href: string; status: ReactNode; tabs: ReactNode; extra?: ReactNode; children: ReactNode;
}) {
  return (
    <Panel title="Storm watch" lede={lede} source={source} sourceHref={href} status={status} controls={<>{tabs}{extra}</>}>
      {children}
    </Panel>
  );
}

const VIEWS = { now: 'Right now', soon: 'Next 2 weeks', winter: 'This winter' };
type View = keyof typeof VIEWS;

export default function Storms() {
  const [view, setView] = useState<View>('now');
  const tabs = (
    <div className="lv-seg" role="group" aria-label="Timescale">
      {(Object.keys(VIEWS) as View[]).map((v) => (
        <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{VIEWS[v]}</button>
      ))}
    </div>
  );
  if (view === 'soon') return <ForecastView tabs={tabs} />;
  if (view === 'winter') return <WinterView tabs={tabs} />;
  return <NowView tabs={tabs} />;
}

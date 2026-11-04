import { useMemo, useState, type PointerEvent } from 'react';
import { ShareBars, StackedBars } from '../demos/charts';
import { Panel, PollStatus, Stat, Stats, Waiting } from './Panel';
import { getJson, usePolled } from './useLive';
import { inLower48, loadMap, UsMap, xy, type UsMapData } from './UsMap';

/**
 * The largest US AI data centers, from Epoch AI's satellite and permit research.
 * Reads a cached server function, because Epoch's files can't be fetched from a
 * browser, then a saved snapshot if that's unavailable.
 */

const POLL_MS = 6 * 3_600_000;
const OWNERS_SHOWN = 6;
const STATES_SHOWN = 6;

type Site = {
  name: string; owner: string; users: string; state: string | null; lat: number | null; lon: number | null;
  now: number; cost: number; planned: number; timeline: [string, number][];
};
type Dataset = { fetchedAt: string; sites: Site[] };
type Mapped = Site & { lat: number; lon: number };

async function load(signal: AbortSignal): Promise<{ data: Dataset; snapshot: boolean; map: UsMapData }> {
  const map = await loadMap(signal);
  try {
    return { data: await getJson<Dataset>('/api/datacenters', signal), snapshot: false, map };
  } catch (e) {
    if (signal.aborted) throw e;
    return { data: await getJson<Dataset>('/data/ai-datacenters.json', signal), snapshot: true, map };
  }
}

const gw = (mw: number) => `${(mw / 1000).toFixed(1)} GW`;
const mwText = (mw: number) => `${Math.round(mw).toLocaleString()} MW`;
const radius = (mw: number) => 5 + Math.sqrt(mw) / 3.5;

/** Total scheduled power at the end of each quarter: each site holds its last reading until the next. */
function quarters(sites: Site[]) {
  const today = new Date().toISOString().slice(0, 10);
  const first = 2023;
  const last = Math.max(...sites.flatMap((s) => s.timeline.map((t) => +t[0].slice(0, 4))));
  const out: { label: string; past: number; ahead: number }[] = [];
  for (let y = first; y <= last; y++) {
    for (let q = 1; q <= 4; q++) {
      const end = `${y}-${String(q * 3).padStart(2, '0')}-31`;
      const total = sites.reduce((sum, s) => sum + (s.timeline.filter((t) => t[0] <= end).at(-1)?.[1] ?? 0), 0);
      const done = end <= today;
      out.push({ label: `Q${q} ’${String(y).slice(2)}`, past: done ? total / 1000 : 0, ahead: done ? 0 : total / 1000 });
    }
  }
  // Plans run out before the decade does: stop there, or the flat tail looks like growth ending.
  const peak = Math.max(...out.map((q) => q.past + q.ahead));
  return out.slice(0, out.findIndex((q) => q.past + q.ahead >= peak) + 1);
}

function shares(sites: Site[], key: (s: Site) => string, shown: number, rest: string) {
  const totals = new Map<string, number>();
  for (const s of sites) totals.set(key(s), (totals.get(key(s)) ?? 0) + s.planned);
  const ranked = [...totals].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  const tail = ranked.slice(shown);
  const other = tail.reduce((a, r) => a + r.value, 0);
  return [...ranked.slice(0, shown), ...(tail.length ? [{ label: rest, value: other, more: tail }] : [])];
}

export default function DataCenters() {
  const { data, failed, updatedAt, retry } = usePolled(load, POLL_MS);
  const [hover, setHover] = useState<{ site: Mapped; x: number; y: number } | null>(null);
  const sites = data?.data.sites ?? [];

  const mapped = useMemo(() => sites.filter((s): s is Mapped => s.lat !== null && s.lon !== null).sort((a, b) => b.planned - a.planned), [data]);
  const rows = useMemo(() => [...sites].sort((a, b) => b.planned - a.planned), [data]);
  const trend = useMemo(() => (sites.length ? quarters(sites) : []), [data]);

  const onPoint = (e: PointerEvent<SVGSVGElement>) => {
    if (e.type === 'pointerleave') return setHover(null);
    const box = e.currentTarget.getBoundingClientRect();
    const scale = box.width / 975;
    const px = e.clientX - box.left;
    const py = e.clientY - box.top;
    let best: Mapped | null = null;
    let bestD = 26;
    for (const s of mapped) {
      const [x, y] = xy(s.lon, s.lat);
      const d = Math.hypot(x * scale - px, y * scale - py);
      if (d < bestD) { bestD = d; best = s; }
    }
    setHover(best && { site: best, x: (px / box.width) * 100, y: (py / box.height) * 100 });
  };

  const now = sites.reduce((a, s) => a + s.now, 0);
  const planned = sites.reduce((a, s) => a + s.planned, 0);
  const cost = sites.reduce((a, s) => a + s.cost, 0);
  const notBuilt = sites.filter((s) => s.now === 0).length;
  const byState = shares(sites, (s) => s.state ?? 'Not public', STATES_SHOWN, 'Other states');
  const stateNames = new Set(byState.slice(0, 3).map((r) => r.label));
  const topShare = sites.filter((s) => s.state && stateNames.has(s.state)).reduce((a, s) => a + s.planned, 0) / (planned || 1);

  return (
    <Panel
      title="AI data centers in the US"
      lede="The largest sites training and running AI, estimated from satellite images, permits and filings. This covers frontier AI sites, not every data center in the country."
      source="Epoch AI, AI data centers (CC BY)"
      sourceHref="https://epoch.ai/data/ai-data-centers"
      status={<PollStatus updatedAt={updatedAt} failed={failed} />}
    >
      {!data ? <Waiting failed={failed} retry={retry} what="the data center records" /> : (
        <div className="lv-body">
          <Stats>
            <Stat label="Sites tracked" value={sites.length} detail={`${notBuilt} with nothing online yet`} />
            <Stat label="Online now" value={gw(now)} detail="Epoch's current estimate" />
            <Stat label="Planned" value={gw(planned)} detail={`${(planned / (now || 1)).toFixed(1)}× what's online`} />
            <Stat label="Built so far" value={`$${Math.round(cost)}B`} detail="estimated, in 2025 dollars" />
          </Stats>
          <div className="lv-split lv-split-even">
            <div>
              <UsMap
                map={data.map} you={null} onPoint={onPoint}
                label={`Map of ${mapped.length} US AI data centers. Every site is in the table below.`}
                tip={hover && {
                  x: hover.x, y: hover.y,
                  text: <><strong>{hover.site.name}</strong><span>{hover.site.owner}</span><span>{hover.site.now ? `${mwText(hover.site.now)} now, ` : 'Not online yet, '}{mwText(hover.site.planned)} planned</span></>,
                }}
              >
                {mapped.filter((s) => inLower48({ lat: s.lat, lon: s.lon, name: s.name, us: true })).map((s) => {
                  const [cx, cy] = xy(s.lon, s.lat);
                  return <circle key={s.name} cx={cx} cy={cy} r={radius(s.planned)} className={`lv-dc ${s.now ? '' : 'lv-dc-future'} ${hover?.site.name === s.name ? 'lv-dc-on' : ''}`} />;
                })}
              </UsMap>
              <ul className="ch-legend lv-key">
                <li><span className="lv-chip lv-dc-key" aria-hidden="true" />Online</li>
                <li><span className="lv-chip lv-dc-key lv-dc-future" aria-hidden="true" />Not online yet</li>
              </ul>
              <p className="lv-caveat">Bigger dots have more power planned. {sites.length - mapped.length} sites with no public address aren't drawn but are in the table.</p>
            </div>
            <div className="lv-stack">
              <ShareBars title="Planned power by owner" rows={shares(sites, (s) => s.owner, OWNERS_SHOWN, 'Everyone else')} fmt={gw} />
              <div className="lv-gap" />
              <ShareBars title={`By state: the top 3 hold ${Math.round(topShare * 100)}%`} rows={byState} fmt={gw} />
            </div>
          </div>
          <div className="lv-gap" />
          <StackedBars
            title="Power scheduled across these sites, GW"
            x={trend.map((q) => q.label)}
            series={[{ label: 'To date', values: trend.map((q) => q.past) }, { label: 'Scheduled', values: trend.map((q) => q.ahead) }]}
            fmt={(n) => `${n.toFixed(1)} GW`}
            xHead="Quarter"
            desc="Bars of total scheduled power by quarter, rising through the end of the decade."
          />
          <p className="lv-caveat">Site timelines include scheduled milestones, so these totals run ahead of the current estimate above. Dates past today are plans and can slip, and the chart ends where published plans do.</p>
          <details className="ch-table">
            <summary>Show all {sites.length} sites</summary>
            <div className="ch-table-wrap lv-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Site</th><th scope="col">Owner</th><th scope="col">State</th><th scope="col">Now</th><th scope="col">Planned</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((site) => (
                    <tr key={site.name}>
                      <th scope="row">{site.name}</th>
                      <td>{site.owner}</td>
                      <td>{site.state ?? '–'}</td>
                      <td>{site.now ? mwText(site.now) : '–'}</td>
                      <td>{mwText(site.planned)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          {data.snapshot && <p className="lv-caveat">Showing the saved copy from {new Date(data.data.fetchedAt).toLocaleDateString()}.</p>}
        </div>
      )}
    </Panel>
  );
}

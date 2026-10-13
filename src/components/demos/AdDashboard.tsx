import { Fragment, useMemo, useState } from 'react';
import { money } from './shared';
import './demo.css';
import './AdDashboard.css';

/**
 * Funnel performance dashboard for account managers. Illustrative: clients,
 * funnels and numbers are invented, and the layout is a reconstruction of the
 * kind of view the team used, not a copy of it.
 * The question it answers: for the money a client put in, where did the sales
 * come from, and where are people dropping out of the funnel?
 * An account manager might carry 5 or 100 clients, so the page is built to
 * surface the ones that need attention first: status counts double as filters,
 * the default sort is worst return first, and long books are trimmed to 10 rows.
 */

const SOURCES = ['Search', 'Social', 'Native', 'Email'] as const;
type Source = (typeof SOURCES)[number];

// How each source converts relative to its cost; the same for every client.
const SOURCE_FIT: Record<Source, { cpc: number; fit: number }> = {
  Search: { cpc: 1.4, fit: 1.2 },
  Social: { cpc: 1.0, fit: 0.85 },
  Native: { cpc: 0.95, fit: 0.55 },
  Email: { cpc: 1.3, fit: 1.4 },
};

const STEPS = ['Landing page', 'Order form', 'Purchase', 'Upsell'] as const;
type Row = { spend: number; steps: number[]; revenue: number };

// Small seeded RNG so the "data" is stable between renders and reloads.
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Brightside', 'Summit', 'Northwind', 'Hearth', 'Bluebird', 'Ironwood', 'Clearwater', 'Juniper', 'Copperline', 'Maple', 'Harbor', 'Redstone', 'Lumen', 'Fieldstone', 'Silverleaf', 'Oakmont', 'Tidewater', 'Wildflower', 'Granite', 'Sunday'];
const SECOND = ['Skincare', 'Supplements', 'Fitness', 'Home', 'Pet Co.', 'Nutrition', 'Sleep', 'Kitchen', 'Wellness', 'Outdoors'];
const OFFERS = ['Free trial', 'Starter kit', '30-day program', 'Bundle', 'Subscription box', 'Intro offer'];
const PRICES = [29, 39, 49, 59, 79, 89];

const MAX_CLIENTS = 100;
const DAYS = 90;
const CLIENTS = Array.from({ length: MAX_CLIENTS }, (_, i) => {
  const r = rng(i * 31 + 3);
  return {
    id: `c${i}`,
    // Step through both name lists so the first 100 are all distinct.
    client: `${FIRST[i % FIRST.length]} ${SECOND[(i + Math.floor(i / FIRST.length)) % SECOND.length]}`,
    name: OFFERS[Math.floor(r() * OFFERS.length)],
    price: PRICES[Math.floor(r() * PRICES.length)],
    quality: 0.78 + r() * 0.5,
  };
});

const DATA: Record<string, Record<Source, Row[]>> = {};
for (const [ci, c] of CLIENTS.entries()) {
  DATA[c.id] = {} as Record<Source, Row[]>;
  for (const [si, s] of SOURCES.entries()) {
    const r = rng(ci * 100 + si + 7);
    const { cpc, fit } = SOURCE_FIT[s];
    DATA[c.id][s] = Array.from({ length: DAYS }, () => {
      const visits = Math.round((s === 'Email' ? 120 : 380) * (0.7 + r() * 0.6));
      const form = Math.round(visits * 0.28 * fit * c.quality * (0.85 + r() * 0.3));
      const sales = Math.round(form * 0.1 * c.quality * (0.8 + r() * 0.4));
      const upsell = Math.round(sales * 0.3 * (0.7 + r() * 0.6));
      return {
        spend: visits * cpc * (0.9 + r() * 0.2),
        steps: [visits, form, sales, upsell],
        revenue: sales * c.price + upsell * c.price * 0.6,
      };
    });
  }
}

function total(rows: Row[]): Row {
  return rows.reduce(
    (a, r) => ({ spend: a.spend + r.spend, revenue: a.revenue + r.revenue, steps: a.steps.map((v, i) => v + r.steps[i]) }),
    { spend: 0, revenue: 0, steps: [0, 0, 0, 0] },
  );
}

const roi = (r: Row) => (r.spend ? (r.revenue - r.spend) / r.spend : 0);
const fmt = (n: number) => money(n, 'USD').replace(/\.\d\d$/, '');
const fmtCents = (n: number) => money(n, 'USD');
const pct = (n: number) => `${n >= 0 ? '' : '−'}${Math.abs(n * 100).toFixed(0)}%`;

type StatusKey = 'bad' | 'warn' | 'good';
const STATUS: Record<StatusKey, { icon: string; label: string }> = {
  bad: { icon: '▼', label: 'Losing money' },
  warn: { icon: '●', label: 'Thin' },
  good: { icon: '▲', label: 'Profitable' },
};
const statusOf = (v: number): StatusKey => (v >= 0.5 ? 'good' : v >= 0 ? 'warn' : 'bad');

function Status({ value }: { value: number }) {
  const k = statusOf(value);
  return <span className={`ad-status ad-${k}`}><span aria-hidden="true">{STATUS[k].icon}</span> {STATUS[k].label}</span>;
}

type SortKey = 'client' | 'spend' | 'sales' | 'revenue' | 'return';
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'client', label: 'Client' },
  { key: 'spend', label: 'Spend' },
  { key: 'sales', label: 'Sales' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'return', label: 'Return' },
];
const PAGE = 10;

export default function AdDashboard() {
  const [book, setBook] = useState<5 | 25 | 100>(25);
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [source, setSource] = useState<Source | 'All'>('All');
  const [status, setStatus] = useState<StatusKey | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'return', dir: 1 });
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const sources = source === 'All' ? SOURCES : [source];
  const slice = (id: string, s: Source) => DATA[id][s].slice(-range);

  const rows = useMemo(
    () => CLIENTS.slice(0, book).map((c) => {
      const t = total(sources.flatMap((s) => slice(c.id, s)));
      return { ...c, t, roi: roi(t), status: statusOf(roi(t)) };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [book, range, source],
  );

  const counts = { bad: 0, warn: 0, good: 0 };
  rows.forEach((r) => counts[r.status]++);
  const all = total(rows.map((r) => r.t));

  const q = query.trim().toLowerCase();
  const value = (r: (typeof rows)[number]) =>
    ({ client: r.client, spend: r.t.spend, sales: r.t.steps[2], revenue: r.t.revenue, return: r.roi })[sort.key];
  const filtered = rows
    .filter((r) => !status || r.status === status)
    .filter((r) => !q || `${r.client} ${r.name}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const x = value(a), y = value(b);
      return (typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)) * sort.dir;
    });
  const visible = showAll ? filtered : filtered.slice(0, PAGE);

  const sortBy = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === 'client' || key === 'return' ? 1 : -1 }));

  return (
    <div className="demo ad">
      <div className="demo-controls" role="group" aria-label="Demo controls">
        <p className="demo-controls-title">Demo controls</p>
        <div className="ad-seg" role="group" aria-label="Clients this account manager handles">
          <span className="ad-seg-label">Clients managed</span>
          {([5, 25, 100] as const).map((n) => (
            <button key={n} type="button" aria-pressed={book === n} onClick={() => { setBook(n); setShowAll(false); setOpen(null); }}>{n}</button>
          ))}
        </div>
      </div>

      <div className="demo-frame ad-frame">
        <div className="ad-filters" role="group" aria-label="Filters">
          <p className="demo-frame-label">Account dashboard · {book} clients</p>
          <div className="ad-seg" role="group" aria-label="Date range">
            {([7, 30, 90] as const).map((r) => (
              <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>{r} days</button>
            ))}
          </div>
          <label className="demo-toggle">
            Traffic source
            <select value={source} onChange={(e) => setSource(e.target.value as Source | 'All')}>
              <option value="All">All sources</option>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>

        <dl className="ad-tiles">
          <div><dt>Spend</dt><dd>{fmt(all.spend)}</dd></div>
          <div><dt>Revenue</dt><dd>{fmt(all.revenue)}</dd></div>
          <div><dt>Return on spend</dt><dd>{pct(roi(all))}</dd></div>
          <div><dt>Cost per sale</dt><dd>{fmtCents(all.spend / Math.max(1, all.steps[2]))}</dd></div>
        </dl>

        <div className="ad-toolbar">
          <div className="ad-chips" role="group" aria-label="Filter by status">
            {(['bad', 'warn', 'good'] as StatusKey[]).map((k) => (
              <button
                key={k} type="button" aria-pressed={status === k} className={`ad-chip ad-${k}`}
                onClick={() => { setStatus(status === k ? null : k); setShowAll(false); }}
              >
                <span aria-hidden="true">{STATUS[k].icon}</span> {counts[k]} {STATUS[k].label.toLowerCase()}
              </button>
            ))}
          </div>
          <input
            type="search" className="ad-search" placeholder="Search clients" aria-label="Search clients"
            value={query} onChange={(e) => { setQuery(e.target.value); setShowAll(false); }}
          />
        </div>

        <div className="ad-table-wrap">
          <table className="ad-table">
            <caption className="visually-hidden">Clients. Select a client for its funnel breakdown.</caption>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                    <button type="button" onClick={() => sortBy(c.key)}>
                      {c.label}
                      <span aria-hidden="true" className="ad-sort">{sort.key === c.key ? (sort.dir === 1 ? '↑' : '↓') : ''}</span>
                    </button>
                  </th>
                ))}
                <th scope="col"><span className="visually-hidden">Status</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <Fragment key={r.id}>
                  <tr className={open === r.id ? 'is-open' : ''}>
                    <th scope="row">
                      <button type="button" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
                        <strong>{r.client}</strong>
                        <small>{r.name}</small>
                      </button>
                    </th>
                    <td>{fmt(r.t.spend)}</td>
                    <td>{r.t.steps[2].toLocaleString('en-US')}</td>
                    <td>{fmt(r.t.revenue)}</td>
                    <td>{pct(r.roi)}</td>
                    <td><Status value={r.roi} /></td>
                  </tr>
                  {open === r.id && (
                    <tr className="ad-detail-row">
                      <td colSpan={6}><Detail client={r} source={source} slice={slice} /></td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="ad-empty">No clients match. Clear the search or status filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > PAGE && (
          <div className="ad-more">
            <span>Showing {visible.length} of {filtered.length}</span>
            <button type="button" className="quiet" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : 'Show all'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ client, source, slice }: {
  client: { id: string; t: Row };
  source: Source | 'All';
  slice: (id: string, s: Source) => Row[];
}) {
  const t = client.t;
  return (
    <div className="ad-detail-grid">
      <figure className="ad-funnel">
        <figcaption>Where people drop off</figcaption>
        <ol>
          {STEPS.map((step, i) => {
            const v = t.steps[i];
            const prev = i ? t.steps[i - 1] : v;
            return (
              <li key={step}>
                <span className="ad-step">{step}</span>
                <span className="ad-track">
                  <span className="ad-fill" style={{ width: `${(v / Math.max(1, t.steps[0])) * 100}%` }} />
                </span>
                <span className="ad-val">
                  {v.toLocaleString('en-US')}
                  {i > 0 && <small> {prev ? Math.round((v / prev) * 100) : 0}% of previous</small>}
                </span>
              </li>
            );
          })}
        </ol>
      </figure>

      <div className="ad-sources">
        <p className="ad-sub">By traffic source</p>
        <table>
          <thead>
            <tr><th scope="col">Source</th><th scope="col">Spend</th><th scope="col">Cost per sale</th><th scope="col">Return</th></tr>
          </thead>
          <tbody>
            {SOURCES.map((s) => {
              const st = total(slice(client.id, s));
              const dim = source !== 'All' && source !== s;
              return (
                <tr key={s} className={dim ? 'is-dim' : ''}>
                  <th scope="row">{s}</th>
                  <td>{fmt(st.spend)}</td>
                  <td>{st.steps[2] ? fmtCents(st.spend / st.steps[2]) : '–'}</td>
                  <td><span className="ad-roi">{pct(roi(st))}</span> <Status value={roi(st)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

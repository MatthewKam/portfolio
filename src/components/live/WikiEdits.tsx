import { useEffect, useMemo, useRef, useState } from 'react';
import { ShareBars, StackedBars } from '../demos/charts';
import { Panel, Stat, Stats, Status, Waiting } from './Panel';
import { useTabVisible } from './useLive';

/**
 * Every edit to every Wikimedia wiki, as it happens, from a server-sent event
 * stream. Events land in a ref and React only hears about them once a second.
 * The stream is roughly 40 KB/s, so it stays closed unless someone is looking.
 */

const STREAM = 'https://stream.wikimedia.org/v2/stream/recentchange';
const WINDOW_S = 60;
const IDLE_LIMIT_MS = 10 * 60_000;
const CONNECT_LIMIT_MS = 15_000;
const LATEST_ROWS = 5;

type RawEvent = {
  id?: number; type?: string; bot?: boolean; wiki?: string; server_name?: string; title?: string;
  namespace?: number; title_url?: string; length?: { old?: number; new?: number };
};
type Bucket = { sec: number; people: number; bots: number; wikis: Record<string, number> };
type Edit = { id: number; title: string; url: string; delta: number };

const clock = (sec: number) => new Date(sec * 1000).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
const count = (n: number) => Math.round(n).toLocaleString();

export default function WikiEdits() {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [latest, setLatest] = useState<Edit[]>([]);
  const [state, setState] = useState<'connecting' | 'live' | 'failed'>('connecting');
  const [attempt, setAttempt] = useState(0);
  const [paused, setPaused] = useState<'no' | 'you' | 'idle'>('no');
  const [onScreen, setOnScreen] = useState(true);
  const visible = useTabVisible();
  const root = useRef<HTMLDivElement>(null);
  const store = useRef({ open: new Map<number, Bucket>(), done: [] as Bucket[], latest: [] as Edit[], since: 0 });

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const streaming = paused === 'no' && visible && onScreen;

  useEffect(() => {
    if (!streaming) return;
    setState('connecting');
    const s = store.current;
    s.since = Math.floor(Date.now() / 1000);
    const source = new EventSource(STREAM);

    source.onopen = () => setState('live');
    // EventSource reconnects on its own unless the server refuses outright.
    source.onerror = () => setState(source.readyState === EventSource.CLOSED ? 'failed' : 'connecting');
    let heard = false;
    const giveUp = setTimeout(() => { if (!heard) { source.close(); setState('failed'); } }, CONNECT_LIMIT_MS);
    source.onmessage = (msg) => {
      heard = true;
      let e: RawEvent;
      try { e = JSON.parse(msg.data); } catch { return; }
      if ((e.type !== 'edit' && e.type !== 'new') || !e.wiki || !e.server_name) return;
      const sec = Math.floor(Date.now() / 1000);
      let b = s.open.get(sec);
      if (!b) s.open.set(sec, (b = { sec, people: 0, bots: 0, wikis: {} }));
      if (e.bot) b.bots++; else b.people++;
      b.wikis[e.server_name] = (b.wikis[e.server_name] ?? 0) + 1;
      // The feed is unmoderated, so the reading list sticks to people editing English articles.
      if (!e.bot && e.namespace === 0 && e.wiki === 'enwiki' && e.title && e.title_url?.startsWith('https://en.wikipedia.org/')) {
        const delta = (e.length?.new ?? 0) - (e.length?.old ?? 0);
        s.latest = [{ id: e.id ?? sec, title: e.title, url: e.title_url, delta }, ...s.latest].slice(0, LATEST_ROWS);
      }
    };

    const tick = setInterval(() => {
      const current = Math.floor(Date.now() / 1000);
      // Whole seconds only: the running one would always look like a dip.
      for (let sec = Math.max((s.done.at(-1)?.sec ?? 0) + 1, s.since); sec < current; sec++) {
        s.done.push(s.open.get(sec) ?? { sec, people: 0, bots: 0, wikis: {} });
      }
      for (const k of s.open.keys()) if (k < current) s.open.delete(k);
      s.done = s.done.slice(-WINDOW_S);
      setBuckets(s.done);
      setLatest(s.latest);
    }, 1000);

    const idle = setTimeout(() => setPaused('idle'), IDLE_LIMIT_MS);
    return () => {
      source.close();
      clearInterval(tick);
      clearTimeout(idle);
      clearTimeout(giveUp);
      s.open.clear();
    };
  }, [streaming, attempt]);

  const stats = useMemo(() => {
    const people = buckets.reduce((a, b) => a + b.people, 0);
    const bots = buckets.reduce((a, b) => a + b.bots, 0);
    const wikis: Record<string, number> = {};
    for (const b of buckets) for (const [k, v] of Object.entries(b.wikis)) wikis[k] = (wikis[k] ?? 0) + v;
    const ranked = Object.entries(wikis).sort((a, b) => b[1] - a[1]);
    return { people, bots, total: people + bots, ranked };
  }, [buckets]);

  const status = paused === 'idle' ? <Status signal="paused" text="Paused after 10 minutes" />
    : paused === 'you' ? <Status signal="paused" text="Paused" />
    : state === 'failed' ? <Status signal="stale" text="Unavailable" />
    : state === 'live' ? <Status signal="live" text="Streaming" />
    : <Status signal="waiting" text="Connecting" />;

  const ready = buckets.length >= 3 && stats.total > 0;
  const perMin = ready ? (stats.total / buckets.length) * 60 : 0;
  const other = stats.ranked.slice(5).reduce((a, [, v]) => a + v, 0);

  return (
    <div ref={root}>
      <Panel
        title="Wikipedia, being edited right now"
        lede="Every page edit across all Wikimedia wikis, counted per second. Nothing here is sampled."
        source="Wikimedia EventStreams"
        sourceHref="https://stream.wikimedia.org/?doc"
        status={status}
        controls={
          <button type="button" className="lv-btn" aria-pressed={paused !== 'no'} onClick={() => setPaused(paused === 'no' ? 'you' : 'no')}>
            {paused === 'no' ? 'Pause' : 'Resume'}
          </button>
        }
      >
        <div className={`lv-body ${streaming ? '' : 'lv-held'}`}>
          {state === 'failed' && !ready ? <Waiting failed retry={() => setAttempt((n) => n + 1)} what="The Wikimedia stream" />
            : !ready ? <div className="lv-wait"><p>Counting the first few seconds of edits…</p></div> : (
            <>
              <Stats>
                <Stat label="Edits per minute" value={count(perMin)} detail={`over the last ${buckets.length}s`} />
                <Stat label="Made by people" value={`${Math.round((stats.people / stats.total) * 100)}%`} detail="the rest are flagged bots" />
                <Stat label="Wikis active" value={stats.ranked.length} detail="in this window" />
              </Stats>
              <div className="lv-split">
                <StackedBars
                  title="Edits per second, last minute"
                  x={buckets.map((b) => clock(b.sec))}
                  series={[
                    { label: 'People', values: buckets.map((b) => b.people) },
                    { label: 'Bots', values: buckets.map((b) => b.bots) },
                  ]}
                  fmt={count}
                  xHead="Time"
                  desc="Stacked bars of edits per second by people and bots over the last minute."
                />
                <div className="lv-stack">
                  <ShareBars
                    title="Busiest wikis"
                    rows={[
                      ...stats.ranked.slice(0, 5).map(([label, value]) => ({ label: label.replace(/^www\./, ''), value })),
                      ...(other ? [{ label: 'Everywhere else', value: other, more: stats.ranked.slice(5).map(([label, value]) => ({ label: label.replace(/^www\./, ''), value })) }] : []),
                    ]}
                    fmt={count}
                  />
                </div>
              </div>
              {latest.length > 0 && (
                <div className="lv-feed">
                  <h3>Latest English articles edited by people</h3>
                  <ol>
                    {latest.map((e) => (
                      <li key={e.id}>
                        <a href={e.url} target="_blank" rel="noopener noreferrer">{e.title}</a>
                        <span>{e.delta >= 0 ? '+' : '−'}{Math.abs(e.delta).toLocaleString()} bytes</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}

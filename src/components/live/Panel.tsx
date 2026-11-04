import type { ReactNode } from 'react';
import { ago, useNow } from './useLive';
import './live.css';

export type Signal = 'live' | 'waiting' | 'paused' | 'stale';

/** Status is always a shape and a word, never color alone. */
export function Status({ signal, text }: { signal: Signal; text: string }) {
  return <span className={`lv-status lv-${signal}`}><i aria-hidden="true" />{text}</span>;
}

/** The status line for anything fetched with usePolled. */
export function PollStatus({ updatedAt, failed }: { updatedAt: number; failed: boolean }) {
  const now = useNow();
  if (!updatedAt) return <Status signal={failed ? 'stale' : 'waiting'} text={failed ? 'Unavailable' : 'Connecting'} />;
  const when = ago(Math.max(0, now - updatedAt));
  return failed
    ? <Status signal="stale" text={`Refresh failed, data from ${when}`} />
    : <Status signal="live" text={`Updated ${when}`} />;
}

export function Panel({ title, lede, source, sourceHref, status, controls, children }: {
  title: string; lede: string; source: string; sourceHref: string; status: ReactNode; controls?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="lv-panel" aria-label={title}>
      <header className="lv-head">
        <div>
          <h2>{title}</h2>
          <p>{lede}</p>
        </div>
        <div className="lv-side">
          {status}
          {controls}
        </div>
      </header>
      {children}
      <p className="lv-source">Source: <a href={sourceHref} target="_blank" rel="noopener noreferrer">{source}</a></p>
    </section>
  );
}

export function Stats({ children }: { children: ReactNode }) {
  return <dl className="lv-stats">{children}</dl>;
}

export function Stat({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="lv-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {detail && <dd className="lv-detail">{detail}</dd>}
    </div>
  );
}

/** The one line of a panel that's about the viewer's own location. */
export function Here({ children }: { children: ReactNode }) {
  return <p className="lv-here"><i className="lv-you-dot" aria-hidden="true" /><span>{children}</span></p>;
}

/** Shown in place of a panel's content until the first response, at a similar height so nothing jumps. */
export function Waiting({ failed, retry, what }: { failed: boolean; retry: () => void; what: string }) {
  return (
    <div className="lv-wait">
      {failed ? (
        <>
          <p>{what[0].toUpperCase() + what.slice(1)} isn't responding right now. Everything on this page is real data, so there's nothing to fall back on.</p>
          <button type="button" className="lv-btn" onClick={retry}>Try again</button>
        </>
      ) : <p>Loading {what}…</p>}
    </div>
  );
}

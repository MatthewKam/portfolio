import { createContext, useContext, useEffect, useRef, useState } from 'react';

const TIMEOUT_MS = 15_000;

export async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.json();
}

/** False inside a /live tab that isn't open, so hidden tabs stop fetching like background ones. */
export const PanelOpen = createContext(true);

export function useTabVisible() {
  const open = useContext(PanelOpen);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const sync = () => setVisible(!document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  return visible && open;
}

/** Re-renders on a timer so "2 min ago" labels stay true. Zero until mounted, which keeps SSR stable. */
export function useNow(everyMs = 1000) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/**
 * Fetches on mount and every `everyMs`, but only while the tab is visible. When
 * `key` changes or a refresh fails, the last good data stays on screen.
 */
export function usePolled<T>(load: (signal: AbortSignal) => Promise<T>, everyMs: number, key = '') {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const visible = useTabVisible();
  const loadRef = useRef(load);
  loadRef.current = load;
  const lastRun = useRef({ key: '', at: 0 });

  useEffect(() => {
    if (!visible) return;
    const ctrl = new AbortController();
    const run = async () => {
      lastRun.current = { key, at: Date.now() };
      setPending(true);
      try {
        const next = await loadRef.current(ctrl.signal);
        if (ctrl.signal.aborted) return;
        setData(next);
        setFailed(false);
        setUpdatedAt(Date.now());
      } catch {
        if (!ctrl.signal.aborted) setFailed(true);
      }
      if (!ctrl.signal.aborted) setPending(false);
    };
    // Coming back to the tab only refetches if a poll was missed.
    const due = lastRun.current.at + everyMs - Date.now();
    const fresh = lastRun.current.key === key && attempt === 0 && due > 0;
    let interval: ReturnType<typeof setInterval>;
    const first = setTimeout(() => {
      run();
      interval = setInterval(run, everyMs);
    }, fresh ? due : 0);
    return () => {
      ctrl.abort();
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [key, everyMs, visible, attempt]);

  return { data, failed, pending, updatedAt, retry: () => setAttempt((n) => n + 1) };
}

export function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} hr ago` : `${Math.round(h / 24)} days ago`;
}

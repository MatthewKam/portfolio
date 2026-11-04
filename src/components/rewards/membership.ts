import { useSyncExternalStore } from 'react';

/**
 * The visitor's rewards membership, kept only in their browser. Work pages stamp
 * it with a plain script (StampOnVisit.astro), so the key and shape are shared.
 */

export const KEY = 'rewards-membership';
export const SLOTS = 5; // One stamp per case study.
export const MILESTONES = [
  { at: 3, tier: 'Silver', reward: 'Résumé unlocked' },
  { at: 5, tier: 'Gold', reward: 'Card complete. Contact unlocked' },
] as const;

export type Membership = {
  number: string; // Shown on the card, e.g. "0427 1180".
  joined: string; // ISO date.
  stamps: string[]; // Work slugs in the order earned.
  seen: number; // Stamps already animated onto the card.
};

// Cards from before the referral stamp was retired: drop it and keep the count honest.
const migrate = (m: Membership & { referredBy?: string }): Membership => {
  const at = m.stamps.indexOf('referral');
  if (at < 0) return m;
  const { referredBy, ...rest } = m;
  return { ...rest, stamps: m.stamps.filter((s) => s !== 'referral'), seen: m.seen > at ? m.seen - 1 : m.seen };
};

const listeners = new Set<() => void>();
let cache: Membership | null | undefined;

function read(): Membership | null {
  if (cache !== undefined) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? migrate(JSON.parse(raw)) : null;
  } catch {
    cache = null;
  }
  return cache ?? null;
}

function write(next: Membership | null) {
  cache = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // Private windows can refuse storage; the card still works until the page closes.
  }
  listeners.forEach((l) => l());
}

// Another tab (a work page opened from here) may stamp the card.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    cache = undefined;
    listeners.forEach((l) => l());
  });
}

export function useMembership() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    read,
    () => null,
  );
}

export function join() {
  const digits = Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) => n % 10).join('');
  write({
    number: `${digits.slice(0, 4)} ${digits.slice(4)}`,
    joined: new Date().toISOString().slice(0, 10),
    stamps: [],
    seen: 0,
  });
}

export function markSeen() {
  const m = read();
  if (m && m.seen !== m.stamps.length) write({ ...m, seen: m.stamps.length });
}

/** Empty the card but keep the membership, to play again. */
export function reset() {
  const m = read();
  if (m) write({ ...m, stamps: [], seen: 0 });
}

export function leave() {
  write(null);
}

export const tierOf = (count: number) =>
  [...MILESTONES].reverse().find((m) => count >= m.at)?.tier ?? 'Member';

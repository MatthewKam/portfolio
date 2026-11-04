import { useSyncExternalStore } from 'react';

/**
 * The viewer's place, shared by every panel on the page and rounded to about a
 * kilometer. A place they choose is kept in their browser. A place we infer is
 * labeled as approximate and worked out again on each visit, never saved.
 */

export type Source = 'exact' | 'search' | 'connection' | 'timezone';
export type Place = { name: string; lat: number; lon: number; us: boolean; source?: Source };

const KEY = 'live-place';
const OFF_KEY = 'live-place-off';
const listeners = new Set<() => void>();
let place: Place | null | undefined; // undefined until storage has been read.

function read() {
  if (place !== undefined) return place;
  try {
    const raw = localStorage.getItem(KEY);
    place = raw ? JSON.parse(raw) : null;
  } catch {
    place = null;
  }
  return place ?? null;
}

export function setPlace(next: Place | null) {
  place = next;
  const chosen = next && next.source !== 'connection' && next.source !== 'timezone';
  try {
    if (chosen) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
    // Turning location off has to stick, or the next visit would just infer it again.
    if (next) localStorage.removeItem(OFF_KEY);
    else localStorage.setItem(OFF_KEY, '1');
  } catch {
    // Private windows can refuse storage; the place still lasts for this page view.
  }
  listeners.forEach((l) => l());
}

export function usePlace() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    read,
    () => null,
  );
}

export const placeId = (p: Place | null) => (p ? `${p.lat},${p.lon}` : '');
const round = (n: number) => Math.round(n * 100) / 100;

export async function locate(): Promise<Place> {
  const { coords } = await new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error('unsupported'));
    else navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 15_000, maximumAge: 600_000 });
  });
  const lat = round(coords.latitude);
  const lon = round(coords.longitude);
  // The Weather Service names US points and answers 404 for anywhere else.
  const res = await fetch(`https://api.weather.gov/points/${lat},${lon}`).catch(() => null);
  if (res?.ok) {
    const { city, state } = (await res.json()).properties.relativeLocation.properties;
    return { name: `${city}, ${state}`, lat, lon, us: true, source: 'exact' };
  }
  return { name: 'Your location', lat, lon, us: res?.status !== 404, source: 'exact' };
}

export async function search(query: string): Promise<Place | null> {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Search failed');
  const hit = (await res.json()).results?.[0];
  if (!hit) return null;
  return {
    name: [hit.name, hit.admin1 ?? hit.country].filter(Boolean).join(', '),
    lat: round(hit.latitude), lon: round(hit.longitude), us: hit.country_code === 'US', source: 'search',
  };
}

// The site's own function on Vercel, so the IP address never reaches a third party.
async function fromConnection(): Promise<Place | null> {
  const res = await fetch('/api/geo');
  if (res.status !== 200) return null;
  const { city, region, country, lat, lon } = await res.json();
  return {
    name: city ? [city, region].filter(Boolean).join(', ') : 'Your area',
    lat: round(lat), lon: round(lon), us: country === 'US', source: 'connection',
  };
}

// Rough, but needs nothing from anyone: America/Chicago means somewhere near Chicago's zone.
async function fromTimezone(): Promise<Place | null> {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  if (!zone.includes('/') || zone.startsWith('Etc/')) return null;
  const hit = await search(zone.split('/').at(-1)?.replaceAll('_', ' ') ?? '');
  return hit && { ...hit, source: 'timezone' };
}

async function alreadyAllowed() {
  const status = await navigator.permissions?.query({ name: 'geolocation' }).catch(() => null);
  return status?.state === 'granted';
}

/** Best guess with no prompt, unless the viewer has already chosen or turned this off. */
export async function infer() {
  if (read()) return;
  try { if (localStorage.getItem(OFF_KEY)) return; } catch { /* Storage blocked: carry on. */ }
  const attempts = [
    async () => ((await alreadyAllowed()) ? locate() : null),
    fromConnection,
    fromTimezone,
  ];
  for (const attempt of attempts) {
    const found = await attempt().catch(() => null);
    // The viewer may have picked a place while this was running; theirs wins.
    if (found) { if (!read()) setPlace(found); return; }
  }
}

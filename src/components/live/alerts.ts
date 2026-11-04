import { getJson } from './useLive';

/** National Weather Service alerts for storms, shared by Storm watch and the home page strip. */

export type Kind = 'winter' | 'wind' | 'flood';
export const KINDS: Record<Kind, string> = { winter: 'Winter', wind: 'Wind & severe', flood: 'Flood & heavy rain' };

const EVENTS: Record<Kind, string[]> = {
  winter: ['Blizzard Warning', 'Winter Storm Warning', 'Winter Storm Watch', 'Ice Storm Warning', 'Winter Weather Advisory', 'Lake Effect Snow Warning', 'Snow Squall Warning', 'Extreme Cold Warning', 'Extreme Cold Watch'],
  wind: ['High Wind Warning', 'High Wind Watch', 'Severe Thunderstorm Warning', 'Tornado Warning', 'Tornado Watch', 'Hurricane Warning', 'Hurricane Watch', 'Tropical Storm Warning', 'Tropical Storm Watch', 'Storm Surge Warning'],
  flood: ['Flood Warning', 'Flood Watch', 'Flash Flood Warning', 'Flash Flood Watch', 'Coastal Flood Warning'],
};
const KIND_OF = new Map((Object.keys(EVENTS) as Kind[]).flatMap((k) => EVENTS[k].map((e) => [e, k] as const)));
const SEVERITY = ['Minor', 'Moderate', 'Severe', 'Extreme'];

export type RawAlert = { properties: {
  event: string; severity: string; onset: string | null; effective: string; ends: string | null; expires: string; areaDesc: string;
  geocode: { SAME?: string[] };
} };
export type Alert = { key: string; event: string; kind: Kind; severity: number; start: number; end: number; open: boolean; areas: string[]; fips: Set<string> };

export const alertKey = ({ properties: p }: RawAlert) => `${p.event}|${Date.parse(p.ends ?? p.expires)}`;

export async function fetchAlerts(signal: AbortSignal) {
  const events = [...KIND_OF.keys()].join(',');
  const url = `https://api.weather.gov/alerts/active?status=actual&message_type=alert,update&event=${encodeURIComponent(events)}`;
  const { features } = await getJson<{ features: RawAlert[] }>(url, signal);
  // One storm can arrive as many messages, so alerts of one type ending together become one row.
  const groups = new Map<string, Alert>();
  for (const feature of features) {
    const p = feature.properties;
    const kind = KIND_OF.get(p.event);
    if (!kind) continue;
    const start = Date.parse(p.onset ?? p.effective);
    const end = Date.parse(p.ends ?? p.expires);
    const key = alertKey(feature);
    const g = groups.get(key) ?? { key, event: p.event, kind, severity: 0, start, end, open: !p.ends, areas: [], fips: new Set<string>() };
    g.start = Math.min(g.start, start);
    g.severity = Math.max(g.severity, SEVERITY.indexOf(p.severity));
    g.areas.push(...p.areaDesc.split('; '));
    // SAME codes are a county FIPS code with one extra leading digit.
    for (const same of p.geocode.SAME ?? []) g.fips.add(same.slice(1));
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.severity - a.severity || a.start - b.start);
}

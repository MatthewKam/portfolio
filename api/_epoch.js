/**
 * Epoch AI's data center tables, reduced to what the page draws. Shared by the
 * /api/datacenters function and the snapshot script. CC BY: https://epoch.ai/data/ai-data-centers
 */
const BASE = 'https://epoch.ai/data/data_centers';

export function parseCsv(text) {
	const rows = [];
	let row = [];
	let cell = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
			else if (c === '"') quoted = false;
			else cell += c;
		} else if (c === '"') quoted = true;
		else if (c === ',') { row.push(cell); cell = ''; }
		else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
		else cell += c;
	}
	if (cell || row.length) { row.push(cell); rows.push(row); }
	const [head, ...body] = rows;
	return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

// Epoch tags each owner with its confidence, e.g. "Meta #speculative".
const clean = (v) => v.replace(/\s*#\w+/g, '').trim();
const num = (v) => { const n = Number(v); return v !== '' && Number.isFinite(n) ? n : null; };

export const STATES = {
	Alabama: 'AL', Arizona: 'AZ', Georgia: 'GA', Idaho: 'ID', Indiana: 'IN', Iowa: 'IA', Louisiana: 'LA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS',
	Missouri: 'MO', Nebraska: 'NE', Nevada: 'NV', 'North Dakota': 'ND', 'South Carolina': 'SC', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR',
	Pennsylvania: 'PA', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Virginia: 'VA', Washington: 'WA', Wisconsin: 'WI', Wyoming: 'WY',
};
const CODES = new Set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
export function stateOf(address) {
	// Street directions like "Beech Rd SW," look like state codes, so check every candidate.
	const codes = [...address.matchAll(/[,\s]([A-Z]{2})(?=\s+\d{5}|\s*,|\s*$)/g)].map((m) => m[1]);
	const code = codes.find((c) => CODES.has(c));
	if (code) return code;
	return Object.entries(STATES).find(([name]) => address.includes(name))?.[1] ?? null;
}

export async function buildDataset(coords) {
	const get = async (file) => {
		const res = await fetch(`${BASE}/${file}.csv`);
		if (!res.ok) throw new Error(`${res.status} from Epoch for ${file}`);
		return parseCsv(await res.text());
	};
	const [centers, timelines] = await Promise.all([get('data_centers'), get('data_center_timelines')]);
	const sites = centers.filter((c) => c.Country === 'United States').map((c) => {
		const timeline = timelines
			.filter((t) => t['Data center'] === c.Name && num(t['Power (MW)']) !== null)
			.map((t) => [t.Date, num(t['Power (MW)'])])
			.sort((a, b) => a[0].localeCompare(b[0]));
		return {
			name: c.Name,
			owner: clean(c.Owner) || 'Undisclosed',
			users: clean(c.Users),
			state: coords[c.Name]?.state ?? stateOf(c.Address),
			lat: coords[c.Name]?.lat ?? null,
			lon: coords[c.Name]?.lon ?? null,
			now: num(c['Current power (MW)']) ?? 0,
			cost: num(c['Current total capital cost (2025 USD billions)']) ?? 0,
			planned: Math.max(num(c['Current power (MW)']) ?? 0, ...timeline.map((t) => t[1]), 0),
			timeline,
		};
	});
	return { fetchedAt: new Date().toISOString(), sites };
}

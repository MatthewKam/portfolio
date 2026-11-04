import { buildDataset } from './_epoch.js';
import { COORDS } from './_coords.js';

/**
 * Epoch AI doesn't allow browsers to read its files from other sites, so this
 * fetches them on the server. Vercel's cache means Epoch sees one request every few hours.
 */
export default async function handler(req, res) {
	try {
		const data = await buildDataset(COORDS);
		res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
		res.status(200).json(data);
	} catch {
		res.setHeader('Cache-Control', 'no-store');
		res.status(502).json({ error: 'Epoch data unavailable' });
	}
}

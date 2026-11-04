/**
 * The visitor's approximate city, from the headers Vercel adds to every request.
 * This function keeps nothing, and it doesn't pass the IP address to any third party.
 */
export default function handler(req, res) {
	const h = req.headers;
	const lat = Number(h['x-vercel-ip-latitude']);
	const lon = Number(h['x-vercel-ip-longitude']);
	res.setHeader('Cache-Control', 'private, no-store');
	if (!h['x-vercel-ip-latitude'] || !h['x-vercel-ip-longitude'] || Number.isNaN(lat) || Number.isNaN(lon)) {
		return res.status(204).end();
	}
	res.status(200).json({
		// Vercel URL-encodes city names so accents survive the header.
		city: h['x-vercel-ip-city'] ? decodeURIComponent(h['x-vercel-ip-city']) : null,
		region: h['x-vercel-ip-country-region'] ?? null,
		country: h['x-vercel-ip-country'] ?? null,
		lat,
		lon,
	});
}

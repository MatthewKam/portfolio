/**
 * Helpers shared by the demos. Everything is fake: Loam Coffee Co. is a
 * fictional brand and no request leaves the browser.
 */

/** Resolves after a realistic delay, or rejects when `fail` is set. */
export function fakeApi<T>(result: T, fail: boolean): Promise<T> {
  const latency = 350 + Math.random() * 450;
  return new Promise((resolve, reject) =>
    setTimeout(() => (fail ? reject(new Error('The server did not respond.')) : resolve(result)), latency),
  );
}

export type Currency = 'USD' | 'CAD' | 'GBP' | 'EUR';

export const LOCALES: { id: string; label: string; currency: Currency }[] = [
  { id: 'en-US', label: 'United States', currency: 'USD' },
  { id: 'en-CA', label: 'Canada', currency: 'CAD' },
  { id: 'en-GB', label: 'United Kingdom', currency: 'GBP' },
  { id: 'fr-FR', label: 'France', currency: 'EUR' },
];

/** Formats with the shopper's locale, not the merchant's. */
export function money(amount: number, currency: Currency, locale = 'en-US') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}

import { useState } from 'react';
import { money, LOCALES, type Currency } from './shared';
import './demo.css';
import './Referrals.css';

/**
 * Referral program demo for Loam Coffee Co. (fictional brand, fake data).
 * Merchant settings on the left, the customer landing page they drive on the right.
 * Rules modeled here:
 *  - Store credit is set per currency by the merchant, not converted.
 *  - The landing page shows the shopper's currency, formatted for their locale.
 *  - Credit can be held until the friend's order is past the return window.
 */

type Settings = {
  enabled: boolean;
  credit: Record<Currency, number>;
  friendPercent: number;
  holdDays: 0 | 14 | 30;
};

const CURRENCIES: Currency[] = ['USD', 'CAD', 'GBP', 'EUR'];
const START: Settings = {
  enabled: true,
  credit: { USD: 10, CAD: 14, GBP: 8, EUR: 9 },
  friendPercent: 15,
  holdDays: 14,
};

function validate(s: Settings) {
  const errors: string[] = [];
  for (const c of CURRENCIES) {
    if (!(s.credit[c] > 0 && s.credit[c] <= 100)) errors.push(`${c} credit must be between 1 and 100.`);
  }
  if (!(s.friendPercent >= 5 && s.friendPercent <= 50)) errors.push('Friend discount must be between 5% and 50%.');
  return errors;
}

export default function Referrals() {
  const [s, setS] = useState<Settings>(START);
  const [shopper, setShopper] = useState(LOCALES[0]);
  const [copied, setCopied] = useState(false);

  const errors = validate(s);
  const num = (v: string) => (v === '' ? NaN : Number(v));
  const show = (n: number) => (Number.isNaN(n) ? '' : n);
  // Drop ".00" / ",00" so "$10" reads like marketing copy, not a receipt.
  const credit = money(s.credit[shopper.currency] || 0, shopper.currency, shopper.id).replace(/[.,]00(?=\D*$)/, '');

  return (
    <div className="demo rf">
      <div className="demo-frame rf-settings">
        <p className="demo-frame-label">Merchant admin · Referral program</p>

        <label className="demo-toggle rf-switch">
          <input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} />
          Program is {s.enabled ? 'on' : 'off'}
        </label>

        <h4>Customer who refers</h4>
        <p className="rf-help">Store credit, set separately for each currency you sell in.</p>
        <div className="rf-currencies">
          {CURRENCIES.map((c) => (
            <label key={c}>
              <span>{c}</span>
              <input
                type="number" inputMode="decimal" min={1} max={100}
                value={show(s.credit[c])}
                onChange={(e) => setS({ ...s, credit: { ...s.credit, [c]: num(e.target.value) } })}
              />
            </label>
          ))}
        </div>

        <h4>Friend who orders</h4>
        <label className="rf-field">
          <span>Discount on first order</span>
          <span className="rf-inline">
            <input
              type="number" min={5} max={50}
              value={show(s.friendPercent)}
              onChange={(e) => setS({ ...s, friendPercent: num(e.target.value) })}
            /> %
          </span>
        </label>
        <label className="rf-field">
          <span>Give the referrer credit</span>
          <select
            value={s.holdDays}
            onChange={(e) => setS({ ...s, holdDays: Number(e.target.value) as Settings['holdDays'] })}
          >
            <option value={0}>As soon as the friend orders</option>
            <option value={14}>14 days after (return window)</option>
            <option value={30}>30 days after</option>
          </select>
        </label>

        {errors.length > 0 && (
          <ul className="demo-msg demo-msg-error rf-errors" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        )}
        <button type="button" className="quiet" onClick={() => setS(START)}>Reset demo</button>
      </div>

      <div className="rf-preview">
        <label className="demo-toggle">
          Preview as a shopper in
          <select value={shopper.id} onChange={(e) => setShopper(LOCALES.find((l) => l.id === e.target.value) ?? LOCALES[0])}>
            {LOCALES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>

        <div className="demo-frame demo-shop rf-landing" aria-live="polite">
          <p className="demo-frame-label">Storefront · loamcoffee.example/refer</p>
          {!s.enabled ? (
            <>
              <h4>Our referral program is taking a break</h4>
              <p>Check back soon. Any credit you've already earned is still in your account.</p>
            </>
          ) : errors.length ? (
            <p className="rf-fine">Fix the settings on the left to see the page.</p>
          ) : (
            <>
              <h4>Give {s.friendPercent}% off. Get {credit}.</h4>
              <p>
                Share your link with a friend. They get {s.friendPercent}% off their first bag, and you get {credit} in
                store credit {s.holdDays === 0 ? 'as soon as they order' : `${s.holdDays} days after their order ships`}.
              </p>
              <div className="rf-link">
                <code>loamcoffee.example/r/JORDAN-7Q2</code>
                <button
                  type="button" className="primary"
                  onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }}
                >
                  {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>
              <p className="rf-fine">Credit applies to future orders and never expires. One reward per new customer.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

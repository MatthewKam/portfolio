import { useState } from 'react';
import { fakeApi, money, LOCALES, type Currency } from './shared';
import CustomerPortal from './CustomerPortal';
import './demo.css';
import './CancellationFlow.css';

/**
 * Cancellation flow demo for Loam Coffee Co. (fictional brand, fake data).
 * The customer gives a reason, gets one offer that fits it (a discount, a free
 * gift, a less frequent schedule, or delaying or skipping their next order), and
 * can take the offer or keep cancelling. Rules modeled here:
 *  - Each reason maps to exactly one offer; "something else" gets none.
 *  - Prices are set per currency by the merchant, never converted on the fly.
 *  - Money and dates are formatted in the shopper's locale.
 *  - Declining an offer never blocks cancelling: one click to confirm.
 */

type Step = 'manage' | 'reason' | 'offer' | 'confirm' | 'saved' | 'cancelled';
type ReasonId = 'price' | 'too-much' | 'too-soon' | 'away' | 'taste' | 'other';
type Offer =
  | { kind: 'discount'; percent: number; orders: number }
  | { kind: 'gift'; item: string }
  | { kind: 'frequency'; weeks: number }
  | { kind: 'delay'; weeks: number }
  | { kind: 'skip' };

const REASONS: { id: ReasonId; label: string; offer: Offer | null }[] = [
  { id: 'price', label: "It's too expensive", offer: { kind: 'discount', percent: 20, orders: 3 } },
  { id: 'too-much', label: 'I have too much coffee', offer: { kind: 'frequency', weeks: 4 } },
  { id: 'too-soon', label: 'My next bag is coming too soon', offer: { kind: 'delay', weeks: 1 } },
  { id: 'away', label: "I'm traveling or away", offer: { kind: 'skip' } },
  { id: 'taste', label: "I'm bored of the same coffee", offer: { kind: 'gift', item: 'Roaster’s sampler' } },
  { id: 'other', label: 'Something else', offer: null },
];

// Merchant-set prices per currency (not exchange-rate conversions).
const PRICES: Record<string, Record<Currency, number>> = {
  'Ridgeline blend, 12 oz': { USD: 18, CAD: 24, GBP: 14, EUR: 16 },
  'Night Owl decaf, 12 oz': { USD: 19, CAD: 25, GBP: 15, EUR: 17 },
  'Harbor espresso, 12 oz': { USD: 20, CAD: 27, GBP: 16, EUR: 18 },
};
const PRODUCTS = Object.keys(PRICES);

const START = {
  product: PRODUCTS[0], weeks: 2, next: new Date(2026, 9, 24),
  discount: null as null | { percent: number; orders: number },
  gift: null as null | string,
};

export default function CancellationFlow() {
  const [locale, setLocale] = useState(LOCALES[0]);
  const [sub, setSub] = useState(START);
  const [step, setStep] = useState<Step>('manage');
  const [reason, setReason] = useState<ReasonId | null>(null);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [failNext, setFailNext] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cur = locale.currency;
  const price = (product: string) => PRICES[product][cur];
  const fmtMoney = (n: number) => money(n, cur, locale.id);
  const fmtDate = (d: Date) => new Intl.DateTimeFormat(locale.id, { month: 'long', day: 'numeric' }).format(d);
  const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
  const discounted = (n: number, pct: number) => Math.round(n * (100 - pct)) / 100;

  const chosen = REASONS.find((r) => r.id === reason) ?? null;

  async function run(label: string, apply: () => void) {
    setPending(label);
    setError(null);
    try {
      await fakeApi(null, failNext);
      apply();
    } catch {
      setError(`${label} didn't go through. Your subscription hasn't changed, so you can try again.`);
    } finally {
      setFailNext(false);
      setPending(null);
    }
  }

  function chooseReason() {
    if (!chosen) return;
    setStep(chosen.offer ? 'offer' : 'confirm');
  }

  function acceptOffer() {
    const offer = chosen?.offer;
    if (!offer) return;
    run('Saving your change', () => {
      setSub((s) => {
        switch (offer.kind) {
          case 'discount': return { ...s, discount: { percent: offer.percent, orders: offer.orders } };
          case 'gift': return { ...s, gift: offer.item };
          case 'frequency': return { ...s, weeks: offer.weeks };
          case 'delay': return { ...s, next: addDays(s.next, offer.weeks * 7) };
          case 'skip': return { ...s, next: addDays(s.next, s.weeks * 7) };
        }
      });
      setStep('saved');
    });
  }

  function confirmCancel() {
    run('Cancelling', () => {
      setStep('cancelled');
    });
  }

  function reset() {
    setSub(START);
    setStep('manage');
    setReason(null);
    setNote('');
    setError(null);
    setFailNext(false);
  }

  function offerCopy(offer: Offer) {
    const base = price(sub.product);
    switch (offer.kind) {
      case 'discount':
        return {
          title: `Take ${offer.percent}% off your next ${offer.orders} orders`,
          body: `${fmtMoney(discounted(base, offer.percent))} instead of ${fmtMoney(base)} per bag, then back to the regular price.`,
          cta: `Keep it for ${fmtMoney(discounted(base, offer.percent))}`,
        };
      case 'gift':
        return {
          title: 'Have a free sampler on us',
          body: `We'll add a ${offer.item} (three small bags of our other roasts) to your ${fmtDate(sub.next)} delivery, free.`,
          cta: 'Add my free sampler',
        };
      case 'frequency':
        return {
          title: `Get a bag every ${offer.weeks} weeks instead`,
          body: `Same coffee, less often. Your next bag still arrives ${fmtDate(sub.next)}, then every ${offer.weeks} weeks after that.`,
          cta: `Switch to every ${offer.weeks} weeks`,
        };
      case 'delay': {
        const later = addDays(sub.next, offer.weeks * 7);
        return {
          title: `Push your next bag back ${offer.weeks === 1 ? 'a week' : `${offer.weeks} weeks`}`,
          body: `It would arrive ${fmtDate(later)} instead of ${fmtDate(sub.next)}, then carry on every ${sub.weeks} weeks as usual.`,
          cta: `Delay to ${fmtDate(later)}`,
        };
      }
      case 'skip':
        return {
          title: 'Skip your next delivery',
          body: `We'll hold off on ${fmtDate(sub.next)} and send the following one on ${fmtDate(addDays(sub.next, sub.weeks * 7))}.`,
          cta: 'Skip one delivery',
        };
    }
  }

  const unitPrice = sub.discount ? discounted(price(sub.product), sub.discount.percent) : price(sub.product);

  return (
    <div className="demo cf">
      <CustomerPortal active="Subscriptions" aside={null}>
        <div className="cf-portal" aria-busy={pending !== null}>
          {step === 'manage' && (
            <div className="cf-step">
              <h4>Your subscription</h4>
              <dl className="cf-sub">
                <div><dt>Coffee</dt><dd>{sub.product}</dd></div>
                <div><dt>Every</dt><dd>{sub.weeks} weeks</dd></div>
                <div><dt>Next bag</dt><dd>{fmtDate(sub.next)}{sub.gift && <small> + free {sub.gift}</small>}</dd></div>
                <div>
                  <dt>Price</dt>
                  <dd>
                    {fmtMoney(unitPrice)}
                    {sub.discount && <small> ({sub.discount.percent}% off, next {sub.discount.orders} orders)</small>}
                  </dd>
                </div>
              </dl>
              <button type="button" className="quiet" onClick={() => setStep('reason')}>
                Cancel subscription
              </button>
            </div>
          )}

          {step === 'reason' && (
            <fieldset className="cf-step">
              <legend><h4>Before you go, what's the main reason?</h4></legend>
              <div className="cf-reasons">
                {REASONS.map((r) => (
                  <label key={r.id} className={reason === r.id ? 'is-on' : ''}>
                    <input type="radio" name="cf-reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} />
                    {r.label}
                  </label>
                ))}
              </div>
              <div className="cf-actions">
                <button type="button" className="primary" disabled={!reason} onClick={chooseReason}>Continue</button>
                <button type="button" className="quiet" onClick={() => setStep('manage')}>Never mind</button>
              </div>
            </fieldset>
          )}

          {step === 'offer' && chosen?.offer && (() => {
            const copy = offerCopy(chosen.offer);
            return (
              <div className="cf-step">
                <p className="cf-eyebrow">Because you said: {chosen.label.toLowerCase()}</p>
                <h4>{copy.title}</h4>
                <p>{copy.body}</p>
                <div className="cf-actions">
                  <button type="button" className="primary" onClick={acceptOffer} disabled={pending !== null}>
                    {pending ? 'Saving…' : copy.cta}
                  </button>
                  <button type="button" className="quiet" onClick={() => setStep('confirm')} disabled={pending !== null}>
                    No thanks, continue cancelling
                  </button>
                </div>
              </div>
            );
          })()}

          {step === 'confirm' && (
            <div className="cf-step">
              <h4>Cancel your subscription?</h4>
              <p>You won't be charged again. Your {fmtDate(sub.next)} bag won't ship.</p>
              <label className="cf-note">
                Anything we could do better? (optional)
                <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <div className="cf-actions">
                <button type="button" className="primary" onClick={confirmCancel} disabled={pending !== null}>
                  {pending ? 'Cancelling…' : 'Cancel subscription'}
                </button>
                <button type="button" className="quiet" onClick={() => setStep('manage')} disabled={pending !== null}>
                  Keep my subscription
                </button>
              </div>
            </div>
          )}

          {step === 'saved' && (
            <div className="cf-step" role="status">
              <h4>You're all set</h4>
              <p>
                Your subscription is updated. Next bag: {sub.product.split(',')[0]} on {fmtDate(sub.next)}, {fmtMoney(unitPrice)}
                {sub.gift ? `, with a free ${sub.gift}.` : '.'}
              </p>
              <button type="button" onClick={() => setStep('manage')}>Back to subscription</button>
            </div>
          )}

          {step === 'cancelled' && (
            <div className="cf-step" role="status">
              <h4>Your subscription is cancelled</h4>
              <p>Thanks for drinking Loam. You can restart any time from your account.</p>
            </div>
          )}

          {error && <p className="demo-msg demo-msg-error" role="alert">{error}</p>}
        </div>
      </CustomerPortal>

      <div className="cf-side">
        <div className="demo-controls" role="group" aria-label="Demo controls">
          <p className="demo-controls-title">Demo controls</p>
          <label className="demo-toggle">
            Shopper in
            <select
              value={locale.id}
              onChange={(e) => setLocale(LOCALES.find((l) => l.id === e.target.value) ?? LOCALES[0])}
            >
              {LOCALES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <label className="demo-toggle">
            <input type="checkbox" checked={failNext} onChange={(e) => setFailNext(e.target.checked)} />
            Make the next request fail
          </label>
          <button type="button" className="quiet" onClick={reset}>Reset demo</button>
        </div>

        <h4 className="cf-side-title">Reason → offer rules</h4>
        <ul className="cf-rules">
          {REASONS.map((r) => (
            <li key={r.id} className={reason === r.id ? 'is-on' : ''}>
              <span>{r.label}</span>
              <span>{r.offer ? offerCopy(r.offer).title : 'No offer, go to confirm'}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { fakeApi, money } from './shared';
import './demo.css';
import './BundleBuilder.css';

/**
 * Build-a-bundle demo for Loam Coffee Co. (fictional brand, fake prices).
 * A small storefront: the bundle builder, one page per flavor, and the cart.
 * Rules modeled here:
 *  - Bundles come in 5, 10, 25 or 50 pods; bigger bundles cost less per pod.
 *  - Once a size is picked, the bundle stays open across the whole store
 *    (and across reloads) until it's full and added to the cart.
 *  - Pods can be added from the builder or from any product page.
 *  - Switching to a smaller size keeps the shopper's picks and asks them to
 *    trim, instead of silently dropping pods they chose.
 *  - A full bundle offers the next size up, priced against the current
 *    per-pod rate so the saving is concrete. Saying no hides it for that bundle.
 *  - In the cart, a bundle is one line item with its mix listed underneath.
 */

const SIZES = [
  { size: 5, perPod: 2.4 },
  { size: 10, perPod: 2.2 },
  { size: 25, perPod: 1.96 },
  { size: 50, perPod: 1.8 },
];
const FULL_PRICE = SIZES[0].perPod;

const FLAVORS = [
  { id: 'ridgeline', name: 'Ridgeline', note: 'Chocolate and toasted almond. Our everyday medium roast.', color: '#5a3f2f' },
  { id: 'harbor', name: 'Harbor', note: 'Dark and smoky, built for espresso-style shots.', color: '#2a1d15' },
  { id: 'meadow', name: 'Meadow', note: 'Bright and citrusy. A light roast for slow mornings.', color: '#c08a3e' },
  { id: 'night-owl', name: 'Night Owl', note: 'Swiss water decaf with a caramel finish.', color: '#2e6b58' },
];

type Picks = Record<string, number>;
type Bundle = { size: number; picks: Picks; declinedUpsell?: boolean };
type View = 'build' | 'cart' | string; // or a flavor id

const EMPTY: Picks = Object.fromEntries(FLAVORS.map((f) => [f.id, 0]));
const STORAGE_KEY = 'loam-demo-bundle';
const tierOf = (size: number) => SIZES.find((t) => t.size === size) ?? SIZES[0];
const countOf = (p: Picks) => Object.values(p).reduce((a, b) => a + b, 0);
const fmt = (n: number) => money(n, 'USD');

export default function BundleBuilder() {
  const [view, setView] = useState<View>('build');
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [cart, setCart] = useState<Bundle[]>([]);
  const [restored, setRestored] = useState(false);
  const [pending, setPending] = useState(false);
  const [failNext, setFailNext] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  // Restore after mount so the server-rendered markup matches the first client render.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (saved) {
        setBundle(saved.bundle ?? null);
        setCart(saved.cart ?? []);
        setRestored(!!saved.bundle);
      }
    } catch { /* storage unavailable: start fresh */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ bundle, cart })); } catch { /* ignore */ }
  }, [bundle, cart]);

  const count = bundle ? countOf(bundle.picks) : 0;
  const left = bundle ? bundle.size - count : 0;
  const full = !!bundle && left === 0;
  const tier = bundle ? tierOf(bundle.size) : null;
  const nextTier = bundle ? SIZES.find((t) => t.size > bundle.size) : undefined;
  const upsell = full && tier && nextTier && !bundle.declinedUpsell
    ? {
        size: nextTier.size,
        more: nextTier.perPod * nextTier.size - tier.perPod * tier.size,
        // What the bigger bundle would cost at today's per-pod rate, minus what it actually costs.
        save: (tier.perPod - nextTier.perPod) * nextTier.size,
        perPodPct: Math.round((1 - nextTier.perPod / tier.perPod) * 100),
      }
    : null;

  const go = (v: View) => { setView(v); setMessage(null); };
  const pickSize = (size: number) => {
    setMessage(null);
    setBundle((b) => ({ size, picks: b?.picks ?? { ...EMPTY } }));
  };
  const sizeUp = (size: number) => {
    setMessage(null);
    setBundle((b) => b && { ...b, size, declinedUpsell: false });
  };
  const change = (id: string, by: number) => {
    setMessage(null);
    setBundle((b) => b && { ...b, picks: { ...b.picks, [id]: Math.max(0, b.picks[id] + by) } });
  };

  // Spread the remaining pods across flavors, starting with the least picked.
  function fillRest() {
    setBundle((b) => {
      if (!b) return b;
      const picks = { ...b.picks };
      for (let i = countOf(picks); i < b.size; i++) {
        const id = FLAVORS.map((f) => f.id).sort((x, y) => picks[x] - picks[y])[0];
        picks[id] += 1;
      }
      return { ...b, picks };
    });
  }

  async function addToCart() {
    if (!bundle || !full) return;
    setPending(true);
    setMessage(null);
    try {
      await fakeApi(null, failNext);
      setCart((c) => [...c, bundle]);
      setBundle(null);
      setView('cart');
    } catch {
      setMessage({ tone: 'error', text: "Couldn't add to cart: the store didn't respond. Your bundle is saved, so you can try again." });
    } finally {
      setFailNext(false);
      setPending(false);
    }
  }

  function reset() {
    setBundle(null);
    setCart([]);
    setView('build');
    setMessage(null);
    setFailNext(false);
    setRestored(false);
  }

  const flavor = FLAVORS.find((f) => f.id === view);

  return (
    <div className="demo bb">
      <div className="demo-frame demo-shop bb-shop" aria-busy={pending}>
        <nav className="bb-nav" aria-label="Store (demo)">
          <span className="bb-logo">Loam</span>
          <button type="button" aria-current={view === 'build' ? 'page' : undefined} onClick={() => go('build')}>Build a bundle</button>
          {FLAVORS.map((f) => (
            <button key={f.id} type="button" aria-current={view === f.id ? 'page' : undefined} onClick={() => go(f.id)}>{f.name}</button>
          ))}
          <button type="button" className="bb-cart-link" aria-current={view === 'cart' ? 'page' : undefined} onClick={() => go('cart')}>
            Cart ({cart.length})
          </button>
        </nav>

        {restored && (
          <p className="bb-restored" role="status">
            Welcome back. Your bundle was saved.
            <button type="button" className="quiet" onClick={() => setRestored(false)}>Dismiss</button>
          </p>
        )}

        <div className="bb-page">
          {view === 'build' && (
            <>
              <fieldset className="bb-sizes">
                <legend><h4>1. Pick a size</h4></legend>
                <div className="bb-size-grid">
                  {SIZES.map((t) => {
                    const save = Math.round((1 - t.perPod / FULL_PRICE) * 100);
                    return (
                      <label key={t.size} className={bundle?.size === t.size ? 'is-on' : ''}>
                        <input type="radio" name="bb-size" checked={bundle?.size === t.size} onChange={() => pickSize(t.size)} />
                        <span className="bb-size-n">{t.size}</span>
                        <span className="bb-size-unit">pods</span>
                        <span className="bb-size-price">{fmt(t.perPod)} each</span>
                        <span className="bb-size-save">{save > 0 ? `Save ${save}%` : ' '}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <h4>2. Mix your flavors</h4>
              {bundle ? (
                <>
                  <p className="bb-hint">Fill it here, or keep shopping and add pods from any coffee's page.</p>
                  <ul className="bb-flavors">
                    {FLAVORS.map((f) => (
                      <li key={f.id}>
                        <span className="bb-swatch" style={{ background: f.color }} aria-hidden="true" />
                        <span className="bb-flavor">
                          <button type="button" className="bb-flavor-link" onClick={() => go(f.id)}>{f.name}</button>
                        </span>
                        <Stepper name={f.name} value={bundle.picks[f.id]} canAdd={left > 0} onChange={(by) => change(f.id, by)} />
                      </li>
                    ))}
                  </ul>
                  <div className="bb-actions">
                    {left > 0 && <button type="button" className="quiet" onClick={fillRest}>Fill the rest for me</button>}
                  </div>
                </>
              ) : (
                <p className="bb-hint">Pick a size first. Your bundle stays open while you browse.</p>
              )}
            </>
          )}

          {flavor && (
            <div className="bb-product">
              <span className="bb-product-img" style={{ background: flavor.color }} aria-hidden="true" />
              <div>
                <h4>{flavor.name} pods</h4>
                <p>{flavor.note}</p>
                {bundle ? (
                  <div className="bb-product-add">
                    <span>In your bundle</span>
                    <Stepper name={flavor.name} value={bundle.picks[flavor.id]} canAdd={left > 0} onChange={(by) => change(flavor.id, by)} />
                  </div>
                ) : (
                  <p className="bb-hint">
                    From {fmt(SIZES[SIZES.length - 1].perPod)} a pod in a bundle.{' '}
                    <button type="button" className="quiet bb-inline" onClick={() => go('build')}>Start a bundle</button>
                  </p>
                )}
              </div>
            </div>
          )}

          {view === 'cart' && (
            <div className="bb-cart">
              <h4>Your cart</h4>
              {cart.length === 0 ? (
                <p className="bb-hint">Nothing here yet.</p>
              ) : (
                <ul>
                  {cart.map((b, i) => {
                    const t = tierOf(b.size);
                    return (
                      <li key={i}>
                        <div className="bb-cart-head">
                          <strong>{b.size}-pod bundle</strong>
                          <span>{fmt(t.perPod * t.size)}</span>
                        </div>
                        <p>
                          {FLAVORS.filter((f) => b.picks[f.id] > 0).map((f) => `${b.picks[f.id]} ${f.name}`).join(' · ')}
                        </p>
                        <button type="button" className="quiet" onClick={() => setCart((c) => c.filter((_, j) => j !== i))}>Remove</button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {bundle && <p className="bb-hint">You still have a bundle in progress below.</p>}
            </div>
          )}
        </div>

        {bundle && upsell && (
          <div className="bb-upsell" role="status">
            <p>
              <strong>Go up to {upsell.size} pods for {fmt(upsell.more)} more</strong> and save {fmt(upsell.save)}.
              {' '}That's {upsell.perPodPct}% less per pod, and you keep your mix.
            </p>
            <div className="bb-upsell-actions">
              <button type="button" className="primary" onClick={() => sizeUp(upsell.size)}>Make it {upsell.size}</button>
              <button type="button" className="quiet" onClick={() => setBundle((b) => b && { ...b, declinedUpsell: true })}>
                No thanks
              </button>
            </div>
          </div>
        )}
        {bundle && (
          <div className={`bb-tray${left < 0 ? ' is-over' : ''}`} aria-live="polite">
            <div className="bb-tray-info">
              <strong>Your {bundle.size}-pod bundle</strong>
              <div className="bb-bar"><span style={{ width: `${Math.min(100, (count / bundle.size) * 100)}%` }} /></div>
              <span>
                {left < 0
                  ? `${count} of ${bundle.size}: remove ${-left} to fit this size`
                  : full
                    ? `${count} of ${bundle.size}: full`
                    : `${count} of ${bundle.size}: ${left} to go`}
              </span>
            </div>
            <div className="bb-tray-actions">
              <span className="bb-tray-price">{fmt(tierOf(bundle.size).perPod * bundle.size)}</span>
              {full ? (
                <button type="button" className="primary" onClick={addToCart} disabled={pending}>
                  {pending ? 'Adding…' : 'Add bundle to cart'}
                </button>
              ) : view !== 'build' ? (
                <button type="button" onClick={() => go('build')}>Finish bundle</button>
              ) : null}
            </div>
          </div>
        )}
        {message && <p className={`demo-msg demo-msg-${message.tone}`} role="alert">{message.text}</p>}
      </div>

      <div className="demo-controls" role="group" aria-label="Demo controls">
        <p className="demo-controls-title">Demo controls · pick a size, add a few pods, then open a coffee's page or reload</p>
        <label className="demo-toggle">
          <input type="checkbox" checked={failNext} onChange={(e) => setFailNext(e.target.checked)} />
          Make the next request fail
        </label>
        <button type="button" className="quiet" onClick={reset}>Reset demo</button>
      </div>
    </div>
  );
}

function Stepper({ name, value, canAdd, onChange }: {
  name: string; value: number; canAdd: boolean; onChange: (by: number) => void;
}) {
  return (
    <span className="bb-stepper">
      <button type="button" onClick={() => onChange(-1)} disabled={value === 0} aria-label={`Remove one ${name}`}>−</button>
      <output aria-label={`${name} pods in bundle`}>{value}</output>
      <button type="button" onClick={() => onChange(1)} disabled={!canAdd} aria-label={`Add one ${name}`}>+</button>
    </span>
  );
}

import { useState } from 'react';
import { fakeApi } from './shared';
import CustomerPortal from './CustomerPortal';
import PunchCardView from './PunchCardView';
import { STEPS, rewardText, useDesign } from './punchCardDesign';
import './PunchCard.css';

/**
 * Punch card demo for Loam Coffee Co. (fictional brand, fake data).
 * Rules modeled here:
 *  - Each paid order earns one punch. A full card (8) unlocks the reward to redeem.
 *  - Punches beyond 8 carry over to the next card.
 *  - Refunding an order removes its punch, unless that punch was
 *    already spent on a redeemed reward (we never claw back a reward).
 *  - Every action goes through a fake API with latency and optional failure.
 * The card's look comes from the shared design, so the designer below restyles it.
 */

const CARD_SIZE = STEPS;

type Order = { id: number; item: string; date: string; refunded: boolean };

const SEED: Order[] = [
  { id: 1041, item: 'Ridgeline blend, 12 oz', date: 'Aug 4', refunded: false },
  { id: 1052, item: 'Night Owl decaf, 12 oz', date: 'Aug 18', refunded: false },
  { id: 1067, item: 'Ridgeline blend, 12 oz', date: 'Sep 1', refunded: false },
];

const ITEMS = ['Ridgeline blend, 12 oz', 'Night Owl decaf, 12 oz', 'Harbor espresso, 2 lb', 'Field notes sampler'];

export default function PunchCard() {
  const design = useDesign();
  const [orders, setOrders] = useState<Order[]>(SEED);
  const [redeemed, setRedeemed] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [failNext, setFailNext] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [nextId, setNextId] = useState(1080);
  // Refunds of punches already spent on a reward. Counted back in so the
  // card never goes negative and the customer keeps what they redeemed.
  const [forgiven, setForgiven] = useState(0);

  const earned = orders.filter((o) => !o.refunded).length + forgiven;
  const balance = earned - redeemed * CARD_SIZE; // punches not yet spent
  const rewardReady = balance >= CARD_SIZE;
  const onCard = rewardReady ? CARD_SIZE : balance;
  const carryOver = Math.max(0, balance - CARD_SIZE);


  async function run(label: string, action: () => void, success: string) {
    setPending(label);
    setMessage(null);
    try {
      await fakeApi(null, failNext);
      action();
      setMessage({ tone: 'ok', text: success });
    } catch {
      setMessage({ tone: 'error', text: `${label} failed: the server did not respond. Nothing changed, so you can try again.` });
    } finally {
      setFailNext(false);
      setPending(null);
    }
  }

  function placeOrder() {
    const item = ITEMS[nextId % ITEMS.length];
    const id = nextId;
    run(
      'Order',
      () => {
        setOrders((o) => [{ id, item, date: 'Today', refunded: false }, ...o]);
        setNextId((n) => n + 1);
      },
      `Order #${id} placed. One punch added.`,
    );
  }

  function refund(order: Order) {
    // A punch that already paid for a redeemed reward can't be taken back.
    if (balance <= 0) {
      run(
        'Refund',
        () => {
          setOrders((o) => o.map((x) => (x.id === order.id ? { ...x, refunded: true } : x)));
          setForgiven((f) => f + 1);
        },
        `Order #${order.id} refunded. Its punch was already used on a redeemed reward, so the card stays the same.`,
      );
      return;
    }
    run(
      'Refund',
      () => setOrders((o) => o.map((x) => (x.id === order.id ? { ...x, refunded: true } : x))),
      `Order #${order.id} refunded. One punch removed.`,
    );
  }

  function redeem() {
    run('Redeem', () => setRedeemed((r) => r + 1), `${rewardText(design, STEPS)} redeemed. A new card starts now.`);
  }

  function reset() {
    setOrders(SEED);
    setRedeemed(0);
    setForgiven(0);
    setMessage(null);
    setFailNext(false);
    setNextId(1080);
  }

  return (
    <div className="pc">
      <CustomerPortal>
        <PunchCardView design={design} reached={onCard} busy={pending !== null}>
          {carryOver > 0 && <p className="pc-carry">{carryOver} extra {carryOver === 1 ? 'punch carries' : 'punches carry'} over to your next card.</p>}
          {rewardReady && (
            <button type="button" onClick={redeem} disabled={pending !== null} className="pc-primary">
              {pending === 'Redeem' ? 'Redeeming…' : `Redeem ${rewardText(design, STEPS).toLowerCase()}`}
            </button>
          )}
        </PunchCardView>
      </CustomerPortal>

      <div className="pc-side">
        <div className="pc-controls" role="group" aria-label="Demo controls">
          <p className="pc-controls-title">Demo controls</p>
          <button type="button" onClick={placeOrder} disabled={pending !== null}>
            {pending === 'Order' ? 'Placing order…' : 'Place an order'}
          </button>
          <label className="pc-toggle">
            <input type="checkbox" checked={failNext} onChange={(e) => setFailNext(e.target.checked)} />
            Make the next request fail
          </label>
          <button type="button" onClick={reset} className="pc-quiet">
            Reset demo
          </button>
        </div>

        {message && (
          <p className={`pc-msg pc-msg-${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>
            {message.text}
          </p>
        )}

        <h4 className="pc-orders-title">Order history</h4>
        <ul className="pc-orders">
          {orders.map((o) => (
            <li key={o.id} className={o.refunded ? 'is-refunded' : ''}>
              <span>
                <strong>#{o.id}</strong> {o.item}
                <small>{o.date}{o.refunded ? ', refunded' : ''}</small>
              </span>
              {!o.refunded && (
                <button type="button" onClick={() => refund(o)} disabled={pending !== null} className="pc-quiet">
                  Refund
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

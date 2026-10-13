import { useState } from 'react';
import { money } from './shared';
import { LineChart, ShareBars } from './charts';
import './demo.css';
import './analytics.css';

/**
 * Rewards and store credit performance for Loam Coffee Co. (fictional brand,
 * invented numbers). Answers two merchant questions: are rewards members worth
 * more over time, and is the credit we hand out actually being used?
 */

const MONTHS = 12;
const CREDIT = Array.from({ length: MONTHS }, (_, i) => {
  const issued = 4200 + i * 260 + Math.sin(i) * 300;
  return { issued, redeemed: issued * (0.66 + (i % 3) * 0.02), expired: issued * 0.06 };
});

// Average cumulative revenue per customer by their Nth order.
const ORDERS = Array.from({ length: 12 }, (_, i) => `${i + 1}`);
const ltv = (keep: number, aov: number) =>
  ORDERS.map((_, n) => Array.from({ length: n + 1 }, (_, k) => aov * keep ** k).reduce((a, b) => a + b, 0));
const MEMBERS = ltv(0.93, 31);
const NON_MEMBERS = ltv(0.84, 30);

const CHANNELS = [
  { label: 'Auto-applied at renewal', share: 0.54 },
  { label: 'Customer account', share: 0.27 },
  { label: 'Checkout', share: 0.14 },
  { label: 'Support team', share: 0.05 },
];

const fmt = (n: number) => money(Math.round(n), 'USD').replace(/\.00$/, '');

export default function RewardsAnalytics() {
  const [range, setRange] = useState<6 | 12>(12);
  const rows = CREDIT.slice(-range);
  const issued = rows.reduce((a, r) => a + r.issued, 0);
  const redeemed = rows.reduce((a, r) => a + r.redeemed, 0);
  const expired = rows.reduce((a, r) => a + r.expired, 0);
  const outstanding = issued - redeemed - expired;
  const lift = MEMBERS[11] / NON_MEMBERS[11] - 1;

  return (
    <div className="demo">
      <div className="demo-frame">
        <div className="an-head">
          <p className="demo-frame-label">Merchant admin · Rewards performance</p>
          <div className="an-seg" role="group" aria-label="Date range">
            {([6, 12] as const).map((r) => (
              <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>Last {r} months</button>
            ))}
          </div>
        </div>

        <dl className="an-tiles">
          <div><dt>Credit issued</dt><dd>{fmt(issued)}</dd></div>
          <div><dt>Credit redeemed</dt><dd>{fmt(redeemed)}</dd><small>{Math.round((redeemed / issued) * 100)}% of issued</small></div>
          <div><dt>Credit expired</dt><dd>{fmt(expired)}</dd></div>
          <div><dt>Still outstanding</dt><dd>{fmt(outstanding)}</dd><small>Owed to customers today</small></div>
        </dl>

        <div className="an-grid">
          <div>
            <p className="an-note">
              By their 12th order, rewards members have spent {Math.round(lift * 100)}% more than customers who never joined.
            </p>
            <LineChart
              title="Average lifetime revenue per customer, by order"
              desc="Line chart comparing average cumulative revenue for rewards members and non-members across their first 12 orders."
              x={ORDERS} xHead="Order" fmt={fmt}
              series={[
                { label: 'Rewards members', values: MEMBERS },
                { label: 'Not in rewards', values: NON_MEMBERS },
              ]}
            />
          </div>
          <div>
            <ShareBars
              title="Where credit gets used"
              fmt={fmt}
              rows={CHANNELS.map((c) => ({ label: c.label, value: redeemed * c.share }))}
            />
            <dl className="an-tiles an-behavior">
              <div><dt>Days to first use</dt><dd>18</dd><small>Average, after credit is issued</small></div>
              <div><dt>Credit balance</dt><dd>$12.40</dd><small>Average per customer with credit</small></div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { money } from './shared';
import { StackedBars } from './charts';
import './demo.css';
import './analytics.css';

/**
 * Referral performance for Loam Coffee Co. (fictional brand, invented numbers).
 * Headline totals, then revenue or orders by month, split by whether the
 * friend's first order was a one-time purchase or started a subscription.
 */

const MONTHS = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
const ONE_TIME_AOV = 34;
const SUB_AOV = 31;

// Steady growth with a holiday bump in December.
const ROWS = MONTHS.map((m, i) => {
  const bump = m === 'Dec' ? 1.35 : 1;
  const oneTime = Math.round((42 + i * 5.5 + Math.sin(i * 1.3) * 6) * bump);
  const subscription = Math.round((24 + i * 6.4 + Math.cos(i * 1.1) * 5) * bump);
  return { m, oneTime, subscription, rewarded: Math.round((oneTime + subscription) * 0.91) };
});

const fmt = (n: number) => money(Math.round(n), 'USD').replace(/\.00$/, '');
const num = (n: number) => Math.round(n).toLocaleString('en-US');

export default function ReferralAnalytics() {
  const [range, setRange] = useState<6 | 12>(12);
  const [metric, setMetric] = useState<'revenue' | 'orders'>('revenue');

  const rows = ROWS.slice(-range);
  const prev = ROWS.slice(-range * 2, -range);
  const sum = (rs: typeof ROWS, f: (r: (typeof ROWS)[number]) => number) => rs.reduce((a, r) => a + f(r), 0);
  const revenueOf = (r: (typeof ROWS)[number]) => r.oneTime * ONE_TIME_AOV + r.subscription * SUB_AOV;

  const revenue = sum(rows, revenueOf);
  const orders = sum(rows, (r) => r.oneTime + r.subscription);
  const rewarded = sum(rows, (r) => r.rewarded);
  const subShare = sum(rows, (r) => r.subscription) / orders;
  const growth = prev.length === rows.length ? revenue / sum(prev, revenueOf) - 1 : null;

  const series = metric === 'revenue'
    ? [
        { label: 'One-time orders', values: rows.map((r) => r.oneTime * ONE_TIME_AOV) },
        { label: 'Subscriptions', values: rows.map((r) => r.subscription * SUB_AOV) },
      ]
    : [
        { label: 'One-time orders', values: rows.map((r) => r.oneTime) },
        { label: 'Subscriptions', values: rows.map((r) => r.subscription) },
      ];

  return (
    <div className="demo">
      <div className="demo-frame">
        <div className="an-head">
          <p className="demo-frame-label">Merchant admin · Referral performance</p>
          <div className="an-seg" role="group" aria-label="Date range">
            {([6, 12] as const).map((r) => (
              <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>Last {r} months</button>
            ))}
          </div>
        </div>

        <dl className="an-tiles">
          <div>
            <dt>Referral revenue</dt><dd>{fmt(revenue)}</dd>
            {growth !== null && <small>{growth >= 0 ? '▲' : '▼'} {Math.abs(Math.round(growth * 100))}% vs previous {range} months</small>}
          </div>
          <div><dt>Referred orders</dt><dd>{num(orders)}</dd><small>{Math.round(subShare * 100)}% started a subscription</small></div>
          <div><dt>Rewards given</dt><dd>{num(rewarded)}</dd><small>Credit sent to the customer who referred</small></div>
        </dl>

        <div className="an-section-head">
          <h4>{metric === 'revenue' ? 'Revenue' : 'Orders'} from referrals</h4>
          <div className="an-seg" role="group" aria-label="Measure">
            <button type="button" aria-pressed={metric === 'revenue'} onClick={() => setMetric('revenue')}>Revenue</button>
            <button type="button" aria-pressed={metric === 'orders'} onClick={() => setMetric('orders')}>Orders</button>
          </div>
        </div>
        <StackedBars
          title={`Referred ${metric} by month, one-time vs subscription`}
          desc={`Stacked bar chart of referred ${metric} per month for the last ${range} months.`}
          x={rows.map((r) => r.m)} xHead="Month" series={series}
          fmt={metric === 'revenue' ? fmt : num}
        />
      </div>
    </div>
  );
}

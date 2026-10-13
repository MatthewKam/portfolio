import type { ReactNode } from 'react';
import './CustomerPortal.css';

/**
 * A Loam Coffee Co. customer account page to set a demo in context.
 * Decorative chrome only: the nav and side boxes don't do anything.
 */
export default function CustomerPortal({ children }: { children: ReactNode }) {
  return (
    <div className="pcp" role="region" aria-label="Customer account page (demo)">
      <div className="pcp-top">
        <span className="pcp-brand">Loam Coffee Co.</span>
        <span className="pcp-account" aria-hidden="true">J</span>
      </div>
      <nav className="pcp-nav" aria-label="Account (demo)">
        {['Overview', 'Subscriptions', 'Orders', 'Account'].map((l, i) => (
          <span key={l} className={i === 0 ? 'is-on' : ''}>{l}</span>
        ))}
      </nav>
      <p className="pcp-hello">Welcome back, Jordan</p>
      <div className="pcp-cols">
        <div className="pcp-main">{children}</div>
        <aside className="pcp-side">
          <div className="pcp-box">
            <p className="pcp-label">Next order</p>
            <p className="pcp-big">Sat, Oct 24</p>
            <p>Ridgeline blend, 12 oz · $18.00</p>
            <span className="pcp-link">Skip or reschedule</span>
          </div>
          <div className="pcp-box">
            <p className="pcp-label">Subscription</p>
            <p>Every 2 weeks · Active</p>
            <span className="pcp-link">Manage</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

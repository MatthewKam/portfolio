import type { ReactNode } from 'react';
import { REWARD_STEPS, STEPS, rewardText, stepIcon, type Design, type Icon } from './punchCardDesign';
import './PunchCardView.css';

/** The customer-facing card, drawn from the merchant's design. */

export const ICONS: Record<Icon, { label: string; svg: ReactNode }> = {
  dot: { label: 'Dot', svg: <circle cx="12" cy="12" r="6" /> },
  bean: {
    label: 'Bean',
    svg: <><ellipse cx="12" cy="12" rx="6" ry="8.5" transform="rotate(30 12 12)" /><path d="M9 6.5c3 3 0 8 4 11" className="pcv-cut" /></>,
  },
  cup: { label: 'Cup', svg: <path d="M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 9.5h1.5a2.5 2.5 0 0 1 0 5H16" /> },
  star: { label: 'Star', svg: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z" /> },
  percent: {
    label: 'Percent',
    svg: <><circle cx="7.5" cy="7.5" r="2.8" /><circle cx="16.5" cy="16.5" r="2.8" /><path d="M16.6 4.2l2.2 1.4L7.4 19.8l-2.2-1.4z" /></>,
  },
  money: {
    label: 'Money',
    svg: <><circle cx="12" cy="12" r="8.5" /><path d="M14.6 9.3c-.6-.8-1.6-1.2-2.7-1.2-1.4 0-2.5.8-2.5 1.9 0 2.6 5.3 1.4 5.3 4.1 0 1.2-1.2 2-2.7 2-1.1 0-2.2-.5-2.8-1.3M12 6.3v11.4" className="pcv-cut" /></>,
  },
  gift: {
    label: 'Gift',
    svg: (
      <>
        <ellipse cx="9.3" cy="7.4" rx="3" ry="1.8" transform="rotate(28 9.3 7.4)" />
        <ellipse cx="14.7" cy="7.4" rx="3" ry="1.8" transform="rotate(-28 14.7 7.4)" />
        <path d="M4 9.5h16v3.5H4zM5.5 13.8h13V20h-13z" />
        <path d="M12 9.5V20" className="pcv-cut" />
      </>
    ),
  },
};

export default function PunchCardView({
  design: d, reached, busy, children,
}: { design: Design; reached: number; busy?: boolean; children?: ReactNode }) {
  if (!d.showCard) {
    return (
      <div className="pcv-hidden" role="note">
        <strong>Punch card hidden</strong>
        <span>The merchant turned the card off. Punches still count; customers just don't see the card.</span>
      </div>
    );
  }
  const done = reached >= STEPS;
  const next = REWARD_STEPS.find((n) => n > reached);
  const left = next ? next - reached : 0;

  return (
    <div className="pcv" aria-busy={busy}>
      {d.showBanner && (
        <div className={`pcv-banner size-${d.bannerSize} align-${d.bannerAlign}`} role="img" aria-label="Coffee bags on a shelf">
          <svg viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <rect width="320" height="120" fill="#d9c2a1" />
            <rect y="92" width="320" height="28" fill="#b89670" />
            <path d="M40 92V44l10-10h40l10 10v48z" fill="#3b2a20" />
            <path d="M128 92V38l12-12h46l12 12v54z" fill="#5a3f2f" />
            <path d="M226 92V50l9-9h36l9 9v42z" fill="#2e6b58" />
            <circle cx="70" cy="66" r="9" fill="#e2b23c" />
            <circle cx="163" cy="62" r="11" fill="#f6ead8" />
            <circle cx="253" cy="70" r="8" fill="#e2b23c" />
          </svg>
        </div>
      )}
      <div className="pcv-head">
        <h4>{d.heading || 'Untitled punch card'}</h4>
        <p className="pcv-count" aria-live="polite">{Math.min(reached, STEPS)} of {STEPS}</p>
      </div>
      <p className="pcv-desc">{done ? d.complete : d.description}</p>

      <ol className="pcv-steps" style={{ gap: `${d.spacing}px` }}>
        {Array.from({ length: STEPS }, (_, i) => {
          const n = i + 1;
          const isReached = n <= reached;
          const reward = REWARD_STEPS.includes(n) ? rewardText(d, n) : null;
          return (
            <li key={n} className={`${isReached ? 'is-reached' : ''}${reward ? ' has-reward' : ''}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[stepIcon(d, n)].svg}</svg>
              <span className="pcv-label">{reward ?? (d.showStepNumbers ? `Order ${n}` : '')}</span>
              <span className="visually-hidden">{isReached ? ', reached' : ', not reached yet'}</span>
            </li>
          );
        })}
      </ol>

      {!done && next && (
        <p className="pcv-next">{left} more {left === 1 ? 'order' : 'orders'} until {rewardText(d, next).toLowerCase()}.</p>
      )}
      {children}
    </div>
  );
}

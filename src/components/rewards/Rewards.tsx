import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { MILESTONES, SLOTS, join, leave, markSeen, reset, tierOf, useMembership } from './membership';
import { confetti } from './confetti';
import { contactLinks } from '../../data/contact';
import './rewards.css';

export type WorkItem = { slug: string; title: string; company: string; years: string; summary: string };

// What each stamp says around its rim.
const RIM: Record<string, string> = {
  'punch-cards': 'PUNCH CARDS',
  'cancellation-flow': 'RETENTION',
  referrals: 'REFERRALS',
  'vejo-bundles-headless': 'BUNDLES',
  'ad-exchange-dashboards': 'DASHBOARDS',
};

const RESUME = '/resume.pdf';
const LINKEDIN = 'https://www.linkedin.com/in/mattkam/';

// The same slug always lands at the same slight angle, like a hand-pressed stamp.
const tilt = (s: string) => ((Array.from(s).reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 25) - 12);

/** `children` is the page's intro text, set beside the card on wide screens. */
export default function Rewards({ work, children }: { work: WorkItem[]; children?: ReactNode }) {
  const m = useMembership();
  const [mounted, setMounted] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [said, setSaid] = useState('');
  const motion = useRef(true);

  useEffect(() => {
    setMounted(true);
    motion.current = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const count = m?.stamps.length ?? 0;
  const fresh = m ? m.stamps.slice(m.seen) : [];
  const tier = tierOf(count);
  // The card turns into contact details once the last stamp has landed.
  const complete = !!m && count >= SLOTS && m.seen >= SLOTS;

  // New stamps slam down one after another, then count as seen.
  useEffect(() => {
    if (!m || fresh.length === 0) return;
    const gap = motion.current ? 420 : 0;
    // The highest milestone crossed, so stamping several at once still reaches Gold.
    const crossed = [...MILESTONES].reverse().find((ms) => m.seen < ms.at && count >= ms.at);
    const timer = setTimeout(() => {
      markSeen();
      if (crossed) {
        setSaid(`${crossed.tier} status. ${crossed.reward}.`);
        if (crossed.at === SLOTS) { setFlipped(false); confetti(); }
      } else {
        setSaid(`${fresh.length === 1 ? 'Stamp' : `${fresh.length} stamps`} added. ${count} of ${SLOTS}.`);
      }
    }, 600 + fresh.length * gap);
    return () => clearTimeout(timer);
  }, [m?.stamps.length, m?.seen]);

  const onReset = () => {
    reset();
    setFlipped(false);
    setSaid(`Card reset. 0 of ${SLOTS}.`);
  };

  // Tilt toward the pointer; the foil follows the same point.
  const card = useRef<HTMLDivElement>(null);
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !motion.current) return;
    const el = card.current!;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${(x - 0.5) * 16}deg`);
    el.style.setProperty('--rx', `${(0.5 - y) * 12}deg`);
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
  };
  const onLeave = () => {
    const el = card.current!;
    ['--rx', '--ry'].forEach((p) => el.style.setProperty(p, '0deg'));
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '30%');
  };

  const slots = work.map((w) => w.slug).slice(0, SLOTS);

  return (
    <div className="rw" data-tier={tier.toLowerCase()} data-x="Rewards.tsx">
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <filter id="rw-ink">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="3" />
        </filter>
      </svg>

      <div className="rw-head">
      <div className="rw-intro">{children}</div>
      <div className="rw-hold">
      <div className="rw-stage" onPointerMove={onMove} onPointerLeave={onLeave}>
        <div className={`rw-card ${flipped ? 'is-flipped' : ''} ${mounted ? '' : 'is-loading'}`} ref={card}>
          <div className="rw-face rw-front">
            <div className="rw-foil" aria-hidden="true" />
            <div className="rw-top">
              <span className="rw-brand">Matt Kam<br />Rewards</span>
              <span className="rw-tier">{m ? tier : 'Guest'}</span>
            </div>
            {complete ? (
              <div className="rw-contact">
                <p className="rw-contact-kicker">Card complete · Gold member</p>
                <p className="rw-contact-title">Let's talk.</p>
                <ul>
                  {contactLinks.map((l) => (
                    <li key={l.href}>
                      <a href={l.href} {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{l.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
            <ol className="rw-slots" aria-label={m ? `${count} of ${SLOTS} stamps` : 'Stamp slots'}>
              {slots.map((slug, i) => {
                const at = m?.stamps.indexOf(slug) ?? -1;
                const isNew = m && at >= m.seen;
                const delay = isNew ? (at - m!.seen) * (motion.current ? 0.42 : 0) + 0.35 : 0;
                const name = work.find((w) => w.slug === slug)?.title;
                return (
                  <li key={slug} className="rw-slot" aria-label={`${name}: ${at >= 0 ? 'stamped' : 'not yet'}`}>
                    {at >= 0
                      ? <Stamp rim={RIM[slug] ?? slug.toUpperCase()} angle={tilt(slug)} isNew={!!isNew} delay={delay} />
                      : <span className="rw-empty" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>}
                  </li>
                );
              })}
            </ol>
            )}
            <div className="rw-bottom">
              <span><small>Member no.</small>{m ? m.number : '•••• ••••'}</span>
              <span><small>Since</small>{m ? m.joined.slice(0, 4) : '—'}</span>
            </div>
          </div>
          <div className="rw-face rw-back" aria-hidden={!flipped}>
            <div className="rw-strip" />
            <dl>
              {MILESTONES.map((ms) => (
                <div key={ms.at}><dt>{ms.at} stamps · {ms.tier}</dt><dd>{ms.reward}</dd></div>
              ))}
            </dl>
            <p>Not transferable. No cash value. Valid wherever good interfaces are sold.</p>
          </div>
        </div>
      </div>

      <div className="rw-actions">
        {!mounted ? null : !m ? (
          <>
            <button type="button" className="rw-join" onClick={join}>Join the program</button>
            <p className="rw-small">Free. No email, no account. Your card lives in this browser only.</p>
          </>
        ) : (
          <p className="rw-progress">
            {complete ? <><strong>Card complete.</strong> Quote member no. {m.number} and you go to the front of the line.</> : (
              <>
                <strong>{count} of {SLOTS}</strong> stamps
                {count < SLOTS && <> · {MILESTONES.find((ms) => ms.at > count)!.at - count} to {MILESTONES.find((ms) => ms.at > count)!.tier}</>}
              </>
            )}
          </p>
        )}
        <div className="rw-tools">
          {m && <button type="button" onClick={() => setFlipped((f) => !f)}>{flipped ? 'Turn to front' : 'Turn over'}</button>}
          {m && count > 0 && <button type="button" onClick={onReset}>Reset card</button>}
        </div>
      </div>
      </div>
      </div>
      <p className="visually-hidden" role="status">{said}</p>

      <section className="rw-earn" id="work" aria-labelledby="rw-earn-title">
        <h2 id="rw-earn-title">Ways to earn</h2>
        <p className="rw-lede">Each case study has a working demo inside. Open one and it stamps your card.</p>
        <ol className="rw-list">
          {work.map((w, i) => {
            const got = m?.stamps.includes(w.slug);
            return (
              <li key={w.slug}>
                <a href={`/work/${w.slug}`}>
                  <span className="rw-n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="rw-what">
                    <strong>{w.title}</strong>
                    <span>{w.company} · {w.years}</span>
                  </span>
                  <span className={`rw-pts ${got ? 'is-got' : ''}`}>{got ? 'Stamped' : '+1 stamp'}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rw-rewards" aria-labelledby="rw-rewards-title">
        <h2 id="rw-rewards-title">Rewards</h2>
        <ul>
          <li className={count >= 3 ? 'is-open' : ''}>
            <span className="rw-at">3</span>
            <div>
              <strong>Silver: the résumé</strong>
              {count >= 3
                ? <a href={RESUME}>Download the PDF</a>
                : <span>Unlocks at 3 stamps. (Or <a href={RESUME}>skip the game</a>. I'm not going to gatekeep a PDF.)</span>}
            </div>
          </li>
          <li className={count >= SLOTS ? 'is-open' : ''}>
            <span className="rw-at">{SLOTS}</span>
            <div>
              <strong>Gold: a direct line</strong>
              {count >= SLOTS && m
                ? <span>Your card is now my contact card. Message me on <a href={LINKEDIN}>LinkedIn</a> and quote member no. <b>{m.number}</b>. You go to the front of the line.</span>
                : <span>Unlocks at {SLOTS} stamps. Your card turns into my contact card.</span>}
            </div>
          </li>
        </ul>
        {m && <button type="button" className="rw-leave" onClick={() => { leave(); setFlipped(false); }}>Leave the program</button>}
      </section>
    </div>
  );
}

function Stamp({ rim, angle, isNew, delay }: { rim: string; angle: number; isNew: boolean; delay: number }) {
  const id = `rim-${rim.replace(/\W/g, '')}`;
  return (
    <svg
      className={`rw-stamp ${isNew ? 'is-new' : ''}`} viewBox="0 0 100 100" aria-hidden="true"
      style={{ '--a': `${angle}deg`, '--d': `${delay}s` } as React.CSSProperties}
    >
      <g filter="url(#rw-ink)">
        <circle cx="50" cy="50" r="45" className="rw-ring" />
        <circle cx="50" cy="50" r="27" className="rw-ring" />
        <path id={id} d="M 50 50 m -36 0 a 36 36 0 1 1 72 0 a 36 36 0 1 1 -72 0" fill="none" />
        <text className="rw-rim"><textPath href={`#${id}`} startOffset="25%" textAnchor="middle">{rim}</textPath></text>
        <path d="M50 35l4.4 9 9.9 1.4-7.2 7 1.7 9.8L50 57.6l-8.8 4.6 1.7-9.8-7.2-7 9.9-1.4z" className="rw-star" />
      </g>
    </svg>
  );
}

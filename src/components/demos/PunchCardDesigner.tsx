import { useEffect, useRef, useState } from 'react';
import { DEFAULT_DESIGN, REWARD_ICONS, REWARD_STEPS, STEP_ICONS, STEPS, setDesign, stepIcon, useDesign, type Design, type Icon } from './punchCardDesign';
import PunchCardView, { ICONS } from './PunchCardView';
import './demo.css';
import './PunchCardDesigner.css';

/**
 * Punch card look-and-feel editor for Loam Coffee Co. (fictional brand).
 * The merchant edits copy, icons, an optional banner and spacing. The design
 * is shared, so the customer card in "Try it" changes too.
 */

export default function PunchCardDesigner() {
  const d = useDesign();
  const [orders, setOrders] = useState(3);
  const [mobile, setMobile] = useState(false);
  const set = <K extends keyof Design>(k: K, v: Design[K]) => setDesign({ [k]: v });

  return (
    <div className="demo pcd">
      <form className="demo-frame pcd-form" onSubmit={(e) => e.preventDefault()}>
        <p className="demo-frame-label">Merchant admin · Punch card design</p>

        <fieldset>
          <legend>Customer portal</legend>
          <label className="demo-toggle">
            <input type="checkbox" checked={d.showCard} onChange={(e) => set('showCard', e.target.checked)} />
            Show the punch card in the customer portal
          </label>
        </fieldset>

        <fieldset>
          <legend>Text</legend>
          <label>Heading<input type="text" value={d.heading} onChange={(e) => set('heading', e.target.value)} /></label>
          <label>Description<textarea rows={2} value={d.description} onChange={(e) => set('description', e.target.value)} /></label>
          <label>When the card is full<input type="text" value={d.complete} onChange={(e) => set('complete', e.target.value)} /></label>
        </fieldset>

        <fieldset>
          <legend>Rewards</legend>
          {REWARD_STEPS.map((n) => {
            const name = n === STEPS ? `Order ${n} (card full)` : `Order ${n}`;
            return (
              <div key={n} className="pcd-reward">
                <label>
                  {name}
                  <input
                    type="text" maxLength={24} value={d.rewards[n] ?? ''}
                    onChange={(e) => set('rewards', { ...d.rewards, [n]: e.target.value })}
                  />
                </label>
                <IconSelect
                  name={`pcd-reward-icon-${n}`} label={`${name} icon`} options={REWARD_ICONS}
                  value={stepIcon(d, n)} onChange={(v) => set('rewardIcons', { ...d.rewardIcons, [n]: v })}
                />
              </div>
            );
          })}
        </fieldset>

        <fieldset>
          <legend>Steps</legend>
          <IconPicker name="pcd-icon" label="Step icon" options={STEP_ICONS} value={d.icon} onChange={(v) => set('icon', v)} />
          <label className="demo-toggle">
            <input type="checkbox" checked={d.showStepNumbers} onChange={(e) => set('showStepNumbers', e.target.checked)} />
            Show order numbers on steps without a reward
          </label>
          <label>
            Space between steps: {d.spacing}px
            <input type="range" min={4} max={28} value={d.spacing} onChange={(e) => set('spacing', Number(e.target.value))} />
          </label>
        </fieldset>

        <fieldset>
          <legend>Banner image</legend>
          <label className="demo-toggle">
            <input type="checkbox" checked={d.showBanner} onChange={(e) => set('showBanner', e.target.checked)} />
            Show a banner above the heading
          </label>
          {d.showBanner && (
            <div className="pcd-row">
              <label>
                Size
                <select value={d.bannerSize} onChange={(e) => set('bannerSize', e.target.value as Design['bannerSize'])}>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="full">Full width</option>
                </select>
              </label>
              <label>
                Position
                <select
                  value={d.bannerAlign} disabled={d.bannerSize === 'full'}
                  onChange={(e) => set('bannerAlign', e.target.value as Design['bannerAlign'])}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </div>
          )}
        </fieldset>

        <button type="button" className="quiet" onClick={() => { setDesign(DEFAULT_DESIGN); setOrders(3); }}>Reset design</button>
      </form>

      <div className="pcd-side">
        <div className="demo-controls" role="group" aria-label="Preview controls">
          <p className="demo-controls-title">Preview · changes also apply to the card in Try it</p>
          <div className="pcd-seg" role="group" aria-label="Screen size">
            <button type="button" aria-pressed={!mobile} onClick={() => setMobile(false)}>Desktop</button>
            <button type="button" aria-pressed={mobile} onClick={() => setMobile(true)}>Phone</button>
          </div>
          <label className="demo-toggle pcd-orders">
            Orders placed: {orders}
            <input type="range" min={0} max={STEPS} value={orders} onChange={(e) => setOrders(Number(e.target.value))} />
          </label>
        </div>

        <div className={`pcd-stage${mobile ? ' is-mobile' : ''}`}>
          <PunchCardView design={d} reached={orders} />
        </div>
      </div>
    </div>
  );
}

function IconPicker({ name, label, options, value, onChange }: {
  name: string; label: string; options: Icon[]; value: Icon; onChange: (v: Icon) => void;
}) {
  return (
    <div className="pcd-icons" role="radiogroup" aria-label={label}>
      {options.map((k) => (
        <label key={k} className={value === k ? 'is-on' : ''}>
          <input type="radio" name={name} checked={value === k} onChange={() => onChange(k)} />
          <svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[k].svg}</svg>
          {ICONS[k].label}
        </label>
      ))}
    </div>
  );
}

/** Icon choice in a dropdown, for rows where a full picker is too much. */
function IconSelect({ name, label, options, value, onChange }: {
  name: string; label: string; options: Icon[]; value: Icon; onChange: (v: Icon) => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => { if (ref.current) ref.current.open = false; };

  useEffect(() => {
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  return (
    <details
      ref={ref} className="pcd-iconselect"
      onKeyDown={(e) => {
        if ((e.key === 'Escape' || (e.key === 'Enter' && e.target instanceof HTMLInputElement)) && ref.current?.open) {
          e.preventDefault();
          close();
          ref.current.querySelector('summary')?.focus();
        }
      }}
    >
      <summary aria-label={`${label}: ${ICONS[value].label}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[value].svg}</svg>
        <span aria-hidden="true">▾</span>
      </summary>
      <div className="pcd-iconmenu" role="radiogroup" aria-label={label}>
        {options.map((k) => (
          <label key={k} className={value === k ? 'is-on' : ''}>
            <input type="radio" name={name} checked={value === k} onChange={() => onChange(k)}
              // Arrow keys also fire click (detail 0); only a real click closes the menu.
              onClick={(e) => { if (e.detail > 0) close(); }}
            />
            <svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[k].svg}</svg>
            {ICONS[k].label}
          </label>
        ))}
      </div>
    </details>
  );
}

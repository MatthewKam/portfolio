import { useSyncExternalStore } from 'react';

/**
 * The merchant's punch card design, shared by every punch card island on the
 * page. Astro islands are separate React roots, but they load this module
 * once per page, so a module-level store is enough to keep them in sync.
 */

export type Icon = 'dot' | 'bean' | 'cup' | 'star' | 'percent' | 'money' | 'gift';
export const STEP_ICONS: Icon[] = ['dot', 'bean', 'cup', 'star'];
export const REWARD_ICONS: Icon[] = ['star', 'percent', 'money', 'gift'];
export type Design = {
  heading: string;
  description: string;
  complete: string;
  showStepNumbers: boolean;
  icon: Icon;
  showBanner: boolean;
  bannerSize: 'small' | 'medium' | 'full';
  bannerAlign: 'left' | 'center' | 'right';
  spacing: number;
  /** Reward text by step number. Which steps carry a reward is fixed. */
  rewards: Record<number, string>;
  /** Icon by reward step; other steps use `icon`. */
  rewardIcons: Record<number, Icon>;
};

export const STEPS = 8;
/** Steps that carry a reward. The last step is the one customers redeem. */
export const REWARD_STEPS = [4, 8];

export const DEFAULT_DESIGN: Design = {
  heading: 'Loam Rewards',
  description: 'Eight bags, then one on us. Rewards unlock automatically.',
  complete: 'Your free bag is ready. Thanks for drinking Loam!',
  showStepNumbers: true,
  icon: 'bean',
  showBanner: false,
  bannerSize: 'medium',
  bannerAlign: 'left',
  spacing: 12,
  rewards: { 4: '10% off', 8: 'Free bag' },
  rewardIcons: { 4: 'percent', 8: 'gift' },
};

let design = DEFAULT_DESIGN;
const listeners = new Set<() => void>();

/** Reward text for a step, with a fallback when the merchant clears it. */
export const rewardText = (d: Design, step: number) => d.rewards[step]?.trim() || 'Reward';

/** The icon a step shows: its reward's own icon, or the card's step icon. */
export const stepIcon = (d: Design, step: number): Icon =>
  (REWARD_STEPS.includes(step) && d.rewardIcons[step]) || d.icon;

export function setDesign(next: Partial<Design> | Design) {
  design = { ...design, ...next };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDesign() {
  return useSyncExternalStore(subscribe, () => design, () => DEFAULT_DESIGN);
}

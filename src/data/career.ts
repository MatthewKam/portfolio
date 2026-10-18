/**
 * Résumé data. The home page timeline is drawn from this file only.
 * Dates are 'YYYY-MM'; `end: null` means present. Months are inclusive.
 */

export interface Role {
  id: string;
  company: string;
  title: string;
  location?: string;
  start: string;
  end: string | null;
  kind: 'job' | 'freelance' | 'education';
  summary: string;
  highlights: string[];
  stack: string[];
  /** slugs in src/content/work */
  work?: string[];
}

export const roles: Role[] = [
  {
    id: 'recharge',
    company: 'Recharge',
    title: 'Frontend Software Engineer',
    location: 'Santa Monica, CA',
    start: '2022-02',
    end: '2026-08',
    kind: 'job',
    summary: 'Loyalty, payments, referrals and subscriptions in the merchant portal.',
    highlights: [
      'Led Punch Cards end to end, from architecture through launch: 70+ merged PRs over 7 months, including a drag-and-drop experience builder, milestone/reward engine and activation workflow.',
      'Built and scaled the Failed Payment Recovery flow editor: Klaviyo integration, conditional branching, A/B split testing and recovery-rate dashboards.',
      'Shipped Referrals and Credits & Rewards end to end: reward flows, multi-currency credit settings, live analytics and customer-facing landing pages.',
      'Delivered Digital Subscriptions / Entitlements, giving merchants a UI for plan-based access in the customer portal.',
      'Owned cancellation-prevention and offer flows in the Customer Portal across pricing, discounts and localization.',
      '378+ merged pull requests (~500 commits).',
    ],
    stack: ['TypeScript', 'React', 'Vue', 'Vitest'],
    work: ['punch-cards', 'cancellation-flow', 'referrals'],
  },
  {
    id: 'vejo',
    company: 'Vejo, Inc.',
    title: 'Front End Engineer → Senior',
    location: 'Santa Monica, CA',
    start: '2020-09',
    end: '2022-01',
    kind: 'job',
    summary: 'Flutter web and mobile apps, Shopify sales funnels.',
    highlights: [
      'Updated and optimized the Flutter web app and companion iOS/Android app; improved page load scores by more than 50%.',
      'Built custom sales funnels in Liquid with Cart.js; theme schema gave admins control of inventory and buy flows.',
      'Created a master style guide and Liquid/SCSS component library so marketing could run campaigns and A/B tests on their own.',
    ],
    stack: ['Flutter', 'Shopify', 'Liquid', 'SCSS'],
    work: ['vejo-bundles-headless'],
  },
  {
    id: 'ad-exchange',
    company: 'Ad Exchange Group',
    title: 'Front End Developer → Senior',
    location: 'Costa Mesa / Irvine, CA',
    start: '2014-11',
    end: '2019-10',
    kind: 'job',
    summary: 'Affiliate performance dashboards, PHP sales funnels and branded Shopify storefronts.',
    highlights: [
      'Developed internal React dashboards and led UX/UI design for advertiser-facing tools.',
      'Built a custom Shopify theme for the branded division; clients included Playboy and Bulletproof Coffee.',
      'Managed concurrent projects and supervised junior developers.',
      'Built a reusable PHP component library that cut deployment time; integrated Google Analytics and Optimizely.',
    ],
    stack: ['React', 'AngularJS', 'Shopify', 'Liquid', 'PHP', 'Optimizely'],
    work: ['ad-exchange-dashboards'],
  },
  {
    id: 'freelance',
    company: 'Freelance',
    title: 'Front End Developer / Consultant',
    start: '2014-07',
    end: null,
    kind: 'freelance',
    summary: 'E-commerce and marketing sites for small businesses.',
    highlights: [
      'Scope requirements with small-business clients and deliver responsive, mobile-first, SEO-optimized sites on Shopify, Wix, WordPress and Squarespace.',
    ],
    stack: ['Shopify', 'WordPress'],
  },
  {
    id: 'general-assembly',
    company: 'General Assembly',
    title: 'Web Development Immersive',
    location: 'Santa Monica, CA',
    start: '2014-05',
    end: '2014-05',
    kind: 'education',
    summary: '12-week full-time full-stack bootcamp.',
    highlights: [],
    stack: [],
  },
];

/** Tools shown on the "stack over time" rows, in display order. */
export const stackRows = ['TypeScript', 'React', 'Vue', 'Flutter', 'AngularJS', 'Liquid', 'PHP'];

export const skills: Record<string, string[]> = {
  'Languages & frameworks': ['TypeScript', 'JavaScript', 'React', 'Vue', 'AngularJS', 'HTML/CSS/SCSS', 'REST APIs'],
  'Testing & quality': ['Jest', 'Vitest', 'A/B testing', 'Code review', 'Git', 'Agile'],
  'Platforms & backend': ['Shopify', 'Liquid', 'Flutter', 'PHP', 'Ruby on Rails', 'Python'],
  'Analytics & design': ['Google Analytics', 'Optimizely', 'UX/UI design', 'Illustrator', 'Photoshop'],
};

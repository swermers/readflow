'use client';

import { motion } from 'framer-motion';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    label: 'The Quiet Inbox',
    features: [
      'Unlimited Sources',
      'Highlights & Notes',
      '5 AI Summaries / month',
      '2 Audio Listens / month',
      '7-day Rack retention',
    ],
  },
  {
    name: 'Pro',
    price: '$7',
    annual: '$59/yr',
    label: 'The Organized Reader',
    features: [
      'Everything in Free',
      '50 AI Summaries / month',
      '20 Audio Listens / month',
      'Signal Sorting',
      'Highlight Export',
      '30-day Rack retention',
    ],
    badge: 'Most Popular',
  },
  {
    name: 'Elite',
    price: '$19',
    annual: '$149/yr',
    label: 'The Executive Intelligence',
    features: [
      'Everything in Pro',
      'Unlimited AI Summaries',
      'Unlimited Audio',
      'Weekly Brief & Podcast',
      'Notion Sync',
      'Semantic Search',
      'Multiple Gmail Accounts',
      'Priority Neural Voice',
    ],
    highlight: true,
    badge: 'Best for Founders',
  },
];

export default function PricingGrid() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55 }}
      className="grid gap-4 md:grid-cols-3"
    >
      {tiers.map((tier) => (
        <article
          key={tier.name}
          className={`relative rounded-2xl border p-6 shadow-sm ${
            tier.highlight
              ? 'border-accent bg-accent/5 shadow-[0_12px_35px_rgba(230,57,45,0.16)]'
              : 'border-line bg-surface-raised'
          }`}
        >
          {tier.badge ? (
            <span className="absolute -top-3 right-4 rounded-full border border-accent/30 bg-surface px-3 py-1 text-xs text-accent">
              {tier.badge}
            </span>
          ) : null}
          <h3 className="text-heading text-ink">{tier.name}</h3>
          <p className="mt-2 text-3xl font-bold text-ink">{tier.price}<span className="text-base text-ink-muted">/mo</span></p>
          {'annual' in tier && tier.annual && (
            <p className="text-xs text-accent font-medium mt-0.5">{tier.annual} — save 30%</p>
          )}
          <p className="mt-1 text-sm text-ink-muted">{tier.label}</p>
          <ul className="mt-4 space-y-2 text-sm text-ink-muted">
            {tier.features.map((feature) => (
              <li key={feature}>• {feature}</li>
            ))}
          </ul>
        </article>
      ))}
    </motion.div>
  );
}

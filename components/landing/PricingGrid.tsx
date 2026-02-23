'use client';

import { motion } from 'framer-motion';

const tokenPacks = [
  {
    name: 'Free',
    price: '$0',
    label: 'Get Started',
    tokens: '30 tokens',
    features: [
      '30 free tokens on signup',
      'Unlimited Sources',
      'Highlights & Notes',
      '~6 AI Summaries or ~3 Listens',
      '7-day Rack retention',
    ],
  },
  {
    name: 'Starter',
    price: '$3',
    label: '100 tokens',
    features: [
      '100 tokens — use anytime',
      '~20 AI Summaries',
      '~10 Audio Listens',
      'Signal Sorting',
      'Highlight Export',
    ],
  },
  {
    name: 'Standard',
    price: '$10',
    label: '500 tokens',
    features: [
      '500 tokens — best value',
      '~100 AI Summaries',
      '~50 Audio Listens',
      'Weekly Brief & Podcast',
      'Notion Sync',
    ],
    badge: 'Best Value',
    highlight: true,
  },
  {
    name: 'Power',
    price: '$25',
    label: '1,500 tokens',
    features: [
      '1,500 tokens',
      '~300 AI Summaries',
      '~150 Audio Listens',
      'Everything included',
      'Lowest per-token cost',
    ],
    badge: 'Power User',
  },
];

export default function PricingGrid() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55 }}
    >
      <p className="text-center text-sm text-ink-muted mb-6">
        Pay per use. No subscriptions. Tokens never expire.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tokenPacks.map((pack) => (
          <article
            key={pack.name}
            className={`relative rounded-2xl border p-6 shadow-sm ${
              pack.highlight
                ? 'border-accent bg-accent/5 shadow-[0_12px_35px_rgba(230,57,45,0.16)]'
                : 'border-line bg-surface-raised'
            }`}
          >
            {pack.badge ? (
              <span className="absolute -top-3 right-4 rounded-full border border-accent/30 bg-surface px-3 py-1 text-xs text-accent">
                {pack.badge}
              </span>
            ) : null}
            <h3 className="text-heading text-ink">{pack.name}</h3>
            <p className="mt-2 text-3xl font-bold text-ink">{pack.price}</p>
            <p className="mt-1 text-sm text-ink-muted">{pack.label}</p>
            <ul className="mt-4 space-y-2 text-sm text-ink-muted">
              {pack.features.map((feature) => (
                <li key={feature}>&#8226; {feature}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <p className="text-center text-xs text-ink-faint mt-4">
        TL;DR = 5 tokens &middot; Listen = 10 tokens &middot; All features unlocked for everyone.
      </p>
    </motion.div>
  );
}

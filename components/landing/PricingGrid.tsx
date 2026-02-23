'use client';

import { motion } from 'framer-motion';

const tokenActions = [
  { action: 'TL;DR Summary', cost: '5 tokens', description: 'AI-generated bullet-point summary' },
  { action: 'Audio Digest', cost: '10 tokens', description: '2-3 min podcast-style narration' },
  { action: 'Weekly Brief', cost: '10 tokens', description: 'Synthesis across your top reads' },
  { action: 'Weekly Podcast', cost: '15 tokens', description: 'Audio version of your brief' },
  { action: 'Signal Sort', cost: '1 token', description: 'Classify newsletters by signal' },
  { action: 'Highlights & Notes', cost: 'Free', description: 'Save and annotate any passage' },
  { action: 'Note Export', cost: 'Free', description: 'Export highlights as Markdown' },
];

const tokenPacks = [
  {
    name: 'Starter',
    price: '$4',
    tokens: '100 tokens',
    examples: '~20 summaries or ~10 digests',
  },
  {
    name: 'Standard',
    price: '$12',
    tokens: '500 tokens',
    examples: '~100 summaries or ~50 digests',
    badge: 'Best Value',
    highlight: true,
  },
  {
    name: 'Power',
    price: '$29',
    tokens: '1,500 tokens',
    examples: '~300 summaries or ~150 digests',
  },
];

export default function PricingGrid() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55 }}
      className="space-y-10"
    >
      {/* Tagline */}
      <div className="text-center">
        <p className="text-sm text-ink-muted">
          Pay per use. No subscriptions. All features unlocked for everyone.
        </p>
        <p className="text-xs text-ink-faint mt-1">
          Start with 30 free tokens on signup. Buy more anytime — tokens never expire.
        </p>
      </div>

      {/* What things cost */}
      <div>
        <h3 className="text-heading text-ink text-center mb-4">What things cost</h3>
        <div className="max-w-2xl mx-auto border border-line divide-y divide-line">
          {tokenActions.map((item) => (
            <div key={item.action} className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="text-sm font-medium text-ink">{item.action}</span>
                <span className="text-xs text-ink-faint ml-2 hidden sm:inline">{item.description}</span>
              </div>
              <span className={`text-sm font-mono ${item.cost === 'Free' ? 'text-green-600 dark:text-green-400' : 'text-ink-muted'}`}>
                {item.cost}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Token packs */}
      <div>
        <h3 className="text-heading text-ink text-center mb-4">Token packs</h3>
        <div className="grid gap-4 sm:grid-cols-3 max-w-3xl mx-auto">
          {tokenPacks.map((pack) => (
            <article
              key={pack.name}
              className={`relative rounded-2xl border p-6 shadow-sm text-center ${
                pack.highlight
                  ? 'border-accent bg-accent/5 shadow-[0_12px_35px_rgba(230,57,45,0.16)]'
                  : 'border-line bg-surface-raised'
              }`}
            >
              {pack.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-accent/30 bg-surface px-3 py-1 text-xs text-accent whitespace-nowrap">
                  {pack.badge}
                </span>
              )}
              <p className="text-3xl font-bold text-ink">{pack.price}</p>
              <p className="text-sm font-medium text-ink mt-1">{pack.tokens}</p>
              <p className="text-xs text-ink-faint mt-2">{pack.examples}</p>
            </article>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

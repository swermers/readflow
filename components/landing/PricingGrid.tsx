'use client';

import { motion } from 'framer-motion';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    label: 'The Quiet Inbox',
    features: ['5 Sources'],
  },
  {
    name: 'Pro',
    price: '$9',
    label: 'The Organized Reader',
    features: ['Unlimited Sources', '50 Synthesis Credits'],
  },
  {
    name: 'Elite',
    price: '$25',
    label: 'The Executive Intelligence',
    features: ['Weekly Auto-Brief', 'Semantic Search', 'Priority Neural Voice', '300 Credits'],
    highlight: true,
    badge: 'Most Popular for Founders',
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
          className={`relative rounded-2xl border p-6 shadow-xl shadow-slate-200/40 ${
            tier.highlight
              ? 'border-blue-300 bg-blue-50/70 shadow-[0_20px_50px_rgba(37,99,235,0.22)]'
              : 'border-stone-200 bg-white'
          }`}
        >
          {tier.badge ? (
            <span className="absolute -top-3 right-4 rounded-full border border-blue-300 bg-white px-3 py-1 text-xs text-[#2563eb]">
              {tier.badge}
            </span>
          ) : null}
          <h3 className="font-serif text-2xl text-slate-900">{tier.name}</h3>
          <p className="mt-2 text-3xl font-bold text-slate-900">{tier.price}<span className="text-base text-slate-500">/mo</span></p>
          <p className="mt-1 text-sm text-slate-600">{tier.label}</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {tier.features.map((feature) => (
              <li key={feature}>• {feature}</li>
            ))}
          </ul>
        </article>
      ))}
    </motion.div>
  );
}

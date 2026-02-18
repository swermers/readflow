'use client';

import { motion } from 'framer-motion';
import { Sparkles, BookOpenText } from 'lucide-react';

export default function BriefSignalSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5 }}
      className="grid gap-4 md:grid-cols-2"
    >
      <article className="rounded-2xl border border-line bg-surface-raised p-5 shadow-sm">
        <p className="text-label uppercase text-ink-faint">Weekly Brief</p>
        <h3 className="mt-1 text-heading text-ink">Your Monday Briefing</h3>
        <ul className="mt-4 space-y-2 text-sm text-ink-muted">
          <li>• Start Here: 5 high-signal reads</li>
          <li>• TLDRs generated for top issues</li>
          <li>• Listen queue prepared for commute</li>
        </ul>
      </article>

      <article className="rounded-2xl border border-line bg-surface-raised p-5 shadow-sm">
        <span className="rounded-full bg-accent/10 px-2 py-1 text-xs text-accent">High Signal</span>
        <h3 className="mt-3 text-heading text-ink">The AI Agent Economy Is Becoming Infrastructure</h3>
        <p className="mt-2 text-sm text-ink-muted">
          Why the next wave of products won&apos;t be single apps, but orchestrated agent workflows with durable memory.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 text-xs text-ink-faint"><BookOpenText className="h-4 w-4" /> Saved from the Rack</p>
      </article>

      <article className="md:col-span-2 rounded-2xl border border-line bg-surface-raised p-5 shadow-sm">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-ink"><Sparkles className="h-4 w-4 text-accent" /> Sources control</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { source: 'Lenny’s Newsletter', active: true },
            { source: 'Stratechery', active: false },
            { source: 'Every', active: true },
          ].map((source) => (
            <div key={source.source} className="rounded-xl border border-line bg-surface p-3">
              <p className="text-sm text-ink">{source.source}</p>
              <p className={`mt-2 text-xs ${source.active ? 'text-accent' : 'text-ink-faint'}`}>
                {source.active ? 'Active' : 'Paused'}
              </p>
            </div>
          ))}
        </div>
      </article>
    </motion.section>
  );
}

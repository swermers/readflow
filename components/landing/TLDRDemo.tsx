'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function TLDRDemo() {
  const [showTLDR, setShowTLDR] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowTLDR(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-line bg-surface-raised p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between gap-4 border-b border-line pb-3">
        <p className="text-sm text-ink-muted">Full Article</p>
        <button
          type="button"
          onClick={() => setShowTLDR((prev) => !prev)}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            showTLDR ? 'bg-accent text-white' : 'bg-surface text-ink-muted border border-line'
          }`}
        >
          Show TLDR
          <span
            className={`h-3 w-6 rounded-full ${showTLDR ? 'bg-white/30' : 'bg-line'}`}
          />
        </button>
      </div>

      <motion.div animate={{ opacity: showTLDR ? 0.2 : 1, height: showTLDR ? 72 : 192 }} className="overflow-hidden">
        <div className="space-y-2 text-sm leading-6 text-ink-muted">
          {Array.from({ length: 7 }).map((_, i) => (
            <p key={i}>
              Market dynamics this quarter continue to show uneven confidence, tighter distribution channels, and rapid AI deployment in core teams.
            </p>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={false}
        animate={{ opacity: showTLDR ? 1 : 0, height: showTLDR ? 'auto' : 0 }}
        className="overflow-hidden"
      >
        <div className="mt-3 rounded-xl border border-line bg-surface p-4 text-sm text-ink-muted">
          <p className="mb-2 font-semibold text-ink">TLDR</p>
          <ul className="space-y-1">
            <li>• Revenue growth is steady, but slower heading into Q3.</li>
            <li>• Teams adopting AI agents are outperforming on output per headcount.</li>
            <li>• Strategic focus is shifting from channels to durable owned distribution.</li>
          </ul>
        </div>
      </motion.div>
    </motion.section>
  );
}

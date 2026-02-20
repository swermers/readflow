'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const articleParagraphs = [
  'Global software teams are shifting from single-task AI copilots to orchestrated agents that can plan, execute, and hand off work across systems.',
  'Early adopters report faster decision cycles, but only when agent outputs are paired with strong editorial checkpoints and clear source provenance.',
  'The next advantage won\'t come from generating more content. It will come from filtering for signal and operationalizing the best ideas quickly.',
];

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
        <div>
          <p className="text-sm font-medium text-ink">Full Article</p>
          <p className="text-xs text-ink-faint">The Information Signal • 8 min read</p>
        </div>
        <button
          type="button"
          onClick={() => setShowTLDR((prev) => !prev)}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            showTLDR ? 'bg-accent text-white' : 'border border-line bg-surface text-ink-muted'
          }`}
        >
          Show TL;DR
          <span className={`h-3 w-6 rounded-full ${showTLDR ? 'bg-white/30' : 'bg-line'}`} />
        </button>
      </div>

      <motion.article
        animate={{ opacity: showTLDR ? 0.18 : 1, height: showTLDR ? 132 : 250 }}
        className="overflow-hidden rounded-xl border border-line bg-surface p-4"
      >
        <h3 className="text-heading text-ink">AI Agents Are Becoming the New Operating Layer</h3>
        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-ink-faint">By Mira Patel • Strategy Memo</p>

        <div className="mt-4 space-y-3 text-sm leading-6 text-ink-muted">
          {articleParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </motion.article>

      <motion.div
        initial={false}
        animate={{ opacity: showTLDR ? 1 : 0, height: showTLDR ? 'auto' : 0 }}
        className="overflow-hidden"
      >
        <div className="mt-3 rounded-xl border border-line bg-surface p-4 text-sm text-ink-muted">
          <p className="mb-2 font-semibold text-ink">TL;DR</p>
          <ul className="space-y-1">
            <li>• Agents are moving from assistants to workflow infrastructure inside teams.</li>
            <li>• Trust and adoption increase when teams can verify sources and review checkpoints.</li>
            <li>• Competitive edge comes from faster signal filtering, not from reading more volume.</li>
          </ul>
        </div>
      </motion.div>
    </motion.section>
  );
}

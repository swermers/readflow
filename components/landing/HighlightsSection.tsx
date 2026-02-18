'use client';

import { motion } from 'framer-motion';
import { Highlighter, NotebookPen, ArrowRight } from 'lucide-react';

export default function HighlightsSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-line bg-surface-raised p-6 shadow-sm"
    >
      <h3 className="text-display text-ink">Highlight. Capture. Compound.</h3>
      <p className="mt-2 text-ink-muted">
        Save the lines that matter, attach notes, and build a durable knowledge base from every issue you read.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-ink"><Highlighter className="h-4 w-4 text-accent" /> In-app highlighting</p>
          <p className="mt-2 text-sm text-ink-muted">Select any passage, highlight it, and revisit it in your Notes workspace.</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-ink"><NotebookPen className="h-4 w-4 text-accent" /> Coming soon: Share to second brain</p>
          <p className="mt-2 text-sm text-ink-muted">Push curated highlights to your favorite note app and knowledge system.</p>
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink-faint">Notion · Obsidian · Reflect <ArrowRight className="h-3 w-3" /></p>
        </div>
      </div>
    </motion.section>
  );
}

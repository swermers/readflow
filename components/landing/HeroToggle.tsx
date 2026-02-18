'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, Bookmark, Archive, Trash2, Clock3 } from 'lucide-react';

const inboxRows = [
  { id: 'inbox-1', subject: 'LAST CHANCE SALE: 70% OFF', from: 'Flash Retail', badge: '99+' },
  { id: 'inbox-2', subject: 'Re: Re: Invoice follow-up', from: 'Ops Team', badge: '12' },
  { id: 'inbox-3', subject: '⚠ Action required by tonight', from: 'Vendor Digest', badge: '8' },
  { id: 'inbox-4', subject: 'Weekly roundup + promo drop', from: 'Marketing Blast', badge: '31' },
  { id: 'inbox-5', subject: 'Fwd: Fwd: Market notes', from: 'Unknown Sender', badge: '27' },
];

const weeklyRackIssues = [
  {
    sender: 'JOE HUDSON',
    title: 'The Trap of Self-Reliance',
    excerpt:
      'Art of Accomplishment — Self-reliance began the first time you learned to carry everything alone. But the highest leverage now is knowing what to keep and what to release.',
    date: '2/18/2026',
    label: 'NEWS',
  },
  {
    sender: 'PIRATE WIRES',
    title: 'Mike Solana // Wealth Tax Counterstrike',
    excerpt:
      'A union thug and his cabal of academics have awakened a sleeping giant. Here is your first look at the billionaire response and the second-order effects for founders.',
    date: '2/18/2026',
    label: 'NEWS',
  },
  {
    sender: 'STRATECHERY',
    title: 'AI Distribution and Durable Defensibility',
    excerpt:
      'The winning move is not shipping another model wrapper. It is owning trust, workflow habit, and memory across the stack where value compounds.',
    date: '2/17/2026',
    label: 'ANALYSIS',
  },
];

export default function HeroToggle() {
  const [isInbox, setIsInbox] = useState(true);

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="rounded-3xl border border-line bg-surface-raised p-4 shadow-sm md:p-6"
    >
      <div className="mx-auto mb-5 flex w-full max-w-sm rounded-xl border border-line bg-surface p-1">
        <button
          onClick={() => setIsInbox(true)}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
            isInbox ? 'bg-accent text-white' : 'text-ink-muted hover:text-ink'
          }`}
        >
          The Inbox
        </button>
        <button
          onClick={() => setIsInbox(false)}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
            !isInbox ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink'
          }`}
        >
          The Rack
        </button>
      </div>

      <AnimatePresence mode="wait">
        {isInbox ? (
          <motion.div
            key="inbox"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-2 rounded-2xl border border-line bg-surface p-3"
          >
            {inboxRows.map((row, index) => (
              <motion.div
                key={row.id}
                layoutId={`morph-row-${index}`}
                className="flex items-center justify-between rounded-xl border border-line bg-surface-raised px-3 py-2"
                animate={{ x: [0, index % 2 ? 1 : -1, 0] }}
                transition={{ repeat: Infinity, duration: 0.7 + index * 0.1, ease: 'easeInOut' }}
              >
                <div className="text-left">
                  <p className="text-sm text-ink">{row.subject}</p>
                  <p className="text-xs text-ink-muted">{row.from}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-xs text-accent">
                  <BellRing className="h-3 w-3" /> {row.badge}
                </span>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="rack"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            <div className="flex items-end justify-between border-b border-line pb-3">
              <div>
                <p className="text-heading text-ink">The Rack.</p>
                <p className="text-sm text-ink-muted">{weeklyRackIssues.length} issues from the last 7 days.</p>
              </div>
              <p className="text-label uppercase text-ink-faint">Weekly view</p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {weeklyRackIssues.map((issue, idx) => (
                <motion.article
                  key={`${issue.sender}-${issue.title}`}
                  layoutId={`morph-row-${idx + 1}`}
                  className="flex min-h-[255px] flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold tracking-[0.08em] text-accent">{issue.sender}</p>
                      <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-ink-faint">{issue.label}</span>
                    </div>
                    <p className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
                      <Clock3 className="h-3 w-3" /> {issue.date}
                    </p>
                  </div>

                  <h3 className="text-lg font-semibold leading-tight text-ink">{issue.title}</h3>
                  <p className="mt-3 line-clamp-3 text-sm text-ink-muted">{issue.excerpt}</p>

                  <div className="mt-auto border-t border-line pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <button className="text-sm font-medium text-accent hover:underline">OPEN ↗</button>
                      <div className="flex items-center gap-2">
                        <button className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink">
                          <Bookmark className="h-3.5 w-3.5" /> SAVE
                        </button>
                        <button className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink">
                          <Archive className="h-3.5 w-3.5" /> ARCHIVE
                        </button>
                        <button className="rounded-lg border border-line p-1.5 text-ink-faint hover:text-ink" aria-label="Delete issue">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

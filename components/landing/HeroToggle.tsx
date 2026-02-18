'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, BookOpenText } from 'lucide-react';

const inboxRows = [
  { id: 'inbox-1', subject: 'LAST CHANCE SALE: 70% OFF', from: 'Flash Retail', badge: '99+' },
  { id: 'inbox-2', subject: 'Re: Re: Invoice follow-up', from: 'Ops Team', badge: '12' },
  { id: 'inbox-3', subject: '⚠ Action required by tonight', from: 'Vendor Digest', badge: '8' },
  { id: 'inbox-4', subject: 'Weekly roundup + promo drop', from: 'Marketing Blast', badge: '31' },
  { id: 'inbox-5', subject: 'Fwd: Fwd: Market notes', from: 'Unknown Sender', badge: '27' },
];

export default function HeroToggle() {
  const [isInbox, setIsInbox] = useState(true);

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="rounded-3xl border border-stone-200 bg-white p-4 shadow-xl shadow-slate-200/60 md:p-6"
    >
      <div className="mx-auto mb-5 flex w-full max-w-sm rounded-full border border-stone-200 bg-stone-50 p-1">
        <button
          onClick={() => setIsInbox(true)}
          className={`flex-1 rounded-full px-4 py-2 text-sm transition ${
            isInbox ? 'bg-[#d97706] text-white' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          The Inbox
        </button>
        <button
          onClick={() => setIsInbox(false)}
          className={`flex-1 rounded-full px-4 py-2 text-sm transition ${
            !isInbox ? 'bg-[#2563eb] text-white' : 'text-slate-500 hover:text-slate-900'
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
            className="space-y-2 rounded-2xl border border-stone-200 bg-stone-50 p-3"
          >
            {inboxRows.map((row, index) => (
              <motion.div
                key={row.id}
                layoutId={`morph-row-${index}`}
                className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-3 py-2"
                animate={{ x: [0, index % 2 ? 1 : -1, 0] }}
                transition={{ repeat: Infinity, duration: 0.7 + index * 0.1, ease: 'easeInOut' }}
              >
                <div className="text-left">
                  <p className="text-sm text-slate-700">{row.subject}</p>
                  <p className="text-xs text-slate-500">{row.from}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
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
            className="grid gap-3 md:grid-cols-2"
          >
            <motion.article
              layoutId="morph-row-1"
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-lg shadow-slate-200/60"
            >
              <p className="font-serif text-2xl text-slate-900">Your Monday Briefing</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">Weekly Brief Workspace</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>• Start Here: 5 high-signal reads curated</li>
                <li>• TLDR pre-generated for top issues</li>
                <li>• Listen queue ready for commute</li>
              </ul>
            </motion.article>

            <motion.article
              layoutId="morph-row-3"
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-lg shadow-slate-200/60"
            >
              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">High Signal</span>
              <h3 className="mt-3 text-lg text-slate-900">The AI Agent Economy Is Becoming Infrastructure</h3>
              <p className="mt-2 line-clamp-3 text-sm text-slate-500">
                Why the next wave of products won&apos;t be single apps, but orchestrated agent workflows with durable memory.
              </p>
              <p className="mt-4 inline-flex items-center gap-2 text-xs text-slate-500"><BookOpenText className="h-4 w-4" /> Saved to Rack</p>
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

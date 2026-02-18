'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, Sparkles, Waves } from 'lucide-react';

const inboxRows = [
  { id: 'inbox-1', subject: 'LAST CHANCE SALE', from: 'Flash Retail', badge: '99+' },
  { id: 'inbox-2', subject: 'Re: Re: Invoice Thread', from: 'Ops Team', badge: '12' },
  { id: 'inbox-3', subject: 'URGENT: Action Required', from: 'Vendor Digest', badge: '8' },
  { id: 'inbox-4', subject: 'Fwd: Fwd: Market Notes', from: 'Unknown Sender', badge: '27' },
  { id: 'inbox-5', subject: 'Morning Promo Drop', from: 'Marketing Blast', badge: '31' },
];

const containerVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export default function HeroToggle() {
  const [isInbox, setIsInbox] = useState(true);

  return (
    <motion.section
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl md:p-8"
    >
      <div className="mx-auto mb-6 flex w-full max-w-sm rounded-full border border-white/20 bg-black/20 p-1">
        <button
          onClick={() => setIsInbox(true)}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
            isInbox ? 'bg-red-500/80 text-white' : 'text-white/70 hover:text-white'
          }`}
        >
          The Inbox
        </button>
        <button
          onClick={() => setIsInbox(false)}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
            !isInbox ? 'bg-blue-500/80 text-white' : 'text-white/70 hover:text-white'
          }`}
        >
          The Library
        </button>
      </div>

      <motion.div
        animate={{
          background: isInbox
            ? 'radial-gradient(circle at top, rgba(40,40,40,0.8), rgba(15,15,16,0.95))'
            : 'radial-gradient(circle at top, rgba(59,130,246,0.28), rgba(30,27,75,0.95))',
        }}
        className="relative overflow-hidden rounded-2xl border border-white/10 p-4 md:p-6"
      >
        <AnimatePresence mode="wait">
          {isInbox ? (
            <motion.div
              key="inbox"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.35 }}
              className="space-y-3"
            >
              {inboxRows.map((row, index) => (
                <motion.div
                  key={row.id}
                  layoutId={`morph-row-${index}`}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-4 py-3"
                  animate={{ x: [0, index % 2 === 0 ? -2 : 2, 0] }}
                  transition={{ repeat: Infinity, duration: 0.55 + index * 0.12, ease: 'easeInOut' }}
                >
                  <div>
                    <p className="text-sm font-semibold tracking-wide text-white/90">{row.subject}</p>
                    <p className="text-xs text-white/50">{row.from}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-300">
                    <BellRing className="h-3 w-3" /> {row.badge}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="library"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.35 }}
              className="grid gap-4 md:grid-cols-2"
            >
              <motion.article
                layoutId="morph-row-1"
                className="rounded-2xl border border-blue-300/20 bg-indigo-950/60 p-5"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Weekly Brief</h3>
                  <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs text-blue-200">Synthesized</span>
                </div>
                <ul className="space-y-2 text-sm text-blue-100/90">
                  <li className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4" /> Macro sentiment stabilizing after Q2 volatility.</li>
                  <li className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4" /> AI agents shifting from tools to workflows.</li>
                  <li className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4" /> One decisive brief replaces 20 noisy threads.</li>
                </ul>
              </motion.article>

              <motion.article
                layoutId="morph-row-3"
                className="rounded-2xl border border-blue-300/20 bg-indigo-900/60 p-5"
              >
                <h3 className="mb-4 text-lg font-semibold text-white">Audio Player</h3>
                <div className="mb-4 flex gap-1.5">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <motion.span
                      key={i}
                      className="block w-1 rounded-full bg-blue-300"
                      animate={{ height: [8, 24 + (i % 5) * 6, 10] }}
                      transition={{ repeat: Infinity, duration: 1 + i * 0.05, ease: 'easeInOut' }}
                    />
                  ))}
                </div>
                <p className="flex items-center gap-2 text-sm text-blue-100/90"><Waves className="h-4 w-4" /> 11m executive narration ready.</p>
              </motion.article>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.section>
  );
}

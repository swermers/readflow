'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Play, Radio } from 'lucide-react';

export default function AudioWidget() {
  const [status, setStatus] = useState<'idle' | 'processing' | 'ready' | 'playing'>('idle');

  const startLifecycle = () => {
    if (status === 'idle') {
      setStatus('processing');
      setTimeout(() => setStatus('ready'), 1000);
      return;
    }

    if (status === 'ready') {
      setStatus('playing');
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.45 }}
      className="rounded-2xl border border-line bg-surface-raised p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={startLifecycle}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
            status === 'idle'
              ? 'bg-ink text-surface'
              : status === 'processing'
                ? 'bg-surface text-ink-muted border border-line'
                : 'bg-accent text-white'
          }`}
        >
          {status === 'idle' && <><Radio className="h-4 w-4" /> Listen</>}
          {status === 'processing' && <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>}
          {status === 'ready' && <><Play className="h-4 w-4" /> Play Narration</>}
          {status === 'playing' && <><Play className="h-4 w-4" /> Playing</>}
        </button>
        <p className="text-label uppercase text-ink-faint">Durable listen queue</p>
      </div>

      <motion.div animate={{ height: status === 'playing' ? 56 : 0, opacity: status === 'playing' ? 1 : 0 }} className="overflow-hidden">
        <div className="mt-3 rounded-xl border border-line bg-surface p-3">
          <div className="flex items-end gap-1">
            {Array.from({ length: 12 }).map((_, index) => (
              <span key={index} className="voice-bar block w-1.5 rounded-full bg-accent" style={{ animationDelay: `${index * 0.08}s` }} />
            ))}
          </div>
        </div>
      </motion.div>
    </motion.section>
  );
}

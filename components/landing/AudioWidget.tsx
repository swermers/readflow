'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Headphones } from 'lucide-react';

const states = ['Queued', 'Processing', 'Ready', 'Playing'] as const;

export default function AudioWidget() {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<(typeof states)[number]>('Queued');

  useEffect(() => {
    if (!expanded) {
      setStatus('Queued');
      return;
    }

    const timeouts = [
      setTimeout(() => setStatus('Processing'), 700),
      setTimeout(() => setStatus('Ready'), 1500),
      setTimeout(() => setStatus('Playing'), 2200),
    ];

    return () => timeouts.forEach(clearTimeout);
  }, [expanded]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      animate={{ width: expanded ? '100%' : 220 }}
      className="overflow-hidden rounded-full border border-white/15 bg-white/10 p-2 backdrop-blur-xl md:max-w-xl"
    >
      <div className="flex items-center gap-3 px-2">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-4 py-2 text-sm font-medium text-white"
        >
          <Headphones className="h-4 w-4" /> {expanded ? 'Pause Brief' : 'Play Brief'}
        </button>
        <span className="text-xs uppercase tracking-[0.16em] text-blue-100/80">{status}</span>
      </div>

      <motion.div
        animate={{ height: expanded ? 66 : 0, opacity: expanded ? 1 : 0 }}
        className="px-4"
      >
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="mb-2 h-1.5 rounded-full bg-white/10">
            <motion.div
              animate={{ width: status === 'Playing' ? ['0%', '100%'] : '20%' }}
              transition={{ duration: 6, repeat: status === 'Playing' ? Infinity : 0, ease: 'linear' }}
              className="h-full rounded-full bg-blue-400"
            />
          </div>
          <div className="flex items-end gap-1">
            {Array.from({ length: 6 }).map((_, index) => (
              <span
                key={index}
                className="voice-bar block w-1.5 rounded-full bg-blue-300"
                style={{ animationDelay: `${index * 0.12}s` }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

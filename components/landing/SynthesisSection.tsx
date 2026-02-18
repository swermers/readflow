'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const denseText = Array.from({ length: 18 })
  .map(
    (_, i) =>
      `Paragraph ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer volutpat, arcu non commodo pharetra, nisl sem iaculis eros, sed tempus nibh nisi in mauris.`
  )
  .join(' ');

export default function SynthesisSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });

  const scannerTop = useTransform(scrollYProgress, [0, 1], ['8%', '92%']);
  const archivedOpacity = useTransform(scrollYProgress, [0, 0.45, 0.85], [1, 0.65, 0.2]);

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6 }}
      className="grid gap-6 lg:grid-cols-2"
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-5">
        <motion.div
          style={{ top: scannerTop }}
          className="pointer-events-none absolute left-0 right-0 h-px bg-blue-400 shadow-[0_0_25px_6px_rgba(59,130,246,0.6)]"
        />
        <motion.p style={{ opacity: archivedOpacity }} className="text-sm leading-7 text-white/80">
          {denseText}
        </motion.p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg">
        <h3 className="mb-4 flex items-center gap-2 text-xl font-semibold text-white">
          <Sparkles className="h-5 w-5 text-blue-300" /> Key Insights
        </h3>
        <div className="space-y-3">
          {[
            'Insight 1: Market correction likely in Q3.',
            'Insight 2: AI Agents are the new operating system.',
          ].map((insight, index) => (
            <motion.div
              key={insight}
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.18 }}
              className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/90"
            >
              {insight}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

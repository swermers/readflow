'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

export default function ROICalculator() {
  const [hoursReading, setHoursReading] = useState(4);
  const [hourlyRate, setHourlyRate] = useState(150);

  const saved = useMemo(() => (hoursReading * 52) * 0.5 * hourlyRate, [hoursReading, hourlyRate]);
  const monthlySaved = Math.round(saved / 12);
  const weeklySaved = Math.round(saved / 52);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55 }}
      className="rounded-2xl border border-line bg-surface-raised p-6 shadow-sm"
    >
      <h3 className="mb-2 text-display text-ink">ROI Calculator</h3>
      <p className="mb-5 text-sm text-ink-muted">Assumes Readflow recovers 50% of your newsletter reading time.</p>

      <div className="grid gap-6 md:grid-cols-2">
        <label className="text-sm text-ink-muted">
          Hours reading per week: <span className="font-semibold text-ink">{hoursReading}</span>
          <input
            type="range"
            min={1}
            max={10}
            value={hoursReading}
            onChange={(event) => setHoursReading(Number(event.target.value))}
            className="mt-3 w-full accent-[var(--color-accent)]"
          />
        </label>

        <label className="text-sm text-ink-muted">
          Hourly rate ($/hr)
          <input
            type="number"
            min={1}
            value={hourlyRate}
            onChange={(event) => setHourlyRate(Number(event.target.value) || 0)}
            className="mt-3 w-full rounded-xl border border-line bg-surface px-3 py-2 text-ink outline-none focus:border-line-strong"
          />
        </label>
      </div>

      <p className="mt-6 text-2xl font-semibold leading-tight text-ink md:text-3xl">
        Readflow saves you <span className="text-accent">${saved.toLocaleString()}</span> per year in billable time.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-label uppercase text-ink-faint">Monthly</p>
          <p className="mt-1 text-xl font-semibold text-ink">${monthlySaved.toLocaleString()} / mo</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-label uppercase text-ink-faint">Weekly</p>
          <p className="mt-1 text-xl font-semibold text-ink">${weeklySaved.toLocaleString()} / wk</p>
        </div>
      </div>
    </motion.section>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

export default function ROICalculator() {
  const [hoursReading, setHoursReading] = useState(4);
  const [hourlyRate, setHourlyRate] = useState(150);

  const saved = useMemo(() => (hoursReading * 52) * 0.5 * hourlyRate, [hoursReading, hourlyRate]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55 }}
      className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg"
    >
      <h3 className="mb-4 text-2xl font-semibold text-white">ROI Calculator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <label className="text-sm text-white/80">
          Hours reading per week: <span className="font-semibold text-white">{hoursReading}</span>
          <input
            type="range"
            min={1}
            max={10}
            value={hoursReading}
            onChange={(event) => setHoursReading(Number(event.target.value))}
            className="mt-3 w-full accent-blue-400"
          />
        </label>

        <label className="text-sm text-white/80">
          Hourly rate ($/hr)
          <input
            type="number"
            min={1}
            value={hourlyRate}
            onChange={(event) => setHourlyRate(Number(event.target.value) || 0)}
            className="mt-3 w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-white outline-none focus:border-blue-300"
          />
        </label>
      </div>

      <p className="mt-6 text-2xl font-semibold leading-tight text-white md:text-3xl">
        Readflow saves you <span className="text-blue-300">${saved.toLocaleString()}</span> per year in billable time.
      </p>
    </motion.section>
  );
}

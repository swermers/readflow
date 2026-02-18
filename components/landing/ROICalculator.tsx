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
      className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xl shadow-slate-200/50"
    >
      <h3 className="mb-4 font-serif text-3xl text-slate-900">ROI Calculator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <label className="text-sm text-slate-600">
          Hours reading per week: <span className="font-semibold text-slate-900">{hoursReading}</span>
          <input
            type="range"
            min={1}
            max={10}
            value={hoursReading}
            onChange={(event) => setHoursReading(Number(event.target.value))}
            className="mt-3 w-full accent-[#2563eb]"
          />
        </label>

        <label className="text-sm text-slate-600">
          Hourly rate ($/hr)
          <input
            type="number"
            min={1}
            value={hourlyRate}
            onChange={(event) => setHourlyRate(Number(event.target.value) || 0)}
            className="mt-3 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-[#2563eb]"
          />
        </label>
      </div>

      <p className="mt-6 text-2xl font-semibold leading-tight text-slate-900 md:text-3xl">
        Readflow saves you <span className="text-[#2563eb]">${saved.toLocaleString()}</span> per year in billable time.
      </p>
    </motion.section>
  );
}

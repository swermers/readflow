'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  label: string;
  title: string;
  subtitle?: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleSection({
  label,
  title,
  subtitle,
  defaultCollapsed = true,
  children,
}: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section className="mb-8 rounded-2xl border border-line bg-surface-raised p-4 md:p-5">
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.1em] text-accent">{label}</p>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          {subtitle && <p className="text-xs text-ink-faint">{subtitle}</p>}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-ink-faint transition-transform duration-200 ${
            collapsed ? '' : 'rotate-180'
          }`}
        />
      </button>
      {!collapsed && <div className="mt-4">{children}</div>}
    </section>
  );
}

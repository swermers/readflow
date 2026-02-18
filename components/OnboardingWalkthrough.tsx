'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Mail, Settings, Tags } from 'lucide-react';
import { triggerToast } from './Toast';

interface OnboardingWalkthroughProps {
  open: boolean;
}

const steps = [
  {
    icon: Mail,
    title: 'Connect Gmail in Settings',
    description: 'Open Settings and connect your Gmail account so Readflow can securely import newsletters.',
    action: (
      <Link href="/settings" className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-accent hover:underline">
        Open Settings <Settings className="h-3.5 w-3.5" />
      </Link>
    ),
  },
  {
    icon: Tags,
    title: 'Create a Gmail label',
    description: 'Create a label (for example, “Readflow”) and use it for newsletters you want inside your library.',
    action: (
      <a
        href="https://mail.google.com/mail/u/0/#settings/labels"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-accent hover:underline"
      >
        Open Gmail Labels <ExternalLink className="h-3.5 w-3.5" />
      </a>
    ),
  },
  {
    icon: CheckCircle2,
    title: 'Pick labels to sync, then sync',
    description: 'Back in Settings, select the labels you want Readflow to sync. Then return to the Rack and press Sync.',
    action: (
      <Link href="/settings" className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-accent hover:underline">
        Choose sync labels <Settings className="h-3.5 w-3.5" />
      </Link>
    ),
  },
];

export default function OnboardingWalkthrough({ open }: OnboardingWalkthroughProps) {
  const [isOpen, setIsOpen] = useState(open);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const completeWalkthrough = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const res = await fetch('/api/profile/onboarding', { method: 'PATCH' });
      if (!res.ok) {
        triggerToast('Could not save walkthrough status.');
        return;
      }

      setIsOpen(false);
      triggerToast('Walkthrough complete. You can reopen setup help anytime in Settings.');
    } catch {
      triggerToast('Could not save walkthrough status.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-6 md:p-8 shadow-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.1em] text-accent">Welcome to Readflow</p>
            <h2 className="mt-1 text-2xl font-bold text-ink">Quick setup walkthrough</h2>
            <p className="mt-2 text-sm text-ink-muted">Follow these steps once to start importing newsletters with labels.</p>
          </div>
        </div>

        <div className="space-y-4">
          {steps.map((step, idx) => (
            <article key={step.title} className="rounded-xl border border-line bg-surface-raised p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white text-xs font-bold">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-ink">{step.title}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{step.description}</p>
                  <div className="mt-2">{step.action}</div>
                </div>
                <step.icon className="h-4 w-4 text-ink-faint" />
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg border border-line px-4 py-2 text-xs uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          >
            Close for now
          </button>
          <button
            onClick={completeWalkthrough}
            disabled={isSaving}
            className="rounded-lg bg-ink px-4 py-2 text-xs uppercase tracking-[0.08em] text-surface hover:bg-accent disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
}

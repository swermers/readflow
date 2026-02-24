'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Mail,
  RefreshCw,
  Settings,
  Tag,
  Tags,
} from 'lucide-react';

interface OnboardingWalkthroughProps {
  open: boolean;
}

const TOTAL_STEPS = 5;

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < current ? 'w-6 bg-accent' : i === current ? 'w-6 bg-ink' : 'w-1.5 bg-line'
          }`}
        />
      ))}
    </div>
  );
}

export default function OnboardingWalkthrough({ open }: OnboardingWalkthroughProps) {
  const [isOpen, setIsOpen] = useState(open);
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-6 md:p-8 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.1em] text-accent">Welcome to Readflow</p>
            <h2 className="mt-1 text-2xl font-bold text-ink">Get started in 5 steps</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Set up Gmail filtering once, then Readflow handles the rest automatically.
            </p>
          </div>
          <StepIndicator current={step} total={TOTAL_STEPS} />
        </div>

        {/* Step content */}
        <div className="min-h-[280px]">
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white text-sm font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink">Connect your Gmail account</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    Readflow needs read-only access to your Gmail so it can import newsletters you&apos;ve labeled.
                    We never modify or delete your emails.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-raised p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-accent" />
                  <p className="text-sm font-medium text-ink">How it works</p>
                </div>
                <ul className="space-y-2 text-sm text-ink-muted pl-6">
                  <li className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    You sign in with Google and grant read-only Gmail access
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    Readflow imports newsletters from the labels you choose
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    Auto-sync keeps your library current every 15 minutes
                  </li>
                </ul>
              </div>

              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-xs uppercase tracking-[0.08em] text-surface hover:bg-accent transition-colors"
              >
                <Settings className="h-3.5 w-3.5" />
                Open Settings to connect Gmail
              </Link>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white text-sm font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink">Create a Gmail label for newsletters</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    Create a label called <strong>&ldquo;Readflow&rdquo;</strong> (or any name you prefer) in Gmail.
                    This label is where your newsletters will be routed.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-raised p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Tags className="h-4 w-4 text-accent" />
                  <p className="text-sm font-medium text-ink">Quick steps in Gmail</p>
                </div>
                <ol className="space-y-2 text-sm text-ink-muted pl-6 list-decimal">
                  <li>Go to <strong>Gmail &rarr; Settings &rarr; Labels</strong></li>
                  <li>Scroll down and click <strong>&ldquo;Create new label&rdquo;</strong></li>
                  <li>Name it <code className="bg-surface-overlay px-1.5 py-0.5 text-xs rounded">Readflow</code></li>
                  <li>Click <strong>Create</strong></li>
                </ol>
              </div>

              <a
                href="https://mail.google.com/mail/u/0/#settings/labels"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-xs uppercase tracking-[0.08em] text-surface hover:bg-accent transition-colors"
              >
                Open Gmail Labels <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white text-sm font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink">Create filters for your newsletters</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    Build Gmail filters to automatically label and archive incoming newsletters. This keeps them out of your inbox and into Readflow.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-raised p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-accent" />
                  <p className="text-sm font-medium text-ink">Example: filter Substack newsletters</p>
                </div>
                <ol className="space-y-2 text-sm text-ink-muted pl-6 list-decimal">
                  <li>In Gmail, click the search bar, then the filter icon (or go to Settings &rarr; Filters)</li>
                  <li>In the <strong>&ldquo;From&rdquo;</strong> field, enter the sender: <code className="bg-surface-overlay px-1.5 py-0.5 text-xs rounded">@substack.com</code></li>
                  <li>Click <strong>&ldquo;Create filter&rdquo;</strong></li>
                  <li>Check these boxes:
                    <ul className="mt-1.5 space-y-1.5 text-ink-faint">
                      <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Skip the Inbox (Archive it)</li>
                      <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Apply the label: <strong className="text-ink">Readflow</strong></li>
                      <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-ink-faint" /> Mark as read (optional)</li>
                      <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-ink-faint" /> Also apply to matching conversations (optional, for backfill)</li>
                    </ul>
                  </li>
                  <li>Click <strong>&ldquo;Create filter&rdquo;</strong></li>
                </ol>
              </div>

              <div className="flex gap-2">
                <a
                  href="https://mail.google.com/mail/u/0/#settings/filters"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-xs uppercase tracking-[0.08em] text-surface hover:bg-accent transition-colors"
                >
                  Open Gmail Filters <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white text-sm font-bold flex-shrink-0">
                  4
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink">Repeat for each newsletter</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    Create one filter per sender or domain. Start with your top 3–5 newsletters, then add more over time.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-raised p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-accent" />
                  <p className="text-sm font-medium text-ink">Common newsletter domains to filter</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    '@substack.com',
                    '@beehiiv.com',
                    '@ghost.io',
                    '@convertkit.com',
                    '@mailchimp.com',
                    '@email.mg.*',
                  ].map((domain) => (
                    <div key={domain} className="rounded-lg border border-line bg-surface px-3 py-2">
                      <code className="text-xs text-ink">{domain}</code>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-ink-faint">
                  Pro tip: You can also filter by specific sender email addresses for individual newsletters.
                </p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white text-sm font-bold flex-shrink-0">
                  5
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink">Select labels and sync</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    Back in Readflow Settings, choose which Gmail labels to sync. Once selected, Readflow will automatically import newsletters every 15 minutes — no manual syncing needed.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-raised p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-accent" />
                  <p className="text-sm font-medium text-ink">What happens next</p>
                </div>
                <ul className="space-y-2 text-sm text-ink-muted pl-6">
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-3.5 w-3.5 text-accent mt-0.5 flex-shrink-0" />
                    New newsletters appear on your <strong>Rack</strong> automatically
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-3.5 w-3.5 text-accent mt-0.5 flex-shrink-0" />
                    Your <strong>Briefing</strong> page synthesizes top reads into a weekly brief
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-3.5 w-3.5 text-accent mt-0.5 flex-shrink-0" />
                    Highlight passages, take notes, and generate audio digests on the go
                  </li>
                </ul>
              </div>

              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-xs uppercase tracking-[0.08em] text-surface hover:bg-accent transition-colors"
              >
                <Settings className="h-3.5 w-3.5" />
                Choose labels in Settings
              </Link>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            {step > 0 && (
              <button
                onClick={prev}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-xs uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg border border-line px-4 py-2 text-xs uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
            >
              {step === TOTAL_STEPS - 1 ? 'Close' : 'Skip for now'}
            </button>
            {step < TOTAL_STEPS - 1 ? (
              <button
                onClick={next}
                className="inline-flex items-center gap-1 rounded-lg bg-ink px-4 py-2 text-xs uppercase tracking-[0.08em] text-surface hover:bg-accent"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg bg-accent px-4 py-2 text-xs uppercase tracking-[0.08em] text-white hover:bg-accent/90"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

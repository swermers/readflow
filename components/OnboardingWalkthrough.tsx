'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Forward,
  Inbox,
  Mail,
  Sparkles,
  Settings,
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
  const [forwardingEmail, setForwardingEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/profile/forwarding-email', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setForwardingEmail(data.email || null))
      .catch(() => {});
  }, []);

  if (!isOpen) return null;

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const handleCopy = () => {
    if (!forwardingEmail) return;
    navigator.clipboard.writeText(forwardingEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-6 md:p-8 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.1em] text-accent">Welcome to Readflow</p>
            <h2 className="mt-1 text-2xl font-bold text-ink">Your newsletter sanctuary</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Get set up in under a minute. No Gmail permissions needed.
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
                  <h3 className="text-lg font-semibold text-ink">Your Readflow email</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    You have a unique Readflow email address. Use it to subscribe to newsletters — they&apos;ll arrive directly in your Rack.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-raised p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-accent" />
                  <p className="text-sm font-medium text-ink">Your address</p>
                </div>
                {forwardingEmail ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 border border-line bg-surface px-3 py-2.5 font-mono text-sm text-ink select-all rounded-lg">
                      {forwardingEmail}
                    </div>
                    <button
                      onClick={handleCopy}
                      className="px-3 py-2.5 border border-line hover:border-line-strong transition-colors rounded-lg"
                      title="Copy to clipboard"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-ink-faint" />}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-ink-faint">Loading your email address...</p>
                )}
                <p className="text-xs text-ink-faint">
                  You can also find this anytime in <strong>Settings</strong>.
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white text-sm font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink">Subscribe to newsletters</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    Go to your favorite newsletters and sign up using your Readflow email. Start with 2–3 to try it out.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-raised p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-accent" />
                  <p className="text-sm font-medium text-ink">Popular platforms that work great</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'Substack',
                    'Beehiiv',
                    'Ghost',
                    'ConvertKit',
                    'Mailchimp',
                    'Buttondown',
                  ].map((platform) => (
                    <div key={platform} className="rounded-lg border border-line bg-surface px-3 py-2">
                      <span className="text-xs text-ink">{platform}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-ink-faint">
                  Works with any newsletter that sends email — just use your Readflow address when subscribing.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white text-sm font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink">Forward existing newsletters</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    Already getting newsletters in Gmail or another inbox? Set up a filter to automatically forward them to your Readflow address.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-raised p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Forward className="h-4 w-4 text-accent" />
                  <p className="text-sm font-medium text-ink">How to set up forwarding in Gmail</p>
                </div>
                <ol className="space-y-2 text-sm text-ink-muted pl-6 list-decimal list-outside">
                  <li>
                    Open <strong>Gmail Settings &rarr; Forwarding</strong> and add your Readflow email as a forwarding address
                  </li>
                  <li>
                    Confirm the verification email that appears in your <strong>Rack</strong>
                  </li>
                  <li>
                    Go to <strong>Gmail Settings &rarr; Filters</strong> and create a new filter
                  </li>
                  <li>
                    Match newsletters by sender (e.g. <em>from:substack.com</em>) and choose <strong>&ldquo;Forward to&rdquo;</strong> your Readflow address
                  </li>
                </ol>
                <p className="text-xs text-ink-faint">
                  Works with any email provider that supports filters &amp; forwarding — Outlook, Yahoo, Fastmail, etc. You can also manually forward individual emails at any time.
                </p>
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
                  <h3 className="text-lg font-semibold text-ink">Confirm your subscriptions</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    Verification emails will appear in your <strong>Rack</strong>. Open them and click the confirmation link to activate each subscription.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-raised p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  <p className="text-sm font-medium text-ink">How verification works</p>
                </div>
                <ul className="space-y-2 text-sm text-ink-muted pl-6">
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-3.5 w-3.5 text-accent mt-0.5 flex-shrink-0" />
                    Newsletter sends a confirmation email to your Readflow address
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-3.5 w-3.5 text-accent mt-0.5 flex-shrink-0" />
                    It appears in your <strong>Rack</strong> within seconds
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-3.5 w-3.5 text-accent mt-0.5 flex-shrink-0" />
                    Open it and click the confirmation link
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    Future issues arrive automatically
                  </li>
                </ul>
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
                  <h3 className="text-lg font-semibold text-ink">You&apos;re all set</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    Newsletters will arrive in your Rack automatically. Here&apos;s what you can do with them.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-raised p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <p className="text-sm font-medium text-ink">What you can do</p>
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
                    Highlight passages, take notes, and generate audio digests
                  </li>
                </ul>
              </div>

              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-lg border border-line px-5 py-2.5 text-xs uppercase tracking-[0.08em] text-ink-muted hover:text-ink hover:border-line-strong transition-colors"
              >
                <Settings className="h-3.5 w-3.5" />
                Settings (optional: connect Gmail for import)
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
                Start Reading
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

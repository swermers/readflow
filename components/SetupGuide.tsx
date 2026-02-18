'use client';

import { Mail, ArrowRight, ExternalLink, Check, Filter } from 'lucide-react';
import Link from 'next/link';
import SyncButton from '@/components/SyncButton';

interface SetupGuideProps {
  gmailConnected?: boolean;
}

function StepNumber({ step, completed }: { step: number; completed: boolean }) {
  if (completed) {
    return (
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center">
        <Check className="w-4 h-4" />
      </div>
    );
  }
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-ink text-surface flex items-center justify-center text-sm font-bold">
      {step}
    </div>
  );
}

export default function SetupGuide({ gmailConnected = false }: SetupGuideProps) {
  return (
    <div className="col-span-full max-w-3xl mx-auto w-full">
      <div className="border border-dashed border-line p-8 md:p-12">
        <div className="text-center mb-10">
          <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-ink mb-2">Set up Readflow in 5 minutes</h2>
          <p className="text-sm text-ink-muted">
            Route newsletters out of your inbox and into a dedicated Readflow label, then sync only what you want to read.
          </p>
        </div>

        <div className="space-y-8">
          <div className="flex gap-4">
            <StepNumber step={1} completed={false} />
            <div className="flex-1">
              <h3 className="font-bold text-ink mb-1">Create a Gmail label called “Readflow”</h3>
              <p className="text-sm text-ink-muted mb-3">
                In Gmail, create a label that will hold your newsletters so they stay out of your main inbox.
              </p>
              <a
                href="https://mail.google.com/mail/u/0/#settings/labels"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-label uppercase text-accent hover:underline"
              >
                Open Gmail Labels <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="flex gap-4">
            <StepNumber step={2} completed={false} />
            <div className="flex-1">
              <h3 className="font-bold text-ink mb-1">Create a filter for your first newsletter</h3>
              <p className="text-sm text-ink-muted mb-3">
                Build a filter by sender email/domain (example: <code className="bg-surface-overlay px-1 text-xs">@substack.com</code>).
              </p>
              <a
                href="https://mail.google.com/mail/u/0/#settings/filters"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-label uppercase text-accent hover:underline"
              >
                Open Gmail Filters <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="flex gap-4">
            <StepNumber step={3} completed={false} />
            <div className="flex-1">
              <h3 className="font-bold text-ink mb-1">Choose filter actions to reduce inbox clutter</h3>
              <p className="text-sm text-ink-muted mb-3">
                In filter actions, select <strong>Apply label: Readflow</strong> and <strong>Skip Inbox (Archive it)</strong>. Optionally add
                <strong> Mark as read</strong> if you want a cleaner inbox.
              </p>
              <details className="group border border-line">
                <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium text-ink hover:bg-surface-overlay">
                  <span>Exact checkbox options to select</span>
                  <ArrowRight className="w-4 h-4 text-ink-faint group-open:rotate-90 transition-transform" />
                </summary>
                <div className="px-4 pb-4 text-sm text-ink-muted space-y-2">
                  <ul className="list-disc list-inside space-y-1.5">
                    <li>✅ Skip the Inbox (Archive it)</li>
                    <li>✅ Apply the label → Readflow</li>
                    <li>✅ Also apply filter to matching conversations (optional for backfill)</li>
                    <li>✅ Never send it to Spam (optional)</li>
                    <li>✅ Mark as read (optional)</li>
                  </ul>
                </div>
              </details>
            </div>
          </div>

          <div className="flex gap-4">
            <StepNumber step={4} completed={false} />
            <div className="flex-1">
              <h3 className="font-bold text-ink mb-1">Repeat for every newsletter you want in Readflow</h3>
              <p className="text-sm text-ink-muted mb-3">
                Add one filter per sender/publication. This is what keeps non-newsletter email in your inbox and reading content in Readflow.
              </p>
              <p className="inline-flex items-center gap-2 text-xs text-ink-faint uppercase tracking-[0.08em]">
                <Filter className="w-3.5 h-3.5" /> One-time setup, long-term inbox clarity.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <StepNumber step={5} completed={gmailConnected} />
            <div className="flex-1">
              <h3 className={`font-bold mb-1 ${gmailConnected ? 'text-ink-faint line-through' : 'text-ink'}`}>
                Connect Gmail in Readflow and choose labels to sync
              </h3>
              {gmailConnected ? (
                <>
                  <p className="text-sm text-green-600 dark:text-green-400 mb-3">Gmail connected. You are ready to sync.</p>
                  <SyncButton />
                </>
              ) : (
                <>
                  <p className="text-sm text-ink-muted mb-3">
                    In Settings, connect Gmail and select your <strong>Readflow</strong> label in sync preferences.
                  </p>
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-2 text-label uppercase bg-ink text-surface px-6 py-3 hover:bg-accent transition-colors"
                  >
                    <Mail className="w-3 h-3" />
                    Go to Settings
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-line text-center">
          <p className="text-xs text-ink-faint">
            Pro tip: start with your top 3 newsletters, then add filters over time as new subscriptions arrive.
          </p>
        </div>
      </div>
    </div>
  );
}

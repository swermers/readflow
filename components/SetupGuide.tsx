'use client';

import { Mail, ArrowRight, ExternalLink, Check } from 'lucide-react';
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
    <div className="col-span-full max-w-2xl mx-auto w-full">
      <div className="border border-dashed border-line p-8 md:p-12">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-ink mb-2">Welcome to Readflow</h2>
          <p className="text-sm text-ink-muted">Connect Gmail to start syncing your newsletters.</p>
        </div>

        {/* Steps */}
        <div className="space-y-8">
          {/* Step 1 */}
          <div className="flex gap-4">
            <StepNumber step={1} completed={gmailConnected} />
            <div className="flex-1">
              <h3 className={`font-bold mb-1 ${gmailConnected ? 'text-ink-faint line-through' : 'text-ink'}`}>
                Connect your Gmail account
              </h3>
              {gmailConnected ? (
                <p className="text-sm text-green-600 dark:text-green-400">Gmail connected.</p>
              ) : (
                <>
                  <p className="text-sm text-ink-muted mb-3">
                    Grant read-only access to emails you label for Readflow.
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

          {/* Step 2 */}
          <div className="flex gap-4">
            <StepNumber step={2} completed={false} />
            <div className="flex-1">
              <h3 className="font-bold text-ink mb-1">Create a Gmail label</h3>
              <p className="text-sm text-ink-muted mb-3">
                In Gmail, create a label called &quot;Readflow&quot; (or any name you prefer).
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

          {/* Step 3 */}
          <div className="flex gap-4">
            <StepNumber step={3} completed={false} />
            <div className="flex-1">
              <h3 className="font-bold text-ink mb-1">Create a Gmail filter</h3>
              <p className="text-sm text-ink-muted mb-3">
                Auto-label your newsletter emails with the Readflow label.
              </p>
              <details className="group border border-line">
                <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium text-ink hover:bg-surface-overlay">
                  <span>Filter setup instructions</span>
                  <ArrowRight className="w-4 h-4 text-ink-faint group-open:rotate-90 transition-transform" />
                </summary>
                <div className="px-4 pb-4 text-sm text-ink-muted space-y-2">
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>Go to <a href="https://mail.google.com/mail/u/0/#settings/filters" target="_blank" rel="noopener noreferrer" className="text-accent underline inline-flex items-center gap-0.5">Gmail Filters <ExternalLink className="w-3 h-3" /></a></li>
                    <li>Click &quot;Create a new filter&quot;</li>
                    <li>In the &quot;From&quot; field, enter your newsletter sender (e.g., <code className="bg-surface-overlay px-1 text-xs">@substack.com</code>)</li>
                    <li>Click &quot;Create filter&quot;</li>
                    <li>Check &quot;Apply the label&quot; and select &quot;Readflow&quot;</li>
                    <li>Optionally check &quot;Also apply filter to matching emails&quot;</li>
                    <li>Click &quot;Create filter&quot;</li>
                  </ol>
                </div>
              </details>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <StepNumber step={4} completed={false} />
            <div className="flex-1">
              <h3 className="font-bold text-ink mb-1">Sync your newsletters</h3>
              <p className="text-sm text-ink-muted mb-3">
                {gmailConnected
                  ? 'Click below to import your labeled newsletters.'
                  : 'After connecting Gmail and creating labels, sync to import.'}
              </p>
              {gmailConnected ? (
                <SyncButton />
              ) : (
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-2 text-label uppercase bg-ink text-surface px-6 py-3 hover:bg-accent transition-colors"
                >
                  Go to Settings
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-8 border-t border-line text-center">
          <p className="text-xs text-ink-faint">
            New senders are auto-added to <strong>Sources</strong>, where you can pause or block anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

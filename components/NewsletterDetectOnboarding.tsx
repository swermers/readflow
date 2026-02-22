'use client';

import { useState } from 'react';
import { Search, Loader2, Check, Mail, ArrowRight, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { triggerToast } from '@/components/Toast';
import { refreshSidebar } from '@/components/Sidebar';

type DetectedSender = {
  email: string;
  name: string;
  domain: string;
  messageCount: number;
  latestSubject: string;
  latestDate: string;
  alreadyAdded: boolean;
};

type Step = 'intro' | 'scanning' | 'select' | 'importing' | 'done';

export default function NewsletterDetectOnboarding({ onComplete }: { onComplete?: () => void }) {
  const [step, setStep] = useState<Step>('intro');
  const [senders, setSenders] = useState<DetectedSender[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleScan = async () => {
    setStep('scanning');
    setError(null);

    try {
      const res = await fetch('/api/newsletters/detect');
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to scan for newsletters.');
        setStep('intro');
        return;
      }

      setSenders(data.senders || []);
      // Pre-select new senders (not already added)
      const newEmails = (data.senders || [])
        .filter((s: DetectedSender) => !s.alreadyAdded)
        .map((s: DetectedSender) => s.email);
      setSelected(new Set(newEmails));
      setStep('select');
    } catch {
      setError('Network error. Please try again.');
      setStep('intro');
    }
  };

  const toggleSender = (email: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  };

  const selectAll = () => {
    const newEmails = senders.filter((s) => !s.alreadyAdded).map((s) => s.email);
    setSelected(new Set(newEmails));
  };

  const selectNone = () => {
    setSelected(new Set());
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setStep('importing');
    setError(null);

    try {
      const res = await fetch('/api/newsletters/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senders: Array.from(selected) }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Import failed.');
        setStep('select');
        return;
      }

      setImportedCount(data.imported || 0);
      setStep('done');
      refreshSidebar();
    } catch {
      setError('Network error during import.');
      setStep('select');
    }
  };

  const handleFinish = async () => {
    // Mark onboarding as complete
    try {
      await fetch('/api/profile/onboarding', { method: 'PATCH' });
    } catch {
      // Non-critical — continue anyway
    }
    onComplete?.();
    router.refresh();
  };

  const newSenders = senders.filter((s) => !s.alreadyAdded);
  const existingSenders = senders.filter((s) => s.alreadyAdded);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-6 md:p-8 shadow-xl max-h-[90vh] flex flex-col">
        {/* Intro step */}
        {step === 'intro' && (
          <>
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-accent">Welcome to Readflow</p>
              <h2 className="mt-1 text-2xl font-bold text-ink">Let&apos;s find your newsletters</h2>
              <p className="mt-2 text-sm text-ink-muted max-w-md mx-auto">
                We&apos;ll scan your Gmail for newsletters from platforms like Substack, Beehiiv, Ghost, and more. No labels or filters needed.
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleScan}
                className="inline-flex items-center gap-2 rounded-lg bg-ink px-6 py-3 text-xs uppercase tracking-[0.08em] text-surface hover:bg-accent transition-colors"
              >
                <Search className="w-4 h-4" />
                Scan my inbox
              </button>
              <button
                onClick={handleFinish}
                className="text-xs text-ink-faint hover:text-ink-muted transition-colors"
              >
                Skip for now
              </button>
            </div>
          </>
        )}

        {/* Scanning step */}
        {step === 'scanning' && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-bold text-ink mb-1">Scanning your inbox...</h2>
            <p className="text-sm text-ink-muted">Looking for newsletter senders from the last 30 days.</p>
          </div>
        )}

        {/* Select senders step */}
        {step === 'select' && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink">
                Found {newSenders.length} new newsletter{newSenders.length === 1 ? '' : 's'}
              </h2>
              <p className="text-sm text-ink-muted mt-1">
                Select which newsletters to import into Readflow.
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {newSenders.length > 0 && (
              <div className="flex items-center gap-3 mb-3">
                <button onClick={selectAll} className="text-[11px] uppercase tracking-[0.08em] text-accent hover:underline">
                  Select all
                </button>
                <span className="text-ink-faint">|</span>
                <button onClick={selectNone} className="text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:underline">
                  Deselect all
                </button>
                <span className="ml-auto text-[11px] text-ink-faint">
                  {selected.size} selected
                </span>
              </div>
            )}

            <div className="overflow-y-auto flex-1 min-h-0 -mx-2 px-2 space-y-1.5" style={{ maxHeight: '45vh' }}>
              {newSenders.map((sender) => (
                <label
                  key={sender.email}
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                    selected.has(sender.email)
                      ? 'border-accent/50 bg-accent/5'
                      : 'border-line hover:border-line-strong'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(sender.email)}
                    onChange={() => toggleSender(sender.email)}
                    className="mt-1 h-4 w-4 rounded border-line text-accent focus:ring-accent"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink truncate">{sender.name}</span>
                      <span className="text-[10px] text-ink-faint rounded-full border border-line px-2 py-0.5">
                        {sender.messageCount} issue{sender.messageCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-faint truncate mt-0.5">{sender.email}</p>
                    <p className="text-[11px] text-ink-muted truncate mt-0.5">{sender.latestSubject}</p>
                  </div>
                </label>
              ))}

              {existingSenders.length > 0 && (
                <div className="pt-3 mt-3 border-t border-line">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint mb-2">Already in your library</p>
                  {existingSenders.map((sender) => (
                    <div key={sender.email} className="flex items-center gap-3 rounded-xl border border-line p-3 opacity-50 mb-1.5">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-ink truncate block">{sender.name}</span>
                        <span className="text-[11px] text-ink-faint truncate block">{sender.email}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {senders.length === 0 && (
                <div className="text-center py-8">
                  <Mail className="w-8 h-8 text-ink-faint mx-auto mb-3" />
                  <p className="text-sm text-ink-muted">No newsletters detected in your inbox.</p>
                  <p className="text-[11px] text-ink-faint mt-1">Try subscribing to a few newsletters and scanning again later.</p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-line flex items-center justify-between gap-3">
              <button
                onClick={handleFinish}
                className="rounded-lg border border-line px-4 py-2 text-xs uppercase tracking-[0.08em] text-ink-muted hover:text-ink transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleImport}
                disabled={selected.size === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-xs uppercase tracking-[0.08em] text-surface hover:bg-accent transition-colors disabled:opacity-40"
              >
                Import {selected.size} newsletter{selected.size === 1 ? '' : 's'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}

        {/* Importing step */}
        {step === 'importing' && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-bold text-ink mb-1">Importing newsletters...</h2>
            <p className="text-sm text-ink-muted">Fetching recent issues from {selected.size} source{selected.size === 1 ? '' : 's'}.</p>
          </div>
        )}

        {/* Done step */}
        {step === 'done' && (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-lg font-bold text-ink mb-1">You&apos;re all set!</h2>
            <p className="text-sm text-ink-muted mb-6">
              {importedCount > 0
                ? `Imported ${importedCount} newsletter${importedCount === 1 ? '' : 's'} into your Rack.`
                : 'No new issues to import right now — check back later.'}
            </p>
            <button
              onClick={handleFinish}
              className="inline-flex items-center gap-2 rounded-lg bg-ink px-6 py-3 text-xs uppercase tracking-[0.08em] text-surface hover:bg-accent transition-colors"
            >
              Go to The Rack
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

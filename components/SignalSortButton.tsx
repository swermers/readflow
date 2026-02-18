'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { triggerToast } from '@/components/Toast';

type Response = {
  sorted?: number;
  error?: string;
};

export default function SignalSortButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onSort = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/signal-sort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const body = (await res.json().catch(() => null)) as Response | null;

      if (!res.ok) {
        triggerToast(body?.error || 'Could not sort issues right now');
        return;
      }

      triggerToast(`Signal sorted ${body?.sorted || 0} issue${(body?.sorted || 0) === 1 ? '' : 's'}`);
      router.refresh();
    } catch {
      triggerToast('Could not sort issues right now');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onSort}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink hover:border-line-strong disabled:opacity-60"
      title="Auto-sort unread issues into High Signal, News, or Reference"
    >
      <Sparkles className="h-3.5 w-3.5" />
      {loading ? 'Sorting...' : 'Signal Sort'}
    </button>
  );
}

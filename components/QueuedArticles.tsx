'use client';

import { useState } from 'react';
import { ArrowUpRight, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { triggerToast } from './Toast';

interface QueuedArticle {
  id: string;
  subject: string;
  from_email: string;
  received_at: string;
  senders?: { name: string; status: string }[] | null;
}

export default function QueuedArticles({ articles }: { articles: QueuedArticle[] }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const moveBack = async (id: string) => {
    const res = await fetch(`/api/issues/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'unread' }),
    });
    if (!res.ok) return;
    setDismissed((prev) => new Set(prev).add(id));
    triggerToast('Moved back to Rack');
    router.refresh();
  };

  const visible = articles.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((article) => (
        <div
          key={article.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2"
        >
          <a href={`/newsletters/${article.id}`} className="min-w-0 flex-1 group">
            <p className="text-[10px] uppercase tracking-[0.08em] text-accent">
              {(Array.isArray(article.senders) ? article.senders[0]?.name : null) || article.from_email}
            </p>
            <p className="mt-1 line-clamp-1 text-sm font-medium text-ink group-hover:text-accent transition-colors">
              {article.subject}
            </p>
          </a>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`/newsletters/${article.id}`}
              className="rounded-md border border-line p-1.5 text-ink-faint hover:text-accent hover:border-accent"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={() => moveBack(article.id)}
              className="rounded-md border border-line p-1.5 text-ink-faint hover:text-accent hover:border-accent"
              title="Move back to Rack"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

'use client';

import { type MouseEvent, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { triggerToast } from './Toast';

interface IssueDeleteButtonProps {
  issueId: string;
  onDeleted?: () => void;
  compact?: boolean;
}

export default function IssueDeleteButton({ issueId, onDeleted, compact = false }: IssueDeleteButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (isDeleting) return;

    const confirmed = window.confirm('Delete this article permanently?');
    if (!confirmed) return;

    setIsDeleting(true);

    try {
      const res = await fetch(`/api/issues/${issueId}`, { method: 'DELETE' });

      if (!res.ok) {
        let message = 'Failed to delete article.';
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch {
          // ignore non-JSON responses (e.g. redirects/html)
        }
        triggerToast(message);
        return;
      }

      triggerToast('Article deleted');
      onDeleted?.();
      router.refresh();
    } catch {
      triggerToast('Failed to delete article.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className={`inline-flex items-center gap-1 rounded-lg border border-line text-ink-faint hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 ${
        compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[10px] uppercase tracking-[0.08em]'
      }`}
      title="Delete article"
      aria-label="Delete article"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {!compact && (isDeleting ? 'Deleting...' : 'Delete')}
    </button>
  );
}

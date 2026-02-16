'use client';

import { type MouseEvent } from 'react';
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

  const handleDelete = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const confirmed = window.confirm('Delete this article permanently?');
    if (!confirmed) return;

    const res = await fetch(`/api/issues/${issueId}`, { method: 'DELETE' });
    if (!res.ok) return;

    triggerToast('Article deleted');
    onDeleted?.();
    router.refresh();
  };

  return (
    <button
      onClick={handleDelete}
      className={`inline-flex items-center gap-1 rounded-lg border border-line text-ink-faint hover:border-accent hover:text-accent ${
        compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[10px] uppercase tracking-[0.08em]'
      }`}
      title="Delete article"
      aria-label="Delete article"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {!compact && 'Delete'}
    </button>
  );
}

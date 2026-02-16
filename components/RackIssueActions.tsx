'use client';

import { type MouseEvent } from 'react';
import { Archive, BookmarkPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { triggerToast } from './Toast';

interface RackIssueActionsProps {
  issueId: string;
}

export default function RackIssueActions({ issueId }: RackIssueActionsProps) {
  const router = useRouter();

  const updateStatus = async (event: MouseEvent, status: 'read' | 'archived') => {
    event.preventDefault();
    event.stopPropagation();

    const res = await fetch(`/api/issues/${issueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) return;

    if (status === 'read') {
      triggerToast('Saved to Library');
    } else {
      triggerToast('Archived and removed');
    }

    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={(event) => updateStatus(event, 'read')}
        className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:border-accent hover:text-accent"
      >
        <BookmarkPlus className="h-3.5 w-3.5" />
        Save
      </button>
      <button
        onClick={(event) => updateStatus(event, 'archived')}
        className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:border-accent hover:text-accent"
      >
        <Archive className="h-3.5 w-3.5" />
        Archive
      </button>
    </div>
  );
}

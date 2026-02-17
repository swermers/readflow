'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, BookmarkCheck, Globe, Check } from 'lucide-react';
import { triggerToast } from '@/components/Toast';

interface IssueActionsProps {
  issueId: string;
  currentStatus: string;
  senderWebsite?: string;
}

export default function IssueActions({ issueId, currentStatus, senderWebsite }: IssueActionsProps) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const updateStatus = async (newStatus: 'unread' | 'read' | 'archived') => {
    setLoading(true);

    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setStatus(newStatus);

        if (newStatus === 'archived') {
          triggerToast('Moved to Archive');
          setTimeout(() => router.push('/archive'), 400);
        } else if (newStatus === 'read') {
          triggerToast('Saved to Library');
        } else {
          triggerToast('Removed from Library');
        }

        router.refresh();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }

    setLoading(false);
  };

  return (
    <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8">
      <div className="flex gap-4">
        {status !== 'archived' ? (
          <button
            onClick={() => updateStatus('archived')}
            disabled={loading}
            className="flex items-center gap-2 text-label uppercase text-ink-faint transition-colors hover:text-ink disabled:opacity-50"
          >
            <Archive className="h-4 w-4" />
            Archive
          </button>
        ) : (
          <span className="flex items-center gap-2 text-label uppercase text-green-600 dark:text-green-400">
            <Check className="h-4 w-4" />
            Archived
          </span>
        )}

        {status === 'unread' ? (
          <button
            onClick={() => updateStatus('read')}
            disabled={loading}
            className="flex items-center gap-2 text-label uppercase text-ink-faint transition-colors hover:text-ink disabled:opacity-50"
          >
            <BookmarkCheck className="h-4 w-4" />
            Save to Library
          </button>
        ) : status === 'read' ? (
          <button
            onClick={() => updateStatus('unread')}
            disabled={loading}
            className="flex items-center gap-2 text-label uppercase text-accent transition-colors hover:text-ink disabled:opacity-50"
          >
            <BookmarkCheck className="h-4 w-4" />
            Saved (click to unsave)
          </button>
        ) : null}
      </div>

      {senderWebsite && (
        <a
          href={senderWebsite}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-label uppercase text-ink-faint transition-colors hover:text-accent"
        >
          Visit Website <Globe className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

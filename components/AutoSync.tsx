'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { refreshSidebar } from '@/components/Sidebar';

interface AutoSyncProps {
  lastSyncAt: string | null;
  /** Minimum minutes between auto-syncs (default: 15) */
  intervalMinutes?: number;
}

/**
 * Invisible component that auto-triggers a Gmail sync when the page loads,
 * but only if enough time has passed since the last sync.
 */
export default function AutoSync({ lastSyncAt, intervalMinutes = 15 }: AutoSyncProps) {
  const router = useRouter();
  const hasSynced = useRef(false);

  useEffect(() => {
    if (hasSynced.current) return;

    const shouldSync = !lastSyncAt ||
      Date.now() - new Date(lastSyncAt).getTime() > intervalMinutes * 60 * 1000;

    if (!shouldSync) return;

    hasSynced.current = true;

    fetch('/api/sync-gmail', { method: 'POST' })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.imported > 0) {
            refreshSidebar();
            router.refresh();
          }
        }
      })
      .catch(() => {
        // Silent failure for auto-sync — user can always manually sync
      });
  }, [lastSyncAt, intervalMinutes, router]);

  return null;
}

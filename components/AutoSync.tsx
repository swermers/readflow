'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { refreshSidebar } from '@/components/Sidebar';

type SyncPayload = { imported?: number };

function parseJson<T>(raw: string): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

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
        const raw = await res.text();
        const data = parseJson<SyncPayload>(raw);

        if (!res.ok) {
          console.warn('[AutoSync] Sync failed:', res.status, raw.slice(0, 500));
          return;
        }

        console.log('[AutoSync] Sync result:', raw.slice(0, 500));
        if ((data?.imported ?? 0) > 0) {
          refreshSidebar();
          router.refresh();
        }
      })
      .catch((err) => {
        console.warn('[AutoSync] Network error:', err);
      });
  }, [lastSyncAt, intervalMinutes, router]);

  return null;
}

'use client';

import { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { triggerToast } from '@/components/Toast';
import { refreshSidebar } from '@/components/Sidebar';

interface SyncButtonProps {
  variant?: 'primary' | 'compact';
  onDisconnected?: () => void;
}

function parseJson<T>(raw: string): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export default function SyncButton({ variant = 'primary', onDisconnected }: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    setSyncing(true);

    try {
      const res = await fetch('/api/sync-gmail', { method: 'POST' });

      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        const errorMsg = (data.error as string) || 'Sync failed. Check Settings to make sure Gmail is connected.';
        triggerToast(errorMsg);
        if (res.status === 401 || (data.code === 'TOKEN_EXPIRED')) {
          onDisconnected?.();
          router.push('/settings?gmail=expired');
        }
      } else {
        const msg = (data.message as string) || `Imported ${data.imported} newsletters`;
        triggerToast(msg);
        if (data.warning) {
          triggerToast(data.warning as string);
        }
        if (data.debug) {
          console.log('[SyncButton] Sync debug:', JSON.stringify(data.debug));
        }
        refreshSidebar();
        router.refresh();
      }
    } catch (err) {
      console.error('Sync error:', err);
      triggerToast('Network error. Check your connection and try again.');
    }

    setSyncing(false);
  };

  if (variant === 'compact') {
    return (
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-2 text-label uppercase text-accent hover:text-accent-hover transition-colors disabled:opacity-50"
      >
        {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        {syncing ? 'Syncing...' : 'Sync Now'}
      </button>
    );
  }

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="flex items-center gap-2 text-label uppercase bg-ink text-surface px-6 py-3 hover:bg-accent transition-colors disabled:opacity-50"
    >
      {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
      {syncing ? 'Syncing...' : 'Sync Now'}
    </button>
  );
}

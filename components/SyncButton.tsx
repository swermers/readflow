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

export default function SyncButton({ variant = 'primary', onDisconnected }: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    setSyncing(true);

    try {
      const res = await fetch('/api/sync-gmail', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        triggerToast(data.error || 'Sync failed');
        if (res.status === 401 && data.error?.includes('expired')) {
          onDisconnected?.();
        }
      } else {
        triggerToast(data.message || `Imported ${data.imported} newsletters`);
        refreshSidebar();
        router.refresh();
      }
    } catch (err) {
      console.error('Sync error:', err);
      triggerToast('Sync failed');
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

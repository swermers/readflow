'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Trash2, PauseCircle, PlayCircle, Loader2, AlertCircle, Rss } from 'lucide-react';
import { triggerToast } from '@/components/Toast';
import { refreshSidebar } from '@/components/Sidebar';

export default function SourcesPage() {
  const [senders, setSenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchSenders();
  }, []);

  const fetchSenders = async () => {
    const { data, error: fetchError } = await supabase
      .from('senders')
      .select('*')
      .in('status', ['approved', 'blocked'])
      .order('name', { ascending: true });

    if (fetchError) {
      console.error('Error fetching senders:', fetchError);
      setError('Failed to load sources.');
    }
    if (data) setSenders(data);
    setLoading(false);
  };

  const toggleStatus = async (id: string, currentStatus: string, name: string) => {
    const newStatus = currentStatus === 'approved' ? 'blocked' : 'approved';

    setSenders((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
    );

    const { error } = await supabase
      .from('senders')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      setSenders((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: currentStatus } : s))
      );
      console.error('Error updating sender:', error);
    } else {
      triggerToast(newStatus === 'approved' ? `Resumed ${name}` : `Paused ${name}`);
      refreshSidebar();
    }
  };

  const deleteSender = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}? Their issues will remain in the vault.`)) return;

    const prev = senders;
    setSenders((current) => current.filter((s) => s.id !== id));

    const { error } = await supabase.from('senders').delete().eq('id', id);

    if (error) {
      setSenders(prev);
      console.error('Error deleting sender:', error);
    } else {
      triggerToast(`Removed ${name}`);
      refreshSidebar();
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-ink-muted flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading sources...
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-8 md:p-12 min-h-screen">
        <header className="mb-10">
          <h1 className="text-display-lg text-ink">Sources.</h1>
        </header>
        <div className="h-px bg-line-strong mb-10" />
        <div className="text-center py-20 bg-surface-raised border border-line">
          <AlertCircle className="w-10 h-10 text-accent mx-auto mb-4" />
          <p className="text-ink font-medium">Something went wrong.</p>
          <p className="text-sm text-ink-muted mt-1">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); fetchSenders(); }}
            className="mt-6 px-6 py-2.5 bg-ink text-surface text-label uppercase hover:bg-accent transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const activeCount = senders.filter((s) => s.status === 'approved').length;

  return (
    <div className="px-6 py-8 md:p-12 min-h-screen">

      {/* Header */}
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-display-lg text-ink">Sources.</h1>
          <p className="text-sm text-ink-muted mt-1">
            {activeCount} active, {senders.length - activeCount} paused.
          </p>
        </div>
      </header>

      <div className="h-px bg-line-strong mb-8" />

      {/* Sources List */}
      {senders.length === 0 ? (
        <div className="text-center py-20 bg-surface-raised border border-dashed border-line">
          <Rss className="w-10 h-10 text-ink-faint mx-auto mb-4" />
          <p className="text-ink-muted font-medium">No sources yet.</p>
          <p className="text-sm text-ink-faint">Approved senders will appear here.</p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {senders.map((sender) => {
            const isActive = sender.status === 'approved';
            return (
              <div key={sender.id} className="group flex flex-col md:flex-row md:items-center justify-between py-5 px-2 hover:bg-surface-raised transition-colors gap-4 md:gap-0">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isActive ? 'bg-accent' : 'bg-ink-faint'}`} />
                  <div className="overflow-hidden">
                    <h3 className={`text-base font-bold truncate ${isActive ? 'text-ink' : 'text-ink-faint'}`}>
                      {sender.name}
                    </h3>
                    <p className="text-xs text-ink-faint font-mono truncate">{sender.email}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 md:gap-6 w-full md:w-auto pl-7 md:pl-0">
                  <div className={`text-label uppercase px-2.5 py-1 ${isActive ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-surface-overlay text-ink-faint'}`}>
                    {isActive ? 'Active' : 'Paused'}
                  </div>

                  <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => toggleStatus(sender.id, sender.status, sender.name)}
                      className="p-2 hover:bg-surface-overlay border border-transparent hover:border-line rounded-lg text-ink-faint hover:text-ink transition-all"
                      title={isActive ? 'Pause' : 'Resume'}
                    >
                      {isActive ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => deleteSender(sender.id, sender.name)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-200 dark:hover:border-red-800 rounded-lg text-ink-faint hover:text-accent transition-all"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

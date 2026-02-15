'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Trash2, PauseCircle, PlayCircle, Plus, Loader2, AlertCircle } from 'lucide-react';
import { triggerToast } from '@/components/Toast';
import { refreshSidebar } from '@/components/Sidebar';

export default function SubscriptionsPage() {
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
      setError('Failed to load subscriptions.');
    }
    if (data) setSenders(data);
    setLoading(false);
  };

  const toggleStatus = async (id: string, currentStatus: string, name: string) => {
    const newStatus = currentStatus === 'approved' ? 'blocked' : 'approved';

    // Optimistic update
    setSenders((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
    );

    const { error } = await supabase
      .from('senders')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      // Revert on failure
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
    if (!confirm(`Remove ${name} from your library? Their issues will remain in the vault.`)) {
      return;
    }

    // Optimistic removal
    const prev = senders;
    setSenders((current) => current.filter((s) => s.id !== id));

    const { error } = await supabase
      .from('senders')
      .delete()
      .eq('id', id);

    if (error) {
      setSenders(prev); // Revert
      console.error('Error deleting sender:', error);
    } else {
      triggerToast(`Removed ${name}`);
      refreshSidebar();
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-gray-400 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading subscriptions...
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-8 md:p-12 min-h-screen">
        <header className="mb-8 md:mb-12 border-b border-black pb-6 md:pb-4">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1A1A1A]">Subscriptions.</h1>
        </header>
        <div className="text-center py-20 bg-red-50 rounded-lg border border-red-100">
          <AlertCircle className="w-12 h-12 text-[#FF4E4E] mx-auto mb-4" />
          <p className="text-gray-900 font-medium">Something went wrong.</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); fetchSenders(); }}
            className="mt-6 px-6 py-2 bg-[#1A1A1A] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#FF4E4E] transition-colors"
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
      <header className="mb-8 md:mb-12 border-b border-black pb-6 md:pb-4 flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1A1A1A]">Subscriptions.</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeCount} active, {senders.length - activeCount} paused.
          </p>
        </div>
      </header>

      {/* List */}
      {senders.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-lg border border-gray-100 border-dashed">
          <p className="text-gray-500 font-medium">No subscriptions yet.</p>
          <p className="text-sm text-gray-400">Approved senders will appear here.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {senders.map((sender) => {
            const isActive = sender.status === 'approved';
            return (
              <div key={sender.id} className="group flex flex-col md:flex-row md:items-center justify-between py-6 border-b border-gray-100 hover:bg-gray-50 transition-colors px-2 gap-4 md:gap-0">

                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isActive ? 'bg-[#FF4E4E]' : 'bg-gray-300'}`} />
                  <div className="overflow-hidden">
                    <h3 className={`text-lg font-bold truncate ${isActive ? 'text-black' : 'text-gray-400'}`}>
                      {sender.name}
                    </h3>
                    <p className="text-xs text-gray-400 font-mono truncate">{sender.email}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 md:gap-8 w-full md:w-auto pl-7 md:pl-0">
                  <div className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded ${isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    {isActive ? 'Active' : 'Paused'}
                  </div>

                  <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => toggleStatus(sender.id, sender.status, sender.name)}
                      className="p-2 hover:bg-white border border-transparent hover:border-gray-200 rounded-full text-gray-400 hover:text-black transition-all"
                      title={isActive ? 'Pause' : 'Resume'}
                    >
                      {isActive ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => deleteSender(sender.id, sender.name)}
                      className="p-2 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-full text-gray-400 hover:text-[#FF4E4E] transition-all"
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

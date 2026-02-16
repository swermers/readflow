'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { CheckCircle, XCircle, Shield, AlertCircle } from 'lucide-react';
import { triggerToast } from '@/components/Toast';
import { refreshSidebar } from '@/components/Sidebar';

export default function ReviewPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const { data, error: fetchError } = await supabase
      .from('senders')
      .select('*, issues(snippet)')
      .eq('status', 'pending');

    if (fetchError) {
      console.error('Error fetching review queue:', fetchError);
      setError('Failed to load the review queue.');
    }
    if (data) setRequests(data);
    setLoading(false);
  };

  const handleDecision = async (id: string, decision: 'approved' | 'blocked', name: string) => {
    setRequests(current => current.filter(r => r.id !== id));

    const { error } = await supabase
      .from('senders')
      .update({ status: decision })
      .eq('id', id);

    if (error) {
      console.error('Error updating status:', error);
      triggerToast('Failed to update sender. Please try again.', 'error');
      fetchRequests();
    } else {
      triggerToast(decision === 'approved' ? `Added ${name} to Library` : `Blocked ${name}`);
      refreshSidebar();
    }
  };

  if (loading) return <div className="p-12 text-ink-muted animate-pulse">Loading gatekeeper...</div>;

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6 md:p-12">
        <header className="mb-10">
          <h1 className="text-display-lg text-ink">Gatekeeper.</h1>
        </header>
        <div className="h-px bg-line-strong mb-10" />
        <div className="text-center py-20 bg-surface-raised border border-line">
          <AlertCircle className="w-10 h-10 text-accent mx-auto mb-4" />
          <p className="text-ink font-medium">Something went wrong.</p>
          <p className="text-sm text-ink-muted mt-1">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); fetchRequests(); }}
            className="mt-6 px-6 py-2.5 bg-ink text-surface text-label uppercase hover:bg-accent transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12">

      <header className="mb-10">
        <h1 className="text-display-lg text-ink">Gatekeeper.</h1>
        <p className="text-sm text-ink-muted mt-1">
          {requests.length} new {requests.length === 1 ? 'sender' : 'senders'} waiting for approval.
        </p>
      </header>

      <div className="h-px bg-line-strong mb-8" />

      {requests.length === 0 ? (
        <div className="text-center py-20 bg-surface-raised border border-dashed border-line">
          <Shield className="w-10 h-10 text-ink-faint mx-auto mb-4" />
          <p className="text-ink-muted font-medium">Perimeter Secure.</p>
          <p className="text-sm text-ink-faint">No new senders in the queue.</p>
        </div>
      ) : (
        <div className="space-y-4 stagger-children">
          {requests.map((request) => (
            <div key={request.id} className="bg-surface border border-line p-6 flex flex-col md:flex-row gap-6 hover:border-accent/30 transition-colors">

              {/* Sender Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-surface-overlay rounded-full flex items-center justify-center text-sm font-bold text-ink-faint">
                    {request.name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-ink">{request.name}</h3>
                    <p className="text-xs text-ink-faint font-mono">{request.email}</p>
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-surface-raised p-4 border-l-2 border-line">
                  <p className="text-sm text-ink-muted italic">
                    &ldquo;{request.issues?.[0]?.snippet || 'No preview available...'}&rdquo;
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex md:flex-col justify-end gap-3 min-w-[140px]">
                <button
                  onClick={() => handleDecision(request.id, 'blocked', request.name)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-label uppercase hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                >
                  <XCircle className="w-4 h-4" /> Block
                </button>
                <button
                  onClick={() => handleDecision(request.id, 'approved', request.name)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-ink text-surface text-label uppercase hover:bg-accent transition-colors"
                >
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}

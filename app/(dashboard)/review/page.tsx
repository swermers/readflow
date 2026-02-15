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

  // 1. Fetch only 'pending' senders
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

  // 2. Handle Decision
  const handleDecision = async (id: string, decision: 'approved' | 'blocked', name: string) => {
    // Optimistic UI: Remove it from the screen immediately
    setRequests(current => current.filter(r => r.id !== id));

    // Send update to DB
    const { error } = await supabase
      .from('senders')
      .update({ status: decision })
      .eq('id', id);

    if (error) {
      console.error('Error updating status:', error);
      triggerToast('Failed to update sender. Please try again.', 'error');
      fetchRequests(); // Revert by re-fetching
    } else {
      triggerToast(decision === 'approved' ? `Added ${name} to Library` : `Blocked ${name}`);
      refreshSidebar();
    }
  };

  if (loading) return <div className="p-12 text-gray-400">Loading protocol...</div>;

  if (error) return (
    <div className="max-w-4xl mx-auto p-6 md:p-12">
      <header className="mb-12 border-b border-gray-100 pb-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Gatekeeper.</h1>
      </header>
      <div className="text-center py-20 bg-red-50 rounded-lg border border-red-100">
        <AlertCircle className="w-12 h-12 text-[#FF4E4E] mx-auto mb-4" />
        <p className="text-gray-900 font-medium">Something went wrong.</p>
        <p className="text-sm text-gray-500 mt-1">{error}</p>
        <button
          onClick={() => { setError(null); setLoading(true); fetchRequests(); }}
          className="mt-6 px-6 py-2 bg-[#1A1A1A] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#FF4E4E] transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12">
      
      <header className="mb-12 border-b border-gray-100 pb-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Gatekeeper.</h1>
        <p className="text-gray-500">
          {requests.length} new senders waiting for approval.
        </p>
      </header>

      {requests.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-lg border border-gray-100 border-dashed">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Perimeter Secure.</p>
          <p className="text-sm text-gray-400">No new senders in the queue.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {requests.map((request) => (
            <div key={request.id} className="bg-white border border-gray-100 p-6 flex flex-col md:flex-row gap-6 shadow-sm hover:shadow-md transition-shadow">
              
              {/* Sender Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-[#F5F5F0] rounded-full flex items-center justify-center text-xs font-bold text-gray-500">
                    {request.name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{request.name}</h3>
                    <p className="text-xs text-gray-400 font-mono">{request.email}</p>
                  </div>
                </div>

                {/* Preview Snippet (if available) */}
                <div className="bg-[#F9F9F9] p-4 rounded-md mt-4 border-l-2 border-gray-200">
                  <p className="text-sm text-gray-600 italic">
                    "{request.issues?.[0]?.snippet || 'No preview available...'}"
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex md:flex-col justify-end gap-3 min-w-[140px]">
                <button 
                  onClick={() => handleDecision(request.id, 'blocked', request.name)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-red-100 bg-red-50 text-red-600 text-xs font-bold uppercase tracking-widest hover:bg-red-100 transition-colors"
                >
                  <XCircle className="w-4 h-4" /> Block
                </button>
                <button 
                  onClick={() => handleDecision(request.id, 'approved', request.name)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#1A1A1A] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#FF4E4E] transition-colors"
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
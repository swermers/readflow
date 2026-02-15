'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { triggerToast } from '@/components/Toast';

export default function UnsubscribeButton({ senderId, senderName }: { senderId: string; senderName: string }) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleUnsubscribe = async () => {
    if (!confirm(`Block ${senderName}? Their future emails will be ignored.`)) return;

    setLoading(true);
    const { error } = await supabase
      .from('senders')
      .update({ status: 'blocked' })
      .eq('id', senderId);

    if (error) {
      console.error('Error blocking sender:', error);
    } else {
      triggerToast(`Blocked ${senderName}`);
      router.push('/');
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleUnsubscribe}
      disabled={loading}
      className="px-4 py-2 border border-gray-200 hover:border-red-200 hover:text-red-600 rounded text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors disabled:opacity-50"
    >
      {loading ? 'Blocking...' : 'Unsubscribe'}
    </button>
  );
}

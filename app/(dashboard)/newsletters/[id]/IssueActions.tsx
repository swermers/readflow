'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, BookOpen, Globe, Check } from 'lucide-react';
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

  const updateStatus = async (newStatus: 'read' | 'archived' | 'unread') => {
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
          // Navigate back to the rack after a brief moment
          setTimeout(() => router.push('/'), 500);
        } else if (newStatus === 'unread') {
          triggerToast('Marked as unread');
        }
        
        router.refresh();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
    
    setLoading(false);
  };

  return (
    <div className="mt-20 pt-10 border-t border-gray-100 flex justify-between items-center">
      <div className="flex gap-3">
        {status !== 'archived' ? (
          <button 
            onClick={() => updateStatus('archived')}
            disabled={loading}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors disabled:opacity-50"
          >
            <Archive className="w-4 h-4" />
            Archive Issue
          </button>
        ) : (
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-green-600">
            <Check className="w-4 h-4" />
            Archived
          </span>
        )}

        {status === 'read' && (
          <button 
            onClick={() => updateStatus('unread')}
            disabled={loading}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors disabled:opacity-50"
          >
            <BookOpen className="w-4 h-4" />
            Mark Unread
          </button>
        )}
      </div>

      <a 
        href={senderWebsite || '#'} 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-[#FF4E4E] transition-colors"
      >
        Visit Website <Globe className="w-4 h-4" />
      </a>
    </div>
  );
}
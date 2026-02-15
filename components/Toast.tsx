'use client';

import { CheckCircle, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

export const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
  const event = new CustomEvent('toast', { detail: { message, type } });
  window.dispatchEvent(event);
};

export default function Toast() {
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    const handleToast = (e: any) => {
      setMessage(e.detail.message);
      setType(e.detail.type || 'success');
      setShow(true);
      setTimeout(() => setShow(false), 3000);
    };

    window.addEventListener('toast', handleToast);
    return () => window.removeEventListener('toast', handleToast);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-[#1A1A1A] text-white px-4 py-3 rounded shadow-xl flex items-center gap-3">
        {type === 'error' ? (
          <AlertCircle className="w-4 h-4 text-red-400" />
        ) : (
          <CheckCircle className="w-4 h-4 text-[#FF4E4E]" />
        )}
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
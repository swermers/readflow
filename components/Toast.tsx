'use client';

import { CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

// A simple global event system for this prototype
export const triggerToast = (message: string) => {
  const event = new CustomEvent('toast', { detail: message });
  window.dispatchEvent(event);
};

export default function Toast() {
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleToast = (e: any) => {
      setMessage(e.detail);
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
        <CheckCircle className="w-4 h-4 text-[#FF4E4E]" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
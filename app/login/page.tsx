'use client'; // Switch to Client Component to manage state (Show/Hide Input)

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client'; // Use Client SDK here for cleaner UI flow
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const router = useRouter();
  const supabase = createClient();

  // 1. Send the Code
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      // No 'options' needed for generic OTP!
    });

    if (error) {
      setMsg(error.message);
    } else {
      setSent(true); // Flip the UI to show the "Code" input
      setMsg('Check your email for the code!');
    }
    setLoading(false);
  };

  // 2. Verify the Code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const form = e.target as HTMLFormElement;
    const token = (form.elements.namedItem('token') as HTMLInputElement).value;

    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error) {
      setMsg('Invalid code. Try again.');
      setLoading(false);
    } else {
      // Success! Force a hard refresh to update server components
      router.refresh();
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="w-full max-w-sm text-center">
        <div className="inline-block h-1 w-8 bg-[#FF4E4E] mb-8"></div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A] mb-2">Readflow.</h1>
        <p className="text-gray-500 mb-8 text-sm">Your personal newsletter sanctuary.</p>

        {msg && (
          <div className={`mb-6 p-3 text-xs text-center border rounded ${msg.includes('Check') ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
            {msg}
          </div>
        )}

        {!sent ? (
          // STATE 1: Ask for Email
          <form onSubmit={handleSendCode} className="flex flex-col gap-4">
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full bg-gray-50 border border-gray-100 p-3 rounded text-sm outline-none focus:border-[#FF4E4E] transition-colors"
              required
              disabled={loading}
            />
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A1A1A] text-white font-bold uppercase tracking-widest text-xs p-4 rounded hover:bg-[#FF4E4E] transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Login Code'}
            </button>
          </form>
        ) : (
          // STATE 2: Ask for Code
          <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
             <div className="text-left text-xs text-gray-400 mb-1">
                Sent to <span className="text-black font-bold">{email}</span>
                <button type="button" onClick={() => setSent(false)} className="ml-2 underline hover:text-[#FF4E4E]">Change?</button>
             </div>
            <input 
              type="text" 
              name="token"
              placeholder="123456"
              className="w-full bg-gray-50 border border-gray-100 p-3 rounded text-sm outline-none focus:border-[#FF4E4E] transition-colors text-center tracking-[0.5em] font-bold text-lg"
              autoFocus
              required
              disabled={loading}
            />
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A1A1A] text-white font-bold uppercase tracking-widest text-xs p-4 rounded hover:bg-[#FF4E4E] transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Enter Code'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
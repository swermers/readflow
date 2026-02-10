'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useSearchParams } from 'next/navigation';
import { verifyOtp } from './actions'; // <--- IMPORT THE SERVER ACTION

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Check for error messages from the server (e.g. if code was wrong)
  useEffect(() => {
    const message = searchParams.get('message');
    const emailParam = searchParams.get('email');
    if (message) setMsg(message);
    if (emailParam) {
        setEmail(emailParam);
        setSent(true); // Jump straight to step 2 if we came back with an error
    }
  }, [searchParams]);

  // STEP 1: Send the Code (Client-Side is fine here)
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
    });

    if (error) {
      setMsg(error.message);
      setLoading(false);
    } else {
      setSent(true);
      setMsg('Check your email for the code!');
      setLoading(false);
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
              name="email"
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
          // STATE 2: Ask for Code (Uses Server Action directly!)
          <form action={verifyOtp} className="flex flex-col gap-4">
             <div className="text-left text-xs text-gray-400 mb-1">
                Sent to <span className="text-black font-bold">{email}</span>
                <button type="button" onClick={() => setSent(false)} className="ml-2 underline hover:text-[#FF4E4E]">Change?</button>
             </div>
            
            {/* HIDDEN INPUT: Sends the email to the server action */}
            <input type="hidden" name="email" value={email} />

            <input 
              type="text" 
              name="token"
              placeholder="123456"
              className="w-full bg-gray-50 border border-gray-100 p-3 rounded text-sm outline-none focus:border-[#FF4E4E] transition-colors text-center tracking-[0.5em] font-bold text-lg"
              autoFocus
              required
            />
            <button 
              type="submit"
              className="w-full bg-[#1A1A1A] text-white font-bold uppercase tracking-widest text-xs p-4 rounded hover:bg-[#FF4E4E] transition-colors"
            >
              Verify & Enter
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
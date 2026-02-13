'use client';

import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type LoginClientProps = {
  code?: string;
  next?: string;
  message?: string;
};

export default function LoginClient({ code, next, message }: LoginClientProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(message ?? null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!code) return;

    const safeNext = next?.startsWith('/') ? next : '/';

    const exchangeCode = async () => {
      setLoading(true);
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        setError(exchangeError.message);
        setLoading(false);
        return;
      }

      router.replace(safeNext);
    };

    void exchangeCode();
  }, [code, next, router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="w-full max-w-sm text-center">
        <div className="inline-block h-1 w-8 bg-[#FF4E4E] mb-8"></div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A] mb-2">Readflow.</h1>
        <p className="text-gray-500 mb-8 text-sm">Your personal newsletter sanctuary.</p>

        {error && (
          <div className="mb-4 p-3 text-xs text-red-500 bg-red-50 border border-red-100 rounded">
            {error}
          </div>
        )}

        <a
          href="/auth/google"
          aria-disabled={loading}
          className={`w-full border border-gray-300 text-[#1A1A1A] font-medium text-sm p-3 rounded flex items-center justify-center gap-3 transition-colors mb-6 ${
            loading ? 'pointer-events-none bg-gray-50 text-gray-400' : 'bg-white hover:bg-gray-50'
          }`}
        >
          {loading ? 'Connecting...' : 'Continue with Google'}
        </a>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 text-gray-500 uppercase tracking-wider">Or with email</span>
          </div>
        </div>

        <div className="text-xs text-gray-400">Magic links are temporarily disabled while we upgrade.</div>
      </div>
    </div>
  );
}

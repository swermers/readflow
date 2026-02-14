'use client';

import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/');
      }
    });
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    // Always use the current origin so PKCE cookies and callback run on the same domain.
    const redirectUrl = `${window.location.origin}/auth/callback`;

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        // flowType: 'pkce' is the default in @supabase/ssr, 
        // but explicitly defining it can help in some versions
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (authError) {
      console.error('Google Login Error:', authError);
      setError(authError.message);
      setLoading(false);
    }
  };

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

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white border border-gray-300 text-[#1A1A1A] font-medium text-sm p-3 rounded flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors mb-6"
        >
          {loading ? 'Connecting...' : 'Continue with Google'}
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 text-gray-500 uppercase tracking-wider">Or with email</span>
          </div>
        </div>

         <div className="text-xs text-gray-400">
            Magic links are temporarily disabled while we upgrade.
         </div>
      </div>
    </div>
  );
}

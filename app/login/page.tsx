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

    const redirectUrl = `${window.location.origin}/auth/callback`;

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        scopes: 'https://www.googleapis.com/auth/gmail.readonly',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
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
    <div className="min-h-screen flex items-center justify-center bg-surface p-6">
      <div className="w-full max-w-sm text-center">
        {/* Swiss Red accent bar */}
        <div className="inline-block h-1 w-10 bg-accent mb-8" />

        <h1 className="text-2xl font-bold tracking-tight text-ink mb-2">Readflow.</h1>
        <p className="text-ink-muted mb-10 text-sm">Your personal newsletter sanctuary.</p>

        {error && (
          <div className="mb-4 p-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-surface border border-line text-ink font-medium text-sm p-3.5 flex items-center justify-center gap-3 hover:border-line-strong transition-colors mb-8"
        >
          {loading ? 'Connecting...' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
}

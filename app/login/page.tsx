'use client';

import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [email, setEmail] = useState('');
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/');
      } else {
        setCheckingSession(false);
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
        scopes: 'openid email profile',
      },
    });

    if (authError) {
      console.error('Google Login Error:', authError);
      setError(authError.message);
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (otpError) {
      setError(otpError.message);
    } else {
      setSuccess('Check your email for a sign-in link.');
    }
    setLoading(false);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="inline-block h-1 w-10 bg-accent mb-8 rounded-full" />
          <h1 className="text-2xl font-bold tracking-tight text-ink">Readflow.</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-6">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-block h-1 w-10 bg-accent mb-6 rounded-full" />
          <h1 className="text-2xl font-bold tracking-tight text-ink">Readflow.</h1>
          <p className="text-ink-muted mt-2 text-sm">Your personal newsletter sanctuary.</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-line bg-surface-raised p-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          {error && (
            <div className="mb-4 rounded-lg p-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg p-3 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              {success}
            </div>
          )}

          {/* Primary: Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-ink text-surface font-semibold text-sm px-4 py-3.5 hover:bg-accent transition-colors disabled:opacity-50"
          >
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {loading && !showMagicLink ? 'Connecting...' : 'Continue with Google'}
          </button>

          <p className="text-center text-[11px] text-ink-faint mt-3">
            Syncs your newsletter labels automatically.
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-line" />
            <span className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">or</span>
            <div className="flex-1 h-px bg-line" />
          </div>

          {/* Secondary: Magic link */}
          {!showMagicLink ? (
            <button
              onClick={() => { setShowMagicLink(true); setError(null); setSuccess(null); }}
              className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-ink hover:border-accent hover:text-accent transition-colors"
            >
              Sign in with email link
            </button>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-3">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full rounded-xl bg-surface border border-line text-ink text-sm px-4 py-3 focus:outline-none focus:border-accent placeholder:text-ink-faint"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-ink hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send magic link'}
              </button>
              <button
                type="button"
                onClick={() => { setShowMagicLink(false); setError(null); setSuccess(null); }}
                className="w-full text-[11px] text-ink-faint hover:text-ink transition-colors"
              >
                Back
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-ink-faint mt-6">
          By continuing, you agree to the{' '}
          <a href="/terms" className="underline hover:text-ink">Terms</a>{' '}
          and{' '}
          <a href="/privacy" className="underline hover:text-ink">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}

'use client';

import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

type AuthMode = 'magic-link' | 'signin' | 'signup';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>('magic-link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setSuccess(null);
  };

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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (mode === 'magic-link') {
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
      return;
    }

    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signUpError) {
        setError(signUpError.message);
      } else {
        setSuccess('Check your email to confirm your account.');
      }
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError(signInError.message);
    } else {
      router.replace('/');
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

          {/* Google button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm font-medium text-ink hover:bg-surface-overlay transition-colors disabled:opacity-50"
          >
            <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
            {loading ? 'Connecting...' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-line" />
            <span className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">or</span>
            <div className="flex-1 h-px bg-line" />
          </div>

          {/* Magic link (default) */}
          {mode === 'magic-link' && (
            <>
              <form onSubmit={handleEmailAuth} className="space-y-3">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg bg-surface border border-line text-ink text-sm px-4 py-3 focus:outline-none focus:border-accent placeholder:text-ink-faint"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm font-medium text-ink hover:bg-surface-overlay transition-colors disabled:opacity-50"
                >
                  <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  {loading ? 'Sending...' : 'Continue with Email'}
                </button>
              </form>

              {/* Traditional login below */}
              <div className="mt-5 space-y-2 text-center text-xs text-ink-muted">
                <p>
                  <button onClick={() => switchMode('signin')} className="text-ink-muted hover:text-accent transition-colors">
                    Sign in with password
                  </button>
                </p>
                <p className="text-ink-faint">
                  Don&apos;t have an account?{' '}
                  <button onClick={() => switchMode('signup')} className="text-accent hover:underline">
                    Sign up
                  </button>
                </p>
              </div>
            </>
          )}

          {/* Sign in with password */}
          {mode === 'signin' && (
            <>
              <form onSubmit={handleEmailAuth} className="space-y-3">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg bg-surface border border-line text-ink text-sm px-4 py-3 focus:outline-none focus:border-accent placeholder:text-ink-faint"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-lg bg-surface border border-line text-ink text-sm px-4 py-3 focus:outline-none focus:border-accent placeholder:text-ink-faint"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-ink text-surface font-medium text-sm px-4 py-3 hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Sign in'}
                </button>
              </form>

              <div className="mt-4 space-y-2 text-center text-xs text-ink-muted">
                <p>
                  <a href="/auth/reset-password" className="text-accent hover:underline">
                    Forgot password?
                  </a>
                </p>
                <p>
                  <button onClick={() => switchMode('magic-link')} className="text-ink-muted hover:text-accent transition-colors">
                    Sign in with magic link
                  </button>
                </p>
                <p className="pt-1 text-ink-faint">
                  Don&apos;t have an account?{' '}
                  <button onClick={() => switchMode('signup')} className="text-accent hover:underline">
                    Sign up
                  </button>
                </p>
              </div>
            </>
          )}

          {/* Sign up */}
          {mode === 'signup' && (
            <>
              <form onSubmit={handleEmailAuth} className="space-y-3">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg bg-surface border border-line text-ink text-sm px-4 py-3 focus:outline-none focus:border-accent placeholder:text-ink-faint"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-lg bg-surface border border-line text-ink text-sm px-4 py-3 focus:outline-none focus:border-accent placeholder:text-ink-faint"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-ink text-surface font-medium text-sm px-4 py-3 hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Create account'}
                </button>
              </form>

              <div className="mt-4 text-center text-xs text-ink-muted">
                <p>
                  Already have an account?{' '}
                  <button onClick={() => switchMode('signin')} className="text-accent hover:underline">
                    Sign in
                  </button>
                </p>
              </div>
            </>
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

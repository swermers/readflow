'use client';

import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

type AuthMode = 'signin' | 'signup' | 'magic-link';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>('signin');
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

    // Sign in
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

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="inline-block h-1 w-10 bg-accent mb-8" />
          <h1 className="text-2xl font-bold tracking-tight text-ink">Readflow.</h1>
        </div>
      </div>
    );
  }

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

        {success && (
          <div className="mb-4 p-3 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            {success}
          </div>
        )}

        {/* Email/password form */}
        <form onSubmit={handleEmailAuth} className="space-y-3 mb-6">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-surface border border-line text-ink text-sm p-3 focus:outline-none focus:border-accent placeholder:text-ink-faint"
          />

          {mode !== 'magic-link' && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-surface border border-line text-ink text-sm p-3 focus:outline-none focus:border-accent placeholder:text-ink-faint"
            />
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink text-surface font-medium text-sm p-3.5 hover:bg-accent transition-colors disabled:opacity-50"
          >
            {loading
              ? 'Loading...'
              : mode === 'signup'
                ? 'Create account'
                : mode === 'magic-link'
                  ? 'Send magic link'
                  : 'Sign in'}
          </button>
        </form>

        {/* Mode toggles */}
        <div className="space-y-2 mb-6 text-xs text-ink-muted">
          {mode === 'signin' && (
            <>
              <p>
                Don&apos;t have an account?{' '}
                <button onClick={() => { setMode('signup'); setError(null); setSuccess(null); }} className="text-accent hover:underline">
                  Sign up
                </button>
              </p>
              <p>
                <button onClick={() => { setMode('magic-link'); setError(null); setSuccess(null); }} className="text-ink-muted hover:text-ink">
                  Sign in with magic link instead
                </button>
              </p>
              <p>
                <a href="/auth/reset-password" className="text-ink-muted hover:text-ink">
                  Forgot password?
                </a>
              </p>
            </>
          )}
          {mode === 'signup' && (
            <p>
              Already have an account?{' '}
              <button onClick={() => { setMode('signin'); setError(null); setSuccess(null); }} className="text-accent hover:underline">
                Sign in
              </button>
            </p>
          )}
          {mode === 'magic-link' && (
            <p>
              <button onClick={() => { setMode('signin'); setError(null); setSuccess(null); }} className="text-ink-muted hover:text-ink">
                Sign in with password instead
              </button>
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-line" />
          <span className="text-[11px] uppercase tracking-[0.1em] text-ink-faint">or</span>
          <div className="flex-1 h-px bg-line" />
        </div>

        {/* Google login */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-surface border border-line text-ink font-medium text-sm p-3.5 flex items-center justify-center gap-3 hover:border-line-strong transition-colors"
        >
          {loading ? 'Connecting...' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
}

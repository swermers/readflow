'use client';

import { createClient } from '@/utils/supabase/client';
import { useState } from 'react';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-6">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-block h-1 w-10 bg-accent mb-6 rounded-full" />
          <h1 className="text-2xl font-bold tracking-tight text-ink">Reset password</h1>
          <p className="text-ink-muted mt-2 text-sm">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-line bg-surface-raised p-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          {error && (
            <div className="mb-4 rounded-lg p-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          {sent ? (
            <div className="space-y-4 text-center">
              <div className="rounded-lg p-3 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                Check your email for a password reset link.
              </div>
              <Link href="/login" className="block text-xs text-ink-muted hover:text-accent transition-colors">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
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
                className="w-full rounded-lg bg-ink text-surface font-medium text-sm px-4 py-3 hover:bg-accent transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
              <Link href="/login" className="block text-center text-xs text-ink-muted hover:text-accent transition-colors pt-1">
                Back to sign in
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

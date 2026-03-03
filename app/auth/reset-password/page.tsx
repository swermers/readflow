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
      redirectTo: `${window.location.origin}/auth/update-password`,
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
      <div className="w-full max-w-sm text-center">
        <div className="inline-block h-1 w-10 bg-accent mb-8" />
        <h1 className="text-2xl font-bold tracking-tight text-ink mb-2">Reset password</h1>
        <p className="text-ink-muted mb-8 text-sm">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>

        {error && (
          <div className="mb-4 p-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {sent ? (
          <div className="space-y-4">
            <div className="p-3 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              Check your email for a password reset link.
            </div>
            <Link href="/login" className="text-xs text-ink-muted hover:text-ink">
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
              className="w-full bg-surface border border-line text-ink text-sm p-3 focus:outline-none focus:border-accent placeholder:text-ink-faint"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-surface font-medium text-sm p-3.5 hover:bg-accent transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
            <Link href="/login" className="block text-xs text-ink-muted hover:text-ink mt-4">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}

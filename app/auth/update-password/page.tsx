'use client';

import { createClient } from '@/utils/supabase/client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    // Supabase will set the session from the recovery link's hash fragment
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
    } else {
      router.replace('/briefing');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-6">
      <div className="w-full max-w-sm text-center">
        <div className="inline-block h-1 w-10 bg-accent mb-8" />
        <h1 className="text-2xl font-bold tracking-tight text-ink mb-2">Set new password</h1>
        <p className="text-ink-muted mb-8 text-sm">
          Choose a new password for your account.
        </p>

        {error && (
          <div className="mb-4 p-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {!ready ? (
          <p className="text-sm text-ink-muted">Verifying your reset link...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-surface border border-line text-ink text-sm p-3 focus:outline-none focus:border-accent placeholder:text-ink-faint"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-surface border border-line text-ink text-sm p-3 focus:outline-none focus:border-accent placeholder:text-ink-faint"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-surface font-medium text-sm p-3.5 hover:bg-accent transition-colors disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

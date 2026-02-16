'use client';

import { useEffect, useState, Suspense } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User, Mail, LogOut, Loader2, Save, ExternalLink, ArrowRight, RefreshCw, AlertTriangle, Settings } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { triggerToast } from '@/components/Toast';
import { useRouter, useSearchParams } from 'next/navigation';

function SettingsContent() {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    loadProfile();
    handleGmailCallbackResult();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setEmail(user.email || '');

    // Load base profile fields (always present)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('id', user.id)
      .single();

    if (profile) {
      setFirstName(profile.first_name || user.user_metadata?.full_name?.split(' ')[0] || '');
      setLastName(profile.last_name || user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '');

      // Gmail columns may not exist if migration 002 hasn't been run
      const { data: gmailProfile } = await supabase
        .from('profiles')
        .select('gmail_connected, gmail_last_sync_at')
        .eq('id', user.id)
        .single();

      if (gmailProfile) {
        setGmailConnected(gmailProfile.gmail_connected || false);
        if (gmailProfile.gmail_last_sync_at) {
          setLastSync(new Date(gmailProfile.gmail_last_sync_at));
        }
      }
    } else {
      const fullName = user.user_metadata?.full_name || '';
      setFirstName(fullName.split(' ')[0] || '');
      setLastName(fullName.split(' ').slice(1).join(' ') || '');
    }

    setLoading(false);
  };

  const handleGmailCallbackResult = () => {
    const gmailResult = searchParams.get('gmail');
    if (!gmailResult) return;

    // Read error detail BEFORE cleaning the URL
    const errorDetail = searchParams.get('gmail_error');

    // Clean the URL to prevent re-showing on refresh
    const url = new URL(window.location.href);
    url.searchParams.delete('gmail');
    url.searchParams.delete('gmail_error');
    window.history.replaceState({}, '', url.pathname);

    switch (gmailResult) {
      case 'connected':
        setGmailConnected(true);
        triggerToast('Gmail connected successfully! Click "Sync Now" to import newsletters.');
        // Reload profile to get the latest gmail state
        loadProfile();
        break;
      case 'no_tokens':
        setGmailError(
          'Gmail connection failed — no access tokens were received. ' +
          'This usually means the Gmail API is not enabled in your Google Cloud Console, ' +
          'or the gmail.readonly scope is not configured on the OAuth consent screen.'
        );
        triggerToast('Gmail connection failed — see error details below');
        break;
      case 'error': {
        const isMigrationError = errorDetail?.includes('migration required') || errorDetail?.includes('schema cache');
        const isTokenError = errorDetail?.includes('No provider tokens');
        setGmailError(
          errorDetail || 'Gmail connection failed. The OAuth flow did not complete successfully.'
        );
        triggerToast(
          isMigrationError ? 'Database migration required — see details below' :
          isTokenError ? 'Supabase config issue — see details below' :
          'Gmail connection failed — see details below'
        );
        break;
      }
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, email: user.email, first_name: firstName, last_name: lastName });

    if (error) {
      console.error('Error saving profile:', error);
      triggerToast('Error saving profile');
    } else {
      triggerToast('Profile saved');
    }
    setSaving(false);
  };

  const handleConnectGmail = async () => {
    setConnecting(true);
    setGmailError(null);

    const redirectUrl = `${window.location.origin}/auth/callback?next=/settings`;

    const { error } = await supabase.auth.signInWithOAuth({
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

    if (error) {
      setConnecting(false);
      setGmailError(`Failed to start Gmail connection: ${error.message}`);
      triggerToast('Failed to start Gmail connection');
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync-gmail', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        triggerToast(data.error || 'Sync failed');
        if (res.status === 401 && data.error?.includes('expired')) {
          setGmailConnected(false);
        }
      } else {
        triggerToast(data.message || `Imported ${data.imported} newsletters`);
        setLastSync(new Date());
        await loadProfile();
      }
    } catch (err) {
      console.error('Sync error:', err);
      triggerToast('Sync failed');
    }
    setSyncing(false);
  };

  const handleDisconnectGmail = async () => {
    if (!confirm('Disconnect Gmail? You will need to reconnect to sync newsletters.')) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('profiles')
      .update({
        gmail_connected: false,
        gmail_access_token: null,
        gmail_refresh_token: null,
        gmail_token_expires_at: null,
      })
      .eq('id', user.id);

    setGmailConnected(false);
    triggerToast('Gmail disconnected');
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure? This will sign you out and your data may be deleted. This action cannot be undone.')) return;
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="p-12 text-ink-muted flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading settings...
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 min-h-screen max-w-4xl">

      {/* Header */}
      <header className="mb-10">
        <h1 className="text-display-lg text-ink">Control Room.</h1>
        <p className="text-sm text-ink-muted mt-1">Preferences &amp; Gmail Connection.</p>
      </header>

      <div className="h-px bg-line-strong mb-12" />

      <div className="space-y-16">

        {/* ─── Profile Section ─── */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-4">
            <h3 className="font-bold text-lg text-ink flex items-center gap-2">
              <User className="w-5 h-5 text-ink-faint" />
              Profile
            </h3>
            <p className="text-sm text-ink-faint mt-1">How you appear in the app.</p>
          </div>
          <div className="md:col-span-8 space-y-6 bg-surface-raised p-6 border border-line">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-label uppercase text-ink-faint">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full border-b border-line py-2 text-ink bg-transparent focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-label uppercase text-ink-faint">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full border-b border-line py-2 text-ink bg-transparent focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-label uppercase text-ink-faint">Email Address</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full border-b border-line py-2 text-ink-faint bg-transparent cursor-not-allowed"
              />
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="flex items-center gap-2 text-label uppercase bg-ink text-surface px-6 py-3 hover:bg-accent transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save Changes
            </button>
          </div>
        </section>

        {/* ─── Gmail Sync Manager ─── */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-12 border-t border-line">
          <div className="md:col-span-4">
            <h3 className="font-bold text-lg text-ink flex items-center gap-2">
              <Mail className="w-5 h-5 text-ink-faint" />
              Sync Manager
            </h3>
            <p className="text-sm text-ink-faint mt-1">Connect and sync Gmail labels.</p>
          </div>
          <div className="md:col-span-8 bg-surface-raised border border-line">
            <div className="p-6 space-y-6">
              {gmailConnected ? (
                <>
                  {/* Connected state */}
                  <div className="flex items-center justify-between pb-4 border-b border-line">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-sm font-bold text-ink">Gmail Connected</span>
                    </div>
                    <button
                      onClick={handleDisconnectGmail}
                      className="text-xs text-ink-faint hover:text-accent transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>

                  {/* Sync button */}
                  <div className="space-y-3">
                    <button
                      onClick={handleSyncNow}
                      disabled={syncing}
                      className="flex items-center gap-2 text-label uppercase bg-ink text-surface px-6 py-3 hover:bg-accent transition-colors disabled:opacity-50 w-full justify-center"
                    >
                      {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      {syncing ? 'Syncing...' : 'Sync Now'}
                    </button>

                    {lastSync && (
                      <p className="text-xs text-ink-faint text-center">
                        Last synced {formatDistanceToNow(lastSync, { addSuffix: true })}
                      </p>
                    )}
                  </div>

                  {/* Setup instructions */}
                  <div className="pt-4 border-t border-line space-y-3">
                    <label className="text-label uppercase text-ink-faint">Gmail Setup</label>
                    <details className="group border border-line">
                      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium text-ink hover:bg-surface-overlay">
                        <span>How to sync newsletters</span>
                        <ArrowRight className="w-4 h-4 text-ink-faint group-open:rotate-90 transition-transform" />
                      </summary>
                      <div className="px-4 pb-4 text-sm text-ink-muted space-y-2">
                        <ol className="list-decimal list-inside space-y-1.5">
                          <li>In Gmail, go to <a href="https://mail.google.com/mail/u/0/#settings/labels" target="_blank" rel="noopener noreferrer" className="text-accent underline inline-flex items-center gap-0.5">Settings &rarr; Labels <ExternalLink className="w-3 h-3" /></a></li>
                          <li>Create a new label called &quot;Readflow&quot;</li>
                          <li>Go to <a href="https://mail.google.com/mail/u/0/#settings/filters" target="_blank" rel="noopener noreferrer" className="text-accent underline inline-flex items-center gap-0.5">Settings &rarr; Filters <ExternalLink className="w-3 h-3" /></a></li>
                          <li>Create a filter: &quot;From&quot; contains your newsletter sender</li>
                          <li>Action: Apply label &quot;Readflow&quot;</li>
                          <li>Click &quot;Sync Now&quot; above to import</li>
                        </ol>
                      </div>
                    </details>
                  </div>
                </>
              ) : (
                <>
                  {/* Not connected state */}
                  <div className="text-center py-8">
                    <Mail className="w-10 h-10 text-ink-faint mx-auto mb-4" />
                    <p className="text-sm font-bold text-ink mb-1">Connect Gmail to sync newsletters</p>
                    <p className="text-xs text-ink-faint mb-6">
                      Read-only access. We only see emails you label &quot;Readflow&quot;.
                    </p>

                    {gmailError && (
                      <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-left">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <div className="space-y-2">
                            <p className="text-sm text-red-700 dark:text-red-400">{gmailError}</p>
                            <details open className="text-xs text-red-600 dark:text-red-400">
                              <summary className="cursor-pointer font-medium hover:text-red-800 dark:hover:text-red-300">
                                How to fix this
                              </summary>
                              {gmailError?.includes('migration required') || gmailError?.includes('schema cache') ? (
                                <ol className="list-decimal list-inside mt-2 space-y-1">
                                  <li>Open your <strong>Supabase project dashboard</strong> &rarr; SQL Editor</li>
                                  <li>Run the contents of <code className="bg-red-100 dark:bg-red-900/40 px-1">supabase/migrations/002_add_gmail_tokens.sql</code></li>
                                  <li>This adds the required Gmail token columns to the profiles table</li>
                                  <li>Come back here and click &quot;Connect Gmail&quot; again</li>
                                </ol>
                              ) : gmailError?.includes('provider tokens') || gmailError?.includes('no access tokens') ? (
                                <div className="mt-2 space-y-3">
                                  <p className="font-medium">Supabase is not returning Google OAuth tokens. Fix this in your Supabase Dashboard:</p>
                                  <ol className="list-decimal list-inside space-y-1.5">
                                    <li>Go to <strong>Supabase Dashboard</strong> &rarr; Authentication &rarr; Providers &rarr; Google</li>
                                    <li>Make sure <strong>both Client ID and Client Secret</strong> are filled in</li>
                                    <li>The Client Secret comes from <strong>Google Cloud Console</strong> &rarr; APIs &amp; Services &rarr; Credentials &rarr; your OAuth 2.0 Client ID</li>
                                    <li>Also verify the <strong>Authorized redirect URI</strong> in Google Cloud Console is set to:<br />
                                      <code className="bg-red-100 dark:bg-red-900/40 px-1 break-all">https://&lt;your-project-ref&gt;.supabase.co/auth/v1/callback</code>
                                    </li>
                                    <li>Make sure you are using the traditional <strong>&quot;OAuth 2.0&quot;</strong> config (not &quot;Sign in with Google&quot; / Google Identity Services which does not return API tokens)</li>
                                  </ol>
                                  <p className="mt-2 text-red-500 dark:text-red-300 font-medium">
                                    Key: If you only entered a Client ID (no Secret) in Supabase, that is the &quot;Sign in with Google&quot; mode which cannot access Gmail. You need to also add the Client Secret.
                                  </p>
                                </div>
                              ) : (
                                <ol className="list-decimal list-inside mt-2 space-y-1">
                                  <li>Go to <strong>Google Cloud Console</strong> &rarr; APIs &amp; Services &rarr; Library</li>
                                  <li>Search for &quot;Gmail API&quot; and <strong>enable</strong> it</li>
                                  <li>Go to OAuth consent screen &rarr; Edit &rarr; Add scopes</li>
                                  <li>Use &quot;Manually add scopes&quot; and enter: <code className="bg-red-100 dark:bg-red-900/40 px-1">https://www.googleapis.com/auth/gmail.readonly</code></li>
                                  <li>Save and try connecting again</li>
                                </ol>
                              )}
                            </details>
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleConnectGmail}
                      disabled={connecting}
                      className="flex items-center gap-2 text-label uppercase bg-ink text-surface px-6 py-3 hover:bg-accent transition-colors mx-auto disabled:opacity-50"
                    >
                      {connecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                      {connecting ? 'Connecting...' : 'Connect Gmail'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ─── Danger Zone ─── */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-12 border-t border-line">
          <div className="md:col-span-4">
            <h3 className="font-bold text-lg text-accent flex items-center gap-2">
              <LogOut className="w-5 h-5" />
              Danger Zone
            </h3>
          </div>
          <div className="md:col-span-8">
            <button
              onClick={handleDeleteAccount}
              className="px-6 py-3 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-accent text-label uppercase hover:bg-accent hover:text-white transition-colors"
            >
              Disconnect &amp; Delete Data
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-ink-muted flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading settings...
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}

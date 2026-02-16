'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User, Mail, LogOut, Loader2, Save, RefreshCw, AlertTriangle, Tag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { triggerToast } from '@/components/Toast';
import { useRouter, useSearchParams } from 'next/navigation';

interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
}

function SettingsContent() {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  // Labels
  const [labels, setLabels] = useState<GmailLabel[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [labelsLoading, setLabelsLoading] = useState(false);
  const [labelsSaving, setLabelsSaving] = useState(false);

  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setEmail(user.email || '');

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
        .select('gmail_connected, gmail_last_sync_at, gmail_sync_labels')
        .eq('id', user.id)
        .single();

      if (gmailProfile) {
        setGmailConnected(gmailProfile.gmail_connected || false);
        setSelectedLabels(gmailProfile.gmail_sync_labels || []);
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
  }, [supabase]);

  useEffect(() => {
    loadProfile();
    handleGmailCallbackResult();
  }, []);

  // Fetch labels when gmail becomes connected
  useEffect(() => {
    if (gmailConnected) {
      fetchLabels();
    }
  }, [gmailConnected]);

  const handleGmailCallbackResult = () => {
    const gmailResult = searchParams.get('gmail');
    if (!gmailResult) return;

    const errorDetail = searchParams.get('gmail_error');

    const url = new URL(window.location.href);
    url.searchParams.delete('gmail');
    url.searchParams.delete('gmail_error');
    window.history.replaceState({}, '', url.pathname);

    switch (gmailResult) {
      case 'connected':
        setGmailConnected(true);
        triggerToast('Gmail connected successfully!');
        loadProfile();
        break;
      case 'error': {
        setGmailError(
          errorDetail || 'Gmail connection failed. The OAuth flow did not complete successfully.'
        );
        triggerToast('Gmail connection issue — see details below');
        break;
      }
    }
  };

  const fetchLabels = async () => {
    setLabelsLoading(true);
    try {
      const res = await fetch('/api/gmail-labels');
      const data = await res.json();
      if (res.ok && data.labels) {
        setLabels(data.labels);
      } else if (res.status === 401) {
        setGmailConnected(false);
        setGmailError('Gmail session expired. Please sign out and sign back in.');
      }
    } catch {
      console.error('Failed to fetch labels');
    }
    setLabelsLoading(false);
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabels(prev =>
      prev.includes(labelId)
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  const handleSaveLabels = async () => {
    setLabelsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLabelsSaving(false); return; }

    const { error } = await supabase
      .from('profiles')
      .update({ gmail_sync_labels: selectedLabels })
      .eq('id', user.id);

    if (error) {
      console.error('Error saving labels:', error);
      triggerToast('Error saving label preferences');
    } else {
      triggerToast('Label preferences saved');
    }
    setLabelsSaving(false);
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

  const handleReconnectGmail = async () => {
    setGmailError(null);
    // Sign out + re-auth to get fresh provider tokens
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
        scopes: 'https://www.googleapis.com/auth/gmail.readonly',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) {
      setGmailError(`Failed to start reconnection: ${error.message}`);
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
    if (!confirm('Disconnect Gmail? You will need to sign out and back in to reconnect.')) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('profiles')
      .update({
        gmail_connected: false,
        gmail_access_token: null,
        gmail_refresh_token: null,
        gmail_token_expires_at: null,
        gmail_sync_labels: [],
      })
      .eq('id', user.id);

    setGmailConnected(false);
    setLabels([]);
    setSelectedLabels([]);
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
        <p className="text-sm text-ink-muted mt-1">Preferences &amp; Gmail sync.</p>
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
            <p className="text-sm text-ink-faint mt-1">
              {gmailConnected
                ? 'Choose which labels to sync and import newsletters.'
                : 'Gmail access is needed to sync newsletters.'}
            </p>
          </div>
          <div className="md:col-span-8 bg-surface-raised border border-line">
            <div className="p-6 space-y-6">
              {gmailConnected ? (
                <>
                  {/* Connected header */}
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

                  {/* Label selection */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-label uppercase text-ink-faint flex items-center gap-1.5">
                        <Tag className="w-3 h-3" />
                        Labels to Sync
                      </label>
                      {labels.length > 0 && (
                        <button
                          onClick={fetchLabels}
                          disabled={labelsLoading}
                          className="text-xs text-ink-faint hover:text-ink transition-colors flex items-center gap-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${labelsLoading ? 'animate-spin' : ''}`} />
                          Refresh
                        </button>
                      )}
                    </div>

                    {labelsLoading && labels.length === 0 ? (
                      <div className="flex items-center gap-2 text-sm text-ink-muted py-4">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading labels from Gmail...
                      </div>
                    ) : labels.length > 0 ? (
                      <div className="space-y-1">
                        {labels.map(label => (
                          <label
                            key={label.id}
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-overlay cursor-pointer transition-colors border border-transparent hover:border-line"
                          >
                            <input
                              type="checkbox"
                              checked={selectedLabels.includes(label.id)}
                              onChange={() => toggleLabel(label.id)}
                              className="w-4 h-4 accent-accent"
                            />
                            <span className="text-sm text-ink flex-1">{label.name}</span>
                            {label.type === 'system' && (
                              <span className="text-[10px] text-ink-faint uppercase tracking-wider">System</span>
                            )}
                          </label>
                        ))}
                        <button
                          onClick={handleSaveLabels}
                          disabled={labelsSaving}
                          className="flex items-center gap-2 text-label uppercase bg-ink text-surface px-5 py-2.5 hover:bg-accent transition-colors disabled:opacity-50 mt-3"
                        >
                          {labelsSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          Save Labels
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-ink-faint py-2">
                        No labels found. Create labels in Gmail to organize your newsletters.
                      </p>
                    )}
                  </div>

                  {/* Sync button */}
                  <div className="space-y-3 pt-4 border-t border-line">
                    <button
                      onClick={handleSyncNow}
                      disabled={syncing || selectedLabels.length === 0}
                      className="flex items-center gap-2 text-label uppercase bg-ink text-surface px-6 py-3 hover:bg-accent transition-colors disabled:opacity-50 w-full justify-center"
                    >
                      {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      {syncing ? 'Syncing...' : 'Sync Now'}
                    </button>

                    {selectedLabels.length === 0 && (
                      <p className="text-xs text-ink-faint text-center">
                        Select at least one label above to enable syncing.
                      </p>
                    )}

                    {lastSync && (
                      <p className="text-xs text-ink-faint text-center">
                        Last synced {formatDistanceToNow(lastSync, { addSuffix: true })}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Not connected state */}
                  <div className="text-center py-8">
                    <Mail className="w-10 h-10 text-ink-faint mx-auto mb-4" />
                    <p className="text-sm font-bold text-ink mb-1">Gmail access required</p>
                    <p className="text-xs text-ink-faint mb-6">
                      Sign out and sign back in to grant Gmail read-only access, or click below.
                    </p>

                    {gmailError && (
                      <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-left">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-red-700 dark:text-red-400">{gmailError}</p>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleReconnectGmail}
                      className="flex items-center gap-2 text-label uppercase bg-ink text-surface px-6 py-3 hover:bg-accent transition-colors mx-auto"
                    >
                      <Mail className="w-3 h-3" />
                      Grant Gmail Access
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

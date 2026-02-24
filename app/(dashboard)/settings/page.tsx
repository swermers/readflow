'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User, Mail, LogOut, Loader2, Save, RefreshCw, AlertTriangle, Tag, CalendarClock, Wallet, ArrowDownRight, ArrowUpRight, Trash2, ShieldAlert, ChevronDown, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { triggerToast } from '@/components/Toast';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
}

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const FREE_TIER_SOURCE_LIMIT = 5;


function parseJson<T>(raw: string): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
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
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [planTier, setPlanTier] = useState<'free' | 'pro' | 'elite'>('free');
  const [tokenBalance, setTokenBalance] = useState(0);
  const [unlimitedAiAccess, setUnlimitedAiAccess] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [redeemingCode, setRedeemingCode] = useState(false);
  const [purchasingPack, setPurchasingPack] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Array<{
    id: string; amount: number; type: string; description: string | null;
    balance_after: number; created_at: string;
  }>>([]);
  const [briefDeliveryDays, setBriefDeliveryDays] = useState<number[]>([1]);
  const [briefDeliveryHour, setBriefDeliveryHour] = useState(9);
  const [briefDeliveryTz, setBriefDeliveryTz] = useState('UTC');
  const [savingBriefPrefs, setSavingBriefPrefs] = useState(false);
  const [hasPromptedTopFive, setHasPromptedTopFive] = useState(false);

  const supabase = createClient();
  const isFreeTierSourceLimited = false; // Pay-per-use: no source limit
  const router = useRouter();
  const searchParams = useSearchParams();

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setEmail(user.email || '');

    // Use full_name (the actual DB column) — split into first/last for display
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', user.id)
      .single();

    const fullNameRaw = profile?.full_name || user.user_metadata?.full_name || '';
    setFirstName(fullNameRaw.split(' ')[0] || '');
    setLastName(fullNameRaw.split(' ').slice(1).join(' ') || '');

    // Gmail + plan fields (only columns that exist in the DB schema)
    const { data: gmailProfile } = await supabase
      .from('profiles')
      .select('gmail_connected, gmail_last_sync_at, gmail_sync_labels, plan_tier, unlimited_ai_access')
      .eq('id', user.id)
      .single();

    if (gmailProfile) {
      setGmailConnected(gmailProfile.gmail_connected || false);
      setSelectedLabels(gmailProfile.gmail_sync_labels || []);
      if (gmailProfile.gmail_last_sync_at) {
        setLastSync(new Date(gmailProfile.gmail_last_sync_at));
      }
      setPlanTier((gmailProfile.plan_tier || 'free') as 'free' | 'pro' | 'elite');
      setUnlimitedAiAccess(Boolean(gmailProfile.unlimited_ai_access));
    }

    // Brief schedule
    const { data: briefPrefs } = await supabase
      .from('profiles')
      .select('brief_delivery_days, brief_delivery_hour, brief_delivery_tz')
      .eq('id', user.id)
      .maybeSingle<{
        brief_delivery_days: number[] | null;
        brief_delivery_hour: number | null;
        brief_delivery_tz: string | null;
      }>();

    if (briefPrefs) {
      setBriefDeliveryDays(
        Array.isArray(briefPrefs.brief_delivery_days) && briefPrefs.brief_delivery_days.length
          ? briefPrefs.brief_delivery_days.map((day) => Number(day))
          : [1],
      );
      setBriefDeliveryHour(Number.isFinite(Number(briefPrefs.brief_delivery_hour)) ? Number(briefPrefs.brief_delivery_hour) : 9);
      setBriefDeliveryTz(briefPrefs.brief_delivery_tz || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    }

    setLoading(false);
  }, [supabase]);

  const refreshAiUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/profile/ai-usage', { cache: 'no-store' });
      if (!res.ok) return;
      const payload = await res.json();
      setPlanTier((payload.planTier || 'free') as 'free' | 'pro' | 'elite');
      setTokenBalance(payload.tokenBalance ?? 0);
      setUnlimitedAiAccess(Boolean(payload.unlimitedAiAccess));
    } catch {
      // best effort
    }
  }, []);

  const refreshTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/transactions?limit=10', { cache: 'no-store' });
      if (!res.ok) return;
      const payload = await res.json();
      setTransactions(payload.transactions || []);
      if (typeof payload.balance === 'number') setTokenBalance(payload.balance);
    } catch {
      // best effort
    }
  }, []);

  const handleBuyTokens = async (packId: string) => {
    setPurchasingPack(packId);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        triggerToast(data.error || 'Could not start checkout');
      }
    } catch {
      triggerToast('Could not start checkout');
    } finally {
      setPurchasingPack(null);
    }
  };

  const redeemInviteCode = async () => {
    if (!inviteCode.trim()) return;
    setRedeemingCode(true);
    try {
      const res = await fetch('/api/profile/redeem-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode.trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        triggerToast(body?.error || 'Could not redeem code');
        return;
      }
      triggerToast(body?.message || 'Code redeemed');
      setInviteCode('');
      await refreshAiUsage();
      await loadProfile();
    } catch {
      triggerToast('Could not redeem code');
    } finally {
      setRedeemingCode(false);
    }
  };


  useEffect(() => {
    loadProfile();
    handleGmailCallbackResult();
    handlePurchaseResult();
    void refreshAiUsage();
    void refreshTransactions();
  }, []);

  const handlePurchaseResult = () => {
    const purchaseResult = searchParams.get('purchase');
    const tokensAdded = searchParams.get('tokens');
    if (!purchaseResult) return;

    const url = new URL(window.location.href);
    url.searchParams.delete('purchase');
    url.searchParams.delete('tokens');
    window.history.replaceState({}, '', url.pathname);

    if (purchaseResult === 'success') {
      triggerToast(`${tokensAdded || ''} tokens added to your wallet!`);
      void refreshAiUsage();
      void refreshTransactions();
    } else if (purchaseResult === 'canceled') {
      triggerToast('Purchase canceled');
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      void refreshAiUsage();
    }, 15000);

    const onFocus = () => {
      void refreshAiUsage();
    };

    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshAiUsage]);

  // When gmail appears disconnected, check if tokens are actually valid and auto-restore
  useEffect(() => {
    if (loading) return; // wait for profile to load first
    if (gmailConnected) {
      fetchLabels();
      return;
    }
    // gmail_connected is false — try to self-heal
    const checkGmail = async () => {
      try {
        const res = await fetch('/api/gmail-check');
        const data = await res.json();
        if (data.connected) {
          setGmailConnected(true);
          // fetchLabels will be triggered by the state change above
        }
      } catch {
        // silent — user can still click reconnect manually
      }
    };
    checkGmail();
  }, [gmailConnected, loading]);

  useEffect(() => {
    if (!gmailConnected || labelsLoading || labels.length === 0 || !isFreeTierSourceLimited) return;

    if (selectedLabels.length > FREE_TIER_SOURCE_LIMIT) {
      setSelectedLabels((prev) => prev.slice(0, FREE_TIER_SOURCE_LIMIT));
      triggerToast('Free tier supports up to 5 labels. Keep your top 5 active sources or upgrade for unlimited.');
      return;
    }

    if (!hasPromptedTopFive) {
      window.alert('Free tier includes up to 5 active sources. Please choose your top 5 labels to sync.');
      setHasPromptedTopFive(true);
    }
  }, [
    gmailConnected,
    hasPromptedTopFive,
    isFreeTierSourceLimited,
    labels.length,
    labelsLoading,
    selectedLabels.length,
  ]);

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

  const fetchLabels = async (retries = 1) => {
    setLabelsLoading(true);
    try {
      const res = await fetch('/api/gmail-labels');
      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* empty */ }

      if (res.ok && Array.isArray(data.labels)) {
        setLabels(data.labels as GmailLabel[]);
        setGmailError(null);
      } else if (res.status === 401 && data.code === 'TOKEN_REVOKED') {
        // Only disconnect when Google permanently revoked the token
        setGmailConnected(false);
        setGmailError('Gmail access was revoked. Please reconnect below.');
      } else if ((res.status === 502 || res.status >= 500) && retries > 0) {
        // Transient error — retry once after a short delay
        await new Promise(r => setTimeout(r, 2000));
        setLabelsLoading(false);
        return fetchLabels(retries - 1);
      } else if (!res.ok) {
        // Non-fatal error — show message but keep connected state
        console.error('Label fetch error:', data.error);
      }
    } catch {
      console.error('Failed to fetch labels (network)');
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 2000));
        setLabelsLoading(false);
        return fetchLabels(retries - 1);
      }
    }
    setLabelsLoading(false);
  };

  const saveLabelsToDb = async (labelsToSave: string[]) => {
    setLabelsSaving(true);
    try {
      const res = await fetch('/api/gmail-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels: labelsToSave }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('Error saving labels:', res.status, data);
        triggerToast(data.error || `Error saving labels (${res.status})`);
      }
    } catch (err) {
      console.error('Network error saving labels:', err);
      triggerToast('Network error saving labels');
    }
    setLabelsSaving(false);
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabels((prev) => {
      let next: string[];
      if (prev.includes(labelId)) {
        next = prev.filter((id) => id !== labelId);
      } else {
        if (isFreeTierSourceLimited && prev.length >= FREE_TIER_SOURCE_LIMIT) {
          window.alert('Free tier supports up to 5 active sources. Upgrade to unlimited to sync more labels.');
          return prev;
        }
        next = [...prev, labelId];
      }

      // Auto-save via server API (fire-and-forget from state setter)
      void saveLabelsToDb(next);
      return next;
    });
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('Profile save error:', res.status, data);
        triggerToast(data.error || `Error saving profile (${res.status})`);
      } else {
        triggerToast('Profile saved');
      }
    } catch (err) {
      console.error('Profile save network error:', err);
      triggerToast('Network error saving profile');
    }
    setSaving(false);
  };

  const toggleBriefDay = (day: number) => {
    setBriefDeliveryDays((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
      return next.length ? next.sort((a, b) => a - b) : [1];
    });
  };

  const handleUseLocalTimezone = async () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    setBriefDeliveryTz(tz);
    const hour = Math.max(0, Math.min(23, Math.floor(briefDeliveryHour || 0)));
    const days = briefDeliveryDays.length ? briefDeliveryDays : [1];
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief_delivery_days: days, brief_delivery_hour: hour, brief_delivery_tz: tz }),
      });
      if (res.ok) {
        triggerToast('Timezone set and schedule saved');
      }
    } catch {
      // silent
    }
  };

  const handleSaveBriefPreferences = async () => {
    setSavingBriefPrefs(true);
    const hour = Math.max(0, Math.min(23, Math.floor(briefDeliveryHour || 0)));
    const days = briefDeliveryDays.length ? briefDeliveryDays : [1];

    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief_delivery_days: days,
          brief_delivery_hour: hour,
          brief_delivery_tz: (briefDeliveryTz || 'UTC').trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error('Brief schedule save error:', res.status, data);
        triggerToast(data.error || `Could not save brief schedule (${res.status})`);
      } else {
        setBriefDeliveryHour(hour);
        triggerToast('Brief schedule saved');
      }
    } catch (err) {
      console.error('Brief schedule save network error:', err);
      triggerToast('Could not save brief schedule');
    }

    setSavingBriefPrefs(false);
  };


  const handleReconnectGmail = async () => {
    setGmailError(null);
    // Re-link Google without signing out — preserves the session
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
      const res = await fetch('/api/sync-gmail', { cache: 'no-store' });

      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        const errorMsg = (data.error as string) || 'Sync failed. Check that Gmail is connected and labels are selected.';
        triggerToast(errorMsg);
        if (data.code === 'TOKEN_REVOKED') {
          setGmailConnected(false);
          setGmailError('Gmail access was revoked. Please reconnect below.');
        }
      } else {
        triggerToast((data.message as string) || `Imported ${data.imported} newsletters`);
        if (data.warning) {
          triggerToast(data.warning as string);
        }
        if (data.debug) {
          console.log('[Settings Sync] Debug:', JSON.stringify(data.debug));
        }
        setLastSync(new Date());
        await loadProfile();
      }
    } catch (err) {
      console.error('Sync error:', err);
      triggerToast('Network error. Check your connection and try again.');
    }
    setSyncing(false);
  };

  const handleDisconnectGmail = async () => {
    if (!confirm('Disconnect Gmail? This will remove your Gmail tokens and sync labels. You will need to re-authorize through onboarding to reconnect.')) return;

    try {
      const res = await fetch('/api/account/disconnect-gmail', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        triggerToast(data.error || 'Failed to disconnect Gmail');
        return;
      }
    } catch {
      triggerToast('Network error disconnecting Gmail');
      return;
    }

    setGmailConnected(false);
    setLabels([]);
    setSelectedLabels([]);
    setLastSync(null);
    triggerToast('Gmail disconnected. Go through onboarding to reconnect.');
  };

  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'deleting'>('idle');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleDeleteAccount = async () => {
    if (deleteStep === 'idle') {
      setDeleteStep('confirm');
      return;
    }

    if (deleteStep !== 'confirm' || deleteConfirmText !== 'DELETE') return;

    setDeleteStep('deleting');

    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        triggerToast(data.error || 'Could not delete data. Please try again.');
        setDeleteStep('idle');
        return;
      }

      triggerToast('All data deleted. Signing you out.');
      await supabase.auth.signOut();
      router.push('/login');
    } catch (err) {
      console.error('Delete error:', err);
      triggerToast('Could not fully delete data. Please try again.');
      setDeleteStep('idle');
    }
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

      <section className="mb-10 rounded-2xl border border-line bg-surface-raised p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-ink-faint">Organization</p>
            <h2 className="text-lg font-bold text-ink">Manage Sources</h2>
            <p className="mt-1 text-sm text-ink-muted">Source subscriptions are now tucked into Settings to keep navigation cleaner.</p>
          </div>
          <Link
            href="/subscriptions"
            className="inline-flex items-center justify-center border border-line px-4 py-2 text-label uppercase text-ink hover:border-line-strong"
          >
            Open Sources
          </Link>
        </div>
      </section>

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
          <div className="md:col-span-8 space-y-6 rounded-2xl bg-surface-raised p-6 border border-line">
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


        {/* ─── Token Wallet ─── */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-12 border-t border-line">
          <div className="md:col-span-4">
            <h3 className="font-bold text-lg text-ink flex items-center gap-2">
              <Wallet className="w-5 h-5 text-ink-faint" />
              Token Wallet
            </h3>
            <p className="text-sm text-ink-faint mt-1">Pay per use. Buy tokens, use them anytime.</p>
          </div>
          <div className="md:col-span-8 rounded-2xl bg-surface-raised border border-line p-6 space-y-6">

            {/* Balance display */}
            <div className="border border-line p-6 text-center">
              <p className="text-label uppercase text-ink-faint">Token Balance</p>
              <p className="mt-2 text-4xl font-bold text-ink">
                {unlimitedAiAccess ? 'Unlimited' : tokenBalance.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-ink-faint">
                {unlimitedAiAccess
                  ? 'Unlimited access is active for this account.'
                  : 'TL;DR = 5, Audio Digest = 10, Brief = 10, Podcast = 15 tokens'}
              </p>
            </div>

            {/* Token packs */}
            {!unlimitedAiAccess && (
              <div>
                <p className="text-label uppercase text-ink-faint mb-3">Buy Tokens</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'starter', name: 'Starter', tokens: 100, price: '$4', per: '$0.04/token' },
                    { id: 'standard', name: 'Standard', tokens: 500, price: '$12', per: '$0.024/token', badge: 'Best Value' },
                    { id: 'power', name: 'Power', tokens: 1500, price: '$29', per: '$0.019/token' },
                  ].map((pack) => (
                    <button
                      key={pack.id}
                      onClick={() => handleBuyTokens(pack.id)}
                      disabled={purchasingPack !== null}
                      className={`relative border p-4 text-left transition-all hover:border-accent hover:shadow-sm disabled:opacity-60 ${
                        pack.badge ? 'border-accent bg-accent/5' : 'border-line'
                      }`}
                    >
                      {pack.badge && (
                        <span className="absolute -top-2.5 right-3 rounded-full border border-accent/30 bg-surface px-2 py-0.5 text-[10px] text-accent">
                          {pack.badge}
                        </span>
                      )}
                      <p className="text-sm font-bold text-ink">{pack.name}</p>
                      <p className="text-2xl font-bold text-ink mt-1">{pack.price}</p>
                      <p className="text-xs text-ink-faint">{pack.tokens} tokens</p>
                      <p className="text-[10px] text-ink-faint mt-0.5">{pack.per}</p>
                      {purchasingPack === pack.id && (
                        <Loader2 className="w-4 h-4 animate-spin absolute top-3 right-3 text-ink-faint" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recent transactions */}
            {transactions.length > 0 && (
              <div>
                <p className="text-label uppercase text-ink-faint mb-3">Recent Activity</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {transactions.slice(0, 8).map((txn) => (
                    <div key={txn.id} className="flex items-center justify-between py-2 px-2 text-sm border-b border-line last:border-0">
                      <div className="flex items-center gap-2">
                        {txn.amount > 0 ? (
                          <ArrowDownRight className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-ink-faint" />
                        )}
                        <span className="text-ink-muted truncate max-w-[200px]">
                          {txn.description || txn.type}
                        </span>
                      </div>
                      <span className={`font-mono text-xs ${txn.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-ink-faint'}`}>
                        {txn.amount > 0 ? '+' : ''}{txn.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Redeem code */}
            <div className="border-t border-line pt-4">
              <label className="text-label uppercase text-ink-faint">Redeem Code</label>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Enter access code"
                  className="flex-1 border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
                />
                <button
                  onClick={redeemInviteCode}
                  disabled={redeemingCode || !inviteCode.trim()}
                  className="px-4 py-2 bg-ink text-surface text-label uppercase disabled:opacity-50 hover:bg-accent transition-colors"
                >
                  {redeemingCode ? 'Redeeming...' : 'Redeem'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-12 border-t border-line">
          <div className="md:col-span-4">
            <h3 className="font-bold text-lg text-ink flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-ink-faint" />
              Brief Schedule
            </h3>
            <p className="text-sm text-ink-faint mt-1">
              Choose delivery days and time for your elite weekly brief package (high-signal reads + synthesis).
            </p>
          </div>
          <div className="md:col-span-8 rounded-2xl bg-surface-raised border border-line p-6 space-y-6">
            <div>
              <p className="text-label uppercase text-ink-faint mb-3">Delivery Days</p>
              <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                {WEEKDAY_OPTIONS.map((day) => {
                  const active = briefDeliveryDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      onClick={() => toggleBriefDay(day.value)}
                      className={`px-3 py-2 border text-sm transition-colors ${
                        active
                          ? 'bg-ink text-surface border-ink'
                          : 'bg-surface border-line text-ink hover:border-line-strong'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-label uppercase text-ink-faint">Delivery Hour (0-23)</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={briefDeliveryHour}
                  onChange={(e) => setBriefDeliveryHour(Number(e.target.value))}
                  className="w-full border-b border-line py-2 text-ink bg-transparent focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-label uppercase text-ink-faint">Timezone</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={briefDeliveryTz}
                    onChange={(e) => setBriefDeliveryTz(e.target.value)}
                    placeholder="e.g., America/New_York"
                    className="flex-1 border-b border-line py-2 text-ink bg-transparent focus:outline-none focus:border-accent transition-colors"
                  />
                  <button
                    onClick={handleUseLocalTimezone}
                    className="px-3 py-2 border border-line text-label uppercase text-ink hover:border-line-strong"
                  >
                    Use Local
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveBriefPreferences}
              disabled={savingBriefPrefs}
              className="flex items-center gap-2 text-label uppercase bg-ink text-surface px-6 py-3 hover:bg-accent transition-colors disabled:opacity-50"
            >
              {savingBriefPrefs ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save Brief Schedule
            </button>

            <p className="text-xs text-ink-faint border-t border-line pt-4">
              Auto-sync is enabled by default. When Gmail is connected, Readflow automatically syncs new newsletters every 15 minutes when you visit the app. You do not need to press Sync manually — your brief and rack will always reflect the latest content from your selected labels.
            </p>
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
          <div className="md:col-span-8 rounded-2xl bg-surface-raised border border-line">
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

                  {/* Label selection dropdown */}
                  <div className="space-y-3">
                    <label className="text-label uppercase text-ink-faint flex items-center gap-1.5">
                      <Tag className="w-3 h-3" />
                      Labels to Sync
                    </label>

                    {/* Selected labels summary chips */}
                    {selectedLabels.length > 0 && labels.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedLabels.map(id => {
                          const label = labels.find(l => l.id === id);
                          return label ? (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-ink/5 border border-line text-xs text-ink"
                            >
                              {label.name}
                              <button
                                onClick={() => toggleLabel(id)}
                                className="text-ink-faint hover:text-accent transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}

                    {/* Dropdown trigger */}
                    <button
                      onClick={() => setLabelsOpen(!labelsOpen)}
                      disabled={labelsLoading && labels.length === 0}
                      className="w-full flex items-center justify-between px-3 py-2.5 border border-line hover:border-line-strong bg-surface text-sm text-ink transition-colors disabled:opacity-50"
                    >
                      <span className="text-ink-muted">
                        {labelsLoading && labels.length === 0
                          ? 'Loading labels...'
                          : labels.length === 0
                            ? 'No labels found'
                            : `${selectedLabels.length} label${selectedLabels.length !== 1 ? 's' : ''} selected`}
                      </span>
                      <div className="flex items-center gap-2">
                        {labelsLoading && <Loader2 className="w-3 h-3 animate-spin text-ink-faint" />}
                        <ChevronDown className={`w-4 h-4 text-ink-faint transition-transform ${labelsOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {/* Dropdown panel */}
                    {labelsOpen && labels.length > 0 && (
                      <div className="border border-line bg-surface max-h-56 overflow-y-auto">
                        {labels.map(label => (
                          <label
                            key={label.id}
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-overlay cursor-pointer transition-colors border-b border-line last:border-0"
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
                      </div>
                    )}

                    {/* Status + Refresh row */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ink-faint flex items-center gap-1.5">
                        {labelsSaving ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>
                        ) : (
                          selectedLabels.length > 0 && <><Save className="w-3 h-3" /> Auto-saved</>
                        )}
                      </span>
                      <button
                        onClick={() => fetchLabels()}
                        disabled={labelsLoading}
                        className="flex items-center gap-1 text-xs text-ink-faint hover:text-ink transition-colors px-3 py-2.5"
                      >
                        <RefreshCw className={`w-3 h-3 ${labelsLoading ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    </div>
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
              <ShieldAlert className="w-5 h-5" />
              Danger Zone
            </h3>
            <p className="text-sm text-ink-faint mt-1">Irreversible actions.</p>
          </div>
          <div className="md:col-span-8 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 p-6 space-y-4">

            {gmailConnected && (
              <div className="flex items-center justify-between pb-4 border-b border-red-200 dark:border-red-800">
                <div>
                  <p className="text-sm font-bold text-ink">Disconnect Gmail</p>
                  <p className="text-xs text-ink-faint mt-0.5">Remove Gmail tokens and sync labels. You will need to go through onboarding again.</p>
                </div>
                <button
                  onClick={handleDisconnectGmail}
                  className="px-4 py-2 border border-red-200 dark:border-red-800 text-accent text-label uppercase hover:bg-accent hover:text-white transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}

            <div>
              <p className="text-sm font-bold text-ink">Delete All Data &amp; Sign Out</p>
              <p className="text-xs text-ink-faint mt-0.5">
                Permanently deletes all newsletters, highlights, notes, senders, tokens, and preferences. You will be signed out and must complete onboarding again to use Readflow.
              </p>

              {deleteStep === 'idle' && (
                <button
                  onClick={handleDeleteAccount}
                  className="mt-3 px-6 py-3 border border-red-200 dark:border-red-800 text-accent text-label uppercase hover:bg-accent hover:text-white transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete Everything
                </button>
              )}

              {deleteStep === 'confirm' && (
                <div className="mt-3 space-y-3 rounded-lg border border-red-300 dark:border-red-700 bg-surface p-4">
                  <p className="text-sm text-ink font-medium">Type <strong>DELETE</strong> to confirm:</p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type DELETE"
                    className="w-full border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmText !== 'DELETE'}
                      className="px-4 py-2 bg-red-600 text-white text-label uppercase disabled:opacity-40 hover:bg-red-700 transition-colors"
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => { setDeleteStep('idle'); setDeleteConfirmText(''); }}
                      className="px-4 py-2 border border-line text-label uppercase text-ink hover:border-line-strong"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {deleteStep === 'deleting' && (
                <div className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
                  <Loader2 className="w-4 h-4 animate-spin" /> Deleting all data...
                </div>
              )}
            </div>
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

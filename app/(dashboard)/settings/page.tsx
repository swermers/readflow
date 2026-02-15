'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User, Mail, LogOut, Loader2, Save, ExternalLink, ArrowRight, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { triggerToast } from '@/components/Toast';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setEmail(user.email || '');

    // Try to load profile from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      setFirstName(profile.first_name || user.user_metadata?.full_name?.split(' ')[0] || '');
      setLastName(profile.last_name || user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '');
      setGmailConnected(profile.gmail_connected || false);
      if (profile.gmail_last_sync_at) {
        setLastSync(new Date(profile.gmail_last_sync_at));
      }
    } else {
      const fullName = user.user_metadata?.full_name || '';
      setFirstName(fullName.split(' ')[0] || '');
      setLastName(fullName.split(' ').slice(1).join(' ') || '');
    }

    setLoading(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        first_name: firstName,
        last_name: lastName,
      });

    if (error) {
      console.error('Error saving profile:', error);
      triggerToast('Error saving profile');
    } else {
      triggerToast('Profile saved');
    }

    setSaving(false);
  };

  const handleConnectGmail = async () => {
    const redirectUrl = `${window.location.origin}/auth/callback?next=/settings`;

    await supabase.auth.signInWithOAuth({
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
  };

  const handleSyncNow = async () => {
    setSyncing(true);

    try {
      const res = await fetch('/api/sync-gmail', {
        method: 'POST',
      });

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
    if (!confirm('Disconnect Gmail? You will need to reconnect to sync newsletters.')) {
      return;
    }

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
    if (!confirm('Are you sure? This will sign you out and your data may be deleted. This action cannot be undone.')) {
      return;
    }
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="p-12 text-gray-400 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading settings...
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 min-h-screen max-w-4xl">

      {/* Header */}
      <header className="mb-16 border-b border-black pb-4">
        <h1 className="text-4xl font-bold tracking-tight text-[#1A1A1A]">Control Room.</h1>
        <p className="text-sm text-gray-500 mt-1">
          Preferences & Gmail Connection.
        </p>
      </header>

      <div className="space-y-12">

        {/* Section 1: Profile */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-4">
             <h3 className="font-bold text-lg text-black flex items-center gap-2">
               <User className="w-5 h-5 text-gray-400" />
               Profile
             </h3>
             <p className="text-sm text-gray-400 mt-1">How you appear in the app.</p>
          </div>
          <div className="md:col-span-8 space-y-6 bg-white p-6 border border-gray-200">

             <div className="grid grid-cols-2 gap-6">
               <div className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-widest text-gray-500">First Name</label>
                 <input
                   type="text"
                   value={firstName}
                   onChange={(e) => setFirstName(e.target.value)}
                   className="w-full border-b border-gray-300 py-2 text-black focus:outline-none focus:border-[#FF4E4E] transition-colors"
                 />
               </div>
               <div className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Last Name</label>
                 <input
                   type="text"
                   value={lastName}
                   onChange={(e) => setLastName(e.target.value)}
                   className="w-full border-b border-gray-300 py-2 text-black focus:outline-none focus:border-[#FF4E4E] transition-colors"
                 />
               </div>
             </div>

             <div className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Email Address</label>
                 <input
                   type="email"
                   value={email}
                   disabled
                   className="w-full border-b border-gray-200 py-2 text-gray-400 bg-gray-50 cursor-not-allowed"
                 />
             </div>

             <button
               onClick={handleSaveProfile}
               disabled={saving}
               className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-[#1A1A1A] text-white px-6 py-3 hover:bg-[#FF4E4E] transition-colors disabled:opacity-50"
             >
               {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
               Save Changes
             </button>

          </div>
        </section>

        {/* Section 2: Gmail Connection */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-12 border-t border-gray-100">
          <div className="md:col-span-4">
             <h3 className="font-bold text-lg text-black flex items-center gap-2">
               <Mail className="w-5 h-5 text-gray-400" />
               Gmail Connection
             </h3>
             <p className="text-sm text-gray-400 mt-1">Sync newsletters from Gmail labels.</p>
          </div>
          <div className="md:col-span-8 bg-white border border-gray-200">

             <div className="p-6 space-y-6">
               {gmailConnected ? (
                 <>
                   {/* Connected state */}
                   <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                     <div className="flex items-center gap-2">
                       <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                       <span className="text-sm font-bold text-gray-900">Gmail Connected</span>
                     </div>
                     <button
                       onClick={handleDisconnectGmail}
                       className="text-xs text-gray-500 hover:text-[#FF4E4E] transition-colors"
                     >
                       Disconnect
                     </button>
                   </div>

                   {/* Sync button */}
                   <div className="space-y-3">
                     <button
                       onClick={handleSyncNow}
                       disabled={syncing}
                       className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-[#1A1A1A] text-white px-6 py-3 hover:bg-[#FF4E4E] transition-colors disabled:opacity-50 w-full justify-center"
                     >
                       {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                       {syncing ? 'Syncing...' : 'Sync Now'}
                     </button>

                     {lastSync && (
                       <p className="text-xs text-gray-400 text-center">
                         Last synced {formatDistanceToNow(lastSync, { addSuffix: true })}
                       </p>
                     )}
                   </div>

                   {/* Setup instructions */}
                   <div className="pt-4 border-t border-gray-100 space-y-3">
                     <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Gmail Setup</label>

                     <details className="group border border-gray-200">
                       <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium text-[#1A1A1A] hover:bg-gray-50">
                         <span>How to sync newsletters</span>
                         <ArrowRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
                       </summary>
                       <div className="px-4 pb-4 text-sm text-gray-600 space-y-2">
                         <ol className="list-decimal list-inside space-y-1.5">
                           <li>In Gmail, go to <a href="https://mail.google.com/mail/u/0/#settings/labels" target="_blank" rel="noopener noreferrer" className="text-[#FF4E4E] underline inline-flex items-center gap-0.5">Settings → Labels <ExternalLink className="w-3 h-3" /></a></li>
                           <li>Create a new label called &quot;Readflow&quot;</li>
                           <li>Go to <a href="https://mail.google.com/mail/u/0/#settings/filters" target="_blank" rel="noopener noreferrer" className="text-[#FF4E4E] underline inline-flex items-center gap-0.5">Settings → Filters <ExternalLink className="w-3 h-3" /></a></li>
                           <li>Create a filter: &quot;From&quot; contains your newsletter sender (e.g., @substack.com)</li>
                           <li>Action: Apply label &quot;Readflow&quot;</li>
                           <li>Optionally check &quot;Also apply filter to matching emails&quot; for existing newsletters</li>
                           <li>Click &quot;Sync Now&quot; above to import newsletters from the Readflow label</li>
                         </ol>
                       </div>
                     </details>
                   </div>
                 </>
               ) : (
                 <>
                   {/* Not connected state */}
                   <div className="text-center py-6">
                     <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                     <p className="text-sm font-bold text-gray-900 mb-1">Connect Gmail to sync newsletters</p>
                     <p className="text-xs text-gray-500 mb-6">
                       Read-only access. We only see emails you label &quot;Readflow&quot;.
                     </p>
                     <button
                       onClick={handleConnectGmail}
                       className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-[#1A1A1A] text-white px-6 py-3 hover:bg-[#FF4E4E] transition-colors mx-auto"
                     >
                       <Mail className="w-3 h-3" />
                       Connect Gmail
                     </button>
                   </div>
                 </>
               )}
             </div>

          </div>
        </section>

        {/* Section 3: Danger Zone */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-12 border-t border-gray-100">
          <div className="md:col-span-4">
             <h3 className="font-bold text-lg text-[#FF4E4E] flex items-center gap-2">
               <LogOut className="w-5 h-5" />
               Danger Zone
             </h3>
          </div>
          <div className="md:col-span-8">
             <button
               onClick={handleDeleteAccount}
               className="px-6 py-3 border border-red-200 bg-red-50 text-[#FF4E4E] text-xs font-bold uppercase tracking-widest hover:bg-[#FF4E4E] hover:text-white transition-colors"
             >
               Disconnect & Delete Data
             </button>
          </div>
        </section>

      </div>
    </div>
  );
}

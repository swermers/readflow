'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User, Mail, LogOut, Shield, Loader2, Save, Copy, Check } from 'lucide-react';
import { triggerToast } from '@/components/Toast';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const [email, setEmail] = useState('');
  const [forwardingAlias, setForwardingAlias] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
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
      setForwardingAlias(profile.forwarding_alias || '');
      // Use metadata or profile fields for name
      setFirstName(profile.first_name || user.user_metadata?.full_name?.split(' ')[0] || '');
      setLastName(profile.last_name || user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '');
    } else {
      // Fallback to auth metadata
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

  const handleCopyAlias = () => {
    if (!forwardingAlias) return;
    const fullAddress = `${forwardingAlias}@ingest.readflow.app`;
    navigator.clipboard.writeText(fullAddress);
    setCopied(true);
    triggerToast('Forwarding address copied');
    setTimeout(() => setCopied(false), 2000);
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
          Preferences & Connection Status.
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

        {/* Section 2: Forwarding Address */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-12 border-t border-gray-100">
          <div className="md:col-span-4">
             <h3 className="font-bold text-lg text-black flex items-center gap-2">
               <Mail className="w-5 h-5 text-gray-400" />
               Forwarding Address
             </h3>
             <p className="text-sm text-gray-400 mt-1">Send newsletters here to import them.</p>
          </div>
          <div className="md:col-span-8 bg-white border border-gray-200">

             <div className="p-6">
               {forwardingAlias ? (
                 <div className="space-y-4">
                   <div className="flex items-center gap-3">
                     <code className="flex-1 bg-[#F5F5F0] px-4 py-3 text-sm font-mono text-[#1A1A1A] border border-gray-200">
                       {forwardingAlias}@ingest.readflow.app
                     </code>
                     <button
                       onClick={handleCopyAlias}
                       className="p-3 border border-gray-200 hover:border-[#FF4E4E] hover:text-[#FF4E4E] transition-colors"
                       title="Copy address"
                     >
                       {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                     </button>
                   </div>
                   <p className="text-xs text-gray-400">
                     Set up a Gmail/Outlook filter to forward newsletters to this address. They will appear in your Rack automatically.
                   </p>
                 </div>
               ) : (
                 <div className="text-center py-6">
                   <Shield className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                   <p className="text-sm text-gray-500">No forwarding address assigned yet.</p>
                   <p className="text-xs text-gray-400 mt-1">This will be set up automatically.</p>
                 </div>
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

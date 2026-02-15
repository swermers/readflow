'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User, Mail, LogOut, Shield, Loader2, Save, Copy, Check, ExternalLink, ArrowRight } from 'lucide-react';
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
  const [testSending, setTestSending] = useState(false);
  const [testSent, setTestSent] = useState(false);
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

  const handleTestConnection = async () => {
    setTestSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setTestSending(false);
      triggerToast('You need to be logged in', 'error');
      return;
    }

    // Find or create a Readflow system sender
    let { data: sender } = await supabase
      .from('senders')
      .select('id')
      .eq('user_id', user.id)
      .eq('email', 'hello@readflow.app')
      .single();

    if (!sender) {
      const { data: newSender } = await supabase
        .from('senders')
        .insert({
          user_id: user.id,
          email: 'hello@readflow.app',
          name: 'Readflow',
          status: 'approved',
        })
        .select('id')
        .single();
      sender = newSender;
    }

    if (sender) {
      const { error } = await supabase.from('issues').insert({
        user_id: user.id,
        sender_id: sender.id,
        subject: 'Connection Test — Readflow',
        snippet: 'This is a test issue to verify your Readflow pipeline is working correctly.',
        body_html: '<div style="font-family: system-ui, sans-serif;"><h1>Connection Test</h1><p>If you can see this in The Rack, your Readflow pipeline is working correctly.</p></div>',
        body_text: 'This is a test issue to verify your Readflow pipeline is working correctly.',
        from_email: 'hello@readflow.app',
        message_id: `test-${Date.now()}`,
        received_at: new Date().toISOString(),
        status: 'unread',
      });

      if (error) {
        triggerToast('Failed to send test issue', 'error');
      } else {
        triggerToast('Test issue sent! Check The Rack.');
        setTestSent(true);
      }
    }

    setTestSending(false);
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

             <div className="p-6 space-y-6">
               {forwardingAlias ? (
                 <>
                   {/* Address + copy */}
                   <div className="space-y-2">
                     <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Your Readflow Address</label>
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
                   </div>

                   {/* Setup links */}
                   <div className="space-y-3">
                     <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Set Up Forwarding</label>

                     <details className="group border border-gray-200">
                       <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium text-[#1A1A1A] hover:bg-gray-50">
                         <span>Gmail</span>
                         <ArrowRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
                       </summary>
                       <div className="px-4 pb-4 text-sm text-gray-600 space-y-2">
                         <ol className="list-decimal list-inside space-y-1.5">
                           <li>Open <a href="https://mail.google.com/mail/u/0/#settings/fwdandpop" target="_blank" rel="noopener noreferrer" className="text-[#FF4E4E] underline inline-flex items-center gap-0.5">Forwarding Settings <ExternalLink className="w-3 h-3" /></a></li>
                           <li>Click &quot;Add a forwarding address&quot;</li>
                           <li>Paste: <code className="bg-gray-100 px-1 text-xs">{forwardingAlias}@ingest.readflow.app</code></li>
                           <li>Enter the verification code Gmail sends (it will appear as an issue in The Rack)</li>
                           <li>Go to <a href="https://mail.google.com/mail/u/0/#settings/filters" target="_blank" rel="noopener noreferrer" className="text-[#FF4E4E] underline inline-flex items-center gap-0.5">Filters <ExternalLink className="w-3 h-3" /></a> and create a filter to forward newsletters</li>
                         </ol>
                       </div>
                     </details>

                     <details className="group border border-gray-200">
                       <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium text-[#1A1A1A] hover:bg-gray-50">
                         <span>Outlook</span>
                         <ArrowRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
                       </summary>
                       <div className="px-4 pb-4 text-sm text-gray-600 space-y-2">
                         <ol className="list-decimal list-inside space-y-1.5">
                           <li>Go to Settings &rarr; Mail &rarr; Rules</li>
                           <li>Click &quot;Add new rule&quot;</li>
                           <li>Condition: &quot;From&quot; contains your newsletter sender</li>
                           <li>Action: &quot;Forward to&quot; &rarr; <code className="bg-gray-100 px-1 text-xs">{forwardingAlias}@ingest.readflow.app</code></li>
                           <li>Save the rule</li>
                         </ol>
                       </div>
                     </details>
                   </div>

                   {/* Test connection */}
                   <div className="pt-2 border-t border-gray-100">
                     {testSent ? (
                       <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-3 border border-green-200">
                         <Check className="w-4 h-4" />
                         Test issue sent! Check The Rack to verify.
                       </div>
                     ) : (
                       <button
                         onClick={handleTestConnection}
                         disabled={testSending}
                         className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-[#1A1A1A] text-white px-6 py-3 hover:bg-[#FF4E4E] transition-colors disabled:opacity-50"
                       >
                         {testSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                         Test Connection
                       </button>
                     )}
                   </div>
                 </>
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

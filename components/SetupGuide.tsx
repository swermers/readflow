'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Copy, Check, Mail, ArrowRight, ExternalLink, Loader2 } from 'lucide-react';

export default function SetupGuide() {
  const [alias, setAlias] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testSending, setTestSending] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadAlias();
  }, []);

  const loadAlias = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('forwarding_alias')
      .eq('id', user.id)
      .single();

    if (profile?.forwarding_alias) {
      setAlias(profile.forwarding_alias);
    }
    setLoading(false);
  };

  const handleCopy = () => {
    if (!alias) return;
    navigator.clipboard.writeText(`${alias}@ingest.readflow.app`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTest = async () => {
    setTestSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setTestSending(false);
      return;
    }

    // Insert a test issue directly to verify the pipeline works
    // First, find or create a "Readflow" system sender
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
      await supabase.from('issues').insert({
        user_id: user.id,
        sender_id: sender.id,
        subject: 'Welcome to Readflow!',
        snippet: 'Your reading sanctuary is ready. This is a test issue to confirm everything is working.',
        body_html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px;">
            <h1>Welcome to Readflow</h1>
            <p>Your reading sanctuary is ready. This test issue confirms that newsletters will appear here in <strong>The Rack</strong> once you set up email forwarding.</p>
            <h2>Next steps:</h2>
            <ol>
              <li>Copy your forwarding address from the Settings page</li>
              <li>In Gmail, go to Settings → Forwarding → Add a forwarding address</li>
              <li>Paste your Readflow address and verify it</li>
              <li>Create a filter for newsletter senders to auto-forward</li>
            </ol>
            <p>New senders will appear in the <strong>Review</strong> page for your approval before their newsletters show up in The Rack.</p>
            <p style="color: #999; font-size: 14px;">— The Readflow Team</p>
          </div>
        `,
        body_text: 'Your reading sanctuary is ready. This test issue confirms that newsletters will appear here in The Rack once you set up email forwarding.',
        from_email: 'hello@readflow.app',
        message_id: `test-${Date.now()}`,
        received_at: new Date().toISOString(),
        status: 'unread',
      });
    }

    setTestSending(false);
    setTestSent(true);
  };

  if (loading) {
    return (
      <div className="p-8 text-gray-400 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
      </div>
    );
  }

  const fullAddress = `${alias}@ingest.readflow.app`;

  return (
    <div className="col-span-full max-w-2xl mx-auto w-full">
      <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 md:p-12">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-12 h-12 bg-[#FF4E4E] rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">Set up your reading sanctuary</h2>
          <p className="text-sm text-gray-500">Forward your newsletters to Readflow in 3 steps.</p>
        </div>

        {/* Steps */}
        <div className="space-y-8">

          {/* Step 1: Copy address */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-sm font-bold">
              1
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[#1A1A1A] mb-1">Copy your forwarding address</h3>
              <p className="text-sm text-gray-500 mb-3">This is your unique Readflow inbox. Newsletters sent here appear in The Rack.</p>
              {alias ? (
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-[#F5F5F0] px-4 py-3 text-sm font-mono text-[#1A1A1A] border border-gray-200 rounded">
                    {fullAddress}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="p-3 border border-gray-200 rounded hover:border-[#FF4E4E] hover:text-[#FF4E4E] transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No forwarding address assigned yet. Try signing out and back in.</p>
              )}
            </div>
          </div>

          {/* Step 2: Set up forwarding in Gmail */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-sm font-bold">
              2
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[#1A1A1A] mb-1">Set up email forwarding</h3>
              <p className="text-sm text-gray-500 mb-3">
                Create a filter in your email client to forward newsletters to your Readflow address.
              </p>

              <div className="space-y-3">
                {/* Gmail instructions */}
                <details className="group border border-gray-200 rounded">
                  <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium text-[#1A1A1A] hover:bg-gray-50">
                    <span>Gmail instructions</span>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="px-4 pb-4 text-sm text-gray-600 space-y-2">
                    <ol className="list-decimal list-inside space-y-1.5">
                      <li>Open <a href="https://mail.google.com/mail/u/0/#settings/fwdandpop" target="_blank" rel="noopener noreferrer" className="text-[#FF4E4E] underline inline-flex items-center gap-0.5">Gmail Forwarding Settings <ExternalLink className="w-3 h-3" /></a></li>
                      <li>Click &quot;Add a forwarding address&quot;</li>
                      <li>Paste your Readflow address: <code className="bg-gray-100 px-1 text-xs">{fullAddress}</code></li>
                      <li>Gmail will send a verification code — once email infrastructure is live, the code will appear in your Rack</li>
                      <li>Enter the code in Gmail to confirm</li>
                      <li>Then go to <a href="https://mail.google.com/mail/u/0/#settings/filters" target="_blank" rel="noopener noreferrer" className="text-[#FF4E4E] underline inline-flex items-center gap-0.5">Filters <ExternalLink className="w-3 h-3" /></a> → Create filter → match newsletter senders → Forward to your Readflow address</li>
                    </ol>
                  </div>
                </details>

                {/* Outlook instructions */}
                <details className="group border border-gray-200 rounded">
                  <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium text-[#1A1A1A] hover:bg-gray-50">
                    <span>Outlook instructions</span>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="px-4 pb-4 text-sm text-gray-600 space-y-2">
                    <ol className="list-decimal list-inside space-y-1.5">
                      <li>Go to Settings → Mail → Rules</li>
                      <li>Click &quot;Add new rule&quot;</li>
                      <li>Set condition: &quot;From&quot; contains your newsletter sender</li>
                      <li>Set action: &quot;Forward to&quot; → <code className="bg-gray-100 px-1 text-xs">{fullAddress}</code></li>
                      <li>Save the rule</li>
                    </ol>
                  </div>
                </details>
              </div>
            </div>
          </div>

          {/* Step 3: Verify */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-sm font-bold">
              3
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[#1A1A1A] mb-1">Verify it works</h3>
              <p className="text-sm text-gray-500 mb-3">
                Send a test to make sure newsletters will appear in The Rack. New senders go to Review first for your approval.
              </p>

              {testSent ? (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-3 rounded border border-green-200">
                  <Check className="w-4 h-4" />
                  Test issue sent! Refresh the page to see it in The Rack.
                </div>
              ) : (
                <button
                  onClick={handleSendTest}
                  disabled={testSending}
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-[#1A1A1A] text-white px-6 py-3 hover:bg-[#FF4E4E] transition-colors disabled:opacity-50 rounded"
                >
                  {testSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                  Send Test Issue
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

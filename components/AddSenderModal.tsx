'use client';

import { useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { triggerToast } from '@/components/Toast';
import { refreshSidebar } from '@/components/Sidebar';

export default function AddSenderModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      triggerToast('You need to be logged in to add a newsletter', 'error');
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.from('senders').insert({
      user_id: user.id,
      email: email,
      name: name || email.split('@')[0],
      status: 'approved'
    });

    if (error) {
      triggerToast('Error adding newsletter: ' + error.message, 'error');
    } else {
      triggerToast('Newsletter added');
      setIsOpen(false);
      setEmail('');
      setName('');
      refreshSidebar();
      router.refresh();
    }

    setIsLoading(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center w-full gap-2 p-2 mt-4 text-xs font-medium text-ink-faint border border-dashed border-line hover:border-accent hover:text-accent transition-colors rounded-lg"
      >
        <Plus className="w-3 h-3" />
        Add Newsletter
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface border border-line shadow-2xl overflow-hidden animate-fade-in">

            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-line bg-surface-raised">
              <h3 className="font-bold text-ink">Add New Source</h3>
              <button onClick={() => setIsOpen(false)} className="text-ink-faint hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-label uppercase text-ink-faint mb-1.5">
                  Newsletter Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Morning Brew"
                  className="w-full p-2.5 bg-surface-raised border border-line text-sm text-ink focus:outline-none focus:border-accent transition-colors placeholder:text-ink-faint"
                />
              </div>

              <div>
                <label className="block text-label uppercase text-ink-faint mb-1.5">
                  Sender Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. crew@morningbrew.com"
                  className="w-full p-2.5 bg-surface-raised border border-line text-sm text-ink focus:outline-none focus:border-accent transition-colors placeholder:text-ink-faint"
                />
                <p className="mt-1.5 text-[11px] text-ink-faint">
                  The address that sends you the newsletter.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 bg-ink text-surface font-medium py-2.5 hover:bg-accent transition-all disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Source'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

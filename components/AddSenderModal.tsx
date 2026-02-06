'use client';

import { useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

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

    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert('You need to be logged in to add a newsletter!');
      setIsLoading(false);
      return;
    }

    // 2. Insert into Supabase
    const { error } = await supabase.from('senders').insert({
      user_id: user.id,
      email: email,
      name: name || email.split('@')[0], // Use email prefix if no name provided
      status: 'active'
    });

    if (error) {
      alert('Error adding newsletter: ' + error.message);
    } else {
      setIsOpen(false);
      setEmail('');
      setName('');
      router.refresh(); // Refresh the page to show the new link in Sidebar
    }
    
    setIsLoading(false);
  };

  return (
    <>
      {/* The Trigger Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center w-full gap-2 p-2 mt-4 text-xs font-medium text-gray-600 border border-dashed border-gray-300 rounded-md hover:border-[#FF4E4E] hover:text-[#FF4E4E] transition-colors"
      >
        <Plus className="w-3 h-3" />
        Add Newsletter
      </button>

      {/* The Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-semibold text-gray-900">Add New Subscription</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Newsletter Name
                </label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Morning Brew"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4E4E]/20 focus:border-[#FF4E4E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Sender Email
                </label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. crew@morningbrew.com"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4E4E]/20 focus:border-[#FF4E4E]"
                />
                <p className="mt-1.5 text-[11px] text-gray-400">
                  The address that sends you the newsletter.
                </p>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 bg-[#1A1A1A] hover:bg-black text-white font-medium py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Subscription'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </>
  );
}
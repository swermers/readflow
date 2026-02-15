'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Inbox, User, LogOut, Layers } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';
import AddSenderModal from './AddSenderModal';

export const refreshSidebar = () => {
  window.dispatchEvent(new CustomEvent('sidebar-refresh'));
};

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [senders, setSenders] = useState<any[]>([]);

  const getSenders = async () => {
    const { data } = await supabase.from('senders').select('*').eq('status', 'approved');
    if (data) setSenders(data);
  };

  useEffect(() => {
    getSenders();
  }, []);

  useEffect(() => {
    const handleRefresh = () => getSenders();
    window.addEventListener('sidebar-refresh', handleRefresh);
    return () => window.removeEventListener('sidebar-refresh', handleRefresh);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const isActive = (path: string) => pathname === path;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      <div className={`w-64 h-screen border-r border-gray-100 flex flex-col fixed left-0 top-0 bg-white z-40 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>

        {/* Logo */}
        <div className="p-6">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-[#1A1A1A]">
            <div className="w-2 h-2 bg-[#FF4E4E] rounded-full"></div>
            Readflow.
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-4 space-y-1">
          <Link
            href="/"
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive('/') ? 'bg-[#F5F5F0] text-[#1A1A1A]' : 'text-gray-500 hover:text-[#1A1A1A] hover:bg-gray-50'}`}
          >
            <Home className="w-4 h-4" />
            The Rack
          </Link>
          <Link
            href="/review"
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive('/review') ? 'bg-[#F5F5F0] text-[#1A1A1A]' : 'text-gray-500 hover:text-[#1A1A1A] hover:bg-gray-50'}`}
          >
            <Inbox className="w-4 h-4" />
            Review
          </Link>
          <Link
            href="/archive"
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive('/archive') ? 'bg-[#F5F5F0] text-[#1A1A1A]' : 'text-gray-500 hover:text-[#1A1A1A] hover:bg-gray-50'}`}
          >
            <Layers className="w-4 h-4" />
            Archive
          </Link>
        </nav>

        {/* Library Section */}
        <div className="flex-1 px-4 overflow-y-auto mt-8">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 px-3">
            Library
          </div>
          <div className="space-y-1">
            {senders.map((sender) => (
              <Link
                key={sender.id}
                href={`/sender/${sender.id}`}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${isActive(`/sender/${sender.id}`) ? 'bg-[#F5F5F0] text-[#1A1A1A]' : 'text-gray-500 hover:text-[#1A1A1A] hover:bg-gray-50'}`}
              >
                <div className="w-4 h-4 rounded bg-gray-100 flex items-center justify-center text-[8px] font-bold text-gray-500">
                  {sender.name[0]}
                </div>
                <span className="truncate">{sender.name}</span>
              </Link>
            ))}

            <div className="px-3 pt-2">
              <AddSenderModal />
            </div>

            {senders.length === 0 && (
               <p className="px-3 text-xs text-gray-300 mt-2 text-center">
                 Start by adding a newsletter above.
               </p>
            )}
          </div>
        </div>

        {/* Footer: Settings & Sign Out */}
        <div className="p-4 border-t border-gray-100 space-y-1">
          <Link
            href="/settings"
            onClick={onClose}
            className={`flex items-center text-xs font-bold uppercase tracking-widest transition-colors w-full px-3 py-2 ${isActive('/settings') ? 'text-[#1A1A1A]' : 'text-gray-400 hover:text-[#FF4E4E]'}`}
          >
            <User className="w-4 h-4 mr-2" />
            Settings
          </Link>

          <button
            onClick={handleSignOut}
            className="flex items-center text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-[#FF4E4E] transition-colors w-full px-3 py-2"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}

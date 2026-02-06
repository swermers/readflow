'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Settings, PlusCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client'; // Import the client bridge

export default function Sidebar() {
  const pathname = usePathname();
  
  // State to hold our real data
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  // Fetch data on load
  useEffect(() => {
    const fetchSidebarData = async () => {
      const supabase = createClient();
      
      // 1. Get all senders
      const { data: senders } = await supabase
        .from('senders')
        .select('*');

      if (senders) {
        // Filter: Approved goes to 'Subscriptions', Pending goes to 'New Senders'
        const approved = senders.filter(s => s.status === 'approved');
        const pending = senders.filter(s => s.status === 'pending');
        
        setSubscriptions(approved);
        setPendingCount(pending.length);
      }
    };

    fetchSidebarData();
  }, []);

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const getLinkClass = (path: string) => {
    const baseClass = "block transition-transform hover:translate-x-1";
    if (isActive(path)) {
      return `${baseClass} text-black font-bold border-l-2 border-[#FF4E4E] pl-2 -ml-2.5`; 
    }
    return `${baseClass} hover:text-black`; 
  };

  return (
    <aside className="col-span-12 md:col-span-2 pt-6 px-6 md:px-0 md:pl-8 md:pt-12 md:border-r border-[#E5E5E5] md:pr-6 pb-6 md:pb-0 border-b md:border-b-0 border-gray-100 flex flex-col justify-between h-auto md:h-screen sticky top-0 bg-white z-50">
      
      <div>
        {/* Brand / Logo */}
        <div className="mb-6 md:mb-12 flex items-center md:block justify-between">
          <div>
             <div className="hidden md:block h-1 w-8 bg-[#FF4E4E] mb-6"></div> 
             <div className="font-bold text-sm tracking-widest text-gray-400 uppercase">Readflow</div>
          </div>
          
          <div className="md:hidden text-xs font-bold text-[#FF4E4E] bg-[#FF4E4E]/10 px-2 py-1 rounded">
            Beta
          </div>
        </div>
        
        {/* Main Navigation */}
        <nav className="flex md:block space-x-6 md:space-x-0 md:space-y-6 text-sm font-medium text-gray-500 overflow-x-auto whitespace-nowrap pb-2 md:pb-0 hide-scrollbar items-center">
          
          <Link href="/" className={getLinkClass('/')}>
            Newsletters
          </Link>
          
          <Link href="/review" className={getLinkClass('/review')}>
            New Senders 
            {/* Dynamic Counter */}
            {pendingCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ml-2 align-middle ${isActive('/review') ? 'bg-[#FF4E4E] text-white' : 'bg-[#FF4E4E]/10 text-[#FF4E4E]'}`}>
                {pendingCount}
              </span>
            )}
          </Link>

          {/* Library Section (Desktop) */}
          <div className="hidden md:block pt-6 border-t border-gray-100">
             <div className="flex justify-between items-center mb-4 pr-2">
                <div className="text-xs font-bold tracking-widest text-gray-300 uppercase">Library</div>
             </div>
             
             {/* Dynamic Subscription List */}
             {subscriptions.map((sub) => (
                <Link key={sub.id} href={`/sender/${sub.id}`} className="block mb-3 transition-transform hover:translate-x-1 hover:text-black">
                   <span className="truncate block">{sub.name || sub.email}</span>
                </Link>
             ))}

             {subscriptions.length === 0 && (
               <div className="text-xs text-gray-300 italic">No subscriptions yet.</div>
             )}
          </div>

          {/* Mobile Links */}
          <div className="md:hidden flex items-center space-x-6 pr-4">
             <Link href="/subscriptions" className={getLinkClass('/subscriptions')}>
               Subscriptions
             </Link>
             <Link href="/archive" className={getLinkClass('/archive')}>
               Archive
             </Link>
             <button onClick={() => alert('Signing out...')} className="text-gray-400 hover:text-[#FF4E4E]">
               <LogOut className="w-4 h-4" />
             </button>
          </div>
        </nav>
      </div>

      {/* Utilities (Desktop Only) */}
      <div className="hidden md:block border-t border-gray-100 pt-6 pb-6 space-y-4">
        
        <Link href="/settings" className={`flex items-center gap-2 text-sm font-medium transition-colors ${isActive('/settings') ? 'text-black' : 'text-gray-400 hover:text-black'}`}>
          <Settings className="w-4 h-4" />
          Settings
        </Link>
        
        <button 
          onClick={() => alert('Signing out...')} 
          className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-[#FF4E4E] transition-colors w-full text-left"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>

      </div>

    </aside>
  );
}
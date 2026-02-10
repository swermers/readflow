import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { Clock, ArrowUpRight } from 'lucide-react';

export default async function Home() {
  const supabase = await createClient();

  // Fetch unread + read issues from approved senders (not archived)
  const { data: emails, error } = await supabase
    .from('issues')
    .select('*, senders!inner(name, status)') 
    .eq('senders.status', 'approved')
    .in('status', ['unread', 'read'])
    .order('received_at', { ascending: false });

  if (error) {
    console.error("Supabase error:", error);
  }

  const unreadCount = emails?.filter(e => e.status === 'unread').length || 0;

  return (
    <div className="p-6 md:p-12 min-h-screen">
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1A1A1A]">The Rack.</h1>
          <p className="text-sm text-gray-500 mt-1">
            {unreadCount > 0 
              ? `${unreadCount} unread issue${unreadCount !== 1 ? 's' : ''} waiting for you.`
              : `${emails?.length || 0} issues on the rack.`
            }
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {emails?.map((email: any) => (
          <Link key={email.id} href={`/newsletters/${email.id}`} className="block">
            <div className={`group relative bg-white border p-6 transition-all h-64 flex flex-col justify-between shadow-sm hover:shadow-md ${
              email.status === 'unread' 
                ? 'border-gray-200 hover:border-[#FF4E4E]' 
                : 'border-gray-100 opacity-75 hover:opacity-100 hover:border-gray-300'
            }`}>
              
              {/* Unread indicator */}
              {email.status === 'unread' && (
                <div className="absolute top-3 right-3 w-2 h-2 bg-[#FF4E4E] rounded-full"></div>
              )}

              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF4E4E]">
                  {email.senders?.name || 'Unknown'}
                </span>
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(email.received_at).toLocaleDateString()}
                </span>
              </div>

              <div>
                <h3 className={`text-lg font-bold leading-tight mb-2 group-hover:text-[#FF4E4E] transition-colors ${
                  email.status === 'unread' ? 'text-gray-900' : 'text-gray-600'
                }`}>
                  {email.subject}
                </h3>
                <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed">
                  {email.snippet}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-50 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[#FF4E4E]">
                  Read <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>

            </div>
          </Link>
        ))}
        
        {(!emails || emails.length === 0) && (
           <div className="col-span-full py-12 text-center text-gray-400 border-2 border-dashed border-gray-100 rounded-lg">
             <p className="mb-2 font-bold text-gray-900">All caught up.</p>
             <p className="text-xs">Approved newsletters will appear here when they arrive.</p>
           </div>
        )}
      </div>
    </div>
  );
}
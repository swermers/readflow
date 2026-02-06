import { createClient } from '@/utils/supabase/server';
import Sidebar from '@/components/Sidebar'; 
import Link from 'next/link';
import { Clock, ArrowUpRight } from 'lucide-react';

export default async function Home() {
  // 1. Connect to the DB
  const supabase = await createClient();

  // 2. Fetch the issues (instead of using MOCK_EMAILS)
  const { data: emails } = await supabase
    .from('issues')
    .select('*, senders(name)') // This joins the sender name automatically!
    .order('received_at', { ascending: false });

  return (
    <div className="p-6 md:p-12 min-h-screen">
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1A1A1A]">The Rack.</h1>
          <p className="text-sm text-gray-500 mt-1">
            {emails?.length || 0} issues waiting for you.
          </p>
        </div>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {emails?.map((email: any) => (
          <div key={email.id} className="group relative bg-white border border-gray-100 p-6 hover:border-[#FF4E4E] transition-colors h-64 flex flex-col justify-between shadow-sm hover:shadow-md">
            
            {/* Header */}
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF4E4E]">
                {email.senders?.name || 'Unknown'}
              </span>
              {/* Note: We'll format the date properly later */}
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(email.received_at).toLocaleDateString()}
              </span>
            </div>

            {/* Content */}
            <div>
              <h3 className="text-lg font-bold leading-tight text-gray-900 mb-2 group-hover:text-[#FF4E4E] transition-colors">
                {email.subject}
              </h3>
              <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed">
                {email.snippet}
              </p>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-gray-50 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
              <Link href={`/newsletters/${email.id}`} className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[#FF4E4E]">
                Read <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

          </div>
        ))}
        
        {/* Empty State if no emails */}
        {(!emails || emails.length === 0) && (
           <div className="col-span-full py-12 text-center text-gray-400">
             Your rack is empty.
           </div>
        )}
      </div>
    </div>
  );
}
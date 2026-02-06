import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { ArrowLeft, Clock, Globe, ArrowUpRight } from 'lucide-react';
import { notFound } from 'next/navigation';

export default async function SenderPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  // 1. Fetch Sender Details
  const { data: sender } = await supabase
    .from('senders')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!sender) return notFound();

  // 2. Fetch ALL issues from this sender
  const { data: issues } = await supabase
    .from('issues')
    .select('*')
    .eq('sender_id', params.id)
    .order('received_at', { ascending: false });

  return (
    <div className="p-6 md:p-12 min-h-screen">
      
      {/* Navigation */}
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-[#FF4E4E] transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Rack
        </Link>
      </div>

      {/* Header Profile */}
      <header className="mb-12 border-b border-gray-100 pb-12">
        <div className="flex items-center gap-6 mb-6">
          <div className="w-20 h-20 bg-[#F5F5F0] rounded-full flex items-center justify-center text-3xl font-bold text-gray-400">
            {sender.name[0]}
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1A1A1A]">{sender.name}</h1>
            <a href={`mailto:${sender.email}`} className="text-gray-400 text-sm hover:text-[#FF4E4E] transition-colors">
              {sender.email}
            </a>
          </div>
        </div>

        <div className="flex gap-4">
          <a 
            href={sender.website_url || '#'} 
            target="_blank" 
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded text-xs font-bold uppercase tracking-widest text-gray-600 transition-colors"
          >
            <Globe className="w-4 h-4" /> Website
          </a>
          <button className="px-4 py-2 border border-gray-200 hover:border-red-200 hover:text-red-600 rounded text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors">
            Unsubscribe
          </button>
        </div>
      </header>

      {/* List of Issues */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {issues?.map((issue) => (
          <div key={issue.id} className="group relative bg-white border border-gray-100 p-6 hover:border-[#FF4E4E] transition-colors h-64 flex flex-col justify-between shadow-sm hover:shadow-md">
            
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(issue.received_at).toLocaleDateString()}
            </span>

            <div>
              <h3 className="text-lg font-bold leading-tight text-gray-900 mb-2 group-hover:text-[#FF4E4E] transition-colors">
                {issue.subject}
              </h3>
              <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed">
                {issue.snippet}
              </p>
            </div>

            <div className="pt-4 border-t border-gray-50 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
              <Link href={`/newsletters/${issue.id}`} className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[#FF4E4E]">
                Read <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

          </div>
        ))}
        
        {(!issues || issues.length === 0) && (
           <div className="col-span-full py-12 text-center text-gray-400">
             <p className="text-sm">No issues archived from this sender yet.</p>
           </div>
        )}
      </div>
    </div>
  );
}
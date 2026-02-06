import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { ArrowLeft, Clock, Globe } from 'lucide-react';
import { notFound } from 'next/navigation';

export default async function NewsletterPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  // 1. Fetch the specific issue by ID
  const { data: email, error } = await supabase
    .from('issues')
    .select('*, senders(*)') // Get the email AND the sender details
    .eq('id', params.id)
    .single();

  if (error || !email) {
    return notFound(); // Shows the 404 page if ID is wrong
  }

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-12">
      
      {/* Navigation */}
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-[#FF4E4E] transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Rack
        </Link>
      </div>

      {/* Header */}
      <header className="mb-12 pb-8 border-b border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            {/* Sender Avatar (or placeholder) */}
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-400">
              {email.senders?.name?.[0] || 'N'}
            </div>
            <div>
              <p className="text-sm font-bold text-[#1A1A1A]">{email.senders?.name}</p>
              <p className="text-xs text-gray-400">{email.senders?.email}</p>
            </div>
          </div>
          
          <span className="text-xs text-gray-400 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {new Date(email.received_at).toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </span>
        </div>

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-[#1A1A1A] leading-tight">
          {email.subject}
        </h1>
      </header>

      {/* The Content (Rendered HTML) */}
      <article className="prose prose-lg prose-slate max-w-none prose-headings:font-bold prose-p:leading-relaxed prose-a:text-[#FF4E4E] prose-img:rounded-xl">
        {/* We use dangerouslySetInnerHTML to render the HTML stored in Supabase */}
        <div dangerouslySetInnerHTML={{ __html: email.body_html }} />
      </article>

      {/* Footer Actions */}
      <div className="mt-20 pt-10 border-t border-gray-100 flex justify-between items-center">
        <button className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors">
          Archive Issue
        </button>
        <a 
          href={email.senders?.website_url || '#'} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-[#FF4E4E] transition-colors"
        >
          Visit Website <Globe className="w-4 h-4" />
        </a>
      </div>

    </div>
  );
}
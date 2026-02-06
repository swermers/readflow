import { MOCK_EMAILS } from '@/lib/mockData';
import Link from 'next/link';
import { ArrowLeft, Archive, Star } from 'lucide-react'; // Minimalist icons

// This function tells Next.js which IDs exist (for static building)
export function generateStaticParams() {
  return MOCK_EMAILS.map((email) => ({
    id: email.id,
  }));
}

export default function NewsletterPage({ params }: { params: { id: string } }) {
  // Find the specific email that matches the ID in the URL
  const email = MOCK_EMAILS.find((e) => e.id === params.id);

  if (!email) {
    return <div className="p-12">Email not found</div>;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 bg-[#F5F5F0]/95 backdrop-blur-sm border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
        <Link href="/" className="flex items-center text-sm font-medium hover:text-[#FF4E4E] transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Inbox
        </Link>
        
        <div className="flex gap-4">
          <button className="p-2 hover:bg-white rounded-full transition-colors" title="Star">
            <Star className="w-4 h-4" />
          </button>
          <button className="p-2 hover:bg-white rounded-full transition-colors" title="Archive">
            <Archive className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Reading Container - Centered & Narrow like a Book */}
      <main className="max-w-2xl mx-auto px-6 py-12">
        
        {/* Header Metadata */}
        <header className="mb-12 border-b border-black/10 pb-8">
          <div className="flex justify-between items-start mb-6">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1A1A1A] leading-tight">
              {email.subject}
            </h1>
          </div>
          
          <div className="flex justify-between items-end font-mono text-xs text-gray-500 uppercase tracking-wider">
            <div>
              <span className="block text-black font-bold mb-1">{email.senderName}</span>
              <span>{email.senderEmail}</span>
            </div>
            <div>{email.date}</div>
          </div>
        </header>

        {/* The Content (Rendered HTML) */}
        <article 
          className="prose prose-lg prose-neutral max-w-none 
          prose-headings:font-bold prose-headings:tracking-tight 
          prose-p:text-gray-800 prose-p:leading-relaxed 
          prose-blockquote:border-l-2 prose-blockquote:border-[#FF4E4E] prose-blockquote:pl-4 prose-blockquote:italic"
          dangerouslySetInnerHTML={{ __html: email.body || '' }}
        />
        
        {/* Footer */}
        <div className="mt-20 pt-8 border-t border-gray-200 flex justify-center">
           <Link href="/" className="text-sm text-gray-400 hover:text-black transition-colors">
             End of Newsletter • Return to Inbox
           </Link>
        </div>

      </main>
    </div>
  );
}
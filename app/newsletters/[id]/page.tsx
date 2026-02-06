'use client';

import { MOCK_EMAILS } from '@/lib/mockData';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Archive, Star, CheckCircle } from 'lucide-react'; 
import { useState, useEffect } from 'react';

export default function NewsletterPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [email, setEmail] = useState<any>(null);

  // Simulate fetching data
  useEffect(() => {
    const found = MOCK_EMAILS.find((e) => e.id === params.id);
    setEmail(found);
  }, [params.id]);

  if (!email) {
    return <div className="p-12">Loading...</div>;
  }

  const handleFinish = () => {
    // In the real app, this will mark the email as "Done" in the database
    // For now, we simulate the satisfaction of finishing and going back
    router.back(); 
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 bg-[#F5F5F0]/95 backdrop-blur-sm border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
        <button onClick={() => router.back()} className="flex items-center text-sm font-medium hover:text-[#FF4E4E] transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
        
        <div className="flex gap-4">
          <button className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-yellow-500" title="Star / Save">
            <Star className="w-4 h-4" />
          </button>
          <button 
            onClick={handleFinish}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[#1A1A1A] hover:text-white transition-colors"
          >
            <Archive className="w-3 h-3" />
            Archive
          </button>
        </div>
      </nav>

     {/* The Content - Editorial Design */}
<article className="prose prose-lg prose-neutral max-w-none mb-24
  /* Headers */
  prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-[#1A1A1A]
  prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
  
  /* Body Text */
  prose-p:text-gray-800 prose-p:leading-8 prose-p:mb-6
  
  /* Blockquotes (The 'Swiss' Touch) */
  prose-blockquote:border-l-4 prose-blockquote:border-[#FF4E4E] 
  prose-blockquote:pl-6 prose-blockquote:py-2 prose-blockquote:my-8
  prose-blockquote:text-xl prose-blockquote:font-medium prose-blockquote:italic prose-blockquote:bg-gray-50
  
  /* Links */
  prose-a:text-[#FF4E4E] prose-a:no-underline prose-a:border-b prose-a:border-[#FF4E4E]/30 hover:prose-a:border-[#FF4E4E] hover:prose-a:bg-[#FF4E4E]/5 prose-a:transition-all
  
  /* Lists */
  prose-ul:list-disc prose-ul:pl-6 prose-li:mb-2 prose-li:marker:text-gray-300"
  
  dangerouslySetInnerHTML={{ __html: email.body || '' }}
/>

        {/* The Content */}
        <article 
          className="prose prose-lg prose-neutral max-w-none 
          prose-headings:font-bold prose-headings:tracking-tight 
          prose-p:text-gray-800 prose-p:leading-relaxed 
          prose-blockquote:border-l-2 prose-blockquote:border-[#FF4E4E] prose-blockquote:pl-4 prose-blockquote:italic"
          dangerouslySetInnerHTML={{ __html: email.body || '' }}
        />
        
        {/* "Done" Footer Action */}
        <div className="mt-20 pt-12 border-t border-gray-200 flex flex-col items-center">
           <button 
             onClick={handleFinish}
             className="group flex flex-col items-center gap-4 text-gray-400 hover:text-black transition-colors"
           >
             <CheckCircle className="w-12 h-12 stroke-1 group-hover:scale-110 transition-transform text-[#FF4E4E]" />
             <span className="text-sm font-medium tracking-widest uppercase">Finish & Return to Shelf</span>
           </button>
        </div>

      </main>
    </div>
  );
}
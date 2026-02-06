import Link from 'next/link';
import { Search, Calendar, ArrowUpRight } from 'lucide-react';

// Mocking some "Old" emails
const ARCHIVED_EMAILS = [
  { id: '201', sender: 'Dan Koe', subject: 'The Art of Focus', date: 'Jan 12', snippet: 'Why you cant concentrate on anything anymore.' },
  { id: '202', sender: 'James Clear', subject: '3-2-1: On persistence', date: 'Jan 10', snippet: 'The difference between stubbornness and persistence.' },
  { id: '203', sender: 'The Verge', subject: 'CES 2024 Recap', date: 'Jan 08', snippet: 'The weirdest gadgets we saw in Vegas.' },
  { id: '204', sender: 'Benedict Evans', subject: 'Tech in 2024', date: 'Jan 01', snippet: 'Predictions for the year ahead.' },
  { id: '205', sender: 'Huckberry', subject: 'Winter Sale', date: 'Dec 24', snippet: 'Up to 50% off flannel lined pants.' },
];

export default function ArchivePage() {
  return (
    <div className="p-8 md:p-12 min-h-screen">
      
      {/* Header */}
      <header className="mb-12 border-b border-black pb-4">
        <h1 className="text-4xl font-bold tracking-tight text-[#1A1A1A]">The Vault.</h1>
        <p className="text-sm text-gray-500 mt-1">
          Everything you have read.
        </p>
      </header>

      {/* Search Bar (Visual only for now) */}
      <div className="relative mb-12 max-w-lg">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input 
          type="text" 
          placeholder="Search for topics, authors, or keywords..." 
          className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all text-sm font-medium"
        />
      </div>

      {/* The List */}
      <div className="space-y-2">
        {ARCHIVED_EMAILS.map((email) => (
          <div key={email.id} className="group flex items-center justify-between p-4 bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer">
             
             <div className="flex-1 min-w-0 pr-8">
               <div className="flex items-center gap-3 mb-1">
                 <span className="font-bold text-sm text-gray-900">{email.sender}</span>
                 <span className="text-xs text-gray-400">•</span>
                 <span className="text-xs text-gray-500">{email.date}</span>
               </div>
               <h3 className="text-base font-medium text-black truncate group-hover:text-[#FF4E4E] transition-colors">{email.subject}</h3>
               <p className="text-sm text-gray-400 truncate mt-0.5">{email.snippet}</p>
             </div>

             <div className="opacity-0 group-hover:opacity-100 transition-opacity">
               <ArrowUpRight className="w-4 h-4 text-gray-400" />
             </div>

          </div>
        ))}
      </div>

      {/* Pagination / Load More */}
      <div className="mt-12 text-center">
        <button className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors">
          Load older issues
        </button>
      </div>

    </div>
  );
}
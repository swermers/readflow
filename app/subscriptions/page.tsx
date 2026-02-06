'use client';

import { useState } from 'react';
import { MoreHorizontal, Trash2, PauseCircle, PlayCircle, Settings } from 'lucide-react';

// Mock Data representing your "Approved" list
const INITIAL_SUBS = [
  { id: '1', name: 'Dan Koe', email: 'dan@dankoe.com', frequency: 'Weekly', status: 'Active', color: 'bg-black' },
  { id: '2', name: 'James Clear', email: 'james@jamesclear.com', frequency: 'Weekly', status: 'Active', color: 'bg-[#FF4E4E]' },
  { id: '3', name: 'The Verge', email: 'verge@theverge.com', frequency: 'Daily', status: 'Active', color: 'bg-blue-600' },
  { id: '4', name: 'Farnam Street', email: 'support@fs.blog', frequency: 'Weekly', status: 'Paused', color: 'bg-yellow-600' },
  { id: '5', name: 'Benedict Evans', email: 'benedict@ben-evans.com', frequency: 'Weekly', status: 'Active', color: 'bg-purple-600' },
];

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState(INITIAL_SUBS);

  const toggleStatus = (id: string) => {
    setSubs(subs.map(s => {
      if (s.id === id) {
        return { ...s, status: s.status === 'Active' ? 'Paused' : 'Active' };
      }
      return s;
    }));
  };

  const deleteSub = (id: string) => {
    if(confirm('Are you sure? This will remove them from your Library.')) {
      setSubs(subs.filter(s => s.id !== id));
    }
  };

  return (
    <div className="p-8 md:p-12 min-h-screen">
      
      {/* Header */}
      <header className="mb-12 border-b border-black pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[#1A1A1A]">Subscriptions.</h1>
          <p className="text-sm text-gray-500 mt-1">
            Managing {subs.length} active connections.
          </p>
        </div>
        <button className="text-xs font-bold uppercase tracking-widest bg-black text-white px-4 py-2 hover:bg-[#FF4E4E] transition-colors">
          Add Manually
        </button>
      </header>

      {/* List Container */}
      <div className="space-y-1">
        {subs.map((sub) => (
          // Responsive Row: Stack on mobile, Row on desktop
          <div key={sub.id} className="group flex flex-col md:flex-row md:items-center justify-between py-6 border-b border-gray-100 hover:bg-gray-50 transition-colors px-2 gap-4 md:gap-0">
            
            {/* Identity Section */}
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className={`w-3 h-3 rounded-full ${sub.status === 'Paused' ? 'bg-gray-300' : sub.color} flex-shrink-0`}></div>
              <div className="overflow-hidden">
                <h3 className={`text-lg font-bold truncate ${sub.status === 'Paused' ? 'text-gray-400' : 'text-black'}`}>
                  {sub.name}
                </h3>
                <p className="text-xs text-gray-400 font-mono truncate">{sub.email}</p>
              </div>
            </div>

            {/* Actions Section */}
            <div className="flex items-center justify-between md:justify-end gap-4 md:gap-8 w-full md:w-auto pl-7 md:pl-0">
              
              {/* Meta Tags */}
              <div className="flex items-center gap-4">
                <div className="hidden md:block text-xs font-medium uppercase tracking-widest text-gray-400">
                  {sub.frequency}
                </div>
                <div className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded ${sub.status === 'Active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                  {sub.status}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => toggleStatus(sub.id)}
                  className="p-2 hover:bg-white border border-transparent hover:border-gray-200 rounded-full text-gray-400 hover:text-black transition-all"
                >
                  {sub.status === 'Active' ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                </button>
                
                <button className="hidden sm:block p-2 hover:bg-white border border-transparent hover:border-gray-200 rounded-full text-gray-400 hover:text-black transition-all">
                  <Settings className="w-4 h-4" />
                </button>

                <button 
                  onClick={() => deleteSub(sub.id)}
                  className="p-2 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-full text-gray-400 hover:text-[#FF4E4E] transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        ))}
      </div>
      
    </div>
  );
}
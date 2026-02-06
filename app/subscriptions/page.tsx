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

      {/* The Management Table */}
      <div className="border-t border-gray-100">
        {subs.map((sub) => (
          <div key={sub.id} className="group flex items-center justify-between py-6 border-b border-gray-100 hover:bg-gray-50 transition-colors px-2">
            
            {/* Left: Identity */}
            <div className="flex items-center gap-4">
              {/* Color Dot */}
              <div className={`w-3 h-3 rounded-full ${sub.status === 'Paused' ? 'bg-gray-300' : sub.color}`}></div>
              
              <div>
                <h3 className={`text-lg font-bold ${sub.status === 'Paused' ? 'text-gray-400' : 'text-black'}`}>
                  {sub.name}
                </h3>
                <p className="text-xs text-gray-400 font-mono">{sub.email}</p>
              </div>
            </div>

            {/* Right: Meta & Actions */}
            <div className="flex items-center gap-8">
              
              {/* Frequency Tag */}
              <div className="hidden md:block text-xs font-medium uppercase tracking-widest text-gray-400">
                {sub.frequency}
              </div>

              {/* Status Indicator */}
              <div className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded ${sub.status === 'Active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                {sub.status}
              </div>

              {/* Action Buttons (Visible on Hover) */}
              <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                
                {/* Pause/Resume */}
                <button 
                  onClick={() => toggleStatus(sub.id)}
                  className="p-2 hover:bg-white border border-transparent hover:border-gray-200 rounded-full text-gray-400 hover:text-black transition-all"
                  title={sub.status === 'Active' ? 'Pause notifications' : 'Resume'}
                >
                  {sub.status === 'Active' ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                </button>

                {/* Settings */}
                <button className="p-2 hover:bg-white border border-transparent hover:border-gray-200 rounded-full text-gray-400 hover:text-black transition-all">
                  <Settings className="w-4 h-4" />
                </button>

                {/* Delete */}
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
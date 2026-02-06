'use client'; // <--- THIS IS CRITICAL for buttons to work

import { useState } from 'react';
import { XCircle, CheckCircle, ShieldAlert, Inbox } from 'lucide-react';

// Initial Data
const MOCK_SUSPICIOUS = [
  { id: '101', sender: 'Wayfair', email: 'shop@wayfair.com', subject: 'Your cart is expiring soon!', frequency: 'Daily', reason: 'Marketing' },
  { id: '102', sender: 'LinkedIn', email: 'invitations@linkedin.com', subject: 'You appeared in 4 searches this week', frequency: 'Weekly', reason: 'Social' },
  { id: '103', sender: 'Unknown', email: 'newsletter@random-growth.com', subject: '10x your leads with this trick', frequency: 'First time', reason: 'Spam Risk' },
];

export default function ReviewPage() {
  const [senders, setSenders] = useState(MOCK_SUSPICIOUS);
  const [history, setHistory] = useState<string[]>([]);

  // Function to handle the decision
  const handleDecision = (id: string, action: 'blocked' | 'allowed') => {
    // 1. Remove from list
    setSenders(prev => prev.filter(item => item.id !== id));
    
    // 2. Add to local history log (just for feedback)
    const item = senders.find(i => i.id === id);
    if (item) {
      setHistory(prev => [`${action === 'blocked' ? 'Unsubscribed from' : 'Approved'} ${item.sender}`, ...prev]);
    }
  };

  return (
    <div className="p-8 md:p-12 min-h-screen flex flex-col">
      
      {/* Header */}
      <header className="mb-12 border-b border-black pb-4">
        <h1 className="text-4xl font-bold tracking-tight text-[#1A1A1A]">Gatekeeper.</h1>
        <p className="text-sm text-gray-500 mt-1">
          {senders.length} senders remaining.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* Left Column: The Active Queue */}
        <div className="space-y-6">
          
          {/* Empty State (When you finish) */}
          {senders.length === 0 && (
            <div className="py-12 text-center bg-gray-50 border border-dashed border-gray-300">
               <div className="mx-auto w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                 <Inbox className="w-6 h-6" />
               </div>
               <h3 className="font-bold text-gray-900">All Clean</h3>
               <p className="text-sm text-gray-500">No new senders to review.</p>
            </div>
          )}

          {/* The Cards */}
          {senders.map((item) => (
            <div key={item.id} className="bg-white border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {item.reason === 'Spam Risk' && (
                <div className="absolute top-0 right-0 bg-[#FF4E4E] text-white text-[10px] font-bold px-2 py-1 uppercase tracking-widest">
                  High Risk
                </div>
              )}

              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-black">{item.sender}</h3>
                  <div className="text-xs text-gray-400 font-mono mt-1">{item.email}</div>
                </div>
              </div>

              <div className="bg-gray-50 p-3 mb-6 border-l-2 border-gray-200 text-sm text-gray-600 italic">
                "{item.subject}"
              </div>

              {/* Interactive Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => handleDecision(item.id, 'blocked')}
                  className="flex items-center justify-center gap-2 py-2.5 border border-[#FF4E4E] text-[#FF4E4E] hover:bg-[#FF4E4E] hover:text-white transition-colors text-xs font-bold uppercase tracking-wider"
                >
                  <XCircle className="w-4 h-4" />
                  Unsubscribe
                </button>
                <button 
                  onClick={() => handleDecision(item.id, 'allowed')}
                  className="flex items-center justify-center gap-2 py-2.5 border border-gray-200 text-gray-600 hover:border-black hover:text-black transition-colors text-xs font-bold uppercase tracking-wider"
                >
                  <CheckCircle className="w-4 h-4" />
                  Allow
                </button>
              </div>

            </div>
          ))}
        </div>

        {/* Right Column: Feedback Log */}
        <div className="hidden lg:block space-y-8">
           {/* Static Explainer */}
           <div className="p-8 bg-[#F5F5F0]">
              <div className="flex items-center gap-2 text-[#FF4E4E] mb-4">
                <ShieldAlert className="w-5 h-5" />
                <span className="font-bold text-sm uppercase tracking-widest">Protection Active</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                Readflow acts as a firewall for your attention.
              </p>
           </div>

           {/* Dynamic History Log */}
           {history.length > 0 && (
             <div className="border-t border-gray-200 pt-8 animate-in fade-in">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Just processed</h4>
                <ul className="space-y-3">
                  {history.map((action, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                       <span className="w-1.5 h-1.5 bg-gray-300 rounded-full"></span>
                       {action}
                    </li>
                  ))}
                </ul>
             </div>
           )}
        </div>

      </div>
    </div>
  );
}
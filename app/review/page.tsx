'use client';

import { useState } from 'react';
import { XCircle, Plus, ShieldAlert, Inbox, BookOpen } from 'lucide-react';

// Mixed data: Some are good newsletters, some are junk
const INCOMING_QUEUE = [
  { 
    id: '101', 
    sender: 'Morning Brew', 
    email: 'crew@morningbrew.com', 
    subject: 'Markets tumble as tech stocks...', 
    frequency: 'Daily', 
    type: 'Newsletter', // Good
    reason: 'New Subscription' 
  },
  { 
    id: '102', 
    sender: 'Wayfair', 
    email: 'shop@wayfair.com', 
    subject: 'Your cart is expiring soon!', 
    frequency: 'Daily', 
    type: 'Marketing', // Bad
    reason: 'Spam Risk' 
  },
  { 
    id: '103', 
    sender: 'Lenny Rachitsky', 
    email: 'lenny@substack.com', 
    subject: 'How to hire a PM in 2024', 
    frequency: 'Weekly', 
    type: 'Newsletter', // Good
    reason: 'New Subscription' 
  },
];

export default function ReviewPage() {
  const [queue, setQueue] = useState(INCOMING_QUEUE);
  const [history, setHistory] = useState<string[]>([]);

  // Function to handle the decision
  const handleDecision = (id: string, action: 'blocked' | 'approved', name: string) => {
    // 1. Remove from list
    setQueue(prev => prev.filter(item => item.id !== id));
    
    // 2. Add to local history log for feedback
    const message = action === 'blocked' 
      ? `Unsubscribed from ${name}` 
      : `Added ${name} to Library`;
      
    setHistory(prev => [message, ...prev]);
  };

  return (
    <div className="p-8 md:p-12 min-h-screen flex flex-col">
      
      {/* Header */}
      <header className="mb-12 border-b border-black pb-4">
        <h1 className="text-4xl font-bold tracking-tight text-[#1A1A1A]">Gatekeeper.</h1>
        <p className="text-sm text-gray-500 mt-1">
          {queue.length} new senders waiting for approval.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* Left Column: The Active Queue */}
        <div className="space-y-6">
          
          {/* Empty State */}
          {queue.length === 0 && (
            <div className="py-16 text-center bg-gray-50 border border-dashed border-gray-300 rounded-lg">
               <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                 <Inbox className="w-8 h-8" />
               </div>
               <h3 className="font-bold text-xl text-gray-900 mb-2">Queue Cleared</h3>
               <p className="text-gray-500">Your perimeter is secure.</p>
            </div>
          )}

          {/* The Cards */}
          {queue.map((item) => (
            <div key={item.id} className="bg-white border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 group">
              
              {/* Type Badge */}
              <div className="absolute top-0 right-0 px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-gray-100 text-gray-500">
                {item.type}
              </div>

              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-xl text-black group-hover:text-[#FF4E4E] transition-colors">{item.sender}</h3>
                  <div className="text-xs text-gray-400 font-mono mt-0.5">{item.email}</div>
                </div>
              </div>

              <div className="bg-[#F5F5F0] p-4 mb-6 border-l-2 border-gray-300 text-sm text-gray-700 font-medium italic mt-4">
                "{item.subject}"
              </div>

              {/* Decision Buttons */}
              <div className="grid grid-cols-2 gap-4">
                
                {/* Block Button */}
                <button 
                  onClick={() => handleDecision(item.id, 'blocked', item.sender)}
                  className="flex items-center justify-center gap-2 py-3 border border-red-100 text-red-400 bg-red-50 hover:bg-[#FF4E4E] hover:text-white hover:border-[#FF4E4E] transition-all text-xs font-bold uppercase tracking-wider rounded-sm"
                >
                  <XCircle className="w-4 h-4" />
                  Block
                </button>
                
                {/* Approve Button */}
                <button 
                  onClick={() => handleDecision(item.id, 'approved', item.sender)}
                  className="flex items-center justify-center gap-2 py-3 bg-[#1A1A1A] text-white border border-[#1A1A1A] hover:bg-white hover:text-[#1A1A1A] transition-all text-xs font-bold uppercase tracking-wider rounded-sm shadow-lg shadow-black/10"
                >
                  <Plus className="w-4 h-4" />
                  Add to Library
                </button>
              </div>

            </div>
          ))}
        </div>

        {/* Right Column: Feedback Log */}
        <div className="hidden lg:block space-y-8">
           
           {/* Explainer */}
           <div className="p-8 bg-[#F5F5F0] border border-gray-100">
              <div className="flex items-center gap-2 text-[#FF4E4E] mb-4">
                <ShieldAlert className="w-5 h-5" />
                <span className="font-bold text-sm uppercase tracking-widest">Protocol</span>
              </div>
              <ul className="text-sm text-gray-600 space-y-4">
                <li className="flex gap-3">
                  <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                  <span><strong>Block:</strong> We unsubscribe you and delete the email. You never see them again.</span>
                </li>
                <li className="flex gap-3">
                  <BookOpen className="w-5 h-5 text-gray-800 shrink-0" />
                  <span><strong>Add to Library:</strong> We create a dedicated Tile on your home screen for this sender.</span>
                </li>
              </ul>
           </div>

           {/* Live History Log */}
           {history.length > 0 && (
             <div className="border-t border-gray-200 pt-8 animate-in fade-in">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Activity Log</h4>
                <ul className="space-y-3">
                  {history.map((action, i) => (
                    <li key={i} className="text-sm text-black font-medium flex items-center gap-3">
                       <span className={`w-2 h-2 rounded-full ${action.includes('Added') ? 'bg-green-500' : 'bg-red-500'}`}></span>
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
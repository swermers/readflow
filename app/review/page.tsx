import Link from 'next/link';
import { XCircle, CheckCircle, ShieldAlert } from 'lucide-react';

const SUSPICIOUS_SENDERS = [
  { id: '101', sender: 'Wayfair', email: 'shop@wayfair.com', subject: 'Your cart is expiring soon!', frequency: 'Daily', reason: 'Marketing' },
  { id: '102', sender: 'LinkedIn', email: 'invitations@linkedin.com', subject: 'You appeared in 4 searches this week', frequency: 'Weekly', reason: 'Social' },
  { id: '103', sender: 'Unknown', email: 'newsletter@random-growth.com', subject: '10x your leads with this trick', frequency: 'First time', reason: 'Spam Risk' },
];

export default function ReviewPage() {
  return (
    <div className="p-8 md:p-12 h-screen flex flex-col">
      
      {/* Header */}
      <header className="mb-12 border-b border-black pb-4">
        <h1 className="text-4xl font-bold tracking-tight text-[#1A1A1A]">Gatekeeper.</h1>
        <p className="text-sm text-gray-500 mt-1">
          Reviewing 3 new senders.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* The Scanner List */}
        <div className="space-y-6">
          {SUSPICIOUS_SENDERS.map((item) => (
            <div key={item.id} className="bg-white border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              
              {/* Red Warning Strip for Spam Risk */}
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

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button className="flex items-center justify-center gap-2 py-2.5 border border-[#FF4E4E] text-[#FF4E4E] hover:bg-[#FF4E4E] hover:text-white transition-colors text-xs font-bold uppercase tracking-wider">
                  <XCircle className="w-4 h-4" />
                  Unsubscribe
                </button>
                <button className="flex items-center justify-center gap-2 py-2.5 border border-gray-200 text-gray-600 hover:border-black hover:text-black transition-colors text-xs font-bold uppercase tracking-wider">
                  <CheckCircle className="w-4 h-4" />
                  Allow
                </button>
              </div>

            </div>
          ))}
        </div>

        {/* Explainer Panel */}
        <div className="hidden lg:block p-8 bg-[#F5F5F0] h-fit">
          <div className="flex items-center gap-2 text-[#FF4E4E] mb-4">
            <ShieldAlert className="w-5 h-5" />
            <span className="font-bold text-sm uppercase tracking-widest">Protection Active</span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Readflow acts as a firewall for your attention.
          </p>
          <ul className="text-sm text-gray-500 space-y-2 list-disc pl-4">
            <li>Unsubscribing here removes them forever.</li>
            <li>Allowed senders move to your Reading List.</li>
            <li>We auto-flag senders with high frequency.</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
import Link from 'next/link';
import { XCircle, CheckCircle, MinusCircle } from 'lucide-react'; // Icons for the actions

const SUSPICIOUS_SENDERS = [
  { id: '101', sender: 'Wayfair', email: 'shop@wayfair.com', subject: 'Your cart is expiring soon!', frequency: 'Daily' },
  { id: '102', sender: 'LinkedIn', email: 'invitations@linkedin.com', subject: 'You appeared in 4 searches this week', frequency: 'Weekly' },
  { id: '103', sender: 'Unknown', email: 'newsletter@random-growth-hacks.com', subject: '10x your leads with this trick', frequency: 'First time' },
];

export default function ReviewPage() {
  return (
    <div className="p-8 md:p-12 h-screen flex flex-col">
      
      {/* Header */}
      <header className="mb-12 border-b border-black pb-4">
        <h1 className="text-4xl font-bold tracking-tight text-[#1A1A1A]">Incoming Review.</h1>
        <p className="text-sm text-gray-500 mt-1">
          3 new senders found. Decide who enters your Reading List.
        </p>
      </header>

      {/* The Scanner Interface */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        
        {/* Left Column: The Card Stack */}
        <div className="space-y-6">
          {SUSPICIOUS_SENDERS.map((item, index) => (
            <div key={item.id} className="group relative p-8 bg-white border border-gray-200 shadow-xl shadow-black/5 hover:border-[#FF4E4E] transition-colors">
              
              <div className="flex justify-between items-start mb-6">
                 <div>
                   <h2 className="text-xl font-bold text-black">{item.sender}</h2>
                   <p className="font-mono text-xs text-gray-400 mt-1">{item.email}</p>
                 </div>
                 <div className="px-2 py-1 bg-gray-100 text-xs font-bold uppercase tracking-wider rounded">
                   {item.frequency}
                 </div>
              </div>

              <div className="mb-8">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-widest mb-2">Latest Subject:</p>
                <p className="text-lg italic">"{item.subject}"</p>
              </div>

              {/* The "Spam Killer" Actions */}
              <div className="grid grid-cols-2 gap-4">
                <button className="flex items-center justify-center gap-2 py-3 bg-[#FFF0F0] text-[#FF4E4E] font-bold text-sm uppercase tracking-wider hover:bg-[#FF4E4E] hover:text-white transition-colors">
                  <XCircle className="w-4 h-4" />
                  Unsubscribe
                </button>
                <button className="flex items-center justify-center gap-2 py-3 bg-[#F0FFF4] text-[#00A86B] font-bold text-sm uppercase tracking-wider hover:bg-[#00A86B] hover:text-white transition-colors">
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </button>
              </div>
              
            </div>
          ))}
        </div>

        {/* Right Column: Explainer (Swiss Style) */}
        <div className="hidden md:block pt-8 text-gray-400 text-sm leading-relaxed max-w-xs">
          <p className="mb-6">
            <strong className="text-black block mb-2">The Gatekeeper</strong>
            This is your firewall. These senders are trying to reach your Reading List.
          </p>
          <p className="mb-6">
            <strong className="text-[#FF4E4E] block mb-2">Unsubscribe</strong>
            We will automatically handle the unsubscribe request and block future emails.
          </p>
          <p>
            <strong className="text-black block mb-2">Approve</strong>
            They will be added to your "Subscriptions" and future issues will appear in your Reading List.
          </p>
        </div>

      </div>
    </div>
  );
}
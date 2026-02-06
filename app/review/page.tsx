import Link from 'next/link';

// Mocking some "Unsure" emails just for this view
const UNSURE_EMAILS = [
  { id: '101', sender: 'Huckberry', subject: 'The 10 Best Boots for Winter', snippet: 'Plus: A secret sale on flannels.', date: 'Today' },
  { id: '102', sender: 'LinkedIn', subject: 'You appeared in 4 searches', snippet: 'See who is looking at your profile this week.', date: 'Yesterday' },
  { id: '103', sender: 'Local Utility', subject: 'Your Statement is Ready', snippet: 'Bill period: Jan 01 - Feb 01. Amount due...', date: 'Feb 04' },
];

export default function ReviewPage() {
  return (
    <div className="p-8 md:p-12 h-screen flex flex-col">
      
      {/* Header */}
      <header className="mb-12 border-b border-black pb-4">
        <h1 className="text-4xl font-bold tracking-tight text-[#1A1A1A]">Review Queue.</h1>
        <p className="text-sm text-gray-500 mt-1">3 emails need classification</p>
      </header>

      {/* The Queue Card Stack */}
      <div className="flex-1 max-w-2xl">
        {UNSURE_EMAILS.map((email, index) => (
          <div key={email.id} className="mb-6 p-6 bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg">{email.sender}</h3>
                <p className="text-gray-500 text-xs uppercase tracking-wider">{email.date}</p>
              </div>
              {/* Index Number (Swiss touch) */}
              <span className="font-mono text-xs text-gray-300">0{index + 1}</span>
            </div>

            <p className="font-medium mb-1">{email.subject}</p>
            <p className="text-gray-500 text-sm mb-8">{email.snippet}</p>

            {/* Action Buttons - The "Sorting" Interface */}
            <div className="grid grid-cols-3 gap-4 border-t border-gray-100 pt-6">
              <button className="text-xs font-bold uppercase tracking-widest py-3 hover:bg-red-50 hover:text-red-600 transition-colors text-left">
                x Delete
              </button>
              <button className="text-xs font-bold uppercase tracking-widest py-3 hover:bg-blue-50 hover:text-blue-600 transition-colors text-center border-x border-gray-100">
                + Newsletter
              </button>
              <button className="text-xs font-bold uppercase tracking-widest py-3 hover:bg-green-50 hover:text-green-600 transition-colors text-right">
                ✓ Personal
              </button>
            </div>

          </div>
        ))}
      </div>

      {/* Done State (Hidden for now, but part of the design) */}
      <div className="hidden items-center justify-center h-64 text-gray-400">
        <span className="tracking-widest uppercase text-sm">All Clear</span>
      </div>

    </div>
  );
}
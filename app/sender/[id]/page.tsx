import { MOCK_EMAILS, MOCK_SUBSCRIPTIONS } from '@/lib/mockData';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';

export default function SenderPage({ params }: { params: { id: string } }) {
  // 1. Find the Sender details (Simulated lookup)
  // In a real app, we'd filter emails by this sender ID. 
  // For now, we just grab a random subscription name to show in the header.
  const subscription = MOCK_SUBSCRIPTIONS.find(s => s.id === params.id) || MOCK_SUBSCRIPTIONS[0];

  // 2. Filter Mock Emails (Just simulating that we have 3 emails for this person)
  const senderEmails = MOCK_EMAILS.slice(0, 3); 

  return (
    <div className="p-8 md:p-12 min-h-screen bg-[#F5F5F0]">
      
      {/* Back Navigation */}
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-black transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Rack
        </Link>
      </div>

      {/* Header */}
      <header className="mb-12">
        <h1 className="text-5xl font-bold tracking-tight text-[#1A1A1A] mb-2">{subscription.name}</h1>
        <p className="text-gray-500">3 unread issues waiting for you.</p>
      </header>

      {/* The Issue List */}
      <div className="space-y-4 max-w-3xl">
        {senderEmails.map((email) => (
          <Link href={`/newsletters/${email.id}`} key={email.id}>
            <div className="group bg-white p-6 border border-gray-200 hover:border-black hover:shadow-lg transition-all cursor-pointer flex items-center justify-between">
              
              <div>
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#FF4E4E] transition-colors mb-2">
                  {email.subject}
                </h3>
                <p className="text-sm text-gray-500 line-clamp-1">{email.snippet}</p>
              </div>

              <div className="text-right pl-6">
                 <div className="flex items-center gap-1 text-xs text-gray-400 font-mono mb-1 justify-end">
                   <Clock className="w-3 h-3" />
                   {email.date}
                 </div>
                 <span className="inline-block px-2 py-1 bg-gray-100 text-[10px] font-bold uppercase tracking-widest rounded">
                   12 min read
                 </span>
              </div>

            </div>
          </Link>
        ))}
      </div>

    </div>
  );
}
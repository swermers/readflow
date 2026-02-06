import { MOCK_EMAILS } from '@/lib/mockData';

export default function Home() {
  return (
    <main className="p-8 md:p-12">

      {/* Header */}
      <header className="mb-16 border-b border-black pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[#1A1A1A]">Readflow.</h1>
          <p className="text-sm text-gray-500 uppercase tracking-widest mt-1">Leysin, Switzerland</p>
        </div>
        {/* Counter */}
        <div className="text-5xl font-light text-[#FF4E4E]">
          {MOCK_EMAILS.filter(e => !e.read).length}
        </div>
      </header>

      {/* Email List */}
      <div className="space-y-0">
        {MOCK_EMAILS.map((email) => (
          <div key={email.id} className="group grid grid-cols-12 gap-4 py-5 border-b border-gray-100 hover:bg-gray-50 transition-all cursor-pointer items-baseline">

            {/* Sender */}
            <div className="col-span-12 md:col-span-3 font-bold text-sm text-[#1A1A1A] flex items-center">
              {email.senderName || "Unknown Sender"}
              {!email.read && <span className="ml-2 w-1.5 h-1.5 bg-[#FF4E4E] rounded-full"></span>}
            </div>

            {/* Subject & Snippet */}
            <div className="col-span-12 md:col-span-7 text-sm">
              <span className="font-semibold text-black mr-2">{email.subject}</span>
              <span className="text-gray-400 font-light line-clamp-1">{email.snippet}</span>
            </div>

            {/* Date */}
            <div className="col-span-12 md:col-span-2 text-right text-xs text-gray-300 font-mono group-hover:text-black transition-colors">
              {email.date}
            </div>
          </div>
        ))}
      </div>

    </main>
  )
}
import { MOCK_SUBSCRIPTIONS } from '@/lib/mockData';
import Link from 'next/link';

export default function Home() {
  return (
    <div className={`group relative h-64 border border-gray-200 bg-white 
  hover:-translate-y-1 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] 
  hover:border-[#FF4E4E] transition-all duration-300 ease-out 
  cursor-pointer flex flex-col justify-between p-6 
  ${sub.count === 0 ? 'opacity-60 grayscale hover:grayscale-0 hover:opacity-100' : ''}`}
>
    
</div>
    <div className="p-8 md:p-12">
      
      {/* Header */}
      <header className="mb-12 border-b border-black pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[#1A1A1A]">The Rack.</h1>
          <p className="text-sm text-gray-500 uppercase tracking-widest mt-1">Your Library</p>
        </div>
      </header>

      {/* The Magazine Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {MOCK_SUBSCRIPTIONS.map((sub) => (
          <Link href={`/sender/${sub.id}`} key={sub.id}>
            <div className={`group relative h-64 border border-gray-200 bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between p-6 ${sub.count === 0 ? 'opacity-60 grayscale' : ''}`}>
              
              {/* Top Row: Status */}
              <div className="flex justify-between items-start">
                <div className={`w-3 h-3 rounded-full ${sub.count > 0 ? 'bg-[#FF4E4E] animate-pulse' : 'bg-gray-200'}`}></div>
                <span className="font-mono text-xs text-gray-400">{sub.lastReceived}</span>
              </div>

              {/* Middle: Name (Big Typography) */}
              <div>
                <h2 className="text-3xl font-bold leading-none tracking-tight text-gray-900 group-hover:text-[#FF4E4E] transition-colors">
                  {sub.name}
                </h2>
              </div>

              {/* Bottom: Count Badge */}
              <div className="flex justify-between items-end border-t border-gray-100 pt-4">
                 <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Unread Issues</span>
                 <span className="text-2xl font-light text-black">
                   {sub.count}
                 </span>
              </div>

            </div>
          </Link>
        ))}

        {/* "Add New" Ghost Tile */}
        <Link href="/review">
          <div className="h-64 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-300 hover:border-gray-400 hover:text-gray-500 transition-colors cursor-pointer">
            <span className="text-4xl font-light mb-2">+</span>
            <span className="text-xs font-bold uppercase tracking-widest">Add Feed</span>
          </div>
        </Link>

      </div>
      
    </div>
  )
}
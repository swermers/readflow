import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'; 

export const metadata: Metadata = {
  title: 'Readflow',
  description: 'Swiss precision for your inbox.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-[#F5F5F0]">
        
        {/* The Swiss Grid Container */}
        <div className="min-h-screen grid grid-cols-12 gap-4 max-w-[1400px] mx-auto p-6 border-x border-[#E5E5E5] bg-white shadow-2xl shadow-black/5">
          
          {/* Sidebar (Left 2 cols) */}
          <aside className="col-span-12 md:col-span-2 hidden md:block pt-12 border-r border-[#E5E5E5] pr-6">
             <div className="mb-12">
               {/* Small Red Accent Line */}
               <div className="h-1 w-8 bg-[#FF4E4E] mb-6"></div> 
               <div className="font-bold text-sm tracking-widest text-gray-400 uppercase">Readflow</div>
             </div>
             
             {/* Navigation Links */}
             <nav className="space-y-6 text-sm font-medium text-gray-500">
               {/* The Main Feed */}
               <Link href="/" className="block text-black hover:translate-x-1 transition-transform">
                 Reading List
               </Link>
               
               {/* The Gatekeeper */}
               <Link href="/review" className="block hover:text-black hover:translate-x-1 transition-transform">
                 New Senders <span className="text-xs bg-[#FF4E4E]/10 text-[#FF4E4E] px-1.5 py-0.5 rounded ml-2">3</span>
               </Link>
               
               <div className="pt-6 border-t border-gray-100">
                  <div className="mb-4 text-xs font-bold tracking-widest text-gray-300 uppercase">Library</div>
                  <Link href="#" className="block hover:text-black hover:translate-x-1 transition-transform mb-3">
                    Subscriptions
                  </Link>
                  <Link href="#" className="block hover:text-black hover:translate-x-1 transition-transform">
                    Archive
                  </Link>
               </div>
             </nav>
          </aside>

          {/* Main Content (Right 10 cols) */}
          <main className="col-span-12 md:col-span-10 pt-4 md:pt-0 md:pl-8 min-h-[80vh]">
            {children}
          </main>
          
        </div>
      </body>
    </html>
  )
}
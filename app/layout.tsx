import './globals.css'
import type { Metadata } from 'next'
import Sidebar from '@/components/Sidebar'; // <--- Import the new component

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
          
          {/* The Smart Sidebar */}
          <Sidebar />

          {/* Main Content */}
          <main className="col-span-12 md:col-span-10 pt-4 md:pt-0 md:pl-8 min-h-[80vh]">
            {children}
          </main>
          
        </div>
      </body>
    </html>
  )
}
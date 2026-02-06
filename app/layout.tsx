import './globals.css'
import type { Metadata } from 'next'

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
      <body className="min-h-screen antialiased">
        {/* The Main Grid Layout */}
        <div className="max-w-[1400px] mx-auto bg-white min-h-screen shadow-2xl shadow-black/5 border-x border-gray-200">
          {children}
        </div>
      </body>
    </html>
  )
}
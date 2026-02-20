'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from "@/components/Sidebar";
import MobileBottomNav from '@/components/MobileBottomNav';
import { GlobalAudioPlayerProvider } from '@/components/GlobalAudioPlayer';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <GlobalAudioPlayerProvider>
      <div className="flex min-h-screen bg-surface">
        {/* Mobile hamburger */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed right-4 top-4 z-50 rounded-xl border border-line bg-surface p-2.5 shadow-sm md:hidden"
        >
          <Menu className="w-5 h-5 text-ink" />
        </button>

        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-h-screen flex-1 pb-28 pt-14 md:ml-[260px] md:pb-0 md:pt-0">
          {children}
        </main>
        <MobileBottomNav />
      </div>
    </GlobalAudioPlayerProvider>
  );
}

'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 bg-surface-raised border border-line rounded-lg shadow-sm md:hidden"
      >
        <Menu className="w-5 h-5 text-ink" />
      </button>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 ml-0 md:ml-[260px] pt-14 md:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}

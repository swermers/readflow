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
    <div className="flex min-h-screen bg-white">
      {/* Mobile hamburger button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 bg-white border border-gray-200 rounded-lg shadow-sm md:hidden"
      >
        <Menu className="w-5 h-5 text-[#1A1A1A]" />
      </button>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 ml-0 md:ml-64 pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}

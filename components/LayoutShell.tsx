'use client';

import { usePathname } from 'next/navigation';
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === '/landing';

  if (isLanding) {
    return (
      <>
        <Toast />
        {children}
      </>
    );
  }

  return (
    <>
      <Toast />
      <div className="max-w-[1600px] mx-auto min-h-screen bg-white shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
        <Sidebar />
        <main className="col-span-1 md:col-span-10 h-screen overflow-y-auto bg-white">
          {children}
        </main>
      </div>
    </>
  );
}
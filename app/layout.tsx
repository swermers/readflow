import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Readflow",
  description: "Your curated newsletter library.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#F5F5F0] text-[#1A1A1A]`}>
        <Toast /> {/* This is the hidden notification system */}
        
        <div className="max-w-[1600px] mx-auto min-h-screen bg-white shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
          <Sidebar />
          <main className="col-span-1 md:col-span-10 h-screen overflow-y-auto bg-white">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
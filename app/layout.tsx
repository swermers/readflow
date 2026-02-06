import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import LayoutShell from "@/components/LayoutShell"; // We'll create this

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
        {/* We move the sidebar logic into a client component */}
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
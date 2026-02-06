'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, Filter, Library } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-black selection:bg-[#FF4E4E] selection:text-white">
      
      {/* Minimal Navigation */}
      <nav className="flex justify-between items-center px-6 py-8 md:px-12">
        <div className="flex items-center gap-4">
          <div className="h-1 w-8 bg-[#FF4E4E]"></div>
          <span className="font-bold uppercase tracking-[0.3em] text-sm">Readflow</span>
        </div>
        <Link 
          href="/" 
          className="text-xs font-bold uppercase tracking-widest border-b-2 border-black pb-1 hover:text-[#FF4E4E] hover:border-[#FF4E4E] transition-all"
        >
          Open App
        </Link>
      </nav>

      {/* Hero Section */}
      <main className="px-6 md:px-12 pt-20 pb-32 max-w-6xl">
        <h1 className="text-6xl md:text-8xl font-bold tracking-tight leading-[0.95] mb-8">
          The quiet place <br />
          for your <span className="text-[#FF4E4E]">reading.</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-500 max-w-2xl leading-relaxed mb-12">
          Your inbox is for work, bills, and chaos. Readflow is a dedicated space for the writers you actually want to hear from.
        </p>

        <Link href="/">
          <button className="group flex items-center gap-4 bg-black text-white px-8 py-6 font-bold uppercase tracking-widest text-sm hover:bg-[#FF4E4E] transition-all">
            Enter your Library
            <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
          </button>
        </Link>
      </main>

      {/* The Philosophy (Grid) */}
      <section className="px-6 md:px-12 py-24 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-12">
        
        <div className="space-y-6">
          <div className="w-12 h-12 bg-gray-50 flex items-center justify-center border border-gray-100">
            <Filter className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold uppercase tracking-tight">01. Invite Only</h3>
          <p className="text-gray-500 leading-relaxed">
            New senders wait in the lobby. You decide if they are worth your time before they ever reach your shelf.
          </p>
        </div>

        <div className="space-y-6">
          <div className="w-12 h-12 bg-gray-50 flex items-center justify-center border border-gray-100">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold uppercase tracking-tight">02. Reading, Refined</h3>
          <p className="text-gray-500 leading-relaxed">
            No clutter. No "Mark as Unread." Just a clean, editorial view designed for deep focus and comprehension.
          </p>
        </div>

        <div className="space-y-6">
          <div className="w-12 h-12 bg-gray-50 flex items-center justify-center border border-gray-100">
            <Library className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold uppercase tracking-tight">03. Build a Legacy</h3>
          <p className="text-gray-500 leading-relaxed">
            Don't let great ideas get buried in email threads. Save your favorite issues to a permanent, searchable archive.
          </p>
        </div>

      </section>

      {/* Minimal Footer */}
      <footer className="px-6 md:px-12 py-12 flex flex-col md:flex-row justify-between items-center border-t border-gray-100 gap-8">
        <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-300">
          Curated for clarity. © 2026 Readflow.
        </div>
      </footer>

    </div>
  );
}
'use client';

import Link from 'next/link';
import { ArrowRight, ShieldCheck, Layout, Archive, Zap } from 'lucide-react';

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
        <h1 className="text-6xl md:text-8xl font-bold tracking-tight leading-[0.9] mb-8">
          Your inbox is a <br />
          <span className="text-[#FF4E4E]">battleground.</span> <br />
          This is the DMZ.
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-500 max-w-2xl leading-relaxed mb-12">
          Readflow is a minimalist sanctuary for your newsletters. No ads, no tracking, and no "Unsubscribe" buttons you have to hunt for. Just you and the writers you love.
        </p>

        <Link href="/">
          <button className="group flex items-center gap-4 bg-black text-white px-8 py-6 font-bold uppercase tracking-widest text-sm hover:bg-[#FF4E4E] transition-all">
            Start your library
            <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
          </button>
        </Link>
      </main>

      {/* The Philosophy (Grid) */}
      <section className="px-6 md:px-12 py-24 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-12">
        
        <div className="space-y-6">
          <div className="w-12 h-12 bg-gray-50 flex items-center justify-center border border-gray-100">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold uppercase tracking-tight">01. The Gatekeeper</h3>
          <p className="text-gray-500 leading-relaxed">
            Every new sender hits the gate first. You approve them once, or they never reach your rack. You are the algorithm.
          </p>
        </div>

        <div className="space-y-6">
          <div className="w-12 h-12 bg-gray-50 flex items-center justify-center border border-gray-100">
            <Layout className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold uppercase tracking-tight">02. The Rack</h3>
          <p className="text-gray-500 leading-relaxed">
            A visual, editorial interface designed for deep focus. No "Mark as Read" anxiety. Just a beautiful shelf of knowledge.
          </p>
        </div>

        <div className="space-y-6">
          <div className="w-12 h-12 bg-gray-50 flex items-center justify-center border border-gray-100">
            <Archive className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold uppercase tracking-tight">03. The Archive</h3>
          <p className="text-gray-500 leading-relaxed">
            Build your own personal library of insights. Searchable, permanent, and perfectly indexed for future reference.
          </p>
        </div>

      </section>

      {/* Social Proof / Trust */}
      <section className="bg-black text-white px-6 md:px-12 py-32 text-center">
        <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-12">
          "The most intentional reading <br /> experience on the web."
        </h2>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700"></div>
          <div>
            <p className="font-bold uppercase tracking-widest text-xs">A. Minimalist</p>
            <p className="text-gray-500 text-[10px] uppercase tracking-widest mt-1">Founding Member</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-12 flex flex-col md:flex-row justify-between items-center border-t border-gray-100 gap-8">
        <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-300">
          Built for the focused. © 2024 Readflow.
        </div>
        <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest">
          <a href="#" className="hover:text-[#FF4E4E]">Twitter</a>
          <a href="#" className="hover:text-[#FF4E4E]">Privacy</a>
          <a href="#" className="hover:text-[#FF4E4E]">Manifesto</a>
        </div>
      </footer>

    </div>
  );
}
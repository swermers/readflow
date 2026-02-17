'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, Filter, Library, ShieldCheck, Sparkles, Workflow } from 'lucide-react';

const featureRows = [
  {
    title: 'Signal over noise',
    body: 'Approve trusted senders, block the rest, and keep your reading environment intentional.',
    icon: Filter,
  },
  {
    title: 'A true reading workflow',
    body: 'Move issues from the Rack to Library to Archive with one click, and stay focused on what matters now.',
    icon: Workflow,
  },
  {
    title: 'Highlight and remember',
    body: 'Capture important passages from longform issues and keep your notes attached to the original article.',
    icon: Sparkles,
  },
  {
    title: 'Your private knowledge shelf',
    body: 'Build a personal library of the ideas you actually want to revisit later.',
    icon: Library,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-black selection:bg-[#FF4E4E] selection:text-white">
      <nav className="flex justify-between items-center px-6 py-8 md:px-12">
        <div className="flex items-center gap-4">
          <div className="h-1 w-8 bg-[#FF4E4E]" />
          <span className="font-bold uppercase tracking-[0.3em] text-sm">Readflow</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/privacy" className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-[#FF4E4E] transition-all">Privacy</Link>
          <Link href="/terms" className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-[#FF4E4E] transition-all">Terms</Link>
          <Link
            href="/"
            className="text-xs font-bold uppercase tracking-widest border-b-2 border-black pb-1 hover:text-[#FF4E4E] hover:border-[#FF4E4E] transition-all"
          >
            Open App
          </Link>
        </div>
      </nav>

      <main className="px-6 md:px-12 pt-16 pb-24 max-w-6xl">
        <h1 className="text-5xl md:text-8xl font-bold tracking-tight leading-[0.95] mb-8">
          A calm home for your <span className="text-[#FF4E4E]">newsletter reading.</span>
        </h1>

        <p className="text-xl md:text-2xl text-gray-500 max-w-3xl leading-relaxed mb-10">
          Readflow transforms the chaos of an inbox into a focused reading practice. Import the writers you care about,
          curate what deserves your attention, and keep every insight organized in one beautiful library.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <Link href="/">
            <button className="group flex items-center gap-4 bg-black text-white px-8 py-6 font-bold uppercase tracking-widest text-sm hover:bg-[#FF4E4E] transition-all">
              Enter your Library
              <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
            </button>
          </Link>
        </div>
      </main>

      <section className="px-6 md:px-12 py-20 border-t border-gray-100">
        <div className="max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8">
          {featureRows.map((item) => (
            <article key={item.title} className="space-y-5 border border-gray-100 bg-gray-50/70 p-6">
              <div className="w-12 h-12 bg-white flex items-center justify-center border border-gray-100">
                <item.icon className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold uppercase tracking-tight">{item.title}</h3>
              <p className="text-gray-500 leading-relaxed">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-6 md:px-12 py-20 border-t border-gray-100 max-w-6xl">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">Built for deep readers, not inbox triage.</h2>
        <p className="text-lg text-gray-500 max-w-4xl leading-relaxed">
          Readflow was designed around a simple belief: the best writing deserves a dedicated space. Instead of searching
          crowded folders and promotions tabs, you get a clean reading view, sender-level controls, one-click archive and
          deletion, and highlight tools for long-term retention.
        </p>
      </section>

      <footer className="px-6 md:px-12 py-12 flex flex-col md:flex-row justify-between items-center border-t border-gray-100 gap-8">
        <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-300">Curated for clarity. © 2026 Readflow.</div>
        <div className="flex items-center gap-6 text-[11px] uppercase tracking-[0.1em]">
          <Link href="/privacy" className="text-gray-500 hover:text-[#FF4E4E] inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Privacy
          </Link>
          <Link href="/terms" className="text-gray-500 hover:text-[#FF4E4E] inline-flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" /> Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}

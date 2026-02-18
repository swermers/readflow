'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, Filter, Library, ShieldCheck, Sparkles, Workflow } from 'lucide-react';

const featureRows = [
  {
    title: 'Win the war on noise',
    body: 'Turn inbox anxiety into clear signal with sender controls and calm prioritization.',
    icon: Filter,
  },
  {
    title: 'From chaos to clarity',
    body: 'Move fast through the Rack, keep only high-signal reads, and archive the rest without guilt.',
    icon: Workflow,
  },
  {
    title: 'Brief, then remember',
    body: 'Generate TLDRs and narration, then capture highlights so insights survive beyond the inbox.',
    icon: Sparkles,
  },
  {
    title: 'Your anti-noise archive',
    body: 'Keep only what matters: a focused archive of signals worth revisiting later.',
    icon: Library,
  },
];

const workflowSteps = [
  {
    title: 'Create a Gmail label for reading',
    body: 'Set up a label like "Readflow" and route newsletters into it with Gmail filters so your inbox stays clean.',
  },
  {
    title: 'Connect Gmail and choose labels',
    body: 'Sign in securely with Google, then choose the label(s) you want Readflow to sync into your dashboard.',
  },
  {
    title: 'Read, save, archive, and highlight',
    body: 'Process each issue with one-click actions and keep your best ideas organized for later review.',
  },
];

const faqItems = [
  {
    question: 'Do I have to forward newsletters to Readflow?',
    answer:
      'No. Readflow connects with Gmail (readonly) so you can sync selected labels without forwarding emails anywhere.',
  },
  {
    question: 'Can I keep my inbox cleaner with this setup?',
    answer:
      'Yes. We recommend applying Gmail filters that skip the inbox and apply your Readflow label for each newsletter sender.',
  },
  {
    question: 'Is Readflow private?',
    answer:
      'Readflow is built for personal reading workflows. You control which labels are synced, and you can archive or delete issues anytime.',
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
          Win your <span className="text-[#FF4E4E]">war on noise.</span>
        </h1>

        <p className="text-xl md:text-2xl text-gray-500 max-w-3xl leading-relaxed mb-10">
          Readflow is your quiet command center for newsletters—separate signal from noise, get briefed fast, and focus on what actually matters.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <Link href="/">
            <button className="group flex items-center gap-4 bg-black text-white px-8 py-6 font-bold uppercase tracking-widest text-sm hover:bg-[#FF4E4E] transition-all">
              Start the quiet brief
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
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">Built for the war on inbox noise.</h2>
        <p className="text-lg text-gray-500 max-w-4xl leading-relaxed">
          Most inbox tools just store content. Readflow helps you decide faster: what to read now, what to save for later, and what to ignore.
          That means less scrolling, less guilt, and more insight per minute.
        </p>
      </section>

      <section className="px-6 md:px-12 py-20 border-t border-gray-100">
        <div className="max-w-6xl">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-10">How to launch your anti-noise system in under 10 minutes.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {workflowSteps.map((step, index) => (
              <article key={step.title} className="border border-gray-100 p-6 bg-white space-y-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF4E4E]">Step {index + 1}</p>
                <h3 className="text-xl font-bold leading-tight">{step.title}</h3>
                <p className="text-gray-500 leading-relaxed">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 md:px-12 py-20 border-t border-gray-100">
        <div className="max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Pricing built for the war on noise.</h2>
            <p className="text-gray-500 text-lg leading-relaxed">
              Start free for calm inbox control, then scale up as you want deeper synthesis, stronger automation, and more AI briefing power.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <article className="border border-gray-200 p-6 bg-gray-50/70 space-y-4">
              <h3 className="text-lg font-bold uppercase tracking-wide">Free</h3>
              <p className="text-3xl font-bold">$0</p>
              <p className="text-xs uppercase tracking-[0.1em] text-gray-500">Good for trial runs</p>
              <ul className="text-sm text-gray-600 space-y-2 list-disc pl-4">
                <li>Up to 5 newsletter sources/month</li>
                <li>Basic search + read workflow</li>
                <li>3 AI credits / month</li>
              </ul>
            </article>

            <article className="border border-black p-6 bg-white space-y-4">
              <h3 className="text-lg font-bold uppercase tracking-wide">Pro</h3>
              <p className="text-3xl font-bold">$9/mo</p>
              <p className="text-xs uppercase tracking-[0.1em] text-gray-500">or $90/year (save $18)</p>
              <ul className="text-sm text-gray-600 space-y-2 list-disc pl-4">
                <li>Unlimited newsletter sources</li>
                <li>50 AI credits / month</li>
                <li>Priority sync + automation controls</li>
              </ul>
            </article>

            <article className="border border-gray-900 p-6 bg-gray-900 text-white space-y-4">
              <h3 className="text-lg font-bold uppercase tracking-wide">Elite</h3>
              <p className="text-3xl font-bold">$25/mo</p>
              <p className="text-xs uppercase tracking-[0.1em] text-gray-300">or $250/year (save $50)</p>
              <ul className="text-sm text-gray-200 space-y-2 list-disc pl-4">
                <li>300 AI credits / month</li>
                <li>Weekly synthesis brief + semantic search</li>
                <li>Priority model access + faster queues</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="px-6 md:px-12 py-20 border-t border-gray-100">
        <div className="max-w-6xl space-y-8">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Frequently asked questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {faqItems.map((item) => (
              <article key={item.question} className="border border-gray-100 p-6 bg-white space-y-3">
                <h3 className="font-bold leading-tight">{item.question}</h3>
                <p className="text-gray-500 leading-relaxed text-sm">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
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

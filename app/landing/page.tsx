'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Library, Shield, Sparkles, Headphones, ScrollText } from 'lucide-react';
import HeroToggle from '@/components/landing/HeroToggle';
import TLDRDemo from '@/components/landing/TLDRDemo';
import AudioWidget from '@/components/landing/AudioWidget';
import ROICalculator from '@/components/landing/ROICalculator';
import PricingGrid from '@/components/landing/PricingGrid';

const senders = ['Substack', 'Beehiiv', 'The New York Times', 'Stratechery', 'a16z', 'Lenny’s Newsletter'];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5 },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fcfbf9] text-slate-900">
      <div className="relative z-10">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 md:px-8">
          <div className="flex items-center gap-2 text-lg"><Library className="h-5 w-5 text-[#2563eb]" /> Readflow</div>
          <div className="hidden items-center gap-6 text-sm text-slate-500 md:flex">
            <a href="#manifesto" className="hover:text-slate-900">Manifesto</a>
            <a href="#pricing" className="hover:text-slate-900">Pricing</a>
            <Link href="/login" className="hover:text-slate-900">Login</Link>
          </div>
          <Link href="/login" className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white">
            Get the Brief
          </Link>
        </nav>

        <main className="mx-auto w-full max-w-6xl space-y-20 px-5 pb-20 pt-8 md:px-8 md:pt-12">
          <section className="space-y-7 text-center">
            <motion.h1 {...fadeUp} className="font-serif text-4xl leading-tight tracking-wide md:text-7xl">
              Win your war on noise.
            </motion.h1>
            <motion.p {...fadeUp} className="mx-auto max-w-3xl text-base text-slate-500 md:text-xl">
              Turn your inbox into a sanctuary. Filter signal, auto-synthesize insights, and listen on the go.
            </motion.p>
            <HeroToggle />
          </section>

          <section className="space-y-5">
            <motion.h2 {...fadeUp} className="flex items-center gap-2 font-serif text-3xl md:text-5xl">
              <Sparkles className="h-7 w-7 text-[#2563eb]" /> TLDR, on demand.
            </motion.h2>
            <motion.p {...fadeUp} className="max-w-3xl text-slate-500">
              Use the Show TLDR toggle to collapse long reads into clear executive bullets.
            </motion.p>
            <TLDRDemo />
          </section>

          <section className="space-y-5">
            <motion.h2 {...fadeUp} className="flex items-center gap-2 font-serif text-3xl md:text-5xl">
              <Headphones className="h-7 w-7 text-[#2563eb]" /> Listen lifecycle, built to last.
            </motion.h2>
            <motion.p {...fadeUp} className="max-w-3xl text-slate-500">
              Queue narration from any article and track each stage from processing to playback.
            </motion.p>
            <AudioWidget />
          </section>

          <motion.section {...fadeUp} className="overflow-hidden rounded-2xl border border-stone-200 bg-white py-5 shadow-xl shadow-slate-200/50">
            <div className="sender-marquee whitespace-nowrap text-center text-sm text-slate-500">
              {senders.concat(senders).map((sender, index) => (
                <span key={`${sender}-${index}`} className="mx-6 inline-block">{sender}</span>
              ))}
            </div>
          </motion.section>

          <motion.section id="manifesto" {...fadeUp} className="rounded-2xl border border-stone-200 bg-[#f7f2e7] p-8 shadow-xl shadow-stone-200/50 md:p-12">
            <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500"><ScrollText className="h-4 w-4" /> The Readflow Manifesto</p>
            <h2 className="font-serif text-3xl tracking-[0.08em] text-slate-900 md:text-5xl">The Readflow Manifesto</h2>
            <div className="mt-7 space-y-5 text-base leading-8 text-slate-700 md:text-lg">
              <p>We are drowning in information, but starving for wisdom.</p>
              <p>
                Your inbox was designed for communication, but it has become a battlefield of attention. Every “Unsubscribe” is a micro-stress.
                Every “Sale” is a distraction. The writers you love are buried under the clutter of the things you merely tolerate.
              </p>
              <p className="font-medium text-slate-900">We believe:</p>
              <p>Attention is your most valuable asset. It should not be sold to the highest bidder.</p>
              <p>Curation is a superpower. What you don&apos;t read is as important as what you do.</p>
              <p>
                Knowledge should compound. A newsletter shouldn&apos;t disappear after you read it; it should become a permanent brick in your intellectual foundation.
              </p>
              <p>
                The Readflow Library is your sanctuary. It is the quiet room in a loud world. It is where inbox anxiety goes to die and where insights go to live.
              </p>
              <p className="font-medium tracking-[0.08em] text-slate-900">Filter the noise. Keep the signal. Build your library.</p>
            </div>
          </motion.section>

          <section id="pricing" className="space-y-8">
            <ROICalculator />
            <PricingGrid />
          </section>
        </main>

        <footer className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 border-t border-stone-200 px-5 py-10 text-sm text-slate-500 md:flex-row md:px-8">
          <p>© {new Date().getFullYear()} Readflow Library</p>
          <div className="flex items-center gap-5">
            <Link href="/terms" className="hover:text-slate-900">Terms</Link>
            <Link href="/privacy" className="hover:text-slate-900">Privacy</Link>
            <span className="inline-flex items-center gap-1"><Shield className="h-4 w-4" /> Sanctuary for Intelligence</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

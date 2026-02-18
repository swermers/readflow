'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Library, Shield, Sparkles, Headphones } from 'lucide-react';
import HeroToggle from '@/components/landing/HeroToggle';
import SynthesisSection from '@/components/landing/SynthesisSection';
import AudioWidget from '@/components/landing/AudioWidget';
import ROICalculator from '@/components/landing/ROICalculator';
import PricingGrid from '@/components/landing/PricingGrid';

const senders = ['Substack', 'Beehiiv', 'The New York Times', 'Stratechery', 'a16z', 'Lenny’s Newsletter'];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.55 },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0f0f10] text-[#ededed]"> 
      <div className="pointer-events-none fixed inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] [background-size:22px_22px]" />
      <div className="relative z-10">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 md:px-8">
          <div className="flex items-center gap-2 text-lg font-semibold"><Library className="h-5 w-5 text-blue-400" /> Readflow</div>
          <div className="hidden items-center gap-6 text-sm text-white/70 md:flex">
            <a href="#manifesto" className="hover:text-white">Manifesto</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <Link href="/login" className="hover:text-white">Login</Link>
          </div>
          <Link href="/login" className="rounded-full border border-white/20 bg-blue-500/90 px-4 py-2 text-sm font-medium text-white">
            Get the Brief
          </Link>
        </nav>

        <main className="mx-auto w-full max-w-6xl space-y-24 px-5 pb-20 pt-10 md:px-8 md:pt-14">
          <section className="space-y-8 text-center">
            <motion.h1 {...fadeUp} className="text-4xl font-semibold leading-tight md:text-7xl">
              Win your war on noise.
            </motion.h1>
            <motion.p {...fadeUp} className="mx-auto max-w-3xl text-base text-white/75 md:text-xl">
              Turn your inbox into a sanctuary. Filter signal, auto-synthesize insights, and listen on the go.
            </motion.p>
            <HeroToggle />
          </section>

          <section className="space-y-5">
            <motion.h2 {...fadeUp} className="flex items-center gap-2 text-3xl font-semibold md:text-5xl">
              <Sparkles className="h-8 w-8 text-blue-300" /> The Synthesis Layer.
            </motion.h2>
            <motion.p {...fadeUp} className="max-w-3xl text-white/70">
              Our AI reads every email so you don&apos;t have to. It auto-tags signal vs. noise and delivers the gist in seconds.
            </motion.p>
            <SynthesisSection />
          </section>

          <section className="space-y-5">
            <motion.h2 {...fadeUp} className="flex items-center gap-2 text-3xl font-semibold md:text-5xl">
              <Headphones className="h-8 w-8 text-blue-300" /> Listen to your Library.
            </motion.h2>
            <motion.p {...fadeUp} className="max-w-3xl text-white/70">
              Your morning commute, upgraded. Durable, high-fidelity narration for your most important reads.
            </motion.p>
            <AudioWidget />
          </section>

          <motion.section {...fadeUp} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 py-5">
            <div className="sender-marquee whitespace-nowrap text-center text-sm text-white/65">
              {senders.concat(senders).map((sender, index) => (
                <span key={`${sender}-${index}`} className="mx-6 inline-block">{sender}</span>
              ))}
            </div>
          </motion.section>

          <motion.section id="manifesto" {...fadeUp} className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="font-serif text-2xl leading-relaxed text-white/90 md:text-4xl">
              “We believe attention is your most valuable asset. The Readflow Library is your sanctuary. Where inbox anxiety goes to die, and insights go to live.”
            </p>
          </motion.section>

          <section id="pricing" className="space-y-8">
            <ROICalculator />
            <PricingGrid />
          </section>
        </main>

        <footer className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 border-t border-white/10 px-5 py-10 text-sm text-white/60 md:flex-row md:px-8">
          <p>© {new Date().getFullYear()} Readflow Library</p>
          <div className="flex items-center gap-5">
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <span className="inline-flex items-center gap-1"><Shield className="h-4 w-4" /> Sanctuary for Intelligence</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

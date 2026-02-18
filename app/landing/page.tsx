'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, Sparkles, Headphones, ScrollText } from 'lucide-react';
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
    <div className="min-h-screen bg-surface text-ink">
      <div className="relative z-10">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 md:px-8">
          <div className="flex items-center gap-3">
            <Image src="/icon.svg" alt="Readflow logo" width={28} height={28} className="rounded-md" />
            <span className="text-lg font-black uppercase tracking-[0.06em]">Readflow</span>
          </div>
          <div className="hidden items-center gap-6 text-sm text-ink-muted md:flex">
            <a href="#manifesto" className="hover:text-ink">Manifesto</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
            <Link href="/login" className="hover:text-ink">Login</Link>
          </div>
          <Link href="/login" className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-surface">
            Get the Brief
          </Link>
        </nav>

        <main className="mx-auto w-full max-w-6xl space-y-20 px-5 pb-20 pt-8 md:px-8 md:pt-12">
          <section className="space-y-7 text-center">
            <motion.h1 {...fadeUp} className="text-display-xl leading-tight text-ink">
              Win your war on noise.
            </motion.h1>
            <motion.p {...fadeUp} className="mx-auto max-w-3xl text-lg text-ink-muted">
              Turn your inbox into a sanctuary. Filter signal, auto-synthesize insights, and listen on the go.
            </motion.p>
            <HeroToggle />
          </section>

          <section className="space-y-5">
            <motion.h2 {...fadeUp} className="flex items-center gap-2 text-display">
              <Sparkles className="h-6 w-6 text-accent" /> TLDR, on demand.
            </motion.h2>
            <motion.p {...fadeUp} className="max-w-3xl text-ink-muted">
              Use the Show TLDR toggle to collapse long reads into clear executive bullets.
            </motion.p>
            <TLDRDemo />
          </section>

          <section className="space-y-5">
            <motion.h2 {...fadeUp} className="flex items-center gap-2 text-display">
              <Headphones className="h-6 w-6 text-accent" /> Listen lifecycle, built to last.
            </motion.h2>
            <motion.p {...fadeUp} className="max-w-3xl text-ink-muted">
              Queue narration from any article and track each stage from processing to playback.
            </motion.p>
            <AudioWidget />
          </section>

          <motion.section {...fadeUp} className="overflow-hidden rounded-2xl border border-line bg-surface-raised py-5 shadow-sm">
            <div className="sender-marquee whitespace-nowrap text-center text-sm text-ink-muted">
              {senders.concat(senders).map((sender, index) => (
                <span key={`${sender}-${index}`} className="mx-6 inline-block">{sender}</span>
              ))}
            </div>
          </motion.section>

          <motion.section id="manifesto" {...fadeUp} className="rounded-2xl border border-line bg-[#f6f2eb] p-8 shadow-sm md:p-12">
            <p className="mb-3 flex items-center gap-2 text-label uppercase text-ink-faint"><ScrollText className="h-4 w-4" /> The Readflow Manifesto</p>
            <h2 className="text-display-lg tracking-[0.01em] text-ink">The Readflow Manifesto</h2>
            <div className="mt-7 space-y-5 text-base leading-8 text-ink-muted md:text-lg">
              <p className="text-ink">We are drowning in information, but starving for wisdom.</p>
              <p>
                Your inbox was designed for communication, but it has become a battlefield of attention. Every “Unsubscribe” is a micro-stress.
                Every “Sale” is a distraction. The writers you love are buried under the clutter of the things you merely tolerate.
              </p>
              <p className="font-semibold text-ink">We believe:</p>
              <p>Attention is your most valuable asset. It should not be sold to the highest bidder.</p>
              <p>Curation is a superpower. What you don&apos;t read is as important as what you do.</p>
              <p>
                Knowledge should compound. A newsletter shouldn&apos;t disappear after you read it; it should become a permanent brick in your intellectual foundation.
              </p>
              <p>
                The Readflow Library is your sanctuary. It is the quiet room in a loud world. It is where inbox anxiety goes to die and where insights go to live.
              </p>
              <p className="font-semibold uppercase tracking-[0.08em] text-ink">Filter the noise. Keep the signal. Build your library.</p>
            </div>
          </motion.section>

          <section id="pricing" className="space-y-8">
            <ROICalculator />
            <PricingGrid />
          </section>
        </main>

        <footer className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 border-t border-line px-5 py-10 text-sm text-ink-muted md:flex-row md:px-8">
          <p>© {new Date().getFullYear()} Readflow Library</p>
          <div className="flex items-center gap-5">
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <span className="inline-flex items-center gap-1"><Shield className="h-4 w-4 text-accent" /> Sanctuary for Intelligence</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

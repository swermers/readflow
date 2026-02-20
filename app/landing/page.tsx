'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, FileText, Headphones, Moon, Sun, Newspaper } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import HeroToggle from '@/components/landing/HeroToggle';
import TLDRDemo from '@/components/landing/TLDRDemo';
import AudioWidget from '@/components/landing/AudioWidget';
import ROICalculator from '@/components/landing/ROICalculator';
import PricingGrid from '@/components/landing/PricingGrid';
import BriefSignalSection from '@/components/landing/BriefSignalSection';
import HighlightsSection from '@/components/landing/HighlightsSection';
import ManifestoReveal from '@/components/landing/ManifestoReveal';

const senders = ['Substack', 'Beehiiv', 'The New York Times', 'Stratechery', 'a16z', 'Lenny’s Newsletter'];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5 },
};

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();

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
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="rounded-xl border border-line bg-surface-raised p-2 text-ink-muted hover:text-ink" aria-label="Toggle theme">
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <Link href="/login" className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-surface">
              Cut the chaos
            </Link>
          </div>
        </nav>

        <main className="mx-auto w-full max-w-6xl space-y-20 px-5 pb-20 pt-8 md:px-8 md:pt-12">
          <section className="space-y-7 text-center">
            <motion.h1 {...fadeUp} className="text-display-xl leading-tight text-ink">
              Win your war on noise.
            </motion.h1>
            <motion.p {...fadeUp} className="mx-auto max-w-3xl text-lg text-ink-muted">
              Turn your inbox into a sanctuary. Zero your inbox, save highlights and notes, get TL;DRs for long newsletters, and listen on the go.
            </motion.p>
            <HeroToggle />
          </section>

          <section className="space-y-5">
            <motion.h2 {...fadeUp} className="flex items-center gap-2 text-display">
              <Newspaper className="h-6 w-6 text-accent" /> The Brief + High Signal.
            </motion.h2>
            <motion.p {...fadeUp} className="max-w-3xl text-ink-muted">
              Your Rack is a newsletter grid. Then Readflow elevates the most important reads into your brief and high-signal queue.
            </motion.p>
            <BriefSignalSection />
          </section>

          <section className="space-y-5">
            <motion.h2 {...fadeUp} className="flex items-center gap-2 text-display">
              <FileText className="h-6 w-6 text-accent" /> TL;DR, on demand.
            </motion.h2>
            <motion.p {...fadeUp} className="max-w-3xl text-ink-muted">
              Use the Show TL;DR toggle to collapse long reads into clear executive bullets.
            </motion.p>
            <TLDRDemo />
          </section>

          <section className="space-y-5">
            <motion.h2 {...fadeUp} className="flex items-center gap-2 text-display">
              <Headphones className="h-6 w-6 text-accent" /> Listen on the go.
            </motion.h2>
            <motion.p {...fadeUp} className="max-w-3xl text-ink-muted">
              Catch up while you work, walk, or commute with durable narration for your top reads.
            </motion.p>
            <AudioWidget />
          </section>

          <HighlightsSection />

          <motion.section {...fadeUp} className="overflow-hidden rounded-2xl border border-line bg-surface-raised py-5 shadow-sm">
            <div className="sender-marquee whitespace-nowrap text-center text-sm text-ink-muted">
              {senders.concat(senders).map((sender, index) => (
                <span key={`${sender}-${index}`} className="mx-6 inline-block">{sender}</span>
              ))}
            </div>
          </motion.section>

          <section id="manifesto" className="space-y-4">
            <motion.p {...fadeUp} className="text-label uppercase text-ink-faint">The Readflow Manifesto</motion.p>
            <ManifestoReveal />
          </section>

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

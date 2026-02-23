'use client';

import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Pause, Play, Radio } from 'lucide-react';

export default function AudioWidget() {
  const [status, setStatus] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Use Web Speech API to generate a sample brief narration
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const generateSampleAudio = () => {
    if (!('speechSynthesis' in window)) return;

    const synth = window.speechSynthesis;

    if (status === 'playing') {
      synth.pause();
      setStatus('paused');
      return;
    }

    if (status === 'paused') {
      synth.resume();
      setStatus('playing');
      return;
    }

    synth.cancel();

    const text =
      'Welcome to your Readflow briefing. This week, three themes dominated your newsletter stack. ' +
      'First: AI infrastructure costs are falling faster than expected, with three sources converging on a 40 percent drop in inference pricing. ' +
      'Second: The creator economy is shifting toward owned audiences. Substack, Beehiiv, and Ghost all reported record migration numbers. ' +
      'Third: Climate tech funding hit a new quarterly high, led by battery storage and grid modernization. ' +
      'Your top five recommended reads are queued in your Rack. That is your brief for this week.';

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to use a natural-sounding voice
    const voices = synth.getVoices();
    const preferred = voices.find(
      (v) => v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'),
    );
    if (preferred) utterance.voice = preferred;

    const estimatedDuration = text.length / 14; // ~14 chars/sec
    setDuration(estimatedDuration);

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setProgress(Math.min(elapsed / estimatedDuration, 1));
    }, 200);

    utterance.onend = () => {
      clearInterval(interval);
      setProgress(1);
      setTimeout(() => {
        setStatus('idle');
        setProgress(0);
      }, 1500);
    };

    utterance.onerror = () => {
      clearInterval(interval);
      setStatus('idle');
      setProgress(0);
    };

    synth.speak(utterance);
    setStatus('playing');
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.45 }}
      className="rounded-2xl border border-line bg-surface-raised p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={generateSampleAudio}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
            status === 'idle'
              ? 'bg-ink text-surface'
              : 'bg-accent text-white'
          }`}
        >
          {status === 'idle' && <><Radio className="h-4 w-4" /> Play Sample Brief</>}
          {status === 'playing' && <><Pause className="h-4 w-4" /> Pause</>}
          {status === 'paused' && <><Play className="h-4 w-4" /> Resume</>}
        </button>
        <p className="text-label uppercase text-ink-faint">
          {status !== 'idle' ? formatTime(progress * duration) + ' / ' + formatTime(duration) : 'Sample audio brief'}
        </p>
      </div>

      <motion.div
        animate={{ height: status !== 'idle' ? 'auto' : 0, opacity: status !== 'idle' ? 1 : 0 }}
        className="overflow-hidden"
      >
        <div className="mt-3 space-y-2">
          {/* Progress bar */}
          <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          {/* Visualizer */}
          <div className="rounded-xl border border-line bg-surface p-3">
            <div className="flex items-end gap-1">
              {Array.from({ length: 16 }).map((_, index) => (
                <span
                  key={index}
                  className={`block w-1.5 rounded-full bg-accent ${status === 'playing' ? 'voice-bar' : ''}`}
                  style={{
                    animationDelay: `${index * 0.08}s`,
                    height: status === 'playing' ? undefined : '4px',
                  }}
                />
              ))}
            </div>
          </div>

          <p className="text-xs text-ink-faint">
            Sample: &ldquo;This week, three themes dominated your newsletter stack&hellip;&rdquo;
          </p>
        </div>
      </motion.div>
    </motion.section>
  );
}

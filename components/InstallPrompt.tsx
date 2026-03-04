'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

const DISMISSED_KEY = 'readflow-install-dismissed';
const DISMISS_DAYS = 14;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Already running as installed PWA — never show
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if ((navigator as any).standalone === true) return;

    // Respect dismiss cooldown
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) {
      const dismissedAt = Number(dismissed);
      if (Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
    }

    // Detect iOS Safari (no beforeinstallprompt support)
    const ua = navigator.userAgent;
    const iosDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS|Chrome/.test(ua);

    if (iosDevice && isSafari) {
      setIsIos(true);
      setVisible(true);
      return;
    }

    // Chrome / Edge / Samsung etc — use the native install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt.current) {
      await deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === 'accepted') {
        setVisible(false);
      }
      deferredPrompt.current = null;
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:bottom-6 md:left-auto md:right-6 md:max-w-sm animate-fade-in">
      <div className="relative rounded-2xl border border-line bg-surface-raised p-5 shadow-lg">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-ink-faint hover:text-ink transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-line bg-surface p-2.5 shrink-0">
            <Download className="w-5 h-5 text-ink" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-ink">Get the Readflow app</p>
            <p className="text-xs text-ink-muted mt-0.5">
              {isIos
                ? <>Tap <Share className="inline w-3.5 h-3.5 -mt-0.5" /> then &quot;Add to Home Screen&quot; for the best experience.</>
                : 'Install Readflow on your device for quick access and a full-screen experience.'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {!isIos && (
            <button
              onClick={handleInstall}
              className="flex-1 bg-ink text-surface text-label uppercase px-4 py-2.5 hover:bg-accent transition-colors"
            >
              Install App
            </button>
          )}
          <button
            onClick={handleDismiss}
            className={`text-label uppercase px-4 py-2.5 border border-line text-ink hover:border-line-strong transition-colors ${isIos ? 'flex-1' : ''}`}
          >
            {isIos ? 'Got it' : 'Not now'}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Play, Save, Square } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { triggerToast } from '@/components/Toast';
import { DEFAULT_VOICE_KEY, VOICE_OPTIONS, estimateDigestCostUsd, type VoiceTier } from '@/utils/voices';

const TIER_LABELS: Record<VoiceTier, { title: string; note: string }> = {
  budget: { title: 'Budget', note: 'Clear and very cheap. Good for daily listening.' },
  standard: { title: 'Standard', note: 'More natural delivery.' },
  premium: { title: 'Premium', note: 'Most lifelike. Costs the most per article.' },
};

const TIER_ORDER: VoiceTier[] = ['budget', 'standard', 'premium'];

function formatCost(usd: number) {
  if (usd < 0.01) return `${(usd * 100).toFixed(2)}¢`;
  return `${(usd * 100).toFixed(1)}¢`;
}

export default function VoicePicker() {
  const [selected, setSelected] = useState(DEFAULT_VOICE_KEY);
  const [saved, setSaved] = useState(DEFAULT_VOICE_KEY);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlCache = useRef(new Map<string, string>());

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profile_preferences')
        .select('tts_voice')
        .eq('user_id', user.id)
        .maybeSingle<{ tts_voice: string | null }>();
      if (data?.tts_voice && VOICE_OPTIONS.some((option) => option.key === data.tts_voice)) {
        setSelected(data.tts_voice);
        setSaved(data.tts_voice);
      }
    })();

    const cache = urlCache.current;
    return () => {
      audioRef.current?.pause();
      cache.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const stopPlayback = () => {
    audioRef.current?.pause();
    setPlaying(null);
  };

  const handlePreview = async (key: string) => {
    if (playing === key) {
      stopPlayback();
      return;
    }
    stopPlayback();

    let url = urlCache.current.get(key);
    if (!url) {
      setPreviewing(key);
      try {
        const res = await fetch('/api/ai/voice-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voice: key }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          triggerToast(data.error || 'Could not play this voice');
          return;
        }
        url = URL.createObjectURL(await res.blob());
        urlCache.current.set(key, url);
      } catch {
        triggerToast('Could not play this voice');
        return;
      } finally {
        setPreviewing(null);
      }
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setPlaying(null);
    setPlaying(key);
    audio.play().catch(() => setPlaying(null));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tts_voice: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        triggerToast(data.error || 'Could not save voice');
        return;
      }
      setSaved(selected);
      triggerToast('Voice saved. New audio will use it.');
    } catch {
      triggerToast('Could not save voice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {TIER_ORDER.map((tier) => {
        const options = VOICE_OPTIONS.filter((option) => option.tier === tier);
        if (!options.length) return null;
        return (
          <div key={tier}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-label uppercase text-ink-faint">{TIER_LABELS[tier].title}</p>
              <p className="text-xs text-ink-faint">{TIER_LABELS[tier].note}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {options.map((option) => {
                const active = selected === option.key;
                return (
                  <div
                    key={option.key}
                    className={`flex items-center gap-3 border px-3 py-2 transition-colors ${
                      active ? 'border-ink bg-surface' : 'border-line hover:border-line-strong'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(option.key)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      aria-pressed={active}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          active ? 'border-ink bg-ink text-surface' : 'border-line-strong'
                        }`}
                      >
                        {active && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">
                          {option.label}
                          {option.key === DEFAULT_VOICE_KEY && (
                            <span className="ml-2 text-[10px] uppercase text-ink-faint">Default</span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-ink-faint">
                          {option.description} · ~{formatCost(estimateDigestCostUsd(option))}/article
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePreview(option.key)}
                      disabled={previewing !== null && previewing !== option.key}
                      className="shrink-0 border border-line p-2 text-ink hover:border-line-strong disabled:opacity-40"
                      aria-label={playing === option.key ? `Stop ${option.label}` : `Play a sample of ${option.label}`}
                    >
                      {previewing === option.key ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : playing === option.key ? (
                        <Square className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <button
        onClick={handleSave}
        disabled={saving || selected === saved}
        className="flex items-center gap-2 text-label uppercase bg-ink text-surface px-6 py-3 hover:bg-accent transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        Save Voice
      </button>

      <p className="text-xs text-ink-faint border-t border-line pt-4">
        Costs assume a 2 to 3 minute audio digest (about 3,000 characters). Audio you have already generated keeps its original voice.
      </p>
    </div>
  );
}

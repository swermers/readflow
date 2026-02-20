'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, X } from 'lucide-react';

type AudioChapter = {
  label: string;
  startRatio: number;
};

type PlayOptions = {
  title?: string;
  chapters?: AudioChapter[];
};

type GlobalAudioPlayerContextValue = {
  playAudio: (url: string, options?: PlayOptions) => Promise<void>;
  isCurrentUrl: (url: string | null | undefined) => boolean;
};

type PendingAudioStatus = 'missing' | 'queued' | 'processing' | 'failed' | 'ready' | 'canceled';

const GlobalAudioPlayerContext = createContext<GlobalAudioPlayerContextValue | null>(null);

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function GlobalAudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('Narration');
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [chapters, setChapters] = useState<AudioChapter[]>([]);

  const [pendingIssueId, setPendingIssueId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<PendingAudioStatus>('missing');
  const [pendingUpdatedAt, setPendingUpdatedAt] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());

  const playAudio = async (url: string, options?: PlayOptions) => {
    if (!audioRef.current) return;

    const nextTitle = options?.title || 'Narration';
    setTitle(nextTitle);
    setChapters(options?.chapters || []);

    if (currentUrl !== url) {
      audioRef.current.src = url;
      setCurrentUrl(url);
      setCurrentTime(0);
      setDuration(0);
    }

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: nextTitle,
        artist: 'Readflow',
      });
    }

    try {
      await audioRef.current.play();
    } catch {
      // fallback to manual controls in player UI
    }
  };

  const pause = () => {
    audioRef.current?.pause();
  };

  const seek = (nextTime: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const clear = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.removeAttribute('src');
    audioRef.current.load();
    setCurrentUrl(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setChapters([]);
  };

  useEffect(() => {
    const syncPendingIssue = () => {
      const issueId = window.localStorage.getItem('readflow_active_listen_issue');
      setPendingIssueId(issueId || null);
      if (!issueId) {
        setPendingStatus('missing');
        setPendingUpdatedAt(null);
      }
    };

    syncPendingIssue();
    const interval = setInterval(syncPendingIssue, 1000);
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'readflow_active_listen_issue') syncPendingIssue();
    };

    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!pendingIssueId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/ai/listen?issueId=${encodeURIComponent(pendingIssueId)}`, {
          method: 'GET',
          cache: 'no-store',
        });
        if (!res.ok) return;

        const payload = (await res.json()) as { status?: PendingAudioStatus; updatedAt?: string | null };
        if (cancelled) return;

        const status = payload.status || 'missing';
        setPendingStatus(status);
        setPendingUpdatedAt(payload.updatedAt || null);

        if (status === 'ready' || status === 'failed' || status === 'canceled' || status === 'missing') {
          const current = window.localStorage.getItem('readflow_active_listen_issue');
          if (current === pendingIssueId) window.localStorage.removeItem('readflow_active_listen_issue');
          setPendingIssueId(null);
        }
      } catch {
        // best effort
      }
    };

    void poll();
    const interval = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pendingIssueId]);

  useEffect(() => {
    if (!pendingIssueId) return;
    if (pendingStatus !== 'queued' && pendingStatus !== 'processing') return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [pendingIssueId, pendingStatus]);

  const pendingElapsed = pendingUpdatedAt ? Math.max(0, Math.floor((nowTick - new Date(pendingUpdatedAt).getTime()) / 1000)) : 0;
  const pendingProgress = Math.min(95, Math.max(8, Math.round((pendingElapsed / 45) * 100)));

  const value = useMemo<GlobalAudioPlayerContextValue>(
    () => ({
      playAudio,
      isCurrentUrl: (url) => Boolean(url && currentUrl === url),
    }),
    [currentUrl]
  );

  return (
    <GlobalAudioPlayerContext.Provider value={value}>
      {children}

      {pendingIssueId && (pendingStatus === 'queued' || pendingStatus === 'processing') && (
        <div className={`fixed left-3 right-3 z-40 md:left-auto md:right-4 md:w-[420px] ${currentUrl ? 'bottom-[10.5rem] md:bottom-[10.5rem]' : 'bottom-24 md:bottom-4'}`}>
          <div className="rounded-xl border border-line bg-surface-raised p-3 shadow-lg">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Audio generating in background</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pendingProgress}%` }} />
            </div>
            <p className="mt-2 text-[10px] text-ink-faint">{pendingElapsed > 0 ? `Elapsed ${formatTime(pendingElapsed)}` : 'Starting now'} · You can keep browsing while narration finishes.</p>
          </div>
        </div>
      )}

      {currentUrl && (
        <div className="fixed bottom-24 left-3 right-3 z-40 md:bottom-4 md:left-auto md:right-4 md:w-[420px]">
          <div className="rounded-xl border border-line bg-surface-raised p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">{title}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={isPlaying ? pause : () => {
                    void audioRef.current?.play();
                  }}
                  className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink"
                >
                  {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={clear}
                  className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mb-2">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(currentTime, duration || 0)}
                onChange={(event) => seek(Number(event.target.value))}
                className="w-full"
              />
              <div className="mt-1 flex items-center justify-between text-[10px] text-ink-faint">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {chapters.length > 1 && (
              <div className="mb-2 flex gap-1 overflow-x-auto pb-1 thin-scrollbar">
                {chapters.map((chapter) => (
                  <button
                    key={`${chapter.label}-${chapter.startRatio}`}
                    type="button"
                    onClick={() => seek((duration || 0) * chapter.startRatio)}
                    className="whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-[10px] text-ink-faint hover:border-accent hover:text-accent"
                  >
                    {chapter.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <audio
        ref={audioRef}
        controls
        preload="auto"
        className="hidden"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onDurationChange={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
      />
    </GlobalAudioPlayerContext.Provider>
  );
}

export function useGlobalAudioPlayer() {
  const context = useContext(GlobalAudioPlayerContext);
  if (!context) {
    throw new Error('useGlobalAudioPlayer must be used within GlobalAudioPlayerProvider');
  }

  return context;
}

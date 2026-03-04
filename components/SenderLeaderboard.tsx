interface SenderStat {
  name: string;
  email: string;
  score: number;
  maxScore: number;
}

export default function SenderLeaderboard({ senders }: { senders: SenderStat[] }) {
  if (senders.length === 0) {
    return (
      <p className="text-xs text-ink-faint">
        Not enough engagement data yet. Open, highlight, and summarize articles to build your sender rankings.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {senders.map((sender, i) => {
        const pct = sender.maxScore > 0 ? Math.round((sender.score / sender.maxScore) * 100) : 0;
        return (
          <div key={sender.email}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-ink truncate">
                <span className="text-ink-faint mr-1.5">#{i + 1}</span>
                {sender.name}
              </p>
              <p className="text-[10px] uppercase tracking-[0.08em] text-ink-faint shrink-0">
                {sender.score} pts
              </p>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-line overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

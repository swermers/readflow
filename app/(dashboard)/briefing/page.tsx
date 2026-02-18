import { createClient } from '@/utils/supabase/server';
import { ArrowUpRight } from 'lucide-react';
import TrackIssueLink from '@/components/TrackIssueLink';
import WeeklyBriefCard from '@/components/WeeklyBriefCard';

export default async function BriefingPage() {
  const supabase = await createClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: emails } = await supabase
    .from('issues')
    .select('id, subject, snippet, from_email, received_at, signal_tier, signal_reason, senders(name, status)')
    .eq('status', 'unread')
    .is('deleted_at', null)
    .gte('received_at', sevenDaysAgo)
    .order('received_at', { ascending: false })
    .limit(120);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let senderAffinity = new Map<string, number>();

  if (user) {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const { data: events } = await supabase
      .from('user_issue_events')
      .select('sender_email, event_type, created_at')
      .eq('user_id', user.id)
      .gte('created_at', sixtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(500);

    const eventWeights: Record<string, number> = {
      issue_opened: 1,
      tldr_generated: 2,
      listen_started: 2,
      listen_completed: 3,
      highlight_created: 4,
      note_created: 4,
      issue_archived: 1,
      issue_deleted: -1,
    };

    senderAffinity = (events || []).reduce((acc: Map<string, number>, event: any) => {
      const senderEmail = event.sender_email || '';
      if (!senderEmail) return acc;
      const current = acc.get(senderEmail) || 0;
      acc.set(senderEmail, current + (eventWeights[event.event_type] || 0));
      return acc;
    }, new Map<string, number>());
  }

  const signalStats = (emails || []).reduce(
    (acc: { highSignal: number; news: number; reference: number; unclassified: number }, email: any) => {
      if (email.signal_tier === 'high_signal') acc.highSignal += 1;
      else if (email.signal_tier === 'news') acc.news += 1;
      else if (email.signal_tier === 'reference') acc.reference += 1;
      else acc.unclassified += 1;
      return acc;
    },
    { highSignal: 0, news: 0, reference: 0, unclassified: 0 }
  );

  const executiveStats = [
    { label: 'High Signal', value: signalStats.highSignal, tone: 'text-emerald-600' },
    { label: 'News', value: signalStats.news, tone: 'text-sky-600' },
    { label: 'Reference', value: signalStats.reference, tone: 'text-violet-600' },
    { label: 'Unsorted', value: signalStats.unclassified, tone: 'text-ink-faint' },
  ];

  const tierBaseScore: Record<string, number> = {
    high_signal: 70,
    news: 45,
    reference: 30,
    unclassified: 20,
  };

  const recommendedIssues = (emails || [])
    .map((email: any) => {
      const tierScore = tierBaseScore[email.signal_tier || 'unclassified'] || tierBaseScore.unclassified;
      const ageInDays = Math.max(
        0,
        (Date.now() - new Date(email.received_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      const freshnessScore = Math.max(0, 20 - ageInDays * 3);
      const senderScore = Math.min(30, Math.max(0, (senderAffinity.get(email.from_email || '') || 0) * 2));

      const why: string[] = [];
      if ((senderAffinity.get(email.from_email || '') || 0) >= 3) {
        why.push('You frequently engage with this sender');
      }
      if (email.signal_tier === 'high_signal') {
        why.push('Classified as high signal');
      }
      if (ageInDays <= 1) {
        why.push('Fresh from the last 24h');
      }

      return {
        ...email,
        recommendationScore: tierScore + freshnessScore + senderScore,
        recommendationReason: why[0] || email.signal_reason || 'Recommended from your current signal mix',
      };
    })
    .sort((a: any, b: any) => b.recommendationScore - a.recommendationScore)
    .slice(0, 3);

  return (
    <div className="p-6 md:p-12 min-h-screen">
      <header className="mb-10 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-display-lg text-ink">Briefing.</h1>
          <p className="text-sm text-ink-muted mt-1">Your weekly synthesis and guided priorities, away from Rack clutter.</p>
        </div>
      </header>

      <section className="mb-8 rounded-2xl border border-line bg-surface-raised p-4 md:p-5">
        <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.1em] text-accent">Executive Assistant</p>
            <h2 className="text-lg font-semibold text-ink">Signal Snapshot</h2>
            <p className="text-xs text-ink-faint">Quick triage across your unread stack this week.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          {executiveStats.map((item) => (
            <div key={item.label} className="rounded-lg border border-line bg-surface px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.08em] text-ink-faint">{item.label}</p>
              <p className={`mt-1 text-xl font-semibold ${item.tone}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {recommendedIssues.length > 0 && (
        <section className="mb-8 rounded-2xl border border-line bg-surface-raised p-4 md:p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.1em] text-accent">Start Here</p>
              <h2 className="text-lg font-semibold text-ink">Top 3 issues to read now</h2>
              <p className="text-xs text-ink-faint">Auto-prioritized from this week’s stack.</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {recommendedIssues.map((issue: any, index: number) => (
              <TrackIssueLink
                key={issue.id}
                issueId={issue.id}
                senderEmail={issue.from_email}
                href={`/newsletters/${issue.id}`}
                className="block rounded-lg border border-line bg-surface px-3 py-2 hover:border-line-strong"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-accent">#{index + 1} · {issue.signal_tier === 'high_signal' ? 'High Signal' : 'Recommended'}</p>
                    <p className="mt-1 line-clamp-1 text-sm font-medium text-ink">{issue.subject}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-ink-faint">Why: {issue.recommendationReason}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-ink-faint" />
                </div>
              </TrackIssueLink>
            ))}
          </div>
        </section>
      )}

      <WeeklyBriefCard />
    </div>
  );
}

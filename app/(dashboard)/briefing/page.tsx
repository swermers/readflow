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
  let issueTags = new Map<string, string[]>();
  let tagAffinity = new Map<string, number>();
  let senderPenalty = new Map<string, number>();
  let tagPenalty = new Map<string, number>();

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

    const { data: highlights } = await supabase
      .from('highlights')
      .select('issue_id, auto_tags')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1000);

    for (const row of highlights || []) {
      const tags = (Array.isArray((row as any).auto_tags) ? (row as any).auto_tags : []).filter(
        (tag: unknown): tag is string => typeof tag === 'string',
      );
      if (tags.length === 0) continue;

      const issueId = (row as any).issue_id as string | null;
      if (issueId) {
        const existing = issueTags.get(issueId) || [];
        issueTags.set(issueId, Array.from(new Set([...existing, ...tags])).slice(0, 12));
      }

      for (const tag of tags) {
        tagAffinity.set(tag, (tagAffinity.get(tag) || 0) + 1);
      }
    }

    const { data: feedback } = await supabase
      .from('user_article_feedback')
      .select('sender_email, auto_tags, feedback_type')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500);

    for (const row of feedback || []) {
      if ((row as any).feedback_type !== 'not_relevant') continue;
      const sender = ((row as any).sender_email || '') as string;
      if (sender) senderPenalty.set(sender, (senderPenalty.get(sender) || 0) + 8);
      const tags = (Array.isArray((row as any).auto_tags) ? (row as any).auto_tags : []) as string[];
      for (const tag of tags) {
        tagPenalty.set(tag, (tagPenalty.get(tag) || 0) + 3);
      }
    }
  }

  const signalStats = (emails || []).reduce(
    (acc: { highSignal: number; news: number; reference: number; unclassified: number }, email: any) => {
      if (email.signal_tier === 'high_signal') acc.highSignal += 1;
      else if (email.signal_tier === 'news') acc.news += 1;
      else if (email.signal_tier === 'reference') acc.reference += 1;
      else acc.unclassified += 1;
      return acc;
    },
    { highSignal: 0, news: 0, reference: 0, unclassified: 0 },
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

  const rankedIssues = (emails || [])
    .map((email: any) => {
      const tierScore = tierBaseScore[email.signal_tier || 'unclassified'] || tierBaseScore.unclassified;
      const ageInDays = Math.max(0, (Date.now() - new Date(email.received_at).getTime()) / (1000 * 60 * 60 * 24));
      const freshnessScore = Math.max(0, 20 - ageInDays * 3);
      const senderScore = Math.min(30, Math.max(0, (senderAffinity.get(email.from_email || '') || 0) * 2));
      const issueAutoTags = issueTags.get(email.id) || [];
      const affinityBoost = issueAutoTags.reduce((sum, tag) => sum + Math.min(4, tagAffinity.get(tag) || 0), 0);
      const senderDownrank = senderPenalty.get(email.from_email || '') || 0;
      const tagDownrank = issueAutoTags.reduce((sum, tag) => sum + (tagPenalty.get(tag) || 0), 0);

      const why: string[] = [];
      if ((senderAffinity.get(email.from_email || '') || 0) >= 3) why.push('You frequently engage with this sender');
      if (affinityBoost > 0) why.push('Matches topics from your notes');
      if (email.signal_tier === 'high_signal') why.push('Classified as high signal');
      if (ageInDays <= 1) why.push('Fresh from the last 24h');
      if (senderDownrank + tagDownrank > 0) why.push('Adjusted using your not relevant feedback');

      return {
        ...email,
        recommendationScore: tierScore + freshnessScore + senderScore + affinityBoost - senderDownrank - tagDownrank,
        recommendationReason: why[0] || email.signal_reason || 'Recommended from your current signal mix',
      };
    })
    .sort((a: any, b: any) => b.recommendationScore - a.recommendationScore);

  const recommendedIssues: any[] = [];
  const seenSenders = new Set<string>();

  for (const issue of rankedIssues) {
    const sender = issue.from_email || issue.id;
    if (recommendedIssues.length < 5 && !seenSenders.has(sender)) {
      recommendedIssues.push(issue);
      seenSenders.add(sender);
    }
    if (recommendedIssues.length >= 5) break;
  }

  if (recommendedIssues.length < 5) {
    for (const issue of rankedIssues) {
      if (recommendedIssues.some((item) => item.id === issue.id)) continue;
      recommendedIssues.push(issue);
      if (recommendedIssues.length >= 5) break;
    }
  }

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
              <h2 className="text-lg font-semibold text-ink">Top 5 issues to read now</h2>
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

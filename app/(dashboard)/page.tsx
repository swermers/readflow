import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { ArrowUpRight, Clock } from 'lucide-react';
import SetupGuide from '@/components/SetupGuide';
import SyncButton from '@/components/SyncButton';
import AutoSync from '@/components/AutoSync';
import RackIssueActions from '@/components/RackIssueActions';

const ZEN_QUOTES = [
  { text: 'The mind is everything. What you think you become.', author: 'Buddha' },
  { text: 'It is not that we have a short time to live, but that we waste a good deal of it.', author: 'Seneca' },
  { text: 'The ability to simplify means to eliminate the unnecessary so that the necessary may speak.', author: 'Hans Hofmann' },
  { text: 'Reading is to the mind what exercise is to the body.', author: 'Joseph Addison' },
  { text: 'Not all readers are leaders, but all leaders are readers.', author: 'Harry S. Truman' },
  { text: 'Be still when you have nothing to say; when genuine passion moves you, say what you have got to say, and say it hot.', author: 'D.H. Lawrence' },
];

function getQuoteOfDay() {
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return ZEN_QUOTES[day % ZEN_QUOTES.length];
}

export default async function Home() {
  const supabase = await createClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: emails, error } = await supabase
    .from('issues')
    .select('*, senders!inner(name, status)')
    .eq('senders.status', 'approved')
    .eq('status', 'unread')
    .gte('received_at', sevenDaysAgo)
    .order('received_at', { ascending: false });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let gmailConnected = false;
  let lastSyncAt: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('gmail_connected, gmail_last_sync_at')
      .eq('id', user.id)
      .single();

    gmailConnected = profile?.gmail_connected || false;
    lastSyncAt = profile?.gmail_last_sync_at || null;
  }

  if (error) {
    console.error('Supabase error:', error);
    return (
      <div className="p-6 md:p-12 min-h-screen">
        <header className="mb-12">
          <h1 className="text-display-lg text-ink">The Rack.</h1>
        </header>
        <div className="text-center py-20 bg-surface-raised rounded-lg border border-line">
          <p className="text-ink font-medium">Something went wrong loading your newsletters.</p>
          <p className="text-sm text-ink-muted mt-1">Please refresh the page to try again.</p>
        </div>
      </div>
    );
  }

  const quote = getQuoteOfDay();

  return (
    <div className="p-6 md:p-12 min-h-screen">
      {gmailConnected && <AutoSync lastSyncAt={lastSyncAt} />}

      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-display-lg text-ink">The Rack.</h1>
          <p className="text-sm text-ink-muted mt-1">
            {(emails?.length || 0)} {(emails?.length || 0) === 1 ? 'issue' : 'issues'} from the last 7 days.
          </p>
        </div>
        {gmailConnected && (emails?.length ?? 0) > 0 && <SyncButton variant="compact" />}
      </header>

      <div className="h-px bg-line-strong mb-10" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-5 lg:grid-cols-3 stagger-children">
        {emails?.map((email: any) => (
          <article key={email.id} className="relative flex min-h-56 md:h-56 flex-col justify-between rounded-2xl border border-line bg-surface p-4 md:p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_14px_32px_rgba(15,23,42,0.12)]">
            <div>
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-[10px] uppercase tracking-[0.08em] text-accent">{email.senders?.name || 'Unknown'}</p>
                <div className="flex items-center gap-2">
                  <div className="unread-dot" />
                  <span className="text-[10px] text-ink-faint flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(email.received_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <Link href={`/newsletters/${email.id}`} className="group mt-2 block">
                <h3 className="text-sm md:text-base font-semibold leading-tight text-ink line-clamp-3 group-hover:text-accent transition-colors">
                  {email.subject}
                </h3>
                <p className="mt-2 text-[11px] text-ink-faint line-clamp-2">{email.snippet}</p>
              </Link>
            </div>

            <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2">
              <Link href={`/newsletters/${email.id}`} className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] text-accent hover:opacity-80">
                Open <ArrowUpRight className="w-3 h-3" />
              </Link>
              <RackIssueActions issueId={email.id} />
            </div>
          </article>
        ))}

        {(!emails || emails.length === 0) && (
          !gmailConnected ? (
            <SetupGuide gmailConnected={gmailConnected} />
          ) : (
            <div className="col-span-full flex items-center justify-center py-20">
              <div className="max-w-md text-center space-y-6">
                <div className="w-12 h-px bg-accent mx-auto" />
                <blockquote className="text-xl font-medium text-ink leading-relaxed italic">
                  &ldquo;{quote.text}&rdquo;
                </blockquote>
                <p className="text-sm text-ink-faint">&mdash; {quote.author}</p>
                <div className="w-12 h-px bg-line mx-auto" />
                <p className="text-sm text-ink-muted">
                  No unread issues from the last 7 days.
                </p>
                <div className="flex justify-center pt-2">
                  <SyncButton variant="compact" />
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

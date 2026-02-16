import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { ArrowLeft, Clock, Globe, ArrowUpRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import UnsubscribeButton from './UnsubscribeButton';

export default async function SenderPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { view?: string };
}) {
  const supabase = await createClient();
  const libraryView = searchParams?.view === 'library';

  const { data: sender } = await supabase
    .from('senders')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!sender) return notFound();

  const { data: issues } = await supabase
    .from('issues')
    .select('*')
    .eq('sender_id', params.id)
    .neq('status', 'archived')
    .order('received_at', { ascending: false });

  return (
    <div className="min-h-screen p-6 md:p-12">
      <div className="mb-8">
        <Link
          href={libraryView ? '/library' : '/'}
          className="inline-flex items-center gap-2 text-label uppercase text-ink-faint transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          {libraryView ? 'Back to Library' : 'Back to Rack'}
        </Link>
      </div>

      <header className="mb-8 border-b border-line pb-8">
        <div className="mb-5 flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-overlay text-xl font-bold text-ink-faint">
            {sender.name[0]}
          </div>
          <div>
            <h1 className="text-display-lg text-ink">{sender.name}</h1>
            <a href={`mailto:${sender.email}`} className="text-sm text-ink-faint transition-colors hover:text-accent">
              {sender.email}
            </a>
          </div>
        </div>

        <div className="flex gap-3">
          {sender.website_url && (
            <a
              href={sender.website_url}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface-raised px-4 py-2 text-label uppercase text-ink-muted transition-colors hover:bg-surface-overlay"
            >
              <Globe className="h-4 w-4" /> Website
            </a>
          )}
          <UnsubscribeButton senderId={sender.id} senderName={sender.name} />
        </div>
      </header>

      <div className="mb-6">
        <p className="text-sm text-ink-muted">
          {issues?.length || 0} available {issues?.length === 1 ? 'article' : 'articles'}.
        </p>
      </div>

      <div className="stagger-children grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
        {issues?.map((issue) => (
          <Link key={issue.id} href={`/newsletters/${issue.id}`} className="group">
            <article className="relative flex h-52 md:h-56 flex-col justify-between rounded-2xl border border-line bg-surface p-4 md:p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_14px_32px_rgba(15,23,42,0.12)]">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] text-ink-faint inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(issue.received_at).toLocaleDateString()}
                  </span>
                  {issue.status === 'read' && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">SAVED</span>
                  )}
                </div>
                <h3 className="mt-2 line-clamp-3 text-sm font-semibold leading-tight text-ink transition-colors group-hover:text-accent md:text-base">
                  {issue.subject}
                </h3>
              </div>

              <div className="border-t border-line pt-3">
                <p className="line-clamp-2 text-[11px] text-ink-faint">{issue.snippet}</p>
                <span className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase text-accent">
                  Open <ArrowUpRight className="h-3 w-3" />
                </span>
              </div>
            </article>
          </Link>
        ))}

        {(!issues || issues.length === 0) && (
          <div className="col-span-full py-12 text-center text-ink-faint">
            <p className="text-sm">No active articles from this sender right now.</p>
          </div>
        )}
      </div>
    </div>
  );
}

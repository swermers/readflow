import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { ArrowLeft, Clock, Globe, ArrowUpRight, BookmarkCheck } from 'lucide-react';
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

      <header className="mb-10 border-b border-line pb-10">
        <div className="mb-6 flex items-center gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-overlay text-2xl font-bold text-ink-faint">
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
              className="inline-flex items-center gap-2 border border-line bg-surface-raised px-4 py-2 text-label uppercase text-ink-muted transition-colors hover:bg-surface-overlay"
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

      <div className="stagger-children grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {issues?.map((issue) => (
          <Link key={issue.id} href={`/newsletters/${issue.id}`} className="group">
            <div className="flex h-64 flex-col justify-between border border-line bg-surface p-6 transition-all duration-200 hover:border-accent">
              <div className="flex items-start justify-between gap-3">
                <span className="flex items-center gap-1 text-[10px] text-ink-faint">
                  <Clock className="h-3 w-3" />
                  {new Date(issue.received_at).toLocaleDateString()}
                </span>
                {issue.status === 'read' && (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase text-accent">
                    <BookmarkCheck className="h-3 w-3" /> Saved
                  </span>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-lg font-bold leading-tight text-ink transition-colors group-hover:text-accent">
                  {issue.subject}
                </h3>
                <p className="line-clamp-3 text-sm leading-relaxed text-ink-muted">{issue.snippet}</p>
              </div>

              <div className="flex justify-end border-t border-line pt-4 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="flex items-center gap-1 text-label uppercase text-accent">
                  Read <ArrowUpRight className="h-3 w-3" />
                </span>
              </div>
            </div>
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

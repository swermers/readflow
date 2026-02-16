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

  let issuesQuery = supabase
    .from('issues')
    .select('*')
    .eq('sender_id', params.id)
    .order(libraryView ? 'read_at' : 'received_at', { ascending: false });

  if (libraryView) {
    issuesQuery = issuesQuery.eq('status', 'read');
  } else {
    issuesQuery = issuesQuery.neq('status', 'archived');
  }

  const { data: issues } = await issuesQuery;

  return (
    <div className="p-6 md:p-12 min-h-screen">
      <div className="mb-8">
        <Link
          href={libraryView ? '/library' : '/'}
          className="inline-flex items-center gap-2 text-label uppercase text-ink-faint hover:text-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {libraryView ? 'Back to Library' : 'Back to Rack'}
        </Link>
      </div>

      <header className="mb-10 pb-10 border-b border-line">
        <div className="flex items-center gap-6 mb-6">
          <div className="w-16 h-16 bg-surface-overlay rounded-full flex items-center justify-center text-2xl font-bold text-ink-faint">
            {sender.name[0]}
          </div>
          <div>
            <h1 className="text-display-lg text-ink">{sender.name}</h1>
            <a href={`mailto:${sender.email}`} className="text-ink-faint text-sm hover:text-accent transition-colors">
              {sender.email}
            </a>
          </div>
        </div>

        <div className="flex gap-3">
          {sender.website_url && (
            <a
              href={sender.website_url}
              target="_blank"
              className="inline-flex items-center gap-2 px-4 py-2 bg-surface-raised hover:bg-surface-overlay border border-line text-label uppercase text-ink-muted transition-colors"
            >
              <Globe className="w-4 h-4" /> Website
            </a>
          )}
          <UnsubscribeButton senderId={sender.id} senderName={sender.name} />
        </div>
      </header>

      <div className="mb-6">
        <p className="text-sm text-ink-muted">
          {libraryView
            ? `${issues?.length || 0} saved ${issues?.length === 1 ? 'article' : 'articles'} in your library.`
            : `${issues?.length || 0} available ${issues?.length === 1 ? 'article' : 'articles'}.`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
        {issues?.map((issue) => (
          <Link key={issue.id} href={`/newsletters/${issue.id}`} className="group">
            <div className="bg-surface border border-line p-6 hover:border-accent transition-all duration-200 h-64 flex flex-col justify-between">
              <span className="text-[10px] text-ink-faint flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {libraryView && issue.read_at
                  ? `Saved ${new Date(issue.read_at).toLocaleDateString()}`
                  : new Date(issue.received_at).toLocaleDateString()}
              </span>

              <div>
                <h3 className="text-lg font-bold leading-tight text-ink mb-2 group-hover:text-accent transition-colors">
                  {issue.subject}
                </h3>
                <p className="text-sm text-ink-muted line-clamp-3 leading-relaxed">
                  {issue.snippet}
                </p>
              </div>

              <div className="pt-4 border-t border-line flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="flex items-center gap-1 text-label uppercase text-accent">
                  Read <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </Link>
        ))}

        {(!issues || issues.length === 0) && (
          <div className="col-span-full py-12 text-center text-ink-faint">
            <p className="text-sm">
              {libraryView ? 'No saved articles from this newsletter yet.' : 'No issues from this sender yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

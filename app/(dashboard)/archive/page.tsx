'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { Search, ArrowUpRight, Archive, AlertCircle } from 'lucide-react';
import IssueDeleteButton from '@/components/IssueDeleteButton';

export default function ArchivePage() {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const supabase = createClient();

  useEffect(() => {
    fetchArchived();
  }, []);

  const fetchArchived = async () => {
    const { data, error: fetchError } = await supabase
      .from('issues')
      .select('*, senders!inner(name, status)')
      .eq('status', 'archived')
      .is('deleted_at', null)
      .order('archived_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching archived issues:', fetchError);
      setError('Failed to load archive.');
    }
    if (data) setIssues(data);
    setLoading(false);
  };

  const filtered = searchQuery.trim()
    ? issues.filter(
        (issue) =>
          issue.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          issue.snippet?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          issue.senders?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : issues;

  if (loading) {
    return <div className="p-12 text-ink-muted animate-pulse">Loading archive...</div>;
  }

  if (error) {
    return (
      <div className="p-6 md:p-12 min-h-screen">
        <header className="mb-8">
          <h1 className="text-display-lg text-ink">Archive.</h1>
        </header>
        <div className="h-px bg-line-strong mb-8" />
        <div className="text-center py-20 bg-surface-raised border border-line">
          <AlertCircle className="w-10 h-10 text-accent mx-auto mb-4" />
          <p className="text-ink font-medium">Something went wrong.</p>
          <p className="text-sm text-ink-muted mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-12 min-h-screen">
      <header className="mb-8">
        <h1 className="text-display-lg text-ink">Archive.</h1>
        <p className="text-sm text-ink-muted mt-1">
          {issues.length} archived {issues.length === 1 ? 'article' : 'articles'}.
        </p>
      </header>

      <div className="h-px bg-line-strong mb-8" />

      <div className="relative mb-8 max-w-lg">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search archive..."
          className="w-full rounded-xl border border-line bg-surface-raised py-3.5 pl-12 pr-4 text-sm text-ink placeholder:text-ink-faint transition-all focus:border-line-strong focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-surface-raised border border-dashed border-line">
          <Archive className="w-10 h-10 text-ink-faint mx-auto mb-4" />
          <p className="text-ink-muted font-medium">Archive is empty.</p>
          <p className="text-sm text-ink-faint">Archived articles appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {filtered.map((issue) => (
            <Link key={issue.id} href={`/newsletters/${issue.id}`} className="group">
              <article className="relative flex h-52 md:h-56 flex-col justify-between rounded-2xl border border-line bg-surface p-4 md:p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_14px_32px_rgba(15,23,42,0.12)]">
                <div>
                  <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-[10px] uppercase tracking-[0.08em] text-accent">{issue.senders?.name || 'Unknown'}</p>
                  <div className="flex items-center gap-1">
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">ARCH</span>
                    <IssueDeleteButton
                      issueId={issue.id}
                      compact
                      onDeleted={() => setIssues((prev) => prev.filter((row) => row.id !== issue.id))}
                    />
                  </div>
                </div>
                  <h3 className="mt-2 text-sm md:text-base font-semibold leading-tight text-ink line-clamp-3 group-hover:text-accent transition-colors">
                    {issue.subject}
                  </h3>
                </div>

                <div className="pt-3 border-t border-line">
                  <p className="text-[11px] text-ink-faint line-clamp-2">{issue.snippet}</p>
                  <p className="mt-2 text-[10px] text-ink-faint">
                    {issue.archived_at
                      ? new Date(issue.archived_at).toLocaleDateString()
                      : new Date(issue.received_at).toLocaleDateString()}
                  </p>
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase text-accent">
                    Open <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

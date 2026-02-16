'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { Search, ArrowUpRight, Archive, AlertCircle } from 'lucide-react';

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
          className="w-full pl-12 pr-4 py-3.5 bg-surface-raised border border-line focus:outline-none focus:border-line-strong transition-all text-sm text-ink placeholder:text-ink-faint"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-surface-raised border border-dashed border-line">
          <Archive className="w-10 h-10 text-ink-faint mx-auto mb-4" />
          <p className="text-ink-muted font-medium">Archive is empty.</p>
          <p className="text-sm text-ink-faint">Archived articles appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
          {filtered.map((issue) => (
            <Link key={issue.id} href={`/newsletters/${issue.id}`} className="group">
              <article className="h-52 md:h-56 border border-line bg-surface p-4 md:p-5 flex flex-col justify-between hover:border-accent transition-all duration-200">
                <div>
                  <p className="text-[10px] uppercase text-accent truncate">{issue.senders?.name || 'Unknown'}</p>
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

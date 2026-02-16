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
      <div className="p-8 md:p-12 min-h-screen">
        <header className="mb-10">
          <h1 className="text-display-lg text-ink">Archive.</h1>
        </header>
        <div className="h-px bg-line-strong mb-10" />
        <div className="text-center py-20 bg-surface-raised border border-line">
          <AlertCircle className="w-10 h-10 text-accent mx-auto mb-4" />
          <p className="text-ink font-medium">Something went wrong.</p>
          <p className="text-sm text-ink-muted mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 min-h-screen">
      <header className="mb-10">
        <h1 className="text-display-lg text-ink">Archive.</h1>
        <p className="text-sm text-ink-muted mt-1">
          {issues.length} archived {issues.length === 1 ? 'issue' : 'issues'}.
        </p>
      </header>

      <div className="h-px bg-line-strong mb-8" />

      <div className="relative mb-10 max-w-lg">
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
        <div className="divide-y divide-line">
          {filtered.map((issue) => (
            <Link key={issue.id} href={`/newsletters/${issue.id}`}>
              <div className="group flex items-center justify-between py-5 px-2 hover:bg-surface-raised transition-colors cursor-pointer">
                <div className="flex-1 min-w-0 pr-8">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-sm text-ink">{issue.senders?.name || 'Unknown'}</span>
                    <span className="text-ink-faint">&middot;</span>
                    <span className="text-xs text-ink-faint">
                      {issue.archived_at
                        ? new Date(issue.archived_at).toLocaleDateString()
                        : new Date(issue.received_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-base font-medium text-ink truncate group-hover:text-accent transition-colors">
                    {issue.subject}
                  </h3>
                  <p className="text-sm text-ink-faint truncate mt-0.5">{issue.snippet}</p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowUpRight className="w-4 h-4 text-ink-faint" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

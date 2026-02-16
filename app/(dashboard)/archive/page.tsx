'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { Search, ArrowUpRight, Library, AlertCircle } from 'lucide-react';

export default function ArchivePage() {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const supabase = createClient();

  useEffect(() => {
    fetchSaved();
  }, []);

  const fetchSaved = async () => {
    const { data, error: fetchError } = await supabase
      .from('issues')
      .select('*, senders!inner(name, status)')
      .eq('status', 'read')
      .order('read_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching library issues:', fetchError);
      setError('Failed to load your library.');
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

  const senderCounts = issues.reduce((acc: Record<string, number>, issue) => {
    const name = issue.senders?.name || 'Unknown';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return <div className="p-12 text-ink-muted animate-pulse">Loading library...</div>;
  }

  if (error) {
    return (
      <div className="p-8 md:p-12 min-h-screen">
        <header className="mb-10">
          <h1 className="text-display-lg text-ink">Library.</h1>
        </header>
        <div className="h-px bg-line-strong mb-10" />
        <div className="text-center py-20 bg-surface-raised border border-line">
          <AlertCircle className="w-10 h-10 text-accent mx-auto mb-4" />
          <p className="text-ink font-medium">Something went wrong.</p>
          <p className="text-sm text-ink-muted mt-1">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); fetchSaved(); }}
            className="mt-6 px-6 py-2.5 bg-ink text-surface text-label uppercase hover:bg-accent transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 min-h-screen">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-display-lg text-ink">Library.</h1>
          <p className="text-sm text-ink-muted mt-1">
            {issues.length} saved {issues.length === 1 ? 'issue' : 'issues'}.
          </p>
        </div>
        {Object.keys(senderCounts).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(senderCounts).slice(0, 5).map(([name, count]) => (
              <span key={name} className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-surface-overlay text-ink-muted border border-line">
                {name} ({count})
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="h-px bg-line-strong mb-8" />

      <div className="relative mb-10 max-w-lg">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search your saved library..."
          className="w-full pl-12 pr-4 py-3.5 bg-surface-raised border border-line focus:outline-none focus:border-line-strong transition-all text-sm text-ink placeholder:text-ink-faint"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-surface-raised border border-dashed border-line">
          <Library className="w-10 h-10 text-ink-faint mx-auto mb-4" />
          {searchQuery ? (
            <>
              <p className="text-ink-muted font-medium">No matches found.</p>
              <p className="text-sm text-ink-faint">Try a different search term.</p>
            </>
          ) : (
            <>
              <p className="text-ink-muted font-medium">Your library is empty.</p>
              <p className="text-sm text-ink-faint">Save issues from The Rack to keep them here.</p>
            </>
          )}
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
                      {issue.read_at
                        ? new Date(issue.read_at).toLocaleDateString()
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

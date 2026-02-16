'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ArrowUpRight, BookMarked, Search, AlertCircle, Mail } from 'lucide-react';

type SenderCard = {
  id: string;
  name: string;
  email: string;
  totalCount: number;
  savedCount: number;
  latestDate?: string;
};

export default function LibraryPage() {
  const [senders, setSenders] = useState<SenderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const supabase = createClient();

  useEffect(() => {
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
    const { data: senderRows, error: senderError } = await supabase
      .from('senders')
      .select('id, name, email')
      .eq('status', 'approved')
      .order('name', { ascending: true });

    if (senderError) {
      console.error('Error fetching senders:', senderError);
      setError('Failed to load your library.');
      setLoading(false);
      return;
    }

    const senderIds = (senderRows || []).map((row) => row.id);
    if (senderIds.length === 0) {
      setSenders([]);
      setLoading(false);
      return;
    }

    const { data: issues, error: issueError } = await supabase
      .from('issues')
      .select('sender_id, status, received_at, read_at')
      .in('sender_id', senderIds)
      .neq('status', 'archived');

    if (issueError) {
      console.error('Error fetching sender issues:', issueError);
      setError('Failed to load your library.');
      setLoading(false);
      return;
    }

    const issueMap = (issues || []).reduce((acc: Record<string, any[]>, issue) => {
      acc[issue.sender_id] = acc[issue.sender_id] || [];
      acc[issue.sender_id].push(issue);
      return acc;
    }, {});

    const cards: SenderCard[] = (senderRows || [])
      .map((sender) => {
        const rows = issueMap[sender.id] || [];
        const savedRows = rows.filter((row) => row.status === 'read');
        const latest = rows
          .map((row) => row.received_at)
          .sort((a, b) => +new Date(b) - +new Date(a))[0];

        return {
          id: sender.id,
          name: sender.name,
          email: sender.email,
          totalCount: rows.length,
          savedCount: savedRows.length,
          latestDate: latest,
        };
      })
      .filter((card) => card.totalCount > 0);

    setSenders(cards);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return senders;
    const q = searchQuery.toLowerCase();
    return senders.filter((sender) => sender.name.toLowerCase().includes(q) || sender.email.toLowerCase().includes(q));
  }, [senders, searchQuery]);

  if (loading) {
    return <div className="animate-pulse p-12 text-ink-muted">Loading library...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen p-8 md:p-12">
        <header className="mb-10">
          <h1 className="text-display-lg text-ink">Library.</h1>
        </header>
        <div className="mb-10 h-px bg-line-strong" />
        <div className="border border-line bg-surface-raised py-20 text-center">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-accent" />
          <p className="font-medium text-ink">Something went wrong.</p>
          <p className="mt-1 text-sm text-ink-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 md:p-12">
      <header className="mb-10">
        <h1 className="text-display-lg text-ink">Library.</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {senders.length} {senders.length === 1 ? 'newsletter' : 'newsletters'} with articles.
        </p>
      </header>

      <div className="mb-8 h-px bg-line-strong" />

      <div className="relative mb-10 max-w-lg">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search newsletters in library..."
          className="w-full border border-line bg-surface-raised py-3.5 pl-12 pr-4 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-line bg-surface-raised py-20 text-center">
          <BookMarked className="mx-auto mb-4 h-10 w-10 text-ink-faint" />
          <p className="font-medium text-ink-muted">No newsletters found.</p>
          <p className="text-sm text-ink-faint">Sync your inbox to populate the library.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {filtered.map((sender) => (
            <Link key={sender.id} href={`/sender/${sender.id}?view=library`} className="group">
              <article className="flex h-48 md:h-56 flex-col justify-between border border-line bg-surface p-4 md:p-6 transition-all duration-200 hover:border-accent">
                <div>
                  <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-overlay text-ink-faint">
                    <Mail className="h-4 w-4" />
                  </div>
                  <h3 className="truncate text-lg font-bold text-ink transition-colors group-hover:text-accent">{sender.name}</h3>
                  <p className="mt-1 truncate text-[11px] md:text-xs font-mono text-ink-faint">{sender.email}</p>
                </div>

                <div className="space-y-1.5 border-t border-line pt-3 text-[11px] md:text-xs text-ink-muted">
                  <p>{sender.totalCount} total article{sender.totalCount === 1 ? '' : 's'}</p>
                  <p>{sender.savedCount} saved</p>
                  <p>{sender.latestDate ? `Latest: ${new Date(sender.latestDate).toLocaleDateString()}` : 'No dates yet'}</p>
                  <span className="inline-flex items-center gap-1 uppercase text-accent">
                    Open <ArrowUpRight className="h-3 w-3" />
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

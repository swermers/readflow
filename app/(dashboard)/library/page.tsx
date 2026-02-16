'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ArrowUpRight, BookMarked, Search, AlertCircle } from 'lucide-react';

export default function LibraryPage() {
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
      .select('sender_id, read_at, senders!inner(name, email)')
      .eq('status', 'read')
      .order('read_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching library senders:', fetchError);
      setError('Failed to load your library.');
      setLoading(false);
      return;
    }

    setIssues(data || []);
    setLoading(false);
  };

  const senders = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string; count: number; lastReadAt?: string }>();

    for (const issue of issues) {
      const senderId = issue.sender_id as string;
      const sender = issue.senders;
      if (!senderId || !sender) continue;

      const existing = map.get(senderId);
      if (!existing) {
        map.set(senderId, {
          id: senderId,
          name: sender.name,
          email: sender.email,
          count: 1,
          lastReadAt: issue.read_at || undefined,
        });
      } else {
        existing.count += 1;
        if (!existing.lastReadAt && issue.read_at) {
          existing.lastReadAt = issue.read_at;
        }
      }
    }

    return Array.from(map.values());
  }, [issues]);

  const filtered = searchQuery.trim()
    ? senders.filter(
        (sender) =>
          sender.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          sender.email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : senders;

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
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 min-h-screen">
      <header className="mb-10">
        <h1 className="text-display-lg text-ink">Library.</h1>
        <p className="text-sm text-ink-muted mt-1">
          {senders.length} {senders.length === 1 ? 'newsletter' : 'newsletters'} with saved articles.
        </p>
      </header>

      <div className="h-px bg-line-strong mb-8" />

      <div className="relative mb-10 max-w-lg">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search newsletters in library..."
          className="w-full pl-12 pr-4 py-3.5 bg-surface-raised border border-line focus:outline-none focus:border-line-strong transition-all text-sm text-ink placeholder:text-ink-faint"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-surface-raised border border-dashed border-line">
          <BookMarked className="w-10 h-10 text-ink-faint mx-auto mb-4" />
          <p className="text-ink-muted font-medium">Your library is empty.</p>
          <p className="text-sm text-ink-faint">Save articles from The Rack to keep them here.</p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {filtered.map((sender) => (
            <Link key={sender.id} href={`/sender/${sender.id}?view=library`}>
              <div className="group flex items-center justify-between py-5 px-2 hover:bg-surface-raised transition-colors cursor-pointer">
                <div className="min-w-0 pr-8">
                  <h3 className="text-base font-semibold text-ink group-hover:text-accent transition-colors truncate">
                    {sender.name}
                  </h3>
                  <p className="text-xs text-ink-faint font-mono truncate mt-0.5">{sender.email}</p>
                  <p className="text-xs text-ink-muted mt-1">
                    {sender.count} saved {sender.count === 1 ? 'article' : 'articles'}
                    {sender.lastReadAt ? ` · last saved ${new Date(sender.lastReadAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

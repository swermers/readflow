'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { Search, StickyNote, Trash2, ArrowUpRight, AlertCircle, Loader2 } from 'lucide-react';
import { triggerToast } from '@/components/Toast';

interface HighlightRow {
  id: string;
  highlighted_text: string;
  note: string | null;
  created_at: string;
  issue_id: string;
  issues: {
    id: string;
    subject: string;
    sender_id: string;
    senders: {
      id: string;
      name: string;
    };
  };
}

export default function NotesPage() {
  const [highlights, setHighlights] = useState<HighlightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchHighlights();
  }, []);

  const fetchHighlights = async () => {
    try {
      const res = await fetch('/api/highlights');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setHighlights(data);
    } catch {
      setError('Failed to load highlights.');
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/highlights/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setHighlights(prev => prev.filter(h => h.id !== id));
        triggerToast('Highlight removed');
      }
    } catch {
      triggerToast('Failed to delete');
    }
    setDeleting(null);
  };

  const filtered = searchQuery.trim()
    ? highlights.filter(
        (h) =>
          h.highlighted_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.note?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.issues?.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.issues?.senders?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : highlights;

  // Group by issue
  const grouped = filtered.reduce<Record<string, { subject: string; senderName: string; issueId: string; highlights: HighlightRow[] }>>((acc, h) => {
    const key = h.issue_id;
    if (!acc[key]) {
      acc[key] = {
        subject: h.issues?.subject || 'Untitled',
        senderName: h.issues?.senders?.name || 'Unknown',
        issueId: h.issue_id,
        highlights: [],
      };
    }
    acc[key].highlights.push(h);
    return acc;
  }, {});

  const groups = Object.values(grouped);

  if (loading) {
    return (
      <div className="p-12 text-ink-muted flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading notes...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 md:p-12 min-h-screen">
        <header className="mb-10">
          <h1 className="text-display-lg text-ink">Notes.</h1>
        </header>
        <div className="h-px bg-line-strong mb-10" />
        <div className="text-center py-20 bg-surface-raised border border-line">
          <AlertCircle className="w-10 h-10 text-accent mx-auto mb-4" />
          <p className="text-ink font-medium">Something went wrong.</p>
          <p className="text-sm text-ink-muted mt-1">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); fetchHighlights(); }}
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

      {/* Header */}
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-display-lg text-ink">Notes.</h1>
          <p className="text-sm text-ink-muted mt-1">
            {highlights.length} {highlights.length === 1 ? 'highlight' : 'highlights'} across {groups.length} {groups.length === 1 ? 'article' : 'articles'}.
          </p>
        </div>
      </header>

      <div className="h-px bg-line-strong mb-8" />

      {/* Search */}
      <div className="relative mb-10 max-w-lg">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search highlights and notes..."
          className="w-full pl-12 pr-4 py-3.5 bg-surface-raised border border-line focus:outline-none focus:border-line-strong transition-all text-sm text-ink placeholder:text-ink-faint"
        />
      </div>

      {/* Notes grouped by article */}
      {groups.length === 0 ? (
        <div className="text-center py-20 bg-surface-raised border border-dashed border-line">
          <StickyNote className="w-10 h-10 text-ink-faint mx-auto mb-4" />
          {searchQuery ? (
            <>
              <p className="text-ink-muted font-medium">No matches found.</p>
              <p className="text-sm text-ink-faint">Try a different search term.</p>
            </>
          ) : (
            <>
              <p className="text-ink-muted font-medium">No highlights yet.</p>
              <p className="text-sm text-ink-faint mt-1">
                Select text while reading a newsletter to highlight and add notes.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.issueId} className="bg-surface-raised border border-line">
              {/* Article header */}
              <Link href={`/newsletters/${group.issueId}`}>
                <div className="group flex items-center justify-between px-5 py-4 border-b border-line hover:bg-surface-overlay transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-surface-overlay flex items-center justify-center text-[11px] font-bold text-ink-faint flex-shrink-0">
                      {group.senderName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink truncate group-hover:text-accent transition-colors">
                        {group.subject}
                      </p>
                      <p className="text-[11px] text-ink-faint">{group.senderName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-ink-faint">{group.highlights.length} {group.highlights.length === 1 ? 'note' : 'notes'}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </Link>

              {/* Highlights list */}
              <div className="divide-y divide-line">
                {group.highlights.map((h) => (
                  <div key={h.id} className="px-5 py-4 flex gap-4">
                    {/* Yellow bar */}
                    <div className="w-1 flex-shrink-0 bg-yellow-400/60 rounded-full" />

                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Highlighted text */}
                      <p className="text-sm text-ink leading-relaxed">
                        &ldquo;{h.highlighted_text}&rdquo;
                      </p>

                      {/* Note */}
                      {h.note && (
                        <p className="text-sm text-ink-muted italic">
                          {h.note}
                        </p>
                      )}

                      {/* Meta */}
                      <p className="text-[10px] text-ink-faint">
                        {new Date(h.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </p>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(h.id)}
                      disabled={deleting === h.id}
                      className="flex-shrink-0 self-start mt-1 text-ink-faint hover:text-accent transition-colors disabled:opacity-50"
                    >
                      {deleting === h.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { NotebookPen, Search, Trash2, AlertCircle, Download } from 'lucide-react';

type Highlight = {
  id: string;
  issue_id: string;
  highlighted_text: string;
  note: string | null;
  auto_tags?: string[];
  created_at: string;
  issues?: {
    subject?: string;
    senders?: {
      name?: string;
      email?: string;
    };
  };
};

export default function NotesPage() {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [exporting, setExporting] = useState(false);

  const fetchHighlights = async (query = '') => {
    const base = query.trim() ? `/api/highlights?search=${encodeURIComponent(query.trim())}` : '/api/highlights';
    const url = `${base}${base.includes('?') ? '&' : '?'}sort=${sortOrder}`;
    const res = await fetch(url);

    if (!res.ok) {
      setError('Failed to load notes.');
      setLoading(false);
      return;
    }

    const data = await res.json();
    setHighlights(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchHighlights();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchHighlights(search);
    }, 200);

    return () => clearTimeout(timeout);
  }, [search, sortOrder]);

  const grouped = useMemo(() => {
    const map = new Map<string, Highlight[]>();

    highlights.forEach((highlight) => {
      const key = highlight.issue_id;
      const existing = map.get(key) || [];
      existing.push(highlight);
      map.set(key, existing);
    });

    return Array.from(map.entries());
  }, [highlights]);

  const deleteHighlight = async (id: string) => {
    const res = await fetch(`/api/highlights/${id}`, { method: 'DELETE' });
    if (!res.ok) return;

    setHighlights((prev) => prev.filter((highlight) => highlight.id !== id));
  };

  const exportNotesForNotion = async () => {
    setExporting(true);

    try {
      const res = await fetch('/api/notes/export?format=notion_markdown');

      if (!res.ok) {
        setError('Failed to export notes.');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `readflow-notes-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-ink-muted animate-pulse">Loading notes...</div>;
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
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 min-h-screen">
      <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-display-lg text-ink">Notes.</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {highlights.length} saved {highlights.length === 1 ? 'highlight' : 'highlights'}.
          </p>
        </div>
        <button
          onClick={exportNotesForNotion}
          disabled={exporting || highlights.length === 0}
          className="inline-flex items-center gap-2 border border-line bg-surface-raised px-4 py-2 text-xs uppercase tracking-[0.1em] text-ink-muted transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          {exporting ? 'Exporting…' : 'Export for Notion'}
        </button>
      </header>

      <div className="h-px bg-line-strong mb-8" />

      <div className="relative mb-8 max-w-lg">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search highlights and notes..."
          className="w-full border border-line bg-surface-raised py-3.5 pl-12 pr-4 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
        />
      </div>

      <div className="mb-8">
        <label className="mr-3 text-xs uppercase tracking-[0.1em] text-ink-faint">Sort</label>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
          className="border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {grouped.length === 0 ? (
        <div className="border border-dashed border-line bg-surface-raised py-20 text-center">
          <NotebookPen className="mx-auto mb-4 h-10 w-10 text-ink-faint" />
          <p className="font-medium text-ink-muted">No notes yet.</p>
          <p className="text-sm text-ink-faint">Highlight text in any newsletter to start your knowledge trail.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([issueId, entries]) => {
            const first = entries[0];
            return (
              <section key={issueId} className="space-y-3">
                <div className="flex items-end justify-between gap-4 border-b border-line pb-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-accent">{first.issues?.senders?.name || 'Unknown Sender'}</p>
                    <h2 className="text-lg font-bold text-ink">{first.issues?.subject || 'Untitled Issue'}</h2>
                  </div>
                  <Link href={`/newsletters/${issueId}`} className="text-xs uppercase tracking-[0.1em] text-ink-faint hover:text-accent">
                    Open issue
                  </Link>
                </div>

                <div className="space-y-3">
                  {entries.map((highlight) => (
                    <article key={highlight.id} className="rounded-xl border border-line bg-surface-raised p-4">
                      <blockquote className="border-l-2 border-accent pl-3 text-sm text-ink-muted">
                        {highlight.highlighted_text}
                      </blockquote>

                      {highlight.note?.trim() && (
                        <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm text-ink">{highlight.note}</p>
                      )}

                      {!!highlight.auto_tags?.length && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {highlight.auto_tags.map((tag) => (
                            <span key={`${highlight.id}-${tag}`} className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-ink-faint">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between text-xs text-ink-faint">
                        <span>{new Date(highlight.created_at).toLocaleString()}</span>
                        <button
                          onClick={() => deleteHighlight(highlight.id)}
                          className="inline-flex items-center gap-1 text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

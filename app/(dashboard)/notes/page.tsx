'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { NotebookPen, Search, Trash2, AlertCircle, Download, Copy, Sparkles, BookOpen } from 'lucide-react';

type Highlight = {
  id: string;
  issue_id: string | null;
  ebook_id?: string | null;
  highlighted_text: string;
  note: string | null;
  page_number?: number | null;
  auto_tags?: string[];
  created_at: string;
  issues?: {
    subject?: string;
    senders?: {
      name?: string;
      email?: string;
    };
  };
  ebooks?: {
    title?: string;
    author?: string;
  };
};

type SearchMode = 'all' | 'notes' | 'highlights';
type SourceType = 'all' | 'newsletters' | 'ebooks';

export default function NotesPage() {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [searchMode, setSearchMode] = useState<SearchMode>('all');
  const [sourceType, setSourceType] = useState<SourceType>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resurfacedId, setResurfacedId] = useState<string | null>(null);

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

  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    highlights.forEach((highlight) => {
      if (highlight.ebook_id) {
        const source = highlight.ebooks?.title || 'Untitled Book';
        counts.set(source, (counts.get(source) || 0) + 1);
      } else {
        const source = highlight.issues?.senders?.name || 'Unknown Sender';
        counts.set(source, (counts.get(source) || 0) + 1);
      }
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [highlights]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    highlights.forEach((highlight) => {
      (highlight.auto_tags || []).forEach((tag) => {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [highlights]);

  const filteredHighlights = useMemo(() => {
    return highlights.filter((highlight) => {
      if (searchMode === 'notes' && !highlight.note?.trim()) return false;
      if (searchMode === 'highlights' && !!highlight.note?.trim()) return false;

      if (sourceType === 'newsletters' && highlight.ebook_id) return false;
      if (sourceType === 'ebooks' && !highlight.ebook_id) return false;

      if (selectedTag && !(highlight.auto_tags || []).includes(selectedTag)) return false;

      if (selectedSource) {
        const source = highlight.ebook_id
          ? (highlight.ebooks?.title || 'Untitled Book')
          : (highlight.issues?.senders?.name || 'Unknown Sender');
        if (source !== selectedSource) return false;
      }

      return true;
    });
  }, [highlights, searchMode, sourceType, selectedTag, selectedSource]);

  const grouped = useMemo(() => {
    const map = new Map<string, Highlight[]>();

    filteredHighlights.forEach((highlight) => {
      // Group by ebook_id or issue_id
      const key = highlight.ebook_id || highlight.issue_id || 'unknown';
      const existing = map.get(key) || [];
      existing.push(highlight);
      map.set(key, existing);
    });

    return Array.from(map.entries());
  }, [filteredHighlights]);

  const deleteHighlight = async (id: string) => {
    const res = await fetch(`/api/highlights/${id}`, { method: 'DELETE' });
    if (!res.ok) return;

    setHighlights((prev) => prev.filter((highlight) => highlight.id !== id));
  };

  const copyHighlight = async (highlight: Highlight) => {
    const parts = [highlight.highlighted_text.trim()];
    if (highlight.note?.trim()) {
      parts.push(`My Thought: ${highlight.note.trim()}`);
    }

    await navigator.clipboard.writeText(parts.join('\n\n'));
    setCopiedId(highlight.id);
    setTimeout(() => setCopiedId((current) => (current === highlight.id ? null : current)), 1200);
  };

  const resurfaceInsight = () => {
    if (filteredHighlights.length === 0) return;
    const pick = filteredHighlights[Math.floor(Math.random() * filteredHighlights.length)];
    setResurfacedId(pick.id);
    const card = document.getElementById(`highlight-${pick.id}`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  // Count ebook vs newsletter highlights
  const ebookHighlightCount = highlights.filter((h) => h.ebook_id).length;
  const newsletterHighlightCount = highlights.filter((h) => !h.ebook_id).length;

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
    <div className="p-4 sm:p-6 md:p-10 min-h-screen">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-display-lg text-ink">Notes.</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {filteredHighlights.length} saved {filteredHighlights.length === 1 ? 'highlight' : 'highlights'}
            {sourceType === 'all' && ebookHighlightCount > 0 && newsletterHighlightCount > 0 && (
              <span className="text-ink-faint"> · {newsletterHighlightCount} from newsletters · {ebookHighlightCount} from books</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={resurfaceInsight}
            disabled={filteredHighlights.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface-raised px-3 py-2 text-xs uppercase tracking-[0.08em] text-ink-muted transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Resurface Insight
          </button>
          <button
            onClick={exportNotesForNotion}
            disabled={exporting || filteredHighlights.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface-raised px-3 py-2 text-xs uppercase tracking-[0.08em] text-ink-muted transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </header>

      <div className="h-px bg-line-strong mb-6" />

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-line bg-surface-raised p-4 h-fit lg:sticky lg:top-24">
          <p className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">Library Filters</p>

          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
            />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.08em]">
            {(['all', 'notes', 'highlights'] as SearchMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setSearchMode(mode)}
                className={`rounded-lg border px-2 py-1.5 ${searchMode === mode ? 'border-accent text-accent bg-accent/5' : 'border-line text-ink-faint hover:text-ink'}`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Source type filter */}
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">Source Type</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.08em]">
              {([
                { key: 'all', label: 'All' },
                { key: 'newsletters', label: 'Letters' },
                { key: 'ebooks', label: 'Books' },
              ] as { key: SourceType; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSourceType(key)}
                  className={`rounded-lg border px-2 py-1.5 ${sourceType === key ? 'border-accent text-accent bg-accent/5' : 'border-line text-ink-faint hover:text-ink'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">Popular Tags</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {tagCounts.length === 0 && <p className="text-xs text-ink-faint">No tags yet.</p>}
              {tagCounts.map(([tag, count]) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag((current) => (current === tag ? null : tag))}
                  className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] ${selectedTag === tag ? 'border-accent text-accent bg-accent/5' : 'border-line text-ink-faint hover:text-ink'}`}
                >
                  #{tag} · {count}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">Top Sources</p>
            <div className="mt-2 space-y-1.5">
              {sourceCounts.map(([source, count]) => (
                <button
                  key={source}
                  onClick={() => setSelectedSource((current) => (current === source ? null : source))}
                  className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs ${selectedSource === source ? 'border-accent text-accent bg-accent/5' : 'border-line text-ink-muted hover:text-ink'}`}
                >
                  <span className="truncate text-left">{source}</span>
                  <span className="text-[10px]">{count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between text-[10px] uppercase tracking-[0.08em]">
            <label className="text-ink-faint">Sort</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
              className="border border-line bg-surface px-2 py-1 text-[10px] text-ink focus:border-line-strong focus:outline-none"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </aside>

        <main className="min-w-0">
          {grouped.length === 0 ? (
            <div className="border border-dashed border-line bg-surface-raised py-20 text-center">
              <NotebookPen className="mx-auto mb-4 h-10 w-10 text-ink-faint" />
              <p className="font-medium text-ink-muted">No notes yet.</p>
              <p className="text-sm text-ink-faint">Highlight text in any newsletter or e-book to start your knowledge trail.</p>
            </div>
          ) : (
            <div className="space-y-6 md:space-y-8">
              {grouped.map(([groupId, entries]) => {
                const first = entries[0];
                const isEbook = !!first.ebook_id;
                const sectionTags = Array.from(new Set(entries.flatMap((entry) => entry.auto_tags || []))).slice(0, 8);
                return (
                  <section key={groupId} className="rounded-2xl border border-line bg-surface-raised p-4 md:p-5 space-y-4">
                    <div className="lg:sticky lg:top-16 z-[1] -mx-1 border-b border-line bg-surface-raised/95 px-1 pb-3 pt-1 backdrop-blur">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          {isEbook ? (
                            <>
                              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-yellow-600">
                                <BookOpen className="h-3 w-3" />
                                Book
                              </p>
                              <h2 className="text-lg md:text-xl font-semibold text-ink">
                                {first.ebooks?.title || 'Untitled Book'}
                              </h2>
                              {first.ebooks?.author && (
                                <p className="text-xs text-ink-faint">by {first.ebooks.author}</p>
                              )}
                            </>
                          ) : (
                            <>
                              <p className="text-xs uppercase tracking-[0.12em] text-accent">{first.issues?.senders?.name || 'Unknown Sender'}</p>
                              <h2 className="text-lg md:text-xl font-semibold text-ink">{first.issues?.subject || 'Untitled Issue'}</h2>
                            </>
                          )}
                        </div>
                        {isEbook ? (
                          <Link href={`/books/${groupId}`} className="text-xs uppercase tracking-[0.1em] text-ink-faint hover:text-accent">
                            Open book
                          </Link>
                        ) : (
                          <Link href={`/newsletters/${groupId}`} className="text-xs uppercase tracking-[0.1em] text-ink-faint hover:text-accent">
                            Open issue
                          </Link>
                        )}
                      </div>

                      {!!sectionTags.length && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {sectionTags.map((tag) => (
                            <button
                              key={`${groupId}-${tag}`}
                              onClick={() => setSelectedTag((current) => (current === tag ? null : tag))}
                              className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-ink-faint hover:text-ink"
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {entries.map((highlight) => (
                        <article
                          id={`highlight-${highlight.id}`}
                          key={highlight.id}
                          className={`group rounded-xl border border-line bg-surface p-4 transition ${resurfacedId === highlight.id ? 'ring-1 ring-accent/60 border-accent/40' : ''}`}
                        >
                          <blockquote className="border-l-2 border-accent pl-3 text-sm text-ink-muted">
                            {highlight.highlighted_text}
                          </blockquote>

                          {highlight.page_number && (
                            <p className="mt-1 text-[10px] text-ink-faint">Page {highlight.page_number}</p>
                          )}

                          {highlight.note?.trim() && (
                            <div className="mt-3 rounded-lg border border-line bg-surface-raised px-3 py-2">
                              <p className="text-[10px] uppercase tracking-[0.08em] text-accent">My Thought</p>
                              <p className="mt-1 text-sm text-ink">{highlight.note}</p>
                            </div>
                          )}

                          <div className="mt-3 flex flex-col gap-2 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between">
                            <span>{new Date(highlight.created_at).toLocaleString()}</span>
                            <div className="flex flex-wrap items-center gap-3">
                              {isEbook ? (
                                <Link href={`/books/${groupId}`} className="uppercase tracking-[0.08em] hover:text-accent">
                                  Open in reader
                                </Link>
                              ) : (
                                <Link href={`/newsletters/${groupId}?h=${highlight.id}`} className="uppercase tracking-[0.08em] hover:text-accent">
                                  Jump to paragraph
                                </Link>
                              )}
                              <button onClick={() => copyHighlight(highlight)} className="inline-flex items-center gap-1 hover:text-ink">
                                <Copy className="h-3.5 w-3.5" />
                                {copiedId === highlight.id ? 'Copied' : 'Copy'}
                              </button>
                              <button
                                onClick={() => deleteHighlight(highlight.id)}
                                className="inline-flex items-center gap-1 text-red-500 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

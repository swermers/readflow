'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Search, Loader2, ArrowUpRight, Clock } from 'lucide-react';

type SearchResult = {
  id: string;
  subject: string;
  snippet: string;
  from_email: string;
  received_at: string;
  status: string;
  sender_name: string | null;
  rank: number;
};

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&limit=30`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (value: string) => {
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      doSearch(value);
    }, 350);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    doSearch(query);
  };

  return (
    <div className="p-6 md:p-12 min-h-screen">
      <header className="mb-8">
        <h1 className="text-display-lg text-ink">Search.</h1>
        <p className="text-sm text-ink-muted mt-1">Find any newsletter issue by keyword, topic, or sender.</p>
      </header>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-faint" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search by keyword, topic, or sender name..."
            autoFocus
            className="w-full rounded-xl border border-line bg-surface pl-12 pr-4 py-3.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
          />
          {loading && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-accent animate-spin" />
          )}
        </div>
      </form>

      <div className="h-px bg-line mb-8" />

      {!searched && !loading && (
        <div className="text-center py-16">
          <Search className="w-10 h-10 text-ink-faint mx-auto mb-4" />
          <p className="text-sm text-ink-muted">Start typing to search across all your newsletters.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {['Stratechery', 'AI', 'climate', 'substack'].map((hint) => (
              <button
                key={hint}
                onClick={() => { handleInput(hint); setQuery(hint); }}
                className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-muted hover:border-accent hover:text-accent transition-colors"
              >
                {hint}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-ink-faint">
            Tip: search by sender name, email address, or any keyword in the subject or body.
          </p>
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-ink-muted">
            No results for &ldquo;{query}&rdquo;. Try different keywords.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2 max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint mb-4">
            {results.length} result{results.length === 1 ? '' : 's'}
          </p>

          {results.map((result) => (
            <Link
              key={result.id}
              href={`/newsletters/${result.id}`}
              className="group flex items-start gap-4 rounded-xl border border-line p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-accent truncate">
                    {result.sender_name || result.from_email}
                  </span>
                  {result.sender_name && (
                    <span className="text-[10px] text-ink-faint truncate max-w-[180px]">
                      {result.from_email}
                    </span>
                  )}
                  {result.status === 'unread' && <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />}
                </div>
                <h3 className="text-sm font-semibold text-ink line-clamp-2 group-hover:text-accent transition-colors">
                  {result.subject}
                </h3>
                <p className="text-[11px] text-ink-faint line-clamp-2 mt-1">{result.snippet}</p>
                <div className="flex items-center gap-1 mt-2 text-[10px] text-ink-faint">
                  <Clock className="w-3 h-3" />
                  {new Date(result.received_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-ink-faint group-hover:text-accent flex-shrink-0 mt-1 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

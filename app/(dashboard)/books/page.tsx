'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { BookOpen, Upload, Trash2, AlertCircle, FileText } from 'lucide-react';

type Ebook = {
  id: string;
  title: string;
  author: string;
  file_name: string;
  file_size: number;
  file_type: string;
  status: string;
  current_page: number;
  total_pages: number | null;
  created_at: string;
  sender_email: string | null;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: string): string {
  if (status === 'reading') return 'Reading';
  if (status === 'finished') return 'Finished';
  return 'Unread';
}

function statusColor(status: string): string {
  if (status === 'reading') return 'bg-amber-500';
  if (status === 'finished') return 'bg-emerald-500';
  return 'bg-ink-faint';
}

export default function BooksPage() {
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchEbooks();
  }, []);

  const fetchEbooks = async () => {
    const { data, error: fetchError } = await supabase
      .from('ebooks')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError('Failed to load your books.');
      setLoading(false);
      return;
    }

    setEbooks(data || []);
    setLoading(false);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/ebooks', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || 'Upload failed');
        setUploading(false);
        return;
      }

      const ebook = await res.json();
      setEbooks((prev) => [ebook, ...prev]);
    } catch {
      setError('Upload failed. Please try again.');
    }

    setUploading(false);
    // Reset the input so the same file can be re-uploaded if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const res = await fetch(`/api/ebooks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setEbooks((prev) => prev.filter((e) => e.id !== id));
    }
    setDeleting(null);
  };

  if (loading) {
    return <div className="animate-pulse p-12 text-ink-muted">Loading books...</div>;
  }

  return (
    <div className="min-h-screen p-6 md:p-12">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-display-lg text-ink">Books.</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {ebooks.length} {ebooks.length === 1 ? 'book' : 'books'} in your library.
          </p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.epub"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </header>

      <div className="mb-8 h-px bg-line-strong" />

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {ebooks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface-raised py-20 text-center">
          <BookOpen className="mx-auto mb-4 h-10 w-10 text-ink-faint" />
          <p className="font-medium text-ink-muted">No books yet.</p>
          <p className="mt-1 text-sm text-ink-faint">
            Upload a PDF or EPUB, or forward an email with an ebook attached.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
          >
            <Upload className="h-4 w-4" />
            Upload your first book
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {ebooks.map((ebook) => (
            <div key={ebook.id} className="group relative">
              <Link href={`/books/${ebook.id}`}>
                <article className="relative flex h-56 md:h-64 flex-col justify-between rounded-2xl border border-line bg-surface p-4 md:p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_14px_32px_rgba(15,23,42,0.12)]">
                  {/* File type badge & status */}
                  <div className="flex items-start justify-between">
                    <span className="rounded-md bg-surface-overlay px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                      {ebook.file_type}
                    </span>
                    <span className={`h-2 w-2 rounded-full ${statusColor(ebook.status)}`} title={statusLabel(ebook.status)} />
                  </div>

                  {/* Icon */}
                  <div className="flex items-center justify-center py-2">
                    <FileText className="h-10 w-10 text-ink-faint/40" />
                  </div>

                  {/* Title & meta */}
                  <div>
                    <h3 className="line-clamp-2 text-sm md:text-base font-bold text-ink transition-colors group-hover:text-accent leading-tight">
                      {ebook.title}
                    </h3>
                    {ebook.author && (
                      <p className="mt-0.5 truncate text-[10px] text-ink-faint">{ebook.author}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between text-[10px] text-ink-faint">
                      <span>{formatFileSize(ebook.file_size)}</span>
                      <span>{statusLabel(ebook.status)}</span>
                    </div>
                  </div>
                </article>
              </Link>

              {/* Delete button (top-right, visible on hover) */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete(ebook.id);
                }}
                disabled={deleting === ebook.id}
                className="absolute right-2 top-2 hidden rounded-lg bg-surface-raised p-1.5 text-ink-faint opacity-0 transition-all hover:text-red-500 group-hover:opacity-100 md:block"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

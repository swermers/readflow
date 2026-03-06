'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Maximize2, Minimize2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Ebook = {
  id: string;
  title: string;
  author: string;
  file_type: string;
  status: string;
  current_page: number;
  total_pages: number | null;
};

export default function EbookReader({ ebook }: { ebook: Ebook }) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasMarkedReading, setHasMarkedReading] = useState(ebook.status !== 'unread');
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mark as "reading" on first view
  useEffect(() => {
    if (ebook.status === 'unread' && !hasMarkedReading) {
      fetch(`/api/ebooks/${ebook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'reading' }),
      });
      setHasMarkedReading(true);
    }
  }, [ebook.id, ebook.status, hasMarkedReading]);

  // Track container width for responsive page sizing
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => setContainerWidth(el.clientWidth);
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const markFinished = async () => {
    await fetch(`/api/ebooks/${ebook.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'finished' }),
    });
  };

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
  }, []);

  // Page width: fill container minus padding, capped at 900px for readability
  const pageWidth = containerWidth > 0 ? Math.min(containerWidth - 32, 900) : undefined;

  if (ebook.file_type === 'pdf') {
    return (
      <div ref={containerRef} className="flex min-h-0 flex-1 flex-col bg-surface-overlay">
        {/* PDF toolbar */}
        <div className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-4 py-2">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <BookOpen className="h-3.5 w-3.5" />
            <span>
              PDF Reader
              {numPages && <span className="ml-1 text-ink-faint">({numPages} pages)</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={markFinished}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-emerald-500 hover:text-emerald-500"
            >
              Mark Finished
            </button>
            <button
              onClick={toggleFullscreen}
              className="rounded-lg border border-line p-1.5 text-ink-muted transition-colors hover:border-accent hover:text-accent"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Scrollable PDF pages */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <Document
            file={`/api/ebooks/${ebook.id}/file`}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex items-center justify-center py-20 text-sm text-ink-muted">
                Loading PDF...
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-ink-muted">
                <p>Unable to display PDF.</p>
                <a
                  href={`/api/ebooks/${ebook.id}/file`}
                  download={ebook.title}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover"
                >
                  Download instead
                </a>
              </div>
            }
          >
            {numPages &&
              Array.from({ length: numPages }, (_, i) => (
                <div key={i} className="flex justify-center py-2 first:pt-4 last:pb-4">
                  <Page
                    pageNumber={i + 1}
                    width={pageWidth}
                    className="shadow-lg"
                    renderAnnotationLayer
                    renderTextLayer
                  />
                </div>
              ))}
          </Document>
        </div>
      </div>
    );
  }

  // EPUB fallback — download link for now
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12">
      <BookOpen className="h-16 w-16 text-ink-faint" />
      <h2 className="text-lg font-bold text-ink">{ebook.title}</h2>
      <p className="text-sm text-ink-muted">EPUB reader coming soon. Download to read in your favorite app.</p>
      <a
        href={`/api/ebooks/${ebook.id}/file`}
        download={ebook.title}
        className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
      >
        Download EPUB
      </a>
    </div>
  );
}

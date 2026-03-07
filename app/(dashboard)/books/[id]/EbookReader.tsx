'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Maximize2, Minimize2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import HighlightToolbar from '@/components/HighlightToolbar';
import HighlightPopover from '@/components/HighlightPopover';

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

type EbookHighlight = {
  id: string;
  ebook_id: string;
  highlighted_text: string;
  note: string | null;
  page_number: number | null;
  auto_tags?: string[];
  created_at: string;
};

export default function EbookReader({ ebook }: { ebook: Ebook }) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasMarkedReading, setHasMarkedReading] = useState(ebook.status !== 'unread');
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Highlight state
  const [highlights, setHighlights] = useState<EbookHighlight[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [selectedPageNumber, setSelectedPageNumber] = useState<number | null>(null);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [activeHighlight, setActiveHighlight] = useState<EbookHighlight | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState('');
  const [highlightCount, setHighlightCount] = useState(0);

  // Fetch existing highlights for this ebook
  useEffect(() => {
    const fetchHighlights = async () => {
      const res = await fetch(`/api/highlights?ebook_id=${ebook.id}`);
      if (res.ok) {
        const data = await res.json();
        setHighlights(data || []);
        setHighlightCount(data?.length || 0);
      }
    };
    fetchHighlights();
  }, [ebook.id]);

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

  // Apply highlights to rendered PDF text layer
  const applyHighlightsToPage = useCallback((pageNumber: number) => {
    const pageHighlights = highlights.filter((h) => h.page_number === pageNumber);
    if (pageHighlights.length === 0) return;

    const pageContainer = scrollRef.current?.querySelector(`[data-page-number="${pageNumber}"]`);
    if (!pageContainer) return;

    const textLayer = pageContainer.querySelector('.react-pdf__Page__textContent');
    if (!textLayer) return;

    // Walk through text spans and mark highlights
    const spans = textLayer.querySelectorAll('span');
    const fullText = Array.from(spans).map((s) => s.textContent || '').join('');

    pageHighlights.forEach((highlight) => {
      const idx = fullText.indexOf(highlight.highlighted_text);
      if (idx === -1) return;

      // Find which spans contain this text and apply highlight styling
      let charCount = 0;
      spans.forEach((span) => {
        const spanText = span.textContent || '';
        const spanStart = charCount;
        const spanEnd = charCount + spanText.length;
        charCount = spanEnd;

        const highlightStart = idx;
        const highlightEnd = idx + highlight.highlighted_text.length;

        // Check if this span overlaps with the highlight
        if (spanStart < highlightEnd && spanEnd > highlightStart) {
          span.style.backgroundColor = 'rgba(250, 204, 21, 0.3)';
          span.style.borderRadius = '2px';
          span.dataset.highlightId = highlight.id;
          span.style.cursor = 'pointer';
        }
      });
    });
  }, [highlights]);

  // Re-apply highlights whenever pages render
  useEffect(() => {
    if (!numPages || highlights.length === 0) return;

    // Small delay to let text layers render
    const timer = setTimeout(() => {
      for (let i = 1; i <= numPages; i++) {
        applyHighlightsToPage(i);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [numPages, highlights, applyHighlightsToPage, containerWidth]);

  // Handle text selection in the PDF
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 2) return;

    // Find which page the selection is in
    const anchorNode = selection.anchorNode;
    let pageEl = anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement;
    while (pageEl && !pageEl.dataset.pageNumber) {
      pageEl = pageEl.parentElement;
    }
    const pageNum = pageEl?.dataset.pageNumber ? parseInt(pageEl.dataset.pageNumber, 10) : null;

    // Check if clicking on an existing highlight
    const target = anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement;
    if (target && target instanceof HTMLElement && target.dataset.highlightId && text === selection.toString().trim()) {
      const existing = highlights.find((h) => h.id === target.dataset.highlightId);
      if (existing) {
        const rect = target.getBoundingClientRect();
        setActiveHighlight(existing);
        setDraftNote(existing.note || '');
        setEditingNote(false);
        setPopoverPos({ top: rect.bottom + 8, left: Math.min(rect.left, window.innerWidth - 340) });
        selection.removeAllRanges();
        return;
      }
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setSelectedText(text);
    setSelectedPageNumber(pageNum);
    setNoteMode(false);
    setNoteText('');
    setToolbarPos({
      top: rect.bottom + 8,
      left: Math.min(rect.left, window.innerWidth - 300),
    });
  }, [highlights]);

  // Listen for mouseup on the scroll container
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener('mouseup', handleMouseUp);
    return () => el.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  // Listen for clicks on existing highlights
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.dataset.highlightId) {
        const existing = highlights.find((h) => h.id === target.dataset.highlightId);
        if (existing) {
          const rect = target.getBoundingClientRect();
          setActiveHighlight(existing);
          setDraftNote(existing.note || '');
          setEditingNote(false);
          setPopoverPos({ top: rect.bottom + 8, left: Math.min(rect.left, window.innerWidth - 340) });
        }
      }
    };

    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [highlights]);

  // Close toolbar/popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (toolbarPos && !target.closest('.fixed.z-50')) {
        setToolbarPos(null);
        setSelectedText('');
      }
      if (popoverPos && !target.closest('.fixed.z-50')) {
        setPopoverPos(null);
        setActiveHighlight(null);
      }
    };

    // Delay to avoid closing immediately on the same click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [toolbarPos, popoverPos]);

  const createHighlight = async (withNote: boolean) => {
    if (!selectedText.trim()) return;

    const res = await fetch('/api/highlights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ebook_id: ebook.id,
        highlighted_text: selectedText,
        note: withNote ? noteText.trim() || null : null,
        page_number: selectedPageNumber,
      }),
    });

    if (res.ok) {
      const newHighlight = await res.json();
      setHighlights((prev) => [...prev, newHighlight]);
      setHighlightCount((prev) => prev + 1);
    }

    setToolbarPos(null);
    setSelectedText('');
    setNoteMode(false);
    setNoteText('');
    window.getSelection()?.removeAllRanges();
  };

  const updateHighlightNote = async () => {
    if (!activeHighlight) return;

    const res = await fetch(`/api/highlights/${activeHighlight.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: draftNote.trim() || null }),
    });

    if (res.ok) {
      const updated = await res.json();
      setHighlights((prev) => prev.map((h) => (h.id === updated.id ? { ...h, ...updated } : h)));
      setActiveHighlight(updated);
      setEditingNote(false);
    }
  };

  const deleteHighlight = async () => {
    if (!activeHighlight) return;

    const res = await fetch(`/api/highlights/${activeHighlight.id}`, { method: 'DELETE' });
    if (res.ok) {
      setHighlights((prev) => prev.filter((h) => h.id !== activeHighlight.id));
      setHighlightCount((prev) => prev - 1);
      setPopoverPos(null);
      setActiveHighlight(null);
    }
  };

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
            {highlightCount > 0 && (
              <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700">
                {highlightCount} {highlightCount === 1 ? 'highlight' : 'highlights'}
              </span>
            )}
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
                    onRenderTextLayerSuccess={() => applyHighlightsToPage(i + 1)}
                  />
                </div>
              ))}
          </Document>
        </div>

        {/* Highlight creation toolbar */}
        {toolbarPos && (
          <HighlightToolbar
            position={toolbarPos}
            noteMode={noteMode}
            noteText={noteText}
            onNoteTextChange={setNoteText}
            onHighlight={() => createHighlight(false)}
            onToggleNote={() => setNoteMode(!noteMode)}
            onSaveNote={() => createHighlight(true)}
            onClose={() => {
              setToolbarPos(null);
              setSelectedText('');
              setNoteMode(false);
              setNoteText('');
              window.getSelection()?.removeAllRanges();
            }}
          />
        )}

        {/* Existing highlight popover */}
        {popoverPos && activeHighlight && (
          <HighlightPopover
            position={popoverPos}
            highlightedText={activeHighlight.highlighted_text}
            note={activeHighlight.note}
            draftNote={draftNote}
            isEditing={editingNote}
            onStartEdit={() => {
              setDraftNote(activeHighlight.note || '');
              setEditingNote(true);
            }}
            onDraftChange={setDraftNote}
            onSave={updateHighlightNote}
            onDelete={deleteHighlight}
            onClose={() => {
              setPopoverPos(null);
              setActiveHighlight(null);
              setEditingNote(false);
            }}
          />
        )}
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

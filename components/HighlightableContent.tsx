'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import HighlightToolbar from './HighlightToolbar';
import HighlightPopover from './HighlightPopover';
import { triggerToast } from './Toast';

interface Highlight {
  id: string;
  highlighted_text: string;
  note: string | null;
  created_at: string;
}

interface Props {
  issueId: string;
  bodyHtml: string;
}

/**
 * Walk DOM text nodes and wrap the first occurrence of `searchText`
 * in a <mark> element with the given highlight ID.
 */
function markTextInDOM(container: HTMLElement, searchText: string, highlightId: string): boolean {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const text = node.textContent || '';
    const idx = text.indexOf(searchText);

    if (idx === -1) continue;

    // Don't re-mark if already inside a mark element
    if (node.parentElement?.closest('mark[data-highlight-id]')) continue;

    try {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + searchText.length);

      const mark = document.createElement('mark');
      mark.setAttribute('data-highlight-id', highlightId);
      mark.className = 'readflow-highlight';
      range.surroundContents(mark);
      return true;
    } catch {
      // surroundContents can fail if range spans multiple elements — skip
      continue;
    }
  }
  return false;
}

/**
 * Remove all highlight marks from the container, restoring original text nodes.
 */
function clearMarks(container: HTMLElement) {
  const marks = container.querySelectorAll('mark[data-highlight-id]');
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    // Replace the mark with its text content
    const textNode = document.createTextNode(mark.textContent || '');
    parent.replaceChild(textNode, mark);
    parent.normalize();
  });
}

export default function HighlightableContent({ issueId, bodyHtml }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [activeHighlight, setActiveHighlight] = useState<{ id: string; note: string | null; position: { top: number; left: number } } | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch highlights on mount
  useEffect(() => {
    fetchHighlights();
  }, [issueId]);

  // Re-apply marks whenever highlights change
  useEffect(() => {
    applyHighlights();
  }, [highlights]);

  const fetchHighlights = async () => {
    try {
      const res = await fetch(`/api/highlights?issue_id=${issueId}`);
      if (res.ok) {
        const data = await res.json();
        setHighlights(data);
      }
    } catch (err) {
      console.error('Failed to fetch highlights:', err);
    }
  };

  const applyHighlights = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;

    // Clear existing marks, then re-apply
    clearMarks(el);
    for (const h of highlights) {
      markTextInDOM(el, h.highlighted_text, h.id);
    }
  }, [highlights]);

  // Handle text selection
  const handleMouseUp = useCallback(() => {
    // Small delay to let the selection finalize
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        return;
      }

      const contentEl = contentRef.current;
      if (!contentEl) return;

      // Ensure selection is within our content
      if (!contentEl.contains(selection.anchorNode) || !contentEl.contains(selection.focusNode)) {
        return;
      }

      // Don't show toolbar if clicking on an existing highlight
      const anchorParent = selection.anchorNode?.parentElement;
      if (anchorParent?.closest('mark[data-highlight-id]')) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = contentEl.getBoundingClientRect();

      setSelectedText(selection.toString().trim());
      setToolbarPos({
        top: rect.top - containerRect.top - 52,
        left: rect.left - containerRect.left + rect.width / 2,
      });
      setActiveHighlight(null);
    }, 10);
  }, []);

  // Handle click on existing highlight marks
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const mark = target.closest('mark[data-highlight-id]');

    if (!mark) {
      // Clicked outside a mark — dismiss popover (but not toolbar, which is handled by mouseup)
      if (activeHighlight) setActiveHighlight(null);
      return;
    }

    const highlightId = mark.getAttribute('data-highlight-id');
    if (!highlightId) return;

    const highlight = highlights.find(h => h.id === highlightId);
    if (!highlight) return;

    const contentEl = contentRef.current;
    if (!contentEl) return;

    const markRect = mark.getBoundingClientRect();
    const containerRect = contentEl.getBoundingClientRect();

    setToolbarPos(null);
    setActiveHighlight({
      id: highlight.id,
      note: highlight.note,
      position: {
        top: markRect.top - containerRect.top - 12,
        left: markRect.left - containerRect.left + markRect.width / 2,
      },
    });

    // Clear text selection so it doesn't interfere
    window.getSelection()?.removeAllRanges();
  }, [highlights, activeHighlight]);

  const handleHighlight = async () => {
    if (!selectedText) return;
    setSaving(true);

    try {
      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: issueId, highlighted_text: selectedText }),
      });

      if (res.ok) {
        const newHighlight: Highlight = await res.json();
        setHighlights(prev => [...prev, newHighlight]);
        triggerToast('Highlight saved');
      } else {
        triggerToast('Failed to save highlight');
      }
    } catch {
      triggerToast('Failed to save highlight');
    }

    setSaving(false);
    setToolbarPos(null);
    setSelectedText('');
    window.getSelection()?.removeAllRanges();
  };

  const handleNote = async (note: string) => {
    if (!selectedText) return;
    setSaving(true);

    try {
      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: issueId, highlighted_text: selectedText, note }),
      });

      if (res.ok) {
        const newHighlight: Highlight = await res.json();
        setHighlights(prev => [...prev, newHighlight]);
        triggerToast('Highlight + note saved');
      } else {
        triggerToast('Failed to save');
      }
    } catch {
      triggerToast('Failed to save');
    }

    setSaving(false);
    setToolbarPos(null);
    setSelectedText('');
    window.getSelection()?.removeAllRanges();
  };

  const handleDeleteHighlight = async (id: string) => {
    try {
      const res = await fetch(`/api/highlights/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setHighlights(prev => prev.filter(h => h.id !== id));
        setActiveHighlight(null);
        triggerToast('Highlight removed');
      }
    } catch {
      triggerToast('Failed to delete');
    }
  };

  const handleUpdateNote = async (id: string, note: string) => {
    try {
      const res = await fetch(`/api/highlights/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      if (res.ok) {
        const updated: Highlight = await res.json();
        setHighlights(prev => prev.map(h => h.id === id ? updated : h));
        setActiveHighlight(null);
        triggerToast('Note updated');
      }
    } catch {
      triggerToast('Failed to update note');
    }
  };

  return (
    <div className="relative">
      <div
        ref={contentRef}
        className="reading-content newsletter-body"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleMouseUp}
        onClick={handleContentClick}
      />

      {/* Selection toolbar */}
      {toolbarPos && selectedText && (
        <HighlightToolbar
          position={toolbarPos}
          onHighlight={handleHighlight}
          onNote={handleNote}
          onDismiss={() => { setToolbarPos(null); setSelectedText(''); }}
          saving={saving}
        />
      )}

      {/* Existing highlight popover */}
      {activeHighlight && (
        <HighlightPopover
          position={activeHighlight.position}
          note={activeHighlight.note}
          onDelete={() => handleDeleteHighlight(activeHighlight.id)}
          onUpdateNote={(note) => handleUpdateNote(activeHighlight.id, note)}
          onDismiss={() => setActiveHighlight(null)}
        />
      )}
    </div>
  );
}

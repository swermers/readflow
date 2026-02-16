'use client';

import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import HighlightToolbar from './HighlightToolbar';
import HighlightPopover from './HighlightPopover';

type Highlight = {
  id: string;
  issue_id: string;
  highlighted_text: string;
  note: string | null;
  created_at: string;
};

const TOOLBAR_WIDTH = 280;
const POPOVER_WIDTH = 320;

function clampX(centerX: number, width: number) {
  const min = 8;
  const max = window.innerWidth - width - 8;
  return Math.max(min, Math.min(centerX - width / 2, max));
}

export default function HighlightableContent({ issueId, bodyHtml }: { issueId: string; bodyHtml: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRangeRef = useRef<Range | null>(null);

  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number } | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [noteText, setNoteText] = useState('');

  const [activeHighlight, setActiveHighlight] = useState<Highlight | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draftNote, setDraftNote] = useState('');

  const highlightedById = useMemo(() => new Map(highlights.map((h) => [h.id, h])), [highlights]);

  const closeToolbar = () => {
    setToolbarPosition(null);
    setSelectedText('');
    setNoteMode(false);
    setNoteText('');
    selectedRangeRef.current = null;
    window.getSelection()?.removeAllRanges();
  };

  const closePopover = () => {
    setPopoverPosition(null);
    setActiveHighlight(null);
    setEditMode(false);
    setDraftNote('');
  };

  const fetchHighlights = async () => {
    const res = await fetch(`/api/highlights?issue_id=${issueId}`);
    if (!res.ok) return;

    const data = await res.json();
    setHighlights(data || []);
  };

  const clearExistingMarks = () => {
    const container = containerRef.current;
    if (!container) return;

    const marks = Array.from(container.querySelectorAll('mark[data-highlight-id]'));
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
    });
  };

  const applyHighlightToDom = (id: string, highlightedText: string) => {
    const container = containerRef.current;
    if (!container || !highlightedText.trim()) return;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text;
      const parentElement = textNode.parentElement;
      if (!parentElement || parentElement.closest('mark[data-highlight-id]')) continue;

      const textContent = textNode.textContent || '';
      const start = textContent.indexOf(highlightedText);
      if (start === -1) continue;

      const range = document.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, start + highlightedText.length);

      const mark = document.createElement('mark');
      mark.className = 'readflow-highlight';
      mark.dataset.highlightId = id;

      try {
        range.surroundContents(mark);
      } catch {
        range.detach?.();
      }
      break;
    }
  };

  const tryApplyCurrentRangeHighlight = (highlightId: string) => {
    const range = selectedRangeRef.current;
    if (!range) return;
    const container = containerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) return;

    try {
      const mark = document.createElement('mark');
      mark.className = 'readflow-highlight';
      mark.dataset.highlightId = highlightId;
      const fragment = range.extractContents();
      mark.appendChild(fragment);
      range.insertNode(mark);
    } catch {
      // fall back to text-based application in highlights effect
    }
  };

  const captureSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const text = selection.toString().replace(/\s+/g, ' ').trim();
    if (!text) return;

    const range = selection.getRangeAt(0);
    const container = containerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) return;

    selectedRangeRef.current = range.cloneRange();

    const rect = range.getBoundingClientRect();
    const top = Math.max(8, rect.top + window.scrollY - 64);
    const left = clampX(rect.left + rect.width / 2, TOOLBAR_WIDTH);

    setSelectedText(text);
    setToolbarPosition({ top, left });
    setNoteMode(false);
    setNoteText('');
    closePopover();
  };

  useEffect(() => {
    fetchHighlights();
  }, [issueId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = bodyHtml || '';
  }, [bodyHtml]);

  useEffect(() => {
    clearExistingMarks();
    highlights
      .slice()
      .reverse()
      .forEach((highlight) => applyHighlightToDom(highlight.id, highlight.highlighted_text));
  }, [highlights]);


  useEffect(() => {
    let frame: number | null = null;

    const handleSelectionChange = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const selection = window.getSelection();
        const hasText = !!selection && selection.toString().replace(/\s+/g, ' ').trim().length > 0;

        if (hasText) {
          captureSelection();
        }
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.readflow-highlight')) return;
      if (target.closest('[data-highlight-ui="true"]')) return;

      const selection = window.getSelection();
      if (selection && selection.toString().trim()) return;

      closeToolbar();
      closePopover();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeToolbar();
        closePopover();
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const onSelectionEvent = () => {
    window.setTimeout(() => {
      captureSelection();
    }, 0);
  };

  const createHighlight = async (note?: string) => {
    if (!selectedText.trim()) return;

    const res = await fetch('/api/highlights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issue_id: issueId,
        highlighted_text: selectedText,
        note: note?.trim() || undefined,
      }),
    });

    if (!res.ok) return;

    const created = await res.json();
    tryApplyCurrentRangeHighlight(created.id);
    setHighlights((prev) => [created, ...prev]);
    closeToolbar();
  };

  const handleMarkClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const mark = target.closest('mark[data-highlight-id]') as HTMLElement | null;
    if (!mark) return;

    const id = mark.dataset.highlightId;
    if (!id) return;

    const highlight = highlightedById.get(id);
    if (!highlight) return;

    const rect = mark.getBoundingClientRect();
    const top = rect.bottom + window.scrollY + 8;
    const left = clampX(rect.left + rect.width / 2, POPOVER_WIDTH);

    setActiveHighlight(highlight);
    setPopoverPosition({ top, left });
    setEditMode(false);
    setDraftNote(highlight.note || '');
    closeToolbar();
  };

  const saveNote = async () => {
    if (!activeHighlight) return;

    const res = await fetch(`/api/highlights/${activeHighlight.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: draftNote }),
    });

    if (!res.ok) return;
    const updated = await res.json();

    setHighlights((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
    setActiveHighlight(updated);
    setEditMode(false);
  };

  const deleteHighlight = async () => {
    if (!activeHighlight) return;

    const res = await fetch(`/api/highlights/${activeHighlight.id}`, {
      method: 'DELETE',
    });

    if (!res.ok) return;

    setHighlights((prev) => prev.filter((h) => h.id !== activeHighlight.id));
    closePopover();
  };

  return (
    <>
      <div
        ref={containerRef}
        className="reading-content newsletter-body"
        onMouseUp={onSelectionEvent}
        onTouchEnd={onSelectionEvent}
        onPointerUp={onSelectionEvent}
        onKeyUp={onSelectionEvent}
        onClick={handleMarkClick}
      />

      {toolbarPosition && (
        <div data-highlight-ui="true">
          <HighlightToolbar
            position={toolbarPosition}
            noteMode={noteMode}
            noteText={noteText}
            onNoteTextChange={setNoteText}
            onHighlight={() => createHighlight()}
            onToggleNote={() => setNoteMode((v) => !v)}
            onSaveNote={() => createHighlight(noteText)}
            onClose={closeToolbar}
          />
        </div>
      )}

      {activeHighlight && popoverPosition && (
        <div data-highlight-ui="true">
          <HighlightPopover
            position={popoverPosition}
            highlightedText={activeHighlight.highlighted_text}
            note={activeHighlight.note}
            draftNote={draftNote}
            isEditing={editMode}
            onStartEdit={() => setEditMode(true)}
            onDraftChange={setDraftNote}
            onSave={saveNote}
            onDelete={deleteHighlight}
            onClose={closePopover}
          />
        </div>
      )}
    </>
  );
}

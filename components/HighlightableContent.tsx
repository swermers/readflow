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
  selection_start?: number | null;
  selection_end?: number | null;
};

const TOOLBAR_WIDTH = 280;
const POPOVER_WIDTH = 320;

type TextNodeEntry = {
  node: Text;
  start: number;
  end: number;
};

function clampX(centerX: number, width: number) {
  const min = 8;
  const max = Math.max(min, window.innerWidth - width - 8);
  return Math.max(min, Math.min(centerX - width / 2, max));
}

function getTextNodesInRange(range: Range, root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.textContent?.trim()) continue;

    const nodeRange = document.createRange();
    nodeRange.selectNodeContents(node);

    const intersects =
      range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
      range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0;

    if (intersects) nodes.push(node);
  }

  return nodes;
}


export default function HighlightableContent({ issueId, bodyHtml }: { issueId: string; bodyHtml: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRangeRef = useRef<Range | null>(null);
  const selectedOffsetsRef = useRef<{ start: number; end: number } | null>(null);

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
    selectedOffsetsRef.current = null;
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

  const removeMarksById = (highlightId: string) => {
    const container = containerRef.current;
    if (!container) return;

    const marks = Array.from(container.querySelectorAll(`mark[data-highlight-id="${highlightId}"]`));
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
    });
  };

  const getTextNodeEntries = () => {
    const container = containerRef.current;
    if (!container) return { fullText: '', entries: [] as TextNodeEntry[] };

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const entries: TextNodeEntry[] = [];
    let fullText = '';

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (!node.textContent) continue;
      const start = fullText.length;
      fullText += node.textContent;
      entries.push({ node, start, end: fullText.length });
    }

    return { fullText, entries };
  };

  const getGlobalOffsetsFromRange = (range: Range) => {
    const container = containerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) return null;

    const fullRange = document.createRange();
    fullRange.selectNodeContents(container);

    const startRange = fullRange.cloneRange();
    startRange.setEnd(range.startContainer, range.startOffset);

    const endRange = fullRange.cloneRange();
    endRange.setEnd(range.endContainer, range.endOffset);

    const start = startRange.toString().length;
    const end = endRange.toString().length;

    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
    return { start, end };
  };

  const createRangeFromGlobalOffsets = (entries: TextNodeEntry[], start: number, end: number) => {
    const startEntry = entries.find((entry) => start >= entry.start && start <= entry.end);
    const endEntry = entries.find((entry) => end >= entry.start && end <= entry.end);
    if (!startEntry || !endEntry) return null;

    const range = document.createRange();
    range.setStart(startEntry.node, Math.max(0, start - startEntry.start));
    range.setEnd(endEntry.node, Math.max(0, end - endEntry.start));
    return range;
  };


  const normalizeWhitespaceWithMap = (value: string) => {
    const normalizedChars: string[] = [];
    const map: number[] = [];
    let inWhitespace = false;

    for (let i = 0; i < value.length; i++) {
      const raw = value[i];
      const char = raw === '\u00a0' ? ' ' : raw.normalize('NFKC');

      if (/\s/.test(char)) {
        if (!inWhitespace) {
          normalizedChars.push(' ');
          map.push(i);
          inWhitespace = true;
        }
      } else {
        normalizedChars.push(char);
        map.push(i);
        inWhitespace = false;
      }
    }

    return {
      text: normalizedChars.join(''),
      map,
    };
  };

  const findHighlightRanges = (fullText: string, targetText: string) => {
    const exactRanges: Array<{ start: number; end: number }> = [];

    let exactIndex = fullText.indexOf(targetText);
    while (exactIndex !== -1) {
      exactRanges.push({ start: exactIndex, end: exactIndex + targetText.length });
      exactIndex = fullText.indexOf(targetText, exactIndex + targetText.length);
    }

    if (exactRanges.length > 0) {
      return exactRanges;
    }

    const normalizedFull = normalizeWhitespaceWithMap(fullText);
    const baseTarget = targetText.replace(/\u00a0/g, ' ').normalize('NFKC');
    const normalizedTarget = baseTarget.replace(/\s+/g, ' ').trim();

    if (!normalizedFull.text || !normalizedTarget) {
      return [];
    }

    const findMappedRanges = (haystack: string, needle: string) => {
      const ranges: Array<{ start: number; end: number }> = [];
      let normalizedIndex = haystack.indexOf(needle);

      while (normalizedIndex !== -1) {
        const mappedStart = normalizedFull.map[normalizedIndex];
        const mappedEndIndex = normalizedIndex + needle.length - 1;
        const mappedEnd = (normalizedFull.map[mappedEndIndex] ?? mappedStart) + 1;

        if (mappedStart !== undefined && mappedEnd > mappedStart) {
          ranges.push({ start: mappedStart, end: mappedEnd });
        }

        normalizedIndex = haystack.indexOf(needle, normalizedIndex + needle.length);
      }

      return ranges;
    };

    const directRanges = findMappedRanges(normalizedFull.text, normalizedTarget);
    if (directRanges.length > 0) return directRanges;

    return findMappedRanges(normalizedFull.text.toLowerCase(), normalizedTarget.toLowerCase());
  };

  const applyHighlightToDom = (highlight: Highlight, usedRanges: Array<{ start: number; end: number }>) => {
    const { id, highlighted_text: highlightedText, note, selection_start: selectionStart, selection_end: selectionEnd } = highlight;
    const container = containerRef.current;
    if (!container || !highlightedText.trim()) return;

    const { fullText, entries } = getTextNodeEntries();
    if (!fullText || entries.length === 0) return;

    const tryRange = (start: number, end: number) => {
      const overlapsExisting = usedRanges.some((range) => start < range.end && end > range.start);
      if (overlapsExisting) return false;

      const range = createRangeFromGlobalOffsets(entries, start, end);
      if (!range) return false;

      const mark = document.createElement('mark');
      mark.className = 'readflow-highlight';
      mark.dataset.highlightId = id;
      const hasNote = !!note?.trim();
      mark.dataset.hasNote = hasNote ? 'true' : 'false';
      if (hasNote) {
        mark.setAttribute('title', note!.trim());
        mark.setAttribute('aria-label', `Highlight note: ${note!.trim()}`);
      } else {
        mark.removeAttribute('title');
        mark.removeAttribute('aria-label');
      }

      try {
        range.surroundContents(mark);
        usedRanges.push({ start, end });
        return true;
      } catch {
        return false;
      }
    };

    if (
      typeof selectionStart === 'number' &&
      typeof selectionEnd === 'number' &&
      selectionEnd > selectionStart &&
      selectionStart >= 0
    ) {
      if (tryRange(selectionStart, selectionEnd)) {
        return;
      }
    }

    const targetText = highlightedText.trim();
    if (!targetText) return;

    const matches = findHighlightRanges(fullText, targetText);

    for (const match of matches) {
      if (tryRange(match.start, match.end)) {
        return;
      }
    }
  };


  const updateMarkMetadata = (highlightId: string, note: string | null) => {
    const container = containerRef.current;
    if (!container) return;

    const marks = Array.from(container.querySelectorAll(`mark[data-highlight-id="${highlightId}"]`)) as HTMLElement[];
    const noteValue = note?.trim() || '';
    const hasNote = noteValue.length > 0;

    marks.forEach((mark) => {
      mark.dataset.hasNote = hasNote ? 'true' : 'false';
      if (hasNote) {
        mark.setAttribute('title', noteValue);
        mark.setAttribute('aria-label', `Highlight note: ${noteValue}`);
      } else {
        mark.removeAttribute('title');
        mark.removeAttribute('aria-label');
      }
    });
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
      mark.dataset.hasNote = 'false';
      const fragment = range.extractContents();
      mark.appendChild(fragment);
      range.insertNode(mark);
    } catch {
      // Fallback: wrap each intersecting text-node segment so multi-node selections still render reliably.
      const textNodes = getTextNodesInRange(range, container);

      textNodes.forEach((node) => {
        const nodeStart = node === range.startContainer ? range.startOffset : 0;
        const nodeEnd = node === range.endContainer ? range.endOffset : node.textContent?.length ?? 0;

        if (nodeEnd <= nodeStart) return;

        try {
          const nodeRange = document.createRange();
          nodeRange.setStart(node, nodeStart);
          nodeRange.setEnd(node, nodeEnd);

          const mark = document.createElement('mark');
          mark.className = 'readflow-highlight';
          mark.dataset.highlightId = highlightId;
          mark.dataset.hasNote = 'false';
          nodeRange.surroundContents(mark);
        } catch {
          // no-op; text based apply in highlights effect remains a final fallback
        }
      });
    }
  };

  const captureSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const rawText = selection.toString();
    if (!rawText.trim()) return;

    const range = selection.getRangeAt(0);
    const container = containerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) return;

    selectedRangeRef.current = range.cloneRange();
    selectedOffsetsRef.current = getGlobalOffsetsFromRange(range);

    const rects = range.getClientRects();
    const rect = rects.length > 0 ? rects[0] : range.getBoundingClientRect();
    const anchorRect = (range.startContainer as Element)?.parentElement?.getBoundingClientRect?.();
    const baseRect = (rect && (rect.width > 0 || rect.height > 0)) ? rect : anchorRect || rect;

    const top = Math.max(8, (baseRect?.top || 16) - 64);
    const left = clampX((baseRect?.left || 40) + ((baseRect?.width || 40) / 2), TOOLBAR_WIDTH);

    setSelectedText(rawText.trim());
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
    const container = containerRef.current;
    if (!container) return;

    const markCount = container.querySelectorAll('mark[data-highlight-id]').length;

    if (markCount === 0 && highlights.length > 0) {
      const usedRanges: Array<{ start: number; end: number }> = [];
      highlights
        .slice()
        .reverse()
        .forEach((highlight) => applyHighlightToDom(highlight, usedRanges));
    }

    highlights.forEach((highlight) => {
      updateMarkMetadata(highlight.id, highlight.note);
    });
  }, [highlights]);



  useEffect(() => {
    if (highlights.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const targetHighlightId = params.get('h');
    if (!targetHighlightId) return;

    const mark = document.querySelector(`mark[data-highlight-id="${targetHighlightId}"]`) as HTMLElement | null;
    if (!mark) return;

    mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    mark.classList.add('ring-2', 'ring-accent/60');
    const timeout = window.setTimeout(() => {
      mark.classList.remove('ring-2', 'ring-accent/60');
    }, 1800);

    return () => window.clearTimeout(timeout);
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
    const handleDocumentClick = (event: Event) => {
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
    document.addEventListener('touchstart', handleDocumentClick, { passive: true });
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('touchstart', handleDocumentClick);
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

    const selectionOffsets = selectedOffsetsRef.current;

    const res = await fetch('/api/highlights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issue_id: issueId,
        highlighted_text: selectedText,
        note: note?.trim() || undefined,
        selection_start: selectionOffsets?.start,
        selection_end: selectionOffsets?.end,
      }),
    });

    if (!res.ok) return;

    const created = await res.json();
    tryApplyCurrentRangeHighlight(created.id);
    updateMarkMetadata(created.id, created.note ?? null);
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
    const top = rect.bottom + 8;
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
    updateMarkMetadata(updated.id, updated.note ?? null);
    setActiveHighlight(updated);
    setEditMode(false);
  };

  const deleteHighlight = async () => {
    if (!activeHighlight) return;

    const res = await fetch(`/api/highlights/${activeHighlight.id}`, {
      method: 'DELETE',
    });

    if (!res.ok) return;

    removeMarksById(activeHighlight.id);
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

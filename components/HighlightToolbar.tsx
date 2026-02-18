'use client';

import { Highlighter, NotebookPen, X } from 'lucide-react';

interface HighlightToolbarProps {
  position: { top: number; left: number };
  noteMode: boolean;
  noteText: string;
  onNoteTextChange: (value: string) => void;
  onHighlight: () => void;
  onToggleNote: () => void;
  onSaveNote: () => void;
  onClose: () => void;
}

export default function HighlightToolbar({
  position,
  noteMode,
  noteText,
  onNoteTextChange,
  onHighlight,
  onToggleNote,
  onSaveNote,
  onClose,
}: HighlightToolbarProps) {
  return (
    <div
      className="fixed z-50 w-[min(280px,calc(100vw-16px))] rounded-xl border border-line-strong bg-ink text-surface shadow-2xl animate-fade-in"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-center gap-2 p-2">
        <button
          onClick={onHighlight}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-accent-hover"
        >
          <Highlighter className="h-3.5 w-3.5" />
          Highlight
        </button>
        <button
          onClick={onToggleNote}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-white/10"
        >
          <NotebookPen className="h-3.5 w-3.5" />
          Note
        </button>
        <button
          onClick={onClose}
          className="ml-auto rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Close toolbar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {noteMode && (
        <div className="border-t border-white/10 p-2">
          <textarea
            value={noteText}
            onChange={(e) => onNoteTextChange(e.target.value)}
            placeholder="Add your note..."
            className="min-h-[84px] w-full resize-none rounded-lg border border-white/20 bg-black/20 px-2.5 py-2 text-sm text-white placeholder:text-white/40 focus:border-accent focus:outline-none"
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={onSaveNote}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-accent-hover"
            >
              Save Note
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

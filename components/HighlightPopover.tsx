'use client';

import { Trash2, NotebookPen, X } from 'lucide-react';

interface HighlightPopoverProps {
  position: { top: number; left: number };
  highlightedText: string;
  note?: string | null;
  draftNote: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function HighlightPopover({
  position,
  highlightedText,
  note,
  draftNote,
  isEditing,
  onStartEdit,
  onDraftChange,
  onSave,
  onDelete,
  onClose,
}: HighlightPopoverProps) {
  return (
    <div
      className="fixed z-50 w-[min(320px,calc(100vw-16px))] rounded-xl border border-line bg-surface-raised p-3 shadow-xl animate-fade-in"
      style={{ top: position.top, left: position.left }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.12em] text-ink-faint">Highlight</p>
        <button onClick={onClose} className="rounded-md p-1 text-ink-faint hover:bg-surface-overlay hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <blockquote className="border-l-2 border-accent pl-2 text-sm text-ink-muted">{highlightedText}</blockquote>

      {isEditing ? (
        <div className="mt-3">
          <textarea
            value={draftNote}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Add a note"
            className="min-h-[80px] w-full resize-none rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={onSave}
              className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-surface hover:bg-accent"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink-muted">
          {note?.trim() ? note : 'No note yet.'}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={onStartEdit}
          className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-ink-muted hover:text-accent"
        >
          <NotebookPen className="h-3.5 w-3.5" />
          {note?.trim() ? 'Edit Note' : 'Add Note'}
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-red-500 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}

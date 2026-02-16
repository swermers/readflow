'use client';

import { useState, useRef, useEffect } from 'react';
import { Trash2, StickyNote, X, Loader2 } from 'lucide-react';

interface Props {
  position: { top: number; left: number };
  note: string | null;
  onDelete: () => void;
  onUpdateNote: (note: string) => void;
  onDismiss: () => void;
}

export default function HighlightPopover({ position, note, onDelete, onUpdateNote, onDismiss }: Props) {
  const [editing, setEditing] = useState(false);
  const [noteText, setNoteText] = useState(note || '');
  const [deleting, setDeleting] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onDismiss]);

  const handleDelete = async () => {
    setDeleting(true);
    onDelete();
  };

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
      }}
    >
      <div className="bg-ink text-surface shadow-lg border border-line-strong min-w-[220px] max-w-[320px]">
        {!editing ? (
          <div className="p-3 space-y-2">
            {note && (
              <p className="text-sm text-surface/90 leading-relaxed">{note}</p>
            )}
            <div className="flex items-center gap-1 pt-1">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-surface/60 hover:text-surface px-2 py-1.5 transition-colors"
              >
                <StickyNote className="w-3 h-3" />
                {note ? 'Edit Note' : 'Add Note'}
              </button>
              <div className="w-px h-4 bg-surface/20" />
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 px-2 py-1.5 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            <textarea
              ref={inputRef}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  onUpdateNote(noteText.trim());
                }
              }}
              placeholder="Add a note..."
              rows={3}
              className="w-full bg-surface/10 text-surface text-sm p-2 border border-surface/20 focus:outline-none focus:border-accent resize-none placeholder:text-surface/40"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => { setEditing(false); setNoteText(note || ''); }}
                className="text-xs text-surface/60 hover:text-surface transition-colors px-2 py-1"
              >
                Cancel
              </button>
              <button
                onClick={() => onUpdateNote(noteText.trim())}
                className="text-xs font-bold uppercase tracking-wider bg-accent text-white px-3 py-1.5 hover:bg-accent/80 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

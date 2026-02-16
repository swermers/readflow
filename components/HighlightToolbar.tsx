'use client';

import { useState, useRef, useEffect } from 'react';
import { Highlighter, StickyNote, X, Loader2 } from 'lucide-react';

interface Props {
  position: { top: number; left: number };
  onHighlight: () => void;
  onNote: (note: string) => void;
  onDismiss: () => void;
  saving?: boolean;
}

export default function HighlightToolbar({ position, onHighlight, onNote, onDismiss, saving }: Props) {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showNoteInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showNoteInput]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    // Delay to avoid closing immediately from the mouseup that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onDismiss]);

  const handleSubmitNote = () => {
    onNote(noteText.trim());
    setNoteText('');
    setShowNoteInput(false);
  };

  return (
    <div
      ref={toolbarRef}
      className="absolute z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
      }}
    >
      <div className="bg-ink text-surface shadow-lg border border-line-strong flex flex-col items-stretch">
        {!showNoteInput ? (
          <div className="flex items-center">
            <button
              onClick={onHighlight}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-accent transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Highlighter className="w-3.5 h-3.5" />}
              Highlight
            </button>
            <div className="w-px h-5 bg-surface/20" />
            <button
              onClick={() => setShowNoteInput(true)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-accent transition-colors disabled:opacity-50"
            >
              <StickyNote className="w-3.5 h-3.5" />
              Note
            </button>
          </div>
        ) : (
          <div className="p-3 space-y-2 min-w-[260px]">
            <textarea
              ref={inputRef}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSubmitNote();
                }
              }}
              placeholder="Add a note..."
              rows={3}
              className="w-full bg-surface/10 text-surface text-sm p-2 border border-surface/20 focus:outline-none focus:border-accent resize-none placeholder:text-surface/40"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-surface/40">Cmd+Enter to save</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowNoteInput(false); setNoteText(''); }}
                  className="text-xs text-surface/60 hover:text-surface transition-colors px-2 py-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitNote}
                  disabled={saving}
                  className="text-xs font-bold uppercase tracking-wider bg-accent text-white px-3 py-1.5 hover:bg-accent/80 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

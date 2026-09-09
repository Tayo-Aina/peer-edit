import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useEditorUpdate } from '../../hooks/useEditorUpdate';
import type { Editor } from '@tiptap/react';

interface ToolbarDropdownProps {
  /** Content of the trigger button (icons/label). */
  trigger: React.ReactNode;
  /** Visual state of the trigger (adds the .active class). */
  active?: boolean;
  /** Accessible name for the trigger button. */
  label?: string;
  /** Which edge of the trigger the panel aligns to. */
  align?: 'left' | 'right';
  /** Extra class for the panel (width tweaks etc.). */
  panelClassName?: string;
  /** Editor instance — used for live re-render + focus return on close. */
  editor?: Editor | null;
  /** Panel content; receives a close() callback. */
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
}

/**
 * Reusable toolbar popover primitive. Instances coordinate through a
 * `peeredit:dropdown-open` window event (no synchronous cross-setter calls,
 * so no flicker), close on outside mousedown/touchstart + Escape, keep
 * ProseMirror selection alive via preventDefault, and return focus to the
 * editor on close.
 */
export function ToolbarDropdown({
  trigger,
  active,
  label,
  align = 'left',
  panelClassName = '',
  editor = null,
  children,
}: ToolbarDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();

  // Live re-render so trigger labels (block type, font, size, color) follow caret.
  useEditorUpdate(editor);

  const close = useCallback(() => setOpen(false), []);

  // Coordinate: when another dropdown opens, close this one.
  useEffect(() => {
    if (!open) return;
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== id) close();
    };
    window.addEventListener('peeredit:dropdown-open', onOther);
    return () => window.removeEventListener('peeredit:dropdown-open', onOther);
  }, [open, id, close]);

  // Outside close + Escape, with editor focus return.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
        editor?.commands.focus();
      }
    }
    function onKey(e: KeyboardEvent) {
      // Let inputs (link URL) handle their own Escape first.
      if (e.key === 'Escape') {
        const t = e.target as HTMLElement | null;
        if (t && t.closest('input,textarea')) return;
        close();
        editor?.commands.focus();
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close, editor]);

  return (
    <div className={`toolbar-dropdown${open ? ' open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`toolbar-btn toolbar-dropdown-trigger${active ? ' active' : ''}`}
        onMouseDown={e => e.preventDefault()}
        onClick={() => {
          if (!open) {
            window.dispatchEvent(new CustomEvent('peeredit:dropdown-open', { detail: id }));
          }
          setOpen(o => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={`toolbar-dropdown-panel ${align === 'right' ? 'align-right' : ''} ${panelClassName}`.trim()}
          role="menu"
          onMouseDown={e => {
            if ((e.target as HTMLElement).closest('input,textarea,[contenteditable="true"]')) return;
            e.preventDefault();
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              close();
              editor?.commands.focus();
            }
          }}
        >
          {typeof children === 'function' ? (children as (c: () => void) => React.ReactNode)(close) : children}
        </div>
      )}
    </div>
  );
}

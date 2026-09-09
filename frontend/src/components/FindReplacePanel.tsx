import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { ArrowDown, ArrowUp, CaseSensitive, X } from 'lucide-react';
import { findReplaceKey } from '../extensions/findReplace/FindReplace';

interface FindReplacePanelProps {
  editor: Editor;
}

/**
 * Floating find & replace panel pinned to the top-right of the editor.
 * Pure UI: state lives in the FindReplace extension's ProseMirror plugin;
 * this component only feeds the inputs in and reads the live match count out.
 */
export function FindReplacePanel({ editor }: FindReplacePanelProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [count, setCount] = useState({ current: 0, total: 0 });
  const findInputRef = useRef<HTMLInputElement>(null);

  // Mod-f / openFindReplace dispatch this window event; the panel toggles itself.
  useEffect(() => {
    const onToggle = () => setOpen(current => !current);
    window.addEventListener('peeredit:toggle-find', onToggle);
    return () => window.removeEventListener('peeredit:toggle-find', onToggle);
  }, []);

  // Esc closes the panel from anywhere while it is open, then returns
  // focus to the editor so typing can continue immediately.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        editor.commands.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editor, open]);

  // Focus the find input whenever the panel opens.
  useEffect(() => {
    if (open) findInputRef.current?.focus();
  }, [open]);

  // Push the finder inputs into the extension. Clearing the query on close
  // removes every decoration so no highlights outlive the panel.
  useEffect(() => {
    if (!open) {
      editor.commands.setFindQuery({ query: '' });
      return;
    }
    editor.commands.setFindQuery({ query, matchCase });
  }, [editor, open, query, matchCase]);

  // Live "3/12" counter, read straight from the plugin state on every transaction.
  useEffect(() => {
    const updateCount = () => {
      const findState = findReplaceKey.getState(editor.state);
      setCount({
        total: findState?.matches.length ?? 0,
        current: findState && findState.activeIndex >= 0 ? findState.activeIndex + 1 : 0,
      });
    };
    updateCount();
    editor.on('transaction', updateCount);
    return () => {
      editor.off('transaction', updateCount);
    };
  }, [editor]);

  if (!open) return null;

  return (
    <div className="find-panel">
      <div className="find-row">
        <input
          ref={findInputRef}
          className="find-input"
          type="text"
          placeholder="Find"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        <span className="find-count">{query ? `${count.current}/${count.total}` : ''}</span>
        <button
          type="button"
          className={`find-btn${matchCase ? ' active' : ''}`}
          title="Match case"
          onClick={() => setMatchCase(value => !value)}
        >
          <CaseSensitive size={14} />
        </button>
        <button
          type="button"
          className="find-btn"
          title="Previous match"
          onClick={() => editor.commands.prevMatch()}
        >
          <ArrowUp size={14} />
        </button>
        <button
          type="button"
          className="find-btn"
          title="Next match"
          onClick={() => editor.commands.nextMatch()}
        >
          <ArrowDown size={14} />
        </button>
        <button
          type="button"
          className="find-btn"
          title="Close (Esc)"
          aria-label="Close find and replace"
          onClick={() => {
            setOpen(false);
            editor.commands.focus();
          }}
        >
          <X size={14} />
        </button>
      </div>
      <div className="find-row">
        <input
          className="find-input"
          type="text"
          placeholder="Replace with"
          value={replacement}
          onChange={event => setReplacement(event.target.value)}
        />
        <button
          type="button"
          className="find-btn-primary"
          disabled={!count.total}
          onClick={() => editor.commands.replaceCurrentMatch(replacement)}
        >
          Replace
        </button>
        <button
          type="button"
          className="find-btn-primary"
          disabled={!count.total}
          onClick={() => editor.commands.replaceAll(replacement)}
        >
          Replace all
        </button>
      </div>
    </div>
  );
}

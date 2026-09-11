import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { DecorationSet } from '@tiptap/pm/view';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useCollaboration } from '../providers/CollaborationProvider';
import { useFullscreen } from '../hooks/useFullscreen';
import { PaginationKey } from '../extensions/Pagination';

interface StatusBarProps {
  editor: Editor;
}

/**
 * Bottom strip of the editor: live connection state, word/character count,
 * and a fullscreen toggle. Counts re-render on every editor 'update' —
 * remote Yjs changes fire this too, so counts stay live in collaboration.
 */
export function StatusBar({ editor }: StatusBarProps) {
  const { provider } = useCollaboration();
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  const [counts, setCounts] = useState({ words: 0, chars: 0 });
  const [pages, setPages] = useState({ page: 1, total: 1 });
  const [connected, setConnected] = useState(() => provider.wsconnected);

  useEffect(() => {
    const update = () => {
      setCounts({
        words: editor.storage.characterCount.words(),
        chars: editor.storage.characterCount.characters(),
      });
    };
    update();
    editor.on('update', update);
    return () => {
      editor.off('update', update);
    };
  }, [editor]);

  useEffect(() => {
    const onStatus = ({ status }: { status: string }) => {
      setConnected(status === 'connected');
    };
    provider.on('status', onStatus);
    return () => {
      provider.off('status', onStatus);
    };
  }, [provider]);

  // Live "Page X of Y": the pagination plugin stores its page-gap decorations
  // in plugin state, so every transaction (typing, cursor moves, remote edits)
  // can recompute which page the caret is on. Listens on 'transaction' rather
  // than 'update' because the caret crossing a break changes the page without
  // changing the document.
  //
  // When the caret is scrolled out of sight, the counter follows the viewport
  // instead (Word behaves the same way): it shows the page the user is
  // actually looking at, counted from the rendered page-gap widgets sitting
  // above the top edge of .editor-content's visible box. Without this,
  // scrolling a long doc leaves the counter frozen on the caret's page — the
  // "page tracking isn't accurate" bug.
  useEffect(() => {
    const update = () => {
      const decos = PaginationKey.getState(editor.state) as DecorationSet | undefined;
      let total = 1;
      let page = 1;
      if (decos) {
        const breaks = decos.find().map(d => d.from).sort((a, b) => a - b);
        total = breaks.length + 1;
        const head = editor.state.selection.head;
        page = breaks.filter(pos => pos < head).length + 1;

        const view = editor.view;
        const scroller = view.dom.closest('.editor-content') as HTMLElement | null;
        if (scroller) {
          try {
            const box = scroller.getBoundingClientRect();
            const caret = view.coordsAtPos(head);
            const caretVisible = caret.top < box.bottom && caret.bottom > box.top;
            if (!caretVisible) {
              // Measure the gap widgets' DOM directly rather than resolving
              // each break position through coordsAtPos: getBoundingClientRect
              // works for any rendered element, while coordsAtPos can come up
              // empty for positions ProseMirror hasn't laid out — and one
              // failure would silently drop the whole viewport-follow.
              let above = 0;
              for (const gap of view.dom.querySelectorAll<HTMLElement>('.pm-page-gap')) {
                if (gap.getBoundingClientRect().top < box.top) above += 1;
                else break;
              }
              page = above + 1;
            }
          } catch {
            // coordsAtPos can throw for positions with no rendered coords;
            // keep the caret-derived page as the fallback.
          }
        }
      }
      setPages(prev => (prev.page === page && prev.total === total ? prev : { page, total }));
    };
    update();
    editor.on('transaction', update);
    // Scroll events don't bubble, but the capture phase still sees them, so a
    // document-level capture listener catches .editor-content scrolling
    // without needing a direct reference to it. Plain-timer throttle, NOT
    // requestAnimationFrame: rAF never fires in hidden/occluded windows, and
    // PeerEdit windows sit in the background a lot — the same reason the
    // pagination plugin itself debounces with timers. Chromium can delay even
    // timers in occluded windows, so a visibilitychange refresh catches the
    // counter up when a backgrounded window comes back to the front.
    let throttle = 0;
    const onScroll = () => {
      if (throttle) return;
      throttle = window.setTimeout(() => {
        throttle = 0;
        update();
      }, 60);
    };
    const onVisible = () => {
      if (!document.hidden) update();
    };
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      editor.off('transaction', update);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('visibilitychange', onVisible);
      if (throttle) window.clearTimeout(throttle);
    };
  }, [editor]);

  return (
    <div className="status-bar">
      <span className="status-bar-section" title={connected ? 'Connected to relay' : 'Reconnecting…'}>
        <span className={`status-dot${connected ? ' connected' : ''}`} />
        {connected ? 'Connected' : 'Reconnecting…'}
      </span>
      <span className="status-bar-section">
        Page {pages.page} of {pages.total}
      </span>
      <span className="status-bar-section">
        {counts.words} {counts.words === 1 ? 'word' : 'words'} · {counts.chars}{' '}
        {counts.chars === 1 ? 'character' : 'characters'}
      </span>
      <span className="status-bar-spacer" />
      <button
        type="button"
        className="status-bar-btn"
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
    </div>
  );
}

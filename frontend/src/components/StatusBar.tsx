import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useCollaboration } from '../providers/CollaborationProvider';
import { useFullscreen } from '../hooks/useFullscreen';

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

  return (
    <div className="status-bar">
      <span className="status-bar-section" title={connected ? 'Connected to relay' : 'Reconnecting…'}>
        <span className={`status-dot${connected ? ' connected' : ''}`} />
        {connected ? 'Connected' : 'Reconnecting…'}
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

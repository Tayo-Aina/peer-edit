import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import * as Y from 'yjs';
import { CollaborationProvider } from './providers/CollaborationProvider';
import { DiscoveryPanel } from './components/DiscoveryPanel';
import { EditorView } from './components/EditorView';
import { UserPresence } from './components/UserPresence';
import { OptionsMenu } from './components/OptionsMenu';
import { BackstageView } from './components/BackstageView';
import { RecoveryBanner } from './components/RecoveryBanner';
import { DocumentProvider, useDocument } from './stores/documentStore';
import { useAutosave } from './hooks/useAutosave';
import { getFriendlyName } from './utils/names';
import { initTheme } from './hooks/useTheme';
import { useOptionalCollaboration } from './providers/CollaborationProvider';
import './styles/editor.css';
import './styles/panel.css';

// Apply the persisted theme before the first paint to avoid a light-mode flash.
initTheme();

/**
 * Inner workspace: lives INSIDE DocumentProvider so it can read docId/title
 * and run IndexedDB autosave + crash-recovery detection.
 */
function Workspace({
  relayUrl,
  userName,
  onDisconnect,
  onFindAnotherNetwork,
}: {
  relayUrl: string | null;
  userName: string;
  onDisconnect: () => void;
  onFindAnotherNetwork: () => void;
}) {
  const { docId, title, ydoc, dirty, lastSavedAt, newDocument } = useDocument();
  const { synced, whenSynced, clearPersisted } = useAutosave();

  const [backstageOpen, setBackstageOpen] = useState(false);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  const handleEditorReady = useCallback((ed: Editor | null) => {
    setEditorInstance(ed);
  }, []);

  const openFileMenu = useCallback(() => setBackstageOpen(true), []);
  const closeFileMenu = useCallback(() => setBackstageOpen(false), []);

  // Crash recovery: on launch (and on doc switch), if the doc has never been
  // explicitly saved but IndexedDB already holds updates, offer Restore/Discard.
  // IndexedDB loads asynchronously via whenSynced, so check after `synced`.
  const checkedDocRef = useRef<string | null>(null);
  useEffect(() => {
    if (!synced || checkedDocRef.current === docId) return;
    checkedDocRef.current = docId;
    let cancelled = false;
    // Reading the update size directly from the Y.Doc avoids an extra
    // IndexedDB round-trip: whenSynced already loaded persistence into ydoc.
    const update = Y.encodeStateAsUpdate(ydoc);
    if (!cancelled && lastSavedAt === null && update.length > 0) {
      try {
        const probe = new Y.Doc();
        Y.applyUpdate(probe, update);
        const hasContent = probe.getXmlFragment('default').length > 0 || update.length > 100;
        probe.destroy();
        if (hasContent) setRecoveryOpen(true);
      } catch {
        /* corrupt autosave -> stay quiet, editor still mounts */
      }
    }
    return () => {
      cancelled = true;
    };
  }, [synced, docId, ydoc, lastSavedAt]);

  // Ctrl/Cmd+O opens Backstage at Open; Ctrl/Cmd+S opens it at Save.
  // (The actual save/open runs inside Backstage; the shortcut just opens it.)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.altKey) return;
      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        setBackstageOpen(true);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setBackstageOpen(true);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleRestore = useCallback(() => {
    // Restore = keep IndexedDB state (already loaded), open Backstage Home.
    setRecoveryOpen(false);
    setBackstageOpen(true);
  }, []);

  const handleDiscard = useCallback(() => {
    // Discard = clearData() + fresh Y.Doc. Never auto-merges without consent.
    setRecoveryBusy(true);
    void clearPersisted()
      .catch(() => {
        /* clear errors are non-fatal — still reset the doc */
      })
      .then(() => {
        newDocument();
        checkedDocRef.current = null;
        setRecoveryOpen(false);
      })
      .finally(() => setRecoveryBusy(false));
  }, [clearPersisted, newDocument]);

  const workspace = (
    <>
      <RecoveryBanner
        open={recoveryOpen}
        title={title}
        recoveredAt={lastSavedAt}
        busy={recoveryBusy}
        onRestore={handleRestore}
        onDiscard={handleDiscard}
      />
      <header className="app-header">
        <div className="app-header-left">
          <button
            type="button"
            className="file-menu-btn"
            onClick={openFileMenu}
            title="File — New, Open, Save, Export, Info, Share"
          >
            File
          </button>
          <h1>PeerEdit</h1>
          <span className="doc-title" title={dirty ? 'Unsaved changes' : 'All changes saved'}>
            {title}
            {dirty ? ' •' : ''}
          </span>
        </div>
        <div className="status-indicator" aria-live="polite">
          <span className={`status-dot${relayUrl ? ' connected' : ''}`} />
          <span>{relayUrl ? relayUrl.replace('ws://', '') : 'Offline — local editing'}</span>
          {relayUrl && (
            <OptionsMenu
              relayUrl={relayUrl}
              onDisconnect={onDisconnect}
              onFindAnotherNetwork={onFindAnotherNetwork}
            />
          )}
        </div>
      </header>
      <main className="workspace">
        <EditorView onEditorReady={handleEditorReady} onOpenFileMenu={openFileMenu} />
        <OfflineAwarePresence />
      </main>
      <BackstageView
        open={backstageOpen}
        onClose={closeFileMenu}
        editor={editorInstance}
        relayUrl={relayUrl}
      />
    </>
  );

  // Online: wrap in CollaborationProvider (roomName = docId, connect after
  // IndexedDB whenSynced). Offline: render IndexedDB-only editing directly.
  if (relayUrl) {
    return (
      <CollaborationProvider
        key={docId}
        relayUrl={relayUrl}
        docId={docId}
        ydoc={ydoc}
        whenSynced={whenSynced}
        userName={userName}
      >
        {workspace}
      </CollaborationProvider>
    );
  }
  return workspace;
}

/** UserPresence needs a provider; render nothing offline. */
function OfflineAwarePresence() {
  const collab = useOptionalCollaboration();
  if (!collab) return null;
  return <UserPresence />;
}

export default function App() {
  // The desktop shell appends ?instance=N&relay=ws://... for additional windows
  // opened on the same machine (auto-connect + a distinguishable title).
  const params = new URLSearchParams(window.location.search);
  const initialRelay = params.get('relay');
  const instanceLabel = params.get('instance');

  const [relayUrl, setRelayUrl] = useState<string | null>(initialRelay);
  const [userName] = useState(() => getFriendlyName());
  // Bumping this remounts DiscoveryPanel so "Search for another network"
  // always kicks off a fresh mDNS scan instead of showing a stale list.
  const [discoveryKey, setDiscoveryKey] = useState(0);

  useEffect(() => {
    if (instanceLabel) {
      document.title = `PeerEdit (${instanceLabel})`;
    }
  }, [instanceLabel]);

  const handleConnect = useCallback((url: string) => {
    setRelayUrl(url);
  }, []);

  const handleDisconnect = useCallback(() => {
    setRelayUrl(null);
  }, []);

  const handleFindAnotherNetwork = useCallback(() => {
    setRelayUrl(null);
    setDiscoveryKey((k) => k + 1);
  }, []);

  return (
    <DocumentProvider>
      <div className="app">
        <DiscoveryPanel
          key={discoveryKey}
          onConnect={handleConnect}
          connected={relayUrl !== null}
        />

        <Workspace
          relayUrl={relayUrl}
          userName={userName}
          onDisconnect={handleDisconnect}
          onFindAnotherNetwork={handleFindAnotherNetwork}
        />
      </div>
    </DocumentProvider>
  );
}

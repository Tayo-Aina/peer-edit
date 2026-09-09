import React, { useState, useCallback, useEffect } from 'react';
import { CollaborationProvider } from './providers/CollaborationProvider';
import { DiscoveryPanel } from './components/DiscoveryPanel';
import { EditorView } from './components/EditorView';
import { UserPresence } from './components/UserPresence';
import { OptionsMenu } from './components/OptionsMenu';
import { getFriendlyName } from './utils/names';
import { initTheme } from './hooks/useTheme';
import './styles/editor.css';
import './styles/panel.css';

// Apply the persisted theme before the first paint to avoid a light-mode flash.
initTheme();

export default function App() {
  // The desktop shell appends ?instance=N&relay=ws://... for additional windows
  // opened on the same machine (auto-connect + a distinguishable title).
  const params = new URLSearchParams(window.location.search);
  const initialRelay = params.get('relay');
  const instanceLabel = params.get('instance');

  const [relayUrl, setRelayUrl] = useState<string | null>(initialRelay);
  const [roomName] = useState('default-doc');
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
    <div className="app">
      <DiscoveryPanel
        key={discoveryKey}
        onConnect={handleConnect}
        connected={relayUrl !== null}
      />

      {relayUrl && (
        <CollaborationProvider relayUrl={relayUrl} roomName={roomName} userName={userName}>
          <header className="app-header">
            <h1>PeerEdit</h1>
            <div className="status-indicator" aria-live="polite">
              <span className="status-dot connected" />
              <span>{relayUrl.replace('ws://', '')}</span>
              <OptionsMenu
                relayUrl={relayUrl}
                onDisconnect={handleDisconnect}
                onFindAnotherNetwork={handleFindAnotherNetwork}
              />
            </div>
          </header>
          <main className="workspace">
            <EditorView />
            <UserPresence />
          </main>
        </CollaborationProvider>
      )}
    </div>
  );
}

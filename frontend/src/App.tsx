import React, { useState, useCallback, useEffect } from 'react';
import { CollaborationProvider } from './providers/CollaborationProvider';
import { DiscoveryPanel } from './components/DiscoveryPanel';
import { EditorView } from './components/EditorView';
import { UserPresence } from './components/UserPresence';
import { getFriendlyName } from './utils/names';
import './styles/editor.css';
import './styles/panel.css';

export default function App() {
  // The desktop shell appends ?instance=N&relay=ws://... for additional windows
  // opened on the same machine (auto-connect + a distinguishable title).
  const params = new URLSearchParams(window.location.search);
  const initialRelay = params.get('relay');
  const instanceLabel = params.get('instance');

  const [relayUrl, setRelayUrl] = useState<string | null>(initialRelay);
  const [roomName] = useState('default-doc');
  const [userName] = useState(() => getFriendlyName());

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

  return (
    <div className="app">
      <DiscoveryPanel onConnect={handleConnect} connected={relayUrl !== null} />

      {relayUrl && (
        <CollaborationProvider relayUrl={relayUrl} roomName={roomName} userName={userName}>
          <header className="app-header">
            <h1>PeerEdit</h1>
            <div className="status-indicator">
              <span className="status-dot connected" />
              <span>{relayUrl.replace('ws://', '')}</span>
              <button
                className="btn"
                onClick={handleDisconnect}
                style={{ marginLeft: 12 }}
              >
                Disconnect
              </button>
            </div>
          </header>
          <main>
            <EditorView />
            <UserPresence />
          </main>
        </CollaborationProvider>
      )}
    </div>
  );
}

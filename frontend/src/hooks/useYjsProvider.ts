import { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface UseYjsProviderResult {
  ydoc: Y.Doc;
  provider: WebsocketProvider | null;
  status: ConnectionStatus;
}

export function useYjsProvider(relayUrl: string | null, roomName: string): UseYjsProviderResult {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const providerRef = useRef<WebsocketProvider | null>(null);

  useEffect(() => {
    if (!relayUrl) {
      setStatus('disconnected');
      return;
    }

    setStatus('connecting');
    const provider = new WebsocketProvider(relayUrl, roomName, ydocRef.current, { connect: true });
    providerRef.current = provider;

    provider.on('status', (event: { status: string }) => {
      setStatus(event.status as ConnectionStatus);
    });

    return () => {
      provider.destroy();
      providerRef.current = null;
    };
  }, [relayUrl, roomName]);

  return { ydoc: ydocRef.current, provider: providerRef.current, status };
}

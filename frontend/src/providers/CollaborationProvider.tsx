import React, { createContext, useContext, useMemo, useRef, useEffect } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { getFriendlyName } from '../utils/names';
import { getUserColor } from '../utils/colors';

interface CollaborationContextValue {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  awareness: WebsocketProvider['awareness'];
}

const CollaborationContext = createContext<CollaborationContextValue | null>(null);

interface Props {
  relayUrl: string;
  roomName: string;
  userName?: string;
  children: React.ReactNode;
}

export function CollaborationProvider({ relayUrl, roomName, userName, children }: Props) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  const value = useMemo(() => {
    // Destroy previous if URL/room changes
    providerRef.current?.destroy();
    ydocRef.current?.destroy();

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const provider = new WebsocketProvider(relayUrl, roomName, ydoc, {
      connect: true,
    });
    providerRef.current = provider;

    const displayName = userName ?? getFriendlyName();
    const color = getUserColor(ydoc.clientID);

    // Set local awareness state
    provider.awareness.setLocalState({
      name: displayName,
      color,
      cursor: null,
    });

    return { ydoc, provider, awareness: provider.awareness };
  }, [relayUrl, roomName, userName]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      providerRef.current?.destroy();
      ydocRef.current?.destroy();
    };
  }, []);

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
}

export function useCollaboration(): CollaborationContextValue {
  const ctx = useContext(CollaborationContext);
  if (!ctx) throw new Error('useCollaboration must be used within CollaborationProvider');
  return ctx;
}

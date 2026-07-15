import React, { createContext, useContext, useMemo, useRef, useEffect } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { getFriendlyName } from '../utils/names';
import { getUserColor } from '../utils/colors';

interface CollaborationContextValue {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  awareness: WebsocketProvider['awareness'];
  userName: string;
  color: string;
}

const CollaborationContext = createContext<CollaborationContextValue | null>(null);

interface Props {
  relayUrl: string;
  roomName: string;
  userName?: string;
  children: React.ReactNode;
}

export function CollaborationProvider({ relayUrl, roomName, userName, children }: Props) {
  const [value, setValue] = React.useState<CollaborationContextValue | null>(null);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(relayUrl, roomName, ydoc, {
      connect: true,
    });

    const displayName = userName ?? getFriendlyName();
    const color = getUserColor(ydoc.clientID);

    // Set local awareness state
    provider.awareness.setLocalState({
      name: displayName,
      color,
      cursor: null,
    });

    setValue({
      ydoc,
      provider,
      awareness: provider.awareness,
      userName: displayName,
      color,
    });

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [relayUrl, roomName, userName]);

  if (!value) {
    return <div className="loading-state">Connecting to collaboration server...</div>;
  }

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

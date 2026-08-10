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
      // Connect manually AFTER setting awareness: the Awareness constructor
      // seeds an empty `{}` local state, and broadcasting that would show us
      // as an "Unknown" user. Set the real name/color first.
      connect: false,
      // CRITICAL: Send a sync message every 10 seconds. The y-websocket client
      // has a 30-second idle timeout — if no data message is received from the
      // server in 30 seconds, it kills the connection. Our relay only forwards
      // to OTHER clients (never back to sender), so an idle client receives
      // nothing and gets disconnected. resyncInterval forces a periodic
      // server response that keeps the connection alive.
      resyncInterval: 10000,
    });

    const displayName = userName ?? getFriendlyName();
    const color = getUserColor(ydoc.clientID);

    // Set local awareness state BEFORE connecting.
    provider.awareness.setLocalState({
      name: displayName,
      color,
      cursor: null,
    });
    provider.connect();

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

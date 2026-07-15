import React, { createContext, useContext, useRef, useEffect, useReducer } from 'react';
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
  // Refs hold the real objects — their identity NEVER changes across renders.
  // This is critical: if ydoc or provider change identity, TipTap's useEditor
  // will destroy and recreate the editor, blanking the page.
  const ydocRef = useRef<Y.Doc>(null!);
  const providerRef = useRef<WebsocketProvider>(null!);
  const displayName = useRef(userName ?? getFriendlyName()).current;
  const [, forceRender] = useReducer((n) => n + 1, 0);

  // One-time init: create ydoc and provider, wire them up
  useEffect(() => {
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(relayUrl, roomName, ydoc, {
      connect: true,
    });
    ydocRef.current = ydoc;
    providerRef.current = provider;

    const color = getUserColor(ydoc.clientID);
    provider.awareness.setLocalState({
      name: displayName,
      color,
      cursor: null,
    });

    forceRender(); // trigger render so children see the provider

    return () => {
      provider.destroy();
      ydoc.destroy();
      ydocRef.current = null!;
      providerRef.current = null!;
    };
  }, [relayUrl, roomName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Not ready yet
  if (!providerRef.current) {
    return null; // avoid flash — DiscoveryPanel is still visible
  }

  const provider = providerRef.current;
  const color = getUserColor(ydocRef.current.clientID);

  // Build a stable context value. useMemo with [] keeps it from changing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = React.useMemo(() => ({
    ydoc: ydocRef.current,
    provider,
    awareness: provider.awareness,
    userName: displayName,
    color,
  }), [provider]);

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

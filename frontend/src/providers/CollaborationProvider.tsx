import React, { createContext, useContext, useEffect, useState } from 'react';
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
  /** Document identity — also used as the Y room name (one room per doc). */
  docId: string;
  /** Y.Doc owned by DocumentProvider (not created/destroyed here). */
  ydoc: Y.Doc;
  /** Resolves when IndexedDB has loaded into ydoc — connect only after. */
  whenSynced: Promise<unknown>;
  userName?: string;
  children: React.ReactNode;
}

export function CollaborationProvider({ relayUrl, docId, ydoc, whenSynced, userName, children }: Props) {
  const [value, setValue] = useState<CollaborationContextValue | null>(null);

  useEffect(() => {
    let cancelled = false;
    let provider: WebsocketProvider | null = null;

    const roomName = docId;

    provider = new WebsocketProvider(relayUrl, roomName, ydoc, {
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

    // Gate network connect on IndexedDB readiness so an empty initial
    // state can never clobber the persisted document.
    Promise.resolve(whenSynced)
      .then(() => {
        if (cancelled || !provider) return;
        // Set local awareness state BEFORE connecting.
        provider.awareness.setLocalState({
          name: displayName,
          color,
          cursor: null,
        });
        provider.connect();
      })
      .catch(() => {
        // IndexedDB unavailable (private mode) -> still connect
        // so collaboration works in-memory.
        if (cancelled || !provider) return;
        try {
          provider.awareness.setLocalState({ name: displayName, color, cursor: null });
          provider.connect();
        } catch {
          /* ignore */
        }
      });

    setValue({
      ydoc,
      provider,
      awareness: provider.awareness,
      userName: displayName,
      color,
    });

    return () => {
      cancelled = true;
      try {
        provider?.destroy();
      } catch {
        /* ignore */
      }
      // NOTE: ydoc is owned by DocumentProvider — never destroy it here.
    };
  }, [relayUrl, docId, ydoc, whenSynced, userName]);

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

/** Null when offline (no relay) — lets EditorView/StatusBar render without a provider. */
export function useOptionalCollaboration(): CollaborationContextValue | null {
  return useContext(CollaborationContext);
}

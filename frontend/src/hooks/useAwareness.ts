import { useState, useEffect } from 'react';
import { useCollaboration } from '../providers/CollaborationProvider';

export interface RemoteUser {
  clientId: number;
  name: string;
  color: string;
  cursor: { anchor: any; head: any } | null;
}

export function useAwareness(): {
  self: RemoteUser | null;
  others: RemoteUser[];
} {
  const { awareness } = useCollaboration();
  const [state, setState] = useState<Map<number, any>>(new Map());

  useEffect(() => {
    const handler = () => {
      setState(new Map(awareness.getStates()));
    };
    awareness.on('change', handler);
    handler(); // initial
    return () => {
      awareness.off('change', handler);
    };
  }, [awareness]);

  const selfId = awareness.clientID;

  // Safely build a RemoteUser from raw awareness state.
  // Remote states can be null (disconnecting) or missing fields.
  function toRemoteUser(clientId: number, raw: any): RemoteUser | null {
    if (!raw || typeof raw !== 'object') return null;
    return {
      clientId,
      name: typeof raw.name === 'string' ? raw.name : 'Unknown',
      color: typeof raw.color === 'string' ? raw.color : '#999999',
      cursor: raw.cursor ?? null,
    };
  }

  const self: RemoteUser | null = state.has(selfId)
    ? toRemoteUser(selfId, state.get(selfId))
    : null;

  const others: RemoteUser[] = [];
  state.forEach((raw, key) => {
    if (key !== selfId) {
      const user = toRemoteUser(key, raw);
      if (user) others.push(user);
    }
  });

  return { self, others };
}

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
  const self: RemoteUser | null = state.has(selfId)
    ? { clientId: selfId, ...state.get(selfId) }
    : null;

  const others: RemoteUser[] = [];
  state.forEach((val, key) => {
    if (key !== selfId) {
      others.push({ clientId: key, ...val });
    }
  });

  return { self, others };
}

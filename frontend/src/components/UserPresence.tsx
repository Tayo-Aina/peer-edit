import React from 'react';
import { useAwareness } from '../hooks/useAwareness';
import { useCollaboration } from '../providers/CollaborationProvider';

export function UserPresence() {
  const { self, others } = useAwareness();
  const allUsers = self ? [self, ...others] : others;

  return (
    <div className="presence-sidebar">
      <h3>In This Doc ({allUsers.length})</h3>
      {allUsers.map((user) => (
        <div key={user.clientId} className="presence-user">
          <span
            className="presence-dot"
            style={{ backgroundColor: user.color }}
          />
          <span>{user.name}</span>
          {user.clientId === self?.clientId && (
            <span style={{ color: '#999', fontSize: '11px' }}>(you)</span>
          )}
        </div>
      ))}
    </div>
  );
}

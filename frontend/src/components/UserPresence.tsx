import React from 'react';
import { useAwareness } from '../hooks/useAwareness';

export function UserPresence() {
  const { self, others } = useAwareness();
  const allUsers = self ? [self, ...others] : others;

  return (
    <aside className="user-presence-sidebar">
      <div className="user-presence-header">
        In This Doc ({allUsers.length})
      </div>
      <ul className="user-presence-list">
        {allUsers.map((user) => (
          <li key={user.clientId}>
            <div
              className="user-avatar"
              style={{ backgroundColor: user.color }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span>{user.name}</span>
            {user.clientId === self?.clientId && (
              <span style={{ color: 'var(--text-muted)' }}>(you)</span>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}

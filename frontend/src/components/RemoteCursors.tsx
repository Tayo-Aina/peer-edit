import React from 'react';
import { useAwareness } from '../hooks/useAwareness';

export function RemoteCursors() {
  const { others } = useAwareness();

  // TipTap's CollaborationCursor extension renders remote cursor decorations
  // directly inside the ProseMirror editor DOM. This component exists as a
  // supplementary awareness indicator that could be extended for additional
  // remote presence overlays (e.g., floating names above selections).
  return null;
}

import React, { useRef, useState, useEffect } from 'react';
import { Settings } from 'lucide-react';

interface OptionsMenuProps {
  relayUrl: string;
  onDisconnect: () => void;
  onFindAnotherNetwork: () => void;
}

export function OptionsMenu({ relayUrl, onDisconnect, onFindAnotherNetwork }: OptionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click, matching the Toolbar export menu pattern.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="header-options" ref={rootRef}>
      <button
        type="button"
        className="options-trigger"
        onClick={() => setOpen(!open)}
        title="Options"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Settings size={18} />
      </button>
      {open && (
        <div className="options-menu" role="menu">
          <div className="options-menu-header">Connected to {relayUrl.replace('ws://', '')}</div>
          <button
            type="button"
            role="menuitem"
            className="options-menu-item"
            onClick={() => {
              setOpen(false);
              onFindAnotherNetwork();
            }}
          >
            Search for another network
          </button>
          <button
            type="button"
            role="menuitem"
            className="options-menu-item options-menu-item-danger"
            onClick={() => {
              setOpen(false);
              onDisconnect();
            }}
          >
            Disconnect from network
          </button>
        </div>
      )}
    </div>
  );
}

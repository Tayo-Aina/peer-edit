import React, { useRef, useState, useEffect } from 'react';
import { Settings, Moon, SunMedium, Maximize2, Minimize2 } from 'lucide-react';
import { applyTheme, getTheme } from '../hooks/useTheme';
import { useFullscreen } from '../hooks/useFullscreen';

interface OptionsMenuProps {
  relayUrl: string;
  onDisconnect: () => void;
  onFindAnotherNetwork: () => void;
}

export function OptionsMenu({ relayUrl, onDisconnect, onFindAnotherNetwork }: OptionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState(() => getTheme());
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  // Close on outside click/touch + Escape, matching the Toolbar export menu.
  useEffect(() => {
    function handleDown(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleDown);
      document.addEventListener('touchstart', handleDown);
      document.addEventListener('keydown', handleKey);
    }
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('touchstart', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
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
              const next = theme === 'dark' ? 'light' : 'dark';
              applyTheme(next);
              setTheme(next);
            }}
          >
            {theme === 'dark' ? <SunMedium size={14} /> : <Moon size={14} />}
            Toggle dark mode
          </button>
          <button
            type="button"
            role="menuitem"
            className="options-menu-item"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            Toggle fullscreen
          </button>
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

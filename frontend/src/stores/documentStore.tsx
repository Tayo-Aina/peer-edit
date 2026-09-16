// Document identity store: owns the Y.Doc plus title / path / dirty state.
// Decouples document identity from the network room so each file gets its
// own collaboration room (roomName = docId) and its own IndexedDB key.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';

export const APP_VERSION = '1.0.0';
const CURRENT_DOC_KEY = 'peeredit:current-doc';

interface StoredCurrentDoc {
  docId: string;
  title: string;
}

function newUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadCurrentDoc(): StoredCurrentDoc | null {
  try {
    const raw = localStorage.getItem(CURRENT_DOC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCurrentDoc>;
    if (typeof parsed.docId === 'string' && parsed.docId.length > 0) {
      return {
        docId: parsed.docId,
        title: typeof parsed.title === 'string' && parsed.title ? parsed.title : 'Untitled',
      };
    }
  } catch {
    /* corrupt entry -> fresh doc */
  }
  return null;
}

export interface OpenMeta {
  docId: string;
  title: string;
  savedAt: number;
}

interface DocumentContextValue {
  docId: string;
  title: string;
  filePath: string | null;
  ydoc: Y.Doc;
  dirty: boolean;
  lastSavedAt: number | null;
  newDocument: () => void;
  openFromFile: (meta: OpenMeta, update: Uint8Array, filePath: string | null) => void;
  rename: (title: string) => void;
  setFilePath: (path: string | null) => void;
  markDirty: () => void;
  markClean: (savedAt?: number) => void;
}

const DocumentContext = createContext<DocumentContextValue | null>(null);

export function DocumentProvider({ children }: { children: React.ReactNode }) {
  const initial = useRef<{ docId: string; title: string } | null>(null);
  if (initial.current === null) {
    const stored = loadCurrentDoc();
    initial.current = stored ?? { docId: newUuid(), title: 'Untitled' };
  }

  const [docId, setDocId] = useState(initial.current.docId);
  const [title, setTitle] = useState(initial.current.title);
  const [filePath, setFilePathState] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [ydoc, setYdoc] = useState(() => new Y.Doc());

  // Persist the current doc identity so a relaunch can offer crash recovery.
  useEffect(() => {
    try {
      localStorage.setItem(CURRENT_DOC_KEY, JSON.stringify({ docId, title }));
    } catch {
      /* storage full / private mode -> autosave still works in-memory */
    }
  }, [docId, title]);

  // Destroy the Y.Doc on unmount only (switches create their replacement first).
  const ydocRef = useRef(ydoc);
  ydocRef.current = ydoc;
  useEffect(() => {
    return () => {
      try {
        ydocRef.current.destroy();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const newDocument = useCallback(() => {
    const next = new Y.Doc();
    const prev = ydocRef.current;
    ydocRef.current = next;
    setYdoc(next);
    setDocId(newUuid());
    setTitle('Untitled');
    setFilePathState(null);
    setDirty(false);
    setLastSavedAt(null);
    try {
      prev.destroy();
    } catch {
      /* ignore */
    }
  }, []);

  const openFromFile = useCallback((meta: OpenMeta, update: Uint8Array, path: string | null) => {
    const next = new Y.Doc();
    try {
      Y.applyUpdate(next, update);
    } catch {
      next.destroy();
      throw new Error('Could not open document: content is corrupted.');
    }
    const prev = ydocRef.current;
    ydocRef.current = next;
    setYdoc(next);
    setDocId(meta.docId);
    setTitle(meta.title || 'Untitled');
    setFilePathState(path);
    setDirty(false);
    setLastSavedAt(meta.savedAt);
    try {
      prev.destroy();
    } catch {
      /* ignore */
    }
  }, []);

  const rename = useCallback((next: string) => {
    setTitle((next || 'Untitled').trim() || 'Untitled');
  }, []);

  const setFilePath = useCallback((path: string | null) => {
    setFilePathState(path);
  }, []);

  const markDirty = useCallback(() => {
    setDirty(true);
  }, []);

  const markClean = useCallback((savedAt?: number) => {
    setDirty(false);
    setLastSavedAt(savedAt ?? Date.now());
  }, []);

  const value = useMemo<DocumentContextValue>(
    () => ({
      docId,
      title,
      filePath,
      ydoc,
      dirty,
      lastSavedAt,
      newDocument,
      openFromFile,
      rename,
      setFilePath,
      markDirty,
      markClean,
    }),
    [docId, title, filePath, ydoc, dirty, lastSavedAt, newDocument, openFromFile, rename, setFilePath, markDirty, markClean],
  );

  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>;
}

export function useDocument(): DocumentContextValue {
  const ctx = useContext(DocumentContext);
  if (!ctx) throw new Error('useDocument must be used within DocumentProvider');
  return ctx;
}

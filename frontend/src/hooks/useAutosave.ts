import { useCallback, useEffect, useRef, useState } from 'react';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useDocument } from '../stores/documentStore';

export interface UseAutosaveResult {
  /** True once IndexedDB has loaded into the current Y.Doc. */
  synced: boolean;
  /** Resolves when the current persistence instance finishes initial load. */
  whenSynced: Promise<IndexeddbPersistence>;
  /** Deletes the IndexedDB database for the current docId (explicit Discard only). */
  clearPersisted: () => Promise<void>;
}

/**
 * Autosave via y-indexeddb 9.0.12.
 *
 * - Creates `new IndexeddbPersistence(docId, ydoc)` on docId/ydoc change.
 * - Destroys the instance on switch/unmount.
 * - Marks the document dirty (debounced 1s) on `ydoc` updates.
 * - Exposes `synced` + `whenSynced` so CollaborationProvider can gate
 *   `provider.connect()` until local state is loaded (prevents clobber).
 */
export function useAutosave(): UseAutosaveResult {
  const { docId, ydoc, markDirty } = useDocument();

  const [synced, setSynced] = useState(false);
  const [whenSynced, setWhenSynced] = useState<Promise<IndexeddbPersistence>>(
    () => new Promise<IndexeddbPersistence>(() => {}),
  );

  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const markDirtyRef = useRef(markDirty);
  markDirtyRef.current = markDirty;

  useEffect(() => {
    const persistence = new IndexeddbPersistence(docId, ydoc);
    persistenceRef.current = persistence;

    setSynced(persistence.synced);
    setWhenSynced(persistence.whenSynced);

    let cancelled = false;
    persistence.whenSynced.then(() => {
      if (!cancelled) {
        setSynced(true);
      }
    }).catch(() => {
      /* IndexedDB unavailable (private mode) -> stay offline in-memory */
    });

    let dirtyTimer: ReturnType<typeof setTimeout> | null = null;
    const onUpdate = (): void => {
      if (dirtyTimer !== null) {
        clearTimeout(dirtyTimer);
      }
      dirtyTimer = setTimeout(() => {
        dirtyTimer = null;
        markDirtyRef.current();
      }, 1000);
    };
    ydoc.on('update', onUpdate);

    return () => {
      cancelled = true;
      if (dirtyTimer !== null) {
        clearTimeout(dirtyTimer);
        dirtyTimer = null;
      }
      ydoc.off('update', onUpdate);
      persistenceRef.current = null;
      persistence.destroy().catch(() => {
        /* ignore close errors on unmount */
      });
    };
  }, [docId, ydoc]);

  const clearPersisted = useCallback(async (): Promise<void> => {
    const persistence = persistenceRef.current;
    if (!persistence) {
      return;
    }
    persistenceRef.current = null;
    await persistence.clearData();
  }, []);

  return { synced, whenSynced, clearPersisted };
}

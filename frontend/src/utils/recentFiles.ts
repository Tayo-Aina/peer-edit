// Recent files MRU stored in localStorage under `peeredit:recent-files`.
// Max 10 entries, newest first: { docId, title, path?, openedAt }.
// Browser-safe: paths only, no File System Access handles.
// Add on successful open/save; Home renders list with empty-state.

export interface RecentFile {
  docId: string;
  title: string;
  /** Real path in Electron; undefined in browser fallback. */
  path?: string | null;
  openedAt: number;
}

export const RECENT_FILES_KEY = 'peeredit:recent-files';
export const RECENT_FILES_MAX = 10;

function isBrowserStorageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function sanitize(entries: unknown): RecentFile[] {
  if (!Array.isArray(entries)) return [];
  const out: RecentFile[] = [];
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    const r = e as Partial<RecentFile>;
    if (typeof r.docId !== 'string' || !r.docId) continue;
    out.push({
      docId: r.docId,
      title: typeof r.title === 'string' && r.title ? r.title : 'Untitled',
      path: typeof r.path === 'string' ? r.path : null,
      openedAt: typeof r.openedAt === 'number' ? r.openedAt : Date.now(),
    });
  }
  return out;
}

/** Newest-first list, empty when nothing stored or storage unavailable. */
export function list(): RecentFile[] {
  if (!isBrowserStorageAvailable()) return [];
  try {
    const raw = localStorage.getItem(RECENT_FILES_KEY);
    if (!raw) return [];
    return sanitize(JSON.parse(raw)).slice(0, RECENT_FILES_MAX);
  } catch {
    return [];
  }
}

/** Alias kept for call-sites that prefer a named getter. */
export const listRecentFiles = list;

function persist(entries: RecentFile[]): RecentFile[] {
  const capped = entries.slice(0, RECENT_FILES_MAX);
  if (!isBrowserStorageAvailable()) return capped;
  try {
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(capped));
  } catch {
    /* storage full / private mode -> keep in-memory result only */
  }
  return capped;
}

/**
 * Add or bump an entry to the front of the MRU. Dedupe by docId first,
 * then by path so Save As does not leave stale duplicates.
 */
export function add(entry: Omit<RecentFile, 'openedAt'> & { openedAt?: number }): RecentFile[] {
  const prev = list();
  const openedAt = typeof entry.openedAt === 'number' ? entry.openedAt : Date.now();
  const next: RecentFile = {
    docId: entry.docId,
    title: entry.title || 'Untitled',
    path: entry.path ?? null,
    openedAt,
  };
  const rest = prev.filter(
    r => r.docId !== next.docId && !(next.path && r.path === next.path),
  );
  return persist([next, ...rest]);
}

/** Alias for add(). */
export const addRecentFile = add;

/** Remove a single entry by docId (falls back to path match). */
export function remove(docIdOrPath: string): RecentFile[] {
  const prev = list();
  return persist(prev.filter(r => r.docId !== docIdOrPath && r.path !== docIdOrPath));
}

/** Alias for remove(). */
export const removeRecentFile = remove;

/** Clear the whole MRU list. */
export function clear(): void {
  if (!isBrowserStorageAvailable()) return;
  try {
    localStorage.removeItem(RECENT_FILES_KEY);
  } catch {
    /* ignore */
  }
}

/** Alias for clear(). */
export const clearRecentFiles = clear;

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Home,
  FilePlus,
  FolderOpen,
  Save,
  Copy,
  Download,
  Info,
  Share2,
  X,
  Trash2,
  FileText,
  Check,
} from 'lucide-react';
import { useDocument, APP_VERSION } from '../stores/documentStore';
import { fileBridge } from '../utils/fileBridge';
import {
  decodePeereditFile,
  encodePeereditFile,
  PeereditDecodeError,
  withPeereditExtension,
} from '../utils/peereditFile';
import { importDocxToHtml } from '../utils/docxImport';
import { buildDocxBlob } from '../utils/docxExport';
import * as recentFiles from '../utils/recentFiles';
import type { RecentFile } from '../utils/recentFiles';
import '../styles/backstage.css';

export type BackstageTab =
  | 'home'
  | 'new'
  | 'open'
  | 'save'
  | 'saveas'
  | 'export'
  | 'info'
  | 'share';

interface BackstageViewProps {
  open: boolean;
  onClose: () => void;
  /** Lifted editor instance (for Export stats / docx import target). */
  editor: Editor | null;
  /** Null when offline — Share tab explains relay is required. */
  relayUrl: string | null;
  initialTab?: BackstageTab;
}

interface Notice {
  kind: 'info' | 'success' | 'error';
  message: string;
}

const RAIL_TABS: { id: BackstageTab; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Home', icon: <Home size={16} /> },
  { id: 'new', label: 'New', icon: <FilePlus size={16} /> },
  { id: 'open', label: 'Open', icon: <FolderOpen size={16} /> },
  { id: 'save', label: 'Save', icon: <Save size={16} /> },
  { id: 'saveas', label: 'Save As', icon: <Copy size={16} /> },
  { id: 'export', label: 'Export', icon: <Download size={16} /> },
  { id: 'info', label: 'Info', icon: <Info size={16} /> },
  { id: 'share', label: 'Share', icon: <Share2 size={16} /> },
];

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function sanitizedBase(name: string): string {
  const base = (name || 'Untitled').trim() || 'Untitled';
  return base.replace(/[\\/:*?"<>|]/g, '-');
}

function formatTime(ts: number | null): string {
  if (!ts) return 'Never';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function downloadBlobObject(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(content: string, filename: string, mime: string): void {
  downloadBlobObject(new Blob([content], { type: mime }), filename);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function BackstageView({ open, onClose, editor, relayUrl, initialTab }: BackstageViewProps) {
  const {
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
  } = useDocument();

  const [activeTab, setActiveTab] = useState<BackstageTab>(initialTab ?? 'home');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [recent, setRecent] = useState<RecentFile[]>([]);
  const [renameDraft, setRenameDraft] = useState(title);
  const [confirmNew, setConfirmNew] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const shellRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const refreshRecent = useCallback(() => {
    setRecent(recentFiles.list());
  }, []);

  // Reset per-opening state + focus the shell when the Backstage opens.
  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab ?? 'home');
    setNotice(null);
    setWarnings([]);
    setConfirmNew(false);
    setBusy(null);
    setCopied(null);
    refreshRecent();
    const t = window.setTimeout(() => shellRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, initialTab, refreshRecent]);

  useEffect(() => {
    setRenameDraft(title);
  }, [title, open]);

  // Close on outside click (backdrop) + Escape — same pattern as OptionsMenu.
  useEffect(() => {
    if (!open) return;
    function handleDown(e: MouseEvent | TouchEvent) {
      if (shellRef.current && !shellRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('touchstart', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('touchstart', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open ]);

  // Lock background scroll while the overlay is up.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open ]);

  const runOp = useCallback(async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setNotice(null);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }, []);

  /* ---------------- Save / Save As (.peeredit via fileBridge) ---------------- */

  const doSave = useCallback(
    async (saveAs: boolean) => {
      const savedAt = Date.now();
      const bytes = encodePeereditFile(ydoc, {
        docId,
        title,
        savedAt,
        appVersion: APP_VERSION,
      });
      const suggested = withPeereditExtension(sanitizedBase(title));
      // Fast path: Save back to the known native path without another dialog.
      if (!saveAs && filePath && window.peeredit?.file) {
        try {
          await window.peeredit.file.writeFile(filePath, bytes);
        } catch (err) {
          setNotice({
            kind: 'error',
            message: `Save failed: ${err instanceof Error ? err.message : String(err)}`,
          });
          return;
        }
        markClean(savedAt);
        refreshRecent();
        recentFiles.add({ docId, title, path: filePath });
        refreshRecent();
        setNotice({ kind: 'success', message: `Saved to ${filePath}.` });
        return;
      }
      const savedPath = await fileBridge.saveDocument(bytes, suggested);
      if (!savedPath) return; // user cancelled the dialog
      setFilePath(savedPath);
      markClean(savedAt);
      recentFiles.add({ docId, title, path: savedPath });
      refreshRecent();
      setNotice({ kind: 'success', message: `Saved to ${savedPath}.` });
    },
    [ydoc, docId, title, filePath, setFilePath, markClean, refreshRecent],
  );

  const handleSave = useCallback(() => {
    void runOp('save', () => doSave(false)).catch(err => {
      setNotice({
        kind: 'error',
        message: `Save failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    });
  }, [runOp, doSave]);

  const handleSaveAs = useCallback(() => {
    void runOp('saveas', () => doSave(true)).catch(err => {
      setNotice({
        kind: 'error',
        message: `Save As failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    });
  }, [runOp, doSave]);

  /* ---------------- Open (.peeredit codec / .docx import) ---------------- */

  const applyPeereditBytes = useCallback(
    (bytes: Uint8Array, path: string | null) => {
      const { meta, update } = decodePeereditFile(bytes);
      openFromFile({ docId: meta.docId, title: meta.title, savedAt: meta.savedAt }, update, path);
      recentFiles.add({ docId: meta.docId, title: meta.title, path });
      refreshRecent();
      setWarnings([]);
      setNotice({ kind: 'success', message: `Opened “${meta.title}”.` });
    },
    [openFromFile, refreshRecent],
  );

  const applyDocxBytes = useCallback(
    async (bytes: Uint8Array, name: string, path: string | null) => {
      if (!editor) {
        setNotice({ kind: 'error', message: 'Editor is not ready yet — try again in a moment.' });
        return;
      }
      // Copy out of the IPC/clone buffer before handing to mammoth.
      const copy = new Uint8Array(bytes);
      const ab = copy.buffer.slice(
        copy.byteOffset,
        copy.byteOffset + copy.byteLength,
      ) as ArrayBuffer;
      const { html, warnings } = await importDocxToHtml(ab);
      // User gesture only — never on mount or in the collab sync path.
      editor.commands.setContent(html);
      markDirty();
      const base = sanitizedBase(name.replace(/\.docx$/i, ''));
      rename(base);
      recentFiles.add({ docId, title: base, path });
      refreshRecent();
      setWarnings(warnings);
      setNotice({
        kind: 'success',
        message: `Imported “${name}” as “${base}”.`,
      });
    },
    [editor, markDirty, rename, docId, refreshRecent],
  );

  const handleOpen = useCallback(() => {
    void runOp('open', async () => {
      const picked = await fileBridge.openDocument(true);
      if (!picked) return; // user cancelled
      setWarnings([]);
      try {
        if (/\.docx$/i.test(picked.name)) {
          await applyDocxBytes(picked.bytes, picked.name, picked.path);
        } else {
          applyPeereditBytes(picked.bytes, picked.path);
        }
        setActiveTab('home');
      } catch (err) {
        setNotice({
          kind: 'error',
          message:
            err instanceof PeereditDecodeError || err instanceof Error
              ? `Could not open “${picked.name}”: ${err.message}`
              : `Could not open “${picked.name}”.`,
        });
      }
    });
  }, [runOp, applyDocxBytes, applyPeereditBytes]);

  const handleRecentOpen = useCallback(
    (entry: RecentFile) => {
      // Native fast path: re-read the known path without a picker dialog.
      if (entry.path && window.peeredit?.file) {
        void runOp(`recent:${entry.docId}`, async () => {
          try {
            const raw = await window.peeredit!.file!.readFile(entry.path as string);
            applyPeereditBytes(new Uint8Array(raw), entry.path as string);
            setActiveTab('home');
          } catch {
            setActiveTab('open');
            setNotice({
              kind: 'info',
              message: 'That file could not be read directly — pick it again below.',
            });
          }
        });
        return;
      }
      // Browser mode keeps paths only, so fall through to the picker.
      setActiveTab('open');
      setNotice({
        kind: 'info',
        message: 'Pick the file again via Open — browsers do not retain file access.',
      });
    },
    [runOp, applyPeereditBytes],
  );

  const handleRemoveRecent = useCallback(
    (entry: RecentFile, e: React.MouseEvent) => {
      e.stopPropagation();
      recentFiles.remove(entry.docId);
      refreshRecent();
    },
    [refreshRecent],
  );

  const handleClearRecent = useCallback(() => {
    recentFiles.clear();
    refreshRecent();
  }, [refreshRecent]);

  /* ---------------- New ---------------- */

  const handleNew = useCallback(() => {
    if (dirty && !confirmNew) {
      setConfirmNew(true);
      return;
    }
    setConfirmNew(false);
    setWarnings([]);
    newDocument();
    setNotice({ kind: 'success', message: 'Created a new blank document.' });
    setActiveTab('home');
  }, [dirty, confirmNew, newDocument]);

  /* ---------------- Export (buildDocxBlob + HTML/TXT) ---------------- */

  const handleExportDocx = useCallback(() => {
    if (!editor) {
      setNotice({ kind: 'error', message: 'Editor is not ready yet — try again in a moment.' });
      return;
    }
    void runOp('export-docx', async () => {
      try {
        const blob = await buildDocxBlob(editor);
        downloadBlobObject(blob, `${sanitizedBase(title)}-${timestamp()}.docx`);
        setNotice({ kind: 'success', message: 'Exported as Word (.docx).' });
      } catch (err) {
        setNotice({
          kind: 'error',
          message: `DOCX export failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    });
  }, [editor, title, runOp]);

  const handleExportHtml = useCallback(() => {
    if (!editor) {
      setNotice({ kind: 'error', message: 'Editor is not ready yet — try again in a moment.' });
      return;
    }
    const html = editor.getHTML();
    downloadText(
      `<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><title>${sanitizedBase(title)}</title></head>\n<body>\n${html}\n</body>\n</html>`,
      `${sanitizedBase(title)}-${timestamp()}.html`,
      'text/html',
    );
    setNotice({ kind: 'success', message: 'Exported as HTML.' });
  }, [editor, title]);

  const handleExportTxt = useCallback(() => {
    if (!editor) {
      setNotice({ kind: 'error', message: 'Editor is not ready yet — try again in a moment.' });
      return;
    }
    downloadText(editor.getText(), `${sanitizedBase(title)}-${timestamp()}.txt`, 'text/plain');
    setNotice({ kind: 'success', message: 'Exported as plain text.' });
  }, [editor, title]);

  /* ---------------- Info ---------------- */

  const counts = (() => {
    try {
      const store = editor?.storage.characterCount as
        | { words(): number; characters(): number }
        | undefined;
      if (store && typeof store.words === 'function') {
        return { words: store.words(), chars: store.characters() };
      }
    } catch {
      /* editor tearing down */
    }
    return { words: 0, chars: 0 };
  })();

  const handleRename = useCallback(() => {
    rename(renameDraft);
    recentFiles.add({ docId, title: renameDraft || 'Untitled', path: filePath });
    refreshRecent();
    setNotice({ kind: 'success', message: 'Document renamed.' });
  }, [rename, renameDraft, docId, filePath, refreshRecent]);

  /* ---------------- Share ---------------- */

  const handleCopy = useCallback((key: string, text: string) => {
    void copyText(text).then(ok => {
      setCopied(ok ? key : null);
      if (ok) {
        window.setTimeout(() => {
          setCopied(prev => (prev === key ? null : prev));
        }, 1500);
      }
    });
  }, []);

  if (!open) return null;

  const copyBtn = (key: string, text: string) => (
    <button
      type="button"
      className="backstage-copy-btn"
      onClick={() => handleCopy(key, text)}
      title="Copy to clipboard"
    >
      {copied === key ? <Check size={13} /> : <Copy size={13} />}
      {copied === key ? 'Copied' : 'Copy'}
    </button>
  );

  return (
    <div className="backstage-overlay" role="presentation">
      <div
        ref={shellRef}
        className="backstage-shell"
        role="dialog"
        aria-modal="true"
        aria-label="File menu"
        tabIndex={-1}
      >
        <nav className="backstage-rail" aria-label="File menu tabs">
          <div className="backstage-rail-title">PeerEdit</div>
          {RAIL_TABS.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              className={`backstage-rail-tab${activeTab === t.id ? ' active' : ''}`}
              onClick={() => {
                setActiveTab(t.id);
                setNotice(null);
                setConfirmNew(false);
              }}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
          <div className="backstage-rail-spacer" />
          <button type="button" className="backstage-rail-back" onClick={() => onCloseRef.current()}>
            <X size={16} />
            <span>Back to document (Esc)</span>
          </button>
        </nav>

        <section className="backstage-pane" aria-label={`${activeTab} panel`}>
          <div className="backstage-pane-header">
            <span className="backstage-pane-title">
              {RAIL_TABS.find(t => t.id === activeTab)?.label}
            </span>
            <button
              type="button"
              className="backstage-close"
              onClick={() => onCloseRef.current()}
              title="Close (Esc)"
              aria-label="Close file menu"
            >
              <X size={18} />
            </button>
          </div>

          <div className="backstage-pane-body" tabIndex={0}>
            {notice && (
              <div
                className={`backstage-notice${notice.kind === 'error' ? ' backstage-notice-error' : notice.kind === 'success' ? ' backstage-notice-success' : ''}`}
                role={notice.kind === 'error' ? 'alert' : 'status'}
              >
                {notice.message}
              </div>
            )}
            {warnings.length > 0 && (
              <div className="backstage-notice" role="status">
                <span className="backstage-section-title">Import warnings</span>
                <ul className="backstage-warnings">
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === 'home' && (
              <>
                <div className="backstage-row">
                  <button
                    type="button"
                    className="backstage-btn backstage-btn-primary"
                    onClick={() => setActiveTab('new')}
                  >
                    <FilePlus size={15} /> New document
                  </button>
                  <button type="button" className="backstage-btn" onClick={() => setActiveTab('open')}>
                    <FolderOpen size={15} /> Open…
                  </button>
                </div>
                <div>
                  <div className="backstage-section-title">Recent</div>
                  <p className="backstage-muted">
                    {dirty ? 'Unsaved changes in the current document.' : 'All changes saved.'}
                  </p>
                </div>
                {recent.length === 0 ? (
                  <div className="backstage-empty">No recent documents</div>
                ) : (
                  <>
                    <div className="backstage-recent-list">
                      {recent.map(r => (
                        <button
                          key={`${r.docId}-${r.openedAt}`}
                          type="button"
                          className="backstage-recent-item"
                          onClick={() => handleRecentOpen(r)}
                          title={r.path ?? r.title}
                        >
                          <span className="backstage-recent-icon">
                            <FileText size={16} />
                          </span>
                          <span className="backstage-recent-meta">
                            <span className="backstage-recent-title">{r.title}</span>
                            <span className="backstage-recent-path">
                              {r.path ?? 'Browser — no stored path'} · {formatTime(r.openedAt)}
                            </span>
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={`Remove ${r.title} from recent`}
                            className="backstage-recent-remove"
                            onClick={e => handleRemoveRecent(r, e as unknown as React.MouseEvent)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleRemoveRecent(r, e as unknown as React.MouseEvent);
                              }
                            }}
                          >
                            <X size={14} />
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="backstage-row">
                      <button type="button" className="backstage-btn" onClick={handleClearRecent}>
                        <Trash2 size={14} /> Clear recent
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {activeTab === 'new' && (
              <>
                <p className="backstage-text">
                  Start a fresh blank document with its own collaboration room and autosave.
                </p>
                {dirty && !confirmNew && (
                  <div className="backstage-notice" role="status">
                    The current document has unsaved changes. Creating a blank document will switch
                    away from it (autosave keeps a local copy).
                  </div>
                )}
                {confirmNew && (
                  <div className="backstage-notice backstage-notice-error" role="alert">
                    Discard the current view and create a blank document?
                  </div>
                )}
                <div className="backstage-row">
                  <button
                    type="button"
                    className="backstage-btn backstage-btn-primary"
                    onClick={handleNew}
                  >
                    <FilePlus size={15} />
                    {dirty && !confirmNew ? 'New blank document…' : 'Create blank document'}
                  </button>
                  {confirmNew && (
                    <button
                      type="button"
                      className="backstage-btn"
                      onClick={() => setConfirmNew(false)}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </>
            )}

            {activeTab === 'open' && (
              <>
                <p className="backstage-text">
                  Open a native <code>.peeredit</code> file, or import a Word <code>.docx</code>{' '}
                  (content-only; some formatting may not carry over).
                </p>
                <div className="backstage-row">
                  <button
                    type="button"
                    className="backstage-btn backstage-btn-primary"
                    disabled={busy === 'open'}
                    onClick={handleOpen}
                  >
                    <FolderOpen size={15} />
                    {busy === 'open' ? 'Opening…' : 'Choose file…'}
                  </button>
                </div>
                <p className="backstage-muted">
                  {fileBridge.isNative
                    ? 'Uses the native file dialog.'
                    : 'Browser mode: uses a file picker; paths are not retained.'}
                </p>
              </>
            )}

            {activeTab === 'save' && (
              <>
                <p className="backstage-text">
                  Save the current document as a native <code>.peeredit</code> file.
                  {filePath ? (
                    <>
                      {' '}Current file: <code>{filePath}</code>
                    </>
                  ) : (
                    ' It has not been saved to a file yet.'
                  )}
                </p>
                <div className="backstage-row">
                  <button
                    type="button"
                    className="backstage-btn backstage-btn-primary"
                    disabled={busy === 'save'}
                    onClick={handleSave}
                  >
                    <Save size={15} /> {busy === 'save' ? 'Saving…' : filePath ? 'Save' : 'Save…'}
                  </button>
                  <button
                    type="button"
                    className="backstage-btn"
                    onClick={() => setActiveTab('saveas')}
                  >
                    Save As…
                  </button>
                </div>
              </>
            )}

            {activeTab === 'saveas' && (
              <>
                <p className="backstage-text">
                  Save a copy under a new name. The new file becomes the current document.
                </p>
                <div className="backstage-row">
                  <button
                    type="button"
                    className="backstage-btn backstage-btn-primary"
                    disabled={busy === 'saveas'}
                    onClick={handleSaveAs}
                  >
                    <Copy size={15} /> {busy === 'saveas' ? 'Saving…' : 'Save a copy…'}
                  </button>
                </div>
              </>
            )}

            {activeTab === 'export' && (
              <>
                <p className="backstage-text">
                  Export a copy for other apps. The PeerEdit document stays open.
                </p>
                <div className="backstage-row">
                  <button
                    type="button"
                    className="backstage-btn backstage-btn-primary"
                    disabled={!editor || busy === 'export-docx'}
                    onClick={handleExportDocx}
                  >
                    <Download size={15} />
                    {busy === 'export-docx' ? 'Exporting…' : 'Word (.docx)'}
                  </button>
                  <button
                    type="button"
                    className="backstage-btn"
                    disabled={!editor}
                    onClick={handleExportHtml}
                  >
                    HTML
                  </button>
                  <button
                    type="button"
                    className="backstage-btn"
                    disabled={!editor}
                    onClick={handleExportTxt}
                  >
                    Plain text
                  </button>
                </div>
                {!editor && (
                  <p className="backstage-muted">Editor is not ready yet — try again in a moment.</p>
                )}
              </>
            )}

            {activeTab === 'info' && (
              <>
                <div>
                  <div className="backstage-section-title">Title</div>
                  <div className="backstage-row" style={{ marginTop: 6 }}>
                    <input
                      className="backstage-input"
                      value={renameDraft}
                      onChange={e => setRenameDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename();
                      }}
                      aria-label="Document title"
                      maxLength={120}
                    />
                    <button type="button" className="backstage-btn" onClick={handleRename}>
                      Rename
                    </button>
                  </div>
                </div>
                <dl className="backstage-kv">
                  <dt className="backstage-kv-dt">Words</dt>
                  <dd className="backstage-kv-dd">{counts.words.toLocaleString()}</dd>
                  <dd />
                  <dt className="backstage-kv-dt">Characters</dt>
                  <dd className="backstage-kv-dd">{counts.chars.toLocaleString()}</dd>
                  <dd />
                  <dt className="backstage-kv-dt">Document ID</dt>
                  <dd className="backstage-kv-dd" title={docId}>
                    {docId}
                  </dd>
                  <dd>{copyBtn('docId', docId)}</dd>
                  <dt className="backstage-kv-dt">Last saved</dt>
                  <dd className="backstage-kv-dd">{formatTime(lastSavedAt)}</dd>
                  <dd />
                  <dt className="backstage-kv-dt">File</dt>
                  <dd className="backstage-kv-dd" title={filePath ?? ''}>
                    {filePath ?? 'Not saved to a file yet'}
                  </dd>
                  <dd />
                  <dt className="backstage-kv-dt">Status</dt>
                  <dd className="backstage-kv-dd">{dirty ? 'Unsaved changes' : 'All changes saved'}</dd>
                  <dd />
                </dl>
              </>
            )}

            {activeTab === 'share' && (
              <>
                {!relayUrl ? (
                  <p className="backstage-text">
                    Not connected. Share needs a relay connection — connect from the discovery
                    panel first, then the room link will appear here.
                  </p>
                ) : (
                  <>
                    <p className="backstage-text">
                      Collaborators on the same relay join this room. Each document has its own
                      room (<code>room = docId</code>), so different files never merge.
                    </p>
                    <dl className="backstage-kv">
                      <dt className="backstage-kv-dt">Relay</dt>
                      <dd className="backstage-kv-dd" title={relayUrl}>
                        {relayUrl}
                      </dd>
                      <dd>{copyBtn('relay', relayUrl)}</dd>
                      <dt className="backstage-kv-dt">Room (docId)</dt>
                      <dd className="backstage-kv-dd" title={docId}>
                        {docId}
                      </dd>
                      <dd>{copyBtn('room', docId)}</dd>
                    </dl>
                  </>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

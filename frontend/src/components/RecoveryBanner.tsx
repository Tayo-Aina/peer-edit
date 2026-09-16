import React from 'react';
import { History, RotateCcw, Trash2 } from 'lucide-react';
import '../styles/backstage.css';

export interface RecoveryBannerProps {
  /** Show the strip. Parent decides visibility (IndexedDB newer than last save). */
  open: boolean;
  /** Current document title for the message. */
  title: string;
  /** Wall-clock of the recovered autosave, if known (else generic message). */
  recoveredAt: number | null;
  /** True while Discard (clearData) is in flight — disables buttons. */
  busy?: boolean;
  /** Restore = keep IndexedDB state, typically opens Backstage Home. */
  onRestore: () => void;
  /**
   * Discard = caller runs `clearPersisted()` (IndexedDB `clearData()`)
   * + `newDocument()` (fresh Y.Doc). Never auto-merges without consent.
   */
  onDiscard: () => void;
}

function formatTime(ts: number | null): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

/**
 * Non-modal crash-recovery strip (plan §11).
 * Styles come from `styles/backstage.css` (`.recovery-banner`, CSS vars only).
 */
export function RecoveryBanner({
  open,
  title,
  recoveredAt,
  busy,
  onRestore,
  onDiscard,
}: RecoveryBannerProps) {
  if (!open) return null;

  const when = formatTime(recoveredAt);
  return (
    <div className="recovery-banner" role="alert" aria-live="assertive">
      <History size={16} aria-hidden="true" />
      <span className="recovery-banner-text">
        Unsaved changes{title ? ` in \u201c${title}\u201d` : ''}
        {when ? ` from ${when}` : ''} — Restore or Discard.
      </span>
      <span className="recovery-banner-actions">
        <button
          type="button"
          className="backstage-btn backstage-btn-primary"
          disabled={busy}
          onClick={onRestore}
        >
          <RotateCcw size={14} />
          Restore
        </button>
        <button
          type="button"
          className="backstage-btn"
          disabled={busy}
          onClick={onDiscard}
          title="Clears the local autosave (IndexedDB clearData) and starts fresh"
        >
          <Trash2 size={14} />
          {busy ? 'Discarding…' : 'Discard'}
        </button>
      </span>
    </div>
  );
}

export default RecoveryBanner;

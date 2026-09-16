// Native `.peeredit` v1 binary codec.
// Layout: 8-byte magic `PEEREDIT` + 1-byte version (0x01) + 4-byte LE
// JSON-meta length + JSON meta + Y.encodeStateAsUpdate V1 bytes.
// Pure functions: no DOM, no Electron, no Y.Doc mutation on decode
// (callers apply the update themselves after validating the file).

import * as Y from 'yjs';

export const PEEREDIT_MAGIC = 'PEEREDIT';
export const PEEREDIT_VERSION = 0x01;
export const PEEREDIT_EXTENSION = 'peeredit';

export interface PeereditMeta {
  docId: string;
  title: string;
  savedAt: number;
  appVersion: string;
}

export interface DecodedPeereditFile {
  meta: PeereditMeta;
  update: Uint8Array;
}

export class PeereditDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PeereditDecodeError';
  }
}

function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function utf8Decode(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

function isValidMeta(m: unknown): m is PeereditMeta {
  if (!m || typeof m !== 'object') return false;
  const o = m as Record<string, unknown>;
  return (
    typeof o['docId'] === 'string' &&
    typeof o['title'] === 'string' &&
    typeof o['savedAt'] === 'number' &&
    typeof o['appVersion'] === 'string'
  );
}

export function encodePeereditFile(doc: Y.Doc, meta: PeereditMeta): Uint8Array {
  const metaBytes = utf8Encode(JSON.stringify(meta));
  const update = Y.encodeStateAsUpdate(doc);
  const out = new Uint8Array(8 + 1 + 4 + metaBytes.length + update.length);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  for (let i = 0; i < PEEREDIT_MAGIC.length; i++) {
    out[i] = PEEREDIT_MAGIC.charCodeAt(i)!;
  }
  out[8] = PEEREDIT_VERSION;
  view.setUint32(9, metaBytes.length, true);
  out.set(metaBytes, 13);
  out.set(update, 13 + metaBytes.length);
  return out;
}

export function decodePeereditFile(bytes: Uint8Array): DecodedPeereditFile {
  if (bytes.length < 13) {
    throw new PeereditDecodeError('File is too small to be a PeerEdit document.');
  }
  for (let i = 0; i < PEEREDIT_MAGIC.length; i++) {
    if (bytes[i] !== PEEREDIT_MAGIC.charCodeAt(i)) {
      throw new PeereditDecodeError('Not a PeerEdit document (bad magic).');
    }
  }
  const version = bytes[8]!;
  if (version !== PEEREDIT_VERSION) {
    throw new PeereditDecodeError(
      `Unsupported file version ${version} (this app reads v${PEEREDIT_VERSION}).`,
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const metaLen = view.getUint32(9, true);
  if (!Number.isFinite(metaLen) || metaLen > bytes.length - 13) {
    throw new PeereditDecodeError('File is truncated (bad metadata length).');
  }
  let meta: unknown;
  try {
    meta = JSON.parse(utf8Decode(bytes.slice(13, 13 + metaLen)));
  } catch {
    throw new PeereditDecodeError('File metadata is corrupted.');
  }
  if (!isValidMeta(meta)) {
    throw new PeereditDecodeError('File metadata is invalid.');
  }
  const update = bytes.slice(13 + metaLen);
  // Validate the Y update before the caller applies it: a corrupt tail must
  // fail here, not halfway through mutating the live document.
  try {
    const probe = new Y.Doc();
    Y.applyUpdate(probe, update);
    probe.destroy();
  } catch {
    throw new PeereditDecodeError('File content is corrupted.');
  }
  return { meta, update };
}

/** `Untitled` -> `Untitled.peeredit`; leaves existing extensions alone. */
export function withPeereditExtension(name: string): string {
  const base = (name || 'Untitled').trim() || 'Untitled';
  return /\.peeredit$/i.test(base) ? base : `${base}.peeredit`;
}

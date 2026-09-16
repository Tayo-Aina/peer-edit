// Renderer-side file facade: one contract for native (Electron) and
// browser (vite dev) environments. The renderer never touches Node/fs
// directly — in Electron every call delegates to window.peeredit.file
// (see desktop/preload.js); in a plain browser we fall back to a hidden
// <input type=file> for open and an <a download> for save.

import type { PeerEditFileBridge } from './electronBridge';

export interface OpenedFile {
  bytes: Uint8Array;
  /** Real path in Electron; the picked File.name in browser fallback. */
  name: string;
  path: string | null;
}

export interface FileBridge {
  readonly isNative: boolean;
  openDocument(acceptDotDocx: boolean): Promise<OpenedFile | null>;
  saveDocument(bytes: Uint8Array, suggestedName: string): Promise<string | null>;
}

function getNativeFileBridge(): PeerEditFileBridge | undefined {
  if (typeof window !== 'undefined' && window.peeredit?.file) {
    return window.peeredit.file;
  }
  return undefined;
}

function browserOpen(acceptDotDocx: boolean): Promise<OpenedFile | null> {
  return new Promise(origResolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = acceptDotDocx ? '.peeredit,.docx' : '.peeredit';
    let settled = false;
    const done = (v: OpenedFile | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      origResolve(v);
    };
    const onFocus = () => {
      window.setTimeout(() => {
        if (!settled && !input.files?.length) done(null);
      }, 300);
    };
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        done(null);
        return;
      }
      file
        .arrayBuffer()
        .then(buf => done({ bytes: new Uint8Array(buf), name: file.name, path: null }))
        .catch(() => done(null));
    };
    window.addEventListener('focus', onFocus);
    input.click();
  });
}

function browserSave(bytes: Uint8Array, suggestedName: string): string | null {
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([copy], {
    type: 'application/octet-stream',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return suggestedName;
}

export const fileBridge: FileBridge = {
  get isNative() {
    return getNativeFileBridge() !== undefined;
  },

  async openDocument(acceptDotDocx: boolean): Promise<OpenedFile | null> {
    const native = getNativeFileBridge();
    if (native) {
      const picked = await native.openDialog(acceptDotDocx);
      if (!picked) return null;
      const bytes = await native.readFile(picked.filePath);
      const name = picked.filePath.split(/[/\\]/).pop() || picked.filePath;
      return { bytes, name, path: picked.filePath };
    }
    return browserOpen(acceptDotDocx);
  },

  async saveDocument(bytes: Uint8Array, suggestedName: string): Promise<string | null> {
    const native = getNativeFileBridge();
    if (native) {
      const picked = await native.saveDialog(suggestedName);
      if (!picked) return null;
      await native.writeFile(picked.filePath, bytes);
      return picked.filePath;
    }
    return browserSave(bytes, suggestedName);
  },
};

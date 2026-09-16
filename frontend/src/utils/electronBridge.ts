// Types + detection for the Electron discovery bridge exposed by
// desktop/preload.js via contextBridge. In a plain browser (dev mode) the
// bridge is absent, so callers fall back to the manual/saved-relay scan.

export interface RawPeer {
  address: string;
  port: number;
  name?: string;
}

export interface PeerEditFileBridge {
  openDialog: (acceptDotDocx: boolean) => Promise<{ filePath: string } | null>;
  saveDialog: (suggestedName: string) => Promise<{ filePath: string } | null>;
  readFile: (filePath: string) => Promise<Uint8Array>;
  writeFile: (filePath: string, bytes: Uint8Array) => Promise<void>;
}

export interface PeerEditBridge {
  listPeers: () => Promise<RawPeer[]>;
  getLocalAddresses: () => Promise<string[]>;
  getRelayPort: () => Promise<number>;
  onPeerUp: (callback: (peer: RawPeer) => void) => () => void;
  onPeerDown: (callback: (peer: RawPeer) => void) => () => void;
  /** Present in Electron when desktop/preload.js exposes file IPC. */
  file?: PeerEditFileBridge;
}

declare global {
  interface Window {
    peeredit?: PeerEditBridge;
  }
}

export function getElectronBridge(): PeerEditBridge | null {
  if (typeof window !== 'undefined' && window.peeredit) {
    return window.peeredit;
  }
  return null;
}

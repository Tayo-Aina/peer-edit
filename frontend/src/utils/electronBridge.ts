// Types + detection for the Electron discovery bridge exposed by
// desktop/preload.js via contextBridge. In a plain browser (dev mode) the
// bridge is absent, so callers fall back to the manual/saved-relay scan.

export interface RawPeer {
  address: string;
  port: number;
  name?: string;
}

export interface PeerEditBridge {
  listPeers: () => Promise<RawPeer[]>;
  getLocalAddresses: () => Promise<string[]>;
  getRelayPort: () => Promise<number>;
  onPeerUp: (callback: (peer: RawPeer) => void) => () => void;
  onPeerDown: (callback: (peer: RawPeer) => void) => () => void;
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

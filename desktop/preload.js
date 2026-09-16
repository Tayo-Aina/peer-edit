// PeerEdit preload — bridges LAN peer discovery + native file IO from the
// Electron main process into the renderer without exposing Node. Rendered via
// contextBridge (contextIsolation is on, nodeIntegration is off, sandbox off).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('peeredit', {
  // Current snapshot of peers discovered via mDNS.
  listPeers: () => ipcRenderer.invoke('peeredit:discover:list'),
  // Non-internal IPv4 addresses of this machine (to filter "self" out).
  getLocalAddresses: () => ipcRenderer.invoke('peeredit:local-addresses'),
  // Port of this machine's embedded relay (may differ from the 9876 default
  // when the preferred port was busy at startup).
  getRelayPort: () => ipcRenderer.invoke('peeredit:relay-port'),
  // Subscribe to live discovery events. Each returns an unsubscribe fn.
  onPeerUp: (callback) => {
    const handler = (_event, peer) => callback(peer);
    ipcRenderer.on('peeredit:peer-up', handler);
    return () => ipcRenderer.removeListener('peeredit:peer-up', handler);
  },
  onPeerDown: (callback) => {
    const handler = (_event, peer) => callback(peer);
    ipcRenderer.on('peeredit:peer-down', handler);
    return () => ipcRenderer.removeListener('peeredit:peer-down', handler);
  },
  // Native file dialogs + fs access (main process only). Bytes cross IPC as
  // Uint8Array via structured clone.
  file: {
    openDialog: (acceptDotDocx) => ipcRenderer.invoke('peeredit:file:open', !!acceptDotDocx),
    saveDialog: (suggestedName) => ipcRenderer.invoke('peeredit:file:save', String(suggestedName || 'Untitled.peeredit')),
    readFile: (filePath) => ipcRenderer.invoke('peeredit:file:read', filePath),
    writeFile: (filePath, bytes) => ipcRenderer.invoke('peeredit:file:write', filePath, bytes),
  },
});

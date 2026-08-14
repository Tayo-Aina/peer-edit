// Thin bridge between the Electron main process and the relay server sources.
// Bundled by esbuild (desktop/build.mjs) into desktop/bundle/relay.cjs.

import net from 'node:net';
import os from 'node:os';
import { RelayServer } from '../relay-server/src/RelayServer.js';
import { Discovery, DiscoveredPeer } from '../relay-server/src/Discovery.js';

let relay: RelayServer | null = null;
let discovery: Discovery | null = null;
let browsing = false;
let peerHandler: ((type: 'up' | 'down', peer: DiscoveredPeer) => void) | null = null;

/** True if nothing is listening on `port` (0.0.0.0). */
export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '0.0.0.0');
  });
}

/** Start the relay + mDNS advertisement. */
export function startRelay(port: number): void {
  relay = new RelayServer(port);
  relay.start();
  try {
    if (!discovery) discovery = new Discovery();
    discovery.advertise(port);
  } catch (err) {
    console.error('[PeerEdit] mDNS advertise unavailable:', err);
  }
}

/** Stop the relay + mDNS advertisement. */
export function stopRelay(): void {
  try {
    relay?.stop();
  } catch (err) {
    console.error('[PeerEdit] relay stop error:', err);
  }
  try {
    discovery?.destroy();
  } catch (err) {
    console.error('[PeerEdit] discovery stop error:', err);
  }
  relay = null;
  discovery = null;
  browsing = false;
  peerHandler = null;
}

/** All non-internal IPv4 addresses of this machine (used to filter "self"
 *  out of the peer list, so we don't list our own relay as a remote peer). */
export function getLocalAddresses(): string[] {
  const addrs: string[] = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) addrs.push(iface.address);
    }
  }
  return addrs;
}

/** Begin browsing the LAN for other PeerEdit relays via mDNS. Events are
 *  forwarded to `handler` as `('up' | 'down', peer)`. Safe to call once. */
export function startDiscovery(handler: (type: 'up' | 'down', peer: DiscoveredPeer) => void): void {
  peerHandler = handler;
  if (browsing) return;
  try {
    if (!discovery) discovery = new Discovery();
    discovery.on('peerUp', (peer: DiscoveredPeer) => peerHandler?.('up', peer));
    discovery.on('peerDown', (peer: DiscoveredPeer) => peerHandler?.('down', peer));
    discovery.startBrowsing();
    browsing = true;
  } catch (err) {
    console.error('[PeerEdit] mDNS browse unavailable:', err);
  }
}

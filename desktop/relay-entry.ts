// Thin bridge between the Electron main process and the relay server sources.
// Bundled by esbuild (desktop/build.mjs) into desktop/bundle/relay.cjs.

import net from 'node:net';
import { RelayServer } from '../relay-server/src/RelayServer.js';
import { Discovery } from '../relay-server/src/Discovery.js';

let relay: RelayServer | null = null;
let discovery: Discovery | null = null;

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
    discovery = new Discovery();
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
}

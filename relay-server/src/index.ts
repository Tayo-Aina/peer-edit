import { RelayServer } from './RelayServer.js';
import { Discovery } from './Discovery.js';

const WS_PORT = parseInt(process.env.PEEREDIT_PORT ?? '9876', 10);
const AUTO_START = process.env.PEEREDIT_AUTO !== 'false';

async function main() {
  const discovery = new Discovery();

  if (AUTO_START) {
    // Start the relay server and advertise via mDNS
    const relay = new RelayServer(WS_PORT);
    relay.start();
    discovery.advertise(WS_PORT);

    console.log(`\n=== PeerEdit Relay ===`);
    console.log(`WebSocket:  ws://localhost:${WS_PORT}`);
    console.log(`mDNS:       advertising as "_peeredit._tcp"\n`);

    // Graceful shutdown
    const shutdown = () => {
      console.log('\nShutting down...');
      relay.stop();
      discovery.destroy();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } else {
    // Browse-only mode (client that found an existing relay)
    console.log('[Relay] Browse-only mode — scanning for existing relays...');
    discovery.startBrowsing();
    discovery.on('peerUp', (peer) => {
      console.log(`Found relay: ${peer.name} at ${peer.address}:${peer.port}`);
    });
  }
}

main().catch(console.error);

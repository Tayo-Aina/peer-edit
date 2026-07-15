import { Bonjour } from 'bonjour-service';

const SERVICE_TYPE = 'peeredit';
const PROTOCOL = 'tcp';
const SERVICE_NAME = 'PeerEdit Relay';

export interface DiscoveredPeer {
  address: string;
  port: number;
  name: string;
}

interface DiscoveryEvents {
  peerUp: DiscoveredPeer;
  peerDown: DiscoveredPeer;
}

interface BonjourService {
  addresses?: string[];
  host?: string;
  port: number;
  name: string;
  stop?: () => void;
}

type EventHandler = (payload: any) => void;

export class Discovery {
  private bonjour: InstanceType<typeof Bonjour>;
  private service: any = null;
  private browser: any = null;
  private listeners: Map<keyof DiscoveryEvents, Set<EventHandler>> = new Map();

  constructor() {
    this.bonjour = new Bonjour();
  }

  /** Advertise this peer as the relay on port 'wsPort'. */
  advertise(wsPort: number, hostname?: string): void {
    this.service = this.bonjour.publish({
      name: SERVICE_NAME,
      type: SERVICE_TYPE,
      protocol: PROTOCOL,
      port: wsPort,
      host: hostname,
      txt: { version: '1' },
    });
    console.log(`[Discovery] Advertising relay on port ${wsPort}`);
  }

  /** Start browsing for relay peers on the LAN. */
  startBrowsing(): void {
    this.browser = this.bonjour.find({ type: SERVICE_TYPE, protocol: PROTOCOL });
    this.browser.on('up', (service: BonjourService) => {
      const peer: DiscoveredPeer = {
        address: service.addresses?.[0] ?? service.host ?? 'unknown',
        port: service.port,
        name: service.name,
      };
      this.emit('peerUp', peer);
    });
    this.browser.on('down', (service: BonjourService) => {
      const peer: DiscoveredPeer = {
        address: service.addresses?.[0] ?? service.host ?? 'unknown',
        port: service.port,
        name: service.name,
      };
      this.emit('peerDown', peer);
    });
    console.log('[Discovery] Browsing for peers...');
  }

  on<K extends keyof DiscoveryEvents>(event: K, handler: (payload: DiscoveryEvents[K]) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }

  private emit<K extends keyof DiscoveryEvents>(event: K, payload: DiscoveryEvents[K]): void {
    this.listeners.get(event)?.forEach(handler => handler(payload));
  }

  destroy(): void {
    this.service?.stop();
    this.browser?.stop();
    this.bonjour.destroy();
  }
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { getElectronBridge, RawPeer } from '../utils/electronBridge';

const RELAY_PORT = 9876;

export interface DiscoveredPeer {
  address: string;
  port: number;
  name?: string;
}

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

function keyOf(peer: { address: string; port: number }): string {
  return `${peer.address}:${peer.port}`;
}

function isSelf(address: string, selfAddresses: Set<string>): boolean {
  return LOOPBACK.has(address) || selfAddresses.has(address);
}

function toEntries(list: DiscoveredPeer[]): [string, DiscoveredPeer][] {
  return list.map((peer) => [keyOf(peer), peer]);
}

// Best-effort discovery for plain-browser dev mode (no Electron bridge). This
// checks the last saved relay, probes a small slice of the local subnet, and
// always offers localhost. Real LAN discovery happens via mDNS in Electron.
function getLocalSubnet(): string | null {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return null;
  const parts = host.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}`;
  return null;
}

async function scanBrowser(): Promise<DiscoveredPeer[]> {
  const found: DiscoveredPeer[] = [];

  const saved = localStorage.getItem('peeredit-last-relay');
  if (saved) {
    try {
      const { address, port } = JSON.parse(saved);
      found.push({ address, port, name: `${address}:${port} (saved)` });
    } catch {
      /* ignore corrupt localStorage entry */
    }
  }

  const subnet = getLocalSubnet();
  if (subnet) {
    const candidates = [1, ...Array.from({ length: 15 }, (_, i) => i + 100)];
    await Promise.allSettled(
      candidates.map(async (host) => {
        const addr = `${subnet}.${host}`;
        const url = `ws://${addr}:${RELAY_PORT}`;
        try {
          const ws = new WebSocket(url);
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
              ws.close();
              reject(new Error('timeout'));
            }, 600);
            ws.onopen = () => {
              clearTimeout(timer);
              ws.close();
              resolve();
            };
            ws.onerror = () => {
              clearTimeout(timer);
              reject(new Error('no connection'));
            };
          });
          found.push({ address: addr, port: RELAY_PORT, name: `${addr}:${RELAY_PORT}` });
        } catch {
          /* host not reachable */
        }
      })
    );
  }

  found.push({ address: 'localhost', port: RELAY_PORT, name: `localhost:${RELAY_PORT}` });

  const seen = new Set<string>();
  return found.filter((peer) => {
    const key = keyOf(peer);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function usePeerDiscovery() {
  const [peers, setPeers] = useState<DiscoveredPeer[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selfAddresses, setSelfAddresses] = useState<string[]>([]);

  const knownRef = useRef(new Map<string, DiscoveredPeer>());
  const selfRef = useRef(new Set<string>());

  const refresh = useCallback(() => {
    const filtered = Array.from(knownRef.current.values()).filter(
      (peer) => !isSelf(peer.address, selfRef.current)
    );
    setPeers(filtered);
  }, []);

  useEffect(() => {
    const bridge = getElectronBridge();

    if (!bridge) {
      // Plain browser (dev mode): one-shot best-effort scan.
      let cancelled = false;
      setScanning(true);
      scanBrowser()
        .then((found) => {
          if (cancelled) return;
          knownRef.current = new Map(toEntries(found));
          selfRef.current = new Set();
          setSelfAddresses([]);
          refresh();
        })
        .finally(() => {
          if (!cancelled) setScanning(false);
        });
      return () => {
        cancelled = true;
      };
    }

    // Electron: subscribe to continuous mDNS discovery.
    setScanning(true);
    const offUp = bridge.onPeerUp((peer: RawPeer) => {
      knownRef.current.set(keyOf(peer), peer);
      refresh();
    });
    const offDown = bridge.onPeerDown((peer: RawPeer) => {
      knownRef.current.delete(keyOf(peer));
      refresh();
    });

    let disposed = false;
    (async () => {
      try {
        const [list, addrs] = await Promise.all([bridge.listPeers(), bridge.getLocalAddresses()]);
        if (disposed) return;
        selfRef.current = new Set(addrs);
        setSelfAddresses(addrs);
        list.forEach((peer) => knownRef.current.set(keyOf(peer), peer));
        refresh();
      } finally {
        if (!disposed) setScanning(false);
      }
    })();

    return () => {
      disposed = true;
      offUp();
      offDown();
    };
  }, [refresh]);

  const rescan = useCallback(async () => {
    const bridge = getElectronBridge();
    setScanning(true);
    try {
      if (bridge) {
        const [list, addrs] = await Promise.all([bridge.listPeers(), bridge.getLocalAddresses()]);
        selfRef.current = new Set(addrs);
        setSelfAddresses(addrs);
        list.forEach((peer) => knownRef.current.set(keyOf(peer), peer));
      } else {
        const found = await scanBrowser();
        knownRef.current = new Map(toEntries(found));
      }
      refresh();
    } finally {
      setScanning(false);
    }
  }, [refresh]);

  const saveRelay = useCallback((address: string, port: number) => {
    localStorage.setItem('peeredit-last-relay', JSON.stringify({ address, port }));
  }, []);

  return { peers, scanning, selfAddresses, rescan, saveRelay };
}

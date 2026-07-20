import { useState, useEffect, useCallback } from 'react';

const RELAY_PORT = 9876;

export interface DiscoveredPeer {
  address: string;
  port: number;
  label: string;
}

function getLocalSubnet(): string | null {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return null;
  const parts = host.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  return null;
}

export function usePeerDiscovery() {
  const [peers, setPeers] = useState<DiscoveredPeer[]>([]);
  const [scanning, setScanning] = useState(false);

  const scan = useCallback(async () => {
    setScanning(true);
    const found: DiscoveredPeer[] = [];

    // Strategy 1: Check localStorage for last connected relay
    const saved = localStorage.getItem('peeredit-last-relay');
    if (saved) {
      try {
        const { address, port } = JSON.parse(saved);
        found.push({ address, port, label: `${address}:${port} (saved)` });
      } catch {
        /* ignore corrupt localStorage entry */
      }
    }


    // Strategy 2: Scan local subnet
    const subnet = getLocalSubnet();
    if (subnet) {
      const candidates = [1, ...Array.from({ length: 15 }, (_, i) => i + 100)];
      const promises = candidates.map(async (host) => {
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
          found.push({ address: addr, port: RELAY_PORT, label: `${addr}:${RELAY_PORT}` });
        } catch {
          /* host not reachable */
        }
      });
      await Promise.allSettled(promises);
    }

    // Strategy 3: Always include localhost
    found.push({ address: 'localhost', port: RELAY_PORT, label: `localhost:${RELAY_PORT}` });

    setPeers(found);
    setScanning(false);
  }, []);

  useEffect(() => {
    scan();
  }, [scan]);

  const saveRelay = useCallback((address: string, port: number) => {
    localStorage.setItem('peeredit-last-relay', JSON.stringify({ address, port }));
  }, []);

  return { peers, scanning, rescan: scan, saveRelay };
}

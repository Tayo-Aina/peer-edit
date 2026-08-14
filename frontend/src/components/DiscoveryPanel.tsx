import React, { useState } from 'react';
import { usePeerDiscovery, DiscoveredPeer } from '../hooks/usePeerDiscovery';

interface DiscoveryPanelProps {
  onConnect: (url: string) => void;
  connected: boolean;
}

function labelFor(peer: DiscoveredPeer): string {
  return peer.name ?? `${peer.address}:${peer.port}`;
}

export function DiscoveryPanel({ onConnect, connected }: DiscoveryPanelProps) {
  const { peers, scanning, selfAddresses, rescan, saveRelay } = usePeerDiscovery();
  const [manualIp, setManualIp] = useState('');
  const [manualPort, setManualPort] = useState('9876');

  const handleManualConnect = () => {
    const address = manualIp.trim() || 'localhost';
    const port = parseInt(manualPort, 10) || 9876;
    const url = `ws://${address}:${port}`;
    saveRelay(address, port);
    onConnect(url);
  };

  const handlePeerClick = (peer: DiscoveredPeer) => {
    const url = `ws://${peer.address}:${peer.port}`;
    saveRelay(peer.address, peer.port);
    onConnect(url);
  };

  if (connected) return null;

  return (
    <div className="discovery-overlay">
      <div className="discovery-panel">
        <div className="discovery-header">
          <h1>PeerEdit</h1>
          <p className="discovery-subtitle">Collaborative Rich Text Editor</p>
        </div>

        <section className="discovery-section">
          <h2>Peers on your network</h2>
          <button className="btn btn-secondary" onClick={rescan} disabled={scanning}>
            {scanning ? 'Scanning…' : '🔄 Refresh'}
          </button>
          {peers.length === 0 && !scanning && (
            <p className="discovery-empty">
              No peers found. Make sure other PeerEdit instances are running on this network.
            </p>
          )}
          <ul className="peer-list">
            {peers.map((peer) => (
              <li key={`${peer.address}:${peer.port}`} className="peer-item">
                <span className="peer-label">{labelFor(peer)}</span>
                <button className="btn" onClick={() => handlePeerClick(peer)}>
                  Connect
                </button>
              </li>
            ))}
          </ul>
          {selfAddresses.length > 0 && (
            <p className="discovery-self">
              This device: {selfAddresses.join(', ')} — share an address so others can join you.
            </p>
          )}
        </section>

        <section className="discovery-section">
          <h2>Manual Connect</h2>
          <div className="manual-form">
            <input
              type="text"
              placeholder="IP Address (e.g. 192.168.1.5)"
              value={manualIp}
              onChange={(e) => setManualIp(e.target.value)}
            />
            <input
              type="number"
              placeholder="Port"
              value={manualPort}
              onChange={(e) => setManualPort(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleManualConnect}>
              Connect
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import { Awareness } from 'y-protocols/awareness';

interface RelayDoc {
  doc: Y.Doc;
  awareness: Awareness;
  clients: Map<WebSocket, boolean>;
}

const messageSync = 0;
const messageAwareness = 1;
const messageAuth = 2;
const messageQueryAwareness = 3;

export class RelayServer {
  private wss: WebSocketServer;
  private docs: Map<string, RelayDoc> = new Map();
  public port: number;

  constructor(port: number) {
    this.port = port;
    this.wss = new WebSocketServer({ port, host: '0.0.0.0' });
  }

  start(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
      const roomName = url.pathname.slice(1).split('?')[0] || 'default';

      let relayDoc = this.docs.get(roomName);
      if (!relayDoc) {
        const doc = new Y.Doc();
        const awareness = new Awareness(doc);
        relayDoc = { doc, awareness, clients: new Map() };
        this.docs.set(roomName, relayDoc);

        doc.on('update', (update: Uint8Array, origin: any) => {
          const enc = encoding.createEncoder();
          encoding.writeVarUint(enc, messageSync);
          syncProtocol.writeUpdate(enc, update);
          const msg = encoding.toUint8Array(enc);
          relayDoc!.clients.forEach((_, client) => {
            if (client !== origin && client.readyState === WebSocket.OPEN) {
              client.send(msg);
            }
          });
        });

        awareness.on('update', ({ added, updated, removed }: any, origin: any) => {
          const changedClients = ([] as number[]).concat(added, updated, removed);
          const enc = encoding.createEncoder();
          encoding.writeVarUint(enc, messageAwareness);
          encoding.writeVarUint8Array(
            enc,
            awarenessProtocol.encodeAwarenessUpdate(relayDoc!.awareness, changedClients)
          );
          const msg = encoding.toUint8Array(enc);
          relayDoc!.clients.forEach((_, client) => {
            if (client !== origin && client.readyState === WebSocket.OPEN) {
              client.send(msg);
            }
          });
        });
      }

      relayDoc.clients.set(ws, true);
      console.log(
        `[Relay] Client connected to room "${roomName}" (total: ${relayDoc.clients.size})`
      );

      // Send sync step 1 + existing awareness state immediately to new client
      {
        const enc = encoding.createEncoder();
        encoding.writeVarUint(enc, messageSync);
        syncProtocol.writeSyncStep1(enc, relayDoc.doc);
        ws.send(encoding.toUint8Array(enc));

        const awarenessStates = relayDoc.awareness.getStates();
        if (awarenessStates.size > 0) {
          const awEnc = encoding.createEncoder();
          encoding.writeVarUint(awEnc, messageAwareness);
          encoding.writeVarUint8Array(
            awEnc,
            awarenessProtocol.encodeAwarenessUpdate(
              relayDoc.awareness,
              Array.from(awarenessStates.keys())
            )
          );
          ws.send(encoding.toUint8Array(awEnc));
        }
      }

      // Handle incoming messages — wrap in try/catch so one bad message
      // doesn't kill the connection handler
      ws.on('message', (rawData: Buffer) => {
        try {
          const data = new Uint8Array(rawData);
          const decoder = decoding.createDecoder(data);
          const encoder = encoding.createEncoder();
          const messageType = decoding.readVarUint(decoder);

          switch (messageType) {
            case messageSync: {
              encoding.writeVarUint(encoder, messageSync);
              syncProtocol.readSyncMessage(decoder, encoder, relayDoc!.doc, ws);
              if (encoding.length(encoder) > 1) {
                ws.send(encoding.toUint8Array(encoder));
              }
              break;
            }
            case messageAwareness: {
              awarenessProtocol.applyAwarenessUpdate(
                relayDoc!.awareness,
                decoding.readVarUint8Array(decoder),
                ws
              );
              break;
            }
            case messageQueryAwareness: {
              encoding.writeVarUint(encoder, messageAwareness);
              encoding.writeVarUint8Array(
                encoder,
                awarenessProtocol.encodeAwarenessUpdate(
                  relayDoc!.awareness,
                  Array.from(relayDoc!.awareness.getStates().keys())
                )
              );
              ws.send(encoding.toUint8Array(encoder));
              break;
            }
            case messageAuth: {
              // auth messages — acknowledge and move on
              break;
            }
          }
        } catch (err: any) {
          console.error(`[Relay] Message handler error:`, err.message);
        }
      });

      // Keepalive: ping every 15s to prevent y-websocket's 30s idle timeout
      // from killing the connection
      let isAlive = true;
      ws.on('pong', () => { isAlive = true; });
      const pingTimer = setInterval(() => {
        if (!isAlive) {
          clearInterval(pingTimer);
          ws.terminate();
          return;
        }
        isAlive = false;
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 15000);

      ws.on('close', () => {
        clearInterval(pingTimer);
        if (relayDoc) {
          relayDoc.clients.delete(ws);
          console.log(
            `[Relay] Client left room "${roomName}" (remaining: ${relayDoc.clients.size})`
          );
          if (relayDoc.clients.size === 0) {
            relayDoc.doc.destroy();
            this.docs.delete(roomName);
          }
        }
      });

      ws.on('error', (err) => {
        clearInterval(pingTimer);
        console.error(`[Relay] WebSocket error:`, err.message);
      });
    });

    console.log(`[Relay] WebSocket relay running on ws://0.0.0.0:${this.port}`);
  }

  stop(): void {
    this.docs.forEach((relayDoc) => relayDoc.doc.destroy());
    this.docs.clear();
    this.wss.close();
  }
}

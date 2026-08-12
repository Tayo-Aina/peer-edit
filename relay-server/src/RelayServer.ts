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
  /** clientIDs each WebSocket has contributed to awareness (for cleanup on close). */
  awarenessClients: Map<WebSocket, Set<number>>;
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
    // Don't crash the whole process if the port is taken or the socket errors.
    this.wss.on('error', (err: Error) => {
      console.error(`[Relay] WebSocket server error:`, err.message);
    });
  }

  start(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
      const roomName = url.pathname.slice(1).split('?')[0] || 'default';

      let relayDoc = this.docs.get(roomName);
      if (!relayDoc) {
        const doc = new Y.Doc();
        const awareness = new Awareness(doc);
        // The Awareness constructor seeds a local `{}` state. The relay must
        // NOT appear as an anonymous "Unknown" user in every room, so drop it.
        awareness.setLocalState(null);
        relayDoc = { doc, awareness, clients: new Map(), awarenessClients: new Map() };
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
          // Track which clientIDs came from each socket so they can be removed
          // immediately when that socket closes (no ghost "unknown" users).
          if (origin instanceof WebSocket) {
            let ids = relayDoc!.awarenessClients.get(origin);
            if (!ids) {
              ids = new Set<number>();
              relayDoc!.awarenessClients.set(origin, ids);
            }
            (added || []).forEach((id: number) => ids!.add(id));
            (removed || []).forEach((id: number) => ids!.delete(id));
          }
          // Cursor movements update awareness on every mousemove; only log
          // meaningful changes (a user joining/leaving) to avoid log spam.
          if ((added || []).length > 0 || (removed || []).length > 0) {
            console.log(
              `[Relay] awareness ${roomName}: +${(added || []).length} -${(removed || []).length} (${relayDoc!.clients.size} clients)`
            );
          }
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
          // Remove this socket's awareness states immediately so other clients
          // don't keep seeing a stale/nameless user.
          const ids = relayDoc.awarenessClients.get(ws);
          if (ids && ids.size > 0) {
            awarenessProtocol.removeAwarenessStates(
              relayDoc.awareness,
              Array.from(ids),
              null
            );
            console.log(`[Relay] awareness cleanup: removed ${ids.size} ids for closed ws`);
          }
          relayDoc.awarenessClients.delete(ws);
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

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
  clients: Set<WebSocket>;
}

// y-websocket message type constants
const messageSync = 0;
const messageAwareness = 1;
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
      const roomName = url.searchParams.get('room') ?? 'default';

      // Get or create shared doc + awareness for this room
      let relayDoc = this.docs.get(roomName);
      if (!relayDoc) {
        const doc = new Y.Doc();
        const awareness = new Awareness(doc);
        relayDoc = { doc, awareness, clients: new Set() };
        this.docs.set(roomName, relayDoc);

        // Broadcast document updates to all OTHER clients
        doc.on('update', (update: Uint8Array, origin: any) => {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageSync);
          syncProtocol.writeUpdate(encoder, update);
          const message = encoding.toUint8Array(encoder);
          relayDoc!.clients.forEach((client) => {
            if (client !== origin && client.readyState === WebSocket.OPEN) {
              client.send(message);
            }
          });
        });

        // Broadcast awareness changes to all OTHER clients
        awareness.on('update', ({ added, updated, removed }: any, origin: any) => {
          const changedClients = added.concat(updated).concat(removed);
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageAwareness);
          encoding.writeVarUint8Array(
            encoder,
            awarenessProtocol.encodeAwarenessUpdate(relayDoc!.awareness, changedClients)
          );
          const message = encoding.toUint8Array(encoder);
          relayDoc!.clients.forEach((client) => {
            if (client !== origin && client.readyState === WebSocket.OPEN) {
              client.send(message);
            }
          });
        });
      }

      relayDoc.clients.add(ws);
      console.log(`[Relay] Client connected to room "${roomName}" (total: ${relayDoc.clients.size})`);

      // Handle messages from this client
      ws.on('message', (rawData: Buffer) => {
        const data = new Uint8Array(rawData);
        const decoder = decoding.createDecoder(data);
        const encoder = encoding.createEncoder();
        const messageType = decoding.readVarUint(decoder);

        switch (messageType) {
          case messageSync: {
            // Sync protocol: handles sync step 1, step 2, and document updates internally.
            // readSyncMessage reads the sub-type, processes it, and writes any response.
            // We pass ws as the origin so we can filter it in the 'update' broadcast above.
            encoding.writeVarUint(encoder, messageSync);
            syncProtocol.readSyncMessage(decoder, encoder, relayDoc!.doc, ws);
            // Send response back to this client only if there's data beyond the message type
            if (encoding.length(encoder) > 1) {
              ws.send(encoding.toUint8Array(encoder));
            }
            break;
          }
          case messageAwareness: {
            // Apply the awareness update to the shared awareness state
            awarenessProtocol.applyAwarenessUpdate(
              relayDoc!.awareness,
              decoding.readVarUint8Array(decoder),
              ws // origin so we don't echo back
            );
            break;
          }
          case messageQueryAwareness: {
            // Client is asking for the current awareness state
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
        }
      });

      ws.on('close', () => {
        relayDoc?.clients.delete(ws);
        console.log(
          `[Relay] Client left room "${roomName}" (remaining: ${relayDoc?.clients.size})`
        );
        if (relayDoc && relayDoc.clients.size === 0) {
          relayDoc.doc.destroy();
          this.docs.delete(roomName);
        }
      });

      ws.on('error', (err) => {
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

# PeerEdit

A collaborative text editor that runs on your local network. No internet needed, no accounts, no cloud server. You and whoever else is on the same Wi-Fi can type in the same document at the same time.

## What it does

- Rich text editing: bold, italic, underline, strikethrough, headings, bullet and numbered lists, checkboxes, code blocks, quotes, text alignment, highlight, links
- Live cursors: you can see where everyone else is typing and who they are
- Export your doc as HTML or plain text
- Automatic peer discovery: the app scans the network and shows you who else is running PeerEdit
- Manual connect: type in an IP and port if discovery is blocked

## How it works

Every time you open PeerEdit, it starts a small relay server on your machine and advertises itself over mDNS. When you open the app, it browses the network for other PeerEdit instances. Click one and you're instantly editing the same document together.

There's no central server. The "network" is just whoever is running the app around you. That's the whole point.

## Running it

1. Launch `PeerEdit.exe`
2. Wait for the scan to find peers on your network
3. Click Connect on whoever you want to join
4. Start typing

If nobody shows up, make sure the other person actually has PeerEdit running. On the same machine you can open a second window to test it, both windows edit the same doc.

### Manual connect

Some routers and firewalls block mDNS, so automatic discovery won't find anything. If that happens, use the Manual Connect box and enter the other machine's IP and port (default is 9876).

### Options menu

While connected you'll see a gear icon in the top right. It lets you:

- Search for another network (drops the current connection and scans again)
- Disconnect from the network

## Running from source

You need Node.js. From the project root:

```bash
npm install
npm run dev
```

That starts the relay server and the frontend together.

- `npm run relay` starts just the relay
- `npm run app` starts just the frontend (Vite dev server)

## Building the exe

```bash
node desktop/build.mjs
```

or just double-click `build-exe.bat`. The build produces a self-contained `PeerEdit.exe` and copies it to the folder above the repo.

## Tech stack

- Electron (desktop shell)
- React + Vite + TypeScript (frontend)
- TipTap (editor)
- Yjs + y-websocket (collaboration sync)
- bonjour-service (mDNS discovery)
- ws (WebSocket relay)

## Project layout

```
relay-server/   the WebSocket relay that syncs documents between clients
frontend/       the editor UI
desktop/        Electron shell, preload bridge, packaging
```

## Troubleshooting

**Peers don't show up**

- Check that the other machine is on the same network
- Check your firewall and router AP isolation, both kill mDNS
- Use Manual Connect instead, it always works if the port is reachable

**Port 9876 is already in use**

- Something else is holding the port. Close it or change the `PEEREDIT_PORT` env var.

**Docs are out of sync**

- This is a peer-to-peer app, there's no server to reconcile things. Make sure everyone connects to the same relay before typing.

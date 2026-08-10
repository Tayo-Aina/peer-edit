// PeerEdit desktop shell (Electron main process)
//
// Starts the bundled relay (ws://0.0.0.0:9876), serves the built frontend
// over HTTP (http://0.0.0.0:5173, auto-increments if busy) and opens the
// editor in its own window. LAN peers can join via their browser.
//
// Second-instance handling: the Electron single-instance lock is unreliable
// for portable exes, so a second launch is detected with BOTH the lock AND a
// direct HTTP probe of the running instance's control endpoint. Whichever way
// a second launch is detected, the running instance is asked to show a prompt
// ("open another window?") and the second process quits immediately.

const { app, BrowserWindow, dialog } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const { startRelay, stopRelay, isPortFree } = require('./bundle/relay.cjs');

// A text editor doesn't need GPU acceleration, and disabling it avoids
// renderer crashes on machines/VMs with flaky GPU drivers.
app.disableHardwareAcceleration();

const WS_PORT = parseInt(process.env.PEEREDIT_PORT || '9876', 10);
const HTTP_START_PORT = parseInt(process.env.PEEREDIT_HTTP_PORT || '5173', 10);
const DIST_DIR = path.join(__dirname, 'bundle', 'frontend-dist');
// Test hooks: auto-open a new window instead of showing the prompt, and
// auto-connect the first window (simulates clicking "Connect").
const AUTO_SECOND = process.env.PEEREDIT_AUTO_SECOND === '1';
const AUTO_CONNECT = process.env.PEEREDIT_AUTO_CONNECT === '1';
// Optional debug log file (Electron GUI apps can't be relied on for stdout).
const DEBUG_LOG = process.env.PEEREDIT_DEBUG_LOG;
function dbg(...args) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${args.join(' ')}`;
  if (DEBUG_LOG) {
    try {
      fs.appendFileSync(DEBUG_LOG, line + '\n');
    } catch {}
  }
  console.log(line);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

let windows = [];
let httpServer = null;
let promptOpen = false;
let secondLaunchInProgress = false;
let windowCounter = 1; // the first window (created directly by main) counts as #1

// ---------------------------------------------------------------------------
// HTTP: static frontend + tiny control endpoints
// ---------------------------------------------------------------------------

function startStaticServer(dir, startPort) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath;
      try {
        urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      } catch {
        res.writeHead(400);
        res.end('Bad request');
        return;
      }
      dbg(`http ${req.method} ${req.url} -> ${urlPath}`);

      // Control endpoints used to detect/hand off between instances.
      if (urlPath === '/__peeredit/ping') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        return;
      }
      if (urlPath === '/__peeredit/instance-request') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('queued');
        handleSecondLaunch(); // async; do not block the response
        return;
      }

      if (urlPath === '/') urlPath = '/index.html';

      const safePath = path
        .normalize(urlPath)
        .replace(/^(\.\.[/\\])+/, '')
        .replace(/^([/\\])/, '');
      const filePath = path.join(dir, safePath);

      fs.readFile(filePath, (err, data) => {
        if (!err) {
          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Cache-Control': 'no-cache',
          });
          res.end(data);
          return;
        }
        if (!path.extname(urlPath)) {
          fs.readFile(path.join(dir, 'index.html'), (err2, data2) => {
            if (err2) {
              res.writeHead(404);
              res.end('Not found');
              return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data2);
          });
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });
    });

    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE' && startPort < 65535) {
        server.close();
        resolve(startStaticServer(dir, startPort + 1));
      } else {
        reject(err);
      }
    });

    server.listen(startPort, '0.0.0.0', () => resolve(server));
  });
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

function createWindow(instanceLabel) {
  const port = httpServer ? httpServer.address().port : HTTP_START_PORT;
  let url = `http://127.0.0.1:${port}`;
  if (instanceLabel || AUTO_CONNECT) {
    const label = instanceLabel || '1';
    url += `/?instance=${label}&relay=${encodeURIComponent(`ws://127.0.0.1:${WS_PORT}`)}`;
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: instanceLabel ? `PeerEdit (${instanceLabel})` : 'PeerEdit',
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // NOTE: sandbox:false — with this portable app running from a temp
      // extraction dir, the Windows AppContainer sandbox fails to spawn a
      // SECOND renderer (render-process-gone "launch-failed", exit 65),
      // leaving window 2+ as a blank blue screen. The renderer still has no
      // Node access (contextIsolation + nodeIntegration:false) and only loads
      // our own local content, so this is safe here.
      sandbox: false,
    },
  });
  windows.push(win);
  win.loadURL(url);
  win.on('closed', () => {
    windows = windows.filter((w) => w !== win);
  });
  // Forward renderer diagnostics (also to the debug log when enabled).
  win.webContents.on('console-message', (_e, _level, message) => {
    dbg(`[renderer${instanceLabel ? ' ' + instanceLabel : ''}] ${message}`);
  });
  win.webContents.on('did-fail-load', (_e, code, desc, failedUrl) => {
    dbg(`[renderer${instanceLabel ? ' ' + instanceLabel : ''}] did-fail-load ${code} ${desc} ${failedUrl}`);
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    dbg(`[renderer${instanceLabel ? ' ' + instanceLabel : ''}] render-process-gone ${JSON.stringify(details)}`);
  });
  win.webContents.on('did-finish-load', async () => {
    dbg(`[renderer${instanceLabel ? ' ' + instanceLabel : ''}] did-finish-load`);
    const snapshot = async (tag) => {
      try {
        const info = await win.webContents.executeJavaScript(`({
          url: window.location.href,
          readyState: document.readyState,
          title: document.title,
          rootChildren: (document.getElementById('root') ? document.getElementById('root').childElementCount : -1),
          rootText: (document.getElementById('root') ? document.getElementById('root').innerText.slice(0, 300) : ''),
          bodyHtmlHead: document.body.innerHTML.slice(0, 600),
          cssInDom: document.documentElement.outerHTML.includes('.ProseMirror { position: relative'),
          styleTags: document.querySelectorAll('style').length,
          hasEditor: !!document.querySelector('.ProseMirror'),
          editorText: (document.querySelector('.ProseMirror') ? document.querySelector('.ProseMirror').innerText.slice(0, 200) : '')
        })`);
        dbg(`[renderer${instanceLabel ? ' ' + instanceLabel : ''}] page-state(${tag}) ${JSON.stringify(info)}`);
      } catch (e) {
        dbg(`[renderer${instanceLabel ? ' ' + instanceLabel : ''}] page-state(${tag}) error ${String(e)}`);
      }
    };
    await snapshot('load');
    setTimeout(() => snapshot('6s'), 6000);
    setTimeout(() => snapshot('15s'), 15000);
  });
  dbg(`createWindow label=${instanceLabel || '1'} url=${url}`);
  return win;
}

/** Open a new editor window (the first window has no label; later ones get "2", "3", ...). */
function openWindow() {
  windowCounter += 1;
  createWindow(windowCounter > 1 ? String(windowCounter) : null);
}

// ---------------------------------------------------------------------------
// Second-instance handling
// ---------------------------------------------------------------------------

/** Ask the user whether to open another editor window on this machine. */
async function handleSecondLaunch() {
  // A single second launch can arrive through BOTH the 'second-instance'
  // event and the HTTP control endpoint — only act on the first.
  if (secondLaunchInProgress) return;
  secondLaunchInProgress = true;
  dbg('handleSecondLaunch called (auto=' + AUTO_SECOND + ')');
  try {
    if (AUTO_SECOND) {
      dbg('auto-second: opening window');
      openWindow();
      return;
    }
    const parent = windows[0] || null;
    const { response } = await dialog.showMessageBox(parent, {
      type: 'question',
      title: 'PeerEdit',
      message: 'PeerEdit is already running',
      detail: 'Open another editor window on this machine? Both windows edit the same document together.',
      buttons: ['Open another window', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    dbg('prompt response=' + response);
    if (response === 0) {
      openWindow();
    } else if (windows.length) {
      const w = windows[0];
      if (w.isMinimized()) w.restore();
      w.focus();
    }
  } finally {
    secondLaunchInProgress = false;
    promptOpen = false;
  }
}

async function fetchWithTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function pingExisting(port) {
  try {
    const res = await fetchWithTimeout(`http://127.0.0.1:${port}/__peeredit/ping`, {}, 800);
    return res.ok;
  } catch {
    return false;
  }
}

/** Tell the running instance (on `port`) to open another window. */
async function requestNewInstance(port) {
  try {
    await fetchWithTimeout(
      `http://127.0.0.1:${port}/__peeredit/instance-request`,
      { method: 'POST' },
      1500
    );
    return true;
  } catch {
    return false;
  }
}

/** Probe the default HTTP port (and its fallbacks) for a running instance. */
async function signalExistingInstance() {
  for (let p = HTTP_START_PORT; p < HTTP_START_PORT + 5; p++) {
    if (await pingExisting(p)) {
      await requestNewInstance(p);
      return true;
    }
  }
  return false;
}

/** Keep trying for a few seconds (handles the race where the other instance is still starting). */
async function waitForAndSignalInstance() {
  for (let i = 0; i < 10; i++) {
    if (await signalExistingInstance()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function main() {
  dbg('main() starting');
  try {
    // Another instance's UI may already be reachable (e.g. we lost the lock race).
    if (await signalExistingInstance()) {
      dbg('another instance reachable — quitting');
      app.quit();
      return;
    }

    const free = await isPortFree(WS_PORT);
    dbg('isPortFree(' + WS_PORT + ')=' + free);
    if (!free) {
      // Port busy: either another PeerEdit is coming up (hand over to it) or an
      // unrelated program holds the port (show an error).
      const signaled = await waitForAndSignalInstance();
      dbg('port busy; signaled other instance=' + signaled);
      if (!signaled) {
        dialog.showErrorBox(
          'PeerEdit',
          `Port ${WS_PORT} is already in use.\n\nClose the program using port ${WS_PORT} and try again.`
        );
      }
      app.quit();
      return;
    }

    startRelay(WS_PORT);
    httpServer = await startStaticServer(DIST_DIR, HTTP_START_PORT);
    const port = httpServer.address().port;

    dbg(`Relay: ws://0.0.0.0:${WS_PORT}; UI: http://0.0.0.0:${port}`);

    createWindow(null);
  } catch (err) {
    dbg('main() error: ' + String((err && err.message) || err));
    dialog.showErrorBox('PeerEdit failed to start', String((err && err.message) || err));
    app.quit();
  }
}

const gotLock = app.requestSingleInstanceLock();
dbg('single instance lock=' + gotLock);
if (!gotLock) {
  // Electron says another instance exists — hand off to it and quit.
  signalExistingInstance().catch(() => {});
  app.quit();
} else {
  app.on('second-instance', () => {
    dbg('second-instance event');
    handleSecondLaunch();
  });

  app.on('child-process-gone', (_e, details) => {
    dbg(`child-process-gone ${JSON.stringify(details)}`);
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('before-quit', () => {
    try {
      stopRelay();
    } catch {}
    if (httpServer) {
      try {
        httpServer.close();
      } catch {}
      if (httpServer.closeAllConnections) {
        try {
          httpServer.closeAllConnections();
        } catch {}
      }
    }
  });

  app.whenReady().then(main);
}

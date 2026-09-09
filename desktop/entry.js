// PeerEdit desktop shell: relay + static frontend + editor windows.
// Second launches are detected via single-instance lock AND HTTP probe;
// the running instance prompts to open another window, the duplicate quits.
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { startRelay, stopRelay, isPortFree, startDiscovery, getLocalAddresses } = require('./bundle/relay.cjs');
// File-based launch log: a double-clicked windowed exe has NO console, so every
// startup decision is also appended to %TEMP%\peeredit-launch.log for diagnosis.
const LAUNCH_LOG = path.join(process.env.TEMP || process.env.TMP || __dirname, 'peeredit-launch.log');
function plog(msg) {
  try { console.error(`[peeredit] ${msg}`); } catch {}
  try {
    try { if (fs.statSync(LAUNCH_LOG).size > 512 * 1024) fs.writeFileSync(LAUNCH_LOG, ''); } catch {}
    fs.appendFileSync(LAUNCH_LOG, `[${new Date().toISOString()}] [pid=${process.pid}] ${msg}\n`);
  } catch {}
}
plog(`entry.js loaded pid=${process.pid} (log file: ${LAUNCH_LOG})`);
app.disableHardwareAcceleration(); // text editor needs no GPU; avoids flaky-driver renderer crashes
const WS_PORT = parseInt(process.env.PEEREDIT_PORT || '9876', 10);
const HTTP_START_PORT = parseInt(process.env.PEEREDIT_HTTP_PORT || '5173', 10);
const DIST_DIR = path.join(__dirname, 'bundle', 'frontend-dist');
const PRELOAD = path.join(__dirname, 'preload.js');
const AUTO_SECOND = process.env.PEEREDIT_AUTO_SECOND === '1'; // test hook: skip prompt
const AUTO_CONNECT = process.env.PEEREDIT_AUTO_CONNECT === '1'; // test hook: auto-connect window 1
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
let windows = [], httpServer = null, secondLaunchInProgress = false, windowCounter = 1;
const knownPeers = new Map();
function broadcastPeer(type, peer) {
  if (type === 'up') knownPeers.set(`${peer.address}:${peer.port}`, peer);
  else knownPeers.delete(`${peer.address}:${peer.port}`);
  for (const w of windows) if (w.webContents && !w.webContents.isDestroyed()) w.webContents.send(`peeredit:peer-${type}`, peer);
}
ipcMain.handle('peeredit:discover:list', () => Array.from(knownPeers.values()));
ipcMain.handle('peeredit:local-addresses', () => getLocalAddresses());
function isLoopback(req) {
  const r = (req.socket && req.socket.remoteAddress) || '';
  return r === '127.0.0.1' || r === '::1' || r === '::ffff:127.0.0.1' || r === 'localhost';
}
function startStaticServer(dir, startPort) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath;
      try { urlPath = decodeURIComponent((req.url || '/').split('?')[0]); }
      catch { res.writeHead(400); res.end('Bad request'); return; }
      if (urlPath === '/__peeredit/ping') {
        if (!isLoopback(req)) { res.writeHead(403); res.end('Forbidden'); return; }
        res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return;
      }
      if (urlPath === '/__peeredit/instance-request') {
        if (!isLoopback(req)) { res.writeHead(403); res.end('Forbidden'); return; }
        res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('queued');
        handleSecondLaunch(); return;
      }
      if (urlPath === '/') urlPath = '/index.html';
      const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '').replace(/^([/\\])/, '');
      fs.readFile(path.join(dir, safe), (err, data) => {
        if (!err) {
          res.writeHead(200, { 'Content-Type': MIME[path.extname(safe).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
          res.end(data); return;
        }
        if (!path.extname(urlPath)) { // SPA fallback for extensionless routes
          fs.readFile(path.join(dir, 'index.html'), (e2, d2) => {
            if (e2) { res.writeHead(404); res.end('Not found'); return; }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(d2);
          });
        } else { res.writeHead(404); res.end('Not found'); }
      });
    });
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE' && startPort < 65535) { server.close(); resolve(startStaticServer(dir, startPort + 1)); }
      else reject(err);
    });
    server.listen(startPort, '0.0.0.0', () => resolve(server));
  });
}
function createWindow(instanceLabel) {
  const port = httpServer ? httpServer.address().port : HTTP_START_PORT;
  let url = `http://127.0.0.1:${port}`;
  if (instanceLabel || AUTO_CONNECT) url += `/?instance=${instanceLabel || '1'}&relay=${encodeURIComponent(`ws://127.0.0.1:${WS_PORT}`)}`;
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 600,
    title: instanceLabel ? `PeerEdit (${instanceLabel})` : 'PeerEdit',
    autoHideMenuBar: true, backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true, nodeIntegration: false, preload: PRELOAD,
      // NOTE: sandbox:false — portable exe runs from a temp extraction dir where the
      // Windows AppContainer sandbox fails to spawn a SECOND renderer (exit 65, blank
      // blue window 2+). Renderer still has no Node access, loads only local content.
      sandbox: false,
    },
  });
  windows.push(win);
  win.loadURL(url);
  win.on('closed', () => { windows = windows.filter((w) => w !== win); });
  win.webContents.on('did-fail-load', (_e, code, desc, u) => plog(`renderer${instanceLabel ? ' ' + instanceLabel : ''} did-fail-load ${code} ${desc} ${u}`));
  win.webContents.on('render-process-gone', (_e, details) => plog(`renderer${instanceLabel ? ' ' + instanceLabel : ''} GONE: ${JSON.stringify(details)}`));
  return win;
}
function openWindow() { windowCounter += 1; createWindow(windowCounter > 1 ? String(windowCounter) : null); }
async function handleSecondLaunch() {
  if (secondLaunchInProgress) return; // dedupe lock-event + HTTP-probe arrivals
  secondLaunchInProgress = true;
  try {
    if (AUTO_SECOND) { openWindow(); return; }
    const { response } = await dialog.showMessageBox(windows[0] || null, {
      type: 'question', title: 'PeerEdit', message: 'PeerEdit is already running',
      detail: 'Open another editor window on this machine? Both windows edit the same document together.',
      buttons: ['Open another window', 'Cancel'], defaultId: 0, cancelId: 1, noLink: true,
    });
    if (response === 0) openWindow();
    else if (windows.length) { const w = windows[0]; if (w.isMinimized()) w.restore(); w.focus(); }
  } finally { secondLaunchInProgress = false; }
}
async function fetchWithTimeout(url, opts, ms) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); } finally { clearTimeout(t); }
}
async function pingExisting(port) {
  try {
    const res = await fetchWithTimeout(`http://127.0.0.1:${port}/__peeredit/ping`, {}, 800);
    if (!res.ok) return false;
    const body = await res.text();
    // Identity check: OUR static server answers exactly "ok". Any other server
    // on ports 5173-5177 (e.g. vite's SPA fallback returns 200 HTML for every
    // extensionless path) must NOT be mistaken for a running PeerEdit instance.
    return body === 'ok';
  }
  catch { return false; }
}
async function signalExistingInstance() {
  for (let p = HTTP_START_PORT; p < HTTP_START_PORT + 5; p++) {
    const ok = await pingExisting(p);
    plog(`ping :${p} existing-instance=${ok}`);
    if (ok) {
      try { await fetchWithTimeout(`http://127.0.0.1:${p}/__peeredit/instance-request`, { method: 'POST' }, 1500); } catch {}
      return true;
    }
  }
  return false;
}
async function main() {
  plog('main() entered');
  try {
    if (await signalExistingInstance()) { plog('quitting: existing instance signaled'); app.quit(); return; }
    if (!(await isPortFree(WS_PORT))) {
      plog(`relay port ${WS_PORT} busy`);
      if (!(await signalExistingInstance())) dialog.showErrorBox('PeerEdit', `Port ${WS_PORT} is already in use.\n\nClose the program using port ${WS_PORT} and try again.`);
      app.quit(); return;
    }
    startRelay(WS_PORT); startDiscovery(broadcastPeer);
    plog(`relay started on :${WS_PORT}`);
    httpServer = await startStaticServer(DIST_DIR, HTTP_START_PORT);
    plog(`static server on :${httpServer.address().port}`);
    createWindow(null);
    plog('window created');
  } catch (err) { plog(`FATAL: ${err && err.stack ? err.stack : err}`); dialog.showErrorBox('PeerEdit failed to start', String((err && err.message) || err)); app.quit(); }
}
(async () => {
  // Lock acquisition with brief retries: a previous instance that is still shutting
  // down can transiently hold the lock, which used to mean instant silent death on a
  // rapid double-launch. A hard failure shows up as process_singleton_win Error 5.
  let gotLock = app.requestSingleInstanceLock();
  plog(`single-instance lock: ${gotLock}`);
  for (let attempt = 2; !gotLock && attempt <= 3; attempt++) {
    await new Promise((r) => setTimeout(r, 700));
    gotLock = app.requestSingleInstanceLock();
    plog(`single-instance lock (retry ${attempt}): ${gotLock}`);
  }
  if (!gotLock) {
    // Distinguish "another instance holds the lock" from "we cannot create the
    // lockfile at all" (Chromium reports the latter as Error code 5).
    try { fs.accessSync(app.getPath('userData'), fs.constants.W_OK); plog(`userData dir ${app.getPath('userData')} IS writable (lockfile likely held by another instance) or antivirus blocked it`); }
    catch (e) { plog(`userData dir ${app.getPath('userData')} NOT writable: ${(e && e.code) || e}`); }
    plog('quitting: lock not acquired (another instance running?)');
    signalExistingInstance().catch(() => {});
    app.quit();
    return;
  }
  app.on('second-instance', () => handleSecondLaunch());
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => {
    plog('before-quit');
    try { stopRelay(); } catch {}
    if (httpServer) { try { httpServer.close(); } catch {} try { httpServer.closeAllConnections?.(); } catch {} }
  });
  app.whenReady().then(() => { plog('app ready'); return main(); });
})();

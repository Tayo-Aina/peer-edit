// PeerEdit build orchestrator:
//   1. builds the frontend (vite)
//   2. bundles the relay server into a single CJS file (esbuild)
//   3. copies the built frontend next to it
//   4. packages a portable Windows exe (electron-builder)
//   5. copies the fresh exe to the workspace root
//
// AGENTS — root-exe convention (re-added at the user's explicit request after
// an earlier "single artifact only" experiment): the PeerEdit.exe at the
// workspace root (the folder containing peer-edit/, next to README.md) is the
// copy users actually double-click, so it must NEVER go stale. Step [5/5]
// below refreshes it automatically on every build. Rebuild instead of moving
// exes around by hand, and keep this copy step intact.
//
// NOTE: Do NOT post-process the portable exe with rcedit or similar PE
// resource editors. The portable exe is an NSIS stub with the app payload
// appended after the PE; rewriting its PE resources drops that payload and
// breaks the installer integrity check (NSIS Error at launch).

import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: true, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`))
    );
  });
}

console.log('\n[1/5] Building frontend...');
// Clean build: wipe previous dist so stale hashed assets can never leak
// into the packaged app (a mismatched index.html previously caused window 2
// to render raw CSS text).
fs.rmSync(path.join(root, 'frontend', 'dist'), { recursive: true, force: true });
await run('npm', ['run', 'build', '-w', 'frontend'], root);

console.log('\n[2/5] Bundling relay server...');
const bundleDir = path.join(__dirname, 'bundle');
fs.mkdirSync(bundleDir, { recursive: true });
await build({
  entryPoints: [path.join(__dirname, 'relay-entry.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile: path.join(bundleDir, 'relay.cjs'),
  external: ['bufferutil', 'utf-8-validate'], // optional ws natives, not needed
  logLevel: 'info',
});

console.log('\n[3/5] Copying frontend dist into bundle...');
fs.rmSync(path.join(bundleDir, 'frontend-dist'), { recursive: true, force: true });
fs.cpSync(path.join(root, 'frontend', 'dist'), path.join(bundleDir, 'frontend-dist'), { recursive: true });

console.log('\n[4/5] Packaging portable exe (electron-builder)...');
await run('npx', ['electron-builder', '--win', 'portable', '--config', 'electron-builder.yml'], __dirname);

const exePath = path.join(__dirname, 'release', 'PeerEdit.exe');
if (!fs.existsSync(exePath)) throw new Error('electron-builder did not produce PeerEdit.exe');

console.log('\n[5/5] Copying fresh exe to the workspace root...');
const workspaceRoot = path.resolve(__dirname, '..', '..');
const rootCopy = path.join(workspaceRoot, 'PeerEdit.exe');
fs.copyFileSync(exePath, rootCopy);

console.log('\n[DONE] Self-contained app:', exePath);
console.log('[DONE] Fresh copy at workspace root:', rootCopy);

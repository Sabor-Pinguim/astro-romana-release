// Headless Edge/Chrome over the DevTools protocol, with no npm dependencies: a static server for the repository,
// the browser process and a small CDP client. Shared by the page audit, the smoke test (mobile-audit.mjs) and the
// minigame clip recorder (minigame-clips.mjs).
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary',
};

export const delay = ms => new Promise(r => setTimeout(r, ms));

export function findBrowser() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const candidates = process.platform === 'win32'
    ? [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
      ]
    : process.platform === 'darwin'
      ? [
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        ]
      : ['microsoft-edge', 'google-chrome', 'chromium', 'chromium-browser'];
  for (const c of candidates) {
    if (c && (!c.includes(path.sep) || existsSync(c))) return c;
  }
  return null;
}

// Serves the repository on a free localhost port.
export function startStaticServer(root = ROOT) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const cleanUrl = decodeURIComponent((req.url || '/').split('?')[0]);
        const rel = cleanUrl === '/' ? 'index.html' : cleanUrl.replace(/^\/+/, '');
        const filePath = path.resolve(root, rel);
        if (!filePath.startsWith(root)) {
          res.writeHead(403).end('Forbidden');
          return;
        }
        const stat = await fs.stat(filePath).catch(() => null);
        const target = stat?.isDirectory() ? path.join(filePath, 'index.html') : filePath;
        const data = await fs.readFile(target);
        const ext = path.extname(target).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404).end('Not found');
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

export function launchBrowser(bin, userDataDir) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--mute-audio',
      // CI runners have no GPU: software WebGL (SwiftShader) keeps the 3D surface running; no sandbox inside the VM.
      ...(process.env.CI ? ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []),
      'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Timed out waiting for browser DevTools port. stderr=${stderr}`));
    }, 15000);

    proc.stderr.on('data', chunk => {
      stderr += chunk.toString();
      const m = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) {
        clearTimeout(timer);
        resolve({ proc, wsUrl: m[1] });
      }
    });
    proc.on('error', err => { clearTimeout(timer); reject(err); });
    proc.on('exit', code => {
      clearTimeout(timer);
      reject(new Error(`Browser exited early (${code}): ${stderr}`));
    });
  });
}

export class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        const key = `${msg.sessionId || ''}:${msg.method}`;
        for (const fn of this.listeners.get(key) || []) fn(msg.params);
      }
    });
  }
  send(method, params = {}, sessionId = undefined) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      const payload = sessionId ? { id, method, params, sessionId } : { id, method, params };
      this.ws.send(JSON.stringify(payload));
    });
  }
  on(method, fn, sessionId = '') {
    const key = `${sessionId}:${method}`;
    if (!this.listeners.has(key)) this.listeners.set(key, []);
    this.listeners.get(key).push(fn);
  }
  off(method, fn, sessionId = '') {
    const list = this.listeners.get(`${sessionId}:${method}`);
    if (list) list.splice(list.indexOf(fn) >>> 0, 1);
  }
  close() {
    this.ws.close();
  }
}

export async function connectCDP(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  return new CDPClient(ws);
}

// The room server from your machine, without logging in to the VM. No dependencies.
//   npm run server:status            the versions the VM runs (game and room server) next to this checkout's,
//                                    uptime, open rooms and players online
//   npm run server:restart           restarts the room server now. Every open room closes (players see "the room
//                                    server restarted"); systemd brings it back in seconds with the code the VM has
//                                    pulled, so a server version still waiting for rooms to close starts at once.
//                                    With rooms open it asks first; -- --yes skips the question.
// Settings, from the environment or from .env at the root of the repository (git ignores it; see .env.example):
//   ASTRO_SERVER_URL    the server (default: the v2 VM, from NET_SERVER in web/net.js)
//   ASTRO_ADMIN_TOKEN   the VM's ADMIN_TOKEN (/etc/astro-romana-v2/admin.env), needed by restart only
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// No process.exit(): on Windows it can abort while fetch still holds a connection. Errors end main() instead.
class Failure extends Error {}
const fail = msg => { throw new Failure(msg); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// .env: KEY=value lines; # comments; the environment wins.
const env = { ...readDotEnv(path.join(ROOT, '.env')), ...process.env };
function readDotEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trimStart().startsWith('#')) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}
function serverUrl() {
  if (env.ASTRO_SERVER_URL) return env.ASTRO_SERVER_URL.replace(/\/+$/, '');
  const m = /NET_SERVER\s*=\s*'(wss?):\/\/([^/']+)/.exec(fs.readFileSync(path.join(ROOT, 'web/net.js'), 'utf8'));
  if (!m) fail('no ASTRO_SERVER_URL in .env and no NET_SERVER in web/net.js');
  return `${m[1] === 'wss' ? 'https' : 'http'}://${m[2]}`;
}
const localVersion = rel => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')).version || '?'; } catch { return '?'; } };
async function getJson(url, init) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), ...init });
  let body = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  return { status: res.status, body };
}
const health = async base => { try { const r = await getJson(`${base}/health`); return r.status === 200 ? r.body : null; } catch { return null; } };
const uptime = sec => (sec >= 3600 ? `${Math.floor(sec / 3600)} h ${Math.floor((sec % 3600) / 60)} min` : sec >= 60 ? `${Math.floor(sec / 60)} min` : `${sec} s`);
const describe = h => `version ${h.version ?? '(older than 1.0.0)'} · up ${uptime(h.uptimeSec)} · ${h.rooms} room(s), ${h.online} player(s) online`;

async function status(base) {
  const h = await health(base);
  if (!h) fail(`${base}/health is not answering`);
  let game = '?';
  try { game = (await getJson(`${base}/package.json`)).body?.version ?? '?'; } catch { /* the game is hosted elsewhere */ }
  console.log(`${base}`);
  console.log(`  room server  ${describe(h)}   (this checkout: ${localVersion('multiplayer/package.json')})`);
  console.log(`  game         version ${game}   (this checkout: ${localVersion('package.json')})`);
}

async function restart(base) {
  const token = env.ASTRO_ADMIN_TOKEN;
  if (!token) fail('no ASTRO_ADMIN_TOKEN: copy .env.example to .env and fill it in (on the VM: sudo cat /etc/astro-romana-v2/admin.env)');
  const before = await health(base);
  if (!before) fail(`${base}/health is not answering: nothing to restart from here`);
  console.log(`${base}\n  now: ${describe(before)}`);
  if (before.online > 0 && !process.argv.includes('--yes')) {
    if (!process.stdin.isTTY) fail(`${before.online} player(s) are online: run again with -- --yes to restart anyway`);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`  ${before.rooms} room(s) with ${before.online} player(s) will close. Restart? [y/N] `);
    rl.close();
    if (!/^(y|yes|s|sim)$/i.test(answer.trim())) { console.log('  cancelled'); return; }
  }
  const r = await getJson(`${base}/api/admin/restart`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401) fail('the server refused the token: ASTRO_ADMIN_TOKEN must match ADMIN_TOKEN in /etc/astro-romana-v2/admin.env');
  if (r.status === 404) fail('this server has no restart endpoint yet (room server older than 1.0.2, or no admin.env): run setup-v2.sh on the VM');
  if (r.status === 429) fail('too many wrong tokens in the last minute: wait a minute');
  if (r.status !== 202) fail(`unexpected answer ${r.status}: ${JSON.stringify(r.body)}`);
  console.log(`  restarting: ${r.body.rooms} room(s) closed`);
  // Back when /health answers again with a fresh uptime (systemd restarts it about 2 s after it exits).
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const h = await health(base);
    if (h && h.uptimeSec < before.uptimeSec + i + 1 && h.uptimeSec < 30) {
      console.log(`✔ back: ${describe(h)}`);
      return;
    }
  }
  fail('the server did not come back within 30 s: on the VM, journalctl -u astro-rooms-v2 -n 50');
}

const command = process.argv[2];
try {
  if (command === 'status') await status(serverUrl());
  else if (command === 'restart') await restart(serverUrl());
  else { console.log('Usage: npm run server:status | npm run server:restart [-- --yes]'); process.exitCode = command ? 1 : 0; }
} catch (err) {
  if (!(err instanceof Failure)) throw err;
  console.error(`✘ ${err.message}`);
  process.exitCode = 1;
}

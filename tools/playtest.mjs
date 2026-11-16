// playtest.mjs — plays the real game in headless Chromium with real input
// events: starts a run from the title, moves and fires, pauses and resumes,
// flips the speed toggle, and watches for console errors throughout.
//   node tools/playtest.mjs
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const CHROME = process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const DEBUG_PORT = 9345;
const BASE = 'http://localhost:8080';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('timed out waiting for ' + url);
}

class CdpClient {
  static all = [];
  constructor(ws, sessionId = null) {
    this.ws = ws;
    this.sessionId = sessionId;
    this.nextId = 1;
    this.pending = new Map();
    this.onEvent = null;
    if (!sessionId) {
      ws.addEventListener('message', (ev) => {
        const msg = JSON.parse(ev.data);
        for (const c of CdpClient.all) {
          if ((msg.sessionId ?? null) !== c.sessionId) continue;
          if (msg.id && c.pending.has(msg.id)) {
            const { resolve, reject } = c.pending.get(msg.id);
            c.pending.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
          } else if (msg.method && c.onEvent) {
            c.onEvent(msg.method, msg.params);
          }
        }
      });
    }
    CdpClient.all.push(this);
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const envelope = { id, method, params };
      if (this.sessionId) envelope.sessionId = this.sessionId;
      this.ws.send(JSON.stringify(envelope));
    });
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error('page exception: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    }
    return r.result.value;
  }
  async snap(path) {
    const res = await this.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
    const buf = Buffer.from(res.data, 'base64');
    if (path) writeFileSync(path, buf);
    return buf;
  }
  mouse(type, x, y, button = 'none', buttons = 0) {
    return this.send('Input.dispatchMouseEvent', {
      type, x, y, button, buttons, clickCount: type === 'mousePressed' ? 1 : 0,
    });
  }
  key(type, keyName, code, vk) {
    return this.send('Input.dispatchKeyEvent', {
      type, key: keyName, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
    });
  }
}

async function play(page) {
  const errors = [];
  page.onEvent = (method, params) => {
    if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
      errors.push(params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
    if (method === 'Runtime.exceptionThrown') {
      errors.push('exception: ' + (params.exceptionDetails?.exception?.description ?? 'unknown'));
    }
  };
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  });
  await page.send('Page.navigate', { url: BASE + '/' });
  await sleep(2500);

  const titleShot = await page.snap('/tmp/pt-title.jpg');
  // Click BEGIN THE NIGHT (world 640,493 == client 640,493 at 1:1 scale).
  await page.mouse('mousePressed', 640, 493, 'left', 1);
  await page.mouse('mouseReleased', 640, 493, 'left', 0);
  await sleep(1200);
  const runShot = await page.snap('/tmp/pt-run.jpg');
  console.log('title -> run frames differ:', !titleShot.equals(runShot));

  // Move with D held, aim right, hold fire.
  await page.key('keyDown', 'd', 'KeyD', 68);
  await page.mouse('mouseMoved', 1050, 330);
  await page.mouse('mousePressed', 1050, 330, 'left', 1);
  await sleep(2600);
  await page.mouse('mouseReleased', 1050, 330, 'left', 0);
  await page.key('keyUp', 'd', 'KeyD', 68);
  const fightShot = await page.snap('/tmp/pt-fight.jpg');
  console.log('run -> fight frames differ:', !runShot.equals(fightShot));

  // Pause: the overlay must appear; resume; speed toggle.
  await page.key('keyDown', 'p', 'KeyP', 80);
  await page.key('keyUp', 'p', 'KeyP', 80);
  await sleep(500);
  await page.snap('/tmp/pt-paused.jpg');
  console.log('paused frame captured for visual check');
  await page.key('keyDown', 'p', 'KeyP', 80);
  await page.key('keyUp', 'p', 'KeyP', 80);
  await page.key('keyDown', '2', 'Digit2', 50);
  await page.key('keyUp', '2', 'Digit2', 50);
  await sleep(1500);
  const lateShot = await page.snap('/tmp/pt-late.jpg');
  console.log('fight -> late frames differ:', !fightShot.equals(lateShot));
  console.log('console errors: ' + errors.length + (errors.length ? ' — ' + errors.join(' | ') : ''));
  if (errors.length) process.exitCode = 1;
}

async function main() {
  const server = spawn('node', [join(ROOT, 'tools', 'serve.mjs'), '8080'], {
    detached: true, stdio: 'ignore',
  });
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--window-size=1280,720', '--force-device-scale-factor=1',
    '--remote-debugging-port=' + DEBUG_PORT, 'about:blank',
  ], { detached: true, stdio: 'ignore' });
  try {
    const version = await waitForJson(`http://localhost:${DEBUG_PORT}/json/version`);
    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res);
      ws.addEventListener('error', rej);
    });
    const browser = new CdpClient(ws);
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new CdpClient(ws, sessionId);
    await play(page);
    ws.close();
  } finally {
    try { process.kill(-chrome.pid, 'SIGKILL'); } catch { /* already gone */ }
    try { process.kill(-server.pid, 'SIGKILL'); } catch { /* already gone */ }
  }
}

await main();

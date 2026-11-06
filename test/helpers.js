'use strict';
// Starts the mock FreeLLMAPI and a Roundtable server pointed at it, on ports that
// will not collide with a real FreeLLMAPI (3001 / 31415) or your own Roundtable (5173).
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');

const MOCK_PORT = 41415;
const APP_PORT = Number(process.env.APP_PORT || 5199);

function waitFor(url, tries = 60) {
  return new Promise((resolve, reject) => {
    const attempt = n => {
      const req = http.get(url, r => { r.resume(); resolve(); });
      req.on('error', () => (n <= 0 ? reject(new Error('Timed out waiting for ' + url)) : setTimeout(() => attempt(n - 1), 100)));
    };
    attempt(tries);
  });
}

function loadPlaywright() {
  try { return require('playwright'); } catch {
    console.error('Playwright is needed for the browser tests:\n  npm install\n  npx playwright install chromium');
    process.exit(2);
  }
}

async function startStack({ demo = false } = {}) {
  const log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'roundtable-')), 'requests.jsonl');
  fs.writeFileSync(log, '');
  const mock = spawn(process.execPath, [path.join(__dirname, 'mock-freellmapi.js')], {
    env: { ...process.env, MOCK_PORT: String(MOCK_PORT), MOCK_LOG: log, MOCK_DEMO: demo ? '1' : '0' }, stdio: 'ignore',
  });
  const app = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(APP_PORT), FREELLMAPI_URL: `http://127.0.0.1:${MOCK_PORT}` }, stdio: 'ignore',
  });
  await waitFor(`http://127.0.0.1:${MOCK_PORT}/api/ping`);
  await waitFor(`http://127.0.0.1:${APP_PORT}/health`);
  return {
    base: `http://127.0.0.1:${APP_PORT}/`,
    requests: () => fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)),
    stop() { mock.kill(); app.kill(); },
  };
}

module.exports = { startStack, loadPlaywright };

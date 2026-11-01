#!/usr/bin/env node
'use strict';
// Roundtable server: serves index.html and proxies /v1/* to FreeLLMAPI.
// No dependencies.   Usage: node server.js
//
// Env:
//   PORT             Port for Roundtable itself (default 5173)
//   FREELLMAPI_URL   Where FreeLLMAPI lives. If unset, Roundtable looks for it on
//                    http://127.0.0.1:3001 (Docker / npm run dev) and
//                    http://127.0.0.1:31415 (desktop app) and uses whichever answers.
//   FREELLMAPI_KEY   Optional unified key to use when the browser sends none.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 5173);
const HOST = '127.0.0.1'; // loopback only on purpose: the page can hold your API key
const ENV_KEY = process.env.FREELLMAPI_KEY || '';
const PINNED = process.env.FREELLMAPI_URL ? new URL(process.env.FREELLMAPI_URL) : null;
const CANDIDATES = ['http://127.0.0.1:3001', 'http://127.0.0.1:31415'].map(u => new URL(u));
const PAGE = path.join(__dirname, 'index.html');

let target = PINNED || CANDIDATES[0];

const lib = u => (u.protocol === 'https:' ? https : http);
const portOf = u => u.port || (u.protocol === 'https:' ? 443 : 80);

// Any HTTP response at all means something is listening there.
function probe(u) {
  return new Promise(resolve => {
    const req = lib(u).request(
      { host: u.hostname, port: portOf(u), path: '/api/ping', method: 'GET', timeout: 1500 },
      r => { r.resume(); resolve(true); }
    );
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function resolveTarget() {
  if (PINNED) return (await probe(PINNED)) ? PINNED : null;
  const order = [target, ...CANDIDATES.filter(c => c.origin !== target.origin)];
  for (const c of order) {
    if (await probe(c)) { target = c; return c; }
  }
  return null;
}

const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    fs.readFile(PAGE, (err, data) => {
      if (err) { res.writeHead(500); return res.end('index.html not found next to server.js'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(data);
    });
    return;
  }

  if (url.pathname === '/health') {
    const found = await resolveTarget();
    return json(res, 200, { proxy: true, upstream: !!found, target: (found || target).origin, pinned: !!PINNED });
  }

  if (url.pathname.startsWith('/v1/')) {
    const headers = { ...req.headers, host: target.host };
    delete headers.origin; delete headers.referer; delete headers.connection;
    if (!headers.authorization && ENV_KEY) headers.authorization = 'Bearer ' + ENV_KEY;

    const up = lib(target).request({
      host: target.hostname, port: portOf(target), path: url.pathname + url.search,
      method: req.method, headers,
    }, upstream => {
      res.writeHead(upstream.statusCode || 502, upstream.headers);
      upstream.pipe(res);
    });
    up.on('error', err => {
      if (res.headersSent) return res.end();
      const where = PINNED ? PINNED.origin : 'http://127.0.0.1:3001 or :31415';
      json(res, 502, { error: { message: `Cannot reach FreeLLMAPI at ${where} (${err.code || err.message}). Is it running?` } });
    });
    // If the browser aborts (Stop button), drop the upstream request too.
    res.on('close', () => { if (!res.writableEnded) up.destroy(); });
    req.pipe(up);
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, HOST, async () => {
  console.log(`Roundtable running at http://localhost:${PORT}`);
  const found = await resolveTarget();
  if (found) console.log(`Using FreeLLMAPI at ${found.origin}`);
  else console.log(`FreeLLMAPI not found yet (${PINNED ? PINNED.origin : '3001 and 31415'}). Start it; Roundtable will pick it up automatically.`);
});

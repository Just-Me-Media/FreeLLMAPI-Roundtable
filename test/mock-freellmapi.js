#!/usr/bin/env node
'use strict';
// A tiny stand-in for FreeLLMAPI, used by the tests and the README screenshots.
// It speaks just enough of the OpenAI wire format: GET /v1/models and streamed
// POST /v1/chat/completions, with one model ("broken-model") that always 429s.
//
// Env: MOCK_PORT (default 41415, deliberately not 3001/31415 so it never collides
//      with a real FreeLLMAPI), MOCK_LOG (append each chat request as JSON lines),
//      MOCK_DEMO=1 (canned, realistic replies for screenshots).

const http = require('http');
const fs = require('fs');

const PORT = Number(process.env.MOCK_PORT || 41415);
const LOG = process.env.MOCK_LOG || '';
const DEMO = process.env.MOCK_DEMO === '1';
const KEY = 'freellmapi-test';
const MODELS = ['auto', 'Dots3 Note Preview', 'GPT-OSS 120B', 'Muse Glimmer 30B', 'North Mini Code', 'broken-model', 'Gemini Flash Lite'];

const DEMO_REPLIES = [
  'SQLite. It is a single file that ships with the app, needs no server process, and handles a single-user, read-heavy workload easily. Turn on WAL mode, keep migrations inside the app, and back the file up like any other document.',
  'Agree on SQLite, with two caveats. Writers still serialize, so keep write transactions short. And if you ever add multi-device sync, you will want a change-log table from day one rather than retrofitting it.',
  'Consensus: SQLite in WAL mode.\n\nDo now: migrations in the app, short write transactions.\nPlan for later: an append-only change log so sync can be added without rewriting the schema.',
];

http.createServer((req, res) => {
  if (req.url === '/api/ping') { res.writeHead(200); return res.end('ok'); }
  if (req.headers.authorization !== 'Bearer ' + KEY) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: { message: 'Invalid API key' } }));
  }
  if (req.url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ data: MODELS.map(id => ({ id })) }));
  }
  if (req.url === '/v1/chat/completions' && req.method === 'POST') {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => {
      const j = JSON.parse(body);
      if (LOG) fs.appendFileSync(LOG, JSON.stringify(j) + '\n');
      if (j.model === 'broken-model') {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: { message: 'Rate limit exceeded' } }));
      }
      let text = `Reply from ${j.model} seeing ${j.messages.length} messages.`;
      if (DEMO) {
        const lastUser = [...j.messages].reverse().find(m => m.role === 'user');
        const seen = ((lastUser && lastUser.content.match(/\n\n\[[^\]]+\]: /g)) || []).length;
        text = DEMO_REPLIES[Math.min(seen, DEMO_REPLIES.length - 1)];
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const words = text.split(/(?<= )/);
      let i = 0;
      const t = setInterval(() => {
        if (i >= words.length) { res.write('data: [DONE]\n\n'); clearInterval(t); return res.end(); }
        res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: words[i++] } }] }) + '\n\n');
      }, DEMO ? 12 : 30);
      res.on('close', () => clearInterval(t));
    });
    return;
  }
  res.writeHead(404); res.end();
}).listen(PORT, '127.0.0.1', () => console.log(`mock FreeLLMAPI on :${PORT}`));

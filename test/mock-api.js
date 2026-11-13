const http = require('http');

const PORT = Number(process.env.PORT || 31415);
const HOST = '127.0.0.1';

const responseText = 'Here is the requested artifact:\n\n```markdown\n# Smoke artifact\n- Streamed response rendered.\n- Artifact extracted and displayed.\n- Literal markup stays text: <img src=x onerror=alert(1)>\n```\n';

function sendSse(res, chunks) {
  let i = 0;
  const emit = () => {
    if (i >= chunks.length) {
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    const chunk = chunks[i++];
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
    setTimeout(emit, 50);
  };
  emit();
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'mock-free-llm-api' }));
    return;
  }

  if (req.url.startsWith('/v1/chat/completions')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let request;
      try {
        request = JSON.parse(body || '{}');
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Invalid JSON request body' } }));
        return;
      }

      const isStream = request.stream === true || req.headers.accept?.includes('text/event-stream');
      if (!isStream) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: responseText } }] }));
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });

      // First reply: a single markdown artifact (existing behaviour).
      // Second reply: multiple distinct artifacts from one synthesizer
      // response (markdown + json + html) — exercises multi-artifact capture.
      // Detect second synthesizer turn: second user prompt in the conversation.
      const userMessages = (request.messages || []).filter(m => m.role === 'user');
      const isSecond = userMessages.length === 2 && userMessages[userMessages.length - 1].content.includes('Second prompt');
      const chunks = isSecond ? [
        'Here are the requested artifacts:\n\n',
        '```markdown\n# Multi artifact\n- Markdown block from one reply.\n```\n\n',
        '```json\n[\n  {"instruction": "hello", "input": "", "response": "world"}\n]\n```\n\n',
        '```html\n<div>Hello</div>\n```\n',
      ] : [
        'Here is the requested artifact:\n\n```mark',
        'down\n# Smoke artifact\n- Streamed response rendered.\n',
        '- Artifact extracted and displayed.\n- Literal markup stays text: <img src=x onerror=alert(1)>\n```\n',
      ];
      sendSse(res, chunks);
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'Not found' } }));
});

server.listen(PORT, HOST, () => {
  console.log(`Mock FreeLLMAPI listening on http://${HOST}:${PORT}`);
});

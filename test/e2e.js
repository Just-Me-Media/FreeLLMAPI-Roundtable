#!/usr/bin/env node
'use strict';
// End-to-end test: drives the real page in Chromium against a mock FreeLLMAPI.
//   npm install && npx playwright install chromium && npm test
const { startStack, loadPlaywright } = require('./helpers');

let failed = 0;
const check = (cond, msg) => {
  if (!cond) { failed++; console.error('FAIL:', msg); } else console.log('ok  :', msg);
};

(async () => {
  const { chromium } = loadPlaywright();
  const stack = await startStack();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // 401/429 responses are expected in this test and show up as console noise.
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });

    await page.goto(stack.base);
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('connected'));
    check(true, 'health shows FreeLLMAPI connected');
    check(await page.locator('#overlay.open').count() === 1, 'setup opens on first run');

    // Bad key surfaces the upstream error; good key loads models
    await page.click('[data-tab="tab-cloud"]');
    await page.fill('#key', 'wrong');
    await page.click('#btnLoad');
    await page.waitForFunction(() => document.getElementById('loadNote').textContent.startsWith('Failed'));
    check((await page.textContent('#loadNote')).includes('Invalid API key'), 'bad key surfaces the upstream error');
    await page.fill('#key', 'freellmapi-test');
    await page.click('#btnLoad');
    await page.waitForFunction(() => document.getElementById('loadNote').textContent.includes('7 models'));
    check(true, 'models load through the proxy with the key');

    // Lineup: quick start, add a failing model, reorder, role text
    await page.click('#btnQuick');
    let names = await page.$$eval('#slots input[data-field=name]', els => els.map(e => e.value));
    check(names.length === 4, 'quick start added 4 models: ' + names.join(' | '));
    await page.fill('#search', 'broken');
    await page.click('[data-add="broken-model"]');
    await page.locator('[data-up]').nth(4).click();
    names = await page.$$eval('#slots input[data-field=name]', els => els.map(e => e.value));
    check(names[3] === 'Broken Model', 'reordering moves a model up: ' + names.join(' | '));
    await page.locator('#slots select[data-field=role-template]').first().selectOption('custom');
    await page.locator('textarea[data-field=role]').first().fill('Draft the first answer.');
    await page.click('#btnClose');
    check((await page.textContent('#roundHint')).includes('5 models × 1 round = 5 req/msg'), 'request-cost hint is shown');

    // One message, five models
    await page.fill('#input', 'What is 2+2?');
    await page.press('#input', 'Enter');
    await page.waitForFunction(() => document.querySelectorAll('.msg').length >= 6 && !document.getElementById('btnSend').disabled, null, { timeout: 15000 });
    const whos = await page.$$eval('.msg .meta .who', els => els.map(e => e.textContent));
    check(whos.join(',') === 'You,Dots3 Note Preview,GPT OSS 120B,Muse Glimmer 30B,Broken Model,North Mini Code',
      'models answer in lineup order: ' + whos.join(', '));
    const via = await page.$$eval('.msg .via', els => els.map(e => e.textContent));
    check(via.length === 1 && via[0] === 'via auto', 'failing model fell back to auto');
    check(await page.locator('.msg.err').count() === 0, 'no error card after a successful fallback');

    // What each model actually received
    const reqs = stack.requests();
    const first = reqs[0];
    const last = reqs[reqs.length - 1];
    check(first.model === 'Dots3 Note Preview' && first.messages.length === 2, 'model 1 saw only system + user');
    check(first.messages[0].content.includes('Draft the first answer.'), 'role text reached the system prompt');
    check(first.messages[0].content.includes('Participants in answer order'), 'system prompt lists the participants');
    check(last.model === 'North Mini Code' && last.messages.length === 2 && last.messages[1].role === 'user' &&
      last.messages[1].content.includes('What is 2+2?') &&
      last.messages[1].content.includes('[Dots3 Note Preview]: Reply from') &&
      last.messages[1].content.includes('[Muse Glimmer 30B]:') &&
      last.messages[1].content.includes('[Broken Model]: Reply from auto'),
      'last model saw the question plus every earlier reply, tagged by name, in one user turn');
    check(!last.messages[1].content.includes('Rate limit'), 'error text never enters the shared history');
    check(reqs.some(r => r.model === 'broken-model') && reqs.some(r => r.model === 'auto'), 'broken-model tried, then auto');
    check(reqs.every(r => r.stream === true), 'all requests are streamed');

    // Another round: model 1 now sees its own earlier reply as "assistant"
    const before = reqs.length;
    await page.click('#btnAgain');
    await page.waitForFunction(() => document.querySelectorAll('.msg').length >= 11 && !document.getElementById('btnSend').disabled, null, { timeout: 20000 });
    const r1 = stack.requests()[before];
    check(r1.model === 'Dots3 Note Preview', 'another round starts at model 1');
    check(r1.messages.map(m => m.role).join(',') === 'system,user,assistant,user', 'own reply is "assistant", everyone else merged as "user"');

    // Persistence
    await page.reload();
    await page.waitForSelector('.msg');
    check(await page.locator('.msg').count() >= 11, 'chat restored after reload');
    check(await page.locator('#overlay.open').count() === 0, 'setup is not shown again once a lineup exists');
    check((await page.textContent('#lineupBar')).includes('Dots3 Note Preview'), 'lineup restored');

    // Stop
    await page.fill('#input', 'Another question');
    await page.click('#btnSend');
    await page.waitForFunction(() => !document.getElementById('btnStop').disabled);
    await page.click('#btnStop');
    await page.waitForFunction(() => !document.getElementById('btnSend').disabled, null, { timeout: 5000 });
    check(true, 'Stop ends the run and re-enables Send');

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  } finally {
    await browser.close();
    stack.stop();
  }
  console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });

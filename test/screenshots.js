#!/usr/bin/env node
'use strict';
// Regenerates docs/*.png against the mock backend with canned demo replies.
const path = require('path');
const { startStack, loadPlaywright } = require('./helpers');

(async () => {
  const { chromium } = loadPlaywright();
  const stack = await startStack({ demo: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
    await page.goto(stack.base);
    await page.fill('#key', 'freellmapi-test');
    await page.click('#btnLoad');
    await page.waitForFunction(() => document.getElementById('loadNote').textContent.includes('models loaded'));
    await page.click('#btnQuick');
    await page.locator('[data-rm]').last().click(); // keep three at the table
    const roles = ['Draft the first answer.', 'Critique the answers so far.', 'Write the final summary.'];
    for (let i = 0; i < roles.length; i++) await page.locator('textarea[data-field=role]').nth(i).fill(roles[i]);
    await page.evaluate(() => { document.querySelector('.drawer').scrollTop = 0; });
    await page.screenshot({ path: path.join(__dirname, '..', 'docs', 'setup.png') });

    await page.click('#btnClose');
    await page.fill('#input', 'Should a local-first desktop app store its data in SQLite or Postgres?');
    await page.press('#input', 'Enter');
    await page.waitForFunction(() => document.querySelectorAll('.msg').length >= 4 && !document.getElementById('btnSend').disabled, null, { timeout: 20000 });
    await page.screenshot({ path: path.join(__dirname, '..', 'docs', 'chat.png') });
    console.log('wrote docs/setup.png and docs/chat.png');
  } finally {
    await browser.close();
    stack.stop();
  }
})().catch(e => { console.error('CRASH', e); process.exit(2); });

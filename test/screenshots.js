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
    // Setup opens on the Turn Rules tab, so switch to Cloud Models to load.
    await page.click('[data-tab="tab-cloud"]');
    await page.selectOption('#cloudProvider', 'gateway');
    await page.fill('#key', 'freellmapi-test');
    await page.click('#btnLoad');
    await page.waitForFunction(() => document.getElementById('loadNote').textContent.includes('models loaded'));
    // A deliberate three-model lineup reads better than Quick Start's picks
    // (which can include the mock's failing "broken-model"). The model list
    // lives on the Cloud Models tab.
    for (const model of ['GPT-OSS 120B', 'Muse Glimmer 30B', 'Dots3 Note Preview']) {
      await page.fill('#search', model.split(' ')[0].toLowerCase());
      await page.click(`[data-add="${model}"]`);
    }
    await page.click('[data-tab="tab-rules"]');
    const roles = ['Draft the first answer.', 'Critique the answers so far.', 'Write the final summary.'];
    for (let i = 0; i < roles.length; i++) await page.locator('textarea[data-field=role]').nth(i).fill(roles[i]);
    // Frame the lineup (models + role instructions), not the boilerplate above it.
    await page.evaluate(() => {
      const drawer = document.querySelector('[aria-label="Setup"]');
      const heading = [...drawer.querySelectorAll('*')]
        .find(el => el.children.length === 0 && /ACTIVE TABLE LINEUP/i.test(el.textContent));
      if (heading) drawer.scrollTop = heading.getBoundingClientRect().top - drawer.getBoundingClientRect().top + drawer.scrollTop - 24;
    });
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

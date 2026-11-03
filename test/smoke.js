const { chromium } = require('playwright');
const { spawn } = require('child_process');

const APP_URL = 'http://127.0.0.1:5174';
const HEALTH_URL = `${APP_URL}/health`;
const MOCK_API_URL = 'http://127.0.0.1:31416/api/ping';
const children = [];

function startProcess(script, env) {
  const child = spawn(process.execPath, [script], {
    cwd: `${__dirname}/..`,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  child.testOutput = () => output;
  children.push(child);
  return child;
}

async function waitForUrl(url, child, timeoutMs = 30000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Process exited before ${url} became ready:\n${child.testOutput()}`);
    }

    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      // retry until the service is ready
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(`URL did not become ready: ${url}\n${child.testOutput()}`);
}

async function waitForCondition(page, fn, message, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await page.evaluate(fn)) return;
    await page.waitForTimeout(250);
  }
  throw new Error(message);
}

function stopChildren() {
  for (const child of children) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  try {
    const mock = startProcess('test/mock-api.js', { PORT: '31416' });
    await waitForUrl(MOCK_API_URL, mock);

    const app = startProcess('server.js', {
      PORT: '5174',
      FREELLMAPI_URL: 'http://127.0.0.1:31416',
    });
    const healthResponse = await waitForUrl(HEALTH_URL, app);
    const health = await healthResponse.json();
    if (!health.upstream) throw new Error(`Mock upstream was not detected: ${JSON.stringify(health)}`);
    console.log('Isolated app and mock API are healthy.');

    const page = await browser.newPage();
    await page.addInitScript(appUrl => {
      localStorage.clear();
      localStorage.setItem('rt.cfg', JSON.stringify({
        freellmUrl: appUrl,
        key: '',
        directKey: '',
        slots: [{
          id: 'mock-slot',
          name: 'Mock Synthesizer',
          model: 'mock/smoke',
          role: 'You are the synthesizer. Produce a concise markdown artifact.'
        }],
        rounds: 1,
        fallback: 'auto',
        preamble: 'You are an internal assistant helping a small team.',
        maxTokens: 0,
        outputFormat: 'markdown',
        previewOpen: true,
      }));
      localStorage.setItem('rt.msgs', JSON.stringify([]));
      localStorage.setItem('rt.artifactHistory', JSON.stringify([
        null,
        {},
        { lang: 'html', text: 42 },
        { lang: 'unknown', text: 'invalid saved artifact' },
      ]));
    }, APP_URL);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('#input').waitFor({ state: 'visible', timeout: 20000 });

    await page.locator('#input').fill('Smoke test prompt');
    await page.locator('#btnSend').click();
    await waitForCondition(
      page,
      () => document.querySelectorAll('.msg.user').length === 1 &&
        document.querySelectorAll('.msg:not(.user):not(.err)').length === 1,
      'First prompt did not produce a successful model response',
      20000
    );

    await waitForCondition(
      page,
      () => document.querySelectorAll('#artifactVersionStrip [data-artifact-v]').length === 1 &&
        document.querySelector('#artifactRenderArea')?.innerText.includes('Smoke artifact') &&
        document.querySelectorAll('#artifactRenderArea img').length === 0,
      'Synthesizer artifact was not extracted and rendered',
      10000
    );
    console.log('First response and extracted artifact rendered.');

    await page.locator('#input').fill('Second prompt to check repeat responses.');
    await page.locator('#btnSend').click();
    await waitForCondition(
      page,
      () => document.querySelectorAll('.msg.user').length === 2 &&
        document.querySelectorAll('.msg:not(.user):not(.err)').length === 2,
      'Second prompt did not produce a successful model response',
      20000
    );

    const artifactVersions = await page.locator('#artifactVersionStrip [data-artifact-v]').count();
    if (artifactVersions !== 1) {
      throw new Error(`Duplicate identical artifacts should be ignored; found ${artifactVersions} versions`);
    }
    console.log('Second response rendered; duplicate artifact was not added.');
  } finally {
    await browser.close();
    stopChildren();
  }

  console.log('Smoke test passed.');
}

run().catch(err => {
  console.error('Smoke test failed:', err);
  process.exitCode = 1;
});

// UI smoke test against the dev-only mock backend (real Firebase/Gemini Nano can't run in CI).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const assert = require('assert');

(async () => {
  const srv = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { stdio: 'ignore' });
  const url = 'http://localhost:5199/?mock=1';
  for (let i = 0; i < 50; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url);
    await page.click('#btn-start');
    await page.waitForSelector('#app:not([hidden])');
    await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('Ready'));

    await page.click('#btn-describe');
    await page.waitForFunction(() => document.getElementById('result').textContent.includes('cloud'));
    assert.strictEqual(await page.textContent('#src'), 'cloud');

    await ctx.setOffline(true);
    await page.keyboard.press('r'); // keyboard shortcut
    await page.waitForFunction(() => document.getElementById('result').textContent.includes('locally'));
    assert.strictEqual(await page.textContent('#src'), 'on device');
    assert.strictEqual(await page.textContent('#net'), 'offline');
    await ctx.setOffline(false);

    await page.click('#btn-ask');
    await page.fill('#ask-input', 'Which bus is this?');
    await page.press('#ask-input', 'Enter');
    await page.waitForFunction(() => document.getElementById('result').textContent.includes('Which bus is this?'));

    await page.click('#settings summary');
    await page.selectOption('#mode', 'private');
    await page.click('#btn-describe');
    await page.waitForFunction(() => document.getElementById('result').textContent.includes('locally'));

    // every interactive control has an accessible name
    const unnamed = await page.$$eval('button,input,select', (els) =>
      els.filter((e) => !(e.getAttribute('aria-label') || e.labels?.length || e.textContent.trim() || e.placeholder)).map((e) => e.outerHTML));
    assert.deepStrictEqual(unnamed, []);
    await page.screenshot({ path: process.env.SHOT || '/tmp/waylens.png' });
    assert.deepStrictEqual(errors, []);
    console.log('smoke OK');
  } finally { await browser.close(); srv.kill(); }
})().catch((e) => { console.error(e); process.exit(1); });

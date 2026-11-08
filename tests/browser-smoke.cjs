/* Optional: NODE_PATH=<installed playwright directory> node tests/browser-smoke.cjs
   Uses real app markup/styles/navigation, but removes legacy scripts and blocks
   every network request. Synthetic records only; no Firebase access. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.route('**/*', route => route.abort());
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const source = fs.readFileSync('public/index.html', 'utf8');
    const html = source.replace(/<!--[\s\S]*?-->/g, '').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
    await page.setContent(html);
    await page.addStyleTag({ path: 'public/css/operations.css' });
    await page.addScriptTag({ path: 'public/js/toolkit-core.js' });
    // Exactly the app's navigation event handler, without the unrelated boot code.
    await page.addScriptTag({ content: source.slice(source.indexOf('/* ---------- navigation'), source.indexOf('/* ---------- FSA support')) });
    await page.evaluate(() => {
      document.body.classList.add('ent-authenticated', 'ent-is-super-admin');
      document.documentElement.classList.add('ent-super-confirmed');
      window.DB = { recruitmentCases: Array.from({ length: 60 }, (_, i) => ({ id: 'RC-' + i, name: i === 0 ? '<img src=x onerror=alert(1)>' : 'Candidate ' + i, client: i < 55 ? 'Client A' : 'Client B', stage: 'MEDICAL ON PROGRESS', updatedAt: '2026-01-01', passport: 'AA' + i })), visaRecords: [{ id: 'VR-1', client: 'Client A', statusVisa: 'UNUSED', expirationDate: '2026-01-01' }] };
      window.before = JSON.stringify(window.DB);
    });
    await page.addScriptTag({ path: 'public/js/operations.js' });
    await page.locator('[data-tab="operations"]').click();
    await page.waitForFunction(() => document.getElementById('opsQueue').children.length === 50);
    assert.match(await page.locator('#opsCount').innerText(), /61 actions/);
    await page.locator('#opsNext').click();
    assert.equal(await page.locator('#opsQueue tr').count(), 11);
    await page.locator('#opsSearch').fill('AA0');
    assert.match(await page.locator('#opsCount').innerText(), /1 actions/);
    assert.equal(await page.locator('#opsQueue img').count(), 0);
    await page.locator('#opsQueue button').click();
    assert.equal(await page.locator('#opsDetail').evaluate(el => el.open), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#opsDetail').evaluate(el => el.open), false);
    await page.locator('#opsReset').click();
    await page.locator('#opsClient').selectOption('Client B');
    assert.match(await page.locator('#opsCount').innerText(), /5 actions/);
    const download = page.waitForEvent('download');
    await page.locator('#opsExportQueue').click();
    const file = await download;
    const csv = fs.readFileSync(await file.path(), 'utf8');
    assert.match(csv, /Client B/); assert.doesNotMatch(csv, /Client A/);
    await page.locator('#opsClient').selectOption('');
    await page.screenshot({ path: '/tmp/safwat-operations-desktop.png', fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '/tmp/safwat-operations-mobile.png', fullPage: false });
    assert.equal(await page.evaluate(() => JSON.stringify(window.DB) === window.before), true);
    await page.evaluate(() => document.body.classList.remove('ent-authenticated'));
    await page.waitForFunction(() => !document.getElementById('opsQueue').children.length);
    assert.equal(await page.locator('#opsExportQueue').isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log('Browser smoke passed: navigation, metrics, pagination, search, escaping, detail dialog, client filter, CSV download, responsive screenshots, read-only behavior and sign-out clearing.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

/* Real executive-layer code and real styles; synthetic data, no Firebase or network. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.route('**/*', route => route.abort());
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const source = fs.readFileSync('public/index.html', 'utf8');
    await page.setContent(source.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ''));
    for (const [, href] of source.matchAll(/<link[^>]*href="(\/css\/[^"]+)"/g)) await page.addStyleTag({ path: 'public' + href });
    await page.addScriptTag({ path: 'public/js/toolkit-core.js' });
    await page.addScriptTag({ path: 'public/js/appearance.js' });
    await page.evaluate(() => {
      document.body.classList.add('ent-authenticated');
      document.getElementById('ceoDashOv').classList.add('open');
      document.getElementById('ceoDashBody').innerHTML = '<div class="ceo-tile" data-proj="OTHER">Project reports remain independent</div>';
      const today = SafwatCore.today();
      window.DB = { recruitmentCases: [
        { id: 'RC-1', client: 'Client A', stage: 'MEDICAL', updatedAt: '2020-01-01', name: '<img src=x onerror=alert(1)>' },
        { id: 'RC-2', client: 'Client A', stage: 'VISA ISSUED', dateWorkStarted: '2999-01-01', dateArrivalKsa: '2999-01-01', updatedAt: today },
        { id: 'RC-3', client: 'Client B', stage: 'DEPLOYED', dateWorkStarted: '2020-01-01' }
      ], visaRecords: [{ id: 'VR-1', client: 'Client A', statusVisa: 'ALLOCATED', expirationDate: today }] };
      window.beforeCEO = JSON.stringify(DB);
    });
    await page.addScriptTag({ path: 'public/js/legacy/075-ceoexecutivelayerv371.js' });
    await page.waitForSelector('#xdToggleFilters');
    const metric = label => page.locator('.xd-kpi').filter({ has: page.locator('.lb', { hasText: label }) }).locator('b').innerText();
    assert.equal(await metric('Candidates'), '3');
    assert.equal(await metric('Deployed / Started'), '1');
    assert.equal(await metric('Arrived in KSA'), '0');
    assert.equal(await page.locator('.tgt').count(), 0);
    assert.match(await page.locator('[data-att="expiringSoon"]').innerText(), /1/);
    assert.match(await page.locator('[data-att="expiredActive"]').innerText(), /0/);
    await page.locator('[aria-label="Dashboard color theme"]').selectOption('black');
    assert.equal(await page.locator('body').getAttribute('data-appearance'), 'black');
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).getPropertyValue('--paper').trim()), '#08080a');
    await page.locator('[aria-label="Dashboard color theme"]').selectOption('light');
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('ent-dark')), false);
    await page.locator('[aria-label="Dashboard color theme"]').selectOption('dark');
    await page.locator('#xdToggleFilters').click();
    assert.equal(await page.locator('#xdFilters').isVisible(), true);
    await page.locator('#xdFilter-client').selectOption('Client A');
    assert.equal(await metric('Candidates'), '2');
    assert.equal(await metric('Deployed / Started'), '0');
    await page.locator('#xdFocus').click();
    assert.equal(await page.locator('.ceo-tile').isVisible(), false);
    const download = page.waitForEvent('download');
    await page.locator('#xdSummaryExport').click();
    const csv = fs.readFileSync(await (await download).path(), 'utf8');
    assert.match(csv, /Candidates,2/);
    assert.match(csv, /Client A/);
    await page.locator('[data-att="stalled"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#xdDrill').evaluate(el => el.classList.contains('open')), true);
    assert.equal(await page.locator('#xdDrillBody img').count(), 0);
    assert.match(await page.locator('#xdDrillBody').innerText(), /RC-1/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#xdDrill').evaluate(el => el.classList.contains('open')), false);
    assert.equal(await page.evaluate(() => JSON.stringify(DB) === beforeCEO), true);
    // A same-length edit must be reflected after refresh.
    await page.evaluate(() => { DB.recruitmentCases[0].stage = 'DEPLOYED'; window._entCEOExecRefresh(); });
    assert.equal(await metric('Deployed / Started'), '1');
    await page.locator('#xdFocus').click();
    assert.equal(await page.locator('.ceo-tile').isVisible(), true);
    await page.screenshot({ path: '/tmp/safwat-ceo-graphite.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '/tmp/safwat-ceo-mobile.png' });
    assert.deepEqual(errors, []);
    console.log('PROJECT D passed: real executive layer, themes, mixed-case filters, future dates, today expiry, keyboard drill, safe rendering, summary CSV, focus mode, refresh and read-only behavior.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const manifest = require('../docs/asset-manifest.json');
const html = fs.readFileSync('public/index.html', 'utf8');
test('extracted JS and CSS preserve every original block byte-for-byte and in order', () => {
  let last = -1;
  for (const asset of manifest.assets) {
    const data = fs.readFileSync(asset.path);
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), asset.sha256, asset.path);
    const url = '/' + asset.path.slice(7), location = html.indexOf('"' + url + '"');
    assert.ok(location > last, 'Asset order: ' + asset.path); last = location;
    if (asset.kind === 'js') assert.match(html.slice(html.lastIndexOf('<', location), html.indexOf('>', location)), /^<script src=/);
  }
  assert.equal(manifest.assets.filter(a => a.kind === 'js').length, 103);
  assert.equal(manifest.assets.filter(a => a.kind === 'css').length, 67);
});
test('navigation maps every static tab to one panel; shell has no inline JS or CSS', () => {
  for (const [, id] of html.matchAll(/class="tab[^\"]*" data-tab="([^"]+)"/g)) assert.equal((html.match(new RegExp('id="panel-' + id + '"', 'g')) || []).length, 1, id);
  assert.doesNotMatch(html, /<style\b|<script\s*>/i);
  assert.equal((html.match(/<\/body>/g) || []).length, 1);
  assert.ok(html.lastIndexOf('</body>') > html.lastIndexOf('<script'));
  assert.match(html, /data-tab="guide"/);
});

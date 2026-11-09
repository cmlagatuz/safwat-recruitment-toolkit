const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/js/toolkit-core');

test('dates preserve local calendar day, validate leap dates and accept day-first dates', () => {
  assert.equal(C.isoDate(new Date(2026, 10, 8, 16, 30)), '2026-11-08');
  assert.equal(C.isoDate('08/11/2026'), '2026-11-08');
  assert.equal(C.isoDate('2026-11-08T19:30:00Z'), '2026-11-08');
  assert.equal(C.isoDate('29/02/2024'), '2024-02-29');
  for (const value of ['29/02/2026', '31/04/2026', '2026-13-01', '2026-00-01', '2026-11-00', '', null, new Date('bad')]) assert.equal(C.isoDate(value), null);
  assert.equal(C.dayNumber('2026-11-09') - C.dayNumber('2026-11-08'), 1);
});
test('CSV prevents formulas, quotes separators and preserves numeric negatives', () => {
  for (const value of ['=1+1', ' +SUM(A1)', '@cmd', '-2+3', '\t=1', '\n=2']) assert.ok(C.csvCell(value).includes("'"));
  assert.equal(C.csvCell(-12), '-12');
  assert.equal(C.csvCell('a,"b"\rc'), '"a,""b""\rc"');
  assert.equal(C.csv(['Name'], [['محمد']]), '\ufeffName\r\nمحمد');
});
test('HTML escape covers quoted attributes and markup', () => {
  assert.equal(C.escapeHtml('<a x="\'">&'), '&lt;a x=&quot;&#39;&quot;&gt;&amp;');
});
test('database loading rejects corrupt inputs and retains extension fields', () => {
  const db = { recruitmentCases: [{ id: 'RC-1', extra: 'retained' }], visaRecords: [], extraTop: { setting: 4 } };
  assert.deepEqual(C.parseDatabase(JSON.stringify(db)).extraTop, db.extraTop);
  for (const value of [{}, [], { ...db, recruitmentCases: null }, { ...db, recruitmentCases: [null] }, { ...db, recruitmentCases: [{ id: 'x' }, { id: 'x' }] }, { ...db, meta: [] }, { ...db, customStages: [4] }]) assert.throws(() => C.parseDatabase(JSON.stringify(value)));
});
const fixture = {
  recruitmentCases: [
    { id: 'RC-1', name: 'Ana Reyes', client: 'Acme', agency: 'Giant', stage: 'MEDICAL ON PROGRESS', updatedAt: '2026-10-20', passport: 'AA123' },
    { id: 'RC-2', client: 'Acme', stage: 'DEPLOYED', updatedAt: '2026-01-01' },
    { id: 'RC-3', client: 'Acme', stage: 'WITHDRAWN/BACKOUT', updatedAt: '2026-01-01' },
    { id: 'RC-4', client: '', stage: 'CUSTOM STAGE' },
    { id: 'RC-5', client: 'Beta', stage: 'FOR DEPLOYMENT', updatedAt: '2026-11-08' }
  ],
  visaRecords: [
    { id: 'VR-1', client: 'Acme', statusVisa: 'UNUSED', expirationDate: '2026-11-08', candidateVisaExpiration: '2026-11-15' },
    { id: 'VR-2', client: 'Acme', statusVisa: 'CANCELLED', expirationDate: '2026-01-01' },
    { id: 'VR-3', client: 'Beta', statusVisa: 'USED', expirationDate: '2026-01-01', candidateVisaExpiration: '2026-11-09' },
    { id: 'VR-4', client: 'Beta', statusVisa: 'USED', arrivalDate: '2026-11-01', candidateVisaExpiration: '2026-11-09' },
    { id: 'VR-5', client: 'Beta', statusVisa: 'ALLOCATED', expirationDate: '31/02/2026' }
  ]
};
test('client snapshot distinguishes deployed, closed and active without mutation', () => {
  const before = JSON.stringify(fixture);
  const report = C.analyze(fixture, { today: '2026-11-08' });
  const acme = report.clients.find(r => r.client === 'Acme');
  assert.deepEqual(acme, { client: 'Acme', total: 3, active: 1, deployed: 1, closed: 1, stale: 1, visas: 2, expiryAlerts: 2 });
  assert.equal(report.queue.filter(r => r.type === 'follow-up').length, 1);
  assert.equal(report.queue.find(r => r.id === 'RC-1').days, 19);
  assert.equal(report.queue.filter(r => r.id === 'VR-3').length, 1);
  assert.equal(report.queue.filter(r => ['VR-2', 'VR-4'].includes(r.id)).length, 0);
  assert.equal(report.queue.find(r => r.id === 'VR-5').type, 'data-quality');
  assert.equal(JSON.stringify(fixture), before);
});
test('search ANDs tokens across name, passport and agency; filters compose', () => {
  const report = C.analyze(fixture, { today: '2026-11-08' });
  assert.equal(C.filterQueue(report.queue, { search: 'ana giant aa123', client: 'Acme', type: 'follow-up' }).length, 1);
  assert.equal(C.filterQueue(report.queue, { search: 'ana absent' }).length, 0);
  assert.equal(C.filterQueue(report.queue, { client: 'Acme', type: 'expiry' }).length, 2);
});
test('expiry boundaries and overdue follow-up ordering', () => {
  const report = C.analyze({ recruitmentCases: [{ id: 'new', updatedAt: '2026-10-20' }, { id: 'old', updatedAt: '2026-09-01' }], visaRecords: [{ id: 'past', expirationDate: '2026-11-07' }, { id: 'today', expirationDate: '2026-11-08' }, { id: 'future', expirationDate: '2026-11-09' }] }, { today: '2026-11-08', horizon: 0 });
  assert.deepEqual(report.queue.filter(r => r.type === 'expiry').map(r => r.id), ['past', 'today']);
  assert.deepEqual(report.queue.filter(r => r.type === 'follow-up').map(r => r.id), ['old', 'new']);
});
test('empty database and special client names are safe', () => {
  assert.equal(C.analyze(null).queue.length, 0);
  assert.equal(C.analyze({ recruitmentCases: [{ id: 'x', client: '__proto__' }] }).clients[0].client, '__proto__');
  assert.equal(C.state('for deployment'), 'active');
  assert.equal(C.state(' deployed '), 'deployed');
});

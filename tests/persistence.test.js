const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../public/js/persistence');
const db = () => ({ meta: {}, recruitmentCases: [{ id: 'RC-1', name: 'Before' }], visaRecords: [] });
function fake(initial, beforeTransaction) {
  let remote = initial;
  return {
    once: async () => ({ val: () => remote }),
    transaction: async (fn, cb, applyLocally) => {
      assert.equal(applyLocally, false);
      if (beforeTransaction) await beforeTransaction();
      const value = fn(remote);
      if (value === undefined) return { committed: false };
      remote = value; return { committed: true };
    },
    change(value) { remote = value; }, read() { return remote; }
  };
}
test('immutable outgoing snapshot does not swallow edits made during save', async () => {
  const live = db(); const ref = fake({ version: 1, data: db() }, async () => { live.recruitmentCases[0].name = 'Edited during save'; });
  const result = await P.commit(ref, { db: live, expectedVersion: 1, uid: 'editor', actor: 'Editor' });
  assert.equal(result.data.recruitmentCases[0].name, 'Before');
  assert.equal(live.recruitmentCases[0].name, 'Edited during save');
  assert.notEqual(P.signature(result.data), P.signature(live));
  assert.equal(ref.read().version, 2);
});
test('stale or absent baseline never overwrites existing data', async () => {
  for (const expectedVersion of [null, 1]) {
    const ref = fake({ version: 2, data: db() });
    await assert.rejects(P.commit(ref, { db: db(), expectedVersion, uid: 'editor' }), { code: 'SAVE_CONFLICT' });
    assert.equal(ref.read().version, 2);
  }
});
test('race after read is caught by transaction comparison', async () => {
  const ref = fake({ version: 1, data: db() }, async () => ref.change({ version: 2, data: { newer: true } }));
  await assert.rejects(P.commit(ref, { db: db(), expectedVersion: 1, uid: 'editor' }), { code: 'SAVE_CONFLICT' });
  assert.equal(ref.read().data.newer, true);
});
test('new database starts at version one, denial propagates, savedAt does not mark data dirty', async () => {
  const live = db(), before = P.signature(live), ref = fake(null);
  const result = await P.commit(ref, { db: live, uid: 'editor' });
  assert.equal(result.version, 1); assert.equal(P.signature(result.data), before);
  const denied = fake(null); denied.transaction = async () => { throw new Error('PERMISSION_DENIED'); };
  await assert.rejects(P.commit(denied, { db: live, uid: 'editor' }), /PERMISSION_DENIED/);
});
test('remote updates preserve dirty local records and accept clean replacements', () => {
  const live = db(); P.remember(live, live);
  const remote = db(); remote.recruitmentCases[0].name = 'Remote edit';
  assert.equal(P.acceptRemote(live, { data: remote }), true);
  live.recruitmentCases[0].name = 'Unsaved local edit';
  assert.equal(P.acceptRemote(live, { data: remote }), false);
  assert.equal(P.acceptRemote(null, { data: remote }), true);
  assert.equal(P.acceptRemote(live, { data: live }), true);
});
test('cold local transaction cache proposes data then checks the actual server revision', async () => {
  const ref = fake({ version: 1, data: db() });
  ref.transaction = async (fn, cb, applyLocally) => {
    assert.equal(applyLocally, false);
    assert.equal(fn(null).version, 2);
    assert.equal(fn({ version: 2, data: db() }), undefined);
    return { committed: false };
  };
  await assert.rejects(P.commit(ref, { db: db(), expectedVersion: 1, uid: 'editor' }), { code: 'SAVE_CONFLICT' });
});
test('editor load retains its revision through normalization, immediate edits and successive saves', async () => {
  const live = db(), scope = 'safwat/databases/main';
  const ref = fake({ version: 12, data: structuredClone(live) });
  P.remember(live, live, 12, scope);
  // Startup normalization can happen before CLAIRE observes the server event.
  live.meta.audit = []; live.customStages = [];
  live.recruitmentCases.push({ id: 'RC-2', name: 'Bryan test candidate' });
  assert.equal(P.versionFor(live, scope), 12);
  await P.commit(ref, { db: live, expectedVersion: P.versionFor(live, scope), scope, uid: 'bryan-editor' });
  assert.equal(ref.read().data.recruitmentCases.length, 2);
  assert.equal(P.versionFor(live, scope), 13);
  live.recruitmentCases[1].name = 'Updated';
  await P.commit(ref, { db: live, expectedVersion: P.versionFor(live, scope), scope, uid: 'bryan-editor' });
  assert.equal(ref.read().version, 14);
  assert.equal(ref.read().data.recruitmentCases[1].name, 'Updated');
});
test('load revisions are object- and database-scoped; offline data cannot borrow one', async () => {
  const scope = 'safwat/databases/main', live = db();
  P.remember(live, live, 5, scope);
  assert.equal(P.versionFor(live, 'safwat/databases/other'), null);
  assert.equal(P.versionFor(structuredClone(live), scope), null);
  const cached = db(); P.remember(cached, cached);
  assert.equal(P.versionFor(cached, scope), null);
  const ref = fake({ version: 6, data: db() });
  await assert.rejects(P.commit(ref, { db: live, expectedVersion: P.versionFor(live, scope), scope, uid: 'editor' }), { code: 'SAVE_CONFLICT' });
  assert.equal(ref.read().version, 6);
});
test('CLAIRE save path uses the loader revision even when its matching watcher never runs', async () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const live = db(), scope = 'safwat/databases/main';
  const ref = fake({ version: 7, data: structuredClone(live) }); ref.on = () => {};
  P.remember(live, live, 7, scope);
  live.meta.schemaVersion = 3;
  live.recruitmentCases.push({ id: 'RC-2', name: 'Unsaved editor record' });
  const window = { DB: live, dbSave() {}, addEventListener() {} };
  const source = fs.readFileSync('public/js/legacy/098-clairestep1.js', 'utf8');
  // Execute the actual persistence section; omit unrelated assistant UI setup.
  const end = source.indexOf('  /* =====================================================================\n     2) EVENTS');
  assert.ok(end > 0);
  const context = { window, SafwatPersistence: P, firebase: { auth: () => ({currentUser: {uid:'editor',email:'editor@example.test'}}), database: () => ({ref: () => ref}) }, localStorage:{getItem:()=>null}, document:{addEventListener(){}}, navigator:{onLine:true}, console, setTimeout:()=>0, clearTimeout(){}, performance };
  vm.runInNewContext(source.slice(0,end) + '\nwindow.testSave = cloudWrite; })();', context);
  await window.testSave();
  assert.equal(ref.read().version, 8);
  assert.equal(ref.read().data.recruitmentCases.length, 2);
  live.recruitmentCases[1].name = 'Second save';
  await window.testSave();
  assert.equal(ref.read().version, 9);
});

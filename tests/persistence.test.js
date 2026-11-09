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

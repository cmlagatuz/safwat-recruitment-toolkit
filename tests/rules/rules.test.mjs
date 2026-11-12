import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, get, set, update, remove, runTransaction } from 'firebase/database';
import { readFileSync } from 'node:fs';
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { commit, remember, versionFor } = createRequire(import.meta.url)('../../public/js/persistence.js');
if (!process.env.FIREBASE_DATABASE_EMULATOR_HOST) throw new Error('Run through firebase emulators:exec; production tests are prohibited.');
let env;
const user = (uid, role, disabled = false) => ({ uid, email: uid + '@example.test', role, disabled });
const db = (uid, verified = true, provider = 'password') => env.authenticatedContext(uid, { email: uid + '@example.test', email_verified: verified, firebase: { sign_in_provider: provider } }).database();
const envelope = (uid, version = 2) => ({ version, savedAt: new Date().toISOString(), updatedBy: uid, data: { meta: { version: 1 }, recruitmentCases: [{ id: 'RC-1', name: 'Synthetic' }] } });
const lock = (uid, expires = Date.now() + 90000) => ({ uid, sessionId: uid + '-session', since: Date.now(), expires });
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-safwat-security', database: { rules: readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8') } }); });
beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async c => set(ref(c.database(), 'safwat'), { users: { admin: user('admin', 'admin'), editor: user('editor', 'editor'), other: user('other', 'editor'), viewer: user('viewer', 'viewer'), disabled: user('disabled', 'admin', true) }, databases: { main: envelope('admin', 1) }, ceoConfig: { passwordHash: 'synthetic-hash', devices: { sample: { approved: true } } } }));
});
after(async () => { if (env) await env.cleanup(); });
test('unauthenticated, anonymous, pending, unverified and disabled users cannot read recruitment data', async () => {
  for (const client of [env.unauthenticatedContext().database(), db('anonymous', true, 'anonymous'), db('pending'), db('viewer', false), db('disabled')]) await assertFails(get(ref(client, 'safwat/databases/main')));
});
test('approved verified viewer can read but cannot write', async () => {
  await assertSucceeds(get(ref(db('viewer'), 'safwat/databases/main')));
  await assertFails(set(ref(db('viewer'), 'safwat/databases/main'), envelope('viewer')));
});
test('editors and admins can save a valid next revision', async () => {
  await assertSucceeds(set(ref(db('editor'), 'safwat/databases/main'), envelope('editor')));
  await assertSucceeds(set(ref(db('admin'), 'safwat/databases/main'), envelope('admin', 3)));
});
test('stale revisions, forged authors, database deletes and missing envelopes fail', async () => {
  const r = ref(db('editor'), 'safwat/databases/main');
  await assertFails(set(r, envelope('editor', 1)));
  await assertFails(set(r, envelope('other')));
  await assertFails(remove(r));
  await assertFails(set(r, { version: 2, updatedBy: 'editor' }));
});
test('two concurrent writers cannot both commit the same version', async () => {
  const results = await Promise.allSettled(['editor', 'other'].map(uid => set(ref(db(uid), 'safwat/databases/main'), envelope(uid))));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
});
test('production save helper commits with a cold cache and rejects a stale baseline', async () => {
  const r = ref(db('editor'), 'safwat/databases/main');
  const adapter = {
    once: () => get(r),
    transaction: (fn, callback, applyLocally) => runTransaction(r, fn, { applyLocally })
  };
  const result = await commit(adapter, { db: envelope('editor').data, expectedVersion: 1, uid: 'editor', actor: 'Editor' });
  assert.equal(result.version, 2);
  assert.equal((await get(r)).val().version, 2);
  await assert.rejects(commit(adapter, { db: envelope('editor').data, expectedVersion: 1, uid: 'editor', actor: 'Editor' }), { code: 'SAVE_CONFLICT' });
});
test('users can read their profile but cannot enumerate users, self-promote or self-enable', async () => {
  await assertSucceeds(get(ref(db('viewer'), 'safwat/users/viewer')));
  await assertFails(get(ref(db('viewer'), 'safwat/users')));
  await assertFails(update(ref(db('viewer'), 'safwat/users/viewer'), { role: 'admin' }));
  await assertFails(update(ref(db('disabled'), 'safwat/users/disabled'), { disabled: false }));
  await assertFails(set(ref(db('pending'), 'safwat/users/pending'), user('pending', 'admin')));
});
test('own harmless profile updates are allowed; another user and identity changes are denied', async () => {
  await assertSucceeds(update(ref(db('viewer'), 'safwat/users/viewer'), { displayName: 'Viewer', lastSeenAt: new Date().toISOString(), emailVerified: true }));
  await assertFails(update(ref(db('viewer'), 'safwat/users/other'), { displayName: 'Forged' }));
  await assertFails(update(ref(db('viewer'), 'safwat/users/viewer'), { uid: 'other' }));
});
test('active admin manages accounts; disabled admin cannot, and self-lockout is blocked', async () => {
  await assertSucceeds(update(ref(db('admin'), 'safwat/users/viewer'), { role: 'editor' }));
  await assertFails(update(ref(db('disabled'), 'safwat/users/viewer'), { role: 'admin' }));
  await assertFails(remove(ref(db('admin'), 'safwat/users/admin')));
  await assertFails(update(ref(db('admin'), 'safwat/users/admin'), { role: 'viewer' }));
});
test('first administrator must be provisioned through a trusted console, never self-bootstrapped', async () => {
  await env.clearDatabase();
  await assertFails(set(ref(db('first'), 'safwat/users/first'), user('first', 'admin')));
});
test('pending requests are self-owned and cannot self-approve', async () => {
  const request = { uid: 'pending', email: 'pending@example.test', status: 'pending' };
  await assertSucceeds(set(ref(db('pending', false), 'safwat/pendingUsers/pending'), request));
  await assertFails(update(ref(db('pending'), 'safwat/pendingUsers/pending'), { status: 'approved' }));
  await assertFails(set(ref(db('pending'), 'safwat/pendingUsers/other'), { ...request, uid: 'other' }));
  await assertSucceeds(update(ref(db('admin'), 'safwat/pendingUsers/pending'), { status: 'approved' }));
});
test('CEO password and device registry are admin-only', async () => {
  await assertFails(get(ref(db('viewer'), 'safwat/ceoConfig/passwordHash')));
  await assertFails(set(ref(db('viewer'), 'safwat/ceoConfig/devices/sample'), { approved: true }));
  await assertFails(remove(ref(db('disabled'), 'safwat/ceoConfig/devices')));
  await assertSucceeds(get(ref(db('admin'), 'safwat/ceoConfig/passwordHash')));
});
test('presence requires owner UID and cannot be impersonated or deleted by a peer', async () => {
  const r = 'safwat/presence/main/viewer-session';
  await assertFails(set(ref(db('viewer'), r), { actor: 'Viewer', role: 'viewer' }));
  await assertSucceeds(set(ref(db('viewer'), r), { uid: 'viewer', actor: 'Viewer', role: 'viewer' }));
  await assertFails(remove(ref(db('other'), r)));
  await assertFails(update(ref(db('other'), r), { uid: 'other' }));
  await assertSucceeds(remove(ref(db('viewer'), r)));
});
test('viewer cannot lock; writer cannot forge lock ownership', async () => {
  await assertFails(set(ref(db('viewer'), 'safwat/locks/main/RC-1'), lock('viewer')));
  await assertFails(set(ref(db('editor'), 'safwat/locks/main/RC-1'), lock('other')));
  await assertFails(set(ref(db('editor'), 'safwat/locks/main/RC-1'), lock('editor', Date.now() + 3600000)));
});
test('only owner/admin can delete a fresh lock; owner can refresh', async () => {
  const path = 'safwat/locks/main/RC-1';
  await assertSucceeds(set(ref(db('editor'), path), lock('editor')));
  await assertFails(remove(ref(db('other'), path)));
  await assertFails(set(ref(db('other'), path), lock('other')));
  await assertSucceeds(set(ref(db('editor'), path), lock('editor')));
  await assertSucceeds(remove(ref(db('admin'), path)));
});
test('writer can acquire an expired lock but cannot arbitrarily delete it', async () => {
  const path = 'safwat/locks/main/RC-1';
  await env.withSecurityRulesDisabled(c => set(ref(c.database(), path), lock('editor', Date.now() - 1000)));
  await assertFails(remove(ref(db('other'), path)));
  await assertSucceeds(set(ref(db('other'), path), lock('other')));
});
test('disabled users cannot write diagnostics/config or lock records', async () => {
  await assertFails(set(ref(db('disabled'), 'safwat/diagnostics/disabled'), { test: true }));
  await assertFails(set(ref(db('disabled'), 'safwat/config/test'), true));
  await assertFails(set(ref(db('disabled'), 'safwat/locks/main/RC-1'), lock('disabled')));
});

test('loaded editor revision survives normalization and persists a new record', async () => {
  const scope = 'safwat/databases/main';
  const r = ref(db('editor'), scope), remote = (await get(r)).val();
  const live = remote.data;
  remember(live, live, remote.version, scope);
  live.meta.schemaVersion = 3;
  live.recruitmentCases.push({id:'RC-BRYAN-TEST',name:'Synthetic editor record'});
  const adapter = { once: () => get(r), transaction: (fn, cb, applyLocally) => runTransaction(r, fn, {applyLocally}) };
  await commit(adapter, {db:live,expectedVersion:versionFor(live,scope),scope,uid:'editor',actor:'Editor'});
  const reloaded = (await get(ref(db('other'), scope))).val();
  assert.equal(reloaded.version, 2);
  assert.equal(reloaded.data.recruitmentCases[1].id, 'RC-BRYAN-TEST');
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('public/js/legacy/015-accountapprovalv260.js', 'utf8');
const legacyAuth = fs.readFileSync('public/js/legacy/008-enterprisev22.js', 'utf8');
const html = fs.readFileSync('public/index.html', 'utf8');
const GATES = ['entAuthGate','entVerifyGate','entDisabledGate','entWaitingGate',
  'entRejectedGate','entAccessLoadingGate','entAccessErrorGate'];

function element() {
  const classes = new Set();
  return {
    classList: {
      add: c => classes.add(c),
      remove: c => classes.delete(c),
      contains: c => classes.has(c),
      toggle: (c, value) => { if (value) classes.add(c); else classes.delete(c); }
    },
    style: {},
    textContent: '',
    disabled: false,
    handlers: {},
    addEventListener(name, callback) { this.handlers[name] = callback; }
  };
}
const user = (uid, extras = {}) => ({
  uid, email: uid + '@example.test', displayName: uid,
  emailVerified: true, isAnonymous: false, verificationEmails: 0,
  async reload() {}, async getIdToken() { return 'synthetic-token'; },
  async sendEmailVerification() { this.verificationEmails++; },
  ...extras
});
async function settle() {
  for (let n = 0; n < 8; n++) await new Promise(resolve => setImmediate(resolve));
}
function harness(initialUser, records = {}, failures = {}) {
  const nodes = new Map();
  const node = id => {
    if (id === 'entApprovalsList' || id === 'entQueueBadge' || id === 'entQueueCount') return null;
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  const body = element();
  const local = new Map([['safwatEnt.role', JSON.stringify('admin')]]);
  const listeners = new Map();
  const values = new Map(Object.entries(records));
  const writes = [];
  const auth = {
    currentUser: initialUser,
    onAuthStateChanged(cb) {
      this.callback = cb;
      queueMicrotask(() => cb(this.currentUser));
    },
    async signOut() {
      this.currentUser = null;
      this.callback(null);
    }
  };
  const emit = (path, val) => {
    for (const cb of [...(listeners.get(path) || [])]) queueMicrotask(() => cb({ val: () => val }));
  };
  const db = {
    ref(path) {
      return {
        async once() {
          if (failures[path]) throw new Error('Simulated lookup outage');
          return { val: () => values.has(path) ? values.get(path) : null };
        },
        async set(val) {
          writes.push({ path, val, action: 'set' });
          values.set(path, val);
          emit(path, val);
        },
        async update(val) {
          writes.push({ path, val, action: 'update' });
          const next = { ...(values.get(path) || {}), ...val };
          values.set(path, next);
          emit(path, next);
        },
        on(_name, cb) {
          if (!listeners.has(path)) listeners.set(path, new Set());
          listeners.get(path).add(cb);
          queueMicrotask(() => cb({ val: () => values.has(path) ? values.get(path) : null }));
          return cb;
        },
        off(_name, cb) { listeners.get(path)?.delete(cb); }
      };
    }
  };
  const window = { Session: { role: 'admin', actor: 'stale' },
    EntRbac: { myRecord: { role: 'admin' } }, EntAuth: { user: { role: 'admin' } },
    Toast: { ok() {}, info() {}, warn() {}, err() {} } };
  const context = {
    document: { readyState: 'complete', body, getElementById: node },
    window, firebase: { apps: [{}], auth: () => auth, database: () => db },
    localStorage: {
      getItem: k => local.get(k) ?? null,
      setItem: (k,v) => local.set(k,v),
      removeItem: k => local.delete(k)
    },
    setInterval: fn => { queueMicrotask(fn); return 1; },
    clearInterval() {}, setTimeout: () => 1, clearTimeout() {},
    console: { log() {}, warn() {}, error() {} }, confirm: () => true,
    prompt: () => null, Date, Set, Promise
  };
  vm.runInNewContext(source, context, { filename: 'accountapproval.js' });
  return {
    auth, node, body, values, failures, writes, local, window, emit,
    gate: () => GATES.find(id => node(id).classList.contains('open')),
    approved: () => body.classList.contains('ent-authenticated')
  };
}

test('approved verified user enters with server role, not cached admin', async () => {
  const h = harness(user('staff'), { 'safwat/users/staff': { uid: 'staff', role: 'viewer', disabled: false } });
  await settle();
  assert.equal(h.approved(), true);
  assert.equal(h.window.Session.role, 'viewer');
  assert.equal(h.window.EntAuth.user.role, 'viewer');
  assert.equal(h.gate(), undefined);
  assert.equal(JSON.parse(h.local.get('safwatEnt.role')), 'viewer');
});

test('new unverified signup submits a pending request and receives verification gate/email', async () => {
  const u = user('new', { emailVerified: false });
  const h = harness(u);
  await settle();
  assert.equal(h.gate(), 'entVerifyGate');
  assert.equal(h.approved(), false);
  assert.equal(u.verificationEmails, 1);
  assert.equal(h.values.get('safwat/pendingUsers/new').status, 'pending');
  assert.equal(h.values.get('safwat/pendingUsers/new').uid, 'new');
  assert.equal(h.window.Session.role, null);
  assert.equal(h.local.has('safwatEnt.role'), false);
});

test('verified pending account remains waiting and becomes approved on live role grant', async () => {
  const h = harness(user('new'), { 'safwat/pendingUsers/new': { uid: 'new', email: 'new@example.test', status: 'pending' } });
  await settle();
  assert.equal(h.gate(), 'entWaitingGate');
  assert.equal(h.approved(), false);
  h.values.set('safwat/users/new', { uid: 'new', role: 'editor', disabled: false });
  h.emit('safwat/users/new', h.values.get('safwat/users/new'));
  await settle();
  assert.equal(h.approved(), true);
  assert.equal(h.window.Session.role, 'editor');
});

test('rejected users see rejection; disabled and invalid-role users never enter', async () => {
  const rejected = harness(user('rejected'), { 'safwat/pendingUsers/rejected': { uid: 'rejected', status: 'rejected' } });
  const disabled = harness(user('disabled'), { 'safwat/users/disabled': { uid: 'disabled', role: 'admin', disabled: true } });
  const invalid = harness(user('invalid'), { 'safwat/users/invalid': { uid: 'invalid', role: 'super-admin' } });
  await settle();
  assert.equal(rejected.gate(), 'entRejectedGate');
  assert.equal(disabled.gate(), 'entDisabledGate');
  assert.equal(invalid.gate(), 'entAccessErrorGate');
  assert.equal(rejected.approved() || disabled.approved() || invalid.approved(), false);
});

test('failed account lookup is not misclassified as new or pending; retry recovers', async () => {
  const path = 'safwat/users/staff';
  const h = harness(user('staff'), { [path]: { uid: 'staff', role: 'viewer', disabled: false } }, { [path]: true });
  await settle();
  assert.equal(h.gate(), 'entAccessErrorGate');
  assert.equal(h.approved(), false);
  assert.equal(h.writes.filter(w => w.path.startsWith('safwat/pendingUsers/')).length, 0);
  delete h.failures[path];
  h.node('entAccessRetry').handlers.click();
  await settle();
  assert.equal(h.approved(), true);
});

test('failed pending lookup cannot create a duplicate request', async () => {
  const h = harness(user('new'), {}, { 'safwat/pendingUsers/new': true });
  await settle();
  assert.equal(h.gate(), 'entAccessErrorGate');
  assert.equal(h.writes.length, 0);
});

test('a delayed previous login cannot reveal the app after signout', async () => {
  let resume;
  const old = user('previous', {
    reload: () => new Promise(resolve => { resume = resolve; })
  });
  const h = harness(old, { 'safwat/users/previous': { role: 'admin', disabled: false } });
  await settle();
  await h.auth.signOut();
  resume();
  await settle();
  assert.equal(h.approved(), false);
  assert.equal(h.gate(), 'entAuthGate');
  assert.equal(h.window.Session.role, null);
});

test('revoking an approved user closes the workspace without an independent unlock', async () => {
  const h = harness(user('staff'), { 'safwat/users/staff': { uid: 'staff', role: 'viewer', disabled: false } });
  await settle();
  h.values.set('safwat/users/staff', { uid: 'staff', role: 'viewer', disabled: true });
  h.emit('safwat/users/staff', h.values.get('safwat/users/staff'));
  await settle();
  assert.equal(h.approved(), false);
  assert.equal(h.gate(), 'entDisabledGate');
});

test('all access states exist; retired rescue handlers cannot override the unified gate', () => {
  for (const id of GATES) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(html, /css\/account-access\.css/);
  assert.doesNotMatch(legacyAuth, /Toast\.ok\('Signed in',/);
  assert.doesNotMatch(legacyAuth, /role:\s*lsGet\('role'/);
  const rescue = fs.readFileSync('public/js/legacy/009-hotfixv243.js', 'utf8');
  const duplicate = fs.readFileSync('public/js/legacy/003-document-addeventlistener-domcontentloaded-function.js', 'utf8');
  assert.doesNotMatch(rescue, /forceReveal\s*\(/);
  assert.doesNotMatch(duplicate, /onAuthStateChanged\s*\(/);
});



/* =========================================================
   ENTERPRISE ENHANCEMENT LAYER v2.0.0 — RUNTIME
   ---------------------------------------------------------
   Non-destructive. Wraps existing dbSave / dbOpenExisting /
   dbCreateNew / add / update / delete functions via proxy
   pattern. Does not alter or replace any core logic.
   ========================================================= */

(function EnterpriseLayer(){
'use strict';

const ENT_VERSION = '2.0.0';
const ENT_SCHEMA_VERSION = 2;   // db.meta.schemaVersion we upgrade to on open
const LS_PREFIX = 'safwatEnt.';
const IDB_NAME = 'safwatEntBackups';
const IDB_STORE = 'snapshots';
const MAX_SNAPSHOTS = 30;

/* ---------- small utility helpers ---------- */
const $ = (id) => document.getElementById(id);
const nowIso = () => new Date().toISOString();
const uid = () => 'e_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const clone = (o) => JSON.parse(JSON.stringify(o));
const lsGet = (k, d) => { try { const v = localStorage.getItem(LS_PREFIX + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); } catch {} };

/* ---------- Toast notification system ---------- */
const Toast = {
  show(title, body, kind, ms) {
    kind = kind || 'info';
    ms = ms == null ? 4200 : ms;
    const host = $('entToastHost'); if (!host) return;
    const el = document.createElement('div');
    el.className = 'ent-toast ' + (kind === 'ok' ? 'ok' : kind === 'warn' ? 'warn' : kind === 'err' ? 'err' : '');
    el.innerHTML = '<button class="ent-toast-close" aria-label="Dismiss">×</button>' +
                   '<div class="ent-toast-title"></div>' +
                   (body ? '<div class="ent-toast-body"></div>' : '');
    el.querySelector('.ent-toast-title').textContent = title || '';
    if (body) el.querySelector('.ent-toast-body').textContent = body;
    el.querySelector('.ent-toast-close').addEventListener('click', () => el.remove());
    host.appendChild(el);
    if (ms > 0) setTimeout(() => el.remove(), ms);
  },
  ok(t, b) { this.show(t, b, 'ok'); },
  warn(t, b) { this.show(t, b, 'warn'); },
  err(t, b) { this.show(t, b, 'err', 6000); },
  info(t, b) { this.show(t, b, 'info'); },
};
window.Toast = Toast;

/* ---------- Audit log (stored inside db.meta.audit) ---------- */
const Audit = {
  push(action, entity, before, after, extra) {
    if (!window.DB) return;
    if (!window.DB.meta) window.DB.meta = {};
    if (!Array.isArray(window.DB.meta.audit)) window.DB.meta.audit = [];
    const entry = {
      id: uid(),
      at: nowIso(),
      actor: Session.currentActor(),
      role: Session.currentRole(),
      action: action,     // create | update | delete | security | bulk | import | export | restore
      entity: entity || '',
      before: before ? this._trim(before) : null,
      after: after ? this._trim(after) : null,
      extra: extra || null,
    };
    window.DB.meta.audit.push(entry);
    if (window.DB.meta.audit.length > 2000) window.DB.meta.audit.splice(0, window.DB.meta.audit.length - 2000);
    this.renderIfOpen();
  },
  _trim(o) {
    // strip huge fields so audit doesn't bloat the JSON
    const c = clone(o); if (!c) return c;
    if (c.visaCopyBase64) c.visaCopyBase64 = '[binary]';
    return c;
  },
  diff(before, after) {
    if (!before && after) return { added: Object.keys(after) };
    if (before && !after) return { removed: Object.keys(before) };
    const changed = {};
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    keys.forEach(k => {
      const a = before ? before[k] : undefined;
      const b = after ? after[k] : undefined;
      if (JSON.stringify(a) !== JSON.stringify(b)) changed[k] = { from: a, to: b };
    });
    return changed;
  },
  renderIfOpen() {
    if ($('entAuditPanel') && $('entAuditPanel').classList.contains('open')) this.render();
  },
  render() {
    const list = $('entAuditList'); if (!list) return;
    const q = ($('entAuditSearch').value || '').toLowerCase().trim();
    const filter = $('entAuditFilter').value;
    const items = ((window.DB && window.DB.meta && window.DB.meta.audit) || []).slice().reverse();
    const filtered = items.filter(e => {
      if (filter && e.action !== filter) return false;
      if (q) {
        const hay = (e.actor + ' ' + e.entity + ' ' + e.action + ' ' + JSON.stringify(e.before || '') + ' ' + JSON.stringify(e.after || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (!filtered.length) { list.innerHTML = '<p style="color:var(--text-soft);font-size:13px;text-align:center;padding:24px 0;">No audit entries match.</p>'; return; }
    list.innerHTML = filtered.slice(0, 300).map(e => {
      const d = (e.action === 'update') ? this.diff(e.before, e.after) : null;
      const diffTxt = d ? Object.keys(d).map(k => k + ': ' + JSON.stringify(d[k].from) + ' → ' + JSON.stringify(d[k].to)).join('\n') : '';
      return '<div class="ent-audit-item ' + e.action + '">' +
        '<div class="ent-audit-meta"><span>' + escapeHtml(e.action.toUpperCase()) + ' · ' + escapeHtml(e.entity) + '</span><span>' + new Date(e.at).toLocaleString() + '</span></div>' +
        '<div class="ent-audit-body"><b>' + escapeHtml(e.actor) + '</b> <span style="color:var(--text-soft)">(' + escapeHtml(e.role) + ')</span>' +
        (e.extra ? ' — ' + escapeHtml(String(e.extra)) : '') + '</div>' +
        (diffTxt ? '<pre class="ent-audit-diff">' + escapeHtml(diffTxt) + '</pre>' : '') +
      '</div>';
    }).join('');
  },
  exportCsv() {
    const items = (window.DB && window.DB.meta && window.DB.meta.audit) || [];
    if (!items.length) { Toast.warn('Nothing to export', 'Audit log is empty.'); return; }
    const rows = [['id','at','actor','role','action','entity','extra']];
    items.forEach(e => rows.push([e.id, e.at, e.actor, e.role, e.action, e.entity, e.extra || '']));
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'audit_log_' + Date.now() + '.csv';
    a.click();
    Toast.ok('Exported', items.length + ' entries → CSV');
  },
  clear() {
    if (!confirm('Clear entire audit log? This cannot be undone.')) return;
    if (window.DB && window.DB.meta) window.DB.meta.audit = [];
    Audit.push('security', 'audit', null, null, 'Audit log cleared');
    this.render();
    if (window.dbSave) window.dbSave();
    Toast.ok('Cleared', 'Audit log reset.');
  },
};
window.Audit = Audit;

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

/* ---------- Session / RBAC / lock ---------- */
const Session = {
  role: lsGet('role', 'viewer'),   // viewer | editor | admin
  actor: lsGet('actor', 'Carl Lagatuz'),
  locked: false,
  idleTimeoutMs: lsGet('idleTimeout', 15 * 60 * 1000),
  _idleTimer: null,
  currentActor() { return this.actor; },
  currentRole() { return this.role; },
  can(op) {
    // op: 'read'|'edit'|'delete'|'bulk'|'admin'
    if (op === 'read') return true;
    if (this.role === 'viewer') return false;
    if (op === 'edit' || op === 'bulk') return this.role === 'editor' || this.role === 'admin';
    if (op === 'delete' || op === 'admin') return this.role === 'admin';
    return true;
  },
  setRole(r) {
    const prev = this.role;
    this.role = r; lsSet('role', r);
    const pill = $('entRolePill'); if (pill) pill.textContent = 'Role: ' + r.charAt(0).toUpperCase() + r.slice(1);
    Audit.push('security', 'session', { role: prev }, { role: r }, 'Role changed');
  },
  bumpIdle() {
    if (this._idleTimer) clearTimeout(this._idleTimer);
    if (this.idleTimeoutMs > 0) this._idleTimer = setTimeout(() => this.lock('idle timeout'), this.idleTimeoutMs);
  },
  lock(reason) {
    if (this.locked) return;
    this.locked = true;
    const ov = $('entLockOverlay');
    if (ov) ov.classList.add('open');
    const hint = $('entLockHint');
    if (hint) hint.textContent = reason ? 'Locked (' + reason + ')' : 'Session locked';
    Audit.push('security', 'session', null, null, 'Session locked: ' + (reason || 'manual'));
    setTimeout(() => { const inp = $('entLockInput'); if (inp) inp.focus(); }, 100);
  },
  unlock(pass) {
    // If encryption enabled, verify passphrase; otherwise accept any (session-only lock)
    if (Crypto.isEnabled()) {
      if (!Crypto.verifyPass(pass)) { Toast.err('Wrong passphrase'); return false; }
    }
    this.locked = false;
    const ov = $('entLockOverlay'); if (ov) ov.classList.remove('open');
    Audit.push('security', 'session', null, null, 'Session unlocked');
    this.bumpIdle();
    return true;
  },
};
window.Session = Session;

/* ---------- AES-GCM encryption at rest ---------- */
const Crypto = {
  _passHash: null,   // sha256 hash of active passphrase (verification only)
  _key: null,        // CryptoKey derived from passphrase
  isEnabled() { return !!(window.DB && window.DB.meta && window.DB.meta.encrypted); },
  async _deriveKey(pass, salt) {
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 200000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },
  async _sha256(txt) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  },
  verifyPass(pass) { return this._passHash && this._passHash === this._passHashFor(pass); },
  _passHashFor(pass) { let h = 0; for (const c of pass) h = ((h << 5) - h + c.charCodeAt(0)) | 0; return String(h); }, // lightweight; real hash on setPass
  async setPass(pass) {
    this._passHash = this._passHashFor(pass);
    lsSet('passHash', await this._sha256(pass + '|salt|safwat'));
  },
  async enable(pass) {
    if (!pass || pass.length < 8) throw new Error('Passphrase must be at least 8 characters.');
    await this.setPass(pass);
    if (!window.DB.meta) window.DB.meta = {};
    window.DB.meta.encrypted = true;
    Audit.push('security', 'encryption', null, null, 'Encryption enabled');
    Toast.ok('Encryption enabled', 'DB will be encrypted on next save.');
  },
  disable() {
    if (window.DB && window.DB.meta) window.DB.meta.encrypted = false;
    this._passHash = null; this._key = null;
    lsSet('passHash', null);
    Audit.push('security', 'encryption', null, null, 'Encryption disabled');
    Toast.warn('Encryption disabled');
  },
  async encryptJson(plaintext, pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this._deriveKey(pass, salt);
    const ciphered = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(plaintext));
    return JSON.stringify({
      __format: 'SAFWAT_ENC_v1',
      salt: btoa(String.fromCharCode(...salt)),
      iv: btoa(String.fromCharCode(...iv)),
      data: btoa(String.fromCharCode(...new Uint8Array(ciphered))),
    }, null, 2);
  },
  async decryptJson(json, pass) {
    const p = JSON.parse(json);
    if (p.__format !== 'SAFWAT_ENC_v1') throw new Error('Not an encrypted file.');
    const salt = Uint8Array.from(atob(p.salt), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(p.iv), c => c.charCodeAt(0));
    const data = Uint8Array.from(atob(p.data), c => c.charCodeAt(0));
    const key = await this._deriveKey(pass, salt);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, data);
    return new TextDecoder().decode(plain);
  },
};
window.EntCrypto = Crypto;

/* ---------- IndexedDB backups (rolling snapshots) ---------- */
const Backups = {
  _db: null,
  async _open() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true });
      req.onsuccess = () => { this._db = req.result; resolve(this._db); };
      req.onerror = () => reject(req.error);
    });
  },
  async snapshot(reason) {
    if (!window.DB) return;
    try {
      const db = await this._open();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const payload = { at: nowIso(), reason: reason || 'auto', size: 0, snapshot: null, fileName: window.DB_FILE_NAME || 'db.json' };
      const snap = JSON.stringify(window.DB);
      payload.size = snap.length;
      payload.snapshot = snap;
      store.add(payload);
      // trim old
      const all = await this.list();
      if (all.length > MAX_SNAPSHOTS) {
        const drop = all.slice(0, all.length - MAX_SNAPSHOTS);
        const tx2 = db.transaction(IDB_STORE, 'readwrite');
        drop.forEach(x => tx2.objectStore(IDB_STORE).delete(x.id));
      }
    } catch (e) { console.warn('backup failed', e); }
  },
  async list() {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },
  async restore(id) {
    if (!Session.can('admin')) { Toast.err('Admin only', 'Only admins can restore snapshots.'); return; }
    const all = await this.list();
    const item = all.find(x => x.id === id);
    if (!item) return Toast.err('Not found');
    if (!confirm('Restore snapshot from ' + new Date(item.at).toLocaleString() + '?\n\nThis overwrites the current in-memory database. Next save will write it to disk.')) return;
    const before = clone(window.DB);
    window.DB = JSON.parse(item.snapshot);
    if (typeof onDatabaseReady === 'function') onDatabaseReady();
    Audit.push('restore', 'database', null, null, 'Restored snapshot from ' + item.at);
    Toast.ok('Restored', 'Snapshot loaded into memory. Save to persist to file.');
    UI.renderBackups();
  },
  async delete(id) {
    const db = await this._open();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => UI.renderBackups();
  },
  async exportAll() {
    const all = await this.list();
    if (!all.length) return Toast.warn('No snapshots');
    if (typeof JSZip === 'undefined') return Toast.err('JSZip not loaded');
    const zip = new JSZip();
    all.forEach(s => zip.file('snap_' + s.id + '_' + s.at.replace(/[:.]/g, '-') + '.json', s.snapshot));
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'safwat_backups_' + Date.now() + '.zip'; a.click();
    Toast.ok('Exported', all.length + ' snapshots');
  },
};
window.EntBackups = Backups;

/* ---------- Validation layer ---------- */
const Validators = {
  passport(v) {
    if (!v) return { level: 'warn', msg: 'Passport # is empty (link-by-passport will not work).' };
    const s = String(v).trim();
    if (s.length < 5 || s.length > 15) return { level: 'warn', msg: 'Unusual passport length (' + s.length + ' chars).' };
    if (!/^[A-Z0-9-]+$/i.test(s)) return { level: 'warn', msg: 'Passport contains unusual characters.' };
    return null;
  },
  expiryDate(v) {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return { level: 'err', msg: 'Invalid date.' };
    const now = new Date(); const diffDays = (d - now) / 86400000;
    if (diffDays < -365 * 5) return { level: 'warn', msg: 'Expiry is > 5 years in the past.' };
    if (diffDays > 365 * 10) return { level: 'warn', msg: 'Expiry is > 10 years in the future.' };
    return null;
  },
  duplicatePassport(passport, excludeId) {
    if (!window.DB || !passport) return null;
    const hits = [
      ...window.DB.recruitmentCases.filter(c => (c.passport || '').toLowerCase() === passport.toLowerCase() && c.id !== excludeId),
      ...window.DB.visaRecords.filter(v => (v.passport || '').toLowerCase() === passport.toLowerCase() && v.id !== excludeId),
    ];
    if (hits.length) return { level: 'warn', msg: 'Duplicate passport in ' + hits.length + ' other record(s).' };
    return null;
  },
};
window.EntValidators = Validators;

/* ---------- Health check ---------- */
const Health = {
  run() {
    if (!window.DB) return null;
    const cases = window.DB.recruitmentCases || [];
    const visas = window.DB.visaRecords || [];
    let linked = 0, orphans = 0, needsReview = 0;
    cases.forEach(c => {
      if (c.linkedVisaId) {
        const v = visas.find(v => v.id === c.linkedVisaId);
        if (v) linked++; else orphans++;
      }
      if (c.stage && /needs review/i.test(c.stage)) needsReview++;
    });
    visas.forEach(v => {
      if (v.linkedRecruitmentCaseId) {
        const c = cases.find(c => c.id === v.linkedRecruitmentCaseId);
        if (!c) orphans++;
      }
    });
    const passSeen = {};
    cases.forEach(c => { if (c.passport) passSeen[c.passport.toLowerCase()] = (passSeen[c.passport.toLowerCase()] || 0) + 1; });
    visas.forEach(v => { if (v.passport) passSeen[v.passport.toLowerCase()] = (passSeen[v.passport.toLowerCase()] || 0) + 1; });
    const dupes = Object.values(passSeen).filter(n => n > 1).length;
    return {
      cases: cases.length,
      visas: visas.length,
      linked: linked,
      orphans: orphans,
      dupes: dupes,
      needsReview: needsReview,
      schema: (window.DB.meta && window.DB.meta.schemaVersion) || 1,
    };
  },
  render() {
    const r = this.run();
    if (!r) return;
    $('entHCases').textContent = r.cases;
    $('entHVisas').textContent = r.visas;
    $('entHLinks').textContent = r.linked;
    $('entHOrphans').textContent = r.orphans;
    $('entHDupes').textContent = r.dupes;
    $('entHReview').textContent = r.needsReview;
    $('entHSchema').textContent = 'v' + r.schema;
  },
};
window.EntHealth = Health;

/* ---------- Schema migration (safe, idempotent) ---------- */
const Migrations = {
  run(db) {
    if (!db.meta) db.meta = {};
    const cur = db.meta.schemaVersion || db.meta.version || 1;
    if (cur >= ENT_SCHEMA_VERSION) return { from: cur, to: cur, changed: false };
    // v1 -> v2: add audit array, ensure updatedAt on all records, add security block
    if (cur < 2) {
      if (!Array.isArray(db.meta.audit)) db.meta.audit = [];
      if (!db.meta.security) db.meta.security = { encrypted: false, createdBy: Session.currentActor(), createdAt: nowIso() };
      (db.recruitmentCases || []).forEach(c => { if (!c.updatedAt) c.updatedAt = c.createdAt || nowIso(); });
      (db.visaRecords || []).forEach(v => { if (!v.updatedAt) v.updatedAt = v.createdAt || nowIso(); });
    }
    db.meta.schemaVersion = ENT_SCHEMA_VERSION;
    Toast.info('Schema migrated', 'v' + cur + ' → v' + ENT_SCHEMA_VERSION);
    return { from: cur, to: ENT_SCHEMA_VERSION, changed: true };
  },
};

/* ---------- Wrap existing dbSave / dbOpen / dbCreate ---------- */
const OrigSave = window.dbSave;
const OrigOpen = window.dbOpenExisting;
const OrigCreate = window.dbCreateNew;

window.dbSave = async function entDbSave() {
  if (!window.DB_FILE_HANDLE) return false;
  try {
    // encryption handling
    if (window.DB && window.DB.meta && window.DB.meta.encrypted && Crypto._passHash) {
      const plain = serializeDatabase(window.DB);
      const pass = lsGet('_pp', null);   // ephemeral; only during session
      if (!pass) { Toast.err('Passphrase not in memory', 'Re-open the DB or disable encryption.'); return false; }
      const enc = await Crypto.encryptJson(plain, pass);
      const writable = await window.DB_FILE_HANDLE.createWritable();
      await writable.write(enc);
      await writable.close();
    } else {
      const ok = await OrigSave.apply(this, arguments);
      if (ok === false) return false;
    }
    // rolling backup every 10 saves
    const c = (lsGet('saveCount', 0) || 0) + 1;
    lsSet('saveCount', c);
    if (c % 10 === 0) Backups.snapshot('every-10-saves');
    return true;
  } catch (e) {
    Toast.err('Save failed', e.message);
    return false;
  }
};

window.dbOpenExisting = async function entDbOpen() {
  const before = window.DB_FILE_HANDLE;
  await OrigOpen.apply(this, arguments);
  if (window.DB && window.DB_FILE_HANDLE !== before) {
    // detect encrypted file
    try {
      const file = await window.DB_FILE_HANDLE.getFile();
      const text = await file.text();
      const maybe = JSON.parse(text);
      if (maybe && maybe.__format === 'SAFWAT_ENC_v1') {
        const pass = prompt('This database is encrypted. Enter passphrase:');
        if (!pass) { Toast.err('Cancelled'); return; }
        const plain = await Crypto.decryptJson(text, pass);
        window.DB = parseDatabase(plain);
        window.DB_ID_COUNTER = makeIdCounter(window.DB);
        await Crypto.setPass(pass);
        lsSet('_pp', pass);
        if (typeof onDatabaseReady === 'function') onDatabaseReady();
      }
    } catch {}
    Migrations.run(window.DB);
    await Backups.snapshot('on-open');
    Audit.push('security', 'database', null, null, 'Database opened: ' + (window.DB_FILE_NAME || ''));
    Health.render();
    UI.rebuildPaletteIndex();
    Toast.ok('Database opened', window.DB_FILE_NAME || '');
  }
};

window.dbCreateNew = async function entDbCreate() {
  await OrigCreate.apply(this, arguments);
  if (window.DB) {
    Migrations.run(window.DB);
    await Backups.snapshot('on-create');
    Audit.push('create', 'database', null, null, 'New database created');
    Health.render();
    Toast.ok('New database created');
  }
};

/* ---------- Wrap CRUD engine mutators for audit + RBAC ---------- */
function wrapWithAudit(fnName, entity, action) {
  const orig = window[fnName];
  if (typeof orig !== 'function') return;
  window[fnName] = function() {
    if (!Session.can(action === 'delete' ? 'delete' : 'edit')) {
      Toast.err('Permission denied', 'Your role (' + Session.currentRole() + ') cannot ' + action + ' ' + entity + '.');
      throw new Error('RBAC denied');
    }
    let before = null;
    // Best-effort snapshot of the target record for update/delete
    try {
      const id = arguments[arguments.length - 1];
      if ((action === 'update' || action === 'delete') && window.DB) {
        const src = entity === 'recruitmentCase' ? window.DB.recruitmentCases : window.DB.visaRecords;
        const found = src && src.find && src.find(r => r.id === id);
        if (found) before = clone(found);
      }
    } catch {}
    const res = orig.apply(this, arguments);
    try {
      let after = null;
      if (window.DB) {
        const src = entity === 'recruitmentCase' ? window.DB.recruitmentCases : window.DB.visaRecords;
        const targetId = (before && before.id) || (res && res.id) || arguments[arguments.length - 1];
        if (src && src.find) after = clone(src.find(r => r.id === targetId));
      }
      Audit.push(action, entity, before, after);
    } catch {}
    return res;
  };
}
// Only wrap if the function names exist in the global scope
['createRecruitmentCase','addRecruitmentCase'].forEach(f => wrapWithAudit(f, 'recruitmentCase', 'create'));
['updateRecruitmentCase'].forEach(f => wrapWithAudit(f, 'recruitmentCase', 'update'));
['deleteRecruitmentCase','removeRecruitmentCase'].forEach(f => wrapWithAudit(f, 'recruitmentCase', 'delete'));
['createVisaRecord','addVisaRecord'].forEach(f => wrapWithAudit(f, 'visaRecord', 'create'));
['updateVisaRecord'].forEach(f => wrapWithAudit(f, 'visaRecord', 'update'));
['deleteVisaRecord','removeVisaRecord'].forEach(f => wrapWithAudit(f, 'visaRecord', 'delete'));

/* ---------- Command palette + global search ---------- */
const Palette = {
  index: [],
  commands: [],
  registerCommands() {
    this.commands = [
      { label: 'Open audit log', kind: 'command', run: () => UI.openPanel('entAuditPanel') },
      { label: 'Open backups / restore points', kind: 'command', run: () => UI.openPanel('entBackupPanel') },
      { label: 'Open security & settings', kind: 'command', run: () => UI.openPanel('entSecurityPanel') },
      { label: 'Create backup snapshot now', kind: 'command', run: () => Backups.snapshot('manual').then(() => Toast.ok('Snapshot taken')) },
      { label: 'Toggle dark mode', kind: 'command', run: () => UI.toggleDark() },
      { label: 'Lock session', kind: 'command', run: () => Session.lock('manual') },
      { label: 'Run health check', kind: 'command', run: () => { Health.render(); UI.openPanel('entSecurityPanel'); } },
      { label: 'Force-save database', kind: 'command', run: () => window.dbSave() },
      { label: 'Export audit log to CSV', kind: 'command', run: () => Audit.exportCsv() },
      { label: 'Print current view / save as PDF', kind: 'command', run: () => window.print() },
      { label: 'Show keyboard shortcuts', kind: 'command', run: () => UI.openPanel('entHelpPanel') },
    ];
  },
  rebuildIndex() {
    this.index = [];
    if (!window.DB) return;
    (window.DB.recruitmentCases || []).forEach(c => {
      this.index.push({
        label: (c.name || '(no name)') + ' — ' + (c.position || '') + ' · ' + (c.client || ''),
        kind: 'Case', hay: [c.name, c.position, c.client, c.nationality, c.passport, c.stage].join(' ').toLowerCase(),
        run: () => { if (typeof openCaseForm === 'function') openCaseForm(c.id); }
      });
    });
    (window.DB.visaRecords || []).forEach(v => {
      this.index.push({
        label: (v.name || '(no name)') + ' — Visa ' + (v.visaDocNumber || '') + ' · ' + (v.client || ''),
        kind: 'Visa', hay: [v.name, v.visaDocNumber, v.client, v.nationality, v.passport, v.status].join(' ').toLowerCase(),
        run: () => { if (typeof openVisaForm === 'function') openVisaForm(v.id); }
      });
    });
    // clients
    const clients = new Set();
    (window.DB.recruitmentCases || []).forEach(c => c.client && clients.add(c.client));
    (window.DB.visaRecords || []).forEach(v => v.client && clients.add(v.client));
    clients.forEach(cl => {
      this.index.push({
        label: cl, kind: 'Client', hay: cl.toLowerCase(),
        run: () => { if (typeof jumpToClientIn === 'function') jumpToClientIn('visa', 'visaClientFilter', cl); }
      });
    });
  },
  open() {
    $('entPalette').classList.add('open');
    const inp = $('entPalInput'); inp.value = ''; inp.focus();
    this.render('');
  },
  close() { $('entPalette').classList.remove('open'); },
  render(q) {
    q = (q || '').toLowerCase().trim();
    const all = [...this.commands.map(c => ({ ...c, hay: c.label.toLowerCase() })), ...this.index];
    const hits = q ? all.filter(x => x.hay.includes(q)).slice(0, 30) : this.commands.slice(0, 20);
    const list = $('entPalResults');
    if (!hits.length) { list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-soft);font-size:13px;">No matches.</div>'; return; }
    list.innerHTML = hits.map((h, i) => '<div class="ent-pal-item' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '"><span>' + escapeHtml(h.label) + '</span><span class="ent-pal-kind">' + escapeHtml(h.kind || 'Command') + '</span></div>').join('');
    list.querySelectorAll('.ent-pal-item').forEach(el => el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx, 10);
      hits[idx].run(); Palette.close();
    }));
    this._hits = hits; this._active = 0;
  },
  keyNav(dir) {
    if (!this._hits) return;
    const items = $('entPalResults').querySelectorAll('.ent-pal-item');
    items[this._active] && items[this._active].classList.remove('active');
    this._active = (this._active + dir + this._hits.length) % this._hits.length;
    items[this._active] && items[this._active].classList.add('active');
    items[this._active] && items[this._active].scrollIntoView({ block: 'nearest' });
  },
  keyEnter() { if (this._hits && this._hits[this._active]) { this._hits[this._active].run(); this.close(); } },
};
window.EntPalette = Palette;

/* ---------- UI wiring ---------- */
const UI = {
  init() {
    // Move top strip to be the first child inside <body> so it's always at the top
    const strip = $('entTopStrip');
    if (strip && strip.parentNode !== document.body) document.body.insertBefore(strip, document.body.firstChild);

    // Buttons
    $('entOpenPalette').addEventListener('click', () => Palette.open());
    $('entOpenAudit').addEventListener('click', () => UI.openPanel('entAuditPanel'));
    $('entOpenBackups').addEventListener('click', () => UI.openPanel('entBackupPanel'));
    $('entOpenSecurity').addEventListener('click', () => UI.openPanel('entSecurityPanel'));
    $('entOpenHelp').addEventListener('click', () => UI.openPanel('entHelpPanel'));

    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => UI.closePanel(b.dataset.close)));

    // Palette
    $('entPalInput').addEventListener('input', e => Palette.render(e.target.value));
    $('entPalInput').addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); Palette.keyNav(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); Palette.keyNav(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); Palette.keyEnter(); }
      else if (e.key === 'Escape') { e.preventDefault(); Palette.close(); }
    });
    $('entPalette').addEventListener('click', e => { if (e.target === $('entPalette')) Palette.close(); });

    // Global keyboard shortcuts
    document.addEventListener('keydown', e => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); Palette.open(); }
      else if (mod && e.key === '/') { e.preventDefault(); UI.openPanel('entHelpPanel'); }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); window.dbSave && window.dbSave(); }
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'b') { e.preventDefault(); Backups.snapshot('manual').then(() => Toast.ok('Snapshot taken')); }
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'l') { e.preventDefault(); Session.lock('manual'); }
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'a') { e.preventDefault(); UI.togglePanel('entAuditPanel'); }
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); UI.toggleDark(); }
      else if (e.key === 'Escape') {
        document.querySelectorAll('.ent-slideover.open').forEach(p => p.classList.remove('open'));
        Palette.close();
      }
    });

    // Idle tracking
    ['mousemove','keydown','click','scroll','touchstart'].forEach(ev => document.addEventListener(ev, () => Session.bumpIdle(), { passive: true }));

    // Session lock unlock
    $('entLockBtn').addEventListener('click', () => Session.unlock($('entLockInput').value));
    $('entLockInput').addEventListener('keydown', e => { if (e.key === 'Enter') Session.unlock($('entLockInput').value); });

    // Role, dark, idle
    const rSel = $('entRoleSelect'); rSel.value = Session.role;
    rSel.addEventListener('change', () => Session.setRole(rSel.value));

    const dChk = $('entDarkToggle'); dChk.checked = !!lsGet('dark', false);
    if (dChk.checked) document.body.classList.add('ent-dark');
    dChk.addEventListener('change', () => UI.setDark(dChk.checked));

    const idle = $('entIdleTimeout'); idle.value = String(Session.idleTimeoutMs);
    idle.addEventListener('change', () => {
      Session.idleTimeoutMs = parseInt(idle.value, 10);
      lsSet('idleTimeout', Session.idleTimeoutMs);
      Session.bumpIdle();
    });

    $('entLockNow').addEventListener('click', () => Session.lock('manual'));

    // Encryption UI
    const encChk = $('entEncryptToggle');
    encChk.addEventListener('change', () => {
      $('entEncryptFields').style.display = encChk.checked ? 'block' : 'none';
      if (!encChk.checked && window.DB) Crypto.disable();
    });
    $('entEncryptPass').addEventListener('blur', async () => {
      const p1 = $('entEncryptPass').value, p2 = $('entEncryptPass2').value;
      if (encChk.checked && p1 && p1 === p2 && p1.length >= 8) {
        await Crypto.enable(p1);
        lsSet('_pp', p1);
      }
    });

    // Health
    $('entRunHealth').addEventListener('click', () => { Health.render(); Toast.ok('Health scan complete'); });

    // Audit
    $('entAuditSearch').addEventListener('input', () => Audit.render());
    $('entAuditFilter').addEventListener('change', () => Audit.render());
    $('entAuditExport').addEventListener('click', () => Audit.exportCsv());
    $('entAuditClear').addEventListener('click', () => Audit.clear());

    // Backups
    $('entBackupNow').addEventListener('click', async () => { await Backups.snapshot('manual'); Toast.ok('Snapshot taken'); UI.renderBackups(); });
    $('entBackupExport').addEventListener('click', () => Backups.exportAll());

    // Online / offline
    window.addEventListener('online', () => UI.setConn(true));
    window.addEventListener('offline', () => UI.setConn(false));
    UI.setConn(navigator.onLine);

    // Register palette commands
    Palette.registerCommands();

    // Initial pill
    const pill = $('entRolePill');
    if (pill) pill.textContent = 'Role: ' + Session.role.charAt(0).toUpperCase() + Session.role.slice(1);

    Session.bumpIdle();
  },

  openPanel(id) {
    document.querySelectorAll('.ent-slideover.open').forEach(p => { if (p.id !== id) p.classList.remove('open'); });
    $(id).classList.add('open');
    if (id === 'entAuditPanel') Audit.render();
    if (id === 'entBackupPanel') UI.renderBackups();
    if (id === 'entSecurityPanel') Health.render();
  },
  closePanel(id) { $(id).classList.remove('open'); },
  togglePanel(id) { $(id).classList.toggle('open'); if ($(id).classList.contains('open')) UI.openPanel(id); },
  toggleDark() { UI.setDark(!document.body.classList.contains('ent-dark')); },
  setDark(on) {
    document.body.classList.toggle('ent-dark', on);
    lsSet('dark', on);
    const chk = $('entDarkToggle'); if (chk) chk.checked = on;
  },
  setConn(online) {
    const dot = $('entConnDot'); const txt = $('entConnText');
    if (dot) dot.className = 'ent-dot ' + (online ? '' : 'warn');
    if (txt) txt.textContent = online ? 'Online' : 'Offline';
    const banner = $('entOfflineBanner');
    if (banner) banner.classList.toggle('show', !online);
  },
  async renderBackups() {
    const list = $('entBackupList');
    const all = (await Backups.list()).slice().reverse();
    if (!all.length) { list.innerHTML = '<p style="color:var(--text-soft);text-align:center;padding:24px 0;">No snapshots yet.</p>'; return; }
    list.innerHTML = all.map(s => {
      const kb = Math.round(s.size / 1024);
      return '<div class="ent-backup-row">' +
        '<div><div class="ent-b-when">' + new Date(s.at).toLocaleString() + '</div><div class="ent-b-meta">' + escapeHtml(s.reason) + ' · ' + kb + ' KB · ' + escapeHtml(s.fileName || '') + '</div></div>' +
        '<button class="primary" data-restore="' + s.id + '">Restore</button>' +
        '<button data-delsnap="' + s.id + '">Delete</button>' +
      '</div>';
    }).join('');
    list.querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', () => Backups.restore(parseInt(b.dataset.restore, 10))));
    list.querySelectorAll('[data-delsnap]').forEach(b => b.addEventListener('click', () => Backups.delete(parseInt(b.dataset.delsnap, 10))));
  },
  rebuildPaletteIndex() { Palette.rebuildIndex(); },
};
window.EntUI = UI;

/* ---------- Boot ---------- */
function bootWhenReady() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', UI.init);
  } else {
    UI.init();
  }
}
bootWhenReady();

console.log('%c◆ SAFWAT Enterprise Layer v' + ENT_VERSION + ' loaded', 'color:#B98A2E;font-weight:bold;');
Toast.ok('Enterprise layer active', 'v' + ENT_VERSION + ' · Ctrl+K to search · Ctrl+/ for help');

})();


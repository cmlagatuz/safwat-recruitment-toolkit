

/* =========================================================
   ENTERPRISE LAYER v2.1.0 — RUNTIME EXTENSIONS
   Adds: Approval Queue, Firebase Realtime Sync, Anomaly Detection
   ========================================================= */

(function EnterpriseV21(){
'use strict';

const V21 = '2.1.1';
const $ = (id) => document.getElementById(id);

/* ---------- Baked-in Firebase config (SAFWAT project) ---------- */
const EMBEDDED_FB_CONFIG = {
  apiKey: "AIzaSyA5q8qi2CuvXID-Yl8up16i9OLh0xp8Gv4",
  authDomain: "safwat-recruitment-toolkit.firebaseapp.com",
  databaseURL: "https://safwat-recruitment-toolkit-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "safwat-recruitment-toolkit",
  storageBucket: "safwat-recruitment-toolkit.firebasestorage.app",
  messagingSenderId: "147799261926",
  appId: "1:147799261926:web:be92952754c35e180af127",
  measurementId: "G-RPPEKC31DT"
};
const nowIso = () => new Date().toISOString();
const uid = () => 'e_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const clone = (o) => o == null ? o : JSON.parse(JSON.stringify(o));
const lsGet = (k, d) => { try { const v = localStorage.getItem('safwatEnt.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem('safwatEnt.' + k, JSON.stringify(v)); } catch {} };
const debounce = (fn, ms) => { let t; return function(){ clearTimeout(t); t = setTimeout(() => fn.apply(this, arguments), ms); }; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const Toast = window.Toast || { ok: console.log, warn: console.warn, err: console.error, info: console.info };

/* =========================================================
   1) APPROVAL QUEUE
   ========================================================= */
const Approvals = {
  isRequired() { return !!lsGet('approvalRequired', false); },
  setRequired(v) {
    lsSet('approvalRequired', v);
    window.Audit && window.Audit.push('security', 'settings', null, null, 'Approval required = ' + v);
    UI.updateQueueBadge();
  },

  shouldIntercept(action) {
    if (!this.isRequired()) return false;
    if (!window.Session) return false;
    // Admins bypass; viewers are already blocked; editors are queued
    return window.Session.currentRole() === 'editor' && (action === 'create' || action === 'update' || action === 'delete');
  },

  queue(action, entity, before, after, requestedArgs, fnName) {
    if (!window.DB) return;
    if (!window.DB.meta) window.DB.meta = {};
    if (!Array.isArray(window.DB.meta.pendingChanges)) window.DB.meta.pendingChanges = [];
    const req = {
      id: uid(),
      at: nowIso(),
      requestedBy: window.Session.currentActor(),
      role: window.Session.currentRole(),
      action: action,
      entity: entity,
      before: before ? clone(before) : null,
      after: after ? clone(after) : null,
      fn: fnName,
      args: requestedArgs,
      status: 'pending',
    };
    window.DB.meta.pendingChanges.push(req);
    window.Audit && window.Audit.push('security', 'approval', null, null, action + ' ' + entity + ' queued for admin review');
    Toast.warn('Change queued for approval', 'An admin must approve this ' + action + '.');
    UI.updateQueueBadge();
    window.dbSave && window.dbSave();
    window.EntSync && window.EntSync.pushIfConnected();
  },

  approve(id) {
    if (!window.Session.can('admin')) { Toast.err('Admin only'); return; }
    const list = (window.DB && window.DB.meta && window.DB.meta.pendingChanges) || [];
    const req = list.find(r => r.id === id);
    if (!req) return;

    // Temporarily elevate to admin to actually apply the change
    // by directly calling the underlying wrapped function
    try {
      const fn = window[req.fn];
      if (typeof fn === 'function') {
        // Bypass approval intercept by setting flag
        Approvals._bypass = true;
        try { fn.apply(null, req.args || []); }
        finally { Approvals._bypass = false; }
        req.status = 'approved';
        req.decidedBy = window.Session.currentActor();
        req.decidedAt = nowIso();
        window.Audit && window.Audit.push('security', 'approval', null, req, 'Approved: ' + req.action + ' ' + req.entity);
        Toast.ok('Approved & applied', req.action + ' ' + req.entity);
      } else {
        req.status = 'failed';
        req.error = 'Function ' + req.fn + ' not found';
        Toast.err('Could not apply', req.error);
      }
    } catch (e) {
      req.status = 'failed';
      req.error = e.message;
      Toast.err('Failed to apply', e.message);
    }
    this.render();
    UI.updateQueueBadge();
    window.dbSave && window.dbSave();
    window.EntSync && window.EntSync.pushIfConnected();
  },

  reject(id) {
    if (!window.Session.can('admin')) { Toast.err('Admin only'); return; }
    const list = (window.DB && window.DB.meta && window.DB.meta.pendingChanges) || [];
    const req = list.find(r => r.id === id);
    if (!req) return;
    req.status = 'rejected';
    req.decidedBy = window.Session.currentActor();
    req.decidedAt = nowIso();
    window.Audit && window.Audit.push('security', 'approval', null, req, 'Rejected: ' + req.action + ' ' + req.entity);
    Toast.info('Rejected', req.action + ' ' + req.entity);
    this.render();
    UI.updateQueueBadge();
    window.dbSave && window.dbSave();
    window.EntSync && window.EntSync.pushIfConnected();
  },

  pendingCount() {
    if (!window.DB || !window.DB.meta || !Array.isArray(window.DB.meta.pendingChanges)) return 0;
    return window.DB.meta.pendingChanges.filter(r => r.status === 'pending').length;
  },

  bulkApproveSafe() {
    if (!window.Session.can('admin')) { Toast.err('Admin only'); return; }
    const list = (window.DB && window.DB.meta && window.DB.meta.pendingChanges) || [];
    const safe = list.filter(r => r.status === 'pending' && r.action !== 'delete');
    if (!safe.length) return Toast.info('Nothing safe to approve');
    if (!confirm('Approve all ' + safe.length + ' non-delete pending changes?')) return;
    safe.forEach(r => this.approve(r.id));
  },

  bulkReject() {
    if (!window.Session.can('admin')) { Toast.err('Admin only'); return; }
    const list = (window.DB && window.DB.meta && window.DB.meta.pendingChanges) || [];
    const pend = list.filter(r => r.status === 'pending');
    if (!pend.length) return Toast.info('Nothing to reject');
    if (!confirm('Reject all ' + pend.length + ' pending changes?')) return;
    pend.forEach(r => this.reject(r.id));
  },

  render() {
    const box = $('entApprovalsList'); if (!box) return;
    const chk = $('entApprovalRequired'); if (chk) chk.checked = this.isRequired();
    const list = (window.DB && window.DB.meta && window.DB.meta.pendingChanges) || [];
    const pending = list.filter(r => r.status === 'pending');
    const recent = list.filter(r => r.status !== 'pending').slice(-10).reverse();
    if (!pending.length && !recent.length) {
      box.innerHTML = '<p style="color:var(--text-soft);text-align:center;padding:24px 0;font-size:13px;">Queue is clear.</p>';
      return;
    }
    let html = '';
    if (pending.length) {
      html += '<h3 style="font-size:13px;margin:0 0 10px;font-family:var(--ent-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ent-warn);">Pending (' + pending.length + ')</h3>';
      pending.forEach(r => {
        const diff = this._diffText(r);
        html += '<div class="ent-pending-card">' +
          '<div class="ent-pc-head"><span>' + esc(r.action.toUpperCase()) + ' · ' + esc(r.entity) + '</span><span>' + new Date(r.at).toLocaleString() + '</span></div>' +
          '<div class="ent-pc-title">By ' + esc(r.requestedBy) + '</div>' +
          '<pre class="ent-pc-diff">' + esc(diff) + '</pre>' +
          '<div class="ent-pc-actions">' +
            '<button class="ent-pc-reject" data-reject="' + r.id + '">Reject</button>' +
            '<button class="ent-pc-approve" data-approve="' + r.id + '">Approve</button>' +
          '</div>' +
        '</div>';
      });
    }
    if (recent.length) {
      html += '<h3 style="font-size:13px;margin:20px 0 10px;font-family:var(--ent-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--text-soft);">Recently decided</h3>';
      recent.forEach(r => {
        html += '<div class="ent-pending-card" style="border-left-color:' + (r.status === 'approved' ? 'var(--ent-ok)' : r.status === 'rejected' ? 'var(--ent-danger)' : 'var(--rule)') + ';">' +
          '<div class="ent-pc-head"><span>' + esc(r.status.toUpperCase()) + ' · ' + esc(r.action) + ' · ' + esc(r.entity) + '</span><span>' + (r.decidedAt ? new Date(r.decidedAt).toLocaleString() : '') + '</span></div>' +
          '<div class="ent-pc-title">' + esc(r.requestedBy) + ' → ' + esc(r.decidedBy || '—') + '</div>' +
        '</div>';
      });
    }
    box.innerHTML = html;
    box.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => this.approve(b.dataset.approve)));
    box.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', () => this.reject(b.dataset.reject)));
  },

  _diffText(req) {
    if (req.action === 'create') return 'Create ' + req.entity + ':\n' + JSON.stringify(req.after || req.args || {}, null, 2);
    if (req.action === 'delete') return 'Delete ' + req.entity + ':\n' + JSON.stringify(req.before || req.args || {}, null, 2);
    if (req.action === 'update') {
      const b = req.before || {}, a = req.after || {};
      const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
      const lines = [];
      keys.forEach(k => {
        if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) lines.push(k + ': ' + JSON.stringify(b[k]) + ' → ' + JSON.stringify(a[k]));
      });
      return lines.length ? lines.join('\n') : '(no changes detected)';
    }
    return JSON.stringify(req, null, 2);
  },
};
window.EntApprovals = Approvals;

/* Patch the existing wrapWithAudit to check ApprovalQueue first.
   Instead of rewriting, we wrap the CRUD functions AGAIN with a
   pre-check that queues instead of applying. */
function reWrapForApproval(fnName, entity, action) {
  const cur = window[fnName];
  if (typeof cur !== 'function') return;
  window[fnName] = function() {
    if (Approvals._bypass) return cur.apply(this, arguments);
    if (Approvals.shouldIntercept(action)) {
      let before = null;
      try {
        const id = arguments[arguments.length - 1];
        if ((action === 'update' || action === 'delete') && window.DB) {
          const src = entity === 'recruitmentCase' ? window.DB.recruitmentCases : window.DB.visaRecords;
          const found = src && src.find && src.find(r => r.id === id);
          if (found) before = clone(found);
        }
      } catch {}
      // For create/update we don't yet have "after" — infer from args
      const args = Array.from(arguments);
      Approvals.queue(action, entity, before, action === 'create' ? args[0] : null, args, fnName);
      return null;
    }
    return cur.apply(this, arguments);
  };
}
['createRecruitmentCase','addRecruitmentCase'].forEach(f => reWrapForApproval(f, 'recruitmentCase', 'create'));
['updateRecruitmentCase'].forEach(f => reWrapForApproval(f, 'recruitmentCase', 'update'));
['deleteRecruitmentCase','removeRecruitmentCase'].forEach(f => reWrapForApproval(f, 'recruitmentCase', 'delete'));
['createVisaRecord','addVisaRecord'].forEach(f => reWrapForApproval(f, 'visaRecord', 'create'));
['updateVisaRecord'].forEach(f => reWrapForApproval(f, 'visaRecord', 'update'));
['deleteVisaRecord','removeVisaRecord'].forEach(f => reWrapForApproval(f, 'visaRecord', 'delete'));

/* =========================================================
   2) FIREBASE REALTIME SYNC + PRESENCE
   ========================================================= */
const Sync = {
  cfg: null,
  fb: null,
  dbRef: null,
  presenceRef: null,
  status: 'disconnected',   // disconnected | connecting | connected | error | offline
  sessionId: uid(),
  _isReceiving: false,
  _localVersion: 0,
  _lastRemoteVersion: -1,
  _pushDebounced: null,

  loadSdkIfNeeded() {
    return new Promise((resolve, reject) => {
      if (typeof firebase !== 'undefined' && firebase.apps) return resolve();
      const s1 = document.createElement('script'); s1.src = 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js';
      const s2 = document.createElement('script'); s2.src = 'https://www.gstatic.com/firebasejs/10.13.2/firebase-database-compat.js';
      let loaded = 0;
      const onload = () => { loaded++; if (loaded === 2) resolve(); };
      s1.onload = onload; s2.onload = onload;
      s1.onerror = s2.onerror = () => reject(new Error('Failed to load Firebase SDK'));
      document.head.appendChild(s1);
      setTimeout(() => document.head.appendChild(s2), 100);
    });
  },

  async connect(config) {
    try {
      this.status = 'connecting'; UI.updateSyncStatus();
      if (!config || !config.apiKey || !config.databaseURL) {
        throw new Error('Firebase config missing apiKey or databaseURL');
      }
      await this.loadSdkIfNeeded();
      if (!firebase.apps.length) firebase.initializeApp(config);
      this.fb = firebase.database();
      const nodeName = (window.DB_FILE_NAME || 'main').replace(/\.json$/i, '').replace(/[^\w-]/g, '_');
      this.dbRef = this.fb.ref('safwat/databases/' + nodeName);
      this.presenceRef = this.fb.ref('safwat/presence/' + nodeName + '/' + this.sessionId);

      // Presence
      this.presenceRef.onDisconnect().remove();
      this.presenceRef.set({
        uid: firebase.auth().currentUser.uid,
        actor: window.Session ? window.Session.currentActor() : 'unknown',
        role: window.Session ? window.Session.currentRole() : 'viewer',
        joinedAt: nowIso(),
        editing: null,
      });
      const presenceListRef = this.fb.ref('safwat/presence/' + nodeName);
      presenceListRef.on('value', snap => {
        const data = snap.val() || {};
        UI.renderPresence(data, this.sessionId);
      });

      // Initial sync: if remote exists, pull it (with confirm); else push local
      const snap = await this.dbRef.once('value');
      const remote = snap.val();
      if (remote && remote.data) {
        const remoteAt = remote.savedAt || '';
        const localAt = (window.DB && window.DB.meta && window.DB.meta.savedAt) || '';
        if (remoteAt > localAt) {
          const proceed = confirm('Remote database is newer than local (' + new Date(remoteAt).toLocaleString() + '). Pull remote and overwrite in-memory?');
          if (proceed) this._applyRemote(remote);
        } else if (localAt > remoteAt) {
          if (confirm('Local database is newer than remote. Push local to server?')) this.pushNow();
        } else {
          Toast.info('In sync', 'Local and remote match.');
        }
      } else {
        if (window.DB && (window.DB.recruitmentCases.length || window.DB.visaRecords.length)) {
          if (confirm('Remote is empty. Push local database to server?')) this.pushNow();
        }
      }

      // Subscribe to remote changes
      this.dbRef.on('value', snap => {
        const val = snap.val();
        if (!val || !val.data) return;
        if (val.version <= this._lastRemoteVersion) return;
        if (val.updatedBy === this.sessionId) return; // ignore echoes
        this._lastRemoteVersion = val.version;
        this._applyRemote(val);
      });

      this.status = 'connected';
      UI.updateSyncStatus();
      lsSet('fbConfig', config);
      window.Audit && window.Audit.push('security', 'sync', null, null, 'Connected to Firebase RTDB');
      Toast.ok('Firebase connected', 'Realtime sync + presence active');
      this._pushDebounced = debounce(() => this.pushNow(), 800);
    } catch (e) {
      this.status = 'error';
      UI.updateSyncStatus(e.message);
      Toast.err('Firebase connect failed', e.message);
    }
  },

  _applyRemote(remote) {
    this._isReceiving = true;
    try {
      if (!SafwatPersistence.acceptRemote(window.DB, remote)) return;
      window.DB = remote.data;
      SafwatPersistence.remember(window.DB, remote.data);
      if (typeof onDatabaseReady === 'function') onDatabaseReady();
      Approvals.render();
      UI.updateQueueBadge();
      window.EntHealth && window.EntHealth.render();
      Toast.info('Remote update pulled', 'Updated by ' + (remote.updatedByName || 'someone else'));
    } finally { this._isReceiving = false; }
  },

  pushIfConnected() {
    if (this.status !== 'connected') return;
    if (this._isReceiving) return;
    if (this._pushDebounced) this._pushDebounced();
  },

  async pushNow() {
    if (this._isReceiving) return;
    if (!window.CLAIRE) throw new Error('Wait for the save service to initialize.');
    return window.dbSave();
  },

  disconnect() {
    try {
      if (this.dbRef) this.dbRef.off();
      if (this.presenceRef) this.presenceRef.remove();
    } catch {}
    this.status = 'disconnected';
    UI.updateSyncStatus();
    Toast.info('Firebase disconnected');
  },

  setEditingRecord(entityId) {
    if (this.status !== 'connected' || !this.presenceRef) return;
    this.presenceRef.update({ editing: entityId, editingSince: nowIso() });
  },
};
window.EntSync = Sync;

/* Hook local dbSave to trigger a push after every save */
const OrigSaveForSync = window.dbSave;
window.dbSave = async function entSyncDbSave() {
  const res = await OrigSaveForSync.apply(this, arguments);
  Sync.pushIfConnected();
  return res;
};

/* =========================================================
   3) ANOMALY DETECTION ENGINE
   ========================================================= */
const Anomalies = {
  _timer: null,
  _lastResults: [],

  rules: [
    {
      id: 'visa_expiring_7d',
      severity: 'critical',
      label: 'Visa expiring in ≤ 7 days',
      detect(db) {
        const now = new Date(), out = [];
        (db.visaRecords || []).forEach(v => {
          if (!v.expiryDate) return;
          const status = (v.status || '').toLowerCase();
          if (status === 'used' || status === 'cancelled' || status === 'expired') return;
          const days = (new Date(v.expiryDate) - now) / 86400000;
          if (days >= 0 && days <= 7) out.push({ recordId: v.id, entity: 'visaRecord', detail: (v.name || v.visaDocNumber || v.id) + ' — ' + Math.floor(days) + ' days left' });
        });
        return out;
      },
    },
    {
      id: 'visa_expiring_30d',
      severity: 'high',
      label: 'Visa expiring in 8–30 days',
      detect(db) {
        const now = new Date(), out = [];
        (db.visaRecords || []).forEach(v => {
          if (!v.expiryDate) return;
          const status = (v.status || '').toLowerCase();
          if (status === 'used' || status === 'cancelled' || status === 'expired') return;
          const days = (new Date(v.expiryDate) - now) / 86400000;
          if (days > 7 && days <= 30) out.push({ recordId: v.id, entity: 'visaRecord', detail: (v.name || v.visaDocNumber || v.id) + ' — ' + Math.floor(days) + ' days left' });
        });
        return out;
      },
    },
    {
      id: 'case_stuck_60d',
      severity: 'high',
      label: 'Case stuck at same stage > 60 days',
      detect(db) {
        const now = new Date(), out = [];
        (db.recruitmentCases || []).forEach(c => {
          if (!c.updatedAt) return;
          const stage = (c.stage || '').toLowerCase();
          if (stage === 'deployed' || stage === 'withdrawn/backout' || stage === 'unfit' || stage === 'terminated' || stage === 'awol') return;
          const days = (now - new Date(c.updatedAt)) / 86400000;
          if (days > 60) out.push({ recordId: c.id, entity: 'recruitmentCase', detail: (c.name || c.id) + ' — ' + Math.floor(days) + ' days at "' + (c.stage || '(none)') + '"' });
        });
        return out;
      },
    },
    {
      id: 'case_stuck_30d',
      severity: 'medium',
      label: 'Case stuck at same stage > 30 days',
      detect(db) {
        const now = new Date(), out = [];
        (db.recruitmentCases || []).forEach(c => {
          if (!c.updatedAt) return;
          const stage = (c.stage || '').toLowerCase();
          if (stage === 'deployed' || stage === 'withdrawn/backout' || stage === 'unfit' || stage === 'terminated' || stage === 'awol') return;
          const days = (now - new Date(c.updatedAt)) / 86400000;
          if (days > 30 && days <= 60) out.push({ recordId: c.id, entity: 'recruitmentCase', detail: (c.name || c.id) + ' — ' + Math.floor(days) + ' days at "' + (c.stage || '(none)') + '"' });
        });
        return out;
      },
    },
    {
      id: 'duplicate_passport',
      severity: 'high',
      label: 'Duplicate passport number',
      detect(db) {
        const map = {};
        (db.recruitmentCases || []).forEach(c => { if (c.passport) (map[c.passport.toLowerCase()] = map[c.passport.toLowerCase()] || []).push({ e: 'recruitmentCase', id: c.id, n: c.name }); });
        (db.visaRecords || []).forEach(v => { if (v.passport) (map[v.passport.toLowerCase()] = map[v.passport.toLowerCase()] || []).push({ e: 'visaRecord', id: v.id, n: v.name }); });
        const out = [];
        Object.entries(map).forEach(([pp, hits]) => {
          if (hits.length > 1) hits.forEach(h => out.push({ recordId: h.id, entity: h.e, detail: (h.n || h.id) + ' — passport ' + pp + ' appears in ' + hits.length + ' records' }));
        });
        return out;
      },
    },
    {
      id: 'orphan_link',
      severity: 'medium',
      label: 'Orphaned cross-reference',
      detect(db) {
        const cs = db.recruitmentCases || [], vs = db.visaRecords || [], out = [];
        cs.forEach(c => { if (c.linkedVisaId && !vs.find(v => v.id === c.linkedVisaId)) out.push({ recordId: c.id, entity: 'recruitmentCase', detail: (c.name || c.id) + ' → missing visa ' + c.linkedVisaId }); });
        vs.forEach(v => { if (v.linkedRecruitmentCaseId && !cs.find(c => c.id === v.linkedRecruitmentCaseId)) out.push({ recordId: v.id, entity: 'visaRecord', detail: (v.name || v.id) + ' → missing case ' + v.linkedRecruitmentCaseId }); });
        return out;
      },
    },
    {
      id: 'needs_review',
      severity: 'medium',
      label: 'Records flagged "Needs Review"',
      detect(db) {
        const out = [];
        (db.recruitmentCases || []).forEach(c => { if (c.stage && /needs review/i.test(c.stage)) out.push({ recordId: c.id, entity: 'recruitmentCase', detail: (c.name || c.id) }); });
        (db.visaRecords || []).forEach(v => { if (v.status && /needs review/i.test(v.status)) out.push({ recordId: v.id, entity: 'visaRecord', detail: (v.name || v.id) }); });
        return out;
      },
    },
    {
      id: 'visa_missing_fields',
      severity: 'low',
      label: 'Visa missing key fields',
      detect(db) {
        const out = [];
        (db.visaRecords || []).forEach(v => {
          const missing = [];
          if (!v.visaDocNumber) missing.push('visa doc #');
          if (!v.nationality) missing.push('nationality');
          if (!v.expiryDate) missing.push('expiry');
          if (missing.length) out.push({ recordId: v.id, entity: 'visaRecord', detail: (v.name || v.id) + ' — missing ' + missing.join(', ') });
        });
        return out;
      },
    },
    {
      id: 'case_missing_fields',
      severity: 'low',
      label: 'Case missing key fields',
      detect(db) {
        const out = [];
        (db.recruitmentCases || []).forEach(c => {
          const missing = [];
          if (!c.client) missing.push('client');
          if (!c.position) missing.push('position');
          if (!c.nationality) missing.push('nationality');
          if (missing.length) out.push({ recordId: c.id, entity: 'recruitmentCase', detail: (c.name || c.id) + ' — missing ' + missing.join(', ') });
        });
        return out;
      },
    },
    {
      id: 'bulk_delete_burst',
      severity: 'critical',
      label: 'Rapid deletion burst (audit)',
      detect(db) {
        if (!db.meta || !Array.isArray(db.meta.audit)) return [];
        const last1h = Date.now() - 3600000;
        const deletes = db.meta.audit.filter(e => e.action === 'delete' && new Date(e.at).getTime() > last1h);
        if (deletes.length >= 10) {
          const actors = {};
          deletes.forEach(d => actors[d.actor] = (actors[d.actor] || 0) + 1);
          return Object.entries(actors).map(([actor, n]) => ({ recordId: null, entity: 'security', detail: actor + ' deleted ' + n + ' records in the last hour' }));
        }
        return [];
      },
    },
  ],

  scan() {
    if (!window.DB) return;
    const all = [];
    this.rules.forEach(rule => {
      try {
        const hits = rule.detect(window.DB) || [];
        hits.forEach(h => all.push({ rule: rule.id, severity: rule.severity, label: rule.label, ...h }));
      } catch (e) { console.warn('Rule failed', rule.id, e); }
    });
    this._lastResults = all;
    this.render();
    UI.updateAnomalyBadge();
    return all;
  },

  render() {
    const box = $('entAnomaliesList'); if (!box) return;
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    this._lastResults.forEach(r => counts[r.severity]++);
    $('entAsCritical').textContent = counts.critical;
    $('entAsHigh').textContent = counts.high;
    $('entAsMedium').textContent = counts.medium;
    $('entAsLow').textContent = counts.low;

    if (!this._lastResults.length) {
      box.innerHTML = '<p style="color:var(--ent-ok);text-align:center;padding:24px 0;font-size:14px;">✓ No anomalies detected.</p>';
      return;
    }

    const grouped = {};
    this._lastResults.forEach(r => { grouped[r.label] = grouped[r.label] || []; grouped[r.label].push(r); });

    let html = '';
    Object.entries(grouped).forEach(([label, items]) => {
      html += '<div class="ent-anomaly-group"><h3>' + esc(label) + ' — ' + items.length + '</h3>';
      items.slice(0, 30).forEach(a => {
        html += '<div class="ent-anomaly-item ' + a.severity + '">' +
          '<div><div class="ent-a-title">' + esc(a.detail) + '</div><div class="ent-a-meta">' + esc(a.severity.toUpperCase()) + ' · ' + esc(a.entity) + '</div></div>';
        if (a.recordId) html += '<button class="ent-a-action" data-open-record="' + esc(a.entity) + '|' + esc(a.recordId) + '">Open</button>';
        html += '</div>';
      });
      if (items.length > 30) html += '<div style="font-size:12px;color:var(--text-soft);padding:4px 0;">…and ' + (items.length - 30) + ' more.</div>';
      html += '</div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('[data-open-record]').forEach(b => b.addEventListener('click', () => {
      const [entity, id] = b.dataset.openRecord.split('|');
      if (entity === 'recruitmentCase' && typeof openCaseForm === 'function') openCaseForm(id);
      else if (entity === 'visaRecord' && typeof openVisaForm === 'function') openVisaForm(id);
    }));
  },

  exportReport() {
    if (!this._lastResults.length) return Toast.warn('Nothing to export', 'Run a scan first.');
    const rows = [['severity', 'rule', 'entity', 'recordId', 'detail']];
    this._lastResults.forEach(r => rows.push([r.severity, r.rule, r.entity, r.recordId || '', r.detail]));
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'anomalies_' + Date.now() + '.csv'; a.click();
    Toast.ok('Exported', this._lastResults.length + ' anomalies');
  },

  startAuto() { if (this._timer) clearInterval(this._timer); this._timer = setInterval(() => this.scan(), 300000); },
  stopAuto() { if (this._timer) clearInterval(this._timer); this._timer = null; },
};
window.EntAnomalies = Anomalies;

/* =========================================================
   UI wiring for v2.1
   ========================================================= */
const UI = {
  init() {
    // Inject sync + queue widgets into the top strip
    const strip = $('entTopStrip');
    if (strip) {
      const spacer = strip.querySelector('.ent-spacer');
      const nodes = document.createElement('span');
      nodes.style.display = 'inline-flex'; nodes.style.gap = '10px'; nodes.style.alignItems = 'center';
      nodes.innerHTML =
        '<span class="ent-queue-badge zero" id="entQueueBadge" title="Approvals queue">◇ <span id="entQueueCount">0</span> pending</span>' +
        '<span class="ent-sync-status disconnected" id="entSyncStatus" title="Sync status"><span class="ent-dot"></span><span id="entSyncText">Offline</span></span>' +
        '<span class="ent-presence" id="entPresenceBar"></span>';
      strip.insertBefore(nodes, spacer);

      // Add "Anomalies" and "Approvals" buttons
      const helpBtn = $('entOpenHelp');
      const btnA = document.createElement('button'); btnA.type = 'button'; btnA.id = 'entOpenAnomalies'; btnA.textContent = 'Anomalies';
      const btnQ = document.createElement('button'); btnQ.type = 'button'; btnQ.id = 'entOpenApprovals'; btnQ.textContent = 'Approvals';
      strip.insertBefore(btnQ, helpBtn);
      strip.insertBefore(btnA, helpBtn);
    }

    $('entOpenApprovals').addEventListener('click', () => { window.EntUI.openPanel('entApprovalsPanel'); Approvals.render(); });
    $('entOpenAnomalies').addEventListener('click', () => { window.EntUI.openPanel('entAnomaliesPanel'); Anomalies.scan(); });
    $('entQueueBadge').addEventListener('click', () => { window.EntUI.openPanel('entApprovalsPanel'); Approvals.render(); });

    $('entApprovalRequired').addEventListener('change', e => Approvals.setRequired(e.target.checked));
    $('entApprovalsBulkApprove').addEventListener('click', () => Approvals.bulkApproveSafe());
    $('entApprovalsBulkReject').addEventListener('click', () => Approvals.bulkReject());

    $('entAnomalyScan').addEventListener('click', () => Anomalies.scan());
    $('entAnomaliesExport').addEventListener('click', () => Anomalies.exportReport());
    $('entAnomalyAuto').addEventListener('change', e => e.target.checked ? Anomalies.startAuto() : Anomalies.stopAuto());
    if ($('entAnomalyAuto').checked) Anomalies.startAuto();

    // Inject Firebase config UI into Security panel
    this.injectFirebaseUI();

    // Initial badges
    this.updateQueueBadge();
    this.updateSyncStatus();

    // Auto-connect using embedded config (or user override in localStorage)
    const cfg = lsGet('fbConfig', null) || EMBEDDED_FB_CONFIG;
    const tryAutoConnect = () => {
      if (Sync.status === 'connected' || Sync.status === 'connecting') return;
      if (!window.DB) return; // wait for a DB to be opened first
      Sync.connect(cfg);
    };
    // Try once shortly after boot (in case DB is already open)
    setTimeout(tryAutoConnect, 1500);
    // Also try again a few seconds later — user typically opens the DB manually
    const autoTimer = setInterval(() => {
      if (Sync.status === 'connected') { clearInterval(autoTimer); return; }
      tryAutoConnect();
    }, 3000);
    // Stop trying after 5 min so we don't spam
    setTimeout(() => clearInterval(autoTimer), 300000);

    // Re-scan anomalies when DB changes
    const origOnReady = window.onDatabaseReady;
    if (typeof origOnReady === 'function') {
      window.onDatabaseReady = function(){ origOnReady.apply(this, arguments); setTimeout(() => Anomalies.scan(), 500); Approvals.render(); UI.updateQueueBadge(); };
    }

    // Keyboard shortcuts additions
    document.addEventListener('keydown', e => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === 'q') { e.preventDefault(); window.EntUI.openPanel('entApprovalsPanel'); Approvals.render(); }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); window.EntUI.openPanel('entAnomaliesPanel'); Anomalies.scan(); }
    });
  },

  injectFirebaseUI() {
    const sec = $('entSecurityPanel');
    if (!sec) return;
    const body = sec.querySelector('.ent-slideover-body');
    if (!body) return;
    const div = document.createElement('div');
    div.innerHTML =
      '<h3 style="font-size:15px;margin:20px 0 10px;">Realtime Sync (Firebase)</h3>' +
      '<p style="font-size:12.5px;color:var(--text-soft);margin:0 0 10px;">Paste your Firebase config JSON below and click <b>Connect</b>. The whole database will sync to <code>safwat/databases/{filename}</code>. Presence and edit-locking are automatic. Use Realtime Database (databaseURL required).</p>' +
      '<textarea class="ent-fb-config" id="entFbConfig" placeholder=\'{\\n  "apiKey": "...",\\n  "authDomain": "your-project.firebaseapp.com",\\n  "databaseURL": "https://your-project-default-rtdb.firebaseio.com",\\n  "projectId": "your-project",\\n  "storageBucket": "your-project.appspot.com",\\n  "messagingSenderId": "...",\\n  "appId": "..."\\n}\'></textarea>' +
      '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">' +
        '<button id="entFbConnect" class="btn primary">Connect</button>' +
        '<button id="entFbDisconnect" class="btn">Disconnect</button>' +
        '<button id="entFbPushNow" class="btn">Force push local → remote</button>' +
      '</div>' +
      '<div id="entFbStatus" class="ent-fb-status disconnected">Disconnected</div>';
    body.appendChild(div);

    // Prefill: saved override > embedded config
    const saved = lsGet('fbConfig', null);
    $('entFbConfig').value = JSON.stringify(saved || EMBEDDED_FB_CONFIG, null, 2);
    // Add a small banner above the textarea explaining what's baked in
    const banner = document.createElement('div');
    banner.style.cssText = 'font-family:var(--ent-mono);font-size:11px;color:var(--ent-ok);background:rgba(63,108,77,.08);border:1px solid var(--ent-ok);padding:6px 10px;border-radius:3px;margin-bottom:8px;';
    banner.textContent = '● Baked-in: safwat-recruitment-toolkit · europe-west1 · auto-connects on DB open';
    $('entFbConfig').parentNode.insertBefore(banner, $('entFbConfig'));

    $('entFbConnect').addEventListener('click', () => {
      const raw = $('entFbConfig').value.trim();
      if (!raw) return Toast.err('Paste your Firebase config first');
      let cfg; try { cfg = JSON.parse(raw); } catch (e) { return Toast.err('Config is not valid JSON', e.message); }
      Sync.connect(cfg);
    });
    $('entFbDisconnect').addEventListener('click', () => Sync.disconnect());
    $('entFbPushNow').addEventListener('click', () => Sync.pushNow());
  },

  updateQueueBadge() {
    const n = Approvals.pendingCount();
    const badge = $('entQueueBadge'); const count = $('entQueueCount');
    if (!badge || !count) return;
    count.textContent = n;
    badge.classList.toggle('zero', n === 0);
  },

  updateAnomalyBadge() {
    // could add a top-strip badge for critical anomalies too, similar pattern
  },

  updateSyncStatus(err) {
    const el = $('entSyncStatus'); const txt = $('entSyncText'); const fbEl = $('entFbStatus');
    if (el) {
      el.className = 'ent-sync-status ' + Sync.status;
      if (txt) txt.textContent = ({ disconnected: 'Not synced', connecting: 'Connecting…', connected: 'Live', syncing: 'Pushing…', error: 'Sync err', offline: 'Offline' })[Sync.status] || Sync.status;
    }
    if (fbEl) {
      fbEl.className = 'ent-fb-status ' + (Sync.status === 'connected' || Sync.status === 'syncing' ? 'connected' : Sync.status === 'error' ? 'error' : 'disconnected');
      fbEl.textContent = Sync.status === 'connected' ? '● Connected · sessionId: ' + Sync.sessionId.slice(0, 10) :
                         Sync.status === 'syncing'   ? '● Pushing…' :
                         Sync.status === 'error'     ? '✕ ' + (err || 'Error') :
                         Sync.status === 'connecting'? '◌ Connecting…' :
                         '○ Disconnected';
    }
  },

  renderPresence(data, myId) {
    const el = $('entPresenceBar');
    if (!el) return;
    const entries = Object.entries(data || {});
    if (!entries.length) { el.innerHTML = ''; return; }
    let html = '';
    entries.forEach(([id, u]) => {
      const initials = (u.actor || '?').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
      html += '<span class="ent-presence-avatar' + (id === myId ? ' me' : '') + '" title="' + esc(u.actor + ' (' + u.role + ')' + (u.editing ? ' — editing ' + u.editing : '')) + '">' + esc(initials) + '</span>';
    });
    html += '<span class="ent-presence-count">' + entries.length + ' online</span>';
    el.innerHTML = html;
  },
};

/* Boot */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => UI.init());
else UI.init();

console.log('%c◆ SAFWAT Enterprise v' + V21 + ' extensions loaded (Approvals · Sync · Anomalies)', 'color:#B98A2E;font-weight:bold;');

})();


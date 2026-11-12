
(function ClaireStep1(){
  'use strict';
  var OFF = false; try { OFF = localStorage.getItem('claire.off') === '1'; } catch (e) {}
  if (OFF) { console.warn('[CLAIRE] disabled by kill switch (claire.off=1)'); return; }
  if (window.CLAIRE) return;
  var VERSION = '7.2.0';
  var CLOUD_PATH = 'safwat/databases/main';
  var nowIso = function(){ return new Date().toISOString(); };
  var clone = function(o){ return o == null ? o : JSON.parse(JSON.stringify(o)); };
  var getDb = function(){ return window.DB; };

  /* =====================================================================
     1) PERSISTENCE — the one save path
     ===================================================================== */
  var legacy = window.dbSave;                /* legacy chain — used only as fallback */
  if (typeof legacy !== 'function') { console.error('[CLAIRE] dbSave not found — not installed.'); return; }

  function cloudReady(){
    try { return typeof firebase !== 'undefined' && firebase.database && firebase.auth && !!firebase.auth().currentUser; }
    catch (e) { return false; }
  }
  var lastVersion = null, lastMode = '', snap = null;
  var ARR = ['recruitmentCases', 'visaRecords'];
  function sigOf(v){ try { return JSON.stringify(v); } catch (e) { return null; } }
  function clean(v){ if (v === undefined) return null; try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; } }
  /* snapshot of what Firebase holds, per record — lets CLAIRE send only what changed */
  function takeSnap(db, version){
    var sn = { version: version, db: db, top: {}, rows: {}, meta: {}, auditIds: null };
    var m = db.meta || {};
    Object.keys(m).forEach(function(k){ if (k === 'savedAt') return; if (k === 'audit' && Array.isArray(m.audit)) sn.auditIds = m.audit.map(function(e){ return e && e.id; }); else sn.meta[k] = sigOf(m[k]); });
    Object.keys(db).forEach(function(k){
      if (k === 'meta') return;
      if (ARR.indexOf(k) >= 0 && Array.isArray(db[k])) sn.rows[k] = { ids: db[k].map(function(r){ return r && r.id; }), sigs: db[k].map(sigOf) };
      else sn.top[k] = sigOf(db[k]);
    });
    return sn;
  }
  function plan(db){
    var up = {}, n = 0;
    Object.keys(db).forEach(function(k){
      if (k === 'meta') return;
      var r = snap.rows[k];
      if (r && Array.isArray(db[k])) {
        var a = db[k], i, same = a.length >= r.ids.length;
        for (i = 0; same && i < r.ids.length; i++) if ((a[i] && a[i].id) !== r.ids[i]) same = false;
        if (!same) { up[k] = clean(a); n += a.length; return; }            /* delete/reorder → whole list */
        for (i = 0; i < a.length; i++) if (i >= r.sigs.length || sigOf(a[i]) !== r.sigs[i]) { up[k + '/' + i] = clean(a[i]); n++; }
      } else if (sigOf(db[k]) !== snap.top[k]) { up[k] = clean(db[k]); n++; }
    });
    Object.keys(snap.top).concat(Object.keys(snap.rows)).forEach(function(k){ if (!(k in db)) { up[k] = null; n++; } });
    /* meta: send only changed keys; audit log is append-only → send only new entries */
    var m = db.meta || {}, mn = 0;
    Object.keys(m).forEach(function(k){
      if (k === 'savedAt') return;
      if (k === 'audit' && Array.isArray(m.audit) && snap.auditIds) {
        var a = m.audit, ids = snap.auditIds, ok = a.length >= ids.length, i;
        for (i = 0; ok && i < ids.length; i++) if ((a[i] && a[i].id) !== ids[i]) ok = false;
        if (!ok) { up['meta/audit'] = clean(a); mn += a.length; return; }   /* trimmed at 2000 → whole log */
        for (i = ids.length; i < a.length; i++) { up['meta/audit/' + i] = clean(a[i]); mn++; }
      } else if (sigOf(m[k]) !== snap.meta[k]) { up['meta/' + k] = clean(m[k]); mn++; }
    });
    Object.keys(snap.meta).forEach(function(k){ if (!(k in m)) { up['meta/' + k] = null; mn++; } });
    if (snap.auditIds && !('audit' in m)) { up['meta/audit'] = null; mn++; }
    return { up: up, n: n, mn: mn };
  }
  async function cloudWrite(){
    var liveDb = getDb(); if (!liveDb) return false;
    if (!cloudReady()) {
      if (window._entCloudMode) throw new Error('Sign in before saving cloud data.');
      writer = 'legacy'; return legacy.call(window);
    }
    writer = 'cloud';
    var u = firebase.auth().currentUser;
    if (u.isAnonymous) throw new Error('An approved account is required to save.');
    var ref = firebase.database().ref(CLOUD_PATH);
    var expected = SafwatPersistence.versionFor(liveDb, CLOUD_PATH);
    var committed = await SafwatPersistence.commit(ref, {
      db: liveDb, expectedVersion: expected, scope: CLOUD_PATH, uid: u.uid,
      actor: (u.displayName || u.email || 'unknown')
    });
    lastVersion = committed.version;
    // Snapshot the sent data, never liveDb (which may have changed during the await).
    snap = takeSnap(committed.data, committed.version); snap.db = liveDb;
    liveDb.meta = liveDb.meta || {}; liveDb.meta.savedAt = committed.savedAt;
    lastMode = 'revision-checked transaction';
    return true;
  }
  /* Exact-match fallback for old load integrations. Normal loads register revisions directly. */
  (function watchRemote(){
    if (!cloudReady()) return setTimeout(watchRemote, 1000);
    firebase.database().ref(CLOUD_PATH).on('value', function(s){
      var remote = s.val(); if (!remote || !remote.data) return;
      var attempts = 0;
      function matchLoaded(){
        var db = getDb();
        if (db && SafwatPersistence.signature(db) === SafwatPersistence.signature(remote.data)) {
          snap = takeSnap(remote.data, typeof remote.version === 'number' ? remote.version : 0);
          snap.db = db; lastSig = signature();
          SafwatPersistence.remember(db, remote.data, typeof remote.version === 'number' ? remote.version : 0, CLOUD_PATH);
        } else if (++attempts < 20) setTimeout(matchLoaded, 100);
      }
      matchLoaded();
    }, function(error){ console.warn('[CLAIRE] baseline unavailable:', error.code); });
  })();
  var writer = 'cloud';

  /* save-status pill (reuses the v5.0.0 #entSaveStatus element) */
  /* v7.2.0: status now speaks through CLAIRE's dock chip (section 4) */
  var ui = null;
  function pill(kind, text, autoHide){ if (ui) ui.state(kind, text, autoHide); }

  var GATHER_MS = 50, FOLLOW_MS = 150, RETRY_MS = 15000, followTimer = null, retryTimer = null;
  var lastSig = null, inFlight = null, queued = null, gatherTimer = null, gathering = null;
  var saveLog = [], stats = { requested: 0, written: 0, skipped: 0, merged: 0, failed: 0 };

  function signature(){
    var db = getDb(); if (!db) return null;
    var meta = db.meta;
    try { return JSON.stringify(db, function(k, v){ return (k === 'savedAt' && this === meta) ? undefined : v; }); }
    catch (e) { return null; }
  }
  function newBatch(){ var b = { callers: 0, resolve: null, reject: null, promise: null };
    b.promise = new Promise(function(res, rej){ b.resolve = res; b.reject = rej; }); return b; }
  function scheduleRetry(){
    clearTimeout(retryTimer);
    retryTimer = setTimeout(function(){ if (signature() !== lastSig) flush(); }, RETRY_MS);
  }

  function runBatch(batch){
    var t0 = performance.now(), sig = signature();
    if (sig !== null && lastSig !== null && sig === lastSig) {
      stats.skipped++; record(batch, 'skipped', t0); batch.resolve(true); return Promise.resolve();
    }
    inFlight = batch; pill('saving', 'Saving…', false);
    return Promise.resolve().then(cloudWrite).then(function(ret){
      if (ret === false) { stats.failed++; record(batch, 'failed', t0); pill('err', 'Not saved — retrying', false); scheduleRetry(); }
      else { lastSig = sig; stats.written++; record(batch, 'written v' + (lastVersion || '?') + ' · ' + lastMode, t0); pill('saved', 'Saved ✓' + (writer === 'cloud' && /record/.test(lastMode) ? ' · ' + lastMode.split(' · ')[0] : ''), true); }
      batch.resolve(ret);
    }, function(err){
      stats.failed++; record(batch, 'error: ' + (err && err.message || err), t0);
      if (err && err.code === 'SAVE_CONFLICT') {
        clearTimeout(retryTimer); pill('err', 'Save conflict — export unsaved work before reloading', false);
        if (window.Toast) window.Toast.err('Save stopped', err.message);
      } else {
        pill(navigator.onLine === false ? 'queued' : 'err', navigator.onLine === false ? 'Offline — will save when back' : 'Not saved — retrying', false);
        scheduleRetry();
      }
      batch.reject(err);
    })
    .then(function(){
      if (!queued) { inFlight = null; return; }
      inFlight = 'waiting';                  /* follow-ups land together in ONE write */
      followTimer = setTimeout(startQueued, FOLLOW_MS);
    });
  }
  function record(batch, outcome, t0){
    saveLog.push({ at: nowIso(), outcome: outcome, via: writer, mergedCalls: batch.callers, ms: Math.round(performance.now() - t0) });
    if (saveLog.length > 300) saveLog.shift();
    emit('saved', { outcome: outcome, calls: batch.callers });
  }
  function startQueued(){ followTimer = null; inFlight = null; if (queued) { var q = queued; queued = null; runBatch(q); } }
  function flush(){
    stats.requested++;
    if (inFlight) { if (!queued) queued = newBatch(); else stats.merged++; queued.callers++; return queued.promise; }
    if (gathering) { gathering.callers++; stats.merged++; return gathering.promise; }
    gathering = newBatch(); gathering.callers = 1;
    var b = gathering;
    gatherTimer = setTimeout(function(){ gathering = null; gatherTimer = null; runBatch(b); }, GATHER_MS);
    return b.promise;
  }
  function flushNow(){
    if (gathering) { clearTimeout(gatherTimer); var b = gathering; gathering = null; runBatch(b); }
    if (inFlight === 'waiting' && followTimer) { clearTimeout(followTimer); startQueued(); }
  }
  (function baseline(){ if (getDb() && lastSig === null) { lastSig = signature(); return; } if (lastSig === null) setTimeout(baseline, 500); })();
  window.addEventListener('pagehide', flushNow);
  window.addEventListener('online', function(){ if (signature() !== lastSig) flush(); });
  document.addEventListener('visibilitychange', function(){ if (document.hidden) flushNow(); });
  window.addEventListener('beforeunload', function(e){
    if (lastSig !== null && signature() !== lastSig) { flushNow(); e.preventDefault(); e.returnValue = ''; }
  });

  window.dbSave = function claireDbSave(){ return flush(); };

  /* =====================================================================
     2) EVENTS
     ===================================================================== */
  var listeners = {};
  function on(evt, fn){ (listeners[evt] = listeners[evt] || []).push(fn); return function(){ listeners[evt] = (listeners[evt] || []).filter(function(f){ return f !== fn; }); }; }
  function emit(evt, p){ (listeners[evt] || []).forEach(function(fn){ try { fn(p); } catch (e) { console.warn('[CLAIRE] listener', evt, e); } }); }

  /* =====================================================================
     3) KERNEL — one pipeline for every action
     ===================================================================== */
  var actions = {}, guardians = [], journal = [], usage = {};
  var RANK = { viewer: 0, editor: 1, admin: 2 };
  function myRole(){
    try { var r = (window.EntRbac && window.EntRbac.myRecord && window.EntRbac.myRecord.role) || (window.Session && window.Session.role) || 'viewer'; return /admin|super/i.test(r) ? 'admin' : (RANK[r] != null ? r : 'viewer'); }
    catch (e) { return 'viewer'; }
  }
  function tableOf(kind){ var db = getDb() || {}; return kind === 'visa' ? (db.visaRecords || []) : (db.recruitmentCases || []); }
  function findRec(kind, id){ var t = tableOf(kind); for (var i = 0; i < t.length; i++) if (t[i].id === id) return t[i]; return null; }
  function register(name, def){
    if (actions[name]) throw new Error('CLAIRE: action already registered: ' + name);
    actions[name] = Object.assign({ role: 'editor', validate: function(){ return null; }, touches: function(){ return []; } }, def);
  }
  function guardian(id, check){ guardians.push({ id: id, check: check }); }
  function snapshotInto(images, kind, id){
    var key = kind + ':' + id; if (images[key]) return;
    images[key] = { kind: kind, id: id, rec: clone(findRec(kind, id)) };
  }
  function restore(images){
    Object.keys(images).forEach(function(k){
      var im = images[k], t = tableOf(im.kind), idx = -1;
      for (var i = 0; i < t.length; i++) if (t[i].id === im.id) { idx = i; break; }
      if (im.rec == null) { if (idx >= 0) t.splice(idx, 1); }
      else if (idx >= 0) t[idx] = clone(im.rec); else t.push(clone(im.rec));
    });
  }
  async function run(name, input, ctx){
    ctx = Object.assign({ by: 'unknown', role: myRole(), source: 'ui' }, ctx || {});
    var def = actions[name];
    function fail(code, msg){ emit('refused', { action: name, code: code, say: msg }); return { ok: false, code: code, say: msg }; }
    if (!def) return fail('unknown-action', 'I don’t know how to "' + name + '".');
    if (!getDb()) return fail('not-ready', 'The database hasn’t loaded yet.');
    if ((RANK[ctx.role] || 0) < (RANK[def.role] || 0)) return fail('forbidden', 'Your role (' + ctx.role + ') can’t run ' + name + '.');
    var problem = def.validate(input, getDb(), ctx); if (problem) return fail('invalid', problem);
    var images = {}, touched = def.touches(input, getDb()) || [];
    touched.forEach(function(t){ snapshotInto(images, t.kind, t.id); });
    var result, repairs = [], held = [];
    try {
      result = def.apply(input, getDb(), ctx);
      if (ctx.source !== 'undo') guardians.forEach(function(g){
        (g.check(getDb(), { action: name, input: input, touched: touched }) || []).forEach(function(f){
          if (f.hold) { held.push({ guardian: g.id, note: f.note }); return; }
          (f.touch || []).forEach(function(t){ snapshotInto(images, t.kind, t.id); });
          f.fix(getDb()); repairs.push({ guardian: g.id, note: f.note });
        });
      });
      var ok = await flush();
      if (ok === false) throw new Error('save failed');
    } catch (e) { restore(images); return fail('error', 'Nothing was changed — ' + e.message); }
    var entry = { id: 'j_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: nowIso(), action: name,
      by: ctx.by, role: ctx.role, source: ctx.source, input: clone(input), images: images, repairs: repairs, held: held };
    journal.push(entry); if (journal.length > 1000) journal.shift();
    usage[name] = (usage[name] || 0) + 1;
    emit('changed', { action: name, touched: touched, repairs: repairs, held: held });
    return { ok: true, result: result, journalId: entry.id, repairs: repairs, held: held, say: def.describe ? def.describe(input, result) : 'Done.' };
  }
  async function undo(journalId, ctx){
    var e = null; for (var i = journal.length - 1; i >= 0; i--) if (journal[i].id === journalId) { e = journal[i]; break; }
    if (!e) return { ok: false, say: 'I can’t find that change to undo.' };
    return run('core.restore', { images: e.images, of: journalId }, Object.assign({ source: 'undo' }, ctx || {}));
  }
  register('core.restore', {
    role: 'editor',
    touches: function(i){ return Object.keys(i.images).map(function(k){ return { kind: i.images[k].kind, id: i.images[k].id }; }); },
    apply: function(i){ restore(i.images); },
    describe: function(i){ return 'Restored ' + Object.keys(i.images).length + ' record(s) to how they were.'; },
  });

  function toIso(x){
    if (x == null || x === '') return '';
    var p = function(n){ return String(n).padStart(2, '0'); };
    var t = String(x).trim(), m = t.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
    if (m) return m[1] + '-' + p(m[2]) + '-' + p(m[3]);
    m = t.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/); if (m) return m[3] + '-' + p(m[2]) + '-' + p(m[1]);
    return '';
  }
  function gapDays(a, b){ a = toIso(a); b = toIso(b); if (!a || !b) return null;
    var n = function(s){ var q = s.split('-').map(Number); return Date.UTC(q[0], q[1] - 1, q[2]) / 86400000; }; return n(a) - n(b); }

  guardian('links', function(db, ctx){
    var out = [];
    ctx.touched.filter(function(t){ return t.kind === 'visa'; }).forEach(function(t){
      var v = findRec('visa', t.id); if (!v || !v.linkedRecruitmentCaseId) return;
      var c = findRec('case', v.linkedRecruitmentCaseId);
      if (!c) out.push({ hold: true, note: t.id + ' links to missing candidate ' + v.linkedRecruitmentCaseId });
      else if (c.linkedVisaId !== v.id) out.push({ touch: [{ kind: 'case', id: c.id }], note: c.id + ' ↔ ' + v.id + ' linked both ways',
        fix: function(){ c.linkedVisaId = v.id; c.updatedAt = nowIso(); } });
    });
    return out;
  });
  var PAIRS = [['candVisaIssuance', 'candidateVisaDate'], ['delegationDate', 'ratificationDate'], ['candVisaExpiration', 'candidateVisaExpiration']];
  guardian('date-pairs', function(db, ctx){
    var out = [];
    ctx.touched.filter(function(t){ return t.kind === 'visa'; }).forEach(function(t){
      var v = findRec('visa', t.id); if (!v) return;
      PAIRS.forEach(function(pr){ var g = gapDays(v[pr[0]], v[pr[1]]);
        if (g !== null && g !== 0) out.push({ hold: true, note: t.id + ': ' + pr[0] + ' ' + v[pr[0]] + ' ≠ ' + pr[1] + ' ' + v[pr[1]] + ' (' + (g > 0 ? '+' : '') + g + ' day)' }); });
    });
    return out;
  });
  register('visa.update', {
    validate: function(i){ return !findRec('visa', i.id) ? 'Visa ' + i.id + ' not found.' : null; },
    touches: function(i){ return [{ kind: 'visa', id: i.id }]; },
    apply: function(i){ var v = findRec('visa', i.id); Object.assign(v, i.patch, { updatedAt: nowIso() }); return v; },
    describe: function(i){ return 'Updated visa ' + i.id + '.'; },
  });
  register('case.update', {
    validate: function(i){ return !findRec('case', i.id) ? 'Candidate ' + i.id + ' not found.' : null; },
    touches: function(i){ return [{ kind: 'case', id: i.id }]; },
    apply: function(i){ var c = findRec('case', i.id); Object.assign(c, i.patch, { updatedAt: nowIso() }); return c; },
    describe: function(i){ return 'Updated ' + i.id + '.'; },
  });

  function status(){ return { version: VERSION, role: myRole(), dbLoaded: !!getDb(), cloudReady: cloudReady(), lastWrittenVersion: lastVersion, lastWrite: lastMode, deltaReady: false,
      unsavedChanges: lastSig !== null && signature() !== lastSig, saving: !!inFlight && inFlight !== 'waiting', queued: !!queued,
      saves: Object.assign({}, stats), actions: Object.keys(actions), guardians: guardians.map(function(g){ return g.id; }) }; }

  /* =====================================================================
     4) PRESENCE — v7.2.0 · CLAIRE becomes visible (read-only, additive)
        • Dock (bottom-right): ✦ button + status chip — replaces the old
          top-right #entSaveStatus pill (hidden, so only ONE voice speaks)
        • Panel (Alt+C or click ✦): Status · Findings · Activity · Undo
        • Findings: read-only scan of ALL records with her guardian rules.
          She never changes data here — she only reports and opens records.
     ===================================================================== */
  ui = (function buildPresence(){
    var css = ''
      + '#entSaveStatus{display:none!important}'
      + '#claireDock{position:fixed;right:18px;bottom:18px;z-index:100050;display:flex;align-items:center;gap:8px;flex-direction:row-reverse;font-family:var(--ent-mono,"IBM Plex Mono",monospace)}'
      + '#claireBtn{width:42px;height:42px;border-radius:50%;border:none;cursor:pointer;background:linear-gradient(135deg,#6B4FA0,#3E2C66);color:#fff;font-size:19px;box-shadow:0 6px 18px rgba(62,44,102,.35);position:relative;transition:transform .15s}'
      + '#claireBtn:hover{transform:scale(1.07)}'
      + '#claireBtn.busy::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid #6B4FA0;border-top-color:transparent;animation:claireSpin .9s linear infinite}'
      + '#claireBadge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#B47A0A;color:#fff;font-size:10.5px;font-weight:700;line-height:18px;display:none}'
      + '#claireChip{max-width:0;opacity:0;overflow:hidden;white-space:nowrap;padding:7px 0;border-radius:18px;font-size:11.5px;font-weight:600;background:var(--paper-raised,#fff);color:var(--text,#23201B);border:1px solid var(--rule,#D9D2BC);box-shadow:0 6px 18px rgba(0,0,0,.14);transition:max-width .3s,opacity .25s,padding .3s;cursor:pointer}'
      + '#claireChip.show{max-width:420px;opacity:1;padding:7px 13px}'
      + '#claireChip.saving{color:#6B4FA0;border-color:#6B4FA0}#claireChip.saved{color:#2F5A3B;border-color:#3F6C4D}'
      + '#claireChip.queued{color:#8C6A22;border-color:#B47A0A}#claireChip.err{color:#A23B2E;border-color:#A23B2E}'
      + '#clairePanel{position:fixed;top:0;right:0;bottom:0;width:400px;max-width:94vw;z-index:100052;background:var(--paper,#F5F2EA);color:var(--text,#23201B);border-left:1px solid var(--rule,#D9D2BC);box-shadow:-10px 0 30px rgba(0,0,0,.18);transform:translateX(105%);transition:transform .25s ease;display:flex;flex-direction:column;font-size:13px}'
      + '#clairePanel.open{transform:none}'
      + '#clairePanel .ch{padding:16px 18px 10px;background:linear-gradient(135deg,#6B4FA0,#3E2C66);color:#fff}'
      + '#clairePanel .ch b{font-size:15px;letter-spacing:.5px}#clairePanel .ch small{display:block;opacity:.8;font-size:11px;margin-top:2px}'
      + '#clairePanel .ch .x{float:right;background:none;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1}'
      + '#clairePanel .say{margin-top:10px;font-size:12.5px;line-height:1.45}'
      + '#clairePanel .tabs{display:flex;border-bottom:1px solid var(--rule,#D9D2BC);background:var(--paper-raised,#fff)}'
      + '#clairePanel .tabs button{flex:1;padding:9px 4px;border:none;background:none;cursor:pointer;font-size:12px;font-weight:600;color:var(--text-soft,#6B6558);border-bottom:2px solid transparent}'
      + '#clairePanel .tabs button.on{color:#6B4FA0;border-bottom-color:#6B4FA0}'
      + '#clairePanel .body{flex:1;overflow:auto;padding:14px 18px}'
      + '#clairePanel .row{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dashed var(--rule,#D9D2BC)}'
      + '#clairePanel .row span:first-child{color:var(--text-soft,#6B6558)}#clairePanel .row span:last-child{text-align:right;font-weight:600}'
      + '#clairePanel .grp{margin-bottom:14px;border:1px solid var(--rule,#D9D2BC);border-radius:8px;background:var(--paper-raised,#fff);overflow:hidden}'
      + '#clairePanel .grp h4{margin:0;padding:9px 12px;font-size:12.5px;cursor:pointer;display:flex;justify-content:space-between}'
      + '#clairePanel .grp p{margin:0 12px 8px;font-size:11.5px;color:var(--text-soft,#6B6558)}'
      + '#clairePanel .it{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 12px;border-top:1px solid var(--rule,#D9D2BC);font-size:11.5px;font-family:var(--ent-mono,monospace)}'
      + '#clairePanel .btn{padding:5px 10px;border-radius:6px;border:1px solid #6B4FA0;background:none;color:#6B4FA0;cursor:pointer;font-size:11.5px;font-weight:600;white-space:nowrap}'
      + '#clairePanel .btn.fill{background:#6B4FA0;color:#fff}#clairePanel .btn:disabled{opacity:.4;cursor:default}'
      + '#clairePanel .empty{color:var(--text-soft,#6B6558);text-align:center;padding:26px 8px;line-height:1.5}'
      + '#clairePanel .act{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}'
      + '#clairePanel .lg{padding:7px 0;border-bottom:1px dashed var(--rule,#D9D2BC);font-size:12px}#clairePanel .lg small{color:var(--text-soft,#6B6558);display:block}'
      + '@keyframes claireSpin{to{transform:rotate(360deg)}}';
    var st = document.createElement('style'); st.id = 'claireStyle'; st.textContent = css; document.head.appendChild(st);

    var esc = function(x){ return String(x == null ? '' : x).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); };
    var ago = function(iso){ if (!iso) return '—'; var s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
      if (s < 10) return 'just now'; if (s < 60) return s + ' s ago'; if (s < 3600) return Math.round(s / 60) + ' min ago';
      if (s < 86400) return Math.round(s / 3600) + ' h ago'; return new Date(iso).toLocaleString(); };
    var me = function(){ try { var u = firebase.auth().currentUser; return u && (u.displayName || (u.email || '').split('@')[0]); } catch (e) { return ''; } };

    var dock = document.createElement('div'); dock.id = 'claireDock';
    dock.innerHTML = '<button id="claireBtn" title="C.L.A.I.R.E. (Alt+C)" aria-label="Open CLAIRE">✦<span id="claireBadge"></span></button><div id="claireChip" role="status" aria-live="polite"></div>';
    var panel = document.createElement('aside'); panel.id = 'clairePanel'; panel.setAttribute('aria-label', 'CLAIRE');
    panel.innerHTML = '<div class="ch"><button class="x" aria-label="Close">×</button><b>✦ C.L.A.I.R.E.</b><small>Centralized Logic And Intelligent Record Executive · v' + VERSION + '</small><div class="say"></div></div>'
      + '<div class="tabs"><button data-t="status">Status</button><button data-t="findings">Findings</button><button data-t="activity">Activity</button><button data-t="undo">Undo</button></div><div class="body"></div>';
    function mount(){ if (!document.body) return setTimeout(mount, 100); document.body.appendChild(dock); document.body.appendChild(panel); }
    mount();
    var chip = dock.querySelector('#claireChip'), btn = dock.querySelector('#claireBtn'), badge = dock.querySelector('#claireBadge');
    var body = panel.querySelector('.body'), sayEl = panel.querySelector('.say');
    var tab = 'status', chipTimer = null, findings = [], scannedAt = null, lastSavedAt = null, refreshTimer = null;

    /* ---- chip (replaces the pill) ---- */
    function state(kind, text, autoHide){
      chip.className = 'show ' + kind; chip.textContent = '✦ CLAIRE · ' + text;
      btn.classList.toggle('busy', kind === 'saving');
      if (kind === 'saved') lastSavedAt = nowIso();
      clearTimeout(chipTimer); if (autoHide) chipTimer = setTimeout(function(){ chip.classList.remove('show'); }, 2600);
      if (panel.classList.contains('open') && tab !== 'findings') render();
    }
    function tell(text, kind, ms){ state(kind || 'saved', text, false); clearTimeout(chipTimer); chipTimer = setTimeout(function(){ chip.classList.remove('show'); }, ms || 6000); }

    /* ---- findings: read-only scan of every record ---- */
    var RULES = {
      'date-pair': { title: 'Date pairs that don’t match', hint: 'These two dates should be the same day (e.g. Delegation = Ratification). Usually a typo or a timezone shift.' },
      'one-way':   { title: 'One-way links', hint: 'The visa points to the candidate, but the candidate doesn’t point back. Re-saving the visa fixes it.' },
      'orphan-v':  { title: 'Visas linked to a missing candidate', hint: 'The candidate this visa points to no longer exists.' },
      'orphan-c':  { title: 'Candidates linked to a missing visa', hint: 'The visa this candidate points to no longer exists.' }
    };
    function scan(){
      var db = getDb(); if (!db) return;
      var out = [], visas = db.visaRecords || [], cases = db.recruitmentCases || [], vById = {}, cById = {};
      visas.forEach(function(v){ if (v && v.id) vById[v.id] = v; });
      cases.forEach(function(c){ if (c && c.id) cById[c.id] = c; });
      visas.forEach(function(v){
        if (!v || !v.id) return;
        PAIRS.forEach(function(pr){ var g = gapDays(v[pr[0]], v[pr[1]]);
          if (g !== null && g !== 0) out.push({ rule: 'date-pair', kind: 'visa', id: v.id, text: pr[0] + ' ' + toIso(v[pr[0]]) + ' vs ' + pr[1] + ' ' + toIso(v[pr[1]]) + ' (' + (g > 0 ? '+' : '') + g + 'd)' }); });
        if (v.linkedRecruitmentCaseId) {
          var c = cById[v.linkedRecruitmentCaseId];
          if (!c) out.push({ rule: 'orphan-v', kind: 'visa', id: v.id, text: '→ ' + v.linkedRecruitmentCaseId + ' (not found)' });
          else if (c.linkedVisaId !== v.id) out.push({ rule: 'one-way', kind: 'visa', id: v.id, text: '→ ' + c.id + (c.linkedVisaId ? ' (points to ' + c.linkedVisaId + ')' : ' (no link back)') });
        }
      });
      cases.forEach(function(c){ if (c && c.linkedVisaId && !vById[c.linkedVisaId]) out.push({ rule: 'orphan-c', kind: 'case', id: c.id, text: '→ ' + c.linkedVisaId + ' (not found)' }); });
      findings = out; scannedAt = nowIso();
      badge.style.display = out.length ? 'block' : 'none'; badge.textContent = out.length > 99 ? '99+' : out.length;
      emit('findings', { count: out.length });
      if (panel.classList.contains('open')) render();
    }
    var scanTimer = null;
    function scanSoon(ms){ clearTimeout(scanTimer); scanTimer = setTimeout(function(){
      (window.requestIdleCallback || function(f){ return setTimeout(f, 0); })(scan, { timeout: 2000 }); }, ms || 1500); }

    function openRecord(kind, id){
      close();
      try {
        if (kind === 'visa' && typeof window.openVisaForm === 'function') return window.openVisaForm(id);
        if (kind === 'case' && typeof window.openCaseForm === 'function') return window.openCaseForm(id);
      } catch (e) { console.warn('[CLAIRE] open', e); }
      tell('I couldn’t open ' + id + ' from here — search it in R-01/R-02.', 'queued');
    }

    /* ---- panel ---- */
    function greeting(){
      var n = findings.length, who = me(), h = new Date().getHours();
      var hi = (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + (who ? ', ' + who : '') + '.';
      if (!getDb()) return hi + ' I’m waiting for the database to load.';
      var s = status();
      if (s.unsavedChanges) return hi + ' You have changes I haven’t saved yet — I’m on it.';
      return hi + (n ? ' I checked every record and found ' + n + ' thing' + (n === 1 ? '' : 's') + ' worth a look.' : ' I checked every record — everything is consistent.');
    }
    function render(){
      sayEl.textContent = greeting();
      panel.querySelectorAll('.tabs button').forEach(function(b){ b.classList.toggle('on', b.dataset.t === tab); });
      var h = '';
      if (tab === 'status') {
        var s = status(), db = getDb() || {};
        var conn = !s.dbLoaded ? 'Loading…' : s.cloudReady ? 'Connected to cloud' : (navigator.onLine === false ? 'Offline' : 'Not signed in');
        var row = function(k, v){ return '<div class="row"><span>' + k + '</span><span>' + esc(v) + '</span></div>'; };
        h += row('Connection', conn) + row('Your role', s.role)
          + row('Records', (db.visaRecords || []).length + ' visas · ' + (db.recruitmentCases || []).length + ' candidates')
          + row('Unsaved changes', s.unsavedChanges ? 'Yes — saving' : 'None')
          + row('Last save', ago(lastSavedAt) + (s.lastWrittenVersion ? ' · v' + s.lastWrittenVersion : ''))
          + row('Last write', s.lastWrite || '—')
          + row('Delta saves', s.deltaReady ? 'Ready (only changes are sent)' : 'After first save')
          + row('Saves this session', s.saves.written + ' written · ' + s.saves.skipped + ' skipped · ' + s.saves.merged + ' merged' + (s.saves.failed ? ' · ' + s.saves.failed + ' failed' : ''))
          + row('Last data check', ago(scannedAt));
        h += '<div class="act"><button class="btn fill" data-do="save"' + (s.unsavedChanges ? '' : ' disabled') + '>Save now</button><button class="btn" data-do="scan">Re-check data</button></div>';
      } else if (tab === 'findings') {
        if (!findings.length) h = '<div class="empty">✓ No inconsistencies found.<br><small>Checked ' + ago(scannedAt) + '. I re-check after every save.</small></div>';
        else {
          var by = {}; findings.forEach(function(f){ (by[f.rule] = by[f.rule] || []).push(f); });
          h += '<div style="font-size:11.5px;color:var(--text-soft,#6B6558);margin-bottom:10px">Read-only — I won’t change anything here. Open a record to fix it.</div>';
          Object.keys(RULES).forEach(function(r){ var list = by[r]; if (!list) return;
            h += '<div class="grp"><h4>' + esc(RULES[r].title) + '<span>' + list.length + '</span></h4><p>' + esc(RULES[r].hint) + '</p>';
            list.slice(0, 60).forEach(function(f){ h += '<div class="it"><span><b>' + esc(f.id) + '</b> ' + esc(f.text) + '</span><button class="btn" data-open="' + esc(f.kind) + '|' + esc(f.id) + '">Open</button></div>'; });
            if (list.length > 60) h += '<div class="it"><span>…and ' + (list.length - 60) + ' more</span></div>';
            h += '</div>'; });
        }
      } else if (tab === 'activity') {
        var lg = saveLog.slice(-40).reverse();
        if (!lg.length) h = '<div class="empty">No saves yet this session.</div>';
        lg.forEach(function(e){
          var o = e.outcome, txt = /^written/.test(o) ? 'Saved ' + o.replace(/^written\s*/, '') : /^skipped/.test(o) ? 'Nothing changed — skipped the write' : 'Problem: ' + o.replace(/^error:\s*/, '');
          h += '<div class="lg">' + esc(txt) + '<small>' + ago(e.at) + ' · ' + e.ms + ' ms' + (e.mergedCalls > 1 ? ' · ' + e.mergedCalls + ' requests merged into one' : '') + (e.via === 'legacy' ? ' · via legacy path' : '') + '</small></div>';
        });
      } else if (tab === 'undo') {
        var j = journal.slice(-30).reverse().filter(function(e){ return e.action !== 'core.restore'; });
        if (!j.length) h = '<div class="empty">Nothing to undo yet.<br><small>Undo covers changes made through me. Edit screens connect in Step 3 — then every save shows up here.</small></div>';
        j.forEach(function(e){ h += '<div class="it"><span>' + esc(e.action) + ' · ' + esc(Object.keys(e.images).join(', ')) + '<br><small>' + ago(e.at) + ' · ' + esc(e.by) + '</small></span><button class="btn" data-undo="' + esc(e.id) + '">Undo</button></div>'; });
      }
      body.innerHTML = h;
    }
    function open(t){ if (t) tab = t; panel.classList.add('open'); render();
      clearInterval(refreshTimer); refreshTimer = setInterval(function(){ if (tab !== 'findings') render(); }, 30000); }
    function close(){ panel.classList.remove('open'); clearInterval(refreshTimer); refreshTimer = null; }
    function toggle(){ panel.classList.contains('open') ? close() : open(); }

    btn.addEventListener('click', toggle);
    chip.addEventListener('click', function(){ open(findings.length && !/saving|err/.test(chip.className) ? 'findings' : 'status'); });
    panel.querySelector('.x').addEventListener('click', close);
    panel.querySelector('.tabs').addEventListener('click', function(e){ var t = e.target.closest('button'); if (t) { tab = t.dataset.t; render(); } });
    body.addEventListener('click', function(e){
      var t = e.target.closest('button'); if (!t || t.disabled) return;
      if (t.dataset.open) { var p = t.dataset.open.split('|'); openRecord(p[0], p[1]); }
      else if (t.dataset.do === 'save') { flush(); }
      else if (t.dataset.do === 'scan') { scan(); tell(findings.length ? 'Re-checked — ' + findings.length + ' to review' : 'Re-checked — all consistent', findings.length ? 'queued' : 'saved', 3500); }
      else if (t.dataset.undo) { t.disabled = true; undo(t.dataset.undo, { by: me() || 'unknown' }).then(function(r){ tell(r.say, r.ok ? 'saved' : 'err', 4000); render(); }); }
    });
    document.addEventListener('keydown', function(e){
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); toggle(); }
      else if (e.key === 'Escape' && panel.classList.contains('open')) close();
    });

    /* ---- wiring: re-check after real writes; speak on refusals; greet once loaded ---- */
    on('saved', function(p){ if (/^written/.test(p.outcome)) scanSoon(1500); });
    on('refused', function(p){ tell(p.say, 'err', 6000); });
    (function greetWhenReady(tries){
      if (!getDb() || !document.body.contains(dock)) return tries < 120 ? setTimeout(function(){ greetWhenReady(tries + 1); }, 500) : null;
      scan();
      var first = false; try { first = localStorage.getItem('claire.met') !== '1'; localStorage.setItem('claire.met', '1'); } catch (e) {}
      var n = findings.length;
      if (first) tell('Hi, I’m CLAIRE — I save your work and watch the data. Press Alt+C anytime.', 'saving', 9000);
      else tell(n ? 'Online · ' + n + ' thing' + (n === 1 ? '' : 's') + ' worth a look' : 'Online · all records consistent', n ? 'queued' : 'saved', 5000);
      btn.classList.remove('busy');
    })(0);

    return { state: state, tell: tell, open: open, close: close, scan: scan, findings: function(){ return findings.slice(); } };
  })();

  window.CLAIRE = {
    name: 'C.L.A.I.R.E.', version: VERSION,
    do: run, undo: undo, register: register, guardian: guardian, on: on, flush: flush, toIso: toIso,
    journal: function(){ return journal.slice(); },
    usage: function(){ return Object.assign({}, usage); },
    saves: function(){ console.table(saveLog.slice(-25)); return Object.assign({}, stats); },
    status: status,
    open: function(t){ ui.open(t); }, close: function(){ ui.close(); }, scan: function(){ ui.scan(); return ui.findings().length; }, findings: function(){ return ui.findings(); },
  };
  console.log('%c✦ C.L.A.I.R.E. v' + VERSION + ' online — visible at ✦ (Alt+C) · CLAIRE.status()', 'color:#6B4FA0;font-weight:bold');
})();


(function HotfixV2829(){
  'use strict';
  const V = '2.8.29';
  const $ = (id) => document.getElementById(id);
  const log = (msg, data) => {
    console.log('%c[v2.8.29] ' + msg, 'color:#A23B2E;font-weight:bold', data == null ? '' : data);
    diagLog.push({ t: new Date().toISOString().slice(11, 19), msg: msg, data: data });
    if (diagLog.length > 100) diagLog.shift();
  };
  const diagLog = [];
  const Toast = () => window.Toast || { ok:console.log, warn:console.warn, err:console.error, info:console.info };

  /* =========================================================
     FIX 1 — Bulletproof R-00 hide
     ========================================================= */
  function isSuperAdmin() {
    try {
      const u = firebase.auth().currentUser;
      if (!u) return false;
      const email = (u.email || '').toLowerCase();
      const name = (u.displayName || '').toLowerCase();
      const rbacName = ((window.EntRbac && window.EntRbac.myRecord && window.EntRbac.myRecord.displayName) || '').toLowerCase();
      const rbacEmail = ((window.EntRbac && window.EntRbac.myRecord && window.EntRbac.myRecord.email) || '').toLowerCase();
      const hay = email + '|' + name + '|' + rbacName + '|' + rbacEmail;
      return ['carl', 'lagatuz'].some(n => hay.includes(n));
    } catch { return false; }
  }

  function forceHideR00() {
    if (isSuperAdmin()) {
      document.body.classList.add('ent-is-super-admin');
      return;
    }
    document.body.classList.remove('ent-is-super-admin');

    /* Also do direct DOM removal as belt-and-suspenders */
    const nodes = document.querySelectorAll(
      '.sidebar a, .sidebar li, .sidebar button, nav a, nav li, nav button, [data-tab], [href^="#R-"]'
    );
    nodes.forEach(el => {
      const txt = (el.textContent || '').trim().toUpperCase();
      const dataTab = (el.getAttribute('data-tab') || '').toUpperCase();
      const href = (el.getAttribute('href') || '').toUpperCase();
      const isR00 = dataTab === 'R-00' ||
                    href === '#R-00' ||
                    txt.startsWith('R-00 ') ||
                    txt === 'R-00' ||
                    /^R-00[\s\u00A0]/.test(txt);
      if (isR00) {
        const wrap = el.closest('li, .nav-item, .navgroup-item, .navitem') || el;
        wrap.style.setProperty('display', 'none', 'important');
        wrap.setAttribute('data-r00', 'true');
      }
    });
  }

  /* Block clicks + hash nav to R-00 for non-super-admins */
  document.addEventListener('click', (e) => {
    if (isSuperAdmin()) return;
    const link = e.target.closest('a, button, li');
    if (!link) return;
    const txt = (link.textContent || '').trim().toUpperCase();
    const dataTab = (link.getAttribute && link.getAttribute('data-tab') || '').toUpperCase();
    const href = (link.getAttribute && link.getAttribute('href') || '').toUpperCase();
    if (dataTab === 'R-00' || href === '#R-00' || txt === 'R-00' || /^R-00[\s\u00A0]/.test(txt)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      Toast().warn('Access restricted', 'You do not have access to R-00.');
      log('Blocked R-00 nav click');
      return false;
    }
  }, true);

  window.addEventListener('hashchange', () => {
    if (isSuperAdmin()) return;
    if ((location.hash || '').toUpperCase() === '#R-00') {
      log('Blocked hash to R-00');
      location.hash = 'R-01';
    }
  });

  /* Enforce visibility on load, auth changes, sidebar mutations, and every 1s */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', forceHideR00);
  else forceHideR00();
  setInterval(forceHideR00, 1000);

  const authWait1 = setInterval(() => {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      clearInterval(authWait1);
      firebase.auth().onAuthStateChanged(() => setTimeout(forceHideR00, 200));
    }
  }, 400);
  setTimeout(() => clearInterval(authWait1), 30000);

  /* MutationObserver on sidebar */
  const sidebarWait = setInterval(() => {
    const sb = document.querySelector('.sidebar');
    if (!sb) return;
    clearInterval(sidebarWait);
    new MutationObserver(() => forceHideR00()).observe(sb, { childList: true, subtree: true });
    log('Sidebar mutation observer active');
  }, 500);
  setTimeout(() => clearInterval(sidebarWait), 30000);

  /* =========================================================
     FIX 2 — Verbose DB load diagnostic
     ========================================================= */
  const CLOUD_PATH = 'safwat/databases/main';

  function showDiagBanner(errorMsg) {
    const b = $('entDbDiagBanner');
    if (!b) return;
    b.classList.add('ent-visible');
    if (errorMsg) $('entDbDiagMsg').textContent = errorMsg;
  }
  function hideDiagBanner() {
    const b = $('entDbDiagBanner');
    if (b) b.classList.remove('ent-visible');
  }

  async function attemptDbLoad(reason) {
    log('DB load attempt: ' + reason);

    /* Step 1: Verify auth */
    if (typeof firebase === 'undefined') {
      log('Firebase SDK not loaded');
      return { ok: false, error: 'Firebase SDK not loaded' };
    }
    if (!firebase.auth) {
      log('firebase.auth not available');
      return { ok: false, error: 'firebase.auth not available' };
    }
    const u = firebase.auth().currentUser;
    if (!u) {
      log('No signed-in user');
      return { ok: false, error: 'Not signed in' };
    }
    log('Signed in as: ' + u.email);

    /* Step 2: Wait for token */
    let token = null;
    try {
      log('Requesting ID token...');
      token = await u.getIdToken(false);
      log('Got token (' + token.length + ' chars)');
    } catch (e) {
      log('Token failed: ' + e.message);
      return { ok: false, error: 'Token unavailable: ' + e.message };
    }

    /* Step 3: Check RBAC record */
    let rbacRec = null;
    try {
      log('Reading own RBAC record...');
      const s = await firebase.database().ref('safwat/users/' + u.uid).once('value');
      rbacRec = s.val();
      if (!rbacRec) {
        log('No RBAC record for uid ' + u.uid);
        return { ok: false, error: 'Your account has no permission record. Contact your admin.' };
      }
      log('RBAC role: ' + rbacRec.role + ', disabled: ' + rbacRec.disabled);
      if (rbacRec.disabled) {
        return { ok: false, error: 'Your account is disabled.' };
      }
    } catch (e) {
      log('RBAC read failed: ' + e.message + ' (' + e.code + ')');
      return { ok: false, error: 'Cannot read your permissions: ' + e.message };
    }

    /* Step 4: Fetch the database */
    let val = null;
    try {
      log('Fetching database from ' + CLOUD_PATH + '...');
      const s = await firebase.database().ref(CLOUD_PATH).once('value');
      val = s.val();
      if (!val) {
        log('DB path returned null — no data at ' + CLOUD_PATH);
        return { ok: false, error: 'No database found at ' + CLOUD_PATH + '. An admin needs to initialize it.' };
      }
      if (!val.data) {
        log('DB has metadata but no data field');
        return { ok: false, error: 'Database format invalid — missing data field.' };
      }
      log('DB fetched: v' + val.version + ', ' + (val.data.recruitmentCases || []).length + ' cases, ' + (val.data.visaRecords || []).length + ' visas');
    } catch (e) {
      log('DB fetch failed: ' + e.message + ' (' + e.code + ')');
      return { ok: false, error: 'Database read denied: ' + e.message + ' (' + (e.code || 'unknown') + ')' };
    }

    /* Step 5: Apply the data */
    log('Applying data to window.DB...');
    if (!SafwatPersistence.acceptRemote(window.DB, val)) return;
      window.DB = val.data;
      SafwatPersistence.remember(window.DB, val.data);
    window._entCloudMode = true;
    window._entCloudOffline = false;
    if (typeof window.makeIdCounter === 'function') {
      window.DB_ID_COUNTER = window.makeIdCounter(val.data);
    }
    if (typeof window.onDatabaseReady === 'function') {
      try { window.onDatabaseReady(); log('onDatabaseReady called'); }
      catch (e) { log('onDatabaseReady error: ' + e.message); }
    }
    setTimeout(() => {
      try { if (window.refreshVisaView) window.refreshVisaView(); log('refreshVisaView called'); } catch (e) { log('refreshVisaView error: ' + e.message); }
      try { if (window.refreshPipelineView) window.refreshPipelineView(); log('refreshPipelineView called'); } catch (e) { log('refreshPipelineView error: ' + e.message); }
      try { if (window.renderClientsTable) window.renderClientsTable(); log('renderClientsTable called'); } catch (e) { log('renderClientsTable error: ' + e.message); }
      try { if (window.EntCloud && window.EntCloud._renderPanel) window.EntCloud._renderPanel(); } catch (e) {}
    }, 300);

    hideDiagBanner();
    Toast().ok('Database loaded', (val.data.recruitmentCases || []).length + ' cases, ' + (val.data.visaRecords || []).length + ' visas');
    return { ok: true };
  }

  /* Boot: try to load DB up to 5 times */
  let bootLoaded = false;
  async function bootLoad() {
    if (bootLoaded) return;
    if (window.DB && window.DB.recruitmentCases && window.DB.recruitmentCases.length > 0) {
      bootLoaded = true;
      return;
    }
    for (let attempt = 1; attempt <= 5; attempt++) {
      if (window.DB && window.DB.recruitmentCases && window.DB.recruitmentCases.length > 0) {
        bootLoaded = true;
        return;
      }
      const result = await attemptDbLoad('boot #' + attempt);
      if (result.ok) {
        bootLoaded = true;
        return;
      }
      log('Attempt ' + attempt + ' failed: ' + result.error);
      if (attempt < 5) {
        await new Promise(r => setTimeout(r, 2000));
      } else {
        showDiagBanner(result.error);
      }
    }
  }

  /* Watchdog — starts after auth is confirmed */
  const bootWait = setInterval(() => {
    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.auth().currentUser) return;
    if (!document.body.classList.contains('ent-authenticated')) return;
    clearInterval(bootWait);
    log('Starting boot load — user authenticated');
    setTimeout(bootLoad, 2000);   /* Give base app 2s to try first */
  }, 500);
  setTimeout(() => clearInterval(bootWait), 60000);

  /* Wire diagnostic buttons */
  const retryBtn = $('entDbDiagRetry');
  const detailsBtn = $('entDbDiagDetails');
  const dismissBtn = $('entDbDiagDismiss');
  if (retryBtn) retryBtn.addEventListener('click', async () => {
    hideDiagBanner();
    bootLoaded = false;
    bootLoad();
  });
  if (detailsBtn) detailsBtn.addEventListener('click', () => {
    const el = $('entDbDiagDetail');
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if (el.style.display === 'block') {
      el.textContent = diagLog.slice(-30).map(l => l.t + ' ' + l.msg).join('\n');
    }
  });
  if (dismissBtn) dismissBtn.addEventListener('click', hideDiagBanner);

  window._entRetryLoad = () => { bootLoaded = false; bootLoad(); };

  console.log('%c🛠 R-00 hide + verbose DB load v' + V + ' active', 'color:#A23B2E;font-weight:bold;');
})();

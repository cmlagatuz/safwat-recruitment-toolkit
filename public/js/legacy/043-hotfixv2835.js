
(function HotfixV2835(){
  'use strict';
  const V = '2.8.35';
  const $ = (id) => document.getElementById(id);
  const log = (...a) => console.log('%c[v2.8.35]', 'color:#A23B2E;font-weight:bold', ...a);

  const CLOUD_PATH = 'safwat/databases/main';
  let recoveryAttempts = 0;
  let recoverySucceeded = false;

  function showBanner(title, detail, state) {
    const b = $('entRecoveryBanner');
    if (!b) return;
    b.className = 'ent-visible' + (state ? ' ent-' + state : '');
    $('entRbTitle').innerHTML = (state === 'success' || state === 'error' ? '' : '<span class="ent-rb-spinner"></span>') + title;
    $('entRbDetail').textContent = detail || '';
  }
  function hideBanner() {
    const b = $('entRecoveryBanner');
    if (b) b.className = '';
  }

  function hasValidData() {
    return !!(window.DB &&
              window.DB.recruitmentCases &&
              window.DB.recruitmentCases.length > 0);
  }

  function isAuthenticated() {
    return !!(typeof firebase !== 'undefined' &&
              firebase.auth &&
              firebase.auth().currentUser);
  }

  /* Directly fetch data — no dependencies on EntCloud, EntSync, etc. */
  async function directFetchAndApply() {
    if (!isAuthenticated()) {
      log('Not authenticated — skipping recovery');
      return false;
    }
    recoveryAttempts++;
    log('Recovery attempt #' + recoveryAttempts);

    showBanner('Loading data…', 'Fetching from Firebase (attempt ' + recoveryAttempts + ')');

    /* Step 1: Verify token */
    try {
      await firebase.auth().currentUser.getIdToken(false);
    } catch (e) {
      log('Token failed: ' + e.message);
      showBanner('Auth issue', 'Token unavailable: ' + e.message, 'error');
      return false;
    }

    /* Step 2: Fetch the DB */
    let val = null;
    try {
      const snap = await firebase.database().ref(CLOUD_PATH).once('value');
      val = snap.val();
    } catch (e) {
      log('Fetch failed: ' + e.message + ' (' + e.code + ')');
      showBanner('Cannot fetch DB', e.message + ' (' + (e.code || 'unknown') + ')', 'error');
      return false;
    }

    if (!val || !val.data) {
      log('DB empty or no data field');
      showBanner('DB empty', 'No data at ' + CLOUD_PATH, 'error');
      return false;
    }

    const cases = val.data.recruitmentCases?.length || 0;
    const visas = val.data.visaRecords?.length || 0;
    log('Fetched: ' + cases + ' cases, ' + visas + ' visas, v' + val.version);

    /* Step 3: Apply to window.DB */
    if (!SafwatPersistence.acceptRemote(window.DB, val)) return;
      window.DB = val.data;
      SafwatPersistence.remember(window.DB, val.data);
    window._entCloudMode = true;
    window._entCloudOffline = false;
    if (typeof window.makeIdCounter === 'function') {
      try { window.DB_ID_COUNTER = window.makeIdCounter(val.data); } catch (e) {}
    }

    /* Step 4: Trigger onDatabaseReady + explicit view refresh */
    if (typeof window.onDatabaseReady === 'function') {
      try { window.onDatabaseReady(); log('onDatabaseReady called'); }
      catch (e) { log('onDatabaseReady error: ' + e.message); }
    }

    /* Wait a beat then explicitly refresh views */
    await new Promise(r => setTimeout(r, 500));
    try { if (window.refreshVisaView) { window.refreshVisaView(); log('refreshVisaView called'); } } catch (e) { log('refreshVisaView error: ' + e.message); }
    try { if (window.refreshPipelineView) { window.refreshPipelineView(); log('refreshPipelineView called'); } } catch (e) { log('refreshPipelineView error: ' + e.message); }
    try { if (window.renderClientsTable) { window.renderClientsTable(); log('renderClientsTable called'); } } catch (e) { log('renderClientsTable error: ' + e.message); }

    /* Verify data actually shows */
    await new Promise(r => setTimeout(r, 500));
    if (hasValidData()) {
      recoverySucceeded = true;
      showBanner('✓ Data loaded', cases + ' cases, ' + visas + ' visas', 'success');
      setTimeout(hideBanner, 3500);
      log('Recovery successful');
      return true;
    } else {
      log('Data assigned but hasValidData is false — retrying');
      return false;
    }
  }

  /* Watchdog: check every 2 seconds — if authenticated but no data, recover */
  let watchTimer = null;
  function startWatchdog() {
    if (watchTimer) clearInterval(watchTimer);
    let waitedForAuth = 0;
    watchTimer = setInterval(async () => {
      if (recoverySucceeded) {
        clearInterval(watchTimer);
        return;
      }

      if (!isAuthenticated()) {
        waitedForAuth += 2;
        if (waitedForAuth > 30) {
          log('Auth timeout — giving up');
          clearInterval(watchTimer);
        }
        return;
      }

      if (hasValidData()) {
        /* Data appeared naturally through some other path — great */
        clearInterval(watchTimer);
        hideBanner();
        return;
      }

      if (recoveryAttempts >= 10) {
        showBanner('Load failed', 'Give up after 10 attempts. Check console.', 'error');
        clearInterval(watchTimer);
        return;
      }

      /* Try recovery */
      await directFetchAndApply();
    }, 3000);
  }

  /* Kick off after page load + wait 4s to let existing paths try first */
  function boot() {
    setTimeout(startWatchdog, 4000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* Also boot on auth state changes */
  const authWait = setInterval(() => {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      clearInterval(authWait);
      firebase.auth().onAuthStateChanged((u) => {
        if (u) {
          recoveryAttempts = 0;
          recoverySucceeded = false;
          setTimeout(startWatchdog, 4000);
        } else {
          hideBanner();
          if (watchTimer) clearInterval(watchTimer);
        }
      });
    }
  }, 400);
  setTimeout(() => clearInterval(authWait), 30000);

  /* Expose manual trigger for console debugging */
  window._entForceRecover = async () => {
    recoveryAttempts = 0;
    recoverySucceeded = false;
    await directFetchAndApply();
  };

  console.log('%c🚨 Aggressive DB recovery v' + V + ' active', 'color:#A23B2E;font-weight:bold;');
})();

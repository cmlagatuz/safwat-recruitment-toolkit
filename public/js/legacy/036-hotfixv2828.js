
(function HotfixV2828(){
  'use strict';
  const V = '2.8.28';
  const $ = (id) => document.getElementById(id);
  const log = (...a) => console.log('%c[v2.8.28]', 'color:#A23B2E;font-weight:bold', ...a);
  const Toast = () => window.Toast || { ok:console.log, warn:console.warn, err:console.error, info:console.info };

  const CLOUD_PATH = 'safwat/databases/main';

  /* =========================================================
     Ensure Firebase Auth token is fully ready
     ========================================================= */
  async function waitForAuthToken(timeoutMs) {
    timeoutMs = timeoutMs || 15000;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
          const token = await firebase.auth().currentUser.getIdToken(false);
          if (token && token.length > 100) return true;
        }
      } catch (e) { /* keep trying */ }
      await new Promise(r => setTimeout(r, 300));
    }
    return false;
  }

  /* =========================================================
     Fetch DB from Firebase with retries — no cache fallback
     ========================================================= */
  async function fetchDbFromFirebase(maxAttempts) {
    maxAttempts = maxAttempts || 5;
    for (let i = 1; i <= maxAttempts; i++) {
      try {
        log('Firebase fetch attempt ' + i + '/' + maxAttempts);
        const snap = await firebase.database().ref(CLOUD_PATH).once('value');
        const val = snap.val();
        if (val && val.data) {
          log('Firebase fetch OK on attempt ' + i +
              ' — version ' + val.version +
              ', savedAt ' + val.savedAt +
              ', ' + (val.data.recruitmentCases || []).length + ' cases, ' +
              (val.data.visaRecords || []).length + ' visas');
          return val;
        }
        log('Firebase returned no data on attempt ' + i);
        return null;   // no data, no need to retry
      } catch (e) {
        log('Firebase fetch attempt ' + i + ' failed: ' + e.message);
        if (i < maxAttempts) {
          await new Promise(r => setTimeout(r, 1500 * i));   // backoff: 1.5s, 3s, 4.5s...
        }
      }
    }
    throw new Error('All Firebase fetch attempts failed');
  }

  /* =========================================================
     Force-load fresh data from Firebase
     ========================================================= */
  async function forceFreshLoad(reason) {
    reason = reason || 'manual';
    log('Force fresh load initiated (' + reason + ')');
    /* Wait for auth token */
    const tokenReady = await waitForAuthToken(10000);
    if (!tokenReady) {
      log('Auth token not ready — skipping');
      return false;
    }

    let val;
    try {
      val = await fetchDbFromFirebase(5);
    } catch (e) {
      log('All Firebase attempts failed:', e.message);
      Toast().err('Cloud load failed', 'Using cached data. Click Reload to try again.');
      return false;
    }
    if (!val || !val.data) {
      log('No data at ' + CLOUD_PATH);
      return false;
    }

    /* Compare with current in-memory DB */
    const localSavedAt = window.DB && window.DB.meta && window.DB.meta.savedAt || '';
    const remoteSavedAt = val.savedAt || '';
    if (window.DB && localSavedAt && remoteSavedAt && localSavedAt === remoteSavedAt) {
      log('Already up to date');
      return true;
    }

    /* Apply fresh data */
    log('Applying fresh data (local: ' + localSavedAt + ', remote: ' + remoteSavedAt + ')');
    if (!SafwatPersistence.acceptRemote(window.DB, val)) return;
      window.DB = val.data;
      SafwatPersistence.remember(window.DB, val.data);
    window._entCloudMode = true;
    window._entCloudOffline = false;
    if (typeof window.makeIdCounter === 'function') {
      window.DB_ID_COUNTER = window.makeIdCounter(val.data);
    }
    if (typeof window.onDatabaseReady === 'function') {
      try { window.onDatabaseReady(); } catch (e) { log('onDatabaseReady:', e.message); }
    }
    /* Explicit view refreshes */
    setTimeout(() => {
      try { if (window.refreshVisaView) window.refreshVisaView(); } catch (e) { log('refreshVisaView:', e.message); }
      try { if (window.refreshPipelineView) window.refreshPipelineView(); } catch (e) { log('refreshPipelineView:', e.message); }
      try { if (window.renderClientsTable) window.renderClientsTable(); } catch (e) { log('renderClientsTable:', e.message); }
    }, 300);
    /* Update cloud panel display */
    setTimeout(() => {
      if (window.EntCloud && window.EntCloud._renderPanel) window.EntCloud._renderPanel();
    }, 500);

    Toast().ok('Cloud data refreshed', (val.data.recruitmentCases || []).length + ' cases, ' + (val.data.visaRecords || []).length + ' visas');
    return true;
  }
  window._entForceFreshLoad = forceFreshLoad;

  /* =========================================================
     Boot: run fresh load after sign-in
     ========================================================= */
  let bootAttempted = false;

  async function bootFreshLoad() {
    if (bootAttempted) return;

    /* Wait for authentication + Firebase to be ready */
    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.database) return;
    if (!firebase.auth().currentUser) return;
    if (!document.body.classList.contains('ent-authenticated')) return;

    bootAttempted = true;
    log('Boot fresh load triggered');
    /* Small delay to let base app's cloud auto-open run first */
    setTimeout(() => forceFreshLoad('boot'), 1500);
    /* Second attempt 5s later as safety net */
    setTimeout(() => forceFreshLoad('boot-retry'), 5000);
  }

  /* Poll until conditions are met, then boot */
  let bootPoll = 0;
  const bootTimer = setInterval(() => {
    bootPoll++;
    bootFreshLoad();
    if (bootAttempted || bootPoll > 60) clearInterval(bootTimer);
  }, 500);

  /* Also boot on auth-state changes (in case sign-in happens later) */
  const authWait = setInterval(() => {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      clearInterval(authWait);
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          bootAttempted = false;
          setTimeout(bootFreshLoad, 1000);
        }
      });
    }
  }, 400);
  setTimeout(() => clearInterval(authWait), 30000);

  /* =========================================================
     Also override EntCloud.openFromCloud to skip cache fallback
     ========================================================= */
  function patchCloudModule() {
    if (!window.EntCloud || !window.EntCloud.openFromCloud) {
      return setTimeout(patchCloudModule, 500);
    }
    if (window.EntCloud._v2828Patched) return;
    window.EntCloud._v2828Patched = true;

    /* Manual "Reload from cloud" now goes through our fresh loader */
    window.EntCloud.openFromCloud = async function() {
      return await forceFreshLoad('manual-reload');
    };
    log('EntCloud.openFromCloud replaced with force-fresh version');
  }
  patchCloudModule();

  /* =========================================================
     Periodic freshness check (every 60s while active)
     If remote savedAt is newer than local, apply it silently.
     Catches cases where the user was AFK and someone else saved.
     ========================================================= */
  setInterval(async () => {
    if (!document.body.classList.contains('ent-authenticated')) return;
    if (!window.DB) return;
    try {
      const snap = await firebase.database().ref(CLOUD_PATH + '/savedAt').once('value');
      const remoteSavedAt = snap.val();
      const localSavedAt = window.DB.meta && window.DB.meta.savedAt || '';
      if (remoteSavedAt && localSavedAt && remoteSavedAt > localSavedAt) {
        log('Detected newer remote (' + remoteSavedAt + ' > ' + localSavedAt + ') — refreshing');
        await forceFreshLoad('periodic-check');
      }
    } catch (e) { /* silent */ }
  }, 60000);

  console.log('%c🔄 Force fresh DB load v' + V + ' active', 'color:#A23B2E;font-weight:bold;');
})();

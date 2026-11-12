
(function HotfixV251(){
  'use strict';
  const V = '2.5.1';
  const $ = (id) => document.getElementById(id);
  const nowIso = () => new Date().toISOString();
  const log = (...a) => console.log('%c[v2.5.1]', 'color:#3F6C4D;font-weight:bold', ...a);
  const CLOUD_PATH = 'safwat/databases/main';   // single source of truth

  /* =========================================================
     FIX 1 — Make dbIsOpen() cloud-aware
     ========================================================= */
  window.dbIsOpen = function() {
    return !!window.DB && (window.DB_FILE_HANDLE !== null || window._entCloudMode === true);
  };
  log('Patched dbIsOpen() to recognize cloud mode');

  /* =========================================================
     FIX 2 — Direct cloud write/read (bypass EntSync path
     sanitization). Always uses safwat/databases/main.
     ========================================================= */
  async function directCloudLoad() {
    if (typeof firebase === 'undefined' || !firebase.database) throw new Error('Firebase not ready');
    const snap = await firebase.database().ref(CLOUD_PATH).once('value');
    return snap.val();
  }
  async function directCloudSave() {
    if (!window.CLAIRE) throw new Error('Wait for the save service to initialize.');
    await window.dbSave();
    return window.CLAIRE.status().lastWrittenVersion;
  }
  window._entCloudDirectLoad = directCloudLoad;
  window._entCloudDirectSave = directCloudSave;

  /* =========================================================
     FIX 3 — Override the Cloud.openFromCloud to use direct
     path, and force refresh of R-01/R-02 after load.
     ========================================================= */
  function refreshAllViews() {
    log('Refreshing all views after cloud load');
    try { if (typeof window.refreshVisaView === 'function') window.refreshVisaView(); } catch (e) { console.warn('refreshVisaView:', e.message); }
    try { if (typeof window.refreshPipelineView === 'function') window.refreshPipelineView(); } catch (e) { console.warn('refreshPipelineView:', e.message); }
    try { if (typeof window.renderClientsTable === 'function') window.renderClientsTable(); } catch (e) { console.warn('renderClientsTable:', e.message); }
    // Force show dashboards (some hide themselves when dbIsOpen returned false previously)
    ['visaDashboard', 'pipelineDashboard'].forEach(id => { const e = $(id); if (e) e.style.display = 'block'; });
    ['visaNoDbNotice', 'pipelineNoDbNotice', 'dbNoFileNotice'].forEach(id => { const e = $(id); if (e) e.style.display = 'none'; });
    const tools = $('dbFileTools'); if (tools) tools.style.display = 'block';
    // Ask EntCloud to re-render its panel to show fresh counts
    if (window.EntCloud && typeof window.EntCloud._renderPanel === 'function') window.EntCloud._renderPanel();
  }
  window._entRefreshAllViews = refreshAllViews;

  // Wait for EntCloud to exist, then override its methods
  function hookCloudModule() {
    if (!window.EntCloud) return setTimeout(hookCloudModule, 300);

    // Override openFromCloud with a version that uses direct path
    const origOpen = window.EntCloud.openFromCloud.bind(window.EntCloud);
    window.EntCloud.openFromCloud = async function() {
      this.show('Loading database…', 'Fetching from Firebase');
      try {
        const remote = await directCloudLoad();
        if (remote && remote.data) {
          log('Direct load OK:', (remote.data.recruitmentCases || []).length, 'cases,', (remote.data.visaRecords || []).length, 'visas');
          this._activate(remote.data, false);
          refreshAllViews();
          this.hide();
          if (window.Toast) window.Toast.ok('Database loaded', (remote.data.recruitmentCases || []).length + ' cases, ' + (remote.data.visaRecords || []).length + ' visas');
          return true;
        } else {
          log('No cloud DB at ' + CLOUD_PATH + ' — creating empty');
          const empty = this._emptyDb();
          this._activate(empty, false);
          try { await directCloudSave(); } catch (e) { log('Initial save failed:', e.message); }
          refreshAllViews();
          this.hide();
          if (window.Toast) window.Toast.info('Empty cloud database initialized');
          return true;
        }
      } catch (e) {
        log('Direct load failed:', e.message);
        this.hide();
        if (window.Toast) window.Toast.err('Load failed', e.message);
        return false;
      }
    };

    // Override importJson to use direct save
    const origImport = window.EntCloud.importJson.bind(window.EntCloud);
    window.EntCloud.importJson = function() {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'application/json,.json';
      inp.addEventListener('change', async () => {
        const f = inp.files[0]; if (!f) return;
        if (!confirm('Replace the cloud database with the contents of "' + f.name + '"?\n\nThe current cloud DB will be OVERWRITTEN. Anyone else signed in will receive the imported data on their next sync.')) return;
        try {
          const text = await f.text();
          const parsed = JSON.parse(text);
          if (!parsed || !parsed.recruitmentCases || !parsed.visaRecords) {
            alert('That doesn\'t look like a valid Safwat database file.');
            return;
          }
          window.DB = parsed;
          window._entCloudMode = true;
          log('Importing', parsed.recruitmentCases.length, 'cases,', parsed.visaRecords.length, 'visas to cloud');
          const v = await directCloudSave();
          log('Import save OK, version:', v);
          if (typeof window.onDatabaseReady === 'function') window.onDatabaseReady();
          refreshAllViews();
          if (window.Toast) window.Toast.ok('Imported to cloud', parsed.recruitmentCases.length + ' cases, ' + parsed.visaRecords.length + ' visas');
        } catch (e) {
          log('Import error:', e.message);
          alert('Import failed: ' + e.message);
        }
      });
      inp.click();
    };

    log('EntCloud module patched with direct-path methods');
  }
  hookCloudModule();

  /* =========================================================
     FIX 4 — Cloud-mode dbSave uses direct path
     ========================================================= */
  const origDbSave = window.dbSave;
  window.dbSave = async function v251DbSave() {
    if (!window._entCloudMode) return origDbSave ? origDbSave.apply(this, arguments) : false;
    if (!window.DB) return false;
    try {
      const v = await directCloudSave();
      const pill = $('dbStatusPill');
      if (pill) { pill.textContent = 'Cloud v' + v + ' — saved ' + new Date().toLocaleTimeString(); pill.className = 'status-pill'; }
      log('Direct save OK, version:', v);
      return true;
    } catch (e) {
      log('Direct save failed:', e.message);
      const pill = $('dbStatusPill');
      if (pill) { pill.textContent = 'Save failed: ' + e.message; pill.className = 'status-pill err'; }
      if (window.Toast) window.Toast.err('Save failed', e.message);
      return false;
    }
  };

  /* =========================================================
     FIX 5 — Subscribe to live remote changes at direct path
     ========================================================= */
  function subscribeToRemoteChanges() {
    if (typeof firebase === 'undefined' || !firebase.database || !firebase.auth || !firebase.auth().currentUser) {
      return setTimeout(subscribeToRemoteChanges, 800);
    }
    if (window._entV251Subscribed) return;
    window._entV251Subscribed = true;
    let lastVer = -1;
    firebase.database().ref(CLOUD_PATH).on('value', (snap) => {
      const val = snap.val();
      if (!val || !val.data) return;
      if (val.version <= lastVer) return;
      lastVer = val.version;
      // Skip if this is my own push
      const myUid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : null;
      if (val.updatedBy === myUid) return;
      log('Received remote update from', val.updatedByName, '— applying');
      if (!SafwatPersistence.acceptRemote(window.DB, val)) return;
      window.DB = val.data;
      SafwatPersistence.remember(window.DB, val.data, typeof val.version === 'number' ? val.version : 0, CLOUD_PATH);
      refreshAllViews();
      if (window.Toast) window.Toast.info('Remote update', 'Data refreshed from ' + (val.updatedByName || 'server'));
    });
    log('Subscribed to live changes at ' + CLOUD_PATH);
  }
  subscribeToRemoteChanges();

  /* =========================================================
     FIX 6 — Force a view refresh right now if data is already loaded
     ========================================================= */
  setTimeout(() => {
    if (window._entCloudMode && window.DB) {
      log('Forcing initial view refresh');
      refreshAllViews();
    }
  }, 1500);

  console.log('%c⚡ Cloud path + views hotfix v' + V + ' loaded', 'color:#3F6C4D;font-weight:bold;');
})();

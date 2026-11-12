
(function CloudFirstV250(){
  'use strict';
  const V = '2.5.0';
  const $ = (id) => document.getElementById(id);
  const nowIso = () => new Date().toISOString();
  const log = (...a) => console.log('%c[v2.5.0]', 'color:#2E6FA3;font-weight:bold', ...a);
  const CLOUD_DB_NAME = 'main';   // node under safwat/databases/{name}
  const IDB_NAME = 'safwatCloudCache';
  const IDB_STORE = 'db';

  /* =========================================================
     IndexedDB cache — last known-good copy for offline reads
     ========================================================= */
  const Cache = {
    _db: null,
    async _open() {
      if (this._db) return this._db;
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
        req.onsuccess = () => { this._db = req.result; resolve(this._db); };
        req.onerror = () => reject(req.error);
      });
    },
    async save(data) {
      try {
        const d = await this._open();
        const tx = d.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put({ savedAt: nowIso(), data: data }, CLOUD_DB_NAME);
      } catch (e) { console.warn('cache save failed', e); }
    },
    async load() {
      try {
        const d = await this._open();
        return new Promise(resolve => {
          const tx = d.transaction(IDB_STORE, 'readonly');
          const req = tx.objectStore(IDB_STORE).get(CLOUD_DB_NAME);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });
      } catch { return null; }
    },
    async clear() {
      try {
        const d = await this._open();
        d.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).delete(CLOUD_DB_NAME);
      } catch {}
    },
  };

  /* =========================================================
     Cloud DB loader
     ========================================================= */
  const Cloud = {
    autoOpenAttempted: false,

    show(title, msg) {
      $('entClTitle').textContent = title;
      $('entClMsg').textContent = msg;
      $('entCloudLoading').classList.add('open');
    },
    hide() { $('entCloudLoading').classList.remove('open'); },

    async openFromCloud() {
      this.show('Loading database…', 'Fetching from Firebase');
      try {
        // 1. Try Firebase first
        if (typeof firebase !== 'undefined' && firebase.database) {
          try {
            const snap = await firebase.database().ref('safwat/databases/' + CLOUD_DB_NAME).once('value');
            const remote = snap.val();
            if (remote && remote.data) {
              log('Loaded from Firebase, records:', (remote.data.recruitmentCases || []).length, 'cases,', (remote.data.visaRecords || []).length, 'visas');
              this._activate(remote.data, false, typeof remote.version === 'number' ? remote.version : 0);
              await Cache.save(remote.data);
              this.hide();
              return true;
            } else {
              log('No cloud DB exists — creating empty database');
              // Create empty DB in cloud
              const empty = this._emptyDb();
              this._activate(empty, false);
              // Push it up
              if (window.EntSync && window.EntSync.pushNow) {
                await window.EntSync.pushNow();
              } else {
                await firebase.database().ref('safwat/databases/' + CLOUD_DB_NAME).set({
                  version: 1,
                  savedAt: nowIso(),
                  updatedBy: firebase.auth().currentUser.uid,
                  data: empty,
                });
              }
              await Cache.save(empty);
              this.hide();
              if (window.Toast) window.Toast.info('Empty cloud database initialized');
              return true;
            }
          } catch (e) {
            log('Firebase load failed:', e.message, '— trying cache');
          }
        }
        // 2. Fall back to IndexedDB cache
        const cached = await Cache.load();
        if (cached && cached.data) {
          log('Loaded from IndexedDB cache (saved', cached.savedAt, ')');
          this._activate(cached.data, true);
          if (window.Toast) window.Toast.warn('Offline mode', 'Loaded cached DB from ' + new Date(cached.savedAt).toLocaleString());
          this.hide();
          return true;
        }
        // 3. Neither cloud nor cache — show a clear error
        this.hide();
        if (window.Toast) window.Toast.err('Cannot load database', 'Check your connection or open a local file.');
        return false;
      } catch (e) {
        this.hide();
        log('openFromCloud fatal:', e.message);
        if (window.Toast) window.Toast.err('Load failed', e.message);
        return false;
      }
    },

    _emptyDb() {
      return {
        meta: {
          version: 1,
          schemaVersion: 3,
          createdAt: nowIso(),
          savedAt: nowIso(),
          audit: [],
          security: { encrypted: false, createdBy: 'cloud-bootstrap', createdAt: nowIso() },
        },
        recruitmentCases: [],
        visaRecords: [],
        customStages: [],
      };
    },

    _activate(dbData, isOffline, cloudVersion) {
      if (window.DB && !SafwatPersistence.acceptRemote(window.DB, {data: dbData})) return;
      window.DB = dbData;
      SafwatPersistence.remember(window.DB, dbData, isOffline ? undefined : cloudVersion, 'safwat/databases/' + CLOUD_DB_NAME);
      window.DB_FILE_HANDLE = null;   // no local file — cloud-first mode
      window.DB_FILE_NAME = CLOUD_DB_NAME + '.cloud';
      if (typeof window.makeIdCounter === 'function') window.DB_ID_COUNTER = window.makeIdCounter(dbData);
      window._entCloudMode = true;
      window._entCloudOffline = !!isOffline;
      if (typeof window.onDatabaseReady === 'function') {
        try { window.onDatabaseReady(); } catch (e) { log('onDatabaseReady error:', e.message); }
      }
      this._renderPanel();
    },

    _renderPanel() {
      // Find the R-00 database tab
      const targets = [
        document.querySelector('#dbFileTools'),
        document.querySelector('[data-tab="R-00"]'),
        document.querySelector('#tab-R-00'),
        $('dbNoFileNotice')?.parentNode,
      ].filter(Boolean);
      const target = targets[0];
      if (!target) return;

      let panel = $('entCloudPanel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'entCloudPanel';
        panel.className = 'ent-cloud-panel';
        target.parentNode.insertBefore(panel, target);
      }

      const cases = (window.DB && window.DB.recruitmentCases) ? window.DB.recruitmentCases.length : 0;
      const visas = (window.DB && window.DB.visaRecords) ? window.DB.visaRecords.length : 0;
      const savedAt = window.DB && window.DB.meta && window.DB.meta.savedAt ? new Date(window.DB.meta.savedAt).toLocaleString() : '—';
      const audit = window.DB && window.DB.meta && window.DB.meta.audit ? window.DB.meta.audit.length : 0;

      panel.innerHTML =
        '<h3><span class="ent-cloud-icon">☁ CLOUD</span> Cloud Database — <code>' + CLOUD_DB_NAME + '</code></h3>' +
        '<p>This database is stored in Firebase and syncs across all users automatically. No file picker required.</p>' +
        (window._entCloudOffline ? '<p style="color:var(--brass-dark,#8C6A22);"><b>⚠ Offline:</b> showing last cached snapshot. Reconnect to sync.</p>' : '') +
        '<div class="ent-cloud-stats">' +
          '<div class="ent-cloud-stat"><div class="ent-cs-num">' + cases + '</div><div class="ent-cs-lbl">Recruitment Cases</div></div>' +
          '<div class="ent-cloud-stat"><div class="ent-cs-num">' + visas + '</div><div class="ent-cs-lbl">Visa Records</div></div>' +
          '<div class="ent-cloud-stat"><div class="ent-cs-num">' + audit + '</div><div class="ent-cs-lbl">Audit Entries</div></div>' +
        '</div>' +
        '<p style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--text-soft);">Last saved: ' + savedAt + '</p>' +
        '<div class="ent-cloud-actions">' +
          '<button class="primary" id="entCloudReload">↻ Reload from cloud</button>' +
          '<button id="entCloudExport">⤓ Export as .json backup</button>' +
          '<button id="entCloudImport">⤒ Import from .json</button>' +
        '</div>';

      $('entCloudReload').addEventListener('click', () => this.openFromCloud());
      $('entCloudExport').addEventListener('click', () => this.exportJson());
      $('entCloudImport').addEventListener('click', () => this.importJson());

      // Hide the old "No database open" notice
      const notice = $('dbNoFileNotice');
      if (notice) notice.style.display = 'none';
      const tools = $('dbFileTools');
      if (tools) tools.style.display = 'block';
    },

    async exportJson() {
      if (!window.DB) return;
      const blob = new Blob([JSON.stringify(window.DB, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'safwat_database_backup_' + nowIso().slice(0, 10) + '.json';
      a.click();
      if (window.Toast) window.Toast.ok('Backup downloaded', 'Save this .json somewhere safe.');
    },

    importJson() {
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
          if (window.EntSync && window.EntSync.pushNow) {
            await window.EntSync.pushNow();
          }
          await Cache.save(parsed);
          if (typeof window.onDatabaseReady === 'function') window.onDatabaseReady();
          this._renderPanel();
          if (window.Toast) window.Toast.ok('Imported', parsed.recruitmentCases.length + ' cases, ' + parsed.visaRecords.length + ' visas');
        } catch (e) {
          alert('Import failed: ' + e.message);
        }
      });
      inp.click();
    },
  };
  window.EntCloud = Cloud;

  /* =========================================================
     Override dbSave — cloud-only when in cloud mode
     ========================================================= */
  const origDbSave = window.dbSave;
  window.dbSave = async function cloudFirstDbSave() {
    if (!window._entCloudMode) {
      // Not in cloud mode → fall back to original file-based save
      return origDbSave ? origDbSave.apply(this, arguments) : false;
    }
    if (!window.DB) return false;
    try {
      window.DB.meta = window.DB.meta || {};
      window.DB.meta.savedAt = nowIso();
      // Update local IndexedDB cache immediately
      Cache.save(window.DB);
      // Push to Firebase via EntSync
      if (window.EntSync && window.EntSync.status === 'connected') {
        await window.EntSync.pushNow();
        // Update status pill
        const pill = $('dbStatusPill');
        if (pill) { pill.textContent = 'Cloud — saved ' + new Date().toLocaleTimeString(); pill.className = 'status-pill'; }
        return true;
      } else if (window.EntSync && window.EntSync.status !== 'connected') {
        // Queue for later push
        const pill = $('dbStatusPill');
        if (pill) { pill.textContent = 'Offline — cached, will sync when online'; pill.className = 'status-pill err'; }
        return true;
      }
      return true;
    } catch (e) {
      log('cloudDbSave error:', e.message);
      const pill = $('dbStatusPill');
      if (pill) { pill.textContent = 'Save failed: ' + e.message; pill.className = 'status-pill err'; }
      return false;
    }
  };

  /* =========================================================
     Auto-open cloud DB on sign-in
     ========================================================= */
  function waitForAuthAndOpen() {
    // Wait for: (a) auth complete, (b) sync connected, (c) app revealed
    const timer = setInterval(async () => {
      const authReady = typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser;
      const revealed = document.body.classList.contains('ent-authenticated');
      if (!authReady || !revealed) return;
      if (Cloud.autoOpenAttempted) { clearInterval(timer); return; }
      if (window.DB) { clearInterval(timer); return; }  // already loaded via other means
      Cloud.autoOpenAttempted = true;
      clearInterval(timer);
      log('Auto-opening cloud database');
      await Cloud.openFromCloud();
    }, 500);
    setTimeout(() => clearInterval(timer), 120000);  // give up after 2 min
  }

  // Boot
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForAuthAndOpen);
  else waitForAuthAndOpen();

  // Also re-render panel whenever data changes (light refresh every 30s)
  setInterval(() => {
    if (window._entCloudMode && window.DB && $('entCloudPanel')) Cloud._renderPanel();
  }, 30000);

  console.log('%c☁ Cloud-first mode v' + V + ' loaded', 'color:#2E6FA3;font-weight:bold;');
})();

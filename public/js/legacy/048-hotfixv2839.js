
(function HotfixV2839(){
  'use strict';
  const V = '2.8.39';
  const $ = (id) => document.getElementById(id);
  const nowIso = () => new Date().toISOString();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const log = (...a) => console.log('%c[v2.8.39]', 'color:#8C6A22;font-weight:bold', ...a);
  const Toast = () => window.Toast || { ok:console.log, warn:console.warn, err:console.error, info:console.info };

  const DIAG_PATH = 'safwat/diagnostics/';

  /* =========================================================
     PART 1 — robust diagnostic writer
     ========================================================= */
  async function buildDiag() {
    const u = firebase.auth().currentUser;
    if (!u) return null;
    let rbac = null;
    try {
      const s = await firebase.database().ref('safwat/users/' + u.uid).once('value');
      rbac = s.val();
    } catch (e) {}
    const issues = [];
    if (!rbac) issues.push('no-rbac-record');
    if (rbac?.disabled) issues.push('account-disabled');
    if (!u.emailVerified) issues.push('email-not-verified');
    if (!window.DB) issues.push('no-local-db');
    else if (!window.DB.recruitmentCases?.length) issues.push('empty-cases');
    if (!document.body.classList.contains('ent-authenticated')) issues.push('body-not-authenticated');

    return {
      uid: u.uid,
      email: u.email || '(no email)',
      displayName: u.displayName || rbac?.displayName || u.email?.split('@')[0] || '(no name)',
      role: rbac?.role || '(unknown)',
      disabled: !!rbac?.disabled,
      emailVerified: !!u.emailVerified,
      lastSeenAt: nowIso(),
      caseCount: window.DB?.recruitmentCases?.length || 0,
      visaCount: window.DB?.visaRecords?.length || 0,
      dbSavedAt: window.DB?.meta?.savedAt || null,
      currentTab: (location.hash || '').replace('#', '') || '(none)',
      appAuthenticated: document.body.classList.contains('ent-authenticated'),
      isSuperAdminFlag: localStorage.getItem('safwatEnt.isSuperAdmin') === 'true',
      userAgent: navigator.userAgent.slice(0, 200),
      issues: issues,
      hasIssues: issues.length > 0,
      v: V,
    };
  }

  async function writeDiag() {
    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.auth().currentUser) return;
    try {
      const diag = await buildDiag();
      if (!diag) return;
      await firebase.database().ref(DIAG_PATH + diag.uid).set(diag);
      log('Diagnostic written for ' + diag.email);
    } catch (e) {
      /* Log the exact error so we can debug */
      log('Diagnostic write failed: ' + (e.code || 'unknown') + ' - ' + e.message);
    }
  }

  /* Start writing as soon as authenticated */
  const authWait = setInterval(() => {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      clearInterval(authWait);
      firebase.auth().onAuthStateChanged((u) => {
        if (u) {
          setTimeout(writeDiag, 2000);
          setTimeout(writeDiag, 8000);
          setInterval(writeDiag, 30000);
        }
      });
    }
  }, 400);
  setTimeout(() => clearInterval(authWait), 30000);

  /* =========================================================
     PART 2 — Fix the diagnostics panel
     ========================================================= */
  function isEmptyDiag(u) {
    /* An entry is "empty" if it's missing essential fields */
    if (!u) return true;
    if (!u.email && !u.displayName && !u.uid) return true;
    if (u.caseCount === undefined && u.visaCount === undefined) return true;
    return false;
  }

  async function purgeEntry(uid) {
    if (!uid) return;
    if (!confirm('Purge diagnostic entry for uid ' + uid.slice(0, 12) + '…?')) return;
    try {
      await firebase.database().ref(DIAG_PATH + uid).remove();
      Toast().ok('Purged', uid.slice(0, 12) + '…');
      loadDiagnosticsFixed();
    } catch (e) {
      Toast().err('Purge failed', e.message);
    }
  }

  async function purgeStale() {
    if (!confirm('Purge all diagnostic entries older than 24 hours or empty entries?')) return;
    try {
      const snap = await firebase.database().ref('safwat/diagnostics').once('value');
      const all = snap.val() || {};
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const updates = {};
      let purged = 0;
      Object.entries(all).forEach(([uid, u]) => {
        const shouldPurge = isEmptyDiag(u) ||
                            (u.lastSeenAt && new Date(u.lastSeenAt).getTime() < cutoff);
        if (shouldPurge) {
          updates[uid] = null;
          purged++;
        }
      });
      if (purged > 0) {
        await firebase.database().ref('safwat/diagnostics').update(updates);
        Toast().ok('Purged ' + purged + ' entries');
      } else {
        Toast().info('Nothing to purge');
      }
      loadDiagnosticsFixed();
    } catch (e) {
      Toast().err('Purge failed', e.message);
    }
  }

  async function loadDiagnosticsFixed() {
    const list = $('entDiagUserList');
    if (!list) return;
    list.innerHTML = '<p style="color:#6B6558;text-align:center;padding:20px;">Loading…</p>';
    try {
      const snap = await firebase.database().ref('safwat/diagnostics').once('value');
      const all = snap.val() || {};
      const entries = Object.entries(all)
        .filter(([uid, u]) => !isEmptyDiag(u))
        .map(([uid, u]) => ({ ...u, uid }))
        .sort((a, b) => (b.lastSeenAt || '').localeCompare(a.lastSeenAt || ''));

      /* Also count how many empty entries there are */
      const emptyCount = Object.values(all).filter(isEmptyDiag).length;

      if (!entries.length) {
        list.innerHTML =
          '<p style="color:#6B6558;text-align:center;padding:20px;font-size:13px;">No valid diagnostic data yet. Users must be running v2.8.31 or later.</p>' +
          (emptyCount > 0 ? '<p style="color:#A23B2E;text-align:center;font-size:12px;">' + emptyCount + ' empty/malformed entries can be purged with the button below.</p>' : '');
        return;
      }

      list.innerHTML = entries.map(u => {
        const staleMinutes = u.lastSeenAt ? (Date.now() - new Date(u.lastSeenAt).getTime()) / 60000 : 999999;
        const stale = staleMinutes > 5;
        const staleLbl = stale
          ? (staleMinutes > 60 ? Math.round(staleMinutes / 60) + 'h ago' : Math.round(staleMinutes) + 'm ago')
          : 'online just now';
        const statCls = (n) => n > 0 ? 'ok' : 'warn';
        return '<div class="ent-diag-user-card ' + (stale ? 'stale' : '') + '">' +
          '<div class="ent-du-head">' +
            '<div>' +
              '<div class="ent-du-name">' + esc(u.displayName || '(no name)') + '</div>' +
              '<div class="ent-du-email">' + esc(u.email || '(no email)') + ' · role: <b>' + esc(u.role || '?') + '</b>' + (u.disabled ? ' · DISABLED' : '') + '</div>' +
              '<div class="ent-du-email">tab: ' + esc(u.currentTab || '?') + ' · ' + (u.isSuperAdminFlag ? 'SUPER ADMIN' : 'regular user') + '</div>' +
            '</div>' +
            '<div style="text-align:right;">' +
              '<div class="ent-du-last">' + esc(staleLbl) + '</div>' +
              '<button data-purge="' + esc(u.uid) + '" style="margin-top:6px;padding:3px 8px;font-size:10px;background:#fff;color:#A23B2E;border:1px solid #A23B2E;border-radius:3px;cursor:pointer;">Purge</button>' +
            '</div>' +
          '</div>' +
          '<div class="ent-du-status-row">' +
            '<div class="ent-du-stat ' + statCls(u.caseCount || 0) + '">' +
              '<div class="ent-du-stat-num">' + (u.caseCount || 0) + '</div>' +
              '<div class="ent-du-stat-lbl">Cases loaded</div>' +
            '</div>' +
            '<div class="ent-du-stat ' + statCls(u.visaCount || 0) + '">' +
              '<div class="ent-du-stat-num">' + (u.visaCount || 0) + '</div>' +
              '<div class="ent-du-stat-lbl">Visas loaded</div>' +
            '</div>' +
            '<div class="ent-du-stat ' + (u.appAuthenticated ? 'ok' : 'err') + '">' +
              '<div class="ent-du-stat-num">' + (u.appAuthenticated ? '✓' : '✕') + '</div>' +
              '<div class="ent-du-stat-lbl">App revealed</div>' +
            '</div>' +
          '</div>' +
          (u.issues && u.issues.length
            ? '<div class="ent-du-issues">' + u.issues.map(i => '<div class="ent-du-issue">⚠ ' + esc(i) + '</div>').join('') + '</div>'
            : '') +
        '</div>';
      }).join('') +
      (emptyCount > 0 ? '<p style="color:#A23B2E;text-align:center;font-size:11px;font-family:\'IBM Plex Mono\',monospace;margin-top:10px;">' + emptyCount + ' empty entries hidden — use "Purge stale" below to clean them up.</p>' : '');

      /* Wire per-entry purge buttons */
      list.querySelectorAll('[data-purge]').forEach(btn => {
        btn.addEventListener('click', () => purgeEntry(btn.dataset.purge));
      });
    } catch (e) {
      list.innerHTML = '<p style="color:#A23B2E;padding:20px;">Cannot load: ' + esc(e.message) + '<br><br>Check that the RTDB rules from database.rules.v2.8.31.json are published.</p>';
    }
  }

  /* Override the existing loadDiagnostics function (from v2.8.31) */
  window._entLoadDiagnostics = loadDiagnosticsFixed;

  /* Add a "Purge stale" button to the panel footer once */
  function addPurgeStaleButton() {
    const footer = document.querySelector('#entDiagPanel .ent-diag-actions');
    if (!footer) return setTimeout(addPurgeStaleButton, 1000);
    if ($('entDiagPurgeStaleBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'entDiagPurgeStaleBtn';
    btn.type = 'button';
    btn.textContent = 'Purge stale & empty';
    btn.style.cssText = 'padding: 8px 14px; background: #fff; color: #A23B2E; border: 1px solid #A23B2E; border-radius: 5px; cursor: pointer; font-family: inherit; font-size: 12px; margin-right: auto;';
    btn.addEventListener('click', purgeStale);
    footer.insertBefore(btn, footer.firstChild);
    log('Purge stale button added');
  }
  setTimeout(addPurgeStaleButton, 3000);

  /* Rewire the existing "Refresh now" button to use our fixed loader */
  function rewireRefresh() {
    const btn = $('entDiagRefreshBtn');
    if (!btn) return setTimeout(rewireRefresh, 1000);
    if (btn.dataset.v2839Wired) return;
    btn.dataset.v2839Wired = '1';
    /* Clone to strip old listener, then rewire */
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    clone.addEventListener('click', loadDiagnosticsFixed);
    log('Refresh button rewired');
  }
  setTimeout(rewireRefresh, 3000);

  /* Also rewire the open handler on the Diagnostics top-strip button */
  function rewireOpenButton() {
    const btn = $('entDiagBtn');
    if (!btn) return setTimeout(rewireOpenButton, 1000);
    if (btn.dataset.v2839Wired) return;
    btn.dataset.v2839Wired = '1';
    btn.addEventListener('click', () => {
      setTimeout(loadDiagnosticsFixed, 300);
    });
    log('Open button rewired');
  }
  setTimeout(rewireOpenButton, 3000);

  console.log('%c🔧 Diagnostics panel repair v' + V + ' active', 'color:#8C6A22;font-weight:bold;');
})();

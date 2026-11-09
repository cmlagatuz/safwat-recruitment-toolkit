
(function HotfixV2833(){
  'use strict';
  const V = '2.8.33';
  const $ = (id) => document.getElementById(id);
  const nowIso = () => new Date().toISOString();
  const log = (...a) => console.log('%c[v2.8.33]', 'color:#A23B2E;font-weight:bold', ...a);
  const Toast = () => window.Toast || { ok:console.log, warn:console.warn, err:console.error, info:console.info };

  function isSuperAdmin() {
    try {
      if (localStorage.getItem('safwatEnt.isSuperAdmin') === 'true') return true;
    } catch {}
    try {
      const u = firebase.auth().currentUser;
      if (!u) return false;
      const email = (u.email || '').toLowerCase();
      const name = (u.displayName || '').toLowerCase();
      return ['carl', 'lagatuz'].some(n => (email + '|' + name).includes(n));
    } catch { return false; }
  }

  /* =========================================================
     FIX 1 — 1-click diagnostic button
     ========================================================= */
  async function buildDiagnostic() {
    const u = (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) || null;
    const issues = [];
    let rbacRec = null;
    let dbFetchOK = false;
    let dbFetchError = null;

    if (u) {
      try {
        const s = await firebase.database().ref('safwat/users/' + u.uid).once('value');
        rbacRec = s.val();
      } catch (e) { issues.push('cannot-read-own-rbac: ' + (e.code || e.message)); }

      try {
        const s = await firebase.database().ref('safwat/databases/main').once('value');
        const val = s.val();
        dbFetchOK = !!(val && val.data);
        if (!val) issues.push('db-path-empty');
        else if (!val.data) issues.push('db-has-no-data-field');
      } catch (e) {
        dbFetchError = (e.code || 'unknown') + ': ' + e.message;
        issues.push('db-fetch-failed: ' + dbFetchError);
      }
    } else {
      issues.push('not-signed-in');
    }

    if (!rbacRec) issues.push('no-rbac-record');
    if (rbacRec && rbacRec.disabled) issues.push('account-disabled');
    if (u && !u.emailVerified) issues.push('email-not-verified');
    if (!window.DB) issues.push('no-local-db');
    else if (!window.DB.recruitmentCases || window.DB.recruitmentCases.length === 0) issues.push('empty-cases-locally');
    if (!document.body.classList.contains('ent-authenticated')) issues.push('body-not-authenticated');
    if (typeof window.EntCloud?.openFromCloud !== 'function') issues.push('entcloud-missing');

    return {
      uid: u?.uid,
      email: u?.email,
      displayName: u?.displayName || rbacRec?.displayName || '(no name)',
      role: rbacRec?.role || '(unknown)',
      disabled: !!rbacRec?.disabled,
      emailVerified: !!u?.emailVerified,
      manualSubmit: true,
      submittedAt: nowIso(),
      caseCountLocal: window.DB?.recruitmentCases?.length || 0,
      visaCountLocal: window.DB?.visaRecords?.length || 0,
      dbFetchOK: dbFetchOK,
      dbFetchError: dbFetchError,
      dbSavedAt: window.DB?.meta?.savedAt || null,
      currentTab: (location.hash || '').replace('#', '') || '(none)',
      appAuthenticated: document.body.classList.contains('ent-authenticated'),
      isSuperAdminFlag: localStorage.getItem('safwatEnt.isSuperAdmin') === 'true',
      userAgent: navigator.userAgent.slice(0, 200),
      viewport: window.innerWidth + 'x' + window.innerHeight,
      url: location.href,
      issues: issues,
    };
  }

  async function sendDiagnostic(btn) {
    const u = firebase.auth().currentUser;
    if (!u) { Toast().err('Not signed in'); return; }
    if (btn) { btn.classList.add('ent-sending'); btn.textContent = '⏳ Sending…'; }
    try {
      const diag = await buildDiagnostic();
      /* Store under manual/ so admin can distinguish user-initiated reports */
      await firebase.database().ref('safwat/diagnostics/' + u.uid + '/manual').set(diag);
      /* Also update the live diagnostic root for admin dashboard */
      await firebase.database().ref('safwat/diagnostics/' + u.uid).update({
        lastManualSubmitAt: nowIso(),
      });
      if (btn) {
        btn.classList.remove('ent-sending');
        btn.classList.add('ent-sent');
        btn.textContent = '✓ Diagnostic sent';
        setTimeout(() => {
          btn.classList.remove('ent-sent');
          btn.textContent = '🚨 Send diagnostic';
        }, 4000);
      }
      Toast().ok('Diagnostic sent to admin', 'Issues: ' + (diag.issues.length || 'none'));
      log('Diagnostic submitted', diag);
    } catch (e) {
      if (btn) { btn.classList.remove('ent-sending'); btn.textContent = '🚨 Send diagnostic'; }
      Toast().err('Send failed', e.message);
      log('Diagnostic send failed', e);
    }
  }

  function insertDiagSendButton() {
    if ($('entSendDiagBtn')) return;
    const strip = $('entTopStrip');
    if (!strip) return setTimeout(insertDiagSendButton, 500);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'entSendDiagBtn';
    btn.className = 'ent-send-diag-btn';
    btn.textContent = '🚨 Send diagnostic';
    btn.title = 'Send your session diagnostic to the admin for support';
    const helpBtn = $('entOpenHelp');
    if (helpBtn) strip.insertBefore(btn, helpBtn);
    else strip.appendChild(btn);
    btn.addEventListener('click', () => sendDiagnostic(btn));
    log('1-click diagnostic button inserted');
  }
  setTimeout(insertDiagSendButton, 2000);
  setInterval(insertDiagSendButton, 5000);

  /* =========================================================
     FIX 2 — R-00 content flash fix (handled via inline preflight CSS)
     Add super-confirmed class if super admin, on load
     ========================================================= */
  function updateSuperConfirmed() {
    if (isSuperAdmin()) {
      document.documentElement.classList.add('ent-super-confirmed');
      document.body?.classList.add('ent-is-super-admin');
    } else {
      document.documentElement.classList.remove('ent-super-confirmed');
      document.body?.classList.remove('ent-is-super-admin');
    }
  }
  setInterval(updateSuperConfirmed, 800);
  updateSuperConfirmed();

  /* =========================================================
     FIX 3 — Lock Access Control role dropdown for non-super-admins
     ========================================================= */
  function lockRoleDropdown() {
    const sel = $('entRoleSelect');
    if (!sel) return;
    if (isSuperAdmin()) {
      /* Super admin can change roles (though this is really for testing) */
      sel.disabled = false;
      sel.title = '';
      const hint = document.getElementById('entRoleLockedHint');
      if (hint) hint.remove();
      return;
    }
    /* Non-super-admin: hard-lock */
    sel.disabled = true;
    sel.title = 'Role is enforced by the server. Contact your admin.';
    if (!document.getElementById('entRoleLockedHint')) {
      const hint = document.createElement('span');
      hint.id = 'entRoleLockedHint';
      hint.className = 'ent-role-locked-hint';
      hint.textContent = '🔒 Role locked — contact admin to change';
      sel.parentNode?.insertBefore(hint, sel.nextSibling);
    }
    /* Prevent any change event from taking effect */
    sel.addEventListener('change', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      /* Restore to actual role */
      const actualRole = window.EntRbac?.myRecord?.role || 'viewer';
      sel.value = actualRole;
      Toast().warn('Cannot change your own role', 'Ask your admin.');
    }, true);
  }
  setInterval(lockRoleDropdown, 1500);

  /* =========================================================
     FIX 4 — Fix Connect button in Security & Settings
     ========================================================= */
  function wireConnectButton() {
    const connectBtn = $('entFbConnect');
    if (!connectBtn) return;
    if (connectBtn.dataset.v2833Wired) return;
    connectBtn.dataset.v2833Wired = '1';
    /* Add a listener that runs AFTER the base Connect handler.
       Delay + force-fresh cloud load. */
    connectBtn.addEventListener('click', () => {
      setTimeout(async () => {
        log('Post-Connect: forcing fresh cloud load');
        if (typeof window._entForceFreshLoad === 'function') {
          await window._entForceFreshLoad('post-connect');
        } else if (window.EntCloud && typeof window.EntCloud.openFromCloud === 'function') {
          await window.EntCloud.openFromCloud();
        }
      }, 3000);   /* wait for base app to finish connecting */
    });
    log('Connect button wired');
  }
  setInterval(wireConnectButton, 2000);

  console.log('%c🛠 1-click diag + R-00 content + role lock + connect fix v' + V + ' active', 'color:#A23B2E;font-weight:bold;');
})();


(function HotfixV253(){
  'use strict';
  const V = '2.5.3';
  const $ = (id) => document.getElementById(id);
  const log = (...a) => console.log('%c[v2.5.3]', 'color:#3F6C4D;font-weight:bold', ...a);

  /* =========================================================
     FIX 1 — Suppress the "Push local to server?" confirm() in
     cloud mode. We monkey-patch window.confirm to intercept
     only that specific message; everything else is untouched.
     ========================================================= */
  const origConfirm = window.confirm;
  window.confirm = function(msg) {
    if (typeof msg === 'string' && window._entCloudMode) {
      // Silently accept cloud-authoritative directions
      if (/Remote database is newer than local/i.test(msg)) {
        log('Auto-accept: pulling remote (cloud mode)');
        return true;
      }
      if (/Local database is newer than remote/i.test(msg)) {
        // In cloud mode, cloud IS truth. Don't push local — it's stale.
        log('Auto-decline: local is stale in cloud mode (cloud wins)');
        return false;
      }
      if (/Remote is empty\. Push local database to server\?/i.test(msg)) {
        // Only push if local actually has data
        const hasData = window.DB && ((window.DB.recruitmentCases || []).length + (window.DB.visaRecords || []).length) > 0;
        log('Auto-decide empty-cloud push:', hasData);
        return hasData;
      }
    }
    return origConfirm.call(this, msg);
  };
  log('Confirm interceptor active');

  /* =========================================================
     Also disable the initial sync-conflict dialog from EntSync
     entirely once we're in cloud mode. If EntSync tries to
     compare and prompt, we short-circuit by making sure the
     savedAt values match.
     ========================================================= */
  function suppressEntSyncMergeDialog() {
    if (!window.EntSync || !window.EntSync.connect) return;
    if (window.EntSync._v253Patched) return;
    window.EntSync._v253Patched = true;
    // Wrap the once-per-connect initial comparison by intercepting the getter
    // that reads local savedAt. Simplest safe path: on any connect, we mark
    // local savedAt to be always <= remote so the dialog never triggers.
    const origConnect = window.EntSync.connect.bind(window.EntSync);
    window.EntSync.connect = async function(cfg) {
      if (window._entCloudMode) {
        // In cloud mode, ensure our local DB is treated as older-or-equal
        // to remote by zeroing out our savedAt just before compare.
        if (window.DB && window.DB.meta) {
          window.DB.meta._origSavedAt = window.DB.meta.savedAt;
          window.DB.meta.savedAt = '';   // remote's savedAt will always win the comparison
        }
      }
      return origConnect(cfg);
    };
    log('EntSync merge dialog suppressed in cloud mode');
  }

  /* =========================================================
     FIX 2 — Super Admin badge on the Role pill
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

  function updateRolePill() {
    const pill = $('entRolePill');
    if (!pill) return;
    // Get current role
    let role = 'viewer';
    if (window.EntRbac && window.EntRbac.myRecord && window.EntRbac.myRecord.role) role = window.EntRbac.myRecord.role;
    else if (window.Session && window.Session.role) role = window.Session.role;

    const displayRole = role.charAt(0).toUpperCase() + role.slice(1);
    const superBadge = isSuperAdmin() ? '<span class="ent-super-badge">Super</span>' : '';
    pill.innerHTML = 'Role: ' + displayRole + superBadge;
  }

  /* =========================================================
     FIX 3 — Detect when top strip wraps so we can adjust
     body padding accordingly (prevents content overlap).
     ========================================================= */
  function reflowTopStrip() {
    const strip = $('entTopStrip');
    if (!strip) return;
    const h = strip.offsetHeight;
    document.body.classList.toggle('ent-topstrip-tall', h > 40);
  }

  /* =========================================================
     Boot — apply everything once + on relevant events
     ========================================================= */
  function apply() {
    updateRolePill();
    reflowTopStrip();
    suppressEntSyncMergeDialog();
  }

  function boot() {
    // Wait for the top strip to exist
    const wait = setInterval(() => {
      if ($('entRolePill') || $('entTopStrip')) {
        clearInterval(wait);
        apply();
      }
    }, 300);
    setTimeout(() => clearInterval(wait), 30000);

    // Watch RBAC record changes so the badge updates when admin
    // promotes/demotes someone
    setInterval(apply, 3000);

    // Reflow on window resize
    window.addEventListener('resize', reflowTopStrip);

    // Reapply after auth state changes
    const authWait = setInterval(() => {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        clearInterval(authWait);
        firebase.auth().onAuthStateChanged(() => setTimeout(apply, 500));
      }
    }, 400);
    setTimeout(() => clearInterval(authWait), 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window._entApplyUxPolish = apply;   // manual trigger for debugging
  console.log('%c✨ UX polish v' + V + ' loaded', 'color:#3F6C4D;font-weight:bold;');
})();

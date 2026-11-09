
(function HotfixV2830(){
  'use strict';
  const V = '2.8.30';
  const $ = (id) => document.getElementById(id);
  const log = (...a) => console.log('%c[v2.8.30]', 'color:#8C6A22;font-weight:bold', ...a);

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

  /* Detect whether R-00 is the currently-displayed content section */
  function isOnR00() {
    /* Check the hash first */
    if ((location.hash || '').toUpperCase() === '#R-00') return true;
    /* Check content section visibility */
    const sections = document.querySelectorAll(
      '#tab-R-00, [data-tab-content="R-00"], section#R-00, [id="R-00-content"], [data-panel="R-00"]'
    );
    for (const s of sections) {
      if (getComputedStyle(s).display !== 'none' && s.offsetHeight > 0) return true;
    }
    /* Check if the "R-00 · Database" heading is visible (the "Cloud Database" card) */
    const cloudPanel = $('entCloudPanel');
    if (cloudPanel && getComputedStyle(cloudPanel).display !== 'none' && cloudPanel.offsetHeight > 0) {
      /* Cloud panel is visible → we're on R-00 */
      return true;
    }
    /* Check the R-00 file tools section */
    const dbTools = $('dbFileTools');
    if (dbTools && getComputedStyle(dbTools).display !== 'none' && dbTools.offsetHeight > 0) {
      return true;
    }
    return false;
  }

  /* Navigate to R-01 (the safest default) */
  function goToR01() {
    log('Redirecting from R-00 to R-01');
    /* Try hash navigation */
    location.hash = 'R-01';

    /* Also try clicking the R-01 nav element (in case hash isn't wired) */
    const candidates = [
      ...document.querySelectorAll('[data-tab="R-01"]'),
      ...document.querySelectorAll('a[href="#R-01"]'),
      ...document.querySelectorAll('#nav-R-01'),
      ...[...document.querySelectorAll('.sidebar a, .sidebar button, nav a, nav button')]
        .filter(el => {
          const t = (el.textContent || '').trim().toUpperCase();
          return t === 'R-01' || /^R-01[\s\u00A0]/.test(t);
        }),
    ];
    for (const c of candidates) {
      if (typeof c.click === 'function') {
        try { c.click(); log('Clicked nav element: ' + (c.getAttribute('data-tab') || c.getAttribute('href') || c.textContent?.trim().slice(0, 30))); return; }
        catch (e) {}
      }
    }
    log('No R-01 nav element found');
  }

  function checkAndRedirect() {
    if (isSuperAdmin()) return;
    if (isOnR00()) {
      goToR01();
    }
  }

  /* Run redirect check on load, on auth changes, on hashchange, and every 1s */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', checkAndRedirect);
  else checkAndRedirect();

  window.addEventListener('hashchange', checkAndRedirect);

  setInterval(checkAndRedirect, 1000);

  const authWait = setInterval(() => {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      clearInterval(authWait);
      firebase.auth().onAuthStateChanged(() => setTimeout(checkAndRedirect, 500));
    }
  }, 400);
  setTimeout(() => clearInterval(authWait), 30000);

  console.log('%c🚦 R-00 content redirect v' + V + ' active', 'color:#8C6A22;font-weight:bold;');
})();

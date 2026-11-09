
(function HotfixV2838(){
  'use strict';
  const V = '2.8.38';
  const $ = (id) => document.getElementById(id);
  const log = (...a) => console.log('%c[v2.8.38]', 'color:#8C6A22;font-weight:bold', ...a);

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

  /* Find the R-01 nav element and click it */
  function clickR01Nav() {
    const candidates = [
      ...document.querySelectorAll('[data-tab="R-01"]'),
      ...document.querySelectorAll('a[href="#R-01"]'),
      ...document.querySelectorAll('#nav-R-01'),
      ...[...document.querySelectorAll('.sidebar a, .sidebar button, .sidebar li, nav a, nav button, nav li')]
        .filter(el => {
          const t = (el.textContent || '').trim().toUpperCase();
          return t === 'R-01' || /^R-01[\s\u00A0]/.test(t);
        }),
    ];
    for (const c of candidates) {
      if (typeof c.click === 'function') {
        try {
          c.click();
          log('Clicked R-01 nav');
          return true;
        } catch (e) {}
      }
    }
    return false;
  }

  /* Main enforcer */
  function enforceLanding() {
    if (isSuperAdmin()) {
      document.documentElement.classList.remove('ent-force-r01');
      return;
    }
    document.documentElement.classList.add('ent-force-r01');

    /* If hash isn't already R-01+, redirect */
    const cur = (location.hash || '').toUpperCase().replace('#', '');
    if (cur === 'R-00' || cur === '') {
      history.replaceState(null, '', location.pathname + location.search + '#R-01');
    }

    /* Also try to click R-01 nav to trigger the tab-switch logic */
    clickR01Nav();
  }

  /* Run on load, after auth, and periodically */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enforceLanding);
  else enforceLanding();

  /* Multi-timing enforcement */
  setTimeout(enforceLanding, 500);
  setTimeout(enforceLanding, 1500);
  setTimeout(enforceLanding, 3000);
  setInterval(enforceLanding, 2000);

  /* Update super-admin flag when auth state resolves */
  const authWait = setInterval(() => {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      clearInterval(authWait);
      firebase.auth().onAuthStateChanged(() => {
        setTimeout(enforceLanding, 500);
        setTimeout(enforceLanding, 2000);
      });
    }
  }, 400);
  setTimeout(() => clearInterval(authWait), 30000);

  console.log('%c🎯 Force editor/viewer landing on R-01 v' + V + ' active', 'color:#8C6A22;font-weight:bold;');
})();

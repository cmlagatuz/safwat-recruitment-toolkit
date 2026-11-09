
(function HotfixV2832(){
  'use strict';
  const V = '2.8.32';
  const log = (...a) => console.log('%c[v2.8.32]', 'color:#3F6C4D;font-weight:bold', ...a);

  function isSuperAdmin() {
    /* Trust the localStorage flag if it's set (v2.8.31 persistence),
       otherwise fall back to a direct check. */
    try {
      if (localStorage.getItem('safwatEnt.isSuperAdmin') === 'true') return true;
    } catch {}
    try {
      const u = firebase.auth().currentUser;
      if (!u) return false;
      const email = (u.email || '').toLowerCase();
      const name = (u.displayName || '').toLowerCase();
      const hay = email + '|' + name;
      return ['carl', 'lagatuz'].some(n => hay.includes(n));
    } catch { return false; }
  }

  function restoreR00Visibility() {
    if (!isSuperAdmin()) return;

    /* Ensure the body class is set */
    document.body.classList.add('ent-is-super-admin');

    /* Walk the sidebar and find every nav item that references R-00 */
    const candidates = document.querySelectorAll(
      '.sidebar a, .sidebar li, .sidebar button, nav a, nav li, nav button, [data-tab], [href^="#R-"]'
    );
    let restored = 0;
    candidates.forEach(el => {
      const txt = (el.textContent || '').trim().toUpperCase();
      const dataTab = (el.getAttribute('data-tab') || '').toUpperCase();
      const href = (el.getAttribute('href') || '').toUpperCase();
      const isR00 = dataTab === 'R-00' ||
                    href === '#R-00' ||
                    txt === 'R-00' ||
                    /^R-00[\s\u00A0]/.test(txt);
      if (!isR00) return;

      /* Get the closest wrapper (li or similar) */
      const wrap = el.closest('li, .nav-item, .navgroup-item, .navitem') || el;

      /* Remove any inline display:none set by earlier patches */
      if (wrap.style.display === 'none') {
        wrap.style.removeProperty('display');
        restored++;
      }
      if (el.style.display === 'none') {
        el.style.removeProperty('display');
        restored++;
      }

      /* Also clear all the flags earlier patches set */
      wrap.removeAttribute('data-role-hidden');
      wrap.removeAttribute('data-r00');
      el.removeAttribute('data-role-hidden');
      el.removeAttribute('data-r00');

      /* Clear inline visibility too */
      if (wrap.style.visibility === 'hidden') {
        wrap.style.removeProperty('visibility');
      }
      if (wrap.style.height === '0px' || wrap.style.height === '0') {
        wrap.style.removeProperty('height');
        wrap.style.removeProperty('overflow');
      }
      if (wrap.style.pointerEvents === 'none') {
        wrap.style.removeProperty('pointer-events');
      }
    });
    if (restored > 0) log('Restored ' + restored + ' R-00 nav element(s) for super admin');
  }

  /* Run repeatedly to beat any patch that keeps re-hiding */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreR00Visibility);
  } else {
    restoreR00Visibility();
  }
  setInterval(restoreR00Visibility, 800);

  /* Also react to auth state changes */
  const authWait = setInterval(() => {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      clearInterval(authWait);
      firebase.auth().onAuthStateChanged(() => {
        setTimeout(restoreR00Visibility, 300);
        setTimeout(restoreR00Visibility, 1500);
      });
    }
  }, 400);
  setTimeout(() => clearInterval(authWait), 30000);

  console.log('%c🔓 R-00 restore for super admin v' + V + ' active', 'color:#3F6C4D;font-weight:bold;');
})();

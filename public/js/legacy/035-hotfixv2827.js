
(function HotfixV2827(){
  'use strict';
  const V = '2.8.27';
  const $ = (id) => document.getElementById(id);
  const log = (...a) => console.log('%c[v2.8.27]', 'color:#A23B2E;font-weight:bold', ...a);
  const Toast = () => window.Toast || { ok:console.log, warn:console.warn, err:console.error, info:console.info };

  /* =========================================================
     FIX 1 — Super-admin gate on R-00 visibility
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

  function applyR00Visibility() {
    const isSuper = isSuperAdmin();
    document.body.classList.toggle('ent-is-super-admin', isSuper);

    /* Additionally, walk sidebar and mark any nav items that reference R-00 */
    const items = document.querySelectorAll(
      '[data-tab="R-00"], a[href="#R-00"], #nav-R-00, .sidebar a, .sidebar li, nav a, nav li'
    );
    items.forEach(el => {
      const txt = (el.textContent || '').trim().toUpperCase();
      const dataTab = (el.getAttribute('data-tab') || '').toUpperCase();
      const href = (el.getAttribute('href') || '').toUpperCase();
      const referencesR00 = dataTab === 'R-00' ||
                            href === '#R-00' ||
                            txt.startsWith('R-00 ') ||
                            txt === 'R-00' ||
                            txt.startsWith('R-00\u00A0');
      if (!referencesR00) return;
      const wrap = el.closest('li, .nav-item, .navgroup-item, .navitem') || el;
      if (isSuper) {
        wrap.removeAttribute('data-role-hidden');
      } else {
        wrap.setAttribute('data-role-hidden', 'true');
      }
    });
  }

  /* Block clicks on R-00 for non-super-admins */
  document.addEventListener('click', (e) => {
    if (isSuperAdmin()) return;
    const link = e.target.closest('a, button, li');
    if (!link) return;
    const txt = (link.textContent || '').trim().toUpperCase();
    const dataTab = (link.getAttribute && link.getAttribute('data-tab') || '').toUpperCase();
    const href = (link.getAttribute && link.getAttribute('href') || '').toUpperCase();
    if (dataTab === 'R-00' || href === '#R-00' || txt.startsWith('R-00 ') || txt === 'R-00') {
      e.preventDefault();
      e.stopImmediatePropagation();
      Toast().warn('Access restricted', 'You do not have access to R-00.');
      log('Blocked R-00 nav for non-super-admin');
      return false;
    }
  }, true);

  /* Also block hash-based navigation */
  window.addEventListener('hashchange', () => {
    if (isSuperAdmin()) return;
    if ((location.hash || '').toUpperCase() === '#R-00') {
      log('Blocked hash navigation to R-00');
      location.hash = 'R-01';
    }
  });

  /* Redirect if currently on R-00 */
  function redirectFromR00IfNeeded() {
    if (isSuperAdmin()) return;
    if ((location.hash || '').toUpperCase() === '#R-00') {
      location.hash = 'R-01';
    }
    /* Also detect if R-00 content section is currently visible */
    const r00Sections = document.querySelectorAll('[data-tab-content="R-00"], #tab-R-00, section[id="R-00"]');
    r00Sections.forEach(sec => {
      if (getComputedStyle(sec).display !== 'none') {
        /* Try to click R-01 nav */
        const r01Links = document.querySelectorAll('[data-tab="R-01"], a[href="#R-01"], #nav-R-01');
        for (const r of r01Links) { if (r.click) { r.click(); return; } }
      }
    });
  }

  /* Sidebar MutationObserver — catches any dynamic re-renders */
  function setupSidebarObserver() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return setTimeout(setupSidebarObserver, 500);
    const obs = new MutationObserver(() => {
      applyR00Visibility();
      redirectFromR00IfNeeded();
    });
    obs.observe(sidebar, { childList: true, subtree: true });
    log('Sidebar mutation observer active');
  }
  setupSidebarObserver();

  /* Apply visibility on load + auth changes + periodic safety */
  function boot1() {
    applyR00Visibility();
    redirectFromR00IfNeeded();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot1);
  else boot1();
  setInterval(() => {
    applyR00Visibility();
    redirectFromR00IfNeeded();
  }, 2000);
  const authWait = setInterval(() => {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      clearInterval(authWait);
      firebase.auth().onAuthStateChanged(() => setTimeout(() => {
        applyR00Visibility();
        redirectFromR00IfNeeded();
      }, 300));
    }
  }, 400);
  setTimeout(() => clearInterval(authWait), 30000);

  /* =========================================================
     FIX 2 — Force cloud database load if it didn't happen
     ========================================================= */
  const banner = $('entDbLoadBanner');
  const msg = $('entDbLoadMsg');
  const retryBtn = $('entDbRetryBtn');
  let attemptCount = 0;
  const MAX_ATTEMPTS = 5;
  let checkTimer = null;

  function showBanner(text, isError) {
    if (!banner) return;
    banner.classList.add('ent-visible');
    banner.classList.toggle('ent-error', !!isError);
    if (msg) msg.textContent = text || 'Loading cloud database…';
    retryBtn.style.display = isError ? 'inline-block' : 'none';
  }
  function hideBanner() {
    if (banner) banner.classList.remove('ent-visible');
  }

  function isAuthenticated() {
    return document.body.classList.contains('ent-authenticated') &&
           typeof firebase !== 'undefined' &&
           firebase.auth &&
           firebase.auth().currentUser;
  }
  function hasDb() {
    return !!(window.DB && (
      (window.DB.recruitmentCases && window.DB.recruitmentCases.length >= 0) ||
      (window.DB.visaRecords && window.DB.visaRecords.length >= 0)
    ));
  }
  function isCloudModule() {
    return !!(window.EntCloud && typeof window.EntCloud.openFromCloud === 'function');
  }

  async function forceLoadFromCloud() {
    if (!isCloudModule()) {
      showBanner('Cloud module not loaded — refresh the page.', true);
      return false;
    }
    attemptCount++;
    showBanner('Loading cloud database… (attempt ' + attemptCount + '/' + MAX_ATTEMPTS + ')');
    try {
      const ok = await window.EntCloud.openFromCloud();
      if (ok || hasDb()) {
        log('Cloud DB loaded successfully on attempt ' + attemptCount);
        hideBanner();
        return true;
      }
    } catch (e) {
      log('openFromCloud threw:', e.message);
    }
    if (attemptCount >= MAX_ATTEMPTS) {
      showBanner('Could not load database. Please retry or contact your admin.', true);
      return false;
    }
    /* Try again in 3 seconds */
    setTimeout(forceLoadFromCloud, 3000);
    return false;
  }

  /* Retry button */
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      attemptCount = 0;
      forceLoadFromCloud();
    });
  }

  /* Watchdog: if authenticated but no DB after 6 seconds, force-load */
  function watchdog() {
    if (checkTimer) clearInterval(checkTimer);
    let waited = 0;
    checkTimer = setInterval(() => {
      waited += 1000;
      if (!isAuthenticated()) return;   // still signing in
      if (hasDb()) {
        clearInterval(checkTimer);
        hideBanner();
        return;
      }
      /* Authenticated, no DB — check how long it's been */
      if (waited >= 6000 && attemptCount === 0) {
        log('Watchdog: authenticated for 6s+ but no DB — forcing load');
        clearInterval(checkTimer);
        forceLoadFromCloud();
      }
    }, 1000);
    /* Stop after 2 minutes */
    setTimeout(() => { if (checkTimer) clearInterval(checkTimer); }, 120000);
  }
  watchdog();

  /* Also start watchdog whenever auth state changes */
  const authWait2 = setInterval(() => {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      clearInterval(authWait2);
      firebase.auth().onAuthStateChanged((u) => {
        if (u) {
          attemptCount = 0;
          watchdog();
        } else {
          hideBanner();
          if (checkTimer) clearInterval(checkTimer);
        }
      });
    }
  }, 400);
  setTimeout(() => clearInterval(authWait2), 30000);

  console.log('%c🛡 R-00 hide + DB force-load v' + V + ' active', 'color:#A23B2E;font-weight:bold;');
})();

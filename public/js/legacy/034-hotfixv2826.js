
(function HotfixV2826(){
  'use strict';
  const V = '2.8.26';
  const $ = (id) => document.getElementById(id);
  const log = (...a) => console.log('%c[v2.8.26]', 'color:#3F6C4D;font-weight:bold', ...a);

  /* Is the R-01 Visa Report currently the visible tab? */
  function isVisaTabVisible() {
    const dash = $('visaDashboard');
    if (!dash) return false;
    // offsetParent is null when the element or an ancestor has display:none
    if (dash.offsetParent === null) return false;
    // Also check the tab section wrapper if there is one
    const rect = dash.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return true;
  }

  /* Force-hide the sticky bar (until user scrolls again on R-01) */
  function hideSticky() {
    const bar = $('entStickyVisaBar');
    if (bar) bar.classList.remove('ent-sticky-active');
  }

  /* Run every 500ms — cheap, catches any tab change */
  setInterval(() => {
    if (!isVisaTabVisible()) hideSticky();
  }, 500);

  /* Also react to any sidebar click (tab switch) immediately */
  document.addEventListener('click', (e) => {
    const navItem = e.target.closest('.sidebar a, .sidebar button, nav a, nav button');
    if (!navItem) return;
    // Wait for tab-switch to complete, then check
    setTimeout(() => {
      if (!isVisaTabVisible()) hideSticky();
    }, 100);
    setTimeout(() => {
      if (!isVisaTabVisible()) hideSticky();
    }, 400);
  }, true);

  /* Also react to hashchange (some tab systems use #hash for routing) */
  window.addEventListener('hashchange', () => {
    setTimeout(() => {
      if (!isVisaTabVisible()) hideSticky();
    }, 100);
  });

  /* Patch the sticky bar's intersection observer callback so it
     ALSO gates on visa-tab visibility before showing. */
  function patchStickyLogic() {
    const bar = $('entStickyVisaBar');
    if (!bar) return setTimeout(patchStickyLogic, 500);
    if (bar.dataset.v2826Patched) return;
    bar.dataset.v2826Patched = '1';

    /* Use a MutationObserver only on the sticky bar's class attribute,
       and reject changes that would show it while R-01 isn't visible. */
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        if (m.attributeName === 'class') {
          if (bar.classList.contains('ent-sticky-active') && !isVisaTabVisible()) {
            bar.classList.remove('ent-sticky-active');
          }
        }
      });
    });
    observer.observe(bar, { attributes: true, attributeFilter: ['class'] });
    log('Sticky bar class-change guard active');
  }
  patchStickyLogic();

  console.log('%c🎯 Sticky tab-aware fix v' + V + ' active', 'color:#3F6C4D;font-weight:bold;');
})();

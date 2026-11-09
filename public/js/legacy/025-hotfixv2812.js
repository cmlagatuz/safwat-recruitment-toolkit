
(function HotfixV2812(){
  'use strict';
  const V = '2.8.12';

  function syncSidebarHeight() {
    const sb = document.querySelector('.sidebar');
    if (!sb) return false;
    const strip = document.getElementById('entTopStrip');
    const stripH = strip ? strip.getBoundingClientRect().height : 42;
    const targetH = Math.max(200, window.innerHeight - stripH);
    sb.style.setProperty('bottom', stripH + 'px', 'important');
    sb.style.setProperty('height', targetH + 'px', 'important');
    sb.style.setProperty('max-height', targetH + 'px', 'important');
    return true;
  }

  function neutralize253() {
    // Ensure the tall class doesn't add unwanted body padding
    document.body.classList.remove('ent-topstrip-tall');
    // v2.5.3 also set margin-top on .app which we don't need for fixed sidebar
    const app = document.querySelector('.app');
    if (app) {
      app.style.setProperty('margin-top', '0', 'important');
    }
  }

  function boot() {
    syncSidebarHeight();
    neutralize253();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('resize', () => setTimeout(syncSidebarHeight, 50));

  // Keep re-enforcing every 2s to beat v2.5.3's 3s cycle
  setInterval(() => {
    neutralize253();
    syncSidebarHeight();
  }, 2000);

  console.log('%c🔒 Sidebar fixed positioning v' + V + ' active', 'color:#3F6C4D;font-weight:bold;');
})();

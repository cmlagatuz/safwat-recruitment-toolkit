
(function HotfixV2811(){
  'use strict';
  const V = '2.8.11';

  /* Measure the actual bottom strip height and set the sidebar
     to fill exactly the space above it. Called on load and resize. */
  function syncSidebarHeight() {
    const sb = document.querySelector('.sidebar');
    if (!sb) return false;
    const strip = document.getElementById('entTopStrip');
    const stripH = strip ? strip.getBoundingClientRect().height : 0;
    const targetH = Math.max(200, window.innerHeight - stripH);
    sb.style.setProperty('height', targetH + 'px', 'important');
    sb.style.setProperty('max-height', targetH + 'px', 'important');
    return true;
  }

  /* Neutralize v2.5.3's periodic reflow so it doesn't fight our sizing. */
  function stopFluctuation() {
    // v2.5.3 uses setInterval(apply, 3000); we can't disconnect it directly,
    // but we can undo the .ent-topstrip-tall class it toggles, which was
    // controlling body padding based on a threshold rather than actual size.
    document.body.classList.remove('ent-topstrip-tall');
    // Also override the threshold — after v2.5.3 next fires, resync anyway
    syncSidebarHeight();
  }

  function boot() {
    syncSidebarHeight();
    stopFluctuation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* Re-sync on window resize (real event that should change sizing) */
  window.addEventListener('resize', () => setTimeout(syncSidebarHeight, 50));

  /* Guard against v2.5.3's setInterval(3000) re-adding the tall class.
     Every 2 seconds, remove the class and resync — this beats their
     3-second cycle and keeps the sidebar at the correct height. */
  setInterval(() => {
    if (document.body.classList.contains('ent-topstrip-tall')) {
      document.body.classList.remove('ent-topstrip-tall');
    }
    syncSidebarHeight();
  }, 2000);

  console.log('%c🔒 Sidebar dynamic height v' + V + ' active', 'color:#3F6C4D;font-weight:bold;');
})();

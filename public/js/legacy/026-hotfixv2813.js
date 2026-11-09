
(function HotfixV2813(){
  'use strict';
  console.log('%c🔧 Main-column fix v2.8.13 active', 'color:#3F6C4D;font-weight:bold;');

  /* JS backup: also set grid-column-start via inline style on the
     main element in case CSS specificity wars occur. */
  function forceMainColumn() {
    const app = document.querySelector('.app');
    if (!app) return;
    Array.from(app.children).forEach(child => {
      if (child.classList.contains('sidebar')) return;
      child.style.setProperty('grid-column-start', '2', 'important');
      child.style.setProperty('grid-column-end', '-1', 'important');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', forceMainColumn);
  } else {
    forceMainColumn();
  }

  // Reapply after any potential re-render
  setTimeout(forceMainColumn, 500);
  setTimeout(forceMainColumn, 2000);
})();

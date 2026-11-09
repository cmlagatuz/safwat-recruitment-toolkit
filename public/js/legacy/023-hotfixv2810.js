
(function HotfixV2810(){
  'use strict';
  const V = '2.8.10';

  /* Step 1: Nuke any inline styles left over from removed v2.8.10/v2.8.11
     patches. These persist in the DOM even after their CSS blocks are
     deleted from index.html. */
  function cleanInlineStyles() {
    const sb = document.querySelector('.sidebar');
    if (!sb) return false;
    // Remove ONLY the properties we care about — leaves anything else alone
    ['position','top','left','right','bottom','width','height','max-height',
     'overflow','overflow-y','overflow-x'].forEach(prop => {
      sb.style.removeProperty(prop);
    });
    // Also clean nested containers touched by earlier patches
    sb.querySelectorAll('nav, ul, ol').forEach(el => {
      el.style.removeProperty('overflow');
    });
    return true;
  }

  function apply() {
    if (!cleanInlineStyles()) return false;
    // Now the CSS in the <style> block above takes effect uncontested.
    console.log('%c🔒 Sidebar scroll lock v' + V + ' applied (sticky preserved)', 'color:#3F6C4D;font-weight:bold');
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
  // Safety re-apply in case something re-injects inline styles
  setTimeout(apply, 500);
  setTimeout(apply, 2000);
})();

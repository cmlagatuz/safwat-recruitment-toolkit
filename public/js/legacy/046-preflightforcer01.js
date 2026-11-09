
/* Inline preflight script — runs synchronously as HTML parses,
   before body renders. If we know the user isn't super admin, we
   force-navigate to R-01 IMMEDIATELY. */
(function preflightForceR01(){
  try {
    const isSuperAdmin = localStorage.getItem('safwatEnt.isSuperAdmin') === 'true';
    if (isSuperAdmin) return;   /* super admin sees everything normally */

    /* Not super admin (or first-time visitor whose flag isn't set yet).
       Force hash to R-01 and add CSS class to hide R-00 content. */
    document.documentElement.classList.add('ent-force-r01');

    /* Only override hash if it's currently R-00 or empty */
    const cur = (location.hash || '').toUpperCase().replace('#', '');
    if (!cur || cur === 'R-00') {
      /* Use replaceState to avoid a history entry for R-00 */
      history.replaceState(null, '', location.pathname + location.search + '#R-01');
    }
  } catch {}
})();

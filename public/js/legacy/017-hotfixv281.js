
(function HotfixV281(){
  'use strict';
  const V = '2.8.1';

  /* Seed a defensive RPT_COLORS object BEFORE any script that reads it.
     If the base toolkit's own definition hasn't run yet, we provide the
     v2.8.0-swapped defaults so charts still render. The base app's
     const RPT_COLORS = { ... } normally shadows this, but since the
     original file uses `const RPT_COLORS`, it can't overwrite our
     `window.RPT_COLORS`. So we install a mutable fallback with all keys
     defined. Our v2.8.0 patch's applyColorSwap() then mutates these
     values in place — no reassignment needed. */
  if (!window.RPT_COLORS) {
    window.RPT_COLORS = {
      // Post-swap defaults (matching v2.8.0's applyColorSwap)
      used:        '#2E6FA3',   // blue (formerly ALLOCATED)
      unused:      '#3F6C4D',   // green (formerly USED)
      allocated:   '#B98A2E',   // brass (formerly UNUSED)
      expired:     '#A23B2E',
      cancelled:   '#9B9082',
      deployed:    '#3F6C4D',
      inPipeline:  '#B98A2E',
      onHold:      '#8C6A22',
      transfer:    '#2E6FA3',
      exitedNotDeployed:    '#A23B2E',
      exitedPostDeployment: '#7E2E24',
      unclassified: '#9B9082',
      focus:       '#2E6FA3',
      success:     '#3F6C4D',
      danger:      '#A23B2E',
      brass:       '#B98A2E',
      brassDark:   '#8C6A22',
      slate:       '#6B6558',
    };
    console.log('%c[v2.8.1] Seeded fallback RPT_COLORS (base app definition will merge on load)', 'color:#3F6C4D;font-weight:bold');
  }

  /* Also patch _applyRemote so that if it fires before renderers are
     safe, the error is caught + logged instead of failing the whole
     Firebase connect. */
  function patchApplyRemote() {
    if (!window.EntSync || !window.EntSync._applyRemote) {
      return setTimeout(patchApplyRemote, 500);
    }
    if (window.EntSync._v281Patched) return;
    window.EntSync._v281Patched = true;
    const orig = window.EntSync._applyRemote.bind(window.EntSync);
    window.EntSync._applyRemote = function(remote) {
      try {
        return orig(remote);
      } catch (e) {
        console.warn('[v2.8.1] _applyRemote error (non-fatal):', e.message);
        // Still update DB even if render fails; next real render will succeed
        try {
          if (!SafwatPersistence.acceptRemote(window.DB, remote)) return;
      window.DB = remote.data;
      SafwatPersistence.remember(window.DB, remote.data, typeof remote.version === 'number' ? remote.version : 0, 'safwat/databases/' + window.EntSync.dbRef.key);
          if (typeof onDatabaseReady === 'function') setTimeout(onDatabaseReady, 200);
        } catch (e2) {
          console.warn('[v2.8.1] fallback apply also failed:', e2.message);
        }
      }
    };
    console.log('%c[v2.8.1] EntSync._applyRemote wrapped in try/catch', 'color:#3F6C4D;font-weight:bold');
  }
  patchApplyRemote();

  /* Also defensively wrap ALL v2.8.0 render overrides so any future
     undefined access on RPT_COLORS or missing DOM elements doesn't
     cascade into a "Firebase connect failed" toast. */
  function wrapRenderer(name) {
    const orig = window[name];
    if (typeof orig !== 'function' || orig._v281Wrapped) return;
    window[name] = function() {
      try { return orig.apply(this, arguments); }
      catch (e) {
        console.warn('[v2.8.1] ' + name + ' error (non-fatal):', e.message);
      }
    };
    window[name]._v281Wrapped = true;
  }
  setTimeout(() => {
    ['renderVisaStatusChart','renderVisaSponsorChart','renderVisaNatChart','renderVisaKpis',
     'renderVisaCrTable','renderVisaExpiryTable','renderVisaMainTable',
     'renderPipelineKpis','renderPipelineCategoryChart','renderPipelineTypeChart',
     'renderPipelineNatChart','renderPipelinePosChart','renderPipelineClientTable',
     'renderPipelineMainTable'].forEach(wrapRenderer);
    console.log('%c[v2.8.1] Render functions wrapped', 'color:#3F6C4D;font-weight:bold');
  }, 1500);

  console.log('%c🛡 RPT_COLORS guard v' + V + ' loaded', 'color:#3F6C4D;font-weight:bold;');
})();

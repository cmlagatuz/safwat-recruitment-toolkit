
(function HotfixV2840(){
  'use strict';
  const V = '2.8.40';
  const $ = (id) => document.getElementById(id);
  const log = (...a) => console.log('%c[v2.8.40]', 'color:#3F6C4D;font-weight:bold', ...a);

  /* Extended direct render that also calls the headline renderer */
  function fullVisaRender() {
    if (!window.DB || !window.getVisaFiltered) return false;
    let rows;
    try { rows = window.getVisaFiltered(); } catch { return false; }
    if (!rows) return false;

    /* Full render chain, including headline */
    const calls = [
      'renderVisaHeadline',        /* the missing one */
      'renderVisaKpis',
      'renderVisaStatusChart',
      'renderVisaSponsorChart',
      'renderVisaNatChart',
      'renderVisaCrTable',
      'renderVisaExpiryTable',
      'renderVisaMainTable',
    ];
    let ok = 0;
    calls.forEach(fnName => {
      const fn = window[fnName];
      if (typeof fn !== 'function') return;
      try {
        fn(rows);
        ok++;
      } catch (e) {
        console.warn('[v2.8.40] ' + fnName + ' error:', e.message);
      }
    });
    /* Also refresh filter options */
    try { window.refreshVisaFilterOptions?.(); } catch {}
    log('Full visa render: ' + ok + ' functions called');
    return ok > 0;
  }

  function fullPipelineRender() {
    if (!window.DB || !window.getPipelineFiltered) return false;
    let rows;
    try { rows = window.getPipelineFiltered(); } catch { return false; }
    if (!rows) return false;

    const calls = [
      'renderPipelineHeadline',    /* possible companion for R-02 */
      'renderPipelineKpis',
      'renderPipelineTypeChart',
      'renderPipelineCategoryChart',
      'renderPipelineNatChart',
      'renderPipelinePosChart',
      'renderPipelineClientTable',
      'renderPipelineMainTable',
    ];
    let ok = 0;
    calls.forEach(fnName => {
      const fn = window[fnName];
      if (typeof fn !== 'function') return;
      try {
        fn(rows);
        ok++;
      } catch (e) {
        console.warn('[v2.8.40] ' + fnName + ' error:', e.message);
      }
    });
    try { window.refreshPipelineFilterOptions?.(); } catch {}
    return ok > 0;
  }

  /* Trigger initial full renders once data is available */
  let initialDone = false;
  const initTimer = setInterval(() => {
    if (initialDone) { clearInterval(initTimer); return; }
    if (!window.DB || !window.DB.visaRecords || window.DB.visaRecords.length === 0) return;
    fullVisaRender();
    fullPipelineRender();
    initialDone = true;
    log('Initial headline + full render triggered');
    clearInterval(initTimer);
  }, 800);
  setTimeout(() => clearInterval(initTimer), 60000);

  /* Also run on window load + auth state changes */
  if (document.readyState !== 'loading') {
    setTimeout(fullVisaRender, 2000);
    setTimeout(fullPipelineRender, 2100);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(fullVisaRender, 2000);
      setTimeout(fullPipelineRender, 2100);
    });
  }

  /* Expose for debugging */
  window._entFullVisaRender = fullVisaRender;
  window._entFullPipelineRender = fullPipelineRender;

  console.log('%c🎨 Headline restore v' + V + ' active', 'color:#3F6C4D;font-weight:bold;');
})();

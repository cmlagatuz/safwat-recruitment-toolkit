
(function HotfixV2837(){
  'use strict';
  const V = '2.8.37';
  const $ = (id) => document.getElementById(id);
  const log = (...a) => console.log('%c[v2.8.37]', 'color:#3F6C4D;font-weight:bold', ...a);

  /* Direct-render function that calls every visa view render explicitly.
     Doesn't rely on refreshVisaView or renderVisaAll — bypasses any
     broken wrapper. */
  function directRenderVisa() {
    if (!window.DB || !window.getVisaFiltered) return false;
    let rows;
    try {
      rows = window.getVisaFiltered();
    } catch (e) {
      log('getVisaFiltered failed:', e.message);
      return false;
    }
    if (!rows) return false;

    log('Direct-rendering ' + rows.length + ' rows');
    const calls = [
      ['renderVisaKpis', rows],
      ['renderVisaStatusChart', rows],
      ['renderVisaSponsorChart', rows],
      ['renderVisaNatChart', rows],
      ['renderVisaCrTable', rows],
      ['renderVisaExpiryTable', rows],
      ['renderVisaMainTable', rows],
      ['refreshVisaFilterOptions', null],
    ];
    let ok = 0, failed = 0;
    calls.forEach(([fnName, arg]) => {
      const fn = window[fnName];
      if (typeof fn !== 'function') return;
      try {
        if (arg !== null) fn(arg);
        else fn();
        ok++;
      } catch (e) {
        failed++;
        console.warn('[v2.8.37] ' + fnName + ' error:', e.message);
      }
    });
    log('Direct render: ' + ok + ' ok, ' + failed + ' failed');
    return ok > 0;
  }

  /* Same for pipeline view */
  function directRenderPipeline() {
    if (!window.DB || !window.getPipelineFiltered) return false;
    let rows;
    try {
      rows = window.getPipelineFiltered();
    } catch (e) {
      log('getPipelineFiltered failed:', e.message);
      return false;
    }
    if (!rows) return false;

    const calls = [
      ['renderPipelineKpis', rows],
      ['renderPipelineTypeChart', rows],
      ['renderPipelineCategoryChart', rows],
      ['renderPipelineNatChart', rows],
      ['renderPipelinePosChart', rows],
      ['renderPipelineClientTable', rows],
      ['renderPipelineMainTable', rows],
      ['refreshPipelineFilterOptions', null],
    ];
    let ok = 0;
    calls.forEach(([fnName, arg]) => {
      const fn = window[fnName];
      if (typeof fn !== 'function') return;
      try {
        if (arg !== null) fn(arg);
        else fn();
        ok++;
      } catch (e) {
        console.warn('[v2.8.37] ' + fnName + ' error:', e.message);
      }
    });
    return ok > 0;
  }

  window._entDirectRenderVisa = directRenderVisa;
  window._entDirectRenderPipeline = directRenderPipeline;

  /* =========================================================
     Wire filter/search elements
     ========================================================= */
  function wireVisaFilters() {
    const ids = ['visaFilterNat', 'visaFilterCat', 'visaFilterClient', 'visaFilterStatus', 'visaFilterSponsor', 'visaSearch', 'visaExpiryWindow'];
    ids.forEach(id => {
      const el = $(id);
      if (!el) return;
      if (el.dataset.v2837Wired) return;
      el.dataset.v2837Wired = '1';
      const evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, () => {
        clearTimeout(el._v2837Debounce);
        el._v2837Debounce = setTimeout(directRenderVisa, 50);
      });
    });
    /* Also wire the CR / expiry sort headers if present */
  }
  function wirePipelineFilters() {
    const ids = ['pipelineFilterClient', 'pipelineFilterNat', 'pipelineFilterPos', 'pipelineFilterType', 'pipelineFilterStage', 'pipelineSearch'];
    ids.forEach(id => {
      const el = $(id);
      if (!el) return;
      if (el.dataset.v2837Wired) return;
      el.dataset.v2837Wired = '1';
      const evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, () => {
        clearTimeout(el._v2837Debounce);
        el._v2837Debounce = setTimeout(directRenderPipeline, 50);
      });
    });
  }

  /* Try wiring on a schedule until they exist */
  let wireAttempts = 0;
  const wireTimer = setInterval(() => {
    wireAttempts++;
    wireVisaFilters();
    wirePipelineFilters();
    if (wireAttempts > 60) clearInterval(wireTimer);
  }, 1000);

  /* =========================================================
     Initial render — trigger direct render as soon as data exists
     ========================================================= */
  let initialRenderDone = false;
  const renderTimer = setInterval(() => {
    if (initialRenderDone) return;
    if (!window.DB || !window.DB.visaRecords || window.DB.visaRecords.length === 0) return;

    log('Data available — triggering direct render');
    const visaOK = directRenderVisa();
    const pipeOK = directRenderPipeline();
    if (visaOK || pipeOK) {
      initialRenderDone = true;
      clearInterval(renderTimer);
      log('Initial direct render complete');
    }
  }, 1000);
  setTimeout(() => clearInterval(renderTimer), 90000);

  /* Also override refreshVisaView and refreshPipelineView so any code
     that calls them will actually render (they may be stubbed or broken) */
  const origRefreshVisa = window.refreshVisaView;
  window.refreshVisaView = function() {
    /* Call the original first (harmless if it's just a guard) */
    if (typeof origRefreshVisa === 'function') {
      try { origRefreshVisa.apply(this, arguments); } catch (e) {}
    }
    /* Then always do our direct render */
    directRenderVisa();
  };
  const origRefreshPipe = window.refreshPipelineView;
  window.refreshPipelineView = function() {
    if (typeof origRefreshPipe === 'function') {
      try { origRefreshPipe.apply(this, arguments); } catch (e) {}
    }
    directRenderPipeline();
  };

  log('refreshVisaView + refreshPipelineView wrapped with direct render fallback');

  console.log('%c🎯 Direct render pipeline v' + V + ' active', 'color:#3F6C4D;font-weight:bold;');
})();

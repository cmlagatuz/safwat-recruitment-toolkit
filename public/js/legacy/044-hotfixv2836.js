
(function HotfixV2836(){
  'use strict';
  const V = '2.8.36';
  const log = (...a) => console.log('%c[v2.8.36]', 'color:#3F6C4D;font-weight:bold', ...a);

  /* =========================================================
     STEP 1 — Ensure chart registry objects exist
     ========================================================= */
  window.visaCharts = window.visaCharts || {};
  window.pipelineCharts = window.pipelineCharts || {};
  log('Chart registries initialized');

  /* =========================================================
     STEP 2 — Safe destroy helper (handles undefined & orphans)
     ========================================================= */
  function safeDestroyChart(registry, key, canvasId) {
    /* Try destroying from the registry */
    try {
      if (registry && registry[key] && typeof registry[key].destroy === 'function') {
        registry[key].destroy();
        delete registry[key];
      }
    } catch (e) { /* silent */ }

    /* Also destroy any Chart.js instance attached to the canvas
       (catches orphaned charts that weren't in the registry) */
    if (typeof Chart !== 'undefined' && Chart.getChart && canvasId) {
      try {
        const canvas = document.getElementById(canvasId);
        if (canvas) {
          const existing = Chart.getChart(canvas);
          if (existing && typeof existing.destroy === 'function') {
            existing.destroy();
          }
        }
      } catch (e) { /* silent */ }
    }
  }
  window._entSafeDestroyChart = safeDestroyChart;

  /* =========================================================
     STEP 3 — Replace destroyPChart and destroyVChart
     ========================================================= */
  window.destroyPChart = function(key) {
    /* Map key → canvas ID */
    const canvasMap = {
      cat: 'pipelineCategoryChart',
      type: 'pipelineTypeChart',
      nat: 'pipelineNatChart',
      pos: 'pipelinePosChart',
    };
    safeDestroyChart(window.pipelineCharts, key, canvasMap[key]);
  };
  window.destroyVChart = function(key) {
    const canvasMap = {
      status: 'visaStatusChart',
      sponsor: 'visaSponsorChart',
      nat: 'visaNatChart',
    };
    safeDestroyChart(window.visaCharts, key, canvasMap[key]);
  };
  log('destroyPChart + destroyVChart replaced with safe versions');

  /* =========================================================
     STEP 4 — Wrap all chart render functions so they:
       1. Safe-destroy any existing chart on the canvas first
       2. Ensure registry exists
       3. Call original render inside try/catch
     ========================================================= */
  function wrapChartRender(fnName, registry, key, canvasId) {
    const orig = window[fnName];
    if (typeof orig !== 'function') return;
    if (orig._v2836Wrapped) return;

    const wrapped = function() {
      /* Ensure registry exists */
      if (!window[registry]) window[registry] = {};
      /* Force-destroy any existing chart on this canvas */
      safeDestroyChart(window[registry], key, canvasId);
      /* Now call the original */
      try {
        return orig.apply(this, arguments);
      } catch (e) {
        console.warn('[v2.8.36] ' + fnName + ' error:', e.message);
      }
    };
    wrapped._v2836Wrapped = true;
    window[fnName] = wrapped;
  }

  /* Wrap all known chart render functions */
  [
    /* Visa */
    ['renderVisaStatusChart', 'visaCharts', 'status', 'visaStatusChart'],
    ['renderVisaSponsorChart', 'visaCharts', 'sponsor', 'visaSponsorChart'],
    ['renderVisaNatChart', 'visaCharts', 'nat', 'visaNatChart'],
    /* Pipeline */
    ['renderPipelineCategoryChart', 'pipelineCharts', 'cat', 'pipelineCategoryChart'],
    ['renderPipelineTypeChart', 'pipelineCharts', 'type', 'pipelineTypeChart'],
    ['renderPipelineNatChart', 'pipelineCharts', 'nat', 'pipelineNatChart'],
    ['renderPipelinePosChart', 'pipelineCharts', 'pos', 'pipelinePosChart'],
  ].forEach(([fn, reg, key, canvas]) => wrapChartRender(fn, reg, key, canvas));
  log('Chart render functions wrapped with safe-destroy');

  /* =========================================================
     STEP 5 — Force immediate view refresh so charts appear NOW
     ========================================================= */
  setTimeout(() => {
    try {
      if (window.refreshVisaView) { window.refreshVisaView(); log('refreshVisaView triggered'); }
      if (window.refreshPipelineView) { window.refreshPipelineView(); log('refreshPipelineView triggered'); }
    } catch (e) { log('refresh error:', e.message); }
  }, 500);

  /* Also trigger a refresh after data loads (via v2.8.35's recovery) */
  const dataWatch = setInterval(() => {
    if (window.DB && window.DB.recruitmentCases && window.DB.recruitmentCases.length > 0) {
      clearInterval(dataWatch);
      setTimeout(() => {
        try {
          if (window.refreshVisaView) window.refreshVisaView();
          if (window.refreshPipelineView) window.refreshPipelineView();
          log('Charts refreshed after data load');
        } catch (e) {}
      }, 800);
    }
  }, 1000);
  setTimeout(() => clearInterval(dataWatch), 60000);

  console.log('%c📊 Chart registry + canvas reuse fix v' + V + ' active', 'color:#3F6C4D;font-weight:bold;');
})();

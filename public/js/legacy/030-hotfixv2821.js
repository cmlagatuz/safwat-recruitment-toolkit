
(function HotfixV2821(){
  'use strict';
  const V = '2.8.21';
  const $ = (id) => document.getElementById(id);
  const log = (...a) => console.log('%c[v2.8.21]', 'color:#B98A2E;font-weight:bold', ...a);

  /* =========================================================
     PART 1 — decode common Unicode escape sequences
     ========================================================= */
  const ESCAPE_MAP = {
    '\\u2014': '\u2014',   // — em dash
    '\\u2013': '\u2013',   // – en dash
    '\\u2026': '\u2026',   // … ellipsis
    '\\u2018': '\u2018',   // ' left single quote
    '\\u2019': '\u2019',   // ' right single quote
    '\\u201C': '\u201C',   // " left double quote
    '\\u201D': '\u201D',   // " right double quote
    '\\u00A0': '\u00A0',   //   non-breaking space
  };

  function decodeEscapesInString(s) {
    if (typeof s !== 'string') return s;
    if (!s.includes('\\u')) return s;
    let out = s;
    Object.entries(ESCAPE_MAP).forEach(([esc, ch]) => {
      // Case-insensitive replace of the escape sequence
      const re = new RegExp(esc.replace(/\\/g, '\\\\'), 'gi');
      out = out.replace(re, ch);
    });
    return out;
  }

  /* Walk the DOM and fix all text nodes */
  function decodeDom(root) {
    if (!root) return 0;
    let fixed = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.includes('\\u')) {
        const before = node.nodeValue;
        const after = decodeEscapesInString(before);
        if (before !== after) {
          node.nodeValue = after;
          fixed++;
        }
      }
    }
    // Also fix placeholder attributes on inputs
    root.querySelectorAll('input[placeholder]').forEach(el => {
      const p = el.getAttribute('placeholder');
      if (p && p.includes('\\u')) {
        const fixedP = decodeEscapesInString(p);
        if (fixedP !== p) { el.setAttribute('placeholder', fixedP); fixed++; }
      }
    });
    return fixed;
  }

  /* Walk the database object and fix all string values */
  function decodeDatabase() {
    if (!window.DB) return 0;
    let fixed = 0;
    const walk = (obj) => {
      if (obj === null || typeof obj !== 'object') return;
      Object.keys(obj).forEach(k => {
        const v = obj[k];
        if (typeof v === 'string' && v.includes('\\u')) {
          const decoded = decodeEscapesInString(v);
          if (decoded !== v) { obj[k] = decoded; fixed++; }
        } else if (typeof v === 'object' && v !== null) {
          walk(v);
        }
      });
    };
    walk(window.DB);
    return fixed;
  }

  function runDecode() {
    const domFixed = decodeDom(document.body);
    const dbFixed = decodeDatabase();
    if (domFixed || dbFixed) {
      log('Decoded ' + domFixed + ' DOM text nodes, ' + dbFixed + ' DB fields');
      if (dbFixed && window.dbSave) {
        window.dbSave().catch(() => {});
      }
    }
  }

  /* Run on load, after render refreshes, and periodically */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runDecode);
  else runDecode();
  setTimeout(runDecode, 2000);
  setTimeout(runDecode, 5000);
  setInterval(runDecode, 15000);   // catches newly rendered content

  /* Also run after each visa/pipeline view refresh */
  const origRefreshVisa = window.refreshVisaView;
  if (typeof origRefreshVisa === 'function') {
    window.refreshVisaView = function() {
      const r = origRefreshVisa.apply(this, arguments);
      setTimeout(runDecode, 300);
      return r;
    };
  }
  const origRefreshPipeline = window.refreshPipelineView;
  if (typeof origRefreshPipeline === 'function') {
    window.refreshPipelineView = function() {
      const r = origRefreshPipeline.apply(this, arguments);
      setTimeout(runDecode, 300);
      return r;
    };
  }

  /* =========================================================
     PART 2 — force Visa Status pie to re-render on every refresh
     ========================================================= */
  function forceChartDestroyAndRecreate() {
    if (!window.visaCharts) return;
    // Destroy the status chart instance if it exists
    if (window.visaCharts.status) {
      try { window.visaCharts.status.destroy(); } catch {}
      delete window.visaCharts.status;
    }
  }

  /* Wrap renderVisaStatusChart so it always cleans up first */
  const origRenderStatus = window.renderVisaStatusChart;
  if (typeof origRenderStatus === 'function') {
    window.renderVisaStatusChart = function(rows) {
      forceChartDestroyAndRecreate();
      // Small delay so canvas is ready
      setTimeout(() => {
        try { origRenderStatus.call(window, rows); }
        catch (e) { console.warn('[v2.8.21] status chart render:', e.message); }
      }, 10);
    };
    log('renderVisaStatusChart wrapped with force-destroy');
  }

  /* Also wrap the other visa charts for consistency */
  ['renderVisaSponsorChart', 'renderVisaNatChart'].forEach(name => {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function(rows) {
      // Destroy corresponding cached instance
      const key = name.replace('renderVisa', '').replace('Chart', '').toLowerCase();
      if (window.visaCharts && window.visaCharts[key]) {
        try { window.visaCharts[key].destroy(); } catch {}
        delete window.visaCharts[key];
      }
      setTimeout(() => {
        try { orig.call(window, rows); } catch (e) { console.warn('[v2.8.21] ' + name + ':', e.message); }
      }, 10);
    };
  });

  /* Also patch renderPipelineCategoryChart similarly */
  const origPipeCat = window.renderPipelineCategoryChart;
  if (typeof origPipeCat === 'function') {
    window.renderPipelineCategoryChart = function(rows) {
      if (window.pipelineCharts && window.pipelineCharts.cat) {
        try { window.pipelineCharts.cat.destroy(); } catch {}
        delete window.pipelineCharts.cat;
      }
      setTimeout(() => {
        try { origPipeCat.call(window, rows); } catch (e) { console.warn('[v2.8.21] pipeline cat:', e.message); }
      }, 10);
    };
  }

  console.log('%c🔧 Unicode decode + chart refresh v' + V + ' active', 'color:#B98A2E;font-weight:bold;');
})();

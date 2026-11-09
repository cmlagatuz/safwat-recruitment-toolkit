
/* v7.7.1 — charts follow the theme (legend/axis text + grid), re-drawn on switch */
(function DarkChartsV771(){
  'use strict';
  function apply(){
    var C = window.Chart; if (!C || !C.defaults) return;
    var dark = document.body.classList.contains('ent-dark');
    C.defaults.color = dark ? '#C9CED4' : '#6B6558';
    C.defaults.borderColor = dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.10)';
    try { Object.values(C.instances || {}).forEach(function(ch){
      ['x', 'y'].forEach(function(a){ var sc = ch.options.scales && ch.options.scales[a]; if (sc) { sc.ticks = sc.ticks || {}; sc.ticks.color = C.defaults.color; sc.grid = sc.grid || {}; sc.grid.color = C.defaults.borderColor; } });
      var lg = ch.options.plugins && ch.options.plugins.legend; if (lg) { lg.labels = lg.labels || {}; lg.labels.color = C.defaults.color; }
      ch.update('none');
    }); } catch (e) {}
  }
  new MutationObserver(apply).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  apply();
})();

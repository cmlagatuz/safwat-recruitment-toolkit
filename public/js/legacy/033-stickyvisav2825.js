
(function StickyVisaV2825(){
  'use strict';
  const V = '2.8.25';
  const $ = (id) => document.getElementById(id);
  const log = (...a) => console.log('%c[v2.8.25]', 'color:#2E6FA3;font-weight:bold', ...a);

  let bar = null;
  let sentinel = null;
  let observer = null;
  let initialized = false;

  /* Filter fields we mirror in the sticky bar */
  const FILTER_IDS = [
    'visaFilterNat',
    'visaFilterCat',
    'visaFilterClient',
    'visaFilterStatus',
    'visaFilterSponsor',
    'visaSearch',
  ];
  const FILTER_LABELS = {
    visaFilterNat: 'Nationality',
    visaFilterCat: 'Category',
    visaFilterClient: 'Client',
    visaFilterStatus: 'Status',
    visaFilterSponsor: 'Sponsor',
    visaSearch: 'Search',
  };

  function buildBar() {
    if ($('entStickyVisaBar')) return true;
    bar = document.createElement('div');
    bar.id = 'entStickyVisaBar';
    bar.innerHTML =
      '<div id="entStickyFilterRow"></div>' +
      '<div id="entStickyKpiRow"></div>';
    document.body.appendChild(bar);
    return true;
  }

  /* Populate filter row with lightweight clones of the original controls */
  function populateFilters() {
    const row = $('entStickyFilterRow');
    if (!row) return;
    row.innerHTML = '';
    FILTER_IDS.forEach(id => {
      const src = $(id);
      if (!src) return;
      const wrap = document.createElement('div');
      const lbl = document.createElement('label');
      lbl.textContent = FILTER_LABELS[id] || id;
      wrap.appendChild(lbl);

      let ctrl;
      if (src.tagName === 'SELECT') {
        ctrl = document.createElement('select');
        ctrl.innerHTML = src.innerHTML;   // clone options
        ctrl.value = src.value;
      } else {
        ctrl = document.createElement('input');
        ctrl.type = src.type || 'text';
        ctrl.placeholder = src.placeholder || '';
        ctrl.value = src.value;
      }
      ctrl.dataset.mirror = id;
      wrap.appendChild(ctrl);
      row.appendChild(wrap);

      /* Forward changes to the original element so filter logic runs */
      const forwardEvent = (evtType) => (e) => {
        src.value = e.target.value;
        src.dispatchEvent(new Event(evtType, { bubbles: true }));
      };
      if (src.tagName === 'SELECT') {
        ctrl.addEventListener('change', forwardEvent('change'));
      } else {
        ctrl.addEventListener('input', forwardEvent('input'));
        ctrl.addEventListener('change', forwardEvent('change'));
      }
    });
  }

  /* Keep sticky bar filters in sync when the user changes filters
     in the ORIGINAL bar (which they might do before scrolling). */
  function syncFiltersFromOriginals() {
    const row = $('entStickyFilterRow');
    if (!row) return;
    row.querySelectorAll('[data-mirror]').forEach(el => {
      const src = $(el.dataset.mirror);
      if (!src) return;
      if (el.tagName === 'SELECT') {
        // Refresh options in case they changed
        if (el.innerHTML !== src.innerHTML) el.innerHTML = src.innerHTML;
      }
      if (el.value !== src.value) el.value = src.value;
    });
  }

  /* Populate KPI strip from the main KPI grid */
  function populateKpis() {
    const row = $('entStickyKpiRow');
    const grid = $('visaKpiGrid');
    if (!row || !grid) return;
    const kpiClasses = ['used', 'unused', 'allocated', 'expired', 'cancelled', 'expiring'];
    const cards = [...grid.querySelectorAll('.kpi-card')];
    row.innerHTML = cards.map((card, i) => {
      const numEl = card.querySelector('.kpi-num');
      const lblEl = card.querySelector('.kpi-label');
      const num = numEl ? numEl.textContent.trim() : '?';
      const lbl = lblEl ? lblEl.textContent.trim() : '?';
      const cls = kpiClasses[i] || '';
      return '<div class="ent-sk-card ' + cls + '">' +
        '<span class="ent-sk-num">' + num + '</span>' +
        '<span class="ent-sk-label">' + lbl + '</span>' +
      '</div>';
    }).join('');
  }

  /* Detect scroll past filters: use a sentinel div right after the
     visa KPI grid; when it leaves the viewport (upward), sticky ON. */
  function setupObserver() {
    if (observer || !$('visaKpiGrid')) return;
    /* Insert a 1px sentinel right after the KPI grid */
    sentinel = document.createElement('div');
    sentinel.id = 'entStickySentinel';
    sentinel.style.cssText = 'height:1px;width:1px;pointer-events:none;';
    const kpiGrid = $('visaKpiGrid');
    kpiGrid.parentNode.insertBefore(sentinel, kpiGrid.nextSibling);

    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        /* When sentinel is above the viewport top → we've scrolled past → sticky ON.
           When it's back in view or below → sticky OFF. */
        const scrolledPast = entry.boundingClientRect.top < 0;
        if (bar) {
          if (!entry.isIntersecting && scrolledPast) {
            bar.classList.add('ent-sticky-active');
          } else {
            bar.classList.remove('ent-sticky-active');
          }
        }
      });
    }, { root: null, threshold: 0 });
    observer.observe(sentinel);
  }

  /* Refresh sticky bar KPIs + filter values whenever the main view refreshes */
  function refresh() {
    if (!bar) return;
    populateKpis();
    syncFiltersFromOriginals();
  }

  /* Initialize when the visa dashboard exists */
  function tryInit() {
    if (initialized) return;
    if (!$('visaKpiGrid')) return;
    buildBar();
    populateFilters();
    populateKpis();
    setupObserver();
    initialized = true;
    log('Sticky bar initialized');
  }

  let attempts = 0;
  const int = setInterval(() => {
    attempts++;
    tryInit();
    if (initialized || attempts > 40) clearInterval(int);
  }, 400);

  /* Hook refreshVisaView to keep the sticky bar in sync */
  const origRefresh = window.refreshVisaView;
  if (typeof origRefresh === 'function') {
    window.refreshVisaView = function() {
      const r = origRefresh.apply(this, arguments);
      setTimeout(refresh, 200);
      return r;
    };
  }
  /* Also refresh periodically to catch any changes we missed */
  setInterval(refresh, 4000);

  console.log('%c📌 Sticky filter+KPI bar v' + V + ' active', 'color:#2E6FA3;font-weight:bold;');
})();

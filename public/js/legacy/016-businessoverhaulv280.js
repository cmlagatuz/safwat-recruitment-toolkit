
(function BusinessOverhaulV280(){
  'use strict';
  const V = '2.8.0';
  const $ = (id) => document.getElementById(id);
  const nowIso = () => new Date().toISOString();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const log = (...a) => console.log('%c[v2.8.0]', 'color:#8C6A22;font-weight:bold', ...a);
  const Toast = () => window.Toast || { ok:console.log, warn:console.warn, err:console.error, info:console.info };

  /* =========================================================
     1) HIJRI ↔ GREGORIAN CONVERSION
     Kuwaiti algorithm (Umm al-Qura variant) — ±1 day accuracy
     ========================================================= */
  const Hijri = {
    toGregorian(hy, hm, hd) {
      const jd = Math.floor((11 * hy + 3) / 30) + 354 * hy + 30 * hm - Math.floor((hm - 1) / 2) + hd + 1948440 - 385;
      return this._jdToGregorianDate(jd);
    },
    _jdToGregorianDate(jd) {
      const a = jd + 32044;
      const b = Math.floor((4 * a + 3) / 146097);
      const c = a - Math.floor((146097 * b) / 4);
      const d = Math.floor((4 * c + 3) / 1461);
      const e = c - Math.floor((1461 * d) / 4);
      const m = Math.floor((5 * e + 2) / 153);
      const day = e - Math.floor((153 * m + 2) / 5) + 1;
      const month = m + 3 - 12 * Math.floor(m / 10);
      const year = 100 * b + d - 4800 + Math.floor(m / 10);
      return new Date(year, month - 1, day);
    },
    _dateToIso(d) {
      if (!d || isNaN(d.getTime())) return '';
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },
    addHijriYearsAsGregorianIso(hijriIsoStr, yearsToAdd) {
      if (!hijriIsoStr) return '';
      const parts = hijriIsoStr.split('-').map(x => parseInt(x, 10));
      if (parts.length !== 3 || parts.some(isNaN)) return '';
      const [hy, hm, hd] = parts;
      return this._dateToIso(this.toGregorian(hy + yearsToAdd, hm, hd));
    },
    hijriIsoToGregorianIso(hijriIsoStr) {
      if (!hijriIsoStr) return '';
      const parts = hijriIsoStr.split('-').map(x => parseInt(x, 10));
      if (parts.length !== 3 || parts.some(isNaN)) return '';
      return this._dateToIso(this.toGregorian(parts[0], parts[1], parts[2]));
    },
  };
  window.Hijri = Hijri;

  /* =========================================================
     2) COLOR SWAP — mutate RPT_COLORS in place
     USED: green → blue    (was ALLOCATED's color)
     UNUSED: brass → green (was USED's color)
     ALLOCATED: blue → brass (was UNUSED's color)
     ========================================================= */
  function applyColorSwap() {
    if (!window.RPT_COLORS) return;
    window.RPT_COLORS.used = '#2E6FA3';
    window.RPT_COLORS.unused = '#3F6C4D';
    window.RPT_COLORS.allocated = '#B98A2E';
    log('Color palette swapped');
  }
  applyColorSwap();
  // Also apply after any late-loaded scripts
  setTimeout(applyColorSwap, 500);
  setTimeout(applyColorSwap, 2000);

  /* =========================================================
     3) SPONSOR-AWARE CATEGORY LOGIC
     ========================================================= */
  const CATS = {
    ACTIVE:    'Active / In Progress',
    DEPLOYED:  'Deployed / Visa Issued',
    ON_HOLD:   'On Hold',
    CANCELLED: 'Cancelled / Withdrawn / Rejected',
    EXITED:    'Exited (Post-Deployment)',
    REVIEW:    'Needs Review',
  };
  window.PIPELINE_CATS = CATS;

  function findLinkedVisa(c) {
    if (!c || !c.linkedVisaId || !window.DB) return null;
    return window.DB.visaRecords.find(v => v.id === c.linkedVisaId) || null;
  }
  function isSafwatSponsored(c) {
    const v = findLinkedVisa(c);
    if (v && v.sponsor) return v.sponsor === 'SAFWAT';
    return false;
  }
  function caseCategory(c) {
    const s = (c && c.stage || '').trim().toUpperCase();
    if (!s) return CATS.ACTIVE;
    if (s === 'NEEDS REVIEW' || (c && c.needsReview)) return CATS.REVIEW;
    if (['END OF SERVICE', 'TERMINATED', 'AWOL', 'EXITED AFTER DEPLOYMENT'].includes(s)) return CATS.EXITED;
    if (['CANCELLED', 'REJECTED', 'WITHDRAWN/BACKOUT', 'UNFIT', 'CANCELLED / WITHDRAWN', 'WITHDRAWN'].includes(s)) return CATS.CANCELLED;
    if (s === 'ON HOLD' || s === 'UNDER GRAND HYATT REVIEW') return CATS.ON_HOLD;
    if (s === 'DEPLOYED') return CATS.DEPLOYED;
    if (s === 'VISA ISSUED') return isSafwatSponsored(c) ? CATS.ACTIVE : CATS.DEPLOYED;
    return CATS.ACTIVE;
  }
  window.caseCategory = caseCategory;

  /* =========================================================
     4) CURRENT-STEP DETERMINATION for the 8-step leaderboard
     Uses the last-filled date column; falls back to stage string.
     Matches the pattern of the user's Excel formula.
     ========================================================= */
  function currentStep(c) {
    if (!c) return null;
    if (c.dateVisaStamped)    return 'stamped';
    if (c.dateBioResult)      return 'stamped';
    if (c.dateBioOutset)      return 'bio_in_progress';
    if (c.dateSvpResult)      return 'svp_completed';
    if (c.dateSvpOutset)      return 'svp_in_progress';
    if (c.dateMedicalResult)  return 'medical_completed';
    if (c.dateMedicalOutset)  return 'medical_in_progress';
    if (c.dateOfferSigned)    return 'signed';
    if (c.dateOfferSent)      return 'sent';
    const s = (c.stage || '').trim();
    if (s === 'Visa Issued')                                    return 'stamped';
    if (s === 'Biometrics in Progress and Consular Submission') return 'bio_in_progress';
    if (s === 'FOR BIOMETRICS APPOINTMENT')                     return 'bio_in_progress';
    if (s === 'SVP/QVP ON PROGRESS')                            return 'svp_in_progress';
    if (s === 'For Skills Verification Appointment')            return 'svp_in_progress';
    if (s === 'MEDICAL ON PROGRESS')                            return 'medical_in_progress';
    if (s === 'FOR MEDICAL APPOINTMENT')                        return 'medical_in_progress';
    if (s === 'OFFER SIGNING')                                  return 'signed';
    if (s === 'PENDING OFFER LETTER')                           return 'sent';
    return null;
  }
  window.currentStep = currentStep;

  /* =========================================================
     5) OVERRIDE computeClientMilestones
     ========================================================= */
  window.computeClientMilestones = function(cases) {
    const r = {
      sent: 0, signed: 0,
      medical_in_progress: 0, medical_completed: 0,
      svp_in_progress: 0, svp_completed: 0,
      bio_in_progress: 0, stamped: 0,
      mobilized: 0, active: 0,
      withdrawn: 0, unfit: 0, unresponsive: 0,
      exited: 0,
      total: cases.length,
    };
    cases.forEach(c => {
      const step = currentStep(c);
      if (step && r[step] !== undefined) r[step]++;
      const s = (c.stage || '').trim().toUpperCase();
      if (s === 'DEPLOYED') r.mobilized++;
      if (['WITHDRAWN/BACKOUT', 'WITHDRAWN', 'REJECTED', 'CANCELLED', 'CANCELLED / WITHDRAWN'].includes(s)) r.withdrawn++;
      if (s === 'UNFIT') r.unfit++;
      if (s === 'AWOL') r.unresponsive++;
      if (['END OF SERVICE', 'TERMINATED', 'AWOL', 'EXITED AFTER DEPLOYMENT'].includes(s)) r.exited++;
      if (caseCategory(c) === CATS.ACTIVE) r.active++;
    });
    const accomplished = r.stamped + r.mobilized;
    r.accomplishedPct = r.total > 0 ? Math.round((accomplished / r.total) * 1000) / 10 : 0;
    return r;
  };

  /* =========================================================
     6) OVERRIDE Client Leaderboard header + rows
     ========================================================= */
  function replaceLeaderboardHeader() {
    const table = $('pipelineClientTable');
    if (!table) return false;
    const thead = table.querySelector('thead');
    if (!thead || thead.dataset.v280) return true;
    thead.innerHTML =
      '<tr class="head-row-1">' +
        '<th rowspan="2" data-key="client">Client</th>' +
        '<th colspan="2">Offers</th>' +
        '<th colspan="2">Medical</th>' +
        '<th colspan="2">SVP/QVP</th>' +
        '<th colspan="2">Biometrics &amp; Visa Stamping</th>' +
        '<th colspan="3">Attrition</th>' +
        '<th rowspan="2" data-key="mobilized">Mobilization<br>Mobilized</th>' +
        '<th colspan="3">Pipeline Totals</th>' +
      '</tr>' +
      '<tr class="head-row-2">' +
        '<th data-key="sent">Sent</th><th data-key="signed">Signed</th>' +
        '<th data-key="medical_in_progress">In Progress</th><th data-key="medical_completed">Completed</th>' +
        '<th data-key="svp_in_progress">In Progress</th><th data-key="svp_completed">Completed</th>' +
        '<th data-key="bio_in_progress">In Progress</th><th data-key="stamped">Stamped</th>' +
        '<th data-key="withdrawn">Withdrawn</th><th data-key="unfit">Unfit</th><th data-key="unresponsive">Unresponsive</th>' +
        '<th data-key="active">Active</th><th data-key="total">Total</th><th data-key="accomplishedPct">Accomplished %</th>' +
      '</tr>';
    thead.dataset.v280 = '1';
    return true;
  }

  window.renderPipelineClientTable = function(rows) {
    if (!replaceLeaderboardHeader()) return;
    const byClient = {};
    rows.forEach(r => { (byClient[r.client || '(unspecified)'] = byClient[r.client || '(unspecified)'] || []).push(r); });
    const state = window.pipelineClientSort || { key: 'total', dir: -1 };
    let data = Object.entries(byClient).map(([client, cases]) => ({ client, ...computeClientMilestones(cases) }));
    data = window.sortRows ? window.sortRows(data, state) : data;
    const fmt = window.fmtNum || (x => x);
    const rowsHtml = data.map(g =>
      '<tr>' +
        '<td>' + esc(g.client) + '</td>' +
        '<td>' + fmt(g.sent) + '</td><td>' + fmt(g.signed) + '</td>' +
        '<td>' + fmt(g.medical_in_progress) + '</td><td>' + fmt(g.medical_completed) + '</td>' +
        '<td>' + fmt(g.svp_in_progress) + '</td><td>' + fmt(g.svp_completed) + '</td>' +
        '<td>' + fmt(g.bio_in_progress) + '</td><td>' + fmt(g.stamped) + '</td>' +
        '<td>' + fmt(g.withdrawn) + '</td><td>' + fmt(g.unfit) + '</td><td>' + fmt(g.unresponsive) + '</td>' +
        '<td>' + fmt(g.mobilized) + '</td>' +
        '<td>' + fmt(g.active) + '</td><td>' + fmt(g.total) + '</td><td>' + g.accomplishedPct + '%</td>' +
      '</tr>').join('');
    document.querySelector('#pipelineClientTable tbody').innerHTML = rowsHtml ||
      '<tr><td colspan="16" style="color:var(--text-soft,#6B6558);">No rows match the current filters.</td></tr>';
  };

  /* =========================================================
     7) OVERRIDE Pipeline KPI cards — new labels + sponsor-aware
     ========================================================= */
  window.renderPipelineKpis = function(rows) {
    const cats = { [CATS.ACTIVE]: 0, [CATS.DEPLOYED]: 0, [CATS.ON_HOLD]: 0, [CATS.CANCELLED]: 0, [CATS.EXITED]: 0, [CATS.REVIEW]: 0 };
    rows.forEach(r => { const cat = caseCategory(r); if (cats[cat] !== undefined) cats[cat]++; });
    const fmt = window.fmtNum || (x => x);
    const cards = [
      { label: 'Total candidates', num: rows.length, cls: '' },
      { label: 'Active / In Progress', num: cats[CATS.ACTIVE], cls: 'c-focus' },
      { label: 'Deployed / Visa Issued', num: cats[CATS.DEPLOYED], cls: 'c-success' },
      { label: 'On Hold', num: cats[CATS.ON_HOLD], cls: '' },
      { label: 'Cancelled / Withdrawn / Rejected', num: cats[CATS.CANCELLED], cls: 'c-danger' },
      { label: 'Exited (Post-Deployment)', num: cats[CATS.EXITED], cls: 'c-danger' },
      { label: 'Needs Review', num: cats[CATS.REVIEW], cls: 'c-danger' },
    ];
    const grid = $('pipelineKpiGrid');
    if (grid) grid.innerHTML = cards.map(c =>
      '<div class="kpi-card ' + c.cls + '"><div class="kpi-num">' + fmt(c.num) + '</div><div class="kpi-label">' + esc(c.label) + '</div></div>'
    ).join('');
  };

  /* Category doughnut with new labels + colors */
  window.renderPipelineCategoryChart = function(rows) {
    if (typeof Chart === 'undefined') return;
    const counts = {};
    rows.forEach(r => { const c = caseCategory(r); counts[c] = (counts[c] || 0) + 1; });
    const colorMap = {
      [CATS.ACTIVE]:    window.RPT_COLORS.focus,
      [CATS.DEPLOYED]:  window.RPT_COLORS.success,
      [CATS.ON_HOLD]:   window.RPT_COLORS.brass,
      [CATS.CANCELLED]: window.RPT_COLORS.danger,
      [CATS.EXITED]:    window.RPT_COLORS.exitedPostDeployment,
      [CATS.REVIEW]:    window.RPT_COLORS.slate,
    };
    if (window.destroyPChart) window.destroyPChart('cat');
    const el = $('pipelineCategoryChart');
    if (!el) return;
    window.pipelineCharts.cat = new Chart(el, {
      type: 'doughnut',
      data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: Object.keys(counts).map(k => colorMap[k] || window.RPT_COLORS.slate) }] },
      options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10.5 } } } } }
    });
  };

  /* =========================================================
     8) OVERRIDE Pipeline main table — hide Start Visa for LOCAL_TRANSFER,
     add row count
     ========================================================= */
  const origRenderPipelineMain = window.renderPipelineMainTable;
  window.renderPipelineMainTable = function(rows) {
    if (typeof origRenderPipelineMain === 'function') origRenderPipelineMain.apply(this, arguments);
    // Post-process: hide Start Visa buttons for LOCAL_TRANSFER
    document.querySelectorAll('#pipelineMainTable button[data-action="start-visa"]').forEach(btn => {
      const id = btn.dataset.id;
      if (!id || !window.DB) return;
      const c = window.DB.recruitmentCases.find(x => x.id === id);
      if (c && c.recruitmentType === 'LOCAL_TRANSFER') btn.style.display = 'none';
    });
    // Live row count
    const note = $('pipelineRowCapNote');
    if (note && rows && rows.length <= 400) note.textContent = rows.length + ' candidate(s) in filter';
  };

  /* =========================================================
     9) OVERRIDE Visa KPI cards — color-matched + 90 days
     ========================================================= */
  window.renderVisaKpis = function(rows) {
    const counts = { USED: 0, UNUSED: 0, ALLOCATED: 0, EXPIRED: 0, CANCELLED: 0 };
    rows.forEach(r => { if (counts[r.statusVisa] !== undefined) counts[r.statusVisa]++; });
    const daysBetween = window.daysBetween;
    const expiring90 = rows.filter(r =>
      r.expirationDate && ['UNUSED', 'ALLOCATED'].includes(r.statusVisa) &&
      daysBetween(new Date(), new Date(r.expirationDate)) <= 90 &&
      daysBetween(new Date(), new Date(r.expirationDate)) >= 0
    ).length;
    const fmt = window.fmtNum || (x => x);
    const cards = [
      { label: 'Used', num: counts.USED, cls: 'c-focus' },
      { label: 'Unused (available)', num: counts.UNUSED, cls: 'c-success' },
      { label: 'Allocated', num: counts.ALLOCATED, cls: 'c-brass' },
      { label: 'Expired', num: counts.EXPIRED, cls: 'c-danger' },
      { label: 'Cancelled', num: counts.CANCELLED, cls: '' },
      { label: 'Expiring \u2264 90 days', num: expiring90, cls: 'c-danger', sub: 'unused / allocated only' },
    ];
    const grid = $('visaKpiGrid');
    if (grid) grid.innerHTML = cards.map(c =>
      '<div class="kpi-card ' + c.cls + '"><div class="kpi-num">' + fmt(c.num) + '</div><div class="kpi-label">' + esc(c.label) + '</div>' +
      (c.sub ? '<div class="kpi-sub">' + esc(c.sub) + '</div>' : '') + '</div>'
    ).join('');
  };

  /* =========================================================
     10) OVERRIDE Visa status pie chart — swapped colors
     ========================================================= */
  window.renderVisaStatusChart = function(rows) {
    if (typeof Chart === 'undefined') return;
    const counts = { USED: 0, UNUSED: 0, ALLOCATED: 0, EXPIRED: 0, CANCELLED: 0 };
    rows.forEach(r => { if (counts[r.statusVisa] !== undefined) counts[r.statusVisa]++; });
    if (window.destroyVChart) window.destroyVChart('status');
    const el = $('visaStatusChart');
    if (!el) return;
    window.visaCharts = window.visaCharts || {};
    window.visaCharts.status = new Chart(el, {
      type: 'doughnut',
      data: {
        labels: Object.keys(counts),
        datasets: [{
          data: Object.values(counts),
          backgroundColor: [window.RPT_COLORS.used, window.RPT_COLORS.unused, window.RPT_COLORS.allocated, window.RPT_COLORS.expired, window.RPT_COLORS.cancelled]
        }]
      },
      options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }
    });
  };

  /* =========================================================
     11) OVERRIDE Upcoming Expirations — remove Expiry col, add City, live count
     ========================================================= */
  function replaceVisaExpiryHeader() {
    const table = $('visaExpiryTable');
    if (!table) return false;
    const thead = table.querySelector('thead');
    if (!thead || thead.dataset.v280) return true;
    thead.innerHTML =
      '<tr>' +
        '<th data-key="visaDocumentNumber">Visa Doc #</th>' +
        '<th data-key="sponsorId">Sponsor ID</th>' +
        '<th data-key="category">Category</th>' +
        '<th data-key="nationality">Nationality</th>' +
        '<th data-key="stampingCity">City (Stamping)</th>' +
        '<th data-key="client">Client</th>' +
        '<th data-key="days">Days left</th>' +
      '</tr>';
    thead.dataset.v280 = '1';
    return true;
  }

  window.renderVisaExpiryTable = function(rows) {
    replaceVisaExpiryHeader();
    const winInp = $('visaExpiryWindow');
    const windowDays = Number(winInp ? winInp.value : 90);
    const today = new Date();
    const state = window.visaExpSort || { key: null, dir: 1 };
    const daysBetween = window.daysBetween;
    let data = rows.filter(r => r.expirationDate && ['UNUSED', 'ALLOCATED'].includes(r.statusVisa))
      .map(r => ({
        visaDocumentNumber: r.visaDocumentNumber || '\u2014',
        sponsorId: r.sponsorId || '\u2014',
        category: r.visaCategory,
        nationality: r.nationality,
        stampingCity: r.stampingCity || '\u2014',
        client: r.client,
        expiry: r.expirationDate,
        days: daysBetween(today, new Date(r.expirationDate)),
      }))
      .filter(r => r.days <= windowDays);
    data = window.sortRows ? window.sortRows(data, state) : data;
    document.querySelector('#visaExpiryTable tbody').innerHTML = data.map(r => {
      const cls = r.days < 0 || r.days <= 30 ? 'u-crit' : (r.days <= 90 ? 'u-warn' : 'u-ok');
      const label = r.days < 0 ? 'OVERDUE' : r.days + 'd';
      return '<tr>' +
        '<td class="mono">' + esc(r.visaDocumentNumber) + '</td>' +
        '<td class="mono">' + esc(r.sponsorId) + '</td>' +
        '<td>' + esc(r.category) + '</td>' +
        '<td>' + esc(r.nationality) + '</td>' +
        '<td>' + esc(r.stampingCity) + '</td>' +
        '<td>' + esc(r.client) + '</td>' +
        '<td><span class="urgency ' + cls + '">' + label + '</span></td>' +
      '</tr>';
    }).join('') || '<tr><td colspan="7" style="color:var(--text-soft,#6B6558);">No visas expiring in this window.</td></tr>';

    // Live count in section heading
    document.querySelectorAll('h3, h4').forEach(h => {
      const t = (h.textContent || '').trim();
      if (/^Upcoming expirations/i.test(t)) {
        h.innerHTML = 'Upcoming expirations <span style="color:var(--focus,#2E6FA3);font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:normal;">(' + data.length + ' in window)</span>';
      }
    });
  };

  /* Visa main table live count */
  const origRenderVisaMain = window.renderVisaMainTable;
  window.renderVisaMainTable = function(rows) {
    if (typeof origRenderVisaMain === 'function') origRenderVisaMain.apply(this, arguments);
    const note = $('visaRowCapNote');
    if (note && rows && rows.length <= 400) note.textContent = rows.length + ' visa record(s) in filter';
  };

  /* =========================================================
     12) OVERRIDE openVisaForm — City, Hijri, auto expiry
     ========================================================= */
  const origOpenVisaForm = window.openVisaForm;
  window.openVisaForm = function(visaId, prefillCaseId) {
    const ret = origOpenVisaForm ? origOpenVisaForm.apply(this, arguments) : null;
    setTimeout(() => { try { injectVisaFormEnhancements(visaId); } catch (e) { console.warn('v2.8.0 visa form injection:', e); } }, 100);
    return ret;
  };

  function injectVisaFormEnhancements(visaId) {
    const existing = visaId && window.DB ? window.DB.visaRecords.find(v => v.id === visaId) : null;

    // ---- Stamping City field next to Nationality ----
    const natInput = $('vf_nationality');
    if (natInput && !$('vf_stampingCity')) {
      const row = natInput.closest('.row');
      if (row) {
        const cityWrap = document.createElement('div');
        cityWrap.innerHTML = '<label>City (Stamping City)</label><input type="text" id="vf_stampingCity" placeholder=" MANILA, CAIRO, DHAKA" value="' + esc(existing ? (existing.stampingCity || '') : '') + '">';
        row.appendChild(cityWrap);
      }
    }

    // ---- QIWA Hijri date + auto Gregorian shadow + auto expiration ----
    const qDate = $('vf_qiwaVisaDate');
    const qExp = $('vf_expirationDate');
    if (qDate && !qDate.dataset.v280) {
      qDate.dataset.v280 = '1';
      const parent = qDate.parentNode;
      const prevLabel = parent.querySelector('label');
      if (prevLabel) prevLabel.textContent = 'QIWA Visa Date (Hijri, yyyy-mm-dd)';
      qDate.type = 'text';
      qDate.placeholder = '1447-05-15';
      qDate.pattern = '\\d{4}-\\d{2}-\\d{2}';
      qDate.value = existing && existing.qiwaVisaDateHijri ? existing.qiwaVisaDateHijri : (existing && existing.qiwaVisaDate ? existing.qiwaVisaDate : '');
      const shadow = document.createElement('div');
      shadow.className = 'ent-gregorian-shadow';
      shadow.id = 'vf_qiwaVisaDate_greg';
      shadow.innerHTML = 'Gregorian: <strong id="vf_qiwaVisaDate_greg_val">—</strong>';
      parent.appendChild(shadow);
    }
    if (qExp && !qExp.dataset.v280) {
      qExp.dataset.v280 = '1';
      const parent = qExp.parentNode;
      const prevLabel = parent.querySelector('label');
      if (prevLabel) prevLabel.innerHTML = 'QIWA Visa Expiration <span class="hint" style="display:inline;">(Auto)</span>';
      qExp.readOnly = true;
      qExp.classList.add('ent-auto-computed');
      qExp.title = 'Auto-computed from QIWA Visa Date + 2 Hijri years. Cannot be edited.';
      const hint = document.createElement('div');
      hint.className = 'ent-auto-computed-hint';
      hint.textContent = '↳ Locked (auto-calculated)';
      parent.appendChild(hint);
      const shadow = document.createElement('div');
      shadow.className = 'ent-gregorian-shadow';
      shadow.id = 'vf_expirationDate_greg';
      shadow.innerHTML = 'Gregorian expiry: <strong id="vf_expirationDate_greg_val">—</strong>';
      parent.appendChild(shadow);
    }

    const recompute = () => {
      const hijriStr = qDate ? qDate.value.trim() : '';
      const gShadowIssue = $('vf_qiwaVisaDate_greg_val');
      const gShadowExp = $('vf_expirationDate_greg_val');
      if (!hijriStr || !/^\d{4}-\d{2}-\d{2}$/.test(hijriStr)) {
        if (gShadowIssue) gShadowIssue.textContent = '—';
        if (gShadowExp) gShadowExp.textContent = '—';
        if (qExp) qExp.value = '';
        return;
      }
      try {
        const gregIssue = Hijri.hijriIsoToGregorianIso(hijriStr);
        if (gShadowIssue) gShadowIssue.textContent = gregIssue || '—';
        const gregExp = Hijri.addHijriYearsAsGregorianIso(hijriStr, 2);
        if (qExp) qExp.value = gregExp;
        if (gShadowExp) gShadowExp.textContent = gregExp || '—';
      } catch (e) {
        if (gShadowIssue) gShadowIssue.textContent = 'invalid Hijri';
        if (gShadowExp) gShadowExp.textContent = '—';
      }
    };
    if (qDate) qDate.addEventListener('input', recompute);
    recompute();

    // ---- Candidate visa: auto expiration = +90 days ----
    const cDate = $('vf_candidateVisaDate');
    const cExp = $('vf_candidateVisaExpiration');
    if (cExp && !cExp.dataset.v280) {
      cExp.dataset.v280 = '1';
      const parent = cExp.parentNode;
      const prevLabel = parent.querySelector('label');
      if (prevLabel) prevLabel.innerHTML = 'Candidate Visa Expiration <span class="hint" style="display:inline;">(auto: +90 days)</span>';
      cExp.readOnly = true;
      cExp.classList.add('ent-auto-computed');
      cExp.title = 'Auto-computed from Candidate Visa Date + 90 days. Cannot be edited.';
      const hint = document.createElement('div');
      hint.className = 'ent-auto-computed-hint';
      hint.textContent = '↳ Locked (auto-calculated)';
      parent.appendChild(hint);
    }
    const recomputeCandExp = () => {
      if (!cDate || !cExp) return;
      const v = cDate.value;
      if (!v) { cExp.value = ''; return; }
      const d = new Date(v);
      if (isNaN(d.getTime())) return;
      d.setDate(d.getDate() + 90);
      cExp.value = d.toISOString().slice(0, 10);
    };
    if (cDate) cDate.addEventListener('input', recomputeCandExp);
    recomputeCandExp();

    // Hook Save button to persist stampingCity + qiwaVisaDateHijri
    const saveBtn = $('vf_saveBtn');
    if (saveBtn && !saveBtn.dataset.v280wired) {
      saveBtn.dataset.v280wired = '1';
      saveBtn.addEventListener('click', () => {
        setTimeout(() => {
          try {
            if (!window.DB) return;
            const targetId = visaId || (window.DB.visaRecords.length ? window.DB.visaRecords[window.DB.visaRecords.length - 1].id : null);
            if (!targetId) return;
            const rec = window.DB.visaRecords.find(v => v.id === targetId);
            if (!rec) return;
            const city = $('vf_stampingCity') ? $('vf_stampingCity').value.trim() : '';
            const hijri = $('vf_qiwaVisaDate') ? $('vf_qiwaVisaDate').value.trim() : '';
            let changed = false;
            if (rec.stampingCity !== city) { rec.stampingCity = city; changed = true; }
            if (hijri && rec.qiwaVisaDateHijri !== hijri) {
              rec.qiwaVisaDateHijri = hijri;
              const greg = Hijri.hijriIsoToGregorianIso(hijri);
              if (greg) rec.qiwaVisaDate = greg;
              const gregExp = Hijri.addHijriYearsAsGregorianIso(hijri, 2);
              if (gregExp) rec.expirationDate = gregExp;
              changed = true;
            }
            if (changed) {
              rec.updatedAt = nowIso();
              if (window.dbSave) window.dbSave();
              if (window.refreshVisaView) window.refreshVisaView();
            }
          } catch (e) { console.warn('v2.8.0 visa post-save:', e); }
        }, 200);
      });
    }
  }

  /* =========================================================
     13) OVERRIDE openCaseForm — Agency + pipeline dates section
     ========================================================= */
  const origOpenCaseForm = window.openCaseForm;
  window.openCaseForm = function(caseId) {
    const ret = origOpenCaseForm ? origOpenCaseForm.apply(this, arguments) : null;
    setTimeout(() => { try { injectCaseFormEnhancements(caseId); } catch (e) { console.warn('v2.8.0 case form injection:', e); } }, 100);
    return ret;
  };

  function injectCaseFormEnhancements(caseId) {
    const existing = caseId && window.DB ? window.DB.recruitmentCases.find(c => c.id === caseId) : null;
    if ($('cf_dateOfferSent')) return;   // already injected

    const notes = $('cf_notes');
    const saveBtn = $('cf_saveBtn');
    const insertBefore = notes ? notes.parentNode : (saveBtn ? saveBtn.parentNode : null);
    if (!insertBefore) return;

    const section = document.createElement('div');
    section.className = 'ent-case-section';
    section.innerHTML =
      '<h3>Agency &amp; pipeline dates</h3>' +
      '<label>Agency</label>' +
      '<input type="text" id="cf_agency" placeholder="Bryan Agency" value="' + esc(existing ? (existing.agency || '') : '') + '">' +
      '<div class="row" style="margin-top:8px;">' +
        '<div><label>Offer Sent Date</label><input type="date" id="cf_dateOfferSent" value="' + esc(existing ? (existing.dateOfferSent || '') : '') + '"></div>' +
        '<div><label>Offer Signed Date</label><input type="date" id="cf_dateOfferSigned" value="' + esc(existing ? (existing.dateOfferSigned || '') : '') + '"></div>' +
      '</div>' +
      '<div class="row">' +
        '<div><label>Medical Outset</label><input type="date" id="cf_dateMedicalOutset" value="' + esc(existing ? (existing.dateMedicalOutset || '') : '') + '"></div>' +
        '<div><label>Medical Result</label><input type="date" id="cf_dateMedicalResult" value="' + esc(existing ? (existing.dateMedicalResult || '') : '') + '"></div>' +
      '</div>' +
      '<div class="row">' +
        '<div><label>SVP/QVP Outset</label><input type="date" id="cf_dateSvpOutset" value="' + esc(existing ? (existing.dateSvpOutset || '') : '') + '"></div>' +
        '<div><label>SVP/QVP Result</label><input type="date" id="cf_dateSvpResult" value="' + esc(existing ? (existing.dateSvpResult || '') : '') + '"></div>' +
      '</div>' +
      '<div class="row">' +
        '<div><label>Biometrics Outset</label><input type="date" id="cf_dateBioOutset" value="' + esc(existing ? (existing.dateBioOutset || '') : '') + '"></div>' +
        '<div><label>Biometrics Result (Stamped)</label><input type="date" id="cf_dateBioResult" value="' + esc(existing ? (existing.dateBioResult || '') : '') + '"></div>' +
      '</div>';
    insertBefore.parentNode.insertBefore(section, insertBefore);

    if (saveBtn && !saveBtn.dataset.v280wired) {
      saveBtn.dataset.v280wired = '1';
      saveBtn.addEventListener('click', () => {
        setTimeout(() => {
          try {
            if (!window.DB) return;
            const targetId = caseId || (window.DB.recruitmentCases.length ? window.DB.recruitmentCases[window.DB.recruitmentCases.length - 1].id : null);
            if (!targetId) return;
            const rec = window.DB.recruitmentCases.find(c => c.id === targetId);
            if (!rec) return;
            const fields = ['agency', 'dateOfferSent', 'dateOfferSigned', 'dateMedicalOutset', 'dateMedicalResult', 'dateSvpOutset', 'dateSvpResult', 'dateBioOutset', 'dateBioResult'];
            let changed = false;
            fields.forEach(f => {
              const el = $('cf_' + f);
              if (!el) return;
              const v = el.value;
              if (rec[f] !== v) { rec[f] = v || null; changed = true; }
            });
            if (changed) {
              rec.updatedAt = nowIso();
              if (window.dbSave) window.dbSave();
              if (window.refreshPipelineView) window.refreshPipelineView();
            }
          } catch (e) { console.warn('v2.8.0 case post-save:', e); }
        }, 200);
      });
    }
  }

  /* =========================================================
     14) OVERRIDE Bulk Edit — Position + Agency + all pipeline dates
     ========================================================= */
  window.openCaseBulkEditForm = function(ids) {
    if (!window.datalistHtml || !window.RECRUITMENT_TYPE_LABELS || !window.optionsHtml || !window.getStageOptions) {
      Toast().err('Bulk edit unavailable', 'Core functions missing.');
      return;
    }
    const clients = window.datalistHtml('caseClientList', window.DB.recruitmentCases.map(c => c.client));
    const typeOptions = Object.keys(window.RECRUITMENT_TYPE_LABELS)
      .map(k => '<option value="' + k + '">' + esc(window.RECRUITMENT_TYPE_LABELS[k]) + '</option>').join('');
    const stageOptions = window.optionsHtml(window.getStageOptions(window.DB, null), null);

    const html =
      clients +
      '<p class="hint">Only fields you check below will be changed. Unchecked fields are left as-is on each of the ' + ids.length + ' selected case(s).</p>' +

      '<div class="ent-bulk-datefield-group"><h4>Core fields</h4>' +
        '<div class="checkline"><input type="checkbox" id="bce_useStage"><label style="margin:0;">Set Stage to:</label></div>' +
        '<select id="bce_stage" disabled>' + stageOptions + '</select>' +
        '<div class="checkline"><input type="checkbox" id="bce_useType"><label style="margin:0;">Set Recruitment Type to:</label></div>' +
        '<select id="bce_type" disabled>' + typeOptions + '</select>' +
        '<div class="checkline"><input type="checkbox" id="bce_useClient"><label style="margin:0;">Set Client to:</label></div>' +
        '<input type="text" id="bce_client" list="caseClientList" disabled>' +
        '<div class="checkline"><input type="checkbox" id="bce_usePosition"><label style="margin:0;">Set Position to:</label></div>' +
        '<input type="text" id="bce_position" disabled>' +
        '<div class="checkline"><input type="checkbox" id="bce_useAgency"><label style="margin:0;">Set Agency to:</label></div>' +
        '<input type="text" id="bce_agency" disabled placeholder="Bryan Agency">' +
      '</div>' +

      '<div class="ent-bulk-datefield-group"><h4>Offer dates</h4>' +
        '<div class="row">' +
          '<div><label><input type="checkbox" id="bce_useOfferSent"> Offer Sent</label><input type="date" id="bce_dateOfferSent" disabled></div>' +
          '<div><label><input type="checkbox" id="bce_useOfferSigned"> Offer Signed</label><input type="date" id="bce_dateOfferSigned" disabled></div>' +
        '</div>' +
      '</div>' +

      '<div class="ent-bulk-datefield-group"><h4>Medical</h4>' +
        '<div class="row">' +
          '<div><label><input type="checkbox" id="bce_useMedicalOutset"> Medical (Outset)</label><input type="date" id="bce_dateMedicalOutset" disabled></div>' +
          '<div><label><input type="checkbox" id="bce_useMedicalResult"> Medical (Result)</label><input type="date" id="bce_dateMedicalResult" disabled></div>' +
        '</div>' +
      '</div>' +

      '<div class="ent-bulk-datefield-group"><h4>SVP/QVP</h4>' +
        '<div class="row">' +
          '<div><label><input type="checkbox" id="bce_useSvpOutset"> SVP/QVP (Outset)</label><input type="date" id="bce_dateSvpOutset" disabled></div>' +
          '<div><label><input type="checkbox" id="bce_useSvpResult"> SVP/QVP (Result)</label><input type="date" id="bce_dateSvpResult" disabled></div>' +
        '</div>' +
      '</div>' +

      '<div class="ent-bulk-datefield-group"><h4>Biometrics &amp; Visa Stamping</h4>' +
        '<div class="row">' +
          '<div><label><input type="checkbox" id="bce_useBioOutset"> Biometrics (Outset)</label><input type="date" id="bce_dateBioOutset" disabled></div>' +
          '<div><label><input type="checkbox" id="bce_useBioResult"> Biometrics (Result / Stamped)</label><input type="date" id="bce_dateBioResult" disabled></div>' +
        '</div>' +
      '</div>' +

      '<div class="btnrow">' +
        '<button id="bce_saveBtn">Apply to ' + ids.length + ' case(s)</button>' +
        '<button type="button" class="secondary" id="bce_cancelBtn">Cancel</button>' +
      '</div>';

    window.openModal('Bulk Edit — ' + ids.length + ' Recruitment Case(s)', html);
    $('bce_cancelBtn').addEventListener('click', window.closeModal);

    const pairs = [
      ['Stage','stage'], ['Type','type'], ['Client','client'], ['Position','position'], ['Agency','agency'],
      ['OfferSent','dateOfferSent'], ['OfferSigned','dateOfferSigned'],
      ['MedicalOutset','dateMedicalOutset'], ['MedicalResult','dateMedicalResult'],
      ['SvpOutset','dateSvpOutset'], ['SvpResult','dateSvpResult'],
      ['BioOutset','dateBioOutset'], ['BioResult','dateBioResult'],
    ];
    pairs.forEach(([suf,id]) => {
      const chk = $('bce_use' + suf), field = $('bce_' + id);
      if (chk && field) chk.addEventListener('change', () => { field.disabled = !chk.checked; });
    });

    $('bce_saveBtn').addEventListener('click', async () => {
      const patch = {};
      if ($('bce_useStage').checked)         patch.stage = $('bce_stage').value;
      if ($('bce_useType').checked)          patch.recruitmentType = $('bce_type').value;
      if ($('bce_useClient').checked)        patch.client = $('bce_client').value;
      if ($('bce_usePosition').checked)      patch.position = $('bce_position').value.toUpperCase();
      if ($('bce_useAgency').checked)        patch.agency = $('bce_agency').value;
      if ($('bce_useOfferSent').checked)     patch.dateOfferSent = $('bce_dateOfferSent').value;
      if ($('bce_useOfferSigned').checked)   patch.dateOfferSigned = $('bce_dateOfferSigned').value;
      if ($('bce_useMedicalOutset').checked) patch.dateMedicalOutset = $('bce_dateMedicalOutset').value;
      if ($('bce_useMedicalResult').checked) patch.dateMedicalResult = $('bce_dateMedicalResult').value;
      if ($('bce_useSvpOutset').checked)     patch.dateSvpOutset = $('bce_dateSvpOutset').value;
      if ($('bce_useSvpResult').checked)     patch.dateSvpResult = $('bce_dateSvpResult').value;
      if ($('bce_useBioOutset').checked)     patch.dateBioOutset = $('bce_dateBioOutset').value;
      if ($('bce_useBioResult').checked)     patch.dateBioResult = $('bce_dateBioResult').value;
      if (Object.keys(patch).length === 0) { alert('Check at least one field to apply.'); return; }
      window.bulkUpdateRecruitmentCases(window.DB, ids, patch);
      if (window.selectedCaseIds) window.selectedCaseIds.clear();
      if (window.dbSave) await window.dbSave();
      window.closeModal();
      if (window.refreshPipelineView) window.refreshPipelineView();
      if (window.refreshVisaView) window.refreshVisaView();
      Toast().ok('Bulk update applied', ids.length + ' case(s), ' + Object.keys(patch).length + ' field(s)');
    });
  };

  /* =========================================================
     15) UPDATE Excel templates + parsers
     ========================================================= */
  // Visa aliases
  if (window.BULK_VISA_ALIASES) {
    window.BULK_VISA_ALIASES.stampingCity = ['city', 'stamping city', 'city (stamping)', 'city (stamping city)'];
    window.BULK_VISA_ALIASES.qiwaVisaDateHijri = ['qiwa visa date (hijri)', 'qiwa hijri date', 'hijri date'];
  }
  const origDownloadVisaTemplate = window.downloadVisaTemplate;
  if (typeof origDownloadVisaTemplate === 'function' && typeof XLSX !== 'undefined') {
    window.downloadVisaTemplate = function() {
      const headers = ['Full Name', 'Passport', 'Nationality', 'City (Stamping City)', 'Client', 'Visa Document Number', 'Visa Number', 'Company Name',
        'Visa Category', 'CR Number', 'Sponsor ID', 'Status (Visa)', 'QIWA Visa Date (Hijri)', 'QIWA Visa Date', 'QIWA Visa Expiration',
        'Candidate Visa Date', 'Candidate Visa Expiration', 'Registered Agency Name', 'Enjaz Name',
        'Visa Delegation Number', 'Agency Delegation Number', 'Ratified By', 'Ratification Date', 'MOFA Application Number', 'Notes'];
      const sample = ['Juan Dela Cruz', 'AB123456', 'FILIPINO', 'Riyadh', 'OSC', 'VD-1001', 'VN-1001', 'Safwat Al Khaleej Company',
        'WELDER', '2050174515', '4567890', 'ALLOCATED', '1447-05-15', '', '', '', '', '', '', '', '', '', '', '', ''];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
      XLSX.utils.book_append_sheet(wb, ws, 'Visa Records');
      XLSX.writeFile(wb, 'Visa_Bulk_Add_Template_v2.8.xlsx');
    };
  }
  const origParseBulkVisaRows = window.parseBulkVisaRows;
  if (typeof origParseBulkVisaRows === 'function') {
    window.parseBulkVisaRows = function(rows) {
      const result = origParseBulkVisaRows.apply(this, arguments);
      if (!result || !Array.isArray(result.records) || !rows || !rows.length) return result;
      const header = rows[0].map(h => (h == null ? '' : String(h)).trim().toLowerCase());
      const cityIdx = header.findIndex(h => /^city/.test(h) || /stamping/.test(h));
      const hijriIdx = header.findIndex(h => /hijri/.test(h));
      for (let i = 0; i < result.records.length; i++) {
        const row = rows[i + 1]; if (!row) continue;
        if (cityIdx >= 0 && row[cityIdx] != null) result.records[i].stampingCity = String(row[cityIdx]).trim();
        if (hijriIdx >= 0 && row[hijriIdx] != null) {
          const hijriStr = String(row[hijriIdx]).trim();
          if (hijriStr && /^\d{4}-\d{2}-\d{2}$/.test(hijriStr)) {
            result.records[i].qiwaVisaDateHijri = hijriStr;
            if (!result.records[i].qiwaVisaDate) result.records[i].qiwaVisaDate = Hijri.hijriIsoToGregorianIso(hijriStr);
            if (!result.records[i].expirationDate) result.records[i].expirationDate = Hijri.addHijriYearsAsGregorianIso(hijriStr, 2);
          }
        }
      }
      return result;
    };
  }

  // Case aliases + template
  if (window.BULK_CASE_ALIASES) {
    window.BULK_CASE_ALIASES.agency = ['agency'];
    window.BULK_CASE_ALIASES.dateOfferSent = ['offer sent date', 'offer sent', 'date offer sent'];
    window.BULK_CASE_ALIASES.dateOfferSigned = ['offer signed date', 'offer signed', 'date offer signed'];
    window.BULK_CASE_ALIASES.dateMedicalOutset = ['medical outset', 'medical (outset)'];
    window.BULK_CASE_ALIASES.dateMedicalResult = ['medical result', 'medical (result)', 'medical completed'];
    window.BULK_CASE_ALIASES.dateSvpOutset = ['svp outset', 'svp/qvp outset', 'svp (outset)', 'qvp outset'];
    window.BULK_CASE_ALIASES.dateSvpResult = ['svp result', 'svp/qvp result', 'svp (result)', 'svp completed'];
    window.BULK_CASE_ALIASES.dateBioOutset = ['biometrics outset', 'biometrics (outset)', 'bio outset'];
    window.BULK_CASE_ALIASES.dateBioResult = ['biometrics result', 'biometrics (result)', 'stamped', 'visa stamped'];
  }
  if (typeof window.downloadCaseTemplate === 'function' && typeof XLSX !== 'undefined') {
    window.downloadCaseTemplate = function() {
      const headers = ['Name', 'Nationality', 'Position', 'Client', 'Agency', 'Recruitment Type', 'Stage', 'Passport', 'Request Date',
        'Offer Sent Date', 'Offer Signed Date', 'Medical (Outset)', 'Medical (Result)',
        'SVP/QVP (Outset)', 'SVP/QVP (Result)', 'Biometrics (Outset)', 'Biometrics (Result / Stamped)', 'Notes'];
      const sample = ['Juan Dela Cruz', 'FILIPINO', 'WELDER', 'OSC', 'Greenearth Agency', 'Overseas \u2013 Sourced', 'MEDICAL ON PROGRESS', 'AB123456', '2026-07-01',
        '2026-06-15', '2026-06-20', '2026-07-01', '', '', '', '', '', ''];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
      XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
      XLSX.writeFile(wb, 'Candidate_Bulk_Add_Template_v2.8.xlsx');
    };
  }

  /* =========================================================
     16) SCHEMA MIGRATION v2 → v3 (idempotent)
     Backfills new date fields onto existing records.
     ========================================================= */
  function migrateSchemaV3() {
    if (!window.DB) return;
    if (!window.DB.meta) window.DB.meta = {};
    const cur = window.DB.meta.schemaVersion || 1;
    if (cur >= 3) return;
    (window.DB.recruitmentCases || []).forEach(c => {
      ['agency','dateOfferSent','dateOfferSigned','dateMedicalOutset','dateMedicalResult','dateSvpOutset','dateSvpResult','dateBioOutset','dateBioResult'].forEach(f => {
        if (c[f] === undefined) c[f] = null;
      });
    });
    (window.DB.visaRecords || []).forEach(v => {
      if (v.stampingCity === undefined) v.stampingCity = '';
      if (v.qiwaVisaDateHijri === undefined) v.qiwaVisaDateHijri = '';
    });
    window.DB.meta.schemaVersion = 3;
    Toast().info('Schema migrated', 'v' + cur + ' → v3 (pipeline dates + stamping city)');
    log('Schema migrated to v3');
  }
  const origOnDatabaseReady = window.onDatabaseReady;
  window.onDatabaseReady = function() {
    const r = origOnDatabaseReady ? origOnDatabaseReady.apply(this, arguments) : undefined;
    try { migrateSchemaV3(); } catch (e) { console.warn('v3 migration:', e); }
    return r;
  };
  setTimeout(() => { try { migrateSchemaV3(); } catch {} }, 1500);

  /* =========================================================
     17) Kick a refresh of both dashboards once we're loaded,
     so KPI cards + charts + tables all repaint with new logic.
     ========================================================= */
  setTimeout(() => {
    try { if (window.refreshPipelineView) window.refreshPipelineView(); } catch (e) { console.warn(e); }
    try { if (window.refreshVisaView) window.refreshVisaView(); } catch (e) { console.warn(e); }
  }, 2500);

  console.log('%c⚙ Business overhaul v' + V + ' loaded', 'color:#8C6A22;font-weight:bold;');
  setTimeout(() => Toast().ok('Business logic v' + V + ' active', 'Sponsor-aware categories · Hijri auto-expiry · Stamping city · 8-step leaderboard'), 3500);
})();

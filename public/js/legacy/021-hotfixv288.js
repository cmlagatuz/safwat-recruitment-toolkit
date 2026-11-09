
(function HotfixV288(){
  'use strict';
  const V = '2.8.8';
  const $ = (id) => document.getElementById(id);
  const nowIso = () => new Date().toISOString();
  const log = (...a) => console.log('%c[v2.8.8]', 'color:#8C6A22;font-weight:bold', ...a);
  const Toast = () => window.Toast || { ok:console.log, warn:console.warn, err:console.error, info:console.info };

  /* =========================================================
     ADD Gregorian → Hijri conversion to the Hijri module
     Kuwaiti algorithm — inverse of the toGregorian we already have.
     ========================================================= */
  function addGregorianToHijri() {
    if (!window.Hijri) return setTimeout(addGregorianToHijri, 400);
    if (window.Hijri.fromGregorian) return;   // already present

    window.Hijri._gregorianToJd = function(y, m, d) {
      const a = Math.floor((14 - m) / 12);
      const yr = y + 4800 - a;
      const mo = m + 12 * a - 3;
      return d + Math.floor((153 * mo + 2) / 5) + 365 * yr + Math.floor(yr / 4) - Math.floor(yr / 100) + Math.floor(yr / 400) - 32045;
    };

    window.Hijri._hijriFirstOfMonthJd = function(hy, hm) {
      return Math.floor((11 * hy + 3) / 30) + 354 * hy + 30 * hm - Math.floor((hm - 1) / 2) + 1 + 1948440 - 385;
    };

    window.Hijri.fromGregorian = function(y, m, d) {
      const jd = this._gregorianToJd(y, m, d);
      let hy = Math.floor((30 * (jd - 1948440) + 10646) / 10631);
      // Narrow month
      let hm = 1;
      for (let candMonth = 1; candMonth <= 12; candMonth++) {
        const firstNext = this._hijriFirstOfMonthJd(hy, candMonth + 1);
        if (jd < firstNext) { hm = candMonth; break; }
      }
      const firstThis = this._hijriFirstOfMonthJd(hy, hm);
      const hd = jd - firstThis + 1;
      return { y: hy, m: hm, d: hd };
    };

    window.Hijri.gregorianIsoToHijriIso = function(gregIso) {
      if (!gregIso) return '';
      const s = String(gregIso).trim().replace(/[\/\.]/g, '-');
      const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (!m) return '';
      const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
      if (y < 1900) return '';   // this isn't Gregorian, it's already Hijri
      const h = this.fromGregorian(y, mo, d);
      return h.y + '-' + String(h.m).padStart(2, '0') + '-' + String(h.d).padStart(2, '0');
    };

    log('window.Hijri.fromGregorian + gregorianIsoToHijriIso added');
  }
  addGregorianToHijri();

  /* =========================================================
     Populate Hijri input from stored Gregorian on modal open
     ========================================================= */
  function looksGregorian(dateStr) {
    if (!dateStr) return false;
    const m = String(dateStr).trim().match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (!m) return false;
    const y = parseInt(m[1], 10);
    return y >= 1900;   // Gregorian
  }
  function looksHijri(dateStr) {
    if (!dateStr) return false;
    const m = String(dateStr).trim().match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (!m) return false;
    const y = parseInt(m[1], 10);
    return y >= 1300 && y < 1900;
  }
  function normSlash(s) { return s ? String(s).trim().replace(/[\-\.]/g, '/') : ''; }

  function populateHijriFromGregorian(visaId) {
    if (!visaId || !window.DB || !window.Hijri || !window.Hijri.gregorianIsoToHijriIso) return;
    const rec = window.DB.visaRecords.find(v => v.id === visaId);
    if (!rec) return;
    const qDate = $('vf_qiwaVisaDate');
    if (!qDate) return;

    // Case A: qiwaVisaDateHijri already set → use it
    if (rec.qiwaVisaDateHijri) {
      qDate.value = normSlash(rec.qiwaVisaDateHijri);
      qDate.dispatchEvent(new Event('input', { bubbles: true }));
      log('Used existing qiwaVisaDateHijri:', qDate.value);
      return;
    }

    // Case B: qiwaVisaDate exists and is Gregorian → convert to Hijri
    if (rec.qiwaVisaDate && looksGregorian(rec.qiwaVisaDate)) {
      const hijriIso = window.Hijri.gregorianIsoToHijriIso(rec.qiwaVisaDate);
      if (hijriIso) {
        const hijriSlash = normSlash(hijriIso);
        qDate.value = hijriSlash;
        qDate.dispatchEvent(new Event('input', { bubbles: true }));
        log('Converted Gregorian ' + rec.qiwaVisaDate + ' → Hijri ' + hijriSlash);
        Toast().info('Converted from Gregorian', 'Displaying Hijri equivalent. Save to persist.');
        return;
      }
    }

    // Case C: qiwaVisaDate exists and is already in Hijri format
    if (rec.qiwaVisaDate && looksHijri(rec.qiwaVisaDate)) {
      qDate.value = normSlash(rec.qiwaVisaDate);
      qDate.dispatchEvent(new Event('input', { bubbles: true }));
      log('Legacy Hijri already in field:', qDate.value);
      return;
    }

    log('No date to display for', visaId);
  }

  /* Wrap openVisaForm */
  function wrapOpenVisaForm() {
    const orig = window.openVisaForm;
    if (typeof orig !== 'function') return setTimeout(wrapOpenVisaForm, 500);
    if (orig._v288) return;
    const wrapped = function(visaId, prefillCaseId) {
      const ret = orig.apply(this, arguments);
      setTimeout(() => { try { populateHijriFromGregorian(visaId); } catch (e) { console.warn('[v2.8.8]', e); } }, 550);
      setTimeout(() => { try { populateHijriFromGregorian(visaId); } catch {} }, 1200);
      return ret;
    };
    wrapped._v288 = true;
    window.openVisaForm = wrapped;
    log('openVisaForm wrapped (v2.8.8)');
  }
  wrapOpenVisaForm();

  /* =========================================================
     BULK MIGRATION — scan all records, convert Gregorian→Hijri
     Fills qiwaVisaDateHijri from qiwaVisaDate for records that
     have a Gregorian value but no Hijri yet.
     ========================================================= */
  function scanRecords() {
    if (!window.DB) return { total: 0, needsBackfill: [], hasHijri: 0, empty: 0 };
    const recs = window.DB.visaRecords || [];
    const needsBackfill = [];
    let hasHijri = 0, empty = 0;
    recs.forEach(v => {
      if (v.qiwaVisaDateHijri) { hasHijri++; return; }
      if (!v.qiwaVisaDate) { empty++; return; }
      if (looksGregorian(v.qiwaVisaDate)) {
        needsBackfill.push({
          id: v.id, name: v.fullName || '(unnamed)',
          docNum: v.visaDocumentNumber || '(no doc)',
          gregDate: v.qiwaVisaDate,
        });
      }
    });
    return { total: recs.length, needsBackfill, hasHijri, empty };
  }

  function performBackfill() {
    if (!window.EntRbac || !window.EntRbac.myRecord || window.EntRbac.myRecord.role !== 'admin') {
      return Toast().err('Admin only');
    }
    if (!window.Hijri || !window.Hijri.gregorianIsoToHijriIso) return Toast().err('Hijri module not ready');

    const scan = scanRecords();
    if (!scan.needsBackfill.length) {
      Toast().info('Nothing to backfill', 'Every Gregorian date already has a Hijri equivalent.');
      updateBackfillPanel();
      return;
    }
    if (!confirm(
      'Backfill ' + scan.needsBackfill.length + ' record(s)?\n\n' +
      'For each record where qiwaVisaDate is Gregorian and qiwaVisaDateHijri is empty:\n' +
      '  • Compute the Hijri equivalent\n' +
      '  • Store it in qiwaVisaDateHijri\n' +
      '  • Recompute expirationDate as +2 Hijri years (Gregorian)\n\n' +
      'The Gregorian qiwaVisaDate is preserved unchanged.'
    )) return;

    let done = 0;
    const errors = [];
    scan.needsBackfill.forEach(item => {
      const rec = window.DB.visaRecords.find(v => v.id === item.id);
      if (!rec) return;
      try {
        const hijriIso = window.Hijri.gregorianIsoToHijriIso(rec.qiwaVisaDate);
        if (!hijriIso) { errors.push(item.id + ': conversion failed'); return; }
        rec.qiwaVisaDateHijri = normSlash(hijriIso);
        const newExp = window.Hijri.addHijriYearsAsGregorianIso(hijriIso, 2);
        if (newExp) rec.expirationDate = newExp;
        rec.updatedAt = nowIso();
        done++;
      } catch (e) { errors.push(item.id + ': ' + e.message); }
    });

    if (done) {
      if (window.dbSave) window.dbSave();
      if (window.refreshVisaView) window.refreshVisaView();
      if (window.Audit) window.Audit.push('security', 'migration', null, null,
        'Gregorian→Hijri backfill: ' + done + ' records' + (errors.length ? ', ' + errors.length + ' errors' : ''));
      Toast().ok('Backfill complete', done + ' record(s) filled');
    } else {
      Toast().err('No records updated', errors.slice(0, 3).join('; '));
    }
    updateBackfillPanel();
  }

  function updateBackfillPanel() {
    const cloudPanel = $('entCloudPanel');
    if (!cloudPanel) return;
    const isAdmin = window.EntRbac && window.EntRbac.myRecord && window.EntRbac.myRecord.role === 'admin';
    if (!isAdmin) return;

    const scan = scanRecords();

    let panel = $('entGreg2HijriPanel');
    if (!scan.needsBackfill.length) {
      if (panel) panel.remove();
      return;
    }
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'entGreg2HijriPanel';
      panel.className = 'ent-greg2hijri-panel';
      cloudPanel.parentNode.insertBefore(panel, cloudPanel.nextSibling);
    }

    const preview = scan.needsBackfill.slice(0, 15).map(item => {
      const hijri = window.Hijri.gregorianIsoToHijriIso(item.gregDate);
      return item.docNum.padEnd(14) + ' | ' + item.name.padEnd(30).slice(0, 30) + ' | ' +
             item.gregDate + ' (G) → ' + normSlash(hijri) + ' (H)';
    }).join('\n');
    const more = scan.needsBackfill.length > 15 ? '\n… and ' + (scan.needsBackfill.length - 15) + ' more' : '';

    panel.innerHTML =
      '<h3>◆ Backfill Hijri from Gregorian — ' + scan.needsBackfill.length + ' record(s)</h3>' +
      '<p>These records have Gregorian dates stored in <code>qiwaVisaDate</code> but no Hijri equivalent in <code>qiwaVisaDateHijri</code>. Click below to compute and store the Hijri equivalent for each.</p>' +
      '<p>Already have Hijri: ' + scan.hasHijri + ' · Empty: ' + scan.empty + '</p>' +
      '<div class="ent-greg2hijri-report">' + escHtml(preview + more) + '</div>' +
      '<div style="margin-top:10px;">' +
        '<button id="entGreg2HijriBtn">Backfill all ' + scan.needsBackfill.length + '</button>' +
        '<button id="entGreg2HijriRescan" class="secondary">Re-scan</button>' +
      '</div>';

    $('entGreg2HijriBtn').addEventListener('click', performBackfill);
    $('entGreg2HijriRescan').addEventListener('click', updateBackfillPanel);
  }
  function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

  /* Poll for panel readiness — self-limiting */
  let checker = null;
  let attempts = 0;
  function startPanelCheck() {
    if (checker) return;
    checker = setInterval(() => {
      attempts++;
      if (attempts > 60) { clearInterval(checker); checker = null; return; }   // stop after 5 min
      if (!window.DB) return;
      if (!window.EntRbac || !window.EntRbac.myRecord || window.EntRbac.myRecord.role !== 'admin') return;
      if (!$('entCloudPanel')) return;
      if (!window.Hijri || !window.Hijri.gregorianIsoToHijriIso) return;
      updateBackfillPanel();
      clearInterval(checker); checker = null;
      log('Backfill panel initialized');
    }, 5000);
  }
  startPanelCheck();

  /* Manual API for debugging */
  window._entGreg2Hijri = { scanRecords, performBackfill, updateBackfillPanel, addGregorianToHijri };

  console.log('%c⏱ Gregorian→Hijri conversion v' + V + ' active', 'color:#8C6A22;font-weight:bold;');
})();


(function VisaBulkV2823(){
  'use strict';
  const V = '2.8.23';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const log = (...a) => console.log('%c[v2.8.23]', 'color:#2E6FA3;font-weight:bold', ...a);
  const Toast = () => window.Toast || { ok:console.log, warn:console.warn, err:console.error, info:console.info };

  const toDash = (s) => s ? String(s).trim().replace(/[\/\.]/g, '-') : '';
  const toSlash = (s) => s ? String(s).trim().replace(/-/g, '/') : '';

  function openBulkEdit(ids) {
    if (!ids || !ids.length || !window.DB) return;
    if (!window.openModal || !window.closeModal) {
      Toast().err('Modal system unavailable');
      return;
    }

    const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
    const clients = uniq(window.DB.visaRecords.map(v => v.client));
    const cats = uniq(window.DB.visaRecords.map(v => v.visaCategory));
    const cities = uniq(window.DB.visaRecords.map(v => v.stampingCity));
    const nats = uniq(window.DB.visaRecords.map(v => v.nationality));
    const agencies = uniq(window.DB.visaRecords.map(v => v.registeredAgencyName));
    const sponsorIds = uniq(window.DB.visaRecords.map(v => v.sponsorId));
    const crNumbers = uniq(window.DB.visaRecords.map(v => v.crNumber));

    const dl = (id, items) =>
      '<datalist id="' + id + '">' +
        items.map(v => '<option value="' + esc(v) + '">').join('') +
      '</datalist>';

    const qiwaMode = (function(){ try { return localStorage.getItem('safwatEnt.qiwaDisplayMode') || 'hijri'; } catch { return 'hijri'; } })();
    const qiwaPlaceholder = qiwaMode === 'hijri' ? '1447/07/01' : '2026/01/15';
    const qiwaHint = qiwaMode === 'hijri' ? 'Hijri (yyyy/mm/dd)' : 'Gregorian (yyyy/mm/dd)';

    /* Build one row */
    const row = (chkId, labelText, inputHtml) =>
      '<div class="v2823-row">' +
        '<label class="v2823-lbl">' +
          '<input type="checkbox" id="' + esc(chkId) + '">' +
          '<span>Set ' + esc(labelText) + ':</span>' +
        '</label>' +
        inputHtml +
      '</div>';

    /* Build a pair (two rows side-by-side) */
    const pair = (a, b) =>
      '<div class="v2823-pair">' +
        row(a.chkId, a.label, a.input) +
        row(b.chkId, b.label, b.input) +
      '</div>';

    const html =
      dl('v23_clientList', clients) +
      dl('v23_catList', cats) +
      dl('v23_cityList', cities) +
      dl('v23_natList', nats) +
      dl('v23_agencyList', agencies) +
      dl('v23_sponsorIdList', sponsorIds) +
      dl('v23_crList', crNumbers) +

      '<p style="font-size:12.5px;color:#6B6558;margin:0 0 12px;">Only checked fields will be changed on each of the ' + ids.length + ' selected record(s). Auto-derived fields (Sponsor, QIWA Expiration, Candidate Expiration) update automatically.</p>' +

      /* ── STATUS & CLASSIFICATION ── */
      '<div class="v2823-group">' +
        '<div class="v2823-title">Status &amp; classification</div>' +
        row('v23_useStatus', 'Visa Status',
          '<select id="v23_status" class="v2823-input" disabled>' +
            '<option value="USED">USED</option>' +
            '<option value="UNUSED">UNUSED</option>' +
            '<option value="ALLOCATED">ALLOCATED</option>' +
            '<option value="EXPIRED">EXPIRED</option>' +
            '<option value="CANCELLED">CANCELLED</option>' +
          '</select>') +
        row('v23_useCategory', 'Visa Category',
          '<input type="text" id="v23_category" class="v2823-input" list="v23_catList" disabled placeholder="WELDER">') +
      '</div>' +

      /* ── CANDIDATE DEMOGRAPHICS ── */
      '<div class="v2823-group">' +
        '<div class="v2823-title">Candidate demographics</div>' +
        pair(
          { chkId: 'v23_useNationality', label: 'Nationality',
            input: '<input type="text" id="v23_nationality" class="v2823-input" list="v23_natList" disabled>' },
          { chkId: 'v23_useCity', label: 'Stamping City',
            input: '<input type="text" id="v23_city" class="v2823-input" list="v23_cityList" disabled placeholder="MANILA">' }
        ) +
        row('v23_useGender', 'Gender',
          '<select id="v23_gender" class="v2823-input" disabled>' +
            '<option value="">—</option>' +
            '<option value="MALE">Male</option>' +
            '<option value="FEMALE">Female</option>' +
          '</select>') +
      '</div>' +

      /* ── CLIENT & SPONSOR ── */
      '<div class="v2823-group">' +
        '<div class="v2823-title">Client &amp; sponsor</div>' +
        row('v23_useClient', 'Client',
          '<input type="text" id="v23_client" class="v2823-input" list="v23_clientList" disabled>') +
        pair(
          { chkId: 'v23_useSponsorId', label: 'Sponsor ID',
            input: '<input type="text" id="v23_sponsorId" class="v2823-input" list="v23_sponsorIdList" disabled>' },
          { chkId: 'v23_useCrNumber', label: 'CR Number',
            input: '<input type="text" id="v23_crNumber" class="v2823-input" list="v23_crList" disabled>' }
        ) +
      '</div>' +

      /* ── VISA NUMBERS ── (MOFA REMOVED) */
      '<div class="v2823-group">' +
        '<div class="v2823-title">Visa numbers</div>' +
        pair(
          { chkId: 'v23_useVisaDocNum', label: 'Visa Document #',
            input: '<input type="text" id="v23_visaDocNum" class="v2823-input" disabled placeholder="1304524234">' },
          { chkId: 'v23_useVisaNumber', label: 'Visa Number',
            input: '<input type="text" id="v23_visaNumber" class="v2823-input" disabled>' }
        ) +
      '</div>' +

      /* ── AGENCY & DELEGATION ── */
      '<div class="v2823-group">' +
        '<div class="v2823-title">Agency &amp; delegation</div>' +
        row('v23_useAgency', 'Registered Agency Name',
          '<input type="text" id="v23_agency" class="v2823-input" list="v23_agencyList" disabled>') +
        pair(
          { chkId: 'v23_useAgencyDeleg', label: 'Agency Delegation #',
            input: '<input type="text" id="v23_agencyDeleg" class="v2823-input" disabled>' },
          { chkId: 'v23_useRatDate', label: 'Delegation Date',
            input: '<input type="text" id="v23_ratDate" class="v2823-input" disabled placeholder="yyyy/mm/dd">' }
        ) +
      '</div>' +

      /* ── QIWA VISA DATES ── */
      '<div class="v2823-group">' +
        '<div class="v2823-title">QIWA visa dates</div>' +
        '<div class="v2823-hint">Setting QIWA Visa Date auto-computes QIWA Expiration (+2 Hijri years) per record. Current input mode: <b>' + qiwaHint + '</b>.</div>' +
        row('v23_useQiwaDate', 'QIWA Visa Date',
          '<input type="text" id="v23_qiwaDate" class="v2823-input" disabled placeholder="' + qiwaPlaceholder + '">') +
      '</div>' +

      /* ── CANDIDATE VISA ── (NO LINKED CASE) */
      '<div class="v2823-group">' +
        '<div class="v2823-title">Candidate visa</div>' +
        '<div class="v2823-hint">Setting Candidate Visa Issuance auto-computes expiration (+90 days) per record.</div>' +
        row('v23_useCandDate', 'Candidate Visa Issuance',
          '<input type="text" id="v23_candDate" class="v2823-input" disabled placeholder="yyyy/mm/dd">') +
      '</div>' +

      /* ── ACTIONS ── */
      '<div class="v2823-actions">' +
        '<button type="button" class="v2823-btn-secondary" id="v23_cancelBtn">Cancel</button>' +
        '<button type="button" class="v2823-btn-primary" id="v23_saveBtn">Apply to ' + ids.length + ' record(s)</button>' +
      '</div>';

    window.openModal('Bulk Edit — ' + ids.length + ' Visa Record(s)', html);
    $('v23_cancelBtn').addEventListener('click', window.closeModal);

    /* Wire enabler checkboxes */
    const pairs = [
      ['Status','status'], ['Category','category'],
      ['Nationality','nationality'], ['City','city'], ['Gender','gender'],
      ['Client','client'], ['SponsorId','sponsorId'], ['CrNumber','crNumber'],
      ['VisaDocNum','visaDocNum'], ['VisaNumber','visaNumber'],
      ['Agency','agency'], ['AgencyDeleg','agencyDeleg'], ['RatDate','ratDate'],
      ['QiwaDate','qiwaDate'], ['CandDate','candDate'],
    ];
    pairs.forEach(([suf,id]) => {
      const chk = $('v23_use' + suf);
      const field = $('v23_' + id);
      if (chk && field) chk.addEventListener('change', () => { field.disabled = !chk.checked; });
    });

    $('v23_saveBtn').addEventListener('click', async () => {
      const patch = {};
      const compute = {};

      if ($('v23_useStatus').checked)      patch.statusVisa = $('v23_status').value;
      if ($('v23_useCategory').checked)    patch.visaCategory = $('v23_category').value.toUpperCase();
      if ($('v23_useNationality').checked) patch.nationality = $('v23_nationality').value.toUpperCase();
      if ($('v23_useCity').checked)        patch.stampingCity = $('v23_city').value;
      if ($('v23_useGender').checked)      patch.gender = $('v23_gender').value;
      if ($('v23_useClient').checked)      patch.client = $('v23_client').value;
      if ($('v23_useSponsorId').checked)   patch.sponsorId = $('v23_sponsorId').value;
      if ($('v23_useCrNumber').checked)    patch.crNumber = $('v23_crNumber').value;
      if ($('v23_useVisaDocNum').checked)  patch.visaDocumentNumber = $('v23_visaDocNum').value;
      if ($('v23_useVisaNumber').checked)  patch.visaNumber = $('v23_visaNumber').value;
      if ($('v23_useAgency').checked)      patch.registeredAgencyName = $('v23_agency').value;
      if ($('v23_useAgencyDeleg').checked) patch.agencyDelegationNumber = $('v23_agencyDeleg').value;
      if ($('v23_useRatDate').checked)     patch.ratificationDate = toDash($('v23_ratDate').value);

      if ($('v23_useQiwaDate').checked)    compute.qiwaDate = $('v23_qiwaDate').value;
      if ($('v23_useCandDate').checked)    compute.candDate = toDash($('v23_candDate').value);

      if (Object.keys(patch).length === 0 && Object.keys(compute).length === 0) {
        alert('Check at least one field to apply.');
        return;
      }

      const nowIso = new Date().toISOString();
      let updated = 0;
      ids.forEach(id => {
        const rec = window.DB.visaRecords.find(v => v.id === id);
        if (!rec) return;
        Object.assign(rec, patch);

        if (compute.qiwaDate) {
          const norm = toDash(compute.qiwaDate);
          const yearNum = parseInt(norm.slice(0,4), 10);
          const isHijri = yearNum >= 1300 && yearNum < 1900;
          if (isHijri) {
            rec.qiwaVisaDateHijri = compute.qiwaDate.trim().replace(/-/g, '/');
            if (window.Hijri) {
              rec.qiwaVisaDate = window.Hijri.hijriIsoToGregorianIso(norm);
              rec.expirationDate = window.Hijri.addHijriYearsAsGregorianIso(norm, 2);
            }
          } else {
            rec.qiwaVisaDate = norm;
            if (window.Hijri && window.Hijri.gregorianIsoToHijriIso) {
              const h = window.Hijri.gregorianIsoToHijriIso(norm);
              if (h) {
                rec.qiwaVisaDateHijri = h.replace(/-/g, '/');
                rec.expirationDate = window.Hijri.addHijriYearsAsGregorianIso(h, 2);
              }
            }
          }
        }
        if (compute.candDate) {
          rec.candidateVisaDate = compute.candDate;
          const d = new Date(compute.candDate);
          if (!isNaN(d.getTime())) {
            d.setDate(d.getDate() + 90);
            rec.candidateVisaExpiration = d.toISOString().slice(0, 10);
          }
        }

        rec.updatedAt = nowIso;
        updated++;
      });

      if (updated) {
        if (window.selectedVisaIds) window.selectedVisaIds.clear();
        if (window.dbSave) await window.dbSave();
        window.closeModal();
        if (window.refreshVisaView) window.refreshVisaView();
        const totalFields = Object.keys(patch).length + Object.keys(compute).length;
        Toast().ok('Bulk update applied', updated + ' record(s) • ' + totalFields + ' field(s)');
        log('Bulk updated', updated, 'records');
      }
    });
  }

  /* Expose */
  window.openVisaBulkEditForm = openBulkEdit;

  /* Intercept the Bulk Edit button at capture phase — this fires BEFORE
     any previous handler (v2.8.17, v2.8.22, or base app). */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.id === 'visaBulkEditBtn') {
      e.preventDefault();
      e.stopImmediatePropagation();
      const ids = [...(window.selectedVisaIds || [])];
      if (ids.length < 2) {
        Toast().warn('Select at least 2 records', 'Bulk edit needs 2+ selections.');
        return;
      }
      openBulkEdit(ids);
    }
  }, true);

  /* Reformat displayed dates in tables to yyyy/mm/dd */
  function reformatDatesInTable(tableId) {
    const t = document.getElementById(tableId);
    if (!t) return 0;
    let count = 0;
    t.querySelectorAll('td').forEach(td => {
      const txt = td.textContent;
      if (/^\d{4}-\d{2}-\d{2}$/.test(txt.trim())) {
        td.textContent = txt.trim().replace(/-/g, '/');
        count++;
      }
    });
    return count;
  }

  function reformatAllDates() {
    let total = 0;
    ['visaMainTable','visaExpiryTable','pipelineMainTable'].forEach(id => {
      total += reformatDatesInTable(id);
    });
    if (total > 0) log('Reformatted ' + total + ' dates → yyyy/mm/dd');
  }

  const origRefreshVisa = window.refreshVisaView;
  if (typeof origRefreshVisa === 'function') {
    window.refreshVisaView = function() {
      const r = origRefreshVisa.apply(this, arguments);
      setTimeout(reformatAllDates, 250);
      return r;
    };
  }
  const origRefreshPipeline = window.refreshPipelineView;
  if (typeof origRefreshPipeline === 'function') {
    window.refreshPipelineView = function() {
      const r = origRefreshPipeline.apply(this, arguments);
      setTimeout(reformatAllDates, 250);
      return r;
    };
  }
  setTimeout(reformatAllDates, 2500);
  setInterval(reformatAllDates, 8000);

  console.log('%c✔ Bulk edit total rewrite v' + V + ' active', 'color:#2E6FA3;font-weight:bold;');
})();

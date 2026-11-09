
(function UnifiedAddVisaV2851(){
  'use strict';
  const V = '2.8.51';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const nowIso = () => new Date().toISOString();
  const log = (...a) => console.log('%c[v2.8.51]', 'color:#2E6FA3;font-weight:bold', ...a);
  const Toast = () => window.Toast || { ok:console.log, warn:console.warn, err:console.error, info:console.info };

  /* ── Insert the unified Add Visa button ────────────── */
  function insertUnifiedButton() {
    if ($('entUnifiedAddVisaBtn')) return true;

    /* Find a good anchor — try #visaAddBtn's parent */
    const anchor = $('visaAddBtn') || $('visaBulkAddBtn');
    if (!anchor || !anchor.parentNode) return false;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'entUnifiedAddVisaBtn';
    btn.textContent = '+ Add Visa';
    btn.addEventListener('click', openUnifiedForm);
    anchor.parentNode.insertBefore(btn, anchor);
    log('Unified Add Visa button inserted');
    return true;
  }

  let bootAttempts = 0;
  const bootTimer = setInterval(() => {
    bootAttempts++;
    if (insertUnifiedButton() || bootAttempts > 60) clearInterval(bootTimer);
  }, 500);

  /* ── The unified form ──────────────────────────────── */
  function openUnifiedForm() {
    if (!window.DB) {
      Toast().err('Database not open');
      return;
    }
    if (!window.openModal || !window.closeModal) {
      Toast().err('Modal system unavailable');
      return;
    }

    /* Datalists from existing values */
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

    const html =
      dl('v51_clientList', clients) +
      dl('v51_catList', cats) +
      dl('v51_cityList', cities) +
      dl('v51_natList', nats) +
      dl('v51_agencyList', agencies) +
      dl('v51_sponsorIdList', sponsorIds) +
      dl('v51_crList', crNumbers) +

      '<p style="font-size:12.5px;color:#6B6558;margin:0 0 4px;">Fill in the shared details below — N identical visa records will be created with status <b>UNUSED</b>.</p>' +

      /* Quantity + Visa Doc # ── the two most critical */
      '<div class="v2851-group">' +
        '<h4>Batch essentials</h4>' +
        '<div class="v2851-row">' +
          '<div class="v2851-cell">' +
            '<label>Quantity <span class="req">*</span></label>' +
            '<input type="number" id="v51_qty" min="1" max="500" value="1" required>' +
          '</div>' +
          '<div class="v2851-cell">' +
            '<label>Visa Document Number <span class="req">*</span></label>' +
            '<input type="text" id="v51_docNum" placeholder="1304524234" required>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* Sponsor / CR / Request Number */
      '<div class="v2851-group">' +
        '<h4>Sponsor &amp; CR</h4>' +
        '<div class="v2851-row">' +
          '<div class="v2851-cell">' +
            '<label>Sponsor ID</label>' +
            '<input type="text" id="v51_sponsorId" list="v51_sponsorIdList" placeholder="4001234567">' +
          '</div>' +
          '<div class="v2851-cell">' +
            '<label>CR Number</label>' +
            '<input type="text" id="v51_crNumber" list="v51_crList" placeholder="2050174515">' +
          '</div>' +
        '</div>' +
        '<div class="v2851-row full">' +
          '<div class="v2851-cell">' +
            '<label>Request Number (QIWA)</label>' +
            '<input type="text" id="v51_requestNumber" placeholder="4-29177-1448">' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* Visa Category + Nationality */
      '<div class="v2851-group">' +
        '<h4>Category &amp; candidate profile</h4>' +
        '<div class="v2851-row">' +
          '<div class="v2851-cell">' +
            '<label>Visa Category <span class="req">*</span></label>' +
            '<input type="text" id="v51_category" list="v51_catList" placeholder="WELDER" required>' +
          '</div>' +
          '<div class="v2851-cell">' +
            '<label>Nationality <span class="req">*</span></label>' +
            '<input type="text" id="v51_nationality" list="v51_natList" placeholder="FILIPINO" required>' +
          '</div>' +
        '</div>' +
        '<div class="v2851-row">' +
          '<div class="v2851-cell">' +
            '<label>Stamping City</label>' +
            '<input type="text" id="v51_city" list="v51_cityList" placeholder="MANILA">' +
          '</div>' +
          '<div class="v2851-cell">' +
            '<label>Gender</label>' +
            '<select id="v51_gender">' +
              '<option value="">—</option>' +
              '<option value="MALE">Male</option>' +
              '<option value="FEMALE">Female</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* Client + Agency (optional) */
      '<div class="v2851-group">' +
        '<h4>Client &amp; agency (optional)</h4>' +
        '<div class="v2851-row">' +
          '<div class="v2851-cell">' +
            '<label>Client</label>' +
            '<input type="text" id="v51_client" list="v51_clientList" placeholder="Leave blank if not yet assigned">' +
          '</div>' +
          '<div class="v2851-cell">' +
            '<label>Registered Agency Name</label>' +
            '<input type="text" id="v51_agency" list="v51_agencyList" placeholder="Leave blank if not yet assigned">' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* QIWA Hijri date */
      '<div class="v2851-group">' +
        '<h4>QIWA visa dates (optional)</h4>' +
        '<p class="v2851-hint">Enter Hijri date to auto-compute Gregorian issue + expiration (+2 Hijri years).</p>' +
        '<div class="v2851-row">' +
          '<div class="v2851-cell">' +
            '<label>QIWA Visa Date (Hijri, yyyy/mm/dd)</label>' +
            '<input type="text" id="v51_qiwaHijri" placeholder="1447/07/01">' +
            '<div class="v2851-shadow" id="v51_qiwaGregShadow" style="display:none;">Gregorian: <strong id="v51_qiwaGregVal">—</strong></div>' +
          '</div>' +
          '<div class="v2851-cell">' +
            '<label>QIWA Visa Expiration (Auto)</label>' +
            '<input type="text" id="v51_qiwaExpDate" readonly placeholder="auto">' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="v2851-summary" id="v51_summary">' +
        'Will create <b><span id="v51_summaryQty">1</span></b> identical visa record(s) with status <b>UNUSED</b>.' +
      '</div>' +

      '<div class="v2851-actions">' +
        '<button type="button" class="v2851-btn-secondary" id="v51_cancelBtn">Cancel</button>' +
        '<button type="button" class="v2851-btn-primary" id="v51_saveBtn">Add visa records</button>' +
      '</div>';

    window.openModal('Add Visa Records', html);
    $('v51_cancelBtn').addEventListener('click', window.closeModal);

    /* Live-update the quantity in the summary */
    const qtyInput = $('v51_qty');
    const updateSummary = () => {
      const n = Math.max(1, Math.min(500, parseInt(qtyInput.value, 10) || 1));
      $('v51_summaryQty').textContent = n;
      $('v51_saveBtn').textContent = n === 1 ? 'Add visa record' : 'Add ' + n + ' visa records';
    };
    qtyInput.addEventListener('input', updateSummary);
    updateSummary();

    /* Hijri → Gregorian live conversion */
    const hijriInput = $('v51_qiwaHijri');
    const gregShadow = $('v51_qiwaGregShadow');
    const gregVal = $('v51_qiwaGregVal');
    const expInput = $('v51_qiwaExpDate');
    const recomputeDates = () => {
      const raw = (hijriInput.value || '').trim();
      const norm = raw.replace(/[\/\.]/g, '-');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(norm)) {
        gregShadow.style.display = 'none';
        expInput.value = '';
        return;
      }
      if (!window.Hijri) return;
      try {
        const greg = window.Hijri.hijriIsoToGregorianIso(norm);
        gregVal.textContent = greg || '—';
        gregShadow.style.display = 'inline-block';
        expInput.value = window.Hijri.addHijriYearsAsGregorianIso(norm, 2) || '';
      } catch {}
    };
    hijriInput.addEventListener('input', recomputeDates);

    /* SAVE handler */
    $('v51_saveBtn').addEventListener('click', async () => {
      /* Validate essential fields */
      const qty = Math.max(1, Math.min(500, parseInt(qtyInput.value, 10) || 1));
      const docNum = $('v51_docNum').value.trim();
      const category = $('v51_category').value.trim().toUpperCase();
      const nationality = $('v51_nationality').value.trim().toUpperCase();

      if (!docNum || !category || !nationality) {
        Toast().err('Missing required fields', 'Visa Document Number, Visa Category, and Nationality are required.');
        return;
      }

      /* Build the shared payload */
      const hijriRaw = ($('v51_qiwaHijri').value || '').trim();
      const hijriNorm = hijriRaw.replace(/[\/\.]/g, '-');
      const isValidHijri = /^\d{4}-\d{2}-\d{2}$/.test(hijriNorm);
      const hijriSlash = hijriRaw.replace(/-/g, '/');
      const gregIssue = isValidHijri && window.Hijri ? window.Hijri.hijriIsoToGregorianIso(hijriNorm) : '';
      const gregExp = isValidHijri && window.Hijri ? window.Hijri.addHijriYearsAsGregorianIso(hijriNorm, 2) : '';

      const shared = {
        visaDocumentNumber: docNum,
        sponsorId: $('v51_sponsorId').value.trim(),
        crNumber: $('v51_crNumber').value.trim(),
        requestNumber: $('v51_requestNumber').value.trim(),
        visaCategory: category,
        nationality: nationality,
        stampingCity: $('v51_city').value.trim(),
        gender: $('v51_gender').value,
        client: $('v51_client').value.trim(),
        registeredAgencyName: $('v51_agency').value.trim(),
        qiwaVisaDateHijri: isValidHijri ? hijriSlash : '',
        qiwaVisaDate: gregIssue || '',
        expirationDate: gregExp || '',
      };

      /* Sponsor derived from company/agency — leave blank since Company Name isn't collected here */
      shared.companyName = '';
      if (typeof window.deriveSponsor === 'function') {
        try { shared.sponsor = window.deriveSponsor(''); }
        catch { shared.sponsor = 'CLIENT'; }
      } else {
        shared.sponsor = 'CLIENT';
      }

      /* Get ID counter */
      const idCounter = window.DB_ID_COUNTER || (typeof window.makeIdCounter === 'function' ? window.makeIdCounter(window.DB) : null);
      if (!idCounter) {
        Toast().err('ID counter unavailable');
        return;
      }

      /* Create N identical records */
      const saveBtn = $('v51_saveBtn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Adding…';

      let added = 0;
      const errors = [];
      const nowIsoNow = nowIso();
      for (let i = 0; i < qty; i++) {
        try {
          const id = (typeof window.padId === 'function' ? window.padId('VR', idCounter.nextVisa++) : ('VR-' + String(idCounter.nextVisa++).padStart(6, '0')));
          const rec = {
            id: id,
            linkedRecruitmentCaseId: null,
            fullName: '',
            passport: '',
            ...shared,
            statusVisa: 'UNUSED',   /* per your spec */
            visaNumber: '',
            candidateVisaDate: null,
            candidateVisaExpiration: null,
            enjazAgencyName: '',
            visaDelegationNumber: '',
            agencyDelegationNumber: '',
            ratifiedBy: '',
            ratificationDate: null,
            mofaApplicationNumber: '',
            notes: '',
            createdAt: nowIsoNow,
            updatedAt: nowIsoNow,
          };
          window.DB.visaRecords.push(rec);
          added++;
        } catch (e) {
          errors.push('Record ' + (i + 1) + ': ' + e.message);
        }
      }

      /* Save + refresh */
      if (added > 0) {
        try {
          if (window.dbSave) await window.dbSave();
        } catch (e) { errors.push('Save error: ' + e.message); }
        if (window.refreshVisaView) try { window.refreshVisaView(); } catch {}
        if (window._entDirectRenderVisa) try { window._entDirectRenderVisa(); } catch {}
      }

      saveBtn.disabled = false;
      saveBtn.textContent = 'Add visa records';

      if (added > 0) {
        window.closeModal();
        Toast().ok('Added ' + added + ' visa record(s)',
                   added === 1 ? 'Status: UNUSED' : 'All set to UNUSED status');
        log('Added ' + added + ' visas via unified form');
      } else {
        Toast().err('Failed to add', errors[0] || 'Unknown error');
      }
    });
  }

  window._entOpenUnifiedAddVisa = openUnifiedForm;

  console.log('%c➕ Unified Add Visa v' + V + ' active', 'color:#2E6FA3;font-weight:bold;');
})();

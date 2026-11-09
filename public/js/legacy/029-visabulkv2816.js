
(function VisaBulkV2816(){
  'use strict';
  const V = '2.8.16';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const log = (...a) => console.log('%c[v2.8.16]', 'color:#2E6FA3;font-weight:bold', ...a);
  const Toast = () => window.Toast || { ok:console.log, warn:console.warn, err:console.error, info:console.info };

  /* =========================================================
     1) Override renderVisaBulkBar — show only when 2+ selected
     ========================================================= */
  window.renderVisaBulkBar = function() {
    const bar = $('visaBulkBar');
    if (!bar) return;
    const n = window.selectedVisaIds ? window.selectedVisaIds.size : 0;
    if (n >= 2) {
      bar.classList.add('ent-visible');
      const count = $('visaBulkCount');
      if (count) count.textContent = n + ' records selected';
    } else {
      bar.classList.remove('ent-visible');
      bar.style.display = 'none';
    }
  };

  /* =========================================================
     2) Re-attach row checkbox handler (belt & suspenders)
        In case v2.8.15's tbody rebuild broke the delegated listener.
     ========================================================= */
  function ensureRowCheckboxHandler() {
    const tbody = document.querySelector('#visaMainTable tbody');
    if (!tbody) return;
    if (tbody.dataset.v2816Wired) return;
    tbody.dataset.v2816Wired = '1';
    tbody.addEventListener('change', (e) => {
      if (!e.target.classList.contains('visa-row-check')) return;
      const id = e.target.dataset.id;
      if (!window.selectedVisaIds) window.selectedVisaIds = new Set();
      if (e.target.checked) window.selectedVisaIds.add(id);
      else window.selectedVisaIds.delete(id);
      window.renderVisaBulkBar();
      // Update select-all state
      const selAll = $('visaSelectAll');
      if (selAll) {
        const boxes = [...document.querySelectorAll('.visa-row-check')];
        selAll.checked = boxes.length > 0 && boxes.every(c => c.checked);
      }
    });
    log('Row checkbox handler ensured');
  }

  /* Poll for tbody readiness (short-lived) */
  let attempts = 0;
  const wireTimer = setInterval(() => {
    attempts++;
    ensureRowCheckboxHandler();
    if (attempts > 30) clearInterval(wireTimer);
  }, 800);

  /* =========================================================
     3) Rebuild openVisaBulkEditForm with Gender + expanded fields
     ========================================================= */
  window.openVisaBulkEditForm = function(ids) {
    if (!ids || !ids.length || !window.DB) return;
    if (!window.openModal || !window.closeModal) {
      Toast().err('Modal system unavailable');
      return;
    }

    // Build datalists from existing values
    const uniq = (arr) => [...new Set(arr.filter(Boolean))];
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
      dl('vbulkClientList', clients) +
      dl('vbulkCatList', cats) +
      dl('vbulkCityList', cities) +
      dl('vbulkNatList', nats) +
      dl('vbulkAgencyList', agencies) +
      dl('vbulkSponsorIdList', sponsorIds) +
      dl('vbulkCrList', crNumbers) +

      '<p class="hint">Only fields you check below will be changed. Unchecked fields remain unchanged on each of the ' + ids.length + ' selected record(s).</p>' +

      '<div class="ent-vbulk-group"><h4>Status &amp; Classification</h4>' +
        '<div class="checkline"><input type="checkbox" id="vbe_useStatus"><label style="margin:0;">Set Status to:</label></div>' +
        '<select id="vbe_status" disabled>' +
          '<option value="USED">USED</option>' +
          '<option value="UNUSED">UNUSED</option>' +
          '<option value="ALLOCATED">ALLOCATED</option>' +
          '<option value="EXPIRED">EXPIRED</option>' +
          '<option value="CANCELLED">CANCELLED</option>' +
        '</select>' +
        '<div class="checkline"><input type="checkbox" id="vbe_useCategory"><label style="margin:0;">Set Visa Category to:</label></div>' +
        '<input type="text" id="vbe_category" list="vbulkCatList" disabled>' +
      '</div>' +

      '<div class="ent-vbulk-group"><h4>Candidate details</h4>' +
        '<div class="checkline"><input type="checkbox" id="vbe_useNationality"><label style="margin:0;">Set Nationality to:</label></div>' +
        '<input type="text" id="vbe_nationality" list="vbulkNatList" disabled>' +
        '<div class="checkline"><input type="checkbox" id="vbe_useCity"><label style="margin:0;">Set Stamping City to:</label></div>' +
        '<input type="text" id="vbe_city" list="vbulkCityList" disabled placeholder="MANILA">' +
        '<div class="checkline"><input type="checkbox" id="vbe_useGender"><label style="margin:0;">Set Gender to:</label></div>' +
        '<select id="vbe_gender" disabled>' +
          '<option value="">—</option>' +
          '<option value="MALE">Male</option>' +
          '<option value="FEMALE">Female</option>' +
        '</select>' +
      '</div>' +

      '<div class="ent-vbulk-group"><h4>Client &amp; sponsor</h4>' +
        '<div class="checkline"><input type="checkbox" id="vbe_useClient"><label style="margin:0;">Set Client to:</label></div>' +
        '<input type="text" id="vbe_client" list="vbulkClientList" disabled>' +
        '<div class="checkline"><input type="checkbox" id="vbe_useSponsorId"><label style="margin:0;">Set Sponsor ID to:</label></div>' +
        '<input type="text" id="vbe_sponsorId" list="vbulkSponsorIdList" disabled>' +
        '<div class="checkline"><input type="checkbox" id="vbe_useCrNumber"><label style="margin:0;">Set CR Number to:</label></div>' +
        '<input type="text" id="vbe_crNumber" list="vbulkCrList" disabled>' +
      '</div>' +

      '<div class="ent-vbulk-group"><h4>Agency</h4>' +
        '<div class="checkline"><input type="checkbox" id="vbe_useAgency"><label style="margin:0;">Set Registered Agency Name to:</label></div>' +
        '<input type="text" id="vbe_agency" list="vbulkAgencyList" disabled>' +
      '</div>' +

      '<div class="btnrow">' +
        '<button id="vbe_saveBtn">Apply to ' + ids.length + ' record(s)</button>' +
        '<button type="button" class="secondary" id="vbe_cancelBtn">Cancel</button>' +
      '</div>';

    window.openModal('Bulk Edit — ' + ids.length + ' Visa Record(s)', html);
    $('vbe_cancelBtn').addEventListener('click', window.closeModal);

    // Wire checkbox enablers
    const pairs = [
      ['Status','status'], ['Category','category'],
      ['Nationality','nationality'], ['City','city'], ['Gender','gender'],
      ['Client','client'], ['SponsorId','sponsorId'], ['CrNumber','crNumber'],
      ['Agency','agency'],
    ];
    pairs.forEach(([suf,id]) => {
      const chk = $('vbe_use' + suf);
      const field = $('vbe_' + id);
      if (chk && field) chk.addEventListener('change', () => { field.disabled = !chk.checked; });
    });

    $('vbe_saveBtn').addEventListener('click', async () => {
      const patch = {};
      if ($('vbe_useStatus').checked)      patch.statusVisa = $('vbe_status').value;
      if ($('vbe_useCategory').checked)    patch.visaCategory = $('vbe_category').value.toUpperCase();
      if ($('vbe_useNationality').checked) patch.nationality = $('vbe_nationality').value.toUpperCase();
      if ($('vbe_useCity').checked)        patch.stampingCity = $('vbe_city').value;
      if ($('vbe_useGender').checked)      patch.gender = $('vbe_gender').value;
      if ($('vbe_useClient').checked)      patch.client = $('vbe_client').value;
      if ($('vbe_useSponsorId').checked)   patch.sponsorId = $('vbe_sponsorId').value;
      if ($('vbe_useCrNumber').checked)    patch.crNumber = $('vbe_crNumber').value;
      if ($('vbe_useAgency').checked)      patch.registeredAgencyName = $('vbe_agency').value;

      if (Object.keys(patch).length === 0) {
        alert('Check at least one field to apply.');
        return;
      }

      // Apply patch to each selected record
      const nowIso = new Date().toISOString();
      let updated = 0;
      ids.forEach(id => {
        const rec = window.DB.visaRecords.find(v => v.id === id);
        if (!rec) return;
        Object.assign(rec, patch);
        rec.updatedAt = nowIso;
        updated++;
      });

      if (updated) {
        if (window.selectedVisaIds) window.selectedVisaIds.clear();
        if (window.dbSave) await window.dbSave();
        window.closeModal();
        if (window.refreshVisaView) window.refreshVisaView();
        Toast().ok('Bulk update applied', updated + ' record(s), ' + Object.keys(patch).length + ' field(s)');
        log('Bulk updated ' + updated + ' records with fields: ' + Object.keys(patch).join(', '));
      }
    });
  };

  /* =========================================================
     4) Wire the bulk bar's Edit / Delete / Clear buttons
     (in case they were disconnected during v2.8.15 rebuild)
     ========================================================= */
  function ensureBulkBarButtons() {
    const editBtn = $('visaBulkEditBtn');
    const delBtn = $('visaBulkDeleteBtn');
    const clearBtn = $('visaBulkClearBtn');

    if (editBtn && !editBtn.dataset.v2816) {
      editBtn.dataset.v2816 = '1';
      editBtn.addEventListener('click', () => {
        if (!window.selectedVisaIds || window.selectedVisaIds.size < 2) return;
        window.openVisaBulkEditForm([...window.selectedVisaIds]);
      });
    }
    if (delBtn && !delBtn.dataset.v2816) {
      delBtn.dataset.v2816 = '1';
      delBtn.addEventListener('click', () => {
        const ids = window.selectedVisaIds ? [...window.selectedVisaIds] : [];
        if (ids.length < 2) return;
        if (!confirm('Permanently delete ' + ids.length + ' selected visa record(s)? This cannot be undone.')) return;
        if (window.bulkDeleteVisaRecords) {
          window.bulkDeleteVisaRecords(window.DB, ids);
        } else {
          window.DB.visaRecords = window.DB.visaRecords.filter(v => !ids.includes(v.id));
        }
        window.selectedVisaIds.clear();
        if (window.dbSave) window.dbSave().then(() => {
          if (window.refreshVisaView) window.refreshVisaView();
          if (window.refreshPipelineView) window.refreshPipelineView();
        });
      });
    }
    if (clearBtn && !clearBtn.dataset.v2816) {
      clearBtn.dataset.v2816 = '1';
      clearBtn.addEventListener('click', () => {
        if (window.selectedVisaIds) window.selectedVisaIds.clear();
        document.querySelectorAll('.visa-row-check').forEach(c => c.checked = false);
        const selAll = $('visaSelectAll');
        if (selAll) selAll.checked = false;
        window.renderVisaBulkBar();
      });
    }
  }
  setTimeout(ensureBulkBarButtons, 1500);
  setTimeout(ensureBulkBarButtons, 4000);

  /* =========================================================
     5) selectAll behavior — when checked, add all visible rows;
     when unchecked, clear all. Only enable bulk bar at 2+.
     ========================================================= */
  function ensureSelectAllHandler() {
    const selAll = $('visaSelectAll');
    if (!selAll || selAll.dataset.v2816) return;
    selAll.dataset.v2816 = '1';
    selAll.addEventListener('change', (e) => {
      if (!window.selectedVisaIds) window.selectedVisaIds = new Set();
      document.querySelectorAll('.visa-row-check').forEach(c => {
        c.checked = e.target.checked;
        if (e.target.checked) window.selectedVisaIds.add(c.dataset.id);
        else window.selectedVisaIds.delete(c.dataset.id);
      });
      window.renderVisaBulkBar();
    });
  }
  setInterval(ensureSelectAllHandler, 3000);

  console.log('%c✔ Visa bulk edit v' + V + ' active (Gender + 2+ threshold)', 'color:#2E6FA3;font-weight:bold;');
})();

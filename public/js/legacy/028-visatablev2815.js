
(function VisaTableV2815(){
  'use strict';
  const V = '2.8.15';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const log = (...a) => console.log('%c[v2.8.15]', 'color:#2E6FA3;font-weight:bold', ...a);

  const ROW_CAP = 400;

  /* Persist Hijri/Gregorian toggle in localStorage */
  function getQiwaMode() {
    try { return localStorage.getItem('safwatEnt.qiwaDisplayMode') || 'hijri'; } catch { return 'hijri'; }
  }
  function setQiwaMode(m) {
    try { localStorage.setItem('safwatEnt.qiwaDisplayMode', m); } catch {}
  }

  /* Format a QIWA date for display in the chosen mode */
  function formatQiwaDate(rec, mode) {
    if (!rec) return '—';
    if (mode === 'hijri') {
      // Prefer stored Hijri; fall back to converting Gregorian
      if (rec.qiwaVisaDateHijri) return String(rec.qiwaVisaDateHijri).replace(/-/g, '/');
      if (rec.qiwaVisaDate && window.Hijri && window.Hijri.gregorianIsoToHijriIso) {
        const y = parseInt((rec.qiwaVisaDate + '').slice(0,4), 10);
        if (y >= 1900) {
          const h = window.Hijri.gregorianIsoToHijriIso(rec.qiwaVisaDate);
          return h ? h.replace(/-/g, '/') : '—';
        }
        return String(rec.qiwaVisaDate).replace(/-/g, '/');   // stored value is already Hijri
      }
      return '—';
    }
    // Gregorian
    return rec.qiwaVisaDate || '—';
  }

  /* Format the QIWA Expiration in Gregorian always
     (auto-computed +2 Hijri years, stored as Gregorian) */
  function formatQiwaExpiration(rec, mode) {
    if (!rec) return '—';
    // expirationDate is Gregorian in storage; if in Hijri view mode, convert
    if (mode === 'hijri' && rec.expirationDate && window.Hijri && window.Hijri.gregorianIsoToHijriIso) {
      const y = parseInt((rec.expirationDate + '').slice(0,4), 10);
      if (y >= 1900) {
        const h = window.Hijri.gregorianIsoToHijriIso(rec.expirationDate);
        return h ? h.replace(/-/g, '/') : rec.expirationDate;
      }
    }
    return rec.expirationDate || '—';
  }

  /* Replace the visa table header once — sets 22 columns */
  function replaceVisaHeader() {
    const table = $('visaMainTable');
    if (!table) return false;
    const thead = table.querySelector('thead');
    if (!thead || thead.dataset.v2815) return true;
    const mode = getQiwaMode();
    const modeLabel = mode === 'hijri' ? 'HIJRI' : 'GREG';
    thead.innerHTML =
      '<tr>' +
        '<th><input type="checkbox" id="visaSelectAll"></th>' +
        '<th data-key="fullName">Candidate</th>' +
        '<th data-key="visaDocumentNumber">Visa Doc #</th>' +
        '<th data-key="sponsorId">Sponsor ID</th>' +
        '<th data-key="crNumber">CR Number</th>' +
        '<th data-key="visaCategory">Category</th>' +
        '<th data-key="nationality">Nationality</th>' +
        '<th data-key="stampingCity">Stamping City</th>' +
        '<th data-key="gender">Gender</th>' +
        '<th class="ent-toggle-qiwa" data-key="qiwaVisaDate">QIWA Visa Date <span class="ent-toggle-badge" id="entQiwaModeBadge">' + modeLabel + '</span></th>' +
        '<th data-key="expirationDate">QIWA Expiration</th>' +
        '<th data-key="agencyDelegationNumber">Agency Deleg. #</th>' +
        '<th data-key="ratificationDate">Delegation Date</th>' +
        '<th data-key="registeredAgencyName">Registered Agency</th>' +
        '<th data-key="client">Client</th>' +
        '<th data-key="passport">Passport</th>' +
        '<th data-key="mofaApplicationNumber">MOFA App #</th>' +
        '<th data-key="visaNumber">Visa Number</th>' +
        '<th data-key="statusVisa">Status</th>' +
        '<th data-key="candidateVisaDate">Cand. Visa Issuance</th>' +
        '<th data-key="candidateVisaExpiration">Cand. Visa Expiration</th>' +
        '<th data-key="linkedCase">Linked Case</th>' +
        '<th>Actions</th>' +
      '</tr>';
    thead.dataset.v2815 = '1';

    // Wire the QIWA toggle
    const toggleTh = thead.querySelector('.ent-toggle-qiwa');
    if (toggleTh) {
      toggleTh.addEventListener('click', () => {
        const cur = getQiwaMode();
        const next = cur === 'hijri' ? 'gregorian' : 'hijri';
        setQiwaMode(next);
        const badge = $('entQiwaModeBadge');
        if (badge) badge.textContent = next === 'hijri' ? 'HIJRI' : 'GREG';
        // Re-render
        if (window.refreshVisaView) window.refreshVisaView();
        log('QIWA mode → ' + next);
      });
    }

    // Rewire selectAll checkbox (original handler was on the old element)
    const selAll = $('visaSelectAll');
    if (selAll) {
      selAll.addEventListener('change', (e) => {
        document.querySelectorAll('.visa-row-check').forEach(c => {
          c.checked = e.target.checked;
          if (window.selectedVisaIds) {
            if (e.target.checked) window.selectedVisaIds.add(c.dataset.id);
            else window.selectedVisaIds.delete(c.dataset.id);
          }
        });
        if (window.renderVisaBulkBar) window.renderVisaBulkBar();
      });
    }

    return true;
  }

  /* Override renderVisaMainTable */
  window.renderVisaMainTable = function(rows) {
    replaceVisaHeader();
    const mode = getQiwaMode();
    const shown = rows.slice(0, ROW_CAP);
    const note = $('visaRowCapNote');
    if (note) note.textContent = rows.length > ROW_CAP
      ? 'Showing first ' + ROW_CAP + ' of ' + rows.length + ' matching visa records'
      : rows.length + ' visa record(s) in filter';

    // Sync selection set with visible rows
    const shownIds = new Set(shown.map(v => v.id));
    if (window.selectedVisaIds) {
      [...window.selectedVisaIds].forEach(id => { if (!shownIds.has(id)) window.selectedVisaIds.delete(id); });
    }
    const selected = window.selectedVisaIds || new Set();

    document.querySelector('#visaMainTable tbody').innerHTML = shown.map(v => {
      const linkedCase = v.linkedRecruitmentCaseId && window.DB
        ? window.DB.recruitmentCases.find(c => c.id === v.linkedRecruitmentCaseId) : null;
      const status = (v.statusVisa || '').toUpperCase();
      return '<tr>' +
        '<td><input type="checkbox" class="visa-row-check" data-id="' + esc(v.id) + '" ' + (selected.has(v.id) ? 'checked' : '') + '></td>' +
        '<td class="wrap"><b>' + esc(v.fullName || '—') + '</b>' +
          (v.sponsor ? ' <span class="ent-sponsor-pill ' + esc(v.sponsor) + '">' + esc(v.sponsor) + '</span>' : '') + '</td>' +
        '<td class="mono">' + esc(v.visaDocumentNumber || '—') + '</td>' +
        '<td class="mono">' + esc(v.sponsorId || '—') + '</td>' +
        '<td class="mono">' + esc(v.crNumber || '—') + '</td>' +
        '<td>' + esc(v.visaCategory || '—') + '</td>' +
        '<td>' + esc(v.nationality || '—') + '</td>' +
        '<td>' + esc(v.stampingCity || '—') + '</td>' +
        '<td>' + esc(v.gender || '—') + '</td>' +
        '<td class="mono">' + esc(formatQiwaDate(v, mode)) + '</td>' +
        '<td class="mono">' + esc(formatQiwaExpiration(v, mode)) + '</td>' +
        '<td class="mono">' + esc(v.agencyDelegationNumber || '—') + '</td>' +
        '<td class="mono">' + esc(v.ratificationDate || '—') + '</td>' +
        '<td class="wrap">' + esc(v.registeredAgencyName || '—') + '</td>' +
        '<td class="wrap">' + esc(v.client || '—') + '</td>' +
        '<td class="mono">' + esc(v.passport || '—') + '</td>' +
        '<td class="mono">' + esc(v.mofaApplicationNumber || '—') + '</td>' +
        '<td class="mono">' + esc(v.visaNumber || '—') + '</td>' +
        '<td><span class="ent-vs-pill ' + esc(status) + '">' + esc(status || '—') + '</span></td>' +
        '<td class="mono">' + esc(v.candidateVisaDate || '—') + '</td>' +
        '<td class="mono">' + esc(v.candidateVisaExpiration || '—') + '</td>' +
        '<td class="wrap">' + (linkedCase ? esc(linkedCase.name) : '—') + '</td>' +
        '<td style="white-space:nowrap;">' +
          '<button class="small secondary" data-action="edit-visa" data-id="' + esc(v.id) + '">Edit</button>' +
          (v.visaCopyFileName || v.visaCopyStoragePath
            ? ' <button class="small secondary" data-action="view-copy" data-id="' + esc(v.id) + '">View</button>' : '') +
          ' <button class="small danger" data-action="delete-visa" data-id="' + esc(v.id) + '">Delete</button>' +
        '</td>' +
      '</tr>';
    }).join('') || '<tr><td colspan="23" style="color:var(--text-soft,#6B6558);text-align:center;padding:24px 0;">No visa records match the current filters.</td></tr>';

    const selAll = $('visaSelectAll');
    if (selAll) selAll.checked = shown.length > 0 && shown.every(v => selected.has(v.id));
    if (window.renderVisaBulkBar) window.renderVisaBulkBar();
  };

  /* =========================================================
     Add "Gender" field to the visa form
     ========================================================= */
  function injectGenderField() {
    const natInput = $('vf_nationality');
    if (!natInput || $('vf_gender')) return;
    // Insert Gender next to Stamping City (which sits next to Nationality)
    const cityInput = $('vf_stampingCity');
    const anchor = cityInput ? cityInput.closest('div') : natInput.closest('div');
    if (!anchor) return;
    const row = anchor.parentNode;   // .row
    if (!row) return;
    const wrap = document.createElement('div');
    // Read existing value from record if editing
    const visaId = (window.EntV2815 && window.EntV2815._currentVisaId) || null;
    const rec = visaId && window.DB ? window.DB.visaRecords.find(v => v.id === visaId) : null;
    const current = rec ? (rec.gender || '') : '';
    wrap.innerHTML =
      '<label>Gender</label>' +
      '<select id="vf_gender">' +
        '<option value=""' + (current === '' ? ' selected' : '') + '>—</option>' +
        '<option value="MALE"' + (current === 'MALE' ? ' selected' : '') + '>Male</option>' +
        '<option value="FEMALE"' + (current === 'FEMALE' ? ' selected' : '') + '>Female</option>' +
      '</select>';
    row.appendChild(wrap);
  }

  const origOpenVisa = window.openVisaForm;
  window.openVisaForm = function(visaId, prefillCaseId) {
    if (!window.EntV2815) window.EntV2815 = {};
    window.EntV2815._currentVisaId = visaId;
    const ret = origOpenVisa ? origOpenVisa.apply(this, arguments) : null;
    setTimeout(() => { try { injectGenderField(); } catch (e) { console.warn('[v2.8.15] gender:', e); } }, 350);
    return ret;
  };

  /* Hook save to persist gender */
  document.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('#vf_saveBtn');
    if (!saveBtn) return;
    setTimeout(() => {
      try {
        if (!window.DB) return;
        const genderEl = $('vf_gender');
        if (!genderEl) return;
        const gender = genderEl.value || '';
        const visaId = (window.EntV2815 && window.EntV2815._currentVisaId) ||
          (window.DB.visaRecords.length ? window.DB.visaRecords[window.DB.visaRecords.length - 1].id : null);
        if (!visaId) return;
        const rec = window.DB.visaRecords.find(v => v.id === visaId);
        if (rec && rec.gender !== gender) {
          rec.gender = gender;
          rec.updatedAt = new Date().toISOString();
          if (window.dbSave) window.dbSave();
          if (window.refreshVisaView) window.refreshVisaView();
        }
      } catch (e) { console.warn('[v2.8.15] gender save:', e); }
    }, 500);
  }, true);

  /* Schema migration v3 → v4: backfill gender = '' if missing */
  function migrateV4() {
    if (!window.DB || !window.DB.meta) return;
    if ((window.DB.meta.schemaVersion || 1) >= 4) return;
    (window.DB.visaRecords || []).forEach(v => { if (v.gender === undefined) v.gender = ''; });
    window.DB.meta.schemaVersion = 4;
    log('Schema migrated to v4 (adds gender)');
  }
  const origReady = window.onDatabaseReady;
  window.onDatabaseReady = function() {
    const r = origReady ? origReady.apply(this, arguments) : undefined;
    try { migrateV4(); } catch (e) { console.warn('[v2.8.15] migrate:', e); }
    return r;
  };
  setTimeout(() => { try { migrateV4(); } catch {} }, 2500);

  /* Force initial re-render so new columns show */
  setTimeout(() => {
    try { if (window.refreshVisaView) window.refreshVisaView(); }
    catch (e) { console.warn('[v2.8.15] initial refresh:', e); }
  }, 3000);

  console.log('%c📋 All Visa Records expanded v' + V + ' active', 'color:#2E6FA3;font-weight:bold;');
})();

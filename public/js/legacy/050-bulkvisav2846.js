
(function BulkVisaV2846(){
  'use strict';
  const V = '2.8.46';
  const $ = (id) => document.getElementById(id);
  const nowIso = () => new Date().toISOString();
  const log = (...a) => console.log('%c[v2.8.46]', 'color:#2E6FA3;font-weight:bold', ...a);
  const Toast = () => window.Toast || { ok:console.log, warn:console.warn, err:console.error, info:console.info };

  /* =========================================================
     1) Override downloadVisaTemplate with the exact 11 columns
     ========================================================= */
  window.downloadVisaTemplate = function() {
    if (typeof XLSX === 'undefined') {
      Toast().err('Excel library missing');
      return;
    }
    const headers = [
      'Visa Document Number',
      'Sponsor ID',
      'CR Number',
      'Company Name',
      'Nationality',
      'Gender',
      'Visa Category',
      'Client',
      'Status (Visa)',
      'QIWA Visa Date (Hijri, yyyy/mm/dd)',
      'Registered Agency Name',
    ];
    const sample = [
      '1304524234',
      '4001234567',
      '2050174515',
      'Safwat Al Khaleej Company',
      'FILIPINO',
      'MALE',
      'WELDER',
      'OSC',
      'ALLOCATED',
      '1447/07/01',
      'Greenearth Agency',
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    /* Set generous column widths */
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 3, 18) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Visa Records');
    XLSX.writeFile(wb, 'Visa_Bulk_Add_Template_v2.8.46.xlsx');
    log('Template downloaded');
  };

  /* =========================================================
     2) Update the alias map so any column name variant is recognized
     ========================================================= */
  if (window.BULK_VISA_ALIASES) {
    Object.assign(window.BULK_VISA_ALIASES, {
      visaDocumentNumber: ['visa document number', 'visa doc number', 'visa doc #', 'doc number'],
      sponsorId: ['sponsor id', 'sponsorid'],
      crNumber: ['cr number', 'crnumber', 'commercial registration', 'commercial registration number'],
      companyName: ['company name', 'company', 'companyname'],
      nationality: ['nationality'],
      gender: ['gender', 'sex'],
      visaCategory: ['visa category', 'category'],
      client: ['client'],
      statusVisa: ['status (visa)', 'status', 'visa status'],
      qiwaVisaDateHijri: ['qiwa visa date (hijri, yyyy/mm/dd)', 'qiwa visa date (hijri)', 'qiwa hijri date', 'hijri date', 'qiwa visa date hijri'],
      registeredAgencyName: ['registered agency name', 'agency name', 'agency'],
      /* Keep others available if user still uses the older template */
      fullName: ['full name', 'name'],
      passport: ['passport'],
    });
    log('BULK_VISA_ALIASES updated');
  }

  /* =========================================================
     3) Robust bulk-add executor
     ========================================================= */
  async function robustBulkAdd(records) {
    if (!window.DB) {
      Toast().err('No database open');
      return { added: 0, skipped: 0, errors: [] };
    }
    if (!Array.isArray(records) || records.length === 0) {
      Toast().warn('No records to add');
      return { added: 0, skipped: 0, errors: [] };
    }

    const idCounter = window.DB_ID_COUNTER || (typeof window.makeIdCounter === 'function' ? window.makeIdCounter(window.DB) : null);
    if (!idCounter) {
      Toast().err('ID counter unavailable');
      return { added: 0, skipped: 0, errors: [] };
    }

    let added = 0, skipped = 0;
    const errors = [];

    records.forEach((r, idx) => {
      try {
        /* Ensure every field has a safe default */
        const clean = {
          fullName: (r.fullName || '').trim(),
          passport: (r.passport || '').trim().toUpperCase(),
          nationality: (r.nationality || '').trim().toUpperCase(),
          gender: (r.gender || '').trim().toUpperCase(),
          client: (r.client || '').trim(),
          visaDocumentNumber: (r.visaDocumentNumber || '').trim(),
          visaNumber: (r.visaNumber || '').trim(),
          companyName: (r.companyName || '').trim(),
          visaCategory: (r.visaCategory || '').trim().toUpperCase(),
          crNumber: (r.crNumber || '').trim(),
          sponsorId: (r.sponsorId || '').trim(),
          statusVisa: (r.statusVisa || 'ALLOCATED').trim().toUpperCase(),
          qiwaVisaDate: r.qiwaVisaDate || null,
          expirationDate: r.expirationDate || null,
          candidateVisaDate: r.candidateVisaDate || null,
          candidateVisaExpiration: r.candidateVisaExpiration || null,
          registeredAgencyName: (r.registeredAgencyName || '').trim(),
          enjazAgencyName: (r.enjazAgencyName || '').trim(),
          visaDelegationNumber: (r.visaDelegationNumber || '').trim(),
          agencyDelegationNumber: (r.agencyDelegationNumber || '').trim(),
          ratifiedBy: (r.ratifiedBy || '').trim(),
          ratificationDate: r.ratificationDate || null,
          mofaApplicationNumber: (r.mofaApplicationNumber || '').trim(),
          stampingCity: (r.stampingCity || '').trim(),
          qiwaVisaDateHijri: (r.qiwaVisaDateHijri || '').trim(),
          notes: (r.notes || '').trim(),
        };

        /* Skip completely empty rows */
        if (!clean.fullName && !clean.visaDocumentNumber && !clean.passport) {
          skipped++;
          return;
        }

        /* Auto-compute Gregorian and expiration from Hijri if provided */
        if (clean.qiwaVisaDateHijri && window.Hijri) {
          try {
            const norm = clean.qiwaVisaDateHijri.replace(/[\/\.]/g, '-');
            if (/^\d{4}-\d{2}-\d{2}$/.test(norm)) {
              if (!clean.qiwaVisaDate) clean.qiwaVisaDate = window.Hijri.hijriIsoToGregorianIso(norm);
              if (!clean.expirationDate) clean.expirationDate = window.Hijri.addHijriYearsAsGregorianIso(norm, 2);
              /* Normalize storage format to slash */
              clean.qiwaVisaDateHijri = clean.qiwaVisaDateHijri.replace(/-/g, '/');
            }
          } catch (e) { /* silent */ }
        }

        /* Auto-derive sponsor from company name */
        if (typeof window.deriveSponsor === 'function') {
          try { clean.sponsor = window.deriveSponsor(clean.companyName); }
          catch { clean.sponsor = 'CLIENT'; }
        } else {
          clean.sponsor = /safwat/i.test(clean.companyName) ? 'SAFWAT' : 'CLIENT';
        }

        /* Build the record */
        const id = (typeof window.padId === 'function' ? window.padId('VR', idCounter.nextVisa++) : ('VR-' + String(idCounter.nextVisa++).padStart(6, '0')));
        const rec = {
          id: id,
          linkedRecruitmentCaseId: null,
          ...clean,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };

        window.DB.visaRecords.push(rec);
        added++;
      } catch (e) {
        errors.push('Row ' + (idx + 1) + ': ' + e.message);
      }
    });

    /* Persist */
    if (added > 0) {
      try {
        if (window.dbSave) await window.dbSave();
      } catch (e) {
        errors.push('Save error: ' + e.message);
      }
      /* Refresh views */
      if (window.refreshVisaView) try { window.refreshVisaView(); } catch {}
      if (window.refreshPipelineView) try { window.refreshPipelineView(); } catch {}
    }

    return { added, skipped, errors };
  }

  /* =========================================================
     4) Intercept "Add N visa records" button click
     ========================================================= */
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    /* The base app labels the confirm button with #bav_confirmBtn */
    if (btn.id !== 'bav_confirmBtn') return;

    e.preventDefault();
    e.stopImmediatePropagation();

    /* Read the parsed records */
    const parsedRecords = window._entParsedVisaRecords || window._bulkParsedVisaRecords;
    let records = parsedRecords;

    /* If not exposed, re-parse from the file/textarea */
    if (!records) {
      try {
        const mode = document.querySelector('input[name="bav_mode"]:checked')?.value;
        let rows = [];
        if (mode === 'upload') {
          const file = $('bav_fileInput')?.files?.[0];
          if (file && typeof window.readWorkbookFile === 'function') {
            const wb = await window.readWorkbookFile(file);
            rows = window.sheetToRows(wb.Sheets[wb.SheetNames[0]]);
          }
        } else {
          const text = $('bav_pasteArea')?.value;
          if (text && typeof window.parseDelimitedText === 'function') {
            rows = window.parseDelimitedText(text);
          }
        }
        if (rows.length && typeof window.parseBulkVisaRows === 'function') {
          const result = window.parseBulkVisaRows(rows);
          records = result.records;
        }
      } catch (err) {
        Toast().err('Re-parse failed', err.message);
        return;
      }
    }

    if (!records || !records.length) {
      Toast().err('No records to add');
      return;
    }

    btn.disabled = true;
    const origLabel = btn.textContent;
    btn.textContent = 'Adding…';

    const result = await robustBulkAdd(records);

    btn.disabled = false;
    btn.textContent = origLabel;

    if (result.added > 0) {
      Toast().ok('Added ' + result.added + ' visa record(s)',
                 result.skipped ? '(' + result.skipped + ' empty rows skipped)' : '');
      if (result.errors.length) {
        console.warn('[v2.8.46] Errors during bulk add:', result.errors);
      }
      /* Close modal */
      if (window.closeModal) window.closeModal();
    } else {
      Toast().err('No records added',
                  result.errors.length ? result.errors[0] : 'All rows were empty or invalid');
    }
    log('Bulk add complete: added=' + result.added + ', skipped=' + result.skipped + ', errors=' + result.errors.length);
  }, true);

  /* =========================================================
     5) Capture parsed records when Preview is clicked so we can
     access them at confirm time
     ========================================================= */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.id !== 'bav_previewBtn') return;

    /* Base app builds preview then stores parsed records somewhere; we
       poll the preview table for a moment to extract them via the
       existing state. Actually simpler: hook parseBulkVisaRows itself. */
    /* handled by hook below */
  }, true);

  const origParseBulkVisa = window.parseBulkVisaRows;
  if (typeof origParseBulkVisa === 'function') {
    window.parseBulkVisaRows = function(rows) {
      const result = origParseBulkVisa.apply(this, arguments);
      window._entParsedVisaRecords = result?.records || [];
      log('Captured ' + (result?.records?.length || 0) + ' parsed visa records');
      return result;
    };
  }

  console.log('%c📥 Bulk Visa Add fix + new template v' + V + ' active', 'color:#2E6FA3;font-weight:bold;');
})();

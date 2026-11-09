
(function SponsorAndEditFixV2911(){
  'use strict';
  const V = '2.9.11';
  const $ = (id) => document.getElementById(id);
  const nowIso = () => new Date().toISOString();
  const log = (...a) => console.log('%c[v2.9.11]', 'color:#2E6FA3;font-weight:bold', ...a);
  const Toast = () => window.Toast || { ok:console.log, warn:console.warn, err:console.error, info:console.info };

  /* =========================================================
     1) OFFICIAL SAFWAT IDENTIFIERS
     ========================================================= */
  const SAFWAT_CRS = new Set([
    '2050150966','2050174515','2050175179','2050173584',
    '2050188364','2050194273','2050195838','2050213913',
  ]);
  const SAFWAT_SIDS = new Set([
    '7026511431','7034826839','7033247748','7034591284',
    '7040392644','7041437737','7041760757','7043667661',
  ]);

  function normId(s){ return String(s == null ? '' : s).replace(/\s+/g,'').trim(); }

  /* THE rule: SAFWAT if CR# OR Sponsor ID matches the official list, else CLIENT */
  function deriveSponsor(crNumber, sponsorId){
    const cr = normId(crNumber);
    const sid = normId(sponsorId);
    if (SAFWAT_CRS.has(cr) || SAFWAT_SIDS.has(sid)) return 'SAFWAT';
    return 'CLIENT';
  }
  /* Expose globally so any other code path (bulk add/edit) can reuse it */
  window.deriveSponsor = deriveSponsor;
  window.SAFWAT_CRS = SAFWAT_CRS;
  window.SAFWAT_SIDS = SAFWAT_SIDS;

  /* Apply correct sponsor to a single visa record object */
  function fixRecordSponsor(rec){
    if (!rec) return false;
    const want = deriveSponsor(rec.crNumber, rec.sponsorId);
    if (rec.sponsor !== want){ rec.sponsor = want; return true; }
    return false;
  }

  /* =========================================================
     One-time sweep of ALL existing records so historical data
     is corrected to the CR/SID rule. Runs once per DB load.
     ========================================================= */
  let sweptForThisDb = false;
  function sweepAllSponsors(){
    if (!window.DB || !Array.isArray(window.DB.visaRecords)) return;
    if (sweptForThisDb) return;
    let changed = 0;
    window.DB.visaRecords.forEach(v => { if (fixRecordSponsor(v)) changed++; });
    sweptForThisDb = true;
    if (changed > 0){
      log('Sweep corrected sponsor on ' + changed + ' existing record(s)');
      if (window.dbSave) window.dbSave();
      if (window.refreshVisaView) try { window.refreshVisaView(); } catch {}
      if (window.refreshPipelineView) try { window.refreshPipelineView(); } catch {}
    } else {
      log('Sweep: all records already correct');
    }
  }
  /* Re-sweep whenever a fresh DB is loaded (detect by object identity) */
  let lastDbRef = null;
  setInterval(() => {
    if (window.DB && window.DB !== lastDbRef && Array.isArray(window.DB.visaRecords)){
      lastDbRef = window.DB;
      sweptForThisDb = false;
      setTimeout(sweepAllSponsors, 800);
    }
  }, 1500);

  /* =========================================================
     2) SINGLE-EDIT PERSISTENCE REPAIR
     ========================================================= */

  /* Track which visa is being edited (null = new record) */
  let currentVisaEditId = null;

  /* Wrap openVisaForm to (a) remember the edit id, (b) ensure the
     stampingCity + gender fields exist and are PRE-FILLED so a save
     that preserves current values doesn't wipe them. */
  function wrapOpenVisaForm(){
    const orig = window.openVisaForm;
    if (typeof orig !== 'function') return setTimeout(wrapOpenVisaForm, 500);
    if (orig._v2911) return;
    const wrapped = function(visaId, prefillCaseId){
      currentVisaEditId = visaId || null;
      const ret = orig.apply(this, arguments);
      setTimeout(() => ensureExtraFields(visaId), 120);
      setTimeout(() => ensureExtraFields(visaId), 400);
      return ret;
    };
    wrapped._v2911 = true;
    window.openVisaForm = wrapped;
    log('openVisaForm wrapped');
  }
  wrapOpenVisaForm();

  /* Ensure stampingCity + gender inputs exist and are pre-filled */
  function ensureExtraFields(visaId){
    const rec = (visaId && window.DB) ? window.DB.visaRecords.find(v => v.id === visaId) : null;

    /* Stamping City — place next to Nationality if missing */
    if (!$('vf_stampingCity')){
      const nat = $('vf_nationality');
      const anchor = nat ? nat.closest('.row, .field, div') : null;
      if (anchor && anchor.parentNode){
        const wrap = document.createElement('div');
        wrap.innerHTML = '<label>City (Stamping City)</label>' +
          '<input type="text" id="vf_stampingCity" placeholder="e.g. Riyadh">';
        anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
      }
    }
    /* Gender — place after stamping city if missing */
    if (!$('vf_gender')){
      const sc = $('vf_stampingCity');
      const anchor = sc ? sc.closest('div') : ($('vf_nationality') ? $('vf_nationality').closest('div') : null);
      if (anchor && anchor.parentNode){
        const wrap = document.createElement('div');
        wrap.innerHTML = '<label>Gender</label>' +
          '<select id="vf_gender"><option value="">—</option><option value="MALE">Male</option><option value="FEMALE">Female</option></select>';
        anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
      }
    }

    /* PRE-FILL from the record (this is what stops the wipe) */
    if (rec){
      const sc = $('vf_stampingCity'); if (sc && !sc.value) sc.value = rec.stampingCity || '';
      const g = $('vf_gender'); if (g && !g.value) g.value = rec.gender || '';
    }

    /* Live sponsor badge next to the sponsor/CR fields */
    updateSponsorBadge();
    const cr = $('vf_crNumber'), sid = $('vf_sponsorId');
    [cr, sid].forEach(el => {
      if (el && !el.dataset.v2911){
        el.dataset.v2911 = '1';
        el.addEventListener('input', updateSponsorBadge);
      }
    });
  }

  function updateSponsorBadge(){
    const cr = $('vf_crNumber') ? $('vf_crNumber').value : '';
    const sid = $('vf_sponsorId') ? $('vf_sponsorId').value : '';
    const sponsor = deriveSponsor(cr, sid);
    let badge = $('vf_sponsorBadge');
    /* Attach the badge near the Sponsor ID field label if possible */
    const host = ($('vf_sponsorId') || $('vf_crNumber'));
    if (host && !badge){
      badge = document.createElement('span');
      badge.id = 'vf_sponsorBadge';
      badge.className = 'ent-sponsor-badge ' + sponsor;
      badge.textContent = sponsor;
      const lbl = host.closest('div') ? host.closest('div').querySelector('label') : null;
      if (lbl) lbl.appendChild(badge); else if (host.parentNode) host.parentNode.appendChild(badge);
    }
    if (badge){ badge.className = 'ent-sponsor-badge ' + sponsor; badge.textContent = sponsor; }
  }

  /* =========================================================
     Save interceptor — capture values at click, re-apply after
     the base save completes. Covers BOTH the single visa form
     (#vf_saveBtn) and the unified add form (#v51_saveBtn).
     ========================================================= */
  document.addEventListener('click', function(e){
    const btn = e.target.closest('#vf_saveBtn, #v51_saveBtn');
    if (!btn) return;

    const isUnified = btn.id === 'v51_saveBtn';
    const P = isUnified ? 'v51_' : 'vf_';

    /* Capture NOW (capture phase = before base handler runs) */
    const captured = {
      isUnified,
      editId: isUnified ? null : currentVisaEditId,
      stampingCity: $(P + 'stampingCity') ? $(P + 'stampingCity').value.trim() : (($('vf_city')||{}).value || '').trim(),
      gender: $(P + 'gender') ? $(P + 'gender').value : '',
      crNumber: $(P + 'crNumber') ? $(P + 'crNumber').value.trim() : '',
      sponsorId: $(P + 'sponsorId') ? $(P + 'sponsorId').value.trim() : '',
      countBefore: (window.DB && window.DB.visaRecords) ? window.DB.visaRecords.length : 0,
    };

    /* Re-apply after the base save has run + record exists */
    setTimeout(() => reapplyExtras(captured), 350);
    setTimeout(() => reapplyExtras(captured), 900);   /* safety second pass */
  }, true);

  function reapplyExtras(cap){
    if (!window.DB || !Array.isArray(window.DB.visaRecords)) return;
    let rec = null;

    if (cap.editId){
      rec = window.DB.visaRecords.find(v => v.id === cap.editId);
    } else {
      /* New record: prefer one added after we captured; else last record */
      const list = window.DB.visaRecords;
      rec = list[list.length - 1] || null;
    }
    if (!rec) return;

    let changed = false;

    /* Stamping city — always set to captured value (fixes the wipe) */
    if (cap.stampingCity !== undefined){
      if (rec.stampingCity !== cap.stampingCity){ rec.stampingCity = cap.stampingCity; changed = true; }
    }
    /* Gender */
    if (cap.gender !== undefined && cap.gender !== ''){
      if (rec.gender !== cap.gender){ rec.gender = cap.gender; changed = true; }
    } else if (cap.gender === '' && rec.gender === undefined){
      rec.gender = ''; changed = true;
    }

    /* Sponsor auto-derivation from the record's CR/SID
       (use captured CR/SID if the record's own are blank) */
    const cr = rec.crNumber || cap.crNumber;
    const sid = rec.sponsorId || cap.sponsorId;
    const want = deriveSponsor(cr, sid);
    if (rec.sponsor !== want){ rec.sponsor = want; changed = true; }

    if (changed){
      rec.updatedAt = nowIso();
      if (window.dbSave) window.dbSave();
      if (window.refreshVisaView) try { window.refreshVisaView(); } catch {}
      if (window.refreshPipelineView) try { window.refreshPipelineView(); } catch {}
      log('Re-applied extras to ' + (rec.id||'(new)') + ' — city="' + (rec.stampingCity||'') + '", gender="' + (rec.gender||'') + '", sponsor=' + rec.sponsor);
    }
  }

  /* =========================================================
     Also patch bulk add + bulk edit paths (if present) so their
     sponsor is derived by the CR/SID rule, not left as CLIENT.
     ========================================================= */
  function patchBulkPaths(){
    /* parseBulkVisaRows result → set sponsor per row */
    const origParse = window.parseBulkVisaRows;
    if (typeof origParse === 'function' && !origParse._v2911){
      const wrapped = function(rows){
        const res = origParse.apply(this, arguments);
        if (res && Array.isArray(res.records)){
          res.records.forEach(r => { r.sponsor = deriveSponsor(r.crNumber, r.sponsorId); });
        }
        return res;
      };
      wrapped._v2911 = true;
      window.parseBulkVisaRows = wrapped;
      log('parseBulkVisaRows wrapped for sponsor derivation');
    }
  }
  setTimeout(patchBulkPaths, 800);
  setInterval(patchBulkPaths, 5000);

  /* Manual utility (console): re-derive every sponsor now */
  window._entResweepSponsors = function(){ sweptForThisDb = false; sweepAllSponsors(); };

  console.log('%c🏷 Sponsor auto-detect + single-edit fix v' + V + ' active', 'color:#2E6FA3;font-weight:bold;');
})();

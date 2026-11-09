
(function ApprovalPolicyV2852(){
  'use strict';
  const V = '2.8.52';
  const log = (...a) => console.log('%c[v2.8.52]', 'color:#8C6A22;font-weight:bold', ...a);
  const Toast = () => window.Toast || { ok:console.log, warn:console.warn, err:console.error, info:console.info };

  /* =========================================================
     FIX 1 — Session.can() must allow editors to delete
     ========================================================= */
  function patchSessionCan() {
    if (!window.Session) return setTimeout(patchSessionCan, 500);
    if (window.Session._v2852Patched) return;
    window.Session._v2852Patched = true;
    window.Session.can = function(op) {
      /* op: 'read' | 'edit' | 'delete' | 'bulk' | 'admin' */
      if (op === 'read') return true;
      if (this.role === 'viewer') return false;
      /* Editors can now edit, bulk, AND delete
         (deletes get queued by the approval interceptor) */
      if (op === 'edit' || op === 'bulk' || op === 'delete') {
        return this.role === 'editor' || this.role === 'admin';
      }
      if (op === 'admin') return this.role === 'admin';
      return true;
    };
    log('Session.can() patched — editors can now delete (will be queued)');
  }
  patchSessionCan();

  /* =========================================================
     FIX 2 — Approvals.shouldIntercept: only create + delete
     ========================================================= */
  function patchShouldIntercept() {
    if (!window.EntApprovals) return setTimeout(patchShouldIntercept, 500);
    if (window.EntApprovals._v2852Patched) return;
    window.EntApprovals._v2852Patched = true;
    window.EntApprovals.shouldIntercept = function(action) {
      if (!this.isRequired()) return false;
      if (!window.Session) return false;
      /* Only queue create + delete for editors.
         Update (edit) proceeds directly. */
      return window.Session.currentRole() === 'editor' && (action === 'create' || action === 'delete');
    };
    log('Approvals.shouldIntercept patched — only create + delete queued (edits free)');
  }
  patchShouldIntercept();

  /* =========================================================
     Enforcement watchdog — reapply patches if any other patch
     re-installs old Session.can or shouldIntercept
     ========================================================= */
  setInterval(() => {
    if (window.Session && !window.Session._v2852Patched) patchSessionCan();
    if (window.EntApprovals && !window.EntApprovals._v2852Patched) patchShouldIntercept();
  }, 3000);

  /* =========================================================
     Also patch the unified Add Visa (v2.8.51) so it uses
     the approval-aware add path instead of pushing directly
     to window.DB.visaRecords.
     ========================================================= */
  function patchUnifiedAddVisa() {
    if (!window._entOpenUnifiedAddVisa) return;
    if (window._entOpenUnifiedAddVisa._v2852Patched) return;

    /* Intercept the save click in the unified modal.
       If the user is an editor AND approvals are required,
       queue the batch instead of applying. */
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('#v51_saveBtn');
      if (!btn) return;
      if (!window.Session || window.Session.currentRole() !== 'editor') return;
      if (!window.EntApprovals || !window.EntApprovals.isRequired()) return;

      /* At this point v2.8.51's save handler is about to run.
         Rather than fight it, we intercept and route through the
         approval queue as a single "batch create" pending change. */
      e.preventDefault();
      e.stopImmediatePropagation();

      const qty = Math.max(1, Math.min(500, parseInt(document.getElementById('v51_qty').value, 10) || 1));
      const docNum = document.getElementById('v51_docNum').value.trim();
      const category = document.getElementById('v51_category').value.trim().toUpperCase();
      const nationality = document.getElementById('v51_nationality').value.trim().toUpperCase();

      if (!docNum || !category || !nationality) {
        Toast().err('Missing required fields', 'Visa Document Number, Visa Category, and Nationality are required.');
        return;
      }

      /* Build the shared payload just like v2.8.51 does */
      const hijriRaw = (document.getElementById('v51_qiwaHijri').value || '').trim();
      const hijriNorm = hijriRaw.replace(/[\/\.]/g, '-');
      const isValidHijri = /^\d{4}-\d{2}-\d{2}$/.test(hijriNorm);
      const shared = {
        visaDocumentNumber: docNum,
        sponsorId: document.getElementById('v51_sponsorId').value.trim(),
        crNumber: document.getElementById('v51_crNumber').value.trim(),
        requestNumber: document.getElementById('v51_requestNumber').value.trim(),
        visaCategory: category,
        nationality: nationality,
        stampingCity: document.getElementById('v51_city').value.trim(),
        gender: document.getElementById('v51_gender').value,
        client: document.getElementById('v51_client').value.trim(),
        registeredAgencyName: document.getElementById('v51_agency').value.trim(),
        qiwaVisaDateHijri: isValidHijri ? hijriRaw.replace(/-/g, '/') : '',
        qiwaVisaDate: isValidHijri && window.Hijri ? window.Hijri.hijriIsoToGregorianIso(hijriNorm) : '',
        expirationDate: isValidHijri && window.Hijri ? window.Hijri.addHijriYearsAsGregorianIso(hijriNorm, 2) : '',
        statusVisa: 'UNUSED',
      };

      /* Queue as ONE pending change with batch metadata */
      window.EntApprovals.queue(
        'create',
        'visaRecord',
        null,
        { batchQty: qty, shared: shared },
        [qty, shared],
        '_entBatchCreateVisas'
      );

      Toast().warn('Batch queued for approval', qty + ' record(s) awaiting admin review.');
      if (window.closeModal) window.closeModal();
    }, true);

    window._entOpenUnifiedAddVisa._v2852Patched = true;
    log('Unified Add Visa save handler intercepted');
  }
  setTimeout(patchUnifiedAddVisa, 1500);

  /* Register the batch-create-visas executor so the approval
     apply() can call it back */
  window._entBatchCreateVisas = function(qty, shared) {
    if (!window.DB) return;
    const idCounter = window.DB_ID_COUNTER || (typeof window.makeIdCounter === 'function' ? window.makeIdCounter(window.DB) : null);
    if (!idCounter) return;
    const nowIso = new Date().toISOString();
    for (let i = 0; i < qty; i++) {
      const id = (typeof window.padId === 'function' ? window.padId('VR', idCounter.nextVisa++) : ('VR-' + String(idCounter.nextVisa++).padStart(6, '0')));
      window.DB.visaRecords.push({
        id: id,
        linkedRecruitmentCaseId: null,
        fullName: '',
        passport: '',
        ...shared,
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
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
    if (window.dbSave) window.dbSave();
    if (window.refreshVisaView) try { window.refreshVisaView(); } catch {}
    log('Batch create executed: ' + qty + ' record(s)');
  };

  console.log('%c🔐 Approval policy (create+delete only) v' + V + ' active', 'color:#8C6A22;font-weight:bold;');
})();

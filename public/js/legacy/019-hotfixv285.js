
(function HotfixV285(){
  'use strict';
  const V = '2.8.5';
  const $ = (id) => document.getElementById(id);
  const log = (...a) => console.log('%c[v2.8.5]', 'color:#8C6A22;font-weight:bold', ...a);

  /**
   * Move v2.8.0's injected .ent-case-section to just above the
   * save/cancel button row. Idempotent — safe to call repeatedly.
   */
  function repositionSection() {
    const modalBody = document.querySelector('.modal-body');
    if (!modalBody) return false;

    const section = modalBody.querySelector('.ent-case-section');
    if (!section) return false;
    if (section.dataset.v285Repositioned) return true;   // already fixed

    // Find the save/cancel button row — it's the .btnrow that contains cf_saveBtn
    const saveBtn = $('cf_saveBtn');
    const btnRow = saveBtn ? saveBtn.closest('.btnrow') : null;

    if (btnRow && btnRow.parentNode === modalBody) {
      modalBody.insertBefore(section, btnRow);
      section.dataset.v285Repositioned = '1';
      log('Section moved to bottom (above save/cancel row)');
      return true;
    }

    // Fallback: if we can't find the btnrow, just append to end of modal-body
    if (saveBtn) {
      modalBody.insertBefore(section, saveBtn.parentNode || saveBtn);
      section.dataset.v285Repositioned = '1';
      log('Section moved (fallback path)');
      return true;
    }

    return false;
  }

  /**
   * Wrap openCaseForm so every open triggers the reposition
   * AFTER v2.8.0's setTimeout(100) has injected the section.
   */
  function wrapOpen() {
    const orig = window.openCaseForm;
    if (typeof orig !== 'function') return setTimeout(wrapOpen, 500);
    if (orig._v285) return;
    const wrapped = function() {
      const ret = orig.apply(this, arguments);
      // Run AFTER v2.8.0's setTimeout(100) — use 250ms to guarantee ordering
      setTimeout(() => { try { repositionSection(); } catch (e) { console.warn('[v2.8.5]', e); } }, 250);
      // And once more later, in case the modal took extra time to populate
      setTimeout(() => { try { repositionSection(); } catch {} }, 700);
      return ret;
    };
    wrapped._v285 = true;
    window.openCaseForm = wrapped;
    log('openCaseForm wrapped (v2.8.5)');
  }
  wrapOpen();

  console.log('%c✓ Agency section reposition v' + V + ' active', 'color:#8C6A22;font-weight:bold;');
})();

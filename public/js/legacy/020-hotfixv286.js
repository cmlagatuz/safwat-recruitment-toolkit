
(function HotfixV286(){
  'use strict';
  const V = '2.8.6';
  const $ = (id) => document.getElementById(id);
  const log = (...a) => console.log('%c[v2.8.6]', 'color:#8C6A22;font-weight:bold', ...a);

  function repositionSection() {
    // Search the WHOLE modal, not just modal-body
    const modal = document.querySelector('#modalOverlay') || document.querySelector('.modal') || document;
    const section = modal.querySelector('.ent-case-section');
    if (!section) return false;
    if (section.dataset.v286Positioned) return true;

    // Find where inside modal-body to place it
    const modalBody = modal.querySelector('.modal-body');
    if (!modalBody) return false;

    const saveBtn = modalBody.querySelector('#cf_saveBtn') || $('cf_saveBtn');
    if (!saveBtn) {
      // No save button found — append to end of modal-body
      modalBody.appendChild(section);
      section.dataset.v286Positioned = '1';
      log('Section appended to end of modal-body (no save btn found)');
      return true;
    }

    // Find the button row (the direct child of modal-body that contains the save button)
    let anchor = saveBtn;
    while (anchor && anchor.parentNode !== modalBody) {
      anchor = anchor.parentNode;
    }
    if (!anchor) {
      // Save button isn't a descendant of modal-body — fallback
      modalBody.appendChild(section);
      section.dataset.v286Positioned = '1';
      log('Section appended (save btn not in modal-body)');
      return true;
    }

    // Move section to just before the button row
    modalBody.insertBefore(section, anchor);
    section.dataset.v286Positioned = '1';
    log('Section moved into modal-body, just before save/cancel row');
    return true;
  }

  /* Wrap openCaseForm — run reposition AFTER v2.8.0's setTimeout(100) */
  function wrapOpen() {
    const orig = window.openCaseForm;
    if (typeof orig !== 'function') return setTimeout(wrapOpen, 500);
    if (orig._v286) return;
    const wrapped = function() {
      const ret = orig.apply(this, arguments);
      // Multiple retries in case DOM population is slow
      setTimeout(() => { try { repositionSection(); } catch (e) { console.warn('[v2.8.6]', e); } }, 300);
      setTimeout(() => { try { repositionSection(); } catch {} }, 700);
      setTimeout(() => { try { repositionSection(); } catch {} }, 1500);
      return ret;
    };
    wrapped._v286 = true;
    window.openCaseForm = wrapped;
    log('openCaseForm wrapped (v2.8.6)');
  }
  wrapOpen();

  console.log('%c✓ Section reposition v' + V + ' active', 'color:#8C6A22;font-weight:bold;');
})();

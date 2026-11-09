
(function GlobalApprovalV2853(){
  'use strict';
  const V = '2.8.53';
  const $ = (id) => document.getElementById(id);
  const log = (...a) => console.log('%c[v2.8.53]', 'color:#A23B2E;font-weight:bold', ...a);
  const Toast = () => window.Toast || { ok:console.log, warn:console.warn, err:console.error, info:console.info };

  const CONFIG_PATH = 'safwat/config/approvalRequired';

  /* Live cache of the flag — kept in sync with Firebase */
  let cachedFlag = false;
  let firebaseSubscribed = false;

  /* Subscribe to the RTDB flag; every user's session gets the same value */
  function subscribeFlag() {
    if (typeof firebase === 'undefined' || !firebase.database || !firebase.auth || !firebase.auth().currentUser) {
      return setTimeout(subscribeFlag, 500);
    }
    if (firebaseSubscribed) return;
    firebaseSubscribed = true;

    firebase.database().ref(CONFIG_PATH).on('value', (snap) => {
      const remote = !!snap.val();
      if (remote !== cachedFlag) {
        cachedFlag = remote;
        log('Approval requirement flag changed → ' + remote);
        /* Sync the checkbox UI */
        const chk = $('entApprovalRequired');
        if (chk) chk.checked = remote;
        /* Also mirror to localStorage so any legacy code path still works */
        try { localStorage.setItem('safwatEnt.approvalRequired', JSON.stringify(remote)); } catch {}
      }
    });
    log('Subscribed to RTDB approval flag');
  }

  /* Patch Approvals.isRequired() to read our cached flag */
  function patchIsRequired() {
    if (!window.EntApprovals) return setTimeout(patchIsRequired, 500);
    if (window.EntApprovals._v2853Patched) return;
    window.EntApprovals._v2853Patched = true;

    /* Read our shared cache instead of localStorage */
    window.EntApprovals.isRequired = function() {
      return cachedFlag;
    };

    /* Rewire setRequired to write to Firebase.
       Only admins should be able to change the flag — non-admins
       will get permission_denied from the RTDB rules. */
    const origSetRequired = window.EntApprovals.setRequired;
    window.EntApprovals.setRequired = async function(v) {
      /* Only allow admins to change the flag */
      if (window.Session && window.Session.currentRole() !== 'admin') {
        Toast().err('Admin only', 'Only admins can toggle approval requirement.');
        /* Revert the checkbox to the current value */
        const chk = $('entApprovalRequired');
        if (chk) chk.checked = cachedFlag;
        return;
      }
      try {
        await firebase.database().ref(CONFIG_PATH).set(!!v);
        cachedFlag = !!v;
        log('Wrote approval flag → ' + !!v);
        Toast().ok('Setting saved', v ? 'Approval required for all editors' : 'Approval no longer required');
        if (window.Audit && window.Audit.push) {
          window.Audit.push('security', 'settings', null, null, 'Global approval requirement = ' + !!v);
        }
        if (window.EntApprovals && window.EntApprovals.updateBadge) window.EntApprovals.updateBadge();
        if (window.EntUI && window.EntUI.updateQueueBadge) window.EntUI.updateQueueBadge();
      } catch (e) {
        Toast().err('Cannot save setting', e.message);
        const chk = $('entApprovalRequired');
        if (chk) chk.checked = cachedFlag;
      }
    };
    log('Approvals.isRequired / setRequired patched to use RTDB');
  }
  patchIsRequired();
  subscribeFlag();

  /* When the settings checkbox is toggled in the Approvals panel,
     make sure the write path is our patched version */
  function ensureCheckboxWired() {
    const chk = $('entApprovalRequired');
    if (!chk || chk.dataset.v2853Wired) return;
    chk.dataset.v2853Wired = '1';
    /* Clone the element to strip any existing listeners */
    const clone = chk.cloneNode(true);
    chk.parentNode.replaceChild(clone, chk);
    clone.checked = cachedFlag;
    clone.addEventListener('change', (e) => {
      if (window.EntApprovals && window.EntApprovals.setRequired) {
        window.EntApprovals.setRequired(e.target.checked);
      }
    });
    log('Checkbox rewired to RTDB-backed setRequired');
  }
  setInterval(ensureCheckboxWired, 2000);

  /* Re-apply enforcement on all patches every few seconds */
  setInterval(() => {
    if (window.EntApprovals && !window.EntApprovals._v2853Patched) patchIsRequired();
    subscribeFlag();
    ensureCheckboxWired();
  }, 5000);

  console.log('%c🌐 Global approval flag v' + V + ' active', 'color:#A23B2E;font-weight:bold;');
})();

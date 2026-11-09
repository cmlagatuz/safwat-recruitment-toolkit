
(function AccountApprovalV260(){
  'use strict';
  const V = '2.6.0';
  const $ = (id) => document.getElementById(id);
  const nowIso = () => new Date().toISOString();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const log = (...a) => console.log('%c[v2.6.0]', 'color:#B98A2E;font-weight:bold', ...a);
  const Toast = () => window.Toast || { ok:console.log, warn:console.warn, err:console.error, info:console.info };

  let waitingListener = null;

  /* =========================================================
     Show/hide gates
     ========================================================= */
  function showWaitingGate(email) {
    // Hide all other gates first
    ['entAuthGate','entVerifyGate','entDisabledGate','entRejectedGate'].forEach(id => $(id)?.classList.remove('open'));
    $('entWaitingEmail').textContent = email || '';
    $('entWaitingGate').classList.add('open');
    document.body.classList.remove('ent-authenticated');
  }
  function showRejectedGate(email, reason) {
    ['entAuthGate','entVerifyGate','entDisabledGate','entWaitingGate'].forEach(id => $(id)?.classList.remove('open'));
    $('entRejectedEmail').textContent = email || '';
    $('entRejectedReason').textContent = reason || 'Please contact your administrator for details.';
    $('entRejectedGate').classList.add('open');
    document.body.classList.remove('ent-authenticated');
  }
  function hideAllGates() {
    ['entWaitingGate','entRejectedGate'].forEach(id => $(id)?.classList.remove('open'));
  }

  /* =========================================================
     Wait until Firebase is fully ready (auth + database)
     ========================================================= */
  function whenFirebaseReady() {
    return new Promise(resolve => {
      const check = setInterval(() => {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length &&
            firebase.auth && firebase.database) {
          try { firebase.auth(); firebase.database(); clearInterval(check); resolve(); } catch {}
        }
      }, 300);
    });
  }

  /* =========================================================
     Master auth-state handler — REPLACES the one from v2.4.4
     ========================================================= */
  async function handleAuthState(user) {
    if (!user) {
      log('Signed out');
      hideAllGates();
      if (waitingListener) { try { waitingListener(); } catch {} waitingListener = null; }
      document.body.classList.remove('ent-authenticated');
      $('entAuthGate')?.classList.add('open');
      return;
    }
    log('Auth state: signed in as', user.email, '(uid:', user.uid + ')');

    try { await user.reload(); if (user.emailVerified) await user.getIdToken(true); } catch (e) { log('reload failed:', e.message); }

    // 1. Check if user has an approved account
    let userRec = null;
    try {
      const snap = await firebase.database().ref('safwat/users/' + user.uid).once('value');
      userRec = snap.val();
    } catch (e) { log('users/ read error:', e.message); }

    if (userRec) {
      log('Approved user, role:', userRec.role);
      if (userRec.disabled) {
        $('entDisabledGate')?.classList.add('open');
        document.body.classList.remove('ent-authenticated');
        setTimeout(() => firebase.auth().signOut(), 4000);
        return;
      }
      // Approved account → run existing flow (email verify + reveal)
      // Delegate back to v2.4.4's flow by ensuring EntRbac has our record
      hideAllGates();
      await runApprovedFlow(user, userRec);
      return;
    }

    // 2. No user record — check pending
    let pendingRec = null;
    try {
      const snap = await firebase.database().ref('safwat/pendingUsers/' + user.uid).once('value');
      pendingRec = snap.val();
    } catch (e) { log('pendingUsers/ read error:', e.message); }

    if (pendingRec) {
      if (pendingRec.status === 'rejected') {
        log('Account rejected');
        showRejectedGate(user.email, pendingRec.rejectionReason);
        return;
      }
      log('Pending approval');
      showWaitingGate(user.email);
      subscribeToApproval(user);
      return;
    }

    // The first admin is provisioned through Firebase Console/Admin SDK.
    // Browser accounts always request approval; rules prohibit self-bootstrap.

    // 4. Not first, not approved, not pending → create pending record
    log('Creating pending account request');
    try {
      await firebase.database().ref('safwat/pendingUsers/' + user.uid).set({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        requestedAt: nowIso(),
        status: 'pending',
      });
      showWaitingGate(user.email);
      subscribeToApproval(user);
      Toast().info('Request submitted', 'An admin will review your account shortly.');
    } catch (e) {
      log('Cannot create pending request:', e.message);
      showRejectedGate(user.email, 'Unable to submit account request: ' + e.message);
    }
  }

  /* =========================================================
     Subscribe to my own approval status while waiting
     ========================================================= */
  function subscribeToApproval(user) {
    if (waitingListener) { try { waitingListener(); } catch {} }
    const userRef = firebase.database().ref('safwat/users/' + user.uid);
    const pendingRef = firebase.database().ref('safwat/pendingUsers/' + user.uid);

    const userCb = userRef.on('value', async (snap) => {
      const rec = snap.val();
      if (rec) {
        log('Approval detected! Role:', rec.role);
        Toast().ok('Approved!', 'Role assigned: ' + rec.role);
        hideAllGates();
        await runApprovedFlow(user, rec);
      }
    });

    const pendingCb = pendingRef.on('value', (snap) => {
      const rec = snap.val();
      if (rec && rec.status === 'rejected') {
        showRejectedGate(user.email, rec.rejectionReason);
      }
    });

    waitingListener = () => { userRef.off('value', userCb); pendingRef.off('value', pendingCb); };
  }

  /* =========================================================
     After approval — mimic v2.4.4's post-auth flow
     ========================================================= */
  async function runApprovedFlow(user, rec) {
    // Update lastSeenAt (allowed by rules for own record)
    try {
      await firebase.database().ref('safwat/users/' + user.uid).update({
        lastSeenAt: nowIso(),
        emailVerified: !!user.emailVerified,
        displayName: user.displayName || rec.displayName,
      });
    } catch (e) { log('lastSeenAt update failed:', e.message); }

    // Sync into Session + EntRbac
    if (window.Session) {
      window.Session.role = rec.role;
      try { localStorage.setItem('safwatEnt.role', JSON.stringify(rec.role)); } catch {}
      window.Session.actor = (rec.displayName || user.email) + ' <' + user.email + '>';
      try { localStorage.setItem('safwatEnt.actor', JSON.stringify(window.Session.actor)); } catch {}
    }
    if (window.EntRbac) {
      window.EntRbac.myRecord = rec;
      window.EntRbac.myRef = firebase.database().ref('safwat/users/' + user.uid);
    }
    const pill = $('entRolePill');
    if (pill) pill.textContent = 'Role: ' + rec.role.charAt(0).toUpperCase() + rec.role.slice(1);
    const adminBtn = $('entOpenUserMgmt');
    if (adminBtn) adminBtn.style.display = rec.role === 'admin' ? 'inline-block' : 'none';

    // Email verification
    if (!user.emailVerified) {
      log('Approved but email not verified — showing verify gate');
      if ($('entVerifyEmail')) $('entVerifyEmail').textContent = user.email;
      $('entVerifyGate')?.classList.add('open');
      $('entAuthGate')?.classList.remove('open');
      try {
        const lastKey = 'safwatEnt.lastVerifyEmailAt';
        const last = parseInt(localStorage.getItem(lastKey) || '0', 10);
        if (Date.now() - last > 60000) {
          await user.sendEmailVerification();
          localStorage.setItem(lastKey, String(Date.now()));
          log('Verification email sent');
        }
      } catch (e) { log('sendVerification failed:', e.message); }
      return;
    }

    // All checks passed — reveal app
    document.body.classList.add('ent-authenticated');
    $('entAuthGate')?.classList.remove('open');
    log('✓ App revealed');
    Toast().ok('Welcome' + (rec.displayName ? ', ' + rec.displayName : ''), 'Role: ' + rec.role);
  }

  /* =========================================================
     Super-admin Approvals Queue — render account requests
     ========================================================= */
  const PendingRequests = {
    all: {},
    _listener: null,

    subscribe() {
      if (this._listener) return;
      const ref = firebase.database().ref('safwat/pendingUsers');
      const cb = ref.on('value', (snap) => {
        this.all = snap.val() || {};
        this.render();
        this.updateBadge();
      });
      this._listener = () => ref.off('value', cb);
    },

    updateBadge() {
      const pendingCount = Object.values(this.all).filter(u => u.status !== 'rejected').length;
      const badge = $('entQueueBadge');
      const countEl = $('entQueueCount');
      if (badge && countEl) {
        // Combine account requests + data change approvals
        const dataChanges = (window.EntApprovals && typeof window.EntApprovals.pendingCount === 'function')
          ? window.EntApprovals.pendingCount() : 0;
        const total = pendingCount + dataChanges;
        countEl.textContent = total;
        badge.classList.toggle('zero', total === 0);
      }
    },

    render() {
      const box = $('entApprovalsList');
      if (!box) return;
      const isAdmin = window.EntRbac && window.EntRbac.myRecord && window.EntRbac.myRecord.role === 'admin';
      if (!isAdmin) return;

      // Get pending (non-rejected) accounts
      const pending = Object.entries(this.all).filter(([_, u]) => u.status !== 'rejected');
      const rejected = Object.entries(this.all).filter(([_, u]) => u.status === 'rejected');

      // Remove existing section if any
      const existing = box.querySelector('.ent-account-requests-section');
      if (existing) existing.remove();

      const section = document.createElement('div');
      section.className = 'ent-account-requests-section';

      let html = '<h3>Account Requests (' + pending.length + ')</h3>';
      if (!pending.length) {
        html += '<div class="ent-account-requests-empty">No pending account requests.</div>';
      } else {
        pending.forEach(([uid, u]) => {
          html +=
            '<div class="ent-account-request" data-uid="' + esc(uid) + '">' +
              '<div class="ent-ar-head">' +
                '<span class="ent-ar-tag">◆ NEW ACCOUNT</span>' +
                '<span class="ent-ar-when">' + new Date(u.requestedAt || 0).toLocaleString() + '</span>' +
              '</div>' +
              '<div class="ent-ar-name">' + esc(u.displayName || '(no name)') + '</div>' +
              '<div class="ent-ar-email">' + esc(u.email || '') + '</div>' +
              '<div class="ent-ar-row">' +
                '<label>Assign role:</label>' +
                '<select class="ent-ar-role">' +
                  '<option value="viewer" selected>Viewer</option>' +
                  '<option value="editor">Editor</option>' +
                  '<option value="admin">Admin</option>' +
                '</select>' +
                '<button class="ent-ar-approve" data-approve="' + esc(uid) + '">Approve</button>' +
                '<button class="ent-ar-reject" data-reject="' + esc(uid) + '">Reject</button>' +
              '</div>' +
            '</div>';
        });
      }

      if (rejected.length) {
        html += '<div style="margin-top:14px;font-size:11px;color:#6B6558;font-family:\'IBM Plex Mono\',monospace;letter-spacing:.06em;text-transform:uppercase;">Rejected (' + rejected.length + ')</div>';
        rejected.forEach(([uid, u]) => {
          html +=
            '<div class="ent-account-request" style="border-left-color:#A23B2E;background:rgba(162,59,46,.04);">' +
              '<div class="ent-ar-name" style="opacity:.7;">' + esc(u.displayName || '(no name)') + ' — REJECTED</div>' +
              '<div class="ent-ar-email">' + esc(u.email || '') + '</div>' +
              '<div class="ent-ar-row">' +
                '<button class="ent-ar-reject" data-purge="' + esc(uid) + '">Purge from list</button>' +
              '</div>' +
            '</div>';
        });
      }

      section.innerHTML = html;
      box.insertBefore(section, box.firstChild);

      // Wire buttons
      section.querySelectorAll('[data-approve]').forEach(btn => {
        btn.addEventListener('click', () => {
          const uid = btn.dataset.approve;
          const card = btn.closest('.ent-account-request');
          const role = card.querySelector('.ent-ar-role').value;
          this.approve(uid, role);
        });
      });
      section.querySelectorAll('[data-reject]').forEach(btn => {
        btn.addEventListener('click', () => this.reject(btn.dataset.reject));
      });
      section.querySelectorAll('[data-purge]').forEach(btn => {
        btn.addEventListener('click', () => this.purge(btn.dataset.purge));
      });
    },

    async approve(uid, role) {
      const u = this.all[uid];
      if (!u) return Toast().err('Not found');
      if (!confirm('Approve ' + u.email + ' as ' + role.toUpperCase() + '?')) return;
      try {
        // 1. Create the user record
        await firebase.database().ref('safwat/users/' + uid).set({
          uid: uid,
          email: u.email,
          displayName: u.displayName || u.email.split('@')[0],
          role: role,
          disabled: false,
          emailVerified: false,
          createdAt: u.requestedAt || nowIso(),
          lastSeenAt: nowIso(),
          approvedBy: firebase.auth().currentUser.uid,
          approvedAt: nowIso(),
        });
        // 2. Delete pending record
        await firebase.database().ref('safwat/pendingUsers/' + uid).remove();
        Toast().ok('Approved', u.email + ' → ' + role);
        log('Approved', uid, 'as', role);
      } catch (e) {
        Toast().err('Approve failed', e.message);
      }
    },

    async reject(uid) {
      const u = this.all[uid];
      if (!u) return Toast().err('Not found');
      const reason = prompt('Reason for rejecting ' + u.email + '? (Optional — visible to the user)', '');
      if (reason === null) return;   // cancelled
      try {
        await firebase.database().ref('safwat/pendingUsers/' + uid).update({
          status: 'rejected',
          rejectionReason: reason || 'Rejected by administrator.',
          rejectedBy: firebase.auth().currentUser.uid,
          rejectedAt: nowIso(),
        });
        Toast().warn('Rejected', u.email);
        log('Rejected', uid);
      } catch (e) {
        Toast().err('Reject failed', e.message);
      }
    },

    async purge(uid) {
      const u = this.all[uid];
      if (!u) return;
      if (!confirm('Permanently remove ' + u.email + ' from the rejected list?\n\nNote: they can then sign in and re-submit an account request.')) return;
      try {
        await firebase.database().ref('safwat/pendingUsers/' + uid).remove();
        Toast().ok('Purged');
      } catch (e) {
        Toast().err('Purge failed', e.message);
      }
    },
  };
  window.EntPendingRequests = PendingRequests;

  /* =========================================================
     Wire gate buttons + boot
     ========================================================= */
  function wireGates() {
    $('entWaitingSignout')?.addEventListener('click', () => firebase.auth().signOut().then(() => window.location.reload()));
    $('entRejectedSignout')?.addEventListener('click', () => firebase.auth().signOut().then(() => window.location.reload()));

    // When the Approvals panel opens, subscribe to account requests
    const approvalsBtn = $('entOpenApprovals');
    if (approvalsBtn) {
      approvalsBtn.addEventListener('click', () => {
        setTimeout(() => PendingRequests.subscribe(), 500);
      });
    }
    // Also subscribe automatically for admins so the badge shows even without opening
    setTimeout(() => {
      if (window.EntRbac && window.EntRbac.myRecord && window.EntRbac.myRecord.role === 'admin') {
        PendingRequests.subscribe();
      }
    }, 3000);
  }

  async function boot() {
    log('Boot');
    await whenFirebaseReady();
    log('Firebase ready');

    // Wire our own onAuthStateChanged that OVERRIDES the earlier ones
    firebase.auth().onAuthStateChanged(handleAuthState);

    wireGates();

    // Re-check admin status periodically (in case admin logs in later)
    setInterval(() => {
      if (window.EntRbac && window.EntRbac.myRecord && window.EntRbac.myRecord.role === 'admin' && !PendingRequests._listener) {
        PendingRequests.subscribe();
      }
    }, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  console.log('%c🔒 Account approval flow v' + V + ' loaded', 'color:#B98A2E;font-weight:bold;');
})();

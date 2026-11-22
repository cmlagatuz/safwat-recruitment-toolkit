
(function AccountApprovalV260(){
  'use strict';
  const V = '2.6.0';
  const $ = (id) => document.getElementById(id);
  const nowIso = () => new Date().toISOString();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const log = (...a) => console.log('%c[v2.6.0]', 'color:#B98A2E;font-weight:bold', ...a);
  const Toast = () => window.Toast || { ok:console.log, warn:console.warn, err:console.error, info:console.info };

  // One gate owns sign-in, verification, approval and live authorization.
  // Firebase Authentication alone is not permission to open recruitment data.
  const ROLES = new Set(['viewer', 'editor', 'admin']);
  const GATES = ['entAuthGate', 'entVerifyGate', 'entDisabledGate', 'entWaitingGate', 'entRejectedGate', 'entAccessLoadingGate', 'entAccessErrorGate'];
  let epoch = 0;
  let waitingListener = null;
  let approvedListener = null;
  let welcomedUid = null;

  function dropListeners() {
    if (waitingListener) { waitingListener(); waitingListener = null; }
    if (approvedListener) { approvedListener(); approvedListener = null; }
  }

  function isCurrent(user, ticket) {
    const current = firebase.auth().currentUser;
    return ticket === epoch && current && user && current.uid === user.uid;
  }

  function resetAccess() {
    document.body.classList.remove('ent-authenticated');
    if (window.Session) { window.Session.role = null; window.Session.actor = ''; }
    if (window.EntRbac) { window.EntRbac.myRecord = null; window.EntRbac.myRef = null; }
    if (window.EntAuth && window.EntAuth.user) window.EntAuth.user.role = null;
    try { localStorage.removeItem('safwatEnt.role'); localStorage.removeItem('safwatEnt.actor'); } catch {}
    if ($('entOpenUserMgmt')) $('entOpenUserMgmt').style.display = 'none';
    if ($('entRolePill')) $('entRolePill').textContent = 'Role: —';
    if (window.EntPendingRequests) window.EntPendingRequests.unsubscribe();
  }

  function showGate(id) {
    GATES.forEach(gate => $(gate)?.classList.toggle('open', gate === id));
    if (id) document.body.classList.remove('ent-authenticated');
  }

  function showError(message) {
    dropListeners();
    resetAccess();
    $('entAccessErrorMessage').textContent = message || 'Unable to confirm your access. Please retry.';
    showGate('entAccessErrorGate');
  }

  function showRejected(email, reason) {
    $('entRejectedEmail').textContent = email || '';
    $('entRejectedReason').textContent = reason || 'Please contact your administrator for details.';
    showGate('entRejectedGate');
  }

  function showWaiting(email) {
    $('entWaitingEmail').textContent = email || '';
    showGate('entWaitingGate');
  }

  async function sendVerification(user, force = false) {
    if (user.emailVerified) return;
    const key = 'safwatEnt.lastVerifyEmailAt.' + user.uid;
    // Storage can be blocked in strict browser privacy modes or sandboxed embeds.
    // A storage error must never suppress the email verification process.
    let last = 0;
    try { last = Number(localStorage.getItem(key) || 0); } catch {}
    if (!force && Date.now() - last < 60000) return;
    await user.sendEmailVerification();
    try { localStorage.setItem(key, String(Date.now())); } catch {}
  }

  async function showVerification(user) {
    $('entVerifyEmail').textContent = user.email || '';
    showGate('entVerifyGate');
    try { await sendVerification(user); } catch (e) {
      // Keep the verification gate and allow the user to retry manually.
      log('Verification email could not be sent:', e.message);
      $('entVerifyMessage').textContent = 'We could not automatically send the link. Use Resend verification email.';
    }
  }

  function validRecord(rec) {
    return !!(rec && typeof rec === 'object' && ROLES.has(rec.role) && rec.disabled !== true);
  }

  function syncRecord(user, rec) {
    const actor = (rec.displayName || user.displayName || user.email) + ' <' + user.email + '>';
    if (window.Session) { window.Session.role = rec.role; window.Session.actor = actor; }
    if (window.EntRbac) {
      window.EntRbac.myRecord = rec;
      window.EntRbac.myRef = firebase.database().ref('safwat/users/' + user.uid);
    }
    if (window.EntAuth && window.EntAuth.user) window.EntAuth.user.role = rec.role;
    try {
      localStorage.setItem('safwatEnt.role', JSON.stringify(rec.role));
      localStorage.setItem('safwatEnt.actor', JSON.stringify(actor));
    } catch {}
    if ($('entRolePill')) $('entRolePill').textContent = 'Role: ' + rec.role.charAt(0).toUpperCase() + rec.role.slice(1);
    if ($('entOpenUserMgmt')) $('entOpenUserMgmt').style.display = rec.role === 'admin' ? 'inline-block' : 'none';
    if (window.EntPendingRequests) {
      if (rec.role === 'admin') window.EntPendingRequests.subscribe();
      else window.EntPendingRequests.unsubscribe();
    }
  }

  function subscribeApproved(user, ticket) {
    const ref = firebase.database().ref('safwat/users/' + user.uid);
    const onValue = snap => {
      if (!isCurrent(user, ticket)) return;
      const rec = snap.val();
      if (!validRecord(rec)) {
        dropListeners();
        resetAccess();
        if (rec && rec.disabled === true) showGate('entDisabledGate');
        else showError('Your account permissions were removed or are invalid. Contact an administrator.');
        return;
      }
      syncRecord(user, rec);
    };
    const onError = err => {
      if (isCurrent(user, ticket)) showError('Your access could not be revalidated (' + (err.code || 'connection error') + '). Retry to continue.');
    };
    ref.on('value', onValue, onError);
    approvedListener = () => ref.off('value', onValue);
  }

  function subscribePending(user, ticket) {
    const users = firebase.database().ref('safwat/users/' + user.uid);
    const pending = firebase.database().ref('safwat/pendingUsers/' + user.uid);
    const onUser = snap => {
      if (isCurrent(user, ticket) && snap.val()) void handleAuthState(user);
    };
    const onPending = snap => {
      if (isCurrent(user, ticket) && snap.val()?.status === 'rejected') void handleAuthState(user);
    };
    const onError = err => {
      if (isCurrent(user, ticket)) showError('Cannot monitor your approval status (' + (err.code || 'connection error') + '). Retry to continue.');
    };
    users.on('value', onUser, onError);
    pending.on('value', onPending, onError);
    waitingListener = () => { users.off('value', onUser); pending.off('value', onPending); };
  }

  async function runApprovedFlow(user, rec, ticket) {
    if (!isCurrent(user, ticket)) return;
    if (rec.disabled === true) { showGate('entDisabledGate'); return; }
    if (!validRecord(rec)) { showError('Your assigned role is invalid. Contact an administrator.'); return; }
    if (!user.emailVerified) { await showVerification(user); return; }

    syncRecord(user, rec);
    showGate(null);
    document.body.classList.add('ent-authenticated');
    subscribeApproved(user, ticket);
    if (welcomedUid !== user.uid) {
      welcomedUid = user.uid;
      Toast().ok('Welcome' + (rec.displayName ? ', ' + rec.displayName : ''), 'Role: ' + rec.role);
    }
    firebase.database().ref('safwat/users/' + user.uid).update({
      lastSeenAt: nowIso(), emailVerified: true
    }).catch(e => log('Last-seen update failed:', e.message));
  }

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

  async function handleAuthState(user) {
    const ticket = ++epoch;
    dropListeners();
    resetAccess();
    if (!user) {
      welcomedUid = null;
      showGate('entAuthGate');
      return;
    }
    showGate('entAccessLoadingGate');
    if (user.isAnonymous || !user.uid || !user.email) {
      showError('A verified email/password account is required. Sign out and sign in with your work account.');
      return;
    }
    try {
      await user.reload();
      if (!isCurrent(user, ticket)) return;
      if (user.emailVerified) await user.getIdToken(true);
      if (!isCurrent(user, ticket)) return;
    } catch (e) {
      if (isCurrent(user, ticket)) showError('Could not verify your sign-in or refresh your session. Check your connection and retry.');
      return;
    }

    let userRec;
    try {
      userRec = (await firebase.database().ref('safwat/users/' + user.uid).once('value')).val();
    } catch (e) {
      if (isCurrent(user, ticket)) showError('Unable to check your account permissions. Check your connection and retry.');
      return;
    }
    if (!isCurrent(user, ticket)) return;
    if (userRec) {
      await runApprovedFlow(user, userRec, ticket);
      return;
    }

    let pendingRec;
    try {
      pendingRec = (await firebase.database().ref('safwat/pendingUsers/' + user.uid).once('value')).val();
    } catch (e) {
      if (isCurrent(user, ticket)) showError('Unable to check your approval request. Check your connection and retry.');
      return;
    }
    if (!isCurrent(user, ticket)) return;
    if (pendingRec?.status === 'rejected') {
      showRejected(user.email, pendingRec.rejectionReason);
      return;
    }
    if (!pendingRec) {
      try {
        // Only this own-UID pending request is created. No browser-admin bootstrap.
        await firebase.database().ref('safwat/pendingUsers/' + user.uid).set({
          uid: user.uid, email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          requestedAt: nowIso(), status: 'pending'
        });
      } catch (e) {
        if (isCurrent(user, ticket)) showError('Could not submit your account approval request. Retry or contact an administrator.');
        return;
      }
      if (!isCurrent(user, ticket)) return;
      Toast().info('Account request submitted', 'An administrator must approve your access.');
    }

    if (!user.emailVerified) {
      await showVerification(user);
    } else {
      showWaiting(user.email);
      subscribePending(user, ticket);
    }
  }

  /* =========================================================
     Super-admin Approvals Queue — render account requests
     ========================================================= */
  const PendingRequests = {
    all: {},
    _listener: null,

    subscribe() {
      if (this._listener || !window.EntRbac?.myRecord || window.EntRbac.myRecord.role !== 'admin') return;
      const ref = firebase.database().ref('safwat/pendingUsers');
      const cb = snap => {
        this.all = snap.val() || {};
        this.render();
        this.updateBadge();
      };
      const err = e => { log('Admin request queue unavailable:', e.message); this.unsubscribe(); };
      ref.on('value', cb, err);
      this._listener = () => ref.off('value', cb);
    },

    unsubscribe() {
      if (this._listener) { this._listener(); this._listener = null; }
      this.all = {};
      this.updateBadge();
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
      if (!ROLES.has(role) || !firebase.auth().currentUser || window.EntRbac?.myRecord?.role !== 'admin') {
        return Toast().err('Only an active administrator may approve a valid role.');
      }
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
    const signout = () => firebase.auth().signOut();
    ['entWaitingSignout', 'entRejectedSignout', 'entVerifySignout', 'entDisabledSignout', 'entAccessErrorSignout']
      .forEach(id => $(id)?.addEventListener('click', signout));

    $('entAccessRetry')?.addEventListener('click', () => {
      const user = firebase.auth().currentUser;
      if (user) void handleAuthState(user);
      else showGate('entAuthGate');
    });
    $('entVerifyCheck')?.addEventListener('click', () => {
      const user = firebase.auth().currentUser;
      if (user) void handleAuthState(user);
    });
    $('entVerifyResend')?.addEventListener('click', async () => {
      const user = firebase.auth().currentUser;
      if (!user) return;
      const button = $('entVerifyResend');
      button.disabled = true;
      try {
        await sendVerification(user);
        $('entVerifyMessage').textContent = 'Verification email requested. Check your inbox and spam folder.';
      } catch (e) {
        $('entVerifyMessage').textContent = 'Could not send the verification email. Please retry later.';
      } finally {
        button.disabled = false;
      }
    });

    $('entOpenApprovals')?.addEventListener('click', () => {
      if (window.EntRbac?.myRecord?.role === 'admin') PendingRequests.subscribe();
    });
  }

  async function boot() {
    showGate('entAuthGate');
    await whenFirebaseReady();
    wireGates();
    firebase.auth().onAuthStateChanged(user => { void handleAuthState(user); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  console.log('%c🔒 Account approval flow v' + V + ' loaded', 'color:#B98A2E;font-weight:bold;');
})();

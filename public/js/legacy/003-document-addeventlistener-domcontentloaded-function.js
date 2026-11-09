
document.addEventListener('DOMContentLoaded', function(){
  'use strict';
  const V = '2.4.4';
  const $ = (id) => document.getElementById(id);
  const nowIso = () => new Date().toISOString();
  const log = (...a) => console.log('%c[v2.4.4]', 'color:#B98A2E;font-weight:bold', ...a);

  // Wait briefly for the base app + gates to be present in the DOM
  function waitForGates(cb, attempts) {
    attempts = attempts || 0;
    if ($('entAuthGate') || attempts > 40) return cb();
    setTimeout(() => waitForGates(cb, attempts + 1), 100);
  }

  waitForGates(() => {
    log('Gates present, attaching auth listener');

    // Restore the sign-in button if it was left in a "Loading Firebase…" state
    const primaryBtn = $('entAuthPrimary');
    if (primaryBtn && (primaryBtn.disabled || /loading/i.test(primaryBtn.textContent))) {
      primaryBtn.disabled = false;
      primaryBtn.textContent = 'Sign in';
    }
    const authGate = $('entAuthGate');
    if (authGate) authGate.classList.remove('ent-loading');

    // Attach a fresh auth-state listener that DOES reveal the app
    firebase.auth().onAuthStateChanged(async function(user){
      if (!user) {
        log('Signed out');
        document.body.classList.remove('ent-authenticated');
        if (authGate) { authGate.classList.add('open'); }
        return;
      }
      log('Auth state: signed in as', user.email);

      // Force fresh user object
      try { await user.reload(); if (user.emailVerified) await user.getIdToken(true); } catch (e) { log('reload failed:', e.message); }
      const u = firebase.auth().currentUser;

      // 1. Email verification check
      if (!u.emailVerified) {
        log('Email not verified — showing verify gate');
        document.body.classList.remove('ent-authenticated');
        if ($('entVerifyEmail')) $('entVerifyEmail').textContent = u.email;
        if ($('entVerifyGate')) $('entVerifyGate').classList.add('open');
        if (authGate) authGate.classList.remove('open');
        // Send verification if not sent recently
        try {
          const last = parseInt(localStorage.getItem('safwatEnt.lastVerifyEmailAt') || '0', 10);
          if (Date.now() - last > 60000) {
            await u.sendEmailVerification();
            localStorage.setItem('safwatEnt.lastVerifyEmailAt', String(Date.now()));
            log('Verification email sent');
          }
        } catch (e) { log('sendVerification failed:', e.message); }
        return;
      }

      // 2. RBAC — read own record, bootstrap if missing
      let rec = null;
      try {
        const ref = firebase.database().ref('safwat/users/' + u.uid);
        const snap = await ref.once('value');
        rec = snap.val();

        if (!rec) {
          // Approval is handled by the pending-user flow. Never invent a local role.
          document.body.classList.remove('ent-authenticated');
          return;
        } else {
          // Update lastSeenAt (best-effort, non-fatal)
          try { await ref.update({ lastSeenAt: nowIso(), emailVerified: true }); } catch {}
          log('RBAC record loaded — role:', rec.role);
        }

        // If disabled, block
        if (rec.disabled) {
          log('Account disabled');
          document.body.classList.remove('ent-authenticated');
          if ($('entDisabledGate')) $('entDisabledGate').classList.add('open');
          setTimeout(() => firebase.auth().signOut(), 4000);
          return;
        }

        // Sync role into Session module
        if (window.Session) {
          window.Session.role = rec.role;
          try { localStorage.setItem('safwatEnt.role', JSON.stringify(rec.role)); } catch {}
          window.Session.actor = (rec.displayName || u.email) + ' <' + u.email + '>';
          try { localStorage.setItem('safwatEnt.actor', JSON.stringify(window.Session.actor)); } catch {}
        }
        if (window.EntRbac) {
          window.EntRbac.myRecord = rec;
          window.EntRbac.myRef = ref;
        } else {
          // Provide a minimal EntRbac so admin UI can still work
          window.EntRbac = window.EntRbac || {
            myRecord: rec,
            myRef: ref,
            _amAdmin() { return rec && rec.role === 'admin'; },
            _myUid() { return u.uid; },
            _usersRef() { return firebase.database().ref('safwat/users'); },
            listAll: async function() { const s = await firebase.database().ref('safwat/users').once('value'); return s.val() || {}; },
            setRole: async function(uid, r) {
              if (!['viewer','editor','admin'].includes(r)) return;
              await firebase.database().ref('safwat/users/' + uid).update({ role: r, updatedAt: nowIso(), updatedBy: u.uid });
              if (window.Toast) window.Toast.ok('Role updated');
            },
            setDisabled: async function(uid, d) {
              await firebase.database().ref('safwat/users/' + uid).update({ disabled: !!d, updatedAt: nowIso(), updatedBy: u.uid });
              if (window.Toast) window.Toast.ok(d ? 'User disabled' : 'User enabled');
            },
            deleteUserRecord: async function(uid) {
              if (uid === u.uid) return;
              if (!confirm('Delete RBAC record for ' + uid + '?')) return;
              await firebase.database().ref('safwat/users/' + uid).remove();
              if (window.Toast) window.Toast.ok('User record deleted');
            },
          };
        }

        // Update role pill in top strip
        const pill = $('entRolePill');
        if (pill) pill.textContent = 'Role: ' + rec.role.charAt(0).toUpperCase() + rec.role.slice(1);

        // Show/hide admin Users button
        const adminBtn = $('entOpenUserMgmt');
        if (adminBtn) adminBtn.style.display = rec.role === 'admin' ? 'inline-block' : 'none';

        // Subscribe to live role/disabled updates
        ref.on('value', function(s){
          const r = s.val();
          if (!r) return;
          if (r.disabled) {
            if ($('entDisabledGate')) $('entDisabledGate').classList.add('open');
            document.body.classList.remove('ent-authenticated');
            setTimeout(() => firebase.auth().signOut(), 4000);
            return;
          }
          if (window.Session && window.Session.role !== r.role) {
            window.Session.role = r.role;
            try { localStorage.setItem('safwatEnt.role', JSON.stringify(r.role)); } catch {}
            const p = $('entRolePill');
            if (p) p.textContent = 'Role: ' + r.role.charAt(0).toUpperCase() + r.role.slice(1);
            const ab = $('entOpenUserMgmt');
            if (ab) ab.style.display = r.role === 'admin' ? 'inline-block' : 'none';
            if (window.Toast) window.Toast.info('Role updated', 'You are now: ' + r.role);
          }
          if (window.EntRbac) window.EntRbac.myRecord = r;
        });
      } catch (e) {
        log('RBAC error:', e.message);
        document.body.classList.remove('ent-authenticated');
        if (authGate) authGate.classList.add('open');
        return;
      }

      // 3. REVEAL THE APP — this is the definitive step
      document.body.classList.add('ent-authenticated');
      if (authGate) authGate.classList.remove('open');
      log('✓ App revealed');
      if (window.Toast) window.Toast.ok('Welcome' + (rec && rec.displayName ? ', ' + rec.displayName : ''), 'Signed in');
    });
  });
});

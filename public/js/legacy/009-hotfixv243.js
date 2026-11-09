
(function HotfixV243(){
  'use strict';
  const V = '2.4.3';
  const $ = (id) => document.getElementById(id);
  const nowIso = () => new Date().toISOString();
  const log = (...a) => console.log('%c[v2.4.3]', 'color:#B98A2E;font-weight:bold', ...a);
  const warn = (...a) => console.warn('%c[v2.4.3]', 'color:#8C6A22', ...a);

  // Give v2.4.1's normal flow 5 seconds. If body still has no
  // .ent-authenticated class after that, take over.
  let takingOver = false;
  const rescueTimer = setTimeout(() => {
    if (document.body.classList.contains('ent-authenticated')) return;
    if (typeof firebase === 'undefined' || !firebase.auth) {
      warn('Firebase not ready yet — skipping rescue');
      return;
    }
    const u = firebase.auth().currentUser;
    if (!u) { log('No signed-in user, nothing to rescue'); return; }
    log('Rescue: signed-in user exists but app is hidden — taking over');
    takingOver = true;
    forceReveal(u);
  }, 5000);

  async function forceReveal(fbUser) {
    // 1. Force-refresh user (in case emailVerified stale)
    try { await fbUser.reload(); } catch (e) { warn('reload failed:', e.message); }
    const u = firebase.auth().currentUser;

    const verifyGate = $('entVerifyGate');
    if (!u || u.isAnonymous || !u.emailVerified) {
      document.body.classList.remove('ent-authenticated');
      if (u && !u.isAnonymous && verifyGate) verifyGate.classList.add('open');
      return;
    }
    await u.getIdToken(true);
    if (verifyGate) verifyGate.classList.remove('open');

    // 3. Ensure RBAC record exists (bootstrap if missing)
    if (firebase.database) {
      try {
        const ref = firebase.database().ref('safwat/users/' + u.uid);
        let snap = await ref.once('value');
        let rec = snap.val();
        if (!rec) {
          document.body.classList.remove('ent-authenticated');
          return; // Pending-user flow handles approval; no rescue role is invented.
        } else {
          // Sync latest
          try { await ref.update({ lastSeenAt: nowIso(), emailVerified: !!u.emailVerified }); } catch {}
        }

        // Populate Session + EntRbac
        if (rec.disabled) {
          log('Account disabled — showing disabled gate');
          $('entDisabledGate')?.classList.add('open');
          setTimeout(() => firebase.auth().signOut(), 4000);
          return;
        }
        if (window.EntRbac) {
          window.EntRbac.myRecord = rec;
          window.EntRbac.myRef = ref;
        }
        if (window.Session) {
          window.Session.role = rec.role;
          try { localStorage.setItem('safwatEnt.role', JSON.stringify(rec.role)); } catch {}
          window.Session.actor = rec.displayName + ' <' + rec.email + '>';
          try { localStorage.setItem('safwatEnt.actor', JSON.stringify(window.Session.actor)); } catch {}
        }
        const pill = $('entRolePill');
        if (pill) pill.textContent = 'Role: ' + rec.role.charAt(0).toUpperCase() + rec.role.slice(1);
        const adminBtn = $('entOpenUserMgmt');
        if (adminBtn) adminBtn.style.display = rec.role === 'admin' ? 'inline-block' : 'none';

        // Subscribe to role changes
        ref.on('value', (s) => {
          const r = s.val();
          if (!r) return;
          if (r.disabled) {
            $('entDisabledGate')?.classList.add('open');
            document.body.classList.remove('ent-authenticated');
            setTimeout(() => firebase.auth().signOut(), 4000);
            return;
          }
          if (window.EntRbac) window.EntRbac.myRecord = r;
          if (window.Session && window.Session.role !== r.role) {
            window.Session.role = r.role;
            try { localStorage.setItem('safwatEnt.role', JSON.stringify(r.role)); } catch {}
            const p = $('entRolePill');
            if (p) p.textContent = 'Role: ' + r.role.charAt(0).toUpperCase() + r.role.slice(1);
            const ab = $('entOpenUserMgmt');
            if (ab) ab.style.display = r.role === 'admin' ? 'inline-block' : 'none';
          }
        });
      } catch (e) {
        warn('RBAC subsystem failed:', e.message);
        document.body.classList.remove('ent-authenticated');
        return;
      }
    }

    // 4. REVEAL THE APP — this is the whole point
    document.body.classList.add('ent-authenticated');
    $('entAuthGate')?.classList.remove('open');
    log('✓ App revealed for', u.email);

    // 5. Show a toast if the enterprise toast system is available
    if (window.Toast && window.Toast.ok) {
      window.Toast.ok('Welcome, ' + (u.displayName || u.email.split('@')[0]), 'Signed in via rescue path');
    }
  }

  // Also listen for future sign-ins directly (bypass v2.4.1's listener chain)
  function attachListener() {
    if (typeof firebase === 'undefined' || !firebase.auth) return setTimeout(attachListener, 500);
    try {
      firebase.auth().onAuthStateChanged(async (u) => {
        if (!u) {
          document.body.classList.remove('ent-authenticated');
          clearTimeout(rescueTimer);
          return;
        }
        // If already authenticated, do nothing extra
        if (document.body.classList.contains('ent-authenticated')) return;
        // Give v2.4.1's flow a 3-second head start, then force reveal
        setTimeout(() => {
          if (!document.body.classList.contains('ent-authenticated')) {
            log('Sign-in detected but app not revealed after 3s — force-revealing');
            forceReveal(u);
          }
        }, 3000);
      });
    } catch (e) { setTimeout(attachListener, 500); }
  }
  attachListener();

  console.log('%c🚨 Emergency reveal hotfix v' + V + ' armed', 'color:#A23B2E;font-weight:bold;');
})();

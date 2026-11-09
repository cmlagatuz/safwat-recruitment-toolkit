

/* =========================================================
   ENTERPRISE LAYER v2.2.0 — RUNTIME EXTENSIONS
   Adds: Firebase Auth (email/password), Field-level record locks
   ========================================================= */

(function EnterpriseV22(){
'use strict';

const V22 = '2.2.0';
const $ = (id) => document.getElementById(id);
const nowIso = () => new Date().toISOString();
const uid = () => 'e_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const lsGet = (k, d) => { try { const v = localStorage.getItem('safwatEnt.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem('safwatEnt.' + k, JSON.stringify(v)); } catch {} };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const Toast = window.Toast || { ok: console.log, warn: console.warn, err: console.error, info: console.info };

/* =========================================================
   1) FIREBASE AUTHENTICATION (Email/Password)
   ========================================================= */
const Auth = {
  user: null,        // { uid, email, displayName, role }
  mode: 'signin',    // signin | signup
  ready: false,
  authInstance: null,

  async ensureSdk() {
    // Load auth SDK if not present
    if (typeof firebase !== 'undefined' && firebase.auth) return;
    // Wait for Sync to have loaded the app SDK first
    if (typeof firebase === 'undefined') {
      // Explicitly load the app SDK too
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js';
        s.onload = resolve; s.onerror = () => reject(new Error('Failed to load firebase-app'));
        document.head.appendChild(s);
      });
    }
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js';
      s.onload = resolve; s.onerror = () => reject(new Error('Failed to load firebase-auth'));
      document.head.appendChild(s);
    });
  },

  async init() {
    try {
      await this.ensureSdk();
      // Reuse the Firebase app initialized by Sync if it exists; otherwise init with embedded config.
      let app;
      if (!firebase.apps.length) {
        const cfg = (typeof EMBEDDED_FB_CONFIG !== 'undefined') ? EMBEDDED_FB_CONFIG : (lsGet('fbConfig', null));
        if (!cfg) throw new Error('No Firebase config available');
        app = firebase.initializeApp(cfg);
      } else {
        app = firebase.app();
      }
      this.authInstance = firebase.auth();
      await this.authInstance.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

      this.authInstance.onAuthStateChanged(async (user) => {
        if (user) {
          this.user = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
            role: lsGet('role', 'viewer'),
          };
          // Persist actor into Session so audit log & presence pick up the real identity
          if (window.Session) {
            window.Session.actor = this.user.displayName + ' <' + this.user.email + '>';
            lsSet('actor', window.Session.actor);
          }
          UI.hideGate();
          UI.renderUserPill();
          window.Audit && window.Audit.push('security', 'auth', null, null, 'Signed in: ' + user.email);
          Toast.ok('Signed in', 'Welcome, ' + this.user.displayName);
        } else {
          this.user = null;
          UI.showGate();
          UI.renderUserPill();
        }
      });
      this.ready = true;
    } catch (e) {
      console.warn('Auth init failed:', e);
      Toast.err('Auth init failed', e.message + ' — app remains usable in offline mode');
      // Don't block the app if auth is unavailable; skip the gate
      UI.hideGate();
    }
  },

  async signIn(email, pass) {
    try {
      await this.authInstance.signInWithEmailAndPassword(email, pass);
      return true;
    } catch (e) {
      return { error: this._friendly(e) };
    }
  },

  async signUp(email, pass, displayName) {
    try {
      const cred = await this.authInstance.createUserWithEmailAndPassword(email, pass);
      if (displayName && cred.user) await cred.user.updateProfile({ displayName: displayName });
      return true;
    } catch (e) {
      return { error: this._friendly(e) };
    }
  },

  async signOut() {
    try {
      const email = this.user ? this.user.email : '';
      // Release any locks I hold before signing out
      Locks.releaseAllMine();
      await this.authInstance.signOut();
      window.Audit && window.Audit.push('security', 'auth', null, null, 'Signed out: ' + email);
      Toast.info('Signed out');
    } catch (e) {
      Toast.err('Sign-out failed', e.message);
    }
  },

  async resetPassword(email) {
    if (!email) return { error: 'Enter your email first.' };
    try {
      await this.authInstance.sendPasswordResetEmail(email);
      return true;
    } catch (e) {
      return { error: this._friendly(e) };
    }
  },

  _friendly(err) {
    const code = err && err.code ? err.code : '';
    const map = {
      'auth/invalid-email': 'That email address looks invalid.',
      'auth/user-not-found': 'No account found with that email. Try creating one.',
      'auth/wrong-password': 'Incorrect password. Try again or reset it.',
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/email-already-in-use': 'That email is already registered. Sign in instead.',
      'auth/weak-password': 'Password must be at least 6 characters (recommend 8+).',
      'auth/network-request-failed': 'Network issue. Check your connection.',
      'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
      'auth/user-disabled': 'This account has been disabled by an admin.',
    };
    return map[code] || (err.message || 'Authentication failed.');
  },
};
window.EntAuth = Auth;

/* =========================================================
   2) FIELD-LEVEL RECORD LOCKS
   Uses Firebase RTDB at safwat/locks/{dbName}/{recordId}
   Lock schema: { uid, name, email, since, expires, sessionId }
   Auto-refreshes every 20s while modal is open.
   Auto-expires after 90s of no refresh (heartbeat).
   ========================================================= */
const Locks = {
  LOCK_TTL_MS: 90000,
  HEARTBEAT_MS: 20000,
  currentLock: null,   // { recordId, entity, timerId }
  remoteLocks: {},     // { recordId: lockObj }
  _listenerRef: null,

  ready() { return window.EntSync && window.EntSync.fb && window.EntSync.status === 'connected'; },

  _locksRef() {
    if (!this.ready()) return null;
    const nodeName = (window.DB_FILE_NAME || 'main').replace(/\.json$/i, '').replace(/[^\w-]/g, '_');
    return window.EntSync.fb.ref('safwat/locks/' + nodeName);
  },

  startListener() {
    const ref = this._locksRef();
    if (!ref) return;
    if (this._listenerRef) this._listenerRef.off();
    this._listenerRef = ref;
    ref.on('value', snap => {
      const all = snap.val() || {};
      // Filter expired locks
      const now = Date.now();
      this.remoteLocks = {};
      Object.entries(all).forEach(([recId, lk]) => {
        if (lk && lk.expires && lk.expires > now) this.remoteLocks[recId] = lk;
      });
      UI.updateLockIndicators();
    });
  },

  stopListener() {
    if (this._listenerRef) { this._listenerRef.off(); this._listenerRef = null; }
    this.remoteLocks = {};
  },

  /**
   * Try to acquire a lock for the given record.
   * Returns: { acquired: true } or { acquired: false, heldBy: {name,email,since} }
   */
  async acquire(recordId, entity) {
    if (!this.ready()) return window._entCloudMode ? { acquired: false, error: 'Cloud locks are unavailable.' } : { acquired: true, offline: true };   // no sync — no locking
    if (!Auth.user) return { acquired: false, error: 'Sign in before editing.' };

    const ref = this._locksRef().child(recordId);
    // Use transaction to prevent race conditions
    try {
      const result = await ref.transaction(current => {
        const now = Date.now();
        // If existing lock is fresh AND held by someone else, abort
        if (current && current.expires > now && current.uid !== Auth.user.uid) {
          return; // abort transaction
        }
        // Otherwise take/refresh the lock
        return {
          uid: Auth.user.uid,
          name: Auth.user.displayName,
          email: Auth.user.email,
          since: (current && current.uid === Auth.user.uid) ? current.since : now,
          expires: now + this.LOCK_TTL_MS,
          sessionId: window.EntSync.sessionId,
          entity: entity,
        };
      });
      if (!result.committed) {
        // Someone else holds it
        const snap = await ref.once('value');
        const heldBy = snap.val();
        return { acquired: false, heldBy: heldBy };
      }
      // Success — set up heartbeat
      this.currentLock = { recordId, entity, timerId: null };
      this.currentLock.timerId = setInterval(() => this._heartbeat(recordId), this.HEARTBEAT_MS);
      // Also remove lock if the tab is closed
      ref.onDisconnect().remove();
      // Update presence to reflect what I'm editing
      window.EntSync.setEditingRecord(recordId);
      return { acquired: true };
    } catch (e) {
      console.warn('Lock acquire error', e);
      return { acquired: false, error: e.message };  // do not edit when ownership cannot be verified
    }
  },

  async _heartbeat(recordId) {
    if (!this.ready() || !Auth.user) return;
    const ref = this._locksRef().child(recordId);
    try {
      await ref.transaction(current => {
        if (!current || current.uid !== Auth.user.uid) return; // abort — no longer mine
        return { ...current, expires: Date.now() + this.LOCK_TTL_MS };
      });
    } catch {}
  },

  async release(recordId) {
    if (!this.ready() || !Auth.user) return;
    const ref = this._locksRef().child(recordId);
    try {
      await ref.transaction(current => {
        if (!current || current.uid !== Auth.user.uid) return; // don't clobber other people's locks
        return null;  // delete
      });
    } catch {}
    if (this.currentLock && this.currentLock.recordId === recordId) {
      if (this.currentLock.timerId) clearInterval(this.currentLock.timerId);
      this.currentLock = null;
    }
    // Clear editing indicator in presence
    if (window.EntSync) window.EntSync.setEditingRecord(null);
  },

  async releaseAllMine() {
    if (!this.ready() || !Auth.user) return;
    const ref = this._locksRef();
    try {
      const snap = await ref.once('value');
      const all = snap.val() || {};
      const updates = {};
      Object.entries(all).forEach(([id, lk]) => {
        if (lk && lk.uid === Auth.user.uid) updates[id] = null;
      });
      if (Object.keys(updates).length) await ref.update(updates);
    } catch {}
    if (this.currentLock && this.currentLock.timerId) clearInterval(this.currentLock.timerId);
    this.currentLock = null;
  },

  /** Force-take a lock (admin only, for stale/abandoned records) */
  async forceOverride(recordId, entity) {
    if (!window.Session.can('admin')) { Toast.err('Admin only'); return; }
    if (!confirm('Force-override lock on ' + recordId + '?\n\nThe other user will lose their unsaved changes.')) return;
    const ref = this._locksRef().child(recordId);
    const prev = (await ref.once('value')).val();
    await ref.set({
      uid: Auth.user.uid, name: Auth.user.displayName, email: Auth.user.email,
      since: Date.now(), expires: Date.now() + this.LOCK_TTL_MS,
      sessionId: window.EntSync.sessionId, entity: entity, forced: true,
    });
    window.Audit && window.Audit.push('security', entity, null, null, 'FORCE-OVERRIDE lock on ' + recordId + ' (was held by ' + (prev ? prev.name : '?') + ')');
    Toast.warn('Lock override', 'You now hold ' + recordId);
    // Re-open the record
    if (entity === 'recruitmentCase' && typeof openCaseForm === 'function') openCaseForm(recordId);
    else if (entity === 'visaRecord' && typeof openVisaForm === 'function') openVisaForm(recordId);
  },

  isLockedByOthers(recordId) {
    const lk = this.remoteLocks[recordId];
    if (!lk) return null;
    if (Auth.user && lk.uid === Auth.user.uid) return null;
    return lk;
  },
};
window.EntLocks = Locks;

/* =========================================================
   WRAP OPEN FORMS WITH LOCK ACQUISITION
   ========================================================= */
function wrapOpenForm(fnName, entity) {
  const orig = window[fnName];
  if (typeof orig !== 'function') return;
  window[fnName] = async function(idOrNull, ...rest) {
    // If it's a new record (no id), don't try to lock
    const isNew = !idOrNull;
    // Call the original first so the modal opens synchronously
    const result = orig.call(this, idOrNull, ...rest);
    if (isNew) return result;

    // Try to acquire the lock
    const lockResult = await Locks.acquire(idOrNull, entity);
    if (lockResult.acquired) {
      UI.injectLockBanner('mine', {
        recordId: idOrNull, entity,
        title: 'You have the edit lock',
        detail: 'Auto-released when you close this window.',
      });
    } else {
      const heldBy = lockResult.heldBy || {};
      const heldMs = Date.now() - (heldBy.since || 0);
      const heldMin = Math.round(heldMs / 60000);
      UI.injectLockBanner('theirs', {
        recordId: idOrNull, entity,
        title: 'Locked by ' + (heldBy.name || 'someone else'),
        detail: (heldBy.email || '') + ' · started ' + (heldMin < 1 ? 'just now' : heldMin + ' min ago'),
        showForceBtn: window.Session && window.Session.currentRole() === 'admin',
      });
      // Also make the form read-only
      UI.setModalReadOnly(true);
    }
    return result;
  };
}
wrapOpenForm('openCaseForm', 'recruitmentCase');
wrapOpenForm('openVisaForm', 'visaRecord');

/* Wrap closeModal to release lock */
const origCloseModal = window.closeModal;
window.closeModal = function() {
  if (Locks.currentLock) {
    Locks.release(Locks.currentLock.recordId);
  }
  UI.setModalReadOnly(false);
  return origCloseModal.apply(this, arguments);
};

/* =========================================================
   UI wiring
   ========================================================= */
const UI = {
  init() {
    // Auth gate wiring
    $('entAuthPrimary').addEventListener('click', () => UI.submitAuth());
    $('entAuthPassword').addEventListener('keydown', e => { if (e.key === 'Enter') UI.submitAuth(); });
    $('entAuthEmail').addEventListener('keydown', e => { if (e.key === 'Enter') $('entAuthPassword').focus(); });
    $('entAuthToggleMode').addEventListener('click', () => UI.toggleAuthMode());
    $('entAuthForgot').addEventListener('click', () => UI.forgotPassword());

    // Kick off auth (after Sync has had a chance to init Firebase)
    setTimeout(() => Auth.init(), 800);

    // Add user pill to top strip (once)
    const strip = $('entTopStrip');
    if (strip && !$('entUserPill')) {
      const spacer = strip.querySelector('.ent-spacer');
      const pill = document.createElement('span');
      pill.className = 'ent-user-pill';
      pill.id = 'entUserPill';
      pill.style.display = 'none';
      pill.innerHTML = '<span class="ent-user-avatar" id="entUserAvatar">?</span><span id="entUserName">Not signed in</span><button type="button" class="ent-user-signout" id="entUserSignoutBtn" title="Sign out">⎋</button>';
      strip.insertBefore(pill, spacer);
      $('entUserSignoutBtn').addEventListener('click', () => Auth.signOut());
    }

    // Start lock listener whenever sync connects
    const startWhenReady = setInterval(() => {
      if (window.EntSync && window.EntSync.status === 'connected') {
        Locks.startListener();
        clearInterval(startWhenReady);
      }
    }, 1500);
    setTimeout(() => clearInterval(startWhenReady), 60000);

    // Release locks on tab close
    window.addEventListener('beforeunload', () => Locks.releaseAllMine());
  },

  showGate() {
    $('entAuthGate').classList.add('open');
    setTimeout(() => { const e = $('entAuthEmail'); if (e) e.focus(); }, 100);
  },
  hideGate() { $('entAuthGate').classList.remove('open'); },

  toggleAuthMode() {
    Auth.mode = Auth.mode === 'signin' ? 'signup' : 'signin';
    $('entAuthTitle').textContent = Auth.mode === 'signin' ? 'Sign in' : 'Create account';
    $('entAuthSub').textContent = Auth.mode === 'signin' ? 'Enter your work email and password to continue.' : 'Register a new account for the toolkit.';
    $('entAuthPrimary').textContent = Auth.mode === 'signin' ? 'Sign in' : 'Create account';
    $('entAuthToggleMode').textContent = Auth.mode === 'signin' ? 'New here? Create account' : 'Already have an account? Sign in';
    $('entAuthDisplayNameWrap').style.display = Auth.mode === 'signup' ? 'block' : 'none';
    $('entAuthPassword').setAttribute('autocomplete', Auth.mode === 'signin' ? 'current-password' : 'new-password');
    UI._clearAuthMsg();
  },

  _clearAuthMsg() {
    $('entAuthError').classList.remove('show');
    $('entAuthInfo').classList.remove('show');
  },
  _showAuthError(msg) { const el = $('entAuthError'); el.textContent = msg; el.classList.add('show'); $('entAuthInfo').classList.remove('show'); },
  _showAuthInfo(msg) { const el = $('entAuthInfo'); el.textContent = msg; el.classList.add('show'); $('entAuthError').classList.remove('show'); },

  async submitAuth() {
    UI._clearAuthMsg();
    const email = $('entAuthEmail').value.trim();
    const pass = $('entAuthPassword').value;
    if (!email || !pass) return UI._showAuthError('Email and password are required.');
    if (pass.length < 8 && Auth.mode === 'signup') return UI._showAuthError('Password must be at least 8 characters.');
    $('entAuthPrimary').disabled = true;
    $('entAuthPrimary').textContent = Auth.mode === 'signin' ? 'Signing in…' : 'Creating…';
    let res;
    if (Auth.mode === 'signin') res = await Auth.signIn(email, pass);
    else res = await Auth.signUp(email, pass, $('entAuthDisplayName').value.trim());
    $('entAuthPrimary').disabled = false;
    $('entAuthPrimary').textContent = Auth.mode === 'signin' ? 'Sign in' : 'Create account';
    if (res && res.error) UI._showAuthError(res.error);
    else UI._showAuthInfo(Auth.mode === 'signin' ? 'Signed in successfully.' : 'Account created — signing you in…');
  },

  async forgotPassword() {
    const email = $('entAuthEmail').value.trim();
    UI._clearAuthMsg();
    const res = await Auth.resetPassword(email);
    if (res && res.error) UI._showAuthError(res.error);
    else UI._showAuthInfo('Password reset email sent to ' + email + ' if that account exists.');
  },

  renderUserPill() {
    const pill = $('entUserPill');
    if (!pill) return;
    if (Auth.user) {
      pill.style.display = 'inline-flex';
      const initials = (Auth.user.displayName || '?').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
      $('entUserAvatar').textContent = initials;
      $('entUserName').textContent = Auth.user.displayName;
    } else {
      pill.style.display = 'none';
    }
  },

  injectLockBanner(kind, opts) {
    // Find the currently open modal body
    const modalBody = document.querySelector('#modalOverlay .modal-body') || document.querySelector('.modal-body');
    if (!modalBody) return;
    // Remove any previous banner
    modalBody.querySelectorAll('.ent-lock-banner').forEach(b => b.remove());
    const banner = document.createElement('div');
    banner.className = 'ent-lock-banner ' + kind;
    const iconChar = kind === 'mine' ? '🔓' : kind === 'theirs' ? '🔒' : '⚠';
    banner.innerHTML =
      '<span class="ent-lock-icon">' + iconChar + '</span>' +
      '<div class="ent-lock-info">' +
        '<div class="ent-lock-title">' + esc(opts.title || '') + '</div>' +
        '<div class="ent-lock-detail">' + esc(opts.detail || '') + '</div>' +
      '</div>' +
      (opts.showForceBtn ? '<button type="button" id="entLockForceBtn">Force override</button>' : '');
    modalBody.insertBefore(banner, modalBody.firstChild);
    if (opts.showForceBtn) {
      $('entLockForceBtn').addEventListener('click', () => Locks.forceOverride(opts.recordId, opts.entity));
    }
  },

  setModalReadOnly(on) {
    const modal = document.getElementById('modalOverlay');
    if (!modal) return;
    modal.classList.toggle('ent-readonly-mode', on);
    modal.querySelectorAll('input,select,textarea').forEach(el => {
      if (on) el.setAttribute('readonly', 'readonly'), el.setAttribute('disabled', 'disabled');
      else el.removeAttribute('readonly'), el.removeAttribute('disabled');
    });
    // Disable primary save button as well
    modal.querySelectorAll('button[type="submit"], .btn.primary').forEach(b => {
      if (on) b.setAttribute('disabled', 'disabled');
      else b.removeAttribute('disabled');
    });
  },

  updateLockIndicators() {
    // Annotate rows in the main tables with a lock badge for records held by others
    // Case table rows use data-action="edit-case" on their action button
    // Visa table rows use data-action="edit-visa"
    document.querySelectorAll('[data-action="edit-case"], [data-action="edit-visa"]').forEach(btn => {
      const id = btn.dataset.id;
      if (!id) return;
      const row = btn.closest('tr');
      if (!row) return;
      // Remove any previous marker
      row.classList.remove('ent-row-locked');
      const existing = row.querySelector('.ent-row-lock');
      if (existing) existing.remove();
      const lk = Locks.isLockedByOthers(id);
      if (lk) {
        row.classList.add('ent-row-locked');
        const badge = document.createElement('span');
        badge.className = 'ent-row-lock';
        badge.textContent = '🔒 ' + (lk.name || 'locked');
        badge.title = 'Being edited by ' + (lk.name || '?') + ' (' + (lk.email || '') + ')';
        // Insert near first cell
        const firstCell = row.querySelector('td');
        if (firstCell) firstCell.appendChild(badge);
      }
    });
  },
};

/* Boot */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => UI.init());
else UI.init();

console.log('%c◆ SAFWAT Enterprise v' + V22 + ' extensions loaded (Auth + Locks)', 'color:#B98A2E;font-weight:bold;');

})();


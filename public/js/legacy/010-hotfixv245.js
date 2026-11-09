
(function HotfixV245(){
  'use strict';
  const V = '2.4.5';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

  function keyOf(u) {
    if (!u) return '?';
    // Prefer email (stable across tabs); fall back to actor string
    const actor = u.actor || '';
    const m = actor.match(/<([^>]+)>/);
    return (m ? m[1] : actor).trim().toLowerCase() || '?';
  }

  function renderDeduped(data, mySessionId) {
    const el = $('entPresenceBar');
    if (!el) return;
    const entries = Object.entries(data || {});
    if (!entries.length) { el.innerHTML = ''; return; }

    // Group by user key
    const groups = {};
    entries.forEach(([sid, u]) => {
      const k = keyOf(u);
      if (!groups[k]) groups[k] = { user: u, sessions: [], isMe: false, editing: [] };
      groups[k].sessions.push(sid);
      if (sid === mySessionId) groups[k].isMe = true;
      if (u.editing) groups[k].editing.push(u.editing);
    });

    let html = '';
    Object.values(groups).forEach(g => {
      const u = g.user;
      const initials = (u.actor || '?').replace(/<[^>]+>/, '').trim().split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase() || '?';
      const tabBadge = g.sessions.length > 1 ? '<span class="ent-tab-badge">' + g.sessions.length + '</span>' : '';
      const editingTxt = g.editing.length ? ' — editing ' + g.editing.join(', ') : '';
      const tabTxt = g.sessions.length > 1 ? ' (' + g.sessions.length + ' tabs)' : '';
      const title = (u.actor || '?') + ' (' + (u.role || 'viewer') + ')' + tabTxt + editingTxt;
      html += '<span class="ent-presence-avatar' + (g.isMe ? ' me' : '') + '" title="' + esc(title) + '">' + esc(initials) + tabBadge + '</span>';
    });
    const userCount = Object.keys(groups).length;
    html += '<span class="ent-presence-count">' + userCount + (userCount === 1 ? ' online' : ' online') + '</span>';
    el.innerHTML = html;
  }

  // Wait for the EntSync module then override its renderPresence method
  function hook() {
    if (!window.EntUI || typeof window.EntUI.renderPresence !== 'function') {
      return setTimeout(hook, 500);
    }
    window.EntUI.renderPresence = renderDeduped;
    console.log('%c[v2.4.5] Presence dedup active', 'color:#B98A2E;font-weight:bold');

    // Also re-render immediately if presence data is already loaded
    try {
      if (window.EntSync && window.EntSync.fb && window.EntSync.status === 'connected') {
        const nodeName = (window.DB_FILE_NAME || 'main').replace(/\.json$/i, '').replace(/[^\w-]/g, '_');
        window.EntSync.fb.ref('safwat/presence/' + nodeName).once('value').then(snap => {
          renderDeduped(snap.val() || {}, window.EntSync.sessionId);
        });
      }
    } catch {}
  }
  hook();
})();

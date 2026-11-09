
(function ClaireAlignDatesV730(){
  'use strict';
  var V = '7.3.0';
  var PAIRS = [['candVisaIssuance', 'candidateVisaDate'], ['delegationDate', 'ratificationDate'], ['candVisaExpiration', 'candidateVisaExpiration']];
  var LABEL = { candVisaIssuance: 'Cand. visa date', delegationDate: 'Delegation date', candVisaExpiration: 'Cand. visa expiry' };

  function boot(tries){
    var C = window.CLAIRE;
    if (!C || !C.register || !C.open) { if (tries < 60) setTimeout(function(){ boot(tries + 1); }, 500); else console.warn('[CLAIRE ' + V + '] CLAIRE v7.2.0 not found — align action not installed.'); return; }
    if (C.alignPreview) return;
    var toIso = C.toIso;
    function dayNum(iso){ var q = iso.split('-').map(Number); return Date.UTC(q[0], q[1] - 1, q[2]) / 86400000; }
    function gap(a, b){ a = toIso(a); b = toIso(b); return (a && b) ? dayNum(a) - dayNum(b) : null; }

    /* what would change — read-only */
    function preview(){
      var out = { fix: [], other: 0, records: 0 }, seen = {};
      ((window.DB || {}).visaRecords || []).forEach(function(v){
        if (!v || !v.id) return;
        PAIRS.forEach(function(p){
          var g = gap(v[p[0]], v[p[1]]); if (g === null || g === 0) return;
          if (g === 1) { out.fix.push({ id: v.id, newer: p[0], older: p[1], from: toIso(v[p[1]]), to: toIso(v[p[0]]) }); if (!seen[v.id]) { seen[v.id] = 1; out.records++; } }
          else out.other++;
        });
      });
      return out;
    }

    C.register('visa.alignDatePairs', {
      role: 'admin',
      validate: function(i){ return (!i || !i.fix || !i.fix.length) ? 'Nothing to align.' : null; },
      touches: function(i){ var ids = {}; i.fix.forEach(function(f){ ids[f.id] = 1; }); return Object.keys(ids).map(function(id){ return { kind: 'visa', id: id }; }); },
      apply: function(i, db){
        var byId = {}; (db.visaRecords || []).forEach(function(v){ byId[v.id] = v; });
        var n = 0, now = new Date().toISOString();
        i.fix.forEach(function(f){
          var v = byId[f.id]; if (!v) return;
          if (gap(v[f.newer], v[f.older]) !== 1) return;          /* re-check at apply time */
          v[f.older] = toIso(v[f.newer]); v.updatedAt = now; n++;
        });
        try { if (window.Audit && window.Audit.push) window.Audit.push('bulk', 'visaRecord', null, null, 'CLAIRE aligned ' + n + ' date pair(s) (+1 day UTC shift)'); } catch (e) {}
        return n;
      },
      describe: function(i, n){ return 'Aligned ' + n + ' date pair(s) across ' + i.records + ' visa(s). Undo is available.'; }
    });

    /* ---- Findings-tab bar ---- */
    var st = document.createElement('style');
    st.textContent = '#claireAlign{border:1px solid #6B4FA0;border-radius:8px;background:rgba(107,79,160,.06);padding:10px 12px;margin-bottom:12px;font-size:12px;line-height:1.45}'
      + '#claireAlign b{color:#6B4FA0}#claireAlign .r{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}'
      + '#claireAlign ul{margin:6px 0 0;padding-left:16px;max-height:140px;overflow:auto;font-family:var(--ent-mono,monospace);font-size:11px}';
    document.head.appendChild(st);
    var mode = 'idle', plan = null;

    function bar(){
      var p = mode === 'preview' ? plan : preview();
      if (!p.fix.length && mode === 'idle') return '';
      var h = '<div id="claireAlign">';
      if (mode === 'idle') {
        h += '<b>✦ I can fix ' + p.fix.length + ' of these for you.</b> They are the old 1-day timezone shift — the older field is exactly 1 day early.'
          + (p.other ? ' ' + p.other + ' other mismatch(es) need a human look.' : '')
          + '<div class="r"><button class="btn fill" data-al="preview">Preview fix</button></div>';
      } else {
        var by = {}; p.fix.forEach(function(f){ by[f.newer] = (by[f.newer] || 0) + 1; });
        h += '<b>Preview — nothing changed yet.</b> I will copy the newer date onto the older field in ' + p.fix.length + ' pair(s) on ' + p.records + ' visa(s):<ul>'
          + Object.keys(by).map(function(k){ return '<li>' + LABEL[k] + ': ' + by[k] + '</li>'; }).join('')
          + p.fix.slice(0, 40).map(function(f){ return '<li>' + f.id + ' · ' + f.older + ' ' + f.from + ' → ' + f.to + '</li>'; }).join('')
          + (p.fix.length > 40 ? '<li>…and ' + (p.fix.length - 40) + ' more</li>' : '') + '</ul>'
          + '<div class="r"><button class="btn fill" data-al="apply">Apply ' + p.fix.length + ' fixes</button><button class="btn" data-al="cancel">Cancel</button></div>';
      }
      return h + '</div>';
    }
    function inject(){
      var panel = document.getElementById('clairePanel'); if (!panel) return;
      var tabOn = panel.querySelector('.tabs button.on'); if (!tabOn || tabOn.dataset.t !== 'findings') return;
      var body = panel.querySelector('.body'); if (!body || body.querySelector('#claireAlign')) return;
      var html = bar(); if (html) body.insertAdjacentHTML('afterbegin', html);
    }
    function rerender(){ var b = document.querySelector('#clairePanel .tabs button[data-t="findings"]'); if (b) b.click(); }

    document.addEventListener('click', function(e){
      var t = e.target.closest && e.target.closest('#claireAlign button[data-al]'); if (!t) return;
      var a = t.dataset.al;
      if (a === 'preview') { plan = preview(); mode = 'preview'; rerender(); }
      else if (a === 'cancel') { mode = 'idle'; plan = null; rerender(); }
      else if (a === 'apply') {
        t.disabled = true; t.textContent = 'Applying…';
        var who = ''; try { var u = firebase.auth().currentUser; who = u && (u.email || u.uid); } catch (x) {}
        C.do('visa.alignDatePairs', plan, { by: who || 'unknown' }).then(function(r){
          mode = 'idle'; plan = null;
          if (r.ok) { try { if (window.refreshVisaView) window.refreshVisaView(); } catch (x) {} C.scan(); }
          C.open(r.ok ? 'undo' : 'findings');
          var chip = document.getElementById('claireChip');
          if (chip) { chip.className = 'show ' + (r.ok ? 'saved' : 'err'); chip.textContent = '✦ CLAIRE · ' + r.say; }
        });
      }
    });
    var body0 = document.getElementById('clairePanel');
    if (body0) new MutationObserver(inject).observe(body0, { childList: true, subtree: true });

    C.alignPreview = function(){ var p = preview(); console.table(p.fix); return { pairsToFix: p.fix.length, visas: p.records, leftForReview: p.other }; };
    console.log('%c✦ CLAIRE ' + V + ' — "Align date pairs" ready (Findings tab)', 'color:#6B4FA0;font-weight:bold');
  }
  boot(0);
})();

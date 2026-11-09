
(function ClaireChatV740(){
  'use strict';
  var V = '7.4.0';
  try { if (localStorage.getItem('claire.chat.off') === '1') return console.warn('[CLAIRE chat] disabled by kill switch'); } catch (e) {}

  function boot(tries){
    var C = window.CLAIRE, panel = document.getElementById('clairePanel');
    if (!C || !C.status || !panel || !panel.querySelector('.tabs')) {
      if (tries < 80) return setTimeout(function(){ boot(tries + 1); }, 500);
      return console.warn('[CLAIRE ' + V + '] CLAIRE v7.2.0 panel not found — chat not installed.');
    }
    if (C.ask) return;
    init(C, panel);
  }

  function init(C, panel){
    /* ---------------- helpers ---------------- */
    var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); };
    var norm = function(s){ return String(s == null ? '' : s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[’'`]/g, '').replace(/[^a-z0-9\u0600-\u06ff\-\/\s]/g, ' ').replace(/\s+/g, ' ').trim(); };
    var escRe = function(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
    var DB = function(){ return window.DB || {}; };
    var visas = function(){ return DB().visaRecords || []; }, cases = function(){ return DB().recruitmentCases || []; };
    var idNum = function(id){ return +String(id || '').replace(/\D/g, '') || -1; };
    var iso = function(x){ return C.toIso ? C.toIso(x) : String(x || '').slice(0, 10); };
    var todayIso = function(){ var d = new Date(), p = function(n){ return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
    var dayDiff = function(a, b){ var n = function(s){ var q = s.split('-').map(Number); return Date.UTC(q[0], q[1] - 1, q[2]) / 864e5; }; return n(a) - n(b); };
    var plural = function(n, w){ return n + ' ' + w + (n === 1 ? '' : 's'); };
    var me = function(){ try { var u = firebase.auth().currentUser; return u ? (u.displayName || (u.email || '').split('@')[0]) : ''; } catch (e) { return ''; } };
    var LS = { get: function(k, d){ try { var v = localStorage.getItem('claire.' + k); return v === null ? d : v; } catch (e) { return d; } },
               set: function(k, v){ try { localStorage.setItem('claire.' + k, v); } catch (e) {} } };

    /* ---------------- DOM ---------------- */
    var tabs = panel.querySelector('.tabs');
    var chatTab = document.createElement('button'); chatTab.dataset.t = 'chat'; chatTab.textContent = 'Chat';
    tabs.insertBefore(chatTab, tabs.firstChild);
    var PH = 'Ask CLAIRE… e.g. how many unused visas';
    var box = document.createElement('div'); box.id = 'claireChat';
    box.innerHTML = '<div class="cc-log" role="log" aria-live="polite"></div><div class="cc-chips"></div>'
      + '<form class="cc-in" autocomplete="off"><button type="button" class="cc-mic" title="Talk to CLAIRE (Alt+V)" aria-label="Talk">🎤</button>'
      + '<input type="text" aria-label="Message CLAIRE" placeholder="' + PH + '">'
      + '<button type="button" class="cc-voice" aria-label="Voice replies"></button><button type="submit" class="cc-send">Send</button></form>';
    panel.appendChild(box);
    var logEl = box.querySelector('.cc-log'), input = box.querySelector('input'), mic = box.querySelector('.cc-mic'),
        voiceBtn = box.querySelector('.cc-voice'), dockBtn = document.getElementById('claireBtn');

    ['Status', 'Any issues?', 'Unused visas', 'Expiring in 30 days', 'Help'].forEach(function(t){
      var b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = function(){ send(t, false); };
      box.querySelector('.cc-chips').appendChild(b);
    });

    /* chat mode follows the active tab (works with CLAIRE.open(tab) too) */
    var greeted = false;
    function syncMode(){
      var on = chatTab.classList.contains('on');
      panel.classList.toggle('chat-mode', on);
      if (on && panel.classList.contains('open')) { if (!greeted) greet(); setTimeout(function(){ input.focus(); }, 60); }
    }
    new MutationObserver(syncMode).observe(tabs, { subtree: true, attributes: true, attributeFilter: ['class'] });
    new MutationObserver(syncMode).observe(panel, { attributes: true, attributeFilter: ['class'] });
    chatTab.click();                                   /* Chat is the default tab */

    /* ---------------- messages ---------------- */
    var hist = []; try { hist = JSON.parse(sessionStorage.getItem('claire.chat') || '[]'); } catch (e) {}
    var acts = {}, seq = 0;
    function act(label, fn, fill){ var id = 'a' + (++seq); acts[id] = fn; return '<button class="cc-act' + (fill ? ' fill' : '') + '" data-a="' + id + '">' + esc(label) + '</button>'; }
    function fmt(t){ return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); }
    function paint(who, text, html){
      var d = document.createElement('div'); d.className = 'cc-m ' + who;
      d.innerHTML = '<div class="cc-b">' + fmt(text) + (html || '') + '</div>';
      logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight;
    }
    function add(who, text, html){
      paint(who, text, html); hist.push({ w: who, t: text });
      try { sessionStorage.setItem('claire.chat', JSON.stringify(hist.slice(-60))); } catch (e) {}
    }
    hist.slice(-60).forEach(function(m){ paint(m.w, m.t); }); if (hist.length) greeted = true;
    logEl.addEventListener('click', function(e){
      var b = e.target.closest('button[data-a]'); if (!b || b.disabled) return;
      var fn = acts[b.dataset.a]; if (!fn) return;
      if (b.classList.contains('fill')) b.disabled = true;
      fn();
    });
    var lastViaVoice = false;
    function reply(r){
      if (!r) return;
      if (typeof r === 'string') r = { text: r };
      add('claire', r.text, r.html);
      var mode = voiceMode();
      if (mode === 'on' || (mode === 'auto' && lastViaVoice)) speak(r.speak || r.text);
    }
    function note(t){ add('note', t); }

    function greet(){
      greeted = true;
      var top = topValue(visas(), 'client');
      reply({ text: 'Hi' + (me() ? ' ' + me() : '') + ', I’m CLAIRE. Ask me about visas, candidates or the health of the data — type, or press 🎤 (Alt+V) and talk.'
        + '\nTry: “' + (top ? 'how many unused visas for ' + top.toLowerCase() : 'how many unused visas') + '”, “find VR-635”, or “what’s expiring this month”.' });
    }

    /* ---------------- understanding ---------------- */
    var VF = [['statusVisa', 'status'], ['client', 'client'], ['nationality', 'nationality'], ['visaCategory', 'category'], ['registeredAgencyName', 'agency'], ['stampingCity', 'city'], ['gender', 'gender']];
    var CF = [['stage', 'stage'], ['client', 'client'], ['nationality', 'nationality'], ['position', 'position'], ['agency', 'agency'], ['recruitmentType', 'type'], ['gender', 'gender']];
    var FUZZY = { stage: 1, position: 1, visaCategory: 1, client: 1 };
    var STOP = {}; ('how many much visa visas candidate candidates case cases show list count total number which with from for the and are there have has what '
      + 'expiring expire expires expired days day weeks week months month in of me all our give tell find who is that this today status open please do we us any by '
      + 'per under available currently right now next within about them those these only also stage stages client clients').split(' ').forEach(function(w){ STOP[w] = 1; });

    var fc = { k: '', v: null };
    function facets(){
      var k = visas().length + '|' + cases().length + '|' + ((DB().meta || {}).savedAt || '');
      if (fc.k === k) return fc.v;
      var build = function(rows, defs){ var o = {}; defs.forEach(function(d){ var m = {};
        rows.forEach(function(r){ var v = r && r[d[0]]; if (v == null || v === '') return; var n = norm(v); if (n.length >= 2 && !m[n]) m[n] = String(v).trim(); }); o[d[0]] = m; }); return o; };
      fc = { k: k, v: { visa: build(visas(), VF), 'case': build(cases(), CF) } };
      return fc.v;
    }
    function topValue(rows, fld){ var c = {}, best = '', n = 0; rows.forEach(function(r){ var v = r && r[fld]; if (v) { c[v] = (c[v] || 0) + 1; if (c[v] > n) { n = c[v]; best = v; } } }); return best; }

    /* which field values does the question mention? exact words first, then partial (e.g. "medical" → FOR MEDICAL APPOINTMENT) */
    function matchFields(q, kind){
      var F = facets()[kind], defs = kind === 'visa' ? VF : CF, out = {}, used = {};
      defs.forEach(function(d){
        var hits = Object.keys(F[d[0]]).filter(function(nv){ return new RegExp('(^|[^a-z0-9])' + escRe(nv) + 's?($|[^a-z0-9])').test(q); });
        hits = hits.filter(function(h){ return !hits.some(function(o){ return o !== h && o.indexOf(h) >= 0; }); });
        if (hits.length) { out[d[0]] = hits; hits.forEach(function(h){ h.split(' ').forEach(function(w){ used[w] = 1; }); }); }
      });
      var toks = q.split(' ').filter(function(t){ return t.length >= 4 && !STOP[t] && !used[t] && !/^\d+$/.test(t); });
      if (toks.length) defs.forEach(function(d){
        if (!FUZZY[d[0]] || out[d[0]]) return;
        var hits = Object.keys(F[d[0]]).filter(function(nv){ return toks.some(function(t){ return nv.indexOf(t) >= 0; }); });
        if (hits.length && hits.length <= 12) out[d[0]] = hits;
      });
      return out;
    }
    function applyFilters(rows, m){ var ks = Object.keys(m); return rows.filter(function(r){ return ks.every(function(k){ return m[k].indexOf(norm(r[k])) >= 0; }); }); }
    function describe(kind, m){
      var F = facets()[kind], defs = kind === 'visa' ? VF : CF;
      return defs.filter(function(d){ return m[d[0]]; }).map(function(d){
        return d[1] + ' ' + m[d[0]].map(function(n){ return F[d[0]][n]; }).join(' or '); }).join(' · ');
    }
    function breakdown(rows, fld, max){
      var c = {}; rows.forEach(function(r){ var v = r[fld] || '(blank)'; c[v] = (c[v] || 0) + 1; });
      return Object.keys(c).sort(function(a, b){ return c[b] - c[a]; }).slice(0, max || 6).map(function(k){ return k + ' ' + c[k]; }).join(' · ');
    }

    /* ---------------- records ---------------- */
    function openRecord(kind, id){
      try { if (C.close) C.close(); } catch (e) {}
      try {
        if (kind === 'visa' && typeof window.openVisaForm === 'function') return window.openVisaForm(id);
        if (kind === 'case' && typeof window.openCaseForm === 'function') return window.openCaseForm(id);
      } catch (e) {}
      note('I couldn’t open ' + id + ' from here.');
    }
    function card(kind, r){
      var L = kind === 'visa'
        ? ['<b>' + esc(r.id) + '</b> · ' + esc(r.fullName || '— unassigned —'),
           'Status ' + esc(r.statusVisa || '—') + ' · ' + esc(r.visaCategory || '—') + ' · ' + esc(r.nationality || '—'),
           'Client ' + esc(r.client || '—') + ' · QIWA exp ' + esc(iso(r.expirationDate) || '—'),
           'Cand. visa ' + esc(iso(r.candVisaIssuance || r.candidateVisaDate) || '—') + ' → ' + esc(iso(r.candVisaExpiration || r.candidateVisaExpiration) || '—'),
           'Linked ' + esc(r.linkedRecruitmentCaseId || 'none')]
        : ['<b>' + esc(r.id) + '</b> · ' + esc(r.name || '—'),
           'Stage ' + esc(r.stage || '—') + ' · ' + esc(r.position || '—') + ' · ' + esc(r.nationality || '—'),
           'Client ' + esc(r.client || '—') + ' · Agency ' + esc(r.agency || '—'),
           'Passport ' + esc(r.passport || '—') + ' · Visa ' + esc(r.linkedVisaId || 'none')];
      var link = kind === 'visa' ? r.linkedRecruitmentCaseId : r.linkedVisaId;
      return '<div class="cc-card">' + L.join('<br>') + '</div>' + act('Open', function(){ openRecord(kind, r.id); }, false)
        + (link ? act('Open ' + link, function(){ openRecord(kind === 'visa' ? 'case' : 'visa', link); }) : '');
    }
    function sayRecord(kind, r){
      return kind === 'visa' ? r.id + ': ' + (r.fullName || 'unassigned') + ', ' + (r.statusVisa || 'no status') + (r.client ? ', client ' + r.client : '') + '.'
                             : r.id + ': ' + (r.name || 'no name') + ', stage ' + (r.stage || 'unknown') + (r.client ? ', client ' + r.client : '') + '.';
    }
    function list(kind, rows, cap, days){
      cap = cap || 25;
      var h = '<div class="cc-card">' + rows.slice(0, cap).map(function(r){
        var t = kind === 'visa' ? (r.fullName || r.statusVisa || '') + (days && days.has(r) ? ' · ' + days.get(r) + 'd' : '') : (r.name || '') + ' · ' + (r.stage || '');
        return '<div class="cc-row"><span><b>' + esc(r.id) + '</b> ' + esc(t) + '</span>' + act('Open', function(){ openRecord(kind, r.id); }) + '</div>';
      }).join('') + '</div>';
      return h + (rows.length > cap ? '<div style="font-size:11px;margin-top:4px">Showing ' + cap + ' of ' + rows.length + ' — narrow it down (e.g. add a client).</div>' : '');
    }

    /* ---------------- appearance (v7.7.0) ----------------
       Uses the app's own dark mode (EntUI.setDark → body.ent-dark, saved in
       localStorage 'safwatEnt.dark'; the Settings checkbox stays in sync). */
    function isDark(){ return document.body.classList.contains('ent-dark'); }
    function setDark(on){
      if (window.EntUI && typeof window.EntUI.setDark === 'function') return window.EntUI.setDark(!!on);
      document.body.classList.toggle('ent-dark', !!on);
      try { localStorage.setItem('safwatEnt.dark', JSON.stringify(!!on)); } catch (e) {}
      var chk = document.getElementById('entDarkToggle'); if (chk) chk.checked = !!on;
    }
    function themeWant(q){
      if (/\b(what|which)\b.*\b(mode|theme|appearance)\b|\bis (dark|light) (mode|theme) (on|off|enabled)\b/.test(q)) return 'ask';
      if (/\blights? (off|out)\b/.test(q)) return 'dark';
      if (/\blights? on\b/.test(q)) return 'light';
      var off = /\b(off|disable|deactivate|stop|exit|leave|remove|no more)\b/.test(q);
      var dk = /\b(dark|darker|night|black)\b/.test(q), lt = /\b(light|lighter|day|white|bright|brighter|normal|default|classic)\b/.test(q);
      if (dk && !lt) return off ? 'light' : 'dark';
      if (lt && !dk) return off ? 'dark' : 'light';
      return 'toggle';
    }
    function themeReply(q){
      var want = themeWant(q), was = isDark();
      if (want === 'ask') return 'You’re in **' + (was ? 'dark' : 'light') + ' mode**. Say “' + (was ? 'light' : 'dark') + ' mode” to switch.';
      var on = want === 'toggle' ? !was : want === 'dark';
      if (on === was) return 'Already in **' + (on ? 'dark' : 'light') + ' mode**. Say “' + (on ? 'light' : 'dark') + ' mode” to switch.';
      setDark(on);
      return { text: (on ? 'Dark mode on \uD83C\uDF19' : 'Light mode on \u2600\uFE0F') + ' — it stays this way on this computer. Say “' + (on ? 'light' : 'dark') + ' mode” to switch back.',
               speak: (on ? 'Dark' : 'Light') + ' mode is on.' };
    }
    C.theme = function(m){ if (m === 'dark' || m === 'light') setDark(m === 'dark'); else if (m === 'toggle') setDark(!isDark()); return isDark() ? 'dark' : 'light'; };

    /* ---------------- intents ---------------- */
    var RX = {
      help: /^(help|\?|commands?)$|what can you do|how do i use you|what do you know/,
      hi: /^(hi|hello|hey|yo|salam|salaam|as?salamu? ?alaikum|good (morning|afternoon|evening))\b/,
      who: /who are you|what are you|your name|what is claire|whats claire/,
      thanks: /^(thanks?|thank you|thx|ty|great|nice|perfect|ok|okay|cool)\b/,
      clear: /^(clear|reset)( (the )?(chat|conversation|history))?$/,
      vOff: /\b(mute|be quiet|stop (talking|speaking)|voice off|silent)\b/,
      vOn: /\b(unmute|voice on|speak (to me|up|aloud)|talk to me|read (it )?aloud)\b/,
      vAuto: /\bvoice auto\b/,
      /* v7.7.0 — appearance: "dark mode", "switch to light", "turn off dark mode", "toggle theme", "lights off" */
      theme: /\b(dark|light|night|day)[ -]?(mode|theme)\b|\b(what|which) (mode|theme)\b|\b(theme|appearance|colou?r scheme)\b|\blights? (off|on|out)\b|\b(go|switch|turn|change|set|make|use|enable|activate|put)\b.*\b(dark|darker|light|lighter|bright|brighter)\b/,
      align: /\b(align|fix|correct)\b.*\bdates?\b|\bdate pairs?\b/,
      undo: /\b(undo|revert|roll ?back|take (it|that) back)\b/,
      save: /^(please )?(save|save now|save (it|everything|my work|changes))\b/,
      findings: /\b(findings?|issues?|problems?|wrong|inconsisten\w*|errors?|health|re-?check|recheck|scan|anything off)\b/,
      activity: /\b(activity|history|recent saves|save log|what did you (do|save))\b/,
      status: /\b(status|online|connected|connection|offline|sync\w*|unsaved|is (everything|it|all) saved|are you (there|ok|working))\b/,
      expiring: /\b(expiring|expires?|about to expire|running out|due to expire)\b/,
      countish: /\b(how many|how much|count|number of|total|list|show( me)?( all)?|which|any)\b/,
      find: /\b(find|search|look ?up|lookup|who is|where is|pull up|open|show me|check on)\b/
    };

    function think(raw){
      var q = norm(raw); if (!q) return null;

      /* record IDs — VR-000635, vr 635, Vr635, rc-12 … */
      var ids = [], m, re = /\b(vr|rc)\s*-?\s*0*(\d{1,7})\b/g;
      while ((m = re.exec(q))) ids.push({ k: m[1], n: +m[2] });
      if (ids.length && !RX.countish.test(q.replace(/\bshow( me)?\b/, ''))) {
        var found = [];
        ids.forEach(function(x){
          var kind = x.k === 'vr' ? 'visa' : 'case', rows = kind === 'visa' ? visas() : cases();
          var r = rows.filter(function(r){ return idNum(r.id) === x.n && norm(r.id).indexOf(x.k) === 0; })[0];
          found.push({ x: x, kind: kind, r: r });
        });
        var ok = found.filter(function(f){ return f.r; });
        if (!ok.length) return 'I couldn’t find ' + found.map(function(f){ return f.x.k.toUpperCase() + '-' + String(f.x.n).padStart(6, '0'); }).join(', ') + '.';
        var miss = found.filter(function(f){ return !f.r; });
        return { text: ok.length === 1 ? 'Here’s ' + ok[0].r.id + '.' : 'Here are ' + ok.length + ' records.' + (miss.length ? ' (Not found: ' + miss.map(function(f){ return f.x.k.toUpperCase() + '-' + f.x.n; }).join(', ') + ')' : ''),
                 html: ok.map(function(f){ return card(f.kind, f.r); }).join(''), speak: ok.map(function(f){ return sayRecord(f.kind, f.r); }).join(' ') };
      }

      if (RX.clear.test(q)) { hist = []; logEl.innerHTML = ''; try { sessionStorage.removeItem('claire.chat'); } catch (e) {} return 'Cleared. What would you like to know?'; }
      if (RX.help.test(q)) return { text: 'Here’s what I can do — any wording, upper or lower case:\n'
        + '• **Find**: “VR-635”, “find juan dela cruz”, “passport P1234567”\n'
        + '• **Count / list**: “how many unused visas for <client>”, “list filipino welders”, “candidates in medical”\n'
        + '• **Expiring**: “visas expiring in 2 weeks”, “what expires this month for <client>”\n'
        + '• **Data health**: “any issues?”, “re-check”, “align dates”\n'
        + '• **Saving**: “status”, “save now”, “undo”\n'
        + '• **Voice**: 🎤 or Alt+V to talk · “mute” / “talk to me”\n'
        + '• **Appearance**: “dark mode”, “light mode”, “toggle theme”', speak: 'I can find records, count and list visas or candidates, check what is expiring, report data issues, save, undo, and switch dark or light mode. Just ask.' };
      if (RX.hi.test(q) && q.split(' ').length <= 4) return 'Hello' + (me() ? ' ' + me() : '') + '! What can I look up for you?';
      if (RX.who.test(q)) return 'I’m C.L.A.I.R.E. — Centralized Logic And Intelligent Record Executive. I save your work, watch the data for problems, and answer questions about visas and candidates.';
      if (RX.thanks.test(q) && q.split(' ').length <= 3) return 'Anytime.';
      if (RX.vOff.test(q)) { setVoice('off'); try { speechSynthesis.cancel(); } catch (e) {} return 'Okay — I’ll stay quiet. Say or type “talk to me” to hear me again.'; }
      if (RX.vOn.test(q)) { setVoice('on'); return 'Voice on — I’ll read every answer aloud.'; }
      if (RX.vAuto.test(q)) { setVoice('auto'); return 'Voice on auto — I’ll answer aloud only when you speak to me.'; }
      if (RX.theme.test(q)) return themeReply(q);

      if (RX.align.test(q)) {
        if (!C.alignPreview) return 'The “Align date pairs” add-on (v7.3.0) isn’t installed.';
        var p = C.alignPreview();
        if (!p.pairsToFix) return 'There are no 1-day date-pair shifts left to align.' + (p.leftForReview ? ' ' + plural(p.leftForReview, 'other mismatch') + ' need a manual look.' : '');
        return { text: 'I can align **' + p.pairsToFix + '** date pairs on ' + plural(p.visas, 'visa') + ' (the 1-day timezone shift).' + (p.leftForReview ? ' ' + p.leftForReview + ' other mismatch(es) need a human look.' : '') + ' Admins only — you’ll see a preview first.',
                 html: act('Show me the preview', function(){ C.open('findings'); setTimeout(function(){ var b = document.querySelector('#claireAlign [data-al="preview"]'); if (b) b.click(); }, 120); }, true) };
      }
      if (RX.undo.test(q)) {
        var j = (C.journal ? C.journal() : []).filter(function(e){ return e.action !== 'core.restore'; });
        if (!j.length) return 'There’s nothing I can undo yet. Undo covers changes made through me (like “align dates”); edit screens join in Step 3.';
        var e = j[j.length - 1], n = Object.keys(e.images || {}).length;
        return { text: 'The last change was **' + e.action + '** (' + plural(n, 'record') + ') by ' + (e.by || 'unknown') + ' at ' + new Date(e.at).toLocaleTimeString() + '. Undo it?',
                 html: act('Yes, undo it', function(){ C.undo(e.id, { by: me() || 'unknown' }).then(function(r){ reply(r.say || (r.ok ? 'Undone.' : 'I couldn’t undo that.')); }); }, true) };
      }
      if (RX.save.test(q)) {
        var s0 = C.status();
        if (!s0.unsavedChanges) return 'Everything is already saved' + (s0.lastWrittenVersion ? ' (cloud version ' + s0.lastWrittenVersion + ')' : '') + '.';
        return { text: 'You have unsaved changes. Save them now?', html: act('Save now', function(){
          Promise.resolve(C.flush()).then(function(ok){ reply(ok === false ? 'That save didn’t go through — I’ll keep retrying.' : 'Saved ✓ ' + (C.status().lastWrite || '')); }); }, true) };
      }
      if (RX.findings.test(q) && !RX.countish.test(q.replace(/\bany\b/, ''))) {
        var cnt = C.scan ? C.scan() : 0, f = C.findings ? C.findings() : [];
        if (!f.length) return 'I just checked every record — everything is consistent. ✓';
        var by = {}, NAMES = { 'date-pair': 'date pairs that don’t match', 'one-way': 'one-way links', 'orphan-v': 'visas linked to a missing candidate', 'orphan-c': 'candidates linked to a missing visa' };
        f.forEach(function(x){ by[x.rule] = (by[x.rule] || 0) + 1; });
        return { text: 'I found **' + cnt + '** thing' + (cnt === 1 ? '' : 's') + ' worth a look:\n' + Object.keys(by).map(function(k){ return '• ' + by[k] + ' ' + (NAMES[k] || k); }).join('\n')
                   + (by['date-pair'] && C.alignPreview ? '\nSay “align dates” and I’ll fix the 1-day shifts for you.' : ''),
                 html: act('Open Findings', function(){ C.open('findings'); }) };
      }
      if (RX.activity.test(q)) {
        var st = C.status().saves;
        return { text: 'This session: ' + st.written + ' saves written, ' + st.skipped + ' skipped (nothing changed), ' + st.merged + ' merged' + (st.failed ? ', ' + st.failed + ' failed' : '') + '.', html: act('Open Activity', function(){ C.open('activity'); }) };
      }
      if (RX.status.test(q) && !RX.countish.test(q)) {
        var s = C.status();
        return (s.cloudReady ? 'I’m connected to the cloud' : (navigator.onLine === false ? 'You’re offline — I’ll save when the connection returns' : 'I’m not signed in to the cloud right now'))
          + '. ' + (s.unsavedChanges ? 'You have unsaved changes — saving now.' : 'Everything is saved.')
          + (s.lastWrittenVersion ? ' Last save: version ' + s.lastWrittenVersion + ' (' + s.lastWrite + ').' : '')
          + ' I’m watching ' + plural(visas().length, 'visa') + ' and ' + plural(cases().length, 'candidate') + '. Your role: ' + s.role + '.';
      }

      if (RX.expiring.test(q)) {
        var d = 30, md = q.match(/(\d+)\s*(days?|d)\b/), mw = q.match(/(\d+)\s*weeks?/), mm = q.match(/(\d+)\s*months?/);
        if (md) d = +md[1]; else if (mw) d = 7 * mw[1]; else if (mm) d = 30 * mm[1];
        else if (/\btoday\b/.test(q)) d = 0; else if (/\b(this|next|a) week\b/.test(q)) d = 7;
        var fm = matchFields(q, 'visa'); delete fm.statusVisa;
        var t0 = todayIso(), DAYS = new Map();   /* kept outside the records — never saved */
        var rows = applyFilters(visas(), fm).filter(function(v){
          var s = String(v.statusVisa || '').toUpperCase(); if (s !== 'UNUSED' && s !== 'ALLOCATED') return false;
          var e = iso(v.expirationDate); if (!e) return false; var n = dayDiff(e, t0); DAYS.set(v, n); return n >= 0 && n <= d;
        }).sort(function(a, b){ return DAYS.get(a) - DAYS.get(b); });
        var scope = describe('visa', fm);
        if (!rows.length) return 'No unused or allocated visas expire in the next ' + plural(d, 'day') + (scope ? ' for ' + scope : '') + '. ✓';
        return { text: '**' + rows.length + '** unused/allocated ' + (rows.length === 1 ? 'visa expires' : 'visas expire') + ' in the next ' + plural(d, 'day') + (scope ? ' (' + scope + ')' : '') + ' — QIWA expiration.'
                   + '\nSoonest: ' + rows[0].id + ' in ' + plural(DAYS.get(rows[0]), 'day') + '.' + (fm.client ? '' : '\nBy client: ' + breakdown(rows, 'client', 4)),
                 html: act('List them', function(){ reply({ text: 'Expiring within ' + d + ' days:', html: list('visa', rows, 25, DAYS) }); }) };
      }

      /* counts & lists */
      var wantsVisa = /\bvisas?\b/.test(q), wantsCase = /\b(candidates?|cases?|applicants?|workers?|people|persons?|employees?|recruits?|hires?)\b/.test(q);
      var kind = wantsCase ? 'case' : wantsVisa ? 'visa' : null, mf;
      if (kind) mf = matchFields(q, kind);
      else { var mv = matchFields(q, 'visa'), mc = matchFields(q, 'case');
        kind = Object.keys(mc).length > Object.keys(mv).length ? 'case' : 'visa'; mf = kind === 'case' ? mc : mv; }
      var hasF = Object.keys(mf).length;
      if ((RX.countish.test(q) && (wantsVisa || wantsCase || hasF)) || (hasF && !RX.find.test(q))) {
        var all = kind === 'visa' ? visas() : cases(), res = applyFilters(all, mf), label = kind === 'visa' ? 'visa' : 'candidate';
        var dsc = describe(kind, mf), listy = /\b(list|which|show)\b/.test(q);
        var txt = '**' + res.length + '** ' + label + (res.length === 1 ? '' : 's') + (dsc ? ' — ' + dsc : ' in total') + '.';
        if (res.length > 1) {
          if (kind === 'visa' && !mf.statusVisa) txt += '\nBy status: ' + breakdown(res, 'statusVisa');
          else if (kind === 'case' && !mf.stage) txt += '\nTop stages: ' + breakdown(res, 'stage', 5);
          else if (!mf.client) txt += '\nBy client: ' + breakdown(res, 'client', 4);
        }
        if (listy && res.length) return { text: txt, html: list(kind, res), speak: txt };
        return { text: txt, html: res.length ? act('List them', function(){ reply({ text: dsc ? 'Matching ' + dsc + ':' : 'All ' + label + 's:', html: list(kind, res) }); }) : '' };
      }

      /* find by passport or name */
      var term = q.replace(/\b(find|search|look ?up|lookup|who is|where is|pull up|open|show( me)?|check on|candidate|candidates|visa|visas|record|records|for|me|the|of|passport( no| number)?|named|called|please|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();
      if (term.length >= 2) {
        var pp = term.match(/\b[a-z]{0,2}\d{6,9}\b/), hits;
        var alnum = function(s){ return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
        if (pp) {
          hits = cases().filter(function(c){ return alnum(c.passport).indexOf(pp[0]) >= 0; }).map(function(r){ return { k: 'case', r: r }; })
            .concat(visas().filter(function(v){ return alnum(v.passport).indexOf(pp[0]) >= 0; }).map(function(r){ return { k: 'visa', r: r }; }));
        } else {
          var toks = term.split(' ').filter(function(t){ return t.length >= 2; });
          var hit = function(name){ var n = norm(name); return n && toks.every(function(t){ return n.indexOf(t) >= 0; }); };
          hits = cases().filter(function(c){ return hit(c.name); }).map(function(r){ return { k: 'case', r: r }; })
            .concat(visas().filter(function(v){ return hit(v.fullName); }).map(function(r){ return { k: 'visa', r: r }; }));
        }
        if (hits.length === 1) return { text: 'Found one match.', html: card(hits[0].k, hits[0].r), speak: sayRecord(hits[0].k, hits[0].r) };
        if (hits.length > 1) {
          var hc = hits.filter(function(h){ return h.k === 'case'; }).map(function(h){ return h.r; }), hv = hits.filter(function(h){ return h.k === 'visa'; }).map(function(h){ return h.r; });
          return { text: hits.length + ' matches for “' + term + '”.', html: (hc.length ? list('case', hc, 10) : '') + (hv.length ? list('visa', hv, 10) : '') };
        }
        if (RX.find.test(q) || pp) return 'I couldn’t find anyone or anything matching “' + term + '”.';
      }
      return null;
    }

    function fallback(raw){
      return { text: 'I’m not sure what you mean by “' + raw + '”. I understand questions about visas, candidates, expirations, data issues and saving.',
               html: ['how many unused visas', 'any issues?', 'expiring in 30 days', 'help'].map(function(s){ return act(s, function(){ send(s, false); }); }).join('') };
    }

    function send(text, viaVoice){
      text = String(text || '').trim(); if (!text) return;
      lastViaVoice = !!viaVoice;
      add('me', text);
      var r; try { r = think(text); } catch (e) { console.error('[CLAIRE chat]', e); r = 'Something went wrong on my side (' + e.message + ').'; }
      if (r) return setTimeout(function(){ reply(r); }, 120);
      if (typeof C.brain === 'function') {
        Promise.resolve(C.brain(text, { status: C.status(), findings: C.findings ? C.findings().length : 0 }))
          .then(function(b){ reply(b || fallback(text)); }, function(){ reply(fallback(text)); });
      } else setTimeout(function(){ reply(fallback(text)); }, 120);
    }
    box.querySelector('form').addEventListener('submit', function(e){ e.preventDefault(); var t = input.value; input.value = ''; send(t, false); });
    input.addEventListener('keydown', function(e){ if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key !== 'Escape') e.stopPropagation(); });

    /* ---------------- voice out (on-device) ---------------- */
    var MODES = { auto: '🔈', on: '🔊', off: '🔇' }, TITLES = { auto: 'Voice: auto — answers aloud when you speak', on: 'Voice: always on', off: 'Voice: off' };
    function voiceMode(){ var m = LS.get('voice', 'auto'); return MODES[m] ? m : 'auto'; }
    function setVoice(m){ LS.set('voice', m); voiceBtn.textContent = MODES[m]; voiceBtn.title = TITLES[m]; }
    setVoice(voiceMode());
    voiceBtn.onclick = function(){ var m = voiceMode(), n = m === 'auto' ? 'on' : m === 'on' ? 'off' : 'auto'; setVoice(n); if (n === 'off') try { speechSynthesis.cancel(); } catch (e) {} note(TITLES[n] + '.'); };
    var TTS = 'speechSynthesis' in window, voice = null;
    function pickVoice(){
      if (!TTS) return; var vs = speechSynthesis.getVoices().filter(function(v){ return /^en/i.test(v.lang); });
      voice = vs.filter(function(v){ return /aria|jenny|sonia|libby|zira|samantha|female|hazel|susan|serena/i.test(v.name); })[0]
           || vs.filter(function(v){ return /en-(gb|us)/i.test(v.lang); })[0] || vs[0] || null;
    }
    if (TTS) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
    function spoken(t){
      return String(t).replace(/\*\*/g, '').replace(/[✦✓•]/g, '').replace(/·/g, ',').replace(/→/g, ' to ')
        .replace(/\b(VR|RC)-0*(\d+)/gi, function(_, p, n){ return p.toUpperCase().split('').join(' ') + ' ' + n; })
        .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, function(s, y, m, d){ var dt = new Date(+y, m - 1, +d); return isNaN(dt) ? s : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); })
        .replace(/\n+/g, '. ');
    }
    function speak(t){
      if (!TTS) return;
      try {
        speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(spoken(t)); if (voice) u.voice = voice; u.rate = 1.03; u.pitch = 1.05;
        u.onstart = function(){ if (dockBtn) dockBtn.classList.add('speaking'); };
        u.onend = u.onerror = function(){ if (dockBtn) dockBtn.classList.remove('speaking'); };
        speechSynthesis.speak(u);
      } catch (e) {}
    }

    /* ---------------- voice in (browser speech service) ---------------- */
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null, listening = false;
    if (!SR) { mic.disabled = true; mic.title = 'Voice input needs Chrome or Edge'; }
    function listen(){
      if (!SR) return reply('Voice input isn’t available in this browser — Chrome or Edge is needed. You can still type.');
      if (listening) { try { rec.stop(); } catch (e) {} return; }
      try { speechSynthesis.cancel(); } catch (e) {}
      var finalT = '';
      rec = new SR(); rec.lang = LS.get('voiceLang', 'en-US'); rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
      rec.onstart = function(){ listening = true; mic.classList.add('on'); input.value = ''; input.placeholder = 'Listening… speak now'; };
      rec.onresult = function(e){ var interim = ''; for (var i = e.resultIndex; i < e.results.length; i++) { var t = e.results[i][0].transcript; if (e.results[i].isFinal) finalT += t; else interim += t; } input.value = (finalT + interim).trim(); };
      rec.onerror = function(e){
        var M = { 'not-allowed': 'Microphone access is blocked — allow it from the padlock icon in the address bar.', 'service-not-allowed': 'Voice input is blocked by the browser or company policy.',
                  'no-speech': 'I didn’t hear anything — press 🎤 and try again.', network: 'Voice input needs an internet connection.', 'audio-capture': 'No microphone was found.' };
        if (e.error !== 'aborted') note(M[e.error] || 'Voice error: ' + e.error);
      };
      rec.onend = function(){ listening = false; mic.classList.remove('on'); input.placeholder = PH; var t = finalT.trim(); if (t) { input.value = ''; send(t, true); } };
      try { rec.start(); } catch (e) { note('Couldn’t start the microphone: ' + e.message); }
    }
    mic.onclick = listen;
    document.addEventListener('keydown', function(e){
      if (!(e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'v' || e.key === 'V'))) return;
      e.preventDefault();
      if (!panel.classList.contains('open') && dockBtn) dockBtn.click();
      if (!chatTab.classList.contains('on')) chatTab.click();
      listen();
    });

    /* ---------------- API ---------------- */
    C.ask = function(text){ var r = think(text); return r ? (typeof r === 'string' ? r : r.text) : '(not understood)'; };
    C.chat = function(text){ if (!panel.classList.contains('open') && dockBtn) dockBtn.click(); if (!chatTab.classList.contains('on')) chatTab.click(); send(text, false); };
    C.voice = function(m){ if (MODES[m]) setVoice(m); return voiceMode(); };
    console.log('%c✦ CLAIRE ' + V + ' — chat & voice ready (Chat tab · Alt+V to talk)', 'color:#6B4FA0;font-weight:bold');
  }
  boot(0);
})();

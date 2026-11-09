
(function HotfixV284(){
  'use strict';
  const V = '2.8.4';
  const $ = (id) => document.getElementById(id);
  const log = (...a) => console.log('%c[v2.8.4]', 'color:#3F6C4D;font-weight:bold', ...a);

  function normalizeHijri(s) { return s ? String(s).trim().replace(/[\/.]/g, '-') : ''; }
  function displayHijri(s) { return s ? String(s).trim().replace(/-/g, '/') : ''; }

  /* One-shot Hijri module patch — accept slash + dash formats.
     Safe if window.Hijri doesn't exist yet: retry ONCE after 2s,
     then give up (no repeating leak). */
  function patchHijriOnce(attempts) {
    attempts = attempts || 0;
    if (!window.Hijri) {
      if (attempts < 5) return setTimeout(() => patchHijriOnce(attempts + 1), 500);
      log('window.Hijri not available after 2.5s — slash format will still work at input level');
      return;
    }
    if (window.Hijri._v284) return;
    window.Hijri._v284 = true;
    const origHijriToGreg = window.Hijri.hijriIsoToGregorianIso.bind(window.Hijri);
    const origAddYears = window.Hijri.addHijriYearsAsGregorianIso.bind(window.Hijri);
    window.Hijri.hijriIsoToGregorianIso = function(s) { return origHijriToGreg(normalizeHijri(s)); };
    window.Hijri.addHijriYearsAsGregorianIso = function(s, y) { return origAddYears(normalizeHijri(s), y); };
    log('Hijri module accepts slash + dash formats');
  }
  patchHijriOnce();

  /* One-time cosmetic tweak — no observers, no polling.
     Called ONLY when openVisaForm is invoked, and only executes
     its actual work if the field hasn't been touched by v2.8.4 yet. */
  function applySlashFormat() {
    const qDate = $('vf_qiwaVisaDate');
    if (!qDate) return;
    if (qDate.dataset.v284) return;
    qDate.dataset.v284 = '1';

    // If v2.8.0 already converted the field, we just cosmetically adjust.
    // If v2.8.0 didn't run for any reason, we do the conversion ourselves.
    if (qDate.type !== 'text') qDate.type = 'text';
    qDate.placeholder = '1447/07/01';
    qDate.pattern = '\\d{4}[\\/\\-]\\d{2}[\\/\\-]\\d{2}';   /* v7.1.0: escaped for Edge v-flag */

    const parent = qDate.parentNode;
    const label = parent && parent.querySelector('label');
    if (label && /QIWA Visa Date/i.test(label.textContent)) {
      label.textContent = 'QIWA Visa Date (Hijri, yyyy/mm/dd)';
    }

    // Convert dash form to slash for display
    if (qDate.value && /^\d{4}-\d{2}-\d{2}$/.test(qDate.value)) {
      qDate.value = displayHijri(qDate.value);
    }

    // If v2.8.0's Gregorian shadow spans aren't present, add them.
    // (This makes v2.8.4 self-sufficient even without v2.8.0.)
    if (!$('vf_qiwaVisaDate_greg')) {
      const shadow = document.createElement('div');
      shadow.style.cssText = 'margin-top:4px;font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#6B6558;padding:3px 8px;background:rgba(46,111,163,.06);border-left:2px solid #2E6FA3;border-radius:0 3px 3px 0;display:inline-block;letter-spacing:.02em;';
      shadow.id = 'vf_qiwaVisaDate_greg';
      shadow.innerHTML = 'Gregorian: <strong id="vf_qiwaVisaDate_greg_val" style="color:#23201B;font-weight:500;">—</strong>';
      parent.appendChild(shadow);
    }
    const qExp = $('vf_expirationDate');
    if (qExp) {
      if (qExp.type !== 'text') qExp.type = 'text';
      qExp.readOnly = true;
      qExp.placeholder = 'auto';
      qExp.style.background = 'rgba(63,108,77,.05)';
      qExp.style.color = '#3F6C4D';
      qExp.style.cursor = 'not-allowed';
      qExp.style.fontWeight = '500';
      if (!$('vf_expirationDate_greg')) {
        const shadow2 = document.createElement('div');
        shadow2.style.cssText = 'margin-top:4px;font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#6B6558;padding:3px 8px;background:rgba(46,111,163,.06);border-left:2px solid #2E6FA3;border-radius:0 3px 3px 0;display:inline-block;letter-spacing:.02em;';
        shadow2.id = 'vf_expirationDate_greg';
        shadow2.innerHTML = 'Gregorian expiry: <strong id="vf_expirationDate_greg_val" style="color:#23201B;font-weight:500;">—</strong>';
        qExp.parentNode.appendChild(shadow2);
      }
    }

    // Attach ONE re-entry-guarded input listener.
    let busy = false;
    const recompute = () => {
      if (busy) return;
      busy = true;
      try {
        const raw = qDate.value.trim();
        const normalized = normalizeHijri(raw);
        const gv = $('vf_qiwaVisaDate_greg_val');
        const ev = $('vf_expirationDate_greg_val');
        const exp = $('vf_expirationDate');
        if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
          if (gv) gv.textContent = '—';
          if (ev) ev.textContent = '—';
          if (exp && exp.value !== '') exp.value = '';
          return;
        }
        if (!window.Hijri) return;
        const g1 = window.Hijri.hijriIsoToGregorianIso(normalized);
        if (gv) gv.textContent = g1 || '—';
        const g2 = window.Hijri.addHijriYearsAsGregorianIso(normalized, 2);
        if (exp && exp.value !== g2) exp.value = g2 || '';
        if (ev) ev.textContent = g2 || '—';
      } finally {
        busy = false;
      }
    };
    qDate.addEventListener('input', recompute);
    recompute();   // sync shadows once

    // Candidate visa expiration = +90 days (Gregorian)
    const cDate = $('vf_candidateVisaDate');
    const cExp = $('vf_candidateVisaExpiration');
    if (cDate && cExp && !cDate.dataset.v284) {
      cDate.dataset.v284 = '1';
      cExp.readOnly = true;
      cExp.style.background = 'rgba(63,108,77,.05)';
      cExp.style.color = '#3F6C4D';
      cExp.style.cursor = 'not-allowed';
      let cBusy = false;
      const cRec = () => {
        if (cBusy) return;
        cBusy = true;
        try {
          const v = cDate.value;
          if (!v) { if (cExp.value !== '') cExp.value = ''; return; }
          const d = new Date(v);
          if (isNaN(d.getTime())) return;
          d.setDate(d.getDate() + 90);
          const iso = d.toISOString().slice(0, 10);
          if (cExp.value !== iso) cExp.value = iso;
        } finally { cBusy = false; }
      };
      cDate.addEventListener('input', cRec);
      cRec();
    }
  }

  /* Wrap openVisaForm — the SAME function v2.8.0 wraps.
     We call our enhancement AFTER v2.8.0's setTimeout(100) with a 300ms delay. */
  function wrapOpenVisaForm() {
    const orig = window.openVisaForm;
    if (typeof orig !== 'function') return setTimeout(wrapOpenVisaForm, 500);
    if (orig._v284) return;
    const wrapped = function() {
      const ret = orig.apply(this, arguments);
      setTimeout(() => { try { applySlashFormat(); } catch (e) { console.warn('[v2.8.4] apply failed:', e.message); } }, 300);
      return ret;
    };
    wrapped._v284 = true;
    window.openVisaForm = wrapped;
    log('openVisaForm wrapped (v2.8.4)');
  }
  wrapOpenVisaForm();

  /* Persist slash form on save. Attaches a ONE-TIME click delegate. */
  document.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('#vf_saveBtn');
    if (!saveBtn) return;
    setTimeout(() => {
      try {
        if (!window.DB) return;
        const qDate = $('vf_qiwaVisaDate');
        if (!qDate) return;
        const input = qDate.value.trim();
        if (!input) return;
        const displayForm = displayHijri(normalizeHijri(input));
        const recs = window.DB.visaRecords || [];
        for (let i = recs.length - 1; i >= 0; i--) {
          const v = recs[i];
          if (!v.qiwaVisaDateHijri) continue;
          if (normalizeHijri(v.qiwaVisaDateHijri) === normalizeHijri(input)) {
            if (v.qiwaVisaDateHijri !== displayForm) {
              v.qiwaVisaDateHijri = displayForm;
              if (window.dbSave) window.dbSave();
            }
            break;
          }
        }
      } catch (e) { console.warn('[v2.8.4] save-normalize:', e.message); }
    }, 500);
  }, true);

  console.log('%c✓ Hijri slash format v' + V + ' active (no observers, freeze-safe)', 'color:#3F6C4D;font-weight:bold;');
})();


(function R01CandVisaExpiryV550(){
  'use strict';
  if(window.__entR01P3bV550) return; window.__entR01P3bV550=true;
  const V='5.5.0';
  const $=(id)=>document.getElementById(id);
  const log=(...a)=>console.log('%c[v5.5.0 CandVisaExp]','color:#2E6FA3;font-weight:bold',...a);

  function grid(){ return $('vdGrid'); }
  function overlayOpen(){ const o=$('vdOverlay'); return o&&o.classList.contains('open'); }
  function cellInput(tr, field){ return tr.querySelector('[data-f="'+field+'"]'); }

  /* ---- Gregorian date parse/format + 90 days (validated) ---- */
  function parseGreg(s){
    s=String(s==null?'':s).trim(); if(!s) return null; let m;
    if(m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/)) return {y:+m[1],mo:+m[2],d:+m[3],fmt:'ymd',sep:s.includes('/')?'/':(s.includes('.')?'.':'-')};
    if(m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/)) return {y:+m[3],mo:+m[1],d:+m[2],fmt:'dmy',sep:s.includes('/')?'/':(s.includes('.')?'.':'-')};
    return null;
  }
  function fmtOut(y,mo,d,p){ const pad=n=>String(n).padStart(2,'0'); const sep=p.sep||'/'; return p.fmt==='dmy'?[pad(d),pad(mo),y].join(sep):[y,pad(mo),pad(d)].join(sep); }
  function plus90(s){
    const p=parseGreg(s); if(!p) return '';
    const dt=new Date(p.y, p.mo-1, p.d); if(isNaN(dt.getTime())) return '';
    /* guard: reject impossible dates like 31/02 that Date() would roll */
    if(dt.getMonth()!==p.mo-1 || dt.getDate()!==p.d) return '';
    dt.setDate(dt.getDate()+90);       /* fixed 90 days — leap-safe, month-length-safe */
    return fmtOut(dt.getFullYear(), dt.getMonth()+1, dt.getDate(), p);
  }

  /* ---- lock the expiration cell (read-only, remove picker) ---- */
  function lockExpiration(eInp){
    if(!eInp) return; const td=eInp.closest('td'); if(td) td.classList.add('vd-cvexp-ro');
    eInp.readOnly=true; eInp.setAttribute('readonly','readonly'); eInp.tabIndex=-1;
    eInp.title='Auto-computed: Cand. Visa Issuance + 90 days. Cannot be edited.';
    /* hide any calendar toggle/button in this cell */
    if(td){ td.querySelectorAll('.cal, .vd-cal, [class*="cal"], button').forEach(b=>{ if(b!==eInp) b.style.display='none'; }); }
    /* block typing/picker just in case */
    if(!eInp.dataset.cveLocked){ eInp.dataset.cveLocked='1';
      eInp.addEventListener('keydown',(e)=>{ e.preventDefault(); });
      eInp.addEventListener('focus',()=>{ eInp.blur(); });
    }
  }

  function recompute(tr){
    const iInp=cellInput(tr,'candVisaIssuance'); const eInp=cellInput(tr,'candVisaExpiration');
    if(!eInp) return;
    lockExpiration(eInp);
    const val=iInp?plus90(iInp.value):'';
    if(eInp.value!==val){
      eInp.value=val;
      eInp.dispatchEvent(new Event('input',{bubbles:true}));   /* so Save picks it up */
      const td=eInp.closest('td'); if(td){ td.classList.remove('vd-cvexp-flash'); void td.offsetWidth; td.classList.add('vd-cvexp-flash'); }
    }
  }

  /* wire issuance edits (delegated, once) */
  function wire(){
    const g=grid(); if(!g||g.dataset.cveWired==='1') return; g.dataset.cveWired='1';
    const handler=(e)=>{ const inp=e.target; if(inp&&inp.dataset&&inp.dataset.f==='candVisaIssuance'){ const tr=inp.closest('tr'); if(tr) recompute(tr); } };
    g.addEventListener('input', handler, true);
    g.addEventListener('change', handler, true);
  }

  function setupRows(){
    const g=grid(); if(!g) return;
    g.querySelectorAll('tbody tr').forEach(tr=>{
      const eInp=cellInput(tr,'candVisaExpiration'); if(!eInp) return;
      /* always keep it locked + in sync; cheap idempotent check */
      lockExpiration(eInp);
      if(tr.dataset.cveDone!=='1'){ recompute(tr); tr.dataset.cveDone='1'; }
    });
  }

  function tick(){ if(!overlayOpen()) return; wire(); setupRows(); }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('r01.candVisaExp', tick, 700); }
  else { setInterval(tick, 700); }
  tick();
  const mo=new MutationObserver(()=>{ if(overlayOpen()){ wire(); setupRows(); } });
  try{ const ov=$('vdOverlay'); if(ov) mo.observe(ov,{childList:true,subtree:true}); }catch(e){}

  window._entPlus90=plus90;
  console.log('%c🗓 R-01 Cand. Visa Expiration v'+V+' active — Issuance + 90 days (leap-safe), read-only','color:#2E6FA3;font-weight:bold;');
})();

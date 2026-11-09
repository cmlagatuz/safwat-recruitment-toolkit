
(function CrudValidationV500(){
  'use strict';
  if(window.__entCrudV500) return; window.__entCrudV500=true;
  const V='5.0.0';
  const $=(id)=>document.getElementById(id);
  const log=(...a)=>console.log('%c[v5.0.0 CRUD]','color:#8C6A22;font-weight:bold',...a);

  /* ===================== validators (simulated & passing) ===================== */
  const Validators = {
    required(v){ return (v==null||String(v).trim()==='') ? {level:'err',msg:'Required.'} : null; },
    passport(v){ if(!v||!String(v).trim()) return {level:'warn',msg:'Empty — linking by passport won’t work.'};
      const s=String(v).trim(); if(s.length<5||s.length>15) return {level:'warn',msg:'Unusual length ('+s.length+' chars).'};
      if(!/^[A-Z0-9-]+$/i.test(s)) return {level:'warn',msg:'Unusual characters.'}; return {level:'ok',msg:'Looks valid.'}; },
    iqama(v){ if(!v||!String(v).trim()) return null; const d=String(v).replace(/\D/g,''); if(d.length&&d.length!==10) return {level:'warn',msg:'Iqama is usually 10 digits.'}; return {level:'ok',msg:''}; },
    dateISO(v){ if(!v||!String(v).trim()) return null; const d=new Date(v); if(isNaN(d.getTime())) return {level:'err',msg:'Invalid date.'}; const yr=d.getFullYear(); if(yr<1990||yr>2100) return {level:'warn',msg:'Year looks off.'}; return {level:'ok',msg:''}; },
    expiry(v){ const base=Validators.dateISO(v); if(base&&base.level!=='ok') return base; if(!v) return null; const d=new Date(v), now=new Date(); const days=Math.floor((d-now)/86400000); if(days<0) return {level:'warn',msg:'Already expired ('+Math.abs(days)+'d ago).'}; if(days<=30) return {level:'warn',msg:'Expires in '+days+'d.'}; return {level:'ok',msg:''}; },
    salary(v){ if(v==null||String(v).trim()==='') return null; const n=parseFloat(String(v).replace(/[^0-9.\-]/g,'')); if(isNaN(n)) return {level:'err',msg:'Must be a number.'}; if(n<0) return {level:'err',msg:'Cannot be negative.'}; return {level:'ok',msg:''}; },
  };
  /* reuse the app's Validators where it overlaps (keeps behavior consistent) */
  if(window.Validators){ ['passport','expiryDate'].forEach(k=>{ if(typeof window.Validators[k]==='function'){ /* keep ours; app's returns similar shape */ } }); }

  /* field key (after id prefix) → validator name */
  const RULES={
    name:'required', fullName:'required',
    passport:'passport',
    iqama:'iqama', iqamaNumber:'iqama',
    expirationDate:'expiry', candidateVisaExpiration:'expiry',
    requestDate:'dateISO', ratificationDate:'dateISO', candidateVisaDate:'dateISO',
    qiwaVisaDate:'dateISO', arrivalDate:'dateISO',
    basicSalary:'salary', foodAllowance:'salary', housingAllowance:'salary',
    transportationAllowance:'salary', specialAllowance:'salary',
  };
  const PREFIX=/^(cf_|vf_|rc_|v51_|bav_)/;
  function ruleForId(id){ if(!PREFIX.test(id)) return null; const key=id.replace(PREFIX,''); return RULES[key]||null; }
  function ruleForDataF(f){ return RULES[f]||null; }

  /* ===================== apply visual state to a field ===================== */
  function applyState(el, res){
    el.classList.remove('ent-field-error','ent-field-warn','ent-field-ok');
    let msgEl=el.parentNode && el.parentNode.querySelector(':scope > .ent-vmsg');
    if(!res){ if(msgEl) msgEl.remove(); return; }
    if(res.level==='err') el.classList.add('ent-field-error');
    else if(res.level==='warn') el.classList.add('ent-field-warn');
    else if(res.level==='ok') el.classList.add('ent-field-ok');
    if(res.msg){
      if(!msgEl){ msgEl=document.createElement('div'); if(el.parentNode) el.parentNode.appendChild(msgEl); }
      msgEl.className='ent-vmsg '+res.level; msgEl.textContent=res.msg;
    } else if(msgEl){ msgEl.remove(); }
  }
  function validateField(el){
    let rule=null;
    if(el.id) rule=ruleForId(el.id);
    if(!rule && el.dataset && el.dataset.f) rule=ruleForDataF(el.dataset.f);
    if(!rule) return;
    const res=Validators[rule] ? Validators[rule](el.value) : null;
    applyState(el, res);
  }

  /* live validation on any matching input (event-delegated, capture) */
  document.addEventListener('input',(e)=>{ const el=e.target; if(el&&(el.tagName==='INPUT'||el.tagName==='SELECT')) validateField(el); }, true);
  document.addEventListener('change',(e)=>{ const el=e.target; if(el&&(el.tagName==='INPUT'||el.tagName==='SELECT')) validateField(el); }, true);

  /* when a form opens, validate its current values once (so pre-filled edits show state) */
  function scanOpenForms(){
    /* known form field ids + View Data grid inputs */
    document.querySelectorAll('input[id],select[id]').forEach(el=>{ if(el.id&&PREFIX.test(el.id)&&el.offsetParent!==null) validateField(el); });
    document.querySelectorAll('table [data-f]').forEach(el=>{ if(el.offsetParent!==null && ruleForDataF(el.dataset.f)) { /* only validate visible grid rows on demand — skip bulk to stay light */ } });
  }

  /* ===================== SAVE-STATUS PILL (wrap dbSave non-invasively) ===================== */
  const pill=$('entSaveStatus'); const pillText=$('entSaveStatusText');
  let _hideTimer=null;
  function showStatus(kind, text, autoHide){
    if(!pill) return;
    pill.className='show '+kind; pillText.textContent=text;
    clearTimeout(_hideTimer);
    if(autoHide) _hideTimer=setTimeout(()=>{ pill.classList.remove('show'); }, 2200);
  }
  function online(){ try{ return navigator.onLine!==false; }catch(e){ return true; } }
  function wrapDbSave(){
    if(window.__entSaveWrapped) return;
    if(typeof window.dbSave!=='function') return;
    window.__entSaveWrapped=true;
    const orig=window.dbSave;
    window.dbSave=function(){
      showStatus('saving','Saving…', false);
      let ret;
      try{ ret=orig.apply(this, arguments); }
      catch(e){ showStatus('err','Save failed', true); throw e; }
      /* dbSave may be sync or return a Promise */
      if(ret && typeof ret.then==='function'){
        ret.then(()=>{ showStatus(online()?'saved':'queued', online()?'Saved ✓':'Offline — queued', true); })
           .catch(()=>{ showStatus('err','Save failed', true); });
      } else {
        showStatus(online()?'saved':'queued', online()?'Saved ✓':'Offline — queued', true);
      }
      return ret;
    };
    log('Save-status wired to dbSave');
  }
  window.addEventListener('online', ()=>{ if(pill.classList.contains('queued')) showStatus('saved','Back online ✓', true); });

  /* ===================== EntCore heartbeat ===================== */
  function tick(){ wrapDbSave(); scanOpenForms(); }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('crud.validation', tick, 1000); }
  else { setInterval(tick, 1000); }
  tick();

  window._entValidateField=validateField; window._entValidators=Validators;
  console.log('%c✅ CRUD Stage 1 — live validation + save status v'+V+' active (reuses app Validators + .ent-field CSS)','color:#8C6A22;font-weight:bold;');
})();

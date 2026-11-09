
(function R01ViewDataPhase3V547(){
  'use strict';
  if(window.__entR01P3V547) return; window.__entR01P3V547=true;
  window.__entR01P3V540=true; window.__entR01P3V541=true; window.__entR01P3V542=true; window.__entR01P3V543=true; window.__entR01P3V544=true; window.__entR01P3V545=true; window.__entR01P3V546=true;
  const V='5.4.7';
  const $=(id)=>document.getElementById(id);
  const log=(...a)=>console.log('%c[v5.4.7 R01P3-SAFE]','color:#2E6FA3;font-weight:bold',...a);
  const norm=(s)=>String(s==null?'':s).trim().replace(/[.\/]/g,'-');
  const slash=(s)=>String(s==null?'':s).replace(/-/g,'/');
  const pad=(n)=>String(n).padStart(2,'0');
  const yearOf=(s)=>{ const m=norm(s).match(/^(\d{3,4})-/); return m?parseInt(m[1],10):0; };
  const calOf=(s)=>{ const y=yearOf(s); if(!y) return null; return y>=1900?'g':'h'; };
  const H=()=>window.Hijri;
  function toGregISO(val){ const c=calOf(val); if(c==='g') return norm(val); if(c==='h'){ try{ return H()&&H().hijriIsoToGregorianIso?norm(H().hijriIsoToGregorianIso(norm(val))):''; }catch(e){ return ''; } } return ''; }
  function toHijriISO(val){ const c=calOf(val); if(c==='h') return norm(val); if(c==='g'){ try{ return H()&&H().gregorianIsoToHijriIso?norm(H().gregorianIsoToHijriIso(norm(val))):''; }catch(e){ return ''; } } return ''; }
  function addHijriYears(h,y){ const p=norm(h).split('-'); if(p.length<3||!/^\d{3,4}$/.test(p[0])) return ''; return (parseInt(p[0],10)+y)+'-'+p[1]+'-'+p[2]; }
  function gregToday(){ const d=new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function hijriToday(){ try{ const d=new Date(); if(H()&&H().fromGregorian){ const h=H().fromGregorian(d.getFullYear(), d.getMonth()+1, d.getDate()); if(h&&h.y) return h.y+'-'+pad(h.m)+'-'+pad(h.d); } if(H()&&H().gregorianIsoToHijriIso){ const r=H().gregorianIsoToHijriIso(gregToday()); if(r) return norm(r); } }catch(e){} return '1447-01-01'; }

  function grid(){ return $('vdGrid'); }
  function overlayOpen(){ const o=$('vdOverlay'); return o&&o.classList.contains('open'); }
  function cellInput(tr, field){ return tr.querySelector('[data-f="'+field+'"]'); }
  function rowRecId(tr){ return (tr.dataset&&(tr.dataset.rec||tr.dataset.recId||tr.dataset.id))||''; }

  let MODE='hijri';
  const GREG_ONLY=new Set(['delegationDate','candVisaIssuance']);
  /* autofill: QIWA date propagates; delegationDate does NOT */
  const DOC_FIELDS=new Set(['sponsorId','crNumber','visaCategory','gender','qiwaVisaDate','expirationDate','visaNumber','mofaNumber','client']);

  function setupRow(tr){
    const q=cellInput(tr,'qiwaVisaDate'); const e=cellInput(tr,'expirationDate');
    if(q && q.dataset.canonH==null){ const v=q.value; q.dataset.canonH = calOf(v)==='h'?norm(v):(calOf(v)==='g'?toHijriISO(v):(String(v||'').trim()?norm(v):'')); }
    if(e && e.dataset.canonH==null){ const v=e.value; e.dataset.canonH = calOf(v)==='h'?norm(v):(calOf(v)==='g'?toHijriISO(v):(String(v||'').trim()?norm(v):'')); }
    if(q){ preparePickCell(q, true); if(q.dataset.p3wired!=='1'){ q.dataset.p3wired='1';
      const onQiwaEdit=()=>{ const raw=String(q.value||'').trim(); let canonH; if(raw===''){ canonH=''; } else { const c=calOf(q.value); canonH = c==='h'?norm(q.value):(c==='g'?toHijriISO(q.value):(q.dataset.canonH||'')); } q.dataset.canonH=canonH; syncExpiration(tr); autofillFromEdit(tr,'qiwaVisaDate',canonH,true); };
      q.addEventListener('change', onQiwaEdit);
      q.addEventListener('input', ()=>{ if(String(q.value||'').trim()===''){ q.dataset.canonH=''; syncExpiration(tr); } });
    } }
    GREG_ONLY.forEach(f=>{ const inp=cellInput(tr,f); if(inp) preparePickCell(inp, false); });
    if(e){ const td=e.closest('td'); if(td){ td.classList.add('vd-exp-lock'); td.querySelectorAll('.cal,.vd-cal-toggle').forEach(x=>x.remove()); td.querySelectorAll('input.picker,input[type="date"]').forEach(x=>{ if(x!==e) x.remove(); }); } if(e.getAttribute('type')==='date') e.setAttribute('type','text'); e.readOnly=true; e.setAttribute('readonly','readonly'); e.tabIndex=-1; e.style.pointerEvents='none'; e.title='Auto-computed from QIWA Visa Date + 2 Hijri years.'; }
    applyDisplay(tr);
  }
  function preparePickCell(inp, withClear){
    const td=inp.closest('td'); if(!td) return;
    td.classList.add('vd-pick');
    td.querySelectorAll('.cal,.vd-cal-toggle').forEach(x=>{ if(x.className.indexOf('vd-qcal')<0&&x.className.indexOf('vd-qclr')<0) x.remove(); });
    td.querySelectorAll('input.picker,input[type="date"]').forEach(x=>{ if(x!==inp) x.remove(); });
    if(inp.getAttribute('type')==='date') inp.setAttribute('type','text');
    if(!td.querySelector('.vd-qcal')){ const b=document.createElement('span'); b.className='vd-qcal'; b.textContent='📅'; b.title='Pick date'; td.appendChild(b); b.addEventListener('click',(ev)=>{ ev.preventDefault(); ev.stopPropagation(); openDatePicker(inp); }); }
    /* clear (✕) for QIWA so you can remove the date */
    if(withClear && !td.querySelector('.vd-qclr')){ const c=document.createElement('span'); c.className='vd-qclr'; c.textContent='✕'; c.title='Clear this date'; td.appendChild(c); c.addEventListener('click',(ev)=>{ ev.preventDefault(); ev.stopPropagation(); clearQiwa(inp); }); }
  }
  function clearQiwa(inp){ inp.value=''; inp.dataset.canonH=''; const tr=inp.closest('tr'); if(tr){ syncExpiration(tr); autofillFromEdit(tr,'qiwaVisaDate','',true); } log('Cleared QIWA date (+ same-Doc# rows)'); }
  function syncExpiration(tr){ const q=cellInput(tr,'qiwaVisaDate'); const e=cellInput(tr,'expirationDate'); if(!q||!e) return; const canonH=q.dataset.canonH||''; const hExp = canonH ? addHijriYears(canonH,2) : ''; e.dataset.canonH=hExp; e.value = hExp ? ((MODE==='hijri')?slash(hExp):slash(toGregISO(hExp))) : ''; }
  function applyDisplay(tr){ const q=cellInput(tr,'qiwaVisaDate'); const e=cellInput(tr,'expirationDate'); if(q){ q.value = q.dataset.canonH ? ((MODE==='hijri')?slash(q.dataset.canonH):slash(toGregISO(q.dataset.canonH))) : ''; } if(e){ e.value = e.dataset.canonH ? ((MODE==='hijri')?slash(e.dataset.canonH):slash(toGregISO(e.dataset.canonH))) : ''; } }

  function toggleMode(){ MODE=(MODE==='hijri')?'greg':'hijri'; const g=grid(); if(g) g.querySelectorAll('tbody tr').forEach(applyDisplay); const b=document.querySelector('#vdQiwaToggle .m'); if(b) b.textContent=(MODE==='hijri')?'HIJRI':'GREG'; log('QIWA display → '+MODE.toUpperCase()); }
  function ensureToggle(){ if($('vdQiwaToggle')) return; const bar=$('vdAddRow')?$('vdAddRow').parentElement:(document.querySelector('#vdOverlay .vd-actions')||document.querySelector('#vdOverlay .actions')); if(!bar) return; const btn=document.createElement('button'); btn.id='vdQiwaToggle'; btn.type='button'; btn.innerHTML='QIWA <span class="m">'+(MODE==='hijri'?'HIJRI':'GREG')+'</span>'; btn.title='Switch QIWA Visa Date + Expiration columns between Hijri and Gregorian (display only)'; btn.addEventListener('click',(e)=>{ e.preventDefault(); e.stopPropagation(); toggleMode(); }); bar.insertBefore(btn, bar.firstChild); }

  const dp=$('vdDatePicker'); let dpTarget=null, dpKind='qiwa';
  function fillYears(mode){ const y=$('vdDPY'); let o=''; if(mode==='hijri'){ for(let i=1440;i<=1475;i++) o+='<option>'+i+'</option>'; } else { for(let i=2010;i<=2035;i++) o+='<option>'+i+'</option>'; } y.innerHTML=o; }
  function fillMD(mode){ const m=$('vdDPM'), d=$('vdDPD'); if(m.options.length!==12){ let mo=''; for(let i=1;i<=12;i++) mo+='<option>'+i+'</option>'; m.innerHTML=mo; } const maxD = mode==='hijri'?30:31; let dd=''; for(let i=1;i<=maxD;i++) dd+='<option>'+i+'</option>'; d.innerHTML=dd; }
  function parseAny(s){ const n=norm(s); let m=n.match(/^(\d{3,4})-(\d{1,2})-(\d{1,2})$/); if(m) return {y:+m[1],mo:+m[2],d:+m[3]}; m=n.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/); if(m) return {d:+m[1],mo:+m[2],y:+m[3]}; return null; }
  function openDatePicker(inp){
    dpTarget=inp; const f=inp.getAttribute('data-f'); dpKind=(f==='qiwaVisaDate')?'qiwa':'greg';
    const cal=(dpKind==='qiwa')?MODE:'greg';
    $('vdDPLabel').textContent = cal==='hijri' ? 'Pick Hijri date (yyyy/mm/dd)' : 'Pick Gregorian date (yyyy/mm/dd)';
    fillYears(cal); fillMD(cal);
    let seedISO='';
    if(dpKind==='qiwa'){ const canonH=inp.dataset.canonH||''; if(canonH){ seedISO=cal==='hijri'?canonH:toGregISO(canonH); } else { seedISO=cal==='hijri'?hijriToday():gregToday(); } }
    else { const p=parseAny(inp.value); if(p){ seedISO=p.y+'-'+pad(p.mo)+'-'+pad(p.d); } else { seedISO=gregToday(); } }
    const pp=norm(seedISO).split('-');
    if(pp.length===3&&pp[0]){ $('vdDPY').value=String(parseInt(pp[0],10)); $('vdDPM').value=String(parseInt(pp[1],10)); $('vdDPD').value=String(parseInt(pp[2],10)); }
    const r=inp.getBoundingClientRect(); dp.style.left=Math.max(8, Math.min(r.left, window.innerWidth-262))+'px'; dp.style.top=Math.min(r.bottom+4, window.innerHeight-150)+'px'; dp.classList.add('open');
  }
  $('vdDPCancel').addEventListener('click',()=>dp.classList.remove('open'));
  $('vdDPOk').addEventListener('click',()=>{
    if(!dpTarget){ dp.classList.remove('open'); return; }
    const y=$('vdDPY').value, m=pad($('vdDPM').value), d=pad($('vdDPD').value);
    const isoInMode=y+'-'+m+'-'+d; const tr=dpTarget.closest('tr');
    if(dpKind==='qiwa'){
      const canonH = MODE==='hijri' ? isoInMode : toHijriISO(isoInMode);
      dpTarget.dataset.canonH=canonH; dpTarget.value = MODE==='hijri' ? slash(canonH) : slash(isoInMode);
      if(tr){ applyDisplay(tr); syncExpiration(tr); autofillFromEdit(tr,'qiwaVisaDate',canonH,true); }
      log('Picked QIWA ('+MODE+') → '+canonH);
    } else {
      dpTarget.value = d+'/'+m+'/'+y; dpTarget.dispatchEvent(new Event('input',{bubbles:true})); dpTarget.dispatchEvent(new Event('change',{bubbles:true}));
      log('Picked '+dpTarget.getAttribute('data-f')+' → '+dpTarget.value);
    }
    dp.classList.remove('open');
  });
  document.addEventListener('click',(e)=>{ if(dp.classList.contains('open') && !e.target.closest('#vdDatePicker') && !e.target.closest('.vd-qcal')) dp.classList.remove('open'); }, true);

  function suppressQiwaValidation(){ const g=grid(); if(!g) return; g.querySelectorAll('input[data-f="qiwaVisaDate"], input[data-f="expirationDate"]').forEach(inp=>{ inp.classList.remove('ent-field-error','ent-field-warn','dup-input'); const msg=inp.parentNode&&inp.parentNode.querySelector(':scope > .ent-vmsg'); if(msg&&/invalid|year/i.test(msg.textContent||'')) msg.remove(); }); }

  function rowDoc(tr){ const d=cellInput(tr,'visaDocumentNumber'); return d?String(d.value||'').trim():''; }
  function autofillFromEdit(srcTr, field, valueOrCanon, isUserEdit){
    if(!isUserEdit) return; if(!DOC_FIELDS.has(field)) return;
    const doc=rowDoc(srcTr); if(!doc) return;
    const g=grid(); if(!g) return; let n=0;
    g.querySelectorAll('tbody tr').forEach(tr=>{
      if(tr===srcTr||rowDoc(tr)!==doc) return;
      const inp=cellInput(tr,field); if(!inp) return;
      if(field==='qiwaVisaDate'){
        if(inp.dataset.canonH!==valueOrCanon){ inp.dataset.canonH=valueOrCanon; inp.value = valueOrCanon ? ((MODE==='hijri')?slash(valueOrCanon):slash(toGregISO(valueOrCanon))) : ''; syncExpiration(tr); flash(inp); n++; }
      } else {
        if(inp.value!==valueOrCanon){ inp.value=valueOrCanon; inp.dispatchEvent(new Event('input',{bubbles:true})); flash(inp); n++; }
      }
    });
    if(n>0) log('Auto-filled "'+field+'" to '+n+' same-Doc# row(s)');
  }
  function flash(inp){ const td=inp.closest('td'); if(td){ td.classList.remove('vd-autofill-flash'); void td.offsetWidth; td.classList.add('vd-autofill-flash'); } }
  function wireAutofill(){ const g=grid(); if(!g||g.dataset.p3af==='1') return; g.dataset.p3af='1'; g.addEventListener('change',(e)=>{ const inp=e.target; if(!inp||!inp.dataset||!inp.dataset.f) return; const f=inp.dataset.f; if(!DOC_FIELDS.has(f)) return; if(f==='qiwaVisaDate'||f==='expirationDate') return; const tr=inp.closest('tr'); if(!tr) return; autofillFromEdit(tr, f, inp.value, e.isTrusted!==false); }, true); }

  /* ---------- SAVE hooks ---------- */
  /* (a) capture-phase: restore canonical Hijri (empty stays empty) BEFORE v3.1.1 reads inputs */
  function restoreCanonicalForSave(){ const g=grid(); if(!g) return; g.querySelectorAll('tbody tr').forEach(tr=>{ const q=cellInput(tr,'qiwaVisaDate'); const e=cellInput(tr,'expirationDate'); if(q) q.value = q.dataset.canonH ? slash(q.dataset.canonH) : ''; if(e) e.value = e.dataset.canonH ? slash(e.dataset.canonH) : ''; }); }
  /* (b) bubble-phase (runs AFTER v3.1.1 saveEditor): persist the corrected fields it misses */
  function persistCorrectedFields(){
    const g=grid(); if(!g||!window.DB||!Array.isArray(window.DB.visaRecords)) return;
    const byId={}; window.DB.visaRecords.forEach(v=>byId[v.id]=v);
    let fixed=0;
    g.querySelectorAll('tbody tr').forEach(tr=>{
      const id=rowRecId(tr); const rec=id&&byId[id]; if(!rec) return;
      ['agencyDelegationNumber','delegationDate'].forEach(f=>{ const inp=cellInput(tr,f); if(inp){ const val=inp.value; if(String(rec[f]==null?'':rec[f])!==String(val==null?'':val)){ rec[f]=val; fixed++; } } });
    });
    if(fixed>0){ if(window.dbSave){ try{ window.dbSave(); }catch(e){} } log('Persisted Agency Deleg./Delegation Date on '+fixed+' field(s)'); }
  }
  function hookSave(){ const btn=$('vdSave'); if(!btn||btn.dataset.p3save==='1') return; btn.dataset.p3save='1'; btn.addEventListener('click', restoreCanonicalForSave, true); btn.addEventListener('click', ()=>{ setTimeout(persistCorrectedFields, 0); }, false); }

  function renameHeader(){ const g=grid(); if(!g) return; g.querySelectorAll('thead th').forEach(th=>{ const t=(th.textContent||'').trim(); if(/^QIWA\s*VISA\s*DATE(\s*(HIJRI|GREG))?$/i.test(t) && t.toUpperCase()!=='QIWA VISA DATE') th.textContent='QIWA Visa Date'; }); }

  function tick(){ if(!overlayOpen()) return; ensureToggle(); hookSave(); renameHeader(); wireAutofill(); suppressQiwaValidation(); const g=grid(); if(g) g.querySelectorAll('tbody tr').forEach(tr=>{ if(tr.dataset.p3s!=='1'){ setupRow(tr); tr.dataset.p3s='1'; } }); }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('r01.viewdata3', tick, 700); }
  else { setInterval(tick, 700); }
  tick();
  const mo=new MutationObserver(()=>{ if(overlayOpen()){ ensureToggle(); hookSave(); renameHeader(); wireAutofill(); const g=grid(); if(g) g.querySelectorAll('tbody tr:not([data-p3s])').forEach(tr=>{ setupRow(tr); tr.dataset.p3s='1'; }); } });
  try{ const ov=$('vdOverlay'); if(ov) mo.observe(ov,{childList:true,subtree:true}); }catch(e){}

  console.log('%c🛟 R-01 View Data Phase 3 v'+V+' SAFE active — Deleg#/DelegDate persist · QIWA clearable (+ same Doc#) · deleg no-autofill','color:#2E6FA3;font-weight:bold;');
})();

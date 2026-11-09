
(function SafwatV450(){
  'use strict';
  if(window.__entV450) return; window.__entV450=true;
  const V='4.5.0';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const has=(v)=>v!=null&&String(v).trim()!=='';
  const log=(...a)=>console.log('%c[v4.5.0]','color:#2F5A3B;font-weight:bold',...a);
  const DB=()=>window.DB||{};

  /* =====================================================
     1) field sync — fill empty partners only, never overwrite
     ===================================================== */
  const PAIRS=[
    ['candVisaIssuance','candidateVisaDate'],
    ['candVisaExpiration','candidateVisaExpiration'],
    ['delegationDate','ratificationDate'],
  ];
  function toIso(s){
    if(!has(s)) return '';
    const t=String(s).trim().replace(/[.\/]/g,'-');
    let m=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if(m&&+m[1]>=1900) return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
    m=t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/); if(m) return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
    return String(s).trim();
  }
  function plus90(iso){ const m=String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/); if(!m) return ''; const d=new Date(+m[1],+m[2]-1,+m[3]); d.setDate(d.getDate()+90); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

  let SYNC_SIG='';
  function syncAll(force){
    const V=DB().visaRecords||[], C=DB().recruitmentCases||[];
    if(!V.length) return 0;
    const sig=V.length+'|'+C.length+'|'+((DB().meta&&DB().meta.savedAt)||'');
    if(!force && sig===SYNC_SIG) return 0;
    SYNC_SIG=sig;
    let n=0;
    V.forEach(v=>{
      PAIRS.forEach(([a,b])=>{
        if(has(v[a]) && !has(v[b])){ v[b]=toIso(v[a]); n++; }
        else if(has(v[b]) && !has(v[a])){ v[a]=v[b]; n++; }
      });
      const iss=toIso(v.candidateVisaDate||v.candVisaIssuance);
      if(has(iss) && !has(v.candidateVisaExpiration) && !has(v.candVisaExpiration)){
        const e=plus90(iss); if(e){ v.candidateVisaExpiration=e; v.candVisaExpiration=e; n++; }
      }
    });
    /* two-way linked case */
    const cById={}; C.forEach(c=>cById[c.id]=c);
    const vById={}; V.forEach(v=>vById[v.id]=v);
    V.forEach(v=>{ const c=cById[v.linkedRecruitmentCaseId]; if(c && !has(c.linkedVisaId)){ c.linkedVisaId=v.id; n++; } });
    C.forEach(c=>{ const v=vById[c.linkedVisaId]; if(v && !has(v.linkedRecruitmentCaseId)){ v.linkedRecruitmentCaseId=c.id; n++; } });
    if(n>0){
      try{ if(window.dbSave) window.dbSave(); }catch(e){}
      try{ if(window.refreshVisaView) window.refreshVisaView(); }catch(e){}
      try{ if(window.refreshPipelineView) window.refreshPipelineView(); }catch(e){}
      log('synced '+n+' field(s) across View Data / form / table');
      SYNC_SIG='';
    }
    return n;
  }
  /* run after any View Data save and after the Edit Visa form saves */
  function hookSaves(){
    ['vdSave','cvSave'].forEach(id=>{ const b=$(id); if(!b||b.dataset.v450==='1') return; b.dataset.v450='1';
      b.addEventListener('click',()=>setTimeout(()=>syncAll(true),400),false); });
  }
  document.addEventListener('click',(e)=>{
    const b=e.target.closest&&e.target.closest('button');
    if(b && /^save/i.test((b.textContent||'').trim()) && document.getElementById('vf_candidateVisaDate')) setTimeout(()=>syncAll(true),400);
  }, true);

  /* =====================================================
     2) stop the base from overwriting our expirations heading
     ===================================================== */
  function fixExpHeader(){
    const host=$('v44Exp'); if(!host) return;
    const h=host.querySelector('h3'); if(!h) return;
    const div=document.createElement('div');
    div.className='v45-exp-title';
    div.style.cssText='display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 4px;font-family:\'IBM Plex Mono\',monospace;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#4A4032;font-weight:700';
    div.innerHTML=h.innerHTML;
    h.replaceWith(div);
  }
  /* v4.4.0 re-renders on change; convert after each render */
  const mo=new MutationObserver(()=>{ const h=$('v44Exp'); if(h && h.querySelector('h3')) fixExpHeader(); });
  function watchExp(){ const h=$('v44Exp'); if(h && !h.dataset.v450){ h.dataset.v450='1'; mo.observe(h,{childList:true}); fixExpHeader(); } }

  /* =====================================================
     3) R-02 agency options from the visible filters
     ===================================================== */
  function agencySel(){ return $('entAgencyFilter')||$('pipelineFilterAgency'); }
  const selVal=(id)=>{ const el=$(id); return el?String(el.value||'').trim():''; };
  function optsFromFilters(){
    const client=selVal('pipelineFilterClient'), nat=selVal('pipelineFilterNat'),
          pos=selVal('pipelineFilterPos'), type=selVal('pipelineFilterType'), stage=selVal('pipelineFilterStage');
    const C=(DB().recruitmentCases||[]).filter(c=>
      (!client||String(c.client||'')===client)&&(!nat||String(c.nationality||'')===nat)&&
      (!pos||String(c.position||'')===pos)&&(!type||String(c.recruitmentType||'')===type)&&
      (!stage||String(c.stage||'')===stage));
    return [...new Set(C.map(c=>String(c.agency||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  }
  let AG_BUSY=false, agT=null, OURS=false;
  function guardSelect(s){
    if(s.dataset.v450guard==='1') return; s.dataset.v450guard='1';
    const proto=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
    Object.defineProperty(s,'innerHTML',{
      configurable:true,
      get(){ return proto.get.call(this); },
      set(v){ if(OURS) proto.set.call(this,v); /* ignore other modules' full-list writes */ }
    });
    ['mousedown','focus','keydown','wheel'].forEach(ev=>s.addEventListener(ev,()=>{ AG_BUSY=true; clearTimeout(agT); agT=setTimeout(()=>{AG_BUSY=false;},4000); },true));
    s.addEventListener('blur',()=>{ AG_BUSY=false; },true);
    s.addEventListener('change',()=>{ AG_BUSY=false; });
  }
  function populateAgency(force){
    const s=agencySel(); if(!s||!DB().recruitmentCases) return;
    guardSelect(s);
    if(!force && (AG_BUSY || document.activeElement===s)) return;
    const opts=optsFromFilters();
    const current=[...s.options].map(o=>o.value).filter(Boolean);
    if(!force && current.join('\u0001')===opts.join('\u0001')) return;   /* compare what is ON SCREEN */
    const cur=s.value, ok=opts.includes(cur);
    OURS=true;
    try{ s.innerHTML='<option value="">All</option>'+opts.map(o=>'<option>'+esc(o)+'</option>').join(''); }
    finally{ OURS=false; }
    s.value=ok?cur:'';
  }
  function wireFilters(){
    ['pipelineFilterClient','pipelineFilterNat','pipelineFilterPos','pipelineFilterType','pipelineFilterStage'].forEach(id=>{
      const el=$(id); if(!el||el.dataset.v450==='1') return; el.dataset.v450='1';
      el.addEventListener('change',()=>setTimeout(()=>populateAgency(true),80));
    });
  }

  /* =====================================================
     4) clear "Year looks off" under Hijri QIWA dates
     ===================================================== */
  document.addEventListener('input',(e)=>{
    const t=e.target; if(!t||!t.id||!/qiwa/i.test(t.id)) return;
    setTimeout(()=>{
      t.classList.remove('ent-field-warn','ent-field-error');
      const msg=t.parentNode&&t.parentNode.querySelector('.ent-vmsg'); if(msg&&/year looks off/i.test(msg.textContent||'')) msg.remove();
    },0);
  }, true);
  function clearQiwaWarnings(){
    document.querySelectorAll('.ent-vmsg').forEach(m=>{ if(/year looks off/i.test(m.textContent||'')){ const inp=m.parentNode&&m.parentNode.querySelector('input'); if(inp&&/qiwa/i.test(inp.id||'')) m.remove(); } });
  }

  /* ---------- heartbeat: cheap work only ---------- */
  function tick(){
    hookSaves(); watchExp(); wireFilters(); clearQiwaWarnings();
    const pp=$('panel-pipeline')||$('pipelineDashboard');
    if(pp && pp.offsetParent!==null) populateAgency(false);
    syncAll(false);
  }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('v450', tick, 1500); } else { setInterval(tick, 1500); }
  setTimeout(()=>{ tick(); syncAll(true); }, 800);

  window._entV450={ syncAll:()=>syncAll(true), populateAgency:()=>populateAgency(true) };
  console.log('%c🔗 v'+V+' — View Data / form / table share the same fields · expirations header protected · agency options narrow','color:#2F5A3B;font-weight:bold;');
})();

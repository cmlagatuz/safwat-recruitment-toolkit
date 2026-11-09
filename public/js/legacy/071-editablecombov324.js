
(function EditableComboV324(){
  'use strict';
  const V='3.2.4';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const log=(...a)=>console.log('%c[v3.2.4]','color:#2F5A3B;font-weight:bold',...a);

  const STAGES=['PENDING OFFER LETTER','OFFER SIGNING','FOR MEDICAL APPOINTMENT','MEDICAL ON PROGRESS','FOR SKILLS VERIFICATION APPOINTMENT','SVP/QVP ON PROGRESS','FOR BIOMETRICS APPOINTMENT','Biometrics in Progress and Consular Submission','Visa Issued','DEPLOYED','ON HOLD','WITHDRAWN/BACKOUT','UNFIT','REJECTED','CANCELLED','AWOL','TERMINATED','END OF SERVICE'];
  const TYPES=['Local Transfer','Overseas – Endorsed','Overseas – Sourced'];
  function cases(){ return (window.DB&&window.DB.recruitmentCases)||[]; }
  function visas(){ return (window.DB&&window.DB.visaRecords)||[]; }
  function uniq(arr){ return [...new Set(arr.filter(v=>v!=null&&String(v).trim()!=='').map(v=>String(v).trim()))].sort((a,b)=>a.localeCompare(b)); }
  let _cache={}, _cacheAt=0;
  function optionsFor(field){ const now=Date.now(); if(now-_cacheAt>4000){ _cache={}; _cacheAt=now; } if(_cache[field]) return _cache[field]; let items; const C=cases(),Vz=visas(); switch(field){ case 'nationality': items=uniq(C.map(c=>c.nationality).concat(Vz.map(v=>v.nationality))); break; case 'position': items=uniq(C.map(c=>c.position)); break; case 'client': items=uniq(C.map(c=>c.client).concat(Vz.map(v=>v.client))); break; case 'visaCategory': items=uniq(Vz.map(v=>v.visaCategory).concat(C.map(c=>c.visaCategory))); break; case 'agency': items=uniq(C.map(c=>c.agency).concat(Vz.map(v=>v.registeredAgencyName))); break; case 'stage': items=uniq(STAGES.concat(C.map(c=>c.stage))); break; case 'recruitmentType': items=TYPES.slice(); break; default: items=[]; } _cache[field]=items; return items; }
  const COMBO_FIELDS=['nationality','position','client','visaCategory','agency','stage','recruitmentType'];
  function attrField(el){ const f=el.getAttribute&&el.getAttribute('data-f'); if(f&&COMBO_FIELDS.includes(f)) return {attr:'data-f',field:f}; const k=el.getAttribute&&el.getAttribute('data-k'); if(k&&COMBO_FIELDS.includes(k)) return {attr:'data-k',field:k}; return null; }

  /* ===== SELF-HEAL: revert old <select class="cv-sel"> → <input>, strip list= ===== */
  function revertSelect(sel){
    const af=attrField(sel); if(!af) return;
    const inp=document.createElement('input');
    inp.type='text';
    inp.setAttribute(af.attr, af.field);
    inp.value=sel.value||'';
    /* copy any dup-cell state container */
    sel.replaceWith(inp);
    const td=inp.closest('td'); if(td) td.classList.remove('cv-has-sel');
  }
  function healAndMark(){
    /* 1) revert leftover selects from v3.2.2 */
    document.querySelectorAll('select.cv-sel').forEach(revertSelect);
    /* 2) on our target inputs: strip native list (v3.2.1), mark as combo */
    ['data-f','data-k'].forEach(attr=>{
      COMBO_FIELDS.forEach(field=>{
        document.querySelectorAll('input['+attr+'="'+field+'"]').forEach(inp=>{
          const type=(inp.getAttribute('type')||'text').toLowerCase(); if(type==='number'||type==='date') return;
          if(inp.hasAttribute('list')) inp.removeAttribute('list');
          if(inp.dataset.combo!=='1'){ inp.dataset.combo='1'; inp.classList.add('cv-combo'); inp.setAttribute('autocomplete','off'); }
          else if(!inp.classList.contains('cv-combo')) inp.classList.add('cv-combo');
        });
      });
    });
  }
  let _sched=false; function schedule(){ if(_sched) return; _sched=true; requestAnimationFrame(()=>{ _sched=false; healAndMark(); }); }
  const mo=new MutationObserver(m=>{ for(const x of m){ if((x.addedNodes&&x.addedNodes.length)|| (x.type==='attributes')){ schedule(); return; } } });
  try{ mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','list']}); }catch(e){}
  healAndMark(); setTimeout(healAndMark,300); setTimeout(healAndMark,900); setTimeout(healAndMark,1800);
  /* gentle safety re-heal every 2s ONLY if a stray select reappears (kills the fight without constant churn) */
  setInterval(()=>{ if(document.querySelector('select.cv-sel')) healAndMark(); }, 2000);

  /* ===== shared floating panel ===== */
  const panel=$('cvComboPanel');
  let activeInput=null, items=[], filtered=[], idx=-1;
  function fieldOf(inp){ const af=attrField(inp); return af?af.field:null; }
  function positionPanel(inp){ const r=inp.getBoundingClientRect(); panel.style.left=r.left+'px'; panel.style.minWidth=r.width+'px'; const ph=Math.min(260,panel.scrollHeight||260); const below=window.innerHeight-r.bottom; if(below<ph+8 && r.top>ph){ panel.style.top=(r.top-ph-2)+'px'; } else { panel.style.top=(r.bottom+2)+'px'; } }
  function renderPanel(q){ const field=fieldOf(activeInput); if(!field){ hide(); return; } if(!items.length) items=optionsFor(field); const Q=upc(q); filtered=Q?items.filter(v=>upc(v).includes(Q)):items.slice(0,500); idx=-1; let html=''; if(filtered.length){ html+=filtered.slice(0,500).map((v,i)=>{ let disp=esc(v); if(Q){ const pos=upc(v).indexOf(Q); if(pos>=0){ disp=esc(v.slice(0,pos))+'<span class="hl">'+esc(v.slice(pos,pos+q.length))+'</span>'+esc(v.slice(pos+q.length)); } } return '<div class="cv-item" data-i="'+i+'">'+disp+'</div>'; }).join(''); } else { html+='<div class="cv-empty">No matches — type to add a new value</div>'; } if(q && !items.some(v=>upc(v)===Q)){ html+='<div class="cv-new">↵ Use "'+esc(q)+'" (new)</div>'; } panel.innerHTML=html; positionPanel(activeInput); panel.style.display='block'; }
  function show(inp){ activeInput=inp; items=[]; renderPanel(inp.value||''); }
  function hide(){ panel.style.display='none'; activeInput=null; items=[]; filtered=[]; idx=-1; }
  function choose(val){ if(activeInput){ activeInput.value=val; activeInput.dispatchEvent(new Event('input',{bubbles:true})); activeInput.dispatchEvent(new Event('change',{bubbles:true})); } hide(); }
  function paintActive(){ [...panel.querySelectorAll('.cv-item')].forEach((el,i)=>el.classList.toggle('active',i===idx)); const a=panel.querySelector('.cv-item.active'); if(a) a.scrollIntoView({block:'nearest'}); }

  document.addEventListener('focusin',(e)=>{ const inp=e.target; if(inp&&inp.matches&&inp.matches('input.cv-combo')) show(inp); });
  document.addEventListener('click',(e)=>{ const inp=e.target; if(inp&&inp.matches&&inp.matches('input.cv-combo')){ if(activeInput!==inp||panel.style.display==='none') show(inp); } else if(!e.target.closest('#cvComboPanel')){ hide(); } });
  document.addEventListener('input',(e)=>{ const inp=e.target; if(inp&&inp===activeInput&&inp.matches&&inp.matches('input.cv-combo')) renderPanel(inp.value||''); });
  document.addEventListener('keydown',(e)=>{ if(!activeInput||panel.style.display==='none') return; if(e.key==='ArrowDown'){ e.preventDefault(); idx=Math.min(filtered.length-1,idx+1); paintActive(); } else if(e.key==='ArrowUp'){ e.preventDefault(); idx=Math.max(0,idx-1); paintActive(); } else if(e.key==='Enter'){ if(idx>=0&&filtered[idx]){ e.preventDefault(); choose(filtered[idx]); } else hide(); } else if(e.key==='Escape'){ hide(); } else if(e.key==='Tab'){ hide(); } });
  panel.addEventListener('mousedown',(e)=>{ e.preventDefault(); const item=e.target.closest('.cv-item'); if(item){ const i=parseInt(item.dataset.i,10); if(filtered[i]!=null) choose(filtered[i]); return; } if(e.target.closest('.cv-new')){ hide(); } });
  document.addEventListener('focusout',(e)=>{ if(e.target===activeInput){ setTimeout(()=>{ if(document.activeElement!==panel && !panel.contains(document.activeElement)) hide(); },120); } });
  window.addEventListener('scroll',()=>{ if(activeInput) positionPanel(activeInput); }, true);
  window.addEventListener('resize',()=>{ if(activeInput) positionPanel(activeInput); });

  /* ===== diagnostic ===== */
  window._entComboDiag=function(){
    const inputs=[...document.querySelectorAll('input[data-f],input[data-k]')].filter(i=>attrField(i));
    const sels=[...document.querySelectorAll('select.cv-sel')];
    const sample=inputs.slice(0,10).map(i=>{ const af=attrField(i); return {field:af.field, combo:i.dataset.combo==='1', hasComboClass:i.classList.contains('cv-combo'), hasList:i.hasAttribute('list'), value:i.value.slice(0,20)}; });
    return JSON.stringify({ comboInputs:inputs.length, leftoverSelects:sels.length, panelPresent:!!panel, sample }, null, 2);
  };
  window._entComboRefresh=()=>{ _cache={}; healAndMark(); };
  console.log('%c⬇ Editable combo v'+V+' active (self-healing, conflict-proof) — run _entComboDiag() if issues','color:#2F5A3B;font-weight:bold;');
})();

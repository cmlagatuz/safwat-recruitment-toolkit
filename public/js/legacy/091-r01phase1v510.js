
(function R01Phase1V510(){
  'use strict';
  if(window.__entR01P1V510) return; window.__entR01P1V510=true;
  const V='5.1.0';
  const $=(id)=>document.getElementById(id);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const log=(...a)=>console.log('%c[v5.1.0 R01P1]','color:#2E6FA3;font-weight:bold',...a);

  function visaPanel(){ return $('panel-visa')||$('panel-r01'); }
  function recordsCard(){ const p=visaPanel()||document; const h=[...p.querySelectorAll('h1,h2,h3,h4,div,span,p')].find(x=>/all visa records/i.test(x.textContent||'')&&x.children.length<=6&&x.getBoundingClientRect().height<90); return h?(h.closest('.card, section, div[style*="border"]')||h.parentElement):null; }
  function searchInput(card){ return [...card.querySelectorAll('input[type="text"],input:not([type])')].find(i=>/search visa records/i.test(i.placeholder||'')) || [...card.querySelectorAll('input')].find(i=>/search/i.test(i.placeholder||'')); }
  function viewDataBtn(card){ return $('vdViewBtn') || [...card.querySelectorAll('button')].find(b=>upc(b.textContent)==='VIEW DATA'); }

  /* ---------- A) move View Data inline next to the search ---------- */
  function placeViewDataInline(){
    const card=recordsCard(); if(!card) return false;
    const search=searchInput(card); const btn=viewDataBtn(card);
    if(!search||!btn) return false;
    if(btn.dataset.avrInline==='1' && btn.previousElementSibling===search) return true;
    /* wrap the search in a flex group and drop the button right after it */
    let group=search.closest('.avr-topright');
    if(!group){
      group=document.createElement('div'); group.className='avr-topright';
      const parent=search.parentNode;
      parent.insertBefore(group, search);
      group.appendChild(search);
    }
    /* normalize button styling (it may have been absolutely positioned) */
    btn.classList.add('avr-viewdata');
    btn.style.position='static'; btn.style.top=''; btn.style.right=''; btn.style.left=''; btn.style.margin='0';
    group.appendChild(btn);            /* search first, then View Data — "linear next after the search bar" */
    btn.dataset.avrInline='1';
    /* if the search wrapper was absolutely positioned top-right, keep the group there */
    log('View Data button placed inline after search');
    return true;
  }

  /* ---------- B) remove the CSV / PDF buttons under ALL VISA RECORDS ---------- */
  function removeExportButtons(){
    const card=recordsCard(); if(!card) return;
    /* they usually sit just after the records card; search a small radius */
    const scope=[card, card.parentElement, card.nextElementSibling].filter(Boolean);
    scope.forEach(root=>{
      [...root.querySelectorAll('button, a')].forEach(b=>{
        const t=upc(b.textContent);
        if(t==='EXPORT FILTERED ROWS (.CSV)' || /EXPORT FILTERED ROWS/.test(t) || t==='PRINT / SAVE AS PDF' || /PRINT \/ SAVE AS PDF/.test(t)){
          if(b.dataset.avrHidden==='1') return;
          b.dataset.avrHidden='1'; b.style.display='none';
        }
      });
    });
  }

  /* single maintenance task on EntCore heartbeat */
  function tick(){ placeViewDataInline(); removeExportButtons(); }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('r01.phase1', tick, 900); }
  else { setInterval(tick, 900); }
  tick();

  /* ---------- C) make the CRUD validator (v5.0.0) Hijri-aware for QIWA ---------- */
  function patchValidator(){
    if(!window._entValidators || window.__entHijriPatched) return;
    const Vs=window._entValidators;
    if(typeof Vs.dateISO!=='function') return;
    window.__entHijriPatched=true;
    const origDate=Vs.dateISO.bind(Vs);
    /* a Hijri-tolerant date check */
    Vs.hijriDate=function(v){ if(!v||!String(v).trim()) return null; const norm=String(v).replace(/[.\/]/g,'-'); if(!/^\d{3,4}-\d{1,2}-\d{1,2}$/.test(norm)) return {level:'warn',msg:'Use Hijri yyyy/mm/dd.'}; return {level:'ok',msg:'Hijri date.'}; };
    /* re-route the field-level validator: any *qiwa* field → hijriDate */
    const origVF=window._entValidateField;
    if(typeof origVF==='function' && !origVF.__hijri){
      const wrapped=function(el){
        try{
          const id=el&&el.id||''; const f=(el&&el.dataset&&el.dataset.f)||'';
          if(/qiwa/i.test(id)||/qiwa/i.test(f)){
            const res=Vs.hijriDate(el.value);
            /* reuse v5.0.0's applyState via a synthetic call: set classes/msg here */
            el.classList.remove('ent-field-error','ent-field-warn','ent-field-ok');
            let msgEl=el.parentNode&&el.parentNode.querySelector(':scope > .ent-vmsg');
            if(!res){ if(msgEl) msgEl.remove(); return; }
            el.classList.add(res.level==='err'?'ent-field-error':res.level==='warn'?'ent-field-warn':'ent-field-ok');
            if(res.msg){ if(!msgEl){ msgEl=document.createElement('div'); if(el.parentNode) el.parentNode.appendChild(msgEl); } msgEl.className='ent-vmsg '+res.level; msgEl.textContent=res.msg; }
            else if(msgEl) msgEl.remove();
            return;
          }
        }catch(e){}
        return origVF(el);
      };
      wrapped.__hijri=true;
      window._entValidateField=wrapped;
      log('CRUD validator made Hijri-aware for QIWA fields (no more "Year looks off")');
    }
  }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('r01.hijriValidator', patchValidator, 1200); }
  else { setInterval(patchValidator, 1200); }
  patchValidator();

  console.log('%c🔧 R-01 Phase 1 v'+V+' active — View Data inline · CSV/PDF removed · QIWA Hijri-aware','color:#2E6FA3;font-weight:bold;');
})();

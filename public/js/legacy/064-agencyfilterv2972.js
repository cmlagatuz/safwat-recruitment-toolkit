
(function AgencyFilterV2972(){
  'use strict';
  const V='2.9.72';
  const $=(id)=>document.getElementById(id);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const log=(...a)=>console.log('%c[v2.9.72]','color:#2F5A3B;font-weight:bold',...a);

  function pipelinePanel(){ return $('panel-pipeline')||$('pipelineDashboard'); }
  function panelVisible(p){ return p && p.offsetParent!==null && p.getBoundingClientRect().height>0; }

  /* Find the R-02 filter bar controls. A "filter control" is a wrapper that
     holds a <select> and a label with a known filter name. */
  function labeledSelect(names){
    const panel=pipelinePanel()||document;
    const wraps=[...panel.querySelectorAll('label, .field, div')];
    for(const w of wraps){
      const lt=upc(w.textContent||'');
      if(names.some(N=>lt.startsWith(N))){
        const sel=w.querySelector('select') || (w.nextElementSibling&&w.nextElementSibling.matches&&w.nextElementSibling.matches('select')?w.nextElementSibling:null);
        if(sel) return { wrap:w, sel };
      }
    }
    return null;
  }
  function stageControl(){ return labeledSelect(['STAGE','STATUS']); }
  function searchInput(){ const panel=pipelinePanel()||document; return [...panel.querySelectorAll('input[type="text"], input:not([type])')].find(i=>/search/i.test(i.placeholder||'')); }

  /* Candidate table (has NAME + STAGE headers) */
  function candidatesTable(){ const panel=pipelinePanel(); if(!panel) return null; return [...panel.querySelectorAll('table')].find(t=>{ const hs=[...t.querySelectorAll('th')].map(th=>upc(th.textContent)); return hs.some(h=>h.includes('NAME'))&&hs.some(h=>h.includes('STAGE')); }); }
  function agencyColIndex(t){ const ths=[...t.querySelectorAll('thead th')]; for(let i=0;i<ths.length;i++){ if(upc(ths[i].textContent).includes('AGENCY')) return i; } return -1; }

  /* Unique agency values from the DB (candidates + their linked visas) */
  function agencyOptions(){
    const set=new Set();
    const cases=(window.DB&&window.DB.recruitmentCases)||[];
    cases.forEach(c=>{ if(c.agency) set.add(String(c.agency).trim()); });
    /* also include agencies from visas linked to candidates */
    const visas=(window.DB&&window.DB.visaRecords)||[];
    const linked=new Set(cases.map(c=>c.linkedVisaId).filter(Boolean));
    visas.forEach(v=>{ if(linked.has(v.id)&&v.registeredAgencyName) set.add(String(v.registeredAgencyName).trim()); });
    return [...set].filter(Boolean).sort((a,b)=>a.localeCompare(b));
  }

  /* Resolve a table row to its candidate record's agency (best-effort) */
  function rowAgency(tr, t, agIdx){
    if(agIdx>=0){ const td=tr.children[agIdx]; if(td) return upc(td.textContent); }
    /* fallback: match record by visible name/passport, read agency from DB */
    const cases=(window.DB&&window.DB.recruitmentCases)||[];
    const cells=[...tr.querySelectorAll('td')].map(td=>upc(td.textContent));
    for(const c of cases){ const nm=upc(c.name); if(nm&&cells.includes(nm)) return upc(c.agency); }
    return '';
  }

  let _agencyValue='';
  function applyFilter(){
    const t=candidatesTable(); if(!t) return;
    const agIdx=agencyColIndex(t);
    const want=upc(_agencyValue);
    [...t.querySelectorAll('tbody tr')].forEach(tr=>{
      if(tr.querySelector('th')) return;
      if(!want){ tr.classList.remove('ent-agency-hidden'); return; }
      const a=rowAgency(tr, t, agIdx);
      tr.classList.toggle('ent-agency-hidden', a!==want);
    });
  }

  function buildSelect(){
    const sel=document.createElement('select'); sel.id='entAgencyFilter';
    /* copy sizing/appearance from the Stage select if we can */
    const stage=stageControl();
    if(stage && stage.sel){ sel.className=stage.sel.className; sel.style.cssText=stage.sel.style.cssText; }
    refreshOptions(sel);
    sel.addEventListener('change', ()=>{ _agencyValue=sel.value; applyFilter(); });
    return sel;
  }
  function refreshOptions(sel){ const cur=sel.value; const opts=agencyOptions(); sel.innerHTML='<option value="">All</option>'+opts.map(a=>'<option value="'+esc(upc(a))+'">'+esc(a)+'</option>').join(''); if(cur) sel.value=cur; }

  function ensureAgencyFilter(){
    const panel=pipelinePanel(); if(!panel||!panelVisible(panel)) return;
    if($('entAgencyFilter')){ /* keep options fresh + filter applied */ refreshOptions($('entAgencyFilter')); applyFilter(); return; }
    const stage=stageControl(); if(!stage) return;         /* fail safe */
    const sel=buildSelect();

    /* Build a wrapper that mirrors the Stage control's wrapper (label + select),
       so it sits inline in the same linear bar. */
    const stageWrap=stage.wrap;
    let host, node;
    if(stageWrap){
      /* clone the stage wrapper's structure lightly: a container with an "Agency" label + our select */
      const wrap=document.createElement(stageWrap.tagName);
      wrap.className=stageWrap.className;
      wrap.style.cssText=stageWrap.style.cssText;
      /* label */
      const lbl=document.createElement('label'); lbl.textContent='Agency';
      const stageLbl=stageWrap.querySelector('label'); if(stageLbl){ lbl.className=stageLbl.className; lbl.style.cssText=stageLbl.style.cssText; }
      wrap.appendChild(lbl); wrap.appendChild(sel);
      node=wrap; host=stageWrap.parentNode;
      /* insert AFTER the stage wrapper (so order is …STAGE, AGENCY) */
      host.insertBefore(node, stageWrap.nextSibling);
    } else {
      /* fallback: insert the bare select right after the stage select */
      stage.sel.parentNode.insertBefore(sel, stage.sel.nextSibling);
      node=sel;
    }

    /* Ensure SEARCH comes AFTER agency: if the search input is a sibling before us, move it after */
    const search=searchInput();
    if(search){ const searchWrap=search.closest('label,.field,div')||search; if(searchWrap && node && searchWrap.parentNode===node.parentNode){ /* place search right after our node */ node.parentNode.insertBefore(searchWrap, node.nextSibling); } }

    applyFilter();
    log('Agency filter inserted after Stage (before Search)');
  }
  setInterval(ensureAgencyFilter, 800); ensureAgencyFilter();
  /* keep filter applied after table re-renders */
  setInterval(()=>{ if(_agencyValue) applyFilter(); }, 1200);

  window._entAgencyDiag=function(){ const st=stageControl(); const t=candidatesTable(); return JSON.stringify({ stageFound:!!st, stageWrapTag:st?st.wrap.tagName:null, searchFound:!!searchInput(), agencyOptionCount:agencyOptions().length, tableFound:!!t, agencyColIndex:t?agencyColIndex(t):null, value:_agencyValue }, null, 1); };

  console.log('%c🏢 R-02 Agency filter (after Stage) v'+V+' active','color:#2F5A3B;font-weight:bold;');
})();

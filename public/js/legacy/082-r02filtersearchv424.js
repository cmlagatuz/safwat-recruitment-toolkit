
(function R02FilterSearchV424(){
  'use strict';
  if(window.__entR02FSv424) return; window.__entR02FSv424=true;
  window.__entR02FSv420=true; window.__entR02FSv421=true; window.__entR02FSv422=true; window.__entR02FSv423=true;
  const V='4.2.4';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const log=(...a)=>console.log('%c[v4.2.4 R02]','color:#2F5A3B;font-weight:bold',...a);

  /* keep the legacy auto-link button creator switched off */
  (function(){
    try{ if(window.EntCore&&window.EntCore.clear){ ['fix.v410','fix.v411','fix.v412'].forEach(id=>{ try{ window.EntCore.clear(id); }catch(e){} }); } }catch(e){}
    window.__entFixV410=true; window.__entFixV411=true;
  })();

  const DBx=()=>window.DB||{};
  const cases=()=>DBx().recruitmentCases||[];
  const visas=()=>DBx().visaRecords||[];

  function agencySel(){ return $('entAgencyFilter')||$('pipelineFilterAgency'); }
  function agencyVal(){ const s=agencySel(); return s?s.value:''; }
  function searchEl(){ return $('pipelineSearch'); }
  function searchText(){ const s=searchEl(); return s?String(s.value||'').trim().toLowerCase():''; }   /* READ ONLY */

  /* ---------- never rebuild the agency select while it is open ---------- */
  let SELECT_BUSY=false, busyTimer=null;
  function markBusy(ms){ SELECT_BUSY=true; clearTimeout(busyTimer); busyTimer=setTimeout(()=>{ SELECT_BUSY=false; }, ms||3000); }
  function selectIsOpen(){ const s=agencySel(); if(!s) return false; if(SELECT_BUSY) return true; return document.activeElement===s; }
  function wireBusy(){
    const s=agencySel(); if(!s||s.dataset.v424busy==='1') return; s.dataset.v424busy='1';
    ['mousedown','focus','keydown'].forEach(ev=>s.addEventListener(ev,()=>markBusy(4000), true));
    s.addEventListener('blur',()=>{ SELECT_BUSY=false; }, true);
    s.addEventListener('change',()=>{ SELECT_BUSY=false; });
  }

  /* ---------- cached universal search index ---------- */
  let MAP=null, MAP_SIG='';
  function dataSig(){ return cases().length+'|'+visas().length+'|'+((DBx().meta&&DBx().meta.savedAt)||''); }
  const visaById=(id)=>{ if(!id) return null; return visas().find(v=>v.id===id)||null; };
  function blobFor(c){
    const v=visaById(c.linkedVisaId);
    const parts=[c.name,c.passport,c.iqama,c.client,c.nationality,c.position,c.stage,c.agency,
      c.recruitmentType,c.visaCategory,c.notes,c.id,c.linkedVisaId,c.legacyStatus];
    if(v) parts.push(v.visaDocumentNumber,v.visaNumber,v.sponsorId,v.crNumber,v.registeredAgencyName,v.statusVisa,v.stampingCity);
    return parts.map(x=>String(x==null?'':x)).join(' ').toLowerCase();
  }
  function searchMap(){
    const sig=dataSig();
    if(MAP && MAP_SIG===sig) return MAP;
    MAP={}; cases().forEach(c=>{ MAP[c.id]=blobFor(c); }); MAP_SIG=sig;
    return MAP;
  }

  /* =====================================================
     wrapper — READS the input, never writes to it
     ===================================================== */
  function wrapBase(){
    if(window.__entR02Wrapped) return;
    if(typeof window.getPipelineFilteredBase!=='function') return;
    window.__entR02Wrapped=true;
    const orig=window.getPipelineFilteredBase;

    window.getPipelineFilteredBase=function(excludeKeys){
      excludeKeys=Array.isArray(excludeKeys)?excludeKeys:[];
      const rows=orig.call(this, excludeKeys);          /* NO mutation of the input */
      if(!Array.isArray(rows)) return rows;

      const q=searchText();
      let out=rows;

      /* The base narrowed by NAME only. If a query is present, re-expand from the
         full candidate set using the base's own non-search filters, then apply our
         universal match. We detect the base's other filters by re-running it with
         an empty query is impossible without mutating, so instead we UNION: keep
         the base rows, plus any record that matches our blob AND passes the
         visible dropdown filters. */
      if(q){
        const byId={}; rows.forEach(r=>byId[r.id]=true);
        const m=searchMap();
        const extra=cases().filter(c=>{
          if(byId[c.id]) return false;                  /* already included */
          if(!(m[c.id]||blobFor(c)).includes(q)) return false;
          return passesVisibleFilters(c, excludeKeys);  /* respect the dropdowns */
        });
        out=rows.filter(c=>(m[c.id]||blobFor(c)).includes(q)).concat(extra);
      }

      const a=agencyVal();
      if(a && !excludeKeys.includes('agency')) out=out.filter(c=>upc(c.agency)===upc(a));
      return out;
    };
    log('filter wrapper installed (read-only on the search box)');
  }

  /* mirror the visible dropdown filters so re-expanded rows stay consistent */
  function selVal(id){ const el=$(id); return el?String(el.value||'').trim():''; }
  function passesVisibleFilters(c, excludeKeys){
    excludeKeys=excludeKeys||[];
    const client=selVal('pipelineFilterClient'), nat=selVal('pipelineFilterNat'),
          pos=selVal('pipelineFilterPos'), type=selVal('pipelineFilterType'),
          stage=selVal('pipelineFilterStage');
    if(client && !excludeKeys.includes('client') && String(c.client||'')!==client) return false;
    if(nat && !excludeKeys.includes('nat') && String(c.nationality||'')!==nat) return false;
    if(pos && !excludeKeys.includes('pos') && String(c.position||'')!==pos) return false;
    if(type && !excludeKeys.includes('type') && String(c.recruitmentType||'')!==type) return false;
    if(stage && !excludeKeys.includes('stage') && String(c.stage||'')!==stage) return false;
    return true;
  }

  /* ---------- Agency options: closed + changed only ---------- */
  const uniqSorted=(arr)=>[...new Set(arr.filter(Boolean).map(x=>String(x).trim()))].sort((a,b)=>a.localeCompare(b));
  let LAST_OPTS=null;
  function populateAgency(force){
    const sel=agencySel(); if(!sel||!window.DB) return;
    if(typeof window.getPipelineFilteredBase!=='function') return;
    if(!force && selectIsOpen()) return;
    let base; try{ base=window.getPipelineFilteredBase(['agency']); }catch(e){ return; }
    if(!Array.isArray(base)) return;
    const opts=uniqSorted(base.map(c=>c.agency));
    const key=opts.join('\u0001');
    if(!force && key===LAST_OPTS) return;
    const cur=sel.value, stillValid=opts.includes(cur);
    const html='<option value="">All</option>'+opts.map(o=>'<option>'+esc(o)+'</option>').join('');
    if(sel.innerHTML!==html){ sel.innerHTML=html; sel.value=stillValid?cur:''; }
    LAST_OPTS=key;
  }
  function unhideAgencyRows(){ document.querySelectorAll('tr.ent-agency-hidden').forEach(tr=>tr.classList.remove('ent-agency-hidden')); }

  /* ---------- ONE render per user action ---------- */
  let RENDERING=false;
  function userRefresh(){
    if(RENDERING) return; RENDERING=true;
    try{ if(window.refreshPipelineView) window.refreshPipelineView(); }catch(e){}
    setTimeout(()=>{ populateAgency(true); unhideAgencyRows(); applySearch(); RENDERING=false; }, 0);
  }
  function wireAgency(){
    const sel=agencySel(); if(!sel||sel.dataset.v424==='1') return; sel.dataset.v424='1';
    sel.addEventListener('change', ()=>{ SELECT_BUSY=false; unhideAgencyRows(); userRefresh(); });
  }
  function wrapRefreshOptions(){
    if(window.__entR02OptWrapped) return;
    if(typeof window.refreshPipelineFilterOptions!=='function') return;
    window.__entR02OptWrapped=true;
    const orig=window.refreshPipelineFilterOptions;
    window.refreshPipelineFilterOptions=function(){ const r=orig.apply(this,arguments); try{ populateAgency(false); }catch(e){} return r; };
  }

  /* ---------- filter-bar search: debounced, one render ---------- */
  let fbT=null;
  function wireFilterSearch(){
    const inp=searchEl(); if(!inp||inp.dataset.v424==='1') return; inp.dataset.v424='1';
    inp.placeholder='Search name, passport, client, agency, position…';
    const wrap=inp.closest('div'); const lbl=wrap?wrap.querySelector('label'):null;
    if(lbl && /search/i.test(lbl.textContent||'')) lbl.textContent='SEARCH (ANY FIELD)';
    /* debounce so Ctrl+A / fast typing never storm the renderer */
    inp.addEventListener('input', ()=>{ clearTimeout(fbT); fbT=setTimeout(userRefresh, 220); });
    log('filter-bar search wired (no input mutation, debounced)');
  }

  /* ---------- All Candidates search: row hiding only ---------- */
  let searchT=null;
  function applySearch(){
    const inp=$('entPipeSearch'); if(!inp) return;
    const q=String(inp.value||'').trim().toLowerCase();
    const m=searchMap();
    document.querySelectorAll('#panel-pipeline table tbody tr, #pipelineDashboard table tbody tr').forEach(tr=>{
      if(tr.querySelector('th')) return;
      let blob='';
      const id=(tr.innerHTML.match(/RC-\d{3,}/)||[])[0];
      if(id && m[id]) blob=m[id];
      if(!blob) blob=(tr.textContent||'').toLowerCase();
      tr.classList.toggle('ent-hidden-by-search', !!q && !blob.includes(q));
    });
  }
  function wireCandidateSearch(){
    const inp=$('entPipeSearch'); if(!inp||inp.dataset.v424==='1') return; inp.dataset.v424='1';
    inp.placeholder='Search anything — name, passport, client, agency…';
    inp.addEventListener('input', ()=>{ clearTimeout(searchT); searchT=setTimeout(applySearch, 160); });
  }

  /* ---------- auto-link button in the R-03 row ---------- */
  function ceoButtonRow(){
    const btns=[...document.querySelectorAll('#panel-pipeline button, #pipelineDashboard button')];
    const r03=btns.find(b=>/manage cases|\(R-03\)/i.test(b.textContent||''));
    return r03?r03.parentElement:null;
  }
  function placeLinkButton(){
    const row=ceoButtonRow(); if(!row) return;
    let b=$('v422LinkBtn');
    if(!b){
      b=document.createElement('button'); b.id='v422LinkBtn'; b.type='button';
      b.innerHTML='🔗 Auto-link visas';
      b.title='Match unlinked candidates to unlinked visa records by passport';
      b.addEventListener('click',()=>{ if(typeof window._entAutoLinkVisas==='function') window._entAutoLinkVisas(false); });
      row.appendChild(b); return;
    }
    if(b.parentElement!==row) row.appendChild(b);
  }

  /* ---------- heartbeat: wiring only ---------- */
  function tick(){
    wrapBase(); wrapRefreshOptions(); wireBusy(); wireAgency(); wireFilterSearch(); wireCandidateSearch(); placeLinkButton();
    const p=$('panel-pipeline')||$('pipelineDashboard');
    if(p && p.offsetParent!==null){ populateAgency(false); unhideAgencyRows(); }
  }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('r02.filtersearch', tick, 1500); }
  else { setInterval(tick, 1500); }
  setTimeout(tick, 500);

  window._entR02FS={ populateAgency:()=>populateAgency(true), applySearch, blobFor };
  console.log('%c🔎 R-02 v'+V+' — search box never mutated (Ctrl+A works) · one render per agency change','color:#2F5A3B;font-weight:bold;');
})();

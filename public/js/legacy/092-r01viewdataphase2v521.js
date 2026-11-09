
(function R01ViewDataPhase2V521(){
  'use strict';
  if(window.__entR01P2V521) return; window.__entR01P2V521=true;
  const V='5.2.1';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const compact=(s)=>String(s==null?'':s).toUpperCase().replace(/[^A-Z0-9]/g,'');
  const log=(...a)=>console.log('%c[v5.2.1 R01P2]','color:#2E6FA3;font-weight:bold',...a);
  const visas=()=>((window.DB&&window.DB.visaRecords)||[]);
  const cases=()=>((window.DB&&window.DB.recruitmentCases)||[]);

  function grid(){ return $('vdGrid'); }
  function overlayOpen(){ const o=$('vdOverlay'); return o&&o.classList.contains('open'); }
  function recById(id){ return visas().find(v=>v.id===id); }
  function rowRecId(tr){ return (tr.dataset&&(tr.dataset.rec||tr.dataset.recId||tr.dataset.id))||''; }

  /* ---------- 1) Agency Deleg. mapping fix ---------- */
  function fixAgencyDelegColumn(){
    const g=grid(); if(!g) return;
    const ths=[...g.querySelectorAll('thead th')];
    const idx=ths.findIndex(th=>/AGENCY\s*DELEG/i.test(th.textContent||'')); if(idx<0) return;
    g.querySelectorAll('tbody tr').forEach(tr=>{
      const cell=tr.children[idx]; if(!cell) return;
      const inp=cell.querySelector('[data-f]'); if(!inp) return;
      if(inp.dataset.f==='agencyDelegationNumber') return;
      if(inp.dataset.f!=='registeredAgencyName') return;
      inp.dataset.f='agencyDelegationNumber'; inp.setAttribute('data-f','agencyDelegationNumber');
      const rec=recById(rowRecId(tr)); if(rec){ const correct=rec.agencyDelegationNumber!=null?rec.agencyDelegationNumber:''; if(inp.value!==correct) inp.value=correct; }
    });
  }

  /* ---------- 2) dropdowns (Stamping City / Gender / Reg Agency / Status) ---------- */
  const COMBO=[
    {field:'stampingCity', src:()=>uniq(visas().map(v=>v.stampingCity))},
    {field:'gender',       src:()=>uniq(visas().map(v=>(v.gender||'').toUpperCase()))},
    {field:'registeredAgencyName', src:()=>uniq(visas().map(v=>v.registeredAgencyName))},
    {field:'statusVisa',   src:()=>uniq(['UNUSED','ALLOCATED','USED','EXPIRED','CANCELLED'].concat(visas().map(v=>(v.statusVisa||'').toUpperCase())))},
  ];
  function uniq(arr){ return [...new Set(arr.filter(v=>v!=null&&String(v).trim()!=='').map(v=>String(v).trim()))].sort((a,b)=>a.localeCompare(b)); }
  function markCombos(){
    const g=grid(); if(!g) return;
    COMBO.forEach(c=>{ g.querySelectorAll('input[data-f="'+c.field+'"]').forEach(inp=>{ if(inp.dataset.combo==='1') return; inp.dataset.combo='1'; inp.classList.add('vd-combo'); inp.setAttribute('autocomplete','off'); if(inp.hasAttribute('list')) inp.removeAttribute('list'); }); });
  }
  const panel=$('vdComboPanel'); let activeInp=null, items=[], filtered=[], idx=-1;
  function fieldOf(inp){ return inp&&inp.getAttribute('data-f'); }
  function srcFor(field){ const c=COMBO.find(x=>x.field===field); return c?c.src():[]; }
  function position(inp){ const r=inp.getBoundingClientRect(); panel.style.left=r.left+'px'; panel.style.minWidth=r.width+'px'; const below=window.innerHeight-r.bottom; const ph=Math.min(240,panel.scrollHeight||240); panel.style.top=(below<ph+8&&r.top>ph?(r.top-ph-2):(r.bottom+2))+'px'; }
  function renderPanel(q){ const field=fieldOf(activeInp); if(!field){ hide(); return; } if(!items.length) items=srcFor(field); const Q=upc(q); filtered=Q?items.filter(v=>upc(v).includes(Q)):items.slice(0,400); idx=-1; let html=filtered.map((v,i)=>'<div class="it" data-i="'+i+'">'+esc(v)+'</div>').join('')||'<div class="nu">No matches — type to add</div>'; if(q&&!items.some(v=>upc(v)===Q)) html+='<div class="nu">↵ Use "'+esc(q)+'"</div>'; panel.innerHTML=html; position(activeInp); panel.style.display='block'; }
  function show(inp){ activeInp=inp; items=[]; renderPanel(inp.value||''); }
  function hide(){ panel.style.display='none'; activeInp=null; items=[]; filtered=[]; idx=-1; }
  function choose(val){ if(activeInp){ activeInp.value=val; activeInp.dispatchEvent(new Event('input',{bubbles:true})); activeInp.dispatchEvent(new Event('change',{bubbles:true})); } hide(); }
  document.addEventListener('focusin',(e)=>{ const inp=e.target; if(inp&&inp.matches&&inp.matches('#vdGrid input.vd-combo')) show(inp); });
  document.addEventListener('click',(e)=>{ const inp=e.target; if(inp&&inp.matches&&inp.matches('#vdGrid input.vd-combo')){ if(activeInp!==inp||panel.style.display==='none') show(inp); } else if(!e.target.closest('#vdComboPanel')){ hide(); } });
  document.addEventListener('input',(e)=>{ const inp=e.target; if(inp&&inp===activeInp&&inp.matches&&inp.matches('#vdGrid input.vd-combo')) renderPanel(inp.value||''); });
  document.addEventListener('keydown',(e)=>{ if(!activeInp||panel.style.display==='none') return; if(e.key==='ArrowDown'){ e.preventDefault(); idx=Math.min(filtered.length-1,idx+1); paint(); } else if(e.key==='ArrowUp'){ e.preventDefault(); idx=Math.max(0,idx-1); paint(); } else if(e.key==='Enter'){ if(idx>=0&&filtered[idx]){ e.preventDefault(); choose(filtered[idx]); } else hide(); } else if(e.key==='Escape'){ hide(); } else if(e.key==='Tab'){ hide(); } });
  function paint(){ [...panel.querySelectorAll('.it')].forEach((el,i)=>el.classList.toggle('active',i===idx)); const a=panel.querySelector('.it.active'); if(a) a.scrollIntoView({block:'nearest'}); }
  panel.addEventListener('mousedown',(e)=>{ e.preventDefault(); const it=e.target.closest('.it'); if(it){ const i=parseInt(it.dataset.i,10); if(filtered[i]!=null) choose(filtered[i]); return; } if(e.target.closest('.nu')) hide(); });
  document.addEventListener('focusout',(e)=>{ if(e.target===activeInp) setTimeout(()=>{ if(document.activeElement!==panel&&!panel.contains(document.activeElement)) hide(); },120); });
  window.addEventListener('scroll',()=>{ if(activeInp) position(activeInp); }, true);
  window.addEventListener('resize',()=>{ if(activeInp) position(activeInp); });

  /* ---------- 3) LINKED CASE → read-only, auto-linked (no editing) ---------- */
  function autoLinkFor(rec){
    if(!rec) return {id:'',label:'—'};
    if(rec.linkedRecruitmentCaseId){ const c=cases().find(x=>x.id===rec.linkedRecruitmentCaseId); if(c) return {id:c.id,label:(c.name||'(no name)')+' — '+c.id}; }
    const p=compact(rec.passport); if(p.length>=4){ const c=cases().find(x=>compact(x.passport)===p); if(c) return {id:c.id,label:(c.name||'(no name)')+' — '+c.id}; }
    return {id:'',label:'—'};
  }
  function lockLinkedCase(){
    const g=grid(); if(!g) return;
    g.querySelectorAll('tbody tr').forEach(tr=>{
      const inp=tr.querySelector('[data-f="linkedRecruitmentCaseId"]');
      const td=inp?inp.closest('td'):null; if(!td) return;
      if(td.dataset.roDone==='1'){ /* keep value fresh but don't rebuild */ return; }
      const rec=recById(rowRecId(tr));
      const link=autoLinkFor(rec);
      /* Preserve the value in a HIDDEN input so Save still persists the auto-linked id */
      td.dataset.roDone='1';
      td.classList.add('vd-linked-ro'); if(!link.id) td.classList.add('none');
      td.innerHTML='<span class="vd-lock">🔒</span>'+esc(link.label)+
        '<input type="hidden" data-f="linkedRecruitmentCaseId" value="'+esc(link.id)+'">';
      /* also stamp the record so the DB reflects the auto-link on next save */
      if(rec && link.id && rec.linkedRecruitmentCaseId!==link.id){ rec.linkedRecruitmentCaseId=link.id; }
    });
  }

  /* ---------- 4) View Data button: measure the search, place LEFT of it ---------- */
  function positionViewDataButton(){
    const btn=$('vdViewBtn'); if(!btn) return;
    /* find the ALL VISA RECORDS search input */
    const card=btn.closest('.card, section, div[style*="border"]')||btn.parentElement;
    if(!card) return;
    const search=[...card.querySelectorAll('input')].find(i=>/search visa records/i.test(i.placeholder||''))||[...card.querySelectorAll('input')].find(i=>/search/i.test(i.placeholder||''));
    if(!search) return;
    if(getComputedStyle(card).position==='static') card.style.position='relative';
    btn.classList.add('vd-pinned');
    const cr=card.getBoundingClientRect(); const sr=search.getBoundingClientRect(); const br=btn.getBoundingClientRect();
    const gap=12; const btnW=br.width||96;
    /* left of the search, relative to the card */
    let left=(sr.left-cr.left)-btnW-gap;
    if(left<8) left=8;                                  /* don't go off-card */
    const top=(sr.top-cr.top);                          /* vertically align with search */
    btn.style.left=left+'px'; btn.style.top=Math.max(8,top)+'px'; btn.style.right='auto';
  }

  /* ---------- heartbeat ---------- */
  function tick(){
    positionViewDataButton();
    if(overlayOpen()){ fixAgencyDelegColumn(); markCombos(); lockLinkedCase(); }
  }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('r01.viewdata2', tick, 600); }
  else { setInterval(tick, 600); }
  tick();
  const mo=new MutationObserver(()=>{ if(overlayOpen()){ fixAgencyDelegColumn(); markCombos(); lockLinkedCase(); } });
  try{ const ov=$('vdOverlay'); if(ov) mo.observe(ov,{childList:true,subtree:true}); }catch(e){}
  window.addEventListener('resize', positionViewDataButton);

  console.log('%c🗂 R-01 View Data Phase 2 v'+V+' active — button measured (no overlap) · Linked Case read-only auto-linked · Agency-Deleg fixed · dropdowns','color:#2E6FA3;font-weight:bold;');
})();

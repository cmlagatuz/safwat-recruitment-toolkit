
(function R01FiltersConsolidatedV425(){
  'use strict';
  if(window.__entR01FiltersV425) return; window.__entR01FiltersV425=true;
  const V='4.2.5';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const has=(fn)=>typeof window[fn]==='function';
  const log=(...a)=>console.log('%c[v4.2.5 R01Filters]','color:#2E6FA3;font-weight:bold',...a);

  /* ===== AGENCY cell (main row, once) ===== */
  function insertAgencyCell(){
    if($('visaFilterAgency')) return true;
    const sponsor=$('visaFilterSponsor'); if(!sponsor) return false;
    const sponsorWrap=sponsor.closest('div'); if(!sponsorWrap||!sponsorWrap.parentNode) return false;
    const wrap=document.createElement(sponsorWrap.tagName);
    wrap.className=sponsorWrap.className; wrap.style.cssText=sponsorWrap.style.cssText;
    const lbl=sponsorWrap.querySelector('label'); const lblTag=lbl?lbl.tagName.toLowerCase():'label';
    const lblCls=lbl?lbl.className:''; const lblStyle=lbl?(lbl.getAttribute('style')||''):'';
    wrap.innerHTML='<'+lblTag+(lblCls?(' class="'+esc(lblCls)+'"'):'')+(lblStyle?(' style="'+esc(lblStyle)+'"'):'')+'>AGENCY</'+lblTag+'>'
      +'<select id="visaFilterAgency"><option value="">All</option></select>';
    sponsorWrap.parentNode.insertBefore(wrap, sponsorWrap.nextSibling);
    $('visaFilterAgency').addEventListener('change', reRender);
    return true;
  }

  /* ===== GENDER select ===== */
  function genderSelect(){
    let s=$('entGenderFilter')||$('visaFilterGender'); if(s) return s;
    const scope=$('panel-visa')||document;
    for(const l of scope.querySelectorAll('label')){ if(/^gender/i.test((l.textContent||'').trim())){ const sel=(l.parentNode&&l.parentNode.querySelector('select'))||(l.nextElementSibling&&l.nextElementSibling.matches&&l.nextElementSibling.matches('select')?l.nextElementSibling:null); if(sel){ if(!sel.id) sel.id='visaFilterGender'; return sel; } } }
    return null;
  }

  /* ===== normalize the gender cell to match the Nationality cell ===== */
  function normalizeGenderCell(gCell, natCell){
    if(!gCell||!natCell) return;
    if(natCell.className){ natCell.className.split(/\s+/).filter(Boolean).forEach(cls=>{ if(!gCell.classList.contains(cls)) gCell.classList.add(cls); }); }
    gCell.classList.add('ent-gender-cell');
    if(genderReady) gCell.classList.add('ent-ready');
    const ncs=getComputedStyle(natCell);
    gCell.style.setProperty('display', ncs.display, 'important');
    gCell.style.setProperty('flex-direction', ncs.flexDirection, 'important');
    gCell.style.setProperty('gap', ncs.gap==='normal'?'4px':ncs.gap, 'important');
    gCell.style.setProperty('align-items', ncs.alignItems, 'important');
    gCell.style.setProperty('margin', '0', 'important');
    gCell.style.setProperty('padding', '0', 'important');
    const natLabel=natCell.querySelector('label'); const gLabel=gCell.querySelector('label');
    if(natLabel&&gLabel){ if(natLabel.className) gLabel.className=natLabel.className; const st=natLabel.getAttribute('style'); if(st) gLabel.setAttribute('style', st); gLabel.style.setProperty('margin','0 0 4px','important'); }
    const gSel=gCell.querySelector('select'); const natSel=natCell.querySelector('select');
    if(gSel&&natSel){ const scs=getComputedStyle(natSel); ['padding','fontSize','border','borderRadius','height','lineHeight'].forEach(p=>{ try{ gSel.style.setProperty(p.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()), scs[p]); }catch(e){} }); gSel.style.setProperty('width','100%','important'); gSel.style.setProperty('box-sizing','border-box','important'); }
  }

  /* ===== place + size Gender ONCE ===== */
  let genderReady=false;
  function placeAndSizeOnce(){
    if(genderReady) return true;
    const g=genderSelect(); if(!g) return false;
    const gCell=g.closest('div'); const nat=$('visaFilterNat'); const natCell=nat&&nat.closest('div'); const agency=$('visaFilterAgency');
    if(!gCell||!natCell||!natCell.parentNode||!agency) return false;
    gCell.classList.add('ent-gender-cell');
    if(gCell.previousElementSibling!==natCell || gCell.parentNode!==natCell.parentNode){ natCell.parentNode.insertBefore(gCell, natCell.nextSibling); }
    normalizeGenderCell(gCell, natCell);
    sizeFilterRow();
    if(!g.dataset.entGWired){ g.dataset.entGWired='1'; g.addEventListener('change', reRender); }
    gCell.classList.add('ent-ready'); genderReady=true;
    log('Gender placed + normalized');
    return true;
  }

  /* ===== options (exclude self) ===== */
  function optBase(exclude){ if(has('getVisaFilteredBase')){ try{ const r=window.getVisaFilteredBase([exclude]); if(Array.isArray(r)) return r; }catch(e){} } return (window.DB&&window.DB.visaRecords)||[]; }
  function populateAgencyOptions(){
    const sel=$('visaFilterAgency'); if(!sel||!window.DB) return;
    const agencies=[...new Set(optBase('agency').map(v=>(v.registeredAgencyName||'').trim()).filter(Boolean))].sort();
    const cur=sel.value; const html='<option value="">All</option>'+agencies.map(a=>'<option'+((a===cur&&agencies.includes(cur))?' selected':'')+'>'+esc(a)+'</option>').join('');
    if(sel.innerHTML!==html) sel.innerHTML=html;
    syncStickyValue('visaFilterAgency', html);
  }
  function populateGender(){
    const s=genderSelect(); if(!s||!window.DB) return;
    const genders=[...new Set(optBase('gender').map(v=>(v.gender||'').trim().toUpperCase()).filter(Boolean))].sort();
    const cur=upc(s.value); const html='<option value="">All</option>'+genders.map(g=>'<option value="'+esc(g)+'"'+(g===cur?' selected':'')+'>'+esc(g)+'</option>').join('');
    if(s.innerHTML.replace(/\s+/g,'')!==html.replace(/\s+/g,'')){ s.innerHTML=html; if(cur&&genders.includes(cur)) s.value=cur; }
    syncStickyValue('visaFilterGender', html);
  }

  /* ===== base filter wrap: agency + gender ===== */
  const agencyVal=()=>{ const s=$('visaFilterAgency'); return s?s.value:''; };
  const genderVal=()=>{ const s=genderSelect(); return s?upc(s.value):''; };
  function applyExtra(rows, excludeKeys){
    if(!Array.isArray(rows)) return rows;
    const exA=Array.isArray(excludeKeys)&&excludeKeys.includes('agency');
    const exG=Array.isArray(excludeKeys)&&excludeKeys.includes('gender');
    const av=agencyVal(), gv=genderVal();
    if(av&&!exA) rows=rows.filter(r=>(r.registeredAgencyName||'').trim()===av);
    if(gv&&!exG) rows=rows.filter(r=>(r.gender||'').trim().toUpperCase()===gv);
    return rows;
  }
  function wrapFilters(){
    if(window.__entR01Wrapped) return;
    if(!has('getVisaFiltered')||!has('getVisaFilteredBase')) return;
    window.__entR01Wrapped=true;
    const origGetFiltered=window.getVisaFiltered;
    window.getVisaFiltered=function(){ return applyExtra(origGetFiltered.apply(this,arguments), null); };
    const origBase=window.getVisaFilteredBase;
    window.getVisaFilteredBase=function(excludeKeys){ return applyExtra(origBase.apply(this,arguments), excludeKeys); };
    if(has('refreshVisaFilterOptions')){ const origRef=window.refreshVisaFilterOptions; window.refreshVisaFilterOptions=function(){ const r=origRef.apply(this,arguments); try{ populateAgencyOptions(); populateGender(); }catch(e){} return r; }; }
    log('Filter helpers wrapped (agency + gender)');
  }

  /* ===== STICKY BAR: inject Agency + Gender mirrors, two-way synced ===== */
  function stickyBar(){ return $('entStickyFilterRow')||$('entStickyWrap')||$('entStickyVisaBar')||document.querySelector('[id*="Sticky"]'); }
  function makeStickyMirror(mainId, labelText, afterMirrorId){
    const bar=stickyBar(); if(!bar) return;
    if(bar.querySelector('[data-mirror="'+mainId+'"]')) return;   /* already there */
    /* model the wrapper on an existing sticky mirror (Nationality or Sponsor) */
    const ref=bar.querySelector('[data-mirror="visaFilterSponsor"]')||bar.querySelector('[data-mirror="visaFilterNat"]')||bar.querySelector('select');
    if(!ref) return;
    const refWrap=ref.closest('div')||ref.parentElement;
    const wrap=document.createElement(refWrap?refWrap.tagName:'div'); if(refWrap){ wrap.className=refWrap.className; wrap.style.cssText=refWrap.style.cssText; }
    const refLbl=refWrap&&refWrap.querySelector('label');
    wrap.innerHTML='<label'+(refLbl&&refLbl.className?(' class="'+esc(refLbl.className)+'"'):'')+'>'+esc(labelText)+'</label><select data-mirror="'+mainId+'"><option value="">All</option></select>';
    /* place after the specified mirror (e.g., Agency after Sponsor), else append */
    const anchor=afterMirrorId?bar.querySelector('[data-mirror="'+afterMirrorId+'"]'):null;
    const anchorWrap=anchor?(anchor.closest('div')||anchor.parentElement):null;
    if(anchorWrap&&anchorWrap.parentNode){ anchorWrap.parentNode.insertBefore(wrap, anchorWrap.nextSibling); }
    else if(refWrap&&refWrap.parentNode){ refWrap.parentNode.insertBefore(wrap, refWrap.nextSibling); }
    else bar.appendChild(wrap);
    const mirror=wrap.querySelector('select');
    mirror.addEventListener('change', function(){ const main=(mainId==='visaFilterGender')?genderSelect():$(mainId); if(main){ main.value=this.value; reRender(); } });
    log(labelText+' added to sticky bar');
  }
  function ensureStickyMirrors(){
    /* Agency: after Sponsor; Gender: after Nationality (already added by prior versions, ensure it exists) */
    makeStickyMirror('visaFilterAgency','Agency','visaFilterSponsor');
    makeStickyMirror('visaFilterGender','Gender','visaFilterNat');
    populateAgencyOptions(); populateGender();
  }
  function syncStickyValue(mainId, html){
    const bar=stickyBar(); if(!bar) return;
    const m=bar.querySelector('[data-mirror="'+mainId+'"]'); if(!m) return;
    if(m.innerHTML!==html) m.innerHTML=html;
    const main=(mainId==='visaFilterGender')?genderSelect():$(mainId);
    if(main&&main.value&&[...m.options].some(o=>o.value===main.value)) m.value=main.value;
  }

  /* ===== sizing ===== */
  function sizeFilterRow(){
    const known=['visaFilterNat','visaFilterCat','visaFilterClient','visaFilterAgency','visaFilterStatus','visaFilterSponsor'];
    const cells=known.map(id=>$(id)&&$(id).closest('div')).filter(Boolean);
    const g=genderSelect(); const gCell=g&&g.closest('div'); if(gCell&&!cells.includes(gCell)) cells.push(gCell);
    if(cells.length<4) return false;
    const row=cells[0].parentNode; if(!row) return false;
    row.style.setProperty('display','flex','important'); row.style.setProperty('flex-wrap','wrap','important');
    row.style.setProperty('gap','12px','important'); row.style.setProperty('align-items','flex-end','important');
    cells.forEach(c=>{ if(c.parentNode!==row) return; c.style.setProperty('flex','1 1 130px','important'); c.style.setProperty('min-width','100px','important'); c.style.setProperty('max-width','200px','important'); const s=c.querySelector('select,input'); if(s){ s.style.setProperty('width','100%','important'); s.style.setProperty('min-width','0','important'); s.style.setProperty('box-sizing','border-box','important'); } });
    const sw=$('visaSearch')&&$('visaSearch').closest('div');
    if(sw&&sw.parentNode===row){ sw.style.setProperty('flex','2 1 220px','important'); sw.style.setProperty('min-width','180px','important'); sw.style.setProperty('max-width','340px','important'); const inp=sw.querySelector('input'); if(inp){ inp.style.setProperty('width','100%','important'); inp.style.setProperty('min-width','0','important'); inp.style.setProperty('box-sizing','border-box','important'); } }
    return true;
  }

  function reRender(){ if(has('_entDirectRenderVisa')) window._entDirectRenderVisa(); else if(has('refreshVisaView')) window.refreshVisaView(); }

  function tick(){
    insertAgencyCell();
    placeAndSizeOnce();
    if(genderReady){ const g=genderSelect(); const gCell=g&&g.closest('div'); const natCell=$('visaFilterNat')&&$('visaFilterNat').closest('div'); if(gCell&&natCell){ normalizeGenderCell(gCell,natCell); gCell.classList.add('ent-ready'); } }
    wrapFilters();
    populateAgencyOptions();
    populateGender();
    ensureStickyMirrors();
    if(genderReady) sizeFilterRow();
  }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('r01.filters', tick, 800); }
  else { let n=0; const t=setInterval(()=>{ tick(); if(++n>150) clearInterval(t); },800); }
  tick(); setTimeout(tick,120); setTimeout(tick,300); setTimeout(tick,700);

  console.log('%c🏢 R-01 Filters consolidated v'+V+' active — Agency restored to sticky bar (after Sponsor) + Gender; data-level filtering intact','color:#2E6FA3;font-weight:bold;');
})();

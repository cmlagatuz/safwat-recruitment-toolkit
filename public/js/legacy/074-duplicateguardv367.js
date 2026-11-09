
(function DuplicateGuardV367(){
  'use strict';
  const V='3.6.7';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const compact=(s)=>String(s==null?'':s).toUpperCase().replace(/[^A-Z0-9]/g,'');
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const num=(x)=>{const n=parseFloat(String(x).replace(/[^0-9.\-]/g,''));return isNaN(n)?0:n;};
  const nowIso=()=>new Date().toISOString();
  const log=(...a)=>console.log('%c[v3.6.7]','color:#C0504D;font-weight:bold',...a);
  const Toast=()=>window.Toast||{ok:console.log,warn:console.warn,err:console.error,info:console.info};

  const TYPES=[{value:'LOCAL_TRANSFER',label:'Local Transfer'},{value:'OVERSEAS_ENDORSED',label:'Overseas – Endorsed'},{value:'OVERSEAS_SOURCED',label:'Overseas – Sourced'}];
  function typeValue(label){ const L=upc(label); const t=TYPES.find(x=>upc(x.label)===L||upc(x.value)===L); if(t) return t.value; if(L.includes('LOCAL'))return 'LOCAL_TRANSFER'; if(L.includes('ENDORS'))return 'OVERSEAS_ENDORSED'; if(L.includes('SOURC'))return 'OVERSEAS_SOURCED'; if(L.includes('OVERSEAS'))return 'OVERSEAS_SOURCED'; return label; }
  const SAL=['basicSalary','foodAllowance','housingAllowance','transportationAllowance','specialAllowance'];

  /* ===== detection: PASSPORT + IQAMA only ===== */
  const passKey=(c)=>compact(c.passport), iqamaKey=(c)=>compact(c.iqama);
  function buildIndex(records){ const byPass={},byIqama={}; (records||[]).forEach(r=>{ const p=passKey(r); if(p&&p.length>=4)(byPass[p]=byPass[p]||[]).push(r); const q=iqamaKey(r); if(q&&q.length>=4)(byIqama[q]=byIqama[q]||[]).push(r); }); return {byPass,byIqama}; }
  function firstOther(bucket, ownId){ if(!bucket) return null; for(const r of bucket){ if(r.id!==ownId) return r; } return null; }
  function classify(c, idx, seen, ownId){ const p=passKey(c), q=iqamaKey(c);
    if(p&&p.length>=4){ const m=firstOther(idx.byPass[p], ownId); if(m) return {level:'existing',field:'passport',reason:'Passport already exists',match:m}; }
    if(q&&q.length>=4){ const m=firstOther(idx.byIqama[q], ownId); if(m) return {level:'existing',field:'iqama',reason:'Iqama already exists',match:m}; }
    if(seen){ if(p&&p.length>=4&&seen.pass.has(p)) return {level:'batch',field:'passport',reason:'Duplicate passport in this batch',row:seen.pass.get(p)}; if(q&&q.length>=4&&seen.iqama.has(q)) return {level:'batch',field:'iqama',reason:'Duplicate iqama in this batch',row:seen.iqama.get(q)}; }
    return {level:'',field:'',reason:''}; }
  function markSeen(c, seen, i){ const p=passKey(c),q=iqamaKey(c); if(p&&p.length>=4&&!seen.pass.has(p))seen.pass.set(p,i); if(q&&q.length>=4&&!seen.iqama.has(q))seen.iqama.set(q,i); }
  function recs(){ window.DB=window.DB||{}; window.DB.recruitmentCases=window.DB.recruitmentCases||[]; return window.DB.recruitmentCases; }

  const isVisible=(el)=>!!(el && el.offsetParent!==null && el.getClientRects().length);
  function fieldAttr(grid){ if(grid.querySelector('[data-f="name"]')) return 'data-f'; if(grid.querySelector('[data-k="name"]')) return 'data-k'; return null; }
  function getCell(tr, attr, field){ const el=tr.querySelector('['+attr+'="'+field+'"]'); return el?el.closest('td'):null; }
  function readId3(tr, attr){ const o={}; ['name','passport','iqama'].forEach(f=>{ const el=tr.querySelector('['+attr+'="'+f+'"]'); if(el) o[f]=el.value; }); return o; }
  function readAll(tr, attr){ const o={}; tr.querySelectorAll('['+attr+']').forEach(el=>{ const f=el.getAttribute(attr); if(f) o[f]=el.value; }); return o; }
  function rowOwnId(tr){ return (tr.dataset&&(tr.dataset.rec||tr.dataset.recId||tr.dataset.id)) || (tr.getAttribute&&(tr.getAttribute('data-rec')||tr.getAttribute('data-rec-id'))) || ''; }
  function candidateGrids(){ return [...document.querySelectorAll('table')].filter(t=>{ const ok=(t.querySelector('[data-f="name"]')&&t.querySelector('[data-f="passport"]'))||(t.querySelector('[data-k="name"]')&&t.querySelector('[data-k="passport"]')); return ok && isVisible(t); }); }
  const rowEmpty=(c)=>!compact(c.passport)&&!compact(c.iqama);

  function scanGrid(grid){ const attr=fieldAttr(grid); if(!attr) return 0; const rows=[...grid.querySelectorAll('tbody tr')]; const idx=buildIndex(recs()); const seen={pass:new Map(),iqama:new Map()}; let dup=0;
    rows.forEach((tr,i)=>{ tr.classList.remove('dup-row'); tr.querySelectorAll('td.dup-cell,td.dup-badge-cell').forEach(td=>{ td.classList.remove('dup-cell','dup-badge-cell'); td.removeAttribute('title'); }); const c=readId3(tr,attr); if(rowEmpty(c)){ markSeen(c,seen,i); return; } const res=classify(c,idx,seen,rowOwnId(tr)); if(res.level){ dup++; tr.classList.add('dup-row'); const td=getCell(tr,attr,res.field)||getCell(tr,attr,'passport'); if(td){ td.classList.add('dup-cell','dup-badge-cell'); td.title=res.level==='existing'?(res.reason+' → '+(res.match?(res.match.id+' · '+(res.match.name||'')):'')):(res.reason+' (row '+((res.row|0)+1)+')'); } } markSeen(c,seen,i); });
    return dup; }
  function scanAll(){ let total=0; candidateGrids().forEach(g=>{ total+=scanGrid(g); }); updateSummary(total); return total; }
  function collectGridDuplicates(){ const out=[]; candidateGrids().forEach(grid=>{ const attr=fieldAttr(grid); if(!attr) return; const idx=buildIndex(recs()); const seen={pass:new Map(),iqama:new Map()}; [...grid.querySelectorAll('tbody tr')].forEach((tr,i)=>{ const c=readId3(tr,attr); if(rowEmpty(c)){ markSeen(c,seen,i); return; } const res=classify(c,idx,seen,rowOwnId(tr)); if(res.level) out.push({tr,c,res,isNew:!rowOwnId(tr)}); markSeen(c,seen,i); }); }); return out; }

  function updateSummary(n){ const b=$('dupSummary'); if(!b) return; if(n>0){ $('dupSummaryText').textContent='⚠ '+n+' duplicate row'+(n>1?'s':''); b.classList.add('show'); } else b.classList.remove('show'); }

  const OVERLAY_IDS=['cvOverlay','vdOverlay','entCandOverlay'];
  function openOverlayContaining(el){ if(!el) return false; let node=el; while(node&&node!==document.body){ if(node.id&&OVERLAY_IDS.includes(node.id)){ node.classList.add('open'); return true; } node=node.parentElement; } for(const id of OVERLAY_IDS){ const ov=$(id); if(ov&&ov.querySelector('[data-f="name"],[data-k="name"]')){ ov.classList.add('open'); return true; } } return false; }
  function focusRow(tr){ if(!tr) return; tr.scrollIntoView({block:'center',behavior:'smooth'}); const cell=tr.querySelector('td.dup-cell'); const inp=cell&&cell.querySelector('input'); if(cell) cell.classList.add('dup-flash'); if(inp){ try{ inp.focus(); }catch(e){} } setTimeout(()=>{ if(cell) cell.classList.remove('dup-flash'); },2600); }
  function jumpToFirstDup(){ let target=[...document.querySelectorAll('tr.dup-row')].find(tr=>isVisible(tr)); if(!target){ const any=document.querySelector('tr.dup-row'); if(any){ openOverlayContaining(any); setTimeout(()=>{ scanAll(); focusRow([...document.querySelectorAll('tr.dup-row')].find(tr=>isVisible(tr))||document.querySelector('tr.dup-row')); },120); return; } for(const id of OVERLAY_IDS){ const ov=$(id); if(ov&&ov.querySelector('[data-f="name"],[data-k="name"]')){ ov.classList.add('open'); setTimeout(()=>{ scanAll(); focusRow(document.querySelector('tr.dup-row')); },150); return; } } return; } focusRow(target); }
  $('dupSummaryJump').addEventListener('click', jumpToFirstDup);

  let _t=null; const schedule=()=>{ clearTimeout(_t); _t=setTimeout(scanAll,180); };
  document.addEventListener('input',(e)=>{ const el=e.target; if(el&&el.dataset&&(el.dataset.f!=null||el.dataset.k!=null)) schedule(); }, true);
  document.addEventListener('paste',()=>{ setTimeout(scanAll,250); }, true);
  setInterval(scanAll, 1200);

  /* ===== SELF-PERSIST — NEVER DELETES ===== */
  function genCaseId(){ if(window.DB_ID_COUNTER&&typeof window.DB_ID_COUNTER.nextCase==='number'){ const n=window.DB_ID_COUNTER.nextCase++; return (typeof window.padId==='function')?window.padId('RC',n):('RC-'+String(n).padStart(6,'0')); } let max=0; recs().forEach(c=>{ const m=/RC-(\d+)/.exec(c.id||''); if(m) max=Math.max(max,parseInt(m[1],10)); }); return 'RC-'+String(max+1).padStart(6,'0'); }
  function coerce(vals, existing){ const out={...vals}; if('recruitmentType' in out) out.recruitmentType=typeValue(out.recruitmentType); SAL.forEach(f=>{ if(f in out) out[f]=num(out[f]); }); if(SAL.some(f=>f in out)){ out.totalSalary=SAL.reduce((s,f)=>{ const v=(f in out)?out[f]:(existing?existing[f]:0); return s+num(v); },0); } if('passport' in out) out.passport=String(out.passport||'').trim(); return out; }
  /* mode: 'all' saves everything; 'skipNew' skips brand-new rows flagged as duplicates. NEVER deletes. */
  function persistGrids(mode){
    let updated=0, inserted=0, skipped=0;
    const byId={}; recs().forEach(r=>byId[r.id]=r);
    /* recompute duplicate set for skip decisions */
    const idx=buildIndex(recs());
    candidateGrids().forEach(grid=>{ const attr=fieldAttr(grid); if(!attr) return;
      const seen={pass:new Map(),iqama:new Map()};
      [...grid.querySelectorAll('tbody tr')].forEach((tr,i)=>{
        const id3=readId3(tr,attr);
        const ownId=rowOwnId(tr);
        if(rowEmpty(id3) && !String(id3.name||'').trim()){ markSeen(id3,seen,i); return; }
        const res=classify(id3, idx, seen, ownId);
        markSeen(id3,seen,i);
        const isNew=!ownId;
        /* SKIP only brand-NEW rows that are duplicates. Existing rows are ALWAYS saved (never deleted). */
        if(mode==='skipNew' && res.level && isNew){ skipped++; return; }
        const raw=readAll(tr,attr);
        const existing=(ownId && byId[ownId])?byId[ownId]:null;
        const vals=coerce(raw, existing);
        if(existing){ let ch=false; Object.keys(vals).forEach(k=>{ const nv=vals[k]; if(String(existing[k]==null?'':existing[k])!==String(nv==null?'':nv)){ existing[k]=nv; ch=true; } }); if(ch){ existing.updatedAt=nowIso(); updated++; } }
        else if(String(vals.name||'').trim()!==''){ const rec={...vals}; if(!rec.recruitmentType) rec.recruitmentType='LOCAL_TRANSFER'; if(!rec.stage) rec.stage='PENDING OFFER LETTER'; rec.id=genCaseId(); rec.createdAt=nowIso(); rec.updatedAt=nowIso(); recs().push(rec); byId[rec.id]=rec; if(tr.dataset) tr.dataset.rec=rec.id; inserted++; }
      });
    });
    if(typeof window.makeIdCounter==='function'&&window.DB){ try{ window.DB_ID_COUNTER=window.makeIdCounter(window.DB); }catch{} }
    if(window.dbSave){ try{ window.dbSave(); }catch(e){ log('dbSave err '+e.message); } }
    if(window.refreshPipelineView){ try{ window.refreshPipelineView(); }catch{} }
    if(window.Audit&&window.Audit.push){ try{ window.Audit.push('bulk','recruitmentCase',null,null,'View-Data save: '+updated+' upd, '+inserted+' add, '+skipped+' skipped'); }catch{} }
    return {updated,inserted,skipped,deleted:0};
  }
  function doSave(mode){ const r=persistGrids(mode); scanAll(); Toast().ok('Saved', r.updated+' updated · '+r.inserted+' added'+(r.skipped?(' · '+r.skipped+' skipped'):'')); log('Self-persist (no deletes):', r); }

  const GUARDS=new WeakMap();
  function hookGridSaves(){ ['cvSave','cm_save'].forEach(id=>{ const btn=$(id); if(!btn||GUARDS.has(btn)) return; const h=function(e){ e.preventDefault(); e.stopImmediatePropagation(); const dups=collectGridDuplicates(); if(!dups.length){ doSave('all'); return; } openDialog(dups, { anyway:()=>doSave('all'), skip:()=>doSave('skipNew') }); }; GUARDS.set(btn,h); btn.addEventListener('click', h, true); }); }
  setInterval(hookGridSaves, 800); hookGridSaves();

  /* ===== single forms (Add #cg_*, Edit #rc_*) — never delete; base save handles persistence ===== */
  const FORMS=[ { key:'add', ids:{name:'cg_name',passport:'cg_passport',iqama:'cg_iqama'}, save:'cg_save', body:'entCandBody', idTag:null }, { key:'edit', ids:{name:'rc_name',passport:'rc_passport',iqama:'rc_iqama'}, save:'rc_save', body:'rcBody', idTag:'rcIdTag' } ];
  const FG=new WeakMap();
  function editingIdFrom(idTagId){ if(!idTagId) return null; const t=$(idTagId); if(!t) return null; const m=/RC-\d+/.exec(t.textContent||''); return m?m[0]:null; }
  function ensureBanner(form){ const bodyEl=$(form.body); if(!bodyEl) return null; let b=bodyEl.querySelector('.dup-banner[data-form="'+form.key+'"]'); if(!b){ b=document.createElement('div'); b.className='dup-banner'; b.setAttribute('data-form',form.key); bodyEl.insertBefore(b, bodyEl.firstChild); } return b; }
  function scanForm(form){ const nameEl=$(form.ids.name); if(!nameEl||!isVisible(nameEl)) return; const passEl=$(form.ids.passport), iqamaEl=$(form.ids.iqama); const banner=ensureBanner(form); const idx=buildIndex(recs()); const ownId=editingIdFrom(form.idTag); const res=classify({passport:passEl?passEl.value:'',iqama:iqamaEl?iqamaEl.value:''}, idx, null, ownId); [nameEl,passEl,iqamaEl].forEach(el=>el&&el.classList.remove('dup-input')); const saveBtn=$(form.save); if(res.level==='existing'){ const el=({passport:passEl,iqama:iqamaEl})[res.field]||passEl; if(el) el.classList.add('dup-input'); if(banner){ banner.innerHTML='⚠ '+esc(res.reason)+' — matches <b>'+esc(res.match?res.match.id:'')+'</b>'+(res.match&&res.match.name?(' ('+esc(res.match.name)+')'):'')+'.'; banner.classList.add('show'); } if(saveBtn) saveBtn.dataset.dup='1'; } else { if(banner) banner.classList.remove('show'); if(saveBtn) saveBtn.dataset.dup=''; } }
  function hookFormSaves(){ FORMS.forEach(form=>{ const btn=$(form.save); if(!btn||FG.has(btn)) return; const h=function(e){ if(btn.dataset.dup!=='1') return; e.preventDefault(); e.stopImmediatePropagation(); const passEl=$(form.ids.passport), nameEl=$(form.ids.name), iqamaEl=$(form.ids.iqama); const idx=buildIndex(recs()); const res=classify({passport:passEl?passEl.value:'',iqama:iqamaEl?iqamaEl.value:''}, idx, null, editingIdFrom(form.idTag)); openDialog([{c:{name:nameEl?nameEl.value:'',passport:passEl?passEl.value:''}, res}], { singular:true, backFocus:()=>{ (passEl||nameEl).focus(); }, anyway:()=>{ btn.dataset.dup=''; btn.removeEventListener('click',h,true); try{ btn.click(); }catch(x){ btn.dispatchEvent(new MouseEvent('click',{bubbles:true})); } setTimeout(()=>btn.addEventListener('click',h,true),0); } }, 'This candidate appears to already exist'); }; FG.set(btn,h); btn.addEventListener('click', h, true); }); }
  setInterval(hookFormSaves, 800); hookFormSaves();
  setInterval(()=>FORMS.forEach(scanForm), 500);

  /* ===== dialog ===== */
  function openDialog(dups, handlers, titleOverride){
    $('dupDlgTitle').textContent=titleOverride||('Duplicate records detected ('+dups.length+')');
    const existingMutual=dups.filter(d=>!d.isNew).length;
    const newDup=dups.filter(d=>d.isNew).length;
    const items=dups.slice(0,30).map(d=>{ const c=d.c||{}; const r=d.res||{}; const who=r.match?(r.match.id+' · '+(r.match.name||'')):(r.row!=null?('batch row '+((r.row|0)+1)):''); const tag=d.isNew?'[NEW]':'[existing]'; return '<li>'+tag+' '+esc(c.name||'(no name)')+' · '+esc(c.passport||'(no passport)')+' — '+esc(r.reason||'duplicate')+(who?(' → '+esc(who)):'')+'</li>'; }).join('');
    let note='';
    if(existingMutual>0) note='<div class="note">⚠ '+existingMutual+' of these are EXISTING records that share a passport/iqama with another existing record. Nothing will be deleted — both are kept. Please review/merge them manually.</div>';
    $('dupDlgBody').innerHTML=note+'<div>'+(handlers.singular?'The details you entered match an existing record (by passport/iqama):':(dups.length+' row(s) match an existing PASSPORT/IQAMA or repeat within your entry:'))+'</div><ul>'+items+'</ul>'+(dups.length>30?'<div style="margin-top:6px;color:#8E7F6A">…and '+(dups.length-30)+' more.</div>':'');
    const ft=$('dupDlgFt'); ft.innerHTML='';
    const mk=(cls,txt,fn)=>{ const b=document.createElement('button'); b.className=cls; b.textContent=txt; b.addEventListener('click',()=>{ close(); fn&&fn(); }); return b; };
    if(handlers.singular){ ft.appendChild(mk('cancel','Go back & edit', handlers.backFocus)); ft.appendChild(mk('anyway','Save anyway', handlers.anyway)); }
    else {
      ft.appendChild(mk('cancel','Cancel', null));
      ft.appendChild(mk('anyway','Save all (nothing deleted)', handlers.anyway));
      if(newDup>0) ft.appendChild(mk('skip','Skip '+newDup+' NEW duplicate'+(newDup>1?'s':'')+' & save', handlers.skip));
    }
    $('dupDlg').classList.add('open');
  }
  function close(){ $('dupDlg').classList.remove('open'); }
  $('dupDlg').addEventListener('click',(e)=>{ if(e.target===$('dupDlg')) close(); });

  window._entDupScan=scanAll; window._entDupReview=jumpToFirstDup; window._entDupCore={buildIndex,classify,compact};
  console.log('%c🚫 Duplicate detection v'+V+' active (SAFE · never deletes existing records)','color:#C0504D;font-weight:bold;');
})();


(function VisaIntelV2939(){
  'use strict';
  const V='2.9.39';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const nowIso=()=>new Date().toISOString();
  const log=(...a)=>console.log('%c[v2.9.39]','color:#2F5A3B;font-weight:bold',...a);
  const Toast=()=>window.Toast||{ok:console.log,warn:console.warn,err:console.error,info:console.info};
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const digits=(s)=>String(s==null?'':s).replace(/\D/g,'');
  const daysUntil=(d,now)=>{ if(!d) return null; const x=new Date(d); if(isNaN(x)) return null; return Math.floor((x-now)/86400000); };

  function pipelineTable(){ const byId=$('pipelineMainTable'); if(byId) return byId; for(const t of document.querySelectorAll('table')){ const heads=[...t.querySelectorAll('th')].map(th=>upc(th.textContent)); const isVisa=heads.some(h=>h.includes('VISA DOC')||h.includes('QIWA')); if(isVisa) continue; if(heads.some(h=>h.includes('NAME'))&&(heads.some(h=>h.includes('STAGE'))||heads.some(h=>h.includes('LINKED VISA')))) return t; } return null; }
  function scrollWrapper(t){ let el=t.parentNode; while(el&&el!==document.body){ const s=getComputedStyle(el); if(/(auto|scroll)/.test((s.overflowX||'')+(s.overflowY||''))) return el; el=el.parentNode; } return null; }

  /* ── 1) SCROLL FIX: relocate controls out of scroll wrapper ── */
  function relocateControls(){ const t=pipelineTable(); const ctr=$('entPipeControls'); if(!t||!ctr) return; const wrap=scrollWrapper(t); const host=(wrap&&wrap.parentNode)?wrap.parentNode:t.parentNode; const before=(wrap&&wrap.parentNode)?wrap:t; if(ctr.parentNode!==host){ host.insertBefore(ctr, before); } }
  setInterval(relocateControls, 800);

  /* ── 1b) ROBUST FLOATING HEADER (clone) ── */
  function realHeaderCells(t){ const ths=[...t.querySelectorAll('thead th')]; if(ths.length) return ths; const firstTr=t.querySelector('tr'); return firstTr?[...firstTr.querySelectorAll('th')]:[]; }
  function buildFloatHead(){
    const t=pipelineTable(); if(!t) return;
    const wrap=scrollWrapper(t); if(!wrap) return;
    const cells=realHeaderCells(t); if(!cells.length) return;
    let fh=wrap.querySelector(':scope > .ent-float-head');
    if(!fh){ fh=document.createElement('div'); fh.className='ent-float-head'; wrap.insertBefore(fh, wrap.firstChild); }
    /* rebuild cells if column count changed */
    if(fh.children.length!==cells.length){ fh.innerHTML=cells.map(()=>'<div class="fh-cell"></div>').join(''); }
    /* mirror text + widths + total width so it scrolls horizontally with content */
    let total=0;
    cells.forEach((th,i)=>{ const w=th.getBoundingClientRect().width; total+=w; const c=fh.children[i]; if(!c) return; c.style.width=w+'px'; c.style.minWidth=w+'px'; c.style.maxWidth=w+'px'; c.textContent=th.textContent.trim(); });
    fh.style.width=total+'px';
    /* hide the real header row so we don't see a double header, but keep its layout by leaving cells;
       instead of hiding (which shifts layout), we simply overlay — the float sits sticky at top and
       covers the real one when scrolled. Make real thead transparent text? Keep as-is; the float is opaque. */
  }
  setInterval(buildFloatHead, 700);
  window.addEventListener('resize', buildFloatHead);

  /* ── 2) Bulk Start Visa button ── */
  function ensureStartVisaBtn(){ const bar=$('entPipeBar'); if(!bar) return; if($('entPipeStartVisa')) return; const del=$('entPipeDelete'); const b=document.createElement('button'); b.type='button'; b.id='entPipeStartVisa'; b.className='startvisa'; b.textContent='Bulk Start Visa'; b.addEventListener('click', openBulkStartVisa); if(del) del.parentNode.insertBefore(b, del.nextSibling); else bar.appendChild(b); }
  setInterval(ensureStartVisaBtn, 700);

  /* ── selection ── */
  function dbCases(){ return (window.DB&&window.DB.recruitmentCases)||[]; }
  function checkedRows(){ const t=pipelineTable(); if(!t) return []; return [...t.querySelectorAll('input[type="checkbox"]:checked')].filter(cb=>!cb.closest('thead')&&cb.closest('tr')&&cb.closest('tr').querySelectorAll('td').length>=2).map(cb=>cb.closest('tr')); }
  function idFromButtons(tr){ const found=[]; tr.querySelectorAll('button, a, [data-id], [data-case-id]').forEach(el=>{ if(el.matches&&el.matches('input')) return; if(el.attributes) for(const a of el.attributes){ const m=(a.value||'').match(/RC-\d{3,}/g); if(m) m.forEach(x=>found.push(x)); } const oc=(el.getAttribute&&(el.getAttribute('onclick')||el.getAttribute('href')))||''; const m2=String(oc).match(/RC-\d{3,}/g); if(m2) m2.forEach(x=>found.push(x)); }); const set=new Set(dbCases().map(c=>c.id)); return [...new Set(found)].filter(id=>set.has(id)); }
  function recordForRow(tr, taken){ taken=taken||new Set(); const recs=dbCases(); const ids=idFromButtons(tr); for(const id of ids){ if(!taken.has(id)) return recs.find(c=>c.id===id); } const cells=[...tr.querySelectorAll('td')].map(td=>td.textContent.trim()); const cUP=cells.map(upc); for(const rec of recs){ if(taken.has(rec.id)) continue; const nm=upc(rec.name); if(nm&&cUP.includes(nm)) return rec; } const rowDigits=cells.map(digits).filter(d=>d.length>=6); for(const rec of recs){ if(taken.has(rec.id)) continue; const pd=digits(rec.passport); if(pd.length>=6&&rowDigits.includes(pd)) return rec; } return null; }
  function selectedCandidates(){ const taken=new Set(),out=[]; checkedRows().forEach(tr=>{ const rec=recordForRow(tr,taken); if(rec){ taken.add(rec.id); out.push(rec); } }); return out; }

  /* ── VISA BLOCKS (client-aware) ── */
  function safwatVisas(){ return ((window.DB&&window.DB.visaRecords)||[]).filter(v=>v.sponsor==='SAFWAT'); }
  /* available for a candidate:
       CLIENT-ALLOCATED: status ALLOCATED, same client, not yet linked to a case
       UNUSED-POOL: status UNUSED (any client) */
  function availableVisasFor(cand, now){
    const client=upc(cand.client);
    return safwatVisas().filter(v=>{
      if(v.linkedRecruitmentCaseId) return false;
      const s=(v.statusVisa||'').toUpperCase();
      if(s==='ALLOCATED' && upc(v.client)===client && client) return true;
      if(s==='UNUSED') return true;
      return false;
    });
  }
  function blockKey(v){ const src=((v.statusVisa||'').toUpperCase()==='ALLOCATED')?'CLIENT':'POOL'; return [src, upc(v.nationality), upc(v.visaCategory), upc(v.registeredAgencyName)].join('|'); }
  function buildBlocksFor(cand, now){
    const avail=availableVisasFor(cand, now);
    /* prefer matching nationality+category, but include all as options (freedom) */
    const map={};
    avail.forEach(v=>{ const k=blockKey(v); if(!map[k]) map[k]={src:((v.statusVisa||'').toUpperCase()==='ALLOCATED')?'CLIENT':'POOL', nationality:v.nationality, visaCategory:v.visaCategory, agency:v.registeredAgencyName, list:[]}; map[k].list.push(v); });
    const wantN=upc(cand.nationality), wantC=upc(cand.visaCategory);
    return Object.values(map).map(b=>{ b.list.sort((a,c)=>{ const da=daysUntil(a.expirationDate,now), dc=daysUntil(c.expirationDate,now); return (da==null?9e9:da)-(dc==null?9e9:dc); }); b.qty=b.list.length; b.minDays=daysUntil(b.list[0].expirationDate,now); b.exact=(upc(b.nationality)===wantN && upc(b.visaCategory)===wantC); b.key=blockKey(b.list[0]); return b; })
      .sort((a,b)=>{ if(a.exact!==b.exact) return a.exact?-1:1; if(a.src!==b.src) return a.src==='CLIENT'?-1:1; return (a.minDays==null?9e9:a.minDays)-(b.minDays==null?9e9:b.minDays); });
  }

  function buildPlan(cands, now){
    const usedVisa=new Set();
    const rows=cands.map(c=>{
      const blocks=buildBlocksFor(c, now).map(b=>({ ...b, list:b.list.filter(v=>!usedVisa.has(v.id)) })).filter(b=>b.list.length);
      const auto=blocks[0]||null;           /* best: exact + client + soonest */
      if(auto) usedVisa.add(auto.list[0].id);
      return { cand:c, blocks, chosenKey: auto?auto.key:null };
    });
    /* balance per nationality|category (need vs unused) */
    const groups={};
    cands.forEach(c=>{ const k=upc(c.nationality)+'|'+upc(c.visaCategory); groups[k]=groups[k]||{nat:c.nationality,cat:c.visaCategory,need:0,unused:0,allocFree:0}; groups[k].need++; });
    safwatVisas().forEach(v=>{ if(v.linkedRecruitmentCaseId) return; const k=upc(v.nationality)+'|'+upc(v.visaCategory); if(!groups[k]) return; const s=(v.statusVisa||'').toUpperCase(); if(s==='UNUSED') groups[k].unused++; else if(s==='ALLOCATED') groups[k].allocFree++; });
    const groupList=Object.values(groups).map(g=>({...g, balance:(g.unused+g.allocFree)-g.need}));
    return { rows, groupList };
  }

  function insights(plan, now){
    const o=[]; const numHi=n=>'<span class="n">'+n+'</span>';
    const matched=plan.rows.filter(r=>r.chosenKey).length, unmatched=plan.rows.length-matched;
    if(unmatched>0) o.push({level:'crit', html:numHi(unmatched)+' candidate(s) have <b>no available visa</b> in their client allocation or the unused pool — request new visas.'});
    else o.push({level:'good', html:'Every selected candidate can be allocated a visa now.'});
    const clientFirst=plan.rows.filter(r=>{ const b=r.blocks.find(x=>x.key===r.chosenKey); return b&&b.src==='CLIENT'; }).length;
    if(clientFirst>0) o.push({level:'good', html:numHi(clientFirst)+' assignment(s) reuse visas <b>already allocated to that client</b> — no new pool visas consumed.'});
    const soon=plan.rows.filter(r=>{ const b=r.blocks.find(x=>x.key===r.chosenKey); return b&&b.minDays!=null&&b.minDays<=30; }).length;
    if(soon>0) o.push({level:'warn', html:'Good timing: '+numHi(soon)+' assignment(s) use visas expiring within 30 days first.'});
    plan.groupList.forEach(g=>{ if(g.balance<0) o.push({level:'crit', html:'Deficit in <b>'+esc(g.nat)+' / '+esc(g.cat)+'</b>: short by '+numHi(Math.abs(g.balance))+' visa(s).'}); else if(g.balance>0) o.push({level:'info', html:'Surplus in <b>'+esc(g.nat)+' / '+esc(g.cat)+'</b>: '+numHi(g.balance)+' will remain.'}); });
    return o.slice(0,6);
  }

  let _plan=null, _srcFilter='all';
  function openBulkStartVisa(){
    if(!window.DB){ Toast().err('Database not open'); return; }
    const cands=selectedCandidates();
    if(cands.length<1){ Toast().warn('Select candidates','Tick at least one candidate row.'); return; }
    const now=new Date(); _srcFilter='all';
    _plan=buildPlan(cands, now);
    renderIntel(now);
    $('visaIntelOverlay').classList.add('open');
  }
  function renderIntel(now){
    const cands=_plan.rows.map(r=>r.cand);
    $('viTitle').textContent='Bulk Start Visa — '+cands.length+' Candidate(s)';
    const matched=_plan.rows.filter(r=>r.chosenKey).length;
    $('viSub').textContent=matched+' of '+cands.length+' ready · you choose which visa block each pulls from';

    const ins=insights(_plan, now);
    const insHtml='<div class="vi-insights"><h4>Smart Recommendations</h4>'+ins.map(i=>'<div class="vi-ins"><span class="m '+i.level+'"></span><span>'+i.html+'</span></div>').join('')+'</div>';

    const balHtml='<div class="vi-card"><h4>Visa Balance <span class="sub">by Nationality / Category (available = unused + free client-allocated)</span></h4><table class="vi-tbl"><thead><tr><th>Nationality</th><th>Category</th><th class="right">Need</th><th class="right">Unused</th><th class="right">Client-Alloc Free</th><th class="center">Balance</th></tr></thead><tbody>'+
      _plan.groupList.map(g=>{ const cls=g.balance<0?'crit':(g.balance===0?'warn':'ok'); const rc=g.balance<0?'crit-row':(g.balance===0?'warn-row':''); const bal=(g.balance>0?'+':'')+g.balance+(g.balance<0?' short':(g.balance===0?' exact':' spare')); return '<tr class="'+rc+'"><td>'+esc(g.nat||'—')+'</td><td>'+esc(g.cat||'—')+'</td><td class="mono">'+g.need+'</td><td class="mono">'+g.unused+'</td><td class="mono">'+g.allocFree+'</td><td class="center '+cls+'">'+bal+'</td></tr>'; }).join('')+
      '</tbody></table></div>';

    const srcToggle='<div class="vi-src-toggle"><button class="'+(_srcFilter==='all'?'active':'')+'" data-src="all">All sources</button><button class="'+(_srcFilter==='CLIENT'?'active':'')+'" data-src="CLIENT">Client-allocated only</button><button class="'+(_srcFilter==='POOL'?'active':'')+'" data-src="POOL">Unused pool only</button></div>';

    const planHtml='<div class="vi-card"><h4>Choose the Visa Block per Candidate <span class="sub">client-allocated offered first; you can override</span></h4>'+srcToggle+
      '<table class="vi-tbl"><thead><tr><th>Candidate</th><th>Client</th><th>Nat / Cat</th><th>Visa Block (pick one)</th><th class="center">Qty</th><th class="center">Earliest</th></tr></thead><tbody>'+
      _plan.rows.map((r,idx)=>{
        const blocks=r.blocks.filter(b=>_srcFilter==='all'||b.src===_srcFilter);
        let sel;
        if(!blocks.length){ sel='<select class="vi-pick none" disabled><option>No visa available</option></select>'; }
        else {
          sel='<select class="vi-pick" data-row="'+idx+'">'+blocks.map(b=>{ const lbl=(b.src==='CLIENT'?'CLIENT · ':'POOL · ')+esc(b.nationality||'—')+' / '+esc(b.visaCategory||'—')+(b.agency?(' / '+esc(b.agency)):'')+' — qty '+b.list.length+', '+(b.minDays==null?'no exp':b.minDays+'d')+(b.exact?'':'  (other cat)'); return '<option value="'+esc(b.key)+'"'+(b.key===r.chosenKey?' selected':'')+'>'+lbl+'</option>'; }).join('')+'</select>'; }
        const chosen=blocks.find(b=>b.key===r.chosenKey)||blocks[0];
        const qty=chosen?chosen.list.length:'—';
        const days=chosen?(chosen.minDays==null?'—':(chosen.minDays<=30?('<b style="color:#8F3125">'+chosen.minDays+'d</b>'):chosen.minDays+'d')):'—';
        const badge=chosen?('<span class="vi-blk-badge '+(chosen.src==='CLIENT'?'client">CLIENT':'pool">POOL')+'</span>'):'';
        return '<tr><td>'+badge+esc(r.cand.name)+'</td><td>'+esc(r.cand.client||'—')+'</td><td>'+esc(r.cand.nationality||'—')+' / '+esc(r.cand.visaCategory||'—')+'</td><td>'+sel+'</td><td class="center mono">'+qty+'</td><td class="center">'+days+'</td></tr>';
      }).join('')+
      '</tbody></table></div>';

    const actions='<div class="vi-actions"><button type="button" class="secondary" id="viCancel">Cancel</button><button type="button" class="primary" id="viApply"'+(matched<1?' disabled':'')+'>Allocate &amp; Start '+matched+' Visa(s)</button></div>';
    $('visaIntelBody').innerHTML=insHtml+balHtml+planHtml+actions;

    /* wire source toggle */
    $('visaIntelBody').querySelectorAll('.vi-src-toggle [data-src]').forEach(b=>b.addEventListener('click',()=>{ _srcFilter=b.dataset.src; renderIntel(now); }));
    /* wire per-row dropdown */
    $('visaIntelBody').querySelectorAll('select.vi-pick[data-row]').forEach(sel=>sel.addEventListener('change',()=>{ const idx=parseInt(sel.dataset.row,10); _plan.rows[idx].chosenKey=sel.value; renderIntel(now); }));
    $('viCancel').addEventListener('click', closeIntel);
    const ap=$('viApply'); if(ap) ap.addEventListener('click', applyPlan);
  }
  function closeIntel(){ $('visaIntelOverlay').classList.remove('open'); }
  $('viClose').addEventListener('click', closeIntel);
  $('visaIntelOverlay').addEventListener('click',(e)=>{ if(e.target===$('visaIntelOverlay')) closeIntel(); });

  function applyPlan(){
    if(!_plan) return; const now=new Date();
    const btn=$('viApply'); btn.disabled=true; btn.textContent='Allocating…';
    const usedVisa=new Set(); let done=0;
    _plan.rows.forEach(r=>{ if(!r.chosenKey) return; const block=r.blocks.find(b=>b.key===r.chosenKey); if(!block) return; const v=block.list.find(x=>!usedVisa.has(x.id)); if(!v) return; usedVisa.add(v.id); const c=r.cand;
      v.statusVisa='ALLOCATED'; v.linkedRecruitmentCaseId=c.id; if(!v.client&&c.client) v.client=c.client; v.updatedAt=nowIso();
      c.linkedVisaId=v.id; if(!c.visaCategory&&v.visaCategory) c.visaCategory=v.visaCategory; if(!c.agency&&v.registeredAgencyName) c.agency=v.registeredAgencyName; c.stage='FOR MEDICAL APPOINTMENT'; c.updatedAt=nowIso();
      done++;
    });
    if(typeof window.makeIdCounter==='function'&&window.DB){ try{ window.DB_ID_COUNTER=window.makeIdCounter(window.DB); }catch{} }
    if(window.dbSave){ try{ window.dbSave(); }catch(e){ log('save err '+e.message); } }
    if(window.refreshPipelineView){ try{ window.refreshPipelineView(); }catch{} }
    if(window.refreshVisaView){ try{ window.refreshVisaView(); }catch{} }
    if(window.Audit&&window.Audit.push){ try{ window.Audit.push('bulk','recruitmentCase',null,null,'Bulk started visa for '+done+' candidate(s)'); }catch{} }
    const t=pipelineTable(); if(t){ t.querySelectorAll('input[type="checkbox"]:checked').forEach(b=>{ if(!b.closest('thead')) b.checked=false; }); }
    btn.disabled=false; btn.textContent='Allocate & Start'; closeIntel();
    Toast().ok('Started '+done+' visa(s)','Allocated from your chosen visa blocks.');
    log('Bulk Start Visa allocated '+done);
  }

  window._entOpenBulkStartVisa=openBulkStartVisa;
  console.log('%c🧠 Floating header + client-aware visa allocation v'+V+' active','color:#2F5A3B;font-weight:bold;');
})();

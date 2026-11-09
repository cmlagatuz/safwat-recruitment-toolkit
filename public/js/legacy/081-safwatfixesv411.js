
(function SafwatFixesV411(){
  'use strict';
  if(window.__entFixV411) return; window.__entFixV411=true;
  window.__entFixV410=true;                      /* neutralize v4.1.0 */
  const V='4.1.1';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const compact=(s)=>String(s==null?'':s).toUpperCase().replace(/[^A-Z0-9]/g,'');
  const has=(v)=>v!=null&&String(v).trim()!=='';
  const nowIso=()=>new Date().toISOString();
  const log=(...a)=>console.log('%c[v4.1.1]','color:#2F5A3B;font-weight:bold',...a);
  const Toast=()=>window.Toast||{ok:console.log,warn:console.warn,err:console.error,info:console.info};

  function DB(){ try{ if(window._entCEO_DB) return window._entCEO_DB(); }catch(e){} return window.DB||{}; }
  const cases=()=>DB().recruitmentCases||[];
  const visas=()=>DB().visaRecords||[];
  function parseDate(s){ if(!s) return null; const t=String(s).trim().replace(/[.\/]/g,'-');
    let m=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if(m){const y=+m[1]; if(y>=1900){const d=new Date(y,+m[2]-1,+m[3]); return isNaN(d.getTime())?null:d;} return null;}
    m=t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/); if(m){const d=new Date(+m[3],+m[2]-1,+m[1]); return isNaN(d.getTime())?null:d;}
    const d=new Date(s); return isNaN(d.getTime())?null:d; }
  const DAY=86400000;

  /* =====================================================
     Upcoming Expirations — render once, no DOM fighting
     ===================================================== */
  let EXP_WINDOW=180;
  let SIG='';                    /* data+window signature */
  let INTERACTING=false, interactTimer=null;
  function markInteracting(){ INTERACTING=true; clearTimeout(interactTimer); interactTimer=setTimeout(()=>{ INTERACTING=false; }, 1500); }

  const expKey=(v)=>[v.visaDocumentNumber||'',v.sponsorId||'',upc(v.visaCategory),upc(v.nationality),upc(v.stampingCity),upc(v.gender),upc(v.client)].join('|');
  function grouped(windowDays){
    const now=new Date(); const g={};
    visas().forEach(v=>{ const s=upc(v.statusVisa); if(s!=='UNUSED'&&s!=='ALLOCATED') return;
      const d=parseDate(v.expirationDate); if(!d) return;
      const days=Math.floor((d-now)/DAY);
      if(days<0||days>windowDays) return;
      const k=expKey(v);
      if(!g[k]) g[k]={doc:v.visaDocumentNumber||'—',sid:v.sponsorId||'—',cat:v.visaCategory||'—',nat:v.nationality||'—',city:v.stampingCity||'—',gender:v.gender||'—',client:v.client||'—',qty:0,days:Infinity};
      g[k].qty++; if(days<g[k].days) g[k].days=days; });
    const groups=Object.values(g).sort((a,b)=>a.days-b.days);
    const inWindow=groups.reduce((s,x)=>s+x.qty,0);   /* header count == table content */
    return {groups,inWindow};
  }

  function visaPanel(){ return $('panel-visa'); }
  /* tag legacy blocks ONCE so CSS hides them — never remove, so nothing can re-insert in a loop */
  function hideLegacyOnce(){
    const p=visaPanel(); if(!p) return;
    p.querySelectorAll('.card, section, .ceo-sec, div').forEach(el=>{
      if(el.id==='v41Exp' || el.closest('#v41Exp')) return;
      if(el.classList.contains('v41-legacy-exp')) return;
      const h=el.querySelector(':scope > h3, :scope > h4');
      if(!h) return;
      if(/upcoming expirations/i.test((h.textContent||'').trim())){ el.classList.add('v41-legacy-exp'); }
    });
  }

  function ensureHost(){
    let host=$('v41Exp'); if(host) return host;
    const p=visaPanel(); if(!p) return null;
    host=document.createElement('div'); host.id='v41Exp'; host.className='card';
    const anchor=[...p.querySelectorAll('.card, section')].find(el=>{ const h=el.querySelector('h3,h4'); return h&&/all visa records/i.test(h.textContent||''); });
    if(anchor&&anchor.parentNode) anchor.parentNode.insertBefore(host, anchor); else p.appendChild(host);
    /* keep interaction inside our block from triggering redraws */
    host.addEventListener('mousedown', markInteracting, true);
    host.addEventListener('change', markInteracting, true);
    host.addEventListener('focusin', markInteracting, true);
    return host;
  }

  function render(force){
    const host=ensureHost(); if(!host) return;
    const {groups,inWindow}=grouped(EXP_WINDOW);
    const sig=visas().length+'|'+EXP_WINDOW+'|'+inWindow+'|'+groups.length;
    if(!force && sig===SIG) return;           /* nothing changed → no DOM write */
    if(!force && INTERACTING) return;         /* never redraw under the cursor */
    SIG=sig;
    host.innerHTML=
      '<h3 style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 6px">Upcoming Expirations '+
        '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#2E6FA3;font-weight:400">('+inWindow+' in window)</span>'+
        '<span style="flex:1"></span><button class="v41-btn" id="v41ExpExport">Export Excel</button></h3>'+
      '<div class="exp-note">Visas expiring in the selected window, grouped by Visa Doc # · Sponsor ID · Category · Nationality · City · Gender · Client. Quantity = how many in that group; Days Left = the soonest-expiring visa in the group.</div>'+
      '<div class="exp-tools"><select id="v41ExpWin">'+[30,60,90,180,365].map(d=>'<option value="'+d+'"'+(d===EXP_WINDOW?' selected':'')+'>Next '+d+' days</option>').join('')+'</select>'+
      '<span class="exp-count">'+groups.length+' group(s) · '+inWindow+' visa(s) · next '+EXP_WINDOW+' days</span></div>'+
      (groups.length
        ? '<div class="rowlist" style="max-height:380px;overflow:auto;border:1px solid #EDE7D6;border-radius:8px"><table><thead><tr>'+
          ['Visa Doc #','Sponsor ID','Category','Nationality','City (Stamping)','Gender','Client'].map(h=>'<th>'+h+'</th>').join('')+
          '<th class="r">Quantity</th><th class="r">Days Left</th></tr></thead><tbody>'+
          groups.map(g=>'<tr><td class="mono">'+esc(g.doc)+'</td><td class="mono">'+esc(g.sid)+'</td><td class="cat">'+esc(g.cat)+'</td>'+
            '<td>'+esc(g.nat)+'</td><td>'+esc(g.city)+'</td><td>'+esc(g.gender)+'</td><td>'+esc(g.client)+'</td>'+
            '<td class="r"><span class="chip qty">'+g.qty+'</span></td>'+
            '<td class="r"><span class="chip days'+(g.days<=30?' soon':'')+'">'+g.days+'d</span></td></tr>').join('')+
          '</tbody></table></div>'
        : '<div style="text-align:center;padding:24px;color:#A89B82;font-family:\'IBM Plex Mono\',monospace;font-size:12px">No visas expiring in the selected window.</div>');

    const sel=$('v41ExpWin');
    if(sel) sel.addEventListener('change',()=>{ markInteracting(); EXP_WINDOW=parseInt(sel.value,10)||180; render(true); });
    const ex=$('v41ExpExport');
    if(ex) ex.addEventListener('click',()=>{
      if(window.EntExport&&window.EntExport.xlsx) window.EntExport.xlsx(
        ['Visa Doc #','Sponsor ID','Category','Nationality','City (Stamping)','Gender','Client','Quantity','Days Left'],
        groups.map(g=>[g.doc,g.sid,g.cat,g.nat,g.city,g.gender,g.client,g.qty,g.days]),
        'UPCOMING EXPIRATIONS — NEXT '+EXP_WINDOW+' DAYS','Expirations','UPCOMING EXPIRATIONS.xlsx');
      else Toast().err('Export failed','Universal exporter not loaded.');
    });
  }

  /* =====================================================
     auto-link visas ↔ candidates by passport (from v4.1.0)
     ===================================================== */
  function autoLink(silent){
    const C=cases(), Vz=visas();
    if(!C.length||!Vz.length) return 0;
    const byPass={};
    Vz.forEach(v=>{ const p=compact(v.passport); if(p.length>=4)(byPass[p]=byPass[p]||[]).push(v); });
    let linked=0;
    C.forEach(c=>{
      if(has(c.linkedVisaId)) return;
      const p=compact(c.passport); if(p.length<4) return;
      const pool=byPass[p]||[];
      const v=pool.find(x=>!has(x.linkedRecruitmentCaseId)) || pool.find(x=>x.linkedRecruitmentCaseId===c.id);
      if(v){ c.linkedVisaId=v.id; v.linkedRecruitmentCaseId=c.id; c.updatedAt=nowIso(); v.updatedAt=nowIso(); linked++; }
    });
    if(linked>0){
      try{ if(window.dbSave) window.dbSave(); }catch(e){}
      try{ if(window.Audit&&window.Audit.push) window.Audit.push('bulk','recruitmentCase',null,null,'Auto-linked '+linked+' candidate(s) to visas by passport'); }catch(e){}
      refreshAll();
      if(!silent) Toast().ok('Auto-linked', linked+' candidate(s) matched to visas');
      log('auto-linked '+linked+' pair(s)');
    } else if(!silent){ Toast().info('Nothing to link','No unlinked candidate/visa passport matches found.'); }
    return linked;
  }
  window._entAutoLinkVisas=autoLink;
  function ensureLinkButton(){
    const panel=$('panel-pipeline')||$('pipelineDashboard'); if(!panel||$('v41LinkBtn')) return;
    const anchor=$('entAddCandidateBtn')||panel.querySelector('button');
    const b=document.createElement('button'); b.id='v41LinkBtn'; b.type='button'; b.className='v41-btn'; b.style.marginLeft='8px';
    b.textContent='🔗 Auto-link visas'; b.title='Match unlinked candidates to unlinked visa records by passport';
    b.addEventListener('click',()=>autoLink(false));
    if(anchor&&anchor.parentNode) anchor.parentNode.insertBefore(b, anchor.nextSibling); else panel.insertBefore(b, panel.firstChild);
  }

  /* VISA ISSUED counts as Deployed / Visa Issued */
  function patchStageCategory(){
    if(window.__v41StageCat) return;
    if(typeof window.stageCategory!=='function') return;
    window.__v41StageCat=true;
    const orig=window.stageCategory;
    window.stageCategory=function(stage){
      const s=upc(stage);
      if(s==='DEPLOYED'||s==='VISA ISSUED'||s.includes('FOR DEPLOYMENT')||s.includes('READY FOR TRAVEL')) return 'Deployed';
      return orig.apply(this, arguments);
    };
    log('stageCategory patched — VISA ISSUED counts as Deployed / Visa Issued');
  }

  function refreshAll(){
    try{ if(window._entDirectRenderVisa) window._entDirectRenderVisa(); }catch(e){}
    try{ if(window.refreshVisaView) window.refreshVisaView(); }catch(e){}
    try{ if(window.refreshPipelineView) window.refreshPipelineView(); }catch(e){}
    try{ if(window.EntHealth&&window.EntHealth.render) window.EntHealth.render(); }catch(e){}
  }
  function hookSaves(){
    [['vdSave','R-01'],['cvSave','R-02']].forEach(([id,label])=>{
      const b=$(id); if(!b||b.dataset.v41save==='1') return; b.dataset.v41save='1';
      b.addEventListener('click',()=>{ setTimeout(()=>{ autoLink(true); refreshAll(); SIG=''; render(true); log('post-save refresh ('+label+')'); }, 260); }, false);
    });
  }

  /* ---------- heartbeat: cheap checks only ---------- */
  function tick(){
    patchStageCategory(); hookSaves(); ensureLinkButton();
    const p=visaPanel(); if(!p||!p.classList.contains('active')) return;
    hideLegacyOnce();          /* class-add only; idempotent, no removal */
    render(false);             /* renders only if the signature changed */
  }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('fix.v411', tick, 1200); }
  else { setInterval(tick, 1200); }
  setTimeout(tick, 600);

  window._entFixes411={ autoLink, grouped, refreshAll, render:()=>render(true) };
  console.log('%c🔧 Fixes v'+V+' — Upcoming Expirations no longer flickers (legacy hidden via CSS, render-on-change only)','color:#2F5A3B;font-weight:bold;');
})();

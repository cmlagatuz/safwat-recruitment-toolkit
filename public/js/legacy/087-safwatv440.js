
(function SafwatV440(){
  'use strict';
  if(window.__entV440) return; window.__entV440=true;
  const V='4.4.0';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const log=(...a)=>console.log('%c[v4.4.0]','color:#8C6A22;font-weight:bold',...a);
  const Toast=()=>window.Toast||{ok:console.log,warn:console.warn,err:console.error};

  /* =====================================================
     0) stand down every other expirations renderer
     ===================================================== */
  (function standDown(){
    try{ if(window.EntCore&&window.EntCore.clear){
      ['fix.v410','fix.v411','fix.v412','r01.expirations','ceo.v380','ceo.v381'].forEach(id=>{ try{ window.EntCore.clear(id); }catch(e){} });
    } }catch(e){}
    ['__entFixV410','__entFixV411','__entFixV412','__entRestoreV430'].forEach(k=>{ try{ window[k]=true; }catch(e){} });
    ['_entFixes410','_entFixes411','_entFixes412'].forEach(k=>{ try{ if(window[k]){ window[k].render=function(){}; window[k].dedupeAndRender=function(){}; } }catch(e){} });
    log('other expirations renderers stood down');
  })();

  const DBx=()=>{ try{ if(window._entCEO_DB) return window._entCEO_DB(); }catch(e){} return window.DB||{}; };
  const visas=()=>DBx().visaRecords||[];
  const cases=()=>DBx().recruitmentCases||[];
  function parseDate(s){ if(!s) return null; const t=String(s).trim().replace(/[.\/]/g,'-');
    let m=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if(m){const y=+m[1]; if(y>=1900){const d=new Date(y,+m[2]-1,+m[3]); return isNaN(d.getTime())?null:d;} return null;}
    m=t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/); if(m){const d=new Date(+m[3],+m[2]-1,+m[1]); return isNaN(d.getTime())?null:d;}
    const d=new Date(s); return isNaN(d.getTime())?null:d; }
  const DAY=86400000;

  /* =====================================================
     1+2) ONE expirations renderer; header count = table count
     ===================================================== */
  let WINDOW=180, SIG='', BUSY=false;
  const expKey=(v)=>[v.visaDocumentNumber||'',v.sponsorId||'',upc(v.visaCategory),upc(v.nationality),upc(v.stampingCity),upc(v.gender),upc(v.client)].join('|');
  function compute(windowDays){
    const now=new Date(); const g={}; let inWindow=0;
    visas().forEach(v=>{
      const s=upc(v.statusVisa); if(s!=='UNUSED'&&s!=='ALLOCATED') return;
      const d=parseDate(v.expirationDate); if(!d) return;
      const days=Math.floor((d-now)/DAY);
      if(days<0||days>windowDays) return;                 /* the ONLY inclusion test */
      inWindow++;                                          /* counted from the SAME pass */
      const k=expKey(v);
      if(!g[k]) g[k]={doc:v.visaDocumentNumber||'—',sid:v.sponsorId||'—',cat:v.visaCategory||'—',nat:v.nationality||'—',city:v.stampingCity||'—',gender:v.gender||'—',client:v.client||'—',qty:0,days:Infinity};
      g[k].qty++; if(days<g[k].days) g[k].days=days;
    });
    const groups=Object.values(g).sort((a,b)=>a.days-b.days);
    return {groups, inWindow, windowDays};
  }
  function visaPanel(){ return $('panel-visa'); }
  /* tag every OTHER expirations block so CSS hides it (never delete → no loops) */
  function hideDupes(){
    const p=visaPanel(); if(!p) return;
    p.querySelectorAll('.card, section, .ceo-sec, div').forEach(el=>{
      if(el.id==='v44Exp'||el.closest('#v44Exp')) return;
      if(el.classList.contains('v44-dupe-exp')) return;
      const h=el.querySelector(':scope > h3, :scope > h4');
      if(!h) return;
      if(/upcoming expirations/i.test((h.textContent||'').trim())) el.classList.add('v44-dupe-exp');
    });
  }
  function host(){
    let h=$('v44Exp'); if(h) return h;
    const p=visaPanel(); if(!p) return null;
    h=document.createElement('div'); h.id='v44Exp'; h.className='card';
    const anchor=[...p.querySelectorAll('.card, section')].find(el=>{ const t=el.querySelector('h3,h4'); return t&&/all visa records/i.test(t.textContent||''); });
    if(anchor&&anchor.parentNode) anchor.parentNode.insertBefore(h, anchor); else p.appendChild(h);
    h.addEventListener('mousedown',()=>{ BUSY=true; setTimeout(()=>{BUSY=false;},1500); }, true);
    return h;
  }
  function render(force){
    const h=host(); if(!h) return;
    const sel=$('v44Win'); if(sel){ const v=parseInt(sel.value,10); if(v) WINDOW=v; }
    const data=compute(WINDOW);                              /* ONE computation */
    const sig=visas().length+'|'+data.windowDays+'|'+data.inWindow+'|'+data.groups.length;
    if(!force && (sig===SIG || BUSY)) return;
    SIG=sig;
    const g=data.groups;
    h.innerHTML=
      '<h3 style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 4px">Upcoming Expirations '+
        '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#2E6FA3;font-weight:400">('+data.inWindow+' in window)</span>'+
        '<span style="flex:1"></span><button class="v44-btn" id="v44Exp2">Export Excel</button></h3>'+
      '<div class="exp-note">Visas expiring in the selected window, grouped by Visa Doc # · Sponsor ID · Category · Nationality · City · Gender · Client. Quantity = how many in that group; Days Left = the soonest-expiring visa in the group.</div>'+
      '<div class="exp-tools"><select id="v44Win">'+[30,60,90,180,365].map(d=>'<option value="'+d+'"'+(d===data.windowDays?' selected':'')+'>Next '+d+' days</option>').join('')+'</select>'+
      '<span class="exp-count">'+g.length+' group(s) · '+data.inWindow+' visa(s) · next '+data.windowDays+' days</span></div>'+
      (g.length
        ? '<div style="max-height:380px;overflow:auto;border:1px solid #EDE7D6;border-radius:8px"><table><thead><tr>'+
          ['Visa Doc #','Sponsor ID','Category','Nationality','City (Stamping)','Gender','Client'].map(x=>'<th>'+x+'</th>').join('')+
          '<th class="r">Quantity</th><th class="r">Days Left</th></tr></thead><tbody>'+
          g.map(x=>'<tr><td class="mono">'+esc(x.doc)+'</td><td class="mono">'+esc(x.sid)+'</td><td class="cat">'+esc(x.cat)+'</td>'+
            '<td>'+esc(x.nat)+'</td><td>'+esc(x.city)+'</td><td>'+esc(x.gender)+'</td><td>'+esc(x.client)+'</td>'+
            '<td class="r"><span class="chip qty">'+x.qty+'</span></td>'+
            '<td class="r"><span class="chip days'+(x.days<=30?' soon':'')+'">'+x.days+'d</span></td></tr>').join('')+
          '</tbody></table></div>'
        : '<div style="text-align:center;padding:24px;color:#A89B82;font-family:\'IBM Plex Mono\',monospace;font-size:12px">No visas expiring in the selected window.</div>');
    const s2=$('v44Win'); if(s2) s2.addEventListener('change',()=>{ WINDOW=parseInt(s2.value,10)||180; SIG=''; BUSY=false; render(true); });
    const ex=$('v44Exp2'); if(ex) ex.addEventListener('click',()=>{
      if(window.EntExport&&window.EntExport.xlsx) window.EntExport.xlsx(
        ['Visa Doc #','Sponsor ID','Category','Nationality','City (Stamping)','Gender','Client','Quantity','Days Left'],
        g.map(x=>[x.doc,x.sid,x.cat,x.nat,x.city,x.gender,x.client,x.qty,x.days]),
        'UPCOMING EXPIRATIONS — NEXT '+data.windowDays+' DAYS','Expirations','UPCOMING EXPIRATIONS.xlsx');
      else Toast().err('Export failed','Universal exporter not loaded.');
    });
  }

  /* =====================================================
     3) R-02 agency options — narrow, and never rebuild while open
     ===================================================== */
  function agencySel(){ return $('entAgencyFilter')||$('pipelineFilterAgency'); }
  let AG_BUSY=false, agTimer=null, LAST_AG=null;
  function agBusy(){ AG_BUSY=true; clearTimeout(agTimer); agTimer=setTimeout(()=>{AG_BUSY=false;},4000); }
  function agOpen(){ const s=agencySel(); if(!s) return false; return AG_BUSY || document.activeElement===s; }
  function wireAg(){
    const s=agencySel(); if(!s||s.dataset.v440==='1') return; s.dataset.v440='1';
    ['mousedown','focus','keydown','wheel','scroll'].forEach(ev=>s.addEventListener(ev, agBusy, true));
    s.addEventListener('blur',()=>{ AG_BUSY=false; }, true);
    s.addEventListener('change',()=>{ AG_BUSY=false; });
  }
  const uniq=(a)=>[...new Set(a.filter(Boolean).map(x=>String(x).trim()))].sort((x,y)=>x.localeCompare(y));
  function populateAgency(force){
    const s=agencySel(); if(!s||!window.DB) return;
    if(!force && agOpen()) return;                       /* never while open — keeps scroll */
    if(typeof window.getPipelineFilteredBase!=='function') return;
    let base; try{ base=window.getPipelineFilteredBase(['agency']); }catch(e){ return; }
    if(!Array.isArray(base)) return;
    const opts=uniq(base.map(c=>c.agency));
    const key=opts.join('\u0001');
    if(!force && key===LAST_AG) return;                  /* unchanged → leave alone */
    const cur=s.value, ok=opts.includes(cur);
    const html='<option value="">All</option>'+opts.map(o=>'<option>'+esc(o)+'</option>').join('');
    if(s.innerHTML!==html){ s.innerHTML=html; s.value=ok?cur:''; }
    LAST_AG=key;
  }
  /* refresh the options whenever any OTHER filter changes */
  function wireOtherFilters(){
    ['pipelineFilterClient','pipelineFilterNat','pipelineFilterPos','pipelineFilterType','pipelineFilterStage'].forEach(id=>{
      const el=$(id); if(!el||el.dataset.v440==='1') return; el.dataset.v440='1';
      el.addEventListener('change',()=>{ LAST_AG=null; setTimeout(()=>populateAgency(true),60); });
    });
  }

  /* =====================================================
     4) hide the CSV / PDF buttons
     ===================================================== */
  function hideCsvPdf(){
    document.querySelectorAll('button, a').forEach(b=>{
      if(b.classList.contains('v44-hidden-btn')) return;
      const t=upc(b.textContent||'');
      if(/EXPORT FILTERED ROWS/.test(t) || /PRINT \/ SAVE AS PDF/.test(t) || /PRINT \/ SAVE/.test(t)){
        b.classList.add('v44-hidden-btn');
      }
    });
  }

  /* ---------- heartbeat: cheap work only ---------- */
  function tick(){
    hideCsvPdf(); wireAg(); wireOtherFilters();
    const vp=visaPanel();
    if(vp && vp.classList.contains('active')){ hideDupes(); render(false); }
    const pp=$('panel-pipeline')||$('pipelineDashboard');
    if(pp && pp.offsetParent!==null) populateAgency(false);
  }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('v440', tick, 1500); }
  else { setInterval(tick, 1500); }
  setTimeout(tick, 600);

  window._entV440={ compute, render:()=>render(true), populateAgency:()=>populateAgency(true) };
  console.log('%c🔧 v'+V+' — single expirations renderer (count matches rows) · agency options narrow & keep scroll · CSV/PDF removed','color:#8C6A22;font-weight:bold;');
})();

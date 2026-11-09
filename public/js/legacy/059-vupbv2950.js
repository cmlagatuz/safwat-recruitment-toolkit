
(function VUPBv2950(){
  'use strict';
  const V='2.9.50';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const daysUntil=(d,now)=>{ if(!d) return null; const x=new Date(d); if(isNaN(x)) return null; return Math.floor((x-now)/86400000); };
  const log=(...a)=>console.log('%c[v2.9.50]','color:#2F5A3B;font-weight:bold',...a);
  const COMBINED='UNUSED_ALLOCATED';
  let _blockStatus='';

  function visaRecordsTable(){ for(const t of document.querySelectorAll('table')){ const heads=[...t.querySelectorAll('th')].map(th=>upc(th.textContent)); const isVisa=heads.some(h=>h.includes('VISA DOC'))&&(heads.some(h=>h.includes('SPONSOR ID'))||heads.some(h=>h.includes('CATEGORY'))); const isPipe=heads.some(h=>h.includes('STAGE'))&&heads.some(h=>h.includes('POSITION')); if(isVisa&&!isPipe) return t; } return null; }
  function visaPanel(){ const t=visaRecordsTable(); if(!t) return null; return t.closest('.panel, section, #panel-visa')||t.parentElement; }
  function panelVisible(p){ if(!p) return false; return p.offsetParent!==null && p.getBoundingClientRect().height>0; }
  function visaRecordsCard(){ const t=visaRecordsTable(); if(!t) return null; return t.closest('.card, section, div[style*="border"]')||t.parentElement; }

  function readFilters(){
    const out={}; const panel=visaPanel()||document;
    const labelVal=(labels)=>{ const wraps=[...panel.querySelectorAll('label, .field, div')]; for(const w of wraps){ const lt=upc(w.textContent||''); if(labels.some(L=>lt.startsWith(L))){ const ctl=w.querySelector('select,input')||(w.nextElementSibling&&w.nextElementSibling.matches&&w.nextElementSibling.matches('select,input')?w.nextElementSibling:null); if(ctl){ const val=upc(ctl.value); if(val&&val!=='ALL'&&val!=='') return val; return ''; } } } return ''; };
    out.client=labelVal(['CLIENT']); out.nationality=labelVal(['NATIONALITY']); out.category=labelVal(['CATEGORY','VISA CATEGORY']); out.agency=labelVal(['AGENCY']); out.sponsor=labelVal(['SPONSOR']); out.gender=labelVal(['GENDER']);
    out.status=_blockStatus||'';
    const sb=[...panel.querySelectorAll('input[type="text"],input:not([type])')].find(i=>/search/i.test(i.placeholder||'')); out.search=sb?upc(sb.value):'';
    return out;
  }
  function statusMatch(v,f){ if(!f) return true; const s=upc(v.statusVisa); if(f===COMBINED) return s==='UNUSED'||s==='ALLOCATED'; return s===f; }
  function baseFiltered(withStatus){ const all=(window.DB&&window.DB.visaRecords)||[]; const f=readFilters(); return all.filter(v=>{ if(f.client&&upc(v.client)!==f.client) return false; if(f.nationality&&upc(v.nationality)!==f.nationality) return false; if(f.category&&upc(v.visaCategory)!==f.category) return false; if(f.agency&&upc(v.registeredAgencyName)!==f.agency) return false; if(f.gender&&upc(v.gender)!==f.gender) return false; if(withStatus&&!statusMatch(v,f.status)) return false; if(f.sponsor&&upc(v.sponsor)!==f.sponsor) return false; if(f.search){ const blob=upc([v.fullName,v.passport,v.visaDocumentNumber,v.sponsorId,v.crNumber,v.nationality,v.visaCategory,v.stampingCity,v.client,v.registeredAgencyName].join(' ')); if(!blob.includes(f.search)) return false; } return true; }); }

  /* ═══ VISA USAGE PER BLOCK (REMAINING → CANCELLED) ═══ */
  const BKEY=(v)=>[v.visaDocumentNumber||'',v.sponsorId||'',upc(v.nationality),upc(v.stampingCity),upc(v.gender),upc(v.client),upc(v.visaCategory),upc(v.registeredAgencyName)].join('|');
  function buildBlocks(rows){ const m={}; rows.forEach(v=>{ const k=BKEY(v); if(!m[k]) m[k]={doc:v.visaDocumentNumber||'—',sid:v.sponsorId||'—',nat:v.nationality||'—',city:v.stampingCity||'—',gender:v.gender||'—',project:v.client||'—',cat:v.visaCategory||'—',agency:v.registeredAgencyName||'—',used:0,unused:0,allocated:0,expired:0,cancelled:0,total:0}; const s=upc(v.statusVisa); m[k].total++; if(s==='USED')m[k].used++; else if(s==='UNUSED')m[k].unused++; else if(s==='ALLOCATED')m[k].allocated++; else if(s==='EXPIRED')m[k].expired++; else if(s==='CANCELLED')m[k].cancelled++; }); return Object.values(m); }
  let _sortKey='doc', _sortDir=1, _search='', _lastSig='';
  const COLS=[{k:'doc',label:'Visa Doc #',cls:'mono'},{k:'sid',label:'Sponsor ID',cls:'mono'},{k:'nat',label:'Nationality'},{k:'city',label:'Stamping City'},{k:'gender',label:'Gender'},{k:'project',label:'Project'},{k:'cat',label:'Visa Category'},{k:'agency',label:'Agency'},{k:'used',label:'Used',num:true,chip:'used'},{k:'unused',label:'Unused',num:true,chip:'unused'},{k:'allocated',label:'Allocated',num:true,chip:'alloc'},{k:'expired',label:'Expired',num:true,chip:'exp'},{k:'cancelled',label:'Cancelled',num:true,chip:'canc'},{k:'total',label:'Total',num:true,chip:'total'}];
  function render(){
    const host=$('vupbBody'); if(!host) return;
    const rows=buildBlocks(baseFiltered(true));
    let view=rows;
    if(_search){ view=view.filter(b=>upc([b.doc,b.sid,b.nat,b.city,b.gender,b.project,b.cat,b.agency].join(' ')).includes(_search)); }
    view.sort((a,b)=>{ const av=a[_sortKey],bv=b[_sortKey]; if(typeof av==='number'&&typeof bv==='number') return (av-bv)*_sortDir; return String(av).localeCompare(String(bv))*_sortDir; });
    const tot=view.reduce((t,b)=>{['used','unused','allocated','expired','cancelled','total'].forEach(k=>t[k]+=b[k]);return t;},{used:0,unused:0,allocated:0,expired:0,cancelled:0,total:0});
    const sig=_sortKey+'|'+_sortDir+'|'+_search+'|'+_blockStatus+'|'+view.length+'|'+view.reduce((s,b)=>s+b.doc+b.sid+b.used+b.unused+b.allocated+b.expired+b.cancelled,'').length+'|'+(tot.used+tot.unused+tot.allocated+tot.expired+tot.cancelled+tot.total);
    if(sig===_lastSig) return; _lastSig=sig;
    if(!view.length){ host.innerHTML='<div class="vupb-empty">No visa blocks match the current filters.</div>'; const c=$('vupbCount'); if(c)c.textContent='0 blocks'; return; }
    const c=$('vupbCount'); if(c)c.textContent=view.length+' block(s) · '+tot.total+' visas';
    const th=COLS.map(col=>{ const arrow=(_sortKey===col.k)?('<span class="arrow">'+(_sortDir>0?'▲':'▼')+'</span>'):''; return '<th class="'+(col.num?'right':'')+'" data-k="'+col.k+'">'+esc(col.label)+arrow+'</th>'; }).join('');
    const body=view.map(b=>'<tr>'+COLS.map(col=>{ const v=b[col.k]; if(col.chip){ return '<td style="text-align:right"><span class="chip '+col.chip+'">'+v+'</span></td>'; } return '<td class="'+(col.cls||'')+'">'+esc(v)+'</td>'; }).join('')+'</tr>').join('');
    const foot='<tr><td colspan="8" style="text-align:right;">TOTAL</td>'+['used','unused','allocated','expired','cancelled','total'].map(k=>'<td class="num">'+tot[k]+'</td>').join('')+'</tr>';
    host.innerHTML='<table class="vupb"><thead><tr>'+th+'</tr></thead><tbody>'+body+'</tbody><tfoot>'+foot+'</tfoot></table>';
    host.querySelectorAll('thead th[data-k]').forEach(el=>el.addEventListener('click',()=>{ const k=el.dataset.k; if(_sortKey===k) _sortDir*=-1; else { _sortKey=k; _sortDir=1; } _lastSig=''; render(); }));
  }
  function exportExcel(){
    const rows=buildBlocks(baseFiltered(true));
    const cols=['Visa Doc #','Sponsor ID','Nationality','Stamping City','Gender','Project','Visa Category','Agency','Used','Unused','Allocated','Expired','Cancelled','Total'];
    const keyMap={'Visa Doc #':'doc','Sponsor ID':'sid','Nationality':'nat','Stamping City':'city','Gender':'gender','Project':'project','Visa Category':'cat','Agency':'agency','Used':'used','Unused':'unused','Allocated':'allocated','Expired':'expired','Cancelled':'cancelled','Total':'total'};
    const numCols=new Set(['Used','Unused','Allocated','Expired','Cancelled','Total']); const textCols=new Set(['Visa Doc #','Sponsor ID']);
    const td=(val,c)=>{ const v=esc(String(val==null?'':val)); if(numCols.has(c)) return '<td style="mso-number-format:\\0030;text-align:right">'+v+'</td>'; if(textCols.has(c)) return '<td style="mso-number-format:\\@">'+v+'</td>'; return '<td>'+v+'</td>'; };
    let html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Visa Usage Per Block</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--><style>table{border-collapse:collapse;} td{border:1px solid #999;padding:4px 6px;font-family:Calibri,Arial;font-size:11px;} th{border:1px solid #444;background:#14202B;color:#fff;padding:6px;font-family:Calibri,Arial;font-size:11px;font-weight:bold;} tr.tot td{background:#FBF4DE;font-weight:bold;}</style></head><body><table><thead><tr>'+cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>';
    rows.forEach(b=>{ html+='<tr>'+cols.map(c=>td(b[keyMap[c]],c)).join('')+'</tr>'; });
    const tot=rows.reduce((t,b)=>{['used','unused','allocated','expired','cancelled','total'].forEach(k=>t[k]+=b[k]);return t;},{used:0,unused:0,allocated:0,expired:0,cancelled:0,total:0});
    html+='<tr class="tot"><td colspan="8" style="text-align:right">TOTAL</td>'+['used','unused','allocated','expired','cancelled','total'].map(k=>'<td style="text-align:right">'+tot[k]+'</td>').join('')+'</tr></tbody></table></body></html>';
    const blob=new Blob(['\ufeff'+html],{type:'application/vnd.ms-excel;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='visa_usage_per_block.xls'; a.click(); URL.revokeObjectURL(url); log('Exported Excel');
  }

  /* ═══ GROUPED UPCOMING EXPIRATIONS ═══ */
  let _expSig='';
  function expCard(){ const el=[...document.querySelectorAll('*')].find(x=>/upcoming expirations/i.test(x.textContent||'') && x.children.length<40 && x.getBoundingClientRect().height<1400); if(!el) return null; return el.closest('.card, section, div[style*="border"]')||el.parentElement; }
  function expWindowDays(){ const card=expCard(); if(!card) return 90; const sel=[...card.querySelectorAll('select')].find(s=>/day/i.test(s.textContent||'')||/next/i.test(s.value||'')||/day/i.test((s.options[s.selectedIndex]||{}).text||'')); if(sel){ const t=(sel.options[sel.selectedIndex]||{}).text||sel.value||''; const m=t.match(/(\d+)/); if(m) return parseInt(m[1],10); } return 90; }
  function buildExpGroups(){
    const now=new Date(); const win=expWindowDays();
    const rows=baseFiltered(false).filter(v=>{ if(v.sponsor!=='SAFWAT') return false; if(!['UNUSED','ALLOCATED'].includes(upc(v.statusVisa))) return false; const d=daysUntil(v.expirationDate,now); return d!=null&&d>=0&&d<=win; });
    const m={};
    rows.forEach(v=>{ const k=[v.visaDocumentNumber||'',v.sponsorId||'',upc(v.visaCategory),upc(v.nationality),upc(v.stampingCity),upc(v.gender),upc(v.client)].join('|'); if(!m[k]) m[k]={doc:v.visaDocumentNumber||'—',sid:v.sponsorId||'—',cat:v.visaCategory||'—',nat:v.nationality||'—',city:v.stampingCity||'—',gender:v.gender||'—',client:v.client||'—',qty:0,minDays:Infinity}; m[k].qty++; const d=daysUntil(v.expirationDate,now); if(d<m[k].minDays)m[k].minDays=d; });
    return { groups:Object.values(m).sort((a,b)=>a.minDays-b.minDays), total:rows.length, win };
  }
  const ECOLS=[{k:'doc',label:'Visa Doc #',cls:'mono'},{k:'sid',label:'Sponsor ID',cls:'mono'},{k:'cat',label:'Category'},{k:'nat',label:'Nationality'},{k:'city',label:'City (Stamping)'},{k:'gender',label:'Gender'},{k:'client',label:'Client'},{k:'qty',label:'Quantity',num:true},{k:'minDays',label:'Days Left',num:true}];
  function renderExp(){
    const host=$('vexpBody'); if(!host) return;
    const {groups,total,win}=buildExpGroups();
    const sig=win+'|'+groups.length+'|'+total+'|'+groups.reduce((s,g)=>s+g.doc+g.sid+g.qty+g.minDays,'').length;
    if(sig===_expSig) return; _expSig=sig;
    const c=$('vexpCount'); if(c)c.textContent=groups.length+' group(s) · '+total+' visas · next '+win+' days';
    if(!groups.length){ host.innerHTML='<div class="vexp-empty">No visas expiring in the selected window.</div>'; return; }
    const th=ECOLS.map(col=>'<th class="'+(col.num?'right':'')+'">'+esc(col.label)+'</th>').join('');
    const body=groups.map(g=>'<tr>'+ECOLS.map(col=>{ const v=g[col.k]; if(col.k==='qty') return '<td style="text-align:right"><span class="chip qty">'+v+'</span></td>'; if(col.k==='minDays'){ const soon=v<=30?' soon':''; const txt=v===0?'TODAY':(v<0?'OVERDUE':v+'d'); return '<td style="text-align:right"><span class="chip days'+soon+'">'+txt+'</span></td>'; } return '<td class="'+(col.cls||'')+'">'+esc(v)+'</td>'; }).join('')+'</tr>').join('');
    host.innerHTML='<table class="vexp"><thead><tr>'+th+'</tr></thead><tbody>'+body+'</tbody></table>';
  }
  /* hide the base expirations table (its long per-visa list) once, keep our grouped one */
  function hideBaseExpTable(){ const card=expCard(); if(!card) return; const our=$('vexpSection'); card.querySelectorAll('table').forEach(t=>{ if(our&&our.contains(t)) return; const heads=[...t.querySelectorAll('th')].map(th=>upc(th.textContent)); if(heads.some(h=>h.includes('DAYS LEFT'))||heads.some(h=>h.includes('VISA DOC'))){ t.style.display='none'; const sc=t.closest('div[style*="overflow"], .scroll, .table-scroll'); if(sc&&sc!==card) sc.style.display='none'; } }); }

  /* ═══ debounced render ═══ */
  let _t=null; function schedule(){ clearTimeout(_t); _t=setTimeout(()=>{ render(); renderExp(); hideBaseExpTable(); }, 200); }
  document.addEventListener('change',(e)=>{ const el=e.target; if(el&&(el.tagName==='SELECT'||el.tagName==='INPUT')&&el.id!=='vupbStatus') schedule(); }, false);

  /* ═══ mount both sections (R-01 only) ═══ */
  function ensureSections(){
    const panel=visaPanel();
    const vs=$('vupbSection'), es=$('vexpSection');
    if(!panel||!panelVisible(panel)){ if(vs)vs.style.display='none'; if(es)es.style.display='none'; return; }

    /* Visa Usage Per Block — before ALL VISA RECORDS card */
    if(!vs){ const card=visaRecordsCard(); if(card&&card.parentNode){ const s=document.createElement('div'); s.id='vupbSection'; s.innerHTML='<h3>Visa Usage Per Block</h3><div class="vupb-explain">Every visa block (Visa Doc # · Sponsor ID · Nationality · Stamping City · Gender · Project · Visa Category · Agency) with Used / Unused / Allocated / Expired / Cancelled / Total. Uses this section\'s Status control plus the R-01 filters &amp; search above.</div><div class="vupb-toolbar"><label>Status:</label><select id="vupbStatus"><option value="">All</option><option value="USED">Used</option><option value="UNUSED">Unused</option><option value="ALLOCATED">Allocated</option><option value="'+COMBINED+'">Unused &amp; Allocated</option><option value="EXPIRED">Expired</option><option value="CANCELLED">Cancelled</option></select><input type="text" id="vupbSearch" placeholder="Search blocks (doc, nationality, category, agency, project…)"><span class="spacer"></span><span class="vupb-count" id="vupbCount">—</span><button type="button" id="vupbExport">Export Excel</button></div><div class="vupb-scroll" id="vupbBody"></div>'; card.parentNode.insertBefore(s, card); $('vupbStatus').addEventListener('change',e=>{ _blockStatus=e.target.value; _lastSig=''; render(); }); $('vupbSearch').addEventListener('input',e=>{ _search=upc(e.target.value); _lastSig=''; render(); }); $('vupbExport').addEventListener('click', exportExcel); log('VUPB inserted'); } }
    else vs.style.display='';

    /* Grouped Upcoming Expirations — inside the base expirations card, after its header */
    const ec=expCard();
    if(ec){ if(!es){ const s=document.createElement('div'); s.id='vexpSection'; s.innerHTML='<h3>Upcoming Expirations — grouped by quantity</h3><div class="vexp-explain">Visas expiring in the selected window, grouped by Visa Doc # · Sponsor ID · Category · Nationality · City · Gender · Client. Quantity = how many in that group; Days Left = the soonest-expiring visa in the group.</div><div class="vexp-toolbar"><span class="vexp-count" id="vexpCount">—</span></div><div class="vexp-scroll" id="vexpBody"></div>'; /* insert at end of the exp card so it sits below the Window dropdown */ ec.appendChild(s); log('Grouped Upcoming Expirations inserted'); } else es.style.display=''; hideBaseExpTable(); }
    else if(es){ es.style.display='none'; }

    render(); renderExp();
  }
  setInterval(ensureSections, 1200); ensureSections();
  setInterval(hideBaseExpTable, 1500);

  console.log('%c📊 VUPB Cancelled + grouped Upcoming Expirations v'+V+' active','color:#2F5A3B;font-weight:bold;');
})();

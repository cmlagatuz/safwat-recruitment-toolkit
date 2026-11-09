
(function CEOv381(){
  'use strict';
  if(window.__entCEOv381) return; window.__entCEOv381=true;
  window.__entCEOv380=true;                      /* neutralize v3.8.0 */
  const V='3.8.1';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const has=(v)=>v!=null&&String(v).trim()!=='';
  const log=(...a)=>console.log('%c[CEO v3.8.1]','color:#2F5A3B;font-weight:bold',...a);
  const Toast=()=>window.Toast||{ok:console.log,warn:console.warn,err:console.error};

  function DB(){ try{ if(window._entCEO_DB) return window._entCEO_DB(); }catch(e){} return window.DB||{}; }
  const cases=()=>DB().recruitmentCases||[];
  const visas=()=>DB().visaRecords||[];
  const r03=()=>DB().ceoCases||[];               /* R-03 complaints / post-joining issues */

  function parseDate(s){ if(!s) return null; const t=String(s).trim().replace(/[.\/]/g,'-');
    let m=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if(m){const y=+m[1]; if(y>=1900){const d=new Date(y,+m[2]-1,+m[3]); return isNaN(d.getTime())?null:d;} return null;}
    m=t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/); if(m){const d=new Date(+m[3],+m[2]-1,+m[1]); return isNaN(d.getTime())?null:d;}
    const d=new Date(s); return isNaN(d.getTime())?null:d; }
  const DAY=86400000;

  const ATTRITION=new Set(['WITHDRAWN/BACKOUT','UNFIT','REJECTED','CANCELLED','AWOL','TERMINATED','END OF SERVICE','UNRESPONSIVE']);
  const HOLD=new Set(['ON HOLD']);
  function projectOf(client){ const u=upc(client); if(u.includes('AMERICANA')) return 'AMERICANA'; if(u.includes('ON DEMAND')||u.includes('ON-DEMAND')||u.includes('SAFWAHR')||u.includes('SAFWA HR')) return 'ONDEMAND'; return 'OTHER'; }
  const PROJECTS=[{key:'AMERICANA',label:'AMERICANA'},{key:'ONDEMAND',label:'SAFWAHR (On-Demand)'},{key:'OTHER',label:'Other Clients'}];
  function isForDeploymentStage(c){ const u=upc(c.stage); if(u==='DEPLOYED') return false; return u.includes('FOR DEPLOYMENT')||u==='VISA ISSUED'||u.includes('READY FOR TRAVEL')||u.includes('READY FOR DEPLOYMENT'); }
  const deployDateRaw=(c)=>{ for(const k of ['deploymentDate','expectedDeploymentDate','dateDeployment','dateArrivalKsa','dateWorkStarted']){ if(has(c[k])) return c[k]; } return ''; };

  /* ---- CORRECTION 1: Cases = R-03 records ---- */
  const r03Count=(key)=>r03().filter(x=>projectOf(x.client)===key).length;
  /* ---- CORRECTION 2: Issued Visas = USED only ---- */
  const issuedUsed=(key)=>visas().filter(v=>projectOf(v.client)===key && upc(v.statusVisa)==='USED').length;

  const SAFWAT_HINTS=['safwat','safwa'];
  function isSafwatVisa(v){ if(upc(v.sponsor)==='SAFWAT') return true; const n=String(v.companyName||'').toLowerCase(); return SAFWAT_HINTS.some(x=>n.includes(x)); }

  function projList(key){ return cases().filter(c=>projectOf(c.client)===key); }
  function tileMetrics(key){
    const list=projList(key);
    const m={total:list.length,underProcess:0,started:0,cases:r03Count(key),issuedVisas:issuedUsed(key),arrived:0};
    list.forEach(c=>{ const s=upc(c.stage);
      if(s==='DEPLOYED'||has(c.dateWorkStarted)) m.started++;
      else if(!ATTRITION.has(s)) m.underProcess++;
      if(has(c.dateArrivalKsa)) m.arrived++; });
    return m;
  }
  function execMetrics(key){
    const list=projList(key);
    const m={total:list.length,selected:0,underProcess:0,awaitingVisa:0,forDeployment:0,arrivedKsa:0,arrivedAcc:0,started:0,critical:0,issuedVisas:issuedUsed(key),cases:r03Count(key)};
    const SO={'PENDING OFFER LETTER':0,'OFFER SIGNING':1,'FOR MEDICAL APPOINTMENT':2,'MEDICAL ON PROGRESS':3,'FOR SKILLS VERIFICATION APPOINTMENT':4,'SVP/QVP ON PROGRESS':5,'FOR BIOMETRICS APPOINTMENT':6,'BIOMETRICS IN PROGRESS AND CONSULAR SUBMISSION':7,'VISA ISSUED':8,'FOR DEPLOYMENT':8,'READY FOR TRAVEL':8,'DEPLOYED':9};
    const now=new Date();
    list.forEach(c=>{ const u=upc(c.stage); const idx=(u in SO)?SO[u]:-1;
      if(ATTRITION.has(u)){ m.critical++; return; }
      if(HOLD.has(u)) m.critical++;
      if(u==='DEPLOYED'||has(c.dateWorkStarted)) m.started++;
      if(has(c.dateArrivedAccommodation)) m.arrivedAcc++;
      if(has(c.dateArrivalKsa)) m.arrivedKsa++;
      if(isForDeploymentStage(c)){ const d=parseDate(deployDateRaw(c)); if(!(d&&d<now)) m.forDeployment++; }
      if(idx>=6&&idx<=7) m.awaitingVisa++;
      if(idx>=2) m.selected++;
      if(idx>=0&&idx<=7) m.underProcess++; });
    return m;
  }
  function crStatusSafwat(){
    const g={};
    visas().filter(isSafwatVisa).forEach(v=>{ const k=(v.crNumber||'—')+'|'+(v.sponsorId||'—');
      if(!g[k]) g[k]={cr:v.crNumber||'—',sid:v.sponsorId||'—',used:0,unused:0,allocated:0,expired:0,cancelled:0,total:0};
      const s=upc(v.statusVisa); g[k].total++;
      if(s==='USED')g[k].used++; else if(s==='UNUSED')g[k].unused++; else if(s==='ALLOCATED')g[k].allocated++; else if(s==='EXPIRED')g[k].expired++; else if(s==='CANCELLED')g[k].cancelled++; });
    return Object.values(g).map(r=>({...r,util:r.total?Math.round(r.used/r.total*100):0})).sort((a,b)=>b.total-a.total);
  }
  const BKEY=(v)=>[v.visaDocumentNumber||'',v.sponsorId||'',upc(v.nationality),upc(v.stampingCity),upc(v.gender),upc(v.client),upc(v.visaCategory),upc(v.registeredAgencyName)].join('|');
  function visaBlocksUA(){
    const m={};
    visas().forEach(v=>{ const s=upc(v.statusVisa); if(s!=='UNUSED'&&s!=='ALLOCATED') return;
      const k=BKEY(v);
      if(!m[k]) m[k]={doc:v.visaDocumentNumber||'—',sid:v.sponsorId||'—',nat:v.nationality||'—',city:v.stampingCity||'—',gender:v.gender||'—',project:v.client||'—',cat:v.visaCategory||'—',agency:v.registeredAgencyName||'—',unused:0,allocated:0,total:0};
      m[k].total++; if(s==='UNUSED')m[k].unused++; else m[k].allocated++; });
    return Object.values(m).sort((a,b)=>String(a.doc).localeCompare(String(b.doc)));
  }

  /* ---- CORRECTION 3: grouped upcoming expirations ---- */
  let EXP_WINDOW=180;
  const expKey=(v)=>[v.visaDocumentNumber||'',v.sponsorId||'',upc(v.visaCategory),upc(v.nationality),upc(v.stampingCity),upc(v.gender),upc(v.client)].join('|');
  function upcomingGrouped(windowDays){
    const now=new Date(); const g={}; let inWindow=0, totalActive=0;
    visas().forEach(v=>{ const s=upc(v.statusVisa); if(s!=='UNUSED'&&s!=='ALLOCATED') return;
      const d=parseDate(v.expirationDate); if(!d) return;
      totalActive++;
      const days=Math.floor((d-now)/DAY);
      if(days<0 || days>windowDays) return;
      inWindow++;
      const k=expKey(v);
      if(!g[k]) g[k]={doc:v.visaDocumentNumber||'—',sid:v.sponsorId||'—',cat:v.visaCategory||'—',nat:v.nationality||'—',city:v.stampingCity||'—',gender:v.gender||'—',client:v.client||'—',qty:0,days:Infinity,items:[]};
      g[k].qty++; if(days<g[k].days) g[k].days=days; if(g[k].items.length<400) g[k].items.push({v,days}); });
    return { groups:Object.values(g).sort((a,b)=>a.days-b.days), inWindow, totalActive };
  }

  const pct=(n,t)=>t?((n/t*100).toFixed(1)+'%'):'—';
  const kpiCard=(label,value,sub,color)=>'<div class="v38-kpi" style="--kc:'+color+'"><b>'+value+'</b><div class="lb">'+esc(label)+'</div>'+(sub?'<div class="sub">'+esc(sub)+'</div>':'')+'</div>';
  function exportRows(heads,rows,title,sheet,file){
    if(window.EntExport&&window.EntExport.xlsx) return window.EntExport.xlsx(heads,rows,title,sheet,file);
    Toast().err('Export failed','Universal exporter not loaded.');
  }

  function body(){ return $('ceoDashBody'); }
  function homeVisible(){ const b=body(); return b && !!b.querySelector('.ceo-tile') && !b.querySelector('#ceoBack'); }
  function findSection(re){ const b=body(); if(!b) return null; return [...b.querySelectorAll('.ceo-sec')].find(s=>{const h=s.querySelector('h3'); return h&&re.test((h.textContent||'').trim());})||null; }

  function patchTiles(){
    const b=body(); if(!b) return;
    b.querySelectorAll('.ceo-tile').forEach(tile=>{
      const key=tile.dataset.proj; if(!key) return;
      if(tile.dataset.v381==='1') return;
      const m=tileMetrics(key); const kp=tile.querySelector('.kpis'); if(!kp) return;
      kp.innerHTML=
        '<div class="k"><b>'+m.total+'</b><span>Total</span></div>'+
        '<div class="k"><b>'+m.underProcess+'</b><span>Under Process</span></div>'+
        '<div class="k"><b>'+m.started+'</b><span>Started Work</span></div>'+
        '<div class="k"><b>'+m.cases+'</b><span>Cases (R-03)</span></div>'+
        '<div class="k"><b>'+m.issuedVisas+'</b><span>Issued Visas</span></div>'+
        '<div class="k"><b>'+m.arrived+'</b><span>Arrived</span></div>';
      tile.dataset.v381='1'; tile.dataset.v38='1';
    });
  }
  function moveTiles(){ const b=body(); if(!b) return; const tiles=b.querySelector('.ceo-tiles'); const overall=b.querySelector('.ceo-toplights'); if(tiles&&overall&&overall.nextElementSibling!==tiles) overall.parentNode.insertBefore(tiles, overall.nextSibling); }

  function patchCR(){
    const sec=findSection(/status per commercial registration/i); if(!sec||sec.dataset.v381==='1') return;
    const cr=crStatusSafwat();
    const tot=cr.reduce((t,r)=>{['used','unused','allocated','expired','cancelled','total'].forEach(k=>t[k]+=r[k]);return t;},{used:0,unused:0,allocated:0,expired:0,cancelled:0,total:0});
    const h3=sec.querySelector('h3'); sec.innerHTML=''; sec.appendChild(h3);
    h3.innerHTML='Status per Commercial Registration <span class="sub">SAFWAT-sponsored CRs only</span><span class="sp"></span><button class="ceo-xbtn" id="v38ExpCR">Export Excel</button>';
    sec.insertAdjacentHTML('beforeend', cr.length
      ? '<div class="ceo-scrollbox"><table class="ceo-t"><thead><tr><th>CR #</th><th>Sponsor ID</th><th class="r">Used</th><th class="r">Unused</th><th class="r">Allocated</th><th class="r">Expired</th><th class="r">Cancelled</th><th class="r">Total</th><th class="r">Utilization</th></tr></thead><tbody>'+
        cr.map(r=>'<tr><td style="font-family:monospace">'+esc(r.cr)+'</td><td style="font-family:monospace">'+esc(r.sid)+'</td><td class="r"><span class="chip used">'+r.used+'</span></td><td class="r"><span class="chip unused">'+r.unused+'</span></td><td class="r"><span class="chip alloc">'+r.allocated+'</span></td><td class="r"><span class="chip exp">'+r.expired+'</span></td><td class="r"><span class="chip canc">'+r.cancelled+'</span></td><td class="r"><span class="chip total">'+r.total+'</span></td><td class="r">'+r.util+'%</td></tr>').join('')+
        '</tbody><tfoot><tr><td colspan="2">TOTAL ('+cr.length+' CR)</td><td class="r">'+tot.used+'</td><td class="r">'+tot.unused+'</td><td class="r">'+tot.allocated+'</td><td class="r">'+tot.expired+'</td><td class="r">'+tot.cancelled+'</td><td class="r">'+tot.total+'</td><td class="r">'+(tot.total?Math.round(tot.used/tot.total*100):0)+'%</td></tr></tfoot></table></div>'
      : '<div class="ceo-empty">No SAFWAT-sponsored visa records found.</div>');
    const b=$('v38ExpCR'); if(b) b.addEventListener('click',()=>exportRows(['CR #','Sponsor ID','Used','Unused','Allocated','Expired','Cancelled','Total','Utilization %'], cr.map(x=>[x.cr,x.sid,x.used,x.unused,x.allocated,x.expired,x.cancelled,x.total,x.util]), 'STATUS PER COMMERCIAL REGISTRATION — SAFWAT','CR Status','STATUS PER CR (SAFWAT).xlsx'));
    sec.dataset.v381='1'; sec.dataset.v38='1';
  }

  function patchVUPB(){
    const sec=findSection(/visa usage per block/i); if(!sec||sec.dataset.v381==='1') return;
    const blocks=visaBlocksUA();
    const tot=blocks.reduce((t,b)=>{['unused','allocated','total'].forEach(k=>t[k]+=b[k]);return t;},{unused:0,allocated:0,total:0});
    const h3=sec.querySelector('h3'); sec.innerHTML=''; sec.appendChild(h3);
    h3.innerHTML='Visa Usage per Block <span class="sub">Unused + Allocated only</span><span class="sp"></span><button class="ceo-xbtn" id="v38ExpVU">Export Excel</button>';
    sec.insertAdjacentHTML('beforeend','<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#6B6558;margin-bottom:8px">'+blocks.length+' block(s) · '+tot.total+' visas available</div>'+
      (blocks.length ? '<div class="ceo-scrollbox"><table class="ceo-t"><thead><tr><th>Doc #</th><th>Sponsor ID</th><th>Nationality</th><th>Stamping City</th><th>Gender</th><th>Project</th><th>Visa Category</th><th>Agency</th><th class="r">Unused</th><th class="r">Allocated</th><th class="r">Total</th></tr></thead><tbody>'+
        blocks.slice(0,500).map(b=>'<tr><td style="font-family:monospace">'+esc(b.doc)+'</td><td style="font-family:monospace">'+esc(b.sid)+'</td><td>'+esc(b.nat)+'</td><td>'+esc(b.city)+'</td><td>'+esc(b.gender)+'</td><td>'+esc(b.project)+'</td><td>'+esc(b.cat)+'</td><td>'+esc(b.agency)+'</td><td class="r"><span class="chip unused">'+b.unused+'</span></td><td class="r"><span class="chip alloc">'+b.allocated+'</span></td><td class="r"><span class="chip total">'+b.total+'</span></td></tr>').join('')+
        '</tbody><tfoot><tr><td colspan="8" style="text-align:right">TOTAL</td><td class="r">'+tot.unused+'</td><td class="r">'+tot.allocated+'</td><td class="r">'+tot.total+'</td></tr></tfoot></table></div>' : '<div class="ceo-empty">No unused or allocated visas.</div>'));
    const b=$('v38ExpVU'); if(b) b.addEventListener('click',()=>exportRows(['Visa Doc #','Sponsor ID','Nationality','Stamping City','Gender','Project','Visa Category','Agency','Unused','Allocated','Total'], blocks.map(x=>[x.doc,x.sid,x.nat,x.city,x.gender,x.project,x.cat,x.agency,x.unused,x.allocated,x.total]), 'VISA USAGE PER BLOCK — UNUSED + ALLOCATED','Visa Usage','VISA USAGE PER BLOCK.xlsx'));
    sec.dataset.v381='1'; sec.dataset.v38='1';
  }

  function patchPerformance(){
    const sec=findSection(/overall performance indicators/i); if(!sec||sec.dataset.v381==='1') return;
    const per=PROJECTS.map(p=>({p,m:execMetrics(p.key)}));
    const rowsDef=[['Total Requirement','total'],['Selected Candidates','selected'],['Under Process','underProcess'],['Awaiting Visas','awaitingVisa'],['Issued Visas','issuedVisas'],['For Deployment','forDeployment'],['Arrived in Saudi Arabia','arrivedKsa'],['Arrived at Safwa Accommodation','arrivedAcc'],['Started Work','started'],['Cases (R-03)','cases'],['Critical Cases','critical']];
    const h3=sec.querySelector('h3'); sec.innerHTML=''; sec.appendChild(h3);
    let html='<div class="ceo-scrollbox"><table class="ceo-t"><thead><tr><th>Indicator</th>'+PROJECTS.map(p=>'<th class="r">'+esc(p.label)+'</th>').join('')+'<th class="r">Total</th></tr></thead><tbody>';
    rowsDef.forEach(([label,key])=>{ let t=0; html+='<tr><td>'+label+'</td>'+per.map(x=>{const v=x.m[key]||0;t+=v;return '<td class="r">'+v+'</td>';}).join('')+'<td class="r">'+t+'</td></tr>'; });
    const aS=per.reduce((s,x)=>s+x.m.started,0), aT=per.reduce((s,x)=>s+x.m.total,0);
    html+='</tbody><tfoot><tr><td>Completion Rate (Started / Total)</td>'+PROJECTS.map(()=>'<td class="r"></td>').join('')+'<td class="r">'+(aT?Math.round(aS/aT*100):0)+'%</td></tr></tfoot></table></div>';
    sec.insertAdjacentHTML('beforeend', html);
    sec.dataset.v381='1'; sec.dataset.v38='1';
  }

  /* ---- grouped Upcoming Expirations ---- */
  function renderExpirations(){
    const sec=$('v38ExpSec'); if(!sec) return;
    const {groups,inWindow,totalActive}=upcomingGrouped(EXP_WINDOW);
    const h3=sec.querySelector('h3');
    h3.innerHTML='Upcoming Expirations <span class="sub" style="color:#2E6FA3">('+inWindow+' in window)</span><span class="sp"></span><button class="ceo-xbtn" id="v38ExpExp">Export Excel</button>';
    const rest=sec.querySelector('.exp-body'); if(rest) rest.remove();
    const wrap=document.createElement('div'); wrap.className='exp-body';
    wrap.innerHTML=
      '<div class="exp-note">Visas expiring in the selected window, grouped by Visa Doc # · Sponsor ID · Category · Nationality · City · Gender · Client. Quantity = how many in that group; Days Left = the soonest-expiring visa in the group.</div>'+
      '<div class="exp-tools"><select id="v38ExpWin">'+[30,60,90,180,365].map(d=>'<option value="'+d+'"'+(d===EXP_WINDOW?' selected':'')+'>next '+d+' days</option>').join('')+'</select>'+
      '<span class="exp-count">'+groups.length+' group(s) · '+inWindow+' visa(s) · next '+EXP_WINDOW+' days</span></div>'+
      (groups.length
        ? '<div class="ceo-scrollbox"><table class="ceo-t"><thead><tr><th>Visa Doc #</th><th>Sponsor ID</th><th>Category</th><th>Nationality</th><th>City (Stamping)</th><th>Gender</th><th>Client</th><th class="r">Quantity</th><th class="r">Days Left</th></tr></thead><tbody>'+
          groups.map(g=>'<tr><td style="font-family:monospace">'+esc(g.doc)+'</td><td style="font-family:monospace">'+esc(g.sid)+'</td><td class="cat">'+esc(g.cat)+'</td><td>'+esc(g.nat)+'</td><td>'+esc(g.city)+'</td><td>'+esc(g.gender)+'</td><td>'+esc(g.client)+'</td>'+
          '<td class="r"><span class="chip qty">'+g.qty+'</span></td><td class="r"><span class="chip days'+(g.days<=30?' soon':'')+'">'+g.days+'d</span></td></tr>').join('')+
          '</tbody></table></div>'
        : '<div class="ceo-empty">No unused or allocated visas expiring within the next '+EXP_WINDOW+' days. ('+totalActive+' active visas have an expiration date.)</div>');
    sec.appendChild(wrap);
    const sel=$('v38ExpWin'); if(sel) sel.addEventListener('change',()=>{ EXP_WINDOW=parseInt(sel.value,10)||180; renderExpirations(); });
    const eb=$('v38ExpExp'); if(eb) eb.addEventListener('click',()=>exportRows(
      ['Visa Doc #','Sponsor ID','Category','Nationality','City (Stamping)','Gender','Client','Quantity','Days Left'],
      groups.map(g=>[g.doc,g.sid,g.cat,g.nat,g.city,g.gender,g.client,g.qty,g.days]),
      'UPCOMING EXPIRATIONS — NEXT '+EXP_WINDOW+' DAYS','Expirations','UPCOMING EXPIRATIONS.xlsx'));
  }
  function insertExpirations(){
    const b=body(); if(!b) return;
    const old=$('v38ExpSec'); const perf=findSection(/overall performance indicators/i); if(!perf) return;
    if(!old){ const sec=document.createElement('div'); sec.className='ceo-sec'; sec.id='v38ExpSec'; sec.innerHTML='<h3></h3>'; perf.parentNode.insertBefore(sec, perf.nextSibling); renderExpirations(); }
  }

  function fixBars(){
    const b=body(); if(!b) return;
    b.querySelectorAll('.ceo-chart').forEach(card=>{
      if(card.dataset.v38bars==='1') return;
      const rows=[...card.querySelectorAll('.barrow')]; if(!rows.length) return;
      const vals=rows.map(r=>{const n=r.querySelector('.n'); return n?parseFloat(String(n.textContent).replace(/[^0-9.]/g,''))||0:0;});
      const max=Math.max(1,Math.max.apply(null,vals));
      rows.forEach((r,i)=>{
        const track=r.querySelector('.bartrack'), fill=r.querySelector('.barfill');
        if(track){ track.style.setProperty('display','block','important'); track.style.setProperty('height','16px','important'); track.style.setProperty('background','rgba(0,0,0,.07)','important'); track.style.setProperty('border-radius','4px','important'); track.style.setProperty('overflow','hidden','important'); }
        if(fill){ const w=Math.max(2,Math.round(vals[i]/max*100));
          fill.style.setProperty('display','block','important'); fill.style.setProperty('height','16px','important'); fill.style.setProperty('width',w+'%','important');
          if(!fill.style.background) fill.style.setProperty('background','#2E6FA3','important');
          fill.style.setProperty('border-radius','4px','important'); }
      });
      card.dataset.v38bars='1';
    });
  }

  function patchProjectReport(){
    const b=body(); if(!b||!b.querySelector('#ceoBack')) return;
    const exec=[...b.querySelectorAll('.ceo-sec')].find(s=>{const h=s.querySelector('h3'); return h&&/executive summary/i.test(h.textContent||'');});
    if(exec && exec.dataset.v381!=='1'){
      const title=(b.querySelector('.ceo-light')||{}).textContent||'';
      const key=/AMERICANA/i.test(title)?'AMERICANA':/ON-?DEMAND|SAFWAHR/i.test(title)?'ONDEMAND':'OTHER';
      const m=execMetrics(key);
      const h3=exec.querySelector('h3'); exec.innerHTML=''; exec.appendChild(h3);
      exec.insertAdjacentHTML('beforeend','<div class="v38-kpis">'+
        kpiCard('Total Candidates', m.total, '', '#2E6FA3')+
        kpiCard('Under Process', m.underProcess, pct(m.underProcess,m.total)+' of total', '#2E6FA3')+
        kpiCard('Selected Candidates', m.selected, pct(m.selected,m.total)+' of total', '#6E9A4E')+
        kpiCard('Awaiting Visas', m.awaitingVisa, pct(m.awaitingVisa,m.total)+' of total', '#B98A2E')+
        kpiCard('Issued Visas', m.issuedVisas, 'used visas', '#8C6A22')+
        kpiCard('For Deployment', m.forDeployment, 'upcoming only', '#B98A2E')+
        kpiCard('Arrived in Saudi Arabia', m.arrivedKsa, pct(m.arrivedKsa,m.total)+' of total', '#6E9A4E')+
        kpiCard('Arrived at Accommodation', m.arrivedAcc, pct(m.arrivedAcc,m.total)+' of total', '#6E9A4E')+
        kpiCard('Joined / Started Work', m.started, pct(m.started,m.total)+' of total', '#3F6C4D')+
        kpiCard('Cases (R-03)', m.cases, 'complaints / issues', '#8C6A22')+
        kpiCard('Critical Cases', m.critical, pct(m.critical,m.total)+' of total', '#A23B2E')+
      '</div>');
      exec.dataset.v381='1'; exec.dataset.v38='1';
    }
    const fd=[...b.querySelectorAll('.ceo-sec')].find(s=>{const h=s.querySelector('h3'); return h&&/^for deployment/i.test((h.textContent||'').trim());});
    if(fd && fd.dataset.v38fd!=='1'){
      const tbl=fd.querySelector('table');
      if(tbl){
        const heads=[...tbl.querySelectorAll('thead th')].map(th=>upc(th.textContent));
        const di=heads.findIndex(h=>h.includes('DEPLOYMENT DATE'));
        const now=new Date(); let removed=0;
        [...tbl.querySelectorAll('tbody tr')].forEach(tr=>{
          if(di<0) return; const td=tr.children[di]; if(!td) return;
          const raw=(td.textContent||'').trim(); const d=parseDate(raw);
          if(d && d<now){ tr.remove(); removed++; return; }
          if(!d || raw===''){ td.textContent='TBA'; td.style.color='#8E7F6A'; td.style.fontFamily="'IBM Plex Mono',monospace"; }
        });
        const cnt=fd.querySelector('.ceo-count'); if(cnt) cnt.textContent=tbl.querySelectorAll('tbody tr').length+' shown';
        if(removed) log('For Deployment: removed '+removed+' past-dated row(s)');
      }
      fd.dataset.v38fd='1';
    }
  }

  function tick(){
    const b=body(); if(!b) return;
    if(homeVisible()){ moveTiles(); patchTiles(); patchCR(); patchVUPB(); patchPerformance(); insertExpirations(); fixBars(); }
    else patchProjectReport();
  }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('ceo.v381', tick, 700); }
  else { setInterval(tick, 700); }
  setTimeout(tick, 500);

  window._entCEOv381={ tileMetrics, execMetrics, r03Count, issuedUsed, upcomingGrouped, crStatusSafwat };
  console.log('%c📊 CEO Dashboard v'+V+' — Cases = R-03 · Issued Visas = USED only · grouped Upcoming Expirations','color:#2F5A3B;font-weight:bold;');
})();

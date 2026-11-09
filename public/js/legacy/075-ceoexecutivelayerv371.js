
(function CEOExecutiveLayerV371(){
  'use strict';
  if(window.__entCEOx371) return; window.__entCEOx371=true;
  window.__entCEOx370=true;                      /* neutralize v3.7.0 */
  const V='3.7.1';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const has=(v)=>v!=null&&String(v).trim()!=='';
  const log=(...a)=>console.log('%c[CEO x3.7.1]','color:#2E6FA3;font-weight:bold',...a);
  const Toast=()=>window.Toast||{ok:console.log,warn:console.warn,err:console.error};

  function DB(){ try{ if(window._entCEO_DB) return window._entCEO_DB(); }catch(e){} return window.DB||{}; }
  const allCases=()=>DB().recruitmentCases||[];
  const allVisas=()=>DB().visaRecords||[];

  /* ---------- dates (Gregorian only) ---------- */
  function parseDate(s){
    const iso=window.SafwatCore.isoDate(s);
    return iso ? new Date(+iso.slice(0,4),+iso.slice(5,7)-1,+iso.slice(8,10)) : null;
  }
  const reached = s => { const d=parseDate(s); return !!d && window.SafwatCore.dayNumber(s)<=window.SafwatCore.dayNumber(window.SafwatCore.today()); };
  const DAY=86400000;
  function periodWindow(kind, ref){
    const d=new Date(ref); let from,to;
    if(kind==='D'){ from=new Date(d.getFullYear(),d.getMonth(),d.getDate()); to=new Date(from); to.setDate(to.getDate()+1); }
    else if(kind==='W'){ const wd=(d.getDay()+6)%7; from=new Date(d.getFullYear(),d.getMonth(),d.getDate()-wd); to=new Date(from); to.setDate(to.getDate()+7); }
    else if(kind==='M'){ from=new Date(d.getFullYear(),d.getMonth(),1); to=new Date(d.getFullYear(),d.getMonth()+1,1); }
    else if(kind==='Q'){ const q=Math.floor(d.getMonth()/3); from=new Date(d.getFullYear(),q*3,1); to=new Date(d.getFullYear(),q*3+3,1); }
    else if(kind==='Y'){ from=new Date(d.getFullYear(),0,1); to=new Date(d.getFullYear()+1,0,1); }
    else return null;
    return {from,to};
  }
  function prevWindow(kind,w){
    if(!w) return null;
    if(kind==='M') return {from:new Date(w.from.getFullYear(),w.from.getMonth()-1,1), to:new Date(w.from)};
    if(kind==='Q') return {from:new Date(w.from.getFullYear(),w.from.getMonth()-3,1), to:new Date(w.from)};
    if(kind==='Y') return {from:new Date(w.from.getFullYear()-1,0,1), to:new Date(w.from)};
    const span=w.to-w.from; return {from:new Date(w.from-span), to:new Date(w.from)};
  }
  function shiftRef(kind,ref,dir){ const d=new Date(ref);
    if(kind==='D') d.setDate(d.getDate()+dir); else if(kind==='W') d.setDate(d.getDate()+7*dir);
    else if(kind==='M') d.setMonth(d.getMonth()+dir); else if(kind==='Q') d.setMonth(d.getMonth()+3*dir);
    else if(kind==='Y') d.setFullYear(d.getFullYear()+dir); return d; }
  function labelFor(kind,w,ref){
    if(!w) return 'All time';
    const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; const d=new Date(ref);
    if(kind==='D') return d.getDate()+' '+MON[d.getMonth()]+' '+d.getFullYear();
    if(kind==='W'){ const e=new Date(w.to-DAY); return w.from.getDate()+' '+MON[w.from.getMonth()]+' – '+e.getDate()+' '+MON[e.getMonth()]+' '+e.getFullYear(); }
    if(kind==='M') return MON[d.getMonth()]+' '+d.getFullYear();
    if(kind==='Q') return 'Q'+(Math.floor(d.getMonth()/3)+1)+' '+d.getFullYear();
    if(kind==='Y') return String(d.getFullYear());
    return 'All time';
  }

  /* ---------- state ---------- */
  let RANGE='ALL', REF=new Date(), FILTERS_OPEN=false, FOCUS=false;
  const F_DEFAULT={project:'',client:'',nationality:'',position:'',agency:'',stage:'',recruitmentType:'',gender:''};
  let F={...F_DEFAULT};

  const ATTRITION=new Set(['WITHDRAWN/BACKOUT','UNFIT','REJECTED','CANCELLED','AWOL','TERMINATED','END OF SERVICE','UNRESPONSIVE','WITHDRAWN','WITHDRAWED APPLICATION','BACKOUT','CANCELED']);
  const isClosed=(c)=>{ const s=upc(c.stage); return s==='DEPLOYED'||reached(c.dateWorkStarted)||ATTRITION.has(s); };
  function isForDeployment(c){ const u=upc(c.stage); if(u==='DEPLOYED'||reached(c.dateArrivalKsa)||reached(c.dateWorkStarted)) return false; return u.includes('FOR DEPLOYMENT')||u==='VISA ISSUED'||u.includes('READY FOR TRAVEL'); }
  function projectOf(client){ const u=upc(client); if(u.includes('AMERICANA')) return 'AMERICANA'; if(u.includes('ON DEMAND')||u.includes('ON-DEMAND')||u.includes('SAFWAHR')||u.includes('SAFWA HR')) return 'ONDEMAND'; return 'OTHER'; }
  const PROJ_LABEL={AMERICANA:'AMERICANA', ONDEMAND:'SAFWAHR (On-Demand)', OTHER:'Other Clients'};

  /* ---------- filters (validated) ---------- */
  function caseMatches(c){
    if(F.project && projectOf(c.client)!==F.project) return false;
    if(F.client && upc(c.client)!==upc(F.client)) return false;
    if(F.nationality && upc(c.nationality)!==upc(F.nationality)) return false;
    if(F.position && upc(c.position)!==upc(F.position)) return false;
    if(F.agency && upc(c.agency)!==upc(F.agency)) return false;
    if(F.stage && upc(c.stage)!==upc(F.stage)) return false;
    if(F.recruitmentType && upc(c.recruitmentType)!==upc(F.recruitmentType)) return false;
    if(F.gender && upc(c.gender)!==upc(F.gender)) return false;
    return true;
  }
  /* visas only honour the dimensions they actually have */
  function visaMatches(v){
    if(F.project && projectOf(v.client)!==F.project) return false;
    if(F.client && upc(v.client)!==upc(F.client)) return false;
    if(F.nationality && upc(v.nationality)!==upc(F.nationality)) return false;
    if(F.agency && upc(v.registeredAgencyName)!==upc(F.agency)) return false;
    if(F.gender && upc(v.gender)!==upc(F.gender)) return false;
    return true;
  }
  const activeCount=()=>Object.values(F).filter(v=>v!=='').length;
  function optionsOf(list, field){ return [...new Set(list.map(x=>String(x[field]==null?'':x[field]).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)); }

  const inWin=(dateStr,w)=>{ if(!w) return true; const d=parseDate(dateStr); if(!d) return false; return d>=w.from&&d<w.to; };
  const caseDate=(c)=>c.dateWorkStarted||c.dateArrivalKsa||c.requestDate||c.createdAt||c.updatedAt;

  /* ---------- compute (cached per range+filters) ---------- */
  let CACHE={key:'',data:null};
  function compute(){
    const w=periodWindow(RANGE,REF); const pw=prevWindow(RANGE,w);
    const C0=allCases(), V0=allVisas();
    const key=[RANGE,(w?w.from.getTime():'all'),JSON.stringify(F),C0.length,V0.length].join('|');
    // Recompute from current records: edits can leave array lengths unchanged.
    const now=parseDate(window.SafwatCore.today());
    const C=C0.filter(caseMatches), Vz=V0.filter(visaMatches);
    const inC=C.filter(c=>inWin(caseDate(c),w));
    const prevC=pw?C.filter(c=>inWin(caseDate(c),pw)):[];
    const m={window:w,prevWindow:pw,total:inC.length,prevTotal:prevC.length,
      deployed:0,prevDeployed:0,active:0,attrition:0,forDeployment:0,arrivedKsa:0};
    inC.forEach(c=>{ const s=upc(c.stage);
      if(s==='DEPLOYED'||reached(c.dateWorkStarted)) m.deployed++;
      else if(ATTRITION.has(s)) m.attrition++; else m.active++;
      if(isForDeployment(c)) m.forDeployment++;
      if(reached(c.dateArrivalKsa)) m.arrivedKsa++; });
    prevC.forEach(c=>{ const s=upc(c.stage); if(s==='DEPLOYED'||reached(c.dateWorkStarted)) m.prevDeployed++; });
    m.visaTotal=Vz.length;
    m.visaUnused=Vz.filter(v=>upc(v.statusVisa)==='UNUSED').length;
    m.visaAllocated=Vz.filter(v=>upc(v.statusVisa)==='ALLOCATED').length;
    m.visaUsed=Vz.filter(v=>upc(v.statusVisa)==='USED').length;
    const att={expiringSoon:[],expiredActive:[],stalled:[],unlinked:[]};
    Vz.forEach(v=>{ const d=parseDate(v.expirationDate); const s=upc(v.statusVisa);
      if(d&&(s==='UNUSED'||s==='ALLOCATED')){ const days=Math.floor((d-now)/DAY);
        if(days<0) att.expiredActive.push(v); else if(days<=30) att.expiringSoon.push(v); }
      if(!has(v.linkedRecruitmentCaseId)&&s==='ALLOCATED') att.unlinked.push(v); });
    C.forEach(c=>{ if(isClosed(c)) return; const d=parseDate(c.updatedAt)||parseDate(c.requestDate); if(!d) return;
      const a=Math.floor((now-d)/DAY); if(a>60) att.stalled.push(c); });
    m.attention=att;
    const BUCKETS=[['0-7',0,7,'#3F6C4D'],['8-15',8,15,'#6E9A4E'],['16-30',16,30,'#B98A2E'],['31-60',31,60,'#D2762B'],['>60',61,1e9,'#A23B2E']];
    const hist=BUCKETS.map(b=>({label:b[0],min:b[1],max:b[2],color:b[3],n:0,items:[]}));
    C.forEach(c=>{ if(isClosed(c)) return; const d=parseDate(c.updatedAt)||parseDate(c.requestDate); if(!d) return;
      const a=Math.floor((now-d)/DAY); const b=hist.find(x=>a>=x.min&&a<=x.max); if(b){ b.n++; b.items.push({c,a}); } });
    m.ageHist=hist; m.scopeCases=C.length; m.scopeVisas=Vz.length;
    CACHE={key,data:m}; return m;
  }

  /* ---------- UI helpers ---------- */
  const pctOf=(n,t)=>t?((n/t*100).toFixed(1)+'% of total'):'—';
  function deltaHtml(cur,prev){
    if(RANGE==='ALL') return '';
    if(prev===0 && cur>0) return '<div class="trend flat">'+cur+' vs 0 previously · no % baseline</div>';
    let pct,dir;
    if(prev===0){ if(cur===0){dir='flat';pct=0;} else {dir='up';pct=100;} }
    else { const raw=Math.round((cur-prev)/prev*100); dir=raw>0?'up':raw<0?'down':'flat'; pct=Math.abs(raw); }
    const arrow=dir==='up'?'▲':dir==='down'?'▼':'■';
    return '<div class="trend '+dir+'">'+arrow+' '+pct+'% vs previous</div>';
  }
  /* NO ICONS */
  function kpiCard(label,value,sub,trend,color,target){
    return '<div class="xd-kpi" style="--kc:'+color+'"><b>'+value+'</b><div class="lb">'+esc(label)+'</div>'+
      (sub?'<div class="sub">'+esc(sub)+'</div>':'')+(trend||'')+(target||'')+'</div>';
  }

  /* ---------- drill ---------- */
  let DRILL={heads:[],rows:[],name:'export'};
  function openDrill(title,heads,rows,fname){
    DRILL={heads,rows,name:fname||'export'};
    $('xdDrillTitle').textContent=title+' — '+rows.length+' record(s)';
    $('xdDrillBody').innerHTML = rows.length
      ? '<table><thead><tr>'+heads.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+
        rows.slice(0,400).map(r=>'<tr>'+r.map(v=>'<td>'+esc(v==null?'':v)+'</td>').join('')+'</tr>').join('')+
        '</tbody></table>'+(rows.length>400?'<div style="padding:10px;text-align:center;color:#A89B82;font-family:monospace;font-size:12px">Showing first 400 — export for the full list.</div>':'')
      : '<div style="padding:26px;text-align:center;color:#A89B82;font-family:monospace">Nothing to show.</div>';
    $('xdDrill').classList.add('open');
  }
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && $('xdDrill').classList.contains('open')) $('xdDrill').classList.remove('open'); });
  $('xdDrillClose').addEventListener('click',()=>$('xdDrill').classList.remove('open'));
  $('xdDrill').addEventListener('click',(e)=>{ if(e.target===$('xdDrill')) $('xdDrill').classList.remove('open'); });
  $('xdDrillExport').addEventListener('click',()=>{
    try{
      if(typeof window._entCEOExport==='function'){ window._entCEOExport(DRILL.heads,DRILL.rows,'Data',DRILL.name+'.xlsx'); return; }
      const csv=[DRILL.heads].concat(DRILL.rows).map(r=>r.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(',')).join('\n');
      const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url; a.download=DRILL.name+'.csv'; a.style.position='fixed'; a.style.left='-9999px';
      document.body.appendChild(a); a.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      setTimeout(()=>{ try{document.body.removeChild(a);}catch(e){} URL.revokeObjectURL(url); },1500);
      Toast().ok('Exported', DRILL.rows.length+' row(s)');
    }catch(e){ Toast().err('Export failed', e.message); }
  });

  /* ---------- build ---------- */
  function buildLayer(){
    const m=compute(); const w=m.window; const total=m.total||0;
    const deployRate= total? (m.deployed/total*100):0;


    const seg=['ALL','Y','Q','M','W','D'].map(k=>'<button data-r="'+k+'" class="'+(RANGE===k?'on':'')+'">'+(k==='ALL'?'All Time':k)+'</button>').join('');
    const range='<div id="xdRange"><div class="xr-top">'+
      '<span class="xr-seg">'+seg+'</span>'+
      (RANGE!=='ALL'?('<span class="xr-nav"><button id="xdPrev" title="Previous">‹</button><span class="xr-label">'+esc(labelFor(RANGE,w,REF))+'</span><button id="xdNext" title="Next">›</button></span>'):'')+
      '<span class="xr-right"><span class="xr-show">Showing: '+esc(RANGE==='ALL'?'all time':labelFor(RANGE,w,REF))+'</span>'+
      '<button class="xr-link" id="xdLive">↺ Back to live</button><button class="xr-link" id="xdReset">✕ Reset</button></span>'+
    '</div></div>';

    /* --- filter bar --- */
    const C0=allCases(), V0=allVisas();
    const sel=(key,label,opts,display)=>{
      const cur=F[key];
      return '<div class="xf-cell"><label for="xdFilter-'+key+'">'+esc(label)+'</label><select id="xdFilter-'+key+'" data-f="'+key+'" class="'+(cur?'set':'')+'">'+
        '<option value="">All</option>'+
        opts.map(o=>{ const val=typeof o==='object'?o.v:o; const txt=typeof o==='object'?o.t:o;
          return '<option value="'+esc(val)+'"'+(upc(val)===upc(cur)?' selected':'')+'>'+esc(txt)+'</option>'; }).join('')+
      '</select></div>';
    };
    const clientOpts=[...new Set(C0.map(c=>c.client).concat(V0.map(v=>v.client)).map(x=>String(x||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    const natOpts=[...new Set(C0.map(c=>c.nationality).concat(V0.map(v=>v.nationality)).map(x=>String(x||'').trim().toUpperCase()).filter(Boolean))].sort();
    const agencyOpts=[...new Set(C0.map(c=>c.agency).concat(V0.map(v=>v.registeredAgencyName)).map(x=>String(x||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    const typeOpts=[{v:'LOCAL_TRANSFER',t:'Local Transfer'},{v:'OVERSEAS_ENDORSED',t:'Overseas – Endorsed'},{v:'OVERSEAS_SOURCED',t:'Overseas – Sourced'}];
    const filters='<div id="xdFilters"'+(FILTERS_OPEN?'':' hidden')+'><div class="xf-grid">'+
      sel('project','Project',[{v:'AMERICANA',t:'AMERICANA'},{v:'ONDEMAND',t:'SAFWAHR (On-Demand)'},{v:'OTHER',t:'Other Clients'}])+
      sel('client','Client', clientOpts)+
      sel('nationality','Nationality', natOpts)+
      sel('position','Position', optionsOf(C0,'position').map(x=>x.toUpperCase()))+
      sel('agency','Agency', agencyOpts)+
      sel('stage','Stage', optionsOf(C0,'stage'))+
      sel('recruitmentType','Recruitment Type', typeOpts)+
      sel('gender','Gender', [...new Set(C0.map(c=>c.gender).concat(V0.map(v=>v.gender)).map(x=>String(x||'').trim().toUpperCase()).filter(Boolean))].sort())+
    '</div><div class="xf-foot">'+
      '<span class="xf-count"><b>'+activeCount()+'</b> filter(s) active</span>'+
      '<button class="xf-clear" id="xdClearF">✕ Clear filters</button>'+
      '<span class="xf-scope">Scope: '+m.scopeCases+' case(s) · '+m.scopeVisas+' visa(s)</span>'+
    '</div></div>';

    const kp='<div id="xdKpis">'+
      kpiCard('Candidates', total, RANGE==='ALL'?'all records':'in this period', deltaHtml(total,m.prevTotal), '#2E6FA3')+
      kpiCard('Deployed / Started', m.deployed, pctOf(m.deployed,total), deltaHtml(m.deployed,m.prevDeployed), '#3F6C4D')+
      kpiCard('Deployment Share', total ? deployRate.toFixed(1)+'%' : '—','Deployed ÷ selected candidates','','#8C6A22')+
      kpiCard('Active / In Progress', m.active, pctOf(m.active,total), '', '#2E6FA3')+
      kpiCard('For Deployment', m.forDeployment, pctOf(m.forDeployment,total), '', '#B98A2E')+
      kpiCard('Arrived in KSA', m.arrivedKsa, pctOf(m.arrivedKsa,total), '', '#6E9A4E')+
      kpiCard('Closed / Withdrawn', m.attrition, pctOf(m.attrition,total), '', '#A23B2E')+
      kpiCard('Visas — Unused', m.visaUnused, pctOf(m.visaUnused,m.visaTotal), '', '#3F6C4D')+
      kpiCard('Visas — Allocated', m.visaAllocated, pctOf(m.visaAllocated,m.visaTotal), '', '#B98A2E')+
      kpiCard('Visas — Used', m.visaUsed, pctOf(m.visaUsed,m.visaTotal), '', '#2E6FA3')+
    '</div>';

    const a=m.attention;
    const maxAtt=Math.max(1,a.expiringSoon.length,a.expiredActive.length,a.stalled.length,a.unlinked.length);
    const attRow=(key,label,arr,color)=>{ const n=arr.length; const pct=Math.round(n/maxAtt*100);
      return '<div class="xd-attrow'+(n===0?' zero':'')+'" data-att="'+key+'" style="--ac:'+color+'">'+
        '<span class="t">'+(n===0?'✓ ':'')+esc(label)+'</span><span class="n">'+n+'</span>'+
        (n>0?'<span class="track"><span class="fill" style="width:'+Math.max(4,pct)+'%"></span></span>':'')+'</div>'; };
    const attention='<div class="xd-card"><h4>Needs Attention</h4><div class="hint">Items that require action now — click any row to see the records.</div><div class="xd-att">'+
      attRow('expiredActive','Expired visas still Unused / Allocated', a.expiredActive, '#A23B2E')+
      attRow('expiringSoon','Visas expiring within 30 days', a.expiringSoon, '#D2762B')+
      attRow('stalled','Candidates with no recorded update > 60 days', a.stalled, '#B98A2E')+
      attRow('unlinked','Allocated visas with no linked candidate', a.unlinked, '#6B6558')+
    '</div></div>';

    const maxAge=Math.max(1,...m.ageHist.map(b=>b.n));
    const age='<div class="xd-card"><h4>Open Candidate Follow-ups</h4><div class="hint">Days since last recorded update, open candidates only — click a bar to list them.</div><div class="xd-age">'+
      m.ageHist.map(b=>'<div class="xd-agecol" data-age="'+b.label+'"><span class="val">'+b.n+'</span><span class="bar" style="height:'+Math.max(3,Math.round(b.n/maxAge*112))+'px;background:'+b.color+'"></span><span class="lb">'+b.label+'<br>days</span></div>').join('')+
    '</div></div>';

    const intro='<div class="xd-command"><div><div class="ws-overline">PROJECT D / EXECUTIVE WORKSPACE</div><h2>Your decision brief</h2><p>Choose a scope. Review exceptions. Open the records behind the numbers.</p></div><div class="xd-command-actions"><button id="xdToggleFilters" aria-expanded="'+FILTERS_OPEN+'" aria-controls="xdFilters">Filters ('+activeCount()+')</button><button id="xdFocus" aria-pressed="'+FOCUS+'">'+(FOCUS?'Show full dashboard':'Focus view')+'</button><button id="xdSummaryExport">Export summary</button></div></div>';
    const scope='<div class="xd-scope-note"><strong>Reading this view</strong><p>Candidate KPIs use the selected period and filters. Visas, attention items and follow-up age use all dates within the filters. Project reports below keep their own scope.</p><details><summary>Metric definitions</summary><p>Period date: work-start date, then KSA arrival, request, creation or update date. These are current records grouped by a recorded date, not a historical activity log. Deployment share is deployed/started candidates divided by selected candidates; no target is assumed. Arrival and for-deployment counts can overlap other stages. Follow-up age measures recorded updates, not time in stage. Missing activity dates are excluded from the age chart.</p></details></div>';
    return intro+range+filters+scope+kp+'<div class="xd-two">'+attention+age+'</div>';

  }

  function wireLayer(host){
    $('xdToggleFilters').onclick=()=>{ FILTERS_OPEN=!FILTERS_OPEN; $('xdFilters').hidden=!FILTERS_OPEN; $('xdToggleFilters').setAttribute('aria-expanded',String(FILTERS_OPEN)); };
    $('xdFocus').onclick=()=>{ FOCUS=!FOCUS; $('ceoDashBody').classList.toggle('xd-focus',FOCUS); $('xdFocus').setAttribute('aria-pressed',String(FOCUS)); $('xdFocus').textContent=FOCUS?'Show full dashboard':'Focus view'; };
    $('xdSummaryExport').onclick=()=>{
      const m=compute();
      const rows=[['Period',RANGE==='ALL'?'All time':labelFor(RANGE,m.window,REF)],['Filters',JSON.stringify(F)],['Scope','Candidate KPIs: selected period; visas and attention: all dates within filters'],['Candidates',m.total],['Deployed / Started',m.deployed],['Deployment share',m.total?(m.deployed/m.total*100).toFixed(1)+'%':''],['Active',m.active],['Closed / Withdrawn',m.attrition],['For deployment',m.forDeployment],['Arrived in KSA',m.arrivedKsa],['Visas unused',m.visaUnused],['Visas allocated',m.visaAllocated],['Visas used',m.visaUsed],['Expired unused/allocated visas',m.attention.expiredActive.length],['Visas expiring within 30 days',m.attention.expiringSoon.length],['Candidates over 60 days since update',m.attention.stalled.length],['Allocated visas without link',m.attention.unlinked.length]];
      const url=URL.createObjectURL(new Blob([window.SafwatCore.csv(['Metric','Value'],rows)],{type:'text/csv;charset=utf-8'}));
      const a=document.createElement('a'); a.href=url; a.download='PROJECT-D-summary-'+window.SafwatCore.today()+'.csv'; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    host.querySelectorAll('[data-att], [data-age]').forEach(el=>{el.tabIndex=0;el.setAttribute('role','button');el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}});});

    host.querySelectorAll('#xdRange .xr-seg button').forEach(b=>b.addEventListener('click',()=>{ RANGE=b.dataset.r; CACHE.key=''; inject(true); }));
    const pv=$('xdPrev'), nx=$('xdNext');
    if(pv) pv.addEventListener('click',()=>{ REF=shiftRef(RANGE,REF,-1); CACHE.key=''; inject(true); });
    if(nx) nx.addEventListener('click',()=>{ REF=shiftRef(RANGE,REF,1); CACHE.key=''; inject(true); });
    const lv=$('xdLive'); if(lv) lv.addEventListener('click',()=>{ REF=new Date(); CACHE.key=''; inject(true); });
    const rs=$('xdReset'); if(rs) rs.addEventListener('click',()=>{ RANGE='ALL'; REF=new Date(); F={...F_DEFAULT}; CACHE.key=''; inject(true); });
    host.querySelectorAll('#xdFilters select[data-f]').forEach(s=>s.addEventListener('change',()=>{ F[s.dataset.f]=s.value; CACHE.key=''; inject(true); }));
    const cf=$('xdClearF'); if(cf) cf.addEventListener('click',()=>{ F={...F_DEFAULT}; CACHE.key=''; inject(true); });

    const m=compute(); const a=m.attention; const now=new Date();
    host.querySelectorAll('[data-att]').forEach(el=>el.addEventListener('click',()=>{
      const k=el.dataset.att; const arr=a[k]||[]; if(!arr.length) return;
      if(k==='stalled'){
        openDrill('Candidates with no recorded update > 60 days', ['ID','Name','Passport','Client','Stage','Days since update'],
          arr.map(c=>{ const d=parseDate(c.updatedAt)||parseDate(c.requestDate); return [c.id,c.name||'',c.passport||'',c.client||'',c.stage||'', d?Math.floor((now-d)/DAY):'']; }), 'STALLED CANDIDATES');
      } else {
        const title = k==='expiredActive'?'Expired visas still Unused / Allocated' : k==='expiringSoon'?'Visas expiring within 30 days':'Allocated visas with no linked candidate';
        openDrill(title, ['ID','Visa Doc #','Sponsor ID','Nationality','Client','Status','Expiration','Days'],
          arr.map(v=>{ const d=parseDate(v.expirationDate); return [v.id,v.visaDocumentNumber||'',v.sponsorId||'',v.nationality||'',v.client||'',v.statusVisa||'',v.expirationDate||'', d?Math.floor((d-now)/DAY):'']; }),
          title.toUpperCase().replace(/[^A-Z0-9 ]/g,''));
      }
    }));
    host.querySelectorAll('[data-age]').forEach(el=>el.addEventListener('click',()=>{
      const b=m.ageHist.find(x=>x.label===el.dataset.age); if(!b||!b.n) return;
      openDrill('Open candidates — '+b.label+' days idle', ['ID','Name','Passport','Client','Stage','Days since update'],
        b.items.map(it=>[it.c.id,it.c.name||'',it.c.passport||'',it.c.client||'',it.c.stage||'',it.a]), 'OPEN ITEMS '+b.label);
    }));
  }

  function homeVisible(){ const body=$('ceoDashBody'); if(!body) return false; return !!body.querySelector('.ceo-tile') && !body.querySelector('#ceoBack'); }
  function inject(force){
    const body=$('ceoDashBody'); if(!body) return;
    body.classList.toggle('xd-focus',FOCUS && homeVisible());
    if(!homeVisible()){ const old=$('xdWrap'); if(old) old.remove(); return; }
    let wrap=$('xdWrap'); if(wrap&&!force) return; if(wrap) wrap.remove();
    wrap=document.createElement('div'); wrap.id='xdWrap'; wrap.innerHTML=buildLayer();
    body.insertBefore(wrap, body.firstChild); wireLayer(wrap);
  }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('ceo.execlayer', ()=>inject(false), 700); }
  else { setInterval(()=>inject(false), 700); }
  setTimeout(()=>inject(true), 400);

  window._entCEOExecRefresh=()=>{ CACHE.key=''; inject(true); };
  console.log('%c📈 CEO Executive layer v'+V+' active — 8 filters · time range · KPI trends & target · Needs Attention · Open Candidate Follow-ups','color:#2E6FA3;font-weight:bold;');
})();

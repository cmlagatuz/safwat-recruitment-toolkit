
(function CEOv393(){
  'use strict';
  if(window.__entCEOv393) return; window.__entCEOv393=true;
  window.__entCEOv390=true; window.__entCEOv391=true; window.__entCEOv392=true;
  const V='3.9.3';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const has=(v)=>v!=null&&String(v).trim()!=='';
  const log=(...a)=>console.log('%c[CEO v3.9.3]','color:#2F5A3B;font-weight:bold',...a);
  const Toast=()=>window.Toast||{ok:console.log,warn:console.warn,err:console.error};

  /* ---------- data ---------- */
  let CACHE_DB=null, FETCHING=false;
  function liveDB(){
    if(CACHE_DB && ((CACHE_DB.recruitmentCases||[]).length || (CACHE_DB.visaRecords||[]).length)) return CACHE_DB;
    const w=window.DB;
    if(w && ((w.recruitmentCases||[]).length || (w.visaRecords||[]).length)) return w;
    return CACHE_DB || w || {};
  }
  window._entCEO_DB=liveDB;
  function waitAuth(ms){
    return new Promise(res=>{
      if(typeof firebase==='undefined'||!firebase.auth){ res(null); return; }
      const cur=firebase.auth().currentUser; if(cur){ res(cur); return; }
      let done=false;
      const un=firebase.auth().onAuthStateChanged(u=>{ if(done) return; done=true; try{un();}catch(e){} res(u||null); });
      setTimeout(()=>{ if(done) return; done=true; try{un();}catch(e){} res(firebase.auth().currentUser||null); }, ms||4000);
    });
  }
  async function ensureData(){
    if(FETCHING) return;
    const d=liveDB();
    if((d.recruitmentCases||[]).length || (d.visaRecords||[]).length) return;
    if(typeof firebase==='undefined'||!firebase.database) return;
    FETCHING=true;
    try{
      let u=await waitAuth(4000);
      if(!u || u.isAnonymous){ FETCHING=false; return; }
      const snap=await firebase.database().ref('safwat/databases/main').once('value');
      const v=snap.val(); const data=(v&&v.data)?v.data:v;
      if(data && (Array.isArray(data.recruitmentCases)||Array.isArray(data.visaRecords))){
        CACHE_DB=data;
        log('data resolved — '+(data.recruitmentCases||[]).length+' cases');
        try{ if(window._entCEOExecRefresh) window._entCEOExecRefresh(); }catch(e){}
        renderLeaderboard(true); renderCalendars(true); patchTilesAndSummary(true);
      }
    }catch(e){}
    finally{ FETCHING=false; }
  }
  const cases=()=>liveDB().recruitmentCases||[];
  const visas=()=>liveDB().visaRecords||[];
  function parseDate(s){ if(!s) return null; const t=String(s).trim().replace(/[.\/]/g,'-');
    let m=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if(m){const y=+m[1]; if(y>=1900){const d=new Date(y,+m[2]-1,+m[3]); return isNaN(d.getTime())?null:d;} return null;}
    m=t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/); if(m){const d=new Date(+m[3],+m[2]-1,+m[1]); return isNaN(d.getTime())?null:d;}
    const d=new Date(s); return isNaN(d.getTime())?null:d; }

  /* =====================================================
     THE SINGLE DATE RULE — a date counts only once reached
     ===================================================== */
  const sod=(d)=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
  function occurred(s){ const d=parseDate(s); return !!d && sod(d)<=sod(new Date()); }   /* today or past */
  function future(s){ const d=parseDate(s); return !!d && sod(d)>sod(new Date()); }

  const arrivedKsa=(c)=>occurred(c.dateArrivalKsa);
  const arrivedAcc=(c)=>occurred(c.dateArrivedAccommodation);
  /* Mobilization: a real mobilization date OR arrival in KSA already reached */
  const mobilized=(c)=>occurred(c.dateWorkStarted)||occurred(c.mobilizationDate)||occurred(c.dateDeployment)||arrivedKsa(c)||upc(c.stage)==='DEPLOYED';
  function forDeployment(c){
    const s=upc(c.stage);
    if(s==='DEPLOYED') return false;
    if(future(c.dateArrivalKsa)) return true;                 /* future arrival = still to deploy */
    const isFD=s.includes('FOR DEPLOYMENT')||s==='VISA ISSUED'||s.includes('READY FOR TRAVEL')||s.includes('READY FOR DEPLOYMENT');
    if(!isFD) return false;
    return !arrivedKsa(c);                                    /* already arrived → not pending */
  }

  const MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const ATTR={W:'WITHDRAWN/BACKOUT',U:'UNFIT',R:'UNRESPONSIVE'};
  const ATTRITION=new Set([ATTR.W,ATTR.U,ATTR.R,'REJECTED','CANCELLED','AWOL','TERMINATED','END OF SERVICE']);
  function projectOf(client){ const u=upc(client); if(u.includes('AMERICANA')) return 'AMERICANA'; if(u.includes('ON DEMAND')||u.includes('ON-DEMAND')||u.includes('SAFWAHR')||u.includes('SAFWA HR')) return 'ONDEMAND'; return 'OTHER'; }
  const PROJECTS=[{key:'AMERICANA'},{key:'ONDEMAND'},{key:'OTHER'}];
  function exportRows(heads,rows,title,sheet,file){
    if(window.EntExport&&window.EntExport.xlsx) return window.EntExport.xlsx(heads,rows,title,sheet,file);
    Toast().err('Export failed','Universal exporter not loaded.');
  }
  function reparentModals(){
    const host=$('ceoDashOv'); if(!host) return;
    ['pdCalPop','xdDrill'].forEach(id=>{ const el=$(id); if(el && el.parentElement!==host) host.appendChild(el); });
  }

  /* =====================================================
     tiles + executive summary — one consistent rule
     ===================================================== */
  function projList(key){ return cases().filter(c=>projectOf(c.client)===key); }
  function metrics(key){
    const list=projList(key);
    const m={total:list.length,underProcess:0,started:0,arrived:0,arrivedAcc:0,forDeployment:0,
             selected:0,awaitingVisa:0,critical:0,cases:0,issuedVisas:0};
    const SO={'PENDING OFFER LETTER':0,'OFFER SIGNING':1,'FOR MEDICAL APPOINTMENT':2,'MEDICAL ON PROGRESS':3,'FOR SKILLS VERIFICATION APPOINTMENT':4,'SVP/QVP ON PROGRESS':5,'FOR BIOMETRICS APPOINTMENT':6,'BIOMETRICS IN PROGRESS AND CONSULAR SUBMISSION':7,'VISA ISSUED':8,'FOR DEPLOYMENT':8,'READY FOR TRAVEL':8,'DEPLOYED':9};
    list.forEach(c=>{
      const s=upc(c.stage); const idx=(s in SO)?SO[s]:-1;
      if(ATTRITION.has(s)){ m.critical++; return; }
      if(s==='ON HOLD') m.critical++;
      if(mobilized(c)) m.started++;
      if(arrivedKsa(c)) m.arrived++;
      if(arrivedAcc(c)) m.arrivedAcc++;
      if(forDeployment(c)) m.forDeployment++;
      if(idx>=6&&idx<=7) m.awaitingVisa++;
      if(idx>=2) m.selected++;
      if(idx>=0&&idx<=7) m.underProcess++;
    });
    m.issuedVisas=visas().filter(v=>projectOf(v.client)===key && upc(v.statusVisa)==='USED').length;
    m.cases=(liveDB().ceoCases||[]).filter(x=>projectOf(x.client)===key).length;
    return m;
  }
  function patchTilesAndSummary(force){
    const b=$('ceoDashBody'); if(!b) return;
    /* tiles */
    b.querySelectorAll('.ceo-tile').forEach(tile=>{
      const key=tile.dataset.proj; if(!key) return;
      const sig='v393|'+cases().length;
      if(!force && tile.dataset.sig393===sig) return;
      tile.dataset.sig393=sig;
      const m=metrics(key); const kp=tile.querySelector('.kpis'); if(!kp) return;
      kp.innerHTML=
        '<div class="k"><b>'+m.total+'</b><span>Total</span></div>'+
        '<div class="k"><b>'+m.underProcess+'</b><span>Under Process</span></div>'+
        '<div class="k"><b>'+m.started+'</b><span>Mobilization</span></div>'+
        '<div class="k"><b>'+m.cases+'</b><span>Cases (R-03)</span></div>'+
        '<div class="k"><b>'+m.issuedVisas+'</b><span>Issued Visas</span></div>'+
        '<div class="k"><b>'+m.arrived+'</b><span>Arrived</span></div>';
    });
    /* executive summary on a project report */
    if(b.querySelector('#ceoBack')){
      const exec=[...b.querySelectorAll('.ceo-sec')].find(s=>{const h=s.querySelector('h3'); return h&&/executive summary/i.test(h.textContent||'');});
      if(exec){
        const title=(b.querySelector('.ceo-light')||{}).textContent||'';
        const key=/AMERICANA/i.test(title)?'AMERICANA':/ON-?DEMAND|SAFWAHR/i.test(title)?'ONDEMAND':'OTHER';
        const sig='v393|'+key+'|'+cases().length;
        if(force || exec.dataset.sig393!==sig){
          exec.dataset.sig393=sig;
          const m=metrics(key);
          const pct=(n)=>m.total?((n/m.total*100).toFixed(1)+'% of total'):'—';
          const card=(l,v,s,c)=>'<div class="v38-kpi" style="--kc:'+c+'"><b>'+v+'</b><div class="lb">'+esc(l)+'</div>'+(s?'<div class="sub">'+esc(s)+'</div>':'')+'</div>';
          const h3=exec.querySelector('h3'); exec.innerHTML=''; exec.appendChild(h3);
          exec.insertAdjacentHTML('beforeend','<div class="v38-kpis">'+
            card('Total Candidates',m.total,'','#2E6FA3')+
            card('Under Process',m.underProcess,pct(m.underProcess),'#2E6FA3')+
            card('Selected Candidates',m.selected,pct(m.selected),'#6E9A4E')+
            card('Awaiting Visas',m.awaitingVisa,pct(m.awaitingVisa),'#B98A2E')+
            card('Issued Visas',m.issuedVisas,'used visas','#8C6A22')+
            card('For Deployment',m.forDeployment,'not yet arrived','#B98A2E')+
            card('Arrived in Saudi Arabia',m.arrived,pct(m.arrived),'#6E9A4E')+
            card('Arrived at Accommodation',m.arrivedAcc,pct(m.arrivedAcc),'#6E9A4E')+
            card('Mobilization',m.started,pct(m.started),'#3F6C4D')+
            card('Cases (R-03)',m.cases,'complaints / issues','#8C6A22')+
            card('Critical Cases',m.critical,pct(m.critical),'#A23B2E')+
          '</div>');
        }
      }
    }
  }

  /* =====================================================
     leaderboard
     ===================================================== */
  function leaderboard(){
    const g={};
    cases().forEach(c=>{
      const k=c.client||'(Unspecified)';
      if(!g[k]) g[k]={client:k,offSent:0,offSigned:0,medIn:0,medDone:0,svpIn:0,svpDone:0,bioIn:0,stamped:0,withdrawn:0,unfit:0,unresp:0,mobilization:0,active:0,total:0};
      const s=upc(c.stage); const G=g[k]; G.total++;
      if(s==='PENDING OFFER LETTER') G.offSent++;
      if(s==='OFFER SIGNING') G.offSigned++;
      if(s==='FOR MEDICAL APPOINTMENT'||s==='MEDICAL ON PROGRESS') G.medIn++;
      if(occurred(c.dateMedicalResult)) G.medDone++;
      if(s==='FOR SKILLS VERIFICATION APPOINTMENT'||s==='SVP/QVP ON PROGRESS') G.svpIn++;
      if(occurred(c.dateSvpResult)) G.svpDone++;
      if(s.includes('BIOMETRIC')||s.includes('CONSULAR')) G.bioIn++;
      if(s==='VISA ISSUED'||s.includes('FOR DEPLOYMENT')||s.includes('READY FOR TRAVEL')) G.stamped++;
      if(s===ATTR.W) G.withdrawn++;
      if(s===ATTR.U) G.unfit++;
      if(s===ATTR.R) G.unresp++;
      if(mobilized(c)) G.mobilization++;                   /* mobilization date OR arrival in KSA */
      if(!ATTRITION.has(s) && s!=='DEPLOYED') G.active++;
    });
    return Object.values(g).map(r=>({...r, acc: r.total? Math.round((r.mobilization+r.stamped)/r.total*100) : 0})).sort((a,b)=>b.total-a.total);
  }
  const numCell=(n)=>'<td class="'+(n?'':'z')+'">'+(n||0)+'</td>';
  function leaderboardHtml(){
    const rows=leaderboard();
    if(!rows.length) return '<div class="ceo-empty">No recruitment cases loaded.</div>';
    const tot=rows.reduce((t,r)=>{ ['offSent','offSigned','medIn','medDone','svpIn','svpDone','bioIn','stamped','withdrawn','unfit','unresp','mobilization','active','total'].forEach(k=>t[k]+=r[k]); return t; },
      {offSent:0,offSigned:0,medIn:0,medDone:0,svpIn:0,svpDone:0,bioIn:0,stamped:0,withdrawn:0,unfit:0,unresp:0,mobilization:0,active:0,total:0});
    const totAcc=tot.total?Math.round((tot.mobilization+tot.stamped)/tot.total*100):0;
    return '<div class="pd-lb-wrap"><table class="pd-lb"><thead>'+
      '<tr><th class="cli" rowspan="2">Client</th><th class="grp" colspan="2">Offers</th><th class="grp" colspan="2">Medical</th>'+
      '<th class="grp" colspan="2">SVP/QVP</th><th class="grp" colspan="2">Biometrics &amp; Visa Stamping</th>'+
      '<th class="grp" colspan="3">Attrition</th><th class="grp" rowspan="2">Mobilization</th>'+
      '<th class="grp" colspan="3">Pipeline Totals</th></tr>'+
      '<tr><th>Sent</th><th>Signed</th><th>In Progress</th><th>Completed</th><th>In Progress</th><th>Completed</th>'+
      '<th>In Progress</th><th>Stamped</th><th>Withdrawn</th><th>Unfit</th><th>Unresponsive</th>'+
      '<th>Active</th><th>Total</th><th>Accomplished %</th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td class="cli" title="'+esc(r.client)+'">'+esc(r.client)+'</td>'+
        numCell(r.offSent)+numCell(r.offSigned)+numCell(r.medIn)+numCell(r.medDone)+numCell(r.svpIn)+numCell(r.svpDone)+
        numCell(r.bioIn)+numCell(r.stamped)+numCell(r.withdrawn)+numCell(r.unfit)+numCell(r.unresp)+numCell(r.mobilization)+
        numCell(r.active)+'<td>'+r.total.toLocaleString()+'</td><td class="acc">'+r.acc+'%</td></tr>').join('')+
      '</tbody><tfoot><tr><td class="cli">TOTAL ('+rows.length+' clients)</td>'+
      ['offSent','offSigned','medIn','medDone','svpIn','svpDone','bioIn','stamped','withdrawn','unfit','unresp','mobilization','active'].map(k=>'<td>'+tot[k]+'</td>').join('')+
      '<td>'+tot.total.toLocaleString()+'</td><td class="acc">'+totAcc+'%</td></tr></tfoot></table></div>';
  }

  /* ---------- calendars ---------- */
  let ARR_REF=new Date(), APT_REF=new Date();
  const APPT_TYPES=[['dateMedicalOutset','Medical','#2E6FA3'],['dateSvpOutset','SVP/QVP','#8C6A22'],['dateBioOutset','Biometrics','#3F6C4D']];
  function isPast(y,m,d){ return sod(new Date(y,m,d)) < sod(new Date()); }
  function arrivalsByDay(y,m){ const map={}; cases().forEach(c=>{ const d=parseDate(c.dateArrivalKsa); if(!d) return; if(d.getFullYear()!==y||d.getMonth()!==m) return; const k=d.getDate(); (map[k]=map[k]||[]).push(c); }); return map; }
  function apptsByDay(y,m){ const map={}; cases().forEach(c=>APPT_TYPES.forEach(([f,label,color])=>{ const d=parseDate(c[f]); if(!d) return; if(d.getFullYear()!==y||d.getMonth()!==m) return; const k=d.getDate(); (map[k]=map[k]||[]).push({c,type:label,color}); })); return map; }
  function monthCells(y,m){ const sd=(new Date(y,m,1).getDay()+6)%7; const days=new Date(y,m+1,0).getDate(); const cells=[]; for(let i=0;i<sd;i++) cells.push(null); for(let d=1;d<=days;d++) cells.push(d); while(cells.length%7) cells.push(null); return cells; }
  const DOW=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  function calHtml(kind, ref){
    const y=ref.getFullYear(), m=ref.getMonth(); const isArr=kind==='arr';
    const map=isArr?arrivalsByDay(y,m):apptsByDay(y,m);
    const total=Object.values(map).reduce((s,a)=>s+a.length,0);
    const today=new Date();
    const grid=DOW.map(d=>'<div class="pd-dow">'+d+'</div>').join('')+
      monthCells(y,m).map(d=>{
        if(d===null) return '<div class="pd-day blank"></div>';
        const items=map[d]||[]; const past=isPast(y,m,d);
        const isToday=today.getFullYear()===y&&today.getMonth()===m&&today.getDate()===d;
        const clickable=items.length>0 && (isArr || !past);
        let dots='';
        if(!isArr && items.length){ const byType={}; items.forEach(it=>{ byType[it.type]=(byType[it.type]||0)+1; });
          dots='<div class="pd-dots">'+APPT_TYPES.filter(t=>byType[t[1]]).map(t=>'<span class="pd-dot" style="background:'+t[2]+'" title="'+t[1]+': '+byType[t[1]]+'"></span>').join('')+'</div>'; }
        const cls=['pd-day']; if(items.length) cls.push('has'); if(past) cls.push('past'); if(isToday) cls.push('today');
        if(clickable) cls.push('clickable'); else if(items.length) cls.push('locked');
        const title=(items.length&&!clickable)?' title="Past appointment — details are hidden"':'';
        return '<div class="'+cls.join(' ')+'"'+(clickable?(' data-cal="'+kind+'" data-day="'+d+'"'):'')+title+'>'+
          '<span class="dn">'+d+'</span>'+dots+
          (items.length?('<span class="pd-badge '+(isArr?'arr':'apt')+(past?' muted':'')+'">'+items.length+'</span>'):'')+'</div>';
      }).join('');
    const legend=isArr
      ? '<div class="pd-legend"><span class="li"><span class="sw" style="background:#2E6FA3"></span>Arrivals in KSA</span><span class="li">Past days are greyed — history stays viewable.</span></div>'
      : '<div class="pd-legend">'+APPT_TYPES.map(t=>'<span class="li"><span class="sw" style="background:'+t[2]+'"></span>'+t[1]+'</span>').join('')+'<span class="li">Past days are greyed and locked — only today onwards opens.</span></div>';
    return '<div class="pd-cal"><h4>'+(isArr?'Arrivals Calendar':'Government Appointments')+'</h4>'+
      '<div class="hint">'+(isArr?'Candidates arriving in Saudi Arabia, by date. Future dates count as For Deployment until reached.':'Medical, SVP/QVP and Biometrics appointment dates.')+'</div>'+
      '<div class="pd-cal-head"><button data-nav="'+kind+':-1" title="Previous month">‹</button>'+
      '<span class="mon">'+MON[m]+' '+y+'</span><button data-nav="'+kind+':1" title="Next month">›</button>'+
      '<button class="today" data-nav="'+kind+':0">Today</button><span class="tot">'+total+' this month</span></div>'+
      '<div class="pd-grid">'+grid+'</div>'+legend+'</div>';
  }
  let POP={heads:[],rows:[],name:'export'};
  function openDay(kind, day){
    const ref=kind==='arr'?ARR_REF:APT_REF; const y=ref.getFullYear(), m=ref.getMonth();
    if(kind!=='arr' && isPast(y,m,day)) return;
    const map=kind==='arr'?arrivalsByDay(y,m):apptsByDay(y,m);
    const items=map[day]||[]; if(!items.length) return;
    const dateLabel=day+' '+MON[m]+' '+y;
    reparentModals();
    if(kind==='arr'){
      const heads=['Name','Passport','Nationality','Position','Client','Agency','Stage','Status'];
      const rows=items.map(c=>[c.name||'',c.passport||'',c.nationality||'',c.position||'',c.client||'',c.agency||'',c.stage||'', arrivedKsa(c)?'Arrived':'For Deployment']);
      $('pdCalBody').innerHTML='<table><thead><tr>'+heads.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+
        rows.map(r=>'<tr>'+r.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
      POP={heads,rows,name:'ARRIVALS '+dateLabel};
      $('pdCalTitle').textContent='Arrivals — '+dateLabel+' ('+items.length+')';
    } else {
      const heads=['Type','Name','Passport','Nationality','Client','Agency','Stage'];
      const rows=items.map(it=>[it.type,it.c.name||'',it.c.passport||'',it.c.nationality||'',it.c.client||'',it.c.agency||'',it.c.stage||'']);
      $('pdCalBody').innerHTML='<table><thead><tr>'+heads.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+
        items.map(it=>'<tr><td><span class="tag" style="background:'+it.color+'22;color:'+it.color+'">'+esc(it.type)+'</span></td>'+
          '<td>'+esc(it.c.name||'')+'</td><td>'+esc(it.c.passport||'')+'</td><td>'+esc(it.c.nationality||'')+'</td>'+
          '<td>'+esc(it.c.client||'')+'</td><td>'+esc(it.c.agency||'')+'</td><td>'+esc(it.c.stage||'')+'</td></tr>').join('')+'</tbody></table>';
      POP={heads,rows,name:'APPOINTMENTS '+dateLabel};
      $('pdCalTitle').textContent='Appointments — '+dateLabel+' ('+items.length+')';
    }
    $('pdCalPop').classList.add('open');
  }
  $('pdCalClose').addEventListener('click',()=>$('pdCalPop').classList.remove('open'));
  $('pdCalPop').addEventListener('click',(e)=>{ if(e.target===$('pdCalPop')) $('pdCalPop').classList.remove('open'); });
  $('pdCalExport').addEventListener('click',()=>exportRows(POP.heads,POP.rows,POP.name,'Detail',POP.name+'.xlsx'));

  /* ---------- layout: calendars after tiles, leaderboard after calendars ---------- */
  function body(){ return $('ceoDashBody'); }
  function homeVisible(){ const b=body(); return b && !!b.querySelector('.ceo-tile') && !b.querySelector('#ceoBack'); }
  function findSection(re){ const b=body(); if(!b) return null; return [...b.querySelectorAll('.ceo-sec')].find(s=>{const h=s.querySelector('h3'); return h&&re.test((h.textContent||'').trim());})||null; }

  function renderCalendars(force){
    const b=body(); if(!b) return;
    const tiles=b.querySelector('.ceo-tiles'); if(!tiles) return;
    let sec=$('pdCalSec');
    if(!sec){ sec=document.createElement('div'); sec.className='ceo-sec'; sec.id='pdCalSec'; force=true; }
    if(sec.previousElementSibling!==tiles){ tiles.parentNode.insertBefore(sec, tiles.nextSibling); force=true; }
    const sig=ARR_REF.getFullYear()+'-'+ARR_REF.getMonth()+'|'+APT_REF.getFullYear()+'-'+APT_REF.getMonth()+'|'+cases().length;
    if(!force && sec.dataset.sig===sig) return;
    sec.dataset.sig=sig;
    sec.innerHTML='<h3>Schedule — Arrivals &amp; Government Appointments</h3>'+
      '<div class="pd-cals">'+calHtml('arr',ARR_REF)+calHtml('apt',APT_REF)+'</div>';
  }
  function renderLeaderboard(force){
    const sec=findSection(/client leaderboard/i); if(!sec) return;
    const cal=$('pdCalSec');
    /* move it to sit directly AFTER the Schedule section */
    if(cal && sec.previousElementSibling!==cal){ cal.parentNode.insertBefore(sec, cal.nextSibling); force=true; }
    const sig='lb393|'+cases().length;
    if(!force && sec.dataset.sig===sig) return;
    sec.dataset.sig=sig;
    const h3=sec.querySelector('h3')||document.createElement('h3');
    sec.innerHTML=''; sec.appendChild(h3);
    h3.innerHTML='Client Leaderboard <span class="sub">Pipeline standing by client &amp; stage</span><span class="sp"></span><button class="ceo-xbtn" id="pdLbExport">Export Excel</button>';
    sec.insertAdjacentHTML('beforeend', leaderboardHtml());
    const b=$('pdLbExport');
    if(b) b.addEventListener('click',()=>{ const rows=leaderboard();
      exportRows(['Client','Offers Sent','Offers Signed','Medical In Progress','Medical Completed','SVP/QVP In Progress','SVP/QVP Completed','Biometrics In Progress','Visa Stamped','Withdrawn','Unfit','Unresponsive','Mobilization','Active','Total','Accomplished %'],
        rows.map(r=>[r.client,r.offSent,r.offSigned,r.medIn,r.medDone,r.svpIn,r.svpDone,r.bioIn,r.stamped,r.withdrawn,r.unfit,r.unresp,r.mobilization,r.active,r.total,r.acc]),
        'CLIENT LEADERBOARD','Leaderboard','CLIENT LEADERBOARD.xlsx'); });
  }

  document.addEventListener('click',(e)=>{
    const nav=e.target.closest&&e.target.closest('[data-nav]');
    if(nav){ const p=nav.dataset.nav.split(':'); const kind=p[0], d=parseInt(p[1],10);
      if(kind==='arr') ARR_REF = d===0 ? new Date() : new Date(ARR_REF.getFullYear(), ARR_REF.getMonth()+d, 1);
      else APT_REF = d===0 ? new Date() : new Date(APT_REF.getFullYear(), APT_REF.getMonth()+d, 1);
      renderCalendars(true); return; }
    const day=e.target.closest&&e.target.closest('.pd-day[data-day]');
    if(day) openDay(day.dataset.cal, parseInt(day.dataset.day,10));
  }, false);

  function tick(){
    reparentModals(); ensureData();
    patchTilesAndSummary(false);
    if(!homeVisible()) return;
    renderCalendars(false); renderLeaderboard(false);
  }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('ceo.v393', tick, 1200); }
  else { setInterval(tick, 1200); }
  setTimeout(tick, 400); setTimeout(tick, 1500);

  window._entCEOv393={ metrics, leaderboard, occurred, future, arrivedKsa, mobilized, forDeployment };
  console.log('%c📅 CEO Dashboard v'+V+' — leaderboard after Schedule · Mobilization column · arrivals only count once the date is reached (future = For Deployment)','color:#2F5A3B;font-weight:bold;');
})();

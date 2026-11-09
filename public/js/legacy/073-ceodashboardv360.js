
(function CEODashboardV360(){
  'use strict';
  if(window.__entCEOv360) return; window.__entCEOv360=true;
  const V='3.6.0';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const num=(x)=>{const n=parseFloat(String(x).replace(/[^0-9.\-]/g,''));return isNaN(n)?0:n;};
  const nowIso=()=>new Date().toISOString();
  const log=(...a)=>console.log('%c[CEO v3.6.0]','color:#2F5A3B;font-weight:bold',...a);
  const Toast=()=>window.Toast||{ok:console.log,warn:console.warn,err:console.error,info:console.info};

  /* ===================== DATA SOURCE (zeros fix) ===================== */
  let DASH_DB=null, AUTH_FAIL='';
  const DB=()=>DASH_DB||window.DB||{};
  const cases=()=>DB().recruitmentCases||[];
  const visas=()=>DB().visaRecords||[];
  const ceoCasesRead=()=>DB().ceoCases||[];
  const campaignsRead=()=>DB().campaigns||[];

  function waitAuth(timeoutMs){
    return new Promise(resolve=>{
      if(typeof firebase==='undefined'||!firebase.auth){ resolve(null); return; }
      const cur=firebase.auth().currentUser; if(cur){ resolve(cur); return; }
      let done=false;
      const un=firebase.auth().onAuthStateChanged(u=>{ if(done) return; done=true; try{un();}catch(e){} resolve(u||null); });
      setTimeout(()=>{ if(done) return; done=true; try{un();}catch(e){} resolve(firebase.auth().currentUser||null); }, timeoutMs||4000);
    });
  }
  async function ensureAuth(){
    if(typeof firebase==='undefined'||!firebase.auth) return null;
    let u=await waitAuth(4000);
    if(u && !u.isAnonymous) return u;
    AUTH_FAIL='Sign in with an approved account to view this dashboard.';
    return null;
  }
  async function fetchFullDB(){
    AUTH_FAIL='';
    try{
      if(typeof firebase==='undefined'||!firebase.database){ AUTH_FAIL='Firebase not available on this page.'; return null; }
      const u=await ensureAuth();
      if(!u){ if(!AUTH_FAIL) AUTH_FAIL='Not signed in — the database could not be read.'; return null; }
      const s=await firebase.database().ref('safwat/databases/main').once('value');
      const v=s.val(); const data=(v&&v.data)?v.data:v;
      if(data&&(Array.isArray(data.recruitmentCases)||Array.isArray(data.visaRecords))) return data;
      AUTH_FAIL='The database snapshot was empty or unreadable.'; return null;
    }catch(e){ AUTH_FAIL='Read blocked: '+(e&&e.message||e); log(AUTH_FAIL); return null; }
  }

  /* ===================== MODEL ===================== */
  const AMERICANA=(c)=>upc(c).includes('AMERICANA');
  const ONDEMAND=(c)=>{ const u=upc(c); return u.includes('ON DEMAND')||u.includes('ON-DEMAND')||u.includes('SAFWAHR')||u.includes('SAFWA HR'); };
  function projectOf(client){ if(AMERICANA(client)) return 'AMERICANA'; if(ONDEMAND(client)) return 'ONDEMAND'; return 'OTHER'; }
  const PROJECTS=[{key:'AMERICANA',label:'AMERICANA'},{key:'ONDEMAND',label:'SAFWAHR (On-Demand)'},{key:'OTHER',label:'Other Clients'}];
  const projLabel=(k)=>{ const p=PROJECTS.find(x=>x.key===k); return p?p.label:k; };
  const STAGE_ORDER={'PENDING OFFER LETTER':0,'OFFER SIGNING':1,'FOR MEDICAL APPOINTMENT':2,'MEDICAL ON PROGRESS':3,'FOR SKILLS VERIFICATION APPOINTMENT':4,'SVP/QVP ON PROGRESS':5,'FOR BIOMETRICS APPOINTMENT':6,'BIOMETRICS IN PROGRESS AND CONSULAR SUBMISSION':7,'VISA ISSUED':8,'FOR DEPLOYMENT':8,'READY FOR TRAVEL':8,'DEPLOYED':9};
  const ATTRITION=new Set(['WITHDRAWN/BACKOUT','UNFIT','REJECTED','CANCELLED','AWOL','TERMINATED','END OF SERVICE','UNRESPONSIVE']);
  const HOLD=new Set(['ON HOLD']);
  const stageIdx=(s)=>{ const u=upc(s); return (u in STAGE_ORDER)?STAGE_ORDER[u]:-1; };
  const has=(v)=>v!=null&&String(v).trim()!=='';
  const TYPES={LOCAL_TRANSFER:'Local Transfer',OVERSEAS_ENDORSED:'Overseas – Endorsed',OVERSEAS_SOURCED:'Overseas – Sourced'};
  function isForDeployment(c){ const u=upc(c.stage); if(u==='DEPLOYED') return false; return u.includes('FOR DEPLOYMENT')||u==='VISA ISSUED'||u.includes('READY FOR TRAVEL'); }
  function isInProcess(c){ const u=upc(c.stage); return !ATTRITION.has(u)&&u!=='DEPLOYED'; }
  const deployDate=(c)=>{ for(const k of ['deploymentDate','expectedDeploymentDate','dateDeployment','dateArrivalKsa','dateWorkStarted']){ if(has(c[k])) return c[k]; } return ''; };

  function computeExec(list){
    const m={total:list.length,underProcess:0,selected:0,awaitingVisa:0,forDeployment:0,arrivedKsa:0,arrivedAcc:0,started:0,delayed:0};
    list.forEach(c=>{ const u=upc(c.stage),idx=stageIdx(u); if(ATTRITION.has(u)) return; if(HOLD.has(u)) m.delayed++;
      const started=u==='DEPLOYED'||has(c.dateWorkStarted); if(started) m.started++;
      if(has(c.dateArrivedAccommodation)) m.arrivedAcc++; if(has(c.dateArrivalKsa)) m.arrivedKsa++;
      if(isForDeployment(c)) m.forDeployment++; if(idx>=6&&idx<=7) m.awaitingVisa++; if(idx>=2) m.selected++; if(idx>=0&&idx<=7) m.underProcess++; });
    return m;
  }
  const projListFor=(key)=>cases().filter(c=>projectOf(c.client)===key);
  const delayedFor=(key)=>ceoCasesRead().filter(x=>projectOf(x.client)===key&&(upc(x.status).includes('DELAY')||num(x.delayDays)>0));
  const campaignsFor=(key)=>campaignsRead().filter(x=>projectOf(x.client)===key);
  function statusLight(exec,del){ const denom=exec.total||1; const r=(exec.delayed+del)/denom; if(r>=0.20) return {cls:'r',label:'Requires Intervention'}; if(r>=0.08) return {cls:'y',label:'Requires Follow-up'}; return {cls:'g',label:'Stable'}; }

  /* ---------- NEW aggregations (validated) ---------- */
  function crStatus(){
    const g={};
    visas().forEach(v=>{ const k=(v.crNumber||'—')+'|'+(v.sponsorId||'—');
      if(!g[k]) g[k]={cr:v.crNumber||'—',sid:v.sponsorId||'—',used:0,unused:0,allocated:0,expired:0,cancelled:0,total:0};
      const s=upc(v.statusVisa); g[k].total++;
      if(s==='USED')g[k].used++; else if(s==='UNUSED')g[k].unused++; else if(s==='ALLOCATED')g[k].allocated++; else if(s==='EXPIRED')g[k].expired++; else if(s==='CANCELLED')g[k].cancelled++; });
    return Object.values(g).map(r=>({...r,util:r.total?Math.round(r.used/r.total*100):0})).sort((a,b)=>b.total-a.total);
  }
  const BKEY=(v)=>[v.visaDocumentNumber||'',v.sponsorId||'',upc(v.nationality),upc(v.stampingCity),upc(v.gender),upc(v.client),upc(v.visaCategory),upc(v.registeredAgencyName)].join('|');
  function visaBlocks(statusFilter){
    const m={};
    visas().forEach(v=>{ const s=upc(v.statusVisa);
      if(statusFilter && statusFilter!=='ALL'){ if(statusFilter==='UNUSED+ALLOCATED'){ if(s!=='UNUSED'&&s!=='ALLOCATED') return; } else if(s!==statusFilter) return; }
      const k=BKEY(v);
      if(!m[k]) m[k]={doc:v.visaDocumentNumber||'—',sid:v.sponsorId||'—',nat:v.nationality||'—',city:v.stampingCity||'—',gender:v.gender||'—',project:v.client||'—',cat:v.visaCategory||'—',agency:v.registeredAgencyName||'—',used:0,unused:0,allocated:0,expired:0,cancelled:0,total:0};
      m[k].total++;
      if(s==='USED')m[k].used++; else if(s==='UNUSED')m[k].unused++; else if(s==='ALLOCATED')m[k].allocated++; else if(s==='EXPIRED')m[k].expired++; else if(s==='CANCELLED')m[k].cancelled++; });
    return Object.values(m).sort((a,b)=>String(a.doc).localeCompare(String(b.doc)));
  }
  function leaderboard(){
    const g={};
    cases().forEach(c=>{ const k=c.client||'(Unspecified)';
      if(!g[k]) g[k]={client:k,offersSent:0,offersSigned:0,medIn:0,svpIn:0,bioIn:0,stamped:0,withdrawn:0,unfit:0,unresp:0,mobilized:0,active:0,total:0};
      const s=upc(c.stage); g[k].total++;
      if(s==='PENDING OFFER LETTER')g[k].offersSent++;
      if(s==='OFFER SIGNING')g[k].offersSigned++;
      if(s.includes('MEDICAL'))g[k].medIn++;
      if(s.includes('SVP')||s.includes('SKILLS VERIFICATION'))g[k].svpIn++;
      if(s.includes('BIOMETRIC'))g[k].bioIn++;
      if(s==='VISA ISSUED'||isForDeployment(c))g[k].stamped++;
      if(s==='WITHDRAWN/BACKOUT')g[k].withdrawn++;
      if(s==='UNFIT')g[k].unfit++;
      if(s==='UNRESPONSIVE')g[k].unresp++;
      if(s==='DEPLOYED'||has(c.dateWorkStarted))g[k].mobilized++;
      if(!ATTRITION.has(s)&&s!=='DEPLOYED')g[k].active++; });
    return Object.values(g).map(r=>({...r,acc:r.total?Math.round(r.mobilized/r.total*100):0})).sort((a,b)=>b.total-a.total);
  }
  function chartByType(){ const g={}; cases().forEach(c=>{ const t=TYPES[c.recruitmentType]||'Unspecified'; g[t]=(g[t]||0)+1; }); return g; }
  function chartStageCat(){ const g={'Deployed / Visa Issued':0,'Active / In Progress':0,'Cancelled / Withdrawn / Rejected':0};
    cases().forEach(c=>{ const s=upc(c.stage); if(ATTRITION.has(s)) g['Cancelled / Withdrawn / Rejected']++; else if(s==='DEPLOYED'||s==='VISA ISSUED') g['Deployed / Visa Issued']++; else g['Active / In Progress']++; }); return g; }
  function topN(field,n){ const g={}; cases().forEach(c=>{ const k=upc(c[field])||'UNSPECIFIED'; g[k]=(g[k]||0)+1; });
    const arr=Object.entries(g).sort((a,b)=>b[1]-a[1]); const top=arr.slice(0,n); const rest=arr.slice(n).reduce((s,x)=>s+x[1],0); if(rest>0) top.push(['OTHER',rest]); return top; }

  /* ===================== XLSX (validated pattern) ===================== */
  const CRCT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}return t;})();
  function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRCT[(c^b[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
  function sbb(s){return new TextEncoder().encode(s);}
  function ccx(a){let l=0;a.forEach(x=>l+=x.length);const o=new Uint8Array(l);let p=0;a.forEach(x=>{o.set(x,p);p+=x.length;});return o;}
  function u16(n){return new Uint8Array([n&0xFF,(n>>>8)&0xFF]);} function u32(n){return new Uint8Array([n&0xFF,(n>>>8)&0xFF,(n>>>16)&0xFF,(n>>>24)&0xFF]);}
  function zipx(files){const L=[],C=[];let off=0;files.forEach(f=>{const nb=sbb(f.name),crc=crc32(f.data),sz=f.data.length;const loc=ccx([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(sz),u32(sz),u16(nb.length),u16(0),nb,f.data]);L.push(loc);C.push(ccx([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(sz),u32(sz),u16(nb.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off),nb]));off+=loc.length;});const cs=off,cb=ccx(C);const eo=ccx([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cb.length),u32(cs),u16(0)]);return ccx([ccx(L),cb,eo]);}
  function xesc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c]);}
  function xcol(n){let s='';n++;while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26);}return s;}
  function sheetXml(heads,rows){const nc=heads.length;const cell=(r,c,v)=>'<c r="'+xcol(c)+r+'" t="inlineStr"><is><t xml:space="preserve">'+xesc(v)+'</t></is></c>';let body='<row r="1">'+heads.map((h,c)=>cell(1,c,h)).join('')+'</row>';let r=2;rows.forEach(row=>{body+='<row r="'+r+'">'+heads.map((h,c)=>cell(r,c,row[c]==null?'':row[c])).join('')+'</row>';r++;});const lc=xcol(nc-1);return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>'+body+'</sheetData><autoFilter ref="A1:'+lc+Math.max(1,rows.length+1)+'"/></worksheet>';}
  function buildXlsx(heads,rows,sheetName){sheetName=(sheetName||'Sheet1').slice(0,31);const ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>';const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';const wb='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'+xesc(sheetName)+'" sheetId="1" r:id="rId1"/></sheets></workbook>';const wbr='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';return zipx([{name:'[Content_Types].xml',data:sbb(ct)},{name:'_rels/.rels',data:sbb(rels)},{name:'xl/workbook.xml',data:sbb(wb)},{name:'xl/_rels/workbook.xml.rels',data:sbb(wbr)},{name:'xl/worksheets/sheet1.xml',data:sbb(sheetXml(heads,rows))}]);}
  function download(blob,filename){
    try{ if(window.navigator&&window.navigator.msSaveOrOpenBlob){ window.navigator.msSaveOrOpenBlob(blob,filename); return; } }catch(e){}
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=filename; a.rel='noopener'; a.style.position='fixed'; a.style.left='-9999px';
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    setTimeout(()=>{ try{document.body.removeChild(a);}catch(e){} URL.revokeObjectURL(url); },1500);
  }
  function exportSheet(heads,rows,sheet,file){
    try{ download(new Blob([buildXlsx(heads,rows,sheet)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), file); Toast().ok('Exported', rows.length+' row(s)'); }
    catch(e){ Toast().err('Export failed', e.message); }
  }

  /* ===================== chart helpers (CSS/SVG) ===================== */
  const PALETTE=['#2E6FA3','#3F6C4D','#B98A2E','#A23B2E','#6B6558','#8C6A22','#4A5560','#7E9CB8'];
  function donut(title, map, centerLabel){
    const entries=Object.entries(map).filter(([k,v])=>v>0);
    const total=entries.reduce((s,[,v])=>s+v,0);
    if(!total) return '<div class="ceo-chart"><h4>'+esc(title)+'</h4><div class="ceo-empty">No data.</div></div>';
    let acc=0; const stops=entries.map(([k,v],i)=>{ const from=acc/total*100; acc+=v; const to=acc/total*100; return PALETTE[i%PALETTE.length]+' '+from.toFixed(2)+'% '+to.toFixed(2)+'%'; }).join(', ');
    const legend=entries.map(([k,v],i)=>'<div class="li"><span class="sw" style="background:'+PALETTE[i%PALETTE.length]+'"></span><span>'+esc(k)+'</span><span class="val">'+v+'</span></div>').join('');
    return '<div class="ceo-chart"><h4>'+esc(title)+'</h4><div class="donut-wrap">'+
      '<div class="donut" style="background:conic-gradient('+stops+')"><div class="mid"><b>'+total+'</b><span>'+esc(centerLabel||'total')+'</span></div></div>'+
      '<div class="legend">'+legend+'</div></div></div>';
  }
  function bars(title, pairs, color){
    if(!pairs.length) return '<div class="ceo-chart"><h4>'+esc(title)+'</h4><div class="ceo-empty">No data.</div></div>';
    const max=Math.max.apply(null,pairs.map(p=>p[1]))||1;
    const rows=pairs.map(([k,v])=>'<div class="barrow"><span class="lbl" title="'+esc(k)+'">'+esc(k)+'</span><span class="bartrack"><span class="barfill" style="width:'+Math.max(2,Math.round(v/max*100))+'%;background:'+color+'"></span></span><span class="n">'+v+'</span></div>').join('');
    return '<div class="ceo-chart"><h4>'+esc(title)+'</h4><div class="barchart">'+rows+'</div></div>';
  }

  /* ===================== HOME ===================== */
  let vupbStatus='ALL', vupbSearch='';
  function renderHome(){
    const body=$('ceoDashBody');
    const perProj=PROJECTS.map(p=>{ const list=projListFor(p.key); const exec=computeExec(list); const del=delayedFor(p.key).length; return {p,exec,del,light:statusLight(exec,del)}; });
    const worst=perProj.reduce((a,x)=>{ const rank={g:0,y:1,r:2}; return rank[x.light.cls]>rank[a.cls]?x.light:a; },{cls:'g',label:'Stable'});
    const authWarn = (!cases().length&&!visas().length)
      ? '<div id="ceoAuthWarn" class="show">⚠ No data could be read'+(AUTH_FAIL?(' — '+esc(AUTH_FAIL)):'')+'. Ask an administrator to confirm this account can read the database, then press ↻ Refresh.</div>'
      : '<div id="ceoAuthWarn"></div>';

    /* ---- Status per CR ---- */
    const cr=crStatus();
    const crTot=cr.reduce((t,r)=>{['used','unused','allocated','expired','cancelled','total'].forEach(k=>t[k]+=r[k]);return t;},{used:0,unused:0,allocated:0,expired:0,cancelled:0,total:0});
    const crHtml='<div class="ceo-sec"><h3>Status per Commercial Registration'+
      '<span class="sub">Visa standing per CR # &amp; Sponsor ID</span><span class="sp"></span>'+
      '<button class="ceo-xbtn" id="ceoExpCR">Export Excel</button></h3>'+
      (cr.length?('<div class="ceo-scrollbox"><table class="ceo-t"><thead><tr><th>CR #</th><th>Sponsor ID</th><th class="r">Used</th><th class="r">Unused</th><th class="r">Allocated</th><th class="r">Expired</th><th class="r">Cancelled</th><th class="r">Total</th><th class="r">Utilization</th></tr></thead><tbody>'+
        cr.map(r=>'<tr><td style="font-family:monospace">'+esc(r.cr)+'</td><td style="font-family:monospace">'+esc(r.sid)+'</td>'+
        '<td class="r"><span class="chip used">'+r.used+'</span></td><td class="r"><span class="chip unused">'+r.unused+'</span></td><td class="r"><span class="chip alloc">'+r.allocated+'</span></td>'+
        '<td class="r"><span class="chip exp">'+r.expired+'</span></td><td class="r"><span class="chip canc">'+r.cancelled+'</span></td><td class="r"><span class="chip total">'+r.total+'</span></td><td class="r">'+r.util+'%</td></tr>').join('')+
        '</tbody><tfoot><tr><td colspan="2">TOTAL ('+cr.length+' CR)</td><td class="r">'+crTot.used+'</td><td class="r">'+crTot.unused+'</td><td class="r">'+crTot.allocated+'</td><td class="r">'+crTot.expired+'</td><td class="r">'+crTot.cancelled+'</td><td class="r">'+crTot.total+'</td><td class="r">'+(crTot.total?Math.round(crTot.used/crTot.total*100):0)+'%</td></tr></tfoot></table></div>')
        :'<div class="ceo-empty">No visa records.</div>')+'</div>';

    /* ---- VUPB ---- */
    let blocks=visaBlocks(vupbStatus);
    if(vupbSearch){ const q=upc(vupbSearch); blocks=blocks.filter(b=>upc([b.doc,b.sid,b.nat,b.city,b.gender,b.project,b.cat,b.agency].join(' ')).includes(q)); }
    const vTot=blocks.reduce((t,b)=>{['used','unused','allocated','expired','cancelled','total'].forEach(k=>t[k]+=b[k]);return t;},{used:0,unused:0,allocated:0,expired:0,cancelled:0,total:0});
    const vupbHtml='<div class="ceo-sec"><h3>Visa Usage per Block'+
      '<span class="sub">Every visa block with its current standing</span><span class="sp"></span>'+
      '<button class="ceo-xbtn" id="ceoExpVUPB">Export Excel</button></h3>'+
      '<div class="ceo-tools">'+
        '<select id="ceoVupbStatus">'+['ALL','UNUSED+ALLOCATED','USED','UNUSED','ALLOCATED','EXPIRED','CANCELLED'].map(s=>'<option value="'+s+'"'+(s===vupbStatus?' selected':'')+'>'+(s==='ALL'?'All statuses':s==='UNUSED+ALLOCATED'?'Unused + Allocated':s.charAt(0)+s.slice(1).toLowerCase())+'</option>').join('')+'</select>'+
        '<input id="ceoVupbSearch" type="text" placeholder="Search blocks (doc, sponsor, nationality, category, agency…)" value="'+esc(vupbSearch)+'">'+
        '<span class="ceo-count">'+blocks.length+' block(s) · '+vTot.total+' visas</span>'+
      '</div>'+
      (blocks.length?('<div class="ceo-scrollbox"><table class="ceo-t"><thead><tr><th>Doc #</th><th>Sponsor ID</th><th>Nationality</th><th>Stamping City</th><th>Gender</th><th>Project</th><th>Visa Category</th><th>Agency</th><th class="r">Used</th><th class="r">Unused</th><th class="r">Allocated</th><th class="r">Expired</th><th class="r">Cancelled</th><th class="r">Total</th></tr></thead><tbody>'+
        blocks.slice(0,500).map(b=>'<tr><td style="font-family:monospace">'+esc(b.doc)+'</td><td style="font-family:monospace">'+esc(b.sid)+'</td><td>'+esc(b.nat)+'</td><td>'+esc(b.city)+'</td><td>'+esc(b.gender)+'</td><td>'+esc(b.project)+'</td><td>'+esc(b.cat)+'</td><td>'+esc(b.agency)+'</td>'+
        '<td class="r"><span class="chip used">'+b.used+'</span></td><td class="r"><span class="chip unused">'+b.unused+'</span></td><td class="r"><span class="chip alloc">'+b.allocated+'</span></td><td class="r"><span class="chip exp">'+b.expired+'</span></td><td class="r"><span class="chip canc">'+b.cancelled+'</span></td><td class="r"><span class="chip total">'+b.total+'</span></td></tr>').join('')+
        '</tbody><tfoot><tr><td colspan="8" style="text-align:right">TOTAL</td><td class="r">'+vTot.used+'</td><td class="r">'+vTot.unused+'</td><td class="r">'+vTot.allocated+'</td><td class="r">'+vTot.expired+'</td><td class="r">'+vTot.cancelled+'</td><td class="r">'+vTot.total+'</td></tr></tfoot></table></div>'+
        (blocks.length>500?'<div class="ceo-empty">Showing first 500 of '+blocks.length+' — refine the search or export for the full list.</div>':''))
        :'<div class="ceo-empty">No blocks match the current filter.</div>')+'</div>';

    /* ---- tiles ---- */
    const tiles='<div class="ceo-tiles">'+perProj.map(x=>{ const e=x.exec; return '<div class="ceo-tile" data-proj="'+x.p.key+'"><div class="name">'+esc(x.p.label)+'<span class="light"><span class="ceo-dot '+x.light.cls+'"></span></span></div>'+
      '<div class="kpis"><div class="k"><b>'+e.total+'</b><span>Total</span></div><div class="k"><b>'+e.underProcess+'</b><span>Under Process</span></div><div class="k"><b>'+e.started+'</b><span>Started Work</span></div><div class="k"><b>'+(e.delayed+x.del)+'</b><span>Delayed</span></div></div>'+
      '<div class="hint">Click to open the detailed report →</div></div>'; }).join('')+'</div>';

    /* ---- overall performance ---- */
    let perf='<div class="ceo-sec"><h3>Overall Performance Indicators</h3><table class="ceo-t"><thead><tr><th>Indicator</th>'+PROJECTS.map(p=>'<th class="r">'+esc(p.label)+'</th>').join('')+'<th class="r">Total</th></tr></thead><tbody>';
    [['Total Requirement','total'],['Selected Candidates','selected'],['Under Process','underProcess'],['Awaiting Visas','awaitingVisa'],['For Deployment','forDeployment'],['Arrived in Saudi Arabia','arrivedKsa'],['Arrived at Safwa Accommodation','arrivedAcc'],['Started Work','started'],['Delayed Cases','delayed']]
      .forEach(([label,key])=>{ let tot=0; perf+='<tr><td>'+label+'</td>'+perProj.map(x=>{ let v=x.exec[key]; if(key==='delayed') v+=x.del; tot+=v; return '<td class="r">'+v+'</td>'; }).join('')+'<td class="r">'+tot+'</td></tr>'; });
    const allExec=computeExec(cases()); const completion=allExec.total?Math.round(allExec.started/allExec.total*100):0;
    perf+='</tbody><tfoot><tr><td>Completion Rate (Started / Total)</td><td class="r" colspan="'+(PROJECTS.length)+'"></td><td class="r">'+completion+'%</td></tr></tfoot></table></div>';

    /* ---- leaderboard ---- */
    const lb=leaderboard();
    const lbHtml='<div class="ceo-sec"><h3>Client Leaderboard'+
      '<span class="sub">Pipeline standing by client</span><span class="sp"></span>'+
      '<button class="ceo-xbtn" id="ceoExpLB">Export Excel</button></h3>'+
      (lb.length?('<div class="ceo-scrollbox"><table class="ceo-t"><thead><tr><th>Client</th><th class="r">Offers Sent</th><th class="r">Signed</th><th class="r">Medical</th><th class="r">SVP/QVP</th><th class="r">Biometrics</th><th class="r">Visa Issued</th><th class="r">Withdrawn</th><th class="r">Unfit</th><th class="r">Mobilized</th><th class="r">Active</th><th class="r">Total</th><th class="r">Accomplished</th></tr></thead><tbody>'+
        lb.map(r=>'<tr><td>'+esc(r.client)+'</td><td class="r">'+r.offersSent+'</td><td class="r">'+r.offersSigned+'</td><td class="r">'+r.medIn+'</td><td class="r">'+r.svpIn+'</td><td class="r">'+r.bioIn+'</td><td class="r">'+r.stamped+'</td><td class="r">'+r.withdrawn+'</td><td class="r">'+r.unfit+'</td><td class="r"><span class="chip used">'+r.mobilized+'</span></td><td class="r">'+r.active+'</td><td class="r"><span class="chip total">'+r.total+'</span></td><td class="r">'+r.acc+'%</td></tr>').join('')+
        '</tbody></table></div>'):'<div class="ceo-empty">No recruitment cases.</div>')+'</div>';

    /* ---- charts ---- */
    const chartsHtml='<div class="ceo-sec"><h3>Recruitment Pipeline — Current Status</h3><div class="ceo-charts">'+
      donut('By Recruitment Type', chartByType(),'cases')+
      donut('By Stage Category', chartStageCat(),'cases')+
      bars('Top Nationalities', topN('nationality',10),'#2E6FA3')+
      bars('Top Positions Requested', topN('position',10),'#8C6A22')+
    '</div></div>';

    body.innerHTML=
      authWarn+
      '<div class="ceo-toplights"><div class="ceo-overall"><h4>Overall Recruitment Department Status</h4>'+
        '<div class="ceo-light"><span class="ceo-dot '+worst.cls+'"></span>'+esc(worst.label)+'</div>'+
        '<div class="note">Derived from delayed / on-hold ratios across all projects. 🟢 Stable · 🟡 Follow-up · 🔴 Intervention. '+
        '<b>'+cases().length+'</b> cases · <b>'+visas().length+'</b> visas loaded.</div></div></div>'+
      crHtml + vupbHtml + tiles + perf + lbHtml + chartsHtml;

    /* wire */
    body.querySelectorAll('.ceo-tile').forEach(t=>t.addEventListener('click',()=>renderProject(t.dataset.proj)));
    const eCR=$('ceoExpCR'); if(eCR) eCR.addEventListener('click',()=>{ const r=crStatus(); exportSheet(['CR #','Sponsor ID','Used','Unused','Allocated','Expired','Cancelled','Total','Utilization %'], r.map(x=>[x.cr,x.sid,x.used,x.unused,x.allocated,x.expired,x.cancelled,x.total,x.util]), 'CR Status','STATUS PER CR.xlsx'); });
    const eV=$('ceoExpVUPB'); if(eV) eV.addEventListener('click',()=>{ let b=visaBlocks(vupbStatus); if(vupbSearch){ const q=upc(vupbSearch); b=b.filter(x=>upc([x.doc,x.sid,x.nat,x.city,x.gender,x.project,x.cat,x.agency].join(' ')).includes(q)); } exportSheet(['Visa Doc #','Sponsor ID','Nationality','Stamping City','Gender','Project','Visa Category','Agency','Used','Unused','Allocated','Expired','Cancelled','Total'], b.map(x=>[x.doc,x.sid,x.nat,x.city,x.gender,x.project,x.cat,x.agency,x.used,x.unused,x.allocated,x.expired,x.cancelled,x.total]), 'Visa Usage','VISA USAGE PER BLOCK.xlsx'); });
    const eL=$('ceoExpLB'); if(eL) eL.addEventListener('click',()=>{ const r=leaderboard(); exportSheet(['Client','Offers Sent','Signed','Medical','SVP/QVP','Biometrics','Visa Issued','Withdrawn','Unfit','Mobilized','Active','Total','Accomplished %'], r.map(x=>[x.client,x.offersSent,x.offersSigned,x.medIn,x.svpIn,x.bioIn,x.stamped,x.withdrawn,x.unfit,x.mobilized,x.active,x.total,x.acc]), 'Leaderboard','CLIENT LEADERBOARD.xlsx'); });
    const sSel=$('ceoVupbStatus'); if(sSel) sSel.addEventListener('change',()=>{ vupbStatus=sSel.value; renderHome(); });
    const sInp=$('ceoVupbSearch'); if(sInp){ sInp.addEventListener('input',()=>{ vupbSearch=sInp.value; }); sInp.addEventListener('change',()=>{ vupbSearch=sInp.value; renderHome(); }); sInp.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ vupbSearch=sInp.value; renderHome(); } }); }
    $('ceoDashTitle').textContent='PROJECT D — CEO Dashboard';
  }

  /* ===================== PROJECT REPORT ===================== */
  function candView(c){ return { name:c.name||'',passport:c.passport||'',nationality:c.nationality||'',agency:c.agency||'',position:c.position||'',client:c.client||'',deploymentDate:deployDate(c),ksaArrival:c.dateArrivalKsa||'',accArrival:c.dateArrivedAccommodation||'',joining:c.dateWorkStarted||'',stage:c.stage||'' }; }
  const DIM_LABELS={agency:'Agency',nationality:'Nationality',position:'Position',client:'Project / Client'};
  let _flSeq=0;
  function filterableList(views, cols, emptyMsg, dims){
    if(!views.length) return '<div class="ceo-empty">'+esc(emptyMsg||'No records.')+'</div>';
    const uid='fl'+(++_flSeq);
    const opts=(dim)=>[...new Set(views.map(v=>String(v[dim]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    const bar='<div class="ceo-tools" data-fl="'+uid+'">'+dims.map(f=>'<select data-dim="'+f+'"><option value="">'+esc(DIM_LABELS[f]||f)+': All</option>'+opts(f).map(o=>'<option>'+esc(o)+'</option>').join('')+'</select>').join('')+'<span class="ceo-count">'+views.length+' shown</span></div>';
    let t='<div class="ceo-scrollbox"><table class="ceo-t" data-fltable="'+uid+'"><thead><tr>'+cols.map(c=>'<th>'+esc(c[1])+'</th>').join('')+'</tr></thead><tbody>';
    views.forEach(v=>{ const at=dims.map(f=>'data-'+f+'="'+esc(upc(v[f]||''))+'"').join(' '); t+='<tr '+at+'>'+cols.map(c=>'<td>'+esc(v[c[0]]==null?'':v[c[0]])+'</td>').join('')+'</tr>'; });
    return bar+t+'</tbody></table></div>';
  }
  function applyListFilter(bar){ const uid=bar.dataset.fl; const table=$('ceoDashBody').querySelector('table[data-fltable="'+uid+'"]'); if(!table) return; const conds={}; bar.querySelectorAll('select').forEach(s=>{ if(s.value) conds[s.dataset.dim]=upc(s.value); }); let shown=0; table.querySelectorAll('tbody tr').forEach(tr=>{ let ok=true; Object.keys(conds).forEach(f=>{ if((tr.getAttribute('data-'+f)||'')!==conds[f]) ok=false; }); tr.style.display=ok?'':'none'; if(ok)shown++; }); const c=bar.querySelector('.ceo-count'); if(c) c.textContent=shown+' shown'; }
  document.addEventListener('change',(e)=>{ const sel=e.target.closest&&e.target.closest('#ceoDashBody .ceo-tools[data-fl] select'); if(sel) applyListFilter(sel.closest('.ceo-tools')); }, true);
  function plainList(rows, cols, emptyMsg){ if(!rows||!rows.length) return '<div class="ceo-empty">'+esc(emptyMsg||'No records.')+'</div>'; let h='<div class="ceo-scrollbox"><table class="ceo-t"><thead><tr>'+cols.map(c=>'<th>'+esc(c[1])+'</th>').join('')+'</tr></thead><tbody>'; rows.slice(0,300).forEach(r=>{ h+='<tr>'+cols.map(c=>'<td>'+esc(r[c[0]]==null?'':r[c[0]])+'</td>').join('')+'</tr>'; }); return h+'</tbody></table></div>'; }
  const kpiRow=(l,v)=>'<div class="row"><span>'+esc(l)+'</span><b>'+esc(v)+'</b></div>';
  function otherClientsBreakdown(){ const list=cases().filter(c=>projectOf(c.client)==='OTHER'); const g={}; list.forEach(c=>{ const name=c.client||'(Unspecified)'; if(!g[name]) g[name]={client:name,total:0,inProcess:0,selected:0,started:0,delayed:0}; const G=g[name]; G.total++; const u=upc(c.stage),idx=stageIdx(u); if(isInProcess(c))G.inProcess++; if(!ATTRITION.has(u)&&idx>=2)G.selected++; if(u==='DEPLOYED'||has(c.dateWorkStarted))G.started++; if(HOLD.has(u))G.delayed++; }); return Object.values(g).filter(x=>x.inProcess>0).sort((a,b)=>b.inProcess-a.inProcess); }

  function renderProject(key){
    const proj=PROJECTS.find(p=>p.key===key); const list=projListFor(key); const exec=computeExec(list); const del=delayedFor(key); const light=statusLight(exec,del.length);
    const dims=(key==='OTHER')?['agency','nationality','position','client']:['agency','nationality','position'];
    let html='<button class="ceo-back" id="ceoBack">← Back to overview</button><div style="margin:10px 0 4px;"><span class="ceo-light" style="font-size:18px;"><span class="ceo-dot '+light.cls+'"></span>'+esc(proj.label)+' — '+esc(light.label)+'</span></div>';
    if(key==='OTHER'){ const ob=otherClientsBreakdown(); html+='<div class="ceo-sec"><h3>Clients With Active / In-Process Candidates</h3>'+(ob.length?('<div class="ceo-scrollbox"><table class="ceo-t"><thead><tr><th>Client / Project</th><th class="r">In Process</th><th class="r">Selected</th><th class="r">Started</th><th class="r">Delayed</th><th class="r">Total</th></tr></thead><tbody>'+ob.map(o=>'<tr><td>'+esc(o.client)+'</td><td class="r">'+o.inProcess+'</td><td class="r">'+o.selected+'</td><td class="r">'+o.started+'</td><td class="r">'+o.delayed+'</td><td class="r">'+o.total+'</td></tr>').join('')+'</tbody></table></div>'):'<div class="ceo-empty">No other clients currently have in-process candidates.</div>')+'</div>'; }
    html+='<div class="ceo-sec"><h3>Executive Summary</h3><div class="ceo-exec">'+kpiRow('Total Candidates',exec.total)+kpiRow('Candidates Under Process',exec.underProcess)+kpiRow('Selected Candidates',exec.selected)+kpiRow('Awaiting Visas',exec.awaitingVisa)+kpiRow('For Deployment',exec.forDeployment)+kpiRow('Arrived in Saudi Arabia',exec.arrivedKsa)+kpiRow('Arrived at Safwa Accommodation',exec.arrivedAcc)+kpiRow('Joined / Started Work',exec.started)+kpiRow('Delayed Cases',exec.delayed+del.length)+'</div></div>';
    const forDep=list.filter(isForDeployment).map(candView);
    html+='<div class="ceo-sec"><h3>For Deployment</h3>'+filterableList(forDep,[['name','Name'],['passport','Passport'],['nationality','Nationality'],['agency','Agency'],['deploymentDate','Deployment Date']],'No candidates currently For Deployment.',dims)+'</div>';
    const acc=list.filter(c=>has(c.dateArrivedAccommodation)).map(candView);
    html+='<div class="ceo-sec"><h3>Employees Arrived at Safwa Accommodation</h3>'+filterableList(acc,[['name','Name'],['nationality','Country'],['position','Position'],['client','Client'],['accArrival','Accommodation Arrival'],['ksaArrival','KSA Arrival'],['stage','Status']],'No one has arrived at accommodation yet.',dims)+'</div>';
    const started=list.filter(c=>upc(c.stage)==='DEPLOYED'||has(c.dateWorkStarted)).map(candView);
    html+='<div class="ceo-sec"><h3>Employees Who Started Work</h3>'+filterableList(started,[['name','Name'],['nationality','Country'],['position','Position'],['client','Client / Project'],['ksaArrival','Arrival'],['joining','Joining']],'No one has started work yet.',dims)+'</div>';
    html+='<div class="ceo-sec"><h3>Critical Delayed Cases</h3>'+plainList(del,[['country','Country'],['stage','Current Stage'],['delayDays','Delay (days)'],['reason','Reason'],['action','Action Taken'],['owner','Responsible']],'No delayed cases recorded in R-03 for this project.')+'</div>';
    html+='<div class="ceo-sec"><h3>Upcoming Overseas Recruitment Campaigns</h3>'+plainList(campaignsFor(key),[['country','Country'],['positions','Positions'],['requiredQty','Required Qty'],['campaignStatus','Campaign Status'],['visaStatus','Visa Status'],['numVisas','#Visas'],['campaignDate','Campaign Date'],['remarks','Remarks']],'No campaigns recorded in R-04 for this project.')+'</div>';
    $('ceoDashTitle').textContent='PROJECT D — '+proj.label;
    $('ceoDashBody').innerHTML=html;
    $('ceoBack').addEventListener('click', renderHome);
  }

  /* ===================== open / refresh ===================== */
  async function openDashboard(){
    $('ceoDashOv').classList.add('open');
    $('ceoDashBody').innerHTML='<div class="ceo-empty">Connecting &amp; loading live data…</div>';
    const full=await fetchFullDB(); if(full) DASH_DB=full;
    renderHome();
    log('opened (source: '+(DASH_DB?'Firebase':'window.DB')+', cases='+cases().length+', visas='+visas().length+')');
  }
  window._entCEODashboard=openDashboard;
  $('ceoDashClose').addEventListener('click',()=>$('ceoDashOv').classList.remove('open'));
  $('ceoRefresh').addEventListener('click', async()=>{ const full=await fetchFullDB(); if(full) DASH_DB=full; renderHome(); });
  $('ceoDashOv').addEventListener('click',(e)=>{ if(e.target===$('ceoDashOv')&&!document.documentElement.classList.contains('ceo-route')) $('ceoDashOv').classList.remove('open'); });

  /* ===================== R-03 / R-04 grids ===================== */
  const CLIENT_LIST=()=>{ const set=new Set(); (window.DB&&window.DB.recruitmentCases||[]).forEach(c=>{if(c.client)set.add(c.client);}); (window.DB&&window.DB.visaRecords||[]).forEach(v=>{if(v.client)set.add(v.client);}); return [...set].filter(Boolean).sort(); };
  const CASE_COLS=[{f:'client',l:'Client',list:true},{f:'country',l:'Country'},{f:'name',l:'Name'},{f:'position',l:'Position'},{f:'stage',l:'Current Stage'},{f:'status',l:'Status',sel:['','ON TRACK','DELAYED','RESIGNATION','ABSCONDED','RETURNED HOME','TERMINATED','RETURNED TO AGENCY','OTHER']},{f:'joiningDate',l:'Joining Date',date:true},{f:'lastWorkingDate',l:'Last Working Date',date:true},{f:'delayDays',l:'Delay (days)',num:true},{f:'reason',l:'Reason'},{f:'action',l:'Action Taken'},{f:'owner',l:'Responsible'}];
  const CAMP_COLS=[{f:'client',l:'Client',list:true},{f:'country',l:'Country'},{f:'positions',l:'Positions'},{f:'requiredQty',l:'Required Qty',num:true},{f:'campaignStatus',l:'Campaign Status',sel:['','PLANNED','PREPARATION IN PROGRESS','READY','COMPLETED','DELAYED']},{f:'visaStatus',l:'Visa Status',sel:['','AVAILABLE','UNDER ISSUANCE','INCOMPLETE','ISSUE IDENTIFIED']},{f:'numVisas',l:'# Visas',num:true},{f:'campaignDate',l:'Campaign Date',date:true},{f:'remarks',l:'Remarks'}];
  const liveArr=(kind)=>{ window.DB=window.DB||{}; if(kind==='cases'){ window.DB.ceoCases=window.DB.ceoCases||[]; return window.DB.ceoCases; } window.DB.campaigns=window.DB.campaigns||[]; return window.DB.campaigns; };
  let MOD=null;
  function openModule(kind){ if(!window.DB){ Toast().err('Database not open'); return; } MOD={kind,cols:(kind==='cases'?CASE_COLS:CAMP_COLS),title:(kind==='cases'?'R-03 — Cases (post-joining & delayed)':'R-04 — Scheduled Recruitment Campaigns')}; $('ceoModTitle').textContent=MOD.title; let dl=$('ceoClientList'); if(!dl){ dl=document.createElement('datalist'); dl.id='ceoClientList'; document.body.appendChild(dl); } dl.innerHTML=CLIENT_LIST().map(c=>'<option value="'+esc(c)+'">').join(''); $('ceoModGrid').querySelector('thead').innerHTML='<tr><th>#</th>'+MOD.cols.map(c=>'<th>'+esc(c.l)+'</th>').join('')+'<th></th></tr>'; const tb=$('ceoModGrid').querySelector('tbody'); tb.innerHTML=''; const rows=liveArr(kind); if(rows.length){ rows.forEach((r,i)=>tb.insertAdjacentHTML('beforeend', modRow(r,i+1))); } else { for(let i=0;i<5;i++) tb.insertAdjacentHTML('beforeend', modRow(null,i+1)); } $('ceoModOv').classList.add('open'); }
  function modCell(col,rec){ const v=rec?(rec[col.f]==null?'':rec[col.f]):''; if(col.sel) return '<select data-f="'+col.f+'">'+col.sel.map(o=>'<option'+(upc(o)===upc(v)?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select>'; if(col.date) return '<input data-f="'+col.f+'" type="date" value="'+esc(v)+'">'; const list=col.list?' list="ceoClientList"':''; return '<input data-f="'+col.f+'"'+list+' value="'+esc(v)+'">'; }
  function modRow(rec,idx){ const id=rec&&rec.id?rec.id:''; return '<tr data-rec="'+esc(id)+'"><td style="text-align:center;font-family:monospace;color:#8E7F6A;padding:0 6px;">'+idx+'</td>'+MOD.cols.map(c=>'<td>'+modCell(c,rec)+'</td>').join('')+'<td class="rowact"><button type="button" title="Remove">×</button></td></tr>'; }
  $('ceoModGrid').addEventListener('click',(e)=>{ const rm=e.target.closest('.rowact button'); if(rm) rm.closest('tr').remove(); });
  $('ceoModAdd').addEventListener('click',()=>{ const tb=$('ceoModGrid').querySelector('tbody'); tb.insertAdjacentHTML('beforeend', modRow(null, tb.querySelectorAll('tr').length+1)); });
  $('ceoModClose').addEventListener('click',()=>$('ceoModOv').classList.remove('open'));
  $('ceoModOv').addEventListener('click',(e)=>{ if(e.target===$('ceoModOv')) $('ceoModOv').classList.remove('open'); });
  $('ceoModSave').addEventListener('click',()=>{ if(!MOD) return; const arr=liveArr(MOD.kind); const byId={}; arr.forEach(r=>byId[r.id]=r); const kept=[]; let upd=0,ins=0; [...$('ceoModGrid').querySelectorAll('tbody tr')].forEach(tr=>{ const vals={}; MOD.cols.forEach(c=>{ const el=tr.querySelector('[data-f="'+c.f+'"]'); if(el) vals[c.f]=(c.num?num(el.value):el.value); }); const hasAny=Object.values(vals).some(v=>String(v||'').trim()!==''&&String(v)!=='0'); const rid=tr.dataset.rec; if(!rid&&!hasAny) return; if(rid&&byId[rid]){ Object.assign(byId[rid],vals); byId[rid].updatedAt=nowIso(); kept.push(byId[rid]); upd++; } else if(hasAny){ const rec=Object.assign({},vals); rec.id=(MOD.kind==='cases'?'CS-':'CP-')+Date.now().toString(36)+Math.random().toString(36).slice(2,5); rec.createdAt=nowIso(); rec.updatedAt=nowIso(); kept.push(rec); ins++; } }); arr.length=0; kept.forEach(r=>arr.push(r)); if(window.dbSave){ try{ window.dbSave(); }catch(e){} } Toast().ok('Saved', upd+' updated · '+ins+' added'); });

  /* ===================== buttons ===================== */
  function pipelinePanel(){ return $('panel-pipeline')||$('pipelineDashboard'); }
  function ensureButtons(){ const panel=pipelinePanel(); if(!panel||$('ceoOpenDash')) return; const wrap=document.createElement('div'); wrap.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;';
    const b1=document.createElement('button'); b1.id='ceoOpenDash'; b1.className='ceo-btn dash'; b1.textContent='📊 CEO Dashboard'; b1.addEventListener('click', openDashboard);
    const b2=document.createElement('button'); b2.className='ceo-btn mod'; b2.textContent='🗂 Manage Cases (R-03)'; b2.addEventListener('click',()=>openModule('cases'));
    const b3=document.createElement('button'); b3.className='ceo-btn mod'; b3.textContent='📅 Manage Campaigns (R-04)'; b3.addEventListener('click',()=>openModule('campaigns'));
    wrap.appendChild(b1); wrap.appendChild(b2); wrap.appendChild(b3); panel.insertBefore(wrap, panel.firstChild); log('CEO buttons injected'); }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('ceo.buttons', ensureButtons, 900); } else { setInterval(ensureButtons, 900); }
  ensureButtons();
  window._entManageCases=()=>openModule('cases'); window._entManageCampaigns=()=>openModule('campaigns');

  /* ===================== #ceo route ===================== */
  const isCeo=()=>((location.hash||'').toLowerCase().replace(/[^a-z]/g,'')==='ceo');
  let _poll=null,_guard=null,_in=false;
  function routeEnter(){ if(_in) return; _in=true; document.documentElement.classList.add('ceo-route'); const sp=$('ceoSplash'); if(sp) sp.classList.add('show');
    clearInterval(_poll); let tries=0;
    _poll=setInterval(()=>{ tries++;
      if(typeof firebase!=='undefined'&&firebase.database){ clearInterval(_poll); openDashboard().then(()=>{ const s=$('ceoSplash'); if(s) setTimeout(()=>s.classList.remove('show'),150); routeGuard(); }); }
      else if(tries===120){ const s=$('ceoSplash'); if(s) s.querySelector('.s').textContent='Still connecting…'; }
    }, 300); }
  function routeGuard(){ clearInterval(_guard); _guard=setInterval(()=>{ if(!isCeo()) return; document.documentElement.classList.add('ceo-route'); const ov=$('ceoDashOv'); if(ov&&!ov.classList.contains('open')) ov.classList.add('open'); }, 800); }
  window.addEventListener('hashchange',()=>{ if(isCeo()!==document.documentElement.classList.contains('ceo-route')) location.reload(); });
  if(isCeo()) routeEnter(); setTimeout(()=>{ if(isCeo()&&!_in) routeEnter(); },500);

  console.log('%c🏛 CEO Dashboard v'+V+' active — CR status · Visa Usage per Block · Leaderboard · Charts · auth-fixed (no more zeros)','color:#2F5A3B;font-weight:bold;');
})();


(function VUPBExportV2966(){
  'use strict';
  const V='2.9.66';
  const log=(...a)=>console.log('%c[v2.9.66]','color:#2F5A3B;font-weight:bold',...a);
  const num=(s)=>{ const n=parseFloat(String(s).replace(/[^0-9.\-]/g,'')); return isNaN(n)?0:n; };
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const NEAR_DAYS=30;
  const daysUntil=(d,now)=>{ if(!d) return null; const x=new Date(d); if(isNaN(x)) return null; return Math.floor((x-now)/86400000); };

  /* ===== generator (merged nav bar + opens on INDEX) ===== */
// v5: like v4 (freeze/autofilter/2-tint/INDEX/nav bar) BUT nav labels are
// MERGED across columns so full text is visible, and workbook opens on INDEX.
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}return t;})();
function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function sb(s){return new TextEncoder().encode(s);}
function cc(a){let l=0;a.forEach(x=>l+=x.length);const o=new Uint8Array(l);let p=0;a.forEach(x=>{o.set(x,p);p+=x.length;});return o;}
function u16(n){return new Uint8Array([n&0xFF,(n>>>8)&0xFF]);}
function u32(n){return new Uint8Array([n&0xFF,(n>>>8)&0xFF,(n>>>16)&0xFF,(n>>>24)&0xFF]);}
function zip(files){const L=[],C=[];let off=0;files.forEach(f=>{const nb=sb(f.name),crc=crc32(f.data),sz=f.data.length;const loc=cc([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(sz),u32(sz),u16(nb.length),u16(0),nb,f.data]);L.push(loc);C.push(cc([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(sz),u32(sz),u16(nb.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off),nb]));off+=loc.length;});const cs=off,cb=cc(C);const eo=cc([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cb.length),u32(cs),u16(0)]);return cc([cc(L),cb,eo]);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c]);}
function col(n){let s='';n++;while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26);}return s;}
function loc(sheetName){ return "'"+String(sheetName).replace(/'/g,"''")+"'!A1"; }
const FILLS=['none','gray125','FF4F81BD','FF9BBB59','FFF4B942','FFA6A6A6','FFC0504D','FFE36C09','FFFFFFFF','FFFDE0DE','FFFFF2CC','FF1F3864'];
function stylesXml(){
  const fonts=['<font><sz val="10"/><name val="Calibri"/></font>','<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>','<font><b/><sz val="10"/><color rgb="FF222222"/><name val="Calibri"/></font>','<font><b/><sz val="10"/><name val="Calibri"/></font>','<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>','<font><u/><sz val="10"/><color rgb="FF0563C1"/><name val="Calibri"/></font>','<font><b/><u/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'];
  const fills=FILLS.map(f=> f==='none'?'<fill><patternFill patternType="none"/></fill>':f==='gray125'?'<fill><patternFill patternType="gray125"/></fill>':'<fill><patternFill patternType="solid"><fgColor rgb="'+f+'"/><bgColor indexed="64"/></patternFill></fill>');
  const borders=['<border><left/><right/><top/><bottom/><diagonal/></border>','<border><left style="thin"><color rgb="FF808080"/></left><right style="thin"><color rgb="FF808080"/></right><top style="thin"><color rgb="FF808080"/></top><bottom style="thin"><color rgb="FF808080"/></bottom><diagonal/></border>'];
  const X=[[0,0,0,0],[4,2,1,1],[1,2,1,1],[2,3,1,1],[2,4,1,1],[2,5,1,1],[1,6,1,1],[2,3,1,1],[1,7,1,1],[2,8,1,1],[0,8,1,2],[0,8,1,1],[0,9,1,2],[0,9,1,1],[3,8,1,3],[3,8,1,1],[1,7,1,1],[0,10,1,2],[0,10,1,1],[5,8,1,2],[6,11,1,1]];
  const am=['','center','left','right'];
  const xfs=X.map(([fo,fi,bo,al])=>{const a=am[al];const alx=a?'<alignment horizontal="'+a+'" vertical="center"/>':'<alignment vertical="center"/>';return '<xf numFmtId="0" fontId="'+fo+'" fillId="'+fi+'" borderId="'+bo+'" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">'+alx+'</xf>';});
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="'+fonts.length+'">'+fonts.join('')+'</fonts><fills count="'+fills.length+'">'+fills.join('')+'</fills><borders count="'+borders.length+'">'+borders.join('')+'</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="'+xfs.length+'">'+xfs.join('')+'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
}
const HEAD={USED:2,UNUSED:3,ALLOCATED:4,EXPIRED:5,CANCELLED:6,REMAINING:7,TOTAL:8,PLAIN:9};
const BODY={none:{t:10,n:11},red:{t:12,n:13},amber:{t:17,n:18}};
const NUMSET=new Set(['USED','UNUSED','ALLOCATED','EXPIRED','CANCELLED','REMAINING','TOTAL','QUANTITY','COUNT','BLOCKS']);
const NAV=20, IDXLINK=19;
function hs(name){const H=String(name).toUpperCase();return HEAD[H]!=null?HEAD[H]:HEAD.PLAIN;}
function sheetXml(o){
  const heads=o.heads,rows=o.rows,nc=heads.length,upH=heads.map(h=>String(h).toUpperCase());
  const linkCells=o._linkCells||new Set();
  const cell=(r,c,s,v,isN)=>{const ref=col(c)+r;const st=linkCells.has(ref)?IDXLINK:s;return isN?'<c r="'+ref+'" s="'+st+'"><v>'+(v===''?'':v)+'</v></c>':'<c r="'+ref+'" s="'+st+'" t="inlineStr"><is><t xml:space="preserve">'+esc(v)+'</t></is></c>';};
  const hlinks=[]; const navMerges=[];
  let body='';let r=1;let hasNav=false;
  if(o.nav){
    hasNav=true;
    const items=[];
    if(o.nav.index) items.push({t:'\u2302 INDEX', tgt:o.nav.index});
    if(o.nav.prev)  items.push({t:'\u25C0 Prev', tgt:o.nav.prev});
    if(o.nav.next)  items.push({t:'Next \u25B6', tgt:o.nav.next});
    const zones=items.length; const per=Math.max(1,Math.floor(nc/zones));
    let cxml='<row r="1" ht="22" customHeight="1">'; let cIdx=0;
    items.forEach((it,zi)=>{ const start=cIdx; const width=(zi===zones-1)?(nc-start):per; const end=start+width-1;
      for(let c=start;c<=end;c++){ const ref=col(c)+'1'; if(c===start){ cxml+='<c r="'+ref+'" s="'+NAV+'" t="inlineStr"><is><t xml:space="preserve">'+esc(it.t)+'</t></is></c>'; hlinks.push({ref,target:it.tgt}); } else cxml+='<c r="'+ref+'" s="'+NAV+'"/>'; }
      if(end>start) navMerges.push('<mergeCell ref="'+col(start)+'1:'+col(end)+'1"/>');
      cIdx=end+1;
    });
    for(let c=cIdx;c<nc;c++) cxml+='<c r="'+col(c)+'1" s="'+NAV+'"/>';
    cxml+='</row>'; body+=cxml; r++;
  }
  let titleRow=0;
  if(o.title){ titleRow=r; body+='<row r="'+r+'" ht="24" customHeight="1">'+cell(r,0,1,o.title,false); for(let c=1;c<nc;c++) body+='<c r="'+col(c)+r+'" s="1"/>'; if(o.linkTitleTo) hlinks.push({ref:'A'+r,target:o.linkTitleTo,display:o.title}); body+='</row>'; r++; }
  const headerRow=r;
  body+='<row r="'+r+'" ht="20" customHeight="1">'+heads.map((h,c)=>cell(r,c,hs(h),h,false)).join('')+'</row>';r++;
  const firstData=r;
  rows.forEach(row=>{const lvl=(o.levelFn?o.levelFn(row,upH):'')||'';const st=BODY[lvl]||BODY.none;body+='<row r="'+r+'" ht="18" customHeight="1">'+row.map((v,c)=>{const H=upH[c];if(NUMSET.has(H)){const n=parseFloat(String(v).replace(/[^0-9.\-]/g,''));return cell(r,c,st.n,isNaN(n)?'':n,true);}return cell(r,c,st.t,v,false);}).join('')+'</row>';r++;});
  const lastData=r-1;
  let totMerge='';
  if(o.withTotal){const totals=upH.map((H,i)=>NUMSET.has(H)?rows.reduce((s,row)=>{const n=parseFloat(String(row[i]).replace(/[^0-9.\-]/g,''));return s+(isNaN(n)?0:n);},0):'');body+='<row r="'+r+'" ht="20" customHeight="1">'+cell(r,0,14,'TOTAL',false)+'<c r="'+col(1)+r+'" s="14"/>';for(let c=2;c<nc;c++){const H=upH[c];if(NUMSET.has(H)){const st=(H==='TOTAL')?16:15;body+=cell(r,c,st,totals[c]===''?'':totals[c],true);}else body+='<c r="'+col(c)+r+'" s="14"/>';}body+='</row>';totMerge='<mergeCell ref="A'+r+':B'+r+'"/>';r++;}
  const lc=col(nc-1);
  const freezeSplit=o.freeze!==false?headerRow:0;
  const tabSel=o.tabSelected?' tabSelected="1"':'';
  const sheetViews=freezeSplit>0
    ? '<sheetViews><sheetView'+tabSel+' workbookViewId="0"><pane ySplit="'+freezeSplit+'" topLeftCell="A'+firstData+'" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A'+firstData+'" sqref="A'+firstData+'"/></sheetView></sheetViews>'
    : (tabSel?'<sheetViews><sheetView'+tabSel+' workbookViewId="0"/></sheetViews>':'');
  const cols='<cols>'+heads.map((h,i)=>{let w=12;const H=upH[i];if(H==='#')w=5;if(H==='SHEET')w=30;if(H==='CONTENTS')w=48;if(H==='OPEN')w=10;if(H.includes('SPONSOR'))w=14;if(H.includes('CATEGORY')||H.includes('AGENCY')||H.includes('PROJECT')||H.includes('CLIENT')||H.includes('NATIONALITY'))w=22;if(NUMSET.has(H))w=11;if(H.includes('VISA DOC'))w=13;return '<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>';}).join('')+'</cols>';
  const auto=o.autoFilter?'<autoFilter ref="A'+headerRow+':'+lc+(lastData>=firstData?lastData:headerRow)+'"/>':'';
  const mergeParts=[]; if(o.title) mergeParts.push('<mergeCell ref="A'+titleRow+':'+lc+titleRow+'"/>'); if(totMerge) mergeParts.push(totMerge); navMerges.forEach(m=>mergeParts.push(m));
  const merges=mergeParts.length?('<mergeCells count="'+mergeParts.length+'">'+mergeParts.join('')+'</mergeCells>'):'';
  (o.hyperlinks||[]).forEach(h=>hlinks.push(h));
  const hxml=hlinks.length?'<hyperlinks>'+hlinks.map(h=>'<hyperlink ref="'+h.ref+'" location="'+esc(loc(h.target))+'"'+(h.display?(' display="'+esc(h.display)+'"'):'')+'/>').join('')+'</hyperlinks>':'';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+sheetViews+cols+'<sheetData>'+body+'</sheetData>'+auto+merges+hxml+'</worksheet>';
}
function sheetName(name,used){let n=String(name||'Sheet').replace(/[\\\/\?\*\[\]:]/g,' ').trim().slice(0,31)||'Sheet';let base=n,i=2;while(used.has(n.toLowerCase())){const suf=' ('+i+')';n=base.slice(0,31-suf.length)+suf;i++;}used.add(n.toLowerCase());return n;}
function buildWorkbook(sheets,opts){
  opts=opts||{};
  const used=new Set();let named=sheets.map(s=>({...s,name:sheetName(s.name,used)}));
  if(opts.index){
    const idxName=sheetName('INDEX',used);
    const heads=['#','Sheet','Contents','Open'];
    const rows=named.map((s,i)=>[String(i+1),s.name,(s.desc||s.title||''),'Open \u2192']);
    const links=[];const linkCells=new Set();
    named.forEach((s,i)=>{const r=i+3;links.push({ref:'B'+r,target:s.name,display:s.name});links.push({ref:'D'+r,target:s.name,display:'Open'});linkCells.add('B'+r);linkCells.add('D'+r);});
    named.forEach((s,i)=>{s.nav={index:idxName,prev:i>0?named[i-1].name:null,next:i<named.length-1?named[i+1].name:null};s.linkTitleTo=idxName;});
    const idxSheet={name:idxName,title:'INDEX \u2014 click a Sheet to jump. Every sheet has a top nav bar: \u2302 INDEX, \u25C0 Prev, Next \u25B6.',heads,rows,withTotal:false,freeze:true,autoFilter:false,hyperlinks:links,_linkCells:linkCells,tabSelected:true};
    named=[idxSheet,...named];
  }
  const sheetFiles=named.map((s,idx)=>({name:'xl/worksheets/sheet'+(idx+1)+'.xml',data:sb(sheetXml(s))}));
  const ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+named.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
  const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const wb='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0" firstSheet="0"/></bookViews><sheets>'+named.map((s,i)=>'<sheet name="'+esc(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>';
  const wbr='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+named.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rId'+(named.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const files=[{name:'[Content_Types].xml',data:sb(ct)},{name:'_rels/.rels',data:sb(rels)},{name:'xl/workbook.xml',data:sb(wb)},{name:'xl/_rels/workbook.xml.rels',data:sb(wbr)},{name:'xl/styles.xml',data:sb(stylesXml())},...sheetFiles];
  return zip(files);
}



  function dl(bytes,name){ const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url); }
  function headingEl(rx){ return [...document.querySelectorAll('h1,h2,h3,h4,div,span')].find(x=>rx.test((x.textContent||'').trim())&&x.children.length<=3&&x.getBoundingClientRect().height<80); }
  function cardOf(h){ if(!h) return null; return h.closest('.card, section, div[style*="border"]')||h.parentElement; }

  /* ===== STATUS PER CR export button (kept from v2.9.59) ===== */
  function crCard(){ return cardOf(headingEl(/^status per commercial registration/i)); }
  function crTable(){ const c=crCard(); return c?c.querySelector('table'):null; }
  function ensureCRBtn(){ const c=crCard(); if(!c||document.getElementById('crExportBtn')) return; c.classList.add('crx-anchor'); const b=document.createElement('button'); b.id='crExportBtn'; b.type='button'; b.className='crx-btn'; b.textContent='Export Excel'; b.addEventListener('click', exportCR); c.appendChild(b); log('CR export button present'); }
  setInterval(ensureCRBtn, 700); ensureCRBtn();
  function exportCR(){ const t=crTable(); if(!t){ alert('Status per CR table not found'); return; } const heads=[...t.querySelectorAll('thead th')].map(th=>th.textContent.trim()); const rows=[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(td=>td.textContent.trim())); dl(buildWorkbook([{name:'Status per CR', title:'STATUS PER COMMERCIAL REGISTRATION', heads, rows, withTotal:true, freeze:true, autoFilter:true, tabSelected:true}]),'STATUS PER COMMERCIAL REGISTRATION.xlsx'); log('Exported CR xlsx'); }

  /* ===== VISA USAGE PER BLOCK export ===== */
  function vupbTable(){ const sec=document.getElementById('vupbSection'); return sec?sec.querySelector('table.vupb'):null; }
  function readTable(){ const t=vupbTable(); if(!t) return null; const heads=[...t.querySelectorAll('thead th')].map(th=>th.textContent.replace(/[\u25B2\u25BC]/g,'').trim()); const rows=[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(td=>td.textContent.trim())); return {heads,rows}; }
  function nearMap(){ const now=new Date(); const m={}; const all=(window.DB&&window.DB.visaRecords)||[]; all.forEach(v=>{ const s=upc(v.statusVisa); if(s!=='UNUSED'&&s!=='ALLOCATED') return; const d=daysUntil(v.expirationDate,now); if(d==null||d<0) return; const k=[v.visaDocumentNumber||'',v.sponsorId||'',upc(v.nationality),upc(v.stampingCity),upc(v.gender),upc(v.client),upc(v.visaCategory),upc(v.registeredAgencyName)].join('|'); if(m[k]==null||d<m[k]) m[k]=d; }); return m; }

  function exportVUPB(){
    const data=readTable(); if(!data){ alert('Visa Usage Per Block table not found'); return; }
    const { heads, rows }=data; const upH=heads.map(h=>h.toUpperCase());
    const iDoc=upH.indexOf('VISA DOC #'), iSid=upH.indexOf('SPONSOR ID'), iNat=upH.indexOf('NATIONALITY'), iCity=upH.indexOf('STAMPING CITY'), iGen=upH.indexOf('GENDER'), iProj=(upH.indexOf('PROJECT')>=0?upH.indexOf('PROJECT'):upH.indexOf('CLIENT')), iCat=upH.indexOf('VISA CATEGORY'), iAg=upH.indexOf('AGENCY');
    const iRem=upH.indexOf('REMAINING'), iUn=upH.indexOf('UNUSED'), iAl=upH.indexOf('ALLOCATED');
    const remOf=(row)=> iRem>=0?num(row[iRem]):(num(row[iUn])+num(row[iAl]));
    const near=nearMap();
    const rowKey=(row)=>[row[iDoc]||'',row[iSid]||'',upc(row[iNat]),upc(row[iCity]),upc(row[iGen]),upc(row[iProj]),upc(row[iCat]),upc(row[iAg])].join('|');
    const levelFn=(row)=>{ const rem=remOf(row); if(rem===0) return 'red'; const d=near[rowKey(row)]; if(d!=null && d<=NEAR_DAYS) return 'amber'; return ''; };
    const numCols=['USED','UNUSED','ALLOCATED','EXPIRED','CANCELLED','REMAINING','TOTAL'].filter(c=>upH.indexOf(c)>=0);
    function summary(dimIdx, dimLabel){ const g={}; rows.forEach(r=>{ const k=(dimIdx>=0?r[dimIdx]:'')||'(none)'; if(!g[k]) g[k]={blocks:0,vals:{}}; g[k].blocks++; numCols.forEach(c=>{ g[k].vals[c]=(g[k].vals[c]||0)+num(r[upH.indexOf(c)]); }); }); const H=[dimLabel,'Blocks',...numCols.map(c=>c.charAt(0)+c.slice(1).toLowerCase())]; const R=Object.entries(g).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))).map(([k,v])=>[k,v.blocks,...numCols.map(c=>v.vals[c]||0)]); return {heads:H, rows:R}; }
    const redOnly=(row,uh)=>{ const ri=uh.indexOf('REMAINING'); return (num(row[ri]))===0?'red':''; };
    const sheets=[];
    sheets.push({ name:'All Data', title:'VISA USAGE PER BLOCK — ALL DATA', desc:'Every filtered block row (with TOTAL)', heads, rows, levelFn, withTotal:true, freeze:true, autoFilter:true });
    const sC=summary(iProj,'Project'); sheets.push({ name:'SUMMARY (Client)', title:'SUMMARY PER PROJECT / CLIENT', desc:'Totals per client', heads:sC.heads, rows:sC.rows, levelFn:redOnly, withTotal:true, freeze:true });
    const sN=summary(iNat,'Nationality'); sheets.push({ name:'SUMMARY (Nationality)', title:'SUMMARY PER NATIONALITY', desc:'Totals per nationality', heads:sN.heads, rows:sN.rows, levelFn:redOnly, withTotal:true, freeze:true });
    const sA=summary(iAg,'Agency'); sheets.push({ name:'SUMMARY (Agency)', title:'SUMMARY PER AGENCY', desc:'Totals per agency', heads:sA.heads, rows:sA.rows, levelFn:redOnly, withTotal:true, freeze:true });
    const sK=summary(iCat,'Visa Category'); sheets.push({ name:'SUMMARY (Category)', title:'SUMMARY PER VISA CATEGORY', desc:'Totals per visa category', heads:sK.heads, rows:sK.rows, levelFn:redOnly, withTotal:true, freeze:true });
    const clients=[...new Set(rows.map(r=>((iProj>=0?r[iProj]:'')||'(none)')))].sort((a,b)=>a.localeCompare(b));
    clients.forEach(cli=>{ sheets.push({ name:cli, title:'VISA USAGE — '+cli, desc:'Blocks for '+cli, heads, rows:rows.filter(r=>((iProj>=0?r[iProj]:'')||'(none)')===cli), levelFn, withTotal:true, freeze:true, autoFilter:true }); });
    dl(buildWorkbook(sheets, { index:true }),'VISA USAGE PER BLOCK.xlsx');
    log('Exported VUPB — '+(sheets.length+1)+' sheets, opens on INDEX, readable nav');
  }
  function wireVUPB(){ const sec=document.getElementById('vupbSection'); if(!sec) return; const btn=sec.querySelector('#vupbExport'); if(btn && btn.dataset._v66!=='1'){ btn.dataset._v66='1'; const clone=btn.cloneNode(true); clone.id='vupbExport'; clone.textContent='Export Excel'; btn.parentNode.replaceChild(clone,btn); clone.addEventListener('click', exportVUPB); log('VUPB export → v2.9.66'); } }
  setInterval(wireVUPB, 800); wireVUPB();
  window._entVupbExport=exportVUPB; window._entCRExport=exportCR;
  console.log('%c\ud83e\udded VUPB export: readable nav + opens on INDEX v'+V+' active','color:#2F5A3B;font-weight:bold;');
})();


(function ExpExportV2961(){
  'use strict';
  const V='2.9.61';
  const esc0=(s)=>String(s);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const log=(...a)=>console.log('%c[v2.9.61]','color:#2F5A3B;font-weight:bold',...a);

  /* ===== xlsx generator (same CR styling) ===== */
// Single/multi-sheet .xlsx generator (same styling as Status per CR export).
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}return t;})();
function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function sb(s){return new TextEncoder().encode(s);}
function cc(a){let l=0;a.forEach(x=>l+=x.length);const o=new Uint8Array(l);let p=0;a.forEach(x=>{o.set(x,p);p+=x.length;});return o;}
function u16(n){return new Uint8Array([n&0xFF,(n>>>8)&0xFF]);}
function u32(n){return new Uint8Array([n&0xFF,(n>>>8)&0xFF,(n>>>16)&0xFF,(n>>>24)&0xFF]);}
function zip(files){const L=[],C=[];let off=0;files.forEach(f=>{const nb=sb(f.name),crc=crc32(f.data),sz=f.data.length;const loc=cc([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(sz),u32(sz),u16(nb.length),u16(0),nb,f.data]);L.push(loc);C.push(cc([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(sz),u32(sz),u16(nb.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off),nb]));off+=loc.length;});const cs=off,cb=cc(C);const eo=cc([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cb.length),u32(cs),u16(0)]);return cc([cc(L),cb,eo]);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c]);}
function col(n){let s='';n++;while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26);}return s;}
const FILLS=['none','gray125','FF4F81BD','FF9BBB59','FFF4B942','FFA6A6A6','FFC0504D','FFE36C09','FFFFFFFF'];
function stylesXml(){
  const fonts=['<font><sz val="10"/><name val="Calibri"/></font>','<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>','<font><b/><sz val="10"/><color rgb="FF222222"/><name val="Calibri"/></font>','<font><b/><sz val="10"/><name val="Calibri"/></font>','<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'];
  const fills=FILLS.map(f=> f==='none'?'<fill><patternFill patternType="none"/></fill>':f==='gray125'?'<fill><patternFill patternType="gray125"/></fill>':'<fill><patternFill patternType="solid"><fgColor rgb="'+f+'"/><bgColor indexed="64"/></patternFill></fill>');
  const borders=['<border><left/><right/><top/><bottom/><diagonal/></border>','<border><left style="thin"><color rgb="FF808080"/></left><right style="thin"><color rgb="FF808080"/></right><top style="thin"><color rgb="FF808080"/></top><bottom style="thin"><color rgb="FF808080"/></bottom><diagonal/></border>'];
  const X=[[0,0,0,0],[4,2,1,1],[1,2,1,1],[2,3,1,1],[2,4,1,1],[2,5,1,1],[1,6,1,1],[1,7,1,1],[2,8,1,1],[0,8,1,2],[0,8,1,1],[3,8,1,3],[3,8,1,1],[3,7,1,1]];
  const am=['','center','left','right'];
  const xfs=X.map(([fo,fi,bo,al],i)=>{let font=fo;if(i===13)font=1;const a=am[al];const alx=a?'<alignment horizontal="'+a+'" vertical="center"/>':'<alignment vertical="center"/>';return '<xf numFmtId="0" fontId="'+font+'" fillId="'+fi+'" borderId="'+bo+'" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">'+alx+'</xf>';});
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="'+fonts.length+'">'+fonts.join('')+'</fonts><fills count="'+fills.length+'">'+fills.join('')+'</fills><borders count="'+borders.length+'">'+borders.join('')+'</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="'+xfs.length+'">'+xfs.join('')+'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
}
const HEAD={USED:2,UNUSED:3,ALLOCATED:4,EXPIRED:5,CANCELLED:6,TOTAL:7,PLAIN:8,QUANTITY:4,'DAYS LEFT':6};
const NUMSET=new Set(['USED','UNUSED','ALLOCATED','EXPIRED','CANCELLED','TOTAL','QUANTITY']);
const TEXTSET=new Set(['CR #','SPONSOR ID','VISA DOC #']);
function hs(name){const H=String(name).toUpperCase();return HEAD[H]!=null?HEAD[H]:HEAD.PLAIN;}
function sheetXml(heads,rows,totals,title){
  const nc=heads.length,upH=heads.map(h=>String(h).toUpperCase());
  const cell=(r,c,s,v,isN)=>{const ref=col(c)+r;return isN?'<c r="'+ref+'" s="'+s+'"><v>'+(v===''?'':v)+'</v></c>':'<c r="'+ref+'" s="'+s+'" t="inlineStr"><is><t xml:space="preserve">'+esc(v)+'</t></is></c>';};
  let x='';let r=1;
  x+='<row r="'+r+'" ht="24" customHeight="1">'+cell(r,0,1,title,false);for(let c=1;c<nc;c++)x+='<c r="'+col(c)+r+'" s="1"/>';x+='</row>';r++;
  const headerRow=r;
  x+='<row r="'+r+'" ht="20" customHeight="1">'+heads.map((h,c)=>cell(r,c,hs(h),h,false)).join('')+'</row>';r++;
  const firstData=r;
  rows.forEach(row=>{x+='<row r="'+r+'" ht="18" customHeight="1">'+row.map((v,c)=>{const H=upH[c];if(NUMSET.has(H)){const n=parseFloat(String(v).replace(/[^0-9.\-]/g,''));return cell(r,c,10,isNaN(n)?'':n,true);}return cell(r,c,9,v,false);}).join('')+'</row>';r++;});
  const lastData=r-1;
  let mt='';
  if(totals){x+='<row r="'+r+'" ht="20" customHeight="1">'+cell(r,0,11,'TOTAL',false)+'<c r="'+col(1)+r+'" s="11"/>';for(let c=2;c<nc;c++){const H=upH[c];if(NUMSET.has(H)){const st=(H==='TOTAL')?13:12;x+=cell(r,c,st,totals[c]===''?'':totals[c],true);}else x+='<c r="'+col(c)+r+'" s="11"/>';}x+='</row>';mt='<mergeCell ref="A'+r+':B'+r+'"/>';r++;}
  const lc=col(nc-1);
  const views='<sheetViews><sheetView workbookViewId="0"><pane ySplit="'+headerRow+'" topLeftCell="A'+firstData+'" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A'+firstData+'" sqref="A'+firstData+'"/></sheetView></sheetViews>';
  const cols='<cols>'+heads.map((h,i)=>{let w=12;const H=upH[i];if(H.includes('SPONSOR'))w=14;if(H.includes('CATEGORY')||H.includes('AGENCY')||H.includes('CLIENT')||H.includes('NATIONALITY'))w=22;if(NUMSET.has(H))w=11;if(H.includes('VISA DOC'))w=13;return '<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>';}).join('')+'</cols>';
  const auto='<autoFilter ref="A'+headerRow+':'+lc+(lastData>=firstData?lastData:headerRow)+'"/>';
  const merges='<mergeCells count="'+(totals?2:1)+'"><mergeCell ref="A1:'+lc+'1"/>'+mt+'</mergeCells>';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+views+cols+'<sheetData>'+x+'</sheetData>'+auto+merges+'</worksheet>';
}
function buildXlsx(heads,rows,title,sheetName){
  title=title||'EXPORT';sheetName=(sheetName||'Sheet1').slice(0,31);
  const totals=heads.map((h,i)=>{const H=String(h).toUpperCase();if(NUMSET.has(H)){let s=0;rows.forEach(r=>{const n=parseFloat(String(r[i]).replace(/[^0-9.\-]/g,''));if(!isNaN(n))s+=n;});return s;}return '';});
  const ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
  const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const wb='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'+esc(sheetName)+'" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const wbr='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const files=[{name:'[Content_Types].xml',data:sb(ct)},{name:'_rels/.rels',data:sb(rels)},{name:'xl/workbook.xml',data:sb(wb)},{name:'xl/_rels/workbook.xml.rels',data:sb(wbr)},{name:'xl/styles.xml',data:sb(stylesXml())},{name:'xl/worksheets/sheet1.xml',data:sb(sheetXml(heads,rows,totals,title))}];
  return zip(files);
}



  function headingEl(rx){ return [...document.querySelectorAll('h1,h2,h3,h4,div,span')].find(x=>rx.test((x.textContent||'').trim())&&x.children.length<=3&&x.getBoundingClientRect().height<80); }
  function expCard(){ const h=headingEl(/upcoming expirations/i); if(!h) return null; return h.closest('.card, section, div[style*="border"]')||h.parentElement; }
  /* prefer our grouped table (#vexpBody) if present, else any table in the card with DAYS LEFT+QUANTITY */
  function expTable(){ const c=expCard(); if(!c) return null; const body=c.querySelector('#vexpBody table'); if(body) return body; const tables=[...c.querySelectorAll('table')]; return tables.find(t=>{ const h=[...t.querySelectorAll('th')].map(th=>upc(th.textContent)); return h.some(x=>x.includes('DAYS LEFT'))&&h.some(x=>x.includes('QUANTITY')); }) || tables[0] || null; }

  function ensureBtn(){ const c=expCard(); if(!c||document.getElementById('expExportBtn')) return; c.classList.add('exp-anchor'); const b=document.createElement('button'); b.id='expExportBtn'; b.type='button'; b.textContent='Export Excel'; b.addEventListener('click', doExport); c.appendChild(b); log('Upcoming Expirations export button added'); }
  setInterval(ensureBtn, 700); ensureBtn();

  function doExport(){
    const t=expTable(); if(!t){ alert('Upcoming Expirations table not found'); return; }
    const heads=[...t.querySelectorAll('thead th')].map(th=>th.textContent.replace(/[\u25B2\u25BC]/g,'').trim());
    const rows=[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(td=>td.textContent.replace(/\s+/g,' ').trim()));
    if(!heads.length){ alert('No columns found in Upcoming Expirations table'); return; }
    const bytes=buildXlsx(heads, rows, 'UPCOMING EXPIRATIONS', 'Upcoming Expirations');
    const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='UPCOMING EXPIRATIONS.xlsx'; a.click(); URL.revokeObjectURL(url);
    log('Exported UPCOMING EXPIRATIONS.xlsx ('+rows.length+' rows)');
  }
  window._entExpExport=doExport;
  console.log('%c\ud83d\udcc4 Upcoming Expirations Export Excel v'+V+' active','color:#2F5A3B;font-weight:bold;');
})();

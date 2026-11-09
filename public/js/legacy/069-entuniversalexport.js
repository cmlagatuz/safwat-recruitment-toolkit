
/* =========================================================
   PART 1 — UNIVERSAL EXPORTER (canonical R-01 template)
   ========================================================= */
(function EntUniversalExport(){
  'use strict';
  if(window.EntExport && window.EntExport.__v>=400) return;
  const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}return t;})();
  function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
  function sbb(s){return new TextEncoder().encode(s);}
  function ccx(a){let l=0;a.forEach(x=>l+=x.length);const o=new Uint8Array(l);let p=0;a.forEach(x=>{o.set(x,p);p+=x.length;});return o;}
  function u16(n){return new Uint8Array([n&0xFF,(n>>>8)&0xFF]);} function u32(n){return new Uint8Array([n&0xFF,(n>>>8)&0xFF,(n>>>16)&0xFF,(n>>>24)&0xFF]);}
  function zipx(files){const L=[],C=[];let off=0;files.forEach(f=>{const nb=sbb(f.name),crc=crc32(f.data),sz=f.data.length;const loc=ccx([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(sz),u32(sz),u16(nb.length),u16(0),nb,f.data]);L.push(loc);C.push(ccx([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(sz),u32(sz),u16(nb.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off),nb]));off+=loc.length;});const cs=off,cb=ccx(C);const eo=ccx([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cb.length),u32(cs),u16(0)]);return ccx([ccx(L),cb,eo]);}
  function xesc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c]);}
  function xcol(n){let s='';n++;while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26);}return s;}
  /* styles: s=1 title, s=2 header, s=3 data — matching R-01 */
  function stylesXml(){
    const fonts=['<font><sz val="10"/><name val="Calibri"/></font>',
      '<font><b/><sz val="13"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',
      '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'];
    const fills=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FF14202B"/><bgColor indexed="64"/></patternFill></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FF2E4456"/><bgColor indexed="64"/></patternFill></fill>'];
    const borders=['<border><left/><right/><top/><bottom/><diagonal/></border>',
      '<border><left style="thin"><color rgb="FFD9D2BC"/></left><right style="thin"><color rgb="FFD9D2BC"/></right><top style="thin"><color rgb="FFD9D2BC"/></top><bottom style="thin"><color rgb="FFD9D2BC"/></bottom><diagonal/></border>'];
    const xfs=['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>',
      '<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>',
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>'];
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
      '<fonts count="'+fonts.length+'">'+fonts.join('')+'</fonts>'+
      '<fills count="'+fills.length+'">'+fills.join('')+'</fills>'+
      '<borders count="'+borders.length+'">'+borders.join('')+'</borders>'+
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
      '<cellXfs count="'+xfs.length+'">'+xfs.join('')+'</cellXfs>'+
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  }
  function sheetXml(heads,rows,title){
    const nc=heads.length;
    const cell=(r,c,s,v)=>'<c r="'+xcol(c)+r+'" s="'+s+'" t="inlineStr"><is><t xml:space="preserve">'+xesc(v)+'</t></is></c>';
    let body=''; let r=1;
    body+='<row r="1" ht="24" customHeight="1">'+cell(1,0,1,title); for(let c=1;c<nc;c++) body+='<c r="'+xcol(c)+'1" s="1"/>'; body+='</row>'; r=2;
    body+='<row r="2" ht="20" customHeight="1">'+heads.map((h,c)=>cell(2,c,2,h)).join('')+'</row>'; r=3;
    rows.forEach(row=>{ body+='<row r="'+r+'" ht="18" customHeight="1">'+heads.map((h,c)=>cell(r,c,3,row[c]==null?'':row[c])).join('')+'</row>'; r++; });
    const lastData=r-1; const lc=xcol(nc-1);
    const views='<sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A3" sqref="A3"/></sheetView></sheetViews>';
    const cols='<cols>'+heads.map((h,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+(String(h).length>12?20:14)+'" customWidth="1"/>').join('')+'</cols>';
    const auto='<autoFilter ref="A2:'+lc+(lastData>=3?lastData:2)+'"/>';
    const merges='<mergeCells count="1"><mergeCell ref="A1:'+lc+'1"/></mergeCells>';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+views+cols+'<sheetData>'+body+'</sheetData>'+auto+merges+'</worksheet>';
  }
  function buildXlsx(heads,rows,title,sheetName){
    title=title||'REPORT'; sheetName=(sheetName||'Sheet1').slice(0,31);
    const ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
    const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    const wb='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'+xesc(sheetName)+'" sheetId="1" r:id="rId1"/></sheets></workbook>';
    const wbr='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    return zipx([{name:'[Content_Types].xml',data:sbb(ct)},{name:'_rels/.rels',data:sbb(rels)},{name:'xl/workbook.xml',data:sbb(wb)},{name:'xl/_rels/workbook.xml.rels',data:sbb(wbr)},{name:'xl/styles.xml',data:sbb(stylesXml())},{name:'xl/worksheets/sheet1.xml',data:sbb(sheetXml(heads,rows,title))}]);
  }
  function download(blob,filename){
    try{ if(window.navigator&&window.navigator.msSaveOrOpenBlob){ window.navigator.msSaveOrOpenBlob(blob,filename); return; } }catch(e){}
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=filename; a.rel='noopener'; a.style.position='fixed'; a.style.left='-9999px';
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    setTimeout(()=>{ try{document.body.removeChild(a);}catch(e){} URL.revokeObjectURL(url); },1500);
  }
  const Toast=()=>window.Toast||{ok:console.log,warn:console.warn,err:console.error};
  function xlsx(heads,rows,title,sheetName,fileName){
    if(!heads||!heads.length){ Toast().err('Export failed','No columns.'); return false; }
    try{
      download(new Blob([buildXlsx(heads,rows||[],title,sheetName)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), fileName||((sheetName||'export')+'.xlsx'));
      Toast().ok('Exported', (rows||[]).length+' row(s) · '+heads.length+' columns');
      return true;
    }catch(e){ Toast().err('Export failed', e.message); return false; }
  }
  function cellText(td){
    if(!td) return '';
    const el=td.querySelector('input,select,textarea');
    if(el){ if(el.tagName==='SELECT'){ const o=el.options[el.selectedIndex]; return o?o.text:el.value; } return el.value!=null?el.value:''; }
    return (td.textContent||'').replace(/[📅✕×🔒▲▼]/g,'').trim();
  }
  /* read a live table → {heads, rows}; drops '#' / blank / action cols and DUPLICATE headers */
  function readGrid(table){
    if(!table) return null;
    const headRows=[...table.querySelectorAll('thead tr')]; if(!headRows.length) return null;
    const headRow=headRows[headRows.length-1];
    const ths=[...headRow.children];
    const seen=new Set(); const heads=[]; const idx=[];
    ths.forEach((th,i)=>{
      const t=(th.textContent||'').replace(/[▲▼]/g,'').trim();
      if(t===''||t==='#') return;
      const key=t.toUpperCase();
      if(seen.has(key)) return;              /* de-duplicate repeated headers */
      seen.add(key); heads.push(t); idx.push(i);
    });
    const rows=[];
    table.querySelectorAll('tbody tr').forEach(tr=>{
      const cells=[...tr.children];
      const row=idx.map(i=>cellText(cells[i]));
      if(row.some(v=>String(v).trim()!=='')) rows.push(row);
    });
    return {heads,rows};
  }
  function fromGrid(table,title,sheetName,fileName){
    const g=readGrid(table);
    if(!g||!g.heads.length){ Toast().err('Export failed','Table not found.'); return false; }
    if(!g.rows.length){ Toast().warn('Nothing to export','No rows.'); return false; }
    return xlsx(g.heads,g.rows,title,sheetName,fileName);
  }
  window.EntExport={ __v:400, xlsx, fromGrid, readGrid, download, buildXlsx };
  /* legacy shim so Project D's drill-down export uses the same template */
  window._entCEOExport=function(heads,rows,sheet,file){ return xlsx(heads,rows,(sheet||'REPORT').toUpperCase(),sheet||'Sheet1',file); };
  console.log('%c📤 EntExport v4.0.0 — universal xlsx template (title + styled header + freeze + autofilter)','color:#8C6A22;font-weight:bold;');
})();

/* =========================================================
   PART 2 — R-02 date columns (duplicate Request Date removed,
   × moved last, export via EntExport)
   ========================================================= */
(function R02PipelineDatesV400(){
  'use strict';
  if(window.__entR02DatesV400) return; window.__entR02DatesV400=true;
  window.__entR02DatesV325=true; window.__entR02DatesV326=true; window.__entR02DatesV327=true;
  const V='4.0.0';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const pad=(n)=>String(n).padStart(2,'0');
  const log=(...a)=>console.log('%c[v4.0.0 R02Dates]','color:#2E6FA3;font-weight:bold',...a);
  const Toast=()=>window.Toast||{ok:console.log,warn:console.warn,err:console.error};

  /* Request Date REMOVED — the grid already has it */
  const DATE_COLS=[
    ['selectionDate','Selection Date'],
    ['dateOfferSent','Offer Sent'],
    ['dateOfferSigned','Offer Signed'],
    ['dateMedicalOutset','Medical Outset'],
    ['dateMedicalResult','Medical Result'],
    ['dateSvpOutset','SVP/QVP Outset'],
    ['dateSvpResult','SVP/QVP Result'],
    ['dateBioOutset','Biometrics Outset'],
    ['dateBioResult','Biometrics Result'],
    ['dateArrivalKsa','Arrival in KSA'],
    ['dateArrivedAccommodation','Arrived in Accommodation'],
    ['dateWorkStarted','Work Started to Client'],
  ];
  const FIELD_SET=new Set(DATE_COLS.map(c=>c[0]));

  function parseDateCell(s){
    if(s==null) return '';
    const t=String(s).trim(); if(!t) return '';
    let m;
    if(/^\d{5}$/.test(t)){ const d=new Date(Date.UTC(1899,11,30)+(+t)*86400000); return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate()); }
    const u=t.replace(/[.\/]/g,'-');
    if(m=u.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)){ const y=+m[1]; if(y>=1900) return y+'-'+pad(+m[2])+'-'+pad(+m[3]); return ''; }
    if(m=u.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)){ return m[3]+'-'+pad(+m[2])+'-'+pad(+m[1]); }
    const d=new Date(t); if(!isNaN(d.getTime())&&d.getFullYear()>=1900) return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
    return '';
  }

  function grid(){ return $('cvGrid'); }
  function overlayOpen(){ const o=$('cvOverlay'); return o&&o.classList.contains('open'); }
  function rowRecId(tr){ return (tr.dataset&&(tr.dataset.rec||tr.dataset.recId||tr.dataset.id))||''; }
  function recById(id){ const C=(window.DB&&window.DB.recruitmentCases)||[]; return C.find(c=>c.id===id); }

  /* remove a stale duplicate "Request Date" column injected by an earlier version */
  function removeStaleRequestDate(){
    const g=grid(); if(!g) return;
    const headRows=[...g.querySelectorAll('thead tr')]; if(!headRows.length) return;
    const headRow=headRows[headRows.length-1];
    const th=headRow.querySelector('th[data-pd="requestDate"]');
    if(th){ const i=[...headRow.children].indexOf(th); th.remove();
      g.querySelectorAll('tbody tr').forEach(tr=>{ const c=tr.children[i]; if(c&&c.classList.contains('pd-cell')&&c.querySelector('[data-f="requestDate"]')) c.remove(); });
      log('removed duplicate Request Date column'); }
    /* belt & braces: drop any pd-cell that holds requestDate */
    g.querySelectorAll('td.pd-cell input[data-f="requestDate"]').forEach(inp=>{ const td=inp.closest('td'); if(td) td.remove(); });
  }

  function actionCellOf(tr){
    const cells=[...tr.children];
    for(let i=cells.length-1;i>=0;i--){
      const td=cells[i];
      if(td.classList.contains('pd-cell')) continue;
      if(td.classList.contains('rowact')) return td;
      const btn=td.querySelector('button'); const txt=(td.textContent||'').trim();
      if(btn && (txt==='×'||txt==='✕'||txt==='x'||/remove|delete/i.test(btn.title||''))) return td;
    }
    return null;
  }
  function actionHeaderOf(headRow){
    const ths=[...headRow.children];
    for(let i=ths.length-1;i>=0;i--){ const th=ths[i]; if(th.classList.contains('pd-head')) continue; if((th.textContent||'').trim()==='') return th; }
    return null;
  }

  function injectColumns(){
    const g=grid(); if(!g) return;
    const headRows=[...g.querySelectorAll('thead tr')]; if(!headRows.length) return;
    const headRow=headRows[headRows.length-1];
    removeStaleRequestDate();

    DATE_COLS.forEach(([field,label])=>{
      if(headRow.querySelector('th[data-pd="'+field+'"]')) return;
      const th=document.createElement('th'); th.className='pd-head'; th.dataset.pd=field; th.textContent=label;
      headRow.appendChild(th);
    });
    const ah=actionHeaderOf(headRow);
    if(ah && headRow.lastElementChild!==ah) headRow.appendChild(ah);

    let added=0;
    g.querySelectorAll('tbody tr').forEach(tr=>{
      const rec=recById(rowRecId(tr))||{};
      DATE_COLS.forEach(([field])=>{
        if(tr.querySelector('[data-f="'+field+'"]')) return;
        const td=document.createElement('td'); td.className='pd-cell';
        const val=rec[field]?parseDateCell(rec[field]):'';
        td.innerHTML='<input type="text" data-f="'+field+'" value="'+esc(val)+'" placeholder="yyyy-mm-dd" autocomplete="off">'+
                     '<span class="pd-cal" title="Pick date">📅</span>';
        tr.appendChild(td); added++;
      });
      const ac=actionCellOf(tr);
      if(ac && tr.lastElementChild!==ac) tr.appendChild(ac);   /* × always last */
    });
    if(added) log('appended '+added+' date cell(s); × moved to end');
  }

  /* picker */
  const pk=$('pdPicker'); let pkTarget=null;
  function fillPicker(){
    const y=$('pdY'); if(y.options.length===0){ let o=''; const cy=new Date().getFullYear(); for(let i=cy-8;i<=cy+4;i++) o+='<option>'+i+'</option>'; y.innerHTML=o; }
    const m=$('pdM'); if(m.options.length!==12){ let o=''; for(let i=1;i<=12;i++) o+='<option>'+i+'</option>'; m.innerHTML=o; }
    const d=$('pdD'); if(d.options.length!==31){ let o=''; for(let i=1;i<=31;i++) o+='<option>'+i+'</option>'; d.innerHTML=o; }
  }
  function openPicker(inp,label){
    pkTarget=inp; fillPicker(); $('pdLabel').textContent=label||'Pick date';
    const cur=parseDateCell(inp.value)||new Date().toISOString().slice(0,10); const p=cur.split('-');
    if(p.length===3){ $('pdY').value=String(+p[0]); $('pdM').value=String(+p[1]); $('pdD').value=String(+p[2]); }
    const r=inp.getBoundingClientRect();
    pk.style.left=Math.max(8,Math.min(r.left, window.innerWidth-262))+'px';
    pk.style.top=Math.min(r.bottom+4, window.innerHeight-150)+'px';
    pk.classList.add('open');
  }
  $('pdCancel').addEventListener('click',()=>pk.classList.remove('open'));
  $('pdClear').addEventListener('click',()=>{ if(pkTarget){ pkTarget.value=''; pkTarget.dispatchEvent(new Event('input',{bubbles:true})); pkTarget.dispatchEvent(new Event('change',{bubbles:true})); } pk.classList.remove('open'); });
  $('pdOk').addEventListener('click',()=>{
    if(!pkTarget){ pk.classList.remove('open'); return; }
    pkTarget.value=$('pdY').value+'-'+pad($('pdM').value)+'-'+pad($('pdD').value);
    pkTarget.dispatchEvent(new Event('input',{bubbles:true})); pkTarget.dispatchEvent(new Event('change',{bubbles:true}));
    pk.classList.remove('open');
  });
  document.addEventListener('click',(e)=>{
    const cal=e.target.closest&&e.target.closest('#cvGrid td.pd-cell .pd-cal');
    if(cal){ e.preventDefault(); e.stopPropagation(); const td=cal.closest('td'); const inp=td&&td.querySelector('input[data-f]'); if(inp){ const col=DATE_COLS.find(c=>c[0]===inp.dataset.f); openPicker(inp, col?('Pick '+col[1]):'Pick date'); } return; }
    if(pk.classList.contains('open') && !e.target.closest('#pdPicker')) pk.classList.remove('open');
  }, true);

  document.addEventListener('change',(e)=>{
    const inp=e.target; if(!inp||!inp.dataset||!FIELD_SET.has(inp.dataset.f)) return;
    const g=grid(); if(!g||!g.contains(inp)) return;
    const norm=parseDateCell(inp.value);
    if(inp.value.trim()!=='' && norm===''){ inp.value=''; Toast().warn('Date not recognised','Use yyyy-mm-dd or dd/mm/yyyy.'); }
    else if(norm!==inp.value) inp.value=norm;
  }, true);

  document.addEventListener('paste',(e)=>{
    const inp=e.target; if(!inp||!inp.dataset||!FIELD_SET.has(inp.dataset.f)) return;
    const g=grid(); if(!g||!g.contains(inp)) return;
    const text=(e.clipboardData||window.clipboardData).getData('text'); if(!text) return;
    const rows=text.replace(/\r/g,'').split('\n').filter(l=>l!=='').map(l=>l.split('\t'));
    e.preventDefault();
    if(rows.length===1&&rows[0].length===1){ inp.value=parseDateCell(rows[0][0]); inp.dispatchEvent(new Event('input',{bubbles:true})); inp.dispatchEvent(new Event('change',{bubbles:true})); return; }
    const startTd=inp.closest('td'), startTr=inp.closest('tr'); if(!startTd||!startTr) return;
    const allTrs=[...g.querySelectorAll('tbody tr')];
    const rIdx=allTrs.indexOf(startTr); const cIdx=[...startTr.children].indexOf(startTd);
    let filled=0;
    rows.forEach((cells,ri)=>{
      const tr=allTrs[rIdx+ri]; if(!tr) return;
      cells.forEach((cell,ci)=>{
        const td=tr.children[cIdx+ci]; if(!td) return;
        const target=td.querySelector('input[data-f]'); if(!target) return;
        if(!FIELD_SET.has(target.dataset.f)) return;
        target.value=parseDateCell(cell);
        target.dispatchEvent(new Event('input',{bubbles:true}));
        td.classList.remove('pd-flash'); void td.offsetWidth; td.classList.add('pd-flash');
        filled++;
      });
    });
    if(filled) Toast().ok('Pasted', filled+' date cell(s)');
  }, true);

  function persistDates(){
    const g=grid(); if(!g||!window.DB||!Array.isArray(window.DB.recruitmentCases)) return;
    const byId={}; window.DB.recruitmentCases.forEach(c=>byId[c.id]=c);
    let changed=0;
    g.querySelectorAll('tbody tr').forEach(tr=>{
      const rec=byId[rowRecId(tr)]; if(!rec) return;
      DATE_COLS.forEach(([field])=>{
        const inp=tr.querySelector('input[data-f="'+field+'"]'); if(!inp) return;
        const v=parseDateCell(inp.value); const next=v===''?null:v;
        if(String(rec[field]==null?'':rec[field])!==String(next==null?'':next)){ rec[field]=next; changed++; }
      });
    });
    if(changed>0){
      try{ if(window.dbSave) window.dbSave(); }catch(e){}
      try{ if(window.Audit&&window.Audit.push) window.Audit.push('bulk','recruitmentCase',null,null,'Pipeline dates updated ('+changed+' field(s))'); }catch(e){}
      try{ if(window.refreshPipelineView) window.refreshPipelineView(); }catch(e){}
      Toast().ok('Dates saved', changed+' field(s)');
    }
  }
  function hookSave(){ const btn=$('cvSave'); if(!btn||btn.dataset.pdSave==='1') return; btn.dataset.pdSave='1'; btn.addEventListener('click', ()=>{ setTimeout(persistDates,0); }, false); }

  /* Export via the UNIVERSAL template */
  function hookExport(){
    const btn=$('cvExport')||[...document.querySelectorAll('#cvOverlay button')].find(b=>/export report/i.test(b.textContent||''));
    if(!btn||btn.dataset.pdExp==='1') return; btn.dataset.pdExp='1';
    btn.addEventListener('click', function(e){
      e.preventDefault(); e.stopImmediatePropagation();
      if(window.EntExport&&window.EntExport.fromGrid) window.EntExport.fromGrid(grid(), 'ALL CANDIDATES — VIEW / EDIT DATA', 'Candidates', 'ALL CANDIDATES.xlsx');
      else Toast().err('Export failed','Universal exporter not loaded.');
    }, true);
    log('Export Report → universal template');
  }

  function tick(){ if(!overlayOpen()) return; injectColumns(); hookSave(); hookExport(); }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('r02.dates', tick, 700); }
  else { setInterval(tick, 700); }
  tick();
  const mo=new MutationObserver(()=>{ if(overlayOpen()){ injectColumns(); hookSave(); hookExport(); } });
  try{ const ov=$('cvOverlay'); if(ov) mo.observe(ov,{childList:true,subtree:true}); }catch(e){}

  window._entR02Dates={ cols:DATE_COLS, parse:parseDateCell, persist:persistDates };
  console.log('%c📅 R-02 pipeline dates v'+V+' — Request Date de-duplicated · × last · universal export','color:#2E6FA3;font-weight:bold;');
})();

/* =========================================================
   PART 3 — route R-01 View Data export through the same template
   ========================================================= */
(function R01ExportUnify(){
  'use strict';
  if(window.__entR01ExpUnify) return; window.__entR01ExpUnify=true;
  const $=(id)=>document.getElementById(id);
  function tick(){
    const ov=$('vdOverlay'); if(!ov||!ov.classList.contains('open')) return;
    const btn=$('vdExport'); if(!btn||btn.dataset.uniExp==='1') return; btn.dataset.uniExp='1';
    btn.addEventListener('click', function(e){
      e.preventDefault(); e.stopImmediatePropagation();
      if(window.EntExport&&window.EntExport.fromGrid) window.EntExport.fromGrid($('vdGrid'), 'ALL VISA RECORDS — VIEW / EDIT DATA', 'Visa Records', 'ALL VISA RECORDS.xlsx');
    }, true);
    console.log('%c[v4.0.0] R-01 Export Report → universal template','color:#8C6A22;font-weight:bold');
  }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('r01.expUnify', tick, 800); }
  else { setInterval(tick, 800); }
})();


(function ViewDataR02V320(){
  'use strict';
  const V='3.2.0';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const num=(x)=>{const n=parseFloat(String(x).replace(/[^0-9.\-]/g,''));return isNaN(n)?0:n;};
  const nowIso=()=>new Date().toISOString();
  const log=(...a)=>console.log('%c[v3.2.0]','color:#2F5A3B;font-weight:bold',...a);
  const Toast=()=>window.Toast||{ok:console.log,warn:console.warn,err:console.error,info:console.info};

  const RECRUITMENT_TYPES=[{value:'LOCAL_TRANSFER',label:'Local Transfer'},{value:'OVERSEAS_ENDORSED',label:'Overseas – Endorsed'},{value:'OVERSEAS_SOURCED',label:'Overseas – Sourced'}];
  const STAGES=['PENDING OFFER LETTER','OFFER SIGNING','FOR MEDICAL APPOINTMENT','MEDICAL ON PROGRESS','FOR SKILLS VERIFICATION APPOINTMENT','SVP/QVP ON PROGRESS','FOR BIOMETRICS APPOINTMENT','Biometrics in Progress and Consular Submission','Visa Issued','DEPLOYED','ON HOLD','WITHDRAWN/BACKOUT','UNFIT','REJECTED','CANCELLED','AWOL','TERMINATED','END OF SERVICE'];

  /* ===== xlsx (blue title/headers, freeze, autofilter, text IDs) ===== */
  const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}return t;})();
  function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
  function sbb(s){return new TextEncoder().encode(s);}
  function ccx(a){let l=0;a.forEach(x=>l+=x.length);const o=new Uint8Array(l);let p=0;a.forEach(x=>{o.set(x,p);p+=x.length;});return o;}
  function u16(n){return new Uint8Array([n&0xFF,(n>>>8)&0xFF]);} function u32(n){return new Uint8Array([n&0xFF,(n>>>8)&0xFF,(n>>>16)&0xFF,(n>>>24)&0xFF]);}
  function zipx(files){const L=[],C=[];let off=0;files.forEach(f=>{const nb=sbb(f.name),crc=crc32(f.data),sz=f.data.length;const loc=ccx([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(sz),u32(sz),u16(nb.length),u16(0),nb,f.data]);L.push(loc);C.push(ccx([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(sz),u32(sz),u16(nb.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off),nb]));off+=loc.length;});const cs=off,cb=ccx(C);const eo=ccx([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cb.length),u32(cs),u16(0)]);return ccx([ccx(L),cb,eo]);}
  function xesc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c]);}
  function xcol(n){let s='';n++;while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26);}return s;}
  function stylesXml(){const fonts=['<font><sz val="10"/><name val="Calibri"/></font>','<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>','<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'];const fills=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>','<fill><patternFill patternType="solid"><fgColor rgb="FF4F81BD"/><bgColor indexed="64"/></patternFill></fill>'];const borders=['<border><left/><right/><top/><bottom/><diagonal/></border>','<border><left style="thin"><color rgb="FF808080"/></left><right style="thin"><color rgb="FF808080"/></right><top style="thin"><color rgb="FF808080"/></top><bottom style="thin"><color rgb="FF808080"/></bottom><diagonal/></border>'];const X=[[0,0,0,''],[2,2,1,'center'],[1,2,1,'left'],[0,0,1,'left']];const am=(a)=>a?('<alignment horizontal="'+a+'" vertical="center"/>'):'<alignment vertical="center"/>';const xfs=X.map(([fo,fi,bo,al])=>'<xf numFmtId="49" fontId="'+fo+'" fillId="'+fi+'" borderId="'+bo+'" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" applyNumberFormat="1">'+am(al)+'</xf>');return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="'+fonts.length+'">'+fonts.join('')+'</fonts><fills count="'+fills.length+'">'+fills.join('')+'</fills><borders count="'+borders.length+'">'+borders.join('')+'</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="'+xfs.length+'">'+xfs.join('')+'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';}
  function sheetXml(heads,rows,title){const nc=heads.length;const cell=(r,c,s,v)=>'<c r="'+xcol(c)+r+'" s="'+s+'" t="inlineStr"><is><t xml:space="preserve">'+xesc(v)+'</t></is></c>';let body='';let r=1;body+='<row r="1" ht="24" customHeight="1">'+cell(1,0,1,title);for(let c=1;c<nc;c++)body+='<c r="'+xcol(c)+'1" s="1"/>';body+='</row>';r=2;body+='<row r="2" ht="20" customHeight="1">'+heads.map((h,c)=>cell(2,c,2,h)).join('')+'</row>';r=3;rows.forEach(row=>{body+='<row r="'+r+'" ht="18" customHeight="1">'+heads.map((h,c)=>cell(r,c,3,row[c]==null?'':row[c])).join('')+'</row>';r++;});const lastData=r-1;const lc=xcol(nc-1);const views='<sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A3" sqref="A3"/></sheetView></sheetViews>';const cols='<cols>'+heads.map((h,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+(String(h).length>12?20:14)+'" customWidth="1"/>').join('')+'</cols>';const auto='<autoFilter ref="A2:'+lc+(lastData>=3?lastData:2)+'"/>';const merges='<mergeCells count="1"><mergeCell ref="A1:'+lc+'1"/></mergeCells>';return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+views+cols+'<sheetData>'+body+'</sheetData>'+auto+merges+'</worksheet>';}
  function buildXlsx(heads,rows,title,sheetName){title=title||'REPORT';sheetName=(sheetName||'Sheet1').slice(0,31);const ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';const wb='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'+xesc(sheetName)+'" sheetId="1" r:id="rId1"/></sheets></workbook>';const wbr='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';const files=[{name:'[Content_Types].xml',data:sbb(ct)},{name:'_rels/.rels',data:sbb(rels)},{name:'xl/workbook.xml',data:sbb(wb)},{name:'xl/_rels/workbook.xml.rels',data:sbb(wbr)},{name:'xl/styles.xml',data:sbb(stylesXml())},{name:'xl/worksheets/sheet1.xml',data:sbb(sheetXml(heads,rows,title))}];return zipx(files);}

  /* ===== R-02 panel + filters ===== */
  function pipelinePanel(){ return $('panel-pipeline')||$('pipelineDashboard'); }
  function candidatesCard(){ const h=[...document.querySelectorAll('h1,h2,h3,h4,div,span,p')].find(x=>/all candidates/i.test(x.textContent||'')&&x.children.length<=6&&x.getBoundingClientRect().height<90); return h?(h.closest('.card, section, div[style*="border"]')||h.parentElement):null; }
  function candidatesTable(){ const p=pipelinePanel(); if(!p) return null; return [...p.querySelectorAll('table')].find(t=>{ const hs=[...t.querySelectorAll('th')].map(th=>upc(th.textContent)); return hs.some(h=>h.includes('NAME'))&&hs.some(h=>h.includes('STAGE')); }); }
  function labelVal(labels){ const panel=pipelinePanel()||document; for(const w of panel.querySelectorAll('label,.field,div')){ const lt=upc(w.textContent||''); if(labels.some(L=>lt.startsWith(L))){ const ctl=w.querySelector('select,input')||(w.nextElementSibling&&w.nextElementSibling.matches&&w.nextElementSibling.matches('select,input')?w.nextElementSibling:null); if(ctl){ const val=upc(ctl.value); if(val&&val!=='ALL'&&val!=='') return val; return ''; } } } return ''; }
  function typeMatch(recType, filterVal){ if(!filterVal) return true; const rt=upc(recType); const f=upc(filterVal); if(f.includes('LOCAL')) return rt==='LOCAL_TRANSFER'; if(f.includes('OVERSEAS')){ if(f.includes('ENDORS')) return rt==='OVERSEAS_ENDORSED'; if(f.includes('SOURC')) return rt==='OVERSEAS_SOURCED'; return rt.startsWith('OVERSEAS'); } return upc(recType)===f || upc(typeLabel(recType))===f; }
  function readFilters(){ const out={}; out.client=labelVal(['CLIENT']); out.nationality=labelVal(['NATIONALITY']); out.position=labelVal(['POSITION']); out.type=labelVal(['RECRUITMENT TYPE','TYPE']); out.stage=labelVal(['STAGE','STATUS']); out.agency=labelVal(['AGENCY']); const panel=pipelinePanel()||document; const sb=[...panel.querySelectorAll('input[type="text"],input:not([type])')].find(i=>/search/i.test(i.placeholder||'')); out.search=sb?upc(sb.value):''; return out; }
  function currentCases(){ const all=(window.DB&&window.DB.recruitmentCases)||[]; const f=readFilters(); return all.filter(c=>{ if(f.client&&upc(c.client)!==f.client) return false; if(f.nationality&&upc(c.nationality)!==f.nationality) return false; if(f.position&&upc(c.position)!==f.position) return false; if(f.stage&&upc(c.stage)!==f.stage) return false; if(f.agency&&upc(c.agency)!==f.agency) return false; if(!typeMatch(c.recruitmentType, f.type)) return false; if(f.search){ const blob=upc([c.name,c.passport,c.iqama,c.nationality,c.position,c.client,c.agency,c.visaCategory].join(' ')); if(!blob.includes(f.search)) return false; } return true; }); }
  function typeLabel(v){ const t=RECRUITMENT_TYPES.find(x=>x.value===v); return t?t.label:(v||''); }
  function typeValue(label){ const L=upc(label); const t=RECRUITMENT_TYPES.find(x=>upc(x.label)===L||upc(x.value)===L); if(t) return t.value; if(L.includes('LOCAL')) return 'LOCAL_TRANSFER'; if(L.includes('ENDORS')) return 'OVERSEAS_ENDORSED'; if(L.includes('SOURC')) return 'OVERSEAS_SOURCED'; if(L.includes('OVERSEAS')) return 'OVERSEAS_SOURCED'; return label; }

  /* ===== column model (candidate) ===== */
  const COLS=[
    {label:'Name',field:'name',type:'text'},
    {label:'Passport',field:'passport',type:'text'},
    {label:'Iqama #',field:'iqama',type:'text'},
    {label:'Nationality',field:'nationality',type:'text'},
    {label:'Position',field:'position',type:'text'},
    {label:'Request Date',field:'requestDate',type:'date'},
    {label:'Client',field:'client',type:'text'},
    {label:'Status',field:'stage',type:'stage'},
    {label:'Type',field:'recruitmentType',type:'type'},
    {label:'Visa Cat.',field:'visaCategory',type:'text'},
    {label:'Agency',field:'agency',type:'text'},
    {label:'Basic',field:'basicSalary',type:'num'},
    {label:'Food',field:'foodAllowance',type:'num'},
    {label:'Housing',field:'housingAllowance',type:'num'},
    {label:'Transport',field:'transportationAllowance',type:'num'},
    {label:'Special',field:'specialAllowance',type:'num'},
    {label:'Total',field:'totalSalary',type:'total'},
  ];
  const SAL_FIELDS=['basicSalary','foodAllowance','housingAllowance','transportationAllowance','specialAllowance'];

  function buildLists(){ $('cvStageList').innerHTML=STAGES.map(s=>'<option value="'+esc(s)+'"></option>').join(''); $('cvTypeList').innerHTML=RECRUITMENT_TYPES.map(t=>'<option value="'+esc(t.label)+'"></option>').join(''); }
  function renderHead(){ $('cvGrid').querySelector('thead').innerHTML='<tr><th>#</th>'+COLS.map(c=>'<th>'+esc(c.label)+'</th>').join('')+'<th></th></tr>'; }

  const tbody=()=>$('cvGrid').querySelector('tbody');
  const gridRows=()=>[...tbody().querySelectorAll('tr')];
  const FIELD_ORDER=()=>COLS.map(c=>c.field);

  function cellInner(col, rec){
    let v=rec?rec[col.field]:'';
    if(col.type==='stage') return '<input data-f="'+esc(col.field)+'" list="cvStageList" value="'+esc(v==null?'':v)+'">';
    if(col.type==='type'){ const disp=typeLabel(v); return '<input data-f="'+esc(col.field)+'" list="cvTypeList" value="'+esc(disp)+'">'; }
    if(col.type==='date') return '<input data-f="'+esc(col.field)+'" class="d" placeholder="dd/mm/yyyy" value="'+esc(v==null?'':v)+'"><span class="cal" title="Pick date">📅</span>';
    if(col.type==='num') return '<input data-f="'+esc(col.field)+'" value="'+esc(v==null?'':v)+'">';
    if(col.type==='total'){ const t=SAL_FIELDS.reduce((s,f)=>s+num(rec?rec[f]:0),0); return '<input data-f="'+esc(col.field)+'" value="'+(t?t.toLocaleString():'')+'" readonly>'; }
    return '<input data-f="'+esc(col.field)+'" value="'+esc(v==null?'':v)+'">';
  }
  function rowHtml(rec, idx){
    const recId=rec&&rec.id?rec.id:'';
    return '<tr data-rec="'+esc(recId)+'"><td class="rownum">'+idx+'</td>'+COLS.map(col=>{
      const cls = col.type==='date'?'date-cell' : (col.type==='num'?'sal' : (col.type==='total'?'sal total':''));
      return '<td class="'+cls+'">'+cellInner(col, rec||{})+'</td>';
    }).join('')+'<td class="rowact"><button type="button" title="Remove">×</button></td></tr>';
  }
  function renumber(){ gridRows().forEach((tr,i)=>{ const c=tr.querySelector('.rownum'); if(c)c.textContent=i+1; }); }
  function updateCount(){ const c=$('cvCount'); if(c) c.textContent=gridRows().length+' record(s)'; }

  function recomputeTotal(tr){ let s=0; SAL_FIELDS.forEach(f=>{ const el=tr.querySelector('[data-f="'+f+'"]'); if(el) s+=num(el.value); }); const t=tr.querySelector('[data-f="totalSalary"]'); if(t) t.value=s?s.toLocaleString():''; }

  function renderRows(recs, done){
    tbody().innerHTML=''; const CHUNK=300; let i=0;
    function step(){ const end=Math.min(i+CHUNK,recs.length); let html=''; for(;i<end;i++) html+=rowHtml(recs[i], i+1); tbody().insertAdjacentHTML('beforeend', html); updateCount(); if(i<recs.length) setTimeout(step,0); else { $('cvLoading').style.display='none'; if(done) done(); } }
    if(!recs.length){ $('cvLoading').style.display='none'; if(done) done(); return; }
    step();
  }
  function addBlankRow(){ tbody().insertAdjacentHTML('beforeend', rowHtml(null, gridRows().length+1)); renumber(); updateCount(); return tbody().lastElementChild; }

  function wireGrid(){
    const grid=$('cvGrid'); if(grid._wired) return; grid._wired=true;
    grid.addEventListener('input',(e)=>{ const el=e.target; if(!el.dataset||!el.dataset.f) return; if(SAL_FIELDS.includes(el.dataset.f)){ recomputeTotal(el.closest('tr')); } });
    grid.addEventListener('keydown',(e)=>{ if(e.key!=='Enter') return; const el=e.target; if(!el.dataset||!el.dataset.f) return; e.preventDefault(); const tr=el.closest('tr'); const rows=gridRows(); const idx=rows.indexOf(tr); const f=el.dataset.f; let next=rows[idx+1]; if(!next) next=addBlankRow(); const t2=next.querySelector('[data-f="'+f+'"]'); if(t2) t2.focus(); });
    grid.addEventListener('click',(e)=>{ const cal=e.target.closest('.cal'); if(cal){ openPicker(cal.closest('td').querySelector('input.d')); return; } const rm=e.target.closest('.rowact button'); if(rm){ rm.closest('tr').remove(); renumber(); updateCount(); } });
    grid.addEventListener('paste', gridPaste, true);
  }
  function openPicker(disp){ if(!disp) return; const p=document.createElement('input'); p.type='date'; p.style.cssText='position:fixed;left:-9999px;'; document.body.appendChild(p); const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec((disp.value||'').trim()); if(m) p.value=m[3]+'-'+m[2]+'-'+m[1]; p.addEventListener('change',()=>{ if(p.value){ const [y,mm,d]=p.value.split('-'); disp.value=d+'/'+mm+'/'+y; disp.dispatchEvent(new Event('input',{bubbles:true})); } p.remove(); }); p.addEventListener('blur',()=>setTimeout(()=>{ if(p.parentNode) p.remove(); },200)); try{ p.showPicker(); }catch(e){ p.focus(); p.click(); } }

  function gridPaste(e){ const target=e.target; if(!target.matches||!target.matches('input')) return; const text=(e.clipboardData||window.clipboardData).getData('text'); if(!text||(!text.includes('\t')&&!text.includes('\n'))) return; e.preventDefault(); e.stopPropagation(); const lines=text.replace(/\r/g,'').split('\n'); while(lines.length&&lines[lines.length-1]==='') lines.pop(); if(!lines.length) return; const startTr=target.closest('tr'); const fo=FIELD_ORDER(); const startCol=fo.indexOf(target.dataset.f); let rows=gridRows(); const startRow=Math.max(0,rows.indexOf(startTr)); const need=startRow+lines.length; if(gridRows().length<need){ let html=''; for(let k=gridRows().length;k<need;k++) html+=rowHtml(null,k+1); tbody().insertAdjacentHTML('beforeend', html); } rows=gridRows(); lines.forEach((line,ri)=>{ const tr=rows[startRow+ri]; if(!tr) return; const cells=line.split('\t'); cells.forEach((raw,ci)=>{ const f=fo[startCol+ci]; if(!f||f==='totalSalary') return; const el=tr.querySelector('[data-f="'+f+'"]'); if(!el) return; el.value=String(raw).trim(); }); recomputeTotal(tr); }); renumber(); updateCount(); Toast().ok('Pasted '+lines.length+' row(s)'); }

  /* ===== open / save / clear / export ===== */
  function openEditor(){
    if(!window.DB){ Toast().err('Database not open'); return; }
    buildLists(); renderHead();
    $('cvOverlay').classList.add('open'); $('cvLoading').style.display='block'; tbody().innerHTML='';
    setTimeout(()=>{ let recs=currentCases(); let note=''; if(recs.length>5000){ note=' (first 5000; refine filters)'; recs=recs.slice(0,5000); } renderRows(recs, ()=>{ if(!gridRows().length){ for(let i=0;i<5;i++) addBlankRow(); } wireGrid(); log('Editor ready: '+recs.length+' case(s)'+note); }); }, 25);
  }
  function closeEditor(){ $('cvOverlay').classList.remove('open'); }
  function readRow(tr){ const o={}; COLS.forEach(col=>{ const el=tr.querySelector('[data-f="'+col.field+'"]'); if(el) o[col.field]=el.value; }); return o; }

  function saveEditor(){
    if(!window.DB){ Toast().err('Database not open'); return; }
    window.DB.recruitmentCases=window.DB.recruitmentCases||[]; const byId={}; window.DB.recruitmentCases.forEach(c=>byId[c.id]=c);
    let updated=0, inserted=0;
    gridRows().forEach(tr=>{
      const vals=readRow(tr);
      /* normalise type + numbers + total */
      if('recruitmentType' in vals) vals.recruitmentType=typeValue(vals.recruitmentType);
      SAL_FIELDS.forEach(f=>{ if(f in vals) vals[f]=num(vals[f]); });
      vals.totalSalary=SAL_FIELDS.reduce((s,f)=>s+num(vals[f]),0);
      const nameHas=String(vals.name||'').trim()!==''; const anyHas=Object.keys(vals).some(k=>k!=='totalSalary'&&String(vals[k]||'').trim()!=='');
      const recId=tr.dataset.rec;
      if(!recId && !anyHas) return;
      if(recId && byId[recId]){ const rec=byId[recId]; let changed=false; COLS.forEach(col=>{ const f=col.field; let nv=vals[f]; if(String(rec[f]==null?'':rec[f])!==String(nv==null?'':nv)){ rec[f]=nv; changed=true; } }); if(changed){ rec.updatedAt=nowIso(); updated++; } }
      else if(nameHas){ const rec={}; COLS.forEach(col=>{ rec[col.field]=vals[col.field]; }); if(!rec.recruitmentType) rec.recruitmentType='LOCAL_TRANSFER'; if(!rec.stage) rec.stage='PENDING OFFER LETTER'; if(!rec.requestDate) rec.requestDate=new Date().toISOString().slice(0,10); rec.id=genCaseId(); rec.createdAt=nowIso(); rec.updatedAt=nowIso(); window.DB.recruitmentCases.push(rec); byId[rec.id]=rec; tr.dataset.rec=rec.id; inserted++; }
    });
    if(typeof window.makeIdCounter==='function'&&window.DB){ try{ window.DB_ID_COUNTER=window.makeIdCounter(window.DB); }catch{} }
    if(window.dbSave){ try{ window.dbSave(); }catch(e){ log('save err '+e.message); } }
    if(window.refreshPipelineView){ try{ window.refreshPipelineView(); }catch{} }
    if(window.Audit&&window.Audit.push){ try{ window.Audit.push('bulk','recruitmentCase',null,null,'View-Data edit: '+updated+' updated, '+inserted+' added'); }catch{} }
    Toast().ok('Saved', updated+' updated · '+inserted+' added'); log('Saved '+updated+' updated, '+inserted+' inserted');
  }
  function genCaseId(){ if(window.DB_ID_COUNTER&&typeof window.DB_ID_COUNTER.nextCase==='number'){ const n=window.DB_ID_COUNTER.nextCase++; return (typeof window.padId==='function')?window.padId('RC',n):('RC-'+String(n).padStart(6,'0')); } const recs=(window.DB&&window.DB.recruitmentCases)||[]; let max=0; recs.forEach(c=>{ const m=/RC-(\d+)/.exec(c.id||''); if(m) max=Math.max(max,parseInt(m[1],10)); }); return 'RC-'+String(max+1).padStart(6,'0'); }

  function clearEditor(){ if(!confirm('Clear the grid? Unsaved edits will be lost. (Saved records are NOT deleted.)')) return; tbody().innerHTML=''; for(let i=0;i<5;i++) addBlankRow(); updateCount(); }

  function exportReport(){ const heads=COLS.map(c=>c.label); const rows=gridRows().map(tr=>{ const vals=readRow(tr); return COLS.map(c=>{ let v=vals[c.field]; if(c.field==='recruitmentType') v=typeLabel(typeValue(v)); return v==null?'':v; }); }); while(rows.length && rows[rows.length-1].every(x=>String(x).trim()==='')) rows.pop(); const bytes=buildXlsx(heads, rows, 'ALL CANDIDATES', 'Candidates'); const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='ALL CANDIDATES.xlsx'; a.click(); URL.revokeObjectURL(url); log('Exported '+rows.length+' candidate rows'); }

  /* ===== button ===== */
  function ensureButton(){ const card=candidatesCard(); if(!card||$('cvViewBtn')) return; const search=[...card.querySelectorAll('input[type="text"],input:not([type])')].find(i=>/search/i.test(i.placeholder||'')); const btn=document.createElement('button'); btn.id='cvViewBtn'; btn.type='button'; btn.textContent='View Data'; btn.addEventListener('click', openEditor); if(search&&search.parentNode){ search.parentNode.insertBefore(btn, search.nextSibling); } else { card.style.position=card.style.position||'relative'; btn.style.position='absolute'; btn.style.top='12px'; btn.style.right='16px'; card.appendChild(btn); } log('View Data button added (R-02)'); }
  setInterval(ensureButton, 800); ensureButton();

  $('cvClose').addEventListener('click', closeEditor);
  $('cvSave').addEventListener('click', saveEditor);
  $('cvClear').addEventListener('click', clearEditor);
  $('cvExport').addEventListener('click', exportReport);
  $('cvAddRow').addEventListener('click', ()=>{ const r=addBlankRow(); r.scrollIntoView({block:'nearest'}); const f=r.querySelector('input'); if(f) f.focus(); });
  $('cvOverlay').addEventListener('click',(e)=>{ if(e.target===$('cvOverlay')) closeEditor(); });

  window._entViewDataR02=openEditor;
  console.log('%c🗂 R-02 View Data editor v'+V+' active','color:#2F5A3B;font-weight:bold;');
})();


(function ViewDataR01V311(){
  'use strict';
  const V='3.1.1';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const nowIso=()=>new Date().toISOString();
  const log=(...a)=>console.log('%c[v3.1.1]','color:#2F5A3B;font-weight:bold',...a);
  const Toast=()=>window.Toast||{ok:console.log,warn:console.warn,err:console.error,info:console.info};

  /* ===== REAL .xlsx generator (blue title/headers, freeze, autofilter, text IDs) ===== */
  const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}return t;})();
  function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
  function sbb(s){return new TextEncoder().encode(s);}
  function ccx(a){let l=0;a.forEach(x=>l+=x.length);const o=new Uint8Array(l);let p=0;a.forEach(x=>{o.set(x,p);p+=x.length;});return o;}
  function u16(n){return new Uint8Array([n&0xFF,(n>>>8)&0xFF]);} function u32(n){return new Uint8Array([n&0xFF,(n>>>8)&0xFF,(n>>>16)&0xFF,(n>>>24)&0xFF]);}
  function zipx(files){const L=[],C=[];let off=0;files.forEach(f=>{const nb=sbb(f.name),crc=crc32(f.data),sz=f.data.length;const loc=ccx([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(sz),u32(sz),u16(nb.length),u16(0),nb,f.data]);L.push(loc);C.push(ccx([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(sz),u32(sz),u16(nb.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off),nb]));off+=loc.length;});const cs=off,cb=ccx(C);const eo=ccx([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cb.length),u32(cs),u16(0)]);return ccx([ccx(L),cb,eo]);}
  function xesc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c]);}
  function xcol(n){let s='';n++;while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26);}return s;}
  function stylesXml(){
    const fonts=['<font><sz val="10"/><name val="Calibri"/></font>','<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>','<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'];
    const fills=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>','<fill><patternFill patternType="solid"><fgColor rgb="FF4F81BD"/><bgColor indexed="64"/></patternFill></fill>'];
    const borders=['<border><left/><right/><top/><bottom/><diagonal/></border>','<border><left style="thin"><color rgb="FF808080"/></left><right style="thin"><color rgb="FF808080"/></right><top style="thin"><color rgb="FF808080"/></top><bottom style="thin"><color rgb="FF808080"/></bottom><diagonal/></border>'];
    const X=[[0,0,0,''],[2,2,1,'center'],[1,2,1,'left'],[0,0,1,'left']];
    const am=(a)=>a?('<alignment horizontal="'+a+'" vertical="center"/>'):'<alignment vertical="center"/>';
    const xfs=X.map(([fo,fi,bo,al])=>'<xf numFmtId="49" fontId="'+fo+'" fillId="'+fi+'" borderId="'+bo+'" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" applyNumberFormat="1">'+am(al)+'</xf>');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="'+fonts.length+'">'+fonts.join('')+'</fonts><fills count="'+fills.length+'">'+fills.join('')+'</fills><borders count="'+borders.length+'">'+borders.join('')+'</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="'+xfs.length+'">'+xfs.join('')+'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  }
  function sheetXml(heads,rows,title){
    const nc=heads.length; const cell=(r,c,s,v)=>'<c r="'+xcol(c)+r+'" s="'+s+'" t="inlineStr"><is><t xml:space="preserve">'+xesc(v)+'</t></is></c>';
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
    const files=[{name:'[Content_Types].xml',data:sbb(ct)},{name:'_rels/.rels',data:sbb(rels)},{name:'xl/workbook.xml',data:sbb(wb)},{name:'xl/_rels/workbook.xml.rels',data:sbb(wbr)},{name:'xl/styles.xml',data:sbb(stylesXml())},{name:'xl/worksheets/sheet1.xml',data:sbb(sheetXml(heads,rows,title))}];
    return zipx(files);
  }

  /* ===== R-01 table + filters ===== */
  function visaPanel(){ const p=$('panel-visa')||$('panel-r01'); if(p) return p; const h=[...document.querySelectorAll('*')].find(x=>/all visa records/i.test(x.textContent||'')&&x.children.length<40); return h?h.closest('.panel, section')||h.parentElement:null; }
  function recordsCard(){ const h=[...document.querySelectorAll('h1,h2,h3,h4,div,span,p')].find(x=>/all visa records/i.test(x.textContent||'')&&x.children.length<=6&&x.getBoundingClientRect().height<90); return h?(h.closest('.card, section, div[style*="border"]')||h.parentElement):null; }
  function visaTable(){ const p=visaPanel(); if(!p) return null; return [...p.querySelectorAll('table')].find(t=>{ const hs=[...t.querySelectorAll('th')].map(th=>upc(th.textContent)); return hs.some(h=>h.includes('VISA DOC'))&&hs.some(h=>h.includes('STATUS')); }); }
  function labelVal(labels){ const panel=visaPanel()||document; for(const w of panel.querySelectorAll('label,.field,div')){ const lt=upc(w.textContent||''); if(labels.some(L=>lt.startsWith(L))){ const ctl=w.querySelector('select,input')||(w.nextElementSibling&&w.nextElementSibling.matches&&w.nextElementSibling.matches('select,input')?w.nextElementSibling:null); if(ctl){ const val=upc(ctl.value); if(val&&val!=='ALL'&&val!=='') return val; return ''; } } } return ''; }
  function readFilters(){ const out={}; out.nationality=labelVal(['NATIONALITY']); out.category=labelVal(['CATEGORY','VISA CATEGORY']); out.client=labelVal(['CLIENT']); out.agency=labelVal(['AGENCY']); out.status=labelVal(['STATUS']); out.sponsor=labelVal(['SPONSOR']); out.gender=labelVal(['GENDER']); const panel=visaPanel()||document; const sb=[...panel.querySelectorAll('input[type="text"],input:not([type])')].find(i=>/search/i.test(i.placeholder||'')); out.search=sb?upc(sb.value):''; return out; }
  function currentVisas(){ const all=(window.DB&&window.DB.visaRecords)||[]; const f=readFilters(); return all.filter(v=>{ if(f.nationality&&upc(v.nationality)!==f.nationality) return false; if(f.category&&upc(v.visaCategory)!==f.category) return false; if(f.client&&upc(v.client)!==f.client) return false; if(f.agency&&upc(v.registeredAgencyName)!==f.agency) return false; if(f.status&&upc(v.statusVisa)!==f.status) return false; if(f.sponsor&&upc(v.sponsor)!==f.sponsor) return false; if(f.gender&&upc(v.gender)!==f.gender) return false; if(f.search){ const blob=upc([v.fullName,v.passport,v.visaDocumentNumber,v.sponsorId,v.crNumber,v.nationality,v.visaCategory,v.stampingCity,v.client,v.registeredAgencyName].join(' ')); if(!blob.includes(f.search)) return false; } return true; }); }

  /* ===== columns ===== */
  function deriveField(headerText){
    const H=upc(headerText);
    const map=[[['CANDIDATE','NAME'],'fullName','text'],[['VISA DOC'],'visaDocumentNumber','text'],[['SPONSOR ID'],'sponsorId','text'],[['CR NUMBER','CR #'],'crNumber','text'],[['CATEGORY'],'visaCategory','text'],[['NATIONALITY'],'nationality','text'],[['STAMPING'],'stampingCity','text'],[['GENDER'],'gender','text'],[['QIWA VISA DATE','QIWA DATE'],'qiwaVisaDate','date'],[['QIWA EXPIRATION','QIWA EXP'],'expirationDate','date'],[['CAND. VISA ISSUANCE','VISA ISSUANCE','ISSUANCE'],'candVisaIssuance','date'],[['CAND. VISA EXPIRATION','VISA EXPIRATION'],'candVisaExpiration','date'],[['AGENCY'],'registeredAgencyName','text'],[['PASSPORT'],'passport','text'],[['MOFA'],'mofaNumber','text'],[['VISA NUMBER'],'visaNumber','text'],[['STATUS'],'statusVisa','status'],[['CLIENT'],'client','text'],[['LINKED CASE','LINKED'],'linkedRecruitmentCaseId','linkedcase'],[['SPONSOR '],'sponsor','text']];
    for(const [keys,field,type] of map){ if(keys.some(k=>H.includes(k))) return {field,type}; }
    const type=/DATE|EXPIR|ISSUANCE/.test(H)?'date':'text';
    const field=headerText.trim().toLowerCase().replace(/[^a-z0-9]+(.)/g,(m,c)=>c.toUpperCase()).replace(/[^a-zA-Z0-9]/g,'');
    return {field:field||('col_'+Math.random().toString(36).slice(2,6)), type};
  }
  function buildColumns(){
    const t=visaTable(); const cols=[];
    if(t){ [...t.querySelectorAll('thead th')].forEach(th=>{ const label=th.textContent.trim(); const U=upc(label); if(!label) return; if(U==='ACTIONS'||U==='ACTION') return; if(th.querySelector('input[type="checkbox"]')) return; const {field,type}=deriveField(label); cols.push({label,field,type}); }); }
    if(!cols.length){ [['Candidate','fullName','text'],['Visa Doc #','visaDocumentNumber','text'],['Sponsor ID','sponsorId','text'],['CR Number','crNumber','text'],['Category','visaCategory','text'],['Nationality','nationality','text'],['Stamping City','stampingCity','text'],['Gender','gender','text'],['Qiwa Visa Date','qiwaVisaDate','date'],['Qiwa Expiration','expirationDate','date'],['Agency','registeredAgencyName','text'],['Passport','passport','text'],['Status','statusVisa','status'],['Client','client','text'],['Linked Case','linkedRecruitmentCaseId','linkedcase']].forEach(([label,field,type])=>cols.push({label,field,type})); }
    return cols;
  }
  function statusOptionsList(){ const set=new Set(['UNUSED','ALLOCATED','USED','EXPIRED','CANCELLED']); ((window.DB&&window.DB.visaRecords)||[]).forEach(v=>{ if(v.statusVisa) set.add(upc(v.statusVisa)); }); return [...set]; }
  function caseList(){ const cases=(window.DB&&window.DB.recruitmentCases)||[]; return cases.map(c=>({id:c.id, label:(c.name||'(no name)')+' — '+c.id, passport:upc(c.passport).replace(/\s/g,'')})); }

  /* ===== grid state ===== */
  let COLS=[]; let CASES=[]; let CASE_BY_ID={}; let CASE_BY_PASS={}; let CASE_BY_LABEL={};
  const FIELD_ORDER=()=>COLS.map(c=>c.field);
  const tbody=()=>$('vdGrid').querySelector('tbody');
  const gridRows=()=>[...tbody().querySelectorAll('tr')];

  function buildLists(){
    CASES=caseList(); CASE_BY_ID={}; CASE_BY_PASS={}; CASE_BY_LABEL={};
    CASES.forEach(c=>{ CASE_BY_ID[c.id]=c; if(c.passport) CASE_BY_PASS[c.passport]=c; CASE_BY_LABEL[upc(c.label)]=c; });
    /* ONE shared datalist for linked cases */
    $('vdCaseList').innerHTML=CASES.map(c=>'<option value="'+esc(c.label)+'"></option>').join('');
    /* ONE shared datalist for statuses */
    $('vdStatusList').innerHTML=statusOptionsList().map(s=>'<option value="'+esc(s)+'"></option>').join('');
  }

  function renderHead(){ $('vdGrid').querySelector('thead').innerHTML='<tr><th>#</th>'+COLS.map(c=>'<th>'+esc(c.label)+'</th>').join('')+'<th></th></tr>'; }

  function cellInner(col, val){
    val=val==null?'':val;
    if(col.type==='status') return '<input data-f="'+esc(col.field)+'" list="vdStatusList" value="'+esc(val)+'">';
    if(col.type==='linkedcase'){ const disp = val && CASE_BY_ID[val] ? CASE_BY_ID[val].label : val; return '<input data-f="'+esc(col.field)+'" list="vdCaseList" value="'+esc(disp)+'">'; }
    if(col.type==='date') return '<input data-f="'+esc(col.field)+'" class="d" placeholder="dd/mm/yyyy" value="'+esc(val)+'"><span class="cal" title="Pick date">📅</span>';
    return '<input data-f="'+esc(col.field)+'" value="'+esc(val)+'">';
  }
  function rowHtml(rec, idx){
    const recId=rec&&rec.id?rec.id:'';
    let linkedAuto=false;
    return '<tr data-rec="'+esc(recId)+'"><td class="rownum">'+idx+'</td>'+COLS.map(col=>{
      let v=rec?rec[col.field]:'';
      let tdcls=col.type==='date'?'date-cell':(col.type==='linkedcase'?'linked':'');
      if(col.type==='linkedcase' && (!v) && rec){ const c=CASE_BY_PASS[upc(rec.passport).replace(/\s/g,'')]; if(c){ v=c.id; tdcls+=' auto'; } }
      return '<td class="'+tdcls+'">'+cellInner(col, v)+'</td>';
    }).join('')+'<td class="rowact"><button type="button" title="Remove">×</button></td></tr>';
  }

  function renumber(){ gridRows().forEach((tr,i)=>{ const c=tr.querySelector('.rownum'); if(c)c.textContent=i+1; }); }
  function updateCount(){ const c=$('vdCount'); if(c) c.textContent=gridRows().length+' record(s)'; }

  /* ===== chunked render (keeps UI responsive) ===== */
  function renderRows(recs, done){
    tbody().innerHTML='';
    const CHUNK=300; let i=0;
    function step(){
      const end=Math.min(i+CHUNK, recs.length);
      let html='';
      for(; i<end; i++){ html+=rowHtml(recs[i], i+1); }
      tbody().insertAdjacentHTML('beforeend', html);
      updateCount();
      if(i<recs.length){ setTimeout(step, 0); }   /* yield to keep responsive */
      else { $('vdLoading').style.display='none'; if(done) done(); }
    }
    if(!recs.length){ $('vdLoading').style.display='none'; if(done) done(); return; }
    step();
  }
  function addBlankRow(){ tbody().insertAdjacentHTML('beforeend', rowHtml(null, gridRows().length+1)); renumber(); updateCount(); return tbody().lastElementChild; }

  /* ===== EVENT DELEGATION on the grid ===== */
  function wireGrid(){
    const grid=$('vdGrid');
    if(grid._wired) return; grid._wired=true;
    /* auto-link when passport changes */
    grid.addEventListener('input',(e)=>{ const el=e.target; if(el.dataset&&el.dataset.f==='passport'){ const tr=el.closest('tr'); const lc=tr&&tr.querySelector('[data-f="linkedRecruitmentCaseId"]'); if(lc && !lc.value.trim()){ const c=CASE_BY_PASS[upc(el.value).replace(/\s/g,'')]; if(c){ lc.value=c.label; lc.closest('td').classList.add('auto'); } } } });
    /* Enter → next row same column */
    grid.addEventListener('keydown',(e)=>{ if(e.key!=='Enter') return; const el=e.target; if(!el.dataset||!el.dataset.f) return; e.preventDefault(); const tr=el.closest('tr'); const rows=gridRows(); const idx=rows.indexOf(tr); const f=el.dataset.f; let next=rows[idx+1]; if(!next){ next=addBlankRow(); } const t2=next.querySelector('[data-f="'+f+'"]'); if(t2) t2.focus(); });
    /* click: calendar or remove */
    grid.addEventListener('click',(e)=>{
      const cal=e.target.closest('.cal');
      if(cal){ const td=cal.closest('td'); const inp=td.querySelector('input.d'); openPicker(inp); return; }
      const rm=e.target.closest('.rowact button');
      if(rm){ const tr=rm.closest('tr'); tr.remove(); renumber(); updateCount(); return; }
    });
    /* paste (capture) */
    grid.addEventListener('paste', gridPaste, true);
  }

  /* temporary date picker (created on demand — NOT one per row) */
  function openPicker(dispInput){
    if(!dispInput) return;
    const p=document.createElement('input'); p.type='date'; p.style.cssText='position:fixed;left:-9999px;';
    document.body.appendChild(p);
    /* seed with current dd/mm/yyyy if valid */
    const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dispInput.value.trim()); if(m){ p.value=m[3]+'-'+m[2]+'-'+m[1]; }
    p.addEventListener('change',()=>{ if(p.value){ const [y,mm,d]=p.value.split('-'); dispInput.value=d+'/'+mm+'/'+y; dispInput.dispatchEvent(new Event('input',{bubbles:true})); } p.remove(); });
    p.addEventListener('blur',()=>setTimeout(()=>{ if(p.parentNode) p.remove(); },200));
    try{ p.showPicker(); }catch(e){ p.focus(); p.click(); }
  }

  function gridPaste(e){
    const target=e.target; if(!target.matches||!target.matches('input')) return;
    const text=(e.clipboardData||window.clipboardData).getData('text');
    if(!text || (!text.includes('\t')&&!text.includes('\n'))) return;
    e.preventDefault(); e.stopPropagation();
    const lines=text.replace(/\r/g,'').split('\n'); while(lines.length&&lines[lines.length-1]==='') lines.pop(); if(!lines.length) return;
    const startTr=target.closest('tr'); const fo=FIELD_ORDER(); const startCol=fo.indexOf(target.dataset.f);
    let rows=gridRows(); const startRow=Math.max(0, rows.indexOf(startTr));
    const need=startRow+lines.length;
    /* grow rows in one batch */
    if(gridRows().length<need){ let html=''; for(let k=gridRows().length;k<need;k++) html+=rowHtml(null,k+1); tbody().insertAdjacentHTML('beforeend', html); }
    rows=gridRows();
    lines.forEach((line,ri)=>{ const tr=rows[startRow+ri]; if(!tr) return; const cells=line.split('\t'); cells.forEach((raw,ci)=>{ const f=fo[startCol+ci]; if(!f) return; const el=tr.querySelector('[data-f="'+f+'"]'); if(!el) return; el.value=String(raw).trim(); }); });
    renumber(); updateCount(); Toast().ok('Pasted '+lines.length+' row(s)');
  }

  /* ===== open / save / clear / export ===== */
  function openEditor(){
    if(!window.DB){ Toast().err('Database not open'); return; }
    COLS=buildColumns(); buildLists(); renderHead();
    $('vdOverlay').classList.add('open');
    $('vdLoading').style.display='block'; tbody().innerHTML='';
    /* defer heavy work so overlay paints first */
    setTimeout(()=>{
      let recs=currentVisas();
      let note='';
      if(recs.length>5000){ note=' (showing first 5000; refine filters for fewer)'; recs=recs.slice(0,5000); }
      renderRows(recs, ()=>{ if(!gridRows().length){ for(let i=0;i<5;i++) addBlankRow(); } wireGrid(); log('Editor ready: '+recs.length+' row(s), '+COLS.length+' cols'+note); });
      const sub=$('vdCount'); if(sub&&note) sub.textContent=recs.length+' record(s)'+note;
    }, 30);
  }
  function closeEditor(){ $('vdOverlay').classList.remove('open'); }

  function readRow(tr){ const o={}; COLS.forEach(col=>{ const el=tr.querySelector('[data-f="'+col.field+'"]'); if(el) o[col.field]=el.value; }); return o; }
  function resolveLinked(v){ if(!v) return ''; const t=upc(v); if(CASE_BY_LABEL[t]) return CASE_BY_LABEL[t].id; const m=/([A-Z]+-\d+)/.exec(t); if(m && CASE_BY_ID[m[1]]) return m[1]; if(CASE_BY_ID[v]) return v; return v; }

  function saveEditor(){
    if(!window.DB){ Toast().err('Database not open'); return; }
    window.DB.visaRecords=window.DB.visaRecords||[];
    const byId={}; window.DB.visaRecords.forEach(v=>byId[v.id]=v);
    let updated=0, inserted=0;
    gridRows().forEach(tr=>{
      const vals=readRow(tr);
      if('linkedRecruitmentCaseId' in vals) vals.linkedRecruitmentCaseId=resolveLinked(vals.linkedRecruitmentCaseId);
      const hasAny=Object.values(vals).some(v=>String(v||'').trim()!=='');
      const recId=tr.dataset.rec;
      if(!recId && !hasAny) return;
      if(recId && byId[recId]){ const rec=byId[recId]; let changed=false; COLS.forEach(col=>{ if(col.field in vals){ const nv=vals[col.field]; if(String(rec[col.field]==null?'':rec[col.field])!==String(nv==null?'':nv)){ rec[col.field]=nv; changed=true; } } }); if(changed){ rec.updatedAt=nowIso(); updated++; } }
      else if(hasAny){ const rec={}; COLS.forEach(col=>{ rec[col.field]=vals[col.field]; }); rec.id=genVisaId(); rec.createdAt=nowIso(); rec.updatedAt=nowIso(); window.DB.visaRecords.push(rec); byId[rec.id]=rec; tr.dataset.rec=rec.id; inserted++; }
    });
    if(typeof window.makeIdCounter==='function'&&window.DB){ try{ window.DB_ID_COUNTER=window.makeIdCounter(window.DB); }catch{} }
    if(window.dbSave){ try{ window.dbSave(); }catch(e){ log('save err '+e.message); } }
    if(window.refreshVisaView){ try{ window.refreshVisaView(); }catch{} }
    if(window.Audit&&window.Audit.push){ try{ window.Audit.push('bulk','visaRecord',null,null,'View-Data edit: '+updated+' updated, '+inserted+' added'); }catch{} }
    Toast().ok('Saved', updated+' updated · '+inserted+' added'); log('Saved '+updated+' updated, '+inserted+' inserted');
  }
  function genVisaId(){ if(window.DB_ID_COUNTER&&typeof window.DB_ID_COUNTER.nextVisa==='number'){ const n=window.DB_ID_COUNTER.nextVisa++; return (typeof window.padId==='function')?window.padId('V',n):('V-'+String(n).padStart(6,'0')); } const recs=(window.DB&&window.DB.visaRecords)||[]; let max=0; recs.forEach(v=>{ const m=/(\d+)/.exec(v.id||''); if(m) max=Math.max(max,parseInt(m[1],10)); }); return 'V-'+String(max+1).padStart(6,'0'); }

  function clearEditor(){ if(!confirm('Clear the grid? Unsaved edits will be lost. (Saved records are NOT deleted.)')) return; tbody().innerHTML=''; for(let i=0;i<5;i++) addBlankRow(); updateCount(); }

  function exportReport(){
    const heads=COLS.map(c=>c.label);
    const rows=gridRows().map(tr=>{ const vals=readRow(tr); return COLS.map(c=>{ let v=vals[c.field]; if(c.field==='linkedRecruitmentCaseId'&&v){ const id=resolveLinked(v); const cse=CASE_BY_ID[id]; if(cse) v=cse.label; } return v==null?'':v; }); });
    while(rows.length && rows[rows.length-1].every(x=>String(x).trim()==='')) rows.pop();
    const bytes=buildXlsx(heads, rows, 'ALL VISA RECORDS', 'Visa Records');
    const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='ALL VISA RECORDS.xlsx'; a.click(); URL.revokeObjectURL(url);
    log('Exported ALL VISA RECORDS.xlsx ('+rows.length+' rows)');
  }

  /* ===== button ===== */
  function ensureButton(){
    const card=recordsCard(); if(!card||$('vdViewBtn')) return;
    const search=[...card.querySelectorAll('input[type="text"],input:not([type])')].find(i=>/search/i.test(i.placeholder||''));
    const btn=document.createElement('button'); btn.id='vdViewBtn'; btn.type='button'; btn.textContent='View Data'; btn.addEventListener('click', openEditor);
    if(search && search.parentNode){ search.parentNode.insertBefore(btn, search.nextSibling); }
    else { card.style.position=card.style.position||'relative'; btn.style.position='absolute'; btn.style.top='12px'; btn.style.right='16px'; card.appendChild(btn); }
    log('View Data button added');
  }
  setInterval(ensureButton, 800); ensureButton();

  $('vdClose').addEventListener('click', closeEditor);
  $('vdSave').addEventListener('click', saveEditor);
  $('vdClear').addEventListener('click', clearEditor);
  $('vdExport').addEventListener('click', exportReport);
  $('vdAddRow').addEventListener('click', ()=>{ const r=addBlankRow(); r.scrollIntoView({block:'nearest'}); const f=r.querySelector('input'); if(f) f.focus(); });
  $('vdOverlay').addEventListener('click',(e)=>{ if(e.target===$('vdOverlay')) closeEditor(); });

  window._entViewData=openEditor;
  console.log('%c🗂 R-01 View Data editor (crash-fixed) v'+V+' active','color:#2F5A3B;font-weight:bold;');
})();

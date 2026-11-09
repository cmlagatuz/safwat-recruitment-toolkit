
/* =========================================================
   FIX 1 — paste: blank cells in Excel must paste as blank
   ========================================================= */
(function PasteBlankFixV401(){
  'use strict';
  if(window.__entPasteBlankV401) return; window.__entPasteBlankV401=true;
  const pad=(n)=>String(n).padStart(2,'0');
  const log=(...a)=>console.log('%c[v4.0.1 Paste]','color:#2E6FA3;font-weight:bold',...a);
  const Toast=()=>window.Toast||{ok:console.log,warn:console.warn,err:console.error};

  const DATE_FIELDS=new Set(['selectionDate','dateOfferSent','dateOfferSigned','dateMedicalOutset','dateMedicalResult',
    'dateSvpOutset','dateSvpResult','dateBioOutset','dateBioResult','dateArrivalKsa','dateArrivedAccommodation','dateWorkStarted']);

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

  /* capture BEFORE the v4.0.0 handler so this one wins */
  document.addEventListener('paste', function(e){
    const inp=e.target;
    if(!inp||!inp.dataset||!DATE_FIELDS.has(inp.dataset.f)) return;
    const grid=document.getElementById('cvGrid');
    if(!grid||!grid.contains(inp)) return;

    const text=(e.clipboardData||window.clipboardData).getData('text');
    if(text==null) return;
    e.preventDefault();
    e.stopImmediatePropagation();          /* supersede the older paste handler */

    const lines=String(text).replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
    /* drop a single trailing newline artefact but KEEP genuine blank rows in the middle */
    if(lines.length>1 && lines[lines.length-1]==='') lines.pop();
    const rows=lines.map(l=>l.split('\t'));

    /* single cell → straight write (blank clears) */
    if(rows.length===1 && rows[0].length===1){
      inp.value=parseDateCell(rows[0][0]);
      inp.dispatchEvent(new Event('input',{bubbles:true}));
      inp.dispatchEvent(new Event('change',{bubbles:true}));
      return;
    }

    const startTd=inp.closest('td'), startTr=inp.closest('tr'); if(!startTd||!startTr) return;
    const allTrs=[...grid.querySelectorAll('tbody tr')];
    const rIdx=allTrs.indexOf(startTr);
    const cIdx=[...startTr.children].indexOf(startTd);

    /* KEY FIX: use the widest clipboard row, and write EVERY column in that span.
       A missing cell (Excel omitted it) or an empty cell both write BLANK. */
    const width=Math.max.apply(null, rows.map(r=>r.length));
    let written=0, cleared=0;

    rows.forEach((cells,ri)=>{
      const tr=allTrs[rIdx+ri]; if(!tr) return;
      for(let ci=0; ci<width; ci++){
        const td=tr.children[cIdx+ci]; if(!td) continue;
        const target=td.querySelector('input[data-f]'); if(!target) continue;
        if(!DATE_FIELDS.has(target.dataset.f)) continue;     /* never spill outside date columns */
        const raw = (ci < cells.length) ? cells[ci] : '';     /* omitted → blank */
        const val = parseDateCell(raw);
        if(target.value!==val){
          target.value=val;
          target.dispatchEvent(new Event('input',{bubbles:true}));
          td.classList.remove('pd-flash'); void td.offsetWidth; td.classList.add('pd-flash');
        }
        written++; if(val==='') cleared++;
      }
    });
    if(written) { Toast().ok('Pasted', written+' cell(s)'+(cleared?(' · '+cleared+' cleared'):'')); log('pasted '+written+' cells ('+cleared+' blank)'); }
  }, true);

  console.log('%c📋 Paste blank-cell fix v4.0.1 — empty Excel cells now paste as blank','color:#2E6FA3;font-weight:bold;');
})();

/* =========================================================
   FIX 2 — Bulk Edit: add the 3 missing pipeline dates
   ========================================================= */
(function BulkEditDatesV401(){
  'use strict';
  if(window.__entBulkDatesV401) return; window.__entBulkDatesV401=true;
  const $=(id)=>document.getElementById(id);
  const log=(...a)=>console.log('%c[v4.0.1 BulkDates]','color:#2F5A3B;font-weight:bold',...a);
  const Toast=()=>window.Toast||{ok:console.log,warn:console.warn,err:console.error};
  const nowIso=()=>new Date().toISOString();

  const NEW_FIELDS=[
    ['dateArrivalKsa','Arrival in KSA'],
    ['dateArrivedAccommodation','Arrived in Accommodation'],
    ['dateWorkStarted','Work Started to Client'],
  ];

  /* find the open bulk-edit dialog (v2.9.36 uses #pipeBulkOverlay / pbe_* ids) */
  function bulkOverlay(){
    const ov=$('pipeBulkOverlay');
    if(ov && ov.classList.contains('open')) return ov;
    /* fallback: any visible container that has the pipeline-date fields */
    const probe=$('pbe_dateBioResult')||$('pbe_dateOfferSent');
    return probe?probe.closest('.ent-ov, .overlay, div[id*="Overlay"]')||probe.closest('div'):null;
  }
  function pipelineSection(ov){
    if(!ov) return null;
    /* the section whose heading says "Pipeline dates" */
    const heads=[...ov.querySelectorAll('h3,h4,legend,div,span')];
    const h=heads.find(x=>/pipeline dates/i.test((x.textContent||'').trim()) && x.children.length<=2);
    if(h){ return h.closest('.ent-cg, .rc-sec, fieldset, section, div'); }
    const anchor=$('pbe_dateBioResult')||$('pbe_dateBioOutset');
    return anchor?anchor.closest('.ent-cg, .rc-sec, fieldset, section, div'):null;
  }

  function injectFields(){
    const ov=bulkOverlay(); if(!ov) return;
    if(ov.querySelector('#pbe_dateWorkStarted')) return;      /* already injected */
    const sec=pipelineSection(ov); if(!sec) return;

    const wrap=document.createElement('div');
    wrap.className='v401-bulk-row';
    wrap.innerHTML=NEW_FIELDS.map(([f,label])=>
      '<div class="v401-bulk-cell">'+
        '<input type="checkbox" id="pbe_use_'+f+'">'+
        '<label for="pbe_use_'+f+'">'+label+':</label>'+
        '<input type="date" id="pbe_'+f+'" disabled>'+
      '</div>').join('');
    sec.appendChild(wrap);

    /* enable the date input only when its checkbox is ticked (matches existing behaviour) */
    NEW_FIELDS.forEach(([f])=>{
      const cb=$('pbe_use_'+f), inp=$('pbe_'+f);
      if(cb&&inp&&!cb.dataset.v401){ cb.dataset.v401='1';
        cb.addEventListener('change',()=>{ inp.disabled=!cb.checked; if(cb.checked) inp.focus(); });
      }
    });
    hookApply(ov);
    log('added 3 pipeline date fields to Bulk Edit');
  }

  /* after the existing Apply runs, write our 3 fields to the selected records */
  function selectedRecords(){
    /* v2.9.36 exposes the frozen selection; fall back to ticked rows */
    try{ if(typeof window._entBulkSelected==='function'){ const r=window._entBulkSelected(); if(Array.isArray(r)&&r.length) return r; } }catch(e){}
    const ids=new Set();
    document.querySelectorAll('#panel-pipeline tbody tr, #pipelineDashboard tbody tr').forEach(tr=>{
      const cb=tr.querySelector('input[type="checkbox"]'); if(!cb||!cb.checked) return;
      const txt=tr.innerHTML.match(/RC-\d{3,}/); if(txt) ids.add(txt[0]);
    });
    const C=(window.DB&&window.DB.recruitmentCases)||[];
    return C.filter(c=>ids.has(c.id));
  }
  function hookApply(ov){
    const btn=ov.querySelector('#pbe_apply')||[...ov.querySelectorAll('button')].find(b=>/^apply/i.test((b.textContent||'').trim()));
    if(!btn||btn.dataset.v401apply==='1') return; btn.dataset.v401apply='1';
    btn.addEventListener('click', ()=>{
      /* capture values NOW (the dialog closes right after) */
      const picks=[];
      NEW_FIELDS.forEach(([f])=>{ const cb=$('pbe_use_'+f), inp=$('pbe_'+f); if(cb&&cb.checked) picks.push([f, inp?inp.value:'']); });
      if(!picks.length) return;
      const recs=selectedRecords();
      setTimeout(()=>{
        if(!recs.length){ log('no selected records found for the extra date fields'); return; }
        let n=0;
        recs.forEach(rec=>{ picks.forEach(([f,v])=>{ const next=v||null; if(String(rec[f]==null?'':rec[f])!==String(next==null?'':next)){ rec[f]=next; n++; } }); rec.updatedAt=nowIso(); });
        if(n>0){
          try{ if(window.dbSave) window.dbSave(); }catch(e){}
          try{ if(window.Audit&&window.Audit.push) window.Audit.push('bulk','recruitmentCase',null,null,'Bulk set '+picks.map(p=>p[0]).join(', ')+' on '+recs.length+' candidate(s)'); }catch(e){}
          try{ if(window.refreshPipelineView) window.refreshPipelineView(); }catch(e){}
          Toast().ok('Dates applied', n+' field(s) on '+recs.length+' candidate(s)');
          log('applied '+n+' extra date field(s) to '+recs.length+' record(s)');
        }
      }, 60);   /* run just after the base Apply finishes */
    }, false);
  }

  function tick(){ injectFields(); }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('r02.bulkDates', tick, 600); }
  else { setInterval(tick, 600); }
  tick();

  console.log('%c🗓 Bulk Edit pipeline dates v4.0.1 — Arrival in KSA · Accommodation · Work Started','color:#2F5A3B;font-weight:bold;');
})();

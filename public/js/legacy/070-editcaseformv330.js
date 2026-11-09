
(function EditCaseFormV330(){
  'use strict';
  const V='3.3.0';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const num=(x)=>{const n=parseFloat(String(x).replace(/[^0-9.\-]/g,''));return isNaN(n)?0:n;};
  const nowIso=()=>new Date().toISOString();
  const log=(...a)=>console.log('%c[v3.3.0]','color:#2F5A3B;font-weight:bold',...a);
  const Toast=()=>window.Toast||{ok:console.log,warn:console.warn,err:console.error,info:console.info};

  const RECRUITMENT_TYPES=[{value:'LOCAL_TRANSFER',label:'Local Transfer',overseas:false},{value:'OVERSEAS_ENDORSED',label:'Overseas – Endorsed',overseas:true},{value:'OVERSEAS_SOURCED',label:'Overseas – Sourced',overseas:true}];
  const isOverseas=(v)=>{const t=RECRUITMENT_TYPES.find(x=>x.value===v);return t?t.overseas:false;};
  const isLocal=(v)=>v==='LOCAL_TRANSFER';
  const STAGES=['PENDING OFFER LETTER','OFFER SIGNING','FOR MEDICAL APPOINTMENT','MEDICAL ON PROGRESS','FOR SKILLS VERIFICATION APPOINTMENT','SVP/QVP ON PROGRESS','FOR BIOMETRICS APPOINTMENT','Biometrics in Progress and Consular Submission','Visa Issued','DEPLOYED','ON HOLD','WITHDRAWN/BACKOUT','UNFIT','REJECTED','CANCELLED','AWOL','TERMINATED','END OF SERVICE'];

  const PIPELINE_DATES=[
    ['requestDate','Request Date'],['selectionDate','Selection Date'],
    ['dateOfferSent','Offer Sent'],['dateOfferSigned','Offer Signed'],
    ['dateMedicalOutset','Medical Outset'],['dateMedicalResult','Medical Result'],
    ['dateSvpOutset','SVP/QVP Outset'],['dateSvpResult','SVP/QVP Result'],
    ['dateBioOutset','Biometrics Outset'],['dateBioResult','Biometrics Result'],
    ['dateArrivalKsa','Arrival in KSA'],['dateArrivedAccommodation','Arrived in Accommodation'],
    ['dateWorkStarted','Work Started to Client']
  ];
  const SAL_FIELDS=[['basicSalary','Basic'],['foodAllowance','Food'],['housingAllowance','Housing'],['transportationAllowance','Transport'],['specialAllowance','Special']];

  /* ===== datalists ===== */
  function uniq(arr){ return [...new Set(arr.filter(Boolean).map(x=>String(x).trim()))].sort((a,b)=>a.localeCompare(b)); }
  function optionsHtml(id, items){ return '<datalist id="'+id+'">'+items.map(v=>'<option value="'+esc(v)+'">').join('')+'</datalist>'; }
  function dataListsHtml(){
    const cases=(window.DB&&window.DB.recruitmentCases)||[]; const visas=(window.DB&&window.DB.visaRecords)||[];
    const clients=uniq(cases.map(c=>c.client).concat(visas.map(v=>v.client)));
    const positions=uniq(cases.map(c=>c.position));
    const nats=uniq(cases.map(c=>c.nationality).concat(visas.map(v=>v.nationality)));
    const agencies=uniq(cases.map(c=>c.agency).concat(visas.map(v=>v.registeredAgencyName)));
    const cats=uniq(visas.map(v=>v.visaCategory).concat(cases.map(c=>c.visaCategory)));
    return optionsHtml('rc_clients',clients)+optionsHtml('rc_positions',positions)+optionsHtml('rc_nats',nats)+optionsHtml('rc_agencies',agencies)+optionsHtml('rc_cats',cats);
  }

  /* ===== field builders ===== */
  function field(label, id, opts){ opts=opts||{}; const list=opts.list?(' list="'+opts.list+'"'):''; const ro=opts.readonly?' readonly':''; const ph=opts.ph?(' placeholder="'+esc(opts.ph)+'"'):''; const req=opts.req?' <span class="req">*</span>':''; const type=opts.type||'text'; return '<div class="rc-field'+(opts.sal?' rc-sal-suffix':'')+'"><label>'+esc(label)+req+'</label><input id="'+id+'" type="'+type+'"'+list+ro+ph+'></div>'; }
  function selectField(label, id, options, selValue){ return '<div class="rc-field"><label>'+esc(label)+'</label><select id="'+id+'">'+options.map(o=>{ const val=(typeof o==='object')?o.value:o; const lab=(typeof o==='object')?o.label:o; return '<option value="'+esc(val)+'"'+(upc(val)===upc(selValue||'')?' selected':'')+'>'+esc(lab)+'</option>'; }).join('')+'</select></div>'; }
  function dateField(id, label){ return '<div class="rc-field"><label>'+esc(label)+'</label><input id="'+id+'" type="date"></div>'; }

  /* ===== render form ===== */
  let CURRENT=null;   /* the record being edited (live DB object or a new blank) */

  function buildForm(rec){
    return dataListsHtml()+
      /* CANDIDATE PROFILE */
      '<div class="rc-sec"><h3>Candidate Profile</h3><div class="rc-grid">'+
        field('Name','rc_name',{req:true})+
        field('Nationality','rc_nationality',{list:'rc_nats'})+
        field('Passport #','rc_passport')+
        field('Position','rc_position',{list:'rc_positions'})+
        field('Email','rc_email',{type:'email'})+
        field('Phone #','rc_phone')+
      '</div></div>'+
      /* STATUS & CLASSIFICATION */
      '<div class="rc-sec"><h3>Status &amp; Classification</h3><div class="rc-grid">'+
        field('Client','rc_client',{list:'rc_clients'})+
        selectField('Status (Stage)','rc_stage', STAGES, rec.stage||'PENDING OFFER LETTER')+
        selectField('Recruitment Type','rc_type', RECRUITMENT_TYPES, rec.recruitmentType||'LOCAL_TRANSFER')+
        field('Position','rc_position2',{list:'rc_positions'})+
      '</div></div>'+
      /* OVERSEAS DETAILS (conditional) */
      '<div class="rc-sec" id="rc_overseasSec"><h3>Overseas Details</h3><div class="rc-grid">'+
        field('Visa Category','rc_visaCategory',{list:'rc_cats'})+
        field('Agency','rc_agency',{list:'rc_agencies'})+
      '</div></div>'+
      /* LOCAL TRANSFER DETAILS (conditional) */
      '<div class="rc-sec" id="rc_localSec"><h3>Local Transfer Details</h3><div class="rc-grid">'+
        field('Iqama #','rc_iqama')+
        field('IBAN #','rc_iban')+
      '</div></div>'+
      /* PIPELINE */
      '<div class="rc-sec"><h3>Pipeline</h3><div class="rc-grid">'+
        PIPELINE_DATES.map(([id,label])=>dateField('rc_'+id, label)).join('')+
      '</div></div>'+
      /* SALARY */
      '<div class="rc-sec"><h3>Salary (SAR)</h3><div class="rc-grid tri">'+
        SAL_FIELDS.map(([id,label])=>field(label,'rc_'+id,{type:'number',sal:true,ph:'0'})).join('')+
        '<div class="rc-field rc-sal-suffix"><label>Total (auto)</label><input id="rc_totalSalary" type="text" readonly></div>'+
      '</div></div>'+
      /* ACTIONS */
      '<div class="rc-actions"><button type="button" class="secondary" id="rc_cancel">Cancel</button><button type="button" class="primary" id="rc_save">Save</button></div>';
  }

  /* dd/mm/yyyy or ISO → yyyy-mm-dd for <input type=date>; leave unknown as-is (empty) */
  function toDateInput(v){ if(!v) return ''; const s=String(v).trim();
    let m=/^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(s); if(m) return m[1]+'-'+m[2]+'-'+m[3];
    m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s); if(m) return m[3]+'-'+m[2]+'-'+m[1];
    return __claireIsoDate(s)||'';   /* v6.1.0 tz-safe */
  }
  function fromDateInput(v){ return v||''; }   /* store ISO yyyy-mm-dd (dates are unambiguous Gregorian here) */

  function fillForm(rec){
    $('rc_name').value=rec.name||'';
    $('rc_nationality').value=rec.nationality||'';
    $('rc_passport').value=rec.passport||'';
    $('rc_position').value=rec.position||'';
    $('rc_position2').value=rec.position||'';
    $('rc_email').value=rec.email||'';
    $('rc_phone').value=rec.phone||rec.phoneNumber||'';
    $('rc_client').value=rec.client||'';
    $('rc_stage').value=rec.stage||'PENDING OFFER LETTER';
    $('rc_type').value=rec.recruitmentType||'LOCAL_TRANSFER';
    $('rc_visaCategory').value=rec.visaCategory||'';
    $('rc_agency').value=rec.agency||'';
    $('rc_iqama').value=rec.iqama||'';
    $('rc_iban').value=rec.iban||rec.ibanNumber||'';
    PIPELINE_DATES.forEach(([id])=>{ const el=$('rc_'+id); if(el) el.value=toDateInput(rec[id]); });
    SAL_FIELDS.forEach(([id])=>{ const el=$('rc_'+id); if(el) el.value=(rec[id]!=null&&rec[id]!=='')?rec[id]:''; });
    recomputeTotal();
    applyConditional();
    /* keep the two Position fields in sync */
    const p1=$('rc_position'), p2=$('rc_position2'); const sync=(a,b)=>a.addEventListener('input',()=>{b.value=a.value;}); sync(p1,p2); sync(p2,p1);
  }

  function recomputeTotal(){ let s=0; SAL_FIELDS.forEach(([id])=>{ s+=num($('rc_'+id)?.value); }); const t=$('rc_totalSalary'); if(t) t.value=s?s.toLocaleString():'0'; }
  function applyConditional(){ const t=$('rc_type')?$('rc_type').value:''; const ov=isOverseas(t); const loc=isLocal(t); const os=$('rc_overseasSec'), ls=$('rc_localSec'); if(os) os.classList.toggle('hidden', !ov); if(ls) ls.classList.toggle('hidden', !loc); }

  function wire(){
    $('rc_type').addEventListener('change', applyConditional);
    SAL_FIELDS.forEach(([id])=>{ const el=$('rc_'+id); if(el) el.addEventListener('input', recomputeTotal); });
    $('rc_cancel').addEventListener('click', close);
    $('rc_save').addEventListener('click', save);
  }

  function open(recOrId){
    if(!window.DB){ Toast().err('Database not open'); return; }
    let rec=null;
    if(recOrId && typeof recOrId==='object') rec=recOrId;
    else if(recOrId){ rec=((window.DB.recruitmentCases)||[]).find(c=>c.id===recOrId)||null; }
    const isNew=!rec;
    if(isNew){ rec={ id:null, recruitmentType:'LOCAL_TRANSFER', stage:'PENDING OFFER LETTER', requestDate:new Date().toISOString().slice(0,10) }; }
    CURRENT=rec;
    $('rcIdTag').textContent=rec.id?('· '+rec.id):'· NEW';
    $('rcBody').innerHTML=buildForm(rec);
    fillForm(rec); wire();
    $('rcOverlay').classList.add('open');
    log('Opened editor for '+(rec.id||'NEW'));
  }
  function close(){ $('rcOverlay').classList.remove('open'); CURRENT=null; }

  function save(){
    if(!window.DB){ Toast().err('Database not open'); return; }
    const name=($('rc_name').value||'').trim();
    if(!name){ Toast().err('Name is required'); $('rc_name').focus(); return; }
    const rec=CURRENT || {};
    const isNew=!rec.id;
    rec.name=name;
    rec.nationality=($('rc_nationality').value||'').trim().toUpperCase();
    rec.passport=($('rc_passport').value||'').trim().toUpperCase();
    rec.position=($('rc_position').value||'').trim().toUpperCase();
    rec.email=($('rc_email').value||'').trim();
    rec.phone=($('rc_phone').value||'').trim();
    rec.client=($('rc_client').value||'').trim();
    rec.stage=$('rc_stage').value;
    rec.recruitmentType=$('rc_type').value;
    /* conditional fields — only persist the relevant set, clear the other */
    if(isOverseas(rec.recruitmentType)){ rec.visaCategory=($('rc_visaCategory').value||'').trim().toUpperCase(); rec.agency=($('rc_agency').value||'').trim(); rec.iqama=''; rec.iban=''; }
    else if(isLocal(rec.recruitmentType)){ rec.iqama=($('rc_iqama').value||'').trim(); rec.iban=($('rc_iban').value||'').trim(); rec.visaCategory=''; rec.agency=''; }
    /* dates */
    PIPELINE_DATES.forEach(([id])=>{ rec[id]=fromDateInput($('rc_'+id).value)||null; });
    /* salary */
    SAL_FIELDS.forEach(([id])=>{ rec[id]=num($('rc_'+id).value); });
    rec.totalSalary=SAL_FIELDS.reduce((s,[id])=>s+num(rec[id]),0);
    rec.updatedAt=nowIso();

    if(isNew){
      rec.id=genCaseId(); rec.createdAt=nowIso();
      window.DB.recruitmentCases=window.DB.recruitmentCases||[]; window.DB.recruitmentCases.push(rec);
    }
    if(typeof window.makeIdCounter==='function'&&window.DB){ try{ window.DB_ID_COUNTER=window.makeIdCounter(window.DB); }catch{} }
    if(window.dbSave){ try{ window.dbSave(); }catch(e){ log('save err '+e.message); } }
    if(window.refreshPipelineView){ try{ window.refreshPipelineView(); }catch{} }
    if(window.Audit&&window.Audit.push){ try{ window.Audit.push(isNew?'create':'update','recruitmentCase',rec.id,null,'Edited via case form'); }catch{} }
    Toast().ok('Saved', rec.name+' · '+rec.id);
    log('Saved '+rec.id+(isNew?' (new)':''));
    close();
  }
  function genCaseId(){ if(window.DB_ID_COUNTER&&typeof window.DB_ID_COUNTER.nextCase==='number'){ const n=window.DB_ID_COUNTER.nextCase++; return (typeof window.padId==='function')?window.padId('RC',n):('RC-'+String(n).padStart(6,'0')); } const recs=(window.DB&&window.DB.recruitmentCases)||[]; let max=0; recs.forEach(c=>{ const m=/RC-(\d+)/.exec(c.id||''); if(m) max=Math.max(max,parseInt(m[1],10)); }); return 'RC-'+String(max+1).padStart(6,'0'); }

  $('rcClose').addEventListener('click', close);
  $('rcOverlay').addEventListener('click',(e)=>{ if(e.target===$('rcOverlay')) close(); });

  /* ===== hook the R-02 Edit action to open THIS form ===== */
  function pipelinePanel(){ return $('panel-pipeline')||$('pipelineDashboard'); }
  function candidatesTable(){ const p=pipelinePanel(); if(!p) return null; return [...p.querySelectorAll('table')].find(t=>{ const hs=[...t.querySelectorAll('th')].map(th=>upc(th.textContent)); return hs.some(h=>h.includes('NAME'))&&hs.some(h=>h.includes('STAGE')); }); }
  function idFromRow(tr){ /* find an RC-id in the row's buttons/attributes */ const found=new Set(); tr.querySelectorAll('button,a,[data-id],[data-case-id]').forEach(el=>{ if(el.attributes) for(const a of el.attributes){ const m=(a.value||'').match(/RC-\d{3,}/g); if(m) m.forEach(x=>found.add(x)); } const oc=(el.getAttribute&&(el.getAttribute('onclick')||el.getAttribute('href')))||''; const m2=String(oc).match(/RC-\d{3,}/g); if(m2) m2.forEach(x=>found.add(x)); }); const ids=[...found]; const db=(window.DB&&window.DB.recruitmentCases)||[]; const valid=ids.find(id=>db.some(c=>c.id===id)); if(valid) return valid; /* fallback: match by visible NAME */ const cells=[...tr.querySelectorAll('td')].map(td=>upc(td.textContent)); for(const c of db){ if(cells.includes(upc(c.name))) return c.id; } return null; }

  document.addEventListener('click',(e)=>{
    const btn=e.target.closest('button,a'); if(!btn) return;
    const t=upc(btn.textContent||''); const title=upc(btn.getAttribute&&(btn.getAttribute('title')||btn.getAttribute('aria-label'))||'');
    const isEdit = t==='EDIT' || title==='EDIT' || /(^|\s)edit(\s|$)/i.test(btn.className||'') || btn.dataset&&/edit/i.test(btn.dataset.action||'');
    if(!isEdit) return;
    const tr=btn.closest('tr'); if(!tr) return;
    const tbl=candidatesTable(); if(!tbl||!tbl.contains(tr)) return;    /* only R-02 candidate rows */
    const id=idFromRow(tr); if(!id) return;
    e.preventDefault(); e.stopImmediatePropagation();
    open(id);
  }, true);

  window._entEditCase=open;
  console.log('%c📝 R-02 single Recruitment Case edit form v'+V+' active — window._entEditCase(id) to open','color:#2F5A3B;font-weight:bold;');
})();

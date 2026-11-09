
(function SafwatV460(){
  'use strict';
  if(window.__entV460) return; window.__entV460=true;
  const V='4.6.0';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const upc=(s)=>String(s==null?'':s).toUpperCase().trim();
  const has=(v)=>v!=null&&String(v).trim()!=='';
  const pad=(n)=>String(n).padStart(2,'0');
  const nowIso=()=>new Date().toISOString();
  const log=(...a)=>console.log('%c[v4.6.0]','color:#A23B2E;font-weight:bold',...a);
  const Toast=()=>window.Toast||{ok:console.log,warn:console.warn,err:console.error,info:console.info};
  const DB=()=>window.DB||{};

  /* ---------- date helpers (validated) ---------- */
  function toIso(s){ if(s==null) return ''; const t=String(s).trim(); if(!t) return '';
    const u=t.replace(/[.\/]/g,'-'); let m;
    if(m=u.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)) return +m[1]>=1900 ? m[1]+'-'+pad(m[2])+'-'+pad(m[3]) : '';
    if(m=u.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)) return m[3]+'-'+pad(m[2])+'-'+pad(m[1]);   /* DAY first */
    return ''; }
  function plus90(iso){ const m=String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/); if(!m) return ''; const d=new Date(+m[1],+m[2]-1,+m[3]); d.setDate(d.getDate()+90); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function toDmy(iso){ const m=String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m? m[3]+'/'+m[2]+'/'+m[1] : ''; }
  const isHijri=(s)=>{ const m=String(s||'').trim().match(/^(\d{3,4})[\/\-.]/); return !!m && +m[1]<1900; };
  function hijriToGreg(s){
    try{ if(!window.Hijri||!window.Hijri.hijriIsoToGregorianIso) return '';
      const g=String(window.Hijri.hijriIsoToGregorianIso(String(s).trim().replace(/[\/.]/g,'-'))||'').replace(/\//g,'-');
      return (/^\d{4}-\d{2}-\d{2}$/.test(g) && +g.slice(0,4)>=1900) ? g : '';
    }catch(e){ return ''; } }

  /* =====================================================
     1) MOFA — authoritative side = the screen you saved on
     ===================================================== */
  const GRID_TO_FORM=[['mofaNumber','mofaApplicationNumber'],['candVisaIssuance','candidateVisaDate'],['candVisaExpiration','candidateVisaExpiration'],['delegationDate','ratificationDate']];
  function recById(id){ return (DB().visaRecords||[]).find(v=>v.id===id); }
  function copy(rec, fromIdx){ let n=0; GRID_TO_FORM.forEach(p=>{ const a=p[fromIdx], b=p[1-fromIdx];
      if(has(rec[a]) && String(rec[a])!==String(rec[b]||'')){ rec[b]= /date|issuance|expiration/i.test(b)? (toIso(rec[a])||rec[a]) : rec[a]; n++; } }); return n; }
  function afterGridSave(ids){
    let n=0; ids.forEach(id=>{ const r=recById(id); if(!r) return;
      n+=copy(r,0);
      if(isHijri(r.expirationDate)){ const g=hijriToGreg(r.expirationDate); if(g){ r.expirationDateHijri=r.expirationDate; r.expirationDate=g; n++; } }
      const iss=toIso(r.candVisaIssuance||r.candidateVisaDate);
      if(iss){ const e=plus90(iss); if(r.candVisaExpiration!==e||r.candidateVisaExpiration!==e){ r.candVisaExpiration=e; r.candidateVisaExpiration=e; n++; } }
      if(n) r.updatedAt=nowIso(); });
    if(n){ try{ window.dbSave&&window.dbSave(); }catch(e){} try{ window.refreshVisaView&&window.refreshVisaView(); }catch(e){} log('grid save → '+n+' field(s) aligned'); }
  }
  function afterFormSave(id){
    const r=recById(id); if(!r) return; const n=copy(r,1);
    if(n){ r.updatedAt=nowIso(); try{ window.dbSave&&window.dbSave(); }catch(e){} try{ window.refreshVisaView&&window.refreshVisaView(); }catch(e){} log('form save → '+n+' field(s) aligned for '+id); }
  }
  function gridIds(){ const g=$('vdGrid'); if(!g) return []; return [...g.querySelectorAll('tbody tr')].map(tr=>tr.dataset.rec||tr.dataset.recId||tr.dataset.id).filter(Boolean); }

  /* =====================================================
     3a) PREVENTION — convert Hijri expirations before the grid saves
     ===================================================== */
  function hookGridSave(){
    const b=$('vdSave'); if(!b||b.dataset.v460==='1') return; b.dataset.v460='1';
    /* capture, registered after v5.4.7 → runs after its restore, before v3.1.1's save */
    b.addEventListener('click',()=>{
      const g=$('vdGrid'); if(!g) return;
      g.querySelectorAll('input[data-f="expirationDate"]').forEach(inp=>{
        if(isHijri(inp.value)){ const gr=hijriToGreg(inp.value); if(gr){ inp.value=gr.replace(/-/g,'/'); if(inp.dataset) inp.dataset.canonH=''; } }
      });
      const ids=gridIds();
      setTimeout(()=>afterGridSave(ids), 500);
    }, true);
  }
  /* Edit Visa form save */
  document.addEventListener('click',(e)=>{
    const b=e.target.closest&&e.target.closest('button'); if(!b||!/^save/i.test((b.textContent||'').trim())) return;
    if(!document.getElementById('vf_visaNumber')) return;
    const title=[...document.querySelectorAll('h2,h3,.modal-title')].map(x=>x.textContent||'').join(' ');
    const m=title.match(/VR-\d{3,}/); if(m){ const id=m[0]; setTimeout(()=>afterFormSave(id), 500); }
  }, true);

  /* =====================================================
     2) Cand. Visa Expiration in the grid — day-first +90
     ===================================================== */
  function fixCandRow(tr){
    const i=tr.querySelector('[data-f="candVisaIssuance"]'), e=tr.querySelector('[data-f="candVisaExpiration"]');
    if(!i||!e) return;
    const iso=toIso(i.value); const want=iso?toDmy(plus90(iso)):'';
    if(e.value!==want){ e.value=want; }
  }
  /* bubble on document → runs AFTER v5.5.0's grid-capture handler, so ours wins */
  ['input','change'].forEach(ev=>document.addEventListener(ev,(e)=>{
    const t=e.target; if(!t||!t.dataset||t.dataset.f!=='candVisaIssuance') return;
    const tr=t.closest('tr'); if(tr) setTimeout(()=>fixCandRow(tr),0);
  }, false));
  let CAND_SIG='';
  function fixAllCandRows(){
    const g=$('vdGrid'); const ov=$('vdOverlay'); if(!g||!ov||!ov.classList.contains('open')) { CAND_SIG=''; return; }
    const rows=g.querySelectorAll('tbody tr'); const sig=rows.length+'';
    if(sig===CAND_SIG) return; CAND_SIG=sig;
    setTimeout(()=>rows.forEach(fixCandRow), 300);   /* after v5.5.0's first pass */
  }

  /* =====================================================
     3b) REPAIR — preview then apply (backup first)
     ===================================================== */
  function plan(){
    const V=DB().visaRecords||[]; const today=new Date(); today.setHours(0,0,0,0);
    const hij=[], hijFail=[], cand=[], mofa=[]; let willExpire=0;
    V.forEach(v=>{
      if(isHijri(v.expirationDate)){ const g=hijriToGreg(v.expirationDate);
        if(g){ hij.push({v,g}); const s=upc(v.statusVisa); if((s==='UNUSED'||s==='ALLOCATED') && new Date(g)<today) willExpire++; }
        else hijFail.push(v); }
      const iss=toIso(v.candVisaIssuance||v.candidateVisaDate);
      if(iss){ const e=plus90(iss); if((has(v.candVisaExpiration)&&toIso(v.candVisaExpiration)!==e) || (has(v.candidateVisaExpiration)&&toIso(v.candidateVisaExpiration)!==e) || !has(v.candVisaExpiration) || !has(v.candidateVisaExpiration)) cand.push({v,e}); }
      if((has(v.mofaNumber)&&!has(v.mofaApplicationNumber))||(has(v.mofaApplicationNumber)&&!has(v.mofaNumber))) mofa.push(v);
    });
    return {hij,hijFail,cand,mofa,willExpire,total:V.length};
  }
  function renderCard(){
    const p=$('panel-database'); if(!p||$('v46Repair')) return;
    const c=document.createElement('div'); c.id='v46Repair';
    c.innerHTML='<h3>Data Repair — dates &amp; MOFA</h3><p>Converts Hijri QIWA expirations back to Gregorian, corrects Candidate Visa Expiration (+90 days), and fills MOFA numbers across screens. A backup snapshot is taken first. Nothing is deleted.</p>'+
      '<div class="btns"><button class="pv" id="v46Prev">Preview</button><button class="ap" id="v46Apply" disabled>Apply repair</button></div><div id="v46Out"></div>';
    p.insertBefore(c, p.firstChild);
    $('v46Prev').addEventListener('click', preview);
    $('v46Apply').addEventListener('click', apply);
  }
  function preview(){
    const r=plan();
    $('v46Out').innerHTML='<table><tr><th>Fix</th><th>Records</th></tr>'+
      '<tr><td>Hijri QIWA expiration → Gregorian</td><td>'+r.hij.length+'</td></tr>'+
      (r.hijFail.length?'<tr><td class="warn">Hijri values the converter could not read (left untouched)</td><td class="warn">'+r.hijFail.length+'</td></tr>':'')+
      '<tr><td>Candidate Visa Expiration corrected / filled</td><td>'+r.cand.length+'</td></tr>'+
      '<tr><td>MOFA number filled across screens</td><td>'+r.mofa.length+'</td></tr>'+
      '<tr><td class="warn">UNUSED/ALLOCATED whose converted expiry is already past (auto-expire will mark them EXPIRED)</td><td class="warn">'+r.willExpire+'</td></tr></table>'+
      '<p style="margin-top:8px">Sample: '+r.hij.slice(0,5).map(x=>esc(x.v.id)+' '+esc(x.v.expirationDate)+' → '+esc(x.g)).join(' · ')+'</p>';
    $('v46Apply').disabled=!(r.hij.length||r.cand.length||r.mofa.length);
  }
  async function apply(){
    if(!confirm('Take a backup and apply the repair?')) return;
    const V=DB().visaRecords||[]; const before=V.length;
    try{ if(window.EntBackups&&window.EntBackups.snapshot) await window.EntBackups.snapshot('Before v4.6.0 data repair'); }catch(e){ if(!confirm('Backup failed ('+e.message+'). Continue anyway?')) return; }
    const r=plan(); let n=0;
    r.hij.forEach(x=>{ x.v.expirationDateHijri=x.v.expirationDate; x.v.expirationDate=x.g; x.v.updatedAt=nowIso(); n++; });
    r.cand.forEach(x=>{ x.v.candVisaExpiration=x.e; x.v.candidateVisaExpiration=x.e; if(!has(x.v.candVisaIssuance)) x.v.candVisaIssuance=toIso(x.v.candidateVisaDate); if(!has(x.v.candidateVisaDate)) x.v.candidateVisaDate=toIso(x.v.candVisaIssuance); x.v.updatedAt=nowIso(); n++; });
    r.mofa.forEach(v=>{ if(has(v.mofaNumber)&&!has(v.mofaApplicationNumber)) v.mofaApplicationNumber=v.mofaNumber; else v.mofaNumber=v.mofaApplicationNumber; v.updatedAt=nowIso(); n++; });
    if(V.length!==before){ Toast().err('Aborted','Record count changed.'); return; }
    try{ window.dbSave&&window.dbSave(); }catch(e){}
    try{ window.Audit&&window.Audit.push&&window.Audit.push('bulk','visaRecord',null,null,'v4.6.0 repair: '+r.hij.length+' Hijri expirations, '+r.cand.length+' cand. expirations, '+r.mofa.length+' MOFA'); }catch(e){}
    try{ window.refreshVisaView&&window.refreshVisaView(); }catch(e){}
    Toast().ok('Repair applied', n+' fix(es)'); log('repair applied: '+n); preview();
  }

  /* ---------- heartbeat: cheap wiring only ---------- */
  function tick(){ hookGridSave(); fixAllCandRows(); const d=$('panel-database'); if(d&&d.offsetParent!==null) renderCard(); }
  if(window.EntCore&&window.EntCore.every) window.EntCore.every('v460', tick, 1200); else setInterval(tick,1200);
  setTimeout(tick,700);

  window._entV460={ plan, preview, apply };
  console.log('%c🩹 v'+V+' — MOFA synced · Cand. Visa +90 day-first · Hijri expiry guard + R-00 Data Repair','color:#A23B2E;font-weight:bold;');
})();

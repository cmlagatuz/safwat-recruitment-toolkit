
(function R00ControlCenterV431(){
  'use strict';
  if(window.__entHealthV431) return; window.__entHealthV431=true;
  const V='4.3.1';
  const $=(id)=>document.getElementById(id);
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const compact=(s)=>String(s==null?'':s).toUpperCase().replace(/[^A-Z0-9]/g,'');
  const has=(v)=>v!=null&&String(v).trim()!=='';
  const nowIso=()=>new Date().toISOString();
  const daysUntil=(d,now)=>{ if(!d) return null; const x=new Date(d); if(isNaN(x)) return null; return Math.floor((x-now)/86400000); };
  const log=(...a)=>console.log('%c[EntHealth]','color:#2E6FA3;font-weight:bold',...a);
  const Toast=()=>window.Toast||{ok:console.log,warn:console.warn,err:console.error,info:console.info};
  const cases=()=>((window.DB&&window.DB.recruitmentCases)||[]);
  const visas=()=>((window.DB&&window.DB.visaRecords)||[]);
  const dbOpen=()=>!!(window.DB&&(cases().length||visas().length));

  function snapshot(reason){ try{ if(window.EntBackups&&window.EntBackups.snapshot) return window.EntBackups.snapshot(reason||'Health action'); }catch(e){} }
  function saveDb(){ try{ if(window.dbSave) return window.dbSave(); }catch(e){ log('dbSave err '+e.message); } }
  function audit(action,note){ try{ if(window.Audit&&window.Audit.push) window.Audit.push(action||'update','database',null,null,note); }catch(e){} }

  /* ===================== HEALTH ENGINE (validated) ===================== */
  function healthAudit(){
    const C=cases(), Vz=visas(); const now=new Date();
    const caseById={}; C.forEach(c=>caseById[c.id]=c); const visaById={}; Vz.forEach(v=>visaById[v.id]=v);
    const I={ orphanCaseLinks:[],orphanVisaLinks:[],brokenBackLinks:[],dupPassportCases:[],dupPassportVisas:[],missingName:[],missingPassport:[],missingNationality:[],expiredButActive:[],expiringSoon:[],needsReview:[] };
    C.forEach(c=>{ if(c.linkedVisaId&&!visaById[c.linkedVisaId]) I.orphanCaseLinks.push(c.id); });
    Vz.forEach(v=>{ if(v.linkedRecruitmentCaseId&&!caseById[v.linkedRecruitmentCaseId]) I.orphanVisaLinks.push(v.id); });
    C.forEach(c=>{ if(c.linkedVisaId){ const v=visaById[c.linkedVisaId]; if(v&&v.linkedRecruitmentCaseId!==c.id) I.brokenBackLinks.push(c.id); } });
    const cp={}; C.forEach(c=>{ const p=compact(c.passport); if(p.length>=4)(cp[p]=cp[p]||[]).push(c.id); }); Object.entries(cp).forEach(([p,ids])=>{ if(ids.length>1) I.dupPassportCases.push({passport:p,ids}); });
    const vp={}; Vz.forEach(v=>{ const p=compact(v.passport); if(p.length>=4)(vp[p]=vp[p]||[]).push(v.id); }); Object.entries(vp).forEach(([p,ids])=>{ if(ids.length>1) I.dupPassportVisas.push({passport:p,ids}); });
    C.forEach(c=>{ if(!has(c.name)) I.missingName.push(c.id); if(!has(c.passport)) I.missingPassport.push(c.id); if(!has(c.nationality)) I.missingNationality.push(c.id); if(c.needsReview) I.needsReview.push(c.id); });
    Vz.forEach(v=>{ const d=daysUntil(v.expirationDate,now); const s=String(v.statusVisa||'').toUpperCase(); if(d!=null&&d<0&&['UNUSED','ALLOCATED'].includes(s)) I.expiredButActive.push(v.id); if(d!=null&&d>=0&&d<=30&&['UNUSED','ALLOCATED'].includes(s)) I.expiringSoon.push(v.id); });
    const w={orphanCaseLinks:3,orphanVisaLinks:3,brokenBackLinks:2,dupPassportCases:4,dupPassportVisas:4,missingName:5,missingPassport:2,missingNationality:1,expiredButActive:3,needsReview:1};
    let pen=0; Object.keys(w).forEach(k=>pen+=(I[k].length||0)*w[k]); const total=(C.length+Vz.length)||1;
    return { I, score:Math.max(0,Math.round(100-(pen/total)*100)) };
  }

  /* ===================== SAFE BULK ACTIONS (never delete) ===================== */
  function withSafety(label, applyFn, reason){
    const before=cases().length+visas().length;
    snapshot(reason||('Before: '+label));
    const n=applyFn()|0;
    const after=cases().length+visas().length;
    if(after!==before){ log('ABORT: count changed '+before+'→'+after); Toast().err('Aborted','Record count changed — no save.'); return -1; }
    if(n>0){ saveDb(); audit('bulk', label+' — '+n+' change(s)'); }
    Toast().ok(label, n+' change(s)');
    _sig=''; render();     /* force one refresh after our own change */
    log(label+' → '+n);
    return n;
  }
  const trimWhitespace=()=>withSafety('Trim whitespace', ()=>{ let n=0; cases().forEach(c=>['name','position','client','nationality','passport'].forEach(f=>{ if(typeof c[f]==='string'){ const t=c[f].trim(); if(t!==c[f]){ c[f]=t; c.updatedAt=nowIso(); n++; } } })); visas().forEach(v=>['fullName','passport','client','registeredAgencyName'].forEach(f=>{ if(typeof v[f]==='string'){ const t=v[f].trim(); if(t!==v[f]){ v[f]=t; v.updatedAt=nowIso(); n++; } } })); return n; });
  const normalizeCasing=()=>withSafety('Normalize casing', ()=>{ let n=0; cases().forEach(c=>['nationality','position','passport'].forEach(f=>{ if(has(c[f])){ const u=String(c[f]).trim().toUpperCase(); if(u!==c[f]){ c[f]=u; c.updatedAt=nowIso(); n++; } } })); visas().forEach(v=>['nationality','passport','visaCategory'].forEach(f=>{ if(has(v[f])){ const u=String(v[f]).trim().toUpperCase(); if(u!==v[f]){ v[f]=u; v.updatedAt=nowIso(); n++; } } })); return n; });
  function repair(kind){
    const I=healthAudit().I;
    return withSafety('Repair '+kind, ()=>{ let n=0;
      if(kind==='orphan case links'){ I.orphanCaseLinks.forEach(id=>{ const c=cases().find(x=>x.id===id); if(c){ c.linkedVisaId=null; c.updatedAt=nowIso(); n++; } }); }
      else if(kind==='orphan visa links'){ I.orphanVisaLinks.forEach(id=>{ const v=visas().find(x=>x.id===id); if(v){ v.linkedRecruitmentCaseId=null; v.updatedAt=nowIso(); n++; } }); }
      else if(kind==='back-links'){ I.brokenBackLinks.forEach(id=>{ const c=cases().find(x=>x.id===id); if(c&&c.linkedVisaId){ const v=visas().find(x=>x.id===c.linkedVisaId); if(v){ v.linkedRecruitmentCaseId=c.id; v.updatedAt=nowIso(); n++; } } }); }
      else if(kind==='review flags'){ I.needsReview.forEach(id=>{ const c=cases().find(x=>x.id===id); if(c){ c.needsReview=false; c.updatedAt=nowIso(); n++; } }); }
      return n;
    });
  }
  function standardizeClients(){
    const counts={};
    const bump=(val)=>{ const k=compact(val); if(!k) return; (counts[k]=counts[k]||{}); const s=String(val).trim(); counts[k][s]=(counts[k][s]||0)+1; };
    cases().forEach(c=>bump(c.client)); visas().forEach(v=>bump(v.client));
    const canonical={}; Object.entries(counts).forEach(([k,sp])=>{ const best=Object.entries(sp).sort((a,b)=>b[1]-a[1])[0]; if(best) canonical[k]=best[0]; });
    const variants=Object.entries(counts).filter(([k,sp])=>Object.keys(sp).length>1);
    if(!variants.length){ Toast().info('No client variants','All client names already consistent.'); return; }
    const rows=variants.map(([k,sp])=>{ const to=canonical[k]; const from=Object.keys(sp).filter(s=>s!==to); return { to, from, n:from.reduce((s2,f)=>s2+sp[f],0) }; });
    hpOpenDetail('Standardize client names — preview',
      '<p style="font-size:13px">Unify spelling variants to the most-common form. Nothing is deleted; only the client text is updated.</p>'+
      '<table class="hp-tbl"><thead><tr><th>Keep</th><th>Merge from</th><th>Records</th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td><b>'+esc(r.to)+'</b></td><td>'+esc(r.from.join(' · '))+'</td><td style="font-family:monospace">'+r.n+'</td></tr>').join('')+'</tbody></table>'+
      '<div style="margin-top:12px;text-align:right"><button class="secondary small" id="hpStdCancel">Cancel</button> <button class="small" id="hpStdApply" style="background:#2F5A3B;color:#fff;border-color:#2F5A3B">Apply to '+rows.reduce((s,r)=>s+r.n,0)+' record(s)</button></div>'
    );
    $('hpStdCancel').addEventListener('click', hpCloseDetail);
    $('hpStdApply').addEventListener('click', ()=>{ hpCloseDetail(); withSafety('Standardize client names', ()=>{ let n=0; const apply=(rec)=>{ const k=compact(rec.client); if(canonical[k]&&canonical[k]!==rec.client){ rec.client=canonical[k]; rec.updatedAt=nowIso(); n++; } }; cases().forEach(apply); visas().forEach(apply); return n; }); });
  }

  /* ===================== record browser ===================== */
  function allRecords(){
    const out=[];
    cases().forEach(c=>out.push({kind:'case',id:c.id,name:c.name,passport:c.passport,nat:c.nationality,client:c.client,status:c.stage,blob:compact([c.id,c.name,c.passport,c.nationality,c.client,c.position,c.stage].join(' '))}));
    visas().forEach(v=>out.push({kind:'visa',id:v.id,name:v.fullName||'',passport:v.passport,nat:v.nationality,client:v.client,status:v.statusVisa,blob:compact([v.id,v.fullName,v.passport,v.nationality,v.client,v.visaDocumentNumber,v.statusVisa].join(' '))}));
    return out;
  }
  function openRecord(kind,id){
    if(kind==='case'){ if(typeof window.openCaseForm==='function'){ try{ window.openCaseForm(id); return; }catch(e){} } if(typeof window._entEditCase==='function'){ try{ window._entEditCase(id); return; }catch(e){} } }
    if(kind==='visa' && typeof window.openVisaForm==='function'){ try{ window.openVisaForm(id); return; }catch(e){} }
    const rec=(kind==='case'?cases():visas()).find(r=>r.id===id)||{};
    hpOpenDetail((kind==='case'?'Case ':'Visa ')+id, '<table class="hp-tbl"><tbody>'+Object.keys(rec).map(k=>'<tr><td style="font-family:monospace;color:#6B6558">'+esc(k)+'</td><td>'+esc(typeof rec[k]==='object'?JSON.stringify(rec[k]):rec[k])+'</td></tr>').join('')+'</tbody></table>');
  }

  function hpOpenDetail(title,bodyHtml){ $('hpDetailTitle').textContent=title; $('hpDetailBody').innerHTML=bodyHtml; $('hpDetail').classList.add('open'); }
  function hpCloseDetail(){ $('hpDetail').classList.remove('open'); }
  $('hpDetailClose').addEventListener('click', hpCloseDetail);
  $('hpDetail').addEventListener('click',(e)=>{ if(e.target===$('hpDetail')) hpCloseDetail(); });

  function showIssue(key){
    const I=healthAudit().I; const arr=I[key]||[]; if(!arr.length) return;
    const titles={orphanCaseLinks:'Cases linked to a missing visa',orphanVisaLinks:'Visas linked to a missing case',brokenBackLinks:'Broken two-way links',dupPassportCases:'Duplicate passports (cases)',dupPassportVisas:'Duplicate passports (visas)',missingName:'Cases missing a name',missingPassport:'Cases missing a passport',missingNationality:'Cases missing nationality',expiredButActive:'Expired visas still active',expiringSoon:'Visas expiring ≤30 days',needsReview:'Needs review'};
    let body;
    if(key==='dupPassportCases'||key==='dupPassportVisas'){
      body='<table class="hp-tbl"><thead><tr><th>Passport</th><th>Records</th></tr></thead><tbody>'+arr.map(x=>'<tr><td style="font-family:monospace">'+esc(x.passport)+'</td><td style="font-family:monospace">'+esc(x.ids.join(', '))+'</td></tr>').join('')+'</tbody></table>';
    } else {
      const kind=(key.startsWith('orphanVisa')||key==='expiredButActive'||key==='expiringSoon')?'visa':'case';
      body='<table class="hp-tbl"><thead><tr><th>ID</th><th>Name</th><th>Passport</th><th>Client</th></tr></thead><tbody>'+arr.map(id=>{ const r=(kind==='case'?cases():visas()).find(x=>x.id===id)||{}; return '<tr class="clk" data-kind="'+kind+'" data-id="'+esc(id)+'"><td style="font-family:monospace">'+esc(id)+'</td><td>'+esc(r.name||r.fullName||'—')+'</td><td style="font-family:monospace">'+esc(r.passport||'—')+'</td><td>'+esc(r.client||'—')+'</td></tr>'; }).join('')+'</tbody></table>';
    }
    hpOpenDetail(titles[key]||key, body);
    $('hpDetailBody').querySelectorAll('tr[data-id]').forEach(tr=>tr.addEventListener('click',()=>{ hpCloseDetail(); openRecord(tr.dataset.kind, tr.dataset.id); }));
  }

  /* ===================== mount + render ===================== */
  let mounted=false, activeTab='health', collapsed=false;
  function mount(){
    if($('entHealthPanel')) return $('entHealthPanel');
    const cloud=$('entCloudPanel'); const tools=$('dbFileTools');
    const anchor=cloud||tools; if(!anchor||!anchor.parentNode) return null;
    const panel=document.createElement('div'); panel.id='entHealthPanel'; panel.className='card';
    if(cloud) cloud.parentNode.insertBefore(panel, cloud.nextSibling);
    else anchor.parentNode.insertBefore(panel, anchor);
    mounted=true; return panel;
  }
  function verdict(score){ return score>=85?{cls:'g',txt:'Healthy'}: score>=60?{cls:'y',txt:'Needs attention'}:{cls:'r',txt:'Action required'}; }

  function render(){
    const panel=mount(); if(!panel) return;
    if(!dbOpen()){ panel.innerHTML='<div class="hp-head"><h3>⚙ Database Control Center</h3></div><div class="hp-empty">Open a database (above) to see health, control, and governance.</div>'; return; }
    const {I,score}=healthAudit(); const vd=verdict(score); const dial=score>=85?'#3F6C4D':score>=60?'#B98A2E':'#A23B2E';
    const C=cases(), Vz=visas(); const clients=new Set(); C.forEach(c=>{if(c.client)clients.add(c.client.trim());}); Vz.forEach(v=>{if(v.client)clients.add(v.client.trim());});
    const linked=C.filter(c=>c.linkedVisaId).length; const linkedPct=C.length?Math.round(linked/C.length*100):0;

    const issueRow=(cls,label,arr,fixKind,fixLabel)=>{ const n=Array.isArray(arr)?arr.length:0; return '<div class="hp-issue '+(n===0?'ok':cls)+(n>0?' clickable':'')+'" '+(n>0?('data-issue="'+label.k+'"'):'')+'>'+'<span>'+(n===0?'✓ ':'')+esc(label.t)+'</span><span class="cnt">'+n+'</span>'+(n>0&&fixLabel?('<button class="fix" data-fixkind="'+esc(fixKind)+'">'+esc(fixLabel)+'</button>'):'')+'</div>'; };

    const health=
      '<div class="hp-grid">'+
        '<div class="hp-card hp-dialwrap">'+
          '<div class="hp-dial" style="--pct:'+score+';--dial:'+dial+'"><span class="n">'+score+'<small>/100</small></span></div>'+
          '<span class="hp-verdict '+vd.cls+'">'+vd.txt+'</span>'+
          '<div class="hp-mini">'+
            '<div class="m"><b>'+C.length+'</b><span>Cases</span></div>'+
            '<div class="m"><b>'+Vz.length+'</b><span>Visas</span></div>'+
            '<div class="m"><b>'+clients.size+'</b><span>Clients</span></div>'+
            '<div class="m"><b>'+linkedPct+'%</b><span>Linked</span></div>'+
          '</div>'+
        '</div>'+
        '<div class="hp-card"><div class="hp-issues">'+
          issueRow('crit',{t:'Cases linked to a missing visa',k:'orphanCaseLinks'},I.orphanCaseLinks,'orphan case links','Repair')+
          issueRow('crit',{t:'Visas linked to a missing case',k:'orphanVisaLinks'},I.orphanVisaLinks,'orphan visa links','Repair')+
          issueRow('warn',{t:'Broken two-way links',k:'brokenBackLinks'},I.brokenBackLinks,'back-links','Rebuild')+
          issueRow('crit',{t:'Duplicate passports (cases)',k:'dupPassportCases'},I.dupPassportCases,null,null)+
          issueRow('crit',{t:'Duplicate passports (visas)',k:'dupPassportVisas'},I.dupPassportVisas,null,null)+
          issueRow('crit',{t:'Cases missing a name',k:'missingName'},I.missingName,null,null)+
          issueRow('warn',{t:'Cases missing a passport',k:'missingPassport'},I.missingPassport,null,null)+
          issueRow('warn',{t:'Cases missing nationality',k:'missingNationality'},I.missingNationality,null,null)+
          issueRow('crit',{t:'Expired visas still Unused/Allocated',k:'expiredButActive'},I.expiredButActive,null,null)+
          issueRow('warn',{t:'Unused/Allocated expiring ≤30 days',k:'expiringSoon'},I.expiringSoon,null,null)+
          issueRow('warn',{t:'Records flagged Needs Review',k:'needsReview'},I.needsReview,'review flags','Mark reviewed')+
        '</div></div>'+
      '</div>';

    const control=
      '<input class="hp-search" id="hpSearch" type="text" placeholder="Search ALL cases &amp; visas — name, passport, id, client, nationality…" autocomplete="off">'+
      '<div class="hp-results"><table class="hp-tbl" id="hpResults"><thead><tr><th>Type</th><th>ID</th><th>Name</th><th>Passport</th><th>Nationality</th><th>Client</th><th>Status</th></tr></thead><tbody></tbody></table></div>'+
      '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--text-soft,#6B6558);margin:8px 0 12px" id="hpResultsCount"></div>'+
      '<h5 style="margin:6px 0 8px;font-family:\'IBM Plex Sans\',sans-serif">Safe bulk hygiene <span style="font-weight:400;color:var(--text-soft,#6B6558);font-size:11.5px">— snapshots first, never deletes, audited</span></h5>'+
      '<div class="hp-actions">'+
        '<div class="act"><h5>Trim whitespace</h5><p>Remove stray leading/trailing spaces across text fields.</p><button data-bulk="trim">Run</button></div>'+
        '<div class="act"><h5>Normalize casing</h5><p>Uppercase nationality, position, passport, category.</p><button data-bulk="casing">Run</button></div>'+
        '<div class="act"><h5>Standardize client names</h5><p>Unify spelling variants (preview first).</p><button data-bulk="clients">Preview</button></div>'+
        '<div class="act"><h5>Repair all links</h5><p>Null dead links + rebuild back-links (no delete).</p><button data-bulk="links">Run</button></div>'+
      '</div>';

    const auditItems=((window.DB&&window.DB.meta&&window.DB.meta.audit)||[]).slice(-12).reverse();
    const gov='<div class="hp-gov">'+
      '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">'+
        '<button class="fix" id="hpSnap" style="background:#2F5A3B;border-color:#2F5A3B">⛃ Snapshot now</button>'+
        '<button class="fix" id="hpExport" style="background:#B98A2E;border-color:#B98A2E;color:#14202B">⤓ Export health CSV</button>'+
        '<button class="fix" id="hpOpenBackups" style="background:#fff;color:#2F5A3B;border-color:#2F5A3B">↺ Open Restore Points</button>'+
      '</div>'+
      '<h5 style="margin:4px 0 6px;font-family:\'IBM Plex Sans\',sans-serif">Recent changes</h5>'+
      (auditItems.length?auditItems.map(e=>'<div class="gov-row"><span>'+esc((e.action||'').toUpperCase())+' · '+esc(e.entity||'')+(e.extra?(' — '+esc(String(e.extra))):'')+'</span><span class="gov-meta">'+esc(e.actor||'')+' · '+new Date(e.at).toLocaleString()+'</span></div>').join(''):'<div class="hp-empty">No recent changes logged.</div>')+
    '</div>';

    panel.innerHTML=
      '<div class="hp-head" id="hpHead"><h3>⚙ Database Control Center</h3><span class="hp-verdict '+vd.cls+'" style="margin-left:6px">'+score+'/100</span><span class="hp-chev">'+(collapsed?'▸':'▾')+'</span></div>'+
      '<div class="hp-body">'+
        '<div class="hp-tabs">'+
          '<button data-tab="health" class="'+(activeTab==='health'?'active':'')+'">Health</button>'+
          '<button data-tab="control" class="'+(activeTab==='control'?'active':'')+'">Data Control</button>'+
          '<button data-tab="gov" class="'+(activeTab==='gov'?'active':'')+'">Governance</button>'+
        '</div>'+
        (activeTab==='health'?health:activeTab==='control'?control:gov)+
      '</div>';
    if(collapsed) panel.classList.add('collapsed'); else panel.classList.remove('collapsed');

    $('hpHead').addEventListener('click', ()=>{ collapsed=!collapsed; panel.classList.toggle('collapsed', collapsed); const chev=panel.querySelector('.hp-chev'); if(chev) chev.textContent=collapsed?'▸':'▾'; });
    panel.querySelectorAll('.hp-tabs button').forEach(b=>b.addEventListener('click',(e)=>{ e.stopPropagation(); activeTab=b.dataset.tab; _sig=''; render(); }));
    panel.querySelectorAll('[data-issue]').forEach(el=>el.addEventListener('click',(e)=>{ if(e.target.closest('.fix')) return; showIssue(el.dataset.issue); }));
    panel.querySelectorAll('[data-fixkind]').forEach(b=>b.addEventListener('click',(e)=>{ e.stopPropagation(); repair(b.dataset.fixkind); }));
    panel.querySelectorAll('[data-bulk]').forEach(b=>b.addEventListener('click',()=>{ const k=b.dataset.bulk; if(k==='trim') trimWhitespace(); else if(k==='casing') normalizeCasing(); else if(k==='clients') standardizeClients(); else if(k==='links'){ repair('orphan case links'); repair('orphan visa links'); repair('back-links'); } }));
    /* --- Data Control: mark interaction so the heartbeat never rebuilds mid-type/scroll --- */
    const s=$('hpSearch'); if(s){ s.addEventListener('input',()=>{ markInteracting(); renderResults(s.value); }); s.addEventListener('focus', markInteracting); s.addEventListener('keydown', markInteracting); renderResults(''); }
    const resWrap=panel.querySelector('.hp-results'); if(resWrap){ resWrap.addEventListener('scroll', markInteracting, {passive:true}); }
    if($('hpSnap')) $('hpSnap').addEventListener('click',()=>{ snapshot('manual (Health)'); Toast().ok('Snapshot saved','Restore point created'); });
    if($('hpExport')) $('hpExport').addEventListener('click', exportHealthCsv);
    if($('hpOpenBackups')) $('hpOpenBackups').addEventListener('click',()=>{ const p=$('entBackupPanel'); if(p) p.classList.add('open'); else Toast().info('Backups','Open the Backups panel from the top strip.'); });
  }

  /* renderResults updates ONLY the tbody — never the whole panel (keeps focus + scroll) */
  function renderResults(q){
    const tbody=$('hpResults')?$('hpResults').querySelector('tbody'):null; if(!tbody) return;
    const Q=compact(q); let rows=allRecords(); if(Q) rows=rows.filter(r=>r.blob.includes(Q));
    tbody.innerHTML=rows.slice(0,200).map(r=>'<tr class="clk" data-kind="'+r.kind+'" data-id="'+esc(r.id)+'"><td><span class="hp-kind '+r.kind+'">'+r.kind.toUpperCase()+'</span></td><td style="font-family:monospace">'+esc(r.id)+'</td><td>'+esc(r.name||'—')+'</td><td style="font-family:monospace">'+esc(r.passport||'—')+'</td><td>'+esc(r.nat||'—')+'</td><td>'+esc(r.client||'—')+'</td><td>'+esc(r.status||'—')+'</td></tr>').join('');
    const c=$('hpResultsCount'); if(c) c.textContent=rows.length+' record(s)'+(rows.length>200?' — first 200':'');
    tbody.querySelectorAll('tr').forEach(tr=>tr.addEventListener('click',()=>openRecord(tr.dataset.kind,tr.dataset.id)));
  }

  function exportHealthCsv(){
    const {I,score}=healthAudit();
    const lines=[['issue','count','ids']];
    Object.keys(I).forEach(k=>{ const arr=I[k]; const ids=k.startsWith('dup')?arr.map(x=>x.passport+':'+x.ids.join('/')).join(' '):arr.join(' '); lines.push([k, String(arr.length), ids]); });
    lines.unshift(['health_score', String(score), '']);
    const csv=lines.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='SAFWAT-health-'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
    Toast().ok('Exported','Health report CSV');
  }

  /* ===================== register as EntHealth (fills the app hook) ===================== */
  window.EntHealth={ render, audit:healthAudit, __v:431 };

  /* ---- churn-free refresh: only on REAL change, never while interacting ---- */
  let _sig='';
  let _interacting=false, _interactTimer=null;
  function markInteracting(){ _interacting=true; clearTimeout(_interactTimer); _interactTimer=setTimeout(()=>{ _interacting=false; }, 1200); }
  function sig(){ return cases().length+'|'+visas().length+'|'+((window.DB&&window.DB.meta&&window.DB.meta.savedAt)||''); }
  function tick(){
    if(_interacting) return;                    /* never rebuild mid-type/scroll */
    const s=sig();
    if(!mounted || s!==_sig){ _sig=s; render(); } /* only on first mount or real DB change */
  }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('r00.health', tick, 1500); }
  else { setInterval(tick,1500); }
  tick();

  console.log('%c⚙ R-00 Database Control Center v'+V+' active — churn-free (renders only on real change); registered as window.EntHealth','color:#2E6FA3;font-weight:bold;');
})();

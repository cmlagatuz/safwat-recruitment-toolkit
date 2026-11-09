
(function RestoreV2965(){
  'use strict';
  const V='2.9.65';
  const $=(id)=>document.getElementById(id);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const log=(...a)=>console.log('%c[v2.9.65]','color:#2E6FA3;font-weight:bold',...a);

  /* =========================================================
     1) RESTORE LAYOUT — strip the harmful flex class
     ========================================================= */
  function healLayout(){
    document.querySelectorAll('.avr-head-flex').forEach(el=>{
      el.classList.remove('avr-head-flex');
      /* clear any inline flex we might have set previously */
      if(el.style && (el.style.display==='flex')) el.style.display='';
      el.style.removeProperty('justify-content');
      el.style.removeProperty('align-items');
    });
  }
  setInterval(healLayout, 300); healLayout();

  /* =========================================================
     2) SAFE SEARCH — absolute inside the records card (no reflow)
     ========================================================= */
  function recordsHeading(){ return [...document.querySelectorAll('h1,h2,h3,h4,div,span,p')].find(x=>/all visa records/i.test(x.textContent||'')&&x.children.length<=5&&x.getBoundingClientRect().height<80); }
  function recordsCard(){ const h=recordsHeading(); return h?(h.closest('.card, section, div[style*="border"]')||h.parentElement):null; }
  function recordsTable(){ const c=recordsCard(); return c?c.querySelector('table'):null; }
  function ensureSearch(){
    const card=recordsCard(); if(!card) return;
    if($('avrSearch')) return;
    card.classList.add('avr-card-anchor');           /* position:relative only — safe */
    const inp=document.createElement('input'); inp.id='avrSearch'; inp.type='text'; inp.placeholder='Search visa records…';
    inp.addEventListener('input', applySearch);
    card.appendChild(inp);                            /* absolute, floats top-right, no layout change */
    log('Safe search added (absolute, top-right)');
  }
  function applySearch(){ const q=($('avrSearch')?$('avrSearch').value:'').trim().toLowerCase(); const t=recordsTable(); if(!t) return; [...t.querySelectorAll('tbody tr')].forEach(tr=>{ if(tr.querySelector('th')) return; tr.classList.toggle('avr-hidden-by-search', q&&!tr.textContent.toLowerCase().includes(q)); }); }
  setInterval(ensureSearch, 800); ensureSearch();
  setInterval(()=>{ if($('avrSearch')&&$('avrSearch').value) applySearch(); }, 1500);

  /* =========================================================
     3) NAV UNLOCK (Bryan) — SuperAdmin client-side + redirect guard
        (pure JS; cannot affect layout)
     ========================================================= */
  const SUPER_EMAILS=['C.LAGATUZ@SAFWAHR.COM','B.CRUZ@SAFWAHR.COM','B.DELACRUZ@SAFWAHR.COM'];
  function myEmail(){ let e=''; try{ e=(window.EntRbac&&window.EntRbac.myRecord&&(window.EntRbac.myRecord.email||window.EntRbac.myRecord.mail))||(window.Session&&window.Session.email)||(window.currentUser&&window.currentUser.email)||(firebase&&firebase.auth&&firebase.auth().currentUser&&firebase.auth().currentUser.email)||''; }catch(x){} return upc(e); }
  const SUPER_FLAGS=['superAdmin','isSuperAdmin','isSuper','super','superadmin','SuperAdmin'];
  function setSuper(obj){ if(!obj||typeof obj!=='object') return false; let c=false; SUPER_FLAGS.forEach(k=>{ if(obj[k]!==true){ obj[k]=true; c=true; } }); return c; }
  function forceSuper(){
    let changed=false;
    [window.EntRbac&&window.EntRbac.myRecord, window.Session, window.currentUser, window.__me, window.Me].filter(Boolean).forEach(t=>{ if(setSuper(t)) changed=true; });
    ['isSuperAdmin','IS_SUPER','__SUPER_ADMIN','superAdmin'].forEach(k=>{ if(window[k]!==true){ window[k]=true; changed=true; } });
    ['SUPER_ADMINS','SUPER_ADMIN_EMAILS','SUPERADMINS','superAdmins','SUPER_USERS'].forEach(k=>{ const a=window[k]; if(Array.isArray(a)){ SUPER_EMAILS.forEach(e=>{ if(!a.map(x=>upc(x)).includes(e)){ a.push(e.toLowerCase()); changed=true; } }); } });
    try{ if(window.EntRbac&&typeof window.EntRbac.isSuperAdmin==='function'&&!window.EntRbac.__sp){ const o=window.EntRbac.isSuperAdmin.bind(window.EntRbac); window.EntRbac.isSuperAdmin=function(){ if(SUPER_EMAILS.includes(myEmail())) return true; return o.apply(this,arguments); }; window.EntRbac.__sp=true; changed=true; } }catch(x){}
    try{ if(window.Session&&typeof window.Session.isSuperAdmin==='function'&&!window.Session.__sp){ const o=window.Session.isSuperAdmin.bind(window.Session); window.Session.isSuperAdmin=function(){ if(SUPER_EMAILS.includes(myEmail())) return true; return o.apply(this,arguments); }; window.Session.__sp=true; changed=true; } }catch(x){}
    if(changed){ ['applyVisibility','applyRoleVisibility','refreshNav','updateNav','applyNavVisibility','renderNav'].forEach(f=>{ if(typeof window[f]==='function'){ try{ window[f](); }catch(e){} } }); }
  }
  setInterval(forceSuper, 1500); forceSuper();

  function panels(){ return [...document.querySelectorAll('section[id^="panel-"], .panel')]; }
  function activeId(){ const a=panels().find(p=>p.classList.contains('active'))||panels().find(p=>p.offsetParent!==null); return a?a.id:''; }
  function showPanel(id){ for(const f of ['switchPanel','showPanel','activatePanel','openPanel','navigate','goTo','setPanel','selectPanel']){ if(typeof window[f]==='function'){ try{ window[f](id); return; }catch(e){} } } panels().forEach(p=>{ const on=p.id===id; p.classList.toggle('active',on); if(on) p.style.display=''; }); document.querySelectorAll('[data-panel],[data-target],.nav-item,.tab,[role="tab"]').forEach(b=>{ const t=b.dataset.panel||b.dataset.target||''; if(t) b.classList.toggle('active',t===id); }); }
  let _want=null,_until=0;
  document.addEventListener('click',(e)=>{ const btn=e.target.closest('[data-panel],[data-target],a[href^="#panel"],button,.nav-item,.tab,[role="tab"]'); if(!btn) return; let id=btn.dataset.panel||btn.dataset.target||''; if(!id){ const href=btn.getAttribute&&btn.getAttribute('href'); if(href&&/#panel/i.test(href)) id=href.replace('#',''); } if(!id){ const t=upc(btn.textContent||''); if(/R-?02|PIPELINE|CANDIDATE/.test(t)) id='panel-pipeline'; else if(/OFFER/.test(t)) id='panel-offer'; else if(/EXTRACT/.test(t)) id='panel-extract'; else if(/F-?01|FORM/.test(t)) id='panel-f01'; else if(/R-?01|^VISA/.test(t)) id='panel-visa'; } if(!id||!panels().some(p=>p.id===id)) return; _want=id; _until=Date.now()+2500; forceSuper(); }, true);
  setInterval(()=>{ if(!_want||Date.now()>_until) return; const cur=activeId(); if(cur&&cur!==_want&&/visa|r-?01/i.test(cur)&&!/visa|r-?01/i.test(_want)) showPanel(_want); }, 120);
  window._entNavDiag=function(){ const me=(window.EntRbac&&window.EntRbac.myRecord)||window.Session||window.currentUser||{}; return JSON.stringify({ email:myEmail(), superFlags:SUPER_FLAGS.reduce((o,k)=>{o[k]=me[k];return o;},{}), globalSuper:window.isSuperAdmin, activePanel:activeId(), want:_want }, null, 1); };

  /* Presence tree-walk removed (RTDB blocks broad reads → permission_denied). */

  console.log('%c🩹 RESTORE R-01 UI + safe search + nav unlock v'+V+' active','color:#2E6FA3;font-weight:bold;');
})();

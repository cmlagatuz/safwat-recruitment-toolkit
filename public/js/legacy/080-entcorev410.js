
(function EntCoreV410(){
  'use strict';
  if(window.EntCore && window.EntCore.__v>=410) return;   /* idempotent */
  const V='4.1.0';
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const log=(...a)=>console.log('%c[EntCore]','color:#14202B;font-weight:bold',...a);

  /* ============================================================
     1) SHARED HEARTBEAT — replaces ~15 raw setInterval loops.
        One timer; tasks run at their own cadence; fast tasks
        throttle when the tab is hidden (CPU + battery win).
     ============================================================ */
  const tasks=new Map();   /* id -> {fn, everyMs, last} */
  const HEARTBEAT=250;     /* master tick */
  function every(id, fn, everyMs){ tasks.set(id, {fn, everyMs:Math.max(HEARTBEAT,everyMs|0), last:0}); return id; }
  function clear(id){ tasks.delete(id); }
  let _hbErrors=0;
  function beat(){
    const now=Date.now(); const hidden=document.hidden;
    for(const [id,t] of tasks){
      if(hidden && t.everyMs<2000) continue;          /* throttle fast tasks when hidden */
      if(now - t.last >= t.everyMs){ t.last=now; try{ t.fn(); }catch(e){ if(_hbErrors++<5) log('task "'+id+'" error:', e.message); } }
    }
  }
  setInterval(beat, HEARTBEAT);
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) beat(); });

  /* ============================================================
     2) ROLE / SUPER-ADMIN — single source of truth.
        Folds v2.5.2 + v2.8.31 elevation. Admins are treated as
        super in-session so the base app never restricts them.
     ============================================================ */
  function myRecord(){ return (window.EntRbac&&window.EntRbac.myRecord)||window.Session||window.currentUser||{}; }
  function myRole(){ try{ return String(myRecord().role||''); }catch(e){ return ''; } }
  function isAdmin(){ return /admin|super/i.test(myRole()); }
  const SUPER=['superAdmin','isSuperAdmin','isSuper','super','superadmin','SuperAdmin'];
  function grantSuper(){
    if(!isAdmin()) return;
    [window.EntRbac&&window.EntRbac.myRecord, window.Session, window.currentUser].filter(Boolean)
      .forEach(t=>SUPER.forEach(k=>{ if(t[k]!==true) t[k]=true; }));
    ['isSuperAdmin','__SUPER_ADMIN'].forEach(k=>{ if(window[k]!==true) window[k]=true; });
    try{ if(window.EntRbac&&typeof window.EntRbac.isSuperAdmin==='function'&&!window.EntRbac.__sp){ const o=window.EntRbac.isSuperAdmin.bind(window.EntRbac); window.EntRbac.isSuperAdmin=function(){ return isAdmin()||o.apply(this,arguments); }; window.EntRbac.__sp=true; } }catch(e){}
    try{ if(window.Session&&typeof window.Session.isSuperAdmin==='function'&&!window.Session.__sp){ const o=window.Session.isSuperAdmin.bind(window.Session); window.Session.isSuperAdmin=function(){ return isAdmin()||o.apply(this,arguments); }; window.Session.__sp=true; } }catch(e){}
  }

  /* ============================================================
     3) NAV MANAGER — neutralize the base app's forced R-01.
        Folds v3.5.3 / v3.8.0 nav. The base v2.8.38 programmatically
        calls the R-01 nav button's .click() to force Visa; we
        override that button's .click() so a *programmatic* force is
        ignored when an admin intends another panel. Real mouse
        clicks (which don't call .click()) are unaffected.
     ============================================================ */
  const navBtns=()=>[...document.querySelectorAll('button, a, [role="tab"], .nav-item, .tab')];
  function panelOf(el){ const d=el.dataset&&(el.dataset.tab||el.dataset.panel||el.dataset.target); if(d) return d.startsWith('panel-')?d:('panel-'+d); const t=upc(el.textContent||''); if(/R-?01|VISA REPORT|^VISA/.test(t)) return 'panel-visa'; if(/R-?02|RECRUITMENT|PIPELINE/.test(t)) return 'panel-pipeline'; if(/F-?01|OFFER/.test(t)) return 'panel-offer'; if(/R-?00|DATABASE/.test(t)) return 'panel-database'; if(/^F-?0?\d/.test(t)) return 'panel-file'; return ''; }
  const r01Btns=()=>navBtns().filter(b=>panelOf(b)==='panel-visa');
  let INTENT='panel-visa';
  document.addEventListener('click',(e)=>{ if(!e.isTrusted) return; const b=e.target.closest('button, a, [role="tab"], .nav-item, .tab'); if(!b) return; const p=panelOf(b); if(p) INTENT=p; }, true);
  function armNav(){ r01Btns().forEach(btn=>{ if(btn.__navGuard) return; btn.__navGuard=true; const native=HTMLElement.prototype.click; btn.click=function(){ if(isAdmin() && INTENT!=='panel-visa') return; /* suppress forced R-01 */ return native.call(this); }; }); }

  /* ============================================================
     4) PRESENCE PRUNE — single manager (folds v3.8.1 part A).
        Removes stale editing/join sessions (by ANY timestamp),
        keeping the online count honest. Admin-only; RTDB-safe.
     ============================================================ */
  const STALE_MS=10*60*1000;
  const tsOf=(v)=>{ if(!v||typeof v!=='object')return 0; for(const t of [v.lastSeen,v.ts,v.time,v.updatedAt,v.lastPing,v.heartbeat,v.editingSince,v.joinedAt]){ if(t){ const m=typeof t==='number'?t:Date.parse(t); if(m)return m; } } return 0; };
  function dbName(){ try{ return (window.EntCloud&&window.EntCloud.dbName)||'main'; }catch(e){ return 'main'; } }
  async function prunePresence(){
    if(!isAdmin() || typeof firebase==='undefined' || !firebase.database) return;
    const R=firebase.database(); const now=Date.now();
    for(const path of ['safwat/presence/'+dbName(),'safwat/presence/main','safwat/ceoConfig/presence','safwat/locks/'+dbName()]){
      try{ const snap=await R.ref(path).once('value'); const val=snap.val(); if(!val||typeof val!=='object') continue;
        for(const [sid,v] of Object.entries(val)){ const ts=tsOf(v); const orphan=(typeof v!=='object'||ts===0); if((orphan&&path.includes('presence')) || (ts && (now-ts)>STALE_MS)){ try{ await R.ref(path).child(sid).remove(); }catch(e){} } }
      }catch(e){}
    }
  }
  window._entClearGhosts=async function(){ if(!isAdmin()) return 'admin only'; if(typeof firebase==='undefined') return 'no firebase'; for(const p of ['safwat/presence/'+dbName(),'safwat/presence/main']){ try{ await firebase.database().ref(p).remove(); }catch(e){} } log('ghost sessions cleared — live tabs re-register'); return 'cleared'; };

  /* ============================================================
     5) RECORDS GUARD — keep ALL VISA RECORDS visible.
        Folds v2.9.60. Force-shows the records card if any patch
        (or the base) collapses it.
     ============================================================ */
  function recordsCard(){ const h=[...document.querySelectorAll('h1,h2,h3,h4,div,span,p')].find(x=>/all visa records/i.test(x.textContent||'')&&x.children.length<=5&&x.getBoundingClientRect().height<90); return h?(h.closest('.card, section, div[style*="border"]')||h.parentElement):null; }
  function guardRecords(){ const c=recordsCard(); if(!c) return; if(getComputedStyle(c).display==='none'){ c.style.setProperty('display','','important'); } c.querySelectorAll('table').forEach(t=>{ if(getComputedStyle(t).display==='none') t.style.display=''; }); }

  /* ============================================================
     REGISTER the cross-cutting tasks onto the single heartbeat.
     (Cadences chosen to be gentle — this is the whole point.)
     ============================================================ */
  every('core.super',   grantSuper,     2000);
  every('core.nav',     armNav,         1000);
  every('core.records', guardRecords,    800);
  every('core.presence',prunePresence, 30000);
  setTimeout(prunePresence, 3000);

  /* ============================================================
     onReady — resolve when DB + auth look ready (for other modules)
     ============================================================ */
  const readyCbs=[]; let readyFired=false;
  function checkReady(){ const ok = !!(window.DB && (Array.isArray(window.DB.recruitmentCases)||Array.isArray(window.DB.visaRecords))); if(ok && !readyFired){ readyFired=true; readyCbs.splice(0).forEach(fn=>{ try{ fn(); }catch(e){} }); clear('core.readywatch'); } }
  every('core.readywatch', checkReady, 500);
  function onReady(fn){ if(readyFired){ try{ fn(); }catch(e){} } else readyCbs.push(fn); }

  /* ============================================================
     Public API
     ============================================================ */
  window.EntCore = {
    __v:410,
    every, clear,
    isAdmin, myRole, myRecord,
    grantSuper, prunePresence,
    onReady,
    intent:()=>INTENT,
    diag(){ return { version:V, tasks:[...tasks.keys()], role:myRole(), admin:isAdmin(), intent:INTENT, dbReady:readyFired, presencePath:'safwat/presence/'+dbName() }; }
  };

  console.log('%c⚙ SAFWAT EntCore v'+V+' active — 1 heartbeat, '+tasks.size+' tasks (replaces ~15 intervals) · run EntCore.diag()','color:#14202B;font-weight:bold;');
})();

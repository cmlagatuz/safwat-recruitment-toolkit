
(function RestoreVupbExpV430(){
  'use strict';
  if(window.__entRestoreV430) return; window.__entRestoreV430=true;
  const V='4.3.0';
  const $=(id)=>document.getElementById(id);
  const log=(...a)=>console.log('%c[v4.3.0 Restore]','color:#8C6A22;font-weight:bold',...a);

  /* ---------- 1. disable the modules that rebuild these sections ---------- */
  function standDown(){
    /* stop their EntCore tasks */
    try{
      if(window.EntCore&&window.EntCore.clear){
        ['fix.v410','fix.v411','fix.v412','ceo.v380','ceo.v381'].forEach(id=>{ try{ window.EntCore.clear(id); }catch(e){} });
      }
    }catch(e){}
    /* set their guards so any re-evaluated IIFE short-circuits */
    ['__entFixV410','__entFixV411','__entFixV412','__entCEOv380','__entCEOv381'].forEach(k=>{ try{ window[k]=true; }catch(e){} });
    /* stub the specific rebuilders if they were exported */
    try{ if(window._entFixes410) window._entFixes410.dedupeAndRender=function(){}; }catch(e){}
    try{ if(window._entFixes411) window._entFixes411.render=function(){}; }catch(e){}
    try{ if(window._entFixes412) window._entFixes412.render=function(){}; }catch(e){}
    log('rebuilding modules stood down');
  }

  /* ---------- 2. remove my container + un-hide the legacy blocks ---------- */
  function restoreDom(){
    const mine=$('v41Exp');
    if(mine && mine.parentNode){ mine.parentNode.removeChild(mine); log('removed my #v41Exp container'); }
    document.querySelectorAll('.v41-legacy-exp').forEach(el=>el.classList.remove('v41-legacy-exp'));
    /* also clear the marker v3.8.x used so its patch won't re-run */
    ['v38','v381','v38fd','v38bars'].forEach(k=>{
      document.querySelectorAll('[data-'+k+']').forEach(el=>{ try{ delete el.dataset[k]; }catch(e){} });
    });
  }

  /* ---------- 3. repair the render targets a wipe may have destroyed ---------- */
  function ensureBodies(){
    let repaired=0;
    const vupb=$('vupbSection');
    if(vupb && !$('vupbBody')){
      const d=document.createElement('div'); d.id='vupbBody'; vupb.appendChild(d); repaired++;
    }
    const vexp=$('vexpSection');
    if(vexp && !$('vexpBody')){
      const d=document.createElement('div'); d.id='vexpBody'; vexp.appendChild(d); repaired++;
    }
    if(repaired) log('re-created '+repaired+' render target(s) removed by an earlier wipe');
    return repaired;
  }

  /* ---------- 4. one render so v2.9.50 repaints both sections ---------- */
  function repaint(){
    try{ if(window._entDirectRenderVisa) window._entDirectRenderVisa(); }catch(e){}
    try{ if(window.refreshVisaView) window.refreshVisaView(); }catch(e){}
    /* nudge the section's own Status control so v2.9.50 re-runs its render */
    try{
      const sel=document.querySelector('#vupbSection select');
      if(sel) sel.dispatchEvent(new Event('change',{bubbles:true}));
    }catch(e){}
    try{
      const sel2=document.querySelector('#vexpSection select');
      if(sel2) sel2.dispatchEvent(new Event('change',{bubbles:true}));
    }catch(e){}
  }

  /* ---------- run ONCE (no polling, nothing to flicker) ---------- */
  let done=false;
  function runOnce(){
    if(done) return;
    const panel=$('panel-visa');
    if(!panel) return;                       /* wait until R-01 exists */
    done=true;
    standDown();
    restoreDom();
    ensureBodies();
    setTimeout(repaint, 120);
    setTimeout(()=>{ ensureBodies(); repaint(); }, 900);   /* one safety pass */
    log('restore complete — v2.9.50 owns VUPB and Upcoming Expirations again');
  }

  /* try a few times only until R-01 is present, then stop for good */
  let attempts=0;
  const t=setInterval(()=>{
    attempts++;
    runOnce();
    if(done || attempts>40) clearInterval(t);
  }, 400);
  setTimeout(runOnce, 300);

  window._entRestore430=function(){ done=false; runOnce(); };
  console.log('%c♻ Restore v'+V+' — VUPB + Upcoming Expirations handed back to v2.9.50 (single owner, no loops)','color:#8C6A22;font-weight:bold;');
})();

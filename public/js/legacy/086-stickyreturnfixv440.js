
(function StickyReturnFixV440(){
  'use strict';
  if(window.__entStickyReturnV440) return; window.__entStickyReturnV440=true;
  const V='4.4.0';
  const $=(id)=>document.getElementById(id);
  const log=(...a)=>console.log('%c[v4.4.0 StickyReturn]','color:#2E6FA3;font-weight:bold',...a);

  const r01Panel=()=>$('panel-visa');
  function r01Visible(){ const p=r01Panel(); return !!(p && p.classList.contains('active') && p.offsetParent!==null && p.getBoundingClientRect().height>0); }
  const bar=()=>$('entStickyVisaBar');

  /* Find the sentinel v2.8.25 uses. It's the element just before the original
     filter/KPI section. We locate it by the same anchor the base uses; if the
     base didn't id it, fall back to the filter row's own top. */
  function sentinelTop(){
    /* v2.8.25 places a sentinel; try common ids, else use the first filter cell's section top */
    const s=$('entVisaStickySentinel')||$('entStickySentinel')||document.querySelector('#panel-visa .filter-bar')||$('visaFilterNat');
    if(!s) return null;
    const el=s.closest ? (s.closest('.filter-bar, .card, div')||s) : s;
    return el.getBoundingClientRect().top;
  }

  /* Decide + apply the sticky state without needing a scroll event */
  function reeval(){
    const b=bar(); if(!b) return;
    if(!r01Visible()){ if(b.classList.contains('ent-sticky-active')) b.classList.remove('ent-sticky-active'); return; }
    const top=sentinelTop(); if(top==null) return;
    /* stuck when the original filter/KPI section has scrolled above the viewport top */
    const shouldStick = top < 0;
    if(shouldStick){ if(!b.classList.contains('ent-sticky-active')){ b.classList.add('ent-sticky-active'); log('re-evaluated → show (returned scrolled-down)'); } }
    else { if(b.classList.contains('ent-sticky-active')){ b.classList.remove('ent-sticky-active'); } }
  }

  /* Re-evaluate the moment R-01 is (re)shown: tab click, hashchange, and a
     short burst after, since the panel display flips slightly after the click. */
  function scheduleReeval(){ reeval(); setTimeout(reeval,60); setTimeout(reeval,180); setTimeout(reeval,400); }

  /* nav clicks that target R-01 */
  document.addEventListener('click',(e)=>{
    const t=e.target.closest('button,a,.tab,[data-tab]'); if(!t) return;
    const tab=(t.dataset&&t.dataset.tab)||''; const txt=(t.textContent||'').toUpperCase();
    if(tab==='visa' || /R-?01|VISA REPORT/.test(txt)) scheduleReeval();
  }, true);
  window.addEventListener('hashchange', scheduleReeval);

  /* Track visibility flips (covers programmatic tab switches too) */
  let _wasVisible=false;
  function tick(){ const vis=r01Visible(); if(vis && !_wasVisible){ scheduleReeval(); } _wasVisible=vis; if(vis) reeval(); }
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('r01.stickyReturn', tick, 400); }
  else { setInterval(tick,400); }
  tick();

  window._entStickyReeval=reeval;
  console.log('%c📌 R-01 sticky-bar return fix v'+V+' active — shows the sticky bar on tab-return without needing a scroll','color:#2E6FA3;font-weight:bold;');
})();

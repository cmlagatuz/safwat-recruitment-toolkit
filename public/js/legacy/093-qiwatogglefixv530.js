
(function QiwaToggleFixV530(){
  'use strict';
  if(window.__entQiwaToggleV530) return; window.__entQiwaToggleV530=true;
  const V='5.3.0';
  const $=(id)=>document.getElementById(id);
  const log=(...a)=>console.log('%c[v5.3.0 QiwaToggle]','color:#8C6A22;font-weight:bold',...a);
  const MODE_KEY='safwatEnt.qiwaDisplayMode';

  /* reuse the app's own mode getters/setters if present; else same-key localStorage */
  function getMode(){
    try{ if(typeof window.getQiwaMode==='function') return window.getQiwaMode(); }catch(e){}
    try{ return localStorage.getItem(MODE_KEY)||'hijri'; }catch(e){ return 'hijri'; }
  }
  function setMode(m){
    let done=false;
    try{ if(typeof window.setQiwaMode==='function'){ window.setQiwaMode(m); done=true; } }catch(e){}
    try{ localStorage.setItem(MODE_KEY, m); }catch(e){}     /* keep both in sync */
    return done;
  }

  /* pick the first working full-render path (verified order) */
  function forceRender(){
    if(typeof window._entDirectRenderVisa==='function'){ try{ window._entDirectRenderVisa(); return '_entDirectRenderVisa'; }catch(e){} }
    if(typeof window._entFullVisaRender==='function'){ try{ window._entFullVisaRender(); return '_entFullVisaRender'; }catch(e){} }
    if(typeof window.refreshVisaView==='function'){ try{ window.refreshVisaView(); return 'refreshVisaView'; }catch(e){} }
    if(typeof window.renderVisaAll==='function'){ try{ window.renderVisaAll(); return 'renderVisaAll'; }catch(e){} }
    return null;
  }

  function updateBadgeLabel(){
    const badge=$('entQiwaModeBadge'); if(!badge) return;
    const m=getMode(); const want=(m==='hijri')?'HIJRI':'GREG';
    if(badge.textContent.trim()!==want) badge.textContent=want;
    badge.style.cursor='pointer';                 /* affordance */
    badge.title='Click to switch QIWA dates between Hijri and Gregorian';
  }

  /* the toggle action */
  let _busy=false;
  function doToggle(){
    if(_busy) return; _busy=true;
    const cur=getMode(); const next=(cur==='hijri')?'greg':'hijri';
    setMode(next);
    updateBadgeLabel();
    const path=forceRender();
    /* header may be marked "built"; if the badge got a stale label after render, resync */
    setTimeout(()=>{ updateBadgeLabel(); _busy=false; }, 60);
    log('Toggled QIWA → '+next.toUpperCase()+' (rendered via '+(path||'none')+')');
  }

  /* DELEGATED click — survives any header/table rebuild */
  document.addEventListener('click',(e)=>{
    const badge=e.target.closest&&e.target.closest('#entQiwaModeBadge, .ent-toggle-badge, .ent-toggle-qiwa');
    if(!badge) return;
    /* only the QIWA badge (or its header cell) */
    const isBadge = badge.id==='entQiwaModeBadge' || badge.classList.contains('ent-toggle-badge') ||
                    (badge.classList.contains('ent-toggle-qiwa') && /QIWA/i.test(badge.textContent||''));
    if(!isBadge) return;
    e.preventDefault(); e.stopPropagation();
    doToggle();
  }, true);

  /* keep the label correct (light) */
  if(window.EntCore&&window.EntCore.every){ window.EntCore.every('r01.qiwaBadge', updateBadgeLabel, 1500); }
  else { setInterval(updateBadgeLabel, 1500); }
  updateBadgeLabel();

  window._entToggleQiwa=doToggle;
  console.log('%c🕌 QIWA Hijri/Greg toggle reliability fix v'+V+' active — delegated click + forced render (no more "nothing happens")','color:#8C6A22;font-weight:bold;');
})();

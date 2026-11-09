
(function VisaNumberAutofillFixV548(){
  'use strict';
  if(window.__entVNFixV548) return; window.__entVNFixV548=true;
  const V='5.4.8';
  const log=(...a)=>console.log('%c[v5.4.8 VNFix]','color:#A23B2E;font-weight:bold',...a);

  /* fields that are UNIQUE PER VISA and must never autofill across same-Doc# rows */
  const NO_AUTOFILL=/^(visaNumber|mofaNumber)$/;

  function inViewDataGrid(el){ const g=document.getElementById('vdGrid'); return g && g.contains(el); }

  /* CAPTURE phase on document → fires before v5.4.7's grid-level capture autofill listener */
  document.addEventListener('change', function(e){
    const inp=e.target;
    if(!inp || !inp.dataset || !inp.dataset.f) return;
    if(!NO_AUTOFILL.test(inp.dataset.f)) return;
    if(!inViewDataGrid(inp)) return;
    /* the typed value is already committed to THIS cell; block the same-Doc# cascade only */
    e.stopImmediatePropagation();
    /* (do not preventDefault — we want the value to remain) */
  }, true);

  /* also guard the 'input' event path just in case a build listens there */
  document.addEventListener('input', function(e){
    const inp=e.target;
    if(!inp || !inp.dataset || !inp.dataset.f) return;
    if(!NO_AUTOFILL.test(inp.dataset.f)) return;
    if(!inViewDataGrid(inp)) return;
    e.stopImmediatePropagation();
  }, true);

  console.log('%c🔒 Visa Number / MOFA # autofill bug fix v'+V+' active — those fields no longer cascade to same-Doc# rows','color:#A23B2E;font-weight:bold;');
})();

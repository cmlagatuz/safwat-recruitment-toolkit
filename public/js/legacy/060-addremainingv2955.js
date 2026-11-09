
(function AddRemainingV2955(){
  'use strict';
  const V='2.9.55';
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/[▲▼]/g,'').replace(/\s+/g,' ').trim();
  const numOf=(s)=>{ const n=parseInt(String(s).replace(/[^0-9\-]/g,''),10); return isNaN(n)?0:n; };
  const log=(...a)=>console.log('%c[v2.9.55]','color:#2F5A3B;font-weight:bold',...a);

  function vupbTable(){ const sec=document.getElementById('vupbSection'); return sec?sec.querySelector('table.vupb'):null; }

  function headIndex(t){
    const ths=[...t.querySelectorAll('thead th')];
    const find=(label)=>ths.findIndex(th=>upc(th.textContent)===label);
    return { ths, unused:find('UNUSED'), allocated:find('ALLOCATED'), cancelled:find('CANCELLED'), total:find('TOTAL'), remaining:find('REMAINING') };
  }

  function apply(){
    const t=vupbTable(); if(!t) return;
    const ix=headIndex(t);
    if(ix.unused<0||ix.allocated<0||ix.cancelled<0){ return; }        /* structure not ready */
    if(ix.remaining>=0){ /* already added — just refresh values in case data changed */ refreshValues(t, ix); return; }

    /* 1) header: insert REMAINING after CANCELLED */
    const headTr=t.querySelector('thead tr');
    const remTh=document.createElement('th'); remTh.className='right rem-h'; remTh.dataset.k='remaining'; remTh.textContent='Remaining';
    const cancelledTh=ix.ths[ix.cancelled];
    cancelledTh.insertAdjacentElement('afterend', remTh);

    /* 2) body: insert a Remaining chip after CANCELLED in each row */
    t.querySelectorAll('tbody tr').forEach(tr=>{
      const cells=[...tr.children];
      const u=numOf(cells[ix.unused] ? cells[ix.unused].textContent : 0);
      const a=numOf(cells[ix.allocated] ? cells[ix.allocated].textContent : 0);
      const td=document.createElement('td'); td.style.textAlign='right';
      td.innerHTML='<span class="chip rem">'+(u+a)+'</span>';
      cells[ix.cancelled].insertAdjacentElement('afterend', td);
    });

    /* 3) footer TOTAL row: add a Remaining total after CANCELLED total.
       The tfoot's first cell spans 8 name columns, so its cell layout differs.
       We compute the sum from the body and rebuild the footer numeric cells. */
    addFooterRemaining(t);

    log('REMAINING column added');
  }

  function refreshValues(t, ix){
    /* update each row's remaining = unused + allocated (data may have re-rendered without our column if v2.9.50 rebuilt) */
    t.querySelectorAll('tbody tr').forEach(tr=>{
      const cells=[...tr.children];
      const remCell=cells[ix.remaining]; if(!remCell) return;
      const u=numOf(cells[ix.unused]?cells[ix.unused].textContent:0);
      const a=numOf(cells[ix.allocated]?cells[ix.allocated].textContent:0);
      const chip=remCell.querySelector('.chip')||remCell;
      chip.textContent=(u+a);
    });
    addFooterRemaining(t);
  }

  function addFooterRemaining(t){
    const foot=t.querySelector('tfoot tr'); if(!foot) return;
    const ix=headIndex(t);
    if(ix.remaining<0) return;
    /* sum remaining across body */
    let sum=0; t.querySelectorAll('tbody tr').forEach(tr=>{ const cells=[...tr.children]; const c=cells[ix.remaining]; if(c) sum+=numOf(c.textContent); });
    /* footer cells: the first <td colspan="8"> then numeric tds for used,unused,allocated,expired,cancelled,total.
       We need to insert/refresh a Remaining total cell positioned before TOTAL. Rebuild by matching header order. */
    const footCells=[...foot.children];
    /* If we've already added a rem-t cell, just update it */
    let remT=foot.querySelector('td.rem-t');
    if(remT){ remT.textContent=sum; return; }
    /* Otherwise, find the footer's TOTAL cell (last numeric) and insert before it.
       Footer numeric cells align to header numeric columns in order. The last cell = TOTAL. */
    const totalCell=footCells[footCells.length-1];
    remT=document.createElement('td'); remT.className='num rem-t'; remT.textContent=sum;
    totalCell.insertAdjacentElement('beforebegin', remT);
  }

  /* Watch the VUPB body: v2.9.50 replaces innerHTML on re-render, wiping our column → re-apply.
     Disconnect during our own edits so we never trigger ourselves (no loop). */
  let _mo=null, _t=null, _busy=false;
  function safeApply(){ if(_busy) return; _busy=true; try{ if(_mo) _mo.disconnect(); apply(); } finally { if(_mo){ const sec=document.getElementById('vupbSection'); const body=sec&&(sec.querySelector('#vupbBody')||sec); if(body) _mo.observe(body,{childList:true,subtree:true}); } _busy=false; } }
  function schedule(){ clearTimeout(_t); _t=setTimeout(safeApply, 120); }
  function observe(){
    const sec=document.getElementById('vupbSection'); if(!sec){ setTimeout(observe,600); return; }
    const body=sec.querySelector('#vupbBody')||sec;
    _mo=new MutationObserver((muts)=>{ for(const m of muts){ if(m.type==='childList' && (m.addedNodes.length||m.removedNodes.length)){ schedule(); return; } } });
    _mo.observe(body, { childList:true, subtree:true });
    safeApply();
    log('observer attached');
  }
  observe();
  setInterval(safeApply, 1500);   /* safety re-apply */

  console.log('%c➕ REMAINING column for Visa Usage Per Block v'+V+' active','color:#2F5A3B;font-weight:bold;');
})();

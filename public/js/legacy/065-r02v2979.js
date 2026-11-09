
(function R02V2979(){
  'use strict';
  const V='2.9.79';
  const $=(id)=>document.getElementById(id);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const log=(...a)=>console.log('%c[v2.9.79]','color:#2F5A3B;font-weight:bold',...a);

  function pipelinePanel(){ return $('panel-pipeline')||$('pipelineDashboard'); }
  function panelVisible(p){ return p && p.offsetParent!==null && p.getBoundingClientRect().height>0; }
  function kpiGrid(){ return $('pipelineKpiGrid'); }
  function isFilterish(el){ if(!el||el.nodeType!==1) return false; if(el.id==='entR02Bar'||el.id==='entR02BarSentinel') return false; return !!(el.querySelector && (el.querySelector('select')||el.querySelector('input[type="text"]')||el.querySelector('input:not([type])'))); }

  function ensureBar(){
    const panel=pipelinePanel(); const kpi=kpiGrid();
    if(!panel||!panelVisible(panel)||!kpi) return;
    let bar=$('entR02Bar');
    if(bar && bar.contains(kpi)){ paint(bar); layoutFilters(bar); ensureSentinel(bar); updateStuck(); return; }
    const parent=kpi.parentNode; if(!parent) return;
    const collected=[]; let node=kpi.previousElementSibling;
    while(node){ if(isFilterish(node)){ collected.unshift(node); node=node.previousElementSibling; continue; } break; }
    if(!bar){ bar=document.createElement('div'); bar.id='entR02Bar'; }
    const anchor=collected.length?collected[0]:kpi;
    if(anchor.parentNode!==parent) return;
    parent.insertBefore(bar, anchor);
    collected.forEach(el=>{ if(el.parentNode===parent) bar.appendChild(el); });
    bar.appendChild(kpi);
    paint(bar); layoutFilters(bar); ensureSentinel(bar); updateStuck();
    log('Sticky bar built ('+collected.length+' filter block(s) + KPI), h='+Math.round(bar.getBoundingClientRect().height)+'px');
  }
  function paint(bar){ bar.style.setProperty('position','sticky','important'); bar.style.setProperty('top','0px','important'); bar.style.setProperty('z-index','50','important'); if(!bar.style.background){ let el=pipelinePanel(); let bg=''; while(el){ const c=getComputedStyle(el).backgroundColor; if(c&&c!=='rgba(0, 0, 0, 0)'&&c!=='transparent'){ bg=c; break; } el=el.parentElement; } bar.style.background=bg||'#F1EDE2'; } }
  function ensureSentinel(bar){ let s=$('entR02BarSentinel'); if(!s){ s=document.createElement('div'); s.id='entR02BarSentinel'; } if(s.nextElementSibling!==bar||s.parentNode!==bar.parentNode){ if(bar.parentNode) bar.parentNode.insertBefore(s, bar); } }

  /* ROBUST stuck detection: the bar is stuck ONLY when the sentinel has
     scrolled above the top of the viewport. Compute directly from rects. */
  function updateStuck(){
    const bar=$('entR02Bar'); const s=$('entR02BarSentinel'); if(!bar||!s) return;
    const sentTop=s.getBoundingClientRect().top;
    const stuck = sentTop < 0;    /* sentinel above viewport top → bar pinned */
    if(stuck){ if(!bar.classList.contains('is-stuck')){ captureAccents(); bar.classList.add('is-stuck'); applyAccents(); } }
    else { bar.classList.remove('is-stuck'); }
  }
  window.addEventListener('scroll', updateStuck, {passive:true});
  window.addEventListener('resize', ()=>{ const b=$('entR02Bar'); if(b){ paint(b); layoutFilters(b); } updateStuck(); });
  setInterval(updateStuck, 250);

  function layoutFilters(bar){
    const block=[...bar.children].find(c=> c!==kpiGrid() && c.id!=='entR02BarSentinel' && (c.querySelector&&c.querySelector('select')));
    if(!block) return;
    block.classList.add('ent-filter-row');
    [...block.children].forEach(f=>{ if(f.querySelector&&(f.querySelector('input[type="text"]')||f.querySelector('input:not([type])'))&&!f.querySelector('select')){ f.classList.add('ent-search-field'); } });
    const sf=block.querySelector('.ent-search-field'); if(sf && sf!==block.lastElementChild){ block.appendChild(sf); }
  }

  function isNeutral(c){ if(!c) return true; const s=c.replace(/\s/g,'').toLowerCase(); if(s==='transparent'||s==='rgba(0,0,0,0)') return true; const m=s.match(/^rgba?\((\d+),(\d+),(\d+)/); if(!m) return false; const r=+m[1],g=+m[2],b=+m[3]; return (r===g&&g===b); }
  function pickAccent(card){ const cs=getComputedStyle(card); const cands=[cs.borderTopColor,cs.borderLeftColor,cs.borderBottomColor,cs.borderRightColor,cs.outlineColor]; for(const c of cands){ if(c&&!isNeutral(c)) return c; } const num=card.firstElementChild; if(num){ const nc=getComputedStyle(num).color; if(nc&&!isNeutral(nc)) return nc; } for(const el of card.querySelectorAll('*')){ const cc=getComputedStyle(el).color; if(cc&&!isNeutral(cc)) return cc; const bg=getComputedStyle(el).backgroundColor; if(bg&&!isNeutral(bg)) return bg; } return ''; }
  function captureAccents(){ const grid=kpiGrid(); if(!grid) return; [...grid.children].forEach(card=>{ if(!card.getAttribute('data-accent')){ const col=pickAccent(card); if(col) card.setAttribute('data-accent', col); } }); }
  function applyAccents(){ const grid=kpiGrid(); if(!grid) return; [...grid.children].forEach(card=>{ const col=card.getAttribute('data-accent')||pickAccent(card); if(col){ card.setAttribute('data-accent', col); card.style.setProperty('border-left-color', col, 'important'); } }); }
  /* capture accents continuously while NOT stuck so colors are ready when it sticks */
  setInterval(()=>{ const b=$('entR02Bar'); if(b && !b.classList.contains('is-stuck')) captureAccents(); }, 600);

  setInterval(ensureBar, 700); ensureBar();

  function candidatesCard(){ const h=[...document.querySelectorAll('h1,h2,h3,h4,div,span,p')].find(x=>/all candidates/i.test(x.textContent||'')&&x.children.length<=5&&x.getBoundingClientRect().height<80); return h?(h.closest('.card, section, div[style*="border"]')||h.parentElement):null; }
  function candidatesTable(){ const c=candidatesCard(); if(!c) return null; return [...c.querySelectorAll('table')].find(t=>{ const hs=[...t.querySelectorAll('th')].map(th=>upc(th.textContent)); return hs.some(h=>h.includes('NAME'))&&hs.some(h=>h.includes('STAGE')); }) || c.querySelector('table'); }
  const cellsEmpty=(tr)=>[...tr.children].every(td=>upc(td.textContent)===''&&!td.querySelector('input,button,select'));
  function fixHeader(){ document.querySelectorAll('.ent-float-head').forEach(el=>el.remove()); const t=candidatesTable(); if(!t) return; t.classList.add('ent-cand-table'); const heads=[...t.querySelectorAll('thead tr')]; if(heads.length<=1) return; let real=heads.find(r=>r.querySelector('input[type="checkbox"]')&&upc(r.textContent).includes('NAME')&&!cellsEmpty(r))||heads.find(r=>upc(r.textContent).includes('NAME')&&!cellsEmpty(r))||heads.find(r=>!cellsEmpty(r))||heads[0]; heads.forEach(r=>{ if(r===real) r.classList.remove('ent-hdr-hidden'); else r.classList.add('ent-hdr-hidden'); }); }
  setInterval(fixHeader, 600); fixHeader();

  window._entR02Diag=function(){ const bar=$('entR02Bar'); const s=$('entR02BarSentinel'); const sel=bar?bar.querySelector('.ent-filter-row select'):null; const cs=sel?getComputedStyle(sel):null; return JSON.stringify({ barHeight:bar?Math.round(bar.getBoundingClientRect().height):null, stuck:bar?bar.classList.contains('is-stuck'):null, sentinelTop:s?Math.round(s.getBoundingClientRect().top):null, selectPadding:cs?cs.padding:null, selectFont:cs?cs.fontSize:null }, null, 1); };

  console.log('%c🎨 R-02 full-size unscrolled, compact only when stuck v'+V+' active','color:#2F5A3B;font-weight:bold;');
})();

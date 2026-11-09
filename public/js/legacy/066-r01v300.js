
(function R01V300(){
  'use strict';
  const V='3.0.0';
  const $=(id)=>document.getElementById(id);
  const upc=(s)=>String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
  const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const log=(...a)=>console.log('%c[v3.0.0]','color:#2E6FA3;font-weight:bold',...a);

  /* R-01 = Visa panel. Find its visa-records table (VISA DOC + STATUS + NATIONALITY headers). */
  function visaPanel(){ const p=$('panel-visa')||$('panel-r01'); if(p) return p; /* fallback: panel containing ALL VISA RECORDS */ const h=[...document.querySelectorAll('*')].find(x=>/all visa records/i.test(x.textContent||'')&&x.children.length<40); return h?h.closest('.panel, section')||h.parentElement:null; }
  function panelVisible(p){ return p && p.offsetParent!==null && p.getBoundingClientRect().height>0; }
  function visaTable(){ const p=visaPanel(); if(!p) return null; return [...p.querySelectorAll('table')].find(t=>{ const hs=[...t.querySelectorAll('th')].map(th=>upc(th.textContent)); return hs.some(h=>h.includes('VISA DOC'))&&hs.some(h=>h.includes('STATUS')); }); }
  function colIndex(t, label){ const ths=[...t.querySelectorAll('thead th')]; for(let i=0;i<ths.length;i++){ if(upc(ths[i].textContent).includes(label)) return i; } return -1; }

  /* ============================================================
     1) GENDER filter (after Nationality)
     ============================================================ */
  function labeledSelect(names){
    const panel=visaPanel()||document;
    for(const w of panel.querySelectorAll('label, .field, div')){
      const lt=upc(w.textContent||'');
      if(names.some(N=>lt.startsWith(N))){
        const sel=w.querySelector('select')||(w.nextElementSibling&&w.nextElementSibling.matches&&w.nextElementSibling.matches('select')?w.nextElementSibling:null);
        if(sel) return { wrap:w, sel };
      }
    }
    return null;
  }
  function genderOptions(){ const set=new Set(); ((window.DB&&window.DB.visaRecords)||[]).forEach(v=>{ if(v.gender) set.add(String(v.gender).trim()); }); return [...set].filter(Boolean).sort(); }

  let _gender='';
  function applyGenderFilter(){
    const t=visaTable(); if(!t) return; const gi=colIndex(t,'GENDER'); if(gi<0) return;
    const want=upc(_gender);
    [...t.querySelectorAll('tbody tr')].forEach(tr=>{ if(tr.querySelector('th')) return; if(!want){ tr.classList.remove('ent-gender-hidden'); return; } const g=upc((tr.children[gi]||{}).textContent||''); tr.classList.toggle('ent-gender-hidden', g!==want); });
  }
  function ensureGenderFilter(){
    const panel=visaPanel(); if(!panel||!panelVisible(panel)) return;
    if($('entGenderFilter')){ /* refresh options */ const cur=$('entGenderFilter').value; const o=genderOptions(); $('entGenderFilter').innerHTML='<option value="">All</option>'+o.map(g=>'<option value="'+esc(upc(g))+'">'+esc(g)+'</option>').join(''); if(cur) $('entGenderFilter').value=cur; applyGenderFilter(); return; }
    const nat=labeledSelect(['NATIONALITY']); if(!nat) return;         /* fail safe */
    const sel=document.createElement('select'); sel.id='entGenderFilter';
    if(nat.sel){ sel.className=nat.sel.className; sel.style.cssText=nat.sel.style.cssText; }
    const o=genderOptions(); sel.innerHTML='<option value="">All</option>'+o.map(g=>'<option value="'+esc(upc(g))+'">'+esc(g)+'</option>').join('');
    sel.addEventListener('change', ()=>{ _gender=sel.value; applyGenderFilter(); });
    /* wrap to mirror the Nationality field (label + select) and insert AFTER it */
    const natWrap=nat.wrap;
    const wrap=document.createElement(natWrap.tagName); wrap.className=natWrap.className; wrap.style.cssText=natWrap.style.cssText;
    const lbl=document.createElement('label'); lbl.textContent='Gender'; const natLbl=natWrap.querySelector('label'); if(natLbl){ lbl.className=natLbl.className; lbl.style.cssText=natLbl.style.cssText; }
    wrap.appendChild(lbl); wrap.appendChild(sel);
    natWrap.parentNode.insertBefore(wrap, natWrap.nextSibling);
    applyGenderFilter();
    log('Gender filter inserted after Nationality');
  }
  setInterval(ensureGenderFilter, 800); ensureGenderFilter();
  setInterval(()=>{ if(_gender) applyGenderFilter(); }, 1200);

  /* ============================================================
     2) STATUS ROW SHADE
     ============================================================ */
  function statusClass(s){ s=upc(s); if(s.includes('USED')&&!s.includes('UNUSED')) return 'ent-st-used'; if(s.includes('UNUSED')) return 'ent-st-unused'; if(s.includes('ALLOCAT')) return 'ent-st-alloc'; if(s.includes('EXPIR')) return 'ent-st-expired'; if(s.includes('CANCEL')) return 'ent-st-cancel'; return ''; }
  function applyStatusShade(){
    const t=visaTable(); if(!t) return; const si=colIndex(t,'STATUS'); if(si<0) return;
    [...t.querySelectorAll('tbody tr')].forEach(tr=>{ if(tr.querySelector('th')) return; const raw=(tr.children[si]||{}).textContent||tr.textContent; const cls=statusClass(raw); ['ent-st-used','ent-st-unused','ent-st-alloc','ent-st-expired','ent-st-cancel'].forEach(c=>tr.classList.remove(c)); if(cls) tr.classList.add(cls); });
  }
  setInterval(applyStatusShade, 700); applyStatusShade();

  window._entR01Diag=function(){ const t=visaTable(); return JSON.stringify({ tableFound:!!t, genderCol:t?colIndex(t,'GENDER'):null, statusCol:t?colIndex(t,'STATUS'):null, genderOptions:genderOptions(), gender:_gender }, null, 1); };

  console.log('%c🎛 R-01 Gender filter + status row shade v'+V+' active','color:#2E6FA3;font-weight:bold;');
})();

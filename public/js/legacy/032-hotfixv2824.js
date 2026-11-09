
(function HotfixV2824(){
  'use strict';
  const V = '2.8.24';

  /* Set default QIWA mode preference to Hijri (safe — only if unset).
     No effect on any input boxes. */
  try {
    if (localStorage.getItem('safwatEnt.qiwaDisplayMode') == null) {
      localStorage.setItem('safwatEnt.qiwaDisplayMode', 'hijri');
      console.log('%c[v2.8.24] Default QIWA mode → Hijri', 'color:#8C6A22');
    }
  } catch {}

  /* Shorten the label wherever it appears. Runs each time the
     Bulk Edit button is clicked (bubble phase — after modal opens). */
  function shortenLabel() {
    document.querySelectorAll('.v2823-lbl > span').forEach(span => {
      if (span.textContent && span.textContent.includes('Delegation Date (Ratification)')) {
        span.textContent = 'Set Delegation Date:';
      }
    });
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.id === 'visaBulkEditBtn') {
      setTimeout(shortenLabel, 50);
      setTimeout(shortenLabel, 300);
    }
  }, false);

  setTimeout(shortenLabel, 500);

  console.log('%c✔ Labels-only fix v' + V + ' active', 'color:#8C6A22;font-weight:bold;');
})();

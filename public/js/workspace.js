/* Workspace presentation only. No database writes or authentication changes. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const nav = document.querySelector('.sidebar nav');
  const signedIn = () => document.body.classList.contains('ent-authenticated');
  const labels = { home: 'Home', visa: 'Visa intelligence', pipeline: 'Recruitment pipeline', operations: 'Operations', offer: 'Offer studio', guide: 'Explore all tools' };
  const descriptions = { visa: 'Track assignments and visa deadlines.', pipeline: 'Move recruitment forward, one candidate at a time.', operations: 'See client delivery and your next follow-ups.', offer: 'Turn candidate details into a ready-to-send offer.', guide: 'Find the right tool for your next task.' };
  let recent = [], opened = false;
  const tabs = () => [...nav.querySelectorAll('.tab[data-tab]')].filter(t => !t.disabled && getComputedStyle(t).display !== 'none' && getComputedStyle(t).visibility !== 'hidden');
  function open(key) {
    if (!signedIn()) return;
    const tab = tabs().find(t => t.dataset.tab === key);
    if (!tab) return;
    tab.click();
    const heading = document.querySelector('#panel-' + key + ' h2');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  function render() {
    if (!signedIn()) return;
    const available = tabs();
    $('wsDate').textContent = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date());
    $('wsRecent').replaceChildren();
    for (const key of recent.filter(k => available.some(t => t.dataset.tab === k))) {
      const b = document.createElement('button'); b.className = 'ws-recent'; b.textContent = labels[key] || available.find(t => t.dataset.tab === key).textContent.trim(); b.onclick = () => open(key); $('wsRecent').append(b);
    }
    $('wsRecentEmpty').hidden = $('wsRecent').children.length > 0;
    document.querySelectorAll('[data-ws-open]').forEach(b => { b.hidden = !available.some(t => t.dataset.tab === b.dataset.wsOpen); });
  }
  const dialog = $('wsSearchDialog'), input = $('wsSearch');
  function results() {
    $('wsResults').replaceChildren();
    if (!signedIn()) return;
    const terms = input.value.toLowerCase().trim().split(/\s+/);
    for (const t of tabs()) {
      const key = t.dataset.tab, description = descriptions[key] || 'Open this workspace';
      if (!terms.every(q => (t.textContent + ' ' + description).toLowerCase().includes(q))) continue;
      const b = document.createElement('button'); b.className = 'ws-result';
      const title = document.createElement('strong'), detail = document.createElement('span');
      title.textContent = t.textContent.trim(); detail.textContent = description;
      b.append(title, detail); b.onclick = () => { dialog.close(); open(key); }; $('wsResults').append(b);
    }
    $('wsSearchStatus').textContent = $('wsResults').children.length ? `${$('wsResults').children.length} tools available` : 'No matching tools. Try visa, offer or PDF.';
  }
  $('wsFind').onclick = () => { if (!signedIn()) return; input.value = ''; results(); dialog.showModal(); input.focus(); };
  $('wsCloseSearch').onclick = () => dialog.close();
  dialog.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dialog.close(); } });
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
  input.oninput = results;
  input.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); $('wsResults').querySelector('button')?.focus(); } if (e.key === 'Enter') { e.preventDefault(); $('wsResults').querySelector('button')?.click(); } });
  $('wsResults').addEventListener('keydown', e => { const rows = [...$('wsResults').children], i = rows.indexOf(document.activeElement); if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); rows[(i + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length]?.focus(); } });
  function menu(show) { document.body.classList.toggle('ws-menu-open', show); $('wsMenu').setAttribute('aria-expanded', String(show)); $('wsDismiss').hidden = !show; }
  $('wsMenu').onclick = () => menu(!document.body.classList.contains('ws-menu-open'));
  $('wsDismiss').onclick = () => menu(false);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('ws-menu-open')) { menu(false); $('wsMenu').focus(); } });
  document.querySelectorAll('[data-ws-open]').forEach(b => b.onclick = () => open(b.dataset.wsOpen));
  nav.addEventListener('click', e => {
    const tab = e.target.closest('.tab[data-tab]'); if (!tab || !signedIn()) return;
    const key = tab.dataset.tab;
    if (key !== 'home') recent = [key, ...recent.filter(k => k !== key)].slice(0, 4);
    $('wsLocation').textContent = labels[key] || tab.textContent.trim();
    menu(false); render();
  });
  function session() {
    if (!signedIn()) { recent = []; opened = false; $('wsRecent').replaceChildren(); $('wsResults').replaceChildren(); input.value = ''; dialog.close(); menu(false); return; }
    render();
    if (!opened && !document.documentElement.classList.contains('ceo-route')) { opened = true; open('home'); }
  }
  new MutationObserver(session).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  // Role changes can hide tools without changing the session class.
  new MutationObserver(() => { render(); if (dialog.open) results(); }).observe(nav, { subtree: true, attributes: true, attributeFilter: ['style', 'disabled'] });
  session();
})();

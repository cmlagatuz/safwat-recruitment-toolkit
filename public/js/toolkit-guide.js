(function () {
  'use strict';
  const descriptions = {
    database: 'Administration, imports, backups and data health',
    visa: 'Visa inventory, expiry dates, assignments and reports',
    pipeline: 'Candidate stages, recruitment details and bulk editing',
    operations: 'Client delivery summaries, overdue follow-ups and deadlines',
    offer: 'Create offer letters using a template and candidate data',
    extract: 'Extract selected file types from folders',
    sort: 'Sort files into folders', rename: 'Rename a batch of files',
    mkfolders: 'Create folders from a list', list: 'List files and folders',
    merge: 'Merge PDF files by folder', convert: 'Word and PDF conversion workflow',
    delete: 'Delete Word files with the existing confirmation workflow'
  };
  const list = document.getElementById('guideTools'), search = document.getElementById('guideSearch');
  if (!list || !search) return;
  function render() {
    list.replaceChildren();
    const tokens = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    for (const tab of document.querySelectorAll('aside nav .tab[data-tab]')) {
      const key = tab.dataset.tab;
      if (!descriptions[key] || tab.disabled || !tab.getClientRects().length || getComputedStyle(tab).visibility === 'hidden') continue;
      const text = tab.textContent.trim(), description = descriptions[key];
      if (!tokens.every(token => (text + ' ' + description).toLowerCase().includes(token))) continue;
      const row = document.createElement('div'); row.style.cssText = 'padding:14px 0;border-bottom:1px solid var(--rule,#ddd)';
      const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
      button.addEventListener('click', () => {
        if (tab.disabled || !tab.getClientRects().length || getComputedStyle(tab).visibility === 'hidden') return;
        tab.click();
        const heading = document.querySelector('#panel-' + key + ' h2');
        if (heading) { heading.tabIndex = -1; heading.focus(); }
      });
      const detail = document.createElement('p'); detail.textContent = description; detail.style.margin = '6px 0 0';
      row.append(button, detail); list.append(row);
    }
    document.getElementById('guideCount').textContent = `${list.children.length} available tools`;
  }
  search.addEventListener('input', render);
  document.querySelector('[data-tab="guide"]').addEventListener('click', render);
  new MutationObserver(() => {
    if (!document.body.classList.contains('ent-authenticated')) { list.replaceChildren(); search.value = ''; }
    else if (document.getElementById('panel-guide').classList.contains('active')) render();
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();

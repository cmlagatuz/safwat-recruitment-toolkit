/* Read-only operations workspace. Never writes to RTDB or mutates window.DB. */
(function () {
  'use strict';
  const C = window.SafwatCore;
  const panel = document.getElementById('panel-operations');
  if (!C || !panel) return;
  const $ = id => document.getElementById(id);
  const h = C.escapeHtml;
  let model = null, filtered = [], page = 0;
  const pageSize = 50;
  panel.innerHTML = `
    <div class="panel-head"><div class="eyebrow">R-03 · Daily operations</div><h2>Operations</h2>
      <p class="desc">Prioritize follow-ups, review client delivery, and monitor visa deadlines from your loaded database.</p></div>
    <div class="card ops-controls">
      <label>Client<select id="opsClient"><option value="">All clients</option></select></label>
      <label>Follow-up after (days)<input id="opsStale" type="number" min="1" max="365" value="14"></label>
      <label>Expiry horizon (days)<input id="opsHorizon" type="number" min="0" max="365" value="30"></label>
      <button id="opsRefresh" type="button">Refresh analysis</button>
    </div>
    <p id="opsStatus" role="status" aria-live="polite"></p>
    <div id="opsMetrics" class="ops-metrics"></div>
    <div class="card"><div class="ops-heading"><h3>Client delivery snapshot</h3><div><button id="opsExportClients" type="button">Export client summary</button> <button id="opsPrint" type="button">Print summary</button></div></div>
      <p>Current candidate counts, not job-order demand or historical monthly activity. Deployment rate = deployed ÷ all candidates. “Closed” excludes deployed candidates.</p>
      <div class="ops-scroll"><table class="ops-table"><caption class="ops-sr">Client recruitment summary</caption><thead><tr><th>Client</th><th>Candidates</th><th>Active</th><th>Deployed</th><th>Closed</th><th>Deployment rate</th><th>Follow-ups</th><th>Visa slots</th><th>Expiry alerts</th></tr></thead><tbody id="opsClients"></tbody></table></div>
    </div>
    <div class="card" id="opsQueueCard"><div class="ops-heading"><h3>Action queue</h3><button id="opsExportQueue" type="button">Export filtered queue</button></div>
      <p>Follow-up age uses the last record update, then creation or request date; it is not time in stage. Expiry alerts use recorded dates, not assumed visa validity.</p>
      <div class="ops-controls"><label class="ops-search">Search all words<input id="opsSearch" type="search" placeholder="Name, passport, client, agency or ID"></label>
        <label>Action type<select id="opsType"><option value="">All actions</option><option value="expiry">Visa deadlines</option><option value="follow-up">Follow-ups</option><option value="data-quality">Data review</option></select></label>
        <button id="opsReset" type="button">Clear filters</button></div>
      <p id="opsCount" role="status" aria-live="polite"></p>
      <div class="ops-scroll"><table class="ops-table"><caption class="ops-sr">Prioritized recruitment actions</caption><thead><tr><th>Priority</th><th>Record</th><th>Client / agency</th><th>Status</th><th>Action needed</th><th>Date</th><th>Details</th></tr></thead><tbody id="opsQueue"></tbody></table></div>
      <div class="ops-pager"><button id="opsPrev" type="button">Previous</button><span id="opsPage"></span><button id="opsNext" type="button">Next</button></div>
    </div>
    <dialog id="opsDetail" aria-labelledby="opsDetailTitle"><div class="ops-heading"><h3 id="opsDetailTitle">Record details</h3><button id="opsClose" type="button">Close</button></div><div id="opsDetailBody"></div></dialog>`;
  function available() {
    // Reuse the visible session gate, never treat this as a replacement for RTDB authorization.
    return document.body.classList.contains('ent-authenticated') && !!window.DB;
  }
  function clear() {
    model = null; filtered = [];
    $('opsMetrics').replaceChildren(); $('opsClients').replaceChildren(); $('opsQueue').replaceChildren();
    $('opsCount').textContent = ''; $('opsPage').textContent = '';
    $('opsClient').innerHTML = '<option value="">All clients</option>';
    $('opsDetailBody').replaceChildren(); if ($('opsDetail').open) $('opsDetail').close();
    ['opsExportClients', 'opsExportQueue', 'opsPrint', 'opsPrev', 'opsNext'].forEach(id => $(id).disabled = true);
    $('opsStatus').textContent = 'Sign in and load a database to view operations.';
  }
  function selectedClients() { return model.clients.filter(r => !$('opsClient').value || r.client === $('opsClient').value); }
  function renderSummary() {
    const rows = selectedClients();
    const total = key => rows.reduce((sum, r) => sum + r[key], 0);
    $('opsMetrics').innerHTML = [['Active candidates', total('active')], ['Deployed', total('deployed')], ['Closed candidates', total('closed')], ['Follow-ups due', total('stale')], ['Visa expiry alerts', total('expiryAlerts')]].map(([label, value]) => `<div class="ops-metric"><strong>${value.toLocaleString()}</strong><span>${label}</span></div>`).join('');
    $('opsClients').innerHTML = rows.map(r => `<tr><th scope="row">${h(r.client)}</th>${[r.total, r.active, r.deployed, r.closed, r.total ? (r.deployed / r.total * 100).toFixed(1) + '%' : '—', r.stale, r.visas, r.expiryAlerts].map(v => `<td>${h(v)}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="9">No client records.</td></tr>';
  }
  function renderQueue() {
    if (!available() || !model) return clear();
    filtered = C.filterQueue(model.queue, { search: $('opsSearch').value, type: $('opsType').value, client: $('opsClient').value });
    page = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
    const start = page * pageSize;
    $('opsCount').textContent = `${filtered.length} actions · ${new Set(filtered.map(r => r.kind + ':' + r.id)).size} records. One visa can have two expiry alerts.`;
    $('opsQueue').innerHTML = filtered.slice(start, start + pageSize).map((r, i) => `<tr><td><span class="ops-priority p${r.priority}">${['', 'Urgent', 'Follow up', 'Review'][r.priority]}</span></td><td><strong>${h(r.name)}</strong><small>${h(r.id)} · ${h(r.kind)}</small></td><td>${h(r.client)}<small>${h(r.agency)}</small></td><td>${h(r.status)}</td><td>${h(r.reason)}</td><td>${h(r.date || '—')}</td><td><button type="button" data-ops-row="${start + i}" aria-label="View ${h(r.id)}">View</button></td></tr>`).join('') || '<tr><td colspan="7">No actions match these filters.</td></tr>';
    $('opsPage').textContent = filtered.length ? `${start + 1}–${Math.min(start + pageSize, filtered.length)} of ${filtered.length}` : '0 actions';
    $('opsPrev').disabled = page === 0; $('opsNext').disabled = start + pageSize >= filtered.length;
    $('opsExportQueue').disabled = !filtered.length;
  }
  function refresh() {
    if (!available()) return clear();
    const staleDays = Number($('opsStale').value), horizon = Number($('opsHorizon').value);
    if (!$('opsStale').value || !$('opsHorizon').value || !Number.isInteger(staleDays) || staleDays < 1 || staleDays > 365 || !Number.isInteger(horizon) || horizon < 0 || horizon > 365) {
      $('opsStatus').textContent = 'Use whole days: follow-up 1–365 and expiry horizon 0–365.'; return;
    }
    model = C.analyze(window.DB, { staleDays, horizon });
    const previous = $('opsClient').value;
    $('opsClient').innerHTML = '<option value="">All clients</option>' + model.clients.map(r => `<option value="${h(r.client)}">${h(r.client)}</option>`).join('');
    if (model.clients.some(r => r.client === previous)) $('opsClient').value = previous;
    $('opsStatus').textContent = `Snapshot refreshed ${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Riyadh' })} Riyadh · ${C.today()} · ${model.cases} candidates / ${model.visas} visas. Refresh after edits or cloud updates.`;
    $('opsExportClients').disabled = !model.clients.length; $('opsPrint').disabled = !model.clients.length;
    renderSummary(); renderQueue();
  }
  function download(name, headers, rows) {
    if (!available()) return clear();
    const blob = new Blob([C.csv(headers, rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `${name}-${C.today()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('opsRefresh').addEventListener('click', refresh);
  document.querySelector('[data-tab="operations"]').addEventListener('click', refresh);
  $('opsClient').addEventListener('change', () => { if (!available() || !model) return clear(); page = 0; renderSummary(); renderQueue(); });
  $('opsSearch').addEventListener('input', () => { page = 0; renderQueue(); });
  $('opsType').addEventListener('change', () => { page = 0; renderQueue(); });
  $('opsPrev').addEventListener('click', () => { page--; renderQueue(); });
  $('opsNext').addEventListener('click', () => { page++; renderQueue(); });
  $('opsReset').addEventListener('click', () => { $('opsClient').value = ''; $('opsSearch').value = ''; $('opsType').value = ''; page = 0; refresh(); });
  $('opsExportClients').addEventListener('click', () => {
    if (!model) return;
    download('Safwat-client-summary', ['Client', 'Candidates', 'Active', 'Deployed', 'Closed', 'Deployment rate (%)', 'Follow-ups due', 'Visa slots', 'Expiry alerts'], selectedClients().map(r => [r.client, r.total, r.active, r.deployed, r.closed, r.total ? +(r.deployed / r.total * 100).toFixed(1) : '', r.stale, r.visas, r.expiryAlerts]));
  });
  $('opsExportQueue').addEventListener('click', () => download('Safwat-action-queue', ['Priority', 'Type', 'Record ID', 'Name', 'Client', 'Agency', 'Status', 'Action', 'Date', 'Days'], filtered.map(r => [r.priority, r.kind, r.id, r.name, r.client, r.agency, r.status, r.reason, r.date, r.days])));
  $('opsQueue').addEventListener('click', event => {
    const button = event.target.closest('[data-ops-row]');
    if (!button || !available()) return;
    const item = filtered[Number(button.dataset.opsRow)]; if (!item) return;
    const row = (window.DB[item.kind === 'case' ? 'recruitmentCases' : 'visaRecords'] || []).find(r => r.id === item.id);
    if (!row) { refresh(); return; }
    $('opsDetailTitle').textContent = `${item.name} · ${item.id}`;
    const fields = item.kind === 'case' ? ['name', 'passport', 'nationality', 'position', 'client', 'agency', 'stage', 'requestDate', 'updatedAt', 'linkedVisaId', 'notes'] : ['fullName', 'passport', 'nationality', 'client', 'registeredAgencyName', 'statusVisa', 'visaCategory', 'visaDocumentNumber', 'expirationDate', 'candidateVisaExpiration', 'arrivalDate', 'linkedRecruitmentCaseId', 'notes'];
    $('opsDetailBody').innerHTML = '<p>Read-only details. Use Visa Report or Recruitment Pipeline to edit this record.</p><dl>' + fields.map(key => `<dt>${h(key.replace(/([A-Z])/g, ' $1'))}</dt><dd>${h(row[key] == null || row[key] === '' ? '—' : row[key])}</dd>`).join('') + '</dl>';
    $('opsDetail').showModal();
  });
  $('opsClose').addEventListener('click', () => $('opsDetail').close());
  $('opsPrint').addEventListener('click', () => { if (!available()) return clear(); document.body.classList.add('ops-print'); window.print(); });
  window.addEventListener('afterprint', () => document.body.classList.remove('ops-print'));
  // Clear derived personal data when the application's auth gate closes.
  new MutationObserver(() => { if (!available()) clear(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  clear();
})();

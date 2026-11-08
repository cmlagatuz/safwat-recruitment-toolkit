/* Shared, dependency-free helpers. Node exports allow tests without Firebase. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SafwatCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function isoDate(value) {
    if (value == null || value === '') return null;
    if (value instanceof Date) {
      if (!Number.isFinite(value.getTime())) return null;
      return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
    }
    const text = String(value).trim();
    let m = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|T\d{2}:\d{2})/);
    if (!m) { const dmy = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/); if (dmy) m = [dmy[0], dmy[3], dmy[2], dmy[1]]; }
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (y < 1000 || y > 9999 || mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) return null;
    return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  function dayNumber(value) { const iso = isoDate(value); return iso ? Date.parse(iso + 'T00:00:00Z') / 86400000 : null; }
  function today() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const get = type => parts.find(p => p.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
  function csvCell(value) {
    let s = String(value == null ? '' : value);
    // Untrusted text must not become a spreadsheet formula, including after whitespace.
    if (typeof value !== 'number' && (/^[\s\uFEFF]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s))) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csv(headers, rows) { return '\uFEFF' + [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n'); }
  function parseDatabase(text) {
    const db = JSON.parse(text);
    if (!db || typeof db !== 'object' || Array.isArray(db) || !Array.isArray(db.recruitmentCases) || !Array.isArray(db.visaRecords)) throw new Error('Expected a database with recruitmentCases and visaRecords arrays.');
    for (const key of ['recruitmentCases', 'visaRecords']) {
      const ids = new Set();
      for (const record of db[key]) {
        if (!record || typeof record !== 'object' || Array.isArray(record) || typeof record.id !== 'string' || !record.id.trim()) throw new Error(key + ': each record needs a non-empty string ID.');
        if (ids.has(record.id)) throw new Error(key + ': duplicate ID ' + record.id);
        ids.add(record.id);
      }
    }
    if (db.meta != null && (typeof db.meta !== 'object' || Array.isArray(db.meta))) throw new Error('Database meta must be an object.');
    if (db.customStages != null && (!Array.isArray(db.customStages) || db.customStages.some(s => typeof s !== 'string'))) throw new Error('customStages must contain text values.');
    return { ...db, meta: db.meta || { version: 1, createdAt: new Date().toISOString(), savedAt: null }, customStages: db.customStages || [] };
  }
  const norm = v => String(v == null ? '' : v).trim().toUpperCase().replace(/\s+/g, ' ');
  const deployed = new Set(['DEPLOYED', 'ACTIVE', 'TRANSFERRED', 'DEPLOYED APPLICANTS']);
  const closed = new Set(['UNFIT', 'WITHDRAWN/BACKOUT', 'WITHDRAWN', 'WITHDRAWED APPLICATION', 'BACKOUT', 'REJECTED', 'CANCELLED', 'CANCELED', 'TERMINATED', 'AWOL', 'END OF SERVICE']);
  function state(stage) { const s = norm(stage); return deployed.has(s) ? 'deployed' : closed.has(s) ? 'closed' : 'active'; }
  function analyze(db, options = {}) {
    const now = dayNumber(options.today || today());
    if (now === null) throw new Error('Invalid analysis date.');
    const staleDays = Number.isFinite(+options.staleDays) ? Math.max(1, +options.staleDays) : 14;
    const horizon = Number.isFinite(+options.horizon) ? Math.max(0, +options.horizon) : 30;
    const cases = Array.isArray(db?.recruitmentCases) ? db.recruitmentCases.filter(Boolean) : [];
    const visas = Array.isArray(db?.visaRecords) ? db.visaRecords.filter(Boolean) : [];
    const clients = new Map(), queue = [];
    const clientFor = row => String(row.client || '').trim() || '(Unassigned)';
    function group(row) {
      const name = clientFor(row);
      if (!clients.has(name)) clients.set(name, { client: name, total: 0, active: 0, deployed: 0, closed: 0, stale: 0, visas: 0, expiryAlerts: 0 });
      return clients.get(name);
    }
    function add(kind, row, type, priority, reason, date, days) {
      queue.push({ kind, id: String(row.id || ''), name: row.name || row.fullName || '(Unnamed)', client: clientFor(row), agency: row.agency || row.registeredAgencyName || '', status: row.stage || row.statusVisa || '', type, priority, reason, date: date || '', days, passport: row.passport || '' });
    }
    for (const row of cases) {
      const g = group(row), bucket = state(row.stage); g.total++; g[bucket]++;
      if (bucket !== 'active') continue;
      const last = isoDate(row.updatedAt) || isoDate(row.createdAt) || isoDate(row.requestDate);
      const age = last ? now - dayNumber(last) : null;
      if (age !== null && age >= staleDays) { g.stale++; add('case', row, 'follow-up', 2, `No recorded update for ${age} days`, last, age); }
      if (!last) add('case', row, 'data-quality', 3, 'Missing or invalid activity date', '', null);
      if (!String(row.client || '').trim()) add('case', row, 'data-quality', 3, 'Assign a client', '', null);
      if (row.needsReview) add('case', row, 'data-quality', 3, 'Record flagged for review', '', null);
    }
    for (const row of visas) {
      const g = group(row); g.visas++;
      const status = norm(row.statusVisa);
      if (['CANCELLED', 'CANCELED', 'EXPIRED'].includes(status)) continue;
      for (const [field, label] of [['expirationDate', 'Qiwa visa'], ['candidateVisaExpiration', 'Candidate entry visa']]) {
        // A used slot has no remaining Qiwa allocation; a recorded arrival completes entry usage.
        if (field === 'expirationDate' && status === 'USED') continue;
        if (field === 'candidateVisaExpiration' && isoDate(row.arrivalDate)) continue;
        if (!row[field]) continue;
        const date = isoDate(row[field]);
        if (!date) { add('visa', row, 'data-quality', 3, `Invalid ${label.toLowerCase()} expiry`, '', null); continue; }
        const days = dayNumber(date) - now;
        if (days <= horizon) { g.expiryAlerts++; add('visa', row, 'expiry', days <= 7 ? 1 : 2, `${label}: ${days < 0 ? `expired ${-days} days ago` : days === 0 ? 'expires today' : `expires in ${days} days`}`, date, days); }
      }
    }
    queue.sort((a, b) => a.priority - b.priority || (a.type === 'expiry' && b.type === 'expiry' ? a.days - b.days : a.type === 'follow-up' && b.type === 'follow-up' ? b.days - a.days : a.type.localeCompare(b.type)) || a.client.localeCompare(b.client) || a.id.localeCompare(b.id));
    return { clients: [...clients.values()].sort((a, b) => a.client.localeCompare(b.client)), queue, cases: cases.length, visas: visas.length };
  }
  function filterQueue(rows, filters = {}) {
    const tokens = norm(filters.search).split(/\s+/).filter(Boolean);
    return rows.filter(r => (!filters.client || r.client === filters.client) && (!filters.type || r.type === filters.type) && tokens.every(t => norm([r.id, r.name, r.client, r.agency, r.status, r.reason, r.passport].join(' ')).includes(t)));
  }
  return { isoDate, dayNumber, today, escapeHtml, csvCell, csv, parseDatabase, state, analyze, filterQueue };
});

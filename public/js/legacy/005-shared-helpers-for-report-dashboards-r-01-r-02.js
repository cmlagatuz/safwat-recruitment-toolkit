
/* =========================================================
   SHARED HELPERS FOR REPORT DASHBOARDS (R-01, R-02)
   ========================================================= */
function readWorkbookFile(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = (e)=>{
      try{
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, {type:'array', cellDates:true});
        resolve(wb);
      }catch(err){ reject(err); }
    };
    reader.onerror = ()=> reject(reader.error || new Error('File read failed'));
    reader.readAsArrayBuffer(file);
  });
}
function sheetToRows(ws){
  return XLSX.utils.sheet_to_json(ws, {header:1, defval:null, raw:true});
}
function downloadCsv(filename, headers, rows){
  saveAs(new Blob([SafwatCore.csv(headers, rows)], {type:'text/csv;charset=utf-8'}), filename);
}
/* CLAIRE dates fix v6.1.0 — timezone-safe date → 'YYYY-MM-DD'.
   toISOString() converts to UTC, so in Saudi time (UTC+3) a date at local
   midnight became the PREVIOUS day (e.g. 01/12/2024 → 2024-11-30).
   This reads the LOCAL calendar date and treats x/y/yyyy as DAY-FIRST. */
function __claireIsoDate(raw){ return SafwatCore.isoDate(raw); }
function fmtDateISO(d){
  if(!d) return null;
  return __claireIsoDate(d);   /* v6.1.0: was toISOString() — shifted dates 1 day back in UTC+3 */
}
function daysBetween(a,b){ return Math.round((b.getTime()-a.getTime())/(1000*3600*24)); }
function esc(s){ return SafwatCore.escapeHtml(s); }
function fmtNum(n){ return (n===null||n===undefined||isNaN(n)) ? '—' : n.toLocaleString(); }

const RPT_COLORS = {
  used:'#3F6C4D', unused:'#B98A2E', allocated:'#2E6FA3', expired:'#A23B2E', cancelled:'#9B9082',
  deployed:'#3F6C4D', inPipeline:'#B98A2E', onHold:'#8C6A22', transfer:'#2E6FA3',
  exitedNotDeployed:'#A23B2E', exitedPostDeployment:'#7E2E24', unclassified:'#9B9082',
  focus:'#2E6FA3', success:'#3F6C4D', danger:'#A23B2E', brass:'#B98A2E', brassDark:'#8C6A22', slate:'#6B6558'
};

/* Simple, dependency-free sort state helper for a <table>: click a <th data-key> to sort. */
function attachTableSort(tableEl, onSortChange){
  let state = {key:null, dir:1};
  tableEl.querySelectorAll('thead th[data-key]').forEach(th=>{
    th.style.cursor = 'pointer';
    th.addEventListener('click', ()=>{
      const key = th.dataset.key;
      if(state.key===key) state.dir *= -1; else state = {key, dir:1};
      tableEl.querySelectorAll('thead th .sort-arrow').forEach(a=>a.remove());
      const arrow = document.createElement('span');
      arrow.className='sort-arrow';
      arrow.textContent = state.dir===1 ? ' \u25B2' : ' \u25BC';
      th.appendChild(arrow);
      onSortChange(state);
    });
  });
  return ()=>state;
}
function sortRows(rows, state){
  if(!state.key) return rows;
  return [...rows].sort((a,b)=>{
    let va=a[state.key], vb=b[state.key];
    const na = typeof va === 'number', nb = typeof vb === 'number';
    if(na && nb) return (va-vb)*state.dir;
    va = va===null||va===undefined ? '' : String(va);
    vb = vb===null||vb===undefined ? '' : String(vb);
    return va.localeCompare(vb)*state.dir;
  });
}



/* =========================================================
   CORE CRUD ENGINE — pure data layer, no DOM dependency.
   Two linked entities: RecruitmentCase <-> VisaRecord.
   ========================================================= */

// Flat, extensible stage vocabulary - not tied to recruitment type. Users can add custom stages
// via the UI (stored in db.customStages) alongside this default seed list.
const DEFAULT_STAGES = [
  'DEPLOYED', 'FOR DEPLOYMENT', 'FOR VISA', 'UNFIT', 'WITHDRAWN/BACKOUT', 'LOCAL TRANSFER IN PROGRESS',
  'TERMINATED', 'AWOL', 'VISA ON PROGRESS', 'Biometrics in Progress and Consular Submission', 'SVP/QVP ON PROGRESS',
  'OFFER SIGNING', 'PENDING OFFER LETTER', 'MEDICAL ON PROGRESS', 'FOR BIOMETRICS APPOINTMENT',
  'For Skills Verification Appointment', 'Visa Issued',
];
function getStageOptions(db, currentValue) {
  const custom = (db && Array.isArray(db.customStages)) ? db.customStages : [];
  const combined = [...DEFAULT_STAGES];
  custom.forEach(s => { if (!combined.includes(s)) combined.push(s); });
  // always surface the record's own current stage, even if it's an older/legacy value not in the seed list,
  // so re-opening an existing record for edit never silently swaps or loses its real stage.
  if (currentValue && !combined.includes(currentValue)) combined.push(currentValue);
  return combined;
}
function addCustomStage(db, stageName) {
  const trimmed = (stageName || '').trim();
  if (!trimmed) throw new Error('Stage name cannot be empty.');
  if (!Array.isArray(db.customStages)) db.customStages = [];
  if (!db.customStages.includes(trimmed) && !DEFAULT_STAGES.includes(trimmed)) db.customStages.push(trimmed);
  return trimmed;
}
const RECRUITMENT_TYPE_LABELS = {
  LOCAL_TRANSFER: 'Local Transfer',
  OVERSEAS_ENDORSED: 'Overseas \u2013 Endorsed',
  OVERSEAS_SOURCED: 'Overseas \u2013 Sourced',
  OVERSEAS_UNSPECIFIED: 'Overseas \u2013 Unspecified (imported, needs reclassification)',
};

const SAFWAT_NAME_VARIANTS = ['safwat al khaleej company', 'safwat al khaleej', 'safwat al khaleej co', 'safwat al khaleej co.', 'safwat hr', 'safwat al khaleej for recruitment'];
function deriveSponsor(companyName) {
  if (!companyName) return 'CLIENT';
  const norm = safeStr(companyName).toLowerCase();
  return SAFWAT_NAME_VARIANTS.some(v => norm.includes(v) || norm === v) ? 'SAFWAT' : 'CLIENT';
}

function nowIso() { return new Date().toISOString(); }
function safeStr(v) { return (v === null || v === undefined) ? '' : String(v).trim(); }

function makeIdCounter(db) {
  // derive next numeric suffix from existing ids so imports + new manual entries never collide
  let maxCase = 0, maxVisa = 0;
  (db.recruitmentCases || []).forEach(c => { const m = /^RC-(\d+)$/.exec(c.id); if (m) maxCase = Math.max(maxCase, parseInt(m[1], 10)); });
  (db.visaRecords || []).forEach(v => { const m = /^VR-(\d+)$/.exec(v.id); if (m) maxVisa = Math.max(maxVisa, parseInt(m[1], 10)); });
  return { nextCase: maxCase + 1, nextVisa: maxVisa + 1 };
}
function padId(prefix, n) { return prefix + '-' + String(n).padStart(6, '0'); }

function createEmptyDatabase() {
  return { meta: { version: 1, createdAt: nowIso(), savedAt: null }, recruitmentCases: [], visaRecords: [], customStages: [] };
}

function serializeDatabase(db) {
  return JSON.stringify({ ...db, meta: { ...db.meta, savedAt: nowIso() } }, null, 2);
}
function parseDatabase(jsonText) { return SafwatCore.parseDatabase(jsonText); }

/* ---- Recruitment Case CRUD ---- */
function addRecruitmentCase(db, fields, idCounter) {
  const id = padId('RC', idCounter.nextCase++);
  const rec = {
    id,
    name: safeStr(fields.name),
    nationality: safeStr(fields.nationality).toUpperCase(),
    position: safeStr(fields.position).toUpperCase(),
    client: safeStr(fields.client),
    recruitmentType: fields.recruitmentType || 'OVERSEAS_SOURCED',
    stage: fields.stage || 'PENDING OFFER LETTER',
    passport: safeStr(fields.passport).toUpperCase(),
    requestDate: fields.requestDate || null,
    legacyStatus: fields.legacyStatus || null,
    linkedVisaId: fields.linkedVisaId || null,
    notes: fields.notes || '',
    needsReview: !!fields.needsReview,
    createdAt: nowIso(), updatedAt: nowIso(),
  };
  db.recruitmentCases.push(rec);
  return rec;
}
function updateRecruitmentCase(db, id, patch) {
  const rec = db.recruitmentCases.find(c => c.id === id);
  if (!rec) throw new Error('Recruitment case ' + id + ' not found.');
  Object.assign(rec, patch, { updatedAt: nowIso() });
  return rec;
}
function deleteRecruitmentCase(db, id) {
  const rec = db.recruitmentCases.find(c => c.id === id);
  if (rec && rec.linkedVisaId) {
    const visa = db.visaRecords.find(v => v.id === rec.linkedVisaId);
    if (visa) visa.linkedRecruitmentCaseId = null;
  }
  db.recruitmentCases = db.recruitmentCases.filter(c => c.id !== id);
}

/* ---- Visa Record CRUD ---- */
function addVisaRecord(db, fields, idCounter) {
  const id = padId('VR', idCounter.nextVisa++);
  const rec = {
    id,
    linkedRecruitmentCaseId: fields.linkedRecruitmentCaseId || null,
    visaDocumentNumber: safeStr(fields.visaDocumentNumber),
    visaNumber: safeStr(fields.visaNumber),
    companyName: safeStr(fields.companyName),
    sponsor: deriveSponsor(fields.companyName),
    crNumber: safeStr(fields.crNumber),
    sponsorId: safeStr(fields.sponsorId),
    statusVisa: fields.statusVisa || 'ALLOCATED',
    visaCategory: safeStr(fields.visaCategory).toUpperCase(),
    // QIWA-issued visa (document-level, ~2 Hijri years / 708 days) - drives the expiry alerts
    qiwaVisaDate: fields.qiwaVisaDate || null,
    expirationDate: fields.expirationDate || null,
    // Candidate-specific stamped visa (individual, ~3 months / 90 days from approval)
    candidateVisaDate: fields.candidateVisaDate || null,
    candidateVisaExpiration: fields.candidateVisaExpiration || null,
    // Delegation / agency detail - two different delegation numbers exist in the source data,
    // but only one registered agency name; "Enjaz name" has no source column and is manual-entry only.
    visaDelegationNumber: safeStr(fields.visaDelegationNumber),
    agencyDelegationNumber: safeStr(fields.agencyDelegationNumber),
    registeredAgencyName: safeStr(fields.registeredAgencyName),
    enjazAgencyName: safeStr(fields.enjazAgencyName),
    ratifiedBy: safeStr(fields.ratifiedBy),
    ratificationDate: fields.ratificationDate || null,
    mofaApplicationNumber: safeStr(fields.mofaApplicationNumber),
    // visa copy attachment - stored as a separate file via File System Access API, this just holds the reference
    visaCopyFileName: fields.visaCopyFileName || null,
    visaCopyOriginalName: fields.visaCopyOriginalName || null,
    visaCopyUploadedAt: fields.visaCopyUploadedAt || null,
    fullName: safeStr(fields.fullName),
    passport: safeStr(fields.passport).toUpperCase(),
    nationality: safeStr(fields.nationality).toUpperCase(),
    client: safeStr(fields.client),
    arrivalDate: fields.arrivalDate || null,
    notes: fields.notes || '',
    createdAt: nowIso(), updatedAt: nowIso(),
  };
  db.visaRecords.push(rec);
  if (rec.linkedRecruitmentCaseId) {
    const c = db.recruitmentCases.find(c => c.id === rec.linkedRecruitmentCaseId);
    if (c) c.linkedVisaId = rec.id;
  }
  return rec;
}
function updateVisaRecord(db, id, patch) {
  const rec = db.visaRecords.find(v => v.id === id);
  if (!rec) throw new Error('Visa record ' + id + ' not found.');
  if ('companyName' in patch) patch.sponsor = deriveSponsor(patch.companyName);
  Object.assign(rec, patch, { updatedAt: nowIso() });
  return rec;
}
function deleteVisaRecord(db, id) {
  const rec = db.visaRecords.find(v => v.id === id);
  if (rec && rec.linkedRecruitmentCaseId) {
    const c = db.recruitmentCases.find(c => c.id === rec.linkedRecruitmentCaseId);
    if (c) c.linkedVisaId = null;
  }
  db.visaRecords = db.visaRecords.filter(v => v.id !== id);
}

/* ---- Linking helpers ---- */
function linkCaseToVisa(db, caseId, visaId) {
  const c = db.recruitmentCases.find(c => c.id === caseId);
  const v = db.visaRecords.find(v => v.id === visaId);
  if (!c || !v) throw new Error('Case or visa not found for linking.');
  // unlink any previous partner first, to keep the relationship 1:1 (a visa slot serves one case at a time)
  if (c.linkedVisaId && c.linkedVisaId !== visaId) {
    const prevVisa = db.visaRecords.find(v => v.id === c.linkedVisaId);
    if (prevVisa) prevVisa.linkedRecruitmentCaseId = null;
  }
  if (v.linkedRecruitmentCaseId && v.linkedRecruitmentCaseId !== caseId) {
    const prevCase = db.recruitmentCases.find(c => c.id === v.linkedRecruitmentCaseId);
    if (prevCase) prevCase.linkedVisaId = null;
  }
  c.linkedVisaId = v.id;
  v.linkedRecruitmentCaseId = c.id;
  c.updatedAt = nowIso(); v.updatedAt = nowIso();
}
function unlinkCase(db, caseId) {
  const c = db.recruitmentCases.find(c => c.id === caseId);
  if (!c || !c.linkedVisaId) return;
  const v = db.visaRecords.find(v => v.id === c.linkedVisaId);
  if (v) { v.linkedRecruitmentCaseId = null; v.updatedAt = nowIso(); }
  c.linkedVisaId = null; c.updatedAt = nowIso();
}

/* ---- Client management (Client is a plain string field on both entities, not a separate table) ---- */
function listClients(db) {
  const map = {};
  db.recruitmentCases.forEach(c => {
    const k = c.client || '(unspecified)';
    map[k] = map[k] || { client: k, cases: 0, visas: 0 };
    map[k].cases++;
  });
  db.visaRecords.forEach(v => {
    const k = v.client || '(unspecified)';
    map[k] = map[k] || { client: k, cases: 0, visas: 0 };
    map[k].visas++;
  });
  return Object.values(map).sort((a, b) => (b.cases + b.visas) - (a.cases + a.visas));
}
function renameClient(db, oldName, newName) {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('New client name cannot be empty.');
  let count = 0;
  db.recruitmentCases.forEach(c => { if ((c.client || '(unspecified)') === oldName) { c.client = trimmed; c.updatedAt = nowIso(); count++; } });
  db.visaRecords.forEach(v => { if ((v.client || '(unspecified)') === oldName) { v.client = trimmed; v.updatedAt = nowIso(); count++; } });
  return count;
}
function deleteClient(db, clientName) {
  const casesToRemove = db.recruitmentCases.filter(c => (c.client || '(unspecified)') === clientName);
  const visasToRemove = db.visaRecords.filter(v => (v.client || '(unspecified)') === clientName);
  casesToRemove.forEach(c => deleteRecruitmentCase(db, c.id));
  visasToRemove.forEach(v => { if (db.visaRecords.find(x => x.id === v.id)) deleteVisaRecord(db, v.id); });
  return { casesRemoved: casesToRemove.length, visasRemoved: visasToRemove.length };
}
/* ---- Bulk operations (for multi-select checkboxes in the UI) ---- */
function bulkUpdateRecruitmentCases(db, ids, patch) {
  ids.forEach(id => { try { updateRecruitmentCase(db, id, { ...patch }); } catch (e) {} });
}
function bulkDeleteRecruitmentCases(db, ids) {
  ids.forEach(id => deleteRecruitmentCase(db, id));
}
function bulkUpdateVisaRecords(db, ids, patch) {
  ids.forEach(id => { try { updateVisaRecord(db, id, { ...patch }); } catch (e) {} });
}
function bulkDeleteVisaRecords(db, ids) {
  ids.forEach(id => deleteVisaRecord(db, id));
}

const JUNK_PASSPORT_PATTERNS = [/^-+$/, /^N\/?A$/, /^PENDING$/, /^TBD$/, /^DONE$/, /^PP\s*NUMBER$/, /PICK\s*UP/, /^NONE$/, /^NIL$/, /^NOT\s*YET$/];
function isJunkPassportValue(raw) {
  if (!raw) return true;
  const norm = String(raw).trim().toUpperCase();
  if (!norm) return true;
  if (norm.length <= 2) return true; // too short to be a real passport number
  return JUNK_PASSPORT_PATTERNS.some(p => p.test(norm));
}
function cleanPassport(raw) {
  return isJunkPassportValue(raw) ? '' : String(raw).trim();
}

/* ---- Duplicate detection (used when importing, to avoid re-adding the same record) ----
   Primary key is passport (most reliable person-identifier); records without a passport
   (e.g. unassigned visa slots, or a placeholder like "-" instead of a real passport) fall
   back to a composite of other identifying fields. */
function caseDedupKey(rec) {
  const pp = isJunkPassportValue(rec.passport) ? '' : (rec.passport || '').replace(/\s+/g, '').toUpperCase();
  if (pp) return 'PP:' + pp;
  return 'NCN:' + (rec.name || '').trim().toUpperCase() + '|' + (rec.client || '').trim().toUpperCase() + '|' + (rec.nationality || '').trim().toUpperCase();
}
function visaDedupKey(rec) {
  const pp = isJunkPassportValue(rec.passport) ? '' : (rec.passport || '').replace(/\s+/g, '').toUpperCase();
  if (pp) return 'PP:' + pp;
  return 'DOC:' + (rec.visaDocumentNumber || '') + '|' + (rec.crNumber || '') + '|' + (rec.sponsorId || '') + '|' + (rec.visaCategory || '').toUpperCase() + '|' + (rec.statusVisa || '');
}
function categorizeDuplicates(existingRecords, incomingRecords, keyFn) {
  const existingCountByKey = {};
  const representativeByKey = {};
  existingRecords.forEach(rec => {
    const k = keyFn(rec);
    existingCountByKey[k] = (existingCountByKey[k] || 0) + 1;
    representativeByKey[k] = rec; // last one wins as the representative shown in previews
  });
  const usedByKey = {};
  const newRecords = [], duplicates = [];
  incomingRecords.forEach(rec => {
    const key = keyFn(rec);
    const existingCount = existingCountByKey[key] || 0;
    const usedSoFar = usedByKey[key] || 0;
    if (usedSoFar < existingCount) {
      duplicates.push({ existing: representativeByKey[key], incoming: rec });
      usedByKey[key] = usedSoFar + 1;
    } else {
      newRecords.push(rec);
    }
  });
  return { newRecords, duplicates };
}




/* Exhaustive mapping from every raw legacy status string (validated against the real workbook)
   to a recruitment type + stage in the new model. Anything not in this table falls through to
   a keyword-based fallback and is marked needsReview so it's never silently guessed. */
const RAW_STATUS_MIGRATION_TABLE = {
  'DEPLOYED': { type: 'OVERSEAS_UNSPECIFIED', stage: 'DEPLOYED' },
  'UNFIT | WITHDRAWED APPLICATION | TERMINATED | REJECTED': { type: 'OVERSEAS_UNSPECIFIED', stage: 'WITHDRAWN/BACKOUT', needsReview: true },
  'REJECTED': { type: 'OVERSEAS_UNSPECIFIED', stage: 'WITHDRAWN/BACKOUT' },
  'CANCELLED/BACK OUT/REJECTED': { type: 'OVERSEAS_UNSPECIFIED', stage: 'WITHDRAWN/BACKOUT' },
  'CANCELLED': { type: 'OVERSEAS_UNSPECIFIED', stage: 'WITHDRAWN/BACKOUT' },
  'WITHDRAWED APPLICATION': { type: 'OVERSEAS_UNSPECIFIED', stage: 'WITHDRAWN/BACKOUT' },
  'FOR INTERVIEW': { type: 'OVERSEAS_UNSPECIFIED', stage: 'FOR INTERVIEW' }, // not in the new seed list; kept verbatim as a distinct sourcing-stage rather than force-fit
  'CANCELLED/ REJECTED': { type: 'OVERSEAS_UNSPECIFIED', stage: 'WITHDRAWN/BACKOUT' },
  'WITHDRAWN': { type: 'OVERSEAS_UNSPECIFIED', stage: 'WITHDRAWN/BACKOUT' },
  'FOR VISA': { type: 'OVERSEAS_UNSPECIFIED', stage: 'FOR VISA' },
  'VISA ISSUED': { type: 'OVERSEAS_UNSPECIFIED', stage: 'Visa Issued' },
  'UNDER GRAND HYATT REVIEW': { type: 'OVERSEAS_UNSPECIFIED', stage: 'UNDER GRAND HYATT REVIEW' }, // client-specific hold, kept distinct
  'FOR PRESCREEN': { type: 'OVERSEAS_UNSPECIFIED', stage: 'FOR PRESCREEN' },
  'IN PROCESS': { type: 'OVERSEAS_UNSPECIFIED', stage: 'VISA ON PROGRESS' },
  'ACTIVE': { type: 'OVERSEAS_UNSPECIFIED', stage: 'DEPLOYED' },
  'MEDICAL': { type: 'OVERSEAS_UNSPECIFIED', stage: 'MEDICAL ON PROGRESS' },
  'FOR DEPLOYMENT': { type: 'OVERSEAS_UNSPECIFIED', stage: 'FOR DEPLOYMENT' },
  'UNFIT': { type: 'OVERSEAS_UNSPECIFIED', stage: 'UNFIT' },
  'LOCAL TRANSFER': { type: 'LOCAL_TRANSFER', stage: 'LOCAL TRANSFER IN PROGRESS' },
  'RAN AWAY': { type: 'OVERSEAS_UNSPECIFIED', stage: 'AWOL' },
  'SELECTED APPLICANTS-FOR DEPLOYMENT': { type: 'OVERSEAS_UNSPECIFIED', stage: 'FOR DEPLOYMENT' },
  'STAMPING': { type: 'OVERSEAS_UNSPECIFIED', stage: 'VISA ON PROGRESS' },
  'FOR INTERVIEWS': { type: 'OVERSEAS_UNSPECIFIED', stage: 'FOR INTERVIEW' },
  'TRANSFERRED': { type: 'LOCAL_TRANSFER', stage: 'DEPLOYED' },
  'FINAL INTERVIEW': { type: 'OVERSEAS_UNSPECIFIED', stage: 'FOR INTERVIEW' },
  'END OF SERVICE': { type: 'OVERSEAS_UNSPECIFIED', stage: 'END OF SERVICE' }, // post-deployment completion, distinct from AWOL
  'VISA ON PROCESS': { type: 'OVERSEAS_UNSPECIFIED', stage: 'VISA ON PROGRESS' },
  'TERMINATED': { type: 'OVERSEAS_UNSPECIFIED', stage: 'TERMINATED' },
  'HOLD': { type: 'OVERSEAS_UNSPECIFIED', stage: 'ON HOLD' },
  'DECLINED OFFER': { type: 'OVERSEAS_UNSPECIFIED', stage: 'WITHDRAWN/BACKOUT' },
  'WIDTHRAWN': { type: 'OVERSEAS_UNSPECIFIED', stage: 'WITHDRAWN/BACKOUT' },
  'CANDIDATE STATUS': { type: 'OVERSEAS_UNSPECIFIED', stage: 'NEEDS REVIEW', needsReview: true },
  'VISA CANCELLED': { type: 'OVERSEAS_UNSPECIFIED', stage: 'WITHDRAWN/BACKOUT' },
  'ISSUED VISA': { type: 'OVERSEAS_UNSPECIFIED', stage: 'Visa Issued' },
  'FOR VISA CANCELLATION': { type: 'OVERSEAS_UNSPECIFIED', stage: 'WITHDRAWN/BACKOUT' },
  'FOR PRE SCREENING': { type: 'OVERSEAS_UNSPECIFIED', stage: 'FOR PRESCREEN' },
  'IDLE': { type: 'OVERSEAS_UNSPECIFIED', stage: 'ON HOLD' },
  'VISA PROCESSING': { type: 'OVERSEAS_UNSPECIFIED', stage: 'VISA ON PROGRESS' },
  'TRANSFER IN PROCESS': { type: 'LOCAL_TRANSFER', stage: 'LOCAL TRANSFER IN PROGRESS' },
  'AWOL': { type: 'OVERSEAS_UNSPECIFIED', stage: 'AWOL' },
  'FOR DEPLOYMENT/CANCELLED': { type: 'OVERSEAS_UNSPECIFIED', stage: 'NEEDS REVIEW', needsReview: true },
  'MEDICAL UNFIT': { type: 'OVERSEAS_UNSPECIFIED', stage: 'UNFIT' },
  'DEPLOYED APPLICANTS': { type: 'OVERSEAS_UNSPECIFIED', stage: 'DEPLOYED' },
  'FOR CANCELLATION': { type: 'OVERSEAS_UNSPECIFIED', stage: 'WITHDRAWN/BACKOUT' },
  'FINAL EXIT': { type: 'OVERSEAS_UNSPECIFIED', stage: 'END OF SERVICE' },
  'FOR LOCAL TRANSFER': { type: 'LOCAL_TRANSFER', stage: 'LOCAL TRANSFER IN PROGRESS' },
  'VISA IN PROCESS': { type: 'OVERSEAS_UNSPECIFIED', stage: 'VISA ON PROGRESS' },
  '(BLANK)': { type: 'OVERSEAS_UNSPECIFIED', stage: 'NEEDS REVIEW', needsReview: true },
};

function mapLegacyStatus(rawStatus) {
  const key = (rawStatus || '(blank)').trim().toUpperCase();
  const hit = RAW_STATUS_MIGRATION_TABLE[key];
  if (hit) return { ...hit, autoMapped: false };
  // fallback for any value not seen when this migration was built
  let type = 'OVERSEAS_UNSPECIFIED', stage = 'NEEDS REVIEW';
  if (key.includes('TRANSFER')) type = 'LOCAL_TRANSFER';
  if (key.includes('DEPLOY') && !key.includes('FOR')) stage = 'DEPLOYED';
  else if (key.includes('INTERVIEW') || key.includes('SCREEN')) stage = 'FOR INTERVIEW';
  else if (key.includes('MEDICAL')) stage = 'MEDICAL ON PROGRESS';
  else if (key.includes('VISA') || key.includes('PROCESS') || key.includes('STAMP')) stage = 'VISA ON PROGRESS';
  else if (key.includes('HOLD') || key.includes('IDLE') || key.includes('REVIEW')) stage = 'ON HOLD';
  else if (key.includes('AWOL')) stage = 'AWOL';
  else if (key.includes('REJECT') || key.includes('WITHDRAW') || key.includes('CANCEL')) stage = 'WITHDRAWN/BACKOUT';
  else if (key.includes('UNFIT')) stage = 'UNFIT';
  else if (key.includes('TERMINAT')) stage = 'TERMINATED';
  return { type, stage, needsReview: true, autoMapped: true };
}

/* ---- Recruitment sheet extraction (extends the validated R-02 parser with passport capture) ---- */
const NAME_HEADERS = ["applicant's name", 'candidate', 'full name', 'name', 'candidate name', "candidate's name"];
const STATUS_HEADERS = ['status of candidacy', 'candidate status', 'status'];
const NATIONALITY_HEADERS = ['nationality', 'country'];
const POSITION_HEADERS = ['position', 'position applied for'];
const PASSPORT_HEADERS = ['pp number', 'passport', 'passport no', 'passport number', 'passport no.', 'pp no'];
const SECTION_KEYWORDS = ['DEPLOYED APPLICANTS', 'IN PROCESS', 'FOR INTERVIEW', 'FOR INTERVIEWS', 'FOR DEPLOYMENT',
  'CANCELLED', 'WITHDRAWN', 'ON HOLD', 'REJECTED', 'PENDING', 'IDLE', 'DEPLOYED', 'ON PROCESS',
  'FOR VISA', 'FOR OFFER', 'OFFER SENT', 'INTERVIEWED'];

function normHeader(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}
function findHeaderRowIndex(rows, maxScan) {
  maxScan = maxScan || 12;
  for (let i = 0; i < Math.min(maxScan, rows.length); i++) {
    const cells = (rows[i] || []).map(normHeader);
    const nonNull = cells.filter(c => c).length;
    const hasName = cells.some(c => NAME_HEADERS.includes(c));
    const hasSecondary = cells.some(c => STATUS_HEADERS.includes(c) || NATIONALITY_HEADERS.includes(c) || POSITION_HEADERS.includes(c));
    if (hasName && hasSecondary && nonNull >= 4) return i;
  }
  return -1;
}
function findCol(headerNorm, aliases) {
  for (let i = 0; i < headerNorm.length; i++) if (aliases.includes(headerNorm[i])) return i;
  return -1;
}

function migrateRecruitmentTracker(sheetsObj) {
  const skippedSheets = [];
  const parsedRecords = [];
  for (const sheetName of Object.keys(sheetsObj)) {
    if (/summary/i.test(sheetName) || sheetName.trim().toLowerCase() === 'master sheet') {
      skippedSheets.push({ sheet: sheetName, reason: 'rollup/summary sheet' });
      continue;
    }
    const rows = sheetsObj[sheetName];
    const headerIdx = findHeaderRowIndex(rows);
    if (headerIdx === -1) {
      skippedSheets.push({ sheet: sheetName, reason: 'no recognizable header row' });
      continue;
    }
    const headerNorm = rows[headerIdx].map(normHeader);
    const nameCol = findCol(headerNorm, NAME_HEADERS);
    const statusCol = findCol(headerNorm, STATUS_HEADERS);
    const natCol = findCol(headerNorm, NATIONALITY_HEADERS);
    const posCol = findCol(headerNorm, POSITION_HEADERS);
    const ppCol = findCol(headerNorm, PASSPORT_HEADERS);

    let currentSection = null;
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const nonNullCells = row.filter(c => c !== null && c !== undefined);
      if (nonNullCells.length === 0) continue;
      const firstCell = row[0];
      if (nonNullCells.length <= 2 && firstCell) {
        const up = String(firstCell).trim().toUpperCase();
        if (SECTION_KEYWORDS.some(kw => up.includes(kw))) { currentSection = up; continue; }
      }
      if (nameCol !== -1 && row[nameCol]) {
        let statusVal = null;
        if (statusCol !== -1 && row[statusCol]) statusVal = String(row[statusCol]).trim();
        else if (currentSection) statusVal = currentSection;
        const mapping = mapLegacyStatus(statusVal);
        parsedRecords.push({
          name: String(row[nameCol]).trim(),
          nationality: natCol !== -1 && row[natCol] ? String(row[natCol]).trim() : '',
          position: posCol !== -1 && row[posCol] ? String(row[posCol]).trim() : '',
          client: sheetName,
          recruitmentType: mapping.type,
          stage: mapping.stage,
          passport: ppCol !== -1 && row[ppCol] ? cleanPassport(row[ppCol]) : '',
          legacyStatus: statusVal || '(blank)',
          needsReview: !!mapping.needsReview,
        });
      }
    }
  }
  return { parsedRecords, skippedSheets };
}

/* ---- Visa sheet extraction (reuses the validated R-01 header/column detection, broadened
   with alias variants found in the workbook's secondary "CLIENT'S VISA" sheet) ---- */
const VISA_ALIASES = {
  visaDocNumber: ['visa document number'], crNumber: ['commercial registration number'], sponsorId: ['sponsor id'],
  statusVisa: ['status (visa)', 'status visa'], expiryGregorian: ['visa expiration (gregorian)', 'will expire on'],
  qiwaVisaDate: ['visa date (gregorian)'],
  visaCategory: ['visa category'], nationality: ['nationality'], fullName: ['full name'], passport: ['passport'],
  client: ['client'], companyName: ['company name'], arrivalDate: ['arrival date'],
  visaNumber: ['visa number'], candidateVisaDate: ['visa date'], candidateVisaExpiration: ['expiration date'],
  visaDelegationNumber: ['visa delegation number', 'delegation number'], agencyDelegationNumber: ['agency delegation number'],
  registeredAgencyName: ['delegated agency name'], ratifiedBy: ['ratified by'], ratificationDate: ['ratification date'],
  mofaApplicationNumber: ['application number (mofa)', 'application number'],
};
function findVisaHeaderRowIndex(rows, maxScan) {
  maxScan = maxScan || 15;
  let bestIdx = -1, bestScore = 0;
  for (let i = 0; i < Math.min(maxScan, rows.length); i++) {
    const cells = (rows[i] || []).map(normHeader);
    let score = 0;
    if (cells.includes('visa document number')) score += 3;
    if (cells.includes('full name')) score += 3;
    if (cells.includes('status (visa)') || cells.includes('status visa')) score += 2;
    if (cells.includes('nationality')) score += 1;
    if (cells.includes('visa category')) score += 1;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestScore >= 5 ? bestIdx : -1;
}
function buildVisaColumnMap(headerRow) {
  const norm = headerRow.map(normHeader);
  const map = {};
  for (const [field, aliases] of Object.entries(VISA_ALIASES)) {
    let found = -1;
    for (const alias of aliases) { const idx = norm.indexOf(alias); if (idx !== -1) { found = idx; break; } }
    map[field] = found;
  }
  // Some sheets label both delegation-number columns identically ("Delegation Number") rather than
  // distinguishing "Visa Delegation Number" / "Agency Delegation Number". When that happens, both
  // aliases above resolve to the same first occurrence - take the second occurrence for the agency one,
  // matching the confirmed column order (visa-side delegation number, then agency name, then agency delegation number).
  if (map.visaDelegationNumber !== -1 && map.agencyDelegationNumber === map.visaDelegationNumber) {
    const secondIdx = norm.indexOf('delegation number', map.visaDelegationNumber + 1);
    map.agencyDelegationNumber = secondIdx;
  }
  return map;
}
function extractVisaRowsFromSheet(rows) {
  const headerIdx = findVisaHeaderRowIndex(rows);
  if (headerIdx === -1) return { records: [], reason: 'no recognizable header row' };
  const columnMap = buildVisaColumnMap(rows[headerIdx]);
  const records = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every(c => c === null || c === undefined)) continue;
    const get = (field) => { const idx = columnMap[field]; return (idx !== undefined && idx !== -1 && idx < row.length) ? row[idx] : null; };
    const fullName = get('fullName');
    const visaDocNumber = get('visaDocNumber');
    if (!fullName && !visaDocNumber) continue;
    const expRaw = get('expiryGregorian');
    let expDate = null;
    if (expRaw) {
      const d = (expRaw instanceof Date) ? expRaw : new Date(expRaw);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2015) expDate = __claireIsoDate(expRaw);   /* v6.1.0 tz-safe */
    }
    const parseDateLoose = (raw) => {
      if (!raw) return null;
      const d = (raw instanceof Date) ? raw : new Date(raw);
      return (!isNaN(d.getTime()) && d.getFullYear() >= 2015) ? __claireIsoDate(raw) : null;   /* v6.1.0 tz-safe */
    };
    const qiwaVisaDate = parseDateLoose(get('qiwaVisaDate'));
    const candidateVisaDate = parseDateLoose(get('candidateVisaDate'));
    const candidateVisaExpiration = parseDateLoose(get('candidateVisaExpiration'));
    const companyName = get('companyName') ? safeToString(get('companyName')).trim() : '';
    const clientCol = get('client') ? safeToString(get('client')).trim() : '';
    // some sheets have a header/data misalignment where the "VISA CATEGORY" column holds Arabic
    // text and the actual English category sits in the very next (unlabeled) column - use that instead when detected.
    let visaCategory = get('visaCategory') ? safeToString(get('visaCategory')).trim() : '';
    const catColIdx = columnMap.visaCategory;
    if (visaCategory && /[\u0600-\u06FF]/.test(visaCategory) && catColIdx !== -1 && catColIdx + 1 < row.length) {
      const next = row[catColIdx + 1];
      if (next && !/[\u0600-\u06FF]/.test(String(next))) visaCategory = String(next).trim();
    }
    records.push({
      fullName: fullName ? safeToString(fullName).trim() : '',
      passport: get('passport') ? cleanPassport(safeToString(get('passport'))) : '',
      nationality: get('nationality') ? safeToString(get('nationality')).trim() : '',
      visaDocumentNumber: visaDocNumber ? safeToString(visaDocNumber).trim() : '',
      visaNumber: get('visaNumber') ? safeToString(get('visaNumber')).trim() : '',
      companyName,
      crNumber: get('crNumber'), sponsorId: get('sponsorId'),
      statusVisa: get('statusVisa') ? safeToString(get('statusVisa')).trim().toUpperCase() : 'ALLOCATED',
      visaCategory,
      // QIWA-issued (document-level, ~2 Hijri years) - this is what drives expiry alerts
      qiwaVisaDate,
      expirationDate: expDate,
      // candidate-specific stamped visa (~3 months from approval)
      candidateVisaDate,
      candidateVisaExpiration,
      visaDelegationNumber: get('visaDelegationNumber'),
      agencyDelegationNumber: get('agencyDelegationNumber'),
      registeredAgencyName: get('registeredAgencyName') ? safeToString(get('registeredAgencyName')).trim() : '',
      ratifiedBy: get('ratifiedBy') ? safeToString(get('ratifiedBy')).trim() : '',
      ratificationDate: parseDateLoose(get('ratificationDate')),
      mofaApplicationNumber: get('mofaApplicationNumber') ? safeToString(get('mofaApplicationNumber')).trim() : '',
      // if this sheet has no explicit Client column, and the sponsor is the client itself, the company IS the client
      client: clientCol || companyName,
      arrivalDate: get('arrivalDate') ? safeToString(get('arrivalDate')) : null,
    });
  }
  return { records };
}
function safeToString(v) { return (v === null || v === undefined) ? '' : String(v); }

function migrateVisaDatabase(sheetsObj) {
  const parsedRecords = [];
  const sheetReports = [];
  const KNOWN_NON_DATA_SHEETS = new Set(['dynamic', 'dashboard', 'dashboard (wip)', 'menu', 'settings', 'calc', 'calc2']);
  for (const sheetName of Object.keys(sheetsObj)) {
    if (KNOWN_NON_DATA_SHEETS.has(sheetName.trim().toLowerCase())) {
      sheetReports.push({ sheet: sheetName, imported: 0, reason: 'known utility/interactive sheet, not a data table' });
      continue;
    }
    const { records, reason } = extractVisaRowsFromSheet(sheetsObj[sheetName]);
    if (!records || records.length === 0) {
      sheetReports.push({ sheet: sheetName, imported: 0, reason: reason || 'no visa-shaped rows found' });
      continue;
    }
    parsedRecords.push(...records);
    sheetReports.push({ sheet: sheetName, imported: records.length });
  }
  return { parsedRecords, sheetReports };
}

/* ---- Cross-link imported cases <-> visas by normalized passport ---- */
function linkImportedRecords(db) {
  const byPassport = {};
  db.recruitmentCases.forEach(c => {
    const pp = (c.passport || '').replace(/\s+/g, '').toUpperCase();
    if (pp) { byPassport[pp] = byPassport[pp] || []; byPassport[pp].push(c); }
  });
  let linked = 0, visasWithPassport = 0;
  db.visaRecords.forEach(v => {
    const pp = (v.passport || '').replace(/\s+/g, '').toUpperCase();
    if (!pp) return;
    visasWithPassport++;
    const candidates = byPassport[pp];
    if (candidates && candidates.length) {
      // link to the first unlinked candidate case sharing this passport
      const target = candidates.find(c => !c.linkedVisaId) || candidates[0];
      if (!target.linkedVisaId && !v.linkedRecruitmentCaseId) {
        target.linkedVisaId = v.id;
        v.linkedRecruitmentCaseId = target.id;
        linked++;
      }
    }
  });
  return { linked, visasWithPassport, totalVisas: db.visaRecords.length, totalCases: db.recruitmentCases.length };
}



/* =========================================================
   DATABASE LIFECYCLE — File System Access API persistence.
   Single JSON file the user opens/creates once; every mutation
   auto-saves back to the same file handle (full-file rewrite).
   ========================================================= */

window.DB = null;              // in-memory database object (see crud_engine.js schema)
window.DB_FILE_HANDLE = null;  // FileSystemFileHandle
window.DB_ID_COUNTER = null;
window.DB_FILE_NAME = null;
window.ATTACHMENTS_DIR_HANDLE = null; // folder where visa-copy files are stored, picked once per session

async function ensureAttachmentsDir() {
  if (window.ATTACHMENTS_DIR_HANDLE) return window.ATTACHMENTS_DIR_HANDLE;
  if (!('showDirectoryPicker' in window)) { alert('Your browser does not support folder access this way. Use Chrome or Edge.'); return null; }
  try {
    window.ATTACHMENTS_DIR_HANDLE = await window.showDirectoryPicker({ mode: 'readwrite' });
    const pill = document.getElementById('attachmentsDirStatus');
    if (pill) pill.textContent = 'Attachments folder: ' + (window.ATTACHMENTS_DIR_HANDLE.name || 'selected');
    return window.ATTACHMENTS_DIR_HANDLE;
  } catch (err) {
    return null; // user cancelled the picker
  }
}

function dbIsOpen() { return DB !== null && DB_FILE_HANDLE !== null; }

async function dbSave() {
  if (!DB_FILE_HANDLE) return false;
  try {
    const writable = await DB_FILE_HANDLE.createWritable();
    await writable.write(serializeDatabase(DB));
    await writable.close();
    setDbStatus('saved');
    return true;
  } catch (err) {
    setDbStatus('error', err.message);
    return false;
  }
}

async function dbOpenExisting() {
  if (!('showOpenFilePicker' in window)) { logTo('dbLog', 'Your browser does not support opening local files this way. Use Chrome or Edge.', 'err'); return; }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'Database file', accept: { 'application/json': ['.json'] } }],
      excludeAcceptAllOption: false,
    });
    const file = await handle.getFile();
    const text = await file.text();
    DB = parseDatabase(text);
    DB_FILE_HANDLE = handle;
    DB_ID_COUNTER = makeIdCounter(DB);
    DB_FILE_NAME = file.name;
    logTo('dbLog', 'Opened ' + file.name + ' \u2014 ' + DB.recruitmentCases.length + ' recruitment case(s), ' + DB.visaRecords.length + ' visa record(s).', 'ok');
    onDatabaseReady();
  } catch (err) {
    if (err.name !== 'AbortError') logTo('dbLog', 'Could not open file: ' + err.message, 'err');
  }
}

async function dbCreateNew() {
  if (!('showSaveFilePicker' in window)) { logTo('dbLog', 'Your browser does not support creating local files this way. Use Chrome or Edge.', 'err'); return; }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'safwat_database.json',
      types: [{ description: 'Database file', accept: { 'application/json': ['.json'] } }],
    });
    DB = createEmptyDatabase();
    DB_FILE_HANDLE = handle;
    DB_ID_COUNTER = makeIdCounter(DB);
    const file = await handle.getFile().catch(() => null);
    DB_FILE_NAME = handle.name || 'safwat_database.json';
    await dbSave();
    logTo('dbLog', 'Created ' + DB_FILE_NAME + ' \u2014 empty database ready.', 'ok');
    onDatabaseReady();
  } catch (err) {
    if (err.name !== 'AbortError') logTo('dbLog', 'Could not create file: ' + err.message, 'err');
  }
}

function setDbStatus(state, detail) {
  const el = document.getElementById('dbStatusPill');
  if (!el) return;
  if (state === 'saved') { el.textContent = DB_FILE_NAME + ' \u2014 saved ' + new Date().toLocaleTimeString(); el.className = 'status-pill'; }
  else if (state === 'error') { el.textContent = 'Save failed: ' + detail; el.className = 'status-pill err'; }
}

function onDatabaseReady() {
  document.getElementById('dbNoFileNotice').style.display = 'none';
  document.getElementById('dbFileTools').style.display = 'block';
  ['visaNoDbNotice', 'pipelineNoDbNotice'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
  ['visaDashboard', 'pipelineDashboard'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'block'; });
  setDbStatus('saved');
  refreshVisaView();
  refreshPipelineView();
  renderClientsTable();
}

/* ---- Import from Excel (one-time or repeatable merge into the open database) ---- */
let pendingImport = null; // holds parsed+categorized data awaiting the user's duplicate-handling choice

async function runImport() {
  if (!dbIsOpen()) { logTo('dbLog', 'Open or create a database file first.', 'err'); return; }
  const recFile = document.getElementById('importRecruitmentFile').files[0];
  const visaFile = document.getElementById('importVisaFile').files[0];
  if (!recFile && !visaFile) { logTo('dbLog', 'Choose at least one file to import.', 'err'); return; }
  logTo('dbLog', 'Reading and comparing against your current data\u2026', 'warn');
  let caseCat = null, visaCat = null, recSkipped = [], visaSheetReports = [];
  try {
    if (recFile) {
      const wb = await readWorkbookFile(recFile);
      const sheetsObj = {};
      wb.SheetNames.forEach(sn => { sheetsObj[sn] = sheetToRows(wb.Sheets[sn]); });
      const { parsedRecords, skippedSheets } = migrateRecruitmentTracker(sheetsObj);
      recSkipped = skippedSheets;
      caseCat = categorizeDuplicates(DB.recruitmentCases, parsedRecords, caseDedupKey);
    }
    if (visaFile) {
      const wb = await readWorkbookFile(visaFile);
      const sheetsObj = {};
      wb.SheetNames.forEach(sn => { sheetsObj[sn] = sheetToRows(wb.Sheets[sn]); });
      const { parsedRecords, sheetReports } = migrateVisaDatabase(sheetsObj);
      visaSheetReports = sheetReports;
      visaCat = categorizeDuplicates(DB.visaRecords, parsedRecords, visaDedupKey);
    }
  } catch (err) {
    logTo('dbLog', 'Import failed: ' + err.message, 'err');
    return;
  }
  pendingImport = { caseCat, visaCat, recSkipped, visaSheetReports };
  showImportDecisionModal();
}

function showImportDecisionModal() {
  const { caseCat, visaCat } = pendingImport;
  const caseNew = caseCat ? caseCat.newRecords.length : 0;
  const caseDup = caseCat ? caseCat.duplicates.length : 0;
  const visaNew = visaCat ? visaCat.newRecords.length : 0;
  const visaDup = visaCat ? visaCat.duplicates.length : 0;

  const sampleRows = [];
  if (caseCat) caseCat.duplicates.slice(0, 10).forEach(d => sampleRows.push({
    type: 'Case', key: d.existing.passport || d.existing.name, existingVal: d.existing.stage, incomingVal: d.incoming.stage || d.incoming.legacyStatus,
  }));
  if (visaCat) visaCat.duplicates.slice(0, 10).forEach(d => sampleRows.push({
    type: 'Visa', key: d.existing.passport || d.existing.visaDocumentNumber, existingVal: d.existing.statusVisa, incomingVal: d.incoming.statusVisa,
  }));

  const html = `
    <p class="hint">Comparing the file(s) against what's already in your open database, matched by passport (or a fallback of name/client/nationality for visa slots with no passport yet).</p>
    <div class="kpi-grid" style="grid-template-columns:repeat(2,1fr);">
      <div class="kpi-card c-success"><div class="kpi-num">${fmtNum(caseNew + visaNew)}</div><div class="kpi-label">New records to add</div></div>
      <div class="kpi-card c-danger"><div class="kpi-num">${fmtNum(caseDup + visaDup)}</div><div class="kpi-label">Match existing records</div></div>
    </div>
    <p class="hint">Recruitment: ${fmtNum(caseNew)} new, ${fmtNum(caseDup)} duplicate(s). Visa: ${fmtNum(visaNew)} new, ${fmtNum(visaDup)} duplicate(s).</p>
    ${sampleRows.length ? `
    <div class="hint">Sample of matched records \u2014 current Stage/Status vs. what the file has:</div>
    <div class="rowlist" style="max-height:200px;">
      <table><thead><tr><th>Type</th><th>Match key</th><th>Current value</th><th>Incoming value</th></tr></thead>
      <tbody>${sampleRows.map(r => `<tr><td>${esc(r.type)}</td><td class="mono">${esc(r.key)}</td><td>${esc(r.existingVal || '\u2014')}</td><td>${esc(r.incomingVal || '\u2014')}</td></tr>`).join('')}</tbody></table>
    </div>` : ''}
    <p class="hint">Duplicate matching is exact-effort, not perfect \u2014 visa slots with no passport can only be matched by a combination of other fields, so a few edge cases may still slip through either way.</p>
    <div class="btnrow">
      <button id="imp_skipDupBtn">Add new only (skip ${fmtNum(caseDup + visaDup)} duplicate(s))</button>
      <button id="imp_overwriteBtn" class="secondary">Add new + overwrite duplicates with file data</button>
      <button id="imp_cancelBtn" class="secondary">Cancel import</button>
    </div>`;
  openModal('Review Import \u2014 New vs. Duplicate Records', html);
  document.getElementById('imp_cancelBtn').addEventListener('click', () => { pendingImport = null; closeModal(); logTo('dbLog', 'Import cancelled \u2014 no changes made.', 'warn'); });
  document.getElementById('imp_skipDupBtn').addEventListener('click', () => commitImport(false));
  document.getElementById('imp_overwriteBtn').addEventListener('click', () => commitImport(true));
}

async function commitImport(overwrite) {
  const { caseCat, visaCat, recSkipped, visaSheetReports } = pendingImport;
  let caseAdded = 0, caseOverwritten = 0, visaAdded = 0, visaOverwritten = 0;
  if (caseCat) {
    caseCat.newRecords.forEach(rec => { addRecruitmentCase(DB, rec, DB_ID_COUNTER); caseAdded++; });
    if (overwrite) caseCat.duplicates.forEach(d => { updateRecruitmentCase(DB, d.existing.id, d.incoming); caseOverwritten++; });
  }
  if (visaCat) {
    visaCat.newRecords.forEach(rec => { addVisaRecord(DB, rec, DB_ID_COUNTER); visaAdded++; });
    if (overwrite) visaCat.duplicates.forEach(d => { updateVisaRecord(DB, d.existing.id, d.incoming); visaOverwritten++; });
  }
  const linkResult = linkImportedRecords(DB);
  logTo('dbLog', 'Recruitment: ' + caseAdded + ' new case(s) added' + (overwrite ? ', ' + caseOverwritten + ' duplicate(s) overwritten' : ', ' + (caseCat ? caseCat.duplicates.length : 0) + ' duplicate(s) skipped') + '. Skipped sheets: ' + recSkipped.map(s => s.sheet).join(', '), 'ok');
  logTo('dbLog', 'Visa: ' + visaAdded + ' new record(s) added' + (overwrite ? ', ' + visaOverwritten + ' duplicate(s) overwritten' : ', ' + (visaCat ? visaCat.duplicates.length : 0) + ' duplicate(s) skipped') + ' from: ' + visaSheetReports.filter(s => s.imported > 0).map(s => s.sheet + ' (' + s.imported + ')').join(', '), 'ok');
  logTo('dbLog', 'Linked ' + linkResult.linked + ' of ' + linkResult.visasWithPassport + ' passport-bearing visa record(s) to a recruitment case by passport match.', 'ok');
  const needsReview = DB.recruitmentCases.filter(c => c.needsReview).length;
  if (needsReview > 0) logTo('dbLog', needsReview + ' case(s) flagged "Needs Review" \u2014 filter by stage to find them.', 'warn');
  pendingImport = null;
  await dbSave();
  closeModal();
  onDatabaseReady();
}

/* ---- Export to Excel (Excel is now output-only) ---- */
function runExport() {
  if (!dbIsOpen()) { logTo('dbLog', 'Open or create a database file first.', 'err'); return; }
  const wb = XLSX.utils.book_new();
  const caseRows = DB.recruitmentCases.map(c => ({
    ID: c.id, Name: c.name, Nationality: c.nationality, Position: c.position, Client: c.client,
    'Recruitment Type': RECRUITMENT_TYPE_LABELS[c.recruitmentType] || c.recruitmentType, Stage: c.stage,
    Passport: c.passport, 'Request Date': c.requestDate, 'Linked Visa ID': c.linkedVisaId || '',
    'Needs Review': c.needsReview ? 'Yes' : '', Notes: c.notes,
  }));
  const visaRows = DB.visaRecords.map(v => ({
    ID: v.id, 'Full Name': v.fullName, Passport: v.passport, Nationality: v.nationality,
    'Visa Document Number': v.visaDocumentNumber, 'Visa Number': v.visaNumber, 'Company Name': v.companyName, Sponsor: v.sponsor,
    'CR Number': v.crNumber, 'Sponsor ID': v.sponsorId, Status: v.statusVisa, Category: v.visaCategory,
    'QIWA Visa Date': v.qiwaVisaDate, 'QIWA Visa Expiration': v.expirationDate,
    'Candidate Visa Date': v.candidateVisaDate, 'Candidate Visa Expiration': v.candidateVisaExpiration,
    'Registered Agency Name': v.registeredAgencyName, 'Enjaz/Consulate Delegate Name': v.enjazAgencyName,
    'Visa Delegation Number': v.visaDelegationNumber, 'Agency Delegation Number': v.agencyDelegationNumber,
    Client: v.client, 'Linked Case ID': v.linkedRecruitmentCaseId || '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(caseRows), 'Recruitment Cases');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(visaRows), 'Visa Records');
  XLSX.writeFile(wb, 'Safwat_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  logTo('dbLog', 'Exported ' + caseRows.length + ' case(s) and ' + visaRows.length + ' visa record(s) to Excel.', 'ok');
}


/* =========================================================
   MODAL SYSTEM
   ========================================================= */
function openModal(title, bodyHtml) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalOverlay').style.display = 'flex';
}
function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
  document.getElementById('modalBody').innerHTML = '';
}
document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', (e) => { if (e.target.id === 'modalOverlay') closeModal(); });

function optionsHtml(values, selected) {
  return values.map(v => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');
}
function datalistHtml(id, values) {
  return `<datalist id="${id}">${[...new Set(values.filter(Boolean))].sort().map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;
}

/* =========================================================
   RECRUITMENT CASE FORM
   ========================================================= */
function openCaseForm(caseId) {
  const existing = caseId ? DB.recruitmentCases.find(c => c.id === caseId) : null;
  const type = existing ? existing.recruitmentType : 'OVERSEAS_SOURCED';
  const clients = datalistHtml('caseClientList', DB.recruitmentCases.map(c => c.client));
  const nats = datalistHtml('caseNatList', DB.recruitmentCases.map(c => c.nationality));
  const positions = datalistHtml('casePosList', DB.recruitmentCases.map(c => c.position));
  const typeOptions = Object.keys(RECRUITMENT_TYPE_LABELS)
    .filter(k => k !== 'OVERSEAS_UNSPECIFIED' || type === 'OVERSEAS_UNSPECIFIED')
    .map(k => `<option value="${k}" ${k === type ? 'selected' : ''}>${esc(RECRUITMENT_TYPE_LABELS[k])}</option>`).join('');

  const html = `
    ${clients}${nats}${positions}
    <label>Name *</label>
    <input type="text" id="cf_name" value="${esc(existing ? existing.name : '')}">
    <div class="row">
      <div><label>Nationality</label><input type="text" id="cf_nationality" list="caseNatList" value="${esc(existing ? existing.nationality : '')}"></div>
      <div><label>Position</label><input type="text" id="cf_position" list="casePosList" value="${esc(existing ? existing.position : '')}"></div>
    </div>
    <div class="row">
      <div><label>Client</label><input type="text" id="cf_client" list="caseClientList" value="${esc(existing ? existing.client : '')}"></div>
      <div><label>Passport</label><input type="text" id="cf_passport" value="${esc(existing ? existing.passport : '')}"></div>
    </div>
    <div class="row">
      <div><label>Recruitment Type *</label><select id="cf_type">${typeOptions}</select></div>
      <div><label>Stage *</label><select id="cf_stage"></select></div>
    </div>
    <label>Request Date</label>
    <input type="date" id="cf_requestDate" value="${esc(existing && existing.requestDate ? existing.requestDate : '')}">
    <label>Notes</label>
    <textarea id="cf_notes">${esc(existing ? existing.notes : '')}</textarea>
    ${existing && existing.legacyStatus ? `<div class="hint" style="margin-top:10px;">Imported legacy status: <span class="mono">${esc(existing.legacyStatus)}</span></div>` : ''}
    <div class="btnrow">
      <button id="cf_saveBtn">${existing ? 'Save changes' : 'Add candidate'}</button>
      <button type="button" class="secondary" id="cf_cancelBtn">Cancel</button>
    </div>`;
  openModal(existing ? 'Edit Recruitment Case \u2014 ' + existing.id : 'Add Recruitment Case', html);
  document.getElementById('cf_cancelBtn').addEventListener('click', closeModal);

  const ADD_NEW_STAGE = '__add_new_stage__';
  function populateStages(selected) {
    const stages = getStageOptions(DB, existing ? existing.stage : null);
    document.getElementById('cf_stage').innerHTML = optionsHtml(stages, selected) + `<option value="${ADD_NEW_STAGE}">+ Add new stage\u2026</option>`;
  }
  populateStages(existing ? existing.stage : 'PENDING OFFER LETTER');
  document.getElementById('cf_stage').addEventListener('change', (e) => {
    if (e.target.value === ADD_NEW_STAGE) {
      const newStage = prompt('New stage name:');
      if (newStage && newStage.trim()) {
        const added = addCustomStage(DB, newStage);
        populateStages(added);
      } else {
        populateStages(existing ? existing.stage : 'PENDING OFFER LETTER');
      }
    }
  });

  document.getElementById('cf_saveBtn').addEventListener('click', async () => {
    const fields = {
      name: document.getElementById('cf_name').value,
      nationality: document.getElementById('cf_nationality').value,
      position: document.getElementById('cf_position').value,
      client: document.getElementById('cf_client').value,
      recruitmentType: document.getElementById('cf_type').value,
      stage: document.getElementById('cf_stage').value,
      passport: document.getElementById('cf_passport').value,
      requestDate: document.getElementById('cf_requestDate').value || null,
      notes: document.getElementById('cf_notes').value,
    };
    if (!fields.name.trim()) { alert('Name is required.'); return; }
    if (existing) updateRecruitmentCase(DB, existing.id, fields);
    else addRecruitmentCase(DB, fields, DB_ID_COUNTER);
    await dbSave();
    closeModal();
    refreshPipelineView();
    refreshVisaView(); // linked-name displays may reference this case
  });
}

function deleteCase(caseId) {
  const c = DB.recruitmentCases.find(x => x.id === caseId);
  if (!c) return;
  if (!confirm('Delete recruitment case for "' + c.name + '" (' + c.id + ')? This cannot be undone.')) return;
  deleteRecruitmentCase(DB, caseId);
  dbSave().then(() => { refreshPipelineView(); refreshVisaView(); });
}

/* =========================================================
   VISA RECORD FORM
   ========================================================= */
function openVisaForm(visaId, prefillCaseId) {
  const existing = visaId ? DB.visaRecords.find(v => v.id === visaId) : null;
  const prefillCase = prefillCaseId ? DB.recruitmentCases.find(c => c.id === prefillCaseId) : null;
  const companies = datalistHtml('visaCompanyList', DB.visaRecords.map(v => v.companyName));
  const cats = datalistHtml('visaCatList', DB.visaRecords.map(v => v.visaCategory));
  const clients = datalistHtml('visaClientList', DB.visaRecords.map(v => v.client));
  const nats = datalistHtml('visaNatList', DB.visaRecords.map(v => v.nationality));

  const linkedCaseId = existing ? existing.linkedRecruitmentCaseId : (prefillCase ? prefillCase.id : null);
  const caseOptions = ['<option value="">\u2014 none \u2014</option>'].concat(
    DB.recruitmentCases.map(c => `<option value="${c.id}" ${c.id === linkedCaseId ? 'selected' : ''}>${esc(c.name)} (${esc(c.passport || 'no passport')}) \u2014 ${c.id}</option>`)
  ).join('');

  const initial = existing || prefillCase ? {
    fullName: existing ? existing.fullName : prefillCase.name,
    passport: existing ? existing.passport : prefillCase.passport,
    nationality: existing ? existing.nationality : prefillCase.nationality,
    client: existing ? existing.client : prefillCase.client,
  } : { fullName: '', passport: '', nationality: '', client: '' };

  const html = `
    ${companies}${cats}${clients}${nats}
    <div class="row">
      <div><label>Full Name</label><input type="text" id="vf_fullName" value="${esc(initial.fullName)}"></div>
      <div><label>Passport</label><input type="text" id="vf_passport" value="${esc(initial.passport)}"></div>
    </div>
    <div class="row">
      <div><label>Nationality</label><input type="text" id="vf_nationality" list="visaNatList" value="${esc(initial.nationality)}"></div>
      <div><label>Client</label><input type="text" id="vf_client" list="visaClientList" value="${esc(initial.client)}"></div>
    </div>
    <label>Visa Document Number <span class="hint" style="display:inline;">(QIWA batch document)</span></label>
    <input type="text" id="vf_visaDocumentNumber" value="${esc(existing ? existing.visaDocumentNumber : '')}">
    <div class="row">
      <div><label>Company Name (sponsor) <span class="badge ok" id="vf_sponsorBadge" style="margin-left:4px;"></span></label>
        <input type="text" id="vf_companyName" list="visaCompanyList" value="${esc(existing ? existing.companyName : '')}"></div>
      <div><label>Visa Category</label><input type="text" id="vf_visaCategory" list="visaCatList" value="${esc(existing ? existing.visaCategory : '')}"></div>
    </div>
    <div class="row">
      <div><label>CR Number</label><input type="text" id="vf_crNumber" value="${esc(existing ? existing.crNumber : '')}"></div>
      <div><label>Sponsor ID</label><input type="text" id="vf_sponsorId" value="${esc(existing ? existing.sponsorId : '')}"></div>
    </div>
    <label>Status (Visa) *</label>
    <select id="vf_statusVisa">${optionsHtml(['USED', 'UNUSED', 'ALLOCATED', 'EXPIRED', 'CANCELLED'], existing ? existing.statusVisa : 'ALLOCATED')}</select>

    <div class="card" style="margin:14px 0;padding:14px 16px;">
      <h3 style="margin-bottom:8px;">QIWA-issued visa \u2014 document-level, ~2 Hijri years</h3>
      <p class="hint" style="margin-top:0;">This is the batch visa authorization. Its expiration drives the Upcoming Expirations alerts.</p>
      <div class="row">
        <div><label>QIWA Visa Date</label><input type="text" id="vf_qiwaVisaDate" value="${esc(existing && existing.qiwaVisaDate ? existing.qiwaVisaDate : '')}"></div>
        <div><label>QIWA Visa Expiration</label><input type="date" id="vf_expirationDate" value="${esc(existing && existing.expirationDate ? existing.expirationDate : '')}"></div>
      </div>
    </div>

    <div class="card" style="margin:14px 0;padding:14px 16px;">
      <h3 style="margin-bottom:8px;">Candidate-specific visa \u2014 individual, ~3 months from approval</h3>
      <p class="hint" style="margin-top:0;">The stamped visa issued once a specific candidate is matched to this slot.</p>
      <div class="row">
        <div><label>Visa Number</label><input type="text" id="vf_visaNumber" value="${esc(existing ? existing.visaNumber : '')}"></div>
        <div><label>Candidate Visa Date</label><input type="date" id="vf_candidateVisaDate" value="${esc(existing && existing.candidateVisaDate ? existing.candidateVisaDate : '')}"></div>
        <div><label>Candidate Visa Expiration</label><input type="date" id="vf_candidateVisaExpiration" value="${esc(existing && existing.candidateVisaExpiration ? existing.candidateVisaExpiration : '')}"></div>
      </div>
    </div>

    <div class="card" style="margin:14px 0;padding:14px 16px;">
      <h3 style="margin-bottom:8px;">Delegation &amp; agency</h3>
      <p class="hint" style="margin-top:0;">Visa Delegation Number marks the visa category as ready to use. Agency Delegation Number becomes usable once ratified by the jurisdiction Chamber of Commerce, on the date shown.</p>
      <div class="row">
        <div><label>Registered Agency Name</label><input type="text" id="vf_registeredAgencyName" value="${esc(existing ? existing.registeredAgencyName : '')}"></div>
        <div><label>Enjaz / Consulate Delegate Name <span class="hint" style="display:inline;">(manual \u2014 not in source data)</span></label><input type="text" id="vf_enjazAgencyName" value="${esc(existing ? existing.enjazAgencyName : '')}"></div>
      </div>
      <div class="row">
        <div><label>Visa Delegation Number</label><input type="text" id="vf_visaDelegationNumber" value="${esc(existing ? existing.visaDelegationNumber : '')}"></div>
        <div><label>Agency Delegation Number</label><input type="text" id="vf_agencyDelegationNumber" value="${esc(existing ? existing.agencyDelegationNumber : '')}"></div>
      </div>
      <div class="row">
        <div><label>Ratified By (Chamber of Commerce)</label><input type="text" id="vf_ratifiedBy" value="${esc(existing ? existing.ratifiedBy : '')}"></div>
        <div><label>Ratification Date</label><input type="date" id="vf_ratificationDate" value="${esc(existing && existing.ratificationDate ? existing.ratificationDate : '')}"></div>
      </div>
      <label>MOFA Application Number <span class="hint" style="display:inline;">(needed to retrieve the visa copy)</span></label>
      <input type="text" id="vf_mofaApplicationNumber" value="${esc(existing ? existing.mofaApplicationNumber : '')}">
    </div>

    <div class="card" style="margin:14px 0;padding:14px 16px;">
      <h3 style="margin-bottom:8px;">Visa copy</h3>
      <div class="hint" id="vf_visaCopyStatus">${existing && existing.visaCopyFileName ? 'Attached: ' + esc(existing.visaCopyOriginalName || existing.visaCopyFileName) : 'No file attached.'}</div>
      <div class="btnrow" style="margin-top:8px;">
        <input type="file" id="vf_visaCopyInput" accept=".pdf,.jpg,.jpeg,.png" style="max-width:220px;">
        <button type="button" class="small secondary" id="vf_visaCopyUploadBtn">Upload</button>
        <button type="button" class="small secondary" id="vf_visaCopyViewBtn" ${existing && existing.visaCopyFileName ? '' : 'style="display:none;"'}>View</button>
        <button type="button" class="small danger" id="vf_visaCopyRemoveBtn" ${existing && existing.visaCopyFileName ? '' : 'style="display:none;"'}>Remove</button>
      </div>
      <p class="hint">Stored as a separate file in a folder you choose once per session \u2014 not inside the database file itself.</p>
    </div>

    <label>Linked Recruitment Case</label>
    <select id="vf_linkedCase">${caseOptions}</select>
    <label>Notes</label>
    <textarea id="vf_notes">${esc(existing ? existing.notes : '')}</textarea>
    <div class="btnrow">
      <button id="vf_saveBtn">${existing ? 'Save changes' : 'Add visa record'}</button>
      <button type="button" class="secondary" id="vf_cancelBtn">Cancel</button>
    </div>`;
  openModal(existing ? 'Edit Visa Record \u2014 ' + existing.id : (prefillCase ? 'Start Visa Process \u2014 ' + prefillCase.name : 'Add Visa Record'), html);
  document.getElementById('vf_cancelBtn').addEventListener('click', closeModal);

  let pendingVisaCopy = existing && existing.visaCopyFileName
    ? { fileName: existing.visaCopyFileName, originalName: existing.visaCopyOriginalName, uploadedAt: existing.visaCopyUploadedAt }
    : null;

  document.getElementById('vf_visaCopyUploadBtn').addEventListener('click', async () => {
    const file = document.getElementById('vf_visaCopyInput').files[0];
    if (!file) { alert('Choose a file first.'); return; }
    const dirHandle = await ensureAttachmentsDir();
    if (!dirHandle) return;
    try {
      const safeName = Date.now() + '_' + file.name.replace(/[\\/:*?"<>|]/g, '-');
      const fh = await dirHandle.getFileHandle(safeName, { create: true });
      const w = await fh.createWritable();
      await w.write(await file.arrayBuffer());
      await w.close();
      // replace any previous attachment on disk
      if (pendingVisaCopy && pendingVisaCopy.fileName !== safeName) {
        await dirHandle.removeEntry(pendingVisaCopy.fileName).catch(() => {});
      }
      pendingVisaCopy = { fileName: safeName, originalName: file.name, uploadedAt: new Date().toISOString() };
      document.getElementById('vf_visaCopyStatus').textContent = 'Attached: ' + file.name;
      document.getElementById('vf_visaCopyViewBtn').style.display = '';
      document.getElementById('vf_visaCopyRemoveBtn').style.display = '';
    } catch (err) {
      alert('Could not save the file: ' + err.message);
    }
  });
  document.getElementById('vf_visaCopyViewBtn').addEventListener('click', async () => {
    if (!pendingVisaCopy) return;
    const dirHandle = await ensureAttachmentsDir();
    if (!dirHandle) return;
    try {
      const fh = await dirHandle.getFileHandle(pendingVisaCopy.fileName);
      const file = await fh.getFile();
      const url = URL.createObjectURL(file);
      window.open(url, '_blank');
    } catch (err) {
      alert('Could not open the file \u2014 make sure you\'ve selected the same attachments folder this session. (' + err.message + ')');
    }
  });
  document.getElementById('vf_visaCopyRemoveBtn').addEventListener('click', async () => {
    if (!pendingVisaCopy) return;
    if (!confirm('Remove the attached visa copy? The file will also be deleted from the attachments folder.')) return;
    const dirHandle = await ensureAttachmentsDir();
    if (dirHandle) await dirHandle.removeEntry(pendingVisaCopy.fileName).catch(() => {});
    pendingVisaCopy = null;
    document.getElementById('vf_visaCopyStatus').textContent = 'No file attached.';
    document.getElementById('vf_visaCopyViewBtn').style.display = 'none';
    document.getElementById('vf_visaCopyRemoveBtn').style.display = 'none';
  });

  function updateSponsorBadge() {
    const sponsor = deriveSponsor(document.getElementById('vf_companyName').value);
    const badge = document.getElementById('vf_sponsorBadge');
    badge.textContent = sponsor;
    badge.className = 'badge ' + (sponsor === 'SAFWAT' ? 'ok' : 'warn');
  }
  updateSponsorBadge();
  document.getElementById('vf_companyName').addEventListener('input', updateSponsorBadge);

  document.getElementById('vf_saveBtn').addEventListener('click', async () => {
    const fields = {
      fullName: document.getElementById('vf_fullName').value,
      passport: document.getElementById('vf_passport').value,
      nationality: document.getElementById('vf_nationality').value,
      client: document.getElementById('vf_client').value,
      visaDocumentNumber: document.getElementById('vf_visaDocumentNumber').value,
      visaNumber: document.getElementById('vf_visaNumber').value,
      companyName: document.getElementById('vf_companyName').value,
      visaCategory: document.getElementById('vf_visaCategory').value,
      crNumber: document.getElementById('vf_crNumber').value,
      sponsorId: document.getElementById('vf_sponsorId').value,
      statusVisa: document.getElementById('vf_statusVisa').value,
      qiwaVisaDate: document.getElementById('vf_qiwaVisaDate').value || null,
      expirationDate: document.getElementById('vf_expirationDate').value || null,
      candidateVisaDate: document.getElementById('vf_candidateVisaDate').value || null,
      candidateVisaExpiration: document.getElementById('vf_candidateVisaExpiration').value || null,
      registeredAgencyName: document.getElementById('vf_registeredAgencyName').value,
      enjazAgencyName: document.getElementById('vf_enjazAgencyName').value,
      visaDelegationNumber: document.getElementById('vf_visaDelegationNumber').value,
      agencyDelegationNumber: document.getElementById('vf_agencyDelegationNumber').value,
      ratifiedBy: document.getElementById('vf_ratifiedBy').value,
      ratificationDate: document.getElementById('vf_ratificationDate').value || null,
      mofaApplicationNumber: document.getElementById('vf_mofaApplicationNumber').value,
      visaCopyFileName: pendingVisaCopy ? pendingVisaCopy.fileName : null,
      visaCopyOriginalName: pendingVisaCopy ? pendingVisaCopy.originalName : null,
      visaCopyUploadedAt: pendingVisaCopy ? pendingVisaCopy.uploadedAt : null,
      notes: document.getElementById('vf_notes').value,
    };
    const chosenCaseId = document.getElementById('vf_linkedCase').value || null;
    let visaRecord;
    if (existing) { updateVisaRecord(DB, existing.id, fields); visaRecord = existing; }
    else visaRecord = addVisaRecord(DB, fields, DB_ID_COUNTER);

    if (chosenCaseId && chosenCaseId !== visaRecord.linkedRecruitmentCaseId) linkCaseToVisa(DB, chosenCaseId, visaRecord.id);
    else if (!chosenCaseId && visaRecord.linkedRecruitmentCaseId) unlinkCase(DB, visaRecord.linkedRecruitmentCaseId);

    await dbSave();
    closeModal();
    refreshVisaView();
    refreshPipelineView();
  });
}

function deleteVisa(visaId) {
  const v = DB.visaRecords.find(x => x.id === visaId);
  if (!v) return;
  if (!confirm('Delete visa record ' + v.id + ' (' + (v.fullName || 'unassigned') + ')? This cannot be undone.')) return;
  deleteVisaRecord(DB, visaId);
  dbSave().then(() => { refreshVisaView(); refreshPipelineView(); });
}

async function viewVisaCopy(visaId) {
  const v = DB.visaRecords.find(x => x.id === visaId);
  if (!v || !v.visaCopyFileName) return;
  const dirHandle = await ensureAttachmentsDir();
  if (!dirHandle) return;
  try {
    const fh = await dirHandle.getFileHandle(v.visaCopyFileName);
    const file = await fh.getFile();
    const url = URL.createObjectURL(file);
    window.open(url, '_blank');
  } catch (err) {
    alert('Could not open the file \u2014 make sure you\'ve selected the same attachments folder this session. (' + err.message + ')');
  }
}

/* =========================================================
   BULK EDIT (recruitment cases) - only checked fields are applied
   ========================================================= */
function openCaseBulkEditForm(ids) {
  const clients = datalistHtml('caseClientList', DB.recruitmentCases.map(c => c.client));
  const typeOptions = Object.keys(RECRUITMENT_TYPE_LABELS)
    .map(k => `<option value="${k}">${esc(RECRUITMENT_TYPE_LABELS[k])}</option>`).join('');
  const stageOptions = optionsHtml(getStageOptions(DB, null), null);
  const html = `
    ${clients}
    <p class="hint">Only fields you check below will be changed. Unchecked fields are left as-is on each of the ${ids.length} selected case(s).</p>
    <div class="checkline"><input type="checkbox" id="bce_useStage"><label style="margin:0;">Set Stage to:</label></div>
    <select id="bce_stage" disabled>${stageOptions}</select>
    <div class="checkline"><input type="checkbox" id="bce_useType"><label style="margin:0;">Set Recruitment Type to:</label></div>
    <select id="bce_type" disabled>${typeOptions}</select>
    <div class="checkline"><input type="checkbox" id="bce_useClient"><label style="margin:0;">Set Client to:</label></div>
    <input type="text" id="bce_client" list="caseClientList" disabled>
    <div class="btnrow">
      <button id="bce_saveBtn">Apply to ${ids.length} case(s)</button>
      <button type="button" class="secondary" id="bce_cancelBtn">Cancel</button>
    </div>`;
  openModal('Bulk Edit \u2014 ' + ids.length + ' Recruitment Case(s)', html);
  document.getElementById('bce_cancelBtn').addEventListener('click', closeModal);
  ['stage', 'type', 'client'].forEach(f => {
    document.getElementById('bce_use' + f.charAt(0).toUpperCase() + f.slice(1)).addEventListener('change', (e) => {
      document.getElementById('bce_' + f).disabled = !e.target.checked;
    });
  });
  document.getElementById('bce_saveBtn').addEventListener('click', async () => {
    const patch = {};
    if (document.getElementById('bce_useStage').checked) patch.stage = document.getElementById('bce_stage').value;
    if (document.getElementById('bce_useType').checked) patch.recruitmentType = document.getElementById('bce_type').value;
    if (document.getElementById('bce_useClient').checked) patch.client = document.getElementById('bce_client').value;
    if (Object.keys(patch).length === 0) { alert('Check at least one field to apply.'); return; }
    bulkUpdateRecruitmentCases(DB, ids, patch);
    selectedCaseIds.clear();
    await dbSave();
    closeModal();
    refreshPipelineView();
    refreshVisaView();
  });
}

/* =========================================================
   BULK EDIT (visa records) - only checked fields are applied
   ========================================================= */
function openVisaBulkEditForm(ids) {
  const clients = datalistHtml('visaClientList', DB.visaRecords.map(v => v.client));
  const cats = datalistHtml('visaCatList', DB.visaRecords.map(v => v.visaCategory));
  const html = `
    ${clients}${cats}
    <p class="hint">Only fields you check below will be changed. Unchecked fields are left as-is on each of the ${ids.length} selected record(s).</p>
    <div class="checkline"><input type="checkbox" id="bve_useStatus"><label style="margin:0;">Set Status (Visa) to:</label></div>
    <select id="bve_status" disabled>${optionsHtml(['USED', 'UNUSED', 'ALLOCATED', 'EXPIRED', 'CANCELLED'], null)}</select>
    <div class="checkline"><input type="checkbox" id="bve_useClient"><label style="margin:0;">Set Client to:</label></div>
    <input type="text" id="bve_client" list="visaClientList" disabled>
    <div class="checkline"><input type="checkbox" id="bve_useCategory"><label style="margin:0;">Set Visa Category to:</label></div>
    <input type="text" id="bve_category" list="visaCatList" disabled>
    <div class="btnrow">
      <button id="bve_saveBtn">Apply to ${ids.length} record(s)</button>
      <button type="button" class="secondary" id="bve_cancelBtn">Cancel</button>
    </div>`;
  openModal('Bulk Edit \u2014 ' + ids.length + ' Visa Record(s)', html);
  document.getElementById('bve_cancelBtn').addEventListener('click', closeModal);
  ['status', 'client', 'category'].forEach(f => {
    document.getElementById('bve_use' + f.charAt(0).toUpperCase() + f.slice(1)).addEventListener('change', (e) => {
      document.getElementById('bve_' + f).disabled = !e.target.checked;
    });
  });
  document.getElementById('bve_saveBtn').addEventListener('click', async () => {
    const patch = {};
    if (document.getElementById('bve_useStatus').checked) patch.statusVisa = document.getElementById('bve_status').value;
    if (document.getElementById('bve_useClient').checked) patch.client = document.getElementById('bve_client').value;
    if (document.getElementById('bve_useCategory').checked) patch.visaCategory = document.getElementById('bve_category').value;
    if (Object.keys(patch).length === 0) { alert('Check at least one field to apply.'); return; }
    bulkUpdateVisaRecords(DB, ids, patch);
    selectedVisaIds.clear();
    await dbSave();
    closeModal();
    refreshVisaView();
    refreshPipelineView();
  });
}

/* =========================================================
   BULK ADD - shared parsing helpers (Excel upload or paste-from-spreadsheet)
   ========================================================= */
function parseDelimitedText(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim() !== '');
  if (!lines.length) return [];
  const delim = lines[0].includes('\t') ? '\t' : ',';
  return lines.map(l => l.split(delim).map(c => c.trim()));
}
function parseFlexibleDate(raw) {
  if (!raw) return null;
  return __claireIsoDate(raw);   /* v6.1.0: tz-safe + day-first (was toISOString + month-first) */
}
function buildBulkColumnMap(headerRow, aliasMap) {
  const norm = headerRow.map(h => normHeaderGeneric(h));
  const map = {};
  for (const [field, aliases] of Object.entries(aliasMap)) {
    let found = -1;
    for (const alias of aliases) { const idx = norm.indexOf(alias); if (idx !== -1) { found = idx; break; } }
    map[field] = found;
  }
  return map;
}
function normHeaderGeneric(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}
function recruitmentTypeFromLabel(label) {
  if (!label) return 'OVERSEAS_SOURCED';
  const norm = String(label).trim().toLowerCase();
  for (const [key, val] of Object.entries(RECRUITMENT_TYPE_LABELS)) {
    if (val.toLowerCase() === norm || key.toLowerCase() === norm) return key;
  }
  if (norm.includes('local')) return 'LOCAL_TRANSFER';
  if (norm.includes('endors')) return 'OVERSEAS_ENDORSED';
  if (norm.includes('sourc')) return 'OVERSEAS_SOURCED';
  return 'OVERSEAS_SOURCED';
}

const BULK_CASE_ALIASES = {
  name: ['name', 'full name', 'candidate name'], nationality: ['nationality'], position: ['position'],
  client: ['client'], recruitmentType: ['recruitment type', 'type'], stage: ['stage'],
  passport: ['passport', 'passport number'], requestDate: ['request date'], notes: ['notes'],
};
const BULK_VISA_ALIASES = {
  fullName: ['full name', 'name'], passport: ['passport'], nationality: ['nationality'], client: ['client'],
  visaDocumentNumber: ['visa document number'], visaNumber: ['visa number'], companyName: ['company name'],
  visaCategory: ['visa category', 'category'], crNumber: ['cr number', 'commercial registration number'],
  sponsorId: ['sponsor id'], statusVisa: ['status (visa)', 'status'],
  qiwaVisaDate: ['qiwa visa date'], expirationDate: ['qiwa visa expiration', 'expiration date'],
  candidateVisaDate: ['candidate visa date'], candidateVisaExpiration: ['candidate visa expiration'],
  registeredAgencyName: ['registered agency name', 'agency name'],
  enjazAgencyName: ['enjaz name', 'enjaz/consulate delegate name'],
  visaDelegationNumber: ['visa delegation number'], agencyDelegationNumber: ['agency delegation number'],
  ratifiedBy: ['ratified by'], ratificationDate: ['ratification date'],
  mofaApplicationNumber: ['mofa application number'], notes: ['notes'],
};

function parseBulkCaseRows(rows) {
  if (!rows.length) return { records: [], unmatchedHeaders: [] };
  const map = buildBulkColumnMap(rows[0], BULK_CASE_ALIASES);
  const unmatchedHeaders = Object.entries(map).filter(([, idx]) => idx === -1).map(([f]) => f);
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c === null || c === undefined || String(c).trim() === '')) continue;
    const get = (f) => { const idx = map[f]; return (idx !== undefined && idx !== -1 && idx < row.length) ? row[idx] : null; };
    if (!get('name')) continue;
    records.push({
      name: String(get('name')).trim(),
      nationality: get('nationality') ? String(get('nationality')).trim() : '',
      position: get('position') ? String(get('position')).trim() : '',
      client: get('client') ? String(get('client')).trim() : '',
      recruitmentType: recruitmentTypeFromLabel(get('recruitmentType')),
      stage: get('stage') ? String(get('stage')).trim() : 'PENDING OFFER LETTER',
      passport: get('passport') ? String(get('passport')).trim() : '',
      requestDate: parseFlexibleDate(get('requestDate')),
      notes: get('notes') ? String(get('notes')).trim() : '',
    });
  }
  return { records, unmatchedHeaders };
}
function parseBulkVisaRows(rows) {
  if (!rows.length) return { records: [], unmatchedHeaders: [] };
  const map = buildBulkColumnMap(rows[0], BULK_VISA_ALIASES);
  const unmatchedHeaders = Object.entries(map).filter(([, idx]) => idx === -1).map(([f]) => f);
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c === null || c === undefined || String(c).trim() === '')) continue;
    const get = (f) => { const idx = map[f]; return (idx !== undefined && idx !== -1 && idx < row.length) ? row[idx] : null; };
    if (!get('fullName') && !get('visaDocumentNumber')) continue;
    records.push({
      fullName: get('fullName') ? String(get('fullName')).trim() : '',
      passport: get('passport') ? String(get('passport')).trim() : '',
      nationality: get('nationality') ? String(get('nationality')).trim() : '',
      client: get('client') ? String(get('client')).trim() : '',
      visaDocumentNumber: get('visaDocumentNumber') ? String(get('visaDocumentNumber')).trim() : '',
      visaNumber: get('visaNumber') ? String(get('visaNumber')).trim() : '',
      companyName: get('companyName') ? String(get('companyName')).trim() : '',
      visaCategory: get('visaCategory') ? String(get('visaCategory')).trim() : '',
      crNumber: get('crNumber') ? String(get('crNumber')).trim() : '',
      sponsorId: get('sponsorId') ? String(get('sponsorId')).trim() : '',
      statusVisa: get('statusVisa') ? String(get('statusVisa')).trim().toUpperCase() : 'ALLOCATED',
      qiwaVisaDate: parseFlexibleDate(get('qiwaVisaDate')),
      expirationDate: parseFlexibleDate(get('expirationDate')),
      candidateVisaDate: parseFlexibleDate(get('candidateVisaDate')),
      candidateVisaExpiration: parseFlexibleDate(get('candidateVisaExpiration')),
      registeredAgencyName: get('registeredAgencyName') ? String(get('registeredAgencyName')).trim() : '',
      enjazAgencyName: get('enjazAgencyName') ? String(get('enjazAgencyName')).trim() : '',
      visaDelegationNumber: get('visaDelegationNumber') ? String(get('visaDelegationNumber')).trim() : '',
      agencyDelegationNumber: get('agencyDelegationNumber') ? String(get('agencyDelegationNumber')).trim() : '',
      ratifiedBy: get('ratifiedBy') ? String(get('ratifiedBy')).trim() : '',
      ratificationDate: parseFlexibleDate(get('ratificationDate')),
      mofaApplicationNumber: get('mofaApplicationNumber') ? String(get('mofaApplicationNumber')).trim() : '',
      notes: get('notes') ? String(get('notes')).trim() : '',
    });
  }
  return { records, unmatchedHeaders };
}

function downloadCaseTemplate() {
  const headers = ['Name', 'Nationality', 'Position', 'Client', 'Recruitment Type', 'Stage', 'Passport', 'Request Date', 'Notes'];
  const sample = ['Juan Dela Cruz', 'FILIPINO', 'WELDER', 'OSC', 'Overseas \u2013 Sourced', 'PENDING OFFER LETTER', 'AB123456', '2026-07-01', ''];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
  XLSX.writeFile(wb, 'Candidate_Bulk_Add_Template.xlsx');
}
function downloadVisaTemplate() {
  const headers = ['Full Name', 'Passport', 'Nationality', 'Client', 'Visa Document Number', 'Visa Number', 'Company Name',
    'Visa Category', 'CR Number', 'Sponsor ID', 'Status (Visa)', 'QIWA Visa Date', 'QIWA Visa Expiration',
    'Candidate Visa Date', 'Candidate Visa Expiration', 'Registered Agency Name', 'Enjaz Name',
    'Visa Delegation Number', 'Agency Delegation Number', 'Ratified By', 'Ratification Date', 'MOFA Application Number', 'Notes'];
  const sample = ['Juan Dela Cruz', 'AB123456', 'FILIPINO', 'OSC', 'VD-1001', 'VN-1001', 'Safwat Al Khaleej Company',
    'WELDER', '2050174515', '4567890', 'ALLOCATED', '2026-01-01', '2027-12-05', '', '', '', '', '', '', '', '', '', ''];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  XLSX.utils.book_append_sheet(wb, ws, 'Visa Records');
  XLSX.writeFile(wb, 'Visa_Bulk_Add_Template.xlsx');
}

/* =========================================================
   BULK ADD - Recruitment Cases modal
   ========================================================= */
function openBulkAddCaseForm() {
  const html = `
    <p class="hint">Add many candidates at once \u2014 upload a filled-in template, or paste rows copied straight from a spreadsheet (including the header row).</p>
    <div class="btnrow"><button type="button" class="secondary" id="bac_downloadTemplateBtn">Download template (.xlsx)</button></div>
    <div class="checkline">
      <label style="margin-right:16px;"><input type="radio" name="bac_mode" value="upload" checked> Upload Excel file</label>
      <label><input type="radio" name="bac_mode" value="paste"> Paste from spreadsheet</label>
    </div>
    <div id="bac_uploadSection"><input type="file" id="bac_fileInput" accept=".xlsx,.xlsm,.xls,.csv"></div>
    <div id="bac_pasteSection" style="display:none;">
      <textarea id="bac_pasteArea" style="min-height:160px;" placeholder="Paste rows copied from Excel, including the header row (Name, Nationality, Position, Client, Recruitment Type, Stage, Passport, Request Date, Notes)"></textarea>
    </div>
    <div class="btnrow"><button type="button" class="secondary" id="bac_previewBtn">Preview</button></div>
    <div id="bac_previewWrap" style="display:none;">
      <div class="hint" id="bac_previewSummary"></div>
      <div class="rowlist" style="max-height:240px;">
        <table id="bac_previewTable"><thead><tr><th>Name</th><th>Nationality</th><th>Position</th><th>Client</th><th>Type</th><th>Stage</th></tr></thead><tbody></tbody></table>
      </div>
      <div class="btnrow"><button id="bac_confirmBtn">Add candidates</button></div>
    </div>
    <div class="btnrow"><button type="button" class="secondary" id="bac_cancelBtn">Cancel</button></div>`;
  openModal('Bulk Add Recruitment Cases', html);
  document.getElementById('bac_cancelBtn').addEventListener('click', closeModal);
  document.getElementById('bac_downloadTemplateBtn').addEventListener('click', downloadCaseTemplate);

  document.querySelectorAll('input[name="bac_mode"]').forEach(r => r.addEventListener('change', (e) => {
    document.getElementById('bac_uploadSection').style.display = e.target.value === 'upload' ? 'block' : 'none';
    document.getElementById('bac_pasteSection').style.display = e.target.value === 'paste' ? 'block' : 'none';
  }));

  let parsedRecords = [];
  document.getElementById('bac_previewBtn').addEventListener('click', async () => {
    const mode = document.querySelector('input[name="bac_mode"]:checked').value;
    let rows = [];
    try {
      if (mode === 'upload') {
        const file = document.getElementById('bac_fileInput').files[0];
        if (!file) { alert('Choose a file first.'); return; }
        const wb = await readWorkbookFile(file);
        rows = sheetToRows(wb.Sheets[wb.SheetNames[0]]);
      } else {
        const text = document.getElementById('bac_pasteArea').value;
        if (!text.trim()) { alert('Paste some rows first.'); return; }
        rows = parseDelimitedText(text);
      }
    } catch (err) { alert('Could not read the input: ' + err.message); return; }
    const { records, unmatchedHeaders } = parseBulkCaseRows(rows);
    parsedRecords = records;
    const summary = document.getElementById('bac_previewSummary');
    let msg = records.length + ' candidate(s) recognized.';
    if (unmatchedHeaders.length) msg += ' Not found in your header row (left blank for every row): ' + unmatchedHeaders.join(', ') + '.';
    summary.textContent = msg;
    document.querySelector('#bac_previewTable tbody').innerHTML = records.slice(0, 20).map(r => `
      <tr><td>${esc(r.name)}</td><td>${esc(r.nationality)}</td><td>${esc(r.position)}</td><td>${esc(r.client)}</td>
      <td>${esc(RECRUITMENT_TYPE_LABELS[r.recruitmentType])}</td><td>${esc(r.stage)}</td></tr>`).join('')
      || '<tr><td colspan="6" style="color:var(--text-soft);">No recognizable rows found.</td></tr>';
    document.getElementById('bac_previewWrap').style.display = records.length ? 'block' : 'none';
    document.getElementById('bac_confirmBtn').textContent = 'Add ' + records.length + ' candidate' + (records.length === 1 ? '' : 's');
  });

  document.getElementById('bac_confirmBtn').addEventListener('click', async () => {
    if (!parsedRecords.length) return;
    parsedRecords.forEach(rec => addRecruitmentCase(DB, rec, DB_ID_COUNTER));
    await dbSave();
    logTo('dbLog', 'Bulk-added ' + parsedRecords.length + ' recruitment case(s).', 'ok');
    closeModal();
    refreshPipelineView();
  });
}

/* =========================================================
   BULK ADD - Visa Records modal
   ========================================================= */
function openBulkAddVisaForm() {
  const html = `
    <p class="hint">Add many visa records at once \u2014 upload a filled-in template, or paste rows copied straight from a spreadsheet (including the header row).</p>
    <div class="btnrow"><button type="button" class="secondary" id="bav_downloadTemplateBtn">Download template (.xlsx)</button></div>
    <div class="checkline">
      <label style="margin-right:16px;"><input type="radio" name="bav_mode" value="upload" checked> Upload Excel file</label>
      <label><input type="radio" name="bav_mode" value="paste"> Paste from spreadsheet</label>
    </div>
    <div id="bav_uploadSection"><input type="file" id="bav_fileInput" accept=".xlsx,.xlsm,.xls,.csv"></div>
    <div id="bav_pasteSection" style="display:none;">
      <textarea id="bav_pasteArea" style="min-height:160px;" placeholder="Paste rows copied from Excel, including the header row (Full Name, Passport, Nationality, Client, Visa Document Number, Company Name, Visa Category, Status (Visa), ...)"></textarea>
    </div>
    <div class="btnrow"><button type="button" class="secondary" id="bav_previewBtn">Preview</button></div>
    <div id="bav_previewWrap" style="display:none;">
      <div class="hint" id="bav_previewSummary"></div>
      <div class="rowlist" style="max-height:240px;">
        <table id="bav_previewTable"><thead><tr><th>Full Name</th><th>Passport</th><th>Nationality</th><th>Client</th><th>Visa Doc #</th><th>Status</th></tr></thead><tbody></tbody></table>
      </div>
      <div class="btnrow"><button id="bav_confirmBtn">Add visa records</button></div>
    </div>
    <div class="btnrow"><button type="button" class="secondary" id="bav_cancelBtn">Cancel</button></div>`;
  openModal('Bulk Add Visa Records', html);
  document.getElementById('bav_cancelBtn').addEventListener('click', closeModal);
  document.getElementById('bav_downloadTemplateBtn').addEventListener('click', downloadVisaTemplate);

  document.querySelectorAll('input[name="bav_mode"]').forEach(r => r.addEventListener('change', (e) => {
    document.getElementById('bav_uploadSection').style.display = e.target.value === 'upload' ? 'block' : 'none';
    document.getElementById('bav_pasteSection').style.display = e.target.value === 'paste' ? 'block' : 'none';
  }));

  let parsedRecords = [];
  document.getElementById('bav_previewBtn').addEventListener('click', async () => {
    const mode = document.querySelector('input[name="bav_mode"]:checked').value;
    let rows = [];
    try {
      if (mode === 'upload') {
        const file = document.getElementById('bav_fileInput').files[0];
        if (!file) { alert('Choose a file first.'); return; }
        const wb = await readWorkbookFile(file);
        rows = sheetToRows(wb.Sheets[wb.SheetNames[0]]);
      } else {
        const text = document.getElementById('bav_pasteArea').value;
        if (!text.trim()) { alert('Paste some rows first.'); return; }
        rows = parseDelimitedText(text);
      }
    } catch (err) { alert('Could not read the input: ' + err.message); return; }
    const { records, unmatchedHeaders } = parseBulkVisaRows(rows);
    parsedRecords = records;
    const summary = document.getElementById('bav_previewSummary');
    let msg = records.length + ' visa record(s) recognized.';
    if (unmatchedHeaders.length) msg += ' Not found in your header row (left blank for every row): ' + unmatchedHeaders.join(', ') + '.';
    summary.textContent = msg;
    document.querySelector('#bav_previewTable tbody').innerHTML = records.slice(0, 20).map(r => `
      <tr><td>${esc(r.fullName)}</td><td class="mono">${esc(r.passport)}</td><td>${esc(r.nationality)}</td>
      <td>${esc(r.client)}</td><td class="mono">${esc(r.visaDocumentNumber)}</td><td>${esc(r.statusVisa)}</td></tr>`).join('')
      || '<tr><td colspan="6" style="color:var(--text-soft);">No recognizable rows found.</td></tr>';
    document.getElementById('bav_previewWrap').style.display = records.length ? 'block' : 'none';
    document.getElementById('bav_confirmBtn').textContent = 'Add ' + records.length + ' visa record' + (records.length === 1 ? '' : 's');
  });

  document.getElementById('bav_confirmBtn').addEventListener('click', async () => {
    if (!parsedRecords.length) return;
    parsedRecords.forEach(rec => addVisaRecord(DB, rec, DB_ID_COUNTER));
    await dbSave();
    logTo('dbLog', 'Bulk-added ' + parsedRecords.length + ' visa record(s).', 'ok');
    closeModal();
    refreshVisaView();
  });
}


/* =========================================================
   SHARED small helpers (esc/fmtNum/downloadCsv/attachTableSort/sortRows
   are assumed already defined earlier in this file - see shared block)
   ========================================================= */
function stageCategory(stage) {
  const s = (stage || '').trim().toUpperCase();
  if (s === 'DEPLOYED') return 'Deployed';
  if (s === 'ON HOLD' || s === 'UNDER GRAND HYATT REVIEW') return 'On Hold';
  if (['UNFIT', 'WITHDRAWN/BACKOUT', 'TERMINATED', 'CANCELLED / WITHDRAWN'].includes(s)) return 'Cancelled / Withdrawn';
  if (['AWOL', 'END OF SERVICE', 'EXITED AFTER DEPLOYMENT'].includes(s)) return 'Exited After Deployment';
  if (s === 'NEEDS REVIEW') return 'Needs Review';
  return 'Active / In Progress';
}
const ROW_CAP = 400;

/* Ordered pipeline milestones used to derive "booked / awaiting result" vs "completed" per client,
   matching the requested leaderboard shape. A case's position in this sequence (by its current Stage)
   determines whether it has passed a given milestone; stages outside this sequence (older imported
   vocabulary, custom stages) simply don't count toward these specific columns. */
const PIPELINE_STAGE_SEQUENCE = [
  'PENDING OFFER LETTER', 'OFFER SIGNING', 'MEDICAL ON PROGRESS',
  'For Skills Verification Appointment', 'SVP/QVP ON PROGRESS',
  'FOR BIOMETRICS APPOINTMENT', 'Biometrics in Progress and Consular Submission',
  'FOR VISA', 'VISA ON PROGRESS', 'Visa Issued', 'FOR DEPLOYMENT', 'DEPLOYED',
];
function seqIndex(stage) { return PIPELINE_STAGE_SEQUENCE.indexOf(stage); }
function hasPassed(stage, milestone) {
  const c = seqIndex(stage), m = seqIndex(milestone);
  return c !== -1 && m !== -1 && c > m;
}
function isAtAny(stage, milestones) { return milestones.includes(stage); }
function computeClientMilestones(cases) {
  const r = { medicalBooked: 0, medicalCompleted: 0, svpBooked: 0, svpCompleted: 0, bioBooked: 0, bioCompleted: 0,
    visaInProcess: 0, visaStamped: 0, mobilized: 0, withdrawn: 0, unfit: 0, unresponsive: 0, active: 0, total: cases.length };
  cases.forEach(c => {
    if (isAtAny(c.stage, ['MEDICAL ON PROGRESS'])) r.medicalBooked++;
    if (hasPassed(c.stage, 'MEDICAL ON PROGRESS')) r.medicalCompleted++;
    if (isAtAny(c.stage, ['For Skills Verification Appointment', 'SVP/QVP ON PROGRESS'])) r.svpBooked++;
    if (hasPassed(c.stage, 'SVP/QVP ON PROGRESS')) r.svpCompleted++;
    if (isAtAny(c.stage, ['FOR BIOMETRICS APPOINTMENT', 'Biometrics in Progress and Consular Submission'])) r.bioBooked++;
    if (hasPassed(c.stage, 'Biometrics in Progress and Consular Submission')) r.bioCompleted++;
    if (isAtAny(c.stage, ['FOR VISA', 'VISA ON PROGRESS'])) r.visaInProcess++;
    if (c.stage === 'Visa Issued' || hasPassed(c.stage, 'Visa Issued')) r.visaStamped++;
    if (c.stage === 'DEPLOYED') r.mobilized++;
    if (c.stage === 'WITHDRAWN/BACKOUT' || c.stage === 'TERMINATED') r.withdrawn++;
    if (c.stage === 'UNFIT') r.unfit++;
    if (c.stage === 'AWOL') r.unresponsive++;
    if (stageCategory(c.stage) === 'Active / In Progress') r.active++;
  });
  r.visaStampedPct = r.total > 0 ? Math.round((r.visaStamped / r.total) * 1000) / 10 : 0;
  return r;
}

/* =========================================================
   R-02 RECRUITMENT PIPELINE VIEW
   ========================================================= */
let pipelineCharts = {};
function destroyPChart(key) { if (pipelineCharts[key]) { pipelineCharts[key].destroy(); delete pipelineCharts[key]; } }
let pipelineClientSort = { key: 'total', dir: -1 };

function getPipelineFilteredBase(excludeKeys) {
  if (!DB) return [];
  const skip = (k) => excludeKeys.includes(k);
  const client = document.getElementById('pipelineFilterClient').value;
  const nat = document.getElementById('pipelineFilterNat').value;
  const pos = document.getElementById('pipelineFilterPos').value;
  const type = document.getElementById('pipelineFilterType').value;
  const stage = document.getElementById('pipelineFilterStage').value;
  const q = document.getElementById('pipelineSearch').value.trim().toLowerCase();
  return DB.recruitmentCases.filter(c => {
    if (!skip('client') && client && c.client !== client) return false;
    if (!skip('nat') && nat && c.nationality !== nat) return false;
    if (!skip('pos') && pos && c.position !== pos) return false;
    if (!skip('type') && type && c.recruitmentType !== type) return false;
    if (!skip('stage') && stage && c.stage !== stage) return false;
    if (q && !c.name.toLowerCase().includes(q)) return false;
    return true;
  });
}
function getPipelineFiltered() { return getPipelineFilteredBase([]); }

function populateSelectPreserving(selectEl, options, allLabel) {
  const current = selectEl.value;
  const stillValid = options.includes(current);
  selectEl.innerHTML = `<option value="">${allLabel || 'All'}</option>` + options.map(v => `<option ${v === current && stillValid ? 'selected' : ''}>${esc(v)}</option>`).join('');
}
function populateSelectPreservingKeyed(selectEl, entries, allLabel) {
  // entries: [{value, label}] - for filters whose option value differs from its display label
  const current = selectEl.value;
  const stillValid = entries.some(e => e.value === current);
  selectEl.innerHTML = `<option value="">${allLabel || 'All'}</option>` + entries.map(e => `<option value="${esc(e.value)}" ${e.value === current && stillValid ? 'selected' : ''}>${esc(e.label)}</option>`).join('');
}
const uniqSorted = (arr) => [...new Set(arr.filter(Boolean))].sort();

function refreshPipelineFilterOptions() {
  const clientSel = document.getElementById('pipelineFilterClient');
  const natSel = document.getElementById('pipelineFilterNat');
  const posSel = document.getElementById('pipelineFilterPos');
  const typeSel = document.getElementById('pipelineFilterType');
  const stageSel = document.getElementById('pipelineFilterStage');

  populateSelectPreserving(clientSel, uniqSorted(getPipelineFilteredBase(['client']).map(c => c.client)));
  populateSelectPreserving(natSel, uniqSorted(getPipelineFilteredBase(['nat']).map(c => c.nationality)));
  populateSelectPreserving(posSel, uniqSorted(getPipelineFilteredBase(['pos']).map(c => c.position)));
  const typeEntries = Object.keys(RECRUITMENT_TYPE_LABELS)
    .filter(k => getPipelineFilteredBase(['type']).some(c => c.recruitmentType === k))
    .map(k => ({ value: k, label: RECRUITMENT_TYPE_LABELS[k] }));
  populateSelectPreservingKeyed(typeSel, typeEntries);
  populateSelectPreserving(stageSel, uniqSorted(getPipelineFilteredBase(['stage']).map(c => c.stage)));
}

function refreshPipelineView() {
  if (!dbIsOpen()) return;
  renderPipelineAll();
  renderClientsTable();
}
function renderPipelineAll() {
  refreshPipelineFilterOptions();
  const filtered = getPipelineFiltered();
  renderPipelineHeadline(filtered);
  renderPipelineKpis(filtered);
  renderPipelineTypeChart(filtered);
  renderPipelineCategoryChart(filtered);
  renderPipelineNatChart(filtered);
  renderPipelinePosChart(filtered);
  renderPipelineClientTable(filtered);
  renderPipelineMainTable(filtered);
}
function renderPipelineHeadline(rows) {
  const deployed = rows.filter(r => r.stage === 'Deployed').length;
  const active = rows.filter(r => stageCategory(r.stage) === 'Active / In Progress').length;
  const clients = new Set(rows.map(r => r.client)).size;
  document.getElementById('pipelineHeadline').textContent =
    `${fmtNum(rows.length)} candidate(s) tracked \u2014 ${fmtNum(deployed)} deployed, ${fmtNum(active)} actively moving through the pipeline, across ${fmtNum(clients)} client account(s).`;
}
function renderPipelineKpis(rows) {
  const cats = { 'Active / In Progress': 0, Deployed: 0, 'On Hold': 0, 'Cancelled / Withdrawn': 0, 'Exited After Deployment': 0, 'Needs Review': 0 };
  rows.forEach(r => { cats[stageCategory(r.stage)]++; });
  const cards = [
    { label: 'Total candidates', num: rows.length, cls: '' },
    { label: 'Active / In Progress', num: cats['Active / In Progress'], cls: 'c-focus' },
    { label: 'Deployed', num: cats.Deployed, cls: 'c-success' },
    { label: 'On Hold', num: cats['On Hold'], cls: '' },
    { label: 'Cancelled / Withdrawn', num: cats['Cancelled / Withdrawn'], cls: 'c-danger' },
    { label: 'Exited (post-deployment)', num: cats['Exited After Deployment'], cls: 'c-danger' },
    { label: 'Needs Review', num: cats['Needs Review'], cls: 'c-danger' },
  ];
  document.getElementById('pipelineKpiGrid').innerHTML = cards.map(c => `
    <div class="kpi-card ${c.cls}"><div class="kpi-num">${fmtNum(c.num)}</div><div class="kpi-label">${esc(c.label)}</div></div>`).join('');
}
function topN(rows, keyFn, n) {
  const counts = {};
  rows.forEach(r => { const k = keyFn(r) || 'UNSPECIFIED'; counts[k] = (counts[k] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, n);
  const other = sorted.slice(n).reduce((s, e) => s + e[1], 0);
  return { labels: top.map(e => e[0]).concat(other > 0 ? ['OTHER'] : []), data: top.map(e => e[1]).concat(other > 0 ? [other] : []) };
}
function renderPipelineTypeChart(rows) {
  const { labels, data } = topN(rows, r => RECRUITMENT_TYPE_LABELS[r.recruitmentType], 10);
  destroyPChart('type');
  pipelineCharts.type = new Chart(document.getElementById('pipelineTypeChart'), {
    type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: [RPT_COLORS.focus, RPT_COLORS.success, RPT_COLORS.brass, RPT_COLORS.slate] }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10.5 } } } } }
  });
}
function renderPipelineCategoryChart(rows) {
  const counts = {};
  rows.forEach(r => { const c = stageCategory(r.stage); counts[c] = (counts[c] || 0) + 1; });
  const colorMap = { 'Active / In Progress': RPT_COLORS.focus, Deployed: RPT_COLORS.success, 'On Hold': RPT_COLORS.brass, 'Cancelled / Withdrawn': RPT_COLORS.danger, 'Exited After Deployment': RPT_COLORS.exitedPostDeployment, 'Needs Review': RPT_COLORS.slate };
  destroyPChart('cat');
  pipelineCharts.cat = new Chart(document.getElementById('pipelineCategoryChart'), {
    type: 'doughnut', data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: Object.keys(counts).map(k => colorMap[k]) }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10.5 } } } } }
  });
}
function renderPipelineNatChart(rows) {
  const { labels, data } = topN(rows, r => r.nationality, 10);
  destroyPChart('nat');
  pipelineCharts.nat = new Chart(document.getElementById('pipelineNatChart'), {
    type: 'bar', data: { labels, datasets: [{ data, backgroundColor: RPT_COLORS.focus }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
  });
}
function renderPipelinePosChart(rows) {
  const { labels, data } = topN(rows, r => r.position, 10);
  destroyPChart('pos');
  pipelineCharts.pos = new Chart(document.getElementById('pipelinePosChart'), {
    type: 'bar', data: { labels, datasets: [{ data, backgroundColor: RPT_COLORS.brassDark }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
  });
}
function renderPipelineClientTable(rows) {
  const byClient = {};
  rows.forEach(r => { (byClient[r.client] = byClient[r.client] || []).push(r); });
  let data = Object.entries(byClient).map(([client, cases]) => ({ client, ...computeClientMilestones(cases) }));
  data = sortRows(data, pipelineClientSort);
  document.querySelector('#pipelineClientTable tbody').innerHTML = data.map(g => `
    <tr><td>${esc(g.client)}</td>
    <td>${fmtNum(g.medicalBooked)}</td><td>${fmtNum(g.medicalCompleted)}</td>
    <td>${fmtNum(g.svpBooked)}</td><td>${fmtNum(g.svpCompleted)}</td>
    <td>${fmtNum(g.bioBooked)}</td><td>${fmtNum(g.bioCompleted)}</td>
    <td>${fmtNum(g.visaInProcess)}</td><td>${fmtNum(g.visaStamped)}</td>
    <td>${fmtNum(g.mobilized)}</td>
    <td>${fmtNum(g.withdrawn)}</td><td>${fmtNum(g.unfit)}</td><td>${fmtNum(g.unresponsive)}</td>
    <td>${fmtNum(g.active)}</td><td>${fmtNum(g.total)}</td><td>${g.visaStampedPct}%</td></tr>`).join('')
    || '<tr><td colspan="16" style="color:var(--text-soft);">No rows match the current filters.</td></tr>';
}
let selectedCaseIds = new Set();
function renderPipelineMainTable(rows) {
  const shown = rows.slice(0, ROW_CAP);
  document.getElementById('pipelineRowCapNote').textContent = rows.length > ROW_CAP ? `Showing first ${ROW_CAP} of ${rows.length} matching candidates \u2014 use filters or search to narrow.` : `${rows.length} candidate(s)`;
  const shownIds = new Set(shown.map(c => c.id));
  [...selectedCaseIds].forEach(id => { if (!shownIds.has(id)) selectedCaseIds.delete(id); });
  document.querySelector('#pipelineMainTable tbody').innerHTML = shown.map(c => {
    const visa = c.linkedVisaId ? DB.visaRecords.find(v => v.id === c.linkedVisaId) : null;
    const canStartVisa = !c.linkedVisaId && stageCategory(c.stage) !== 'Cancelled / Withdrawn';
    return `<tr>
      <td><input type="checkbox" class="case-row-check" data-id="${c.id}" ${selectedCaseIds.has(c.id) ? 'checked' : ''}></td>
      <td>${esc(c.name)}${c.needsReview ? ' <span class="badge no">review</span>' : ''}</td>
      <td>${esc(c.nationality)}</td><td>${esc(c.position)}</td><td>${esc(c.client)}</td>
      <td>${esc(RECRUITMENT_TYPE_LABELS[c.recruitmentType] || c.recruitmentType)}</td>
      <td>${esc(c.stage)}</td><td class="mono">${esc(c.passport || '\u2014')}</td>
      <td>${visa && visa.registeredAgencyName ? esc(visa.registeredAgencyName) : '\u2014'}</td>
      <td>${visa ? esc(visa.id) : '\u2014'}</td>
      <td style="white-space:nowrap;">
        <button class="small secondary" data-action="edit-case" data-id="${c.id}">Edit</button>
        ${canStartVisa ? `<button class="small secondary" data-action="start-visa" data-id="${c.id}">Start Visa</button>` : ''}
        <button class="small danger" data-action="delete-case" data-id="${c.id}">Delete</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="11" style="color:var(--text-soft);">No candidates yet \u2014 use "+ Add Candidate" or import from Excel.</td></tr>';
  document.getElementById('pipelineSelectAll').checked = shown.length > 0 && shown.every(c => selectedCaseIds.has(c.id));
  renderPipelineBulkBar();
}
function renderPipelineBulkBar() {
  const bar = document.getElementById('pipelineBulkBar');
  const n = selectedCaseIds.size;
  bar.style.display = n > 0 ? 'flex' : 'none';
  document.getElementById('pipelineBulkCount').textContent = n + ' selected';
}

document.querySelector('#pipelineMainTable tbody').addEventListener('change', (e) => {
  if (!e.target.classList.contains('case-row-check')) return;
  const id = e.target.dataset.id;
  if (e.target.checked) selectedCaseIds.add(id); else selectedCaseIds.delete(id);
  renderPipelineBulkBar();
  document.getElementById('pipelineSelectAll').checked = [...document.querySelectorAll('.case-row-check')].every(c => c.checked);
});
document.getElementById('pipelineSelectAll').addEventListener('change', (e) => {
  document.querySelectorAll('.case-row-check').forEach(c => {
    c.checked = e.target.checked;
    if (e.target.checked) selectedCaseIds.add(c.dataset.id); else selectedCaseIds.delete(c.dataset.id);
  });
  renderPipelineBulkBar();
});
document.getElementById('pipelineBulkClearBtn').addEventListener('click', () => { selectedCaseIds.clear(); renderPipelineMainTable(getPipelineFiltered()); });
document.getElementById('pipelineBulkDeleteBtn').addEventListener('click', () => {
  const ids = [...selectedCaseIds];
  if (!ids.length) return;
  if (!confirm('Permanently delete ' + ids.length + ' selected recruitment case(s)? This cannot be undone.')) return;
  bulkDeleteRecruitmentCases(DB, ids);
  selectedCaseIds.clear();
  dbSave().then(() => { refreshPipelineView(); refreshVisaView(); });
});
document.getElementById('pipelineBulkEditBtn').addEventListener('click', () => {
  if (!selectedCaseIds.size) return;
  openCaseBulkEditForm([...selectedCaseIds]);
});

document.querySelector('#pipelineMainTable tbody').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === 'edit-case') openCaseForm(id);
  else if (btn.dataset.action === 'start-visa') openVisaForm(null, id);
  else if (btn.dataset.action === 'delete-case') deleteCase(id);
});

document.getElementById('pipelineAddBtn').addEventListener('click', () => openCaseForm(null));
document.getElementById('pipelineBulkAddBtn').addEventListener('click', () => openBulkAddCaseForm());
['pipelineFilterClient', 'pipelineFilterNat', 'pipelineFilterPos', 'pipelineFilterType', 'pipelineFilterStage'].forEach(id => {
  document.getElementById(id).addEventListener('change', renderPipelineAll);
});
document.getElementById('pipelineSearch').addEventListener('input', renderPipelineAll);
attachTableSort(document.getElementById('pipelineClientTable'), (s) => { pipelineClientSort = s; renderPipelineClientTable(getPipelineFiltered()); });
document.getElementById('pipelineExportBtn').addEventListener('click', () => {
  const rows = getPipelineFiltered();
  const headers = ['ID', 'Name', 'Nationality', 'Position', 'Client', 'Recruitment Type', 'Stage', 'Passport', 'Linked Visa ID'];
  const out = rows.map(r => [r.id, r.name, r.nationality, r.position, r.client, RECRUITMENT_TYPE_LABELS[r.recruitmentType], r.stage, r.passport, r.linkedVisaId || '']);
  downloadCsv('Recruitment_Pipeline_filtered.csv', headers, out);
});
document.getElementById('pipelinePrintBtn').addEventListener('click', () => window.print());

/* =========================================================
   R-01 VISA REPORT VIEW
   ========================================================= */
let visaCharts = {};
function destroyVChart(key) { if (visaCharts[key]) { visaCharts[key].destroy(); delete visaCharts[key]; } }
let visaCrSort = { key: null, dir: 1 };
let visaExpSort = { key: 'days', dir: 1 };

function getVisaFilteredBase(excludeKeys) {
  if (!DB) return [];
  const skip = (k) => excludeKeys.includes(k);
  const nat = document.getElementById('visaFilterNat').value;
  const cat = document.getElementById('visaFilterCat').value;
  const client = document.getElementById('visaFilterClient').value;
  const status = document.getElementById('visaFilterStatus').value;
  const sponsor = document.getElementById('visaFilterSponsor').value;
  const q = document.getElementById('visaSearch').value.trim().toLowerCase();
  return DB.visaRecords.filter(r => {
    if (!skip('nat') && nat && r.nationality !== nat) return false;
    if (!skip('cat') && cat && r.visaCategory !== cat) return false;
    if (!skip('client') && client && r.client !== client) return false;
    if (!skip('status') && status && r.statusVisa !== status) return false;
    if (!skip('sponsor') && sponsor && r.sponsor !== sponsor) return false;
    if (q) {
      const hay = [r.fullName, r.passport, r.visaDocumentNumber].map(v => v ? String(v).toLowerCase() : '').join(' ');
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
function getVisaFiltered() { return getVisaFilteredBase([]); }

function refreshVisaFilterOptions() {
  const natSel = document.getElementById('visaFilterNat');
  const catSel = document.getElementById('visaFilterCat');
  const clientSel = document.getElementById('visaFilterClient');
  const statusSel = document.getElementById('visaFilterStatus');
  const sponsorSel = document.getElementById('visaFilterSponsor');

  populateSelectPreserving(natSel, uniqSorted(getVisaFilteredBase(['nat']).map(r => r.nationality)));
  populateSelectPreserving(catSel, uniqSorted(getVisaFilteredBase(['cat']).map(r => r.visaCategory)));
  populateSelectPreserving(clientSel, uniqSorted(getVisaFilteredBase(['client']).map(r => r.client)));
  populateSelectPreserving(statusSel, ['USED', 'UNUSED', 'ALLOCATED', 'EXPIRED', 'CANCELLED'].filter(s => getVisaFilteredBase(['status']).some(r => r.statusVisa === s)));
  const sponsorEntries = [{ value: 'SAFWAT', label: 'Safwat' }, { value: 'CLIENT', label: 'Client' }]
    .filter(e => getVisaFilteredBase(['sponsor']).some(r => r.sponsor === e.value));
  populateSelectPreservingKeyed(sponsorSel, sponsorEntries);
}

function refreshVisaView() {
  if (!dbIsOpen()) return;
  renderVisaAll();
  renderClientsTable();
}
function renderVisaAll() {
  refreshVisaFilterOptions();
  const filtered = getVisaFiltered();
  renderVisaHeadline(filtered);
  renderVisaKpis(filtered);
  renderVisaStatusChart(filtered);
  renderVisaSponsorChart(filtered);
  renderVisaNatChart(filtered);
  renderVisaCrTable(filtered);
  renderVisaExpiryTable(filtered);
  renderVisaMainTable(filtered);
}
function renderVisaHeadline(rows) {
  const used = rows.filter(r => r.statusVisa === 'USED').length;
  const unused = rows.filter(r => r.statusVisa === 'UNUSED').length;
  const safwat = rows.filter(r => r.sponsor === 'SAFWAT').length;
  const clientOwned = rows.filter(r => r.sponsor === 'CLIENT').length;
  document.getElementById('visaHeadline').textContent =
    `${fmtNum(used)} visas in use, ${fmtNum(unused)} available \u2014 ${fmtNum(safwat)} sponsored by Safwat, ${fmtNum(clientOwned)} sponsored directly by clients.`;
}
function renderVisaKpis(rows) {
  const counts = { USED: 0, UNUSED: 0, ALLOCATED: 0, EXPIRED: 0, CANCELLED: 0 };
  rows.forEach(r => { if (counts[r.statusVisa] !== undefined) counts[r.statusVisa]++; });
  const expiring30 = rows.filter(r => r.expirationDate && ['UNUSED', 'ALLOCATED'].includes(r.statusVisa) && daysBetween(new Date(), new Date(r.expirationDate)) <= 30 && daysBetween(new Date(), new Date(r.expirationDate)) >= 0).length;
  const cards = [
    { label: 'Used', num: counts.USED, cls: 'c-success' }, { label: 'Unused (available)', num: counts.UNUSED, cls: '' },
    { label: 'Allocated', num: counts.ALLOCATED, cls: 'c-focus' }, { label: 'Expired', num: counts.EXPIRED, cls: 'c-danger' },
    { label: 'Cancelled', num: counts.CANCELLED, cls: '' }, { label: 'Expiring \u2264 30 days', num: expiring30, cls: 'c-danger', sub: 'unused / allocated only' },
  ];
  document.getElementById('visaKpiGrid').innerHTML = cards.map(c => `
    <div class="kpi-card ${c.cls}"><div class="kpi-num">${fmtNum(c.num)}</div><div class="kpi-label">${esc(c.label)}</div>${c.sub ? `<div class="kpi-sub">${esc(c.sub)}</div>` : ''}</div>`).join('');
}
function renderVisaStatusChart(rows) {
  const counts = { USED: 0, UNUSED: 0, ALLOCATED: 0, EXPIRED: 0, CANCELLED: 0 };
  rows.forEach(r => { if (counts[r.statusVisa] !== undefined) counts[r.statusVisa]++; });
  destroyVChart('status');
  visaCharts.status = new Chart(document.getElementById('visaStatusChart'), {
    type: 'doughnut', data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: [RPT_COLORS.used, RPT_COLORS.unused, RPT_COLORS.allocated, RPT_COLORS.expired, RPT_COLORS.cancelled] }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }
  });
}
function renderVisaSponsorChart(rows) {
  const counts = { SAFWAT: 0, CLIENT: 0 };
  rows.forEach(r => { counts[r.sponsor] = (counts[r.sponsor] || 0) + 1; });
  destroyVChart('sponsor');
  visaCharts.sponsor = new Chart(document.getElementById('visaSponsorChart'), {
    type: 'doughnut', data: { labels: ['Sponsored by Safwat', 'Sponsored by Client'], datasets: [{ data: [counts.SAFWAT, counts.CLIENT], backgroundColor: [RPT_COLORS.focus, RPT_COLORS.brass] }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }
  });
}
function renderVisaNatChart(rows) {
  const counts = {};
  rows.forEach(r => { counts[r.nationality || 'UNSPECIFIED'] = (counts[r.nationality || 'UNSPECIFIED'] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 10);
  const other = sorted.slice(10).reduce((s, e) => s + e[1], 0);
  destroyVChart('nat');
  visaCharts.nat = new Chart(document.getElementById('visaNatChart'), {
    type: 'bar', data: { labels: top.map(e => e[0]).concat(other > 0 ? ['OTHER'] : []), datasets: [{ data: top.map(e => e[1]).concat(other > 0 ? [other] : []), backgroundColor: RPT_COLORS.focus }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
  });
}
function renderVisaCrTable(rows) {
  const groups = {};
  rows.forEach(r => {
    const key = (r.crNumber || '\u2014') + '|' + (r.sponsorId || '\u2014');
    if (!groups[key]) groups[key] = { cr: r.crNumber || '\u2014', sponsor: r.sponsorId || '\u2014', used: 0, unused: 0, allocated: 0, expired: 0, cancelled: 0 };
    const g = groups[key];
    if (r.statusVisa === 'USED') g.used++; else if (r.statusVisa === 'UNUSED') g.unused++;
    else if (r.statusVisa === 'ALLOCATED') g.allocated++; else if (r.statusVisa === 'EXPIRED') g.expired++;
    else if (r.statusVisa === 'CANCELLED') g.cancelled++;
  });
  let data = Object.values(groups).map(g => {
    const total = g.used + g.unused + g.allocated + g.expired + g.cancelled;
    const activePool = g.used + g.unused + g.allocated + g.expired;
    return { ...g, total, util: activePool > 0 ? Math.round((g.used / activePool) * 100) : null };
  });
  data = sortRows(data, visaCrSort);
  document.querySelector('#visaCrTable tbody').innerHTML = data.map(g => `
    <tr><td class="mono">${esc(g.cr)}</td><td class="mono">${esc(g.sponsor)}</td><td>${fmtNum(g.used)}</td>
    <td>${fmtNum(g.unused)}</td><td>${fmtNum(g.allocated)}</td><td>${fmtNum(g.expired)}</td>
    <td>${fmtNum(g.cancelled)}</td><td>${fmtNum(g.total)}</td><td>${g.util === null ? '\u2014' : g.util + '%'}</td></tr>`).join('')
    || '<tr><td colspan="9" style="color:var(--text-soft);">No rows match the current filters.</td></tr>';
}
function renderVisaExpiryTable(rows) {
  const windowDays = Number(document.getElementById('visaExpiryWindow').value);
  const today = new Date();
  let data = rows.filter(r => r.expirationDate && ['UNUSED', 'ALLOCATED'].includes(r.statusVisa))
    .map(r => ({ visaDocumentNumber: r.visaDocumentNumber || '\u2014', sponsorId: r.sponsorId || '\u2014', category: r.visaCategory, nationality: r.nationality, client: r.client, expiry: r.expirationDate, days: daysBetween(today, new Date(r.expirationDate)) }))
    .filter(r => r.days <= windowDays);
  data = sortRows(data, visaExpSort);
  document.querySelector('#visaExpiryTable tbody').innerHTML = data.map(r => {
    const cls = r.days < 0 || r.days <= 30 ? 'u-crit' : (r.days <= 90 ? 'u-warn' : 'u-ok');
    const label = r.days < 0 ? 'OVERDUE' : r.days + 'd';
    return `<tr><td class="mono">${esc(r.visaDocumentNumber)}</td><td class="mono">${esc(r.sponsorId)}</td><td>${esc(r.category)}</td>
      <td>${esc(r.nationality)}</td><td>${esc(r.client)}</td><td class="mono">${esc(r.expiry)}</td>
      <td><span class="urgency ${cls}">${label}</span></td></tr>`;
  }).join('') || '<tr><td colspan="7" style="color:var(--text-soft);">No visas expiring in this window (unused / allocated only).</td></tr>';
}
let selectedVisaIds = new Set();
function renderVisaMainTable(rows) {
  const shown = rows.slice(0, ROW_CAP);
  document.getElementById('visaRowCapNote').textContent = rows.length > ROW_CAP ? `Showing first ${ROW_CAP} of ${rows.length} matching visa records \u2014 use filters or search to narrow.` : `${rows.length} visa record(s)`;
  const shownIds = new Set(shown.map(v => v.id));
  [...selectedVisaIds].forEach(id => { if (!shownIds.has(id)) selectedVisaIds.delete(id); });
  document.querySelector('#visaMainTable tbody').innerHTML = shown.map(v => {
    const linkedCase = v.linkedRecruitmentCaseId ? DB.recruitmentCases.find(c => c.id === v.linkedRecruitmentCaseId) : null;
    return `<tr>
      <td><input type="checkbox" class="visa-row-check" data-id="${v.id}" ${selectedVisaIds.has(v.id) ? 'checked' : ''}></td>
      <td>${esc(v.fullName || '\u2014')}</td><td class="mono">${esc(v.passport || '\u2014')}</td>
      <td>${esc(v.nationality)}</td><td>${esc(v.visaCategory)}</td>
      <td><span class="badge ${v.sponsor === 'SAFWAT' ? 'ok' : 'warn'}">${esc(v.sponsor)}</span></td>
      <td>${esc(v.client)}</td>
      <td title="${esc(v.enjazAgencyName ? 'Enjaz/consulate delegate: ' + v.enjazAgencyName : '')}">${esc(v.registeredAgencyName || '\u2014')}</td>
      <td>${esc(v.statusVisa)}</td><td class="mono">${esc(v.expirationDate || '\u2014')}</td>
      <td>${linkedCase ? esc(linkedCase.name) : '\u2014'}</td>
      <td style="white-space:nowrap;">
        <button class="small secondary" data-action="edit-visa" data-id="${v.id}">Edit</button>
        ${v.visaCopyFileName ? `<button class="small secondary" data-action="view-copy" data-id="${v.id}">View Copy</button>` : ''}
        <button class="small danger" data-action="delete-visa" data-id="${v.id}">Delete</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="12" style="color:var(--text-soft);">No visa records yet \u2014 use "+ Add Visa Record" or import from Excel.</td></tr>';
  document.getElementById('visaSelectAll').checked = shown.length > 0 && shown.every(v => selectedVisaIds.has(v.id));
  renderVisaBulkBar();
}
function renderVisaBulkBar() {
  const bar = document.getElementById('visaBulkBar');
  const n = selectedVisaIds.size;
  bar.style.display = n > 0 ? 'flex' : 'none';
  document.getElementById('visaBulkCount').textContent = n + ' selected';
}

document.querySelector('#visaMainTable tbody').addEventListener('change', (e) => {
  if (!e.target.classList.contains('visa-row-check')) return;
  const id = e.target.dataset.id;
  if (e.target.checked) selectedVisaIds.add(id); else selectedVisaIds.delete(id);
  renderVisaBulkBar();
  document.getElementById('visaSelectAll').checked = [...document.querySelectorAll('.visa-row-check')].every(c => c.checked);
});
document.getElementById('visaSelectAll').addEventListener('change', (e) => {
  document.querySelectorAll('.visa-row-check').forEach(c => {
    c.checked = e.target.checked;
    if (e.target.checked) selectedVisaIds.add(c.dataset.id); else selectedVisaIds.delete(c.dataset.id);
  });
  renderVisaBulkBar();
});
document.getElementById('visaBulkClearBtn').addEventListener('click', () => { selectedVisaIds.clear(); renderVisaMainTable(getVisaFiltered()); });
document.getElementById('visaBulkDeleteBtn').addEventListener('click', () => {
  const ids = [...selectedVisaIds];
  if (!ids.length) return;
  if (!confirm('Permanently delete ' + ids.length + ' selected visa record(s)? This cannot be undone.')) return;
  bulkDeleteVisaRecords(DB, ids);
  selectedVisaIds.clear();
  dbSave().then(() => { refreshVisaView(); refreshPipelineView(); });
});
document.getElementById('visaBulkEditBtn').addEventListener('click', () => {
  if (!selectedVisaIds.size) return;
  openVisaBulkEditForm([...selectedVisaIds]);
});

document.querySelector('#visaMainTable tbody').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === 'edit-visa') openVisaForm(id);
  else if (btn.dataset.action === 'delete-visa') deleteVisa(id);
  else if (btn.dataset.action === 'view-copy') viewVisaCopy(id);
});

document.getElementById('visaAddBtn').addEventListener('click', () => openVisaForm(null, null));
document.getElementById('visaBulkAddBtn').addEventListener('click', () => openBulkAddVisaForm());
['visaFilterNat', 'visaFilterCat', 'visaFilterClient', 'visaFilterStatus', 'visaFilterSponsor', 'visaExpiryWindow'].forEach(id => {
  document.getElementById(id).addEventListener('change', renderVisaAll);
});
document.getElementById('visaSearch').addEventListener('input', renderVisaAll);
attachTableSort(document.getElementById('visaCrTable'), (s) => { visaCrSort = s; renderVisaCrTable(getVisaFiltered()); });
attachTableSort(document.getElementById('visaExpiryTable'), (s) => { visaExpSort = s; renderVisaExpiryTable(getVisaFiltered()); });
document.getElementById('visaExportBtn').addEventListener('click', () => {
  const rows = getVisaFiltered();
  const headers = ['ID', 'Full Name', 'Passport', 'Nationality', 'Category', 'Sponsor', 'Company Name', 'Client', 'Status',
    'QIWA Visa Date', 'QIWA Visa Expiration', 'Visa Number', 'Candidate Visa Date', 'Candidate Visa Expiration',
    'Registered Agency Name', 'Enjaz/Consulate Delegate Name', 'Visa Delegation Number', 'Agency Delegation Number',
    'Ratified By', 'Ratification Date', 'MOFA Application Number', 'Visa Copy File', 'Linked Case ID'];
  const out = rows.map(r => [r.id, r.fullName, r.passport, r.nationality, r.visaCategory, r.sponsor, r.companyName, r.client, r.statusVisa,
    r.qiwaVisaDate || '', r.expirationDate || '', r.visaNumber || '', r.candidateVisaDate || '', r.candidateVisaExpiration || '',
    r.registeredAgencyName || '', r.enjazAgencyName || '', r.visaDelegationNumber || '', r.agencyDelegationNumber || '',
    r.ratifiedBy || '', r.ratificationDate || '', r.mofaApplicationNumber || '', r.visaCopyOriginalName || '', r.linkedRecruitmentCaseId || '']);
  downloadCsv('Visa_Report_filtered.csv', headers, out);
});
document.getElementById('visaPrintBtn').addEventListener('click', () => window.print());

/* =========================================================
   DATABASE PANEL WIRING
   ========================================================= */
let clientListSnapshot = [];
function renderClientsTable() {
  if (!dbIsOpen()) return;
  clientListSnapshot = listClients(DB);
  document.querySelector('#clientsTable tbody').innerHTML = clientListSnapshot.map((c, i) => `
    <tr><td>${esc(c.client)}</td><td>${fmtNum(c.cases)}</td><td>${fmtNum(c.visas)}</td>
    <td style="white-space:nowrap;">
      <button class="small secondary" data-action="view-cases" data-idx="${i}" ${c.cases === 0 ? 'disabled' : ''}>View Cases</button>
      <button class="small secondary" data-action="view-visas" data-idx="${i}" ${c.visas === 0 ? 'disabled' : ''}>View Visas</button>
      <button class="small secondary" data-action="rename-client" data-idx="${i}">Rename</button>
      <button class="small danger" data-action="delete-client" data-idx="${i}">Delete</button>
    </td></tr>`).join('') || '<tr><td colspan="4" style="color:var(--text-soft);">No clients yet.</td></tr>';
}
function jumpToClientIn(reportTab, filterSelectId, clientName) {
  document.querySelector(`.tab[data-tab="${reportTab}"]`).click();
  const sel = document.getElementById(filterSelectId);
  // the option list is populated by the report's own refresh cycle; ensure the value exists, then set it
  if (![...sel.options].some(o => o.value === clientName)) {
    sel.innerHTML += `<option value="${esc(clientName)}">${esc(clientName)}</option>`;
  }
  sel.value = clientName;
  sel.dispatchEvent(new Event('change'));
}
document.querySelector('#clientsTable tbody').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const entry = clientListSnapshot[Number(btn.dataset.idx)];
  if (!entry) return;
  if (btn.dataset.action === 'view-cases') {
    jumpToClientIn('pipeline', 'pipelineFilterClient', entry.client);
  } else if (btn.dataset.action === 'view-visas') {
    jumpToClientIn('visa', 'visaFilterClient', entry.client);
  } else if (btn.dataset.action === 'rename-client') {
    const newName = prompt('Rename "' + entry.client + '" to:', entry.client);
    if (newName && newName.trim() && newName.trim() !== entry.client) {
      const count = renameClient(DB, entry.client, newName.trim());
      dbSave().then(() => {
        renderClientsTable(); refreshVisaView(); refreshPipelineView();
        logTo('dbLog', 'Renamed "' + entry.client + '" to "' + newName.trim() + '" across ' + count + ' record(s).', 'ok');
      });
    }
  } else if (btn.dataset.action === 'delete-client') {
    const typed = prompt('This will PERMANENTLY delete ' + entry.cases + ' recruitment case(s) and ' + entry.visas + ' visa record(s) for "' + entry.client + '". Type DELETE to confirm.');
    if (typed === 'DELETE') {
      const result = deleteClient(DB, entry.client);
      dbSave().then(() => {
        renderClientsTable(); refreshVisaView(); refreshPipelineView();
        logTo('dbLog', 'Deleted client "' + entry.client + '": ' + result.casesRemoved + ' case(s), ' + result.visasRemoved + ' visa(s) removed.', 'warn');
      });
    }
  }
});

document.getElementById('dbOpenBtn').addEventListener('click', dbOpenExisting);
document.getElementById('dbCreateBtn').addEventListener('click', dbCreateNew);
document.getElementById('dbImportBtn').addEventListener('click', runImport);
document.getElementById('dbExportBtn').addEventListener('click', runExport);
document.getElementById('attachmentsDirBtn').addEventListener('click', ensureAttachmentsDir);


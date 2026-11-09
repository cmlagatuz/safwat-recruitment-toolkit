
(function ClaireLocalBrainV760(){
  'use strict';
  var V = '7.7.1', CREATOR = 'Lagatuz Labs';
  try { if (localStorage.getItem('claire.local.off') === '1') return console.warn('[CLAIRE ' + V + '] local brain disabled by kill switch'); } catch (e) {}

  /* one-time: the cloud AI is blocked for this project (Google PERMISSION_DENIED),
     so switch it off once per browser. "ai on" in the chat turns it back on. */
  try {
    if (localStorage.getItem('claire.v760') !== '1') { localStorage.setItem('claire.ai', 'off'); localStorage.setItem('claire.v760', '1'); }
    localStorage.setItem('claire.aiCreator', CREATOR);
  } catch (e) {}

  var tries = 0, waited = 0;
  function boot(){
    var C = window.CLAIRE, chat = document.getElementById('claireChat');
    if (!C || !C.ask || !chat) {
      if (++tries < 120) return setTimeout(boot, 500);
      return console.warn('[CLAIRE ' + V + '] chat (v7.4.0) not found — local brain not installed.');
    }
    if (!C.ai && ++waited < 10) return setTimeout(boot, 500);      /* let v7.5.x install first so its brain can be wrapped */
    if (C.local) return;
    init(C, chat);
  }

  function init(C, chat){
    var logEl = chat.querySelector('.cc-log');

    /* =====================================================================
       helpers
       ===================================================================== */
    var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); };
    var DB = function(){ return window.DB || {}; };
    var rowsOf = function(k){ return (k === 'visa' ? DB().visaRecords : DB().recruitmentCases) || []; };
    var pad = function(n){ return String(n).padStart(2, '0'); };
    var ymd = function(d){ return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    var today = function(){ var d = new Date(); d.setHours(0, 0, 0, 0); return d; };
    var addDays = function(d, n){ var x = new Date(d); x.setDate(x.getDate() + n); return x; };
    var iso = function(x){
      if (x == null || x === '') return '';
      var s = C.toIso ? C.toIso(x) : ''; if (s) return s;
      var m = String(x).match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/); return m ? m[1] + '-' + pad(m[2]) + '-' + pad(m[3]) : '';
    };
    var dnum = function(s){ var q = s.split('-').map(Number); return Date.UTC(q[0], q[1] - 1, q[2]) / 864e5; };
    var dayDiff = function(a, b){ return dnum(a) - dnum(b); };
    var plural = function(n, w){ return n + ' ' + w + (n === 1 ? '' : 's'); };
    var fmtN = function(n){ return (Math.round(n * 100) / 100).toLocaleString('en-US'); };
    function normQ(s){
      return String(s == null ? '' : s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[’'`]/g, '').replace(/[^a-z0-9\u0600-\u06ff\/\-.,#<>=+ ]/g, ' ').replace(/\s+/g, ' ').trim();
    }
    var tokenize = function(s){ return String(s).split(/[^a-z0-9\u0600-\u06ff]+/).filter(Boolean); };
    function stem(t){
      if (t.length > 4 && /ies$/.test(t)) return t.slice(0, -3) + 'y';
      if (t.length > 3 && /s$/.test(t) && !/(ss|us|is)$/.test(t)) return t.slice(0, -1);
      return t;
    }
    var set = function(s){ var o = {}; s.split(/\s+/).forEach(function(w){ if (w) o[w] = 1; }); return o; };

    /* =====================================================================
       vocabulary
       ===================================================================== */
    var GENERIC = set('company co ltd limited international internnational intl services service inc corporation corp group pvt private license licence lic no number reg regd registration the and of for saudi arabia arabian middle east general trading trade contracting cont management solutions solution consultants consultant consultancy enterprises enterprise travel tours tour recruitment recruiting manpower global hr human resources resource overseas employment agency center centre sa de cv sl sdn bhd llc rl mum per part lb dmw poea pea op hrd kar rwp lhr bom pe orient worker');
    var STOP = set('how many much count counting number total list show display give tell find get pull see check which what who whom whose where when are is was were be been there do doe does did we have has had having with for of in on at to the a an and or but by per each every all any some only just also now then that those these them their they it its from me my our us you your i can could would will should please pls plz kindly currently current right still yet so far about than as into under more less most least record entry data detail info information one same instead again want need know like let look looking provide send export table breakdown summary report overview break down split grouped group sorted sort order ordered between over above below up within inside sar riyal sr overall altogether exist existing exists available? ok okay hey hi');
    delete STOP['available?'];
    var NEG = set('not except excluding exclude excluded non besides minus no');
    var ENTITY_VISA = set('visa block slot quota');
    var ENTITY_CASE = set('candidate applicant worker employee people person hire case staff recruit cv profile');
    var ALIAS_HINT = {
      client: ['client', 'customer'], companyName: ['company', 'sponsor'], nationality: ['nationality', 'country'],
      visaCategory: ['category', 'profession', 'occupation'], position: ['position', 'job', 'role', 'title'],
      statusVisa: ['status'], stage: ['stage', 'status'], registeredAgencyName: ['agency', 'recruiter'], agency: ['agency', 'recruiter'],
      stampingCity: ['city', 'embassy', 'consulate', 'stamping', 'stamped'], gender: ['gender'], recruitmentType: ['type', 'source'], ratifiedBy: ['chamber']
    };
    var ALIAS_WORDS = {}; Object.keys(ALIAS_HINT).forEach(function(f){ ALIAS_HINT[f].forEach(function(w){ ALIAS_WORDS[w] = 1; }); });
    var NAT = { egypt: 'egyptian', pakistan: 'pakistani', sudan: 'sudanese', philippine: 'filipino', pinoy: 'filipino', pinay: 'filipino', filipina: 'filipino',
      india: 'indian', bangladesh: 'bangladeshi', nepal: 'nepalese', nepali: 'nepalese', lanka: 'lankan', ghana: 'ghanian', ghanaian: 'ghanian', kenya: 'kenyan',
      nigeria: 'nigerian', uganda: 'ugandan', tunisia: 'tunisian', algeria: 'algerian', jordan: 'jordanian', lebanon: 'lebanese', malaysia: 'malaysian',
      indonesia: 'indonesian', uk: 'british', britain: 'british', england: 'british', english: 'british', canada: 'canadian', mexico: 'mexican', peru: 'peruvian',
      venezuela: 'venezuelan', zimbabwe: 'zimbabwean', netherland: 'dutch', holland: 'dutch', france: 'french', kazakhstan: 'kazakh', germany: 'german', trinidad: 'trinidadian' };
    var SYN = {
      statusVisa: { available: 'unused', free: 'unused', spare: 'unused', vacant: 'unused', remaining: 'unused', reserved: 'allocated', assigned: 'allocated',
        utilized: 'used', utilised: 'used', consumed: 'used', canceled: 'cancelled', void: 'cancelled', lapsed: 'expired' },
      gender: { men: 'male', man: 'male', gent: 'male', boy: 'male', women: 'female', woman: 'female', lady: 'female', girl: 'female' },
      stage: { bio: 'biometric', deployment: 'deployed', canceled: 'cancelled', withdrew: 'withdrawn', backed: 'backout', svp: 'svp', qvp: 'qvp', skill: 'skill' }
    };
    var MATCH_FIELDS = {
      visa: ['statusVisa', 'gender', 'nationality', 'visaCategory', 'client', 'stampingCity', 'registeredAgencyName', 'companyName', 'ratifiedBy', 'enjazAgencyName', 'sponsor'],
      'case': ['stage', 'gender', 'nationality', 'position', 'recruitmentType', 'client', 'agency', 'visaCategory']
    };
    var CROSS = { visa: ['stage', 'position'], 'case': ['statusVisa', 'stampingCity'] };
    var LABEL = { statusVisa: 'status', visaCategory: 'category', registeredAgencyName: 'agency', stampingCity: 'stamping city', expirationDate: 'QIWA expiry',
      candVisaIssuance: 'cand. visa date', candVisaExpiration: 'cand. visa expiry', candidateVisaDate: 'cand. visa date (old field)', candidateVisaExpiration: 'cand. visa expiry (old field)',
      linkedRecruitmentCaseId: 'linked candidate', linkedVisaId: 'linked visa', recruitmentType: 'recruitment type', totalSalary: 'total salary', basicSalary: 'basic salary',
      housingAllowance: 'housing allowance', foodAllowance: 'food allowance', transportationAllowance: 'transport allowance', specialAllowance: 'special allowance',
      requestDate: 'request date', createdAt: 'created', updatedAt: 'updated', dateArrivalKsa: 'arrival in KSA', dateOfferSent: 'offer sent', dateMedicalResult: 'medical result',
      dateBioResult: 'biometrics result', dateBioOutset: 'biometrics start', dateSvpResult: 'SVP result', selectionDate: 'selection date', dateWorkStarted: 'work started',
      daysToExpiry: 'days to QIWA expiry', candVisaDaysLeft: 'days to cand. visa expiry', companyName: 'company', ratifiedBy: 'chamber', visaDocumentNumber: 'visa doc #',
      fullName: 'name', mofaNumber: 'MOFA #', mofaApplicationNumber: 'MOFA application #', visaNumber: 'visa #', qiwaVisaDate: 'QIWA visa date', delegationDate: 'delegation date',
      ratificationDate: 'ratification date', visaDelegationNumber: 'delegation #', enjazAgencyName: 'Enjaz agency', visaCopyFileName: 'visa copy' };
    function label(f){
      var m = String(f).match(/^(visa|case)\.(.+)$/);
      if (m) return (m[1] === 'visa' ? 'visa ' : 'candidate ') + label(m[2]);
      return LABEL[f] || String(f).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    }

    /* =====================================================================
       data model (field types + value index), rebuilt when data changes
       ===================================================================== */
    var DERIVED = { visa: { daysToExpiry: 'number', candVisaDaysLeft: 'number' }, 'case': {} };
    var model = { k: '', types: null, idx: null };
    function sig(){ var m = DB().meta || {}; return rowsOf('visa').length + '|' + rowsOf('case').length + '|' + (m.savedAt || ''); }
    function detectType(rows, f){
      if (/hijri/i.test(f)) return 'text';
      var n = 0, d = 0, num = 0;
      for (var i = 0; i < rows.length && n < 300; i++) {
        var x = rows[i] && rows[i][f]; if (x == null || x === '' || typeof x === 'object') continue; n++;
        var s = String(x).trim();
        if (/^\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/.test(s) || /^\d{1,2}[-\/.]\d{1,2}[-\/.]\d{4}$/.test(s)) d++;
        else if (/^-?\d[\d,]*(\.\d+)?$/.test(s)) num++;
      }
      if (!n) return null;
      return d / n >= 0.8 ? 'date' : num / n >= 0.8 ? 'number' : 'text';
    }
    function sigToks(x, f){
      var all = tokenize(normQ(x)).map(stem).map(function(t){ return f === 'nationality' ? (NAT[t] || t) : t; });
      var s = all.filter(function(t){ return t.length >= 2 && !GENERIC[t] && !/^\d+$/.test(t); });
      return s.length ? s : all.filter(function(t){ return !/^\d+$/.test(t); });
    }
    function ensure(){
      var k = sig(); if (model.k === k) return model;
      var types = { visa: {}, 'case': {} }, ix = { visa: {}, 'case': {} };
      ['visa', 'case'].forEach(function(kind){
        var rows = rowsOf(kind), keys = {};
        rows.forEach(function(r){ if (r && typeof r === 'object') for (var key in r) if (key.charAt(0) !== '_') keys[key] = 1; });
        Object.keys(keys).forEach(function(f){ var t = detectType(rows, f); if (t) types[kind][f] = t; });
        Object.keys(DERIVED[kind]).forEach(function(f){ types[kind][f] = DERIVED[kind][f]; });
        MATCH_FIELDS[kind].forEach(function(f){
          if (types[kind][f] !== 'text') return;
          var vals = {};
          rows.forEach(function(r){ var x = r && r[f]; if (x == null || x === '' || typeof x === 'object') return; var key = normQ(x); if (key && !vals[key]) vals[key] = { raw: String(x).trim(), key: key, toks: sigToks(x, f) }; });
          var list = Object.keys(vals).map(function(q){ return vals[q]; }).filter(function(v){ return v.toks.length; });
          if (!list.length || list.length > 400) return;
          ix[kind][f] = list;
        });
      });
      model = { k: k, types: types, idx: ix };
      return model;
    }
    function typeOf(kind, f){
      var m = String(f).match(/^(visa|case)\.(.+)$/); if (m) return typeOf(m[1], m[2]);
      return ensure().types[kind][f] || null;
    }
    function hasField(kind, f){ return !!(f && typeOf(kind, f)); }

    /* =====================================================================
       dates
       ===================================================================== */
    var MON = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?![a-z])';
    var DATE = '(?:' + [
      '\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}',
      '\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{4}',
      '\\d{1,2}(?:st|nd|rd|th)? (?:of )?' + MON + '(?:,? \\d{4})?',
      MON + ',? \\d{4}',
      MON + ' \\d{1,2}(?:st|nd|rd|th)?(?!\\d)(?:,? \\d{4})?',
      MON,
      '20\\d{2}(?![\\d/.-])',
      'today|tomorrow|yesterday',
      '(?:this|next|last|previous|coming|current) (?:week|month|year)',
      'end of (?:the |this )?(?:month|year)'
    ].join('|') + ')';
    function monIdx(s){ var k = s.slice(0, 3); return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(k); }
    function inferYear(mon, future){ var T = today(), cy = T.getFullYear(), cm = T.getMonth(); return future ? (mon >= cm ? cy : cy + 1) : (mon <= cm ? cy : cy - 1); }
    function dayR(y, m, d){ var x = new Date(y, m, d); if (x.getMonth() !== ((m % 12) + 12) % 12 || x.getDate() !== d) return null; return { from: ymd(x), to: ymd(x) }; }
    function monR(y, m){ return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) }; }
    function toRange(s, future){
      s = String(s).replace(/,/g, '').replace(/\s+/g, ' ').trim();
      var m, T = today();
      if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/))) return dayR(+m[1], m[2] - 1, +m[3]);
      if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/))) return dayR(+m[3], m[2] - 1, +m[1]);   /* day-first */
      if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)? (?:of )?([a-z]+)(?: (\d{4}))?$/)) && monIdx(m[2]) >= 0) { var mi = monIdx(m[2]); return dayR(m[3] ? +m[3] : inferYear(mi, future), mi, +m[1]); }
      if ((m = s.match(/^([a-z]+) (\d{4})$/)) && monIdx(m[1]) >= 0) return monR(+m[2], monIdx(m[1]));
      if ((m = s.match(/^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/)) && monIdx(m[1]) >= 0) { var mj = monIdx(m[1]); return dayR(m[3] ? +m[3] : inferYear(mj, future), mj, +m[2]); }
      if ((m = s.match(/^(20\d{2})$/))) return { from: m[1] + '-01-01', to: m[1] + '-12-31' };
      if (s === 'today') return { from: ymd(T), to: ymd(T) };
      if (s === 'tomorrow') { var t1 = addDays(T, 1); return { from: ymd(t1), to: ymd(t1) }; }
      if (s === 'yesterday') { var t0 = addDays(T, -1); return { from: ymd(t0), to: ymd(t0) }; }
      if ((m = s.match(/^(this|next|last|previous|coming|current) (week|month|year)$/))) {
        var off = /next|coming/.test(m[1]) ? 1 : /last|previous/.test(m[1]) ? -1 : 0;
        if (m[2] === 'week') { var ws = addDays(T, -T.getDay() + 7 * off); return { from: ymd(ws), to: ymd(addDays(ws, 6)) }; }   /* Sunday-start week */
        if (m[2] === 'month') return monR(T.getFullYear(), T.getMonth() + off);
        var y = T.getFullYear() + off; return { from: y + '-01-01', to: y + '-12-31' };
      }
      if ((m = s.match(/^end of (?:the |this )?(month|year)$/))) { var e = m[1] === 'month' ? new Date(T.getFullYear(), T.getMonth() + 1, 0) : new Date(T.getFullYear(), 11, 31); return { from: ymd(e), to: ymd(e) }; }
      if (monIdx(s) >= 0 && /^[a-z]+$/.test(s)) { var mk = monIdx(s); return monR(inferYear(mk, future), mk); }
      return null;
    }
    var UNIT = { day: 1, week: 7, month: 30, year: 365 };

    /* =====================================================================
       alias tables (phrase → field per entity)
       ===================================================================== */
    var FA_LIST = [
      ['clients?|customers?', { visa: 'client', 'case': 'client' }],
      ['nationalit(?:y|ies)|countr(?:y|ies)', { visa: 'nationality', 'case': 'nationality' }],
      ['(?:visa )?categor(?:y|ies)|professions?|occupations?', { visa: 'visaCategory', 'case': 'visaCategory' }],
      ['positions?|job titles?|jobs?|roles?', { visa: 'visaCategory', 'case': 'position' }],
      ['(?:visa )?status(?:es)?', { visa: 'statusVisa', 'case': 'stage' }],
      ['(?:pipeline )?stages?', { visa: 'case.stage', 'case': 'stage' }],
      ['(?:recruitment |registered )?agenc(?:y|ies)|recruiters?', { visa: 'registeredAgencyName', 'case': 'agency' }],
      ['(?:stamping )?cit(?:y|ies)|embass(?:y|ies)|consulates?', { visa: 'stampingCity', 'case': 'visa.stampingCity' }],
      ['genders?|sex', { visa: 'gender', 'case': 'gender' }],
      ['(?:recruitment )?types?|sources?', { 'case': 'recruitmentType' }],
      ['sponsors?', { visa: 'sponsor' }],
      ['compan(?:y|ies)', { visa: 'companyName', 'case': 'client' }],
      ['(?:visa )?(?:doc(?:ument)?s?|blocks?)(?: (?:no|number|#))?', { visa: 'visaDocumentNumber', 'case': 'visa.visaDocumentNumber' }],
      ['chambers?|ratified by', { visa: 'ratifiedBy' }],
      ['months?|monthly', { visa: '@month', 'case': '@month' }],
      ['years?|yearly|annually', { visa: '@year', 'case': '@year' }]
    ];
    var NUMA_LIST = [
      ['basic(?: salar(?:y|ies)| pay)?', { 'case': 'basicSalary' }],
      ['housing(?: allowances?)?', { 'case': 'housingAllowance' }],
      ['food(?: allowances?)?', { 'case': 'foodAllowance' }],
      ['transport(?:ation)?(?: allowances?)?', { 'case': 'transportationAllowance' }],
      ['special allowances?', { 'case': 'specialAllowance' }],
      ['days (?:left|remaining|to (?:qiwa )?expir\\w*)', { visa: 'daysToExpiry', 'case': 'visa.candVisaDaysLeft' }],
      ['total salar(?:y|ies)|salar(?:y|ies)|pay|wages?|compensation|packages?|paid', { 'case': 'totalSalary' }]
    ];
    var DATEA_LIST = [
      ['qiwa (?:visa )?(?:expir\\w*|expiry)(?: dates?)?', { visa: 'expirationDate', 'case': 'visa.expirationDate' }],
      ['cand(?:idate)?\\.? visa (?:expir\\w*|expiry)(?: dates?)?', { visa: 'candVisaExpiration', 'case': 'visa.candVisaExpiration' }],
      ['cand(?:idate)?\\.? visa (?:dates?|issu\\w*)', { visa: 'candVisaIssuance', 'case': 'visa.candVisaIssuance' }],
      ['qiwa (?:visa )?dates?', { visa: 'qiwaVisaDate', 'case': 'visa.qiwaVisaDate' }],
      ['delegation dates?|delegated', { visa: 'delegationDate' }],
      ['ratification dates?|ratified', { visa: 'ratificationDate' }],
      ['visa (?:expir\\w*|expiry)(?: dates?)?', { visa: 'expirationDate', 'case': 'visa.candVisaExpiration' }],
      ['expir\\w*(?: dates?)?|expiry(?: dates?)?', { visa: 'expirationDate', 'case': 'visa.candVisaExpiration' }],
      ['arriv\\w*(?: dates?)?(?: in ksa)?', { 'case': 'dateArrivalKsa' }],
      ['offers? sent|offer dates?|offered', { 'case': 'dateOfferSent' }],
      ['medical results?(?: dates?)?', { 'case': 'dateMedicalResult' }],
      ['bio(?:metrics?)? results?(?: dates?)?', { 'case': 'dateBioResult' }],
      ['bio(?:metrics?)? (?:outset|start\\w*)', { 'case': 'dateBioOutset' }],
      ['svp results?(?: dates?)?', { 'case': 'dateSvpResult' }],
      ['selection(?: dates?)?|selected', { 'case': 'selectionDate' }],
      ['request(?:ed)?(?: dates?)?', { 'case': 'requestDate' }],
      ['work start\\w*|start(?:ed)? work(?:ing)?|joining dates?|joined', { 'case': 'dateWorkStarted' }],
      ['created|creation dates?|added|entered', { visa: 'createdAt', 'case': 'createdAt' }],
      ['updated|modified|edited|last updates?', { visa: 'updatedAt', 'case': 'updatedAt' }]
    ];
    var EMP_LIST = [
      ['passports?(?: (?:no|number|#))?', { visa: 'passport', 'case': 'passport' }],
      ['mofa(?: (?:no|number|#|application(?: (?:no|number))?))?', { visa: '@mofa' }],
      ['visa (?:no|number|#)s?', { visa: 'visaNumber', 'case': 'visa.visaNumber' }],
      ['(?:visa )?doc(?:ument)? (?:no|number|#)s?', { visa: 'visaDocumentNumber' }],
      ['iqamas?(?: (?:no|number|#))?', { 'case': 'iqama' }],
      ['e-?mails?(?: address(?:es)?)?', { 'case': 'email' }],
      ['phones?(?: (?:no|number))?|mobiles?(?: (?:no|number))?|contact (?:no|number)s?', { 'case': 'phone' }],
      ['clients?', { visa: 'client', 'case': 'client' }],
      ['agenc(?:y|ies)', { visa: 'registeredAgencyName', 'case': 'agency' }],
      ['nationalit(?:y|ies)', { visa: 'nationality', 'case': 'nationality' }],
      ['(?:visa )?categor(?:y|ies)', { visa: 'visaCategory', 'case': 'visaCategory' }],
      ['positions?', { 'case': 'position' }],
      ['genders?', { visa: 'gender', 'case': 'gender' }],
      ['(?:stamping )?cit(?:y|ies)', { visa: 'stampingCity' }],
      ['names?', { visa: 'fullName', 'case': 'name' }],
      ['(?:qiwa )?(?:expiry|expiration)(?: dates?)?', { visa: 'expirationDate' }],
      ['delegation (?:no|number)s?', { visa: 'visaDelegationNumber' }],
      ['delegation(?: dates?)?', { visa: 'delegationDate' }],
      ['salar(?:y|ies)', { 'case': 'totalSalary' }],
      ['offer(?: letters?)?(?: dates?)?', { 'case': 'dateOfferSent' }],
      ['medical(?: results?)?(?: dates?)?', { 'case': 'dateMedicalResult' }],
      ['arrival(?: dates?)?', { 'case': 'dateArrivalKsa' }],
      ['request dates?', { 'case': 'requestDate' }],
      ['cand(?:idate)? visa (?:dates?|issuance)', { visa: 'candVisaIssuance' }],
      ['visa cop(?:y|ies)|attachments?', { visa: 'visaCopyFileName' }],
      ['(?:linked )?candidates?|links?', { visa: 'linkedRecruitmentCaseId' }],
      ['(?:linked )?visas?', { 'case': 'linkedVisaId' }]
    ];
    var alt = function(list){ return list.map(function(x){ return '(?:' + x[0] + ')'; }).join('|'); };
    var FA = alt(FA_LIST), NUMA = alt(NUMA_LIST), DATEA = alt(DATEA_LIST), EMP = alt(EMP_LIST);
    function lookup(list, text){
      text = String(text || '').trim();
      for (var i = 0; i < list.length; i++) if (new RegExp('^(?:' + list[i][0] + ')$').test(text)) return list[i][1];
      return null;
    }
    function fieldFor(entry, kind){
      if (!entry) return null;
      var f = entry[kind]; if (!f) return null;
      if (f === '@mofa') f = hasField(kind, 'mofaNumber') ? 'mofaNumber' : 'mofaApplicationNumber';
      if (f.charAt(0) === '@') return f;
      return hasField(kind, f) ? f : null;
    }

    /* =====================================================================
       value matching (clients, statuses, nationalities, stages, …)
       ===================================================================== */
    function lev1(a, b){
      if (Math.abs(a.length - b.length) > 1) return false;
      var i = 0, j = 0, e = 0;
      while (i < a.length && j < b.length) {
        if (a[i] === b[j]) { i++; j++; continue; }
        if (++e > 1) return false;
        if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
      }
      return e + (a.length - i) + (b.length - j) <= 1;
    }
    function tokScore(q, v){
      if (q === v) return 3;
      if (q.length >= 4 && v.length > q.length && v.indexOf(q) === 0) return 2;
      if (q.length >= 5 && v.length >= 5 && lev1(q, v)) return 2;
      return 0;
    }
    function altTok(t, f){ if (f === 'nationality') return NAT[t] || t; return (SYN[f] && SYN[f][t]) || t; }

    /* toks: [{t, i, used}]; all: full masked token list (for negation + alias hints) */
    function matchValues(kind, toks, all, fields, fullOnly, prefix){
      var IX = ensure().idx[kind], hits = [], conds = [];
      fields.forEach(function(f, prio){
        var list = IX[f]; if (!list) return;
        list.forEach(function(v){
          var cov = 0, idxs = [], best = 3, exactAll = true;
          v.toks.forEach(function(vt){
            var got = 0, gi = -1;
            toks.forEach(function(q){ if (q.used) return; var s = tokScore(altTok(q.t, f), vt); if (s > got) { got = s; gi = q.i; } });
            if (got) { cov++; if (idxs.indexOf(gi) < 0) idxs.push(gi); best = Math.min(best, got); if (got < 3) exactAll = false; }
          });
          if (!cov) return;
          var full = cov === v.toks.length;
          if (fullOnly && !full) return;
          hits.push({ f: f, prio: prio, v: v, idxs: idxs, full: full, exact: exactAll, score: (full ? 10 : 0) + cov * best });
        });
      });
      /* document frequency of each q token per field */
      var df = {};
      hits.forEach(function(h){ h.idxs.forEach(function(i){ var k = h.f + '|' + i; df[k] = (df[k] || 0) + 1; }); });
      var tokText = {}; toks.forEach(function(q){ tokText[q.i] = q.t; });
      var hint = function(i, f){ var p = all[i - 1], p2 = all[i - 2]; var w = ALIAS_HINT[f] || []; return (p && w.indexOf(p) >= 0) || (p2 && w.indexOf(p2) >= 0); };
      /* claims: each q token goes to the best field */
      var claims = {};
      hits.forEach(function(h){
        if (!h.full && h.idxs.some(function(i){ return (tokText[i] || '').length < (h.exact ? 3 : 4); })) return;
        h.idxs.forEach(function(i){
          var sc = h.score + (hint(i, h.f) ? 5 : 0), c = claims[i];
          if (!c || sc > c.score || (sc === c.score && h.prio < c.prio)) claims[i] = { f: h.f, score: sc, prio: h.prio };
        });
      });
      var byField = {};
      hits.forEach(function(h){
        if (!h.idxs.every(function(i){ return claims[i] && claims[i].f === h.f; })) return;
        (byField[h.f] = byField[h.f] || []).push(h);
      });
      Object.keys(byField).forEach(function(f){
        var hs = byField[f], fullTok = {};
        hs.forEach(function(h){ if (h.full) h.idxs.forEach(function(i){ fullTok[i] = 1; }); });
        var groups = {};                                  /* group values by the q tokens they rely on (so "not X" stays separate) */
        hs.forEach(function(h){
          if (!h.full && h.idxs.some(function(i){ return fullTok[i]; })) return;
          var key = h.idxs.slice().sort().join(',');
          (groups[key] = groups[key] || { idxs: h.idxs, vals: [], full: h.full, exact: h.exact }).vals.push(h.v.raw);
        });
        Object.keys(groups).forEach(function(k){
          var g = groups[k];
          var neg = g.idxs.some(function(i){ var p = all[i - 1], p2 = all[i - 2]; return NEG[p] || NEG[p2] || (p === 'than' && p2 === 'other'); });
          var field = (prefix || '') + f;
          if (!g.full && g.vals.length > 6) {          /* too broad: use "contains" on the word itself */
            if (g.idxs.length !== 1) return;
            var w = tokText[g.idxs[0]];
            conds.push({ field: field, op: neg ? 'notContains' : 'contains', value: w });
          } else conds.push({ field: field, op: neg ? 'nin' : (g.vals.length === 1 ? 'eq' : 'in'), value: g.vals[0], values: g.vals });
          g.idxs.forEach(function(i){ toks.forEach(function(q){ if (q.i === i) q.used = true; }); });
        });
      });
      return conds;
    }

    /* =====================================================================
       parser: question → plan
       ===================================================================== */
    var EXPIRING = /\b(expiring|expire|expires|about to expire|due to expire|running out|will expire)\b/;
    /* v7.7.0 — single date rule */
    var OCCUR = { dateArrivalKsa: ['already arrived', 'arriving'], dateArrivedAccommodation: ['already at accommodation', 'still to reach accommodation'],
      dateWorkStarted: ['already started work', 'yet to start work'], mobilizationDate: ['already mobilized', 'yet to mobilize'], dateDeployment: ['already deployed', 'yet to deploy'],
      dateMedicalResult: ['results already in', 'results still due'], dateBioResult: ['results already in', 'results still due'], dateSvpResult: ['results already in', 'results still due'] };
    var PAST_EVT = /\b(arrived|landed|reached|joined|started|completed|finished|happened|took place|already)\b/;
    var FUT_EVT = /\b(arriving|will arrive|to arrive|will start|to start|expected|scheduled|upcoming|planned|future|pending|yet to|not yet|still to)\b/;
    var TENSE_WORDS = '\\b(?:already|arrived|arriving|arrive|arrivals?|landed|reached|joined|started|completed|finished|happened|took place|will|to|expected|scheduled|upcoming|planned|future|pending|yet|still)\\b';
    var EXPIRED = /\bexpired\b/;
    var FOLLOW = /^(and|what about|how about|same for|same but|now|only|just|also|but|except|excluding|then|instead|ok and|okay and)\b|\binstead\b|^(list|show)(?: me)? (them|those|these|it|all of them)\b|^which ones\b|^(by|per) /;
    var LISTW = /\b(list|show|display|which|who|whom|what are|give me|pull|names?|details?|see|view)\b/;
    var COUNTW = /\b(how many|count|number of|total number|how much)\b/;
    var last = null;

    function parse(raw, opts){
      opts = opts || {};
      var q0 = normQ(raw); if (!q0) return null;
      q0 = q0.replace(new RegExp('\\b(?:the )?(?:month|year) of (?=' + MON + '|20\\d{2}\\b)', 'g'), '').replace(/\s+/g, ' ').trim();   /* v7.7.0: "the month of october" → "october" */
      var S = { q: ' ' + q0 + ' ', pend: [], group: [], top: null, stat: null, sort: null, limit: null, nameLike: null };
      var cut = function(src, fn){
        S.q = S.q.replace(new RegExp(src, 'g'), function(){ var r = fn.apply(null, arguments); return r === false ? arguments[0] : ' '.repeat(arguments[0].length); });
      };
      /* entity noun that appears first */
      var ent = null, entPos = 1e9;
      tokenize(q0).forEach(function(w, i, arr){
        var s = stem(w);
        if (ENTITY_VISA[s] && !/^(categor|issu|number|no$|doc|expir|date|cop|delegat|status|holder)/.test(arr[i + 1] || '') && i < entPos) { ent = 'visa'; entPos = i; }
        if (ENTITY_CASE[s] && !(s === 'candidate' && /^visa/.test(arr[i + 1] || '')) && i < entPos) { ent = 'case'; entPos = i; }
      });
      var followUp = !!(last && !ent && (FOLLOW.test(q0) || opts.followUp));

      /* 1) groups / top / most */
      cut('\\b(?:top|first|best|highest|leading|biggest) (\\d+) (' + FA + ')\\b', function(m, n, a){ S.group.push(a); S.limit = +n; S.top = { dir: 'desc' }; });
      cut('\\b(?:bottom|lowest|last|least|smallest) (\\d+) (' + FA + ')\\b', function(m, n, a){ S.group.push(a); S.limit = +n; S.top = { dir: 'asc' }; });
      cut('\\b(?:which|what) (' + FA + ') (?:has|have|had|is|got|holds?|with|gets?)(?: the)? (most|highest|largest|biggest|max(?:imum)?|least|fewest|lowest|smallest|min(?:imum)?)\\b',
        function(m, a, d){ S.group.push(a); S.top = { dir: /least|fewest|lowest|smallest|min/.test(d) ? 'asc' : 'desc', one: true }; });
      cut('\\b(' + FA + ') with (?:the )?(most|highest|largest|least|fewest|lowest)\\b',
        function(m, a, d){ S.group.push(a); S.top = { dir: /least|fewest|lowest/.test(d) ? 'asc' : 'desc', one: true }; });
      cut('\\b(?:by|per) (?:the )?(' + DATEA + ') (month|year)s?\\b', function(m, a, g){ S.group.push('@' + g + '|' + a); });
      cut('\\b(?:grouped by|group by|broken down by|break ?down by|split by|breakdown by|by|per|for each|for every|in each|each|across(?: all)?) (?:the )?(' + FA + ')(?: and (?:by |per )?(' + FA + '))?(?![a-z])',
        function(m, a, b){ S.group.push(a); if (b) S.group.push(b); });
      cut('\\b(' + FA + ')[ -]?(?:wise|breakdown|distribution|split|summary)\\b', function(m, a){ S.group.push(a); });

      /* 2) stats */
      cut('\\b(average|avg|mean|median|total|sum|highest|maximum|max|lowest|minimum|min|biggest|largest|smallest) (?:of |the |their |of the )*(' + NUMA + ')(?![a-z])',
        function(m, a, f){ S.stat = { agg: a, alias: f, num: true }; });
      cut('\\b(earliest|oldest|first|latest|newest|most recent|last|soonest|next) (' + DATEA + ')(?![a-z])',
        function(m, a, f){ S.stat = { agg: /latest|newest|recent|last/.test(a) ? 'max' : 'min', alias: f, date: true }; });

      /* 3) sorting */
      cut('\\b(?:sorted|sort|ordered|order|ranked|rank|arranged?) by (?:the )?(' + FA + '|' + NUMA + '|' + DATEA + ')(?: (asc(?:ending)?|desc(?:ending)?|highest first|lowest first|newest first|oldest first|latest first|earliest first))?(?![a-z])',
        function(m, a, d){ S.sort = { alias: a, dir: d && /desc|highest|newest|latest/.test(d) ? 'desc' : 'asc', explicit: !!d }; });
      cut('\\b(highest|best|top|lowest|least)[ -]paid\\b', function(m, d){ S.sort = { alias: 'salary', dir: /lowest|least/.test(d) ? 'asc' : 'desc' }; });
      cut('\\b(newest|latest|most recent|recent|oldest|earliest|soonest)(?: first)?\\b', function(m, d){ if (S.sort) return false; S.sort = { alias: null, dir: /newest|latest|recent/.test(d) ? 'desc' : 'asc', soon: d === 'soonest' }; });
      cut('\\b(?:top|first) (\\d+)\\b', function(m, n){ S.limit = +n; if (!S.top) S.top = { dir: 'desc' }; });

      /* 4) name contains */
      cut('\\b(?:named |called |whose name (?:is |contains |has )?|name (?:is |contains |like |starts with ))([a-z][a-z.]*(?: [a-z][a-z.]*){0,3}?)(?= (?:in|for|from|with|who|that|and|by|on|at|under|whose)\\b| *$)',
        function(m, n){ S.nameLike = n.trim(); });

      /* 5) empty / filled */
      cut('\\b(?:un-?linked|not linked|unassigned|not (?:yet )?assigned|not allocated to (?:a |any )?candidates?)\\b', function(){ S.pend.push({ t: 'empty', e: { visa: 'linkedRecruitmentCaseId', 'case': 'linkedVisaId' } }); });
      cut('\\b(?:without|missing|lacking|with no|has no|have no|having no|w/o|no) (?:a |an |any )?(' + EMP + ')(?![a-z])', function(m, a){ S.pend.push({ t: 'empty', a: a }); });
      cut('\\b(' + EMP + ') (?:is |are )?(?:missing|empty|blank|not set|not filled|not entered|null)\\b', function(m, a){ S.pend.push({ t: 'empty', a: a }); });
      cut('\\b(?:linked|assigned) to (?:a |any |their )?candidates?\\b', function(){ S.pend.push({ t: 'filled', e: { visa: 'linkedRecruitmentCaseId' } }); });
      cut('\\b(?:with|has|have|having) (?:a |an |any )?(' + EMP + ')(?= (?:and|or|by|per|in|for|sorted|ordered|that|who|which|from|this|last|next|only)\\b| *$)', function(m, a){ S.pend.push({ t: 'filled', a: a }); });
      cut('\\blinked\\b', function(){ S.pend.push({ t: 'filled', e: { visa: 'linkedRecruitmentCaseId', 'case': 'linkedVisaId' } }); });

      /* 6) numbers (only when a money/number field is named) */
      var numAlias = (S.q.match(new RegExp('\\b(' + NUMA + ')(?![a-z])')) || [])[1] || (S.stat && S.stat.num ? S.stat.alias : null) || (S.sort && lookup(NUMA_LIST, S.sort.alias) ? S.sort.alias : null);
      if (numAlias) {
        var N = '(\\d[\\d,]*(?:\\.\\d+)?)\\s*(k)?(?:\\s*(?:sar|riyals?|sr))?(?![\\d])';
        var num = function(n, k){ var x = parseFloat(String(n).replace(/,/g, '')); return k ? x * 1000 : x; };
        var addN = function(op, a, b){ S.pend.push({ t: 'num', alias: numAlias, op: op, value: a, values: b != null ? [a, b] : null }); };
        cut('\\bbetween\\s*' + N + '\\s*(?:and|-|to)\\s*' + N, function(m, a, ka, b, kb){ addN('between', num(a, ka), num(b, kb)); });
        cut('(?:\\b(?:above|over|more than|greater than|higher than|exceeding|exceeds|bigger than)|>)\\s*' + N, function(m, a, k){ addN('gt', num(a, k)); });
        cut('(?:\\b(?:at least|minimum of|min of|not less than)|>=)\\s*' + N, function(m, a, k){ addN('gte', num(a, k)); });
        cut(N + '\\s*(?:or more|and above|and up|plus|\\+)', function(m, a, k){ addN('gte', num(a, k)); });
        cut('(?:\\b(?:at most|maximum of|max of|up to|not more than)|<=)\\s*' + N, function(m, a, k){ addN('lte', num(a, k)); });
        cut(N + '\\s*(?:or less|and below|or below)', function(m, a, k){ addN('lte', num(a, k)); });
        cut('(?:\\b(?:below|under|less than|lower than|smaller than)|<)\\s*' + N, function(m, a, k){ addN('lt', num(a, k)); });
        cut('(?:\\b(?:exactly|equal to|equals)|=)\\s*' + N, function(m, a, k){ addN('eq', num(a, k)); });
        cut('\\b(' + NUMA + ')(?![a-z])', function(m){ return S.pend.some(function(p){ return p.t === 'num'; }) ? undefined : false; });
      }

      /* 7) dates */
      var future = EXPIRING.test(q0) || /\b(expir|due|next|coming|upcoming|until)\w*/.test(q0);
      var addD = function(op, a, b){ S.pend.push({ t: 'date', op: op, value: a, values: b != null ? [a, b] : null }); };
      cut('\\b(?:in |within |over |during )?(?:the )?(?:next|coming|upcoming) (\\d+) (day|week|month|year)s?\\b', function(m, n, u){ addD('withinNextDays', +n * UNIT[u]); });
      cut('\\b(?:in|within) (\\d+) (day|week|month)s?\\b', function(m, n, u){ addD('withinNextDays', +n * UNIT[u]); });
      cut('\\b(?:in |within |over |during )?(?:the )?(?:last|past|previous) (\\d+) (day|week|month|year)s?\\b', function(m, n, u){ addD('inLastDays', +n * UNIT[u]); });
      cut('\\b(?:more than|over|older than|at least) (\\d+) (day|week|month)s? (?:ago|old)\\b|\\bolder than (\\d+) (day|week|month)s?\\b', function(m, n, u, n2, u2){ addD('olderThanDays', +(n || n2) * UNIT[u || u2]); });
      cut('\\b(?:overdue|past due)\\b', function(){ addD('overdue'); });
      cut('\\bbetween (' + DATE + ') and (' + DATE + ')', function(m, a, b){ var r1 = toRange(a, future), r2 = toRange(b, future); if (!r1 || !r2) return false; addD('between', r1.from, r2.to); });
      cut('\\bfrom (' + DATE + ') (?:to|until|till|through|-) (' + DATE + ')', function(m, a, b){ var r1 = toRange(a, future), r2 = toRange(b, future); if (!r1 || !r2) return false; addD('between', r1.from, r2.to); });
      cut('\\b(?:before|until|till|prior to|earlier than|no later than|by) (' + DATE + ')', function(m, a){ var r = toRange(a, future); if (!r) return false; addD('before', r.from); });
      cut('\\b(?:after|later than) (' + DATE + ')', function(m, a){ var r = toRange(a, future); if (!r) return false; addD('after', r.to); });
      cut('\\b(?:since|starting|from) (' + DATE + ')', function(m, a){ var r = toRange(a, future); if (!r) return false; addD('onOrAfter', r.from); });
      cut('\\b(?:on |in |during |for |of |within )?(' + DATE + ')(?![a-z0-9])', function(m, a){ var r = toRange(a, future); if (!r) return false; addD('between', r.from, r.to); });

      var isExpiring = EXPIRING.test(q0), isExpired = !isExpiring && EXPIRED.test(q0);
      cut('\\b(?:expiring soon|about to expire|due to expire|running out|will expire|expiring|expires|expire|expired)\\b', function(){});
      cut('\\b(?:soon|upcoming)\\b', function(){ if (!isExpiring) return false; });

      /* 8) entity */
      var kind = ent || (followUp ? last.entity : null);
      var hasD = S.pend.some(function(p){ return p.t === 'date'; });
      if (!kind) {
        if (S.pend.some(function(p){ return p.t === 'num' && !/days/.test(p.alias); }) || (S.stat && S.stat.num && !/days/.test(S.stat.alias))) kind = 'case';
        else if (S.group.some(function(a){ var e = lookup(FA_LIST, a.replace(/^@[a-z]+\|.*$/, 'month')); return e && !e.visa; })) kind = 'case';
        else if (hasD && new RegExp('\\b(?:' + DATEA_LIST.filter(function(x){ return !x[1].visa; }).map(function(x){ return x[0]; }).join('|') + ')(?![a-z])').test(S.q)) kind = 'case';
      }
      var toksAll = tokenize(S.q).map(stem);
      var candToks = function(){
        return toksAll.map(function(t, i){ return { t: t, i: i, used: false }; }).filter(function(o){
          return !STOP[o.t] && !NEG[o.t] && !ALIAS_WORDS[o.t] && !ENTITY_VISA[o.t] && !ENTITY_CASE[o.t] && !/^\d+$/.test(o.t) && o.t.length >= 2;
        });
      };
      if (!kind) {                                       /* decide by which entity's values match more words */
        var tv = candToks(), tc = candToks();
        var nv = matchValues('visa', tv, toksAll, MATCH_FIELDS.visa).length ? tv.filter(function(o){ return o.used; }).length : 0;
        var nc = matchValues('case', tc, toksAll, MATCH_FIELDS['case']).length ? tc.filter(function(o){ return o.used; }).length : 0;
        kind = nc > nv ? 'case' : 'visa';
      }

      /* 9) resolve fields for this entity */
      var where = [], notes = [];
      var groups = [];
      S.group.forEach(function(a){
        var dm = a.match(/^@(month|year)\|(.+)$/);
        if (dm) { var dfx = fieldFor(lookup(DATEA_LIST, dm[2]), kind); if (dfx) { groups.push({ field: dfx, grain: dm[1] }); return; } a = dm[1]; }
        var f = fieldFor(lookup(FA_LIST, a), kind);
        if (!f) { notes.push('I can’t group ' + (kind === 'visa' ? 'visas' : 'candidates') + ' by “' + a + '”.'); return; }
        groups.push(f);
      });
      var dateF = null;
      var pickDate = function(){
        if (dateF) return dateF;
        var found = null;
        S.q.replace(new RegExp('\\b(' + DATEA + ')(?![a-z])', 'g'), function(m, a){ if (found) return m; var f = fieldFor(lookup(DATEA_LIST, a), kind); if (f) found = { f: f, text: m }; return m; });
        if (!found && /\b(expir|qiwa)\w*/.test(q0)) found = { f: kind === 'visa' ? 'expirationDate' : 'visa.candVisaExpiration' };
        if (found && found.text) cut('\\b' + found.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-z])', function(){});
        dateF = found ? found.f : (kind === 'visa' ? 'expirationDate' : (hasField('case', 'requestDate') ? 'requestDate' : 'createdAt'));
        if (!hasField(kind, dateF)) dateF = kind === 'visa' ? 'expirationDate' : 'createdAt';
        return dateF;
      };
      groups = groups.map(function(g){ return typeof g === 'object' ? g : g.charAt(0) === '@' ? { field: pickDate(), grain: g.slice(1) } : { field: g }; });
      if (hasD || groups.some(function(g){ return g.grain; })) { pickDate(); toksAll = tokenize(S.q).map(stem); }

      S.pend.forEach(function(p){
        if (p.t === 'empty' || p.t === 'filled') {
          var f = p.e ? fieldFor(p.e, kind) : fieldFor(lookup(EMP_LIST, p.a), kind);
          if (!f) { if (p.a) notes.push('“' + p.a + '” isn’t a field on ' + (kind === 'visa' ? 'visas' : 'candidates') + '.'); return; }
          where.push({ field: f, op: p.t === 'empty' ? 'empty' : 'notEmpty' });
        } else if (p.t === 'num') {
          var nf = fieldFor(lookup(NUMA_LIST, p.alias), kind);
          if (!nf) { notes.push('“' + p.alias + '” isn’t a number field on ' + (kind === 'visa' ? 'visas' : 'candidates') + '.'); return; }
          where.push({ field: nf, op: p.op, value: p.value, values: p.values });
        } else if (p.t === 'date') {
          where.push({ field: pickDate(), op: p.op, value: p.value, values: p.values });
        }
      });
      /* v7.7.0 — THE SINGLE DATE RULE (same as the CEO Dashboard): an event date
         (arrival, work start, results…) counts as happened only once it's reached.
         "arrived in october" → arrival in October AND on/before today;
         "arriving in october" → after today; "arrivals in october" → all, with a split. */
      var tense = FUT_EVT.test(q0) ? 'future' : PAST_EVT.test(q0) ? 'past' : '';
      if (tense) {
        where.forEach(function(c){ if (OCCUR[c.field] && typeOf(kind, c.field) === 'date') c[tense === 'past' ? 'reached' : 'pending'] = true; });
        var evF = kind === 'case' ? (/\barriv\w*/.test(q0) ? 'dateArrivalKsa' : /\b(joined|started work|work started|started working|start working|starting work)\b/.test(q0) ? 'dateWorkStarted' : null) : null;
        if (evF && hasField('case', evF) && !where.some(function(c){ return c.field === evF; })) {
          var ec = { field: evF, op: 'notEmpty' }; ec[tense === 'past' ? 'reached' : 'pending'] = true; where.push(ec);
        }
        if (where.some(function(c){ return c.reached || c.pending; })) { cut(TENSE_WORDS, function(){}); toksAll = tokenize(S.q).map(stem); }
      }

      var stat = null;
      if (S.stat) {
        var sf = fieldFor(lookup(S.stat.num ? NUMA_LIST : DATEA_LIST, S.stat.alias), kind);
        if (sf) stat = { fn: { average: 'avg', avg: 'avg', mean: 'avg', median: 'median', total: 'sum', sum: 'sum', highest: 'max', maximum: 'max', max: 'max', biggest: 'max', largest: 'max',
          lowest: 'min', minimum: 'min', min: 'min', smallest: 'min' }[S.stat.agg] || S.stat.agg, field: sf };
        else notes.push('I don’t have “' + S.stat.alias + '” on ' + (kind === 'visa' ? 'visas' : 'candidates') + '.');
      }
      var sort = null;
      if (S.sort) {
        var so = S.sort.alias ? (fieldFor(lookup(FA_LIST, S.sort.alias), kind) || fieldFor(lookup(NUMA_LIST, S.sort.alias), kind) || fieldFor(lookup(DATEA_LIST, S.sort.alias), kind))
                              : (S.sort.soon ? (kind === 'visa' ? 'expirationDate' : 'visa.candVisaExpiration') : pickDate());
        if (so && so.charAt(0) !== '@') sort = { field: so, dir: S.sort.dir };
      }
      if (S.nameLike) { var nmf = kind === 'visa' ? 'fullName' : 'name'; if (hasField(kind, nmf)) where.push({ field: nmf, op: 'contains', value: S.nameLike }); else notes.push('These ' + (kind === 'visa' ? 'visas' : 'candidates') + ' have no name field, so “' + S.nameLike + '” wasn’t used.'); }

      /* 10) values */
      var toks = candToks();
      where = where.concat(matchValues(kind, toks, toksAll, MATCH_FIELDS[kind]));
      var crossF = CROSS[kind].filter(function(f){ return ensure().idx[kind === 'visa' ? 'case' : 'visa'][f]; });
      if (crossF.length) where = where.concat(matchValues(kind === 'visa' ? 'case' : 'visa', toks, toksAll, crossF, true, (kind === 'visa' ? 'case' : 'visa') + '.'));

      /* 11) expiring / expired defaults */
      var hasStatus = where.some(function(c){ return c.field === 'statusVisa'; });
      if (isExpiring) {
        if (!where.some(function(c){ return typeOf(kind, c.field) === 'date'; })) where.push({ field: kind === 'visa' ? 'expirationDate' : 'visa.candVisaExpiration', op: 'withinNextDays', value: 30 });
        else where.forEach(function(c){ if (c.op === 'between' && c.values && typeOf(kind, c.field) === 'date' && c.values[0] < ymd(today())) c.values[0] = ymd(today()); });
        if (kind === 'visa' && !hasStatus) where.push({ field: 'statusVisa', op: 'in', values: ['UNUSED', 'ALLOCATED'], auto: true });
      }
      if (isExpired && kind === 'visa' && !hasStatus && !where.some(function(c){ return typeOf('visa', c.field) === 'date'; })) where.push({ field: 'statusVisa', op: 'eq', value: 'EXPIRED' });

      /* 12) what's left over */
      var left = toks.filter(function(o){ return !o.used && o.t.length >= 3 && !/^\d+$/.test(o.t); }).map(function(o){ return o.t; });

      /* 13) operation */
      var op = groups.length ? 'group' : stat ? 'stats' : COUNTW.test(q0) ? 'count' : LISTW.test(q0) || S.sort || S.nameLike ? 'list' : 'count';
      if (groups.length && stat) stat = { fn: stat.fn, field: stat.field };
      var plan = { entity: kind, op: op, where: where, group: groups, agg: groups.length ? stat : null, stat: groups.length ? null : stat,
                   sort: sort, limit: S.limit, top: S.top, notes: notes, left: left };

      /* 14) follow-ups refine the previous question */
      if (followUp) {
        var p = JSON.parse(JSON.stringify(last));
        where.forEach(function(c){
          if (c.op !== 'nin' && c.op !== 'notContains') p.where = p.where.filter(function(o){ return o.field !== c.field || o.auto; });
          if (c.field === 'statusVisa') p.where = p.where.filter(function(o){ return !o.auto; });
          p.where.push(c);
        });
        if (groups.length) { p.group = groups; p.op = 'group'; p.agg = plan.agg; }
        if (stat) { p.stat = stat; p.op = 'stats'; p.group = []; }
        if (/^(list|show)|which ones/.test(q0) || (op === 'list' && !groups.length)) p.op = 'list';
        if (COUNTW.test(q0) && !groups.length) p.op = 'count';
        if (/\binstead\b/.test(q0) && groups.length) p.group = groups;
        if (sort) p.sort = sort; if (S.limit) p.limit = S.limit; if (S.top) p.top = S.top;
        p.notes = notes; p.left = left; p.followUp = true;
        if (p.op === 'group' && !p.group.length) p.op = 'count';
        plan = p;
      }

      /* 15) did we understand anything? */
      var understood = plan.where.length || plan.group.length || plan.stat || plan.sort || (ent && (COUNTW.test(q0) || LISTW.test(q0))) || followUp;
      if (!understood) return null;
      if (!followUp && !where.length && !groups.length && !stat && left.length) return null;
      return plan;
    }

    /* =====================================================================
       executor
       ===================================================================== */
    function indexes(){ var v = {}, c = {}; rowsOf('visa').forEach(function(r){ if (r && r.id) v[r.id] = r; }); rowsOf('case').forEach(function(r){ if (r && r.id) c[r.id] = r; }); return { v: v, c: c }; }
    function resolve(kind, field, I){
      var m = String(field).match(/^(visa|case)\.(.+)$/), other = null, f = field;
      if (m) { if (m[1] !== kind) other = m[1]; f = m[2]; }
      var k2 = other || kind, t = typeOf(k2, f) || 'text';
      var base = function(r){
        if (!r) return null;
        if (k2 === 'visa' && f === 'daysToExpiry') { var e = iso(r.expirationDate); return e ? dayDiff(e, ymd(today())) : null; }
        if (k2 === 'visa' && f === 'candVisaDaysLeft') { var e2 = iso(r.candVisaExpiration || r.candidateVisaExpiration); return e2 ? dayDiff(e2, ymd(today())) : null; }
        return r[f];
      };
      var get = !other ? base : function(r){ return base(other === 'visa' ? I.v[r.linkedVisaId] : I.c[r.linkedRecruitmentCaseId]); };
      return { get: get, type: t };
    }
    function keyer(type){
      return function(x){
        if (x == null || x === '') return null;
        if (type === 'date') return iso(x) || null;
        if (type === 'number') { var n = parseFloat(String(x).replace(/[, ]/g, '')); return isNaN(n) ? null : n; }
        var s = normQ(x); return s || null;
      };
    }
    function compile(kind, c, I){                         /* v7.7.0: + single date rule gate */
      var t = compile0(kind, c, I);
      if (!c.reached && !c.pending) return t;
      var R = resolve(kind, c.field, I), T = ymd(today());
      return function(r){ if (!t(r)) return false; var d = iso(R.get(r)); return !!d && (c.reached ? d < T : d >= T); };   /* v7.7.1: same cut as the calendar (past = before today) */
    }
    function compile0(kind, c, I){
      var R = resolve(kind, c.field, I), K = keyer(R.type), g = R.get, T = ymd(today());
      var V1 = c.value != null ? K(c.value) : null, VS = (c.values || []).map(K);
      var days = function(r){ var e = iso(g(r)); return e ? dayDiff(e, T) : null; };
      var cmp = function(test){ return function(r){ var a = K(g(r)); return a !== null && V1 !== null && test(a, V1); }; };
      switch (c.op) {
        case 'eq': return function(r){ return K(g(r)) === V1; };
        case 'ne': return function(r){ return K(g(r)) !== V1; };
        case 'in': return function(r){ return VS.indexOf(K(g(r))) >= 0; };
        case 'nin': return function(r){ return VS.indexOf(K(g(r))) < 0; };
        case 'contains': return function(r){ return normQ(g(r)).indexOf(normQ(c.value)) >= 0; };
        case 'notContains': return function(r){ return normQ(g(r)).indexOf(normQ(c.value)) < 0; };
        case 'empty': return function(r){ return K(g(r)) === null; };
        case 'notEmpty': return function(r){ return K(g(r)) !== null; };
        case 'gt': case 'after': return cmp(function(a, b){ return a > b; });
        case 'gte': case 'onOrAfter': return cmp(function(a, b){ return a >= b; });
        case 'lt': case 'before': return cmp(function(a, b){ return a < b; });
        case 'lte': case 'onOrBefore': return cmp(function(a, b){ return a <= b; });
        case 'between': return function(r){ var a = K(g(r)); return a !== null && VS[0] != null && VS[1] != null && a >= VS[0] && a <= VS[1]; };
        case 'withinNextDays': return function(r){ var d = days(r); return d !== null && d >= 0 && d <= +c.value; };
        case 'inLastDays': return function(r){ var d = days(r); return d !== null && d <= 0 && d >= -c.value; };
        case 'olderThanDays': return function(r){ var d = days(r); return d !== null && d < -c.value; };
        case 'overdue': return function(r){ var d = days(r); return d !== null && d < 0; };
      }
      return function(){ return true; };
    }
    var OPW = { eq: 'is', ne: 'is not', in: 'is', nin: 'is not', contains: 'contains', notContains: 'doesn’t contain', empty: 'is empty', notEmpty: 'is filled',
      gt: '>', gte: '≥', lt: '<', lte: '≤', before: 'before', after: 'after', onOrBefore: 'on/before', onOrAfter: 'on or after', between: 'between',
      withinNextDays: 'within the next', inLastDays: 'within the last', olderThanDays: 'more than', overdue: 'is past' };
    function describe(p){
      return (p.where || []).map(function(c){
        var v = c.op === 'in' || c.op === 'nin' ? (c.values || []).join(' / ') : c.op === 'between' ? (c.values || []).join(' – ')
              : /Days$/.test(c.op) ? c.value + ' days' + (c.op === 'olderThanDays' ? ' ago' : '') : /^(empty|notEmpty|overdue)$/.test(c.op) ? '' : c.value;
        return label(c.field) + ' ' + OPW[c.op] + (v !== '' && v != null ? ' ' + v : '') + (c.reached ? ' (before today)' : c.pending ? ' (today or later)' : '');
      }).join(' · ') || 'all records';
    }
    function filterRows(p, I){
      var tests = p.where.map(function(c){ return compile(p.entity, c, I); });
      return rowsOf(p.entity).filter(function(r){ return r && tests.every(function(t){ return t(r); }); });
    }
    function aggregate(fn, nums){
      if (!nums.length) return null;
      if (fn === 'sum') return nums.reduce(function(a, b){ return a + b; }, 0);
      if (fn === 'avg') return nums.reduce(function(a, b){ return a + b; }, 0) / nums.length;
      if (fn === 'max') return Math.max.apply(null, nums);
      if (fn === 'min') return Math.min.apply(null, nums);
      if (fn === 'median') { var s = nums.slice().sort(function(a, b){ return a - b; }), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }
      return nums.length;
    }
    var FNW = { avg: 'average', sum: 'total', max: 'highest', min: 'lowest', median: 'median', count: 'count' };

    /* =====================================================================
       rendering
       ===================================================================== */
    var acts = {}, seq = 0;
    function act(txt, fn){ var id = 'l' + (++seq); acts[id] = fn; return '<button class="cc-act" data-c76="' + id + '">' + esc(txt) + '</button>'; }
    chat.addEventListener('click', function(e){ var b = e.target.closest && e.target.closest('button[data-c76]'); if (!b) return; var fn = acts[b.dataset.c76]; if (fn) fn(); });
    var fmt = function(t){ return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); };
    function paint(who, text, html){
      if (!logEl) return;
      var d = document.createElement('div'); d.className = 'cc-m ' + who;
      d.innerHTML = '<div class="cc-b">' + fmt(text) + (html || '') + '</div>';
      logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight;
    }
    function speak(t){
      try {
        if (!('speechSynthesis' in window) || !C.voice || C.voice() !== 'on') return;
        speechSynthesis.cancel();
        speechSynthesis.speak(new SpeechSynthesisUtterance(String(t).replace(/\*\*/g, '').replace(/[✦✓•]/g, '').replace(/·/g, ',').replace(/\n+/g, '. ')));
      } catch (e) {}
    }
    function openRecord(kind, id){
      try { if (C.close) C.close(); } catch (e) {}
      try {
        if (kind === 'visa' && typeof window.openVisaForm === 'function') return window.openVisaForm(id);
        if (kind === 'case' && typeof window._entEditCase === 'function') return window._entEditCase(id);
        if (kind === 'case' && typeof window.openCaseForm === 'function') return window.openCaseForm(id);
      } catch (e) {}
    }
    function csv(name, head, lines){
      var q = function(s){ s = String(s == null ? '' : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      var blob = new Blob(['\ufeff' + [head].concat(lines).map(function(l){ return l.map(q).join(','); }).join('\r\n')], { type: 'text/csv' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name + '_' + ymd(today()) + '.csv';
      document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    }
    var show = function(v){ return v == null || v === '' ? '—' : String(v); };
    function again(p2){ last = p2; var r = run(p2); paint('claire', r.text, r.html); }
    var DEF_COLS = { visa: ['fullName', 'statusVisa', 'client', 'visaCategory', 'expirationDate'], 'case': ['name', 'stage', 'client', 'position', 'nationality'] };

    /* v7.7.0 — "72 already arrived · 25 still to arrive" (matches the Arrivals Calendar) */
    function splitNote(p, I, n){
      var c = (p.where || []).filter(function(x){ return OCCUR[x.field] && typeOf(p.entity, x.field) === 'date'; })[0];
      if (!c) return '';
      var W = OCCUR[c.field], T = ymd(today());
      if (c.reached || c.pending) {
        var all = filterRows(Object.assign({}, p, { where: p.where.map(function(x){ return x === c ? Object.assign({}, x, { reached: false, pending: false }) : x; }) }), I).length;
        if (all === n) return '';
        var R1 = resolve(p.entity, c.field, I), tod = 0;
        filterRows(Object.assign({}, p, { where: p.where.map(function(x){ return x === c ? Object.assign({}, x, { reached: false, pending: false }) : x; }) }), I)
          .forEach(function(r){ if (iso(R1.get(r)) === T) tod++; });
        var later = all - n - (c.reached ? tod : 0);
        return '\n' + all + ' in total' + (c.op === 'notEmpty' ? '' : ' for that period') + ' — '
          + (c.reached ? (tod ? tod + ' today · ' : '') + later + ' later' : (all - n) + ' ' + W[0]) + '.';
      }
      var R = resolve(p.entity, c.field, I), past = 0, now = 0, fut = 0;
      filterRows(p, I).forEach(function(r){ var d = iso(R.get(r)); if (!d) return; if (d < T) past++; else if (d === T) now++; else fut++; });
      return (fut || now) ? '\n' + past + ' ' + W[0] + (now ? ' · ' + now + ' today' : '') + (fut ? ' · ' + fut + ' later' : '') + '.' : '';
    }

    function run(p){
      var I = indexes(), rows = filterRows(p, I), n = rows.length;
      var noun = p.entity === 'visa' ? 'visa' : 'candidate', nouns = noun + 's';
      var filt = '<div class="cc-f">Filter: ' + esc(describe(p)) + ' <span class="cc-ai">✦ CLAIRE</span></div>';
      var extra = (p.notes || []).slice();
      if (p.left && p.left.length) extra.push('I didn’t recognise “' + p.left.join(' ') + '”, so it isn’t in the filter.');
      var foot = extra.length ? '\n' + extra.map(function(x){ return '• ' + x; }).join('\n') : '';
      foot = splitNote(p, I, n) + foot;
      var text, html = '', said;
      var listBtn = function(){ return n ? act('List them', function(){ again(Object.assign({}, p, { op: 'list', group: [], agg: null, stat: null, notes: [], left: [] })); }) : ''; };
      var groupBtns = function(){
        var opts = p.entity === 'visa' ? [['client', 'By client'], ['visaCategory', 'By category'], ['statusVisa', 'By status']] : [['stage', 'By stage'], ['client', 'By client'], ['nationality', 'By nationality']];
        return n > 1 ? opts.filter(function(o){ return hasField(p.entity, o[0]) && !p.where.some(function(c){ return c.field === o[0] && (c.op === 'eq'); }); })
          .map(function(o){ return act(o[1], function(){ again(Object.assign({}, p, { op: 'group', group: [{ field: o[0] }], agg: null, top: null, limit: null, notes: [], left: [] })); }); }).join('') : '';
      };

      if (p.op === 'group') {
        var G = p.group.map(function(g){ return { R: resolve(p.entity, g.field, I), grain: g.grain, field: g.field }; });
        var A = p.agg ? resolve(p.entity, p.agg.field, I) : null, KA = A ? keyer('number') : null;
        var grp = {}, disp = {};
        rows.forEach(function(r){
          var parts = G.map(function(g){
            var raw = g.R.get(r), k = keyer(g.R.type)(raw);
            if (g.R.type === 'date' && k) k = g.grain === 'year' ? k.slice(0, 4) : k.slice(0, 7);
            return { k: k == null ? '∅' : String(k), d: k == null ? '(blank)' : g.R.type === 'date' ? k : String(raw).trim() };
          });
          var key = parts.map(function(x){ return x.k; }).join('¦');
          if (!grp[key]) { grp[key] = { n: 0, nums: [] }; disp[key] = parts.map(function(x){ return x.d; }).join(' · '); }
          grp[key].n++;
          if (A) { var v = KA(A.get(r)); if (v !== null) grp[key].nums.push(v); }
        });
        var metric = function(k){ return A ? aggregate(p.agg.fn, grp[k].nums) : grp[k].n; };
        var isDate = G.length === 1 && G[0].R.type === 'date';
        var keys = Object.keys(grp).filter(function(k){ return metric(k) !== null; });
        var dir = p.top ? p.top.dir : 'desc';
        keys.sort(function(a, b){ return isDate && !p.top ? (a < b ? -1 : 1) : (dir === 'asc' ? metric(a) - metric(b) : metric(b) - metric(a)); });
        var shown = keys.slice(0, p.limit || (p.top && p.top.one ? 5 : 25));
        var mlabel = A ? FNW[p.agg.fn] + ' ' + label(p.agg.field) : nouns;
        var by = G.map(function(g){ return g.grain ? label(g.field) + ' (' + g.grain + ')' : label(g.field); }).join(' and ');
        if (!keys.length) { text = 'No matching ' + nouns + '.'; said = text; }
        else if (p.top && p.top.one) {
          var k0 = shown[0];
          text = '**' + disp[k0] + '** has the ' + (dir === 'asc' ? 'fewest' : 'most') + (A ? ' (' + mlabel + ' ' + fmtN(metric(k0)) + ')' : ' — ' + plural(metric(k0), noun)) + '.';
          said = disp[k0] + ' has the ' + (dir === 'asc' ? 'fewest' : 'most') + ', ' + fmtN(metric(k0)) + '.';
        } else {
          text = (A ? '**' + mlabel + '** by ' + by : '**' + n + '** ' + (n === 1 ? noun : nouns) + ' by ' + by) + ' — ' + plural(keys.length, 'group') + (shown.length < keys.length ? ', showing ' + (p.limit ? 'top ' : 'first ') + shown.length : '') + '.';
          said = shown.slice(0, 3).map(function(k){ return disp[k] + ' ' + fmtN(metric(k)); }).join(', ') + '.';
        }
        html = keys.length ? '<div class="cc-card">' + shown.map(function(k){ return '<div class="cc-row"><span>' + esc(disp[k]) + '</span><b>' + fmtN(metric(k)) + '</b></div>'; }).join('')
          + (shown.length < keys.length ? '<div class="cc-row"><span>…' + (keys.length - shown.length) + ' more (in the CSV)</span></div>' : '') + '</div>' : '';
        html += filt + (keys.length ? act('Export CSV', function(){ csv('CLAIRE_' + nouns + '_by_' + G.map(function(g){ return g.field; }).join('_'), G.map(function(g){ return label(g.field); }).concat([mlabel]),
          keys.map(function(k){ return disp[k].split(' · ').concat([fmtN(metric(k))]); })); }) : '') + listBtn();
      } else if (p.op === 'stats') {
        var S = resolve(p.entity, p.stat.field, I), Ks = keyer(S.type), vals = [];
        rows.forEach(function(r){ var k = Ks(S.get(r)); if (k !== null) vals.push({ k: k, r: r }); });
        var L = label(p.stat.field);
        if (!vals.length) text = said = 'None of the ' + plural(n, 'matching ' + noun) + ' has ' + L + ' filled.';
        else if (S.type === 'number') {
          var nums = vals.map(function(v){ return v.k; }), lo = vals[0], hi = vals[0];
          vals.forEach(function(v){ if (v.k < lo.k) lo = v; if (v.k > hi.k) hi = v; });
          var main = aggregate(p.stat.fn, nums);
          text = 'The ' + FNW[p.stat.fn] + ' ' + L + ' is **' + fmtN(main) + '**' + (p.stat.fn === 'max' ? ' (' + hi.r.id + ')' : p.stat.fn === 'min' ? ' (' + lo.r.id + ')' : '') + ' across ' + plural(vals.length, noun) + '.'
            + '\nAverage ' + fmtN(aggregate('avg', nums)) + ' · total ' + fmtN(aggregate('sum', nums)) + ' · lowest ' + fmtN(lo.k) + ' (' + lo.r.id + ') · highest ' + fmtN(hi.k) + ' (' + hi.r.id + ')';
          said = 'The ' + FNW[p.stat.fn] + ' ' + L + ' is ' + fmtN(main) + '.';
          html = act('Open ' + (p.stat.fn === 'min' ? lo.r.id : hi.r.id), function(){ var x = p.stat.fn === 'min' ? lo : hi; openRecord(p.entity, x.r.id); });
        } else if (S.type === 'date') {
          vals.sort(function(a, b){ return a.k < b.k ? -1 : 1; });
          var f = vals[0], l = vals[vals.length - 1], pick = p.stat.fn === 'max' ? l : f;
          text = 'The ' + (p.stat.fn === 'max' ? 'latest' : 'earliest') + ' ' + L + ' is **' + pick.k + '** (' + pick.r.id + ').\nRange across ' + plural(vals.length, noun) + ': ' + f.k + ' → ' + l.k + '.';
          said = 'The ' + (p.stat.fn === 'max' ? 'latest' : 'earliest') + ' ' + L + ' is ' + pick.k + '.';
          html = act('Open ' + pick.r.id, function(){ openRecord(p.entity, pick.r.id); });
        } else { var d = {}; vals.forEach(function(v){ d[v.k] = 1; }); text = said = L + ': ' + Object.keys(d).length + ' different values across ' + plural(vals.length, noun) + '.'; }
        html = filt + html;
      } else if (p.op === 'list') {
        var cols = DEF_COLS[p.entity].filter(function(f){ return hasField(p.entity, f); });
        p.where.forEach(function(c){ if (cols.indexOf(c.field) < 0 && cols.length < 6 && !/^(eq|in)$/.test(c.op)) cols.push(c.field); });
        if (p.sort && cols.indexOf(p.sort.field) < 0 && cols.length < 6) cols.push(p.sort.field);
        var R = cols.map(function(f){ return resolve(p.entity, f, I); });
        var srt = p.sort || (p.where.some(function(c){ return c.field === 'expirationDate'; }) ? { field: 'expirationDate', dir: 'asc' } : null);
        if (srt) { var SR = resolve(p.entity, srt.field, I), Kr = keyer(SR.type), dd = srt.dir === 'desc' ? -1 : 1;
          rows = rows.slice().sort(function(a, b){ var x = Kr(SR.get(a)), y = Kr(SR.get(b)); if (x === y) return 0; if (x === null) return 1; if (y === null) return -1; return (x < y ? -1 : 1) * dd; }); }
        var lim = Math.min(p.limit || 25, 50);
        text = n ? '**' + n + '** ' + (n === 1 ? noun : nouns) + (n > lim ? ' — showing the first ' + lim : '') + (srt ? ', sorted by ' + label(srt.field) + (srt.dir === 'desc' ? ' (high → low)' : '') : '') + '.' : 'No matching ' + nouns + '.';
        said = n ? plural(n, noun) + '.' : 'No matching ' + nouns + '.';
        html = n ? '<div class="cc-card">' + rows.slice(0, lim).map(function(r){
            return '<div class="cc-row"><span><b>' + esc(r.id) + '</b> ' + esc(R.map(function(x){ var v = x.get(r); return x.type === 'date' ? (iso(v) || show(v)) : show(v); }).join(' · ')) + '</span>' + act('Open', function(){ openRecord(p.entity, r.id); }) + '</div>';
          }).join('') + '</div><div class="cc-f">Columns: ' + esc(cols.map(label).join(' · ')) + '</div>' : '';
        html += filt + (n ? act('Export CSV (' + n + ')', function(){ csv('CLAIRE_' + nouns, ['id'].concat(cols.map(label)), rows.map(function(r){ return [r.id].concat(R.map(function(x){ var v = x.get(r); return x.type === 'date' ? (iso(v) || show(v)) : show(v); })); })); }) : '');
      } else {
        text = '**' + n + '** ' + (n === 1 ? noun + ' matches' : nouns + ' match') + '.';
        said = plural(n, noun) + (n === 1 ? ' matches.' : ' match.');
        if (n > 1) {
          var bf = p.entity === 'visa' ? 'statusVisa' : 'stage';
          if (hasField(p.entity, bf) && !p.where.some(function(c){ return c.field === bf && c.op === 'eq'; })) {
            var cnt = {}; rows.forEach(function(r){ var v = r[bf] || '(blank)'; cnt[v] = (cnt[v] || 0) + 1; });
            text += '\n' + (p.entity === 'visa' ? 'By status: ' : 'Top stages: ') + Object.keys(cnt).sort(function(a, b){ return cnt[b] - cnt[a]; }).slice(0, 5).map(function(k){ return k + ' ' + cnt[k]; }).join(' · ');
          }
        }
        html = filt + listBtn() + groupBtns();
      }
      return { text: text + foot, html: html, speak: said };
    }

    /* =====================================================================
       identity · help · routing
       ===================================================================== */
    var IDENT = /\b(who (?:made|created|built|designed|developed|programmed|coded|trained|owns|invented|wrote) (?:you|claire)|who is your (?:creator|maker|developer|owner|author|father|mother|boss)|whos your (?:creator|maker|developer)|who are you|what are you|what is your name|whats your name|introduce yourself|whos behind you|who is behind you|are you (?:chatgpt|gpt|gemini|google|openai|copilot|bard|claude|an ai|a bot|a robot|human|real)|what (?:ai|model|llm) (?:are you|is this|do you use|powers you)|which (?:ai|model)|where (?:do you come|are you) from|what is claire|whats claire|what does claire stand for)\b|من (?:صنعك|أنشأك|انشأك|برمجك|طورك|صممك)|من (?:انت|أنت)|sino (?:ang )?(?:gumawa|lumikha) (?:sa ?yo|sa iyo)|sino ka\b/;
    function identity(q){
      if (/[\u0600-\u06ff]/.test(q)) return { text: 'أنا **C.L.A.I.R.E.** — من إنشاء **' + CREATOR + '**. أحفظ عمل الفريق، وأراقب البيانات، وأجيب عن أسئلة التأشيرات والمرشحين.' };
      if (/\bsino\b/.test(q)) return { text: 'Ako si **C.L.A.I.R.E.**, gawa ng **' + CREATOR + '**. Ini-save ko ang trabaho ng team, binabantayan ang data, at sumasagot sa mga tanong tungkol sa visa at candidates.' };
      var no = /^are you|\bare you (?:chatgpt|gpt|gemini|google|openai|copilot|bard|claude)/.test(q) ? 'No — ' : '';
      var t = no + 'I’m **C.L.A.I.R.E.** — Centralized Logic And Intelligent Record Executive, created by **' + CREATOR + '**. I save the team’s work, watch the data for problems, and answer questions about visas and candidates.';
      return { text: t, speak: t.replace(/\*\*/g, '') };
    }
    function topOf(kind, f){ var c = {}, b = '', n = 0; rowsOf(kind).forEach(function(r){ var v = r && r[f]; if (v) { c[v] = (c[v] || 0) + 1; if (c[v] > n) { n = c[v]; b = v; } } }); return String(b).toLowerCase(); }
    function help(){
      var cl = topOf('visa', 'client') || 'a client', nat = topOf('case', 'nationality') || 'filipino';
      return { text: 'Ask in your own words — upper or lower case doesn’t matter. Everything is worked out on this computer; nothing is sent anywhere.\n'
        + '• **Find**: “VR-635”, “find juan dela cruz”, “passport P1234567”\n'
        + '• **Count & list**: “how many unused visas for ' + cl + '”, “list ' + nat + ' candidates in medical”\n'
        + '• **Breakdowns**: “unused visas by client”, “candidates per stage and nationality”, “visas by expiry month”\n'
        + '• **Top / most**: “top 5 clients by unused visas”, “which agency has the most candidates”\n'
        + '• **Money**: “average salary of deployed candidates”, “candidates with salary above 2000”, “highest paid by position”\n'
        + '• **Dates**: “visas expiring before march”, “candidates requested last month”, “offers sent in the last 14 days”\n'
        + '• **Missing data**: “allocated visas not linked”, “candidates without passport”, “visas missing MOFA”\n'
        + '• **Exclude**: “unused visas except ' + cl + '”, “candidates not deployed”\n'
        + '• **Follow-ups**: “and for <client>?”, “only females”, “by agency instead”, “list them”\n'
        + '• **Data health**: “any issues?”, “align dates” · **Saving**: “status”, “save now”, “undo”\n'
        + '• **Voice**: 🎤 or Alt+V · “mute” / “talk to me” · **Appearance**: “dark mode” / “light mode”',
        speak: 'Ask me in your own words: counts, lists, breakdowns by client or stage, salaries, dates, missing data, and follow-ups.' };
    }
    var HELP = /^(help|\?|commands?|what can you do|what can i ask(?: you)?|examples?|how do i use you|what do you know)$/;
    var AI_CMD = /^(?:turn )?ai (?:on|off|status|cloud|device|auto)$/;
    var COMMAND = /^(status|save|save now|undo|clear|reset|hi|hello|hey|thanks?|thank you|ok|okay|mute|unmute|voice (?:on|off|auto)|talk to me|be quiet|any issues\??|re-?check|scan)\b|\b(?:dark|light|night|day)[ -]?(?:mode|theme)\b|\b(?:what|which) (?:mode|theme)\b|\b(?:theme|appearance|colou?r scheme)\b|\blights? (?:off|on|out)\b|\b(?:go|switch|turn|change|set|make|use|enable|activate|put)\b.*\b(?:dark|darker|light|lighter|bright|brighter)\b|\b(?:align|fix|correct)\b.*\bdates?\b|\b(?:vr|rc)\s*-?\s*\d{1,7}\b|\bpassport (?:no |number )?[a-z]{0,2}\d{6,}/;
    var ROUTE = new RegExp('\\b(by|per|breakdown|broken down|group(ed)?|split|each|average|avg|mean|median|sum|total|totals|min(imum)?|max(imum)?|highest|lowest|most|least|fewest|earliest|latest|oldest|newest|soonest|'
      + 'before|after|between|since|until|older than|more than|less than|fewer than|at least|at most|above|below|over|under|greater|sort(ed)?|order(ed)?|rank|top \\d+|bottom \\d+|first \\d+|'
      + 'without|except|excluding|not|no|non|missing|empty|blank|whose|where|which have|that have|instead|and for|what about|how about|only|unlinked|linked|unassigned|named|called|'
      + 'salary|salaries|paid|pay|expired|overdue|today|yesterday|tomorrow|this (week|month|year)|last (week|month|year|\\d+)|next (week|month|year|\\d+)|past \\d+|'
      + 'jan(uary)?|feb(ruary)?|march|apr(il)?|june?|july?|aug(ust)?|sept?(ember)?|oct(ober)?|nov(ember)?|dec(ember)?|20\\d\\d|\\d{1,2}/\\d{1,2}/\\d{4})\\b|^(and|only|just|now|also|but|then|list them|show them|which ones)\\b', 'i');
    function aiOn(){ try { return !!C.ai && localStorage.getItem('claire.ai') !== 'off'; } catch (e) { return false; } }

    function safeParse(text, opts){ try { return parse(text, opts); } catch (e) { console.warn('[CLAIRE ' + V + '] parse', e); return null; } }
    function answerPlan(p){ last = p; try { return run(p); } catch (e) { console.warn('[CLAIRE ' + V + '] run', e); return { text: 'Something went wrong on my side (' + e.message + ').' }; } }

    /* typed messages: identity/help/analytic questions first; everything else goes on to v7.4.0 (and v7.5.x) */
    function handle(said){
      var q = normQ(said);
      if (!q || AI_CMD.test(q)) return null;
      if (IDENT.test(q)) return identity(q);
      if (HELP.test(q)) return help();
      if (COMMAND.test(q)) return null;
      var p = safeParse(said);
      if (!ROUTE.test(q)) return p && !p.left.length && !p.notes.length ? answerPlan(p) : null;   /* simple questions: only when every word was understood */
      if (p) return answerPlan(p);
      if (aiOn()) return null;                                       /* let the cloud AI try */
      var rules = ''; try { rules = C.ask(said); } catch (e) {}
      if (rules && rules !== '(not understood)') return { text: 'I couldn’t follow every part of that, so this may be broader than you asked:\n' + rules + '\nType “help” for examples of what I understand.' };
      return { text: 'I didn’t understand that one yet. Type “help” for examples — e.g. “unused visas by client” or “candidates without passport”.' };
    }
    document.addEventListener('submit', function(e){
      var form = e.target; if (!form || !form.closest || !form.closest('#claireChat')) return;
      var input = form.querySelector('input'); var said = input ? input.value.trim() : ''; if (!said) return;
      var r = handle(said); if (!r) return;
      e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      input.value = '';
      paint('me', said); paint('claire', r.text, r.html); speak(r.speak || r.text);
    }, true);

    /* spoken / unparsed questions arrive through CLAIRE.brain */
    var prevBrain = C.brain;
    C.brain = function(text, ctx){
      var q = normQ(text);
      if (IDENT.test(q)) return Promise.resolve(identity(q));
      if (HELP.test(q)) return Promise.resolve(help());
      var p = safeParse(text);
      if (p) return Promise.resolve(answerPlan(p));
      return typeof prevBrain === 'function' ? prevBrain(text, ctx) : Promise.resolve(null);
    };

    C.local = {
      version: V, creator: CREATOR,
      plan: function(q){ return safeParse(q); },
      ask: function(q){ var r = handle(q) || (function(){ var p = safeParse(q); return p ? answerPlan(p) : null; })(); return r ? r.text.replace(/\*\*/g, '') : '(passed to built-in rules: ' + C.ask(q) + ')'; },
      run: function(p){ return answerPlan(p); },
      last: function(){ return last; },
      reset: function(){ last = null; }
    };
    console.log('%c✦ CLAIRE ' + V + ' — local brain ready (no cloud, no cost) · created by ' + CREATOR, 'color:#6B4FA0;font-weight:bold');
  }
  boot();
})();

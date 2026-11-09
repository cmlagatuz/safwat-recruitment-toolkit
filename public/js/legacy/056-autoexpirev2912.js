
(function AutoExpireV2912(){
  'use strict';
  const V = '2.9.12';
  const log = (...a) => console.log('%c[v2.9.12]', 'color:#A23B2E;font-weight:bold', ...a);
  const nowIso = () => new Date().toISOString();

  /* Statuses eligible to auto-expire. Deliberately EXCLUDES
     USED (stamped/delivered) and CANCELLED. */
  const EXPIRABLE = new Set(['UNUSED', 'ALLOCATED']);

  /* Is this expiration date strictly in the past (before today)? */
  function isPast(expirationDate){
    if (!expirationDate) return false;
    const d = new Date(expirationDate);
    if (isNaN(d.getTime())) return false;
    /* Compare against start of today so a visa expiring "today"
       is NOT yet expired — it flips the day AFTER. */
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  }

  /* Sweep the DB once. Returns number of records changed. */
  function sweepOnce(){
    if (!window.DB || !Array.isArray(window.DB.visaRecords)) return 0;
    let changed = 0;
    window.DB.visaRecords.forEach(v => {
      const status = (v.statusVisa || '').toUpperCase();
      /* Skip anything already expired or not eligible */
      if (status === 'EXPIRED') return;
      if (!EXPIRABLE.has(status)) return;
      /* Skip if already auto-expired earlier (defensive) */
      if (v.autoExpired === true) return;
      if (isPast(v.expirationDate)){
        /* Record the prior status once, for auditability/reversibility */
        v.statusBeforeAutoExpire = status;
        v.statusVisa = 'EXPIRED';
        v.autoExpired = true;
        v.autoExpiredAt = nowIso();
        v.updatedAt = nowIso();
        changed++;
      }
    });
    return changed;
  }

  /* Apply the sweep and, if anything changed, persist + refresh. */
  function runSweep(reason){
    const changed = sweepOnce();
    if (changed > 0){
      log('Auto-expired ' + changed + ' visa(s) [' + (reason||'') + ']');
      if (window.dbSave) { try { window.dbSave(); } catch (e) { log('save error: ' + e.message); } }
      if (window.refreshVisaView) { try { window.refreshVisaView(); } catch {} }
      if (window.refreshPipelineView) { try { window.refreshPipelineView(); } catch {} }
      if (window.Audit && window.Audit.push) {
        try { window.Audit.push('system', 'visaRecord', null, null, 'Auto-expired ' + changed + ' visa(s) past expiration date'); } catch {}
      }
    } else {
      log('Sweep [' + (reason||'') + '] — nothing to expire');
    }
    return changed;
  }

  /* Run once per DB load (detect a new DB object by identity). */
  let lastDbRef = null;
  function watchForNewDb(){
    if (window.DB && window.DB !== lastDbRef && Array.isArray(window.DB.visaRecords)){
      lastDbRef = window.DB;
      /* Slight delay so other on-load patches (sponsor sweep, etc.) settle first */
      setTimeout(() => runSweep('db-load'), 1200);
    }
  }
  setInterval(watchForNewDb, 1500);

  /* Light daily re-check while the app stays open, so a visa that
     crosses midnight during a long session gets flipped. Because
     the sweep is idempotent (autoExpired marker), this is cheap
     and never causes flip-flop. */
  setInterval(() => runSweep('daily-recheck'), 24 * 60 * 60 * 1000);

  /* Also expose a manual trigger for the console / admin use. */
  window._entRunAutoExpire = function(){ return runSweep('manual'); };

  /* Kick an initial attempt shortly after load in case the DB is
     already present when this script runs. */
  setTimeout(watchForNewDb, 500);
  setTimeout(() => { if (window.DB) runSweep('initial'); }, 2500);

  console.log('%c⏳ Auto-expire visas v' + V + ' active (forward-only, no fluctuation)', 'color:#A23B2E;font-weight:bold;');
})();

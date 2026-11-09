
/* =========================================================================
   SAFWAT PERFORMANCE GOVERNOR  v6.0.1  — PHASE 1   (REPLACES v6.0.0)
   -------------------------------------------------------------------------
   MUST be the FIRST script in <head>. Changes NO data, NO features.

   v6.0.1 vs v6.0.0 (from live measurement 2026-10-17):
     • DOM changes no longer count as "activity". Several timers edit the
       page themselves (date reformatter, sticky bar, combo stripper…),
       which kept v6.0.0 permanently in full-speed mode.
     • Timers up to 10 s are now gated (v2.8.23 date reformatter = 8 s,
       sticky-bar refresh = 4 s, etc.); idle cadence is 15 s.
   Unchanged: full speed while you use the page (mouse/keys/scroll in the
   last 4 s), full speed during boot until DB loaded + 10 s, hidden tab =
   30 s, debounced search, instant charts. Timers > 10 s untouched.

   KILL SWITCH:  localStorage.setItem('safwatPerf.off','1'); location.reload();
   DIAGNOSTICS:  SafwatPerf.diag()   ·   await SafwatPerf.measure()
   ========================================================================= */
(function SafwatPerfGovernorV601(){
  'use strict';
  var V = '6.0.1';
  var OFF = false; try { OFF = localStorage.getItem('safwatPerf.off') === '1'; } catch (e) {}
  if (OFF) { console.warn('[SafwatPerf] DISABLED by kill switch (safwatPerf.off=1)'); return; }

  var nativeSetInterval = window.setInterval.bind(window);
  var now = function(){ return Date.now(); };
  var FAST_MAX_MS = 10000, IDLE_EVERY_MS = 15000, HIDDEN_EVERY_MS = 30000,
      ACTIVE_WINDOW_MS = 4000, BOOT_GRACE_MS = 10000, BOOT_HARD_MS = 120000;
  var t0 = now(), lastActivity = t0, dbReadyAt = 0;
  var stats = { wrapped: 0, ran: 0, skipped: 0 };

  function inBoot(t){
    if (t - t0 > BOOT_HARD_MS) return false;
    var db = window.DB;
    var ok = !!(db && (Array.isArray(db.visaRecords) || Array.isArray(db.recruitmentCases)));
    if (!ok) return true;
    if (!dbReadyAt) dbReadyAt = t;
    return (t - dbReadyAt) < BOOT_GRACE_MS;
  }
  function shouldRun(state, t){
    if (inBoot(t)) return true;
    if (document.hidden) return (t - state.last) >= HIDDEN_EVERY_MS;
    if ((t - lastActivity) < ACTIVE_WINDOW_MS) return true;
    return (t - state.last) >= Math.max(IDLE_EVERY_MS, state.ms);
  }

  /* ---------- 1) gated setInterval ---------- */
  window.setInterval = function(fn, ms){
    var period = +ms || 0;
    if (typeof fn !== 'function' || period > FAST_MAX_MS) return nativeSetInterval.apply(window, arguments);
    var extra = Array.prototype.slice.call(arguments, 2);
    var state = { last: 0, ms: period };
    stats.wrapped++;
    return nativeSetInterval(function(){
      var t = now();
      if (!shouldRun(state, t)) { stats.skipped++; return; }
      state.last = t; stats.ran++;
      return fn.apply(this, extra);
    }, period);
  };

  /* ---------- activity signals (real user input only) ---------- */
  var mark = function(){ lastActivity = now(); };
  ['pointerdown','pointermove','keydown','wheel','touchstart','input','change','focusin','scroll'].forEach(function(ev){
    window.addEventListener(ev, function(e){ if (e.isTrusted !== false) mark(); }, { capture: true, passive: true });
  });
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) mark(); });

  /* ---------- 2) search debounce ---------- */
  var DEBOUNCE_IDS = { visaSearch:1, pipelineSearch:1, avrSearch:1, entPipeSearch:1, vupbSearch:1, ceoVupbSearch:1, hpSearch:1 };
  var DEBOUNCE_MS = 220, pending = new WeakMap(), PASS = '__safwatPerfPass';
  document.addEventListener('input', function(e){
    var el = e.target;
    if (!el || !el.id || !DEBOUNCE_IDS[el.id] || e[PASS]) return;
    e.stopImmediatePropagation();
    clearTimeout(pending.get(el));
    pending.set(el, setTimeout(function(){
      var ev = new Event('input', { bubbles: true }); ev[PASS] = true;
      el.dispatchEvent(ev);
    }, DEBOUNCE_MS));
  }, true);

  /* ---------- 3) Chart.js animations off ---------- */
  function chartsFast(){ try { if (window.Chart && window.Chart.defaults) window.Chart.defaults.animation = false; } catch (e) {} }
  document.addEventListener('DOMContentLoaded', chartsFast); window.addEventListener('load', chartsFast);

  /* ---------- diagnostics ---------- */
  window.SafwatPerf = {
    version: V,
    diag: function(){
      var t = now();
      return { version: V, boot: inBoot(t), idleFor_s: Math.round((t - lastActivity)/1000),
               fastTimersGated: stats.wrapped, callbacksRun: stats.ran, callbacksSkipped: stats.skipped };
    },
    measure: function(seconds){
      seconds = seconds || 20;
      return new Promise(function(res){
        var lt = [], obs;
        try { obs = new PerformanceObserver(function(l){ l.getEntries().forEach(function(x){ lt.push(x.duration); }); });
              obs.observe({ type: 'longtask', buffered: false }); } catch (e) {}
        console.log('%c[SafwatPerf] measuring idle freezes for '+seconds+' s — do not touch the page…','color:#B98A2E;font-weight:bold');
        setTimeout(function(){
          if (obs) obs.disconnect();
          var r = { longTasks: lt.length, totalBlockedMs: Math.round(lt.reduce(function(a,b){return a+b;},0)),
                    worstMs: Math.round(lt.length ? Math.max.apply(null, lt) : 0),
                    baseline: '6 / 722 ms / 467 ms', v600: '7 / 571 ms / 122 ms' };
          console.table(r); res(r);
        }, seconds * 1000);
      });
    }
  };
  console.log('%c⚡ SAFWAT Performance Governor v'+V+' active — idle-gated timers · debounced search · instant charts','color:#3F6C4D;font-weight:bold');
})();

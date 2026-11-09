
(function GlobalDownloadFixV570(){
  'use strict';
  if(window.__entDownloadFixV570) return; window.__entDownloadFixV570=true;
  var V='5.7.0';

  /* ---------- 1) ensure download anchors are attached during click ---------- */
  try{
    if(window.HTMLAnchorElement && HTMLAnchorElement.prototype && !HTMLAnchorElement.prototype.__entDlPatched){
      var nativeClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function(){
        try{
          var isDownload = this.hasAttribute && this.hasAttribute('download');
          var connected = ('isConnected' in this) ? this.isConnected : !!(this.parentNode && document.body && document.body.contains(this));
          if(isDownload && !connected && document.body){
            var a = this;
            /* keep it out of view while we attach it */
            var prevPos = a.style.position, prevLeft = a.style.left, prevVis = a.style.visibility;
            a.style.position = 'fixed'; a.style.left = '-9999px'; a.style.visibility = 'hidden';
            document.body.appendChild(a);
            nativeClick.call(a);
            setTimeout(function(){
              try{ if(a.parentNode) a.parentNode.removeChild(a); }catch(e){}
              a.style.position = prevPos; a.style.left = prevLeft; a.style.visibility = prevVis;
            }, 0);
            return;
          }
        }catch(e){}
        return nativeClick.call(this);
      };
      HTMLAnchorElement.prototype.__entDlPatched = true;
    }
  }catch(e){ console.warn('[v5.7.0] anchor patch skipped:', e && e.message); }

  /* ---------- 2) defer URL.revokeObjectURL so downloads aren't cancelled ---------- */
  try{
    if(window.URL && typeof URL.revokeObjectURL === 'function' && !URL.__entRevokePatched){
      var nativeRevoke = URL.revokeObjectURL.bind(URL);
      URL.revokeObjectURL = function(url){
        /* defer ~2s: gives the browser time to start the download before the blob URL is freed */
        setTimeout(function(){ try{ nativeRevoke(url); }catch(e){} }, 2000);
      };
      URL.__entRevokePatched = true;
    }
  }catch(e){ console.warn('[v5.7.0] revoke patch skipped:', e && e.message); }

  /* ---------- optional: expose a helper any module can call directly ---------- */
  window._entSafeDownload = function(blob, filename){
    try{
      if(window.navigator && window.navigator.msSaveOrOpenBlob){ window.navigator.msSaveOrOpenBlob(blob, filename); return true; }
    }catch(e){}
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename || 'download';
    a.click();                    /* patched click handles DOM attach + revoke is deferred */
    return true;
  };

  console.log('%c⤓ SAFWAT Global Download fix v'+V+' active — all Export Excel (R-01 & R-02) restored','color:#2E6FA3;font-weight:bold;');
})();

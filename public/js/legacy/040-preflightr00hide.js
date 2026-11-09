
/* Inline preflight — mark html.ent-super-confirmed if we already know
   the user is super admin (from localStorage). This runs synchronously
   BEFORE the body is parsed, so R-00 content won't flash. */
(function preflightR00Hide(){
  try {
    if (localStorage.getItem('safwatEnt.isSuperAdmin') === 'true') {
      document.documentElement.classList.add('ent-super-confirmed');
    }
  } catch {}
})();

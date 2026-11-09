/* Presentation preferences only; shared by the workspace and PROJECT D. */
(function () {
  'use strict';
  const key = 'safwat.workspace.appearance';
  const modes = new Set(['dark', 'black', 'light']);
  let mode = 'dark';
  try { const saved = localStorage.getItem(key); if (modes.has(saved)) mode = saved; } catch (_) {}
  function apply(next) {
    if (!modes.has(next)) return;
    mode = next;
    document.body.dataset.appearance = mode;
    document.body.classList.toggle('ent-dark', mode !== 'light');
    document.querySelectorAll('[data-appearance-picker]').forEach(el => { el.value = mode; });
    const legacy = document.getElementById('entDarkToggle');
    if (legacy) legacy.checked = mode !== 'light';
    try { localStorage.setItem(key, mode); localStorage.setItem('safwatEnt.dark', JSON.stringify(mode !== 'light')); } catch (_) {}
  }
  document.querySelectorAll('[data-appearance-picker]').forEach(el => el.addEventListener('change', () => apply(el.value)));
  // Existing Security checkbox and keyboard shortcut remain compatible.
  new MutationObserver(() => {
    const dark = document.body.classList.contains('ent-dark');
    if (dark !== (mode !== 'light')) apply(dark ? 'dark' : 'light');
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  apply(mode);
})();

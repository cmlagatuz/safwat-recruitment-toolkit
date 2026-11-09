/* Revision-checked persistence; immutable payloads preserve edits made during saves. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SafwatPersistence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const baselines = new WeakMap();
  const clone = value => JSON.parse(JSON.stringify(value));
  function conflict(message) { const error = new Error(message); error.code = 'SAVE_CONFLICT'; return error; }
  function signature(db) {
    if (!db) return null;
    return JSON.stringify(db, function (key, value) { return key === 'savedAt' && this === db.meta ? undefined : value; });
  }
  function remember(db, persisted) { if (db && persisted) baselines.set(db, signature(persisted)); }
  function acceptRemote(current, incoming) {
    if (!current || signature(current) === signature(incoming.data)) return true;
    const baseline = baselines.get(current);
    if (baseline != null && signature(current) === baseline) return true;
    if (typeof window !== 'undefined' && window.Toast) window.Toast.warn('Cloud update waiting', 'Unsaved local work was kept. Export it before reloading to reconcile changes.');
    return false;
  }
  async function commit(ref, { db, expectedVersion, uid, actor, savedAt = new Date().toISOString() }) {
    // Copy before the first await: never capture later local edits as already persisted.
    const outgoing = clone(db);
    outgoing.meta = { ...(outgoing.meta || {}), savedAt };
    const current = (await ref.once('value')).val();
    const version = current && typeof current.version === 'number' ? current.version : 0;
    if (current && expectedVersion == null) throw conflict('No confirmed baseline. Export unsaved work, then reload the cloud database before saving.');
    if (expectedVersion != null && version !== expectedVersion) throw conflict('The cloud database changed. Export unsaved work and reload before reconciling your edits.');
    const next = { ...(current || {}), version: version + 1, savedAt, updatedBy: uid, updatedByName: actor, data: outgoing };
    const result = await ref.transaction(latest => {
      // Firebase may invoke this first with an empty local cache even after a read.
      // Propose the immutable value so the server can compare and retry with its data.
      // applyLocally=false prevents this proposal from appearing in the UI.
      if (latest === null && current) return next;
      const latestVersion = latest && typeof latest.version === 'number' ? latest.version : 0;
      if (latestVersion !== version || (!!latest !== !!current)) return;
      return next;
    }, undefined, false);
    if (!result.committed) throw conflict('Another user saved first. Your save was stopped to protect their changes.');
    remember(db, outgoing);
    return { version: version + 1, data: outgoing, savedAt };
  }
  return { commit, signature, remember, acceptRemote };
});

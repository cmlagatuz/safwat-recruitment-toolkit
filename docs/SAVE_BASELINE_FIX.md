# Cloud load revision fix — 12 November 2026

The “No confirmed baseline” error is generated locally before a write attempt; it is not a Firebase permission-denied message. Previously, cloud loaders discarded the outer envelope version. CLAIRE attempted to recover it by matching the whole loaded object to the server for two seconds. Startup normalization, early edits or loader timing could prevent that match, leaving a valid editor unable to save.

Cloud load paths now register the revision against the loaded object and database path before invoking render/normalization hooks. CLAIRE reads that registered revision. Successful saves advance it against the immutable outgoing snapshot. Unknown offline/import objects cannot borrow another object's revision, and another user's intervening save still triggers the existing conflict protection. No rules or role changes are included.

Validation includes real CLAIRE persistence-section regression with its matching watcher suppressed, normalization before first save, successive saves, object/path isolation, stale-version protection and an emulator editor-save/readback test.

Deployment: download current main and deploy Hosting. Before refreshing, export any unsaved records in the affected tab. After deployment, close old tabs, open the app again, sign in and load cloud data. Create one test record, wait for Saved, then refresh and verify it remains. Do not restore an entire older export over current shared data; reconcile missing edits individually. Data already discarded on refresh cannot be recovered from this code change; inspect any existing local backup/export if needed.

# Repository review — 8 November 2026

## Baseline inspected

Repository: `cmlagatuz/safwat-recruitment-toolkit`, main commit `9500f43cf33153fdd4514db81e47c474c6b06ecd`. README was only a title and “TBA”. The repository contained LICENSE, README, Firebase Hosting configuration and a roughly 1.7 MB / 28,723-line application in `public/index.html`. There were no checked-in rules, package scripts or test workflow. The app contains 103 executable inline script blocks plus CDN dependencies.

This is a substantial existing application, not an empty scaffold. CRUD, imports, report filters, bulk operations, health checks, locks, backups, RBAC UI and several generations of CLAIRE are already present. Adding duplicate versions of these features would increase the existing layering problem.

## Delivered in this change

- Separate R-03 Operations workspace with client summaries, actionable follow-up/expiry queues, configurable thresholds, multiword search, client/type filters, 50-row pagination, read-only detail dialog, CSV exports and printable client summaries.
- Pure calculations with explicit definitions, current-state reporting and no database mutation or additional cloud reads/writes.
- Fix for the shared date helper that added 12 hours to afternoon Date values, advancing them to the next day; invalid calendar dates now return null.
- Complete HTML escaping in the shared helper (previously only `<` was escaped).
- Safer shared CSV output with formula neutralization, carriage-return quoting and Arabic-friendly UTF-8 BOM. This does not yet replace every legacy local CSV function.
- JSON loader validation and retention of extension fields (previous loader silently replaced malformed/missing arrays and dropped top-level extensions).
- Node regression tests, JavaScript syntax/asset checks, optional isolated Playwright smoke test and CI.
- Operating documentation and a prioritized continuation plan.

## Material unresolved findings

| Priority | Evidence in current source | Consequence / next work |
| --- | --- | --- |
| Critical to verify | Early auth listener creates an initial admin from the browser, and catches RBAC failures while revealing the app. UI roles are also mirrored to localStorage. | The real access boundary must be RTDB rules. Obtain deployed rules, test self-promotion, disabled/unverified users and cross-role reads/writes before modifying auth. Client UI alone cannot establish whether access is secure. |
| High | CLAIRE `cloudWrite()` reads the version, then uses `update()` or `set()` separately. When its snapshot/version does not match it replaces the whole database. | Two writers can race; a stale full write can overwrite another user's changes. Replace with server-enforced revisions/transactions and stable record keys, with conflict and retry tests. Rules/schema review comes first. |
| High | `takeSnap(db, version)` runs after awaited writes while `db` is a mutable shared object. | Edits made during an in-flight save may be included in the baseline without being included in that write. Capture an immutable outgoing snapshot and test deferred-write edits as part of persistence redesign. |
| High | Multiple generations override `dbSave`, edit forms, navigation, roles and renderers; bulk actions also mutate arrays directly. | Enforcement and behavior depend on load order. Establish one authorization/action/persistence path before extending write-heavy features. |
| Medium | Existing health checks and CLAIRE detect current-record issues, but no normalized job-order entity/stage-event ledger is established in the inspected core model. | Do not call candidate totals fulfillment or claim current statuses are monthly closure events. Add job orders and timestamped stage history in a versioned migration. |
| Medium | Several unpinned CDN URLs and independent CSV serializers remain. | Pin/vendor reviewed dependencies and consolidate export escaping. Do not add a strict CSP until inline handlers/scripts are migrated and tested. |
| Medium | Minimal documentation, no existing automated regression suite, monolithic source. | Extract one module at a time while testing behavior. Preserve specialized operational tools instead of rewriting blindly. |

## Next implementation sequence

1. Review actual RTDB rules and establish an isolated emulator/staging database. Add role/disabled/email-verification and self-escalation rule tests.
2. Fix save concurrency, in-flight edits, failure reporting and reconnect handling. Use stable keyed records, conflict-safe revisions and acknowledgments; plan migration/rollback with backups.
3. Consolidate mutations under one service with enforceable roles, lock ownership and append-only audit history. Make bulk operations validate, preview and report failures accurately.
4. Introduce job orders (requested quantity, client, position, nationality, agency, target date, owner) linked to candidates, then measure actual fulfillment and vacancy age.
5. Add stage-event history and assigned follow-up tasks; build defensible period reports for client activities and closures.
6. Add configurable document/licensing checklists by workflow, with explicitly maintained requirements rather than hardcoded legal assumptions.
7. Consolidate imports/exports, report templates, frontend dependencies and the remaining legacy modules.

## Validation and limits

Passed locally: eight Node regression groups and syntax parsing of all 103 inline scripts plus new modules/local asset checks. Unit coverage includes leap dates, day-first dates, afternoon dates, invalid database structures, extension retention, spreadsheet formula input, Arabic CSV, classification, expiry boundaries, queue ordering, multiword filters and immutability.

The optional browser test uses real app markup/styles/navigation with legacy scripts removed, synthetic data and all network traffic blocked. It covers navigation, search, pagination, details, client filters, CSV download and sign-out clearing. It was prepared but **could not run in this execution environment**: Chromium startup was denied a local socket by the runtime. No visual/browser pass is claimed. Run it in a normal development environment, then perform full application regression in staging.

Production authentication, RTDB authorization, save concurrency, legacy imports/export formats and live Firebase behavior have not been verified. This is a reviewable first upgrade, not a claim that the full modernization or security review is complete. No live database or hosting deployment was changed.

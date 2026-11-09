# RTDB hardening and save integrity — 9 November 2026

## Confirmed issues in the supplied rules

- `disabled !== true` was sufficient to read databases: accounts without an approved user record passed this check. Anonymous users were explicitly allowed as well.
- Admin-only expressions checked role but usually not disabled status or verified email.
- Any authenticated account could overwrite the CEO devices registry; the password hash was readable by all authenticated accounts.
- Lock writes permitted `newData.val() === null` regardless of ownership. Non-owner users could delete a lock. New locks did not require a real owner or bounded expiry.
- Presence records had neither ownership validation nor a UID in the existing client payload.
- Client bootstrap allowed first-user admin creation. UI rescue paths could reveal the application without approved membership/verified email.
- Cloud writes had no server revision requirement. A version mismatch triggered a whole-database overwrite in the main save path.

Firebase read/write grants cascade; a permissive parent cannot be restricted by a child. Validation is skipped for deletions, so delete authorization must be in `.write`. Reference: https://firebase.google.com/docs/database/security and https://firebase.google.com/docs/database/security/rules-conditions.

## Replacement behavior

`database.rules.json` defaults to deny. Recruitment database access requires a verified, non-anonymous, approved, enabled viewer/editor/admin. Only editors/admins write. Every save must retain the envelope, identify the authenticated author and increment the current version exactly once. Browser deletion of the whole database is denied.

Only enabled verified admins manage roles and CEO password/device settings. Users can read their own account even before email verification, and can update only harmless own-profile fields. Pending accounts may submit an own-UID approval request; they cannot approve themselves. Browser bootstrap is removed. An admin cannot delete, disable or demote their own account (another active admin can manage it).

Presence includes an owner UID. Peer users cannot alter/delete another user's session. Writers own their locks; an expired lock may be acquired, fresh locks cannot be stolen/deleted by a peer, and expiry cannot be arbitrarily extended. Admin override remains available.

The two anonymous dashboard loaders now require normal sign-in. This intentionally removes anonymous CEO-dashboard access. Existing approved verified viewers can view recruitment data; CEO configuration/device administration remains admin-only. This ruleset does not create client-by-client access segregation: approved users still read the shared database.

The main CLAIRE save path now copies the outgoing data before any await and uses a revision-checked transaction with local speculative events disabled. Concurrent writers cannot both commit the same revision. A stale or unconfirmed baseline causes a visible conflict, not a full-write fallback. Known remote replacement paths preserve dirty local data. Direct/manual sync entry points delegate to CLAIRE once initialized. Transactions currently send a complete snapshot, trading bandwidth for integrity; stable keyed records and efficient conflict-aware deltas remain future work.

## Required staging checks before production

1. Back up the current rules and export the current database privately using Firebase Console. Do not commit production records.
2. Confirm at least one existing `safwat/users/{uid}` is an admin, is not disabled, and belongs to an email-verified Firebase Authentication user. Seed an initial administrator through Console/Admin SDK only if needed.
3. Use a separate staging Firebase project. Copy application code and configure that project in `public/js/legacy/002-initfirebaseearly.js` (also inspect any legacy configuration defaults). Do not use production credentials/data for tests.
4. Run `npm ci --prefix tests/rules --ignore-scripts`, then `tests/rules/node_modules/.bin/firebase emulators:exec --project demo-safwat-security --only database 'npm --prefix tests/rules test'`. Tests explicitly require the emulator; they never target production.
5. Deploy app AND rules to staging. Test sign-in, verification/token refresh, account approval/rejection, viewer/editor/admin permissions, disabled users, CEO dashboard access, record locks and exports.
6. Test two browsers saving simultaneously, editing while a save is pending, and receiving a remote update while local changes are unsaved. Verify conflict messages and export/reload recovery. Also exercise manual sync, first database creation, cache/offline recovery and backup restore. Legacy layers still require full browser regression.
7. Clean obsolete presence records without UIDs using an admin account/Console. They cannot be edited by ordinary users under the new rules.
8. For production, schedule a brief editing pause. Publish the matching app and database rules together, then have all users close old tabs and sign in again. Do not paste these rules over the live system independently of the app changes: old presence payloads, anonymous dashboards and legacy writers will be rejected. A code merge alone does not deploy Firebase.

## Recovery and limitations

On a save conflict, export unsaved work before reloading; compare and reapply only intended edits. Never resolve a conflict by blindly importing the old whole snapshot over newer cloud data. Database rules protect the revision and role boundary, but editors remain trusted to edit the shared data. Audit append-only enforcement, per-client scopes and a full keyed-record migration are not delivered here.

The local JavaScript suite and syntax checks pass. The emulator started locally, but SDK tests stalled in this runtime; An emulator job is configured for GitHub Actions. Check its completed result on the PR before rollout. Chromium startup is also blocked locally. Production rules/data have not been changed; keep the PR draft until emulator CI and staging browser checks pass.

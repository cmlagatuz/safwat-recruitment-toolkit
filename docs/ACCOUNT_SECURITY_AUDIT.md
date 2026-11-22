# New-account security audit — 22 November 2026

## Scope and threat model

Audit Firebase email/password sign-up, email verification, pending approval, admin role assignment, disabled/rejected accounts, authorization read failures, session changes, and RTDB rule enforcement. Treat a Firebase-authenticated identity as **unauthorized** until the server-confirmed `safwat/users/{uid}` record has an approved role, is enabled, and the Firebase email verification token has been refreshed. Browser UI hiding is defense-in-depth; Firebase rules are the data boundary.

No live user accounts, production recruitment records or passwords were accessed or modified in this source-level audit. The checked-in rules were exercised in the isolated emulator test suite; the **actual deployed RTDB rules and real-account login were not independently verified**. Never infer deployed rules from this repository.

## Findings and remediations

| Risk | Before | Corrected implementation |
| --- | --- | --- |
| Conflicting access handlers | v2.4.4 listener, v2.4.3 timed emergency rescue, v2.6 approval listener could independently reveal or hide the app | Old auth listener and emergency unlock are retired; v2.6 is the only application unlock decision |
| Premature success | Firebase password acceptance triggered a `Signed in` toast and loaded the last browser's cached role | Credentials trigger only the access check; the server record determines the role and the welcome message |
| Database errors treated as missing users | Both account reads swallowed errors; failed reads could be treated as absence and lead to a failed pending-request write or a wrong review message | Fail closed with a dedicated retry/error screen; an approval request is created only after both absence checks succeed |
| Missing verification/disabled dialogs | Old handlers referenced HTML elements that did not exist | Real verification/disabled/status/error screens and resend, recheck, retry, sign-out actions |
| Stale async callbacks and revocation | Concurrent listeners and delayed promises could reopen the UI | Monotonic request epoch; sign-out invalidates outstanding reads; live server role/disabled updates can close the workspace |
| Pending onboarding | Unverified new users could be left without a clear verification path | Create self-owned pending request, send verification email, show verification until confirmed, then wait for administrator approval |
| Cached recruitment UI | The workspace markup was visible under asynchronous auth overlays | Hide workspace with CSS until authorized; RTDB rules remain mandatory |

## Authorization matrix (expected)

| Account state | Visible state | Recruitment data |
| --- | --- | --- |
| Signed out | Sign in | Denied |
| Newly created, unverified | Verify email; pending request recorded | Denied |
| Verified, pending | Awaiting administrator approval | Denied |
| Rejected | Rejection explanation | Denied |
| Approved but unverified | Verify email | Denied |
| Approved, verified viewer | Workspace, read-only | Read allowed |
| Approved, verified editor/admin | Workspace, authorized tools | Scoped to server rule role |
| Disabled | Disabled notice | Denied |
| Invalid role / lookup outage | Access error with retry | Denied |
| Revoked mid-session | Workspace closes | Subsequent server access denied by rules |

## Evidence / required rollout checks

- `tests/account-access.test.js`: isolated state-machine tests for new-user verification, pending approval, rejected/disabled/invalid roles, failure-and-retry, sign-out race, live revocation and markup/legacy unlock regressions.
- `tests/rules/rules.test.mjs`: Firebase emulator probes for unverified pending users, unapproved database access and unauthorized role changes, in addition to the existing full rules suite.
- Standard CI: `npm run check`, `TZ=Asia/Riyadh npm test`, RTDB emulator, Chromium smoke tests.
- **Before claiming complete production security verification:** confirm the live RTDB rule revision through an authorized Firebase administrator and run authenticated staging tests with disposable accounts for creation, email delivery/verification, role approval, user-disabled status, admin queue, signed-out behavior, and two-user session switching. See [SECURITY_ROLLOUT.md](SECURITY_ROLLOUT.md).
- Rules have **not** been modified in this patch. Hosting auto-deployment publishes only the app; it must not be represented as a rules rollout. If the live RTDB is running the older permissive rules, this patch **does not** fix that server-side vulnerability; perform the coordinated app/rules rollout separately.

## Future hardening

Evaluate rate limiting/account request abuse mitigation, enforced App Check, multi-factor authentication for administrators, audit logging for role grants, and user-specific client/data segmentation. Replacing localStorage role mirroring and legacy client-side super-admin heuristics throughout the application is a separate refactor; no local UI role should ever be trusted as an authorization boundary.

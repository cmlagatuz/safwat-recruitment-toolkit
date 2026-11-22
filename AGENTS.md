# Safwat Recruitment Toolkit — project instructions

A request in the Safwat Toolkit project to check, fix, enhance, or upgrade “the toolkit” refers to [cmlagatuz/safwat-recruitment-toolkit](https://github.com/cmlagatuz/safwat-recruitment-toolkit). The [live toolkit](https://safwat-recruitment-toolkit.web.app/) runs on Firebase Hosting. Its users manage recruitment cases, visa inventory, documents and executive reports.

## Start each request

1. Read this file on the current default branch and check the relevant code, recent changes and open pull requests. Look for an existing fix before starting another. If the report concerns the live site, establish which behavior is deployed.
2. Use [README.md](README.md) for setup and checks, the [module map](docs/MODULE_MAP.md) to locate code, and the [navigation map](docs/NAVIGATION.md) to connect a screen label to its panel. Treat historical review notes as leads and verify them against the current implementation.
3. For a check, investigate and report what you verified. For a fix or enhancement, implement the requested behavior and test it through the entry point staff use. Reuse the repository and project context without asking the owner to repeat them. Ask for the smallest missing detail if it affects the outcome.

## Make and verify changes

- Effective 2026-11-22, GitHub `main` is the source of truth. Commit and verify each change in GitHub first. The `Toolkit checks and Firebase Hosting release` GitHub Action runs static/unit, Firebase emulator and Chromium checks, then automatically deploys the tested `main` revision from `public/` to production Firebase Hosting. Report the commit, CI run, and observed live verification. Do not make independent Hosting-only edits in Firebase Console. First-time automation requires the GitHub Actions Firebase service-account secret described in [deployment instructions](docs/DEPLOYMENT.md); if absent, report deployment as blocked, never as live. Changes to RTDB security rules require the separate coordinated authenticated staging/production procedure in [security rollout](docs/SECURITY_ROLLOUT.md), not Hosting-only auto-deployment.
- Preserve existing candidate and visa records, links, import/export formats, Arabic text and Asia/Riyadh date handling. Use synthetic records for examples and tests. Keep personal information, credentials and live database exports out of GitHub.
- The browser loads classic scripts and CSS in a defined order from `public/index.html`. Trace all handlers for the affected screen, including later legacy patches. For intentional edits to extracted assets, review the diff, update the corresponding entry in `docs/asset-manifest.json` and cover the changed behavior.
- For code changes, run `npm run check` and `TZ=Asia/Riyadh npm test` with Node 20 or later. For UI changes exercise the affected workflow in a browser. For authentication or database-rule changes use the Firebase emulator checks in `.github/workflows/checks.yml` and follow the [security rollout guide](docs/SECURITY_ROLLOUT.md) for authenticated staging verification.
- Report the user-visible result, the checks actually run, the branch or PR, and whether the change is live. Distinguish source review, synthetic testing and observed production behavior. Treat a code-fix request and authorization to change a real account's access as separate decisions.

## Project notes

Keep this section short. After work that changes a lasting decision or resolves an open problem, update its entry with the date, status and relevant commit or PR. Record the remaining verification step so a later session can resume without repeating completed work.

### 2026-11-22 — GitHub-first Firebase Hosting auto-release (active)

- GitHub `main` change `bd19c617cbdf79edb9e663a76a30c6ea5c4a3e59` enabled a gated Firebase Hosting deployment in `.github/workflows/checks.yml`. The actual [GitHub Actions run 45017624145](https://github.com/cmlagatuz/safwat-recruitment-toolkit/actions/runs/45017624145) passed all three tests, authenticated to Firebase, published to the `safwat-recruitment-toolkit` live Hosting channel, and confirmed the fetched live `index.html` matched the deployed commit.
- Firebase deployment credentials are configured and functional in GitHub Actions; do not disclose or commit them. All subsequent Hosting edits must be committed to GitHub `main` and pass the same CI gates before automatic deployment.
- Database rules are **not** included in automatic Hosting deployment; use `docs/SECURITY_ROLLOUT.md` for an explicitly staged paired app/rules change. Next step for ordinary changes: verify the resulting CI run and live site, not reconfigure the already-working deploy connection.

### 2026-11-22 — New-account security remediation (PR #2; GitHub checks required)

- A 22 November audit found competing legacy auth listeners (including a timed emergency unlock), premature success notifications, cached role reuse, absent verification/disabled dialogs, and Firebase lookup errors interpreted as an account not existing.
- Source corrections in [PR #2](https://github.com/cmlagatuz/safwat-recruitment-toolkit/pull/2) consolidate the access gate in `015-accountapprovalv260.js`, retire `003` and `009` independent reveals, hide the application until server-role/email verification, display reliable pending/rejected/disabled/verification/error/retry screens, and close the UI on live role revocation. A new Firebase identity requests administrator approval; it never self-grants a staff role.
- New synthetic state-machine tests, Firebase rules emulator cases, and isolated real-Chromium sign-up/approval screen tests guard those behaviors. See [full security findings](docs/ACCOUNT_SECURITY_AUDIT.md).
- The change does **not** change `database.rules.json`; Firebase Hosting auto-deployment alone does not deploy the checked-in RTDB rules. Production server-rule parity, real disposable-account email delivery/approval tests, and full authenticated staging acceptance remain required before claiming comprehensive production account security. Follow [SECURITY_ROLLOUT.md](docs/SECURITY_ROLLOUT.md).
- Next step: merge only after complete GitHub checks pass, verify auto-deploy and live Hosting assets; independently verify actual deployed RTDB rules and hosted sign-in with authorized staging/test accounts. Do not alter any real user's role without separate authorization.

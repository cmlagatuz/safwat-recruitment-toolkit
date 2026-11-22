# Safwat Recruitment Toolkit — project instructions

A request in the Safwat Toolkit project to check, fix, enhance, or upgrade “the toolkit” refers to [cmlagatuz/safwat-recruitment-toolkit](https://github.com/cmlagatuz/safwat-recruitment-toolkit). The [live toolkit](https://safwat-recruitment-toolkit.web.app/) runs on Firebase Hosting. Its users manage recruitment cases, visa inventory, documents and executive reports.

## Start each request

1. Read this file on the current default branch and check the relevant code, recent changes and open pull requests. Look for an existing fix before starting another. If the report concerns the live site, establish which behavior is deployed.
2. Use [README.md](README.md) for setup and checks, the [module map](docs/MODULE_MAP.md) to locate code, and the [navigation map](docs/NAVIGATION.md) to connect a screen label to its panel. Treat historical review notes as leads and verify them against the current implementation.
3. For a check, investigate and report what you verified. For a fix or enhancement, implement the requested behavior and test it through the entry point staff use. Reuse the repository and project context without asking the owner to repeat them. Ask for the smallest missing detail if it affects the outcome.

## Make and verify changes

- Effective 2026-11-22, the owner authorizes direct releases. For each requested system update, commit the tested changes to `main` in this repository, deploy the affected components from that revision to the production Firebase project for the live toolkit, and verify the result. Include the commit link and production verification in the handoff. For Hosting updates, deploy `public/` using the repository’s `firebase.json`.
- Preserve existing candidate and visa records, links, import/export formats, Arabic text and Asia/Riyadh date handling. Use synthetic records for examples and tests. Keep personal information, credentials and live database exports out of GitHub.
- The browser loads classic scripts and CSS in a defined order from `public/index.html`. Trace all handlers for the affected screen, including later legacy patches. For intentional edits to extracted assets, review the diff, update the corresponding entry in `docs/asset-manifest.json` and cover the changed behavior.
- For code changes, run `npm run check` and `TZ=Asia/Riyadh npm test` with Node 20 or later. For UI changes exercise the affected workflow in a browser. For authentication or database-rule changes use the Firebase emulator checks in `.github/workflows/checks.yml` and follow the [security rollout guide](docs/SECURITY_ROLLOUT.md) for authenticated staging verification.
- Report the user-visible result, the checks actually run, the branch or PR, and whether the change is live. Distinguish source review, synthetic testing and observed production behavior. Treat a code-fix request and authorization to change a real account's access as separate decisions.

## Project notes

Keep this section short. After work that changes a lasting decision or resolves an open problem, update its entry with the date, status and relevant commit or PR. Record the remaining verification step so a later session can resume without repeating completed work.

### 2026-11-22 — Login followed by “account under review” (open)

The owner reported that some new users cannot enter the toolkit, and some briefly see a successful sign-in before the review popup. A comparison on this date confirmed that the live site served the inspected login and approval scripts. Individual account status and an end-to-end login were not verified.

- `public/js/legacy/008-enterprisev22.js` shows “Signed in” as soon as Firebase Authentication accepts the user. The listener in `015-accountapprovalv260.js` then checks the approved user record and pending request. A genuinely pending user can therefore see both messages in sequence.
- The approval handler also catches failed database reads and continues as though the record were absent. A lookup error alone cannot establish that an account is awaiting review. `003-document-addeventlistener-domcontentloaded-function.js` also manages verification and screen visibility.
- For a future login fix, verify the screen for approved and email-verified, pending, unverified, rejected and disabled accounts, plus a failed lookup. Test a slow response and approval while the user is waiting. Approved users should enter, pending users should see the review message, and an unavailable lookup should offer a retry. Preserve admin approval and email verification.

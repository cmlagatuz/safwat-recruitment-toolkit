# Safwat Recruitment Toolkit

Browser-based recruitment, visa reporting and document tools for Safwat. Firebase Authentication and Realtime Database provide the existing shared workspace; file tools use browser file access.

## Modules

| Module | Purpose |
| --- | --- |
| R-00 Database | Import, administration, data health and backups |
| R-01 Visa Report | Visa inventory, candidate assignments, filters and exports |
| R-02 Recruitment Pipeline | Candidate progress, salary details and bulk editing |
| **R-03 Operations (new)** | Client delivery snapshots, follow-up queue, visa deadlines and CSV summaries |
| **R-04 Toolkit Guide (new)** | Searchable directory of tools visible to your account |
| F-01 | Offer-letter generation |
| F-02–F-06 | Extract, sort, rename, create folders and list files |
| F-07–F-09 | PDF merging, conversion workflow and Word-file cleanup |
| CLAIRE | Existing assistant, local query engine and save-status interface |

## Run locally

From the repository root:

```sh
npm start
```

Open `http://localhost:8080`. This serves `public/` using Python 3. No build or runtime npm installation is required. The application still loads its existing Firebase/document/chart libraries from CDNs. Use desktop Chrome or Edge for File System Access features. Do not open `index.html` directly as a file; local assets use root-relative URLs.

**The extracted legacy scripts contain production Firebase project configuration** (start with `public/js/legacy/002-initfirebaseearly.js` and inspect other legacy defaults). For development with real app scripts, use a separate Firebase project and test accounts/data. Firebase web configuration is not an authorization boundary; deployed RTDB rules enforce access. The isolated browser smoke test blocks all network access and does not connect to Firebase.

## Operations workflow

1. Sign in and load the existing database.
2. Select **R-03 Operations** under Reports & Dashboards.
3. Set a client, follow-up threshold (default 14 days) and expiry horizon (default 30 days), then refresh.
4. Review client totals and the priority-sorted action queue. Search supports multiple words across name, ID, passport, client, agency, status and reason.
5. Open read-only record details, export the filtered queue, export the client summary, or print the client summary. Edit records through the existing Visa Report/Pipeline screens.

The workspace uses the already-loaded database and performs **no writes**. Refresh when returning to the tab or after edits/cloud updates. It clears derived records when the existing authenticated-session class is removed.

### Metric definitions

- **Active:** all candidate stages except recognized deployed and closed stages. Unknown/custom stages remain active.
- **Deployed:** DEPLOYED, ACTIVE, TRANSFERRED or DEPLOYED APPLICANTS.
- **Closed:** UNFIT, WITHDRAWN/BACKOUT, WITHDRAWN, WITHDRAWED APPLICATION, BACKOUT, REJECTED, CANCELLED/CANCELED, TERMINATED, AWOL and END OF SERVICE.
- **Deployment rate:** deployed candidates divided by all candidates in the selected client. This is not job-order fulfillment.
- **Follow-up:** an active candidate whose most recent valid update/creation/request date is at least the selected number of calendar days old. This is not time in stage.
- **Expiry alerts:** recorded Qiwa and candidate-entry expiry dates are evaluated separately. Qiwa alerts exclude used slots; entry alerts exclude records with a valid arrival date. Cancelled/expired visa records are excluded. Expired dates and dates exactly on the horizon are included. Two alerts can refer to one visa.
- Analysis uses the current **Asia/Riyadh** date. No legal validity duration is inferred.
- Summaries describe current records, not historical period activity. No candidate counts are presented as requested vacancies.

## Files and checks

- `public/index.html`: HTML shell and ordered asset references.
- `public/js/legacy/`: 103 extracted classic-script blocks, in original execution order.
- `public/css/legacy/`: 67 extracted stylesheets, in original cascade order.
- `public/js/toolkit-guide.js`: searchable in-app navigation directory.
- [Module map](docs/MODULE_MAP.md), [navigation map](docs/NAVIGATION.md) and [asset manifest](docs/asset-manifest.json): code ownership, tool panels and extraction checksums.
- `public/js/toolkit-core.js`: tested date, CSV, escaping, database validation and operations calculations.
- `public/js/operations.js`, `public/css/operations.css`: new UI, kept separate from the legacy file.
- `tests/core.test.js`: dependency-free regression tests.
- `tests/browser-smoke.cjs`: optional isolated browser integration test using Playwright.
- `docs/REVIEW.md`: findings, limitations and the next implementation priorities.

Node.js 20+:

```sh
npm run check
npm test
```

The check recursively parses all application JavaScript files and checks local asset paths. Structural tests verify the extracted blocks against their original checksums and order, and ensure every static tool tab has a panel. GitHub Actions runs these checks in the Riyadh timezone. To run the optional browser test, install Playwright in your development environment and its Chromium browser, then run `node tests/browser-smoke.cjs`. `CHROMIUM_PATH` can point to an existing compatible Chromium executable.

## Data compatibility and deployment

The shared JSON loader now rejects missing record arrays, missing/duplicate IDs and invalid metadata instead of silently treating corrupt input as an empty database. It preserves unknown top-level extension fields. Back up existing data before importing. Date helpers accept Date objects, ISO dates/timestamps and day-first numeric dates; unsupported date strings return null for review rather than locale guessing.

The common CSV helper and new Operations exports neutralize spreadsheet formulas, support quoted/newline values and include a UTF-8 BOM for Arabic names. Some legacy exporters have independent serializers and still need consolidation.

Firebase Hosting continues to serve `public/` using `firebase.json`; publish the **whole directory**, including `js/` and `css/`. Review on a staging Firebase project before deploying. This branch includes replacement RTDB rules and matching application changes; release them together after staging validation. No live rules, production data, existing roles or hosting settings have been changed during development.

## RTDB security and rollout

The deployed rules were supplied and reviewed on 9 November 2026. The replacement rules and compatibility changes are included in this draft. Follow [SECURITY_ROLLOUT.md](docs/SECURITY_ROLLOUT.md) for emulator tests and coordinated staging/deployment. No production secrets or data are needed for testing.

## Security update (9 November 2026)

The supplied production rules have now been reviewed. The draft includes `database.rules.json`, emulator tests, approved-account dashboard access, owner-checked presence/locks, and revision-checked saves that preserve in-flight edits. Read [the rollout guide](docs/SECURITY_ROLLOUT.md) before deploying: the matching app and rules must be tested and released together. The first admin must already exist through a trusted Console/Admin SDK action; anonymous dashboard access is intentionally removed. Live Firebase has not been changed.

## Working with the split source

The HTML no longer contains inline script or style blocks. Historical HTML comments moved to `docs/LEGACY_NOTES.md`. Extraction preserves each legacy block byte-for-byte, with checksums recorded in the manifest. The total feature code still exists: reducing the HTML size is an organization change, not a claim that the codebase has been fully rewritten or optimized.

Edit the relevant JS/CSS file directly. Keep the numeric ordering and classic script semantics: legacy globals, inline event handlers and patch wrappers depend on them. Do not add `async`, `defer` or `type="module"` to these scripts without a separate tested migration. Do not upload only `index.html`; deploy the entire `public/` directory.

For a feature, start with the [module map](docs/MODULE_MAP.md) or search `rg "functionName|elementId" public/js public/css public/index.html`. Run `npm run check` and `npm test` before committing. The extraction checks intentionally flag changes to preserved legacy files; a reviewed functional edit should also update that file's manifest checksum and regression tests.

GitHub Actions runs unit/structure checks, isolated Firebase rules tests and an isolated browser smoke test with synthetic data. Full authenticated staging regression remains required before merging/deploying the draft.

Verified on GitHub Actions on 9 November 2026: 16 unit/structure tests, 17 Firebase emulator tests, and the isolated Chromium smoke test pass ([run](https://github.com/cmlagatuz/safwat-recruitment-toolkit/actions/runs/42610307070)). The browser test covers synthetic Operations/Guide workflows; it does not replace authenticated regression of the legacy application.

## Interactive workspace (9 November 2026)

The new Home screen brings task launchers, a daily workflow and session-only recent tools together. Use **Find a tool** in the top bar to search available workspaces; press Down to focus results, use arrow keys to move, Enter to open, and Escape to close. Hidden or disabled navigation tools are excluded. On smaller screens, the menu button opens the scrollable sidebar; select a tool, tap outside or press Escape to close it.

The neutral graphite presentation layer updates typography, cards, inputs, focus states and sign-in styling across the toolkit. Animations respect reduced-motion preferences; the existing dark-mode setting remains supported. Recent tools clear on sign-out and are not stored. No candidate data or Firebase settings are changed by this UI update.

Source: `public/js/workspace.js` and `public/css/workspace.css`. The existing tool handlers remain in place. Browser smoke coverage includes Home launchers, tool search, hidden-tool exclusion, recent tools, mobile navigation and sign-out clearing. Full authenticated testing remains necessary for legacy workflows.

## Dark appearance and PROJECT D

Use **Theme** in the workspace or CEO dashboard header: **Graphite** (default), **Midnight** (near-black), or **Light**. Your choice is saved in this browser and applies to both screens. Existing dark-mode controls remain compatible.

PROJECT D now has expandable **Filters**, a **Focus view**, **Export summary**, keyboard-accessible exception drill-downs and visible metric definitions. The fixed 85% target has been removed, future dates no longer count as completed events in executive KPIs, and mixed-case filters work correctly. See [the dashboard review](docs/PROJECT_D_REVIEW.md) for changes and scope limitations. No Firebase configuration changes are required for this appearance/dashboard update.

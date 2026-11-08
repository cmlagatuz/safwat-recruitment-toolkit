# Safwat Recruitment Toolkit

Browser-based recruitment, visa reporting and document tools for Safwat. Firebase Authentication and Realtime Database provide the existing shared workspace; file tools use browser file access.

## Modules

| Module | Purpose |
| --- | --- |
| R-00 Database | Import, administration, data health and backups |
| R-01 Visa Report | Visa inventory, candidate assignments, filters and exports |
| R-02 Recruitment Pipeline | Candidate progress, salary details and bulk editing |
| **R-03 Operations (new)** | Client delivery snapshots, follow-up queue, visa deadlines and CSV summaries |
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

**The existing HTML contains the production Firebase project configuration.** For development with real app scripts, use a separate Firebase project and test accounts/data. Firebase web configuration is not an authorization boundary; deployed RTDB rules enforce access. The isolated browser smoke test blocks all network access and does not connect to Firebase.

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

- `public/index.html`: existing application, integrations and legacy layers.
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

The check parses the existing inline JavaScript and new modules and checks local asset paths. GitHub Actions runs these checks in the Riyadh timezone. To run the optional browser test, install Playwright in your development environment and its Chromium browser, then run `node tests/browser-smoke.cjs`. `CHROMIUM_PATH` can point to an existing compatible Chromium executable.

## Data compatibility and deployment

The shared JSON loader now rejects missing record arrays, missing/duplicate IDs and invalid metadata instead of silently treating corrupt input as an empty database. It preserves unknown top-level extension fields. Back up existing data before importing. Date helpers accept Date objects, ISO dates/timestamps and day-first numeric dates; unsupported date strings return null for review rather than locale guessing.

The common CSV helper and new Operations exports neutralize spreadsheet formulas, support quoted/newline values and include a UTF-8 BOM for Arabic names. Some legacy exporters have independent serializers and still need consolidation.

Firebase Hosting continues to serve `public/` using `firebase.json`; publish the **whole directory**, including `js/` and `css/`. Review on a staging Firebase project before deploying. No RTDB rules, production data, existing roles or live hosting settings are changed by this upgrade.

## RTDB rules needed for the next phase

Provide the deployed Realtime Database Rules JSON (Firebase Console → Realtime Database → Rules). No passwords, service-account keys or production records are needed. Rules review and emulator tests are required before the proposed authorization/concurrent-save redesign described in `docs/REVIEW.md`.

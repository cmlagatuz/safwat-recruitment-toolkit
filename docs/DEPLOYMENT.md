# GitHub-first Firebase Hosting release (22 November 2026)

Source repository: https://github.com/cmlagatuz/safwat-recruitment-toolkit  
Production project: `safwat-recruitment-toolkit`  
Public site: https://safwat-recruitment-toolkit.web.app/

## Trigger and gate

`.github/workflows/checks.yml` runs on pushes and pull requests. Only pushes to `main` (or deliberate workflow_dispatch on `main`) may deploy. The `deploy-hosting` job depends on **all three** successful check jobs: static/unit tests, Firebase RTDB emulator rules tests, and isolated Chromium browser tests. Commits to PR branches do not go live. Hosting releases are serialized, and after publishing the workflow fetches the live `index.html` and compares it with the GitHub revision. A failed comparison is reported as a failed release; do not claim production verified.

The action deploys the **entire** `public/` directory using `firebase.json` to the Firebase Hosting live channel. It does **not** modify Auth users, candidate data or database rules. Do not upload files directly to the Firebase Console as a substitute for a GitHub commit.

## One-time Firebase authentication (required before automation can deploy)

A maintainer with access to Google Cloud/Firebase project `safwat-recruitment-toolkit` must provision a dedicated Firebase Hosting deployment service account and add its JSON key to this repository's encrypted GitHub Actions secret:

`FIREBASE_SERVICE_ACCOUNT_SAFWAT_RECRUITMENT_TOOLKIT`

Configure it under GitHub **Settings → Secrets and variables → Actions → New repository secret**. The Firebase team documents account setup and required roles at https://github.com/FirebaseExtended/action-hosting-deploy/blob/main/docs/service-account.md. Scope the account to deployment needs. Never commit, paste into issues or share the JSON key in chat.

**Status:** The repository workflow can enforce the secret but cannot attest that the secret has been configured; inspect the release job on GitHub Actions. If it reports a missing secret, deployment has not happened. After configuring it, use **Actions → Toolkit checks and Firebase Hosting release → Run workflow** on `main`, then check the deploy job and the live site.

## Coordinated RTDB rules rollout

`database.rules.json` is not auto-deployed by the Hosting action. When a push changes that file, the automatic Hosting release blocks to prevent serving an incompatible app/rules combination. Follow `docs/SECURITY_ROLLOUT.md`: back up live data/rules privately; confirm a trusted approved admin exists; perform authenticated staging tests; arrange the production release of matching app and rules together. Resume normal auto-Hosting releases only after the coupled change is verified. Neither the presence of source rules in GitHub nor green isolated emulator tests prove that production rules were deployed.

## Release handoff

Include the exact GitHub commit SHA/link, the three successful CI jobs, the deploy job outcome, and live content verification. If GitHub cannot authenticate to Firebase, report **source updated / Firebase not deployed**, never **live**.

Firebase reference: https://firebase.google.com/docs/hosting/github-integration

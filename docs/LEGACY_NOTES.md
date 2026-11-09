# Historical inline notes

Moved from the HTML shell for reference. These describe earlier releases, not current instructions.

```text
=========================================================
     Post-auth app reveal — runs after DOMContentLoaded
     =========================================================
```

```text
# =========================================================
```

```text
# AUTHOR:     Carl Michael Lagatuz
```

```text
# COPYRIGHT:  © 2026 Lagatuz Labs
```

```text
# LICENSE:    MIT
```

```text
# VERSION:    7.1.1 (CLAIRE delta saves + audit delta) · was 7.0.0 (CLAIRE Step 1 — single save path) · 6.1.0 tz-safe dates · 6.0.1 governor — previously 2.2.0 (v2.1.1 + Firebase Auth (email/password) with sign-in gate, and field-level record locks via RTDB transactions with 90s TTL heartbeat)
```

```text
# =========================================================
```

```text
Libraries (loaded from public CDN — an internet connection is required the first time each tool is used)
```

```text
=========================================================
     ENTERPRISE LAYER v2.2.0 — AUTH + LOCKS
     =========================================================
```

```text
Auth Gate (full-screen sign-in)
```

```text
R-00 DATABASE
```

```text
R-01 VISA REPORT
```

```text
R-02 RECRUITMENT PIPELINE
```

```text
F-01 OFFER LETTERS
```

```text
F-02 EXTRACT
```

```text
F-03 SORT
```

```text
F-04 RENAME
```

```text
F-05 MKFOLDERS
```

```text
F-06 LIST
```

```text
F-07 MERGE PDFS
```

```text
F-08 CONVERT
```

```text
F-09 DELETE
```

```text
=========================================================
     ENTERPRISE ENHANCEMENT LAYER v2.0.0 — DOM OVERLAY
     =========================================================
```

```text
Offline banner
```

```text
Toast host
```

```text
Command palette (Ctrl+K)
```

```text
Session lock overlay
```

```text
Audit log side panel
```

```text
Backup snapshots side panel
```

```text
Security & settings side panel
```

```text
Enterprise top strip (fixed, always visible)
```

```text
=========================================================
     ENTERPRISE LAYER v2.1.0 — Approvals · Sync · Anomalies
     =========================================================
```

```text
Approvals slideover
```

```text
Anomalies slideover
```

```text
Firebase sync section injected into Security panel via JS on init
```

```text
Help / keyboard shortcuts modal
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.4.3 — force reveal after sign-in
     ---------------------------------------------------------
     Fixes the "signed in but nothing happens" case by
     bypassing the fragile v2.4.1 pipeline. Runs its own
     independent auth-state listener that WILL reveal the
     app once we confirm we have a signed-in user with an
     RBAC record (bootstrapping one if needed).
     
     Paste this AFTER v2.4.1 and v2.4.2, still before </body>.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.4.5 — dedupe presence by user
     ---------------------------------------------------------
     Groups multi-tab presence entries so the same user shows
     as one avatar (with a "×N" tab counter), not N avatars.
     
     Paste before </body>. Safe alongside v2.4.4.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.5.0 — CLOUD-FIRST MODE
     ---------------------------------------------------------
     Auto-loads the recruitment database from Firebase RTDB on
     sign-in. No more manual file picker every session.
     
     - Cloud is the source of truth (safwat/databases/main)
     - Every save writes to cloud instantly
     - IndexedDB cache for offline reads (last known-good copy)
     - "Export as .json" button retained for local backups
     - "Import from .json" button retained for migration
     
     Paste before </body>. Safe alongside all v2.4.x hotfixes.
     =========================================================
```

```text
Cloud loading overlay
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.5.1 — cloud path + R-01/R-02 fetch
     ---------------------------------------------------------
     Fixes two v2.5.0 bugs:
       1. Import/save wrote to safwat/databases/main_cloud
          (EntSync sanitized "main.cloud" -> "main_cloud")
          while reloads read from safwat/databases/main → empty.
       2. dbIsOpen() required DB_FILE_HANDLE which is null in
          cloud mode, so R-01 Visa Report and R-02 Recruitment
          Pipeline refused to render.
     
     Paste before </body> AFTER v2.5.0.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.5.3 — UX POLISH
     ---------------------------------------------------------
     Fixes three UX issues from v2.5.0 → v2.5.2:
     
     1. Silences the "Local database is newer than remote.
        Push local to server?" confirm() prompt in cloud-first
        mode. In cloud mode the cloud IS the source of truth,
        so the merge dialog is nonsense and just annoying.
     
     2. Removes the redundant "Access: Super Admin" hint from
        the sidebar footer. Instead promotes it to a small
        "★ SUPER" badge attached to the existing Role pill in
        the enterprise top strip.
     
     3. Ensures the enterprise top strip stays visible at all
        times (locked to the top of the viewport, no scroll
        needed) and reflows on narrow screens so no buttons
        get cut off.
     
     Paste before </body> AFTER all previous v2.5.x hotfixes.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.5.4 — return strip to bottom
     ---------------------------------------------------------
     Reverts v2.5.3's top-anchor change. The enterprise strip
     belongs at the BOTTOM of the viewport, always visible,
     no scroll needed.
     
     Paste before </body> AFTER v2.5.3.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.6.0 — ACCOUNT APPROVAL FLOW
     ---------------------------------------------------------
     New sign-up flow:
       1. User signs up → record inserted into pendingUsers/
       2. User sees "Waiting for approval" gate (blocked)
       3. Super admin sees request in Approvals Queue with
          role selector → clicks Approve
       4. User's waiting gate auto-advances to email verify
       5. After verification → app revealed with assigned role
     
     Paste before </body> AFTER all previous v2.5.x hotfixes.
     =========================================================
```

```text
Waiting-for-approval gate
```

```text
Rejected gate
```

```text
=========================================================
     ENTERPRISE v2.8.0 — PIPELINE + VISA BUSINESS LOGIC OVERHAUL
     ---------------------------------------------------------
     Applies all the business rules requested:
     
     RECRUITMENT PIPELINE:
     - KPI cards: "Deployed / Visa Issued" and
                  "Cancelled / Withdrawn / Rejected"
     - VISA ISSUED: Safwat sponsor → Active, Client → Deployed
     - END OF SERVICE / TERMINATED / AWOL → Exited (Post-Deployment)
     - CANCELLED / REJECTED / WITHDRAWN/BACKOUT / UNFIT → Cancelled/Withdrawn/Rejected
     - Client leaderboard rebuilt: 8 current-step columns
       (Sent, Signed, Medical IP, Medical Done, SVP IP, SVP Done, Bio IP, Stamped)
     - Sticky headers on all report tables
     - Hide "Start Visa" for Local Transfer candidates
     - Bulk edit adds: Position, Agency, all pipeline date fields
     
     VISA REPORT:
     - Pie chart color swap (USED=blue, UNUSED=green, ALLOCATED=brass)
     - KPI cards color-matched to pie
     - Expiring window: ≤ 90 days (was 30)
     - Upcoming Expirations: remove Expiry column, add City column,
       show live count in section heading
     - Live count on All Visa Records + All Candidates
     
     ADDING VISA RECORDS:
     - City (Stamping City) field on single-add + Excel template
     - QIWA Visa Date: Hijri-only, auto expiration (+ 2 Hijri years)
     - Gregorian shadow displayed under both Hijri dates
     - Candidate Visa Expiration: auto (+ 90 days), locked
     - Both auto-computed fields are read-only
     
     Paste before </body> AFTER all previous v2.x.x hotfixes.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.1 — RPT_COLORS undefined guard
     ---------------------------------------------------------
     Fixes the "Firebase connect failed - Cannot read properties
     of undefined (reading 'used')" error.
     
     Root cause: v2.8.0 overrode renderVisaStatusChart to reference
     window.RPT_COLORS.used. The sync module can call renderers
     during its initial connect (via _applyRemote → onDatabaseReady)
     before the main app's RPT_COLORS constant is fully defined.
     
     Fix: seed a default RPT_COLORS object at page-parse time so
     any early access is safe; the base app overwrites it later.
     
     Paste this BEFORE the v2.8.0 patch (or anywhere before </body>
     — position doesn't matter since it only defines a fallback).
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.8.4 — Hijri slash format (safe rewrite)
     ---------------------------------------------------------
     Replaces v2.8.2 and v2.8.3 entirely.
     
     ⚠️  DELETE the v2.8.2 and v2.8.3 blocks from index.html
         before pasting this. Their MutationObserver was
         causing browser freezes.
     
     This patch:
       - No MutationObservers (the root cause of the freeze)
       - No repeating timers (all timers self-terminate)
       - Wraps openVisaForm once (like v2.8.0 does)
       - Hijri module accepts slash + dash formats
       - Persists slash form to storage for consistency
     
     Paste before </body> AFTER v2.8.0.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.5 — reposition Agency section
     ---------------------------------------------------------
     v2.8.0 injected the "Agency & pipeline dates" section at
     the wrong position (top of modal-body). This hotfix moves
     it to the correct spot: after Notes, right before the
     Save / Cancel button row.
     
     Paste before </body> AFTER v2.8.0 and v2.8.4.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.6 — force Agency section to bottom
     ---------------------------------------------------------
     v2.8.0 inserted .ent-case-section as a SIBLING of .modal-body
     (not inside it). v2.8.5 only searched inside .modal-body,
     so it never found the section to move.
     
     v2.8.6:
       - Searches the entire #modalOverlay for .ent-case-section
       - Moves it INTO .modal-body, just before the Save/Cancel row
       - Idempotent — sets a flag once positioned
     
     Paste before </body> AFTER v2.8.5.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.8 — Gregorian → Hijri conversion
     ---------------------------------------------------------
     Fixes the actual problem:
     
     Records in the database have GREGORIAN dates stored in
     qiwaVisaDate (e.g. "2024-09-28"). When opening for edit,
     the Hijri input field displayed this Gregorian value as-if
     it were Hijri, giving expirations like year 2587.
     
     What v2.8.8 does:
       1. Adds Gregorian → Hijri conversion to window.Hijri
       2. On modal open, detects legacy Gregorian dates and
          converts them to the correct Hijri equivalent for
          display in the Hijri input
       3. Optional bulk migration button in R-00 (admins) to
          backfill qiwaVisaDateHijri from Gregorian source
     
     Paste before </body> AFTER v2.8.4 and v2.8.6.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.9 — lock sidebar (no scroll)
     ---------------------------------------------------------
     The original toolkit set overflow-y:auto on the sidebar,
     which meant it became scrollable whenever content was
     taller than the viewport (worsened by v2.5.4's bottom
     strip eating another 42px).
     
     This patch:
       - Locks sidebar scroll (overflow: hidden)
       - Tightens padding + gaps so all nav items fit
       - Ensures the sidebar height accounts for the bottom strip
     
     Paste before </body>. CSS-only, no JS.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.10 — clean sidebar scroll lock
     ---------------------------------------------------------
     Preserves the ORIGINAL sticky layout (does NOT switch to
     fixed). Only:
       - Turns off overflow-y (no scrollbar)
       - Constrains height to viewport minus bottom strip (42px)
         so content doesn't hide behind the bottom bar
       - Clears any lingering inline styles from removed patches
     
     Paste before </body>. Safe with all other v2.x patches.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.11 — dynamic strip-height calc
     ---------------------------------------------------------
     Fixes the 34px gap between sidebar and bottom strip.
     
     Root cause: v2.5.3's reflowTopStrip() toggles the
     'ent-topstrip-tall' class when strip.offsetHeight > 40.
     Since the strip is actually 42px, it always got flagged
     as tall, so my previous CSS subtracted 76px instead of
     the actual 42px, leaving a gap.
     
     v2.8.11:
       1. Measures the actual strip height dynamically
       2. Sets sidebar height = viewport - actual strip height
       3. Overrides v2.5.3's threshold-based toggle
       4. Removes lingering inline height styles
     
     Paste before </body>. Replaces the height logic in v2.8.10.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.12 — proper fixed sidebar
     ---------------------------------------------------------
     Fixes the scroll-induced sidebar flicker/repositioning.
     
     Root cause: position:sticky briefly reveals underlying
     content when scrolling long pages, because the browser
     transitions the element between "in-flow" and "stuck"
     states.
     
     Fix: switch to position:fixed, but PRESERVE the grid
     layout by keeping the sidebar's grid column reserved.
     Main content stays exactly where it is; sidebar just
     stops participating in scroll.
     
     Paste before </body>. Replaces the height logic in v2.8.11.
     REMOVE the v2.8.11 block from index.html before deploying.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.13 — force main into column 2
     ---------------------------------------------------------
     Fix for v2.8.12: when position:fixed removes the sidebar
     from the grid flow, the main content element auto-placed
     into column 1 (280px wide) and disappeared visually.
     
     Fix: explicitly pin every non-sidebar grid child to
     column 2 so main content always renders in the 1fr column.
     
     Paste before </body> AFTER v2.8.12.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.14 — sidebar typography + spacing
     ---------------------------------------------------------
     Slightly larger nav text, more breathing room between
     items, and faint dashed separators between section groups
     (Reports & Dashboards / Documents / File Movement / PDF & Word).
     
     Paste before </body>. CSS-only, no JS.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.8.15 — All Visa Records: expanded columns
     ---------------------------------------------------------
     Rebuilds the ALL VISA RECORDS table with 22 columns:
     
        Visa Document # | Sponsor ID | CR Number | Category |
        Nationality | Stamping City | Gender |
        QIWA Visa Date (Hijri↔Greg toggle) | QIWA Expiration |
        Agency Delegation # | Delegation Date (Ratification) |
        Registered Agency | Client | Candidate |
        Passport | MOFA App # | Visa Issued # (Visa Number) |
        Status | Cand. Visa Issuance | Cand. Visa Expiration |
        Linked Case | Actions
     
     Features:
       - Clickable "QIWA Visa Date" header toggles all cells
         between Hijri and Gregorian display formats
       - Adds a "Gender" field to the visa form (schema v4)
       - Sticky first two columns (checkbox + candidate) so
         you can scroll horizontally without losing context
       - Horizontal scroll on the container (wide table)
       - Preserves bulk-select, bulk-delete, bulk-edit
     
     Paste before </body>. Compatible with all previous v2.x.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.8.16 — Visa bulk edit enhancements
     ---------------------------------------------------------
     - Bulk bar now shows ONLY when 2 or more records are
       selected (single-record selection just highlights the row)
     - Rebuilds the visa bulk-edit form with expanded fields
       including the new Gender field
     - Belt-and-suspenders: re-attaches row-checkbox handlers
       in case v2.8.15's table rebuild broke the delegated
       listener chain
     - Bulk bar positioned as a floating action bar above the
       table for visibility
     
     Paste before </body> AFTER v2.8.15.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.8.17 — Full visa bulk edit + select-all fix
     ---------------------------------------------------------
     Fixes v2.8.16's two issues:
     
     1. Bulk edit modal was still showing the ORIGINAL 3-field
        form. The base app's Bulk Edit button holds a captured
        reference to the original openVisaBulkEditForm, so my
        window override was bypassed. Fix: intercept the click
        at the document level (capture phase) and open our own
        form instead.
     
     2. "Select All" checkbox didn't trigger the bulk bar.
        Root cause: base app's handler ran first, updated a
        DIFFERENT variable than window.selectedVisaIds. Fix:
        intercept select-all change events and sync properly.
     
     Also EXPANDED the bulk-edit form with EVERY editable
     field visible in the table headers:
     
       - Visa Document Number
       - Sponsor ID
       - CR Number
       - Visa Category
       - Nationality
       - Stamping City
       - Gender
       - QIWA Visa Date (Hijri or Gregorian format)
       - Agency Delegation Number
       - Delegation / Ratification Date
       - Registered Agency Name
       - Client
       - MOFA Application Number
       - Visa Number
       - Visa Status
       - Candidate Visa Issuance
       - Linked Recruitment Case
     
     Auto-derived / read-only fields NOT in bulk edit:
       - Sponsor (derived from Company Name)
       - QIWA Visa Expiration (+2 Hijri years, auto)
       - Candidate Visa Expiration (+90 days, auto)
     
     Paste before </body> AFTER v2.8.16.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.21 — decode escapes + chart refresh
     ---------------------------------------------------------
     Fixes two visual issues:
     
     1. Text like "SPONSOR \u2014 SAFWAT VS. CLIENT" shows the
        literal backslash-u2014 instead of the em-dash character.
        Cause: earlier patches used '\\u2014' in JS strings and
        the double-backslash got persisted somewhere.
        Fix: scan visible text on the page + database on load
        and replace common unicode escape sequences with their
        real characters. Also patches setInterval so newly
        rendered text gets the same fix.
     
     2. The Visa Status Breakdown pie chart doesn't update when
        filters change (KPIs show 3, pie shows 1,007).
        Cause: my earlier renderVisaStatusChart override held a
        stale reference or Chart.js instance got orphaned.
        Fix: force-destroy the previous chart instance before
        recreating on each render.
     
     Paste before </body>.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.8.23 — bulk edit total rewrite
     ---------------------------------------------------------
     Replaces v2.8.17 and v2.8.22 with a completely self-contained
     bulk-edit form that ignores the base app's CSS classes.
     
     Guaranteed fixes:
       - Labels on the LEFT (checkbox + label together, input right)
       - MOFA App # REMOVED
       - Linked Recruitment Case REMOVED
       - All date fields use yyyy/mm/dd format
       - Uses fully scoped CSS with unique class prefix (.v2823-)
       - Higher CSS specificity than base app so nothing fights back
     
     Also normalizes displayed dates in visa/expiry tables to yyyy/mm/dd.
     
     ⚠️ IMPORTANT: If v2.8.17 or v2.8.22 blocks are still in
     index.html, they will fight this. Please:
     1. Remove v2.8.17 block (search for "v2.8.17 patch")
     2. Remove v2.8.22 block (search for "v2.8.22 patch")
     3. Then paste this v2.8.23 block before </body>.
     
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.24 — labels only
     ---------------------------------------------------------
     Minimal fix. Only two changes, nothing else touched:
     
     1. "Set Delegation Date (Ratification):" → "Set Delegation Date:"
        (shorter, no more overlap with its input)
     
     2. Default QIWA input mode set to Hijri when the user
        has no explicit preference yet. Does NOT touch input
        boxes, placeholders, or hint text.
     
     Paste before </body> AFTER v2.8.23.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.8.25 — sticky filter+KPI bar on scroll
     ---------------------------------------------------------
     Once the user scrolls past the header/filter/KPI section
     in R-01 Visa Report, a compact clone of the filter bar
     and KPI cards fixes to the top of the viewport. Scroll
     back up and it disappears — original view is restored.
     
     Approach:
       - Detects when the original filter row + KPI grid
         scroll out of view (IntersectionObserver on a sentinel)
       - Shows a fixed clone at the top with the same controls
         wired to the same DOM element IDs (via cloneNode
         + event forwarding)
       - Clone auto-refreshes its KPI numbers on every visa
         view refresh, so counts stay accurate as filters change
     
     Paste before </body>.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.26 — sticky bar tab-aware
     ---------------------------------------------------------
     v2.8.25 showed the sticky filter+KPI bar whenever the
     sentinel had scrolled past — but never checked whether
     R-01 was actually the visible tab. Result: navigating
     to R-02 or R-00 kept the R-01 sticky bar showing.
     
     Fix: also check if the visa dashboard is currently
     visible (via getComputedStyle or offsetParent) before
     activating. Runs on every tab change and every 500ms.
     
     Paste before </body> AFTER v2.8.25.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.27 — R-00 hide + DB force-load
     ---------------------------------------------------------
     Fixes two bugs affecting non-super-admin users:
     
     BUG 1 — R-00 Database tab visible to non-super-admins
       Cause: v2.5.2's visibility check only re-runs on role
       change. If sidebar renders/re-renders after the initial
       pass, R-00 stays visible.
       Fix:
         - CSS-level hide by default for R-00 (opacity 0, no clicks)
         - Only reveal after CONFIRMED super-admin check
         - MutationObserver on sidebar catches any late renders
         - Block clicks + hash navigation to R-00 tab for
           non-super-admins (even if they type the URL manually)
     
     BUG 2 — Cloud database doesn't auto-load
       Cause: v2.5.0's auto-open loop only fires if window.DB
       is null. If it partially loads or fails silently, the
       loop stops.
       Fix:
         - Detect stuck state (authenticated but no DB after 5s)
         - Force-call EntCloud.openFromCloud() up to 3 times
         - Show visible "Loading database…" banner while loading
         - Show "Retry" button if all attempts fail
     
     Paste before </body>. Safe alongside all previous v2.x.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.28 — force fresh DB, no stale cache
     ---------------------------------------------------------
     v2.5.0's openFromCloud has a fallback to IndexedDB cache
     if the Firebase read fails. On hard refresh, there's a
     race between:
       - Auth token becoming valid for database.ref().once()
       - openFromCloud() firing
     
     If the token isn't ready yet, Firebase throws → falls
     back to cache → shows stale data. Manual "Reload from
     cloud" works because by then the token is valid.
     
     This patch:
       1. Waits for auth token to be VERIFIED (getIdToken)
          before attempting cloud read
       2. Retries Firebase up to 5 times with backoff before
          falling back to cache
       3. Even after successful cache load, schedules a
          background Firebase re-fetch and applies fresh data
          when it arrives
       4. Adds a "sync check" 3 seconds after initial load
          that compares local savedAt to remote savedAt — if
          remote is newer, applies it automatically
       5. Loading indicator shows Firebase status live
     
     Paste before </body> AFTER v2.5.1 and v2.8.27.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.29 — bulletproof R-00 hide + verbose DB load
     ---------------------------------------------------------
     Two changes:
     
     1. R-00 hidden IMMEDIATELY on page parse via CSS
        (before JS runs), then only revealed via JS if the
        signed-in user is confirmed super-admin (email or
        display name contains "carl" or "lagatuz").
        Uses multiple selectors and a JS enforcer that runs
        on every DOMContentLoaded, auth change, and every 1s.
     
     2. Cloud DB load now VERBOSELY logs each step so you
        can see in the console exactly what happened. If DB
        doesn't arrive within 8 seconds, shows a persistent
        banner with "Retry" and "Show error" buttons.
     
     Paste before </body>. Safe alongside all previous v2.x.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.30 — force redirect from R-00 content
     ---------------------------------------------------------
     v2.8.27 and v2.8.29 hid the R-00 sidebar item and blocked
     clicks, but the R-00 CONTENT section is still the default
     landing view. Non-super-admins signing in land on R-00's
     content page (which shows the cloud panel expecting DB to
     load) even though the nav item is hidden.
     
     This patch:
       1. On page load + auth, detect if R-00 content section
          is currently displayed for a non-super-admin
       2. If yes, find R-01 nav element and simulate click on
          it to navigate away from R-00
       3. Hide R-00 CONTENT section explicitly via CSS
       4. If tab navigation is based on data-tab attributes,
          also drives the tab-switch programmatically
     
     Paste before </body> AFTER v2.8.29.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.32 — restore R-00 nav for super admin
     ---------------------------------------------------------
     v2.8.29's forceHideR00() ran BEFORE the super-admin check
     completed, setting inline style="display: none !important"
     on the R-00 nav wrapper. Once inline styles are set, they
     beat any later CSS or class-based reveal.
     
     Symptom: You (super admin) don't see R-00 in the sidebar,
     but you CAN see the R-00 content in the main area.
     
     Fix: on every check tick, if the user IS super admin,
     explicitly remove any inline "display: none" from every
     nav item that references R-00. Also clears the
     data-role-hidden and data-r00 flags.
     
     Paste before </body> AFTER v2.8.31.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.33 — 1-click diag + R-00 content + role lock + connect fix
     ---------------------------------------------------------
     Four fixes in one patch:
     
     1. 1-CLICK DIAGNOSTIC
        Adds a "🚨 Send diagnostic to admin" button to the
        enterprise strip (visible to ALL users). One click
        writes a full session snapshot to
        safwat/diagnostics/{uid}/manual so super admins can
        review remotely from their Diagnostics panel.
     
     2. R-00 CONTENT FLASH FIX
        Even with sidebar item hidden, the R-00 content
        section rendered for a split second before the
        redirect fired. Fix: HTML-level attribute that
        hides all R-00 content sections IMMEDIATELY at
        parse time, using inline styles that always win.
     
     3. LOCK "Access Control" role dropdown
        The Security & Settings panel had an editable role
        dropdown that could bypass RBAC by writing to
        localStorage. Fix: disable it entirely for
        non-super-admins with a lock message.
     
     4. FIX "CONNECT" BUTTON
        Base app's Connect button calls EntSync.connect
        which doesn't force a fresh DB pull. Wraps the
        button so clicking it also triggers force-fresh
        cloud load (from v2.8.28) after connecting.
     
     Paste before </body> AFTER v2.8.31 and v2.8.32.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.34 — hide send-diagnostic from super admin
     ---------------------------------------------------------
     v2.8.33 shows the "🚨 Send diagnostic" button to every
     signed-in user, but it makes no sense for super admins
     since they already have the full 🩺 Diagnostics panel
     to view everyone remotely.
     
     Fix: hide the send button when body has ent-is-super-admin.
     Regular users still see it.
     
     Paste before </body> AFTER v2.8.33.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.35 — aggressive DB recovery
     ---------------------------------------------------------
     Symptom: The app UI loads (sidebar, filters, chart cards)
     but no actual data appears — window.DB is empty or has
     no records. This happens when the DB load path breaks
     due to patch interactions or timing.
     
     Fix: Independent recovery loop that:
       - Checks every 2 seconds if we have data
       - If not, directly fetches from Firebase (bypass all
         accumulated patches: EntCloud, EntSync, etc.)
       - Applies data directly to window.DB
       - Explicitly triggers refreshVisaView, refreshPipelineView
       - Shows visible progress banner
       - Retries up to 10 times
     
     This is the emergency escape hatch — if any earlier
     patch is silently failing, this brute-forces it fixed.
     
     Paste before </body> AFTER v2.8.34.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.36 — Chart.js registry + canvas reuse
     ---------------------------------------------------------
     ROOT CAUSE FOUND from your diagnostic:
     
     Data loads perfectly. Views render. But charts show empty
     because Chart.js throws:
     
       "Cannot set properties of undefined (setting 'cat')"
       "Canvas is already in use. Chart with ID must be destroyed"
     
     v2.8.21 introduced code that:
       1. Tries to destroy old chart before creating new: 
          window.visaCharts.cat.destroy() — throws if visaCharts is undefined
       2. When destroy throws, new chart create fails because
          old chart is still owning the canvas
       3. Silently caught → empty chart cards
     
     FIX:
       1. Ensure window.visaCharts and window.pipelineCharts
          objects exist BEFORE any chart code runs
       2. Provide a global safe-destroy helper that handles
          undefined registries
       3. Use Chart.getChart() API to find and destroy any
          orphaned chart attached to a canvas before creating new
     
     Paste before </body> AFTER v2.8.35.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.37 — direct render pipeline + filter wiring
     ---------------------------------------------------------
     Your diagnostic revealed the exact problem:
     
       "filteredRowCount": 1903     ← data IS filtered
       "visaTableRowCount": 0       ← but rows NEVER rendered
       "kpiRan": true               ← KPIs work when manually called
       "statusRan": true            ← Charts work when manually called
     
     This means refreshVisaView() is not being called after
     data loads. Also, changing filters doesn't retrigger the
     render pipeline.
     
     Fix:
       1. Directly call every render sub-function immediately
       2. Wire filter/search elements to a direct-render call
       3. Bypass refreshVisaView entirely — call the children
          directly so no broken wrapper can stop us
     
     Paste before </body> AFTER v2.8.36.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.38 — force editor/viewer landing on R-01
     ---------------------------------------------------------
     Bryan (and other non-super-admins) still see R-00 content
     on first load because the app boots with R-00 as the
     default active view. Earlier redirect patches fire too
     late — Bryan sees R-00 for a few seconds before switching.
     
     Fix: at page-parse time, if we know the user isn't super
     admin (from localStorage flag), we set location.hash to
     R-01 BEFORE the app boots and hide the R-00 content
     section via CSS. Once the user clicks R-01 in the sidebar
     it becomes the visible section naturally.
     
     Layers:
       1. Inline preflight script (runs at HTML parse)
          - sets location.hash = 'R-01' if not super admin
          - adds html.ent-force-r01 class immediately
       2. CSS: html.ent-force-r01 hides R-00 content section
          in every possible selector variation
       3. On DOMContentLoaded: finds R-01 nav element and
          clicks it programmatically so the app's tab-switch
          logic kicks in
       4. Periodic enforcer catches any re-render
     
     Paste before </body> AFTER v2.8.37.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.39 — diagnostics panel repair
     ---------------------------------------------------------
     Your Diagnostics panel is showing empty "undefined" user
     cards. Root cause: the v2.8.31 diagnostic writer wasn't
     completing successfully — likely because the RTDB rules
     for safwat/diagnostics weren't published yet, or the
     writes are silently failing.
     
     This patch:
     
       1. Makes the diagnostic writer more robust:
          - Retries on failure
          - Logs errors so we know what's failing
          - Writes minimal fallback data if the full snapshot
            build throws
     
       2. Fixes the diagnostics panel to:
          - Skip empty/malformed records instead of showing
            "undefined" cards
          - Show a "Purge" button per record so you can clean
            out old bad data
          - Show a "Refresh + Purge stale" button that removes
            entries older than 24 hours
     
       3. Also writes YOUR (Carl's) diagnostic — the panel was
          showing 2 offline records, but neither was yours,
          which confirms writes are broken across the board.
     
     Paste before </body> AFTER v2.8.31.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.40 — restore visa headline
     ---------------------------------------------------------
     The R-01 headline block ("R-01 · REPORTS & DASHBOARDS",
     "Visa Report" title, "N visas in use, N available…"
     summary) only appears AFTER changing a filter — not on
     initial load.
     
     Root cause: v2.8.37's direct render calls the renderer
     functions individually but MISSES renderVisaHeadline
     (the function that paints the summary/heading block).
     
     Fix: add renderVisaHeadline to the direct render pipeline,
     and also unhide any headline element that might have been
     hidden by CSS during boot.
     
     Same fix applied to the pipeline view for R-02.
     
     Paste before </body> AFTER v2.8.37.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.8.46 — Bulk Visa Add fix + new template
     ---------------------------------------------------------
     Fixes:
     
       1. "Add N visa records" button silently fails
          - Root cause: the base app's confirmBulkAddVisa handler
            may throw when it hits missing fields (like companyName)
            for computing sponsor. Also may fail on the
            v2.8.0 schema migration additions.
          - Fix: wrap the click handler with our own robust
            path that:
              * Ensures every field has a safe default
              * Runs the add sequentially with try/catch per record
              * Auto-derives sponsor from Company Name
              * Handles Hijri dates properly
              * Shows exact success/failure counts
     
       2. Template must have these 11 headers in this order:
            Visa Document Number
            Sponsor ID
            CR Number
            Company Name
            Nationality
            Gender
            Visa Category
            Client
            Status (Visa)
            QIWA Visa Date (Hijri, yyyy/mm/dd)
            Registered Agency Name
     
     Paste before </body>.
     =========================================================
```

```text
=========================================================
     ENTERPRISE HOTFIX v2.8.47 — add Stamping City column
     ---------------------------------------------------------
     Adds "Stamping City" as the 6th column, right after
     Nationality, in the Bulk Add Visa Records Excel template.
     
     New template order (12 columns):
       1. Visa Document Number
       2. Sponsor ID
       3. CR Number
       4. Company Name
       5. Nationality
       6. Stamping City         ← NEW
       7. Gender
       8. Visa Category
       9. Client
      10. Status (Visa)
      11. QIWA Visa Date (Hijri, yyyy/mm/dd)
      12. Registered Agency Name
     
     Paste before </body> AFTER v2.8.46.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.8.51 — Unified single "Add Visa" button
     ---------------------------------------------------------
     Replaces the two separate buttons (+ Add Visa Record and
     + Bulk Add Visa Records) with ONE clean button that opens
     a batch-friendly form.
     
     User fills in shared details:
       - Quantity (how many visas)
       - Visa Document Number
       - Sponsor ID
       - CR Number
       - Request Number (from QIWA)
       - Visa Category
       - Nationality
       - Stamping City
       - Gender
       - Client (optional)
       - QIWA Visa Date (Hijri, auto-computes expiration)
       - Registered Agency Name (optional)
     
     One click "Add N visas" → N identical records inserted
     with status = UNUSED. No Excel, no preview needed.
     
     Paste before </body>.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.8.52 — Approval queue for add + delete only
     ---------------------------------------------------------
     New policy:
       - Editors CAN modify records freely (no approval needed)
       - Editors' ADDITIONS go to the Approvals Queue for admin review
       - Editors' DELETIONS go to the Approvals Queue for admin review
       - Admins/super-admins bypass approval entirely
     
     Fixes two bugs:
     
     Bug 1: v2.0.0's Session.can('delete') hard-blocks editors
       BEFORE the approval interceptor can queue the request.
       Fix: patch Session.can() so editors are allowed to
       delete at the RBAC layer — the approval interceptor
       downstream catches it and queues it instead of applying.
     
     Bug 2: v2.1.0's shouldIntercept queues create/update/delete
       We change it to queue only create + delete (edits go through
       immediately for editors).
     
     Paste before </body> AFTER v2.0.0 and v2.1.0.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.8.53 — global approval requirement in RTDB
     ---------------------------------------------------------
     Root cause: v2.0.0's Approvals.isRequired() reads from
     localStorage, which is per-browser. Bryan's browser
     has it OFF (localStorage default = false), so his
     changes never got queued even though you enabled it
     in YOUR browser.
     
     Fix: move the setting to Firebase at
     safwat/config/approvalRequired. All users read the same
     value. Only admins can write to it.
     
     Paste before </body> AFTER v2.8.52.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.9.11 — sponsor auto-detect + single-edit fix
     ---------------------------------------------------------
     TWO FIXES for R-01 / R-02:
     
     1. SPONSOR AUTO-DETECTION
        A visa is SAFWAT-sponsored if its CR Number OR Sponsor ID
        is in the official Safwat list below; otherwise CLIENT.
        Applied on: single add, single edit, unified add (v51),
        bulk add, bulk edit — and a one-time sweep of existing
        records so historical data is corrected too.
     
     2. SINGLE-EDIT PERSISTENCE REPAIR
        Bugs fixed:
          - Single edit didn't persist changes
          - Gender saved but didn't take effect
          - Stamping City was wiped on ANY single edit and
            couldn't be entered
        Root cause: the base save rebuilds the visa record from
        native fields only, dropping stampingCity/gender (which
        are patch-added fields), then re-renders — erasing them.
        Fix: capture stampingCity + gender + CR + Sponsor ID at
        save-click (capture phase, before the base save runs),
        then re-apply them to the saved record + re-derive
        sponsor, save, and refresh.
     
     Paste before </body>. Safe with the current main app.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.9.12 — auto-expire visas (no fluctuation)
     ---------------------------------------------------------
     Automatically flips a visa's status to EXPIRED when its
     expiration date has passed. One-way, permanent, persisted.
     
     RULES (these guarantee NO fluctuation):
       1. FORWARD ONLY. Only UNUSED or ALLOCATED visas whose
          expirationDate is strictly in the past become EXPIRED.
          Nothing ever flips back to UNUSED/ALLOCATED.
       2. USED / CANCELLED are never touched (a stamped visa
          stays stamped even after its slot date passes).
       3. STAMP a marker (autoExpired:true + autoExpiredAt) so
          the record is never re-evaluated — no repeated writes,
          no flip-flop.
       4. Runs the sweep ONCE per DB load, plus a light daily
          re-check, and once right after any save/refresh — but
          only writes if something actually changed.
     
     Because the change is written to the DB, All Visa Records,
     the KPIs, charts, and the Expired count all reflect it
     consistently — and it syncs to every user via Firebase.
     
     Paste before </body>. Safe with the current main app.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.9.36 — R-02 CONSOLIDATED (row-id from buttons)
     ---------------------------------------------------------
     Replaces ALL prior R-02 blocks (v2.9.19 + v2.9.21→v2.9.35).
     Remove every one, paste ONLY this.
     
     PROVEN FACTS from your console:
       • All row checkboxes share the SAME data-id (broken).
       • The displayed NAME differs from the stored rec.name
         (exact-name matching failed for a row that clearly
         shows "TANVIRUL ALAM").
       So neither data-id nor name text is reliable.
     
     NEW resolver (3 tiers, per row, skip-taken):
       1) Pull an RC-id from the row's ACTION BUTTONS (Edit /
          Delete / Start Visa) or the <tr> attributes — the app's
          OWN identity, unique per row (the checkbox is ignored).
       2) Exact NAME-cell equality.
       3) Passport digits.
       If a row still can't resolve, its button HTML is dumped to
       the console so the exact tagging is visible.
     
     Also: sticky headers, sticky right-aligned search, bulk bar
     only at 2+, Add Candidate (single/multiple) with STATUS,
     Iqama/Overseas cols, salary auto-total, Excel paste, shared
     defaults incl. Status, passport auto-fill, force-single,
     purge, light combobox.
     Paste before </body>.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.9.39 — R-02 floating header + visa blocks
     ---------------------------------------------------------
     REPLACES v2.9.37 and v2.9.38. Keep v2.9.36. Paste before </body>.
     
     1. ROBUST STICKY HEADER (finally). CSS position:sticky kept
        failing against the base app's nested scroll containers.
        This uses a FLOATING CLONE: a copy of the header row is
        rendered as a sticky bar at the very top of the table's
        scroll box, with column widths mirrored from the real
        header and synced on horizontal scroll. Works regardless
        of the base app's overflow/transform quirks.
     
     2. SCROLL FIX kept — controls stay outside the horizontal
        scroll area (search top-right, bulk bar left).
     
     3. BULK START VISA — upgraded to give you full allocation
        FREEDOM with client-aware VISA BLOCKS:
          • For each selected candidate, the system offers VISA
            BLOCKS grouped by source:
              – CLIENT-ALLOCATED: visas already allocated to that
                client (unused within the allocation) — use them
                first for that client's candidates.
              – UNUSED-POOL: unassigned visas you can draw from.
          • Each block shows Nationality / Category / Agency,
            QUANTITY available, and earliest expiry.
          • A DROPDOWN per candidate lets you choose which block
            to pull from (auto-selected to the client's block with
            the soonest-expiring visa; override freely).
          • Balance table + smart recommendations retained.
          • Apply: pulls one visa from each chosen block, links it
            to the candidate, sets ALLOCATED, advances stage.
     
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.9.50 — VUPB (Cancelled) + grouped Expirations
     ---------------------------------------------------------
     REPLACES v2.9.46 → v2.9.49. Remove those, paste this
     before </body>.
     
     Changes:
       1. VISA USAGE PER BLOCK — the REMAINING column is replaced
          by CANCELLED (counts cancelled-status visas per block).
       2. UPCOMING EXPIRATIONS — replaced with a GROUPED-BY-QUANTITY
          view. Instead of listing every expiring visa row, it
          groups by identical characteristics and shows a QUANTITY.
          Headers:
            VISA DOC # · SPONSOR ID · CATEGORY · NATIONALITY ·
            CITY (STAMPING) · GENDER · CLIENT · QUANTITY · DAYS LEFT
          "Days Left" = the soonest-expiring visa in that group.
          Honors the section's Window dropdown (Next N days) and the
          R-01 filters. Our own grouped table replaces the base
          long list (base table hidden, no fluctuation).
     
     Also kept: R-02 slim KPI, R-01-only, Agency column, own Status
     control incl. "Unused & Allocated", sortable/sticky, Excel
     export, debounced signature-guarded render (no flicker).
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.9.55 — add REMAINING column to VUPB
     ---------------------------------------------------------
     Paste AFTER v2.9.50 (and after v2.9.53). Before </body>.
     
     Adds a new "REMAINING" column to VISA USAGE PER BLOCK, placed
     right after CANCELLED and before TOTAL. Remaining counts the
     UNUSED + ALLOCATED visas of that row.
     
     Implementation: a post-processor watches the VUPB table (which
     v2.9.50 re-renders on change) and injects the Remaining column
     after every render. It reads each row's Unused + Allocated
     chip values, inserts a green Remaining chip, and adds the
     Remaining total to the TOTAL row. Idempotent (won't duplicate).
     Because the Excel export reads the live table, REMAINING is
     included in the .xlsx automatically.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.9.66 — VUPB export: readable nav bar + opens on INDEX
     ---------------------------------------------------------
     REPLACES v2.9.59. Keep v2.9.50 + v2.9.55. Paste before </body>.
     
     ONLY the two things you asked for are changed in the Excel:
       1. The workbook now OPENS ON THE INDEX sheet (activeTab=INDEX).
       2. The top NAV BAR labels are no longer squeezed into a single
          narrow cell — each (⌂ INDEX, ◀ Prev, Next ▶) is MERGED
          across several columns so it is fully readable on every
          sheet (narrow summaries and wide data alike). Labels are
          kept short so they always fit; links still jump correctly.
     
     Everything else is IDENTICAL to before: freeze panes, auto-filter,
     the SUMMARY sheets (Client/Nationality/Agency/Category), per-client
     sheets, red = zero remaining, amber = near-expiry, INDEX directory.
     Also re-includes the STATUS PER CR "Export Excel" button (as v2.9.59).
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.9.61 — Upcoming Expirations "Export Excel"
     ---------------------------------------------------------
     Standalone. Paste before </body>.
     
     Adds an "Export Excel" button to the UPCOMING EXPIRATIONS card
     (top-right, same as Status per CR). It exports the GROUPED
     table exactly as shown — headers: Visa Doc # · Sponsor ID ·
     Category · Nationality · City (Stamping) · Gender · Client ·
     Quantity · Days Left — as a real .xlsx with the SAME settings
     as the CR export: title bar, colored headers, 10pt Calibri,
     borders, frozen header, auto-filter, IDs kept as TEXT, and a
     TOTAL row (Quantity summed). File: UPCOMING EXPIRATIONS.xlsx
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.9.65 — RESTORE R-01 UI + safe search + nav unlock
     ---------------------------------------------------------
     ⚠️ REMOVE v2.9.62, v2.9.63, AND v2.9.64 blocks first, then
     paste ONLY this before </body>.
     
     WHAT WENT WRONG: v2.9.63/64 added a class (.avr-head-flex) that
     forced the ALL VISA RECORDS heading's PARENT to display:flex.
     That parent is a big layout container, so the whole R-01 panel
     collapsed (tables gone, KPI cards stacked vertically). Also the
     presence tree-walk hit RTDB permission_denied and spammed errors.
     
     THIS FILE:
       1. RESTORES the layout — neutralises .avr-head-flex everywhere
          and strips the class from any element it was added to, so
          R-01 returns to normal.
       2. SAFE SEARCH — re-adds the ALL VISA RECORDS search box using
          ABSOLUTE positioning inside the card (top-right), with NO
          change to any container's display. Cannot affect layout.
       3. NAV UNLOCK (Bryan) — grants SuperAdmin client-side + guards
          the R-01 redirect. Pure JS, no layout impact.
       4. PRESENCE — the RTDB blocks broad reads (permission_denied),
          so the tree-walk is REMOVED (it can't work and only errors).
          Presence pruning is disabled here; the online count needs a
          rules-side fix (see note in chat).
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.9.69 — R-02 KPI full-size-until-stuck + dedupe header
     ---------------------------------------------------------
     REPLACES v2.9.67 and v2.9.68. Keep v2.9.45 (this works WITH it).
     Paste before </body>.
     
     Findings:
       • v2.9.45 already makes R-02 filters+KPI sticky (#entStickyWrap)
         but COMPACTS the KPI cards ALWAYS — so they never show full
         size. And its header handling now shows a DUPLICATE header
         in ALL CANDIDATES.
     
     This patch:
       1. FULL SIZE UNTIL STUCK — overrides v2.9.45's always-compact:
          KPI cards are FULL SIZE when unscrolled, and shrink ONLY
          when the sticky bar pins to the top (detected via a sentinel
          + IntersectionObserver that toggles .is-stuck on the wrapper).
       2. DEDUPE HEADER — removes the duplicate header row in the
          ALL CANDIDATES table (keeps the real one with the select-all
          checkbox; hides the clone) and strips any leftover floating
          header clones.
     
     Scoped strictly to R-02 (#pipelineKpiGrid + the candidate table).
     No reparenting, no forced flex — safe for the rest of the page.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.9.72 — R-02 Agency filter (after Stage)
     ---------------------------------------------------------
     Standalone. Paste before </body>.
     
     Adds an AGENCY filter to the R-02 Recruitment Pipeline filter
     bar, positioned to give the linear order:
        CLIENT > NATIONALITY > POSITION > RECRUITMENT TYPE > STAGE
        > AGENCY > SEARCH
     
     • Populates the Agency dropdown from the candidates' agencies
       (window.DB.recruitmentCases) — plus any agencies on linked
       visas — sorted, with an "All" default.
     • Inserts it immediately AFTER the Stage control and BEFORE the
       Search box, matching the styling of the existing selects.
     • Filtering works ON TOP of the base filters: when an agency is
       chosen, candidate rows whose agency doesn't match are hidden.
       Re-applies automatically when the table re-renders.
     • Fails safe: if it can't find the Stage control, it does
       nothing (no layout change). A diagnostic is included.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v2.9.79 — R-02 full-size unscrolled, compact only stuck
     ---------------------------------------------------------
     REPLACES v2.9.78 (and all earlier v2.9.7x sticky patches). Keep
     v2.9.72. Paste before </body>.
     
     Fixes:
       • KPI chips were compact even at the TOP (not scrolled) — the
         compact look leaked into the normal state. Now compact KPI
         applies ONLY under .is-stuck.
       • Filter controls looked small unscrolled — I had applied the
         tight R-01 sticky sizing (5px 8px / 12px) unconditionally.
         Now: NORMAL full-size filters when unscrolled; R-01's tight
         control sizing applies ONLY when stuck.
       • Robust stuck detection: uses BOTH an IntersectionObserver
         sentinel AND a scroll fallback, and NEVER marks stuck while
         the sentinel is on-screen (prevents "stuck at top").
     
     So: at the top → everything full/normal size; on scroll → the bar
     pins and shrinks to the slim R-01 look. Scoped to R-02.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v3.0.0 — R-01 Gender filter + status row shade
     ---------------------------------------------------------
     Standalone. Paste before </body>. First two wins of the big update:
     
       1. GENDER filter in R-01 KPI/filter bar, inserted AFTER
          Nationality. Populated from window.DB.visaRecords genders,
          "All" default. Filters the ALL VISA RECORDS table rows by
          gender (intersects with the other filters). Styled like the
          existing R-01 selects.
     
       2. STATUS ROW SHADE — each row in ALL VISA RECORDS gets a light
          tint of its status color so you can identify status at a
          glance:
            USED → light blue · UNUSED → light green ·
            ALLOCATED → light gold · EXPIRED → light red ·
            CANCELLED → light grey
          Reads the STATUS column per row; re-applies on re-render.
     
     Scoped to R-01; fails safe if pieces aren't found.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v3.1.1 — R-01 View Data editor (CRASH FIXED)
     ---------------------------------------------------------
     REPLACES v3.1.0. Standalone. Paste before </body>.
     
     CRASH CAUSE (v3.1.0): with 2,318 filtered visas, each row's
     "Linked Case" was a <select> containing every R-02 candidate
     (~1,100 options) → ~2.6 MILLION <option> nodes → freeze/crash.
     
     FIXES:
       • Linked Case + Status now use ONE shared <datalist> each
         (built once), referenced by lightweight <input list="…">.
         → ~1,100 total option nodes instead of millions.
       • The grid body is built as a SINGLE innerHTML string (fast),
         with EVENT DELEGATION (one set of listeners on the grid) —
         no per-cell listeners across ~46k inputs.
       • Chunked rendering for very large sets (keeps UI responsive),
         plus a soft cap notice at 5,000 rows.
       • Date cells: type dd/mm/yyyy, or click 📅 to open a
         temporary calendar (created on demand, not 2,318 hidden
         inputs).
     
     Same features: filtered load, edit any cell, paste from Excel,
     auto-link by passport, Save / Clear / Export Report (real .xlsx).
     =========================================================
```

```text
=========================================================
     ENTERPRISE v3.2.0 — R-02 "View Data" editor (Phase 2b)
     ---------------------------------------------------------
     Standalone. Paste before </body>.
     
     Adds a "View Data" button to R-02 ALL CANDIDATES (top-right,
     next to the search). Opens the CURRENTLY-FILTERED recruitment
     cases in a full editable spreadsheet grid — same engine as the
     R-01 editor (shared datalists + event delegation = no crash),
     adapted to candidate fields.
     
       • Headers = the candidate model, WITHOUT an Actions column:
         Name · Passport · Iqama · Nationality · Position · Request
         Date · Client · Status · Type · Visa Cat. · Agency · Basic ·
         Food · Housing · Transport · Special · Total (auto).
       • STATUS (stage) & TYPE (recruitment type) are type-ahead
         lists (one shared <datalist> each — no per-row option
         explosion).
       • Salary columns are numeric; TOTAL auto-recomputes per row.
       • Dates: type dd/mm/yyyy or click 📅 (picker on demand).
       • Paste a block from Excel to fill many cells/rows (auto-grow).
       • Save (updates existing + inserts new candidates), Clear,
         Export Report (real .xlsx: blue title/headers, freeze,
         auto-filter, IDs as text).
     
     Non-destructive: reads window.DB.recruitmentCases; writes only
     on Save. Scoped to R-02; fails safe.
     =========================================================
```

```text
=========================================================
     SAFWAT UNIVERSAL EXPORT + R-02 date-column fixes  v4.0.0
     ---------------------------------------------------------
     REPLACES v3.2.7 (R-02 dates). Requires EntCore + v3.2.0 R-02
     View Data. Paste before </body>.

     WHY: exports were inconsistent — R-01 View Data used a styled
     template (merged TITLE row, styled header, styles.xml, freeze at
     row 3, sized columns) while R-02 and Project D used a plain one
     (no title, no styles). This publishes ONE canonical exporter,
     matching R-01 exactly, and routes R-02 + Project D through it.

       window.EntExport.xlsx(heads, rows, title, sheetName, fileName)
       window.EntExport.fromGrid(tableEl, title, sheetName, fileName)

     Canonical template (verified against R-01's code):
       • Row 1  — TITLE, merged A1:<last>1, style s=1
       • Row 2  — header row, style s=2, autoFilter starts here
       • Row 3+ — data, style s=3
       • Freeze ySplit=2 (top-left A3); column width 20 if the header
         is longer than 12 chars, else 14; styles.xml included
       • Robust download (anchor appended to DOM, delayed revoke)

     R-02 FIXES in the same file:
       1) Removed the DUPLICATE "Request Date" column (the grid
          already has one) — from the grid AND the export.
       2) The × remove button is moved to the END of every row, so it
          no longer sits in the middle of "Work Started to Client".
       3) R-02 Export Report now uses the universal template and
          de-duplicates repeated headers.
     12 date columns remain: Selection Date · Offer Sent · Offer
     Signed · Medical Outset · Medical Result · SVP/QVP Outset ·
     SVP/QVP Result · Biometrics Outset · Biometrics Result ·
     Arrival in KSA · Arrived in Accommodation · Work Started.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v3.3.0 — R-02 single Recruitment Case edit form (Phase 3)
     ---------------------------------------------------------
     Standalone. Paste before </body>.
     
     A sectioned edit form for a single recruitment case, matching
     your image 4:
       • CANDIDATE PROFILE — Name, Nationality, Passport #, Position,
         Email, Phone #
       • STATUS & CLASSIFICATION — Client, Status (Stage),
         Recruitment Type, Position
       • OVERSEAS DETAILS — Visa Category, Agency
             (shown ONLY when Recruitment Type is Overseas)
       • LOCAL TRANSFER DETAILS — Iqama #, IBAN #
             (shown ONLY when Recruitment Type is Local Transfer)
       • PIPELINE — all dates: Request, Selection, Offer Sent/Signed,
         Medical Outset/Result, SVP/QVP Outset/Result, Biometrics
         Outset/Result, Arrival in KSA, Arrived in Accommodation,
         Work Started to Client
       • SALARY (SAR) — Basic, Food, Housing, Transport, Special,
         Total (auto)
     
     It OPENS when you click a candidate's Edit action in R-02 (the
     form intercepts the base edit), and can also be opened via
     window._entEditCase(recordOrId). Datalists for Client / Position
     / Nationality / Agency / Visa Category (type-ahead). Dates use a
     native picker (dd/mm/yyyy display kept if you type it). Save /
     Cancel. Non-destructive: writes only on Save.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v3.2.4 — editable combo dropdowns (self-healing)
     ---------------------------------------------------------
     REPLACES v3.2.1 / v3.2.2 / v3.2.3.  ⚠ IMPORTANT: also REMOVE the
     v3.2.1 and v3.2.2 blocks from index.html — if they stay, they
     convert the cells to <select>/datalist and fight this combo.
     Paste before </body>. Keep v3.2.0.
     
     Editable COMBO on: Nationality · Position · Client · Status ·
     Type · Visa Category · Agency  →  pick from list, type to filter,
     type a NEW value, paste, ↑/↓/Enter/Esc.
     
     SELF-HEALING (fixes "dropdown not working again"):
       • If an older patch turned a cell into <select class="cv-sel">,
         this converts it BACK to a plain <input> (keeping value +
         data-f/data-k) so the combo can attach.
       • If a cell has a native list="…" (datalist), it is removed.
       • Cells are (re)marked as combos via a MutationObserver — no
         perpetual timer, no fluctuation.
       • window._entComboDiag() reports each combo cell's state.
     Under the hood cells stay <input> so Save / Export / paste /
     duplicate-check keep working. One shared floating panel = fast.
     =========================================================
```

```text
=========================================================
     SAFWAT PROJECT D — CEO DASHBOARD  v3.6.0
     ---------------------------------------------------------
     REPLACES v3.5.5 (remove that block). Paste before </body>.
     Includes R-03/R-04 manager grids + the #ceo route.

     FIXES
       • ZEROS FOR CEO/MANAGERS — root cause: v3.5.5 fetched the DB
         without ensuring a signed-in session. Your RTDB rule allows
         read when auth != null (anonymous counts). If the viewer
         wasn't signed in, the read was denied and everything showed 0.
         Now: wait for auth state → if no user, signInAnonymously() →
         then fetch. If auth truly fails, it shows a clear banner
         instead of silently displaying zeros.

     NEW ON THE HOME VIEW (before the 3 project tiles)
       • STATUS PER COMMERCIAL REGISTRATION (CR # · Sponsor ID · Used ·
         Unused · Allocated · Expired · Cancelled · Total · Utilization)
         + Export Excel.
       • VISA USAGE PER BLOCK — every visa block with Used/Unused/
         Allocated/Expired/Cancelled/Total, searchable + status filter,
         + Export Excel.
       • CLIENT LEADERBOARD — offers, medical, SVP/QVP, biometrics,
         attrition, mobilized, active, total, accomplished %.
       • PIPELINE CHARTS — By Recruitment Type · By Stage Category ·
         Top Nationalities · Top Positions (pure CSS/SVG, no Chart.js
         dependency, so they always render in the #ceo view).

     REMOVED AS REDUNDANT
       • "Additional KPIs" card (its numbers are already in Overall
         Performance Indicators).

     All aggregations simulated & passing (15/15).
     =========================================================
```

```text
=========================================================
     ENTERPRISE v3.6.7 — duplicate detection (SAFE, no deletes)
     ---------------------------------------------------------
     REPLACES v3.6.6 (and all earlier v3.6.x). Standalone. Paste
     before </body>.
     
     ⚠ CRITICAL FIX (data-loss bug in v3.6.6):
       When TWO real existing records shared a passport (e.g., two
       HARSHAL records with Z5514814), each flagged the OTHER as a
       duplicate, and "Discard" deleted BOTH → the original was lost.
     
     THIS VERSION NEVER DELETES EXISTING RECORDS.
       • Detection still flags rows whose PASSPORT/IQAMA matches a
         DIFFERENT existing record, or an earlier row in the batch
         (name never flags — different people can share a name).
       • Save with duplicates → saves everything (updates existing +
         inserts new). No deletions.
       • "Skip NEW duplicates & save" (replaces Discard) → saves all
         rows EXCEPT brand-new/pasted rows that duplicate something.
         Existing records are ALWAYS kept and updated — never removed.
       • Two existing records sharing a passport are KEPT (both), with
         the warning shown so you can review/merge manually.
     
     Self-persists to window.DB + dbSave() + refresh, with a real
     "N updated · M added · K skipped" toast. deleted is always 0.
     Works on View Data (data-f) and Add multi grid (data-k).
     =========================================================
```

```text
=========================================================
     SAFWAT PROJECT D — CEO DASHBOARD  v3.7.1  (Executive layer)
     ---------------------------------------------------------
     REPLACES v3.7.0. ADD-ON to v3.6.0 (keep v3.6.0). Paste AFTER it,
     before </body>. All logic simulated & passing (24 + 20 checks).

     CHANGES vs v3.7.0
       • KPI icons REMOVED — clean, text-only executive cards.
       • FILTER BAR ADDED — 8 dashboard filters that drive the whole
         executive layer, combining with the time range:
             Project · Client · Nationality · Position ·
             Agency · Stage · Recruitment Type · Gender
         Options are built from your live data (deduped + sorted).
         Shows an active-filter count and a "✕ Clear filters" action.
         Case-only dimensions (Position / Stage / Type) intentionally
         do NOT drop visa records, so visa KPIs stay meaningful.

     RETAINS
       1) Time-range strip (All Time | Y | Q | M | W | D) with prev/
          next, "Showing…", Back to live, Reset.
       2) Executive KPI strip — % of total sub-lines, ▲/▼ trend vs the
          previous equivalent period, Deployment Rate with an 85%
          target and signed variance.
       3) Needs Attention — expired-but-active visas, visas expiring
          ≤30 days, candidates idle >60 days, allocated visas with no
          linked candidate. Clickable → record list → export.
       4) Age of Open Items — 0-7 / 8-15 / 16-30 / 31-60 / >60 buckets
          over OPEN candidates, >60 in red, clickable → list → export.

     Perf: one pass per (range + filters), cached. Pure CSS/SVG.
     Dates parsed Gregorian-only so Hijri QIWA values are never
     miscounted.
     =========================================================
```

```text
=========================================================
     ENTERPRISE v3.7.1 — VUPB Export: Client checkbox picker
     ---------------------------------------------------------
     Add-on to the VISA USAGE PER BLOCK section. Paste before </body>.
     Keep your existing VUPB build (v2.9.50 etc.).
     
     Behaviour you asked for:
       • Clicking "Export Excel" on VISA USAGE PER BLOCK now first
         opens a POPUP listing each CLIENT (Project) with a CHECKBOX.
       • The client list is derived from the CURRENTLY-FILTERED block
         table (so it already respects the Status + all filter-bar
         selections above). Only those clients appear.
       • You tick the clients to include, then "Export Selected".
       • The workbook contains ONLY the checked clients' rows, across
         the SAME sheets: INDEX · All Data · SUMMARY (Client) ·
         SUMMARY (Nationality) · SUMMARY (Agency) · SUMMARY (Category)
         — freeze panes, auto-filter, nav bar, opens on INDEX.
     
     It intercepts the existing #vupbExport button (capture phase) so
     nothing else changes. Reads the live VUPB table (already filtered).
     =========================================================
```

```text
=========================================================
     SAFWAT PROJECT D — CEO DASHBOARD  v3.8.1  (corrections)
     ---------------------------------------------------------
     REPLACES v3.8.0. Layered over v3.6.0 (+ v3.7.1). Paste AFTER
     them, before </body>. All logic simulated & passing (15/15).

     CORRECTIONS vs v3.8.0
       1) "CASES" on the project tiles now means R-03 CASES —
          complaints / post-joining issues recorded in Manage Cases
          (R-03) — NOT the candidate count. Counted from
          DB.ceoCases per project. The tile is clickable-safe and a
          "Cases (R-03)" row is also added to Overall Performance
          Indicators.
       2) "ISSUED VISAS" now counts USED visas only for that client
          (previously USED + ALLOCATED). Applies to the tiles, the
          Overall Performance Indicators row, and the per-project
          Executive Summary card.
       3) UPCOMING EXPIRATIONS rebuilt as a GROUPED TABLE, matching
          the requested layout:
            Visa Doc # · Sponsor ID · Category · Nationality ·
            City (Stamping) · Gender · Client · Quantity · Days Left
          Quantity = how many visas in that group; Days Left = the
          soonest-expiring visa in the group. Window selector
          (30/60/90/180/365 days), live counts in the header, sorted
          by soonest expiry, Export Excel via the universal template.
     =========================================================
```

```text
=========================================================
     SAFWAT PROJECT D — CEO DASHBOARD  v3.9.3
     ---------------------------------------------------------
     REPLACES v3.9.2. Paste AFTER v3.6.0 / v3.7.1 / v3.8.1,
     before </body>. All logic simulated & passing (19/19).

     1) CLIENT LEADERBOARD moved to sit directly AFTER
        "Schedule — Arrivals & Government Appointments".

     2) "MOBILIZATION / MOBILIZED" renamed to "MOBILIZATION", and it
        now counts a candidate once they genuinely have a mobilization
        date OR an arrival in KSA — i.e. Work Started, Mobilization
        Date, Arrival in KSA (any of them already reached) or stage
        DEPLOYED.

     3) THE CONFLICTING "ARRIVED" NUMBERS — fixed at the root.
        The tile said 313, the Executive Summary said 311 arrived /
        310 accommodation, and none of them checked whether the date
        had actually happened: the code counted any record that
        merely HAD a date, including dates months in the future.
        New single rule used everywhere:
          • a date COUNTS only if it is today or already past;
          • a FUTURE arrival date is not "arrived" — that candidate is
            counted under FOR DEPLOYMENT instead;
          • once someone has arrived they are no longer "for
            deployment".
        The project tiles, the Executive Summary cards, Overall
        Performance Indicators and the arrival lists now all derive
        from that one rule, so they agree.
     =========================================================
```

```text
=========================================================
     SAFWAT R-02 — Bulk Edit dates + paste blank-cell fix  v4.0.1
     ---------------------------------------------------------
     ADD-ON to v4.0.0 (keep it). Requires EntCore. Paste before
     </body>, AFTER the v4.0.0 block.

     FIX 1 — PASTE NOW MIRRORS EXCEL EXACTLY (blank stays blank).
       Root cause: when Excel copies a block, trailing empty cells are
       often OMITTED from a row (e.g. "2026-01-01\t\t" can arrive as
       just ["2026-01-01"]). The old loop iterated only the cells that
       were present, so the remaining columns kept their PREVIOUS
       values — which looked like a date had been "pasted" into a cell
       that should have been blank.
       Now the paste computes the clipboard's widest row and writes
       EVERY column in that span: a missing or empty cell is written
       as BLANK. Verified: the stale values are cleared.

     FIX 2 — BULK EDIT gains the three missing pipeline dates:
       Arrival in KSA · Arrived in Accommodation · Work Started to
       Client. They are appended to the existing "Pipeline dates"
       section, follow the same tick-to-apply rule as every other
       field, and are written to the selected candidates on Apply
       (via dbSave + audit). Unticked fields are never touched.
     =========================================================
```

```text
=========================================================
     SAFWAT CORE — STAGE 1: EntCore  (consolidation, v4.1.0)
     ---------------------------------------------------------
     This ONE module replaces ~12 scattered patch blocks and
     collapses ~15 competing setInterval loops into a single
     shared heartbeat. It is the foundation the other consolidated
     modules (R-01, R-02, VUPB, CEO, CRUD) will register onto.
     
     ▶ SAFE TO DELETE from index.html once this is in place
       (these are fully superseded — remove their whole <script>
       blocks, identified by their console banners):
         • v2.5.2  Role-based nav visibility          (folded into EntCore.role)
         • v2.8.31 Persistent super admin             (folded in)
         • v2.8.38 handling / v3.5.3 / v3.8.0 nav      (folded into EntCore.nav)
         • v3.8.1  presence prune + nav unlock         (folded in)
         • v2.9.60 ALL VISA RECORDS permanent guard    (folded into EntCore heartbeat)
       (Keep the base app's own v2.8.38 block itself — EntCore
        neutralizes its forced .click(); it does not need removal.)
     
     Provides one global:  window.EntCore
        .every(id, fn, ms)   → registered task on the shared heartbeat
        .clear(id)           → remove a task
        .isAdmin()           → role helper
        .onReady(fn)         → run when DB + auth are ready
     Plus managed:  presence prune, nav-unlock, super-admin, records-guard.
     
     No behaviour change for users — same protections, far less CPU.
     =========================================================
```

```text
=========================================================
     SAFWAT FIXES v4.1.1 — Upcoming Expirations: NO FLICKER
     ---------------------------------------------------------
     REPLACES v4.1.0. Requires EntCore. Paste before </body>,
     AFTER v3.8.1. All logic simulated & passing (9/9).

     WHY v4.1.0 FLICKERED
       Two modules were fighting over the same area: my block removed
       the older "UPCOMING EXPIRATIONS — GROUPED BY QUANTITY" section,
       the older module immediately re-inserted it, and on the next
       heartbeat mine removed it again. That remove/re-insert loop was
       the fluctuation you saw — and it also produced the nested
       container in the screenshot.

     THE FIX — stop fighting over the DOM
       • The legacy block is HIDDEN with a CSS rule (injected once).
         Nothing is deleted, so nothing can be re-inserted in a loop.
       • My container renders ONCE, then only re-renders when the
         data signature or the selected window actually changes.
       • Rendering is suspended while you are interacting with the
         section (using the window dropdown), so it can never redraw
         under your cursor.
       Result: after the first paint there are zero DOM writes unless
       something genuinely changed.

     Also retained from v4.1.0: visa↔candidate auto-link by passport,
     VISA ISSUED counted in the Deployed/Visa Issued KPI, and a forced
     refresh after View/Edit Data saves.
     =========================================================
```

```text
=========================================================
     SAFWAT R-02 — filters & search  v4.2.4
     ---------------------------------------------------------
     REPLACES v4.2.0 / v4.2.1 / v4.2.2 / v4.2.3. Requires EntCore.
     Paste before </body>, AFTER v2.9.72. Simulated & passing (13/13).

     BOTH BUGS HAD ONE ROOT CAUSE — my filter wrapper was MUTATING
     the search input. To bypass the base app's name-only search it
     set searchEl.value='' and then restored it on every call.

       • Ctrl+A THEN BACKSPACE DIDN'T CLEAR THE BOX. Blanking and
         restoring the value resets the caret and destroys the
         selection, so your "select all" was gone before Backspace
         landed — deleting a single character instead.
       • ALL CANDIDATES FLUCTUATED AFTER PICKING AN AGENCY. Changing
         the Agency filter re-renders the pipeline, which calls the
         wrapper, which mutated the input twice per call — each
         mutation triggering further work. That was the flicker.

     THE FIX — never touch the input.
       The wrapper now READS the typed text and filters AFTER the
       base call, re-expanding from the unfiltered set so the base's
       name-only rule cannot narrow things first. Zero writes to the
       search box: the caret, the selection and Ctrl+A all behave
       normally, and no render loop can start.
       Agency changes trigger exactly ONE render, and the
       All-Candidates search stays debounced with a cached index.
     =========================================================
```

```text
=========================================================
     SAFWAT CONSOLIDATION #1 — R-01 Filters (Agency + Gender) v4.2.5
     ---------------------------------------------------------
     REPLACES v4.2.4. Requires EntCore. Paste before </body>.
     
     Fix from your screenshot:
       • AGENCY now appears in the STICKY BAR again. The base sticky
         bar (v2.8.25) mirrors a HARDCODED filter list that never
         included Agency (it was added later by the old v2.8.41 which
         you deleted). This version injects a sticky "Agency" mirror
         (after Sponsor, before Search — matching the main row), two-
         way synced with the main #visaFilterAgency — exactly like the
         Gender mirror already added.
     
     Keeps everything from v4.2.4: agency + gender data-level filtering
     (KPIs/charts/table), dynamic exclude-self options, gender inline &
     aligned to the Nationality cell, no fluctuation, sticky Gender.
     On EntCore's single heartbeat.
     =========================================================
```

```text
=========================================================
     SAFWAT R-01 — restore VUPB + Upcoming Expirations  v4.3.0
     ---------------------------------------------------------
     Paste before </body>, AFTER all v3.8.x / v4.1.x blocks.
     Simulated & passing (8/8).

     WHAT WENT WRONG (my fault, plainly)
       v2.9.50 already owns and renders BOTH sections correctly —
       #vupbSection (rendering into #vupbBody) and #vexpSection
       (rendering into #vexpBody) — and it honours the R-01 filters,
       the section Status control and the search box.
       My later modules then fought it:
         • v3.8.1 patchVUPB did sec.innerHTML='' and rebuilt the
           section. That DELETED #vupbBody, so v2.9.50's renderer had
           nothing to render into → the VISA USAGE PER BLOCK table
           vanished while the header, Status, search and the
           "445 block(s) · 2358 visas" counter remained.
         • v4.1.x created its own #v41Exp expirations container and
           hid the legacy one, producing the nested box — and because
           it computed from raw visa records while the legacy block
           computes from the FILTERED set, the two disagreed
           ("252 in window" vs "0 group(s) · 0 visas").

     THE FIX — stand down and give each section ONE owner
       1. Delete my #v41Exp container (once, not on a heartbeat).
       2. Un-hide the legacy blocks I had hidden.
       3. Disable the modules that rebuild these sections so they
          cannot wipe them again.
       4. Re-create #vupbBody / #vexpBody if a previous wipe removed
          them, then trigger one render so v2.9.50 repaints.
       Everything runs ONCE, guarded, with no polling loop — so there
       is nothing left to flicker.

     NOT TOUCHED: the R-01 filters, Status per CR, KPI cards, the
     visa table, and every R-02 / Project D fix stay exactly as they
     are.
     =========================================================
```

```text
=========================================================
     SAFWAT R-00 CONTROL CENTER  v4.3.1  — registers as EntHealth
     ---------------------------------------------------------
     REPLACES v4.3.0. Requires EntCore. Paste before </body>. ADD-ON —
     changes no existing R-00 code. Registers as window.EntHealth
     (fills the app's own dangling hook, called on every cloud sync).
     
     FIX in this version (from your report):
       • Search no longer "fluctuates" and the list no longer jumps
         to the top while scrolling. Cause: the heartbeat re-rendered
         the whole panel every 1.5s whenever R-00 was visible, wiping
         the search box + resetting scroll. Now it re-renders ONLY
         when the DB actually changes, and NEVER while you're typing
         or scrolling (a short interaction cooldown suspends redraws).
         Typing updates only the results tbody — never the panel.
     
     Panels: A) Data Health (dial + integrity checks) · B) Data
     Control (global search + safe bulk hygiene) · C) Governance
     (recent changes · export health CSV · snapshot). Reuses your
     EntBackups / Audit / openCaseForm / openVisaForm / dbSave.
     Safety: snapshot-first, count-invariant (never deletes), audited.
     =========================================================
```

```text
=========================================================
     SAFWAT R-01 Sticky-bar return fix  (v4.4.0)
     ---------------------------------------------------------
     Requires EntCore. Paste before </body>. Small companion fix —
     does NOT replace v2.8.25/26; it just re-evaluates their state.
     
     Problem: R-01's sticky filter/KPI bar (#entStickyVisaBar, toggled
     by class .ent-sticky-active via an IntersectionObserver on a
     sentinel) does not appear when you switch AWAY from R-01 and come
     BACK while already scrolled down — because the IntersectionObserver
     doesn't re-fire on tab return until you scroll. You had to scroll
     up then down for it to show.
     
     Fix: when R-01 becomes visible again (tab click / hashchange /
     panel shown), immediately RE-EVALUATE whether the sentinel is
     already above the viewport top and set .ent-sticky-active
     accordingly — so the bar shows right away if you were scrolled
     down, or stays hidden if you're at the top. Also hides it when
     leaving R-01. Logic simulated & passing. On EntCore heartbeat.
     =========================================================
```

```text
=========================================================
     SAFWAT FIXES v4.4.0 — expirations · agency · cleanup
     ---------------------------------------------------------
     Paste before </body>, AFTER every v3.8.x / v4.x block.
     Simulated & passing (12/12). No heartbeat rendering.

     1+2) UPCOMING EXPIRATIONS — duplicated, nested, and the header
          said 286 when only 6 visas were listed.
          Cause: THREE modules render this section (legacy v2.9.50,
          my v4.1.x container, and the v3.8.1 patch). They nest inside
          one another and repaint at different moments, which is why a
          block "sometimes disappears then reappears". The 286 came
          from a header that counted EVERY unused/allocated visa with
          an expiry date, while the table counted only those inside
          the selected window (6).
          FIX: exactly ONE renderer owns the section. Every other copy
          is neutralised, and the header count is taken from the SAME
          filtered array that builds the table — so the number can
          never disagree with the rows again.

     3) R-02 AGENCY FILTER — still listed every agency and jumped back
        to the top of the list while scrolling.
        Cause: the options were populated before the filter wrapper
        was installed (so nothing narrowed them), and the <select> was
        rebuilt while it was open, which resets its scroll position.
        FIX: options are rebuilt from the wrapped, filtered set, and
        NEVER while the list is open or when the options are
        unchanged.

     4) Removes the "Export filtered rows (.csv)" and
        "Print / save as PDF" buttons.
     =========================================================
```

```text
=========================================================
     SAFWAT FIXES v4.5.0 — connected fields · expirations header · agency
     ---------------------------------------------------------
     Paste before </body>, AFTER v4.4.0 (keep v4.4.0).

     1) VIEW/EDIT DATA, EDIT FORM AND TABLE NOW SHARE THE SAME DATA
        Verified in the code: the Edit Visa form reads
        `candidateVisaDate`, but View/Edit Data writes
        `candVisaIssuance` / `candVisaExpiration`. So a value saved in
        one place never appeared in the other.
        A sync layer now keeps each pair in step on every record:
          candVisaIssuance   <-> candidateVisaDate
          candVisaExpiration <-> candidateVisaExpiration
          delegationDate     <-> ratificationDate
        It only FILLS an empty partner field — it never overwrites an
        existing value — then saves once and refreshes the views.
        Candidate Visa Expiration is also computed (+90 days) whenever
        an issuance date exists but no expiration does.
        Linked Case: when a visa has linkedRecruitmentCaseId set, the
        candidate's linkedVisaId is filled in too (and vice versa).

     2) "286 IN WINDOW" — ROOT CAUSE FOUND
        The base renderVisaExpiryTable (v2.8.0) rewrites EVERY <h3>/<h4>
        that starts with "Upcoming expirations" using its own count.
        Our heading is changed to a non-heading element, so the base can
        no longer overwrite it. The count now always matches the rows.

     3) R-02 AGENCY OPTIONS
        v2.9.72 kept writing the full agency list into the dropdown.
        Options are now computed straight from the other visible
        filters, and writes from any other module to this dropdown are
        ignored — no fight, no flicker. Never rebuilt while open.

     4) "Year looks off" no longer appears under Hijri QIWA dates in
        the Edit Visa form.
     =========================================================
```

```text
=========================================================
     SAFWAT FIXES v4.6.0 — MOFA sync · Cand. Visa +90 bug · Hijri expiry
     ---------------------------------------------------------
     Paste before </body>, AFTER v4.5.0 (keep v4.5.0).

     1) MOFA APPLICATION NUMBER NOT CONNECTED
        View/Edit Data writes `mofaNumber`; the Edit form and the ALL
        VISA RECORDS table read `mofaApplicationNumber`. Now synced:
        whichever screen you save on wins for that record, and empty
        partners are filled everywhere else.

     2) CAND. VISA EXPIRATION WAS WRONG IN VIEW DATA (my v5.5.0 bug)
        It read 11/09/2026 as 9 November instead of 11 September, so
        +90 days gave 07/02/2027 instead of 10/12/2026. Reproduced
        exactly. The grid now recalculates day-first, matching the
        Edit form.

     3) 842 VISAS HAVE A HIJRI QIWA EXPIRATION (e.g. 1449/06/25)
        `expirationDate` must be Gregorian — Upcoming Expirations,
        Days Left and auto-expire all do date maths on it. My v5.4.7
        save step wrote the Hijri display value back into it.
          • PREVENTION: from now on, any Hijri value in the expiration
            column is converted to Gregorian before View Data saves.
          • REPAIR: a "Data Repair" card in R-00 (super admin). Preview
            first, then Apply: takes a backup snapshot, converts only
            those expirations with the app's own Hijri converter (the
            original is kept in `expirationDateHijri`), corrects any
            wrong Cand. Visa Expirations, and fills MOFA partners.
            Never deletes, never changes record count, one save, audited.
     =========================================================
```

```text
=========================================================
     SAFWAT CRUD LAYER — STAGE 1: Live validation + Save status  v5.0.0
     ---------------------------------------------------------
     Requires EntCore. Paste before </body>. ADD-ON — changes no
     existing form code. The first piece of the "user can't complain"
     CRUD layer.
     
     What it adds (reuses the app's own dormant infrastructure):
       1. LIVE INLINE VALIDATION on every edit form (Add/Edit Case,
          Add/Edit Visa, R-02 single edit rc_*, Unified Add Visa v51_*).
          As you type, each field shows a green/amber/red state + a
          short message, using the base app's EXISTING .ent-field-error
          / .ent-field-warn / .ent-field-msg CSS (defined but unused).
          Rules (verified by simulation):
            • name / fullName → required (red if empty)
            • passport → format check (length, chars)
            • iqama → 10-digit check
            • dates → validity + sane year
            • expiry dates → expired / expiring-soon warnings
            • salaries → numeric, non-negative
          Non-blocking by design: warnings never stop you; only truly
          empty REQUIRED fields turn red (the form's own Save still
          decides — we just surface issues clearly).
       2. SAVE-STATUS PILL — a small top-right indicator that reflects
          the app's save state: "Saving… / Saved ✓ / Offline — queued",
          driven by wrapping window.dbSave (non-invasively).
     
     Form-agnostic: detects fields by id prefix (cf_ / vf_ / rc_ /
     v51_ / bav_) and by data-f in the View Data grids. On EntCore's
     heartbeat; idempotent; fails safe.
     =========================================================
```

```text
=========================================================
     SAFWAT R-01 QUICK FIXES — Phase 1  v5.1.0
     ---------------------------------------------------------
     Requires EntCore. Paste before </body>. ADD-ON — changes no
     existing code. Three requested changes:
     
       A) VIEW DATA button is moved INLINE, right after the ALL VISA
          RECORDS search bar (top-right), instead of sitting alone
          below the table.
       B) Removes the "Export filtered rows (.csv)" and "Print / save
          as PDF" buttons under ALL VISA RECORDS (they don't fit).
       C) QIWA date fields no longer show "Year looks off" — they are
          HIJRI, so the CRUD validator (v5.0.0) now treats any field
          named *qiwa*/qiwaVisaDate as Hijri (accepts yyyy/mm/dd,
          skips the Gregorian year check). Validated.
     
     Scoped to R-01 (#panel-visa). Idempotent; on EntCore heartbeat.
     The remaining requested items (Agency-Deleg mapping, column
     dropdowns, Linked-Case overflow, Hijri toggle, QIWA-Expiration
     lock, same-Doc# autofill) are Phase 2/3.
     =========================================================
```

```text
=========================================================
     SAFWAT R-01 View Data FIXES — Phase 2  v5.2.1
     ---------------------------------------------------------
     REPLACES v5.2.0. Requires EntCore + v3.1.1 View Data editor.
     Paste before </body>. ADD-ON — patches the LIVE grid.
     
     Fixes vs v5.2.0 (from your screenshots):
       • VIEW DATA BUTTON no longer overlaps the search. Instead of a
         hard-coded offset, it now MEASURES the search box and places
         the button just LEFT of it (dynamic, so any search width is
         handled). Verified.
       • LINKED CASE is now READ-ONLY and AUTO-LINKED. Per your intent,
         the system links each visa to its recruitment case by itself
         (explicit link if present, else match by passport) and shows
         it as locked text — no editable field, so nothing spills
         outside the modal and no human interaction is needed.
     Still includes: Agency Deleg. # mapping fix + dropdowns for
     Stamping City / Gender / Registered Agency / Status.
     
     Scoped to #vdOverlay / #vdGrid. Idempotent; on EntCore heartbeat.
     =========================================================
```

```text
=========================================================
     SAFWAT R-01 QIWA Hijri/Greg toggle — reliability fix  v5.3.0
     ---------------------------------------------------------
     Requires EntCore. Paste before </body>. ADD-ON — reuses the
     app's existing toggle (v2.8.15 getQiwaMode/setQiwaMode +
     #entQiwaModeBadge); does NOT rebuild it.
     
     Problem (verified from code): the QIWA HIJRI/GREG badge lives
     inside the visa table <thead>, which v2.8.15 marks as built and
     won't rebuild. There are also multiple competing render paths
     (base renderVisaAll, v2.8.37 directRenderVisa, v2.8.40
     fullVisaRender). So the badge's click listener can get detached
     on a header rebuild, or the new mode isn't re-read by whichever
     render path fires next → "sometimes nothing happens" until you
     touch a filter.
     
     Fix (small, reuses existing functions; simulated & passing):
       • DELEGATED click handler on #entQiwaModeBadge (document-level,
         capture) so it survives ANY header/table rebuild.
       • On click: flip the mode via the app's own setQiwaMode (or a
         localStorage fallback with the same key), update the badge
         label, then force the CANONICAL full re-render through the
         first available path: _entDirectRenderVisa → refreshVisaView
         → renderVisaAll. So every click re-reads the mode and the
         QIWA columns always update.
       • Guards against double-binding; on EntCore heartbeat only to
         keep the badge label in sync (no perpetual re-render).
     =========================================================
```

```text
=========================================================
     SAFWAT R-01 View Data — Phase 3  v5.4.7  (NON-DESTRUCTIVE)
     ---------------------------------------------------------
     REPLACES v5.4.2..6. Requires EntCore + v3.1.1 View Data editor +
     app Hijri module. Paste before </body>.
     
     Fixes (all simulated & passing):
       1) AGENCY DELEG. # + DELEGATION DATE now PERSIST. v3.1.1's save
          reads cells by its own COLS map; our earlier fix re-pointed
          the Agency Deleg. cell to agencyDelegationNumber, which
          v3.1.1's save didn't know about — so it never saved. This
          version adds a SAVE HOOK that writes agencyDelegationNumber
          and delegationDate straight from their cells to the record
          (then dbSave), so edits stick. (They aren't columns in the
          ALL VISA RECORDS table, but now reopening View Data shows
          them, and the data is stored.)
       2) DELEGATION DATE no longer autofills — only QIWA Visa Date
          propagates to same-Doc# rows.
       3) CLEARING A QIWA DATE now clears it on EVERY same-Doc# row
          too (the clear propagates).
       4) YOU CAN NOW REMOVE A QIWA DATE. Clearing the input sets the
          canonical to empty, blanks the (locked) expiration, and the
          save-guard writes empty — so the value no longer "comes
          back" after save, and the expiration no longer lingers.
     
     Still safe: canonical-Hijri storage, no overwrite on load,
     compact picker, defaults to today, Deleg/Cand-Issuance pickers.
     =========================================================
```

```text
=========================================================
     SAFWAT R-01 View Data — Visa Number autofill bug fix  v5.4.8
     ---------------------------------------------------------
     Requires the v5.4.7 View Data module. Paste before </body>.
     Small surgical companion — no rebuild of v5.4.7.
     
     Bug: typing a VISA NUMBER in ALL VISA RECORDS — View/Edit Data
     filled every same-Doc# row's Visa Number with that value. Cause:
     v5.4.7's same-Doc# autofill set included visaNumber (and MOFA #),
     but those are UNIQUE PER VISA — each visa/person has its own —
     so they must never propagate.
     
     Fix (verified safe): a document-level, CAPTURE-phase change
     listener runs BEFORE v5.4.7's grid autofill and calls
     stopImmediatePropagation() ONLY for visaNumber / mofaNumber cells.
     The typed value stays in that one cell (change fires after the
     value is committed); the cascade is prevented. Save (reads DOM on
     click) and duplicate detection (passport) are unaffected. Genuine
     document-level fields (Sponsor ID, CR #, Category, Client, QIWA
     dates) still cascade normally.
     =========================================================
```

```text
=========================================================
     SAFWAT R-01 View Data — Phase 3b: Cand. Visa Expiration  v5.5.0
     ---------------------------------------------------------
     Requires EntCore + v3.1.1 View Data editor. Paste before </body>.
     ADD-ON — patches the LIVE grid; changes no base code. Field map
     confirmed from your console dump:
        Cand. Visa Issuance  → candVisaIssuance
        Cand. Visa Expiration → candVisaExpiration
     
     What it does (all logic simulated & passing):
       • Cand. Visa Expiration is now READ-ONLY + AUTO-COMPUTED as
         Cand. Visa Issuance + 90 DAYS (a fixed 90-day count, so it is
         leap-safe and unaffected by February’s 28/29 days — exactly
         the Saudi entry-visa rule you specified).
       • Editing the Cand. Visa Issuance instantly recomputes the
         expiration. The expiration cell is locked (no calendar
         picker, not typeable, greyed) so no one can override it.
       • Gregorian; format-preserving (dd/mm/yyyy, yyyy/mm/dd, or
         yyyy-mm-dd in → same format out). Empty issuance → blank
         expiration. Invalid input → blank (never crashes).
     
     Scoped to #vdGrid / #vdOverlay. Idempotent; on EntCore heartbeat.
     The stored value persists on Save (writes to candVisaExpiration).
     =========================================================
```

```text
=========================================================
     SAFWAT GLOBAL — Download / Export fix  v5.7.0
     ---------------------------------------------------------
     Standalone. Paste before </body>. Fixes EVERY "Export Excel"
     across R-01 and R-02 (and anywhere else) at the ROOT — one patch,
     no per-button changes.
     
     Why all exports broke: each exporter builds a Blob, creates an
     <a>, sets a blob: URL, and calls a.click() — but WITHOUT appending
     the <a> to the document, and often revokes the object URL
     immediately after. Modern Edge/Firefox SILENTLY IGNORE a blob
     download when the anchor is detached, and an immediate revoke can
     cancel an in-flight download. So the toast fires but no file saves.
     
     This module patches two browser primitives, safely & globally:
       1) HTMLAnchorElement.prototype.click — if the anchor is a
          DOWNLOAD anchor (has a download attribute) and is NOT in the
          DOM, it is briefly attached, clicked natively, then removed.
          Non-download clicks and already-attached anchors are
          untouched.
       2) URL.revokeObjectURL — deferred ~2s so a download that just
          started isn't cancelled by an immediate revoke. (Harmless:
          only delays garbage-collection of the temporary URL.)
     
     Verified: covers VUPB export, CR export, Upcoming Expirations,
     R-01/R-02 View Data exports — all call anchor.click(), so all are
     fixed at once. Idempotent; no dependencies.
     =========================================================
```

```text
=========================================================================
     C.L.A.I.R.E. — Centralized Logic And Intelligent Record Executive
     STEP 1 + 2 · Single save path + kernel + PRESENCE   v7.2.0   (was v7.1.1)
     v7.2.0 — CLAIRE BECOMES VISIBLE (additive, no save-path change)
       • ✦ dock bottom-right + status chip ("✦ CLAIRE · Saved 3 records…").
         The old top-right #entSaveStatus pill is hidden by CSS so only one
         status voice remains (the v5.0.0 wrapper still runs, harmlessly).
       • Panel (click ✦ or Alt+C): Status · Findings · Activity · Undo.
       • Findings = READ-ONLY scan of all records with her guardian rules
         (date pairs, one-way links, orphan links). Re-runs after each save.
         "Open" opens the record in the existing visa/candidate form.
       • First visit she introduces herself; afterwards a short online note.
       • Console additions: CLAIRE.open() · CLAIRE.scan() · CLAIRE.findings()
     v7.1.1 — meta is diffed too: the audit log (up to 2,000 entries with
       before/after copies) was re-sent whole on EVERY save; now only the new
       entries go. CLAIRE.saves() shows KB sent + read/write time per save.
     v7.1.0 — DELTA SAVES: when Firebase still holds exactly the version this
       tab last saw, CLAIRE sends ONLY the changed records (multi-path update,
       atomic with version + savedAt). Adds go as new rows; deletes/reorders
       send that list whole; any doubt (other writer, reloaded data, first
       save) → full write exactly as v7.0.1. CLAIRE.saves() shows which.
     -------------------------------------------------------------------------
     HOW TO INSTALL: in index.html, delete the whole block that starts with
     "C.L.A.I.R.E. … STEP 1 · Single save path + kernel     v7.1.1" (from its
     opening comment down to the end of its script tag) and paste THIS block in the
     same place — the last script before </html>.
     Kill switch: localStorage.setItem('claire.off','1'); reload.

     v7.0.1 — WHY (diagnostic, 18 Oct 2026)
       The legacy dbSave chain checks window._entCloudMode, which is FALSE in
       your sessions. So every dbSave() fell through to the old FILE save
       (no file open → returns false). The data only reached Firebase through
       a side effect: the old EntSync module pushed the whole DB ~0.8 s later,
       restarting the version at 1 each session and keeping savedAt stuck at
       10 Oct. That is why saves "failed" and the version dropped 18 → 1.
     FIX
       CLAIRE now writes to Firebase HERSELF (safwat/databases/main), the same
       way the working direct save does (your trySave() → version 2):
         • version = current + 1 (never resets), savedAt = now, real user
         • her own write is pre-registered with EntSync, so it is NOT
           re-applied to this tab as a "remote update" (no lost edits)
         • the old EntSync side-push no longer runs → ONE writer
         • failure → change stays pending, retried after 15 s and when the
           connection returns; the top-right pill shows the true state
       If Firebase isn't signed in/ready, she falls back to the legacy chain.
     Everything else (merge/skip/gather, kernel, guardians, undo) = v7.0.0.
     CONSOLE:  CLAIRE.status() · CLAIRE.saves() · CLAIRE.journal()
     =========================================================================
```

```text
=========================================================================
     C.L.A.I.R.E. — STEP 2.1 · "Align date pairs" action     v7.3.0
     -------------------------------------------------------------------------
     HOW TO INSTALL: paste this block DIRECTLY AFTER the CLAIRE v7.2.0 block
     (just before </html>). It needs window.CLAIRE (v7.2.0) and does nothing
     without it. When Step 3 rewrites the CLAIRE block, this folds into it.

     WHY (traced 18 Oct 2026)
       Each visa stores 3 dates twice (newer field ← older field):
         candVisaIssuance   ← candidateVisaDate
         delegationDate     ← ratificationDate
         candVisaExpiration ← candidateVisaExpiration
       • R-01 View Data (v5.5.0 + persistCorrectedFields) writes the NEWER
         fields. The original visa form writes the OLDER ones.
       • The v4.5.0 syncAll only fills an EMPTY partner and never overwrites,
         so once the two differ they stay different.
       • The older fields were stored 1 day early by the pre-v6.1.0 UTC bug.
       Confirmed: VR-000635 candidate visa date = 2024-12-01 = candVisaIssuance.

     WHAT IT DOES
       • Findings tab gets an "Align date pairs" bar → Preview → Apply.
       • Fixes ONLY pairs where the newer field is EXACTLY 1 day later:
         copies the newer date onto the older field. Anything else (−1 day,
         2+ days) is left in Findings for manual review.
       • Runs as ONE CLAIRE action ("visa.alignDatePairs"): admin only,
         one save, before-images kept → fully reversible from the Undo tab.
       Console: CLAIRE.alignPreview()
     =========================================================================
```

```text
=========================================================================
     C.L.A.I.R.E. — STEP 2.2 · Chat + Voice     v7.4.0  (+ v7.7.0 appearance)
     v7.7.0 — "dark mode" / "light mode" / "turn off dark mode" / "toggle theme"
       / "lights off" / "what mode am I in?" — typed or spoken. Uses the app's
       own dark mode (EntUI.setDark), so Settings and Ctrl+Shift+D stay in sync.
       Console: CLAIRE.theme('dark' | 'light' | 'toggle').
     -------------------------------------------------------------------------
     HOW TO INSTALL: paste this block AFTER the v7.3.0 "Align date pairs" block
     (just before </html>). Needs CLAIRE v7.2.0+ (window.CLAIRE + #clairePanel).
     Kill switch: localStorage.setItem('claire.chat.off','1'); reload.

     WHAT IT ADDS
       • "Chat" tab (first tab, default) in CLAIRE's panel. Not case-sensitive:
         "VR-635", "vr 000635", "Vr635" all find VR-000635; "UNUSED visas for
         neom" = "unused Visas For NEOM".
       • Understands: status · save · findings / re-check · align dates · undo
         · find by ID / name / passport · counts & lists with filters
         (status, client, nationality, category, agency, stage, position…)
         · visas expiring in N days/weeks/months · help · voice on/off.
         Filter values come from YOUR data, so new clients/stages just work.
       • Voice: 🎤 (or Alt+V) to talk. 🔈 auto = she answers aloud when you
         spoke to her · 🔊 always · 🔇 never. Her voice is the browser's built-in
         speech (on-device). Voice INPUT uses the browser's speech service
         (Chrome → Google, Edge → Microsoft) — audio leaves the browser.
       • Data changes (save, undo, align) always ask with a button first and
         run through CLAIRE's kernel (roles, single save, undo).
       • Answers are computed locally from window.DB — no AI service, no key.
         Optional later: CLAIRE.brain = async (text, ctx) => 'reply' is called
         for anything she doesn't understand (e.g. a Cloud Function to an LLM).
       Console: CLAIRE.ask('how many unused visas')
     =========================================================================
```

```text
=========================================================================
     C.L.A.I.R.E. — STEP 2.3 · FREE AI brain (no paid plan)     v7.5.2-free
     -------------------------------------------------------------------------
     HOW TO INSTALL: this block REPLACES the v7.5.1-free block. Delete that
     block (from its opening comment to its closing </script>) and paste this
     in the same place (after the v7.4.0 "Chat + Voice" block, before </html>).
     Needs CLAIRE v7.4.0 (CLAIRE.ask). Kill switch: type "ai off" in the chat
     or localStorage.setItem('claire.ai','off').

     v7.5.2 — FIXES (from the live console, 19 Oct 2026)
       • Google retired gemini-2.5-flash for new users (404 "no longer
         available … use models/gemini-3.8-flash"). Default model is now
         gemini-3.8-flash, and if Google retires a model again CLAIRE reads
         the suggested replacement from the error, switches, and retries once.
       • Error messages were misread: the word "generateContent" contains
         "rate", so a 404 was reported as "free quota used up" and the cloud
         engine was paused for 1 hour. Errors are now classified by HTTP
         status (429 / 403 / 404) and only a real 429 pauses the cloud.
       • Identity: "who created you?" no longer gets a Google/Gemini answer.
         She answers as CLAIRE, built in-house for SAFWAT. Set the credit with
         CLAIRE.ai.config({creator:'Carl Lagatuz, SAFWAT Recruitment'}).

     v7.5.1 — ROUTING: typed questions with analytic wording (by/per,
       average, total, highest/lowest, before/after/between, sort, top N,
       not/without/missing, whose, Arabic text…) go STRAIGHT to the AI.
       Commands (IDs, save, undo, align, status, help, voice, "any issues")
       and simple counts stay on the instant rules. Spoken (🎤) questions
       still go rules-first. If the AI fails, the rules answer.

     COST: none. Two free engines, tried in this order:
       1) CLOUD — Firebase AI Logic + Gemini Developer API "free tier".
          No-cost Spark plan: no billing account, no card, no Cloud
          Functions, no API key in this file.
       2) DEVICE — Chrome/Edge built-in on-device model (Prompt API), if the
          PC supports it. If neither is available she keeps her v7.4.0 rules.

     PRIVACY
       • The AI never receives records. It gets the question, field names,
         and business values (clients, statuses, categories, nationalities,
         stages, agencies…) and returns a QUERY PLAN that runs HERE on
         window.DB. Every number is computed locally; the filter is shown.
       • Passport / ID-like numbers in the question are redacted first.
       • FREE-TIER NOTE: Google may use free-tier prompts to improve its
         products. That is why no record data is ever sent.

     CHAT COMMANDS: "ai status" · "ai on" · "ai off" · "ai cloud" ·
       "ai device" · "ai auto"
     CONSOLE: CLAIRE.ai.status() · CLAIRE.ai.ask('visas by client') ·
       CLAIRE.ai.config({model:'gemini-3.8-flash', dailyLimit:150,
       creator:'…', appCheckKey:'<reCAPTCHA v3 site key>'}) ·
       CLAIRE.ai.lastPlan() · CLAIRE.ai.run({entity:'visa',op:'count',where:[]})
     =========================================================================
```

```text
=========================================================================
     C.L.A.I.R.E. — STEP 2.4 · LOCAL brain (no cloud, no cost)     v7.7.0
     v7.7.1 — "arrived" = before today, exactly like the greyed (past) days on
       the Arrivals Calendar; today's arrivals are listed separately.
     v7.7.0 — SINGLE DATE RULE (same as CEO Dashboard): "arrived in october"
       counts arrivals up to today only (calendar total + "still to arrive"
       shown underneath); "arriving …" = after today; "arrivals in …" = all,
       split. "the month of october" is read as "october". Theme commands
       ("dark mode", "light mode", "toggle theme") pass to the v7.4.0 rules.
     -------------------------------------------------------------------------
     HOW TO INSTALL: paste this block AFTER the v7.5.2-free block (just before
     </html>). Keep v7.2.0 – v7.5.2 as they are. Works without v7.5.x too.
     Kill switch: localStorage.setItem('claire.local.off','1'); reload.

     WHY
       Google refuses the Gemini free tier for this project ("Your project has
       been denied access" / PERMISSION_DENIED). So CLAIRE now understands
       questions HERSELF, in the browser. Nothing is sent anywhere.

     WHAT SHE UNDERSTANDS (any wording, any case, typos & plurals)
       • Breakdowns: "unused visas by client", "candidates per stage and
         nationality", "visas by expiry month", "average salary by nationality"
       • Top / most: "top 5 clients by unused visas", "which agency has the most"
       • Numbers: "average/total/highest/lowest salary of deployed candidates",
         "salary above 2000", "between 1500 and 3000"
       • Dates: "expiring before march", "requested last month", "offers sent
         in the last 14 days", "between 1 nov 2026 and 31 dec 2026", "since
         2026-10-01" (dd/mm/yyyy is read day-first)
       • Missing / linked: "allocated visas not linked", "candidates without
         passport", "visas missing MOFA"
       • Exclude: "unused visas except rezayat", "candidates not deployed"
       • Cross-record: "visas of deployed candidates"
       • Synonyms: pinoy → FILIPINO, egypt → EGYPTIAN/EGYPT, ladies → FEMALE,
         available → UNUSED, "engineer" → every *ENGINEER* category…
       • Follow-ups: "and for holiday inn?", "only females", "by agency
         instead", "list them"
       • Results: count + status breakdown, grouped tables, stats, sorted
         lists; Open record, Export CSV, quick "By client / By stage" buttons.
         The filter used is always shown; words she didn't recognise are named.
       • Identity: "who created you?" → C.L.A.I.R.E., created by Lagatuz Labs
         (also Arabic and Filipino).
     ROUTING
       Commands (IDs, save, undo, align, status, any issues, voice, "ai …")
       still go to the v7.4.0 rules. Questions go to the local brain; simple
       ones only when every word was understood, otherwise the rules answer.
       The cloud AI (v7.5.2) is switched OFF once per browser; "ai on" brings
       it back if Google lifts the block.
     CONSOLE: CLAIRE.local.plan('unused visas by client') · CLAIRE.local.ask(…)
     =========================================================================
```

```text
=========================================================================
     APPEARANCE · Dark mode coverage     v7.7.1
     -------------------------------------------------------------------------
     HOW TO INSTALL: keep this as the LAST block before </html>.
     WHY: the original dark mode (v2.0 body.ent-dark) only recoloured the CSS
     variables + a few generic classes. ~220 later rules hard-code white /
     cream backgrounds (R-01 sticky filter bar, Visa Usage per Block, R-02
     action buttons, CEO tiles, modals, pickers…) and ~120 use the dark --ink
     colour for TEXT — which turns invisible when --ink becomes the dark
     background. This block was generated from every such rule in the file,
     so each one gets a dark surface (tints kept, 16%) and readable text.
     Only active while body.ent-dark is on — light mode is untouched.
     =========================================================================
```
# PROJECT D review — 9 November 2026

This review concerns the CEO dashboard inside the Safwat toolkit, not the separate Unity Project-D repository.

## Delivered

- Graphite (default), Midnight and Light appearance controls shared by the workspace and dashboard. Preferences stay in browser local storage; no Firebase changes. Existing dark-mode shortcuts remain compatible.
- Neutral charcoal surfaces, violet accents, readable tables and forms, responsive executive cards and focus states. Semantic warning/status colors remain.
- A decision-brief header with expandable filters, focus view and a spreadsheet-safe CSV summary containing the selected scope.
- Restored filters previously suppressed by stylesheet 050; corrected mixed-case matching for clients, agencies and other dimensions.
- Removed the hard-coded 85% target. Deployment share is a descriptive proportion, not vacancy fulfillment or a configured business goal.
- Future work-start and arrival dates no longer count as completed events in executive KPIs. Dates use the shared validated parser. A visa expiring today remains in the upcoming queue.
- Refreshed calculations read current records even when edits do not change array lengths.
- Zero previous-period baselines are described explicitly instead of claiming 100% growth.
- Follow-up labels describe the last recorded update, not unrecorded movement or time in stage. Age drill exports retain all matching rows rather than silently capping at 500; the existing on-screen limit remains disclosed.
- Keyboard access to attention rows and age bars; Escape closes the record drill.

## Metric boundaries

Candidate KPIs use the selected date period and filters. The period date uses work start, then KSA arrival, request, creation or update date. This is a current-record cohort, not a historical event log. Visa KPIs, attention items and follow-up age use all dates within their applicable filters. Visa records only support project, client, nationality, agency and gender filters. Project reports below the executive brief retain their own scope; Focus view hides those separate sections.

Other legacy project reports retain their existing definitions, which may differ from these executive KPIs. This update does not invent a single organizational health score or reclassify production records. An event-history model and agreed vacancy targets are needed for historical performance and fulfillment reporting.

## Validation

`npm run check` and `npm test` check syntax, source checksums and shared logic. The reviewed manifest checksum for legacy script 075 supersedes its extraction checksum; all other extracted blocks remain unchanged.

`tests/ceo-browser.cjs` runs the actual executive-layer script against synthetic records with network access blocked. It covers themes, restored mixed-case client filtering, future dates, expiry today, focus mode, CSV scope, keyboard drill-downs, escaping, same-length edits on refresh and read-only behavior. The workspace smoke suite covers navigation and session cleanup. Authenticated production-data testing remains a user deployment check.

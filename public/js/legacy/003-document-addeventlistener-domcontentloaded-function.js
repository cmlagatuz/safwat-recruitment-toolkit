/* Historical v2.4.4 auth listener retired (2026-11-22).
 * Authentication is not account authorization. Multiple independent listeners
 * previously raced to reveal the toolkit or hide the pending/verification gate.
 * public/js/legacy/015-accountapprovalv260.js is the sole access gate.
 * Keep this script slot so the legacy asset order remains stable.
 */

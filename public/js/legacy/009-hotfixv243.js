/* Historical v2.4.3 emergency reveal/rescue retired (2026-11-22).
 * Timed UI unlocks must never override email verification, rejection, role
 * revocation or server-side access errors. The unified account approval
 * handler in 015-accountapprovalv260.js owns all access state.
 * Keep this script slot to preserve the existing loading order.
 */

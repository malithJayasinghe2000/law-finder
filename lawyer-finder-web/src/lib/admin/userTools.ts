/**
 * Admin account tools — what platform staff may do to someone else's account.
 * Switches, not deletions (2026-10-16). Plain module: the admin page imports it.
 */

/**
 * Changing an account's role — OFF.
 *
 * One request made a client an ADMIN, and an unknown role crashed with a 500.
 * A role follows from what a person did: an approved application makes an
 * attorney; a practice manager is a CLIENT with a firm membership. Making a new
 * administrator is rare enough to do by script.
 */
export const ADMIN_ROLE_EDIT_ENABLED = false;

/**
 * Setting someone's password — OFF.
 *
 * An admin who chooses an attorney's password can sign in as them and read
 * their clients' matters, which platform staff must never do (guardrail rule 5).
 * Replaced by "Send reset link": the person sets their own password.
 */
export const ADMIN_SET_PASSWORD_ENABLED = false;

/**
 * Single source for the privacy policy link, so the auth screen and Profile
 * don't each hardcode their own copy of a URL that's going to change.
 *
 * This currently points at the published draft (see PRIVACY_POLICY.md at
 * the repo root for the source of truth, and its own banner for what still
 * needs legal review before this is a real policy). Two things to fix
 * before this ships to anyone outside the team:
 *  1. A claude.ai/code/artifact link is private by default — it has to be
 *     shared from its own page before a tester's tap on this link resolves
 *     to anything.
 *  2. App Store Connect and Play Console both also want this URL entered
 *     directly in their own listing metadata, separate from this in-app
 *     link, and a claude.ai URL is not where this should permanently live.
 */
export const PRIVACY_POLICY_URL = 'https://claude.ai/code/artifact/07815a00-82a0-4f9f-8ee3-a682a8ebb579';

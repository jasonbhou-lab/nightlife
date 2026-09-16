/**
 * Single source for the privacy policy link, so the auth screen and Profile
 * don't each hardcode their own copy of a URL that's going to change.
 *
 * Points at PRIVACY_POLICY.md rendered on GitHub — the repo is public, so
 * this needs no separate hosting or sharing step, unlike a claude.ai
 * artifact link (the previous version of this file pointed at one; it was
 * deleted out from under the app without warning, which is exactly the
 * failure mode of depending on that kind of link for anything permanent).
 *
 * Still not the final home for this. App Store Connect and Play Console
 * both also want this URL entered directly in their own listing metadata,
 * separate from this in-app link, and a source-control blob view is a
 * developer-facing page, not a branded one — worth moving to real hosting
 * (even a bare static page under the app's own domain) before this ships
 * to anyone outside the team. See PRIVACY_POLICY.md's own banner for what
 * else — namely legal review — has to happen first regardless.
 */
export const PRIVACY_POLICY_URL = 'https://github.com/jasonbhou-lab/nightlife/blob/main/PRIVACY_POLICY.md';

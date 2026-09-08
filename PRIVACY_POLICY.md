# Nightlife Privacy Policy

> **DRAFT — pending legal review.** This document was assembled from the product's own requirements
> (venue data model, roles, and PRD Section 9, "Compliance and Regulatory Flags") and from how the app
> actually behaves today. It is a starting point, not a substitute for review by qualified privacy
> counsel — especially given the alcohol/tobacco venue context (state tied-house and marketing rules),
> the absence of an in-app age gate today, and California CPRA and other state privacy statutes. Do not
> treat this as a live, binding policy until counsel has reviewed it. Every `[bracketed]` field needs a
> real value before publication.
>
> A styled, published version of this same content lives at:
> https://claude.ai/code/artifact/07815a00-82a0-4f9f-8ee3-a682a8ebb579

Effective date: `[insert date]` · Last updated: `[insert date]` · Entity: `[Legal entity name]`

Nightlife (the "App," "Service," "we," "us") helps you decide where to eat, drink, and go out tonight,
and lets you act on that decision — read and write reviews, save and follow venues, check in, message
businesses and other members, and book a table. This policy explains what we collect to do that, why,
who we share it with, and the choices you have.

## 1. Scope and an age note up front

This policy covers the Nightlife mobile app and any associated web experience. It applies to everyone
who uses the Service: people browsing and reviewing venues, people who claim and run a business
listing, and platform staff who moderate content.

**Age-restricted by design, not yet age-gated in practice.** Every venue category in this app —
restaurants, bars, lounges, cigar lounges, and nightclubs — serves alcohol or permits tobacco use. The
Service is intended for adults 21 and older. Today, the app asks you to self-report a phone number and
an age attestation before you can review, book, or message a business — it does not independently
verify either through a phone carrier or an ID-verification vendor (PRD §9, "Age verification"). Treat
any statement elsewhere describing this as "verification" as shorthand for that self-reported check,
not a claim of independent proof.

## 2. Information we collect

**Account information.** Creating an account takes an email address (for a one-time sign-in code) or a
Google account, and a display name. We never ask for or store a password — there isn't one to leak.

**Age and phone information.** A phone number and an age attestation, both self-reported by you, unlock
reviewing, booking, and messaging a business. See the callout above for exactly what this does and does
not confirm.

**Content you create:**
- Reviews, star ratings, and category-specific sub-ratings (food, service, pour value, and similar,
  depending on venue type)
- Photos and video you attach to a review or upload to a venue's gallery
- Check-ins at a venue, including who you choose to let see them
- Follows — of venues, and of other members (mutual follows unlock direct messaging and check-in
  visibility between two people)
- Direct messages with other members you mutually follow, and messages you send to a business
- Saved venues and named collections, including anyone you invite to collaborate on one
- Reservation, waitlist, and table-service requests — party size, date and time, seating preference, and
  any note you add
- Content reports you file, and the reason you selected

**Business account information.** If you claim or are invited to help run a venue listing, we
additionally hold the role you were granted (owner, manager, or staff), the venue edits and attribute
changes you make (with a change history), offers and advertising you create, and aggregated performance
data about that listing — profile views, search impressions, and click-throughs by action type. This
aggregated data describes traffic to the listing; it is not a breakdown of the individual consumers
behind it.

**Location.** Location (from your device, or a location you type in) is used to find venues near you,
show distance, and center a map. Photo uploads are re-encoded on your device before they reach us, which
strips embedded GPS and device metadata as a byproduct — we don't retain a photo's original location
data (PRD §F-MEDIA-05).

**Usage and device information.** Standard technical information any server sees from a request — device
type, app version, general error and crash information — used to keep the Service running and to fix
what breaks.

## 3. What we deliberately don't collect

- **Payment card numbers.** There is no card field anywhere in the app. Booking deposits show terms and
  capture your explicit acceptance, but no payment is processed by the app itself today.
- **A password.** Sign-in is a one-time emailed code or a Google account — nothing else to store or
  lose.
- **Independent government-ID verification.** Age and phone are self-reported (see §1) — we don't run ID
  or SMS verification.

## 4. How we use this information

- To operate the core features you use it for — showing your reviews, running your search, sending your
  message, holding your reservation
- To show the right thing to the right audience — a check-in marked "just me" stays that way; one marked
  visible to mutual follows is shown only to accounts you both follow
- To keep the platform trustworthy — routing reports to a moderator, detecting review manipulation,
  applying a Consumer Alert to a listing when Trust & Safety finds cause
- To give a business owner an honest picture of their own listing's performance, in aggregate
- To communicate with you about your account, a booking, or a report you filed
- To meet legal obligations and enforce our terms

We do not use your content to sell you alcohol or tobacco, and we do not build consumption-volume
features (drink-count leaderboards, check-in streaks tied to bars) — a deliberate choice given
dram-shop exposure (PRD §9, "Overservice and dram shop exposure").

## 5. Who we share it with

| Recipient | What they get, and why |
|---|---|
| Other members, by your own settings | Your public reviews and profile; check-ins and DMs only per the visibility you chose or the mutual follow they require |
| A venue you message or book | Your message, or your reservation/table/guest-list request details |
| Platform moderators & Trust & Safety | Reported content and the account behind it, scoped to investigating that report |
| Our infrastructure providers | Account, content, and usage data as needed to host the app, its database, and authentication (currently Supabase) |
| Google | Location queries for map display (Google Maps), and your Google account info if you sign in with Google |
| Law enforcement or legal process | Only where we're required to by valid legal process, or to protect someone's safety |

**We do not sell your personal information**, and we do not share it with advertisers for their own
independent use — an advertiser purchasing a placement (PRD §F-BIZ-10) receives campaign performance in
aggregate, not a list of the people who saw it.

## 6. Your choices

- **Delete your account.** Available in Profile at any time. We target propagating a deletion across our
  systems within 30 days.
- **Control who sees a check-in** — just you, or accounts you mutually follow — every time you check in,
  not as a one-time setting.
- **Unfollow, block, or report** another member or a business thread at any time.
- **Notification preferences** are per category, with transactional messages (booking confirmations, a
  ready waitlist spot) kept separate from anything promotional.
- **Ask us what we hold** or request a copy of it by reaching out — see §10.

## 7. Children's privacy

The Service is intended for adults 21 and older and is not directed to children. We do not knowingly
collect personal information from anyone under 13, and given the alcohol/tobacco context, the Service is
not appropriate for any minor. If you believe a child has provided us information, contact us (§10) and
we will delete it. (PRD §9 flags COPPA and the age-verification standard as open questions for counsel —
see the draft note at the top of this page.)

## 8. How long we keep it

We keep information for as long as your account is active and as needed to provide the Service, then per
a retention schedule scoped to each type of data — held longer where needed for a fraud or safety
investigation already underway, or where the law requires it. Deleting your account starts removal of
your personal data within the window in §6.

## 9. Security

We use industry-standard measures — encrypted connections between the app and our servers, and access
controls scoped to what a given role actually needs — to protect your information. No method of
transmission or storage is completely secure, and we can't guarantee absolute security.

## 10. California and other state privacy rights

Depending on where you live, you may have rights to know what personal information we hold about you, to
request a copy of it, to request correction or deletion, and to opt out of the "sale" or "sharing" of
personal information as those terms are defined by law. As stated in §5, we do not sell personal
information. To exercise a right described here, contact us using the information in §13; we will not
discriminate against you for making a request.

This section is the clearest candidate for revision once counsel reviews the product against CPRA and
other state statutes (PRD §9, "Privacy") — treat the rights listed here as a floor, not a final answer.

## 11. Where this applies

The Service currently launches in the United States and is not directed at users elsewhere. If you
access it from outside the US, your information will be processed in the US, under US law.

## 12. Changes to this policy

We'll update the date at the top of this page when we make changes, and where a change is material,
we'll tell you more directly — through the app or by email — before it takes effect.

## 13. Contact us

Questions, requests, or a report about how your information is handled: `[insert privacy contact
email]`.

`[Legal entity name]` · `[mailing address, if required for your state's compliance]`

---

Prepared from the Nightlife product requirements document and the app's current implementation — see the
draft banner at the top of this page for what still needs legal sign-off before this is published as a
live policy.

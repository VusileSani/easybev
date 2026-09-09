# EasyBev v2.7.0 — Security Enforcement & Venue Partitioning

## Purpose
Move EasyBev from authenticated UI routing to backend-enforced tenant/role security without making the guest or waiter experience heavier.

## Security boundary
- Realtime Database defaults to deny.
- Owner/Admin authority is read from trusted Firebase Auth custom claims.
- Manager/Waiter authority is read from `accessByUid/<uid>` and bound to a venue.
- Waiter session list reads are query-restricted to the authenticated waiter's assigned slot and capped at 100.
- Manager session reads are bounded to the recent operating window.
- Guest session reads are query-restricted to `guestUserId == auth.uid` and capped at 25.
- A guest can create a session for an active waiter after phone authentication, but cannot change bill totals, items, reconciliation or settlement state.
- Guest post-create writes are limited to own service requests, own messages, own display name, activity timestamp and the open → requested bill transition.
- Guest identity fields and session-start identity snapshots are immutable after creation/migration.
- Platform audit events are append-only and must carry the authenticated platform actor UID.
- Platform staff authority records are Owner-write only.

## Venue partitioning
Operational data now resolves below:

`venues/<venueId>/...`

Current primary venue: `venue-main`.

Scoped roots:
- waiters
- sessions
- staff
- menuItems
- menuCategories
- menuUsage

The client uses a single venue-path abstraction so future RTDB sharding can change routing without scattering path logic throughout the UI.

## Migration
`MIGRATE-TO-VENUE-v2.7.0.js` copies existing root operational data into `venues/venue-main`, adds venue IDs to staff access mappings, normalises waiter-slot type, and links legacy guest sessions/profiles to Firebase phone identities where possible.

The migration is intentionally non-destructive: legacy root data remains in place for rollback.

## Public/control-plane separation
Non-platform actors no longer read the private company control nodes just to display service notices. Public service state and public feature switches live under:
- `platform/publicService`
- `platform/publicFeatureFlags`

Announcement reads are audience/query constrained rather than downloading the whole announcement collection and filtering client-side.

## Ease improvements
- The home Guest action is now a real **Scan waiter QR** button.
- Camera permission is requested only after the guest taps Scan.
- Rear camera is preferred.
- EasyBev validates scanned waiter links before navigation.
- If in-app QR detection is unavailable, the guest gets one simple fallback: use the phone camera.
- “Use another waiter” no longer downloads a waiter directory; the guest is told to scan that waiter's QR.
- New QR links include the venue partition key.

## Still required before production claim
- Publish and live-test the supplied production Security Rules only after migration + v2.7 app validation.
- MFA/step-up authentication for Owner/Admin.
- App Check.
- Trusted server-side provisioning for privileged role/access changes.
- Server-side/append-only authoritative audit for high-risk operations.
- Shard routing once concurrency warrants more than one RTDB instance.

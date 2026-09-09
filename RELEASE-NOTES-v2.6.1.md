# EasyBev v2.6.1 — Auth Migration Repair

## Purpose
Repair the two issues discovered during the first real Firebase Authentication test pass without adding unrelated product scope.

## Guest reconnect security repair
- Old prototype `localStorage` guest IDs are no longer accepted as proof of guest identity.
- A remembered device/session may suggest a reconnect target, but it cannot open the session by itself.
- An already authenticated Firebase phone user may reconnect without another SMS only when the Firebase phone identity matches the session phone.
- Otherwise the guest must complete real Firebase Phone Authentication before reconnecting.
- Legacy guest profiles are migrated to the authenticated Firebase UID while the old profile record is preserved for historical continuity.
- Legacy active sessions are rebound to the authenticated Firebase UID only after the verified phone number matches the session.
- `connectGuestToSession()` now performs its own Firebase identity/ownership guard rather than trusting the button that called it.
- Home resume wording now makes the verification requirement explicit.

## Platform notification repair
- Published platform announcements now include a visible dismiss control.
- Dismissal is stored per authenticated Firebase user under `platform/announcementReceipts/<uid>/<announcementId>`.
- A local receipt hides the notice immediately while the Firebase receipt synchronises.
- Dismissing an announcement does not remove or unpublish it for other users.
- Service degradation and maintenance banners remain intentionally non-dismissible while the service state is active.

## Authentication status retained
- Trusted `easybevRole` claims continue to drive Owner/Admin authority.
- Manager/Waiter authority remains UID-mapped through `accessByUid`.
- Production staff query-string role switching remains disabled.
- Guest `?guest=<slot>` remains service routing only.

## Deployment state
Do not publish the restrictive RTDB draft rules yet. v2.6.1 is still an authentication migration/test build while Manager/Waiter mappings, child-level guest/session rules and venue namespacing are completed.

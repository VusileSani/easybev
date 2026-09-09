# EasyBev v2.6.1 — Real Authentication Migration & Repair


EasyBev is a lightweight guest-service and digital waiter-pad layer for hospitality venues.

## Core operating model
- Guests connect to a permanent waiter service slot by QR.
- Management assigns staff members to those permanent slots.
- Waiters capture orders directly into EasyBev and respond to guest requests/messages.
- Guests see a live running bill and request the official bill when ready.
- Waiters reconcile the EasyBev order list in the venue POS before processing the bill.
- Sessions move through Active → Bill requested → Awaiting settlement → Closed.
- Active sessions can be handed to another assigned waiter without breaking the guest session or running bill.
- Guests can maintain a compact reusable profile: required identity details plus optional service, language, dietary, bill, tip and notification preferences.
- Management categorises venue items once; the waiter pad turns those categories into fast rush-hour tabs with Frequent items and quick quantities.


## v2.5.2 repair baseline
- Waiter item removal is an audited void with explicit reason rather than silent deletion.
- Rush-hour paths avoid broad session-history reads where practical.
- Normal venue actors no longer block on company/platform bootstrap during startup.
- Repeat Last Round, managed catalogue pricing, handover, lifecycle and reconciliation invariants are regression-tested.

## Project structure
- `index.html` — application shell
- `css/styles.css` — product styling
- `js/` — separated application responsibilities
- `website.html` — public-facing EasyBev website

Production role selection is now driven by Firebase Authentication. The old browser actor switcher is no longer an authority mechanism.


## EasyBev company governance

The application now separates venue operations from EasyBev company operations:

- Guest: requests service and sees the running bill.
- Waiter: serves guests and captures/reconciles orders.
- Venue Management: manages the venue team, waiter slots, items and service reporting.
- EasyBev Admin: operates venues, support, announcements and routine platform controls.
- Owner: governs EasyBev staff authority, critical platform controls and the privileged audit trail.

Owner/Admin access is now resolved from Firebase Authentication and server-issued custom claims rather than query-string routing or UI visibility. Final production enforcement still requires the restrictive Realtime Database Security Rules and trusted server-side handling for high-risk privileged changes. The platform audit data in this build demonstrates the product behavior; production audit integrity should be protected so ordinary clients cannot alter or delete historical audit records.

The existing restaurant service data remains the current single-venue operational model. `platform/venues` is the company venue registry and onboarding/support layer; a later multi-venue backend migration should namespace operational data by venue before more than one venue is considered fully live in the same database.


See `RELEASE-NOTES-v2.5.md` for guest profile and categorised waiter-pad changes. Previous release notes remain in the package.


## Current repair pass
See `RELEASE-NOTES-v2.5.1.md`, `VALIDATION-v2.5.1.md` and `CODE-AUDIT-v2.5.1.md` for the latest repair/performance review and remaining production blockers.


## v2.6.1 auth repair
See `RELEASE-NOTES-v2.6.1.md`, `AUTH-DEPLOYMENT-v2.6.1.md` and `VALIDATION-v2.6.1.md`.

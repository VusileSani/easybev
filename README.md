# EasyBev

EasyBev is a lightweight guest-service and digital waiter-pad layer for hospitality venues.

## Core operating model
- Guests connect to a permanent waiter service slot by QR.
- Management assigns staff members to those permanent slots.
- Waiters capture orders directly into EasyBev and respond to guest requests/messages.
- Guests see a live running bill and request the official bill when ready.
- Waiters reconcile the EasyBev order list in the venue POS before finalising.

## Project structure
- `index.html` — application shell
- `css/styles.css` — product styling
- `js/` — separated application responsibilities
- `website.html` — public-facing EasyBev website

The actor switcher provides fast role navigation while each actor view remains isolated to the controls and information that role needs.


## EasyBev company governance

The application now separates venue operations from EasyBev company operations:

- Guest: requests service and sees the running bill.
- Waiter: serves guests and captures/reconciles orders.
- Venue Management: manages the venue team, waiter slots, items and service reporting.
- EasyBev Admin: operates venues, support, announcements and routine platform controls.
- Owner: governs EasyBev staff authority, critical platform controls and the privileged audit trail.

The browser role switch exists for product testing. In production, Owner/Admin access must not be granted by query-string routing or UI visibility. Use Firebase Authentication and server-issued custom claims, enforce them in Realtime Database Security Rules, and place high-risk privileged changes behind trusted server-side functions. The platform audit data in this build demonstrates the product behavior; production audit integrity should be protected so ordinary clients cannot alter or delete historical audit records.

The existing restaurant service data remains the current single-venue operational model. `platform/venues` is the company venue registry and onboarding/support layer; a later multi-venue backend migration should namespace operational data by venue before more than one venue is considered fully live in the same database.

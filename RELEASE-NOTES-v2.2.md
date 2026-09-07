# EasyBev v2.2 — Operational Reality

## Approved changes included

- Management opens on a compact Service Summary. Team, Items, Service and Support are isolated workspaces; selecting one hides unrelated functions.
- Waiter order capture keeps Quick Items and replaces the browser full-list datalist with a small filtered autocomplete panel capped at five relevant suggestions. Selecting a suggestion adds it immediately.
- Waiters no longer depend on the guest to request or complete the bill flow. After POS reconciliation, the waiter can Process Bill directly, then Close Session.
- Bill processing and session closure are separate recorded events (`bill.processedAt` and `closedAt`).
- Completed sessions remain available to remembered guests under Recent nights, with itemised history, total, Bill processed time and Session closed time.
- Partner Merchant workflow: Record/receive request → Approve → Create Venue → Assign Venue Owner. Approval creates a venue-scoped owner invitation.
- Both EasyBev Owner and EasyBev Admin can create venues. Platform staff authority remains Owner-controlled and cannot be elevated from venue management.
- Venue records expose compact People & Access controls for Venue Owner and Management users, including invite resend, suspension/reactivation and scoped management invitations.

## Production boundary

This remains a working prototype. Firebase Authentication, tenant-scoped database rules and privileged server-side functions must enforce authority in production. Browser visibility is not a security boundary.

# EasyBev Scale Readiness — v2.7.0

## Product invariant
Scale must not appear as complexity in the guest/waiter interface. EasyBev should remain fast, bounded and obvious while tenancy, security, routing and resilience are handled underneath.

## v2.7 structural improvements
- Venue ID is now a physical RTDB partition in client paths, not only metadata.
- All operational path construction is centralised through `venuePath` / `venueRef` / scoped multi-location updates.
- Waiter live session reads are bounded and query-scoped to the waiter's assigned slot.
- Manager session reads are bounded by recent activity.
- Guest session reads are bounded and UID-scoped.
- Platform announcements are audience-query constrained rather than downloaded globally for client-side filtering.
- Platform support requests from managers are venue-query constrained.
- Public service state is separated from private platform control data.
- Guest device storage keys include venue ID to avoid cross-venue collisions.
- QR links carry `venue=<venueId>`.

## Million-user target topology
A single Firebase Authentication project can provide common identity while operational RTDB data is routed across multiple database instances when concurrency requires it.

```text
Firebase Auth / identity
        |
        +-- platform control plane (low-volume)
        |
        +-- venue directory / routing
               |
               +-- RTDB shard A
               |      venues/<venueId>/...
               |
               +-- RTDB shard B
               |      venues/<venueId>/...
               |
               +-- RTDB shard N
```

The current browser uses one RTDB URL, but centralised venue path resolution means a future routing adapter can select a shard before actor subscriptions start.

## Next scale work after security cutover
- Introduce a server-owned venue→database-instance routing directory.
- Keep active operational data hot; archive old session/event history away from permanent live subscriptions.
- Replace cross-venue raw dashboard scans with server-maintained summaries/exception queues.
- Add App Check, Cloud Logging/Error Reporting, SLOs and alerting.
- Add idempotent trusted server handlers for privileged provisioning and other high-risk changes.
- Load/concurrency test each shard before production traffic targets are raised.

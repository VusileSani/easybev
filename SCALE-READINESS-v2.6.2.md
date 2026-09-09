# EasyBev Scale Readiness — v2.6.2

## Non-negotiable operating model
EasyBev must stay simple when users are rushed, distracted, frustrated, intoxicated, on unreliable connections, or tapping twice. Complexity belongs below the interface.

## Client invariants
1. A role owns a bounded set of live subscriptions. Old subscriptions are detached before replacements are attached.
2. No management screen should permanently subscribe to unbounded historical sessions.
3. Repeated UI updates are coalesced.
4. Duplicate taps must not create duplicate consequential writes.
5. Authentication proves identity; URL parameters only select non-privileged service context.
6. Venue ID is the partition key for future namespacing and sharding.

## Million-user architecture
Millions of registered/monthly users are compatible with Firebase, but a single RTDB instance is not an unlimited global bus. EasyBev should partition operational data by venue and route venues across RTDB instances as concurrency grows. Authentication can remain common across the Firebase project.

Target data shape:

```text
platform/                   # low-volume company control plane
venueDirectory/<venueId>    # venue -> shard routing metadata

[operational shard]
venues/<venueId>/
  waiters/
  staff/
  menuCategories/
  menuItems/
  menuUsage/
  activeSessions/
  recentSessionIndex/
```

Historical session/event data should be moved out of permanently subscribed operational nodes. Platform dashboards should consume server-maintained summaries and bounded exception queues rather than raw cross-venue sessions.

## Next production migration
Do not physically move live data until Security Rules and migration tooling are tested against a copy/emulator. The next architecture release should introduce `venues/<venueId>/...` and a compatibility migration with explicit rollback, then remove the legacy root paths.

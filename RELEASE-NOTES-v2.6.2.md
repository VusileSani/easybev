# EasyBev v2.6.2 — Ease + Scale Hardening

## Purpose
Keep the interface simple under pressure while removing browser-side patterns that become dangerous as traffic grows.

## Ease changes
- Public home no longer exposes a fake/default Guest button that silently assumes Waiter 1. Guests are told to scan their waiter QR, which is the real service path.
- Guest SMS actions use explicit `Send code` and `Verify & connect` language.
- OTP send/verify actions are locked while a request is in flight, preventing frustrated double taps from generating duplicate auth work.

## Scale hardening
- Added a central live-listener lifecycle registry. Role/view restarts replace old listeners instead of stacking subscriptions.
- Added render coalescing so bursts of Firebase updates do not trigger repeated full UI redraws in the same animation frame.
- Manager session subscription is bounded to the latest operational window rather than every historical session.
- Platform operational feeds are bounded for venues, partner applications, announcements, support, audit and recent sessions.
- Added central scale limits so browser workload can be tuned without hunting through feature code.
- Added a stable venue partition-key resolver as groundwork for venue namespacing and database-shard routing.
- Extended the draft Realtime Database rules with the indexes required by the bounded queries.

## Important production boundary
This release is **scale-hardened, not yet million-user production-ready**. A single Firebase Realtime Database instance has finite connection/write limits. Before broad production, EasyBev still needs:
- physical venue namespacing migration (`venues/<venueId>/...`)
- trusted backend provisioning for venue memberships / privileged claims
- production Security Rules publication after emulator tests
- App Check and abuse controls
- database-shard routing once traffic approaches a single RTDB instance's capacity
- server-maintained aggregate platform metrics so Owner/Admin dashboards never scan global raw operational data

The browser code is now structured to make those migrations smaller and safer rather than embedding unlimited global listeners throughout the UI.

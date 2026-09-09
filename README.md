# EasyBev v2.7.0 — Security Enforcement & Venue Partitioning

EasyBev is a lightweight guest-service and digital waiter-pad layer for hospitality venues. It sits upstream of the venue POS rather than replacing it.

## Product rule
EasyBev must remain easy under pressure. Guests and waiters get obvious actions and short flows; tenancy, identity, audit and scale complexity stay underneath the interface.

## Authentication and authority
- Guest identity: Firebase Phone Authentication.
- Waiter/Manager identity: Firebase Authentication + venue-scoped `accessByUid` membership.
- EasyBev Admin/Owner authority: trusted Firebase Authentication custom claims.
- URL parameters select guest service context only; they never grant staff authority.

## Data partition
Operational data is venue-scoped:

```text
venues/<venueId>/
  waiters/
  sessions/
  staff/
  menuCategories/
  menuItems/
  menuUsage/
```

The current primary test venue is `venue-main`. The client centralises this partition key so operational venues can later be routed across multiple RTDB instances/shards without redesigning every screen.

## Security Rules
`database.rules.PRODUCTION-v2.7.0.json` is the first restrictive ruleset designed for the real-authenticated application. Follow `DEPLOYMENT-v2.7.0.md` exactly: migrate, deploy/test, then publish rules.

## Migration / rollback
- `MIGRATE-TO-VENUE-v2.7.0.js` — non-destructive copy and auth-identity normalisation.
- `ROLLBACK-VENUE-v2.7.0.js` — copies current namespaced operational data back to legacy root paths if rollback is required.

## Guest QR
The home Guest action now opens an in-app camera scanner where the browser supports native QR detection. The rear camera is preferred. Unsupported/denied camera flows fall back to the phone's normal camera rather than adding complex UI.

## Project structure
- `index.html` — application shell
- `css/styles.css` — product styling
- `js/` — modular client responsibilities
- `website.html` — public-facing EasyBev website
- security/migration/release documents — deployment controls and auditability

## Production work still outstanding
A successful v2.7 security cutover does not by itself complete production hardening. Before a production claim, add MFA/step-up authentication for privileged roles, App Check, trusted server-side role provisioning/high-risk operations, authoritative server-side audit handling, monitoring/observability and RTDB shard routing when concurrency requires it.

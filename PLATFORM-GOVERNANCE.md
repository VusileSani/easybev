# EasyBev Platform Governance

## Authority model

### Owner
Owns the authority model itself. Owner can add/deactivate EasyBev platform users, promote/demote platform roles, change owner-only controls, place the platform into maintenance, review privileged audit history, and perform every Admin function.

EasyBev must always retain at least one active Owner.

### EasyBev Admin
Runs the platform day to day. Admin can onboard/pause/resume venues, maintain commercial/subscription status, reissue permanent waiter QR assets for the current venue, operate the support queue, publish/withdraw announcements, perform reason-coded recovery of stuck service sessions, and manage routine feature/service controls. Admin cannot manage Owner authority or owner-only controls. Admin can see the operational activity history needed for support handover, but ownership/authority changes remain visible only in the Owner audit view.

### Venue Management
Runs one venue. It must not receive cross-venue or EasyBev company authority. Venue Management can raise support cases into the EasyBev operations queue.

## Integrity invariants

1. Role authority is enforced server-side, never by hiding buttons.
2. Owner authority cannot be granted by an ordinary Admin.
3. At least one active Owner must always exist.
4. Sensitive actions require a reason and create an audit event.
5. Audit history and financial/service history are append-oriented; corrections create new events rather than silently rewriting history.
6. Support intervention should be read-only by default. Acting on behalf of a venue must be explicit and auditable.
7. Critical platform controls should support temporary/elevated access rather than permanently broad privileges as the product matures.
8. Venue operational data must be tenant-scoped before EasyBev runs multiple live venues in the same production database.
9. Owner grants, owner-role changes, maintenance-mode activation and comparable high-risk actions should require recent re-authentication and MFA in production.
10. Temporary elevated support privileges should expire automatically rather than becoming permanent broad access.

## Production Firebase direction

Use Firebase Authentication for EasyBev staff and Venue Management. Assign access-control-only custom claims from a trusted Firebase Admin SDK / Cloud Function environment, for example:

```json
{
  "easybevRole": "owner"
}
```

or

```json
{
  "easybevRole": "admin"
}
```

Do not allow the browser to set or edit these claims.

Realtime Database Security Rules should enforce role and tenant boundaries. Privileged owner/admin mutations should increasingly move behind callable/HTTP Cloud Functions so authorization, validation, reason capture, audit creation and high-risk checks happen atomically on trusted infrastructure.

Add Firebase App Check to reduce abuse of EasyBev backend resources from unauthorized clients.

## Multi-venue migration

The current service model stores waiter/session/menu data at root-level paths. Before onboarding multiple fully live venues, migrate to venue-scoped operational paths such as:

```text
venues/{venueId}/waiters
venues/{venueId}/staff
venues/{venueId}/menuItems
venues/{venueId}/sessions
```

Client feature controls in this build affect the normal EasyBev interface, but production enforcement for privileged/financial controls must also exist server-side.

Platform-level company data remains separate:

```text
platform/company
platform/staff
platform/venues
platform/supportCases
platform/announcements
platform/featureFlags
platform/auditLog
```

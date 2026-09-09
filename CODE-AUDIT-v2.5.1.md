# EasyBev v2.5.1 — Code Audit Notes

## Scope reviewed
- application structure and script wiring
- guest identity/profile/preferences writes
- session lifecycle and waiter handover compatibility
- waiter pad/category/frequent/repeat flows
- manager item/category maintenance
- output escaping and numeric invariants
- Firebase read/write breadth on rush-hour paths
- mobile overflow behavior

## Repaired in this release
See `RELEASE-NOTES-v2.5.1.md` for the applied repair list.


## Payment integrity repair

The earlier prototype could mark a finalized bill as paid directly from the guest browser even though no payment processor was connected. That behavior has been removed. Online payment now defaults off, the UI requires an explicit `paymentIntegrationReady` marker, and `payBill()` does not write settlement state. A future real integration must confirm payment through a trusted server-side path before EasyBev records `paid`.

## Catalogue price integrity repair

When a waiter enters the exact name of a managed catalogue item, EasyBev now snapshots the current management-controlled name, price and category instead of trusting an editable waiter-entered price. Manual items remain possible when the name does not match a managed catalogue item.

## Known production blockers — intentionally not disguised as small repairs

### 1. Real authentication / authority enforcement
`js/auth.js` remains a placeholder and actor switching is still available through browser routing for prototype testing. Owner/Admin/Manager/Waiter authority must be established with Firebase Authentication (or equivalent), server-issued role/venue claims, and enforced Realtime Database Security Rules / trusted server-side functions. UI visibility and query-string roles are not security boundaries.

This is especially important now that guest profiles can store service, dietary and allergy notes.

### 2. Demo OTP
Guest verification still uses the prototype code `123456`. Real phone verification must replace it before production use.

### 3. Database rules and indexes
This package does not contain the live database rules. The targeted queries introduced in v2.5.1 should be backed by indexes on `sessions.waiterSlot`, `sessions.guestUserId` and, while legacy phone fallback remains, `sessions.guestPhone`.

Suggested rules fragment to merge into the real rules (do not replace existing access rules blindly):

```json
{
  "sessions": {
    ".indexOn": ["waiterSlot", "guestUserId", "guestPhone"]
  }
}
```

### 4. Long-term session architecture
Waiter and returning-guest paths are narrowed in this release, but venue management/platform reporting still observes the broad session collection. Before a long-lived multi-venue production rollout, operational data should be namespaced by venue and active sessions/history/reporting aggregates should be separated so dashboards do not scale with lifetime raw history.

## Product boundary check
The categorised catalogue remains an internal waiter-pad vocabulary. No guest menu browsing surface was added during this audit.

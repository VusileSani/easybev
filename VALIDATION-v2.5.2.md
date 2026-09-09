# EasyBev v2.5.2 Validation

Final regression and release checks completed after the performance and waiter-item-void repair.

## Static integrity
- All JavaScript files pass `node --check`.
- `index.html` and `website.html` parse successfully.
- No duplicate DOM IDs are present.
- CSS parses with `tinycss2` without stylesheet errors.
- All inline UI handler names resolve to implemented application functions.
- The application title/version metadata is aligned to v2.5.2.

## Order / waiter pad regression
- Managed catalogue exact matches capture the management-controlled name and price.
- Quantities remain whole-number constrained to 1–99.
- The write-in-flight lock blocks duplicate rapid submissions.
- `Repeat Last Round` preserves `menuItemId`, `categoryId` and `categoryName` and uses current active catalogue pricing.
- Disabled catalogued items are skipped rather than silently restored.
- Legacy/manual items remain repeatable.
- Frequent items use `menuUsage` aggregates and do not scan session history.
- Hidden/missing categories safely resolve to `Other`.

## Item correction / void regression
- Removing an item requires an explicit reason.
- Item removal and total correction occur in one root update.
- The original row is retained under `voidedItems` with reason, actor and timestamp.
- An `item_voided` audit event is written.
- A previously reconciled session becomes `stale` after an order correction.
- Catalogued usage counts are reduced after a void.
- Waiters cannot void a locked/finalised order or a session no longer assigned to them.

## Session lifecycle regression
- Active / Bill requested / Awaiting settlement / Closed derivation passes.
- Waiter handover preserves the session ID, items and original waiter attribution while changing current waiter ownership.
- Close writes the Closed lifecycle state and audit event.
- Reopen restores the safe lifecycle state implied by the bill while preserving prior history.

## Guest profile regression
- First name remains required in My Details.
- Preferred name updates the live waiter-facing guest name while preserving the original session identity snapshot.
- Default party size validation remains 1–30.
- Optional service, language, bill, tip, dietary and notification preferences persist.
- Device remembrance remains optional.

## Management regression
- Duplicate waiter-pad item names are rejected.
- Valid item/category assignments persist.
- Existing uncategorised items remain available through Other.

## Performance regression
- Waiter session subscription is scoped by `waiterSlot`.
- Returning guest lookup/history is scoped by `guestUserId` or legacy phone query.
- Normal Guest/Waiter/Management startup does not await `ensurePlatformFoundation()`.
- EasyBev Admin/Owner routes retain platform bootstrap behavior.

## Payment integrity
- Guest browser payment simulation remains disabled.
- Online payment controls require both the feature flag and an explicit integration-readiness marker.

## Known production blockers (unchanged)
- Demo OTP `123456` must be replaced by real authentication.
- Owner/Admin/Manager/Waiter authority must be enforced by Firebase Authentication, Security Rules/custom claims and trusted server-side functions, not query-string/UI routing.
- Realtime Database indexes/rules should be deployed for production query paths such as waiter slot and guest user ID.

# EasyBev v2.5.2 — Performance, Integrity & Item Void Repair

This release completes the v2.5 repair pass and adds the waiter correction flow requested after field testing. It does not expand EasyBev into a guest digital menu.

## Waiter item correction
- Every captured line in the waiter Current Bill view now has a visible `Remove` action.
- Removal is a controlled void, not a destructive delete.
- The waiter selects a reason: wrong item, wrong quantity, duplicate capture, guest changed mind, item unavailable, or other.
- An optional short note can be captured.
- The removed row leaves the live bill immediately and the total is recalculated in the same root Firebase update.
- The original item snapshot is retained under `sessions/<sessionId>/voidedItems/<itemId>`.
- An `item_voided` order event records item, quantity, reason, actor and timestamp.
- If the session had already been reconciled against the POS, reconciliation is marked `stale` and must be checked again.
- Frequent-item usage is reduced when a catalogued item is voided so mistakes do not inflate popularity.

## Performance repairs
- The waiter dashboard subscribes only to sessions assigned to its waiter slot.
- Frequent items use lightweight `menuUsage/<menuItemId>` aggregates rather than scanning all session history.
- The open waiter pad updates locally after capture instead of reloading the full menu/category context after every tap.
- Returning guest lookups use indexed-style queries by `guestUserId` with legacy phone fallback instead of reading all sessions.
- Home no longer reads all waiters unless a remembered guest session actually needs waiter resolution.
- Normal Guest/Waiter/Management startup no longer blocks on a full EasyBev company/platform bootstrap read. Platform foundation bootstrap is limited to EasyBev Admin/Owner routes.

## Data-integrity repairs carried forward from v2.5.1
- Exact managed catalogue matches use management-controlled item name and price.
- `Repeat Last Round` preserves menu/category snapshots and does not resurrect disabled catalogued items.
- Waiter-pad write locking prevents accidental duplicate writes from rapid taps while one order mutation is in flight.
- Dynamic inline-handler escaping protects both JavaScript-string and HTML-attribute parsing layers.
- Prototype browser-side payment simulation remains disabled until a trusted payment integration is ready.

## Compatibility
- Existing v2.5 guest profiles, preferences, categories and menu items remain compatible.
- Legacy uncategorised items continue to resolve to `Other`.
- Existing sessions without void history or menu snapshot metadata remain readable.
- Session lifecycle, waiter handover and POS reconciliation semantics are unchanged except that an item correction invalidates a prior reconciliation as expected.

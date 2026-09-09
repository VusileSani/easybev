# EasyBev v2.5.1 — Repair & Performance Pass

This release is a restraint-focused repair pass over v2.5. It adds no new product surface.

## Repairs
- `Repeat Last Round` now preserves `menuItemId`, `categoryId` and `categoryName` snapshots for catalogued items.
- Repeated catalogued items use the current active catalogue record; items management has disabled are skipped rather than silently reintroduced.
- Manual/legacy items can still be repeated when they were intentionally captured outside the catalogue.
- Manager item rename now prevents duplicate waiter-pad item names.
- Exact matches to managed catalogue items now capture management-controlled item name and price; a waiter cannot reuse a catalogue name with an arbitrary price.
- Order quantities are constrained to whole numbers from 1–99.
- A waiter-pad write lock prevents accidental duplicate submissions from rapid double taps / slow writes.
- Dynamic inline-handler escaping now protects both JavaScript-string and HTML-attribute parsing layers.
- Bill total calculation ignores malformed legacy rows instead of allowing a bad numeric value to poison the whole total.
- Numeric quantities are normalised before bill rendering.
- Prototype online payment simulation has been removed. EasyBev no longer writes a paid state from the guest browser without a real payment-provider confirmation.
- Online payment now defaults off and requires an explicit integration-readiness marker before the Pay control can appear.

## Performance
- Opening the waiter pad no longer scans the entire session history to calculate Frequent items.
- Lightweight `menuUsage/<menuItemId>` aggregate statistics now drive the Frequent tab.
- Adding an item no longer reloads the menu, categories and session history after every tap; the open pad updates locally and writes usage statistics asynchronously.
- Waiter dashboards query only sessions currently assigned to their waiter slot.
- Returning-guest session lookup/history query by `guestUserId` (with a phone fallback for legacy paths) instead of reading all sessions.

## UI restraint
- Waiter quantity/category controls wrap within the modal instead of requiring horizontal scrolling.
- The physical-menu / guest-service boundary remains unchanged. These categories remain waiter operational navigation, not a guest digital menu.

## Compatibility
- Existing v2.5 menu categories/items continue to work.
- Existing uncategorised items continue to resolve to `Other`.
- Existing sessions without menu snapshot metadata remain readable.
- `menuUsage` starts learning from v2.5.1 onward; absence of usage data simply falls back to the normal catalogue sort.

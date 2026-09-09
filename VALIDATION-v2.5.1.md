# EasyBev v2.5.1 Validation

Validated after the repair pass:

- All JavaScript files pass `node --check`.
- `index.html` and `website.html` parse successfully and contain no duplicate IDs.
- CSS parses with `tinycss2` without stylesheet errors.
- All inline UI handler function names resolve to implemented functions (excluding native event methods).
- `escapeHtml(0)` preserves numeric zero.
- inline-handler escaping protects double quotes, markup and apostrophes across HTML-attribute + JavaScript-string layers.
- malformed item prices/quantities cannot poison `calculateTotal()`.
- waiter pad initial context reads menu items, categories, lightweight usage stats and only the current session's items; it does not scan all sessions.
- waiter dashboard subscription is scoped by `waiterSlot`.
- returning guest history is scoped by `guestUserId`.
- new menu item edits cannot create duplicate waiter-pad names.
- exact managed catalogue item matches capture the management-controlled name and price.
- order quantity is whole-number constrained from 1–99.
- repeated catalogued items preserve menu/category snapshot metadata.
- disabled catalogued items are not silently restored by Repeat Last Round.
- waiter pad protects against rapid duplicate writes while one order mutation is in flight.
- category and quick-quantity controls wrap rather than requiring horizontal scrolling.
- guest-side `payBill()` cannot write a paid status without a future trusted payment integration.
- online payment defaults disabled and the guest Pay control is gated by both the feature flag and an integration-readiness marker.
- existing v2.5 guest profile/preferences, session lifecycle, waiter handover, reconciliation and manager category behavior remain present.

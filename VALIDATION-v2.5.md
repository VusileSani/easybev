# EasyBev v2.5 Validation

Validated before packaging:

- All JavaScript files pass `node --check`.
- HTML parses successfully and all IDs are unique.
- CSS parses with `tinycss2` without stylesheet parse errors.
- All newly wired UI controls resolve to implemented functions.
- Default menu-category order is Drinks → Shots → Starters → Mains → Dessert → Sushi → Other.
- Legacy items without category data resolve safely to Other.
- Items assigned to a hidden category remain accessible through the Other waiter tab/search rather than disappearing.
- Manager category filtering was exercised with categorised and legacy items.
- Guest preference saving preserves the existing My Usual subtree.
- Guest dietary/service/language/bill/tip preferences write to the guest profile.
- Device remembrance remains local to the device while profile preferences remain server-side.
- Guest My Details save validates required first name and party-size range.
- Preferred-name changes update the current active session display name while preserving the original at-start identity field.

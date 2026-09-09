# EasyBev v2.5 — Guest Profile & Categorised Waiter Pad

## Guest profile and preferences
- Expanded the existing lightweight guest profile into a compact progressive-disclosure **My Profile & Preferences** area.
- **My Details** is the primary required section. First name and verified mobile remain the identity foundation; preferred name and default party size can be added and changed later.
- A preferred name can update the active waiter-facing display name without rewriting the original guest name captured at session start.
- Added optional service-style preference: Normal, Prefer minimal interruptions, or Check in regularly.
- Added language preference capture.
- Added optional bill and usual-tip preferences for future tailoring; these do not force bill or tip behaviour yet.
- Added dietary preference tags, a dietary note, and an important food/allergy service note with a clear reminder to confirm allergies directly with venue staff.
- Preserved **My Usual** as its own guest preference and ensured other preference saves do not overwrite it.
- Added profile-level service/session notification preference while leaving actual browser permission under the device/browser's control.
- Added a device-specific **Remember my EasyBev profile** setting.
- Guest preferences are stored on the guest profile and are not automatically exposed across waiter screens in this release.

## Management menu categorisation
- Added data-backed venue menu categories under `menuCategories`.
- First-time management setup seeds practical defaults: **Drinks, Shots, Starters, Mains, Dessert, Sushi, Other**.
- Categories are not hard-coded waiter pages. Management can add, rename, reorder, hide or show categories later.
- **Other** remains the safe fallback so legacy or uncategorised items never disappear from the waiter pad.
- Menu-item create/edit now includes a required category selector.
- Item lists show category and price together and can be filtered by active category.
- Existing menu items without a `categoryId` remain valid and resolve to **Other** without destructive migration.

## Rush-hour waiter digital pad
- Replaced the flat Quick Items area with compact horizontal tabs: **Frequent + active venue categories**.
- **Frequent** ranks the venue's commonly used items from prior session activity.
- Category item buttons are compact, bounded in height, and scroll inside the item area rather than making the whole pad excessively long.
- Added quick quantity taps: **1×, 2×, 3×, 4×, 6×**. Select quantity, then tap the item.
- Manual typing/search remains available as an escape route and still supports shortcuts such as `6 Corona`.
- Search suggestions now show category as well as price.
- **Repeat Last Round** remains intact.
- Catalogued items written to a session now snapshot `menuItemId`, `categoryId` and `categoryName` alongside the item name/price for future reporting and POS integration.

## Product restraint
The categories organise the catalogue; they do not create nested menu navigation or new waiter workflows. The waiter still has one digital pad, one search field, one row of category tabs and one compact item grid.

## Production note
Guest profile data and venue menu configuration are still written by the prototype browser client. Production must enforce guest ownership and venue-management authority through Firebase Authentication, Realtime Database Security Rules and/or trusted server-side functions.

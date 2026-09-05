# EasyBev Staff Identity v1

This build introduces persistent staff profiles while preserving permanent waiter QR slots.

## Data model
- `staff/<staffId>`: persistent staff identity with name, mobile, optional Firebase UID and active state.
- `waiters/<slot>`: permanent QR/service slot with `assignedStaffId` and `assignedStaffName`.
- New guest sessions snapshot `waiterStaffIdAtStart` and `waiterStaffNameAtStart` so later slot reassignment cannot rewrite historical attribution.

## Backward compatibility
Existing `waiters/<slot>/name` values still display and are treated as legacy assignments. Assigning a Staff Profile writes both the new identity fields and the old `name` snapshot so existing waiter/guest logic continues to work.

## Test order
1. Management > Staff > add a staff profile.
2. Open a waiter slot > assign the profile > Save Assignment.
3. Open the guest QR/link for that slot and create a new session.
4. Confirm guest sees the assigned staff name.
5. Confirm waiter dashboard sees the new session.
6. Reassign the slot to another staff profile and confirm the old session still retains the original `waiterStaffIdAtStart` / `waiterStaffNameAtStart` in Firebase.

Authentication enforcement is deliberately not switched on in this build. `firebaseUid` is stored as the future authentication anchor, allowing us to connect the existing Firebase Auth users in the next controlled step.

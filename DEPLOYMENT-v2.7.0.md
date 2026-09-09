# EasyBev v2.7.0 Deployment — exact order

## Important
Do not publish the v2.7.0 Security Rules before the data migration and app test. The old app reads legacy root paths; the new app reads venue-namespaced paths.

## 1. Keep the current live rules unchanged
Leave the current temporary development rules in place during migration and first application test.

## 2. Run the non-destructive venue migration in Cloud Shell
Use the same `easybev-prototype` Google Cloud project used for the Owner custom claim.

The migration script requires `firebase-admin`. The existing `~/easybev-owner-bootstrap` folder already has it from the Owner bootstrap step.

Upload `MIGRATE-TO-VENUE-v2.7.0.js` to Cloud Shell, then run:

```bash
mv ~/MIGRATE-TO-VENUE-v2.7.0.js ~/easybev-owner-bootstrap/
cd ~/easybev-owner-bootstrap
node MIGRATE-TO-VENUE-v2.7.0.js
```

Expected final line group includes `SUCCESS`.

The script copies; it does not delete the old root operational data.

## 3. Check Firebase Data
Confirm these exist:

```text
venues
  venue-main
    waiters
    sessions
    menuItems
    menuCategories
    menuUsage
    staff
```

Also confirm the Waiter access record under `accessByUid/<waiter UID>` now has:

```text
role: waiter
waiterSlot: "1"
venueId: venue-main
active: true
```

`waiterSlot` is deliberately stored as a string because session waiter slots are strings.

## 4. Deploy the v2.7.0 app
Use the normal workflow:
- unzip the package;
- copy its contents into the existing EasyBev repository folder;
- choose Replace when Windows asks;
- do not delete/recreate the repository folder;
- commit and push.

## 5. Test before security-rule cutover
With the temporary rules still live, verify:
- Owner signs in and refresh survives;
- Waiter signs in and sees Waiter 1 sessions;
- Guest scans/opens Waiter 1 QR, verifies OTP, connects;
- guest request/message/bill request reaches Waiter;
- waiter item capture/void/reconciliation still works;
- manager functions work if a real Manager account is configured.

## 6. Publish v2.7.0 Security Rules
Only after step 5 passes, open Firebase Console → Realtime Database → Rules.
Replace the temporary rules with `database.rules.PRODUCTION-v2.7.0.json`, then Publish.

## 7. Repeat the security test matrix
See `SECURITY-TEST-MATRIX-v2.7.0.md`.

## Rollback
If the v2.7 app must be rolled back after it has received live writes:
1. restore the previous temporary rules/app;
2. upload and run `ROLLBACK-VENUE-v2.7.0.js` in `~/easybev-owner-bootstrap` to copy current namespaced operational data back to the legacy root;
3. do not delete the namespaced data.

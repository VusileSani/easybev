# EasyBev v2.6.0 Authentication Deployment Checklist

1. Keep the existing live RTDB rules temporarily while testing the new authenticated flows.
2. Deploy v2.6.0 to the test URL.
3. Sign in with the Firebase Owner account and confirm the Owner dashboard opens automatically.
4. Confirm `?owner=1`, `?admin=1`, `?manager=1`, and `?waiter=1` no longer grant staff views.
5. Create one Manager and one Waiter Firebase Auth account. Do not share passwords.
6. Add trusted mappings under `accessByUid/<uid>`:
   - Manager: `{ role: "manager", active: true, venueId: "venue-main" }`
   - Waiter: `{ role: "waiter", active: true, venueId: "venue-main", waiterSlot: "1", staffId: "<existing staff id>" }`
7. Test guest phone OTP on a real South African mobile number via a waiter QR/service URL.
8. Test cross-role denial paths before publishing restrictive RTDB rules.
9. Review `database.rules.DRAFT-v2.6.0.json` in the Firebase Rules Simulator, but DO NOT publish this draft as-is. It is a review aid until guest/session child-level permissions and venue namespacing are completed.
10. Venue namespacing remains the final scale migration: operational data must move under `venues/<venueId>/...` before production multi-venue onboarding. This release does not claim production-ready until that migration and rule update are completed.

Security note: the database staff record is not the source of Platform Owner authority. The trusted `easybevRole` custom claim is.

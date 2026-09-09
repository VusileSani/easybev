# EasyBev v2.6.0 — Real Authentication Foundation

## Primary milestone
EasyBev now uses Firebase Authentication as the source of user identity. Production staff authority is no longer selected by URL query flags or the prototype actor switcher.

## Implemented
- Added Firebase Authentication SDK to the web build.
- Added real email/password staff sign-in.
- Reads the trusted `easybevRole` custom claim for Platform Owner / Platform Admin authority.
- Added venue-access resolution through `accessByUid/<uid>` for Manager / Waiter accounts.
- Waiter service slot is resolved from authenticated access data, not a `?waiter=` URL.
- Removed the production View-as actor switcher.
- Added sign-out.
- Replaced demo OTP `123456` with Firebase Phone Authentication and invisible reCAPTCHA.
- Guest profile IDs migrate to Firebase Auth UID for newly verified guests.
- Guest QR URLs may still carry `?guest=<slot>` because that selects service context, not authority.
- Included candidate RTDB Security Rules and deployment checklist.

## Important deployment state
This package is an authentication migration release candidate. Do not call the system production-ready until the supplied Security Rules are reviewed/published and the venue data migration/access mappings are completed. The current live database rules should remain unchanged until the authenticated flows have been tested.

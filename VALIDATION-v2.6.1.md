# EasyBev v2.6.1 Validation

## Static validation completed
- All JavaScript modules pass `node --check`.
- No duplicate HTML element IDs detected.
- Inline `onclick` handler names resolve to defined JavaScript functions.
- Legacy direct `connectRememberedGuest()` bypass is absent.
- No guest UI calls `connectGuestToSession()` directly from a remembered-session button.
- Guest connection function now checks Firebase phone identity and session ownership.
- Announcement dismiss handler and per-user receipt path are present.
- ZIP extraction/integrity verified after packaging.

## Behaviour requiring live Firebase test
- Real SMS delivery/reCAPTCHA.
- Legacy guest session migration against live RTDB data.
- Cross-device announcement dismissal receipt sync.
- Owner session persistence across deployed GitHub Pages tabs/devices.

## Production blockers still open
- Final RTDB Security Rules publication.
- Manager/Waiter real account mappings and denial tests.
- Venue-scoped operational namespacing for multi-venue scale.
- Production indexes for scoped RTDB queries.
- Stronger Owner/Admin controls such as MFA/session revocation before production.

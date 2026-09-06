# GoodKota v5.0 — Platform Governance

GoodKota v5.0 retains the location-first ordering, verified quality, merchant, delivery and customer foundations while adding a protected company-governance layer.

## Actors

- **Customer** — discover nearby merchants, order, pay and track delivery.
- **Merchant** — manage orders, menu, settlement and request GoodKota support.
- **Driver** — manage assigned delivery and proof of delivery.
- **Delivery Ops** — dispatch and monitor deliveries.
- **GoodKota Admin** — run merchant support, compliance, commercial status, announcements and routine platform operations.
- **GoodKota Owner** — govern platform authority, protected company controls and the full privileged audit.

The actor dropdown is a testing convenience. Production authorization must be enforced server-side.

## Merchant model

A Merchant is the actual operating store/location. Merchant records directly own address, coordinates, operations, delivery, compliance, settlement, quality and commercial status. Orders reference `merchantId` only.

Merchant onboarding now accepts any real South African address and resolves it to coordinates. Manual latitude/longitude entry remains available if address lookup is unavailable.

## Platform continuity

GoodKota now includes:
- platform staff authority
- support cases
- announcements
- operational and privileged audit history
- protected company controls
- merchant commercial status

See `PLATFORM-GOVERNANCE.md` for the authority model and production security rules.

## Core product invariants

- location-first merchant discovery
- verified GoodKota-order quality signals
- direct merchant settlement architecture
- delivery as a separate operational domain
- hybrid GoodKota/merchant/future third-party delivery support
- customer PIN proof of delivery
- no silent deletion/rewrite of financial or privileged audit history in production
- at least one active GoodKota Owner at all times

## Architecture

```text
index.html
css/styles.css
js/app.js
js/core/store.js
js/core/utils.js
js/data/seed.js
js/services/
  location-service.js
  geocoding-service.js
  notification-service.js
  payment-service.js
  quality-service.js
  delivery-service.js
js/views/
  customer-view.js
  merchant-view.js
  driver-view.js
  delivery-ops-view.js
  admin-view.js
  owner-view.js
service-worker.js
manifest.webmanifest
PLATFORM-GOVERNANCE.md
FIREBASE-SCHEMA.md
DELIVERY-ARCHITECTURE.md
```

## Production stack

Firebase Authentication + Cloud Firestore + Cloud Functions + Firebase Cloud Messaging.

Privileged Owner/Admin transitions, payment confirmation, merchant suspension, order/delivery state transitions and audit writes must be enforced by trusted server-side logic and Security Rules rather than the browser UI.

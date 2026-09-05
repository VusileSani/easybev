# EasyBev Refactor v1

This build is a structural refactor of the stable pre-refactor prototype.
No intentional product behaviour changes were introduced.

## Structure
- `index.html` — markup only
- `css/styles.css` — all application styling
- `js/state.js` — Firebase config, URL mode and shared state
- `js/notifications.js` — local attention and notification layer
- `js/helpers.js` — shared helper functions
- `js/firebase.js` — Firebase startup and waiter-slot bootstrap
- `js/auth.js` — reserved for the Staff Identity authentication phase
- `js/navigation.js` — actor navigation, routing and resume-session UI
- `js/guest.js` — guest verification, profiles, sessions, requests and bill view
- `js/waiter.js` — waiter dashboard, session cards, POS reconciliation and messaging
- `js/orders.js` — waiter order pad, item capture, bill finalisation and session closure
- `js/manager.js` — manager dashboard, reports, menu items and waiter slots
- `js/app.js` — application startup and global keyboard handlers

The script order in `index.html` is deliberate because this remains a classic-browser-script application for now.

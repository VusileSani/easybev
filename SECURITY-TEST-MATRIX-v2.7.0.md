# EasyBev v2.7.0 Security Test Matrix

## Unauthenticated browser
Should be able to:
- read public service status / public feature switches;
- read one waiter slot directly from a guest QR context;
- read bounded public/venue announcements.

Must not be able to:
- read sessions;
- read guest profiles;
- read staff/menu collections;
- write any operational or platform data.

## Firebase Phone Guest
Should be able to:
- read/write own `users/<uid>` profile;
- create a new session for an active waiter;
- query only sessions where `guestUserId == auth.uid` with the bounded query;
- read own session directly;
- send own messages / service request;
- request own bill.

Must not be able to:
- read another guest session;
- alter items, totals, reconciliation or paid/finalized settlement state;
- write another user's profile;
- read venue staff/menu configuration;
- read internal platform announcements/control data.

## Waiter
Should be able to:
- read own `accessByUid` mapping;
- read venue menu/catalogue and waiter-slot information;
- query sessions only for the assigned waiter slot;
- update sessions currently assigned to that slot.

Must not be able to:
- query another waiter's sessions;
- change venue staff/menu configuration;
- access Platform Owner/Admin control data.

## Manager
Should be able to:
- manage waiter slots, venue staff and menu data for the assigned venue;
- read the bounded recent venue session window;
- create/read support requests for the assigned venue.

Must not be able to:
- read another venue's operational data;
- modify EasyBev platform staff authority;
- access Owner-only authority controls.

## EasyBev Admin
Should be able to:
- operate platform venues/support/announcements/features;
- read platform staff and audit history;
- operate venue data for support purposes.

Must not be able to:
- modify `platform/staff` Owner/Admin authority records.

## Owner
Should be able to:
- perform Admin capabilities;
- modify platform authority records;
- read protected audit data.

## Negative URL test
`?owner=1`, `?admin=1`, `?manager=1`, or `?waiter=1` must never grant staff authority.
`?guest=<slot>&venue=<venueId>` selects service context only.

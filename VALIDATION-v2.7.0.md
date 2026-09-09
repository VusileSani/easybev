# EasyBev v2.7.0 Validation

Static/regression checks run during packaging:
- all JavaScript files parse with Node `--check`;
- all inline HTML action handlers resolve to defined functions;
- no duplicate HTML IDs;
- no direct client references remain to legacy root operational paths (`waiters`, `sessions`, `staff`, `menuItems`, `menuCategories`, `menuUsage`);
- operational root multi-location updates pass through the venue-scoping adapter;
- waiter session subscription is restricted to waiter slot and limited to 100;
- guest session queries are restricted to Firebase UID and limited to 25;
- manager/session/platform historical live reads remain bounded;
- QR guest links include venue ID;
- guest camera QR entry validates permitted EasyBev hosts, waiter slot and venue identifier;
- migration and rollback scripts parse successfully;
- production rules file is valid JSON;
- package checksum and unzip integrity are verified.

Live Firebase Rules behavior must still be tested after deployment using the supplied Security Test Matrix; JSON/static validation is not a substitute for Firebase server rule evaluation.

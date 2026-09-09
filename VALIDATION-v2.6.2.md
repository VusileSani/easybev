# EasyBev v2.6.2 Validation — Ease + Scale Hardening

## Validation performed
- JavaScript syntax parse: PASS for every file in `js/`.
- HTML duplicate-ID scan: PASS.
- Inline HTML handler resolution: PASS (all referenced EasyBev functions found).
- Authentication authority regression: no `owner`, `admin`, `manager`, or `waiter` URL parameter is read as staff authority.
- Guest-home regression: the public home no longer contains a hard-coded `?guest=1` shortcut.
- Guest OTP stress guard: send and verify operations have in-flight locks and disabled busy states.
- Live-listener lifecycle: waiter, guest, manager and platform operational listeners can be replaced/detached instead of stacking on repeated role/view starts.
- Manager session feed: bounded recent-session query is used rather than an unbounded all-history subscription.
- Platform operational feeds: high-growth feeds use bounded queries for venues, applications, announcements, support, audit and recent sessions.
- Platform bootstrap: no longer reads the entire `platform` tree just to ensure foundation records.
- Rules JSON parse: PASS for legacy draft and v2.6.2 target rules.
- Index coverage: draft/target rules include indexes for new bounded query fields.

## Ease-under-pressure checks
- Public guest entry now matches the real-world path: scan the waiter's QR; no arbitrary default waiter selection.
- Authentication actions use plain action language: `Send code` and `Verify & connect`.
- Rapid double taps on OTP actions are ignored while the first operation is pending.
- No new operational menu or extra decision step was added to waiter/guest service flows.

## Scale boundary
This release removes several browser-side patterns that would degrade badly with growth, but it must not be described as a completed million-concurrent-user architecture.

Before broad production, complete the venue namespace migration, server-trusted provisioning, Security Rules emulator testing/publication, App Check/abuse controls, server-maintained platform aggregates and RTDB shard routing.

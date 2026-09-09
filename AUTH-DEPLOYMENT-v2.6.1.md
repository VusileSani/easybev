# EasyBev v2.6.1 Authentication Test Checklist

1. Deploy v2.6.1 while keeping the existing temporary RTDB rules unchanged.
2. Re-test Owner email/password sign-in and automatic Owner routing.
3. Refresh Owner on both phone and laptop; confirm concurrent sessions remain valid.
4. Publish an internal Owner/Admin announcement and confirm the × dismiss control removes it.
5. On the second device using the same Owner account, confirm the dismissal synchronises after Firebase receives the receipt.
6. Test an old prototype guest browser state:
   - open a remembered waiter/session link;
   - confirm EasyBev does not reconnect from old localStorage identity alone;
   - complete Firebase SMS verification;
   - confirm the matching old active session reconnects and migrates to the Firebase UID.
7. Refresh after successful phone authentication; confirm an already authenticated phone guest may reconnect to the matching session without another SMS challenge.
8. Try a different verified phone number against the remembered session; confirm access is refused.
9. Confirm `?owner=1`, `?admin=1`, `?manager=1`, and `?waiter=1` still do not grant staff authority.
10. Do not publish `database.rules.DRAFT-v2.6.0.json` yet. Restrictive production rules still require venue namespacing and final child-level guest/session permissions.

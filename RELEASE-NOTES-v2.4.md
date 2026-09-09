# EasyBev v2.4 — Session Lifecycle & Waiter Handover

## Session lifecycle correction
- Added an explicit service-session lifecycle: **Active → Bill requested → Awaiting settlement → Closed**.
- Kept the existing `session.status` and `bill.status` fields for backward compatibility with existing Firebase data and screens.
- New lifecycle state lives under `sessions/<id>/lifecycle/state` and is derived safely for older sessions that do not yet have the new field.
- Guest bill requests and waiter-recorded verbal bill requests now create explicit lifecycle transitions.
- POS reconciliation remains required before a requested bill can be processed.
- Processing the bill moves the session to **Awaiting settlement** and locks order items.
- Closing requires the bill to have been processed and records the normal close in history.
- Exceptional `End Session` remains available only behind the compact **More** control for abandoned/stuck sessions.

## Waiter handover
- Active sessions can be transferred from one assigned active waiter slot to another without creating a new guest session.
- Handover preserves the session id, guest identity, live bill, item history, requests, messages and original waiter-at-start snapshot.
- Current waiter ownership is stored separately (`waiterSlot`, `waiterStaffIdCurrent`, `waiterStaffNameCurrent`) while the original assignment remains available for historical reporting.
- The guest view follows the new waiter automatically while the live session is open.
- Remembered guest sessions can still resume through the original waiter QR after a handover, preventing session loss during shift changes.
- Management can perform the same transfer from the expanded waiter detail view.

## Close / reopen correction
- Waiters and venue managers can reopen a normally closed session from **Recently closed**.
- Reopen restores the safe lifecycle state implied by the bill: Active, Bill requested, or Awaiting settlement.
- Reopening never silently unlocks a processed bill or removes the prior close event.

## Audit trail
- Lifecycle transitions and waiter handovers append timestamped session-level audit events under `lifecycleEvents`.
- Active waiter cards expose a compact recent **Session activity** view under **More**.
- Closed/reopened events remain in the same session record.

## Management visibility
- Management service pulse now distinguishes **Bill requests** from sessions **Awaiting settlement**.
- Expanded waiter details expose active-session lifecycle state, transfer controls and recently closed sessions with reopen controls.

## Production note
The current prototype still performs operational writes from the browser. Before production, lifecycle, handover, close and reopen authority must be enforced by Firebase Authentication, database security rules and/or trusted server-side functions so clients cannot grant themselves operational authority or alter protected audit history.

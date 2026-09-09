/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function money(value) {

  return "R" +
    Number(value || 0)
      .toFixed(2);

}


function cleanPhone(phone) {

  return String(phone || "")
    .replace(/\s+/g, "")
    .replace(/-/g, "");

}


function escapeHtml(value) {

  return (value === null || value === undefined ? "" : String(value))
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function calculateTotal(items) {

  if (!items)
    return 0;

  return Object
    .values(items)
    .reduce(
      (total, item) => {

        const price = Number(item && item.price);
        const qty = Number(item && item.qty == null ? 1 : item.qty);

        if (!Number.isFinite(price) || !Number.isFinite(qty) || qty <= 0) {
          return total;
        }

        return total + (price * qty);

      },
      0
    );

}


function makeSessionCode(
  sessionId
) {

  const raw =
    String(sessionId || "")
      .replace(
        /[^a-zA-Z0-9]/g,
        ""
      )
      .slice(-5)
      .toUpperCase();

  return raw
    ? `G-${raw}`
    : "GUEST";

}


function guestLabel(
  sessionId,
  session
) {

  return (
    session &&
    session.sessionCode
  )
    ? session.sessionCode
    : makeSessionCode(
        sessionId
      );

}


function guestName(session) {
  return String(
    (session && (session.guestNameCurrent || session.guestNameAtStart || session.guestName)) || "Guest"
  ).trim() || "Guest";
}


function waiterFallbackName(
  slot
) {

  return `Waiter ${slot}`;

}


function getWaiterDisplayName(
  waiter
) {

  if (
    waiter &&
    waiter.assignedStaffName
  ) {

    return waiter.assignedStaffName;

  }

  if (
    waiter &&
    waiter.name
  ) {

    return waiter.name;

  }

  return waiterFallbackName(
    waiter
      ? waiter.slot
      : ""
  );

}


function guestStorageVenueId() {
  try {
    const venue = new URLSearchParams(window.location.search).get("venue");
    return String(venue || "venue-main").trim() || "venue-main";
  } catch (_) {
    return "venue-main";
  }
}

function sessionStorageKey(slot) {
  const venue = guestStorageVenueId();
  const key = `easybev_guest_session_${venue}_${slot}`;
  const legacyKey = `easybev_guest_session_${slot}`;
  if (localStorage.getItem(key) === null && localStorage.getItem(legacyKey) !== null) {
    localStorage.setItem(key, localStorage.getItem(legacyKey));
  }
  return key;
}

function phoneStorageKey(slot) {
  const venue = guestStorageVenueId();
  const key = `easybev_guest_phone_${venue}_${slot}`;
  const legacyKey = `easybev_guest_phone_${slot}`;
  if (localStorage.getItem(key) === null && localStorage.getItem(legacyKey) !== null) {
    localStorage.setItem(key, localStorage.getItem(legacyKey));
  }
  return key;
}


function guestUserStorageKey() {
  return "easybev_guest_user_id";
}

function rememberedGuestNameKey() {
  return "easybev_guest_name";
}

function rememberGuestStorageKey() {
  return "easybev_guest_remembered";
}

function phoneIndexKey(phone) {
  let digits = String(cleanPhone(phone) || "").replace(/[^0-9]/g, "");
  if (digits.length === 10 && digits.startsWith("0")) {
    digits = `27${digits.slice(1)}`;
  }
  return digits;
}

function sortedWaiterEntries(waiters) {
  return Object.entries(waiters || {})
    .filter(([, waiter]) => waiter)
    .sort((a, b) => Number(a[0]) - Number(b[0]));
}


function escapeJsString(value) {
  /* Values produced here are embedded inside single-quoted JavaScript
     strings that themselves live inside double-quoted HTML attributes.
     Protect both parsing layers so venue-managed names cannot break out. */
  return (value === null || value === undefined ? "" : String(value))
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


function sessionOriginalWaiterSlot(session) {
  return String(
    (session && (session.waiterSlotAtStart || session.waiterSlot)) ||
    ""
  ).trim();
}


function sessionWaiterSnapshotName(session) {
  if (!session) return "";

  return String(
    session.waiterStaffNameAtStart ||
    session.waiterNameAtStart ||
    ""
  ).trim();
}


function sessionWaiterSnapshotId(session) {
  return String(
    (session && session.waiterStaffIdAtStart) ||
    ""
  ).trim();
}


function sessionWaiterCurrentName(session) {
  if (!session) return "";

  return String(
    session.waiterStaffNameCurrent ||
    session.waiterNameCurrent ||
    session.waiterStaffNameAtStart ||
    session.waiterNameAtStart ||
    ""
  ).trim();
}


function sessionWaiterCurrentId(session) {
  return String(
    (session && (
      session.waiterStaffIdCurrent ||
      session.waiterStaffIdAtStart
    )) ||
    ""
  ).trim();
}


function sessionWaiterDisplayName(session, fallbackWaiter = null) {
  const snapshotName = sessionWaiterSnapshotName(session);
  if (snapshotName) return snapshotName;

  if (fallbackWaiter) {
    return getWaiterDisplayName(fallbackWaiter);
  }

  return waiterFallbackName(
    session && session.waiterSlot
      ? session.waiterSlot
      : ""
  );
}


function sessionBillStatus(session) {
  return String(
    (session && session.bill && session.bill.status) ||
    "open"
  );
}


function sessionLifecycleState(session) {
  if (!session) return "closed";

  const stored = String(
    (session.lifecycle && session.lifecycle.state) ||
    ""
  ).trim();

  if (stored) return stored;

  if (["closed", "ended"].includes(String(session.status || ""))) {
    return "closed";
  }

  const billStatus = sessionBillStatus(session);

  if (billStatus === "requested") return "bill_requested";
  if (["finalized", "paid"].includes(billStatus)) return "awaiting_settlement";
  return "active";
}


function sessionLifecycleLabel(sessionOrState) {
  const state = typeof sessionOrState === "string"
    ? sessionOrState
    : sessionLifecycleState(sessionOrState);

  return ({
    active: "Active",
    bill_requested: "Bill requested",
    awaiting_settlement: "Awaiting settlement",
    closed: "Closed"
  })[state] || "Active";
}


function sessionLifecycleBadgeClass(sessionOrState) {
  const state = typeof sessionOrState === "string"
    ? sessionOrState
    : sessionLifecycleState(sessionOrState);

  if (state === "bill_requested") return "alert";
  if (state === "awaiting_settlement") return "warning";
  if (state === "closed") return "";
  return "active";
}


function lifecycleActorContext(overrides = {}) {
  const actor = {
    role: "system",
    slot: null,
    name: "EasyBev"
  };

  if (typeof managerMode !== "undefined" && managerMode) {
    actor.role = "manager";
    actor.name = "Venue Management";
  }
  else if (typeof waiterSlot !== "undefined" && waiterSlot) {
    actor.role = "waiter";
    actor.slot = String(waiterSlot);
    actor.name = `Waiter ${waiterSlot}`;
  }
  else if (typeof guestSlot !== "undefined" && guestSlot) {
    actor.role = "guest";
    actor.slot = String(guestSlot);
    actor.name = "Guest";
  }

  return { ...actor, ...overrides };
}


function addLifecycleTransitionUpdates(
  updates,
  sessionId,
  session,
  toState,
  action,
  actorOverrides = {},
  details = {}
) {
  const base = `sessions/${sessionId}`;
  const timestamp = firebase.database.ServerValue.TIMESTAMP;
  const eventKey = db.ref(`${base}/lifecycleEvents`).push().key;
  const fromState = sessionLifecycleState(session);
  const actor = lifecycleActorContext(actorOverrides);

  updates[`${base}/lifecycle/state`] = toState;
  updates[`${base}/lifecycle/updatedAt`] = timestamp;
  updates[`${base}/lifecycle/lastAction`] = action;
  updates[`${base}/lifecycleEvents/${eventKey}`] = {
    fromState,
    toState,
    action,
    actorRole: actor.role || "system",
    actorSlot: actor.slot || null,
    actorName: actor.name || null,
    details: details || {},
    createdAt: timestamp
  };

  return updates;
}


function lifecycleEventList(session) {
  return Object.values((session && session.lifecycleEvents) || {})
    .filter(Boolean)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}


function lifecycleActionLabel(action) {
  return ({
    session_started: "Session started",
    bill_requested: "Bill requested",
    bill_requested_by_waiter: "Bill request recorded",
    bill_processed: "Bill processed",
    payment_recorded: "Payment recorded",
    waiter_handover: "Waiter handover",
    session_closed: "Session closed",
    session_ended_override: "Session ended by override",
    session_reopened: "Session reopened"
  })[String(action || "")] || "Session updated";
}


function sessionLifecycleHistoryHtml(session, limit = 4) {
  const events = lifecycleEventList(session).slice(0, limit);
  if (!events.length) return `<p class="muted">No lifecycle activity recorded yet.</p>`;

  return `<div class="lifecycle-history">${events.map(event => {
    const when = Number(event.createdAt || 0)
      ? new Date(Number(event.createdAt)).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
      : "just now";
    const actor = event.actorName || event.actorRole || "EasyBev";
    return `<div class="lifecycle-event"><span><strong>${escapeHtml(lifecycleActionLabel(event.action))}</strong><small>${escapeHtml(actor)}</small></span><small>${escapeHtml(when)}</small></div>`;
  }).join("")}</div>`;
}


function sessionOrderIsLocked(session) {
  const status = sessionBillStatus(session);
  return status === "finalized" || status === "paid";
}


function sessionBillTotal(session) {
  if (!session) return 0;

  const rawFinalizedTotal = session.bill && session.bill.finalizedTotal;
  const finalizedTotal = rawFinalizedTotal === null || rawFinalizedTotal === undefined
    ? NaN
    : Number(rawFinalizedTotal);

  if (
    sessionOrderIsLocked(session) &&
    Number.isFinite(finalizedTotal)
  ) {
    return finalizedTotal;
  }

  return calculateTotal(session.items || {});
}



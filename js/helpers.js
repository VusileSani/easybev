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

  return String(value || "")
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

        return (
          total +
          Number(item.price || 0) *
          Number(item.qty || 1)
        );

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
    (session && (session.guestNameAtStart || session.guestName)) || "Guest"
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


function sessionStorageKey(
  slot
) {

  return (
    `easybev_guest_session_${slot}`
  );

}


function phoneStorageKey(
  slot
) {

  return (
    `easybev_guest_phone_${slot}`
  );

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

function activeWaiterEntries(waiters) {
  return Object.entries(waiters || {})
    .filter(([, waiter]) => waiter)
    .sort((a, b) => Number(a[0]) - Number(b[0]));
}

async function getAllWaiters() {
  const snap = await db.ref("waiters").once("value");
  return snap.val() || {};
}



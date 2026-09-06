/* =========================================================
   WAITER DASHBOARD
   ========================================================= */

async function startWaiterDashboard(
  slot
) {

  try {

    const waiter =
      await getWaiter(
        slot
      );

    if (!waiter.exists) {
      showStartupError(`Waiter slot ${slot} does not exist.`);
      return;
    }


    const waiterName =
      getWaiterDisplayName(
        waiter
      );


    document
      .getElementById(
        "waiterDashboardTitle"
      )
      .textContent =
        `${waiterName}'s Guests`;


    /*
      LIVE WAITER NAME UPDATE
    */

    db
      .ref(
        `waiters/${slot}`
      )
      .on(
        "value",
        snap => {

          const latest =
            snap.val() || {};


          const name = getWaiterDisplayName({
            ...latest,
            slot: String(slot)
          });


          document
            .getElementById(
              "waiterDashboardTitle"
            )
            .textContent =
              `${name}'s Guests`;

        }
      );


    /*
      LIVE GUEST SESSION UPDATE
    */

    db
      .ref(
        "sessions"
      )
      .on(
        "value",
        snap => {

          const sessions =
            snap.val() || {};


          latestWaiterSessions = sessions;

          monitorWaiterAlerts(
            slot,
            sessions
          );

          renderWaiterDashboard(
            slot,
            sessions
          );

        }
      );

  }
  catch (error) {

    console.error(error);

    showStartupError(
      error.message ||
      "Could not load waiter dashboard."
    );

  }

}


function renderWaiterDashboard(
  slot,
  sessions
) {

  const container =
    document.getElementById(
      "waiterSessions"
    );


  const activeSessions =

    Object.entries(
      sessions
    )

      .filter(
        ([, session]) =>

          session &&

          session.status ===
            "active" &&

          String(
            session.waiterSlot
          ) ===
            String(
              slot
            )

      )

      .sort(
        (a, b) =>

          Number(
            b[1].lastActivityAt ||
            b[1].createdAt ||
            0
          )

          -

          Number(
            a[1].lastActivityAt ||
            a[1].createdAt ||
            0
          )
      );


  if (
    !activeSessions.length
  ) {

    container.innerHTML = `

      <div class="card">

        <p class="muted">
          No active guest sessions.
        </p>

      </div>

    `;

    return;

  }


  container.innerHTML =

    activeSessions
      .map(

        ([sessionId, session]) =>

          waiterSessionHtml(
            sessionId,
            session
          )

      )
      .join("");

}


/* =========================================================
   WAITER SESSION CARD
   ========================================================= */

function waiterRequestHtml(sessionId, request) {
  if (!request || request.status === "completed") return "";

  const acceptButton = request.status === "new"
    ? `<button class="blue" onclick="acknowledgeRequest('${sessionId}')">Accept</button>`
    : "";

  const completeButton = request.status === "acknowledged" && request.type !== "bill"
    ? `<button class="success" onclick="completeRequest('${sessionId}')">Delivered / Done</button>`
    : "";

  const statusLabel = request.status === "new"
    ? "Needs attention"
    : request.status === "acknowledged"
      ? "Accepted"
      : "In progress";

  return `
    <div class="status ${request.status === "new" ? "danger" : ""}">
      <div class="request-status-line">
        <strong>${escapeHtml(request.label || "")}</strong>
        <span>${escapeHtml(statusLabel)}</span>
      </div>
      <div class="request-actions">
        ${acceptButton}
        ${completeButton}
      </div>
    </div>`;
}


function waiterBillActionHtml(sessionId, session) {
  const billStatus = sessionBillStatus(session);

  if (billStatus === "requested") {
    const reconciliationStatus = String(
      (session.reconciliation && session.reconciliation.status) || ""
    );

    if (reconciliationStatus === "stale") {
      return `<span class="badge">Reconcile POS list again before finalising</span>`;
    }

    if (reconciliationStatus !== "reconciled") {
      return `<span class="badge">Reconcile POS list before finalising</span>`;
    }

    return `<button class="success" onclick="finalizeBill('${sessionId}')">Done – Finalise Bill</button>`;
  }

  if (billStatus === "finalized") {
    return `<span class="badge active">Bill Finalised – Awaiting Payment</span>`;
  }

  if (billStatus === "paid") {
    return `<button class="success" onclick="closePaidSession('${sessionId}')">Close Session</button>`;
  }

  return "";
}


function waiterOrderActionsHtml(sessionId, label, session) {
  const addItems = sessionOrderIsLocked(session)
    ? `<span class="badge">Order locked</span>`
    : `<button class="blue" onclick="openItemModal('${sessionId}', '${escapeJsString(label)}')">Add Items</button>`;

  return `
    ${addItems}
    <button class="secondary" onclick="openReconcileModal('${sessionId}')">POS List</button>`;
}


function waiterSessionHtml(sessionId, session) {
  const total = sessionBillTotal(session);
  const label = guestLabel(sessionId, session);
  const unreadCount = waiterUnreadCount(waiterSlot, sessionId, session);

  return `
    <div class="session-card active ${unreadCount ? "has-unread" : ""}">
      <div class="heading-row">
        <div>
          <div class="guest-name-line">${escapeHtml(guestName(session))}</div>
          <div class="guest-code-line">${escapeHtml(label)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
          ${unreadCount ? `<span class="unread-badge">${unreadCount} new</span>` : ""}
          <span class="badge active">Active</span>
        </div>
      </div>

      ${unreadCount ? `
        <div class="attention-row">
          <strong>New guest activity</strong>
          <button class="secondary" onclick="markWaiterSessionSeen('${sessionId}')">Mark seen</button>
        </div>` : ""}

      ${waiterRequestHtml(sessionId, session.latestRequest)}
      ${waiterChatHtml(sessionId, session.messages || {})}

      <div>
        <strong>Current total</strong>
        <div class="big-number">${money(total)}</div>
      </div>

      <br>
      ${waiterOrderActionsHtml(sessionId, label, session)}
      ${waiterBillActionHtml(sessionId, session)}

      ${sessionBillStatus(session) !== "paid" ? `
        <details class="session-more">
          <summary>More</summary>
          <div class="session-more-body">
            <button class="danger" onclick="endSessionOverride('${sessionId}', 'waiter_override')">End Session</button>
            <p class="muted">For abandoned or stuck service sessions.</p>
          </div>
        </details>
      ` : ""}
    </div>`;
}


/* =========================================================
   POS RECONCILIATION
   ========================================================= */

async function openReconcileModal(sessionId) {
  reconcileModalSessionId = sessionId;

  const snap = await db.ref(`sessions/${sessionId}`).once("value");
  const session = snap.val() || {};
  const items = Object.values(session.items || {});
  const label = guestLabel(sessionId, session);

  document.getElementById("reconcileGuest").textContent =
    `${guestName(session)} · ${label}`;

  const list = document.getElementById("reconcileItems");

  if (!items.length) {
    list.innerHTML = `<p class="muted">No items have been captured for this guest yet.</p>`;
  } else {
    const rows = items.map(item => {
      const qty = Number(item.qty || 1);
      const price = Number(item.price || 0);
      return `
        <div class="reconcile-row">
          <strong>${qty}×</strong>
          <span>${escapeHtml(item.name || "Item")}</span>
          <span class="num unit-price">${money(price)}</span>
          <strong class="num">${money(price * qty)}</strong>
        </div>`;
    }).join("");

    list.innerHTML = `
      <div class="reconcile-row header">
        <span>Qty</span>
        <span>Item</span>
        <span class="num unit-price">Unit</span>
        <span class="num">Line total</span>
      </div>
      ${rows}`;
  }

  document.getElementById("reconcileTotal").textContent =
    money(sessionBillTotal(session));

  renderReconcileStatus(session.reconciliation || {});
  document.getElementById("reconcileModal").classList.remove("hidden");
}

function renderReconcileStatus(reconciliation) {
  const status = document.getElementById("reconcileStatus");
  const button = document.getElementById("markReconciledButton");
  const reconciledAt = Number(reconciliation.reconciledAt || 0);

  if (reconciliation.status === "reconciled") {
    const when = reconciledAt
      ? new Date(reconciledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
      : "recorded";
    status.innerHTML = `<span class="badge active">Reconciled</span> <span>Marked ${escapeHtml(when)}</span>`;
    button.textContent = "Reconciled";
    button.disabled = true;
    return;
  }

  if (reconciliation.status === "stale") {
    status.innerHTML = `<div class="status warning">The order changed after reconciliation. Reconcile this POS list again before finalising the bill.</div>`;
    button.textContent = "Reconcile Again";
    button.disabled = false;
    return;
  }

  status.textContent = "Not yet marked as reconciled with the venue POS.";
  button.textContent = "Mark Reconciled";
  button.disabled = false;
}

function closeReconcileModal() {
  document.getElementById("reconcileModal").classList.add("hidden");
  reconcileModalSessionId = null;
}

async function markSessionReconciled() {
  if (!reconcileModalSessionId) return;

  const sessionId = reconcileModalSessionId;
  const sessionSnap = await db.ref(`sessions/${sessionId}`).once("value");
  const session = sessionSnap.val();
  if (!session || session.status !== "active") return;

  await db.ref(`sessions/${sessionId}`).update({
    "reconciliation/status": "reconciled",
    "reconciliation/reconciledAt": firebase.database.ServerValue.TIMESTAMP,
    "reconciliation/reconciledTotal": calculateTotal(session.items || {}),
    "reconciliation/reconciledItemCount": Object.values(session.items || {}).reduce((sum, item) => sum + Number(item.qty || 1), 0),
    "reconciliation/staleAt": null,
    lastActivityAt: firebase.database.ServerValue.TIMESTAMP
  });

  const snap = await db.ref(`sessions/${sessionId}/reconciliation`).once("value");
  renderReconcileStatus(snap.val() || { status: "reconciled" });
}


/* =========================================================
   REQUEST MANAGEMENT
   ========================================================= */

async function acknowledgeRequest(
  sessionId
) {

  await db
    .ref(
      `sessions/${sessionId}/latestRequest`
    )
    .update({

      status:
        "acknowledged",

      acknowledgedAt:
        firebase.database
          .ServerValue
          .TIMESTAMP

    });

  markWaiterSessionSeen(
    sessionId
  );

}


async function completeRequest(
  sessionId
) {

  await db
    .ref(
      `sessions/${sessionId}/latestRequest`
    )
    .update({

      status:
        "completed",

      completedAt:
        firebase.database
          .ServerValue
          .TIMESTAMP

    });

}



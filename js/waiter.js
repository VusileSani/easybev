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

    replaceLiveListener(
      `actor:waiter:${slot}:identity`,
      db.ref(`waiters/${slot}`),
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

    replaceLiveListener(
      `actor:waiter:${slot}:sessions`,
      db.ref("sessions").orderByChild("waiterSlot").equalTo(String(slot)),
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

  const container = document.getElementById("waiterSessions");

  const activeSessions = Object.entries(sessions)
    .filter(([, session]) =>
      session &&
      session.status === "active" &&
      String(session.waiterSlot) === String(slot)
    )
    .sort((a, b) =>
      Number(b[1].lastActivityAt || b[1].createdAt || 0) -
      Number(a[1].lastActivityAt || a[1].createdAt || 0)
    );

  const recentlyClosed = Object.entries(sessions)
    .filter(([, session]) =>
      session &&
      session.status === "closed" &&
      String(session.waiterSlot) === String(slot)
    )
    .sort((a, b) => Number(b[1].closedAt || 0) - Number(a[1].closedAt || 0))
    .slice(0, 4);

  const activeHtml = activeSessions.length
    ? activeSessions.map(([sessionId, session]) => waiterSessionHtml(sessionId, session)).join("")
    : `<div class="card"><p class="muted">No active guest sessions.</p></div>`;

  const closedHtml = recentlyClosed.length
    ? `<details class="card recent-sessions">
        <summary>Recently closed <span class="badge">${recentlyClosed.length}</span></summary>
        <div class="recent-session-list">
          ${recentlyClosed.map(([sessionId, session]) => waiterClosedSessionHtml(sessionId, session)).join("")}
        </div>
      </details>`
    : "";

  container.innerHTML = activeHtml + closedHtml;
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
  const reconciliationStatus = String((session.reconciliation && session.reconciliation.status) || "");

  if (billStatus === "open") {
    return `<div class="bill-close-actions">
      <button class="warning" onclick="markBillRequestedByWaiter('${sessionId}')">Bill Requested</button>
      <span class="muted">Use when the guest asks verbally.</span>
    </div>`;
  }

  if (billStatus === "requested") {
    if (reconciliationStatus === "stale") {
      return `<span class="badge">Reconcile POS list again before processing bill</span>`;
    }
    if (reconciliationStatus !== "reconciled") {
      return `<span class="badge">Reconcile POS list before processing bill</span>`;
    }
    return `<button class="success" onclick="processBill('${sessionId}')">Process Bill</button>`;
  }

  if (billStatus === "finalized") {
    return `<div class="bill-close-actions"><span class="badge warning">Awaiting settlement</span><button class="success" onclick="closePaidSession('${sessionId}')">Close Session</button></div>`;
  }

  if (billStatus === "paid") {
    return `<div class="bill-close-actions"><span class="badge active">Payment recorded</span><button class="success" onclick="closePaidSession('${sessionId}')">Close Session</button></div>`;
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


function waiterLifecycleBadgeHtml(session) {
  const state = sessionLifecycleState(session);
  const klass = sessionLifecycleBadgeClass(state);
  return `<span class="badge ${klass}">${escapeHtml(sessionLifecycleLabel(state))}</span>`;
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
          ${waiterLifecycleBadgeHtml(session)}
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

      <details class="session-more">
        <summary>More</summary>
        <div class="session-more-body">
          <div class="session-secondary-actions">
            <button class="secondary" onclick="openWaiterHandoverModal('${sessionId}')">Transfer Waiter</button>
            ${!["finalized", "paid"].includes(sessionBillStatus(session))
              ? `<button class="danger" onclick="endSessionOverride('${sessionId}', 'waiter_override')">End Session</button>`
              : ""}
          </div>
          ${!["finalized", "paid"].includes(sessionBillStatus(session))
            ? `<p class="muted">End Session is exception-only for abandoned or stuck service sessions.</p>`
            : ""}
          <div class="lifecycle-audit-block">
            <strong>Session activity</strong>
            ${sessionLifecycleHistoryHtml(session)}
          </div>
        </div>
      </details>
    </div>`;
}


function waiterClosedSessionHtml(sessionId, session) {
  return `<div class="recent-session-row">
    <div>
      <strong>${escapeHtml(guestName(session))}</strong>
      <small>${escapeHtml(guestLabel(sessionId, session))} · ${escapeHtml(money(sessionBillTotal(session)))}</small>
    </div>
    <div class="recent-session-actions">
      <span class="badge">Closed</span>
      <button class="secondary" onclick="reopenClosedSession('${sessionId}')">Reopen</button>
    </div>
  </div>`;
}


/* =========================================================
   WAITER HANDOVER
   ========================================================= */

async function openWaiterHandoverModal(sessionId) {
  const sessionSnap = await db.ref(`sessions/${sessionId}`).once("value");
  const session = sessionSnap.val();

  if (!session || session.status !== "active") {
    alert("This session is no longer active.");
    return;
  }

  if (!canManageSessionLifecycle(session)) {
    alert("This session is not assigned to your waiter view.");
    return;
  }

  const waiters = await getAllWaiters();
  const candidates = sortedWaiterEntries(waiters)
    .filter(([slot, candidate]) =>
      String(slot) !== String(session.waiterSlot) &&
      candidate &&
      candidate.active !== false &&
      Boolean(candidate.assignedStaffId || candidate.assignedStaffName || candidate.name)
    );

  if (!candidates.length) {
    alert("There is no other assigned, active waiter available for handover.");
    return;
  }

  handoverModalSessionId = sessionId;
  document.getElementById("handoverSessionLabel").textContent =
    `${guestName(session)} · ${guestLabel(sessionId, session)}`;

  const select = document.getElementById("handoverWaiterSelect");
  select.innerHTML = candidates.map(([slot, candidate]) => `
    <option value="${escapeHtml(String(slot))}">${escapeHtml(getWaiterDisplayName({ ...candidate, slot: String(slot) }))} · Waiter ${escapeHtml(String(slot))}</option>
  `).join("");

  document.getElementById("handoverModal").classList.remove("hidden");
}


function closeWaiterHandoverModal() {
  document.getElementById("handoverModal").classList.add("hidden");
  handoverModalSessionId = null;
}


async function confirmWaiterHandover() {
  if (!handoverModalSessionId) return;

  const sessionId = handoverModalSessionId;
  const targetSlot = String(document.getElementById("handoverWaiterSelect").value || "").trim();
  if (!targetSlot) return;

  const [sessionSnap, targetWaiter] = await Promise.all([
    db.ref(`sessions/${sessionId}`).once("value"),
    getWaiter(targetSlot)
  ]);

  const session = sessionSnap.val();

  if (!session || session.status !== "active") {
    closeWaiterHandoverModal();
    alert("This session is no longer active.");
    return;
  }

  if (!canManageSessionLifecycle(session)) {
    closeWaiterHandoverModal();
    alert("This session is no longer assigned to your waiter view.");
    return;
  }

  if (!targetWaiter.exists || targetWaiter.active === false) {
    alert("The selected waiter slot is no longer available.");
    return;
  }

  const fromSlot = String(session.waiterSlot || "");
  const targetName = getWaiterDisplayName(targetWaiter);
  const targetStaffId = String(targetWaiter.assignedStaffId || "").trim() || null;
  const targetStaffName = String(targetWaiter.assignedStaffName || targetWaiter.name || "").trim() || targetName;
  const base = `sessions/${sessionId}`;
  const timestamp = firebase.database.ServerValue.TIMESTAMP;
  const updates = {};

  if (!session.waiterSlotAtStart) {
    updates[`${base}/waiterSlotAtStart`] = fromSlot;
  }

  updates[`${base}/waiterSlot`] = targetSlot;
  updates[`${base}/waiterNameCurrent`] = targetName;
  updates[`${base}/waiterStaffIdCurrent`] = targetStaffId;
  updates[`${base}/waiterStaffNameCurrent`] = targetStaffName;
  updates[`${base}/lastHandoverAt`] = timestamp;
  updates[`${base}/lastActivityAt`] = timestamp;

  addLifecycleTransitionUpdates(
    updates,
    sessionId,
    session,
    sessionLifecycleState(session),
    "waiter_handover",
    lifecycleActorContext(),
    {
      fromWaiterSlot: fromSlot,
      toWaiterSlot: targetSlot,
      toWaiterName: targetName
    }
  );

  await db.ref().update(updates);
  closeWaiterHandoverModal();
  showEasyBevToast("Waiter handover complete", `${guestLabel(sessionId, session)} is now with ${targetName}.`);
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
    status.innerHTML = `<div class="status warning">The order changed after reconciliation. Reconcile this POS list again before processing the bill.</div>`;
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



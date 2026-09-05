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


          const name =

            String(
              latest.name || ""
            )
              .trim()

            ||

            waiterFallbackName(
              slot
            );


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

function waiterSessionHtml(
  sessionId,
  session
) {

  const items =
    session.items || {};


  const total =
    calculateTotal(
      items
    );


  const request =
    session.latestRequest;


  const billStatus =

    session.bill &&
    session.bill.status

      ? session.bill.status

      : "open";


  const label =
    guestLabel(
      sessionId,
      session
    );


  const unreadCount =
    waiterUnreadCount(
      waiterSlot,
      sessionId,
      session
    );


  let requestHtml =
    "";


  if (

    request &&

    request.status !==
      "completed"

  ) {

    requestHtml = `

      <div class="status ${
        request.status === "new"
          ? "danger"
          : ""
      }">

        <strong>
          ${escapeHtml(
            request.label || ""
          )}
        </strong>

        <br>

        Status:
        ${escapeHtml(
          request.status
        )}

        <br><br>


        ${
          request.status === "new"

            ? `

              <button
                class="blue"
                onclick="acknowledgeRequest('${sessionId}')"
              >
                Accept
              </button>

            `

            : ""
        }


        ${
          request.status === "acknowledged" &&
          request.type !== "bill"

            ? `

              <button
                class="success"
                onclick="completeRequest('${sessionId}')"
              >
                Delivered / Done
              </button>

            `

            : ""
        }

      </div>

    `;

  }


  let billAction =
    "";


  if (
    billStatus ===
      "requested"
  ) {

    billAction = `

      <button
        class="success"
        onclick="finalizeBill('${sessionId}')"
      >
        Done – Finalise Bill
      </button>

    `;

  }
  else if (
    billStatus ===
      "finalized"
  ) {

    billAction = `

      <span class="badge active">
        Bill Finalised – Awaiting Payment
      </span>

    `;

  }
  else if (
    billStatus ===
      "paid"
  ) {

    billAction = `

      <button
        class="success"
        onclick="closePaidSession('${sessionId}')"
      >
        Close Session
      </button>

    `;

  }


  return `

    <div class="session-card active ${unreadCount ? "has-unread" : ""}">

      <div class="heading-row">

        <div>
          <div class="guest-name-line">${escapeHtml(guestName(session))}</div>
          <div class="guest-code-line">${escapeHtml(label)}</div>
        </div>

        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
          ${unreadCount ? `<span class="unread-badge">${unreadCount} new</span>` : ""}
          <span class="badge active">
            Active
          </span>
        </div>

      </div>

      ${unreadCount ? `
        <div class="attention-row">
          <strong>New guest activity</strong>
          <button class="secondary" onclick="markWaiterSessionSeen('${sessionId}')">Mark seen</button>
        </div>
      ` : ""}


      ${requestHtml}


      ${waiterChatHtml(
        sessionId,
        session.messages || {}
      )}


      <div>

        <strong>
          Current total
        </strong>

        <div class="big-number">
          ${money(
            total
          )}
        </div>

      </div>


      <br>


      <button
        class="blue"
        onclick="openItemModal(
          '${sessionId}',
          '${escapeHtml(label)}'
        )"
      >
        Add Items
      </button>

      <button
        class="secondary"
        onclick="openReconcileModal('${sessionId}')"
      >
        View POS List
      </button>


      ${billAction}


      <hr
        style="
          border:0;
          border-top:1px solid rgba(7,19,28,.10);
          margin:18px 0;
        "
      >


      <button
        class="danger"
        onclick="endSessionOverride(
          '${sessionId}',
          'waiter_override'
        )"
      >
        End Session
      </button>


      <p class="muted">

        Use End Session for abandoned,
        broken or stuck guest sessions.

      </p>

    </div>

  `;

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
    money(calculateTotal(session.items || {}));

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
  } else {
    status.textContent = "Not yet marked as reconciled with the venue POS.";
    button.textContent = "Mark Reconciled";
    button.disabled = false;
  }
}

function closeReconcileModal() {
  document.getElementById("reconcileModal").classList.add("hidden");
  reconcileModalSessionId = null;
}

async function markSessionReconciled() {
  if (!reconcileModalSessionId) return;

  const sessionId = reconcileModalSessionId;
  await db.ref(`sessions/${sessionId}`).update({
    "reconciliation/status": "reconciled",
    "reconciliation/reconciledAt": firebase.database.ServerValue.TIMESTAMP,
    lastActivityAt: firebase.database.ServerValue.TIMESTAMP
  });

  const snap = await db.ref(`sessions/${sessionId}/reconciliation`).once("value");
  renderReconcileStatus(snap.val() || { status: "reconciled" });
}


/* =========================================================
   TWO-WAY SESSION MESSAGING
   ========================================================= */

function orderedMessages(messages) {

  return Object.values(messages || {})
    .filter(message => message && message.text)
    .sort(
      (a, b) =>
        Number(a.createdAt || 0) -
        Number(b.createdAt || 0)
    );

}


function messageTime(timestamp) {

  const value = Number(timestamp || 0);

  if (!value) {
    return "";
  }

  try {
    return new Date(value).toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );
  }
  catch {
    return "";
  }

}


function chatMessageHtml(message) {

  const sender =
    message.sender === "waiter"
      ? "waiter"
      : "guest";

  const senderLabel =
    sender === "waiter"
      ? "Waiter"
      : "Guest";

  const time =
    messageTime(message.createdAt);

  return `
    <div class="chat-message ${sender}">
      ${escapeHtml(message.text || "")}
      <span class="chat-meta">
        ${senderLabel}${time ? ` · ${escapeHtml(time)}` : ""}
      </span>
    </div>
  `;

}


function renderGuestChat(messages) {

  const thread =
    document.getElementById(
      "guestChatThread"
    );

  if (!thread) {
    return;
  }

  const ordered =
    orderedMessages(messages);

  thread.innerHTML =
    ordered.length
      ? ordered.map(chatMessageHtml).join("")
      : `<div class="chat-empty">No messages yet. Send your waiter a message if you need anything specific.</div>`;

  thread.scrollTop =
    thread.scrollHeight;

}


function waiterChatHtml(
  sessionId,
  messages
) {

  const ordered =
    orderedMessages(messages);

  const thread =
    ordered.length
      ? ordered.map(chatMessageHtml).join("")
      : `<div class="chat-empty">No messages yet.</div>`;

  return `
    <div class="chat-panel">
      <h4>Guest conversation</h4>
      <div class="chat-thread">
        ${thread}
      </div>
      <div class="chat-compose">
        <input
          id="waiterMessage-${sessionId}"
          type="text"
          maxlength="300"
          placeholder="Reply to guest…"
        />
        <button
          class="blue"
          onclick="sendWaiterMessage('${sessionId}')"
        >
          Send
        </button>
      </div>
    </div>
  `;

}


async function sendGuestMessage() {

  if (!currentSessionId || !currentSession || currentSession.status !== "active") {
    return;
  }

  const input =
    document.getElementById(
      "guestMessageInput"
    );

  if (!input) {
    return;
  }

  const text =
    String(input.value || "")
      .trim()
      .slice(0, 300);

  if (!text) {
    return;
  }

  input.value = "";

  const updates = {};
  const messageRef =
    db.ref(
      `sessions/${currentSessionId}/messages`
    ).push();

  updates[
    `sessions/${currentSessionId}/messages/${messageRef.key}`
  ] = {
    sender: "guest",
    text,
    createdAt:
      firebase.database.ServerValue.TIMESTAMP
  };

  updates[
    `sessions/${currentSessionId}/lastActivityAt`
  ] = firebase.database.ServerValue.TIMESTAMP;

  await db.ref().update(updates);

}


async function sendWaiterMessage(
  sessionId
) {

  const input =
    document.getElementById(
      `waiterMessage-${sessionId}`
    );

  if (!input) {
    return;
  }

  const text =
    String(input.value || "")
      .trim()
      .slice(0, 300);

  if (!text) {
    return;
  }

  input.value = "";

  const updates = {};
  const messageRef =
    db.ref(
      `sessions/${sessionId}/messages`
    ).push();

  updates[
    `sessions/${sessionId}/messages/${messageRef.key}`
  ] = {
    sender: "waiter",
    text,
    createdAt:
      firebase.database.ServerValue.TIMESTAMP
  };

  updates[
    `sessions/${sessionId}/lastActivityAt`
  ] = firebase.database.ServerValue.TIMESTAMP;

  await db.ref().update(updates);

  markWaiterSessionSeen(
    sessionId
  );

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



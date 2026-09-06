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

  if (typeof platformFeatureEnabled === "function" && !platformFeatureEnabled("guestMessaging", true)) {
    return "";
  }

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

  if (typeof platformFeatureEnabled === "function" && !platformFeatureEnabled("guestMessaging", true)) {
    showEasyBevToast("Messaging unavailable", "EasyBev messaging is temporarily disabled.");
    return;
  }

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
    senderUserId: currentGuestUserId || null,
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

  if (typeof platformFeatureEnabled === "function" && !platformFeatureEnabled("guestMessaging", true)) {
    showEasyBevToast("Messaging unavailable", "EasyBev messaging is temporarily disabled.");
    return;
  }

  const session = latestWaiterSessions && latestWaiterSessions[sessionId];
  if (!session || session.status !== "active") {
    return;
  }

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
    senderStaffId: sessionWaiterSnapshotId(session) || null,
    senderName: sessionWaiterSnapshotName(session) || null,
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

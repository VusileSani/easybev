/* =========================================================
   LIGHTWEIGHT ALERTS & UNREAD STATE
   ========================================================= */

function notificationsAvailable() {
  return "Notification" in window;
}

function notificationsEnabled() {
  return notificationsAvailable() && Notification.permission === "granted";
}

function updateNotificationControls() {
  const enabled = notificationsEnabled();
  const denied = notificationsAvailable() && Notification.permission === "denied";

  const controls = [
    ["waiterNotificationsButton", "waiterNotificationStatus", "Enable Alerts", "Alerts enabled"],
    ["guestNotificationsButton", "guestNotificationStatus", "Enable Reply Alerts", "Reply alerts enabled"]
  ];

  controls.forEach(([buttonId, statusId, defaultText, enabledText]) => {
    const button = document.getElementById(buttonId);
    const status = document.getElementById(statusId);
    if (!button || !status) return;

    if (!notificationsAvailable()) {
      button.disabled = true;
      status.textContent = "Browser notifications are not supported here. In-app alerts still work.";
      return;
    }

    if (enabled) {
      button.textContent = enabledText;
      button.classList.remove("warning");
      button.classList.add("success");
      status.textContent = "Browser alerts are on. In-app alerts and vibration remain active too.";
      status.classList.add("enabled");
      return;
    }

    if (denied) {
      button.disabled = true;
      status.textContent = "Notifications are blocked in this browser. In-app alerts still work.";
      return;
    }

    button.textContent = defaultText;
  });
}

async function enableEasyBevNotifications() {
  try {
    if (window.AudioContext || window.webkitAudioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      easyBevAudioContext = easyBevAudioContext || new AudioContextClass();
      if (easyBevAudioContext.state === "suspended") {
        await easyBevAudioContext.resume();
      }
    }

    if (notificationsAvailable() && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }
  catch (error) {
    console.warn("EasyBev alert setup:", error);
  }

  updateNotificationControls();
  showEasyBevToast("EasyBev alerts", notificationsEnabled()
    ? "Browser notifications are enabled."
    : "In-app alerts are active on this screen.");
}

function showEasyBevToast(title, message) {
  const stack = document.getElementById("easyBevToastStack");
  if (!stack) return;

  const toast = document.createElement("div");
  toast.className = "easybev-toast";
  toast.innerHTML = `<strong>${escapeHtml(title || "EasyBev")}</strong><span>${escapeHtml(message || "")}</span>`;
  stack.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 5200);
}

function playEasyBevAlertTone() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    easyBevAudioContext = easyBevAudioContext || new AudioContextClass();
    if (easyBevAudioContext.state !== "running") return;

    const oscillator = easyBevAudioContext.createOscillator();
    const gain = easyBevAudioContext.createGain();
    oscillator.connect(gain);
    gain.connect(easyBevAudioContext.destination);
    oscillator.frequency.value = 720;
    gain.gain.setValueAtTime(0.0001, easyBevAudioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, easyBevAudioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, easyBevAudioContext.currentTime + 0.18);
    oscillator.start();
    oscillator.stop(easyBevAudioContext.currentTime + 0.2);
  }
  catch (error) {
    console.warn("EasyBev alert tone:", error);
  }
}

function triggerEasyBevAlert(title, message, tag) {
  showEasyBevToast(title, message);
  playEasyBevAlertTone();

  if (navigator.vibrate) {
    try { navigator.vibrate([120, 60, 120]); } catch (_) {}
  }

  if (notificationsEnabled() && document.hidden) {
    try {
      new Notification(title || "EasyBev", {
        body: message || "",
        tag: tag || "easybev-alert"
      });
    }
    catch (error) {
      console.warn("EasyBev browser notification:", error);
    }
  }
}

function waiterReadStorageKey(slot) {
  return `easybev_waiter_read_${slot}`;
}

function getWaiterReadState(slot) {
  try {
    return JSON.parse(localStorage.getItem(waiterReadStorageKey(slot)) || "{}") || {};
  }
  catch {
    return {};
  }
}

function markWaiterSessionSeen(sessionId) {
  if (!waiterSlot || !sessionId) return;
  const state = getWaiterReadState(waiterSlot);
  state[sessionId] = Date.now();
  localStorage.setItem(waiterReadStorageKey(waiterSlot), JSON.stringify(state));

  if (latestWaiterSessions && Object.keys(latestWaiterSessions).length) {
    renderWaiterDashboard(waiterSlot, latestWaiterSessions);
  }
}

function guestMessageEvents(messages) {
  return orderedMessages(messages)
    .filter(message => message.sender === "guest")
    .map(message => Number(message.createdAt || 0))
    .filter(Boolean);
}

function waiterMessageEvents(messages) {
  return orderedMessages(messages)
    .filter(message => message.sender === "waiter")
    .map(message => Number(message.createdAt || 0))
    .filter(Boolean);
}

function waiterUnreadCount(slot, sessionId, session) {
  const state = getWaiterReadState(slot);
  const seenAt = Number(state[sessionId] || 0);
  let count = guestMessageEvents(session.messages || {}).filter(ts => ts > seenAt).length;

  const request = session.latestRequest;
  const requestAt = Number(request && request.createdAt || 0);
  if (request && request.status === "new" && requestAt > seenAt) {
    count += 1;
  }

  return count;
}

function monitorWaiterAlerts(slot, sessions) {
  const active = Object.entries(sessions || {}).filter(([, session]) =>
    session && session.status === "active" && String(session.waiterSlot) === String(slot)
  );

  if (!waiterAlertPrimed) {
    active.forEach(([sessionId, session]) => {
      const guestMsgAt = Math.max(0, ...guestMessageEvents(session.messages || {}));
      const requestAt = Number(session.latestRequest && session.latestRequest.createdAt || 0);
      waiterEventWatermarks[sessionId] = { guestMsgAt, requestAt };
    });
    waiterAlertPrimed = true;
    return;
  }

  active.forEach(([sessionId, session]) => {
    const label = guestLabel(sessionId, session);
    const previous = waiterEventWatermarks[sessionId] || { guestMsgAt: 0, requestAt: 0 };
    const guestMsgAt = Math.max(0, ...guestMessageEvents(session.messages || {}));
    const request = session.latestRequest;
    const requestAt = Number(request && request.createdAt || 0);

    if (guestMsgAt > Number(previous.guestMsgAt || 0)) {
      const latestGuestMessage = orderedMessages(session.messages || {})
        .filter(message => message.sender === "guest")
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
      triggerEasyBevAlert(
        `${label} messaged you`,
        latestGuestMessage ? latestGuestMessage.text : "New guest message",
        `guest-message-${sessionId}`
      );
    }

    if (request && request.status === "new" && requestAt > Number(previous.requestAt || 0)) {
      triggerEasyBevAlert(
        `${label} needs attention`,
        request.label || "New guest request",
        `guest-request-${sessionId}-${requestAt}`
      );
    }

    waiterEventWatermarks[sessionId] = {
      guestMsgAt: Math.max(Number(previous.guestMsgAt || 0), guestMsgAt),
      requestAt: Math.max(Number(previous.requestAt || 0), requestAt)
    };
  });
}

function monitorGuestReplyAlerts(session) {
  const waiterEvents = waiterMessageEvents(session && session.messages || {});
  const latest = Math.max(0, ...waiterEvents);

  if (!guestAlertPrimed) {
    lastGuestWaiterMessageAt = latest;
    guestAlertPrimed = true;
    return;
  }

  if (latest > lastGuestWaiterMessageAt) {
    const latestReply = orderedMessages(session.messages || {})
      .filter(message => message.sender === "waiter")
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
    triggerEasyBevAlert(
      currentGuestWaiterName || "Your waiter",
      latestReply ? latestReply.text : "Your waiter replied",
      `waiter-reply-${currentSessionId}`
    );
    lastGuestWaiterMessageAt = latest;
  }
}



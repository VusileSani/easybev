/* =========================================================
   ACTOR NAVIGATION
   ========================================================= */

function goEasyBevHome() {
  window.location.href = "./";
}


function currentServiceSlotForActorSwitch() {
  const current = String(waiterSlot || guestSlot || "").trim();
  if (current) {
    localStorage.setItem("easybev_last_actor_slot", current);
    return current;
  }

  return String(localStorage.getItem("easybev_last_actor_slot") || "1");
}

function switchEasyBevActor(actor) {
  const selected = String(actor || "").toLowerCase();
  const slot = currentServiceSlotForActorSwitch();

  if (selected === "guest") {
    window.location.href = `?guest=${encodeURIComponent(slot)}`;
    return;
  }

  if (selected === "waiter") {
    window.location.href = `?waiter=${encodeURIComponent(slot)}`;
    return;
  }

  if (selected === "manager") {
    window.location.href = "?manager=1";
    return;
  }

  if (selected === "admin") {
    window.location.href = "?admin=1";
    return;
  }

  if (selected === "owner") {
    window.location.href = "?owner=1";
    return;
  }

  goEasyBevHome();
}

function showActorNavigation(label, actor) {
  const nav = document.getElementById("actorNav");
  const role = document.getElementById("actorNavRole");
  const switcher = document.getElementById("actorSwitcher");

  if (!nav || !role) {
    return;
  }

  document.body.dataset.actor = String(actor || "app");
  role.innerHTML = `<strong>${escapeHtml(String(label || "EasyBev"))}</strong>`;

  if (switcher && actor) {
    switcher.value = String(actor);
  }

  nav.classList.remove("hidden");
}

function hideActorNavigation() {
  const nav = document.getElementById("actorNav");
  document.body.dataset.actor = "home";

  if (nav) {
    nav.classList.add("hidden");
  }
}

/* =========================================================
   ROUTING
   ========================================================= */

function routeApplication() {

  try {

    if (ownerMode) {
      document.getElementById("platformView").classList.remove("hidden");
      document.getElementById("headerMode").textContent = "Owner";
      showActorNavigation("EasyBev Owner", "owner");
      subscribeToPlatformAnnouncements("owner");
      startPlatformDashboard("owner");
      return;
    }

    if (adminMode) {
      document.getElementById("platformView").classList.remove("hidden");
      document.getElementById("headerMode").textContent = "EasyBev Admin";
      showActorNavigation("EasyBev Admin", "admin");
      subscribeToPlatformAnnouncements("admin");
      startPlatformDashboard("admin");
      return;
    }

    if (
      managerMode
    ) {

      document
        .getElementById(
          "managerView"
        )
        .classList
        .remove(
          "hidden"
        );

      document
        .getElementById(
          "headerMode"
        )
        .textContent =
          "Management";

      showActorNavigation("Management", "manager");
      subscribeToPlatformAnnouncements("manager");

      startManagerDashboard();

      return;

    }


    if (
      waiterSlot
    ) {

      localStorage.setItem("easybev_last_actor_slot", String(waiterSlot));

      document
        .getElementById(
          "waiterView"
        )
        .classList
        .remove(
          "hidden"
        );

      document
        .getElementById(
          "headerMode"
        )
        .textContent =
          "Waiter";

      showActorNavigation(`Waiter ${waiterSlot}`, "waiter");
      subscribeToPlatformAnnouncements("waiter");

      startWaiterDashboard(
        waiterSlot
      );

      return;

    }


    if (
      guestSlot
    ) {

      localStorage.setItem("easybev_last_actor_slot", String(guestSlot));

      document
        .getElementById(
          "guestView"
        )
        .classList
        .remove(
          "hidden"
        );

      document
        .getElementById(
          "headerMode"
        )
        .textContent =
          "Guest";

      showActorNavigation(`Guest · Waiter ${guestSlot}`, "guest");
      subscribeToPlatformAnnouncements("guest");

      startGuestFlow();

      return;

    }


    hideActorNavigation();
    clearPlatformNoticeBanner();

    document
      .getElementById(
        "headerMode"
      )
      .textContent =
        "";

    document
      .getElementById(
        "homeView"
      )
      .classList
      .remove(
        "hidden"
      );

    loadRememberedGuestSessions();
    loadGuestHistory();

  }
  catch (error) {

    console.error(error);

    showStartupError(
      error.message ||
      "EasyBev could not start."
    );

  }

}


/* =========================================================
   HOME: RESUME ACTIVE GUEST SESSIONS

   A remembered session is only offered when Firebase confirms
   that it still exists, is active, and belongs to the same
   permanent waiter slot. Navigating home never ends a session.
   ========================================================= */

async function loadRememberedGuestSessions() {

  const panel =
    document.getElementById(
      "resumeSessions"
    );

  if (!panel || !db) {
    return;
  }

  try {

    const activeSessions = [];

    const rememberedSlots = [];
    const prefix = "easybev_guest_session_";
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(prefix)) continue;
      const slot = key.slice(prefix.length);
      if (slot && localStorage.getItem(key)) rememberedSlots.push(slot);
    }

    if (!rememberedSlots.length) {
      panel.innerHTML = "";
      panel.classList.add("hidden");
      return;
    }

    for (const slot of rememberedSlots) {

      const sessionId = localStorage.getItem(sessionStorageKey(slot));
      if (!sessionId) continue;

      const snap =
        await db
          .ref(`sessions/${sessionId}`)
          .once("value");

      const session = snap.val();

      const isActive =
        session &&
        session.status === "active" &&
        (
          String(session.waiterSlot) === String(slot) ||
          String(sessionOriginalWaiterSlot(session)) === String(slot)
        );

      if (!isActive) {
        localStorage.removeItem(
          sessionStorageKey(slot)
        );
        continue;
      }

      let waiterName = sessionWaiterCurrentName(session);
      if (!waiterName) {
        const waiter = await getWaiter(session.waiterSlot || slot);
        waiterName = getWaiterDisplayName(waiter);
      }

      activeSessions.push({
        slot,
        sessionId,
        session,
        waiterName
      });

    }

    if (!activeSessions.length) {
      panel.innerHTML = "";
      panel.classList.add("hidden");
      return;
    }

    panel.innerHTML = `
      <h3>Continue where you left off</h3>
      <p>Your live EasyBev session is still available on this device.</p>
      <div class="resume-session-list">
        ${activeSessions.map(item => `
          <button
            type="button"
            class="resume-session-btn"
            onclick="resumeGuestSession('${escapeHtml(String(item.slot))}')"
          >
            <span>
              <strong>Resume Active Session</strong>
              <small>
                ${escapeHtml(guestLabel(item.sessionId, item.session))}
                · ${escapeHtml(item.waiterName)}
                · ${escapeHtml(money(sessionBillTotal(item.session)))}
              </small>
            </span>
            <span class="resume-session-arrow" aria-hidden="true">→</span>
          </button>
        `).join("")}
      </div>
    `;

    panel.classList.remove("hidden");

  }
  catch (error) {
    console.error(
      "Could not check remembered guest sessions.",
      error
    );

    panel.innerHTML = "";
    panel.classList.add("hidden");
  }
}

function resumeGuestSession(slot) {
  window.location.href = `?guest=${encodeURIComponent(slot)}`;
}



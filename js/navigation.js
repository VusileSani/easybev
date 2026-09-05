/* =========================================================
   ACTOR NAVIGATION
   ========================================================= */

function goEasyBevHome() {
  window.location.href = "./";
}

function goBackOrHome() {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  goEasyBevHome();
}

function showActorNavigation(label) {
  const nav = document.getElementById("actorNav");
  const role = document.getElementById("actorNavRole");

  if (!nav || !role) {
    return;
  }

  role.innerHTML = `<strong>${escapeHtml(String(label || "EasyBev"))}</strong>`;
  nav.classList.remove("hidden");
}

function hideActorNavigation() {
  const nav = document.getElementById("actorNav");

  if (nav) {
    nav.classList.add("hidden");
  }
}

/* =========================================================
   ROUTING
   ========================================================= */

function routeApplication() {

  try {

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

      showActorNavigation("Management Dashboard");

      startManagerDashboard();

      return;

    }


    if (
      waiterSlot
    ) {

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

      showActorNavigation(`Waiter Slot ${waiterSlot}`);

      startWaiterDashboard(
        waiterSlot
      );

      return;

    }


    if (
      guestSlot
    ) {

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

      showActorNavigation(`Guest · Waiter ${guestSlot}`);

      startGuestFlow();

      return;

    }


    hideActorNavigation();

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

    const waiters = await getAllWaiters();

    for (const [slot] of activeWaiterEntries(waiters)) {

      const sessionId =
        localStorage.getItem(
          sessionStorageKey(slot)
        );

      if (!sessionId) {
        continue;
      }

      const snap =
        await db
          .ref(`sessions/${sessionId}`)
          .once("value");

      const session = snap.val();

      const isActive =
        session &&
        session.status === "active" &&
        String(session.waiterSlot) === String(slot);

      if (!isActive) {
        localStorage.removeItem(
          sessionStorageKey(slot)
        );
        continue;
      }

      const waiter =
        await getWaiter(slot);

      activeSessions.push({
        slot,
        sessionId,
        session,
        waiterName: getWaiterDisplayName(waiter)
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
                · ${escapeHtml(money(item.session.total || 0))}
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



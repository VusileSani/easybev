/* =========================================================
   GUEST FLOW
   ========================================================= */

async function startGuestFlow() {

  try {

    const waiter =
      await getWaiter(
        guestSlot
      );

    currentGuestWaiterName =
      getWaiterDisplayName(
        waiter
      );


    document
      .getElementById(
        "guestServiceHeading"
      )
      .textContent =
        `Service by ${currentGuestWaiterName}`;


    if (
      !waiter.active
    ) {

      document
        .getElementById(
          "guestVerification"
        )
        .innerHTML = `

          <div class="status warning">

            This waiter service slot
            is currently unavailable.

            <br><br>

            Please ask a staff member
            for assistance.

          </div>

        `;

      return;

    }


    const rememberedPhone =
      localStorage.getItem(
        phoneStorageKey(
          guestSlot
        )
      );


    if (
      rememberedPhone
    ) {

      document
        .getElementById(
          "guestPhone"
        )
        .value =
          rememberedPhone;

    }

    const rememberedName = localStorage.getItem(rememberedGuestNameKey());
    if (rememberedName) {
      document.getElementById("guestName").value = rememberedName;
    }

    const rememberedUserId = localStorage.getItem(guestUserStorageKey());
    if (rememberedUserId) {
      try {
        const userSnap = await db.ref(`users/${rememberedUserId}`).once("value");
        if (userSnap.exists()) {
          currentGuestUserId = rememberedUserId;
          currentGuestProfile = userSnap.val() || {};
          if (currentGuestProfile.firstName) {
            document.getElementById("guestName").value = currentGuestProfile.firstName;
          }
        }
      } catch (error) {
        console.warn("Could not restore EasyBev guest profile", error);
      }
    }


    const rememberedSessionId =
      localStorage.getItem(
        sessionStorageKey(
          guestSlot
        )
      );


    if (
      rememberedSessionId
    ) {

      const snap =
        await db
          .ref(
            `sessions/${rememberedSessionId}`
          )
          .once(
            "value"
          );

      const session =
        snap.val();


      if (

        session &&

        session.status ===
          "active" &&

        String(
          session.waiterSlot
        ) ===
          String(
            guestSlot
          )

      ) {

        currentSessionId =
          rememberedSessionId;

        if (session.guestUserId) {
          currentGuestUserId = session.guestUserId;
          localStorage.setItem(guestUserStorageKey(), session.guestUserId);
          try {
            const profileSnap = await db.ref(`users/${session.guestUserId}`).once("value");
            if (profileSnap.exists()) currentGuestProfile = profileSnap.val() || {};
          } catch (error) {
            console.warn("Could not restore session guest profile", error);
          }
        }


        document
          .getElementById(
            "verificationMessage"
          )
          .innerHTML = `

            <strong>
              Welcome back${currentGuestProfile && currentGuestProfile.firstName ? `, ${escapeHtml(currentGuestProfile.firstName)}` : ""}.
            </strong>

            <br><br>

            An active EasyBev session was found on this device.
            Verify with the same mobile number to reconnect.

          `;


        /* Identity may be remembered, but waiter-session routing is never automatic.
           The guest must explicitly reconnect to this waiter/session. */
        if (rememberedPhone && cleanPhone(session.guestPhone) === cleanPhone(rememberedPhone)) {
          document.getElementById("verificationMessage").innerHTML = `
            <strong>Welcome back${currentGuestProfile && currentGuestProfile.firstName ? `, ${escapeHtml(currentGuestProfile.firstName)}` : ""}.</strong><br><br>
            You have an active session with ${escapeHtml(currentGuestWaiterName)}.
            <br><br>
            <button class="success" onclick="connectGuestToSession('${rememberedSessionId}')">Reconnect to ${escapeHtml(currentGuestWaiterName)}</button>
            <button class="secondary" style="margin-left:8px" onclick="showAlternativeWaiters()">Use Another Waiter</button>
          `;
        }

        return;

      }


      localStorage.removeItem(
        sessionStorageKey(
          guestSlot
        )
      );

    }

    const rememberMe = localStorage.getItem(rememberGuestStorageKey()) === "true";
    if (rememberMe && rememberedPhone && currentGuestUserId && currentGuestProfile) {
      document.getElementById("verificationMessage").innerHTML = `
        <strong>Welcome back, ${escapeHtml(currentGuestProfile.firstName || "Guest")}.</strong><br><br>
        Ready to connect to ${escapeHtml(currentGuestWaiterName)}.
        <br><br>
        <button class="success" onclick="connectRememberedGuest()">Connect to ${escapeHtml(currentGuestWaiterName)}</button>
        <button class="secondary" style="margin-left:8px" onclick="showAlternativeWaiters()">Use Another Waiter</button>
      `;
      return;
    }

    document
      .getElementById(
        "verificationMessage"
      )
      .innerHTML =
        `Verify your mobile number to connect to ${escapeHtml(currentGuestWaiterName)}.<br><br><button class="secondary" onclick="showAlternativeWaiters()">Use Another Waiter</button>`;

  }
  catch (error) {

    console.error(error);

    showStartupError(
      error.message ||
      "Could not start the guest session."
    );

  }

}


async function connectRememberedGuest() {
  const rememberedPhone = localStorage.getItem(phoneStorageKey(guestSlot));
  if (!rememberedPhone || !currentGuestUserId) {
    document.getElementById("verificationMessage").textContent =
      `Verify your mobile number to connect to ${currentGuestWaiterName}.`;
    return;
  }
  await findOrCreateGuestSession(rememberedPhone);
}


/* =========================================================
   OTP DEMO
   ========================================================= */

function requestOtp() {

  const firstName = String(document.getElementById("guestName").value || "").trim();

  if (!firstName) {
    document.getElementById("verificationStatus").innerHTML = `
      <div class="status danger">Enter your first name.</div>
    `;
    return;
  }

  sessionStorage.setItem("easybev_pending_name", firstName);

  const phone =
    cleanPhone(
      document
        .getElementById(
          "guestPhone"
        )
        .value
    );


  if (
    phone.length < 9
  ) {

    document
      .getElementById(
        "verificationStatus"
      )
      .innerHTML = `

        <div class="status danger">
          Enter a valid mobile number.
        </div>

      `;

    return;

  }


  sessionStorage.setItem(
    "easybev_pending_phone",
    phone
  );


  document
    .getElementById(
      "otpArea"
    )
    .classList
    .remove(
      "hidden"
    );


  document
    .getElementById(
      "verificationStatus"
    )
    .innerHTML = `

      <div class="status">
        OTP sent.
        Demo code is 123456.
      </div>

    `;

}


async function verifyOtp() {

  const otp =
    document
      .getElementById(
        "guestOtp"
      )
      .value;


  const phone =
    sessionStorage.getItem(
      "easybev_pending_phone"
    );


  if (
    otp !== "123456"
  ) {

    document
      .getElementById(
        "verificationStatus"
      )
      .innerHTML = `

        <div class="status danger">
          Incorrect OTP.
        </div>

      `;

    return;

  }


  if (
    !phone
  ) {

    return;

  }


  const rememberMe = document.getElementById("guestRememberMe")?.checked !== false;

  if (rememberMe) {
    localStorage.setItem(phoneStorageKey(guestSlot), phone);
    localStorage.setItem(rememberGuestStorageKey(), "true");
  } else {
    localStorage.removeItem(phoneStorageKey(guestSlot));
    localStorage.removeItem(rememberGuestStorageKey());
  }

  const firstName = String(sessionStorage.getItem("easybev_pending_name") || "").trim();
  await findOrCreateGuestProfile(phone, firstName, rememberMe);

  await findOrCreateGuestSession(
    phone
  );

}


/* =========================================================
   PERSISTENT GUEST PROFILE

   Prototype identity is resolved from the verified mobile number.
   The profile gets its own generated user id so the session model
   already references a durable EasyBev member rather than a phone key.
   When Firebase Authentication is resumed, this layer can be migrated
   to auth.uid without changing the session idea.
   ========================================================= */

async function findOrCreateGuestProfile(phone, firstName, rememberMe = true) {
  const clean = phoneIndexKey(phone);
  if (!clean) return null;

  const indexSnap = await db.ref(`userPhoneIndex/${clean}`).once("value");
  let userId = indexSnap.val();

  if (!userId) {
    const userRef = db.ref("users").push();
    userId = userRef.key;

    const profile = {
      firstName: String(firstName || "Guest").trim() || "Guest",
      phone: cleanPhone(phone),
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
      preferences: {
        usual: {
          drink: "",
          meal: "",
          note: ""
        }
      }
    };

    const updates = {};
    updates[`users/${userId}`] = profile;
    updates[`userPhoneIndex/${clean}`] = userId;
    await db.ref().update(updates);
    currentGuestProfile = profile;
  } else {
    const userSnap = await db.ref(`users/${userId}`).once("value");
    const existing = userSnap.val() || {};
    const resolvedName = String(firstName || existing.firstName || "Guest").trim() || "Guest";

    await db.ref(`users/${userId}`).update({
      firstName: resolvedName,
      phone: cleanPhone(phone),
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    });

    currentGuestProfile = {
      ...existing,
      firstName: resolvedName,
      phone: cleanPhone(phone)
    };
  }

  currentGuestUserId = userId;
  if (rememberMe) {
    localStorage.setItem(guestUserStorageKey(), userId);
    localStorage.setItem(rememberedGuestNameKey(), currentGuestProfile.firstName || firstName || "Guest");
    localStorage.setItem(rememberGuestStorageKey(), "true");
  }
  return userId;
}

async function loadGuestProfileIntoControls() {
  if (!currentGuestUserId) return;

  const snap = await db.ref(`users/${currentGuestUserId}`).once("value");
  if (!snap.exists()) return;

  currentGuestProfile = snap.val() || {};
  const usual = (((currentGuestProfile || {}).preferences || {}).usual) || {};

  const drink = document.getElementById("usualDrink");
  const meal = document.getElementById("usualMeal");
  const note = document.getElementById("usualNote");

  if (drink) drink.value = String(usual.drink || "");
  if (meal) meal.value = String(usual.meal || "");
  if (note) note.value = String(usual.note || "");
}

async function saveMyUsual(showConfirmation = true) {
  if (!currentGuestUserId) {
    showUsualStatus("Your EasyBev profile is not available yet.", "danger");
    return null;
  }

  const usual = {
    drink: String(document.getElementById("usualDrink").value || "").trim(),
    meal: String(document.getElementById("usualMeal").value || "").trim(),
    note: String(document.getElementById("usualNote").value || "").trim()
  };

  if (!usual.drink && !usual.meal && !usual.note) {
    showUsualStatus("Add at least one preference first.", "warning");
    return null;
  }

  await db.ref(`users/${currentGuestUserId}/preferences/usual`).set({
    ...usual,
    updatedAt: firebase.database.ServerValue.TIMESTAMP
  });

  if (showConfirmation) {
    showUsualStatus("My Usual saved.", "success");
  }

  return usual;
}

function showUsualStatus(message, kind = "") {
  const target = document.getElementById("usualStatus");
  if (!target) return;
  target.innerHTML = `<div class="status ${kind}">${escapeHtml(message)}</div>`;
}

async function sendMyUsual() {
  if (!currentSessionId) return;
  if (!currentGuestUserId) {
    showUsualStatus("Set up My Usual under Preferences & Settings first.", "warning");
    document.querySelector(".preferences-panel")?.setAttribute("open", "");
    return;
  }

  const snap = await db.ref(`users/${currentGuestUserId}/preferences/usual`).once("value");
  const usual = snap.val() || {};
  if (!usual.drink && !usual.meal && !usual.note) {
    document.querySelector(".preferences-panel")?.setAttribute("open", "");
    showUsualStatus("Set My Usual here first, then use the button above anytime.", "warning");
    return;
  }

  const parts = [];
  if (usual.drink) parts.push(`Drink: ${usual.drink}`);
  if (usual.meal) parts.push(`Meal: ${usual.meal}`);
  if (usual.note) parts.push(`Note: ${usual.note}`);

  const messageRef = db.ref(`sessions/${currentSessionId}/messages`).push();
  await messageRef.set({
    sender: "guest",
    kind: "usual",
    text: `My Usual — ${parts.join(" · ")}`,
    createdAt: firebase.database.ServerValue.TIMESTAMP
  });

  await db.ref(`sessions/${currentSessionId}`).update({
    lastActivityAt: firebase.database.ServerValue.TIMESTAMP
  });

  showUsualStatus("My Usual sent to your waiter.", "success");
}


/* =========================================================
   FIND OR CREATE GUEST SESSION

   IMPORTANT:

   A waiter can serve multiple
   simultaneous guest sessions.

   There is NO table lock here.
   ========================================================= */

async function findOrCreateGuestSession(
  phone
) {

  const sessionsSnap =
    await db
      .ref(
        "sessions"
      )
      .once(
        "value"
      );


  const sessions =
    sessionsSnap.val() || {};


  const existing =
    Object.entries(
      sessions
    )
    .find(
      ([, session]) =>

        session &&

        session.status ===
          "active" &&

        String(
          session.waiterSlot
        ) ===
          String(
            guestSlot
          ) &&

        (
          (currentGuestUserId && session.guestUserId === currentGuestUserId)
          ||
          cleanPhone(session.guestPhone) === cleanPhone(phone)
        )

    );


  if (
    existing
  ) {

    const [
      existingSessionId
    ] = existing;


    localStorage.setItem(

      sessionStorageKey(
        guestSlot
      ),

      existingSessionId

    );

    if (currentGuestUserId) {
      await db.ref(`sessions/${existingSessionId}`).update({
        guestUserId: currentGuestUserId,
        guestNameAtStart: String((currentGuestProfile && currentGuestProfile.firstName) || sessionStorage.getItem("easybev_pending_name") || "Guest").trim()
      });
    }


    connectGuestToSession(
      existingSessionId
    );

    return;

  }


  const sessionRef =
    db
      .ref(
        "sessions"
      )
      .push();


  const newSessionId =
    sessionRef.key;


  const sessionCode =
    makeSessionCode(
      newSessionId
    );


  const waiter =
    await getWaiter(
      guestSlot
    );


  const newSession = {

    waiterSlot:
      String(
        guestSlot
      ),

    waiterNameAtStart:
      getWaiterDisplayName(
        waiter
      ),

    waiterStaffIdAtStart:
      String(waiter.assignedStaffId || "").trim() || null,

    waiterStaffNameAtStart:
      String(waiter.assignedStaffName || waiter.name || "").trim() || null,

    guestUserId:
      currentGuestUserId || null,

    guestNameAtStart:
      String((currentGuestProfile && currentGuestProfile.firstName) || sessionStorage.getItem("easybev_pending_name") || "Guest").trim(),

    guestPhone:
      phone,

    sessionCode,

    status:
      "active",

    createdAt:
      firebase.database
        .ServerValue
        .TIMESTAMP,

    lastActivityAt:
      firebase.database
        .ServerValue
        .TIMESTAMP,

    latestRequest:
      null,

    bill: {
      status:
        "open"
    },

    total:
      0

  };


  await sessionRef.set(
    newSession
  );


  localStorage.setItem(

    sessionStorageKey(
      guestSlot
    ),

    newSessionId

  );


  connectGuestToSession(
    newSessionId
  );

}


/* =========================================================
   CONNECT GUEST
   ========================================================= */

function connectGuestToSession(
  sessionId
) {

  currentSessionId =
    sessionId;


  document
    .getElementById(
      "guestVerification"
    )
    .classList
    .add(
      "hidden"
    );


  document
    .getElementById(
      "guestSessionInfo"
    )
    .classList
    .remove(
      "hidden"
    );


  document
    .getElementById(
      "guestControls"
    )
    .classList
    .remove(
      "hidden"
    );


  document
    .getElementById(
      "guestClosedView"
    )
    .classList
    .add(
      "hidden"
    );

  loadGuestProfileIntoControls();


  db
    .ref(
      `sessions/${sessionId}`
    )
    .on(
      "value",
      async snap => {

        const session =
          snap.val();


        if (

          !session ||

          session.status !==
            "active"

        ) {

          showGuestSessionEnded();

          return;

        }


        currentSession =
          session;


        const waiter =
          await getWaiter(
            session.waiterSlot
          );


        const waiterName =
          getWaiterDisplayName(
            waiter
          );


        currentGuestWaiterName =
          waiterName;


        document
          .getElementById(
            "connectedWaiter"
          )
          .textContent =
            waiterName;


        document
          .getElementById(
            "guestSessionCode"
          )
          .textContent =
            guestLabel(
              sessionId,
              session
            );


        renderGuestSession(
          session
        );

      }
    );

}


function showGuestSessionEnded() {

  if (
    guestSlot
  ) {

    localStorage.removeItem(
      sessionStorageKey(
        guestSlot
      )
    );

  }


  document
    .getElementById(
      "guestControls"
    )
    .classList
    .add(
      "hidden"
    );


  document
    .getElementById(
      "guestSessionInfo"
    )
    .classList
    .add(
      "hidden"
    );


  document
    .getElementById(
      "guestClosedView"
    )
    .classList
    .remove(
      "hidden"
    );

}


async function showAlternativeWaiters() {

  const panel = document.getElementById("alternativeWaiterPanel");
  if (!panel) return;

  panel.classList.remove("hidden");
  panel.innerHTML = `<div class="status"><strong>Available waiters</strong><br><span class="muted">Choose the waiter serving you.</span></div>`;

  try {
    const snap = await db.ref("waiters").once("value");
    const waiters = snap.val() || {};

    const rows = Object.entries(waiters)
      .filter(([slot, waiter]) => waiter && waiter.active && String(slot) !== String(guestSlot))
      .sort((a, b) => Number(a[0]) - Number(b[0]));

    if (!rows.length) {
      panel.innerHTML = `
        <div class="status warning">
          No other waiter slots are currently available.<br>
          <span class="muted">You can continue with ${escapeHtml(currentGuestWaiterName || `Waiter ${guestSlot}`)} or ask a staff member for assistance.</span>
        </div>
        <button class="secondary" onclick="hideAlternativeWaiters()">Back</button>
      `;
      return;
    }

    panel.innerHTML = `
      <div class="status">
        <strong>Choose another waiter</strong><br>
        <span class="muted">Only active waiter slots are shown.</span>
      </div>
      <div style="display:grid;gap:8px;margin:10px 0">
        ${rows.map(([slot, waiter]) => `
          <button class="secondary" onclick="switchGuestWaiter('${escapeHtml(String(slot))}')">
            ${escapeHtml(getWaiterDisplayName({...waiter, slot}))}
          </button>
        `).join("")}
      </div>
      <button class="secondary" onclick="hideAlternativeWaiters()">Cancel</button>
    `;
  }
  catch (error) {
    console.error(error);
    panel.innerHTML = `
      <div class="status warning">Could not load alternative waiters right now.</div>
      <button class="secondary" onclick="hideAlternativeWaiters()">Back</button>
    `;
  }
}

function hideAlternativeWaiters() {
  const panel = document.getElementById("alternativeWaiterPanel");
  if (!panel) return;
  panel.classList.add("hidden");
  panel.innerHTML = "";
}

function switchGuestWaiter(slot) {
  const nextSlot = String(slot || "").trim();
  if (!nextSlot || nextSlot === String(guestSlot)) {
    hideAlternativeWaiters();
    return;
  }

  window.location.href = `?guest=${encodeURIComponent(nextSlot)}`;
}


function restartGuestSession() {

  if (
    guestSlot
  ) {

    localStorage.removeItem(
      sessionStorageKey(
        guestSlot
      )
    );

  }

  location.reload();

}


/* =========================================================
   GUEST REQUESTS
   ========================================================= */

async function sendRequest(
  type
) {

  if (
    !currentSessionId
  ) {

    return;

  }


  const labels = {
    assistance: "Waiter assistance"
  };


  await db
    .ref(
      `sessions/${currentSessionId}`
    )
    .update({

      latestRequest: {

        type,

        label:
          labels[type] || "Guest request",

        status:
          "new",

        createdAt:
          firebase.database
            .ServerValue
            .TIMESTAMP

      },

      lastActivityAt:
        firebase.database
          .ServerValue
          .TIMESTAMP

    });

}


/* =========================================================
   REQUEST BILL
   ========================================================= */

async function requestBill() {

  if (
    !currentSessionId
  ) {

    return;

  }


  const total =
    calculateTotal(

      currentSession &&
      currentSession.items

    );


  if (
    total <= 0
  ) {

    alert(
      "There are no items on this bill yet."
    );

    return;

  }


  await db
    .ref(
      `sessions/${currentSessionId}`
    )
    .update({

      latestRequest: {

        type:
          "bill",

        label:
          "Bill requested",

        status:
          "new",

        createdAt:
          firebase.database
            .ServerValue
            .TIMESTAMP

      },

      "bill/status":
        "requested",

      "bill/requestedAt":
        firebase.database
          .ServerValue
          .TIMESTAMP,

      lastActivityAt:
        firebase.database
          .ServerValue
          .TIMESTAMP

    });

}


/* =========================================================
   PAYMENT DEMO
   ========================================================= */

async function payBill() {

  if (
    !currentSessionId
  ) {

    return;

  }


  const confirmPayment =
    confirm(
      "Demo payment: mark this bill as paid?"
    );


  if (
    !confirmPayment
  ) {

    return;

  }


  await db
    .ref(
      `sessions/${currentSessionId}`
    )
    .update({

      "bill/status":
        "paid",

      "bill/paidAt":
        firebase.database
          .ServerValue
          .TIMESTAMP,

      latestRequest: {

        type:
          "payment",

        label:
          "Payment completed",

        status:
          "new",

        createdAt:
          firebase.database
            .ServerValue
            .TIMESTAMP

      },

      lastActivityAt:
        firebase.database
          .ServerValue
          .TIMESTAMP

    });

}


/* =========================================================
   RENDER GUEST
   ========================================================= */

function renderGuestSession(
  session
) {

  const items =
    session.items || {};


  const total =
    calculateTotal(
      items
    );


  const itemsDiv =
    document.getElementById(
      "guestBillItems"
    );


  const entries =
    Object.values(
      items
    );


  if (
    !entries.length
  ) {

    itemsDiv.innerHTML = `

      <p class="muted">
        No items added yet.
      </p>

    `;

  }
  else {

    itemsDiv.innerHTML =
      entries
        .map(
          item => {

            const subtotal =

              Number(
                item.price
              ) *

              Number(
                item.qty || 1
              );


            return `

              <div class="bill-row">

                <span>

                  ${escapeHtml(
                    item.name
                  )}

                  ×
                  ${item.qty || 1}

                </span>

                <strong>
                  ${money(
                    subtotal
                  )}
                </strong>

              </div>

            `;

          }
        )
        .join("");

  }


  document
    .getElementById(
      "guestTotal"
    )
    .textContent =
      money(
        total
      );


  document
    .getElementById(
      "guestBillButton"
    )
    .disabled =
      total <= 0;


  const request =
    session.latestRequest;


  const requestStatus =
    document.getElementById(
      "guestRequestStatus"
    );


  if (
    request
  ) {

    let message =
      escapeHtml(
        request.label || ""
      );


    if (
      request.status ===
        "acknowledged"
    ) {

      message +=
        ` — ${escapeHtml(
          currentGuestWaiterName ||
          "Waiter"
        )} acknowledged`;

    }


    if (
      request.status ===
        "completed"
    ) {

      message +=
        " — completed";

    }


    requestStatus.innerHTML = `

      <div class="status">
        ${message}
      </div>

    `;

  }
  else {

    requestStatus.innerHTML =
      "";

  }


  monitorGuestReplyAlerts(
    session
  );

  renderGuestChat(
    session.messages || {}
  );


  const billStatus =

    session.bill &&
    session.bill.status

      ? session.bill.status

      : "open";


  const billStatusDiv =
    document.getElementById(
      "guestBillStatus"
    );


  const payButton =
    document.getElementById(
      "guestPayButton"
    );


  if (
    billStatus ===
      "requested"
  ) {

    billStatusDiv.innerHTML = `

      <div class="status warning">

        Bill requested.

        Waiting for
        ${escapeHtml(
          currentGuestWaiterName ||
          "your waiter"
        )}
        to finalise it.

      </div>

    `;


    payButton
      .classList
      .add(
        "hidden"
      );

  }
  else if (
    billStatus ===
      "finalized"
  ) {

    billStatusDiv.innerHTML = `

      <div class="status success">
        Bill finalised.
      </div>

    `;


    payButton
      .classList
      .remove(
        "hidden"
      );

  }
  else if (
    billStatus ===
      "paid"
  ) {

    billStatusDiv.innerHTML = `

      <div class="status success">

        Payment received.

        Waiting for the session
        to be closed.

      </div>

    `;


    payButton
      .classList
      .add(
        "hidden"
      );

  }
  else {

    billStatusDiv.innerHTML =
      "";


    payButton
      .classList
      .add(
        "hidden"
      );

  }

}



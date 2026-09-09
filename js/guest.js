/* =========================================================
   GUEST FLOW
   ========================================================= */

async function startGuestFlow() {

  try {
    const waiter = await getWaiter(guestSlot);
    currentGuestWaiterName = getWaiterDisplayName(waiter);

    document.getElementById("guestServiceHeading").textContent =
      `Service by ${currentGuestWaiterName}`;

    const rememberedPhone = localStorage.getItem(phoneStorageKey(guestSlot));
    const rememberedName = localStorage.getItem(rememberedGuestNameKey());
    const rememberedSessionId = localStorage.getItem(sessionStorageKey(guestSlot));

    if (rememberedPhone) document.getElementById("guestPhone").value = rememberedPhone;
    if (rememberedName) document.getElementById("guestName").value = rememberedName;

    /* v2.6.1 security boundary:
       localStorage may suggest where the guest left off, but it never proves identity.
       Do not restore currentGuestUserId/currentGuestProfile from prototype storage here. */
    currentGuestUserId = null;
    currentGuestProfile = null;
    currentSessionId = null;
    sessionStorage.removeItem("easybev_pending_reconnect_session");

    if (rememberedSessionId) {
      const snap = await db.ref(`sessions/${rememberedSessionId}`).once("value");
      const session = snap.val();

      const isMatchingActiveSession =
        session &&
        session.status === "active" &&
        (
          String(session.waiterSlot) === String(guestSlot) ||
          String(sessionOriginalWaiterSlot(session)) === String(guestSlot)
        );

      if (isMatchingActiveSession) {
        const rememberedSessionWaiterName =
          sessionWaiterCurrentName(session) || currentGuestWaiterName;
        const firebaseGuestUser = auth && auth.currentUser && auth.currentUser.phoneNumber
          ? auth.currentUser
          : null;
        const hasVerifiedFirebaseIdentity =
          firebaseGuestUser &&
          phoneIndexKey(firebaseGuestUser.phoneNumber) === phoneIndexKey(session.guestPhone);

        sessionStorage.setItem("easybev_pending_reconnect_session", rememberedSessionId);

        if (hasVerifiedFirebaseIdentity) {
          const identityName = rememberedName || session.guestNameCurrent || session.guestNameAtStart || "Guest";
          await findOrCreateGuestProfile(session.guestPhone, identityName, true, firebaseGuestUser.uid);
          document.getElementById("verificationMessage").innerHTML = `
            <strong>Welcome back${currentGuestProfile && currentGuestProfile.firstName ? `, ${escapeHtml(currentGuestProfile.firstName)}` : ""}.</strong><br><br>
            Firebase has verified this device for the mobile number on the active session with ${escapeHtml(rememberedSessionWaiterName)}.
            <br><br>
            <button class="success" onclick="reconnectAuthenticatedGuest('${escapeJsString(rememberedSessionId)}')">Reconnect to ${escapeHtml(rememberedSessionWaiterName)}</button>
            <button class="secondary" style="margin-left:8px" onclick="showAlternativeWaiters()">Use Another Waiter</button>
          `;
          return;
        }

        document.getElementById("verificationMessage").innerHTML = `
          <strong>Active session found.</strong><br><br>
          Verify the mobile number used for this session before reconnecting to ${escapeHtml(rememberedSessionWaiterName)}.
          <br><br>
          <span class="muted">This device remembers the session, but EasyBev will not reconnect until Firebase verifies your identity.</span>
          <br><br>
          <button class="secondary" onclick="showAlternativeWaiters()">Use Another Waiter</button>
        `;
        return;
      }

      localStorage.removeItem(sessionStorageKey(guestSlot));
    }

    const rememberMe = localStorage.getItem(rememberGuestStorageKey()) === "true";
    if (rememberMe && rememberedPhone) {
      const firebaseGuestUser = auth && auth.currentUser && auth.currentUser.phoneNumber
        ? auth.currentUser
        : null;
      const hasVerifiedFirebaseIdentity =
        firebaseGuestUser &&
        phoneIndexKey(firebaseGuestUser.phoneNumber) === phoneIndexKey(rememberedPhone);

      if (hasVerifiedFirebaseIdentity) {
        await findOrCreateGuestProfile(
          rememberedPhone,
          rememberedName || "Guest",
          true,
          firebaseGuestUser.uid
        );
        document.getElementById("verificationMessage").innerHTML = `
          <strong>Welcome back, ${escapeHtml(currentGuestProfile.firstName || "Guest")}.</strong><br><br>
          Your mobile identity is already verified on this device.
          <br><br>
          <button class="success" onclick="connectAuthenticatedGuestToWaiter()">Connect to ${escapeHtml(currentGuestWaiterName)}</button>
          <button class="secondary" style="margin-left:8px" onclick="showAlternativeWaiters()">Use Another Waiter</button>
        `;
        return;
      }

      document.getElementById("verificationMessage").innerHTML = `
        <strong>Welcome back.</strong><br><br>
        Verify your mobile number to connect to ${escapeHtml(currentGuestWaiterName)}.
        <br><br>
        <span class="muted">Remembered details speed up entry; they do not bypass Firebase identity verification.</span>
        <br><br>
        <button class="secondary" onclick="showAlternativeWaiters()">Use Another Waiter</button>
      `;
      return;
    }

    document.getElementById("verificationMessage").innerHTML =
      `Verify your mobile number to connect to ${escapeHtml(currentGuestWaiterName)}.<br><br><button class="secondary" onclick="showAlternativeWaiters()">Use Another Waiter</button>`;
  }
  catch (error) {
    console.error(error);
    showStartupError(error.message || "Could not start the guest session.");
  }
}



async function reconnectAuthenticatedGuest(sessionId) {
  const user = auth && auth.currentUser;
  if (!user || !user.uid || !user.phoneNumber) return;
  const snap = await db.ref(`sessions/${sessionId}`).once("value");
  const session = snap.val();
  if (!session) return;
  await reconnectVerifiedGuestToRememberedSession(sessionId, session.guestPhone, user.uid);
}

async function connectAuthenticatedGuestToWaiter() {
  const user = auth && auth.currentUser;
  const rememberedPhone = localStorage.getItem(phoneStorageKey(guestSlot));
  if (!user || !user.uid || !user.phoneNumber || !rememberedPhone) return;
  if (phoneIndexKey(user.phoneNumber) !== phoneIndexKey(rememberedPhone)) return;
  await findOrCreateGuestSession(rememberedPhone);
}


/* =========================================================
   MOBILE VERIFICATION
   ========================================================= */

let guestOtpRequestInFlight = false;
let guestOtpVerifyInFlight = false;

function setGuestAuthBusy(buttonId, busy, busyLabel, idleLabel) {
  const button = document.getElementById(buttonId);
  if (!button) return;
  button.disabled = Boolean(busy);
  button.setAttribute("aria-busy", busy ? "true" : "false");
  button.textContent = busy ? busyLabel : idleLabel;
}

async function requestOtp() {
  if (guestOtpRequestInFlight) return;
  const firstName = String(document.getElementById("guestName").value || "").trim();
  if (!firstName) {
    document.getElementById("verificationStatus").innerHTML = `<div class="status danger">Enter your first name.</div>`;
    return;
  }

  const phone = cleanPhone(document.getElementById("guestPhone").value);
  if (phoneIndexKey(phone).length < 11) {
    document.getElementById("verificationStatus").innerHTML = `<div class="status danger">Enter a valid mobile number.</div>`;
    return;
  }

  guestOtpRequestInFlight = true;
  setGuestAuthBusy("guestSendOtpButton", true, "Sending…", "Send code");
  sessionStorage.setItem("easybev_pending_name", firstName);
  sessionStorage.setItem("easybev_pending_phone", phone);
  document.getElementById("verificationStatus").innerHTML = `<div class="status">Sending SMS verification code…</div>`;

  try {
    await beginGuestPhoneAuthentication(phone);
    document.getElementById("otpArea").classList.remove("hidden");
    document.getElementById("verificationStatus").innerHTML = `<div class="status success">SMS code sent. Enter it below to verify your number.</div>`;
    document.getElementById("guestOtp")?.focus();
  } catch (error) {
    console.error("EasyBev phone verification failed", error);
    resetGuestRecaptcha();
    const message = String(error && error.message || "Could not send the SMS code.");
    document.getElementById("verificationStatus").innerHTML = `<div class="status danger">${escapeHtml(message)}</div>`;
  } finally {
    guestOtpRequestInFlight = false;
    setGuestAuthBusy("guestSendOtpButton", false, "Sending…", "Send code");
  }
}

async function verifyOtp() {
  if (guestOtpVerifyInFlight) return;
  const otp = String(document.getElementById("guestOtp").value || "").trim();
  const phone = sessionStorage.getItem("easybev_pending_phone");
  if (!phone || !otp) {
    document.getElementById("verificationStatus").innerHTML = `<div class="status danger">Enter the SMS verification code.</div>`;
    return;
  }

  guestOtpVerifyInFlight = true;
  setGuestAuthBusy("guestVerifyOtpButton", true, "Connecting…", "Verify & connect");

  try {
    const user = await confirmGuestPhoneAuthentication(otp);
    const rememberMe = document.getElementById("guestRememberMe")?.checked !== false;

    if (rememberMe) {
      localStorage.setItem(phoneStorageKey(guestSlot), phone);
      localStorage.setItem(rememberGuestStorageKey(), "true");
    } else {
      localStorage.removeItem(phoneStorageKey(guestSlot));
      localStorage.removeItem(rememberGuestStorageKey());
    }

    const firstName = String(sessionStorage.getItem("easybev_pending_name") || "").trim();
    await findOrCreateGuestProfile(phone, firstName, rememberMe, user.uid);

    const pendingReconnectSessionId = sessionStorage.getItem("easybev_pending_reconnect_session");
    if (pendingReconnectSessionId) {
      const reconnected = await reconnectVerifiedGuestToRememberedSession(
        pendingReconnectSessionId,
        phone,
        user.uid
      );
      sessionStorage.removeItem("easybev_pending_reconnect_session");
      if (reconnected) return;
    }

    await findOrCreateGuestSession(phone);
  } catch (error) {
    console.error("EasyBev OTP confirmation failed", error);
    const code = String(error && error.code || "");
    const message = code === "auth/invalid-verification-code"
      ? "That verification code is incorrect."
      : (error && error.message) || "Verification failed. Request a new SMS code and try again.";
    document.getElementById("verificationStatus").innerHTML = `<div class="status danger">${escapeHtml(message)}</div>`;
  } finally {
    guestOtpVerifyInFlight = false;
    setGuestAuthBusy("guestVerifyOtpButton", false, "Connecting…", "Verify & connect");
  }
}

async function reconnectVerifiedGuestToRememberedSession(sessionId, phone, authenticatedUid) {
  const user = auth && auth.currentUser;
  const uid = String(authenticatedUid || (user && user.uid) || "").trim();
  if (!user || !uid || user.uid !== uid || !user.phoneNumber) return false;

  const snap = await db.ref(`sessions/${sessionId}`).once("value");
  const session = snap.val();
  if (!session || session.status !== "active") return false;

  const sameWaiterContext =
    String(session.waiterSlot) === String(guestSlot) ||
    String(sessionOriginalWaiterSlot(session)) === String(guestSlot);
  if (!sameWaiterContext) return false;

  const verifiedPhoneKey = phoneIndexKey(user.phoneNumber);
  const requestedPhoneKey = phoneIndexKey(phone);
  const sessionPhoneKey = phoneIndexKey(session.guestPhone);

  if (!verifiedPhoneKey || verifiedPhoneKey !== requestedPhoneKey || verifiedPhoneKey !== sessionPhoneKey) {
    throw new Error("This verified mobile number does not own the remembered EasyBev session.");
  }

  const identityUpdates = {
    guestUserId: uid,
    guestPhone: cleanPhone(phone),
    guestNameCurrent: String(
      (currentGuestProfile && (currentGuestProfile.preferredName || currentGuestProfile.firstName)) ||
      session.guestNameCurrent ||
      session.guestNameAtStart ||
      "Guest"
    ).trim(),
    identityMigratedAt: firebase.database.ServerValue.TIMESTAMP
  };

  if (session.guestUserId && session.guestUserId !== uid) {
    identityUpdates.legacyGuestUserId = session.guestUserId;
  }

  await db.ref(`sessions/${sessionId}`).update(identityUpdates);
  localStorage.setItem(sessionStorageKey(guestSlot), sessionId);
  await connectGuestToSession(sessionId);
  return true;
}


/* =========================================================
   PERSISTENT GUEST PROFILE

   Guest identity is resolved from the verified mobile number.
   The profile gets its own generated user id so the session model
   already references a durable EasyBev member rather than a phone key.
   When Firebase Authentication is resumed, this layer can be migrated
   to auth.uid without changing the session idea.
   ========================================================= */

async function findOrCreateGuestProfile(phone, firstName, rememberMe = true, authenticatedUid = null) {
  const clean = phoneIndexKey(phone);
  if (!clean) return null;

  const authUid = String(authenticatedUid || (auth && auth.currentUser && auth.currentUser.uid) || "").trim();
  const authUser = auth && auth.currentUser;
  if (!authUid || !authUser || authUser.uid !== authUid || !authUser.phoneNumber) {
    throw new Error("Verified Firebase guest identity is required.");
  }

  if (phoneIndexKey(authUser.phoneNumber) !== clean) {
    throw new Error("Verified mobile number does not match the guest profile request.");
  }

  const indexSnap = await db.ref(`userPhoneIndex/${clean}`).once("value");
  const indexedUserId = String(indexSnap.val() || "").trim();
  const existingSnap = await db.ref(`users/${authUid}`).once("value");
  const existing = existingSnap.val() || null;

  let legacyProfile = null;
  if (indexedUserId && indexedUserId !== authUid) {
    const legacySnap = await db.ref(`users/${indexedUserId}`).once("value");
    legacyProfile = legacySnap.val() || null;
  }

  const source = existing || legacyProfile || {};
  const resolvedName = String(firstName || source.firstName || "Guest").trim() || "Guest";
  const defaultPreferences = {
    serviceStyle: "normal",
    language: "English",
    billPreference: "none",
    tipPreference: "none",
    dietary: [],
    dietaryNote: "",
    allergyNote: "",
    serviceNotifications: true,
    usual: { drink: "", meal: "", note: "" }
  };

  const profile = {
    ...source,
    firstName: resolvedName,
    preferredName: String(source.preferredName || ""),
    phone: cleanPhone(phone),
    defaultPartySize: source.defaultPartySize == null ? null : source.defaultPartySize,
    preferences: {
      ...defaultPreferences,
      ...(source.preferences || {}),
      usual: {
        ...defaultPreferences.usual,
        ...((source.preferences && source.preferences.usual) || {})
      }
    },
    updatedAt: firebase.database.ServerValue.TIMESTAMP
  };

  if (!source.createdAt) profile.createdAt = firebase.database.ServerValue.TIMESTAMP;
  if (!source.detailsCompletedAt) profile.detailsCompletedAt = firebase.database.ServerValue.TIMESTAMP;
  if (legacyProfile && indexedUserId !== authUid) {
    profile.migratedFromLegacyUserId = indexedUserId;
    profile.identityMigratedAt = firebase.database.ServerValue.TIMESTAMP;
  }

  const updates = {};
  updates[`users/${authUid}`] = profile;
  updates[`userPhoneIndex/${clean}`] = authUid;
  await db.ref().update(updates);

  currentGuestUserId = authUid;
  currentGuestProfile = profile;

  if (rememberMe) {
    localStorage.setItem(guestUserStorageKey(), authUid);
    localStorage.setItem(rememberedGuestNameKey(), profile.firstName || resolvedName);
    localStorage.setItem(rememberGuestStorageKey(), "true");
  } else {
    localStorage.removeItem(guestUserStorageKey());
    localStorage.removeItem(rememberedGuestNameKey());
  }

  return authUid;
}


async function loadGuestProfileIntoControls() {
  if (!currentGuestUserId) return;

  const snap = await db.ref(`users/${currentGuestUserId}`).once("value");
  if (!snap.exists()) return;

  currentGuestProfile = snap.val() || {};
  const preferences = (currentGuestProfile || {}).preferences || {};
  const usual = preferences.usual || {};

  const setValue = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.value = value == null ? "" : String(value);
  };

  setValue("profileFirstName", currentGuestProfile.firstName || "");
  setValue("profilePreferredName", currentGuestProfile.preferredName || "");
  setValue("profilePhone", currentGuestProfile.phone || "");
  setValue("profilePartySize", currentGuestProfile.defaultPartySize || "");
  setValue("profileServiceStyle", preferences.serviceStyle || "normal");
  setValue("profileLanguage", preferences.language || "English");
  setValue("profileBillPreference", preferences.billPreference || "none");
  setValue("profileTipPreference", preferences.tipPreference || "none");
  setValue("profileDietaryNote", preferences.dietaryNote || "");
  setValue("profileAllergyNote", preferences.allergyNote || "");

  document.querySelectorAll("[data-dietary]").forEach(input => {
    input.checked = Array.isArray(preferences.dietary) && preferences.dietary.includes(input.dataset.dietary);
  });

  const notifications = document.getElementById("profileServiceNotifications");
  if (notifications) notifications.checked = preferences.serviceNotifications !== false;

  const rememberDevice = document.getElementById("profileRememberDevice");
  if (rememberDevice) rememberDevice.checked = localStorage.getItem(rememberGuestStorageKey()) === "true";

  const drink = document.getElementById("usualDrink");
  const meal = document.getElementById("usualMeal");
  const note = document.getElementById("usualNote");

  if (drink) drink.value = String(usual.drink || "");
  if (meal) meal.value = String(usual.meal || "");
  if (note) note.value = String(usual.note || "");

  showGuestSettingsStatus("guestDetailsStatus", "Required details complete.", "success");
}

function showGuestSettingsStatus(targetId, message, kind = "") {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = `<div class="status ${kind}">${escapeHtml(message)}</div>`;
}

async function saveGuestDetails() {
  if (!currentGuestUserId) {
    showGuestSettingsStatus("guestDetailsStatus", "Your EasyBev profile is not available yet.", "danger");
    return;
  }

  const firstName = String(document.getElementById("profileFirstName")?.value || "").trim();
  const preferredName = String(document.getElementById("profilePreferredName")?.value || "").trim();
  const partyRaw = String(document.getElementById("profilePartySize")?.value || "").trim();
  const defaultPartySize = partyRaw ? Number(partyRaw) : null;

  if (!firstName) {
    showGuestSettingsStatus("guestDetailsStatus", "First name is required.", "danger");
    return;
  }

  if (defaultPartySize !== null && (!Number.isInteger(defaultPartySize) || defaultPartySize < 1 || defaultPartySize > 30)) {
    showGuestSettingsStatus("guestDetailsStatus", "Party size must be between 1 and 30.", "danger");
    return;
  }

  const updates = {
    firstName,
    preferredName,
    defaultPartySize,
    detailsCompletedAt: firebase.database.ServerValue.TIMESTAMP,
    updatedAt: firebase.database.ServerValue.TIMESTAMP
  };

  await db.ref(`users/${currentGuestUserId}`).update(updates);

  const displayName = preferredName || firstName;
  if (currentSessionId) {
    const sessionSnap = await db.ref(`sessions/${currentSessionId}`).once("value");
    const session = sessionSnap.val();
    if (session && session.status === "active" && String(session.guestUserId || "") === String(currentGuestUserId)) {
      await db.ref(`sessions/${currentSessionId}`).update({
        guestNameCurrent: displayName,
        lastActivityAt: firebase.database.ServerValue.TIMESTAMP
      });
    }
  }

  if (localStorage.getItem(rememberGuestStorageKey()) === "true") {
    localStorage.setItem(rememberedGuestNameKey(), firstName);
  }

  currentGuestProfile = {...(currentGuestProfile || {}), ...updates};
  showGuestSettingsStatus("guestDetailsStatus", "My Details saved.", "success");
}

async function saveGuestPreferences() {
  if (!currentGuestUserId) {
    showGuestSettingsStatus("guestPreferencesStatus", "Your EasyBev profile is not available yet.", "danger");
    return;
  }

  const dietary = Array.from(document.querySelectorAll("[data-dietary]:checked"))
    .map(input => String(input.dataset.dietary || ""))
    .filter(Boolean);

  const preferences = {
    serviceStyle: String(document.getElementById("profileServiceStyle")?.value || "normal"),
    language: String(document.getElementById("profileLanguage")?.value || "English"),
    billPreference: String(document.getElementById("profileBillPreference")?.value || "none"),
    tipPreference: String(document.getElementById("profileTipPreference")?.value || "none"),
    dietary,
    dietaryNote: String(document.getElementById("profileDietaryNote")?.value || "").trim(),
    allergyNote: String(document.getElementById("profileAllergyNote")?.value || "").trim(),
    serviceNotifications: document.getElementById("profileServiceNotifications")?.checked !== false,
    updatedAt: firebase.database.ServerValue.TIMESTAMP
  };

  await db.ref(`users/${currentGuestUserId}/preferences`).update(preferences);

  const rememberDevice = document.getElementById("profileRememberDevice")?.checked === true;
  if (rememberDevice) {
    localStorage.setItem(rememberGuestStorageKey(), "true");
    localStorage.setItem(guestUserStorageKey(), currentGuestUserId);
    if (currentGuestProfile && currentGuestProfile.phone) {
      localStorage.setItem(phoneStorageKey(guestSlot), currentGuestProfile.phone);
    }
  } else {
    localStorage.removeItem(rememberGuestStorageKey());
    localStorage.removeItem(guestUserStorageKey());
    localStorage.removeItem(phoneStorageKey(guestSlot));
    localStorage.removeItem(rememberedGuestNameKey());
  }

  currentGuestProfile = {
    ...(currentGuestProfile || {}),
    preferences: {
      ...((currentGuestProfile || {}).preferences || {}),
      ...preferences
    }
  };

  showGuestSettingsStatus("guestPreferencesStatus", "Preferences saved.", "success");
  showEasyBevToast("Preferences saved", "Your EasyBev profile has been updated.");
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
    senderUserId: currentGuestUserId || null,
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

  const authUser = auth && auth.currentUser;
  if (!authUser || !authUser.uid || !authUser.phoneNumber || currentGuestUserId !== authUser.uid) {
    throw new Error("Verify your mobile number before starting or reconnecting to a guest session.");
  }
  if (phoneIndexKey(authUser.phoneNumber) !== phoneIndexKey(phone)) {
    throw new Error("Verified mobile number does not match this guest session request.");
  }

  const byUidSnap = await db.ref("sessions")
    .orderByChild("guestUserId")
    .equalTo(currentGuestUserId)
    .once("value");
  const byPhoneSnap = await db.ref("sessions")
    .orderByChild("guestPhone")
    .equalTo(cleanPhone(phone))
    .once("value");
  const sessions = {
    ...(byPhoneSnap.val() || {}),
    ...(byUidSnap.val() || {})
  };


  const existing =
    Object.entries(
      sessions
    )
    .find(
      ([, session]) =>

        session &&

        session.status ===
          "active" &&

        (
          String(session.waiterSlot) === String(guestSlot) ||
          String(sessionOriginalWaiterSlot(session)) === String(guestSlot)
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
      existingSessionId,
      existingSession
    ] = existing;


    localStorage.setItem(

      sessionStorageKey(
        guestSlot
      ),

      existingSessionId

    );

    if (currentGuestUserId) {
      const identityUpdates = {};

      if (existingSession.guestUserId !== currentGuestUserId) {
        if (existingSession.guestUserId) identityUpdates.legacyGuestUserId = existingSession.guestUserId;
        identityUpdates.guestUserId = currentGuestUserId;
        identityUpdates.identityMigratedAt = firebase.database.ServerValue.TIMESTAMP;
      }

      if (!existingSession.guestNameAtStart) {
        identityUpdates.guestNameAtStart = String(
          (currentGuestProfile && currentGuestProfile.firstName) ||
          sessionStorage.getItem("easybev_pending_name") ||
          "Guest"
        ).trim();
      }

      if (Object.keys(identityUpdates).length) {
        await db.ref(`sessions/${existingSessionId}`).update(identityUpdates);
      }
    }


    await connectGuestToSession(
      existingSessionId
    );

    return;

  }


  const waiter = await getWaiter(guestSlot);

  if (!waiter.exists || !waiter.active) {
    document.getElementById("verificationMessage").innerHTML = `
      <div class="status warning">
        This waiter service slot is currently unavailable. If an existing session was transferred, scan the current waiter QR or ask a staff member for assistance.
      </div>`;
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


  const startedEventKey = db.ref(`sessions/${newSessionId}/lifecycleEvents`).push().key;
  const waiterNameAtStart = getWaiterDisplayName(waiter);
  const waiterStaffIdAtStart = String(waiter.assignedStaffId || "").trim() || null;
  const waiterStaffNameAtStart = String(waiter.assignedStaffName || waiter.name || "").trim() || null;

  const newSession = {

    waiterSlot:
      String(
        guestSlot
      ),

    waiterSlotAtStart:
      String(
        guestSlot
      ),

    waiterNameAtStart,

    waiterStaffIdAtStart,

    waiterStaffNameAtStart,

    waiterNameCurrent:
      waiterNameAtStart,

    waiterStaffIdCurrent:
      waiterStaffIdAtStart,

    waiterStaffNameCurrent:
      waiterStaffNameAtStart,

    guestUserId:
      currentGuestUserId || null,

    guestNameAtStart:
      String((currentGuestProfile && (currentGuestProfile.preferredName || currentGuestProfile.firstName)) || sessionStorage.getItem("easybev_pending_name") || "Guest").trim(),

    guestNameCurrent:
      String((currentGuestProfile && (currentGuestProfile.preferredName || currentGuestProfile.firstName)) || sessionStorage.getItem("easybev_pending_name") || "Guest").trim(),

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

    lifecycle: {
      state: "active",
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
      lastAction: "session_started"
    },

    lifecycleEvents: {
      [startedEventKey]: {
        fromState: "active",
        toState: "active",
        action: "session_started",
        actorRole: "guest",
        actorSlot: String(guestSlot),
        actorName: "Guest",
        details: {},
        createdAt: firebase.database.ServerValue.TIMESTAMP
      }
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


  await connectGuestToSession(
    newSessionId
  );

}


/* =========================================================
   CONNECT GUEST
   ========================================================= */

async function connectGuestToSession(sessionId) {
  const user = auth && auth.currentUser;
  if (!user || !user.uid || !user.phoneNumber || !currentGuestUserId || currentGuestUserId !== user.uid) {
    document.getElementById("verificationStatus").innerHTML =
      `<div class="status danger">Verify your mobile number before reconnecting to an EasyBev session.</div>`;
    return false;
  }

  const authCheckSnap = await db.ref(`sessions/${sessionId}`).once("value");
  const authCheckSession = authCheckSnap.val();
  if (!authCheckSession || authCheckSession.status !== "active") return false;

  const ownsByUid = String(authCheckSession.guestUserId || "") === String(user.uid);
  const ownsByVerifiedPhone =
    phoneIndexKey(authCheckSession.guestPhone) &&
    phoneIndexKey(authCheckSession.guestPhone) === phoneIndexKey(user.phoneNumber);

  if (!ownsByUid && !ownsByVerifiedPhone) {
    document.getElementById("verificationStatus").innerHTML =
      `<div class="status danger">This authenticated guest does not own that EasyBev session.</div>`;
    return false;
  }

  if (!ownsByUid && ownsByVerifiedPhone) {
    const migration = {
      guestUserId: user.uid,
      identityMigratedAt: firebase.database.ServerValue.TIMESTAMP
    };
    if (authCheckSession.guestUserId) migration.legacyGuestUserId = authCheckSession.guestUserId;
    await db.ref(`sessions/${sessionId}`).update(migration);
  }

  currentSessionId = sessionId;
  document.getElementById("guestVerification").classList.add("hidden");
  document.getElementById("guestSessionInfo").classList.remove("hidden");
  document.getElementById("guestControls").classList.remove("hidden");
  document.getElementById("guestClosedView").classList.add("hidden");

  loadGuestProfileIntoControls();

  replaceLiveListener(`actor:guest:session:${sessionId}`, db.ref(`sessions/${sessionId}`), "value", async snap => {
    const session = snap.val();
    if (!session || session.status !== "active") {
      showGuestSessionEnded(session);
      return;
    }

    /* Re-check ownership on every live update so client state cannot silently drift. */
    const currentUser = auth && auth.currentUser;
    if (!currentUser || !currentUser.uid || String(session.guestUserId || "") !== String(currentUser.uid)) {
      document.getElementById("guestControls").classList.add("hidden");
      document.getElementById("guestSessionInfo").classList.add("hidden");
      return;
    }

    currentSession = session;
    let waiterName = sessionWaiterCurrentName(session);
    if (!waiterName) {
      const waiter = await getWaiter(session.waiterSlot);
      waiterName = getWaiterDisplayName(waiter);
    }

    currentGuestWaiterName = waiterName;
    document.getElementById("connectedWaiter").textContent = waiterName;
    const serviceHeading = document.getElementById("guestServiceHeading");
    if (serviceHeading) serviceHeading.textContent = `Service by ${waiterName}`;
    document.getElementById("guestSessionCode").textContent = guestLabel(sessionId, session);
    renderGuestSession(session);
  });

  return true;
}


function guestSessionHistoryHtml(sessionId, session, compact = false) {
  const processedAt = Number((session.bill && (session.bill.processedAt || session.bill.finalizedAt)) || 0);
  const closedAt = Number(session.closedAt || session.endedAt || 0);
  const items = Object.values(session.items || {});
  const itemRows = items.map(item => `<div class="history-item"><span>${Number(item.qty || 1)}× ${escapeHtml(item.name || "Item")}</span><strong>${money(Number(item.price || 0) * Number(item.qty || 1))}</strong></div>`).join("");
  const time = value => value ? new Date(value).toLocaleString([], {dateStyle:"medium", timeStyle:"short"}) : "—";
  return `<details class="guest-history-card" ${compact ? "" : "open"}>
    <summary><span><strong>${escapeHtml(session.sessionCode || guestLabel(sessionId, session))}</strong><small>${time(closedAt)}</small></span><strong>${money(sessionBillTotal(session))}</strong></summary>
    <div class="guest-history-body">
      <div class="history-times"><span>Bill processed <strong>${time(processedAt)}</strong></span><span>Session closed <strong>${time(closedAt)}</strong></span></div>
      <div class="history-items">${itemRows || '<span class="muted">No captured items.</span>'}</div>
    </div>
  </details>`;
}

function showGuestSessionEnded(session = currentSession) {
  if (guestSlot) localStorage.removeItem(sessionStorageKey(guestSlot));

  document.getElementById("guestControls").classList.add("hidden");
  document.getElementById("guestSessionInfo").classList.add("hidden");
  const view = document.getElementById("guestClosedView");
  view.classList.remove("hidden");

  if (session) {
    view.innerHTML = `
      <div class="section-kicker">Completed session</div>
      <h2>Your night, recorded.</h2>
      <p class="muted">The waiter closed the service session. You do not need to do anything.</p>
      ${guestSessionHistoryHtml(currentSessionId || "", session)}
      <button onclick="restartGuestSession()">Start New Session</button>`;
  }
}

async function loadGuestHistory() {
  const panel = document.getElementById("guestHistory");
  const toggle = document.getElementById("guestHistoryToggle");
  if (!panel || !toggle || !db) return;

  panel.classList.add("hidden");
  toggle.classList.add("hidden");
  toggle.setAttribute("aria-expanded", "false");

  const rememberedUserId = localStorage.getItem(guestUserStorageKey());
  if (!rememberedUserId) return;

  const snap = await db.ref("sessions")
    .orderByChild("guestUserId")
    .equalTo(rememberedUserId)
    .once("value");
  const rows = Object.entries(snap.val() || {})
    .filter(([, session]) => session && ["closed", "ended"].includes(session.status))
    .sort((a, b) => Number(b[1].closedAt || b[1].endedAt || 0) - Number(a[1].closedAt || a[1].endedAt || 0))
    .slice(0, 5);

  if (!rows.length) return;

  panel.innerHTML = `<div class="guest-history-head"><strong>Previous Sessions</strong><span class="muted">Completed EasyBev sessions</span></div>${rows.map(([id, session]) => guestSessionHistoryHtml(id, session, true)).join("")}`;
  toggle.textContent = `Previous Sessions (${rows.length}) ›`;
  toggle.classList.remove("hidden");
}

function toggleGuestHistory() {
  const panel = document.getElementById("guestHistory");
  const toggle = document.getElementById("guestHistoryToggle");
  if (!panel || !toggle) return;
  const opening = panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !opening);
  toggle.setAttribute("aria-expanded", opening ? "true" : "false");
  const count = (toggle.textContent.match(/\((\d+)\)/) || [])[1];
  toggle.textContent = `Previous Sessions${count ? ` (${count})` : ""} ${opening ? "⌃" : "›"}`;
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


  const billStatus = sessionBillStatus(currentSession);

  if (billStatus !== "open") {
    if (billStatus === "requested") {
      alert("Your bill has already been requested.");
    }
    return;
  }

  const total =
    sessionBillTotal(currentSession);


  if (
    total <= 0
  ) {

    alert(
      "There are no items on this bill yet."
    );

    return;

  }


  const base = `sessions/${currentSessionId}`;
  const timestamp = firebase.database.ServerValue.TIMESTAMP;
  const updates = {};

  updates[`${base}/latestRequest`] = {
    type: "bill",
    label: "Bill requested",
    status: "new",
    createdAt: timestamp
  };
  updates[`${base}/bill/status`] = "requested";
  updates[`${base}/bill/requestedAt`] = timestamp;
  updates[`${base}/lastActivityAt`] = timestamp;

  addLifecycleTransitionUpdates(
    updates,
    currentSessionId,
    currentSession,
    "bill_requested",
    "bill_requested",
    { role: "guest", slot: null, name: guestName(currentSession) }
  );

  await db.ref().update(updates);

}


/* =========================================================
   PAYMENT HANDOFF
   ========================================================= */

async function payBill() {

  /* Payment is intentionally not simulated. A real provider must confirm
     settlement through a trusted server-side integration before EasyBev
     may write bill.status = "paid". */
  alert("Online payment is not connected. Settlement is handled by the venue and its POS.");

}


/* =========================================================
   RENDER GUEST
   ========================================================= */

function renderGuestBillItems(session) {
  const items = session.items || {};
  const entries = Object.values(items);
  const itemsDiv = document.getElementById("guestBillItems");

  itemsDiv.innerHTML = entries.length
    ? entries.map(item => {
        const subtotal = Number(item.price || 0) * Number(item.qty || 1);
        return `
          <div class="bill-row">
            <span>${escapeHtml(item.name)} × ${Number(item.qty || 1)}</span>
            <strong>${money(subtotal)}</strong>
          </div>`;
      }).join("")
    : `<p class="muted">No items added yet.</p>`;

  const total = sessionBillTotal(session);
  document.getElementById("guestTotal").textContent = money(total);

  const billButton = document.getElementById("guestBillButton");
  billButton.disabled = total <= 0 || sessionBillStatus(session) !== "open";
}


function renderGuestRequestStatus(session) {
  const request = session.latestRequest;
  const requestStatus = document.getElementById("guestRequestStatus");

  if (!request) {
    requestStatus.innerHTML = "";
    return;
  }

  let message = escapeHtml(request.label || "");

  if (request.status === "acknowledged") {
    message += ` — ${escapeHtml(currentGuestWaiterName || "Waiter")} acknowledged`;
  }

  if (request.status === "completed") {
    message += " — completed";
  }

  requestStatus.innerHTML = `<div class="status">${message}</div>`;
}


function renderGuestBillStatus(session) {
  const billStatus = sessionBillStatus(session);
  const billStatusDiv = document.getElementById("guestBillStatus");
  const payButton = document.getElementById("guestPayButton");

  payButton.classList.add("hidden");

  if (billStatus === "requested") {
    billStatusDiv.innerHTML = `
      <div class="status warning">
        Bill requested. Waiting for ${escapeHtml(currentGuestWaiterName || "your waiter")} to process it.
      </div>`;
    return;
  }

  if (billStatus === "finalized") {
    billStatusDiv.innerHTML = `
      <div class="status success">
        Bill ready at ${money(sessionBillTotal(session))}. Settlement is being handled by the venue; order items are locked.
      </div>`;
    if (typeof platformOnlinePaymentReady === "function" && platformOnlinePaymentReady()) {
      payButton.classList.remove("hidden");
    }
    return;
  }

  if (billStatus === "paid") {
    billStatusDiv.innerHTML = `
      <div class="status success">
        Payment recorded. Waiting for the waiter to close the session.
      </div>`;
    return;
  }

  billStatusDiv.innerHTML = "";
}


function renderGuestSession(session) {
  renderGuestBillItems(session);
  renderGuestRequestStatus(session);
  monitorGuestReplyAlerts(session);
  renderGuestChat(session.messages || {});
  renderGuestBillStatus(session);
}


/* =========================================================
   FIREBASE AUTHENTICATION + AUTHORITY RESOLUTION
   ========================================================= */

let guestConfirmationResult = null;
let guestRecaptchaVerifier = null;

function resetActorAuthority() {
  removeLiveListenersByPrefix("actor:");
  managerMode = false;
  adminMode = false;
  ownerMode = false;
  waiterSlot = null;
  currentAuthenticatedRole = null;
  currentVenueAccess = null;
  currentAuthClaims = {};
}

function authStatus(targetId, message, kind = "") {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = message
    ? `<div class="status ${escapeHtml(kind)}">${escapeHtml(message)}</div>`
    : "";
}

function showOnlyView(viewId) {
  ["homeView", "staffLoginView", "guestView", "waiterView", "managerView", "platformView", "startupErrorView"]
    .forEach(id => {
      const view = document.getElementById(id);
      if (view) view.classList.toggle("hidden", id !== viewId);
    });
}

function openStaffSignIn() {
  showOnlyView("staffLoginView");
  hideActorNavigation();
  document.getElementById("headerMode").textContent = "Staff sign in";
  authStatus("staffLoginStatus", "");
  setTimeout(() => document.getElementById("staffLoginEmail")?.focus(), 0);
}

function closeStaffSignIn() {
  showOnlyView("homeView");
  document.getElementById("headerMode").textContent = "";
  hideActorNavigation();
}

async function signInStaff() {
  const email = String(document.getElementById("staffLoginEmail")?.value || "").trim();
  const password = String(document.getElementById("staffLoginPassword")?.value || "");

  if (!email || !password) {
    authStatus("staffLoginStatus", "Enter your email and password.", "danger");
    return;
  }

  authStatus("staffLoginStatus", "Signing in…");

  try {
    const credential = await auth.signInWithEmailAndPassword(email, password);
    await credential.user.getIdToken(true);
    currentAuthUser = credential.user;
    await resolveAuthenticatedAuthority(credential.user);
    await bootstrapResolvedActor();
  } catch (error) {
    console.error("EasyBev staff sign-in failed", error);
    const message = ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"]
      .includes(String(error && error.code || ""))
      ? "Email or password is incorrect."
      : "Could not sign in. Check the account and try again.";
    authStatus("staffLoginStatus", message, "danger");
  }
}

async function signOutEasyBev() {
  try {
    if (auth) await auth.signOut();
  } finally {
    resetActorAuthority();
    currentAuthUser = null;
    window.location.href = "./";
  }
}

async function resolveAuthenticatedAuthority(user) {
  resetActorAuthority();
  currentAuthUser = user || null;
  if (!user) return null;

  const token = await user.getIdTokenResult(true);
  currentAuthClaims = token.claims || {};
  const platformRole = String(currentAuthClaims.easybevRole || "").toLowerCase();

  if (platformRole === "owner") {
    ownerMode = true;
    currentAuthenticatedRole = "owner";
    return "owner";
  }

  if (platformRole === "admin") {
    adminMode = true;
    currentAuthenticatedRole = "admin";
    return "admin";
  }

  /* Venue access is deliberately separate from platform authority.
     A trusted UID mapping gives a staff user one venue role/service slot.
     The database rules supplied with this release enforce the same mapping. */
  const accessSnap = await db.ref(`accessByUid/${user.uid}`).once("value");
  const access = accessSnap.val();
  if (!access || access.active === false) return null;

  currentVenueAccess = access;
  const role = String(access.role || "").toLowerCase();

  if (role === "manager") {
    managerMode = true;
    currentAuthenticatedRole = "manager";
    return "manager";
  }

  if (role === "waiter") {
    const slot = String(access.waiterSlot || "").trim();
    if (!slot) return null;
    waiterSlot = slot;
    currentAuthenticatedRole = "waiter";
    return "waiter";
  }

  return null;
}

function prepareActorRoute() {
  ["homeView", "staffLoginView", "guestView", "waiterView", "managerView", "platformView", "startupErrorView"]
    .forEach(id => document.getElementById(id)?.classList.add("hidden"));
}

async function bootstrapResolvedActor() {
  if (!currentAuthenticatedRole) {
    await auth.signOut();
    openStaffSignIn();
    authStatus("staffLoginStatus", "This account does not have active EasyBev staff access.", "danger");
    return;
  }

  if (managerMode || waiterSlot) await ensureWaiterSlots();
  if (ownerMode || adminMode) await ensurePlatformFoundation();
  prepareActorRoute();
  routeApplication();
  updateNotificationControls();
}

async function initialiseAuthRouting() {
  currentAuthUser = await new Promise(resolve => {
    let unsubscribe = () => {};
    unsubscribe = auth.onAuthStateChanged(user => {
      unsubscribe();
      resolve(user || null);
    }, () => resolve(null));
  });

  /* A guest service URL always enters the guest flow. The phone OTP inside
     that flow establishes guest identity. Staff URL flags are ignored. */
  if (guestSlot) {
    await ensureWaiterSlots();
    routeApplication();
    updateNotificationControls();
    return;
  }

  if (currentAuthUser) {
    await resolveAuthenticatedAuthority(currentAuthUser);
    if (currentAuthenticatedRole) {
      await bootstrapResolvedActor();
      return;
    }
  }

  resetActorAuthority();
  routeApplication();
  updateNotificationControls();
}

function saPhoneToE164(phone) {
  let digits = String(phone || "").replace(/[^0-9]/g, "");
  if (digits.startsWith("0027")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("0")) digits = `27${digits.slice(1)}`;
  if (!digits.startsWith("27") || digits.length < 11 || digits.length > 12) return null;
  return `+${digits}`;
}

function ensureGuestRecaptcha() {
  if (guestRecaptchaVerifier) return guestRecaptchaVerifier;
  guestRecaptchaVerifier = new firebase.auth.RecaptchaVerifier("guestRecaptcha", {
    size: "invisible"
  });
  return guestRecaptchaVerifier;
}

async function beginGuestPhoneAuthentication(phone) {
  const e164 = saPhoneToE164(phone);
  if (!e164) throw new Error("Enter a valid South African mobile number.");
  const verifier = ensureGuestRecaptcha();
  guestConfirmationResult = await auth.signInWithPhoneNumber(e164, verifier);
  return e164;
}

async function confirmGuestPhoneAuthentication(code) {
  if (!guestConfirmationResult) throw new Error("Request a new SMS code first.");
  const credential = await guestConfirmationResult.confirm(String(code || "").trim());
  currentAuthUser = credential.user;
  return credential.user;
}

function resetGuestRecaptcha() {
  try {
    if (guestRecaptchaVerifier) guestRecaptchaVerifier.clear();
  } catch (_) {}
  guestRecaptchaVerifier = null;
  guestConfirmationResult = null;
}

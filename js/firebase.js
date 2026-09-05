/* =========================================================
   FIREBASE STARTUP CHECK
   ========================================================= */

function firebaseConfigLooksValid() {

  const requiredValues = [

    firebaseConfig.apiKey,
    firebaseConfig.authDomain,
    firebaseConfig.databaseURL,
    firebaseConfig.projectId,
    firebaseConfig.appId

  ];

  return requiredValues.every(
    value => {

      const text =
        String(value || "");

      return (
        text.length > 0 &&
        !text.includes(
          "PASTE_YOUR"
        )
      );

    }
  );

}


function showStartupError(
  message
) {

  console.error(
    "EasyBev startup error:",
    message
  );

  document
    .getElementById(
      "homeView"
    )
    .classList
    .add(
      "hidden"
    );

  document
    .getElementById(
      "guestView"
    )
    .classList
    .add(
      "hidden"
    );

  document
    .getElementById(
      "waiterView"
    )
    .classList
    .add(
      "hidden"
    );

  document
    .getElementById(
      "managerView"
    )
    .classList
    .add(
      "hidden"
    );

  document
    .getElementById(
      "startupErrorView"
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
      "Connection Error";

  showActorNavigation("Connection Error");

  document
    .getElementById(
      "startupErrorMessage"
    )
    .textContent =
      message;

}


/* =========================================================
   FIREBASE INITIALISATION
   ========================================================= */

async function initialiseEasyBev() {

  try {

    /*
      FIRST CHECK:

      Prevent the old blank-screen behaviour
      when placeholder Firebase details remain
      in the code.
    */

    if (
      !firebaseConfigLooksValid()
    ) {

      throw new Error(
        "Firebase configuration is missing. Copy the real firebaseConfig values from your existing working EasyBev file into the Firebase configuration section."
      );

    }


    /*
      INITIALISE FIREBASE
    */

    firebase.initializeApp(
      firebaseConfig
    );

    db =
      firebase.database();


    /*
      QUICK CONNECTION TEST

      This forces Firebase to establish
      a Realtime Database connection/read.
    */

    await db
      .ref(".info/connected")
      .once("value");


    /*
      MAKE SURE OUR WAITER SLOTS EXIST
    */

    await ensureWaiterSlots();


    /*
      ONLY AFTER SUCCESSFUL STARTUP
      ROUTE TO THE CORRECT VIEW.
    */

    routeApplication();
    updateNotificationControls();

  }
  catch (error) {

    console.error(error);

    showStartupError(
      error &&
      error.message
        ? error.message
        : "EasyBev could not connect to Firebase."
    );

  }

}


/* =========================================================
   WAITER CONFIGURATION
   ========================================================= */

async function ensureWaiterSlots() {

  const snap = await db.ref("waiters").once("value");

  if (snap.exists()) {
    return;
  }

  /* Fresh prototype only: begin with one permanent service slot.
     Existing venues retain every slot already stored in Firebase. */
  await db.ref("waiters/1").set({
    slot: "1",
    name: "",
    active: true,
    createdAt: firebase.database.ServerValue.TIMESTAMP
  });
}


async function getWaiter(
  slot
) {

  const snap = await db
    .ref(`waiters/${slot}`)
    .once("value");

  const waiter = snap.val() || {};

  return {
    exists: snap.exists(),
    slot: String(slot),
    name: String(waiter.name || "").trim(),
    active: snap.exists() && waiter.active !== false
  };
}




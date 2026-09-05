/* =========================================================
   START EASYBEV
   ========================================================= */

initialiseEasyBev();

document.addEventListener(
  "keydown",
  event => {

    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    if (event.target && event.target.id === "guestMessageInput") {
      event.preventDefault();
      sendGuestMessage();
      return;
    }

    if (event.target && String(event.target.id || "").startsWith("waiterMessage-")) {
      event.preventDefault();
      const sessionId = String(event.target.id).replace("waiterMessage-", "");
      sendWaiterMessage(sessionId);
    }

  }
);


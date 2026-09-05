/* =========================================================
   ADD ITEMS MODAL
   ========================================================= */

async function openItemModal(
  sessionId,
  label
) {

  itemModalSessionId =
    sessionId;


  itemModalGuestLabel =
    label;


  const sessionSnap =
    await db
      .ref(
        `sessions/${sessionId}`
      )
      .once(
        "value"
      );


  const session =
    sessionSnap.val() || {};


  const waiter =
    await getWaiter(
      session.waiterSlot
    );


  itemModalWaiterName =
    getWaiterDisplayName(
      waiter
    );


  document
    .getElementById(
      "itemModalGuest"
    )
    .textContent =
      label;


  document
    .getElementById(
      "itemModal"
    )
    .classList
    .remove(
      "hidden"
    );


  document
    .getElementById(
      "itemName"
    )
    .value =
      "";


  document
    .getElementById(
      "itemPrice"
    )
    .value =
      "";


  document
    .getElementById(
      "itemQty"
    )
    .value =
      "1";


  itemModalBatchId = `round-${Date.now()}`;

  await loadOrderPadContext();
  renderQuickItems();
  updateRepeatLastRoundButton();

  refreshModalBill();


  setTimeout(
    () => {

      document
        .getElementById(
          "itemName"
        )
        .focus();

    },
    100
  );

}


function closeItemModal() {

  document
    .getElementById(
      "itemModal"
    )
    .classList
    .add(
      "hidden"
    );


  itemModalSessionId =
    null;

  itemModalGuestLabel =
    null;

  itemModalWaiterName =
    null;

  itemModalCatalog = [];
  itemModalLastRound = [];
  itemModalBatchId = null;

}


/*
  IMPORTANT:

  ADD ITEM DOES NOT CLOSE THE WINDOW.

  The waiter can add multiple items.

  Only Done closes the modal.
*/

async function addItemToBill() {

  if (
    !itemModalSessionId
  ) {

    return;

  }


  const name =
    document
      .getElementById(
        "itemName"
      )
      .value
      .trim();


  const price =
    Number(

      document
        .getElementById(
          "itemPrice"
        )
        .value

    );


  const qty =
    Number(

      document
        .getElementById(
          "itemQty"
        )
        .value

      || 1

    );


  if (

    !name ||

    !Number.isFinite(
      price
    ) ||

    price < 0 ||

    !Number.isFinite(
      qty
    ) ||

    qty < 1

  ) {

    alert(
      "Enter an item name, valid price and quantity."
    );

    return;

  }


  const itemRef =
    db
      .ref(
        `sessions/${itemModalSessionId}/items`
      )
      .push();


  await itemRef.set({

    name,

    price,

    qty,

    addedBy:
      itemModalWaiterName ||
      "Waiter",

    batchId:
      itemModalBatchId || `round-${Date.now()}`,

    addedAt:
      firebase.database
        .ServerValue
        .TIMESTAMP

  });


  const snap =
    await db
      .ref(
        `sessions/${itemModalSessionId}/items`
      )
      .once(
        "value"
      );


  const total =
    calculateTotal(
      snap.val()
    );


  await db
    .ref(
      `sessions/${itemModalSessionId}`
    )
    .update({

      total,

      lastActivityAt:
        firebase.database
          .ServerValue
          .TIMESTAMP

    });


  /*
    CLEAR THE ENTRY FIELDS
    BUT KEEP THE MODAL OPEN.
  */

  document
    .getElementById(
      "itemName"
    )
    .value =
      "";


  document
    .getElementById(
      "itemPrice"
    )
    .value =
      "";


  document
    .getElementById(
      "itemQty"
    )
    .value =
      "1";


  document
    .getElementById(
      "itemName"
    )
    .focus();


  await loadOrderPadContext();
  renderQuickItems();
  updateRepeatLastRoundButton();
  refreshModalBill();

}


/* =========================================================
   FAST ORDER PAD HELPERS
   ========================================================= */

async function loadOrderPadContext() {
  const [menuSnap, sessionsSnap] = await Promise.all([
    db.ref("menuItems").once("value"),
    db.ref("sessions").once("value")
  ]);

  const menuItems = menuSnap.val() || {};
  const sessions = sessionsSnap.val() || {};
  const usage = new Map();
  const currentItems = [];

  Object.entries(sessions).forEach(([sessionId, session]) => {
    const items = Object.values((session && session.items) || {});

    items.forEach(item => {
      const name = String(item.name || "").trim();
      if (!name) return;

      const key = name.toLowerCase();
      const stats = usage.get(key) || { uses: 0, lastUsedAt: 0 };
      stats.uses += Number(item.qty || 1);
      stats.lastUsedAt = Math.max(stats.lastUsedAt, Number(item.addedAt || 0));
      usage.set(key, stats);

      if (sessionId === itemModalSessionId) currentItems.push(item);
    });
  });

  itemModalCatalog = Object.entries(menuItems)
    .filter(([, item]) => item && item.active !== false)
    .map(([id, item]) => {
      const name = String(item.name || "").trim();
      const price = Number(item.price);
      const stats = usage.get(name.toLowerCase()) || { uses: 0, lastUsedAt: 0 };
      return { id, name, price, uses: stats.uses, lastUsedAt: stats.lastUsedAt };
    })
    .filter(item => item.name && Number.isFinite(item.price))
    .sort((a, b) => (b.uses - a.uses) || (b.lastUsedAt - a.lastUsedAt) || a.name.localeCompare(b.name));

  const grouped = new Map();
  currentItems.forEach(item => {
    if (!item.batchId) return;
    if (!grouped.has(item.batchId)) grouped.set(item.batchId, []);
    grouped.get(item.batchId).push(item);
  });

  const rounds = Array.from(grouped.entries())
    .map(([batchId, items]) => ({
      batchId,
      items,
      time: Math.max(...items.map(item => Number(item.addedAt || 0)))
    }))
    .filter(round => round.batchId !== itemModalBatchId)
    .sort((a, b) => b.time - a.time);

  itemModalLastRound = rounds.length ? rounds[0].items : [];

  const datalist = document.getElementById("menuItemSuggestions");
  if (datalist) {
    datalist.innerHTML = itemModalCatalog
      .map(item => `<option value="${escapeHtml(item.name)}">${money(item.price)}</option>`)
      .join("");
  }
}

function renderQuickItems() {
  const container = document.getElementById("quickItems");
  if (!container) return;

  if (!itemModalCatalog.length) {
    container.innerHTML = '<span class="muted">Quick items will appear as EasyBev learns the venue\'s regular items.</span>';
    return;
  }

  container.innerHTML = itemModalCatalog
    .slice(0, 8)
    .map(item => `
      <button type="button" class="secondary" onclick="selectQuickItem('${escapeJsString(item.name)}', ${Number(item.price)})">
        <strong>${escapeHtml(item.name)}</strong>
        <small>${money(item.price)} · tap to add</small>
      </button>
    `)
    .join("");
}

function escapeJsString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "")
    .replace(/\n/g, " ");
}

function selectQuickItem(name, price) {
  document.getElementById("itemName").value = name;
  document.getElementById("itemPrice").value = Number(price).toFixed(2);
  document.getElementById("itemQty").value = "1";
  addItemToBill();
}

function handleFastItemInput() {
  const input = document.getElementById("itemName");
  const priceInput = document.getElementById("itemPrice");
  const qtyInput = document.getElementById("itemQty");
  if (!input || !priceInput || !qtyInput) return;

  const raw = input.value.trim();
  const match = raw.match(/^(\d+)\s*[x×]?\s+(.+)$/i);
  const lookupName = match ? match[2].trim() : raw;

  if (match) {
    qtyInput.value = String(Math.max(1, Number(match[1]) || 1));
  }

  const known = itemModalCatalog.find(item =>
    item.name.toLowerCase() === lookupName.toLowerCase()
  );

  if (known) {
    if (match) input.value = known.name;
    priceInput.value = Number(known.price).toFixed(2);
  }
}

function handleFastItemKey(event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  addItemToBill();
}

function updateRepeatLastRoundButton() {
  const button = document.getElementById("repeatLastRoundButton");
  if (!button) return;

  if (!itemModalLastRound.length) {
    button.classList.add("hidden");
    return;
  }

  const units = itemModalLastRound.reduce((sum, item) => sum + Number(item.qty || 1), 0);
  button.textContent = `Repeat Last Round (${units})`;
  button.classList.remove("hidden");
}

async function repeatLastRound() {
  if (!itemModalSessionId || !itemModalLastRound.length) return;

  const root = db.ref(`sessions/${itemModalSessionId}/items`);
  const updates = {};
  const nowBatch = itemModalBatchId || `round-${Date.now()}`;

  itemModalLastRound.forEach(item => {
    const key = root.push().key;
    updates[key] = {
      name: item.name,
      price: Number(item.price),
      qty: Number(item.qty || 1),
      addedBy: itemModalWaiterName || "Waiter",
      batchId: nowBatch,
      addedAt: firebase.database.ServerValue.TIMESTAMP
    };
  });

  await root.update(updates);

  const snap = await root.once("value");
  await db.ref(`sessions/${itemModalSessionId}`).update({
    total: calculateTotal(snap.val()),
    lastActivityAt: firebase.database.ServerValue.TIMESTAMP
  });

  refreshModalBill();
  showEasyBevToast("Last round added.", "success");
}

/* =========================================================
   REFRESH MODAL BILL
   ========================================================= */

async function refreshModalBill() {

  if (
    !itemModalSessionId
  ) {

    return;

  }


  const snap =
    await db
      .ref(
        `sessions/${itemModalSessionId}/items`
      )
      .once(
        "value"
      );


  const items =
    snap.val() || {};


  const entries =
    Object.values(
      items
    );


  const list =
    document.getElementById(
      "modalBillItems"
    );


  if (
    !entries.length
  ) {

    list.innerHTML = `

      <p class="muted">
        No items yet.
      </p>

    `;

  }
  else {

    list.innerHTML =
      entries
        .map(
          item => `

            <div class="item-row">

              <span>

                ${escapeHtml(
                  item.name
                )}

                ×
                ${item.qty || 1}

              </span>

              <strong>

                ${money(

                  Number(
                    item.price
                  )

                  *

                  Number(
                    item.qty || 1
                  )

                )}

              </strong>

            </div>

          `
        )
        .join("");

  }


  document
    .getElementById(
      "modalTotal"
    )
    .textContent =

      money(
        calculateTotal(
          items
        )
      );

}


function doneAddingItems() {

  closeItemModal();

}


/* =========================================================
   BILL FINALISATION
   ========================================================= */

async function finalizeBill(
  sessionId
) {

  const snap =
    await db
      .ref(
        `sessions/${sessionId}`
      )
      .once(
        "value"
      );


  const session =
    snap.val();


  if (
    !session
  ) {

    return;

  }


  const total =
    calculateTotal(
      session.items || {}
    );


  if (
    total <= 0
  ) {

    alert(
      "There are no billable items."
    );

    return;

  }


  await db
    .ref(
      `sessions/${sessionId}`
    )
    .update({

      total,

      "bill/status":
        "finalized",

      "bill/finalizedAt":
        firebase.database
          .ServerValue
          .TIMESTAMP,

      latestRequest: {

        type:
          "bill",

        label:
          "Bill finalised",

        status:
          "completed",

        completedAt:
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
   NORMAL PAID SESSION CLOSURE
   ========================================================= */

async function closePaidSession(
  sessionId
) {

  const snap =
    await db
      .ref(
        `sessions/${sessionId}`
      )
      .once(
        "value"
      );


  const session =
    snap.val();


  if (

    !session ||

    !session.bill ||

    session.bill.status !==
      "paid"

  ) {

    alert(
      "The session can only be closed normally after payment."
    );

    return;

  }


  const label =
    guestLabel(
      sessionId,
      session
    );


  const confirmed =
    confirm(
      `Close ${label} and end this paid session?`
    );


  if (
    !confirmed
  ) {

    return;

  }


  await closeSessionAtomic(
    sessionId,
    "paid"
  );

}


/* =========================================================
   WAITER / MANAGER SESSION OVERRIDE
   ========================================================= */

async function endSessionOverride(
  sessionId,
  reason = "waiter_override"
) {

  const snap =
    await db
      .ref(
        `sessions/${sessionId}`
      )
      .once(
        "value"
      );


  const session =
    snap.val();


  if (
    !session
  ) {

    return;

  }


  const label =
    guestLabel(
      sessionId,
      session
    );


  const confirmed =
    confirm(

      `End the active session for ${label}?\n\n` +

      `Use this for an abandoned, broken or stuck session.`

    );


  if (
    !confirmed
  ) {

    return;

  }


  const secondConfirm =
    confirm(
      `Confirm: end ${label} now?`
    );


  if (
    !secondConfirm
  ) {

    return;

  }


  await closeSessionAtomic(
    sessionId,
    reason
  );

}


/* =========================================================
   SESSION CLOSURE

   THERE IS NO TABLE RECORD TO RELEASE.

   EACH GUEST SESSION IS INDEPENDENT.
   ========================================================= */

async function closeSessionAtomic(
  sessionId,
  reason
) {

  const sessionSnap =
    await db
      .ref(
        `sessions/${sessionId}`
      )
      .once(
        "value"
      );


  const session =
    sessionSnap.val();


  if (
    !session
  ) {

    return;

  }


  const finalStatus =

    reason === "paid"

      ? "closed"

      : "ended";


  const updates = {};


  updates[
    `sessions/${sessionId}/status`
  ] =
    finalStatus;


  updates[
    `sessions/${sessionId}/endedAt`
  ] =
    firebase.database
      .ServerValue
      .TIMESTAMP;


  updates[
    `sessions/${sessionId}/closeReason`
  ] =
    reason;


  updates[
    `sessions/${sessionId}/latestRequest`
  ] =
    null;


  updates[
    `sessions/${sessionId}/lastActivityAt`
  ] =
    firebase.database
      .ServerValue
      .TIMESTAMP;


  await db
    .ref()
    .update(
      updates
    );


  alert(

    reason === "paid"

      ? `${guestLabel(
          sessionId,
          session
        )} closed successfully.`

      : `${guestLabel(
          sessionId,
          session
        )} session ended.`

  );

}



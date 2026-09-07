/* =========================================================
   ADD ITEMS MODAL
   ========================================================= */

/* =========================================================
   ORDER INVARIANTS
   ========================================================= */

async function readEditableOrderSession(sessionId, showAlert = true) {
  const snap = await db.ref(`sessions/${sessionId}`).once("value");
  const session = snap.val();

  if (!session || session.status !== "active") {
    if (showAlert) alert("This guest session is no longer active.");
    return null;
  }

  if (sessionOrderIsLocked(session)) {
    if (showAlert) alert("This bill has been processed. Order items are locked.");
    return null;
  }

  return session;
}


function orderMutationRootUpdates(sessionId, session, total) {
  const timestamp = firebase.database.ServerValue.TIMESTAMP;
  const base = `sessions/${sessionId}`;
  const updates = {};

  updates[`${base}/total`] = total;
  updates[`${base}/lastActivityAt`] = timestamp;

  if (session && session.reconciliation && session.reconciliation.status === "reconciled") {
    updates[`${base}/reconciliation/status`] = "stale";
    updates[`${base}/reconciliation/staleAt`] = timestamp;
  }

  return updates;
}


async function openItemModal(
  sessionId,
  label
) {

  const session = await readEditableOrderSession(sessionId);
  if (!session) return;

  itemModalSessionId = sessionId;
  itemModalWaiterName = sessionWaiterSnapshotName(session);
  itemModalWaiterStaffId = sessionWaiterSnapshotId(session);

  if (!itemModalWaiterName) {
    const waiter = await getWaiter(session.waiterSlot);
    itemModalWaiterName = getWaiterDisplayName(waiter);
  }

  document.getElementById("itemModalGuest").textContent = label;
  document.getElementById("itemModal").classList.remove("hidden");
  document.getElementById("itemName").value = "";
  document.getElementById("itemPrice").value = "";
  document.getElementById("itemQty").value = "1";

  itemModalBatchId = `round-${Date.now()}`;

  await loadOrderPadContext();
  renderQuickItems();
  updateRepeatLastRoundButton();
  refreshModalBill();

  setTimeout(() => {
    document.getElementById("itemName").focus();
  }, 100);
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

  itemModalWaiterName =
    null;

  itemModalWaiterStaffId =
    null;

  itemModalCatalog = [];
  hideItemSuggestions();
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

  const session = await readEditableOrderSession(itemModalSessionId);
  if (!session) {
    closeItemModal();
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


  const itemRef = db.ref(`sessions/${itemModalSessionId}/items`).push();
  const newItem = {
    name,
    price,
    qty,
    addedBy: itemModalWaiterName || "Waiter",
    addedByStaffId: itemModalWaiterStaffId || null,
    batchId: itemModalBatchId || `round-${Date.now()}`,
    addedAt: firebase.database.ServerValue.TIMESTAMP
  };

  const nextItems = {
    ...(session.items || {}),
    [itemRef.key]: newItem
  };

  const updates = orderMutationRootUpdates(
    itemModalSessionId,
    session,
    calculateTotal(nextItems)
  );
  updates[`sessions/${itemModalSessionId}/items/${itemRef.key}`] = newItem;

  /* Item write, total update and reconciliation invalidation are one atomic Firebase update. */
  await db.ref().update(updates);


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

  renderItemSuggestions("");
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

function selectQuickItem(name, price) {
  document.getElementById("itemName").value = name;
  document.getElementById("itemPrice").value = Number(price).toFixed(2);
  document.getElementById("itemQty").value = "1";
  hideItemSuggestions();
  addItemToBill();
}

function hideItemSuggestions() {
  const panel = document.getElementById("menuItemSuggestions");
  if (!panel) return;
  panel.innerHTML = "";
  panel.classList.add("hidden");
}

function renderItemSuggestions(query) {
  const panel = document.getElementById("menuItemSuggestions");
  if (!panel) return;
  const q = String(query || "").trim().toLowerCase();
  if (!q) { hideItemSuggestions(); return; }

  const matches = itemModalCatalog
    .filter(item => item.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return aStarts - bStarts || (b.uses - a.uses) || a.name.localeCompare(b.name);
    })
    .slice(0, 5);

  if (!matches.length) { hideItemSuggestions(); return; }

  panel.innerHTML = matches.map(item => `
    <button type="button" class="item-suggestion" role="option" onclick="selectSuggestedItem('${escapeJsString(item.name)}', ${Number(item.price)})">
      <strong>${escapeHtml(item.name)}</strong><span>${money(item.price)}</span>
    </button>`).join("");
  panel.classList.remove("hidden");
}

function selectSuggestedItem(name, price) {
  document.getElementById("itemName").value = name;
  document.getElementById("itemPrice").value = Number(price).toFixed(2);
  hideItemSuggestions();
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

  renderItemSuggestions(lookupName);
}

function handleFastItemKey(event) {
  if (event.key === "Escape") { hideItemSuggestions(); return; }
  if (event.key !== "Enter") return;
  event.preventDefault();
  hideItemSuggestions();
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

  const session = await readEditableOrderSession(itemModalSessionId);
  if (!session) {
    closeItemModal();
    return;
  }

  const itemRoot = db.ref(`sessions/${itemModalSessionId}/items`);
  const updates = {};
  const nextItems = { ...(session.items || {}) };
  const nowBatch = itemModalBatchId || `round-${Date.now()}`;

  itemModalLastRound.forEach(item => {
    const key = itemRoot.push().key;
    const repeatedItem = {
      name: item.name,
      price: Number(item.price),
      qty: Number(item.qty || 1),
      addedBy: itemModalWaiterName || "Waiter",
      addedByStaffId: itemModalWaiterStaffId || null,
      batchId: nowBatch,
      addedAt: firebase.database.ServerValue.TIMESTAMP
    };

    updates[`sessions/${itemModalSessionId}/items/${key}`] = repeatedItem;
    nextItems[key] = repeatedItem;
  });

  Object.assign(
    updates,
    orderMutationRootUpdates(
      itemModalSessionId,
      session,
      calculateTotal(nextItems)
    )
  );

  await db.ref().update(updates);


  refreshModalBill();
  showEasyBevToast("Last round added", "The previous round was added to this bill.");
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

async function processBill(
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
    session.status !== "active"
  ) {

    return;

  }

  if (!["open", "requested"].includes(sessionBillStatus(session))) {
    alert("This bill has already been processed.");
    return;
  }

  const reconciliationStatus = String(
    (session.reconciliation && session.reconciliation.status) || ""
  );

  if (reconciliationStatus !== "reconciled") {
    alert(
      reconciliationStatus === "stale"
        ? "The order changed after POS reconciliation. Reconcile the POS list again before processing the bill."
        : "Reconcile the EasyBev order list with the venue POS before processing the bill."
    );
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

      "bill/processedAt":
        firebase.database
          .ServerValue
          .TIMESTAMP,

      "bill/finalizedTotal":
        total,

      "bill/finalizedItemCount":
        Object.values(session.items || {}).reduce((sum, item) => sum + Number(item.qty || 1), 0),

      latestRequest: {

        type:
          "bill",

        label:
          "Bill processed",

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


// Backward-compatible alias for older links/build state.
async function finalizeBill(sessionId) {
  return processBill(sessionId);
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


  if (!session || !session.bill || !["finalized", "paid"].includes(session.bill.status)) {
    alert("Process the bill before closing the session.");
    return;
  }


  const label =
    guestLabel(
      sessionId,
      session
    );


  const confirmed =
    confirm(
      `Close ${label}? The bill has been processed and the session will move to guest history.`
    );


  if (
    !confirmed
  ) {

    return;

  }


  await closeSessionAtomic(
    sessionId,
    session.bill.status === "paid" ? "paid" : "bill_processed"
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

  if (sessionBillStatus(session) === "paid") {
    alert("This session has been paid. Use Close Session to finish it normally.");
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

    ["paid", "bill_processed"].includes(reason)

      ? "closed"

      : "ended";


  const updates = {};


  updates[
    `sessions/${sessionId}/status`
  ] =
    finalStatus;


  updates[`sessions/${sessionId}/endedAt`] = firebase.database.ServerValue.TIMESTAMP;
  updates[`sessions/${sessionId}/closedAt`] = firebase.database.ServerValue.TIMESTAMP;


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

    ["paid", "bill_processed"].includes(reason)

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



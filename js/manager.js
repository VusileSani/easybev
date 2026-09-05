/* =========================================================
   MANAGEMENT DASHBOARD
   ========================================================= */

function startManagerDashboard() {

  try {

    db.ref("waiters").on("value", snap => {
      latestManagerWaiters = snap.val() || {};
      renderManagerWaiterSlots(latestManagerWaiters, latestManagerSessions);
      if (!document.getElementById("managerReports")?.classList.contains("hidden")) renderManagerReports();
    });

    db.ref("sessions").on("value", snap => {
      latestManagerSessions = snap.val() || {};
      renderManagerWaiterSlots(latestManagerWaiters, latestManagerSessions);
      if (!document.getElementById("managerReports")?.classList.contains("hidden")) renderManagerReports();
    });

    db.ref("menuItems").on("value", snap => {
      latestManagerMenuItems = snap.val() || {};
      if (!document.getElementById("managerMenuItems")?.classList.contains("hidden")) renderManagerMenuItems();
    });

  }
  catch (error) {
    console.error(error);
    showStartupError(error.message || "Could not load management dashboard.");
  }
}


let managerReportRangeDays = 1;

function toggleManagerReports() {
  const panel = document.getElementById("managerReports");
  if (!panel) return;
  panel.classList.toggle("hidden");
  if (!panel.classList.contains("hidden")) renderManagerReports();
}

function setManagerReportRange(days) {
  managerReportRangeDays = Number(days) || 1;
  renderManagerReports();
}

function renderManagerReports() {
  const panel = document.getElementById("managerReports");
  if (!panel) return;

  const now = Date.now();
  const start = managerReportRangeDays === 1
    ? new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime()
    : now - managerReportRangeDays * 24 * 60 * 60 * 1000;

  const rows = Object.entries(latestManagerSessions || {}).filter(([, session]) => {
    const created = Number(session && session.createdAt || 0);
    return session && created >= start && created <= now;
  });

  const uniqueGuests = new Set(rows.map(([, s]) => s.guestUserId || cleanPhone(s.guestPhone) || s.sessionCode).filter(Boolean)).size;
  const closed = rows.filter(([, s]) => s.status === "closed" || s.status === "ended").length;
  const billsRequested = rows.filter(([, s]) => s.bill && s.bill.requestedAt).length;
  const recordedValue = rows.reduce((sum, [, s]) => sum + calculateTotal(s.items || {}), 0);

  const durations = rows
    .filter(([, s]) => s.endedAt && s.createdAt)
    .map(([, s]) => Number(s.endedAt) - Number(s.createdAt))
    .filter(ms => ms > 0);
  const avgMinutes = durations.length ? Math.round(durations.reduce((a,b) => a+b, 0) / durations.length / 60000) : null;

  const waiterCounts = {};
  rows.forEach(([, s]) => {
    const slot = String(s.waiterSlot || "?");
    waiterCounts[slot] = (waiterCounts[slot] || 0) + 1;
  });
  const waiterRows = Object.entries(waiterCounts).sort((a,b) => Number(a[0]) - Number(b[0])).map(([slot, count]) => {
    const waiter = latestManagerWaiters[slot] || {};
    return `<div class="manager-row"><span>${escapeHtml(getWaiterDisplayName({...waiter, slot}))}<small class="muted"> · Waiter ${escapeHtml(slot)}</small></span><strong>${count} session${count === 1 ? "" : "s"}</strong></div>`;
  }).join("") || `<p class="muted">No service sessions in this period.</p>`;

  const rangeLabel = managerReportRangeDays === 1 ? "Today" : `Last ${managerReportRangeDays} days`;
  panel.innerHTML = `
    <div class="heading-row">
      <div><h3 style="margin-bottom:3px">Service Reports</h3><p class="muted" style="margin:0">${rangeLabel} · EasyBev service activity only.</p></div>
      <button class="secondary" onclick="toggleManagerReports()">Close</button>
    </div>
    <div class="report-controls">
      <button class="${managerReportRangeDays === 1 ? "warning" : "secondary"}" onclick="setManagerReportRange(1)">Today</button>
      <button class="${managerReportRangeDays === 7 ? "warning" : "secondary"}" onclick="setManagerReportRange(7)">7 Days</button>
      <button class="${managerReportRangeDays === 30 ? "warning" : "secondary"}" onclick="setManagerReportRange(30)">30 Days</button>
    </div>
    <div class="report-kpis">
      <div class="report-kpi"><span class="muted">Sessions</span><strong>${rows.length}</strong></div>
      <div class="report-kpi"><span class="muted">Unique guests</span><strong>${uniqueGuests}</strong></div>
      <div class="report-kpi"><span class="muted">Bills requested</span><strong>${billsRequested}</strong></div>
      <div class="report-kpi"><span class="muted">Recorded bill value</span><strong>${money(recordedValue)}</strong></div>
    </div>
    <div class="report-table">
      <div class="heading-row"><strong>Waiter activity</strong><span class="muted">${closed} ended · Avg duration ${avgMinutes === null ? "—" : `${avgMinutes} min`}</span></div>
      ${waiterRows}
    </div>
  `;
}


/* =========================================================
   MANAGER MENU ITEMS
   ========================================================= */

function toggleManagerMenuItems() {
  const panel = document.getElementById("managerMenuItems");
  if (!panel) return;
  panel.classList.toggle("hidden");
  if (!panel.classList.contains("hidden")) renderManagerMenuItems();
}

function renderManagerMenuItems() {
  const panel = document.getElementById("managerMenuItems");
  if (!panel) return;

  const rows = Object.entries(latestManagerMenuItems || {})
    .sort((a, b) => String(a[1]?.name || "").localeCompare(String(b[1]?.name || "")));

  const itemRows = rows.length
    ? rows.map(([id, item]) => {
        const active = item && item.active !== false;
        return `
          <div class="manager-menu-row">
            <div class="manager-menu-main">
              <strong>${escapeHtml(String(item?.name || "Unnamed item"))}</strong>
              <span class="muted">${money(Number(item?.price || 0))}</span>
            </div>
            <div class="manager-menu-actions">
              <button class="secondary" onclick="editManagerMenuItem('${escapeJsString(id)}')">Edit</button>
              <button class="${active ? "danger" : "blue"}" onclick="toggleManagerMenuItem('${escapeJsString(id)}', ${active})">${active ? "Disable" : "Enable"}</button>
            </div>
          </div>`;
      }).join("")
    : `<p class="muted">No venue items yet. Add the first item below.</p>`;

  panel.innerHTML = `
    <div class="heading-row">
      <div>
        <h3 style="margin-bottom:3px">Menu Items</h3>
        <p class="muted" style="margin:0">Management maintains the item catalogue. Waiters use it for fast suggestions and automatic pricing.</p>
      </div>
      <button class="secondary" onclick="toggleManagerMenuItems()">Close</button>
    </div>

    <div class="manager-menu-add">
      <input id="managerMenuItemName" type="text" placeholder="Item name e.g. Corona" />
      <input id="managerMenuItemPrice" type="number" min="0" step="0.01" placeholder="Price" />
      <button class="warning" onclick="addManagerMenuItem()">+ Add Item</button>
    </div>

    <div class="manager-menu-list">${itemRows}</div>
  `;
}

async function addManagerMenuItem() {
  const nameInput = document.getElementById("managerMenuItemName");
  const priceInput = document.getElementById("managerMenuItemPrice");
  const name = String(nameInput?.value || "").trim();
  const price = Number(priceInput?.value);

  if (!name || !Number.isFinite(price) || price < 0) {
    alert("Enter an item name and valid price.");
    return;
  }

  const duplicate = Object.values(latestManagerMenuItems || {}).some(item =>
    String(item?.name || "").trim().toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    alert("That item already exists. Edit the existing item instead.");
    return;
  }

  const ref = db.ref("menuItems").push();
  await ref.set({
    name,
    price,
    active: true,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    updatedAt: firebase.database.ServerValue.TIMESTAMP
  });

  if (nameInput) nameInput.value = "";
  if (priceInput) priceInput.value = "";
  showEasyBevToast("Menu item added", `${name} · ${money(price)}`);
}

async function editManagerMenuItem(id) {
  const item = latestManagerMenuItems[id];
  if (!item) return;

  const name = prompt("Item name", String(item.name || ""));
  if (name === null) return;
  const cleanName = name.trim();
  if (!cleanName) return;

  const priceText = prompt("Price", Number(item.price || 0).toFixed(2));
  if (priceText === null) return;
  const price = Number(priceText);
  if (!Number.isFinite(price) || price < 0) {
    alert("Enter a valid price.");
    return;
  }

  await db.ref(`menuItems/${id}`).update({
    name: cleanName,
    price,
    updatedAt: firebase.database.ServerValue.TIMESTAMP
  });
  showEasyBevToast("Menu item updated", `${cleanName} · ${money(price)}`);
}

async function toggleManagerMenuItem(id, currentlyActive) {
  const item = latestManagerMenuItems[id];
  if (!item) return;
  await db.ref(`menuItems/${id}`).update({
    active: !currentlyActive,
    updatedAt: firebase.database.ServerValue.TIMESTAMP
  });
  showEasyBevToast(!currentlyActive ? "Item enabled" : "Item disabled", String(item.name || "Menu item"));
}

/* =========================================================
   MANAGER WAITER SLOTS
   ========================================================= */

function renderManagerWaiterSlots(
  waiters,
  sessions = latestManagerSessions
) {

  const container = document.getElementById("managerWaiterSlots");
  const slots = activeWaiterEntries(waiters);

  if (!slots.length) {
    container.innerHTML = `
      <div class="card">
        <p class="muted">No waiter slots yet.</p>
        <button class="warning" onclick="addWaiterSlot()">+ Add Waiter Slot</button>
      </div>
    `;
    return;
  }

  container.innerHTML = slots.map(([slot, waiter]) => {
    const name = String(waiter.name || "").trim();
    const active = waiter.active !== false;
    const displayName = name || `Waiter ${slot}`;
    const activeSessions = managerSessionsForSlot(slot, sessions);
    const guestCount = activeSessions.length;
    const selected = String(managerSelectedSlot) === String(slot);

    const loadLabel = !active
      ? "Inactive"
      : guestCount === 0
        ? "Available"
        : guestCount === 1
          ? "1 active guest"
          : `${guestCount} active guests`;

    const loadClass = !active ? "inactive" : guestCount === 0 ? "available" : "";

    const guestLink = `${window.location.origin}${window.location.pathname}?guest=${slot}`;
    const waiterLink = `${window.location.origin}${window.location.pathname}?waiter=${slot}`;

    return `
      <div class="waiter-slot-card summary ${selected ? "selected" : ""}" onclick="toggleManagerWaiterDetails('${slot}')">
        <div class="heading-row">
          <div>
            <div class="slot-name">${escapeHtml(displayName)}</div>
            <div class="muted">Waiter ${escapeHtml(slot)}</div>
          </div>
          <span class="badge ${active ? "active" : ""}">${active ? "Active" : "Inactive"}</span>
        </div>

        <div class="slot-summary-meta">
          <span class="manager-load ${loadClass}">${escapeHtml(loadLabel)}</span>
          ${guestCount ? `<span class="badge">${guestCount}</span>` : ""}
        </div>

        ${selected ? managerWaiterDetailHtml(slot, waiter, activeSessions, guestLink, waiterLink) : ""}
      </div>
    `;
  }).join("");

  if (managerSelectedSlot) {
    requestAnimationFrame(() => generateManagerQr(managerSelectedSlot));
  }
}

function managerSessionsForSlot(slot, sessions) {
  return Object.entries(sessions || {})
    .filter(([, session]) => session && session.status === "active" && String(session.waiterSlot) === String(slot))
    .sort((a, b) => Number(b[1].lastActivityAt || b[1].createdAt || 0) - Number(a[1].lastActivityAt || a[1].createdAt || 0));
}

function managerWaiterDetailHtml(slot, waiter, activeSessions, guestLink, waiterLink) {
  const name = String(waiter.name || "").trim();
  const active = waiter.active !== false;

  const sessionHtml = activeSessions.length
    ? activeSessions.map(([sessionId, session]) => `
        <div class="manager-row">
          <div>
            <strong>${escapeHtml(guestName(session))}</strong>
            <div class="muted">${escapeHtml(guestLabel(sessionId, session))}</div>
          </div>
          <strong>${money(calculateTotal(session.items || {}))}</strong>
        </div>
      `).join("")
    : `<p class="muted">No active guests for this waiter.</p>`;

  return `
    <div class="slot-detail" onclick="event.stopPropagation()">
      <div class="slot-detail-grid">
        <div>
          <label>
            Assigned staff name
            <input id="managerWaiterName${slot}" type="text" value="${escapeHtml(name)}" placeholder="e.g. Thabo" />
          </label>
          <div class="slot-detail-actions">
            <button class="success" onclick="saveWaiterName('${slot}')">Save Name</button>
            <button class="${active ? "danger" : "blue"}" onclick="toggleWaiterSlot('${slot}', ${active})">${active ? "Deactivate Slot" : "Reactivate Slot"}</button>
            <button class="blue" onclick="location.href='?waiter=${slot}'">Open Waiter Dashboard</button>
          </div>
        </div>

        <div>
          <strong>Active guests</strong>
          ${sessionHtml}
        </div>
      </div>

      <div class="qr-lanyard">
        <div id="managerQr${slot}" class="qr-box" aria-label="QR code for Waiter ${escapeHtml(slot)}"></div>
        <div>
          <div class="eyebrow" style="color:#a8750e">Permanent lanyard QR</div>
          <h3 style="margin:5px 0">Waiter ${escapeHtml(slot)}</h3>
          <p class="muted">Print once and keep the lanyard with this service slot. Staff names can change without replacing the QR.</p>
          <div class="code">${escapeHtml(guestLink)}</div>
          <div class="slot-detail-actions">
            <button class="warning" onclick="printWaiterLanyard('${slot}')">Print Lanyard</button>
            <button class="secondary" onclick="downloadWaiterQr('${slot}')">Download QR</button>
            <button class="secondary" onclick="copyText('${escapeHtml(guestLink)}')">Copy Guest Link</button>
          </div>
          <details style="margin-top:12px">
            <summary class="muted" style="cursor:pointer;font-weight:800">Technical links</summary>
            <p class="muted">Waiter dashboard</p>
            <div class="code">${escapeHtml(waiterLink)}</div>
          </details>
        </div>
      </div>
    </div>
  `;
}

function toggleManagerWaiterDetails(slot) {
  managerSelectedSlot = String(managerSelectedSlot) === String(slot) ? null : String(slot);
  renderManagerWaiterSlots(latestManagerWaiters, latestManagerSessions);
}

async function addWaiterSlot() {
  const snap = await db.ref("waiters").once("value");
  const waiters = snap.val() || {};
  const numericSlots = Object.keys(waiters).map(Number).filter(Number.isFinite);
  const nextSlot = String((numericSlots.length ? Math.max(...numericSlots) : 0) + 1);

  await db.ref(`waiters/${nextSlot}`).set({
    slot: nextSlot,
    name: "",
    active: true,
    createdAt: firebase.database.ServerValue.TIMESTAMP
  });

  managerSelectedSlot = nextSlot;
  showEasyBevToast("Waiter slot created", `Waiter ${nextSlot} is ready for assignment and lanyard printing.`);
}

function generateManagerQr(slot) {
  const target = document.getElementById(`managerQr${slot}`);
  if (!target || typeof QRCode === "undefined") return;

  target.innerHTML = "";
  const url = `${window.location.origin}${window.location.pathname}?guest=${slot}`;
  new QRCode(target, {
    text: url,
    width: 144,
    height: 144,
    correctLevel: QRCode.CorrectLevel.H
  });
}

function qrDataUrlForSlot(slot) {
  const target = document.getElementById(`managerQr${slot}`);
  if (!target) return null;
  const canvas = target.querySelector("canvas");
  if (canvas) return canvas.toDataURL("image/png");
  const img = target.querySelector("img");
  return img ? img.src : null;
}

function downloadWaiterQr(slot) {
  generateManagerQr(slot);
  setTimeout(() => {
    const dataUrl = qrDataUrlForSlot(slot);
    if (!dataUrl) {
      alert("QR code is still loading. Please try again.");
      return;
    }
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `easybev-waiter-${slot}-qr.png`;
    link.click();
  }, 40);
}

function printWaiterLanyard(slot) {
  generateManagerQr(slot);
  setTimeout(() => {
    const dataUrl = qrDataUrlForSlot(slot);
    if (!dataUrl) {
      alert("QR code is still loading. Please try again.");
      return;
    }

    const waiter = latestManagerWaiters[slot] || {};
    const assignedName = String(waiter.name || "").trim();
    const guestLink = `${window.location.origin}${window.location.pathname}?guest=${slot}`;
    const popup = window.open("", "_blank", "width=520,height=760");
    if (!popup) {
      alert("Allow pop-ups to print the lanyard.");
      return;
    }

    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>EasyBev Waiter ${escapeHtml(slot)} Lanyard</title><style>
      *{box-sizing:border-box} body{margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;background:#fff;color:#07131c}
      .sheet{display:flex;justify-content:center}.lanyard{width:90mm;min-height:125mm;border:1px solid #d9dde0;border-radius:8mm;padding:10mm;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center}
      .brand{font-size:28px;font-weight:900;letter-spacing:-1px}.brand span{color:#b57b08}.eyebrow{margin-top:5mm;font-size:11px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:#7c5a11}
      h1{margin:2mm 0 1mm;font-size:24px}.name{font-size:14px;color:#59656d;margin-bottom:6mm}.qr{width:48mm;height:48mm}.scan{margin-top:6mm;font-size:17px;font-weight:900}.tag{margin-top:4mm;font-size:11px;color:#68747b}.url{margin-top:4mm;font-size:8px;word-break:break-all;color:#89939a}
      @media print{body{padding:0}.lanyard{border:0}}
    </style></head><body><div class="sheet"><div class="lanyard">
      <div class="brand">Easy<span>Bev</span></div>
      <div class="eyebrow">Your waiter</div>
      <h1>Waiter ${escapeHtml(slot)}</h1>
      <div class="name">${assignedName ? escapeHtml(assignedName) : "Service slot"}</div>
      <img class="qr" src="${dataUrl}" alt="Waiter ${escapeHtml(slot)} QR code">
      <div class="scan">Scan for service</div>
      <div class="tag">Good Drinks. Better Times.</div>
      <div class="url">${escapeHtml(guestLink)}</div>
    </div></div><script>window.onload=()=>{window.print()}<\/script></body></html>`);
    popup.document.close();
  }, 40);
}


/* =========================================================
   SAVE WAITER NAME
   ========================================================= */

async function saveWaiterName(
  slot
) {

  const input =
    document.getElementById(
      `managerWaiterName${slot}`
    );


  const name =
    input.value.trim();


  await db
    .ref(
      `waiters/${slot}`
    )
    .update({

      slot:
        String(slot),

      name,

      updatedAt:
        firebase.database
          .ServerValue
          .TIMESTAMP

    });


  alert(

    name

      ? `Waiter ${slot} is now assigned to ${name}.`

      : `Waiter ${slot} returned to its placeholder name.`

  );

}


/* =========================================================
   ENABLE / DISABLE WAITER SLOT
   ========================================================= */

async function toggleWaiterSlot(
  slot,
  currentlyActive
) {

  await db
    .ref(
      `waiters/${slot}`
    )
    .update({

      active:
        !currentlyActive,

      updatedAt:
        firebase.database
          .ServerValue
          .TIMESTAMP

    });

}


/* =========================================================
   COPY LINK
   ========================================================= */

async function copyText(
  text
) {

  try {

    await navigator
      .clipboard
      .writeText(
        text
      );


    alert(
      "Link copied."
    );

  }
  catch (error) {

    prompt(
      "Copy this link:",
      text
    );

  }

}



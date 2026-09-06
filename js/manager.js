/* =========================================================
   MANAGEMENT DASHBOARD
   ========================================================= */

function startManagerDashboard() {

  try {

    db.ref("waiters").on("value", snap => {
      latestManagerWaiters = snap.val() || {};
      renderManagerServicePulse();
      renderManagerWaiterSlots(latestManagerWaiters, latestManagerSessions);
      if (!document.getElementById("managerReports")?.classList.contains("hidden")) renderManagerReports();
    });

    db.ref("sessions").on("value", snap => {
      latestManagerSessions = snap.val() || {};
      renderManagerServicePulse();
      renderManagerWaiterSlots(latestManagerWaiters, latestManagerSessions);
      if (!document.getElementById("managerReports")?.classList.contains("hidden")) renderManagerReports();
    });

    db.ref("menuItems").on("value", snap => {
      latestManagerMenuItems = snap.val() || {};
      if (!document.getElementById("managerMenuItems")?.classList.contains("hidden")) renderManagerMenuItems();
    });

    db.ref("staff").on("value", snap => {
      latestManagerStaff = snap.val() || {};
      renderManagerWaiterSlots(latestManagerWaiters, latestManagerSessions);
      if (!document.getElementById("managerStaff")?.classList.contains("hidden")) renderManagerStaff();
      if (!document.getElementById("managerReports")?.classList.contains("hidden")) renderManagerReports();
    });

  }
  catch (error) {
    console.error(error);
    showStartupError(error.message || "Could not load management dashboard.");
  }
}


function renderManagerServicePulse() {
  const panel = document.getElementById("managerServicePulse");
  if (!panel) return;

  const activeSessions = Object.values(latestManagerSessions || {})
    .filter(session => session && session.status === "active");
  const attention = activeSessions.filter(session =>
    session.latestRequest && session.latestRequest.status === "new"
  ).length;
  const billsWaiting = activeSessions.filter(session =>
    sessionBillStatus(session) === "requested"
  ).length;

  panel.innerHTML = `
    <div class="service-pulse-card">
      <span>Active guests</span>
      <strong>${activeSessions.length}</strong>
    </div>
    <div class="service-pulse-card ${attention ? "needs-attention" : ""}">
      <span>Need attention</span>
      <strong>${attention}</strong>
    </div>
    <div class="service-pulse-card ${billsWaiting ? "needs-attention" : ""}">
      <span>Bills waiting</span>
      <strong>${billsWaiting}</strong>
    </div>`;
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
  const recordedValue = rows.reduce((sum, [, s]) => sum + sessionBillTotal(s), 0);

  const durations = rows
    .filter(([, s]) => s.endedAt && s.createdAt)
    .map(([, s]) => Number(s.endedAt) - Number(s.createdAt))
    .filter(ms => ms > 0);
  const avgMinutes = durations.length ? Math.round(durations.reduce((a,b) => a+b, 0) / durations.length / 60000) : null;

  const staffActivity = new Map();
  rows.forEach(([, session]) => {
    const slot = String(session.waiterSlot || "?");
    const staffId = sessionWaiterSnapshotId(session);
    const fallbackWaiter = { ...(latestManagerWaiters[slot] || {}), slot };
    const currentStaff = staffId ? latestManagerStaff[staffId] : null;
    const name = currentStaff
      ? staffDisplayName(currentStaff)
      : sessionWaiterDisplayName(session, fallbackWaiter);
    const key = staffId || `legacy:${name}:${slot}`;
    const activity = staffActivity.get(key) || { name, count: 0, slots: new Set() };
    activity.count += 1;
    activity.slots.add(slot);
    staffActivity.set(key, activity);
  });

  const waiterRows = Array.from(staffActivity.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(activity => {
      const slots = Array.from(activity.slots).sort((a, b) => Number(a) - Number(b));
      const slotLabel = slots.length === 1
        ? ` · Waiter ${escapeHtml(slots[0])}`
        : slots.length > 1
          ? ` · Waiters ${slots.map(escapeHtml).join(", ")}`
          : "";
      return `<div class="manager-row"><span>${escapeHtml(activity.name)}<small class="muted">${slotLabel}</small></span><strong>${activity.count} session${activity.count === 1 ? "" : "s"}</strong></div>`;
    })
    .join("") || `<p class="muted">No service sessions in this period.</p>`;

  const rangeLabel = managerReportRangeDays === 1 ? "Today" : `Last ${managerReportRangeDays} days`;
  panel.innerHTML = `
    <div class="heading-row">
      <div><h3 style="margin-bottom:3px">Service Summary</h3><p class="muted" style="margin:0">${rangeLabel} · Service activity</p></div>
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
      <div class="report-kpi"><span class="muted">Captured value</span><strong>${money(recordedValue)}</strong></div>
    </div>
    <div class="report-table">
      <div class="heading-row"><strong>Staff activity</strong><span class="muted">${closed} ended · Avg duration ${avgMinutes === null ? "—" : `${avgMinutes} min`}</span></div>
      ${waiterRows}
    </div>
  `;
}


/* =========================================================
   MANAGER STAFF ROSTER
   ========================================================= */

function toggleManagerStaff() {
  const panel = document.getElementById("managerStaff");
  if (!panel) return;
  panel.classList.toggle("hidden");
  if (!panel.classList.contains("hidden")) renderManagerStaff();
}

function staffDisplayName(staff) {
  return String((staff && staff.name) || "Unnamed staff member").trim() || "Unnamed staff member";
}

function sortedStaffEntries() {
  return Object.entries(latestManagerStaff || {})
    .filter(([, staff]) => staff)
    .sort((a, b) => staffDisplayName(a[1]).localeCompare(staffDisplayName(b[1])));
}

function renderManagerStaff() {
  const panel = document.getElementById("managerStaff");
  if (!panel) return;

  const rows = sortedStaffEntries();
  const roster = rows.length
    ? rows.map(([id, staff]) => {
        const active = staff.active !== false;
        const slot = Object.entries(latestManagerWaiters || {})
          .find(([, waiter]) => waiter && String(waiter.assignedStaffId || "") === String(id));
        const assignment = slot ? `Waiter ${escapeHtml(slot[0])}` : "Not assigned";
        const mobile = String(staff.mobile || "").trim();
        return `
          <div class="manager-staff-row">
            <div>
              <div class="manager-staff-name">${escapeHtml(staffDisplayName(staff))}</div>
              <div class="muted">${escapeHtml(assignment)}${mobile ? ` · ${escapeHtml(mobile)}` : ""}</div>
            </div>
            <div class="manager-menu-actions">
              <span class="badge ${active ? "active" : ""}">${active ? "Active" : "Inactive"}</span>
              <button class="secondary" onclick="editManagerStaff('${escapeJsString(id)}')">Edit</button>
              <button class="${active ? "danger" : "blue"}" onclick="toggleManagerStaffMember('${escapeJsString(id)}', ${active})">${active ? "Deactivate" : "Reactivate"}</button>
            </div>
          </div>`;
      }).join("")
    : `<p class="muted">No team members yet. Add the first staff member below.</p>`;

  panel.innerHTML = `
    <div class="heading-row">
      <div>
        <h3 style="margin-bottom:3px">Team</h3>
        <p class="muted" style="margin:0">Add staff once, then assign them to permanent waiter slots as shifts change.</p>
      </div>
      <button class="secondary" onclick="toggleManagerStaff()">Close</button>
    </div>

    <div class="manager-staff-add">
      <input id="managerStaffName" type="text" maxlength="80" placeholder="Full name e.g. Thabo Mokoena" />
      <input id="managerStaffMobile" type="tel" maxlength="30" placeholder="Mobile (optional)" />
      <button class="warning" onclick="addManagerStaff()">+ Add Staff</button>
    </div>

    <div class="manager-staff-list">${roster}</div>
  `;
}

async function addManagerStaff() {
  const name = String(document.getElementById("managerStaffName")?.value || "").trim();
  const mobile = String(document.getElementById("managerStaffMobile")?.value || "").trim();

  if (!name) {
    alert("Enter the staff member's name.");
    return;
  }

  const duplicate = Object.values(latestManagerStaff || {}).some(staff =>
    staff && staff.active !== false && String(staff.name || "").trim().toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    alert("An active team member with that name already exists.");
    return;
  }


  const ref = db.ref("staff").push();
  await ref.set({
    staffId: ref.key,
    name,
    mobile,
    firebaseUid: "",
    active: true,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    updatedAt: firebase.database.ServerValue.TIMESTAMP
  });

  showEasyBevToast("Team member added", `${name} is ready for waiter assignment.`);
}

async function editManagerStaff(id) {
  const staff = latestManagerStaff[id];
  if (!staff) return;

  const namePrompt = prompt("Staff name", String(staff.name || ""));
  if (namePrompt === null) return;
  const name = namePrompt.trim();
  if (!name) return;

  const mobilePrompt = prompt("Mobile number (optional)", String(staff.mobile || ""));
  if (mobilePrompt === null) return;
  const mobile = mobilePrompt.trim();


  await db.ref(`staff/${id}`).update({
    name,
    mobile,
    updatedAt: firebase.database.ServerValue.TIMESTAMP
  });

  /* Keep the live slot's display snapshot aligned with renamed staff. */
  const updates = {};
  Object.entries(latestManagerWaiters || {}).forEach(([slot, waiter]) => {
    if (waiter && String(waiter.assignedStaffId || "") === String(id)) {
      updates[`waiters/${slot}/assignedStaffName`] = name;
      updates[`waiters/${slot}/name`] = name;
      updates[`waiters/${slot}/updatedAt`] = firebase.database.ServerValue.TIMESTAMP;
    }
  });
  if (Object.keys(updates).length) await db.ref().update(updates);

  showEasyBevToast("Team member updated", name);
}

async function toggleManagerStaffMember(id, currentlyActive) {
  const staff = latestManagerStaff[id];
  if (!staff) return;

  if (currentlyActive) {
    const assignedSlots = Object.entries(latestManagerWaiters || {})
      .filter(([, waiter]) => waiter && String(waiter.assignedStaffId || "") === String(id));
    if (assignedSlots.length) {
      alert(`Unassign ${staffDisplayName(staff)} from Waiter ${assignedSlots.map(([slot]) => slot).join(", ")} before deactivating this team member.`);
      return;
    }
  }

  await db.ref(`staff/${id}`).update({
    active: !currentlyActive,
    updatedAt: firebase.database.ServerValue.TIMESTAMP
  });
  showEasyBevToast(!currentlyActive ? "Team member reactivated" : "Team member deactivated", staffDisplayName(staff));
}

function staffAssignmentOptions(selectedId = "") {
  const rows = sortedStaffEntries().filter(([, staff]) => staff.active !== false);
  const options = [`<option value="">Unassigned</option>`];
  rows.forEach(([id, staff]) => {
    const assignedElsewhere = Object.entries(latestManagerWaiters || {})
      .find(([, waiter]) => waiter && String(waiter.assignedStaffId || "") === String(id));
    const label = `${staffDisplayName(staff)}${assignedElsewhere ? ` · Waiter ${assignedElsewhere[0]}` : ""}`;
    options.push(`<option value="${escapeHtml(id)}" ${String(selectedId) === String(id) ? "selected" : ""}>${escapeHtml(label)}</option>`);
  });
  return options.join("");
}

async function saveWaiterStaffAssignment(slot) {
  const select = document.getElementById(`managerWaiterStaff${slot}`);
  if (!select) return;

  const staffId = String(select.value || "").trim();
  const current = latestManagerWaiters[slot] || {};
  const currentStaffId = String(current.assignedStaffId || "").trim();
  const currentLegacyName = String(current.name || "").trim();
  const assignmentChanged = staffId !== currentStaffId || (!staffId && !currentStaffId && Boolean(currentLegacyName));

  if (assignmentChanged && managerSessionsForSlot(slot, latestManagerSessions).length) {
    alert(`Waiter ${slot} still has active guest sessions. End those sessions before changing the staff assignment.`);
    if (select) select.value = currentStaffId;
    return;
  }

  if (!staffId) {
    await db.ref(`waiters/${slot}`).update({
      assignedStaffId: null,
      assignedStaffName: null,
      name: "",
      assignedAt: null,
      assignmentUpdatedAt: firebase.database.ServerValue.TIMESTAMP,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    });
    showEasyBevToast("Waiter slot unassigned", `Waiter ${slot} is available for another staff member.`);
    return;
  }

  const staff = latestManagerStaff[staffId];
  if (!staff || staff.active === false) {
    alert("Choose an active staff member.");
    return;
  }

  const existingAssignment = Object.entries(latestManagerWaiters || {})
    .find(([otherSlot, waiter]) => String(otherSlot) !== String(slot) && waiter && String(waiter.assignedStaffId || "") === staffId);
  if (existingAssignment) {
    alert(`${staffDisplayName(staff)} is already assigned to Waiter ${existingAssignment[0]}. Unassign that slot first.`);
    return;
  }

  const timestamp = firebase.database.ServerValue.TIMESTAMP;
  const assignedAt = staffId === currentStaffId && current.assignedAt
    ? current.assignedAt
    : timestamp;

  await db.ref(`waiters/${slot}`).update({
    slot: String(slot),
    assignedStaffId: staffId,
    assignedStaffName: staffDisplayName(staff),
    /* name remains as a compatibility snapshot for older EasyBev logic. */
    name: staffDisplayName(staff),
    assignedAt,
    assignmentUpdatedAt: timestamp,
    updatedAt: timestamp
  });

  showEasyBevToast("Staff assigned", `${staffDisplayName(staff)} → Waiter ${slot}`);
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
  const slots = sortedWaiterEntries(waiters);

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
    const name = String(waiter.assignedStaffName || waiter.name || "").trim();
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

        ${selected ? managerWaiterDetailHtml(slot, waiter, activeSessions, guestLink) : ""}
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

function managerWaiterDetailHtml(slot, waiter, activeSessions, guestLink) {
  const name = String(waiter.assignedStaffName || waiter.name || "").trim();
  const assignedStaffId = String(waiter.assignedStaffId || "").trim();
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
            Assigned staff
            <select id="managerWaiterStaff${slot}">
              ${staffAssignmentOptions(assignedStaffId)}
            </select>
          </label>
          ${!sortedStaffEntries().filter(([, staff]) => staff.active !== false).length ? `<p class="muted">Add a team member under <strong>Team</strong> before assigning this slot.</p>` : ""}
          ${!assignedStaffId && name ? `<div class="status warning">Choose a team profile to complete this assignment.</div>` : ""}
          <div class="slot-detail-actions">
            <button class="success" onclick="saveWaiterStaffAssignment('${slot}')">Save Assignment</button>
            <button class="${active ? "danger" : "blue"}" onclick="toggleWaiterSlot('${slot}', ${active})">${active ? "Deactivate Slot" : "Reactivate Slot"}</button>
            <button class="blue" onclick="location.href='?waiter=${slot}'">Open Waiter View</button>
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
          <div class="eyebrow" style="color:#a8750e">Service QR</div>
          <h3 style="margin:5px 0">Waiter ${escapeHtml(slot)}</h3>
          <p class="muted">Print once for this waiter slot. Staff can change without replacing the QR.</p>
          <div class="code">${escapeHtml(guestLink)}</div>
          <div class="slot-detail-actions">
            <button class="warning" onclick="printWaiterLanyard('${slot}')">Print Lanyard</button>
            <button class="secondary" onclick="downloadWaiterQr('${slot}')">Download QR</button>
            <button class="secondary" onclick="copyText('${escapeHtml(guestLink)}')">Copy Guest Link</button>
          </div>
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
      <div class="name">Permanent service slot</div>
      <img class="qr" src="${dataUrl}" alt="Waiter ${escapeHtml(slot)} QR code">
      <div class="scan">Scan for service</div>
      <div class="tag">Good Drinks. Better Times.</div>
      <div class="url">${escapeHtml(guestLink)}</div>
    </div></div><script>window.onload=()=>{window.print()}<\/script></body></html>`);
    popup.document.close();
  }, 40);
}


/* =========================================================
   ENABLE / DISABLE WAITER SLOT
   ========================================================= */

async function toggleWaiterSlot(
  slot,
  currentlyActive
) {

  if (currentlyActive && managerSessionsForSlot(slot, latestManagerSessions).length) {
    alert(`Waiter ${slot} still has active guest sessions. End those sessions before deactivating the slot.`);
    return;
  }

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



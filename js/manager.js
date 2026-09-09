/* =========================================================
   MANAGEMENT DASHBOARD
   ========================================================= */

let managerActiveSection = "home";
let managerTeamQuery = "";
let managerTeamVisible = 20;
let managerSelectedStaffId = null;
let managerStaffMode = "list";
let managerItemQuery = "";
let managerItemFilter = "all";
let managerItemCategoryFilter = "all";
let managerItemsVisible = 20;
let managerSelectedItemId = null;
let managerItemMode = "list";

function showManagerSection(section = "home") {
  managerActiveSection = ["home", "team", "items", "service", "support"].includes(section) ? section : "home";

  const visibility = {
    managerLanding: managerActiveSection === "home",
    managerStaff: managerActiveSection === "team",
    managerWaiterSlots: managerActiveSection === "team",
    managerMenuItems: managerActiveSection === "items",
    managerReports: managerActiveSection === "service",
    managerSupport: managerActiveSection === "support"
  };

  Object.entries(visibility).forEach(([id, visible]) => {
    document.getElementById(id)?.classList.toggle("hidden", !visible);
  });

  ["Home", "Team", "Items", "Service", "Support"].forEach(name => {
    const key = name.toLowerCase();
    const button = document.getElementById(`managerNav${name}`);
    if (!button) return;
    button.className = key === managerActiveSection ? "warning" : "secondary";
  });

  if (managerActiveSection === "team") {
    renderManagerStaff();
    renderManagerWaiterSlots(latestManagerWaiters, latestManagerSessions);
  } else if (managerActiveSection === "items") {
    renderManagerMenuItems();
  } else if (managerActiveSection === "service") {
    renderManagerReports();
  } else if (managerActiveSection === "support") {
    renderVenueSupportPanel();
  } else {
    renderManagerServicePulse();
  }
}


function startManagerDashboard() {

  try {

    db.ref("waiters").on("value", snap => {
      latestManagerWaiters = snap.val() || {};
      if (managerActiveSection === "home") renderManagerServicePulse();
      if (managerActiveSection === "team") renderManagerWaiterSlots(latestManagerWaiters, latestManagerSessions);
      if (managerActiveSection === "service") renderManagerReports();
    });

    db.ref("sessions").on("value", snap => {
      latestManagerSessions = snap.val() || {};
      if (managerActiveSection === "home") renderManagerServicePulse();
      if (managerActiveSection === "team") renderManagerWaiterSlots(latestManagerWaiters, latestManagerSessions);
      if (managerActiveSection === "service") renderManagerReports();
    });

    db.ref("menuItems").on("value", snap => {
      latestManagerMenuItems = snap.val() || {};
      if (!document.getElementById("managerMenuItems")?.classList.contains("hidden")) renderManagerMenuItems();
    });

    db.ref("menuCategories").on("value", snap => {
      latestManagerMenuCategories = snap.val() || {};
      if (!document.getElementById("managerMenuItems")?.classList.contains("hidden")) renderManagerMenuItems();
    });

    ensureDefaultMenuCategories().catch(error => console.warn("Could not initialise menu categories", error));

    db.ref("staff").on("value", snap => {
      latestManagerStaff = snap.val() || {};
      if (managerActiveSection === "team") {
        renderManagerWaiterSlots(latestManagerWaiters, latestManagerSessions);
        renderManagerStaff();
      }
      if (managerActiveSection === "service") renderManagerReports();
    });

    showManagerSection("home");

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
    sessionLifecycleState(session) === "bill_requested"
  ).length;
  const awaitingSettlement = activeSessions.filter(session =>
    sessionLifecycleState(session) === "awaiting_settlement"
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
      <span>Bill requests</span>
      <strong>${billsWaiting}</strong>
    </div>
    <div class="service-pulse-card ${awaitingSettlement ? "needs-attention" : ""}">
      <span>Settlement</span>
      <strong>${awaitingSettlement}</strong>
    </div>`;
}


let managerReportRangeDays = 1;

function toggleManagerReports() {
  showManagerSection(managerActiveSection === "service" ? "home" : "service");
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
      <button class="secondary" onclick="showManagerSection('home')">Close</button>
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
  showManagerSection(managerActiveSection === "team" ? "home" : "team");
}

function staffDisplayName(staff) {
  return String((staff && staff.name) || "Unnamed staff member").trim() || "Unnamed staff member";
}

function sortedStaffEntries() {
  return Object.entries(latestManagerStaff || {})
    .filter(([, staff]) => staff)
    .sort((a, b) => staffDisplayName(a[1]).localeCompare(staffDisplayName(b[1])));
}

function managerTeamListRows() {
  const query = managerTeamQuery.trim().toLowerCase();
  return sortedStaffEntries().filter(([, staff]) => {
    if (!query) return true;
    return [staffDisplayName(staff), String(staff.mobile || "")]
      .some(value => value.toLowerCase().includes(query));
  });
}

function setManagerTeamQuery(value) {
  managerTeamQuery = String(value || "");
  managerTeamVisible = 20;
  renderManagerStaff();
  requestAnimationFrame(() => {
    const input = document.getElementById("managerTeamSearch");
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  });
}

function openManagerStaff(id) {
  managerSelectedStaffId = id;
  managerStaffMode = "detail";
  renderManagerStaff();
}

function startAddManagerStaff() {
  managerSelectedStaffId = null;
  managerStaffMode = "add";
  renderManagerStaff();
}

function closeManagerStaffDetail() {
  managerSelectedStaffId = null;
  managerStaffMode = "list";
  renderManagerStaff();
}

function loadMoreManagerTeam() {
  managerTeamVisible += 20;
  renderManagerStaff();
}

function managerStaffDetailHtml() {
  const adding = managerStaffMode === "add";
  const staff = adding ? {name:"", mobile:"", active:true} : latestManagerStaff[managerSelectedStaffId];
  if (!staff) { managerStaffMode = "list"; return ""; }
  const active = staff.active !== false;
  const slot = adding ? null : Object.entries(latestManagerWaiters || {})
    .find(([, waiter]) => waiter && String(waiter.assignedStaffId || "") === String(managerSelectedStaffId));
  return `
    <div class="manager-detail-surface">
      <div class="heading-row">
        <div><div class="eyebrow">${adding ? "New team member" : "Team member"}</div><h3>${adding ? "Add Team Member" : escapeHtml(staffDisplayName(staff))}</h3></div>
        <button class="secondary" onclick="closeManagerStaffDetail()">← Back to Team</button>
      </div>
      ${!adding ? `<div class="detail-summary-line"><span class="badge ${active ? "active" : ""}">${active ? "Active" : "Inactive"}</span><span class="muted">${slot ? `Assigned to Waiter ${escapeHtml(slot[0])}` : "Not assigned to a waiter slot"}</span></div>` : ""}
      <div class="manager-detail-form">
        <label>Full name<input id="managerStaffDetailName" type="text" maxlength="80" value="${escapeHtml(String(staff.name || ""))}" placeholder="Full name" /></label>
        <label>Mobile<input id="managerStaffDetailMobile" type="tel" maxlength="30" value="${escapeHtml(String(staff.mobile || ""))}" placeholder="Mobile (optional)" /></label>
      </div>
      <div class="manager-detail-actions">
        <button class="success" onclick="${adding ? "saveNewManagerStaff()" : `saveManagerStaff('${escapeJsString(managerSelectedStaffId)}')`}">${adding ? "Add Team Member" : "Save Changes"}</button>
        ${!adding ? `<button class="${active ? "danger" : "blue"}" onclick="toggleManagerStaffMember('${escapeJsString(managerSelectedStaffId)}', ${active})">${active ? "Deactivate" : "Reactivate"}</button>` : ""}
      </div>
    </div>`;
}

function renderManagerStaff() {
  const panel = document.getElementById("managerStaff");
  if (!panel) return;

  if (managerStaffMode !== "list") {
    panel.innerHTML = managerStaffDetailHtml();
    return;
  }

  const rows = managerTeamListRows();
  const shown = rows.slice(0, managerTeamVisible);
  const roster = shown.length ? shown.map(([id, staff]) => {
    const active = staff.active !== false;
    const slot = Object.entries(latestManagerWaiters || {}).find(([, waiter]) => waiter && String(waiter.assignedStaffId || "") === String(id));
    const assignment = slot ? `Waiter ${slot[0]}` : "Not assigned";
    const mobile = String(staff.mobile || "").trim();
    return `<button type="button" class="manager-compact-row" onclick="openManagerStaff('${escapeJsString(id)}')">
      <span class="compact-row-main"><strong>${escapeHtml(staffDisplayName(staff))}</strong><small>${escapeHtml(assignment)}${mobile ? ` · ${escapeHtml(mobile)}` : ""}</small></span>
      <span class="compact-row-end"><span class="badge ${active ? "active" : ""}">${active ? "Active" : "Inactive"}</span><span aria-hidden="true">›</span></span>
    </button>`;
  }).join("") : `<p class="muted">${managerTeamQuery ? "No team members match your search." : "No team members yet."}</p>`;

  panel.innerHTML = `
    <div class="heading-row">
      <div><h3 style="margin-bottom:3px">Team</h3><p class="muted" style="margin:0">${rows.length} team member${rows.length === 1 ? "" : "s"}. Select a person to review or edit.</p></div>
      <div class="manager-menu-actions"><button class="warning" onclick="startAddManagerStaff()">+ Team Member</button><button class="secondary" onclick="addWaiterSlot()">+ Waiter Slot</button></div>
    </div>
    <div class="manager-list-toolbar"><input id="managerTeamSearch" type="search" value="${escapeHtml(managerTeamQuery)}" placeholder="Search team" oninput="setManagerTeamQuery(this.value)" /></div>
    <div class="manager-compact-list">${roster}</div>
    ${rows.length > shown.length ? `<button class="secondary manager-load-more" onclick="loadMoreManagerTeam()">Load more · ${rows.length - shown.length} remaining</button>` : ""}
  `;
}

async function saveNewManagerStaff() {
  const name = String(document.getElementById("managerStaffDetailName")?.value || "").trim();
  const mobile = String(document.getElementById("managerStaffDetailMobile")?.value || "").trim();
  if (!name) { alert("Enter the staff member's name."); return; }
  const duplicate = Object.values(latestManagerStaff || {}).some(staff => staff && staff.active !== false && String(staff.name || "").trim().toLowerCase() === name.toLowerCase());
  if (duplicate) { alert("An active team member with that name already exists."); return; }
  const ref = db.ref("staff").push();
  await ref.set({staffId:ref.key,name,mobile,firebaseUid:"",active:true,createdAt:firebase.database.ServerValue.TIMESTAMP,updatedAt:firebase.database.ServerValue.TIMESTAMP});
  managerStaffMode = "list";
  renderManagerStaff();
  showEasyBevToast("Team member added", `${name} is ready for waiter assignment.`);
}

async function saveManagerStaff(id) {
  const staff = latestManagerStaff[id];
  if (!staff) return;
  const name = String(document.getElementById("managerStaffDetailName")?.value || "").trim();
  const mobile = String(document.getElementById("managerStaffDetailMobile")?.value || "").trim();
  if (!name) { alert("Enter the staff member's name."); return; }
  await db.ref(`staff/${id}`).update({name,mobile,updatedAt:firebase.database.ServerValue.TIMESTAMP});
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
  renderManagerStaff();
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
  showManagerSection(managerActiveSection === "items" ? "home" : "items");
}

function sortedManagerMenuCategories(includeInactive = true) {
  return Object.entries(latestManagerMenuCategories || {})
    .filter(([, category]) => category)
    .filter(([, category]) => includeInactive || category.active !== false)
    .sort((a, b) =>
      (Number(a[1]?.sortOrder || 0) - Number(b[1]?.sortOrder || 0)) ||
      String(a[1]?.name || "").localeCompare(String(b[1]?.name || ""))
    );
}

function managerCategoryName(categoryId) {
  const category = latestManagerMenuCategories[String(categoryId || "")];
  if (category && category.name) return String(category.name);
  const fallback = DEFAULT_MENU_CATEGORIES.find(item => item.id === String(categoryId || ""));
  return fallback ? fallback.name : "Other";
}

function managerResolvedItemCategoryId(item) {
  const categoryId = String((item && item.categoryId) || "other");
  return latestManagerMenuCategories[categoryId] ? categoryId : "other";
}

function managerDefaultCategoryId() {
  const active = sortedManagerMenuCategories(false);
  return active.length ? active[0][0] : "other";
}

async function ensureDefaultMenuCategories() {
  const snap = await db.ref("menuCategories").once("value");
  const existing = snap.val() || {};
  if (Object.keys(existing).length) return;

  const updates = {};
  DEFAULT_MENU_CATEGORIES.forEach(category => {
    updates[`menuCategories/${category.id}`] = {
      name: category.name,
      sortOrder: category.sortOrder,
      active: true,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    };
  });
  await db.ref().update(updates);
}

function managerFilteredItemRows() {
  const query = managerItemQuery.trim().toLowerCase();
  return Object.entries(latestManagerMenuItems || {})
    .filter(([, item]) => item)
    .filter(([, item]) => {
      const active = item.active !== false;
      if (managerItemFilter === "active" && !active) return false;
      if (managerItemFilter === "inactive" && active) return false;
      if (managerItemCategoryFilter !== "all" && managerResolvedItemCategoryId(item) !== managerItemCategoryFilter) return false;
      return !query || String(item.name || "").toLowerCase().includes(query);
    })
    .sort((a,b) => {
      const aCat = latestManagerMenuCategories[managerResolvedItemCategoryId(a[1])] || {};
      const bCat = latestManagerMenuCategories[managerResolvedItemCategoryId(b[1])] || {};
      return (Number(aCat.sortOrder || 999) - Number(bCat.sortOrder || 999)) ||
        String(a[1]?.name || "").localeCompare(String(b[1]?.name || ""));
    });
}

function setManagerItemQuery(value) {
  managerItemQuery = String(value || "");
  managerItemsVisible = 20;
  renderManagerMenuItems();
  requestAnimationFrame(() => {
    const input = document.getElementById("managerItemSearch");
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  });
}

function setManagerItemFilter(value) {
  managerItemFilter = ["all","active","inactive"].includes(value) ? value : "all";
  managerItemsVisible = 20;
  renderManagerMenuItems();
}

function setManagerItemCategoryFilter(value) {
  managerItemCategoryFilter = value === "all" || latestManagerMenuCategories[value] ? value : "all";
  managerItemsVisible = 20;
  renderManagerMenuItems();
}

function openManagerMenuItem(id) { managerSelectedItemId = id; managerItemMode = "detail"; renderManagerMenuItems(); }
function startAddManagerMenuItem() { managerSelectedItemId = null; managerItemMode = "add"; renderManagerMenuItems(); }
function closeManagerItemDetail() { managerSelectedItemId = null; managerItemMode = "list"; renderManagerMenuItems(); }
function loadMoreManagerItems() { managerItemsVisible += 20; renderManagerMenuItems(); }

function managerCategoryOptions(selectedId) {
  const rows = sortedManagerMenuCategories(true);
  if (!rows.length) return `<option value="other">Other</option>`;
  return rows.map(([id, category]) => {
    const inactive = category.active === false;
    return `<option value="${escapeHtml(id)}" ${String(id) === String(selectedId) ? "selected" : ""}>${escapeHtml(String(category.name || "Category"))}${inactive ? " (inactive)" : ""}</option>`;
  }).join("");
}

function managerItemDetailHtml() {
  const adding = managerItemMode === "add";
  const item = adding ? {name:"",price:"",active:true,categoryId:managerDefaultCategoryId()} : latestManagerMenuItems[managerSelectedItemId];
  if (!item) { managerItemMode = "list"; return ""; }
  const active = item.active !== false;
  const categoryId = managerResolvedItemCategoryId(item);
  return `<div class="manager-detail-surface">
    <div class="heading-row"><div><div class="eyebrow">${adding ? "New venue item" : "Venue item"}</div><h3>${adding ? "Add Item" : escapeHtml(String(item.name || "Unnamed item"))}</h3></div><button class="secondary" onclick="closeManagerItemDetail()">← Back to Items</button></div>
    ${!adding ? `<div class="detail-summary-line"><span><span class="badge ${active ? "active" : ""}">${active ? "Active" : "Inactive"}</span> <span class="badge">${escapeHtml(managerCategoryName(categoryId))}</span></span><strong>${money(Number(item.price || 0))}</strong></div>` : ""}
    <div class="manager-detail-form menu-item-detail-form">
      <label>Item name<input id="managerItemDetailName" type="text" maxlength="100" value="${escapeHtml(String(item.name || ""))}" placeholder="Item name" /></label>
      <label>Category<select id="managerItemDetailCategory">${managerCategoryOptions(categoryId)}</select></label>
      <label>Price<input id="managerItemDetailPrice" type="number" min="0" step="0.01" value="${adding ? "" : Number(item.price || 0).toFixed(2)}" placeholder="Price" /></label>
    </div>
    <p class="muted manager-item-speed-note">The category controls where this item appears on the waiter digital pad.</p>
    <div class="manager-detail-actions"><button class="success" onclick="${adding ? "saveNewManagerMenuItem()" : `saveManagerMenuItem('${escapeJsString(managerSelectedItemId)}')`}">${adding ? "Add Item" : "Save Changes"}</button>${!adding ? `<button class="${active ? "danger" : "blue"}" onclick="toggleManagerMenuItem('${escapeJsString(managerSelectedItemId)}', ${active})">${active ? "Disable" : "Enable"}</button>` : ""}</div>
  </div>`;
}

function renderManagerCategoryManager() {
  const categories = sortedManagerMenuCategories(true);
  const movableIds = categories.filter(([categoryId]) => categoryId !== "other").map(([categoryId]) => categoryId);
  const rows = categories.map(([id, category]) => {
    const active = category.active !== false;
    const itemCount = Object.values(latestManagerMenuItems || {}).filter(item => managerResolvedItemCategoryId(item) === id).length;
    const movableIndex = movableIds.indexOf(id);
    const upDisabled = id === "other" || movableIndex <= 0;
    const downDisabled = id === "other" || movableIndex < 0 || movableIndex >= movableIds.length - 1;
    return `<div class="manager-category-row">
      <input id="managerCategoryName_${escapeHtml(id)}" type="text" maxlength="40" value="${escapeHtml(String(category.name || ""))}" aria-label="Category name" />
      <span class="muted">${itemCount} item${itemCount === 1 ? "" : "s"}</span>
      <div class="manager-category-actions">
        <button class="secondary" onclick="moveManagerMenuCategory('${escapeJsString(id)}', -1)" ${upDisabled ? "disabled" : ""} aria-label="Move category up">↑</button>
        <button class="secondary" onclick="moveManagerMenuCategory('${escapeJsString(id)}', 1)" ${downDisabled ? "disabled" : ""} aria-label="Move category down">↓</button>
        <button class="secondary" onclick="saveManagerMenuCategory('${escapeJsString(id)}')">Save</button>
        <button class="${active ? "danger" : "blue"}" onclick="toggleManagerMenuCategory('${escapeJsString(id)}', ${active})">${active ? "Hide" : "Show"}</button>
      </div>
    </div>`;
  }).join("");

  return `<details class="manager-category-panel">
    <summary>Pad Categories <span class="muted">${categories.length} configured</span></summary>
    <p class="muted">These tabs organise the waiter pad. Hide or reorder categories without deleting menu items.</p>
    <div class="manager-category-add"><input id="managerNewCategoryName" type="text" maxlength="40" placeholder="New category name" /><button class="warning" onclick="addManagerMenuCategory()">+ Add Category</button></div>
    <div class="manager-category-list">${rows || '<p class="muted">No categories yet.</p>'}</div>
  </details>`;
}

function renderManagerMenuItems() {
  const panel = document.getElementById("managerMenuItems");
  if (!panel) return;
  if (managerItemMode !== "list") { panel.innerHTML = managerItemDetailHtml(); return; }

  const rows = managerFilteredItemRows();
  const shown = rows.slice(0, managerItemsVisible);
  const itemRows = shown.length ? shown.map(([id,item]) => {
    const active = item.active !== false;
    const categoryName = managerCategoryName(managerResolvedItemCategoryId(item));
    return `<button type="button" class="manager-compact-row" onclick="openManagerMenuItem('${escapeJsString(id)}')"><span class="compact-row-main"><strong>${escapeHtml(String(item.name || "Unnamed item"))}</strong><small>${escapeHtml(categoryName)} · ${money(Number(item.price || 0))}</small></span><span class="compact-row-end"><span class="badge ${active ? "active" : ""}">${active ? "Active" : "Inactive"}</span><span aria-hidden="true">›</span></span></button>`;
  }).join("") : `<p class="muted">No items match this view.</p>`;

  const categoryFilters = sortedManagerMenuCategories(false).map(([id, category]) =>
    `<button class="${managerItemCategoryFilter === id ? "warning" : "secondary"}" onclick="setManagerItemCategoryFilter('${escapeJsString(id)}')">${escapeHtml(String(category.name || "Category"))}</button>`
  ).join("");

  panel.innerHTML = `<div class="heading-row"><div><h3 style="margin-bottom:3px">Items</h3><p class="muted" style="margin:0">Categorise once here; waiters get compact rush-hour tabs automatically.</p></div><button class="warning" onclick="startAddManagerMenuItem()">+ Add Item</button></div>
    ${renderManagerCategoryManager()}
    <div class="manager-list-toolbar"><input id="managerItemSearch" type="search" value="${escapeHtml(managerItemQuery)}" placeholder="Search items" oninput="setManagerItemQuery(this.value)" /><div class="compact-filters"><button class="${managerItemFilter === "all" ? "warning" : "secondary"}" onclick="setManagerItemFilter('all')">All</button><button class="${managerItemFilter === "active" ? "warning" : "secondary"}" onclick="setManagerItemFilter('active')">Active</button><button class="${managerItemFilter === "inactive" ? "warning" : "secondary"}" onclick="setManagerItemFilter('inactive')">Inactive</button></div></div>
    <div class="manager-category-filters"><button class="${managerItemCategoryFilter === "all" ? "warning" : "secondary"}" onclick="setManagerItemCategoryFilter('all')">All Categories</button>${categoryFilters}</div>
    <div class="manager-compact-list">${itemRows}</div>${rows.length > shown.length ? `<button class="secondary manager-load-more" onclick="loadMoreManagerItems()">Load more · ${rows.length - shown.length} remaining</button>` : ""}`;
}

async function saveNewManagerMenuItem() {
  const name = String(document.getElementById("managerItemDetailName")?.value || "").trim();
  const price = Number(document.getElementById("managerItemDetailPrice")?.value);
  const categoryId = String(document.getElementById("managerItemDetailCategory")?.value || managerDefaultCategoryId());
  if (!name || !Number.isFinite(price) || price < 0) { alert("Enter an item name and valid price."); return; }
  if (!latestManagerMenuCategories[categoryId]) { alert("Choose a valid category."); return; }
  const duplicate = Object.values(latestManagerMenuItems || {}).some(item => String(item?.name || "").trim().toLowerCase() === name.toLowerCase());
  if (duplicate) { alert("That item already exists. Open the existing item instead."); return; }
  const ref = db.ref("menuItems").push();
  await ref.set({name,price,categoryId,active:true,createdAt:firebase.database.ServerValue.TIMESTAMP,updatedAt:firebase.database.ServerValue.TIMESTAMP});
  managerItemMode = "list";
  renderManagerMenuItems();
  showEasyBevToast("Menu item added", `${name} · ${managerCategoryName(categoryId)} · ${money(price)}`);
}

async function saveManagerMenuItem(id) {
  const item = latestManagerMenuItems[id];
  if (!item) return;
  const name = String(document.getElementById("managerItemDetailName")?.value || "").trim();
  const price = Number(document.getElementById("managerItemDetailPrice")?.value);
  const categoryId = String(document.getElementById("managerItemDetailCategory")?.value || "other");
  if (!name || !Number.isFinite(price) || price < 0) { alert("Enter an item name and valid price."); return; }
  if (!latestManagerMenuCategories[categoryId]) { alert("Choose a valid category."); return; }
  const duplicate = Object.entries(latestManagerMenuItems || {}).some(([otherId, otherItem]) =>
    String(otherId) !== String(id) &&
    String(otherItem && otherItem.name || "").trim().toLowerCase() === name.toLowerCase()
  );
  if (duplicate) { alert("Another item already uses that name. Keep waiter-pad item names unique."); return; }
  await db.ref(`menuItems/${id}`).update({name,price,categoryId,updatedAt:firebase.database.ServerValue.TIMESTAMP});
  showEasyBevToast("Menu item updated", `${name} · ${managerCategoryName(categoryId)} · ${money(price)}`);
  renderManagerMenuItems();
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

async function addManagerMenuCategory() {
  const input = document.getElementById("managerNewCategoryName");
  const name = String(input?.value || "").trim();
  if (!name) { alert("Enter a category name."); return; }
  const duplicate = Object.values(latestManagerMenuCategories || {}).some(category => String(category?.name || "").trim().toLowerCase() === name.toLowerCase());
  if (duplicate) { alert("That category already exists."); return; }
  const categories = sortedManagerMenuCategories(true);
  const nonOther = categories.filter(([id]) => id !== "other");
  const maxSort = nonOther.reduce((max, [, category]) => Math.max(max, Number(category.sortOrder || 0)), 0);
  const nextSort = maxSort + 10;
  const ref = db.ref("menuCategories").push();
  const updates = {};
  updates[`menuCategories/${ref.key}`] = {name,sortOrder:nextSort,active:true,createdAt:firebase.database.ServerValue.TIMESTAMP,updatedAt:firebase.database.ServerValue.TIMESTAMP};
  const other = latestManagerMenuCategories.other;
  if (other && Number(other.sortOrder || 0) <= nextSort) {
    updates["menuCategories/other/sortOrder"] = nextSort + 100;
    updates["menuCategories/other/updatedAt"] = firebase.database.ServerValue.TIMESTAMP;
  }
  await db.ref().update(updates);
  if (input) input.value = "";
  showEasyBevToast("Category added", name);
}

async function saveManagerMenuCategory(id) {
  const category = latestManagerMenuCategories[id];
  if (!category) return;
  const input = document.getElementById(`managerCategoryName_${id}`);
  const name = String(input?.value || "").trim();
  if (!name) { alert("Category name cannot be empty."); return; }
  const duplicate = Object.entries(latestManagerMenuCategories || {}).some(([otherId, other]) => otherId !== id && String(other?.name || "").trim().toLowerCase() === name.toLowerCase());
  if (duplicate) { alert("That category name is already in use."); return; }
  await db.ref(`menuCategories/${id}`).update({name,updatedAt:firebase.database.ServerValue.TIMESTAMP});
  showEasyBevToast("Category updated", name);
}

async function toggleManagerMenuCategory(id, currentlyActive) {
  const category = latestManagerMenuCategories[id];
  if (!category) return;
  if (id === "other" && currentlyActive) {
    alert("Keep Other visible so uncategorised or legacy items always remain accessible.");
    return;
  }
  await db.ref(`menuCategories/${id}`).update({active:!currentlyActive,updatedAt:firebase.database.ServerValue.TIMESTAMP});
  showEasyBevToast(!currentlyActive ? "Category shown" : "Category hidden", String(category.name || "Category"));
}

async function moveManagerMenuCategory(id, direction) {
  if (id === "other") return;
  const categories = sortedManagerMenuCategories(true).filter(([categoryId]) => categoryId !== "other");
  const index = categories.findIndex(([categoryId]) => categoryId === id);
  const targetIndex = index + Number(direction || 0);
  if (index < 0 || targetIndex < 0 || targetIndex >= categories.length) return;
  const [currentId, current] = categories[index];
  const [targetId, target] = categories[targetIndex];
  const updates = {};
  updates[`menuCategories/${currentId}/sortOrder`] = Number(target.sortOrder || targetIndex * 10);
  updates[`menuCategories/${targetId}/sortOrder`] = Number(current.sortOrder || index * 10);
  updates[`menuCategories/${currentId}/updatedAt`] = firebase.database.ServerValue.TIMESTAMP;
  updates[`menuCategories/${targetId}/updatedAt`] = firebase.database.ServerValue.TIMESTAMP;
  await db.ref().update(updates);
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

function managerClosedSessionsForSlot(slot, sessions) {
  return Object.entries(sessions || {})
    .filter(([, session]) => session && session.status === "closed" && String(session.waiterSlot) === String(slot))
    .sort((a, b) => Number(b[1].closedAt || 0) - Number(a[1].closedAt || 0))
    .slice(0, 4);
}

function managerWaiterDetailHtml(slot, waiter, activeSessions, guestLink) {
  const name = String(waiter.assignedStaffName || waiter.name || "").trim();
  const assignedStaffId = String(waiter.assignedStaffId || "").trim();
  const active = waiter.active !== false;
  const recentClosed = managerClosedSessionsForSlot(slot, latestManagerSessions);

  const sessionHtml = activeSessions.length
    ? activeSessions.map(([sessionId, session]) => `
        <div class="manager-row manager-session-row">
          <div>
            <strong>${escapeHtml(guestName(session))}</strong>
            <div class="muted">${escapeHtml(guestLabel(sessionId, session))}</div>
            <span class="badge ${sessionLifecycleBadgeClass(session)}">${escapeHtml(sessionLifecycleLabel(session))}</span>
          </div>
          <div class="manager-session-actions">
            <strong>${money(calculateTotal(session.items || {}))}</strong>
            <button class="secondary" onclick="openWaiterHandoverModal('${sessionId}')">Transfer</button>
          </div>
        </div>
      `).join("")
    : `<p class="muted">No active guests for this waiter.</p>`;

  const closedHtml = recentClosed.length
    ? `<details class="manager-recent-sessions">
        <summary>Recently closed (${recentClosed.length})</summary>
        ${recentClosed.map(([sessionId, session]) => `
          <div class="manager-row manager-session-row">
            <div>
              <strong>${escapeHtml(guestName(session))}</strong>
              <div class="muted">${escapeHtml(guestLabel(sessionId, session))}</div>
            </div>
            <div class="manager-session-actions">
              <strong>${money(sessionBillTotal(session))}</strong>
              <button class="secondary" onclick="reopenClosedSession('${sessionId}')">Reopen</button>
            </div>
          </div>`).join("")}
      </details>`
    : "";

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
          ${closedHtml}
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



import { escapeHtml, formatDateTime } from "../core/utils.js";

const CONTROL_LABELS = {
  maintenanceMode: ["Maintenance mode", "Pause normal actor access while GoodKota resolves a platform incident."],
  orderingEnabled: ["Customer ordering", "Allow customers to place new orders."],
  paymentsEnabled: ["Payments", "Allow payment initiation and confirmation."],
  deliveryEnabled: ["Delivery operations", "Allow Home Delivery and delivery task operations."],
  merchantOnboardingEnabled: ["Merchant onboarding", "Allow GoodKota Admin to create new merchants."]
};

export function renderOwnerView(app) {
  const { state } = app.store;
  const actor = app.platformActor("owner");
  if (!actor) {
    app.root.innerHTML = '<section class="section"><div class="notice danger"><strong>Owner authority is unavailable.</strong><div class="small" style="margin-top:4px">GoodKota requires at least one active Owner.</div></div></section>';
    return;
  }
  const section = app.ownerSection || "control";
  const owners = state.platformStaff.filter(p => p.role === "owner" && p.active !== false);
  const admins = state.platformStaff.filter(p => p.role === "admin" && p.active !== false);
  const openCases = state.supportCases.filter(c => c.status !== "resolved");
  const activeDeliveries = state.deliveryTasks.filter(t => !["delivered", "cancelled"].includes(t.status));
  const settlementAttention = state.merchants.filter(m => m.settlement?.status !== "verified");
  const qualityAttention = state.merchants.filter(m => ["watch", "intervention", "probation", "suspended"].includes(m.qualityWorkflow?.status));

  app.root.innerHTML = `
    <section class="governance-hero owner-hero">
      <div>
        <span class="eyebrow">GoodKota Owner</span>
        <h2>Company Control</h2>
        <p>Govern platform authority, protected company controls and the integrity of GoodKota as an operating business.</p>
      </div>
      <span class="status-pulse ${state.platform.controls.maintenanceMode ? "danger" : "ok"}">${state.platform.controls.maintenanceMode ? "Maintenance" : "Operational"}</span>
    </section>

    <div class="metric-strip governance-metrics">
      <div class="stat"><span class="muted">Active Owners</span><b>${owners.length}</b></div>
      <div class="stat"><span class="muted">Active Admins</span><b>${admins.length}</b></div>
      <div class="stat"><span class="muted">Open support</span><b>${openCases.length}</b></div>
      <div class="stat"><span class="muted">Active deliveries</span><b>${activeDeliveries.length}</b></div>
    </div>

    <nav class="section-tabs" aria-label="GoodKota Owner sections">
      ${ownerTab("control", "Control", section)}
      ${ownerTab("authority", "Authority", section)}
      ${ownerTab("integrity", "Integrity", section)}
      ${ownerTab("audit", "Audit", section)}
    </nav>

    ${section === "authority" ? authoritySection(state) : ""}
    ${section === "integrity" ? integritySection(state, { openCases, settlementAttention, qualityAttention, activeDeliveries }) : ""}
    ${section === "audit" ? auditSection(state) : ""}
    ${section === "control" ? controlSection(state) : ""}
  `;

  bindOwnerTabs(app);
  bindOwnerActions(app, actor);
}

function ownerTab(value, label, current) {
  return `<button class="section-tab ${value === current ? "active" : ""}" data-owner-section="${value}">${label}</button>`;
}

function bindOwnerTabs(app) {
  app.root.querySelectorAll("[data-owner-section]").forEach(button => button.addEventListener("click", () => {
    app.ownerSection = button.dataset.ownerSection;
    app.render();
    window.scrollTo(0, 0);
  }));
}

function controlSection(state) {
  return `
    <section class="section grid grid-2 owner-control-grid">
      <div class="card">
        <span class="eyebrow">Protected controls</span>
        <h3>Company-wide service authority</h3>
        <p class="muted">These controls affect multiple stakeholder groups. Every change requires an Owner reason and is retained in the privileged audit.</p>
        <div class="control-list">${Object.entries(CONTROL_LABELS).map(([key, [label, detail]]) => {
          const enabled = Boolean(state.platform.controls[key]);
          const visuallyOn = key === "maintenanceMode" ? enabled : enabled;
          return `<div class="control-row"><div><strong>${label}</strong><small>${detail}</small></div><button class="control-switch ${visuallyOn ? "on" : ""} ${key === "maintenanceMode" && enabled ? "danger" : ""}" data-platform-control="${key}" data-next-value="${!enabled}" aria-pressed="${enabled}"><span></span>${enabled ? "On" : "Off"}</button></div>`;
        }).join("")}</div>
      </div>
      <div class="card">
        <span class="eyebrow">Platform foundation</span>
        <h3>Money and fulfilment</h3>
        <div class="summary-line"><span>Payment provider</span><strong>${escapeHtml(state.platform.paymentGateway?.provider || "Not configured")}</strong></div>
        <div class="summary-line"><span>Settlement model</span><strong>${escapeHtml(state.platform.paymentGateway?.settlementModel || "—")}</strong></div>
        <div class="summary-line"><span>Delivery model</span><strong>${escapeHtml(state.platform.delivery?.operatingModel || "—")}</strong></div>
        <div class="summary-line"><span>Proof of delivery</span><strong>${escapeHtml(state.platform.delivery?.proofOfDelivery || "—")}</strong></div>
        <div class="notice info" style="margin-top:12px"><strong>Owner principle</strong><div class="small" style="margin-top:4px">Owner authority changes who may control GoodKota. It is deliberately separate from routine merchant and delivery operations.</div></div>
      </div>
    </section>`;
}

function authoritySection(state) {
  return `
    <section class="section-head"><div><h2>Platform Authority</h2><p>Only Owners can create, remove or change GoodKota platform authority.</p></div><button class="btn primary" id="addPlatformStaff">Add platform staff</button></section>
    <section class="section"><div class="table-wrap">${staffTable(state.platformStaff)}</div></section>
    <div class="notice"><strong>Integrity rule:</strong> GoodKota can never be left without at least one active Owner.</div>`;
}

function integritySection(state, data) {
  const commercialAttention = state.merchants.filter(m => ["review", "overdue", "suspended"].includes(m.commercial?.status));
  return `
    <section class="section-head"><div><h2>Platform Integrity</h2><p>Signals that can affect trust, money movement or operational continuity.</p></div></section>
    <div class="grid grid-2">
      ${integrityCard("Settlement verification", data.settlementAttention.length, data.settlementAttention.map(m => m.name), "Merchant money configuration")}
      ${integrityCard("Quality intervention", data.qualityAttention.length, data.qualityAttention.map(m => m.name), "GoodKota Standard")}
      ${integrityCard("Commercial exceptions", commercialAttention.length, commercialAttention.map(m => m.name), "Subscription / commercial status")}
      ${integrityCard("Open support cases", data.openCases.length, data.openCases.map(c => c.subject), "Unresolved stakeholder requests")}
    </div>
    <section class="section card">
      <div class="section-head"><div><h3>Current operating exposure</h3><p>Snapshot only — operational teams retain their own workflows.</p></div></div>
      <div class="metric-strip"><div class="stat"><span class="muted">Active merchants</span><b>${state.merchants.filter(m => m.enabled).length}</b></div><div class="stat"><span class="muted">Paid orders</span><b>${state.orders.filter(o => o.paymentStatus === "paid").length}</b></div><div class="stat"><span class="muted">Live deliveries</span><b>${data.activeDeliveries.length}</b></div></div>
    </section>`;
}

function integrityCard(title, count, items, detail) {
  return `<div class="card integrity-card"><div class="integrity-count ${count ? "attention" : ""}">${count}</div><div><strong>${title}</strong><p class="muted small">${detail}</p>${items.length ? `<div class="integrity-items">${items.slice(0, 4).map(item => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : '<span class="badge ok">Clear</span>'}</div></div>`;
}

function auditSection(state) {
  const events = state.auditTrail.slice(0, 120);
  return `<section class="section-head"><div><h2>Privileged Audit</h2><p>Full company-level history, including authority and protected controls.</p></div></section><section class="section"><div class="table-wrap">${auditTable(events)}</div></section>`;
}

function staffTable(staff) {
  return `<table><thead><tr><th>Person</th><th>Authority</th><th>Status</th><th>Since</th><th></th></tr></thead><tbody>${staff.map(person => `<tr><td><strong>${escapeHtml(person.name)}</strong><div class="muted small">${escapeHtml(person.email)}</div></td><td><span class="badge ${person.role === "owner" ? "dark" : "info"}">${person.role === "owner" ? "Owner" : "Admin"}</span></td><td><span class="badge ${person.active !== false ? "ok" : ""}">${person.active !== false ? "Active" : "Inactive"}</span></td><td>${formatDateTime(person.createdAt)}</td><td><button class="btn ghost small" data-edit-platform-staff="${person.id}">Manage</button></td></tr>`).join("")}</tbody></table>`;
}

function auditTable(events) {
  if (!events.length) return '<div class="empty">No privileged activity yet.</div>';
  return `<table><thead><tr><th>Time</th><th>Who</th><th>Action</th><th>Target</th><th>Reason</th></tr></thead><tbody>${events.map(item => `<tr><td>${formatDateTime(item.createdAt)}</td><td><strong>${escapeHtml(item.actorName)}</strong><div class="muted small">${escapeHtml(item.actorRole)}</div></td><td>${escapeHtml(String(item.action || "").replaceAll("_", " "))}</td><td>${escapeHtml(item.targetType)} · ${escapeHtml(item.targetId)}</td><td>${escapeHtml(item.reason || "—")}</td></tr>`).join("")}</tbody></table>`;
}

function bindOwnerActions(app, actor) {
  app.root.querySelectorAll("[data-platform-control]").forEach(button => button.addEventListener("click", () => {
    const key = button.dataset.platformControl;
    const nextValue = button.dataset.nextValue === "true";
    const [label] = CONTROL_LABELS[key];
    requestOwnerReason(app, {
      title: `${nextValue ? "Enable" : "Disable"} ${label.toLowerCase()}`,
      description: key === "maintenanceMode" ? "Maintenance mode interrupts normal stakeholder access." : "This changes a company-wide operating control.",
      danger: key === "maintenanceMode" && nextValue,
      onConfirm: reason => {
        app.store.updatePlatformControl(key, nextValue, actor, reason);
        app.closeDialog();
        app.toast(`${label} updated.`);
        app.render();
      }
    });
  }));

  app.root.querySelector("#addPlatformStaff")?.addEventListener("click", () => openAddStaff(app, actor));
  app.root.querySelectorAll("[data-edit-platform-staff]").forEach(button => button.addEventListener("click", () => openEditStaff(app, button.dataset.editPlatformStaff, actor)));
}

function openAddStaff(app, actor) {
  app.openDialog(`<div class="dialog-inner"><div class="dialog-head"><div><span class="eyebrow">Owner authority</span><h2>Add platform staff</h2></div><button class="icon-btn" data-close-dialog>✕</button></div><form id="platformStaffForm" class="form-grid"><label class="field full">Name<input id="staffName" required /></label><label class="field full">Email<input id="staffEmail" type="email" required /></label><label class="field">Authority<select id="staffRole"><option value="admin">GoodKota Admin</option><option value="owner">GoodKota Owner</option></select></label><label class="field full">Reason<textarea id="staffReason" rows="3" placeholder="Why is this authority required?" required></textarea></label><button class="btn primary field full">Grant authority</button></form></div>`);
  app.dialog.querySelector("#platformStaffForm").addEventListener("submit", event => { event.preventDefault(); const reason = app.dialog.querySelector("#staffReason").value.trim(); if (!reason) return alert("A reason is required."); try { app.store.addPlatformStaff({ name: app.dialog.querySelector("#staffName").value, email: app.dialog.querySelector("#staffEmail").value, role: app.dialog.querySelector("#staffRole").value }, actor, reason); app.closeDialog(); app.toast("Platform authority granted."); app.render(); } catch (error) { alert(error.message); } });
}

function openEditStaff(app, staffId, actor) {
  const person = app.store.state.platformStaff.find(item => item.id === staffId); if (!person) return;
  app.openDialog(`<div class="dialog-inner"><div class="dialog-head"><div><span class="eyebrow">Owner authority</span><h2>${escapeHtml(person.name)}</h2></div><button class="icon-btn" data-close-dialog>✕</button></div><div class="form-grid"><label class="field">Authority<select id="editStaffRole"><option value="admin" ${person.role === "admin" ? "selected" : ""}>GoodKota Admin</option><option value="owner" ${person.role === "owner" ? "selected" : ""}>GoodKota Owner</option></select></label><label class="field">Status<select id="editStaffActive"><option value="true" ${person.active !== false ? "selected" : ""}>Active</option><option value="false" ${person.active === false ? "selected" : ""}>Inactive</option></select></label><label class="field full">Reason<textarea id="editStaffReason" rows="3" placeholder="Why is this authority changing?" required></textarea></label><button class="btn primary field full" id="saveStaffAuthority">Save authority</button></div></div>`);
  app.dialog.querySelector("#saveStaffAuthority").addEventListener("click", () => { const reason = app.dialog.querySelector("#editStaffReason").value.trim(); if (!reason) return alert("A reason is required."); try { app.store.updatePlatformStaff(staffId, { role: app.dialog.querySelector("#editStaffRole").value, active: app.dialog.querySelector("#editStaffActive").value === "true" }, actor, reason); app.closeDialog(); app.toast("Platform authority updated."); app.render(); } catch (error) { alert(error.message); } });
}

function requestOwnerReason(app, { title, description, danger = false, onConfirm }) {
  app.openDialog(`<div class="dialog-inner"><div class="dialog-head"><div><span class="eyebrow">Owner confirmation</span><h2>${escapeHtml(title)}</h2></div><button class="icon-btn" data-close-dialog>✕</button></div><p class="muted">${escapeHtml(description)}</p><label class="field">Reason<textarea id="ownerReason" rows="4" required placeholder="Record the business or incident reason"></textarea></label><button class="btn ${danger ? "danger" : "primary"} customer-primary-action" id="confirmOwnerAction">Confirm</button></div>`);
  app.dialog.querySelector("#confirmOwnerAction").addEventListener("click", () => { const reason = app.dialog.querySelector("#ownerReason").value.trim(); if (!reason) return alert("A reason is required for an Owner action."); onConfirm(reason); });
}

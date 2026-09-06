/* =========================================================
   EASYBEV PLATFORM GOVERNANCE

   Owner = governance, privileged access and critical controls.
   Admin = day-to-day platform operations, venues, support and comms.

   This browser build demonstrates the operating model. Production
   authorization must be enforced with Firebase Authentication,
   server-issued custom claims, Security Rules and privileged server
   functions. UI visibility alone is never an authorization boundary.
   ========================================================= */

const PLATFORM_DEFAULT_VENUE_ID = "venue-main";

const PLATFORM_FEATURE_DEFAULTS = {
  guestMessaging: {
    label: "Guest messaging",
    description: "Allow guests and waiters to exchange service messages.",
    enabled: true,
    ownerOnly: false
  },
  waiterAlerts: {
    label: "Waiter alerts",
    description: "Allow browser notification controls for waiter requests.",
    enabled: true,
    ownerOnly: false
  },
  liveBill: {
    label: "Live guest bill",
    description: "Show the running EasyBev bill during service.",
    enabled: true,
    ownerOnly: false
  },
  onlinePayment: {
    label: "Online payment",
    description: "Platform-level availability of EasyBev payment handling.",
    enabled: true,
    ownerOnly: true
  }
};

function platformTimestamp() {
  return firebase.database.ServerValue.TIMESTAMP;
}

function platformNowLabel(value) {
  const n = Number(value || 0);
  if (!n) return "—";
  try {
    return new Date(n).toLocaleString([], {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  catch (_) {
    return "—";
  }
}

function platformRoleLabel(role = currentPlatformRole) {
  return role === "owner" ? "Owner" : "EasyBev Admin";
}

function platformIsOwner() {
  return currentPlatformRole === "owner";
}

function platformCurrentVenueId() {
  return String(latestPlatformCompany.currentVenueId || PLATFORM_DEFAULT_VENUE_ID);
}

function platformVenueName(venueId) {
  const venue = latestPlatformVenues[String(venueId || "")] || {};
  return String(venue.name || venueId || "Venue");
}

function platformStatusLabel(status) {
  const value = String(status || "active").toLowerCase();
  if (value === "paused") return "Paused";
  if (value === "onboarding") return "Onboarding";
  if (value === "closed") return "Closed";
  return "Active";
}

function platformStatusClass(status) {
  const value = String(status || "active").toLowerCase();
  if (value === "active" || value === "resolved" || value === "operational") return "active";
  if (value === "critical" || value === "paused" || value === "degraded") return "alert";
  return "";
}

function platformClone(value) {
  if (value === undefined) return null;
  try { return JSON.parse(JSON.stringify(value)); }
  catch (_) { return String(value); }
}

function requestPlatformReason(actionLabel) {
  const answer = prompt(`${actionLabel}\n\nEnter the reason for this privileged change:`);
  if (answer === null) return null;
  const reason = String(answer || "").trim();
  if (reason.length < 4) {
    alert("A short reason is required for privileged changes.");
    return null;
  }
  return reason;
}

async function writePlatformAudit(action, targetType, targetId, reason, beforeValue, afterValue) {
  if (!db) return;
  const ref = db.ref("platform/auditLog").push();
  await ref.set({
    auditId: ref.key,
    actorRole: platformRoleLabel(),
    action: String(action || "change"),
    targetType: String(targetType || "platform"),
    targetId: String(targetId || ""),
    reason: String(reason || "Routine platform operation"),
    before: platformClone(beforeValue),
    after: platformClone(afterValue),
    createdAt: platformTimestamp()
  });
}

async function ensurePlatformFoundation() {
  if (!db) return;

  const snap = await db.ref("platform").once("value");
  const platform = snap.val() || {};
  const updates = {};
  const ts = platformTimestamp();

  if (!platform.company) {
    updates["platform/company"] = {
      companyName: "EasyBev",
      supportEmail: "",
      supportPhone: "",
      serviceStatus: "operational",
      serviceMessage: "All systems operating normally.",
      currentVenueId: PLATFORM_DEFAULT_VENUE_ID,
      createdAt: ts,
      updatedAt: ts
    };
  }
  else if (!platform.company.currentVenueId) {
    updates["platform/company/currentVenueId"] = PLATFORM_DEFAULT_VENUE_ID;
  }

  if (!platform.venues || !platform.venues[PLATFORM_DEFAULT_VENUE_ID]) {
    updates[`platform/venues/${PLATFORM_DEFAULT_VENUE_ID}`] = {
      venueId: PLATFORM_DEFAULT_VENUE_ID,
      name: "Primary Venue",
      status: "active",
      plan: "Standard",
      subscriptionStatus: "trial",
      billingStatus: "not_configured",
      managerName: "",
      contact: "",
      notes: "Current venue linked to the existing EasyBev service data.",
      createdAt: ts,
      updatedAt: ts
    };
  }
  else {
    const currentVenue = platform.venues[PLATFORM_DEFAULT_VENUE_ID] || {};
    if (!currentVenue.plan) updates[`platform/venues/${PLATFORM_DEFAULT_VENUE_ID}/plan`] = "Standard";
    if (!currentVenue.subscriptionStatus) updates[`platform/venues/${PLATFORM_DEFAULT_VENUE_ID}/subscriptionStatus`] = "trial";
    if (!currentVenue.billingStatus) updates[`platform/venues/${PLATFORM_DEFAULT_VENUE_ID}/billingStatus`] = "not_configured";
  }

  if (!platform.staff) {
    updates["platform/staff/owner-primary"] = {
      staffId: "owner-primary",
      name: "Platform Owner",
      email: "",
      role: "owner",
      active: true,
      createdAt: ts,
      updatedAt: ts
    };
    updates["platform/staff/admin-operations"] = {
      staffId: "admin-operations",
      name: "Operations Admin",
      email: "",
      role: "admin",
      active: true,
      createdAt: ts,
      updatedAt: ts
    };
  }

  Object.entries(PLATFORM_FEATURE_DEFAULTS).forEach(([key, config]) => {
    if (!platform.featureFlags || !platform.featureFlags[key]) {
      updates[`platform/featureFlags/${key}`] = {
        key,
        ...config,
        createdAt: ts,
        updatedAt: ts
      };
    }
  });

  if (Object.keys(updates).length) {
    await db.ref().update(updates);
  }
}

/* =========================================================
   GLOBAL PLATFORM COMMUNICATIONS
   ========================================================= */

function clearPlatformNoticeBanner() {
  const banner = document.getElementById("platformNoticeBanner");
  if (!banner) return;
  banner.innerHTML = "";
  banner.className = "platform-notice hidden";
}

function announcementAppliesToActor(item, actor) {
  if (!item || item.status !== "published") return false;
  const expiresAt = Number(item.expiresAt || 0);
  if (expiresAt && expiresAt < Date.now()) return false;

  const audience = String(item.audience || "all").toLowerCase();
  if (audience === "all") return true;
  if (audience === "venue") return ["guest", "waiter", "manager"].includes(actor);
  if (audience === "management") return actor === "manager";
  if (audience === "waiters") return actor === "waiter";
  if (audience === "internal") return ["admin", "owner"].includes(actor);
  return false;
}

function renderPlatformNoticeBanner(actor, company, announcements) {
  const banner = document.getElementById("platformNoticeBanner");
  if (!banner) return;

  const serviceStatus = String(company.serviceStatus || "operational");
  const notices = Object.values(announcements || {})
    .filter(item => announcementAppliesToActor(item, actor))
    .sort((a, b) => Number(b.publishedAt || b.createdAt || 0) - Number(a.publishedAt || a.createdAt || 0));
  const important = notices.find(item => item.priority === "important") || notices[0];

  if (serviceStatus !== "operational") {
    banner.className = `platform-notice ${serviceStatus === "degraded" ? "warning" : "danger"}`;
    banner.innerHTML = `
      <strong>${serviceStatus === "maintenance" ? "EasyBev maintenance" : "EasyBev service notice"}</strong>
      <span>${escapeHtml(String(company.serviceMessage || "Some EasyBev services may be affected."))}</span>`;
    return;
  }

  if (important) {
    banner.className = `platform-notice ${important.priority === "important" ? "warning" : ""}`;
    banner.innerHTML = `
      <strong>${escapeHtml(String(important.title || "EasyBev notice"))}</strong>
      <span>${escapeHtml(String(important.message || ""))}</span>`;
    return;
  }

  clearPlatformNoticeBanner();
}

function subscribeToPlatformAnnouncements(actor) {
  if (!db) return;
  if (typeof platformAnnouncementUnsubscribe === "function") {
    try { platformAnnouncementUnsubscribe(); } catch (_) {}
  }

  const companyRef = db.ref("platform/company");
  const announcementRef = db.ref("platform/announcements");
  const featureRef = db.ref("platform/featureFlags");
  let company = {};
  let announcements = {};

  const render = () => {
    renderPlatformNoticeBanner(String(actor || "guest"), company, announcements);
    applyPlatformFeatureControls(String(actor || "guest"));
  };
  const companyHandler = snap => { company = snap.val() || {}; render(); };
  const announcementHandler = snap => { announcements = snap.val() || {}; render(); };
  const featureHandler = snap => { latestPlatformFeatureFlags = snap.val() || {}; render(); };

  companyRef.on("value", companyHandler);
  announcementRef.on("value", announcementHandler);
  featureRef.on("value", featureHandler);
  platformAnnouncementUnsubscribe = () => {
    companyRef.off("value", companyHandler);
    announcementRef.off("value", announcementHandler);
    featureRef.off("value", featureHandler);
  };
}


function platformFeatureEnabled(key, fallback = true) {
  const item = latestPlatformFeatureFlags && latestPlatformFeatureFlags[key];
  if (!item || typeof item.enabled !== "boolean") return Boolean(fallback);
  return item.enabled;
}

function applyPlatformFeatureControls(actor) {
  const messaging = platformFeatureEnabled("guestMessaging", true);
  const alerts = platformFeatureEnabled("waiterAlerts", true);
  const liveBill = platformFeatureEnabled("liveBill", true);

  if (actor === "guest") {
    const guestChat = document.querySelector("#guestView .guest-chat");
    if (guestChat) guestChat.classList.toggle("hidden", !messaging);

    const guestAlertButton = document.getElementById("guestNotificationsButton");
    const guestAlertStatus = document.getElementById("guestNotificationStatus");
    if (guestAlertButton) guestAlertButton.classList.toggle("hidden", !alerts);
    if (guestAlertStatus) guestAlertStatus.classList.toggle("hidden", !alerts);

    const liveContent = document.getElementById("guestBillLiveContent");
    if (liveContent) liveContent.classList.toggle("hidden", !liveBill);

    const payButton = document.getElementById("guestPayButton");
    if (payButton && !platformFeatureEnabled("onlinePayment", true)) {
      payButton.classList.add("hidden");
    }
    else if (payButton && currentSession && sessionBillStatus(currentSession) === "finalized") {
      payButton.classList.remove("hidden");
    }
  }

  if (actor === "waiter") {
    const waiterAlertButton = document.getElementById("waiterNotificationsButton");
    const waiterAlertStatus = document.getElementById("waiterNotificationStatus");
    if (waiterAlertButton) waiterAlertButton.classList.toggle("hidden", !alerts);
    if (waiterAlertStatus) waiterAlertStatus.classList.toggle("hidden", !alerts);

    document.querySelectorAll("#waiterView .chat-panel").forEach(panel => {
      panel.classList.toggle("hidden", !messaging);
    });
  }
}

/* =========================================================
   VENUE SUPPORT REQUEST (VENUE MANAGEMENT)
   ========================================================= */

async function toggleVenueSupportPanel() {
  const panel = document.getElementById("managerSupport");
  if (!panel) return;
  panel.classList.toggle("hidden");
  if (panel.classList.contains("hidden")) return;

  const venueId = PLATFORM_DEFAULT_VENUE_ID;
  const snap = await db.ref("platform/supportCases").once("value");
  const cases = Object.values(snap.val() || {})
    .filter(item => item && String(item.venueId || PLATFORM_DEFAULT_VENUE_ID) === venueId)
    .sort((a,b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, 5);

  panel.innerHTML = `
    <div class="heading-row">
      <div>
        <h3 style="margin-bottom:3px">EasyBev Support</h3>
        <p class="muted" style="margin:0">Raise a venue issue for the EasyBev operations team.</p>
      </div>
      <button class="secondary" onclick="toggleVenueSupportPanel()">Close</button>
    </div>
    <div class="platform-form-grid platform-form-grid-3">
      <input id="venueSupportSubject" maxlength="100" placeholder="What do you need help with?" />
      <select id="venueSupportSeverity">
        <option value="normal">Normal</option>
        <option value="high">High priority</option>
        <option value="critical">Critical</option>
      </select>
      <button class="warning" onclick="submitVenueSupportRequest()">Send to EasyBev</button>
    </div>
    <textarea id="venueSupportDetail" maxlength="600" rows="3" placeholder="Describe the issue briefly"></textarea>
    <div class="platform-list" style="margin-top:12px">
      ${cases.length ? cases.map(item => `
        <div class="platform-row">
          <div><strong>${escapeHtml(item.subject || "Support request")}</strong><small>${escapeHtml(platformStatusLabel(item.status || "open"))} · ${escapeHtml(platformNowLabel(item.createdAt))}</small></div>
          <span class="badge ${item.severity === "critical" ? "alert" : ""}">${escapeHtml(item.severity || "normal")}</span>
        </div>`).join("") : '<p class="muted">No recent support requests.</p>'}
    </div>`;
}

async function submitVenueSupportRequest() {
  const subject = String(document.getElementById("venueSupportSubject")?.value || "").trim();
  const detail = String(document.getElementById("venueSupportDetail")?.value || "").trim();
  const severity = String(document.getElementById("venueSupportSeverity")?.value || "normal");
  if (!subject) {
    alert("Enter a short subject for the support request.");
    return;
  }

  const ref = db.ref("platform/supportCases").push();
  await ref.set({
    caseId: ref.key,
    venueId: PLATFORM_DEFAULT_VENUE_ID,
    subject,
    detail,
    severity,
    status: "open",
    ownerName: "",
    openedBy: "Venue Management",
    createdAt: platformTimestamp(),
    updatedAt: platformTimestamp()
  });
  showEasyBevToast("Support request sent", "EasyBev operations can now see this issue.");
  await toggleVenueSupportPanel();
  await toggleVenueSupportPanel();
}

/* =========================================================
   PLATFORM DASHBOARD
   ========================================================= */

function startPlatformDashboard(role) {
  currentPlatformRole = role === "owner" ? "owner" : "admin";

  const title = document.getElementById("platformRoleTitle");
  const desc = document.getElementById("platformRoleDescription");
  const kicker = document.getElementById("platformRoleKicker");
  const peopleBtn = document.getElementById("platformPeopleButton");
  const auditBtn = document.getElementById("platformAuditButton");

  if (platformIsOwner()) {
    if (title) title.textContent = "Owner Control";
    if (desc) desc.textContent = "Govern EasyBev access, critical controls and company-wide operating authority.";
    if (kicker) kicker.textContent = "EasyBev ownership";
    peopleBtn?.classList.remove("hidden");
    auditBtn?.classList.remove("hidden");
    if (auditBtn) auditBtn.textContent = "Audit";
  }
  else {
    if (title) title.textContent = "Platform Operations";
    if (desc) desc.textContent = "Keep venues supported, informed and operating normally.";
    if (kicker) kicker.textContent = "EasyBev company";
    peopleBtn?.classList.add("hidden");
    auditBtn?.classList.remove("hidden");
    if (auditBtn) auditBtn.textContent = "Activity";
  }

  const bindings = [
    ["platform/company", value => latestPlatformCompany = value],
    ["platform/venues", value => latestPlatformVenues = value],
    ["platform/staff", value => latestPlatformStaff = value],
    ["platform/announcements", value => latestPlatformAnnouncements = value],
    ["platform/supportCases", value => latestPlatformSupportCases = value],
    ["platform/featureFlags", value => latestPlatformFeatureFlags = value],
    ["platform/auditLog", value => latestPlatformAudit = value],
    ["sessions", value => latestPlatformSessions = value],
    ["waiters", value => latestPlatformWaiters = value]
  ];

  bindings.forEach(([path, assign]) => {
    db.ref(path).on("value", snap => {
      assign(snap.val() || {});
      renderPlatformDashboard();
    });
  });
}

function renderPlatformDashboard() {
  renderPlatformServicePulse();
  renderPlatformAttention();
  const panel = document.getElementById("platformPanel");
  if (panel && !panel.classList.contains("hidden") && panel.dataset.panel) {
    renderPlatformPanel(panel.dataset.panel);
  }
}

function renderPlatformServicePulse() {
  const el = document.getElementById("platformServicePulse");
  if (!el) return;

  const venues = Object.values(latestPlatformVenues || {}).filter(Boolean);
  const activeVenues = venues.filter(v => v.status === "active").length;
  const openCases = Object.values(latestPlatformSupportCases || {}).filter(item => item && item.status !== "resolved");
  const critical = openCases.filter(item => item.severity === "critical").length;
  const service = String(latestPlatformCompany.serviceStatus || "operational");

  el.innerHTML = `
    <div class="platform-pulse-card"><span>Active venues</span><strong>${activeVenues}</strong></div>
    <div class="platform-pulse-card ${openCases.length ? "attention" : ""}"><span>Open support</span><strong>${openCases.length}</strong></div>
    <div class="platform-pulse-card ${critical ? "critical" : ""}"><span>Critical</span><strong>${critical}</strong></div>
    <div class="platform-pulse-card status-card ${service !== "operational" ? "attention" : ""}"><span>Platform</span><strong class="platform-status-word">${escapeHtml(service)}</strong></div>`;
}

function renderPlatformAttention() {
  const el = document.getElementById("platformAttention");
  if (!el) return;

  const openCases = Object.values(latestPlatformSupportCases || {})
    .filter(item => item && item.status !== "resolved")
    .sort((a,b) => {
      const rank = {critical: 3, high: 2, normal: 1};
      return (rank[b.severity] || 0) - (rank[a.severity] || 0) || Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });

  const published = Object.values(latestPlatformAnnouncements || {})
    .filter(item => item && item.status === "published")
    .sort((a,b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0));

  el.innerHTML = `
    <div class="heading-row">
      <div>
        <div class="section-kicker">Attention</div>
        <h3 style="margin:3px 0">What needs EasyBev now</h3>
      </div>
      <span class="badge ${openCases.length ? "alert" : "active"}">${openCases.length ? `${openCases.length} open` : "Clear"}</span>
    </div>
    <div class="platform-attention-grid">
      <div>
        <strong>Support</strong>
        ${openCases.length ? openCases.slice(0,4).map(item => `
          <button class="platform-attention-item" onclick="showPlatformPanel('support')">
            <span>${escapeHtml(item.subject || "Support request")}</span>
            <small>${escapeHtml(platformVenueName(item.venueId))} · ${escapeHtml(item.severity || "normal")}</small>
          </button>`).join("") : '<p class="muted">No venue issues need attention.</p>'}
      </div>
      <div>
        <strong>Communication</strong>
        ${published.length ? published.slice(0,3).map(item => `
          <div class="platform-attention-item static">
            <span>${escapeHtml(item.title || "EasyBev notice")}</span>
            <small>${escapeHtml(item.audience || "all")} · ${escapeHtml(platformNowLabel(item.publishedAt))}</small>
          </div>`).join("") : '<p class="muted">No active platform announcements.</p>'}
      </div>
    </div>`;
}

function showPlatformPanel(panelName) {
  const panel = document.getElementById("platformPanel");
  if (!panel) return;
  const allowed = ["venues", "support", "announcements", "controls", "people", "audit"];
  const name = allowed.includes(panelName) ? panelName : "support";
  if (name === "people" && !platformIsOwner()) {
    alert("Owner access is required for this area.");
    return;
  }
  panel.dataset.panel = name;
  panel.classList.remove("hidden");
  renderPlatformPanel(name);
  panel.scrollIntoView({behavior: "smooth", block: "start"});
}

function closePlatformPanel() {
  const panel = document.getElementById("platformPanel");
  if (!panel) return;
  panel.classList.add("hidden");
  panel.dataset.panel = "";
}

function platformPanelHead(title, description) {
  return `
    <div class="heading-row platform-panel-head">
      <div><h3 style="margin-bottom:3px">${escapeHtml(title)}</h3><p class="muted" style="margin:0">${escapeHtml(description)}</p></div>
      <button class="secondary" onclick="closePlatformPanel()">Close</button>
    </div>`;
}

function renderPlatformPanel(name) {
  const panel = document.getElementById("platformPanel");
  if (!panel) return;
  if (name === "venues") renderPlatformVenues(panel);
  else if (name === "support") renderPlatformSupport(panel);
  else if (name === "announcements") renderPlatformAnnouncements(panel);
  else if (name === "controls") renderPlatformControls(panel);
  else if (name === "people") renderPlatformPeople(panel);
  else if (name === "audit") renderPlatformAudit(panel);
}

/* =========================================================
   VENUES
   ========================================================= */

function renderPlatformVenues(panel) {
  const rows = Object.entries(latestPlatformVenues || {})
    .filter(([,v]) => v)
    .sort((a,b) => String(a[1].name || "").localeCompare(String(b[1].name || "")));

  panel.innerHTML = `${platformPanelHead("Venues", "Onboard, support and control venue access without touching restaurant service settings.")}
    <div class="platform-form-grid platform-form-grid-4">
      <input id="platformVenueName" maxlength="100" placeholder="Venue name" />
      <input id="platformVenueManager" maxlength="80" placeholder="Manager (optional)" />
      <input id="platformVenueContact" maxlength="80" placeholder="Contact (optional)" />
      <button class="warning" onclick="addPlatformVenue()">+ Venue</button>
    </div>
    <div class="platform-list">
      ${rows.map(([id,venue]) => `
        <div class="platform-row platform-row-wide">
          <div>
            <strong>${escapeHtml(venue.name || "Unnamed venue")}</strong>
            <small>${escapeHtml(String(venue.managerName || "No manager named"))}${venue.contact ? ` · ${escapeHtml(venue.contact)}` : ""}</small>
            <small>${escapeHtml(String(venue.plan || "Standard"))} · Subscription: ${escapeHtml(String(venue.subscriptionStatus || "trial"))} · Billing: ${escapeHtml(String(venue.billingStatus || "not_configured"))}</small>
          </div>
          <div class="platform-row-actions">
            <span class="badge ${platformStatusClass(venue.status)}">${escapeHtml(platformStatusLabel(venue.status))}</span>
            <button class="secondary" onclick="editPlatformVenue('${escapeJsString(id)}')">Edit</button>
            <button class="${venue.status === "paused" ? "blue" : "danger"}" onclick="togglePlatformVenue('${escapeJsString(id)}')">${venue.status === "paused" ? "Resume" : "Pause"}</button>
          </div>
        </div>`).join("") || '<p class="muted">No venues registered.</p>'}
    </div>
    ${renderPlatformQrOperationsHtml()}`;

  requestAnimationFrame(() => {
    Object.keys(latestPlatformWaiters || {}).forEach(slot => generateManagerQr(String(slot)));
  });
}

function renderPlatformQrOperationsHtml() {
  const rows = sortedWaiterEntries(latestPlatformWaiters || {});
  if (!rows.length) return "";
  return `
    <div class="platform-subsection">
      <div>
        <h4 style="margin-bottom:3px">QR Operations · Current Venue</h4>
        <p class="muted" style="margin:0">Reissue a permanent waiter QR without changing venue staff assignments.</p>
      </div>
      <div class="platform-qr-grid">
        ${rows.map(([slot, waiter]) => {
          const link = `${window.location.origin}${window.location.pathname}?guest=${slot}`;
          return `<div class="platform-qr-card">
            <div id="managerQr${escapeHtml(slot)}" class="qr-box" aria-label="QR code for Waiter ${escapeHtml(slot)}"></div>
            <div><strong>Waiter ${escapeHtml(slot)}</strong><small>${escapeHtml(getWaiterDisplayName({...waiter, slot}))}</small></div>
            <div class="platform-row-actions">
              <button class="secondary" onclick="downloadWaiterQr('${escapeJsString(slot)}')">Download QR</button>
              <button class="secondary" onclick="copyText('${escapeHtml(link)}')">Copy Link</button>
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>`;
}

async function addPlatformVenue() {
  const name = String(document.getElementById("platformVenueName")?.value || "").trim();
  const managerName = String(document.getElementById("platformVenueManager")?.value || "").trim();
  const contact = String(document.getElementById("platformVenueContact")?.value || "").trim();
  if (!name) { alert("Enter the venue name."); return; }

  const ref = db.ref("platform/venues").push();
  const item = {
    venueId: ref.key,
    name,
    managerName,
    contact,
    status: "onboarding",
    plan: "Standard",
    subscriptionStatus: "trial",
    billingStatus: "not_configured",
    notes: "",
    createdAt: platformTimestamp(),
    updatedAt: platformTimestamp()
  };
  await ref.set(item);
  await writePlatformAudit("Venue created", "venue", ref.key, "New venue onboarding", null, item);
  showEasyBevToast("Venue added", `${name} is ready for onboarding.`);
}

async function editPlatformVenue(id) {
  const venue = latestPlatformVenues[id];
  if (!venue) return;
  const nameValue = prompt("Venue name", String(venue.name || ""));
  if (nameValue === null) return;
  const name = String(nameValue).trim();
  if (!name) return;
  const managerValue = prompt("Manager name (optional)", String(venue.managerName || ""));
  if (managerValue === null) return;
  const contactValue = prompt("Venue contact (optional)", String(venue.contact || ""));
  if (contactValue === null) return;
  const planValue = prompt("Plan", String(venue.plan || "Standard"));
  if (planValue === null) return;
  const subscriptionValue = prompt("Subscription status: trial, active, overdue, suspended", String(venue.subscriptionStatus || "trial"));
  if (subscriptionValue === null) return;
  const subscriptionStatus = String(subscriptionValue).trim().toLowerCase();
  if (!["trial","active","overdue","suspended"].includes(subscriptionStatus)) {
    alert("Subscription status must be trial, active, overdue or suspended.");
    return;
  }
  const billingValue = prompt("Billing status: not_configured, current, overdue, manual", String(venue.billingStatus || "not_configured"));
  if (billingValue === null) return;
  const billingStatus = String(billingValue).trim().toLowerCase();
  if (!["not_configured","current","overdue","manual"].includes(billingStatus)) {
    alert("Billing status must be not_configured, current, overdue or manual.");
    return;
  }
  const before = platformClone(venue);
  const after = {...venue, name, managerName: String(managerValue).trim(), contact: String(contactValue).trim(), plan:String(planValue).trim() || "Standard", subscriptionStatus, billingStatus};
  await db.ref(`platform/venues/${id}`).update({
    name: after.name,
    managerName: after.managerName,
    contact: after.contact,
    plan: after.plan,
    subscriptionStatus,
    billingStatus,
    updatedAt: platformTimestamp()
  });
  await writePlatformAudit("Venue updated", "venue", id, "Venue profile maintenance", before, after);
  showEasyBevToast("Venue updated", name);
}

async function togglePlatformVenue(id) {
  const venue = latestPlatformVenues[id];
  if (!venue) return;
  const pausing = venue.status !== "paused";
  const reason = requestPlatformReason(pausing ? "Pause venue access" : "Resume venue access");
  if (!reason) return;
  const before = platformClone(venue);
  const nextStatus = pausing ? "paused" : "active";
  await db.ref(`platform/venues/${id}`).update({status: nextStatus, statusReason: reason, updatedAt: platformTimestamp()});
  await writePlatformAudit(pausing ? "Venue paused" : "Venue resumed", "venue", id, reason, before, {...venue, status: nextStatus});
  showEasyBevToast(pausing ? "Venue paused" : "Venue resumed", venue.name || id);
}

/* =========================================================
   SUPPORT
   ========================================================= */

function renderPlatformSupport(panel) {
  const rank = {critical:3, high:2, normal:1};
  const rows = Object.entries(latestPlatformSupportCases || {})
    .filter(([,item]) => item)
    .sort((a,b) => (a[1].status === "resolved") - (b[1].status === "resolved") || (rank[b[1].severity]||0)-(rank[a[1].severity]||0) || Number(b[1].createdAt||0)-Number(a[1].createdAt||0));

  panel.innerHTML = `${platformPanelHead("Support", "One queue for venue requests, incidents and EasyBev intervention history.")}
    <div class="platform-form-grid platform-form-grid-4">
      <select id="platformSupportVenue">${Object.entries(latestPlatformVenues || {}).map(([id,v]) => `<option value="${escapeHtml(id)}">${escapeHtml(v.name || id)}</option>`).join("")}</select>
      <input id="platformSupportSubject" maxlength="100" placeholder="Issue or request" />
      <select id="platformSupportSeverity"><option value="normal">Normal</option><option value="high">High priority</option><option value="critical">Critical</option></select>
      <button class="warning" onclick="createPlatformSupportCase()">+ Case</button>
    </div>
    <div class="platform-list">
      ${rows.map(([id,item]) => `
        <div class="platform-row platform-row-wide">
          <div>
            <strong>${escapeHtml(item.subject || "Support request")}</strong>
            <small>${escapeHtml(platformVenueName(item.venueId))} · ${escapeHtml(platformNowLabel(item.createdAt))}${item.ownerName ? ` · ${escapeHtml(item.ownerName)}` : ""}</small>
            ${item.detail ? `<p>${escapeHtml(item.detail)}</p>` : ""}
          </div>
          <div class="platform-row-actions">
            <span class="badge ${item.severity === "critical" ? "alert" : ""}">${escapeHtml(item.severity || "normal")}</span>
            <select class="compact-select" onchange="updatePlatformSupportCase('${escapeJsString(id)}', this.value)">
              <option value="open" ${item.status === "open" ? "selected" : ""}>Open</option>
              <option value="working" ${item.status === "working" ? "selected" : ""}>Working</option>
              <option value="resolved" ${item.status === "resolved" ? "selected" : ""}>Resolved</option>
            </select>
          </div>
        </div>`).join("") || '<p class="muted">No support cases.</p>'}
    </div>
    ${renderPlatformInterventionsHtml()}`;
}

function renderPlatformInterventionsHtml() {
  const active = Object.entries(latestPlatformSessions || {})
    .filter(([,session]) => session && session.status === "active")
    .sort((a,b) => Number(b[1].lastActivityAt || b[1].createdAt || 0) - Number(a[1].lastActivityAt || a[1].createdAt || 0));
  return `
    <div class="platform-subsection">
      <h4 style="margin-bottom:3px">Live Service Intervention</h4>
      <p class="muted" style="margin-top:0">Use only when a venue cannot recover a stuck service session. Closing preserves the session history and records the intervention.</p>
      <div class="platform-list">
        ${active.length ? active.slice(0,12).map(([id,session]) => `
          <div class="platform-row platform-row-wide">
            <div><strong>${escapeHtml(guestName(session))}</strong><small>${escapeHtml(guestLabel(id,session))} · Waiter ${escapeHtml(String(session.waiterSlot || "?"))} · ${escapeHtml(money(sessionBillTotal(session)))}</small></div>
            <div class="platform-row-actions"><span class="badge active">Live</span><button class="danger" onclick="forceClosePlatformSession('${escapeJsString(id)}')">Force End</button></div>
          </div>`).join("") : '<p class="muted">No live service sessions.</p>'}
      </div>
    </div>`;
}

async function forceClosePlatformSession(sessionId) {
  const session = latestPlatformSessions[sessionId];
  if (!session || session.status !== "active") return;
  const reason = requestPlatformReason("Force end live service session");
  if (!reason) return;
  const before = platformClone(session);
  const updates = {
    status: "closed",
    closedAt: platformTimestamp(),
    lastActivityAt: platformTimestamp(),
    closedBy: platformRoleLabel(),
    closureReason: reason,
    supportOverride: true
  };
  await db.ref(`sessions/${sessionId}`).update(updates);
  await writePlatformAudit("Service session force-ended", "session", sessionId, reason, before, {...session,...updates});
  showEasyBevToast("Session ended", `${guestName(session)} · intervention recorded.`);
}

async function createPlatformSupportCase() {
  const venueId = String(document.getElementById("platformSupportVenue")?.value || PLATFORM_DEFAULT_VENUE_ID);
  const subject = String(document.getElementById("platformSupportSubject")?.value || "").trim();
  const severity = String(document.getElementById("platformSupportSeverity")?.value || "normal");
  if (!subject) { alert("Enter the issue or request."); return; }
  const ref = db.ref("platform/supportCases").push();
  const item = {caseId:ref.key, venueId, subject, detail:"", severity, status:"open", ownerName:"", openedBy:platformRoleLabel(), createdAt:platformTimestamp(), updatedAt:platformTimestamp()};
  await ref.set(item);
  await writePlatformAudit("Support case created", "supportCase", ref.key, "Stakeholder support request", null, item);
  showEasyBevToast("Support case created", subject);
}

async function updatePlatformSupportCase(id, nextStatus) {
  const item = latestPlatformSupportCases[id];
  if (!item) return;
  const before = platformClone(item);
  let resolutionNote = String(item.resolutionNote || "");
  if (nextStatus === "resolved") {
    const note = prompt("Resolution note", resolutionNote);
    if (note === null) { renderPlatformSupport(document.getElementById("platformPanel")); return; }
    resolutionNote = String(note).trim();
    if (!resolutionNote) { alert("Add a short resolution note before closing the case."); renderPlatformSupport(document.getElementById("platformPanel")); return; }
  }
  await db.ref(`platform/supportCases/${id}`).update({status:nextStatus, resolutionNote, updatedAt:platformTimestamp()});
  await writePlatformAudit("Support case status changed", "supportCase", id, nextStatus === "resolved" ? resolutionNote : `Status → ${nextStatus}`, before, {...item,status:nextStatus,resolutionNote});
  showEasyBevToast("Support updated", `${item.subject || "Case"} → ${nextStatus}`);
}

/* =========================================================
   ANNOUNCEMENTS
   ========================================================= */

function renderPlatformAnnouncements(panel) {
  const rows = Object.entries(latestPlatformAnnouncements || {})
    .filter(([,item]) => item)
    .sort((a,b) => Number(b[1].createdAt||0)-Number(a[1].createdAt||0));

  panel.innerHTML = `${platformPanelHead("Announcements", "Publish operational messages without relying on external chat groups.")}
    <div class="platform-form-grid platform-form-grid-3">
      <input id="platformAnnouncementTitle" maxlength="80" placeholder="Announcement title" />
      <select id="platformAnnouncementAudience"><option value="all">Everyone</option><option value="venue">Venue users</option><option value="management">Management</option><option value="waiters">Waiters</option><option value="internal">EasyBev team</option></select>
      <select id="platformAnnouncementPriority"><option value="normal">Normal</option><option value="important">Important</option></select>
    </div>
    <textarea id="platformAnnouncementMessage" maxlength="500" rows="3" placeholder="Message"></textarea>
    <button class="warning platform-inline-button" onclick="publishPlatformAnnouncement()">Publish Announcement</button>
    <div class="platform-list" style="margin-top:14px">
      ${rows.map(([id,item]) => `
        <div class="platform-row platform-row-wide">
          <div>
            <strong>${escapeHtml(item.title || "Announcement")}</strong>
            <small>${escapeHtml(item.audience || "all")} · ${escapeHtml(item.status || "draft")} · ${escapeHtml(platformNowLabel(item.publishedAt || item.createdAt))}</small>
            <p>${escapeHtml(item.message || "")}</p>
          </div>
          <div class="platform-row-actions">
            <span class="badge ${item.priority === "important" ? "alert" : ""}">${escapeHtml(item.priority || "normal")}</span>
            ${item.status === "published" ? `<button class="secondary" onclick="unpublishPlatformAnnouncement('${escapeJsString(id)}')">Withdraw</button>` : ""}
          </div>
        </div>`).join("") || '<p class="muted">No announcements yet.</p>'}
    </div>`;
}

async function publishPlatformAnnouncement() {
  const title = String(document.getElementById("platformAnnouncementTitle")?.value || "").trim();
  const message = String(document.getElementById("platformAnnouncementMessage")?.value || "").trim();
  const audience = String(document.getElementById("platformAnnouncementAudience")?.value || "all");
  const priority = String(document.getElementById("platformAnnouncementPriority")?.value || "normal");
  if (!title || !message) { alert("Enter an announcement title and message."); return; }
  const ref = db.ref("platform/announcements").push();
  const item = {announcementId:ref.key,title,message,audience,priority,status:"published",createdByRole:platformRoleLabel(),createdAt:platformTimestamp(),publishedAt:platformTimestamp()};
  await ref.set(item);
  await writePlatformAudit("Announcement published", "announcement", ref.key, `Audience: ${audience}`, null, item);
  showEasyBevToast("Announcement published", title);
}

async function unpublishPlatformAnnouncement(id) {
  const item = latestPlatformAnnouncements[id];
  if (!item) return;
  const reason = requestPlatformReason("Withdraw announcement");
  if (!reason) return;
  await db.ref(`platform/announcements/${id}`).update({status:"withdrawn",withdrawnAt:platformTimestamp(),withdrawReason:reason});
  await writePlatformAudit("Announcement withdrawn", "announcement", id, reason, item, {...item,status:"withdrawn"});
  showEasyBevToast("Announcement withdrawn", item.title || "Announcement");
}

/* =========================================================
   CONTROLS
   ========================================================= */

function renderPlatformControls(panel) {
  const company = latestPlatformCompany || {};
  const flags = Object.entries(latestPlatformFeatureFlags || {})
    .filter(([,item]) => item)
    .sort((a,b) => String(a[1].label||"").localeCompare(String(b[1].label||"")));

  panel.innerHTML = `${platformPanelHead("Platform Controls", "Company-wide operating state and feature availability. Sensitive changes are reason-coded.")}
    <div class="platform-control-block">
      <div>
        <strong>Service status</strong>
        <p class="muted">Visible across EasyBev when the platform is degraded or under maintenance.</p>
      </div>
      <div class="platform-row-actions">
        <select id="platformServiceStatus" class="compact-select">
          <option value="operational" ${company.serviceStatus === "operational" ? "selected" : ""}>Operational</option>
          <option value="degraded" ${company.serviceStatus === "degraded" ? "selected" : ""}>Degraded</option>
          <option value="maintenance" ${company.serviceStatus === "maintenance" ? "selected" : ""}>Maintenance</option>
        </select>
        <button class="secondary" onclick="savePlatformServiceStatus()">Update</button>
      </div>
    </div>
    <input id="platformServiceMessage" maxlength="220" value="${escapeHtml(company.serviceMessage || "")}" placeholder="Public service message" />

    <div class="platform-control-list">
      ${flags.map(([key,item]) => {
        const locked = Boolean(item.ownerOnly && !platformIsOwner());
        return `<div class="platform-control-block">
          <div><strong>${escapeHtml(item.label || key)}</strong><p class="muted">${escapeHtml(item.description || "")}${item.ownerOnly ? " · Owner control" : ""}</p></div>
          <button class="${item.enabled ? "success" : "secondary"}" ${locked ? "disabled" : ""} onclick="togglePlatformFeature('${escapeJsString(key)}')">${item.enabled ? "Enabled" : "Disabled"}</button>
        </div>`;
      }).join("")}
    </div>

    ${platformIsOwner() ? `<div class="platform-owner-settings">
      <h4>Company identity</h4>
      <div class="platform-form-grid platform-form-grid-3">
        <input id="platformCompanyName" maxlength="80" value="${escapeHtml(company.companyName || "EasyBev")}" placeholder="Company name" />
        <input id="platformSupportEmail" maxlength="120" value="${escapeHtml(company.supportEmail || "")}" placeholder="Support email" />
        <input id="platformSupportPhone" maxlength="40" value="${escapeHtml(company.supportPhone || "")}" placeholder="Support phone" />
      </div>
      <button class="secondary platform-inline-button" onclick="savePlatformCompanyIdentity()">Save Company Settings</button>
    </div>` : ""}`;
}

async function savePlatformServiceStatus() {
  const status = String(document.getElementById("platformServiceStatus")?.value || "operational");
  const message = String(document.getElementById("platformServiceMessage")?.value || "").trim();
  if (status === "maintenance" && !platformIsOwner()) {
    alert("Owner access is required to place the whole platform into maintenance mode.");
    renderPlatformControls(document.getElementById("platformPanel"));
    return;
  }
  const reason = requestPlatformReason("Change EasyBev service status");
  if (!reason) return;
  const before = platformClone(latestPlatformCompany);
  await db.ref("platform/company").update({serviceStatus:status,serviceMessage:message || (status === "operational" ? "All systems operating normally." : "Some EasyBev services may be affected."),updatedAt:platformTimestamp()});
  await writePlatformAudit("Service status changed", "company", "easybev", reason, before, {...latestPlatformCompany,serviceStatus:status,serviceMessage:message});
  showEasyBevToast("Platform status updated", status);
}

async function togglePlatformFeature(key) {
  const item = latestPlatformFeatureFlags[key];
  if (!item) return;
  if (item.ownerOnly && !platformIsOwner()) { alert("Owner access is required for this control."); return; }
  const reason = requestPlatformReason(`${item.enabled ? "Disable" : "Enable"} ${item.label || key}`);
  if (!reason) return;
  await db.ref(`platform/featureFlags/${key}`).update({enabled:!item.enabled,updatedAt:platformTimestamp(),lastReason:reason});
  await writePlatformAudit("Feature control changed", "featureFlag", key, reason, item, {...item,enabled:!item.enabled});
  showEasyBevToast("Platform control updated", `${item.label || key}: ${!item.enabled ? "enabled" : "disabled"}`);
}

async function savePlatformCompanyIdentity() {
  if (!platformIsOwner()) return;
  const name = String(document.getElementById("platformCompanyName")?.value || "EasyBev").trim();
  const supportEmail = String(document.getElementById("platformSupportEmail")?.value || "").trim();
  const supportPhone = String(document.getElementById("platformSupportPhone")?.value || "").trim();
  const before = platformClone(latestPlatformCompany);
  await db.ref("platform/company").update({companyName:name || "EasyBev",supportEmail,supportPhone,updatedAt:platformTimestamp()});
  await writePlatformAudit("Company settings updated", "company", "easybev", "Owner company settings maintenance", before, {...latestPlatformCompany,companyName:name,supportEmail,supportPhone});
  showEasyBevToast("Company settings saved", name || "EasyBev");
}

/* =========================================================
   OWNER: EASYBEV PEOPLE
   ========================================================= */

function renderPlatformPeople(panel) {
  if (!platformIsOwner()) return;
  const rows = Object.entries(latestPlatformStaff || {})
    .filter(([,item]) => item)
    .sort((a,b) => String(a[1].role||"").localeCompare(String(b[1].role||"")) || String(a[1].name||"").localeCompare(String(b[1].name||"")));

  panel.innerHTML = `${platformPanelHead("EasyBev Team", "Only the Owner governs who can operate EasyBev and at what authority level.")}
    <div class="platform-form-grid platform-form-grid-4">
      <input id="platformStaffName" maxlength="80" placeholder="Full name" />
      <input id="platformStaffEmail" maxlength="120" placeholder="Email" />
      <select id="platformStaffRole"><option value="admin">Admin</option><option value="owner">Owner</option></select>
      <button class="warning" onclick="addPlatformStaff()">+ EasyBev User</button>
    </div>
    <div class="platform-list">
      ${rows.map(([id,item]) => `
        <div class="platform-row platform-row-wide">
          <div><strong>${escapeHtml(item.name || "EasyBev user")}</strong><small>${escapeHtml(item.email || "No email set")} · ${escapeHtml(item.role || "admin")}</small></div>
          <div class="platform-row-actions">
            <span class="badge ${item.active !== false ? "active" : ""}">${item.active !== false ? "Active" : "Inactive"}</span>
            <button class="secondary" onclick="editPlatformStaff('${escapeJsString(id)}')">Edit</button>
            <button class="${item.active !== false ? "danger" : "blue"}" onclick="togglePlatformStaff('${escapeJsString(id)}')">${item.active !== false ? "Deactivate" : "Reactivate"}</button>
          </div>
        </div>`).join("")}
    </div>`;
}

async function addPlatformStaff() {
  if (!platformIsOwner()) return;
  const name = String(document.getElementById("platformStaffName")?.value || "").trim();
  const email = String(document.getElementById("platformStaffEmail")?.value || "").trim();
  const role = String(document.getElementById("platformStaffRole")?.value || "admin");
  if (!name) { alert("Enter the EasyBev staff member's name."); return; }
  const reason = requestPlatformReason(`Grant ${role} access`);
  if (!reason) return;
  const ref = db.ref("platform/staff").push();
  const item = {staffId:ref.key,name,email,role,active:true,createdAt:platformTimestamp(),updatedAt:platformTimestamp()};
  await ref.set(item);
  await writePlatformAudit("Platform user created", "platformStaff", ref.key, reason, null, item);
  showEasyBevToast("EasyBev user added", `${name} · ${role}`);
}

async function editPlatformStaff(id) {
  if (!platformIsOwner()) return;
  const item = latestPlatformStaff[id];
  if (!item) return;
  const nameValue = prompt("Name", String(item.name || ""));
  if (nameValue === null) return;
  const emailValue = prompt("Email", String(item.email || ""));
  if (emailValue === null) return;
  const roleValue = prompt("Role: owner or admin", String(item.role || "admin"));
  if (roleValue === null) return;
  const role = String(roleValue).trim().toLowerCase();
  if (!["owner","admin"].includes(role)) { alert("Role must be owner or admin."); return; }
  if (role !== item.role) {
    const reason = requestPlatformReason(`Change platform role to ${role}`);
    if (!reason) return;
    const activeOwners = Object.values(latestPlatformStaff || {}).filter(s => s && s.active !== false && s.role === "owner");
    if (item.role === "owner" && role !== "owner" && activeOwners.length <= 1) {
      alert("EasyBev must always retain at least one active Owner.");
      return;
    }
    await db.ref(`platform/staff/${id}`).update({name:String(nameValue).trim(),email:String(emailValue).trim(),role,updatedAt:platformTimestamp()});
    await writePlatformAudit("Platform role changed", "platformStaff", id, reason, item, {...item,name:String(nameValue).trim(),email:String(emailValue).trim(),role});
  }
  else {
    await db.ref(`platform/staff/${id}`).update({name:String(nameValue).trim(),email:String(emailValue).trim(),updatedAt:platformTimestamp()});
    await writePlatformAudit("Platform user updated", "platformStaff", id, "Owner staff profile maintenance", item, {...item,name:String(nameValue).trim(),email:String(emailValue).trim()});
  }
  showEasyBevToast("EasyBev user updated", String(nameValue).trim());
}

async function togglePlatformStaff(id) {
  if (!platformIsOwner()) return;
  const item = latestPlatformStaff[id];
  if (!item) return;
  const active = item.active !== false;
  if (active && item.role === "owner") {
    const activeOwners = Object.values(latestPlatformStaff || {}).filter(s => s && s.active !== false && s.role === "owner");
    if (activeOwners.length <= 1) {
      alert("The last active Owner cannot be deactivated.");
      return;
    }
  }
  const reason = requestPlatformReason(`${active ? "Deactivate" : "Reactivate"} EasyBev ${item.role || "admin"}`);
  if (!reason) return;
  await db.ref(`platform/staff/${id}`).update({active:!active,updatedAt:platformTimestamp()});
  await writePlatformAudit(active ? "Platform user deactivated" : "Platform user reactivated", "platformStaff", id, reason, item, {...item,active:!active});
  showEasyBevToast(active ? "EasyBev user deactivated" : "EasyBev user reactivated", item.name || id);
}

/* =========================================================
   OWNER: AUDIT
   ========================================================= */

function renderPlatformAudit(panel) {
  const allRows = Object.entries(latestPlatformAudit || {})
    .filter(([,item]) => item)
    .sort((a,b) => Number(b[1].createdAt||0)-Number(a[1].createdAt||0));
  const rows = (platformIsOwner()
    ? allRows
    : allRows.filter(([,item]) => item.actorRole === "EasyBev Admin" && item.targetType !== "platformStaff"))
    .slice(0, 60);

  panel.innerHTML = `${platformPanelHead(platformIsOwner() ? "Audit" : "Activity", platformIsOwner() ? "Full privileged platform history remains visible to ownership." : "Recent EasyBev Admin interventions for operational handover and continuity.")}
    <div class="platform-list platform-audit-list">
      ${rows.map(([,item]) => `
        <div class="platform-row platform-row-wide">
          <div><strong>${escapeHtml(item.action || "Platform change")}</strong><small>${escapeHtml(item.actorRole || "EasyBev")} · ${escapeHtml(item.targetType || "platform")} ${item.targetId ? `· ${escapeHtml(item.targetId)}` : ""}</small><p>${escapeHtml(item.reason || "No reason recorded")}</p></div>
          <time>${escapeHtml(platformNowLabel(item.createdAt))}</time>
        </div>`).join("") || '<p class="muted">No privileged platform changes recorded yet.</p>'}
    </div>`;
}

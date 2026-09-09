/* =========================================================
   SCALE / LIFECYCLE GUARDS
   =========================================================
   These helpers keep live subscriptions bounded and replaceable.
   They do not pretend a single RTDB instance can serve unlimited
   concurrent users; they make the browser client shard-ready by
   centralising listener lifecycle and bounded query patterns.
   ========================================================= */

const EASYBEV_SCALE_LIMITS = Object.freeze({
  managerRecentSessions: 250,
  platformRecentVenues: 250,
  platformPartnerApplications: 200,
  platformAnnouncements: 100,
  platformSupportCases: 300,
  platformAuditEvents: 200,
  platformRecentSessions: 150
});

const easyBevLiveListeners = new Map();
const easyBevRenderQueue = new Map();

function replaceLiveListener(key, query, eventName, handler) {
  const id = String(key || "");
  if (!id || !query || typeof handler !== "function") return () => {};
  removeLiveListener(id);
  query.on(eventName, handler);
  const unsubscribe = () => {
    try { query.off(eventName, handler); } catch (_) {}
  };
  easyBevLiveListeners.set(id, unsubscribe);
  return unsubscribe;
}

function removeLiveListener(key) {
  const id = String(key || "");
  const unsubscribe = easyBevLiveListeners.get(id);
  if (typeof unsubscribe === "function") {
    try { unsubscribe(); } catch (_) {}
  }
  easyBevLiveListeners.delete(id);
}

function removeLiveListenersByPrefix(prefix) {
  const value = String(prefix || "");
  [...easyBevLiveListeners.keys()]
    .filter(key => key.startsWith(value))
    .forEach(removeLiveListener);
}

function removeAllLiveListeners() {
  [...easyBevLiveListeners.keys()].forEach(removeLiveListener);
}

function scheduleUiRender(key, render) {
  const id = String(key || "render");
  if (easyBevRenderQueue.has(id)) return;
  const handle = requestAnimationFrame(() => {
    easyBevRenderQueue.delete(id);
    try { render(); } catch (error) { console.error(error); }
  });
  easyBevRenderQueue.set(id, handle);
}

function boundedRecentQuery(path, child, limit) {
  return db.ref(scopeDatabasePath(path)).orderByChild(child).limitToLast(Math.max(1, Number(limit || 100)));
}

/* Stable partition key for the current transition period. Guest QR links may
   include ?venue=<id>. Legacy one-venue links resolve to the existing primary
   venue. The next data migration can switch physical paths behind this key
   without changing the rest of the UI contract. */
const EASYBEV_DEFAULT_VENUE_ID = "venue-main";
function resolvedVenueId() {
  const accessVenue = currentVenueAccess && currentVenueAccess.venueId;
  const queryVenue = params.get("venue");
  return String(accessVenue || queryVenue || EASYBEV_DEFAULT_VENUE_ID).trim();
}

const EASYBEV_VENUE_SCOPED_ROOTS = new Set([
  "waiters", "sessions", "menuItems", "menuCategories", "menuUsage", "staff"
]);

function venuePath(path = "") {
  const clean = String(path || "").replace(/^\/+/, "");
  const base = `venues/${resolvedVenueId()}`;
  return clean ? `${base}/${clean}` : base;
}

function venueRef(path = "") {
  return db.ref(venuePath(path));
}

function scopeDatabasePath(path = "") {
  const clean = String(path || "").replace(/^\/+/, "");
  if (!clean) return clean;
  if (clean.startsWith("venues/")) return clean;
  const first = clean.split("/")[0];
  return EASYBEV_VENUE_SCOPED_ROOTS.has(first) ? venuePath(clean) : clean;
}

function scopeDatabaseUpdates(updates = {}) {
  return Object.fromEntries(
    Object.entries(updates || {}).map(([path, value]) => [scopeDatabasePath(path), value])
  );
}

function updateDatabaseRoot(updates = {}) {
  return db.ref().update(scopeDatabaseUpdates(updates));
}

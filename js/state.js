/* =========================================================
   FIREBASE CONFIGURATION
   ========================================================= */

const firebaseConfig = {

  apiKey:
    "AIzaSyDydmFMOw3Kd5lTXq_n0WGRIamM5cgO08o",

  authDomain:
    "easybev-prototype.firebaseapp.com",

  databaseURL:
    "https://easybev-prototype-default-rtdb.firebaseio.com/",

  projectId:
    "easybev-prototype",

  storageBucket:
    "easybev-prototype.firebasestorage.app",

  messagingSenderId:
    "1006818240163",

  appId:
    "1:1006818240163:web:765843bafcd931ff98c116"

};




/* =========================================================
   VENUE MENU CATEGORY DEFAULTS
   Categories are data, not hard-coded waiter screens. Management
   can rename, reorder, add and disable them after first setup.
   ========================================================= */

const DEFAULT_MENU_CATEGORIES = [
  { id: "drinks", name: "Drinks", sortOrder: 10 },
  { id: "shots", name: "Shots", sortOrder: 20 },
  { id: "starters", name: "Starters", sortOrder: 30 },
  { id: "mains", name: "Mains", sortOrder: 40 },
  { id: "dessert", name: "Dessert", sortOrder: 50 },
  { id: "sushi", name: "Sushi", sortOrder: 60 },
  { id: "other", name: "Other", sortOrder: 900 }
];

/* =========================================================
   APP STATE
   ========================================================= */

let db = null;

const params =
  new URLSearchParams(
    window.location.search
  );

const managerMode =
  params.get("manager") === "1";

const adminMode =
  params.get("admin") === "1";

const ownerMode =
  params.get("owner") === "1";

const waiterSlot =
  params.get("waiter");

let guestSlot =
  params.get("guest");


/* Legacy table links continue to resolve to permanent waiter slots. */

const legacyTable =
  params.get("table");

if (
  !guestSlot &&
  legacyTable
) {

  guestSlot =
    legacyTable === "8"
      ? "2"
      : "1";

}


let managerSelectedSlot = null;
let latestManagerWaiters = {};
let latestManagerSessions = {};
let latestManagerMenuItems = {};
let latestManagerMenuCategories = {};
let latestManagerStaff = {};

let currentGuestUserId = null;
let currentGuestProfile = null;

let currentSessionId = null;
let currentSession = null;
let currentGuestWaiterName = null;

let itemModalSessionId = null;
let itemModalWaiterName = null;
let itemModalWaiterStaffId = null;
let itemModalCatalog = [];
let itemModalCategories = [];
let itemModalActiveCategoryId = "__frequent__";
let itemModalLastRound = [];
let itemModalBatchId = null;
let reconcileModalSessionId = null;
let handoverModalSessionId = null;


/* Lightweight attention state. Unread state stays local to the waiter device. */
let latestWaiterSessions = {};
let waiterAlertPrimed = false;
const waiterEventWatermarks = {};
let guestAlertPrimed = false;
let lastGuestWaiterMessageAt = 0;
let easyBevAudioContext = null;




/* Platform governance state */
let currentPlatformRole = null;
let latestPlatformCompany = {};
let latestPlatformVenues = {};
let latestPlatformPartnerApplications = {};
let latestPlatformVenuePeople = {};
let latestPlatformVenueInvites = {};
let latestPlatformStaff = {};
let latestPlatformAnnouncements = {};
let latestPlatformSupportCases = {};
let latestPlatformFeatureFlags = {};
let latestPlatformAudit = {};
let latestPlatformSessions = {};
let latestPlatformWaiters = {};
let platformAnnouncementUnsubscribe = null;

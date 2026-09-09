const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { execFileSync } = require('child_process');
const { getAuth } = require('firebase-admin/auth');

const PROJECT_ID = 'easybev-prototype';
const DATABASE_URL = 'https://easybev-prototype-default-rtdb.firebaseio.com/';
const VENUE_ID = 'venue-main';
const OPERATIONAL_ROOTS = ['waiters', 'sessions', 'menuItems', 'menuCategories', 'menuUsage', 'staff'];

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID, databaseURL: DATABASE_URL });
const db = getDatabase();
const auth = getAuth();

function canonicalPhone(value) {
  let raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('+')) return '+' + raw.slice(1).replace(/\D/g, '');
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0027')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('0')) return '+27' + digits.slice(1);
  if (digits.startsWith('27')) return '+' + digits;
  return digits ? '+' + digits : '';
}

async function read(path) {
  const snap = await db.ref(path).once('value');
  return snap.val();
}

async function listPhoneAuthUsers() {
  const phoneToUid = new Map();
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      if (user.phoneNumber) phoneToUid.set(canonicalPhone(user.phoneNumber), user.uid);
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return phoneToUid;
}

async function main() {
  let project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
  try {
    const configured = execFileSync('gcloud', ['config', 'get-value', 'project'], { encoding: 'utf8' }).trim();
    if (configured && configured !== '(unset)') project = configured;
  } catch (_) {}
  if (project && project !== PROJECT_ID) {
    throw new Error(`Wrong project. Expected ${PROJECT_ID}, got ${project}`);
  }

  console.log(`EasyBev venue migration -> ${PROJECT_ID} / ${VENUE_ID}`);
  console.log('No legacy root data will be deleted.');

  const rootUpdates = {};
  let copiedRoots = 0;

  for (const name of OPERATIONAL_ROOTS) {
    const [legacy, existing] = await Promise.all([
      read(name),
      read(`venues/${VENUE_ID}/${name}`)
    ]);
    if (legacy && typeof legacy === 'object') {
      const merged = { ...(legacy || {}), ...(existing || {}) };
      rootUpdates[`venues/${VENUE_ID}/${name}`] = merged;
      copiedRoots += 1;
      console.log(`Prepared ${name}: ${Object.keys(legacy).length} legacy records`);
    }
  }

  const accessByUid = (await read('accessByUid')) || {};
  for (const [uid, access] of Object.entries(accessByUid)) {
    if (!access || typeof access !== 'object') continue;
    rootUpdates[`accessByUid/${uid}/venueId`] = String(access.venueId || VENUE_ID);
    if (String(access.role || '').toLowerCase() === 'waiter' && access.waiterSlot != null) {
      rootUpdates[`accessByUid/${uid}/waiterSlot`] = String(access.waiterSlot);
    }
  }

  if (Object.keys(rootUpdates).length) {
    await db.ref().update(rootUpdates);
  }

  const phoneToUid = await listPhoneAuthUsers();
  console.log(`Firebase phone identities found: ${phoneToUid.size}`);

  const profileUpdates = {};
  const users = (await read('users')) || {};
  for (const [legacyId, profile] of Object.entries(users)) {
    if (!profile || typeof profile !== 'object') continue;
    const phone = canonicalPhone(profile.phone);
    const uid = phoneToUid.get(phone);
    if (!uid) continue;

    const current = users[uid] && typeof users[uid] === 'object' ? users[uid] : {};
    const merged = {
      ...profile,
      ...current,
      phone,
      migratedFromLegacyUserId: legacyId !== uid ? legacyId : (current.migratedFromLegacyUserId || null),
      identityMigratedAt: Date.now(),
      updatedAt: Date.now()
    };
    if (!merged.migratedFromLegacyUserId) delete merged.migratedFromLegacyUserId;
    profileUpdates[`users/${uid}`] = merged;
  }

  if (Object.keys(profileUpdates).length) {
    await db.ref().update(profileUpdates);
  }

  const sessionsPath = `venues/${VENUE_ID}/sessions`;
  const sessions = (await read(sessionsPath)) || {};
  const sessionUpdates = {};
  let sessionIdentityMigrations = 0;

  for (const [sessionId, session] of Object.entries(sessions)) {
    if (!session || typeof session !== 'object') continue;
    const phone = canonicalPhone(session.guestPhone);
    const uid = phoneToUid.get(phone);
    if (!uid) continue;

    if (session.guestUserId && session.guestUserId !== uid) {
      sessionUpdates[`${sessionsPath}/${sessionId}/legacyGuestUserId`] = session.guestUserId;
    }
    sessionUpdates[`${sessionsPath}/${sessionId}/guestUserId`] = uid;
    sessionUpdates[`${sessionsPath}/${sessionId}/guestPhone`] = phone;
    sessionUpdates[`${sessionsPath}/${sessionId}/identityMigratedAt`] = Date.now();
    sessionIdentityMigrations += 1;
  }

  if (Object.keys(sessionUpdates).length) {
    await db.ref().update(sessionUpdates);
  }

  const company = (await read('platform/company')) || {};
  const featureFlags = (await read('platform/featureFlags')) || {};
  const publicUpdates = {
    'platform/publicService/companyName': String(company.companyName || 'EasyBev'),
    'platform/publicService/serviceStatus': String(company.serviceStatus || 'operational'),
    'platform/publicService/serviceMessage': String(company.serviceMessage || 'All systems operating normally.'),
    'platform/publicService/paymentIntegrationReady': company.paymentIntegrationReady === true,
    'platform/publicService/updatedAt': Date.now()
  };
  for (const [key, item] of Object.entries(featureFlags)) {
    if (!item || typeof item !== 'object') continue;
    publicUpdates[`platform/publicFeatureFlags/${key}/key`] = key;
    publicUpdates[`platform/publicFeatureFlags/${key}/label`] = String(item.label || key);
    publicUpdates[`platform/publicFeatureFlags/${key}/enabled`] = item.enabled === true;
    publicUpdates[`platform/publicFeatureFlags/${key}/updatedAt`] = Date.now();
  }
  await db.ref().update(publicUpdates);

  console.log('SUCCESS');
  console.log(`Operational roots copied: ${copiedRoots}`);
  console.log(`Guest sessions linked to Firebase phone identities: ${sessionIdentityMigrations}`);
  console.log('Legacy root operational data was retained for rollback.');
}

main().then(() => process.exit(0)).catch(error => {
  console.error('FAILED:', error);
  process.exit(1);
});

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { execFileSync } = require('child_process');

const PROJECT_ID = 'easybev-prototype';
const DATABASE_URL = 'https://easybev-prototype-default-rtdb.firebaseio.com/';
const VENUE_ID = 'venue-main';
const ROOTS = ['waiters', 'sessions', 'menuItems', 'menuCategories', 'menuUsage', 'staff'];

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID, databaseURL: DATABASE_URL });
const db = getDatabase();

async function main() {
  let project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
  try {
    const configured = execFileSync('gcloud', ['config', 'get-value', 'project'], { encoding: 'utf8' }).trim();
    if (configured && configured !== '(unset)') project = configured;
  } catch (_) {}
  if (project && project !== PROJECT_ID) {
    throw new Error(`Wrong project. Expected ${PROJECT_ID}, got ${project}`);
  }

  const updates = {};
  for (const name of ROOTS) {
    const snap = await db.ref(`venues/${VENUE_ID}/${name}`).once('value');
    const value = snap.val();
    if (value && typeof value === 'object') updates[name] = value;
  }
  await db.ref().update(updates);
  console.log('SUCCESS - namespaced venue data copied back to legacy root paths.');
  console.log('No namespaced data was deleted. Re-publish the previous app/rules only if rollback is actually required.');
}

main().then(() => process.exit(0)).catch(error => {
  console.error('FAILED:', error);
  process.exit(1);
});

const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const configData = fs.readFileSync('firebase-applet-config.json', 'utf-8');
const firebaseConfig = JSON.parse(configData);

initializeApp({
  projectId: firebaseConfig.projectId
});

const adminDb = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(firebaseConfig.firestoreDatabaseId)
  : getFirestore();

async function test() {
  try {
    const doc = await adminDb.collection('users').limit(1).get();
    console.log("SUCCESS:", doc.empty ? "Empty" : "Has data");
  } catch(e) {
    console.error("ERROR:", e);
  }
}
test();

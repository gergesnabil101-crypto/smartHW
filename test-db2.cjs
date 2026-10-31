const admin = require('firebase-admin');
const fs = require('fs');

const configData = fs.readFileSync('firebase-applet-config.json', 'utf-8');
const firebaseConfig = JSON.parse(configData);

admin.initializeApp({
  projectId: firebaseConfig.projectId,
  credential: admin.credential.applicationDefault()
});

const adminDb = firebaseConfig.firestoreDatabaseId 
  ? admin.firestore(firebaseConfig.firestoreDatabaseId)
  : admin.firestore();

async function test() {
  try {
    const doc = await adminDb.collection('users').limit(1).get();
    console.log("SUCCESS:", doc.empty ? "Empty" : "Has data");
  } catch(e) {
    console.error("ERROR:", e);
  }
}
test();

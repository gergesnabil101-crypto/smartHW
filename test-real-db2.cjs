const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const configData = fs.readFileSync('firebase-applet-config.json', 'utf-8');
const firebaseConfig = JSON.parse(configData);

initializeApp({ projectId: firebaseConfig.projectId });
const adminDb = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(firebaseConfig.firestoreDatabaseId)
  : getFirestore();

async function run() {
  try {
    const docRef = adminDb.collection('test_auth').doc('test1');
    await docRef.set({ timestamp: Date.now() });
    console.log('SUCCESS');
  } catch (err) {
    console.error('FAILED:', err.message);
  }
}
run();

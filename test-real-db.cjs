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
    const docRef = adminDb.collection('results').doc('test_admin_sdk');
    await docRef.set({ test: true });
    console.log('Admin SDK bypassed rules successfully!');
  } catch (err) {
    console.error('Admin SDK failed:', err.message);
  }
}
run();

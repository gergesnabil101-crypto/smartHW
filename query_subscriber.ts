import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const configData = fs.readFileSync('firebase-applet-config.json', 'utf-8');
const firebaseConfig = JSON.parse(configData);

if (getApps().length === 0) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const defaultAdminApp = getApps()[0];
const adminDb = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(defaultAdminApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(defaultAdminApp);

async function checkSubscriber() {
  const email = 'hanytharwatabushouka@gmail.com';
  console.log(`Searching for user: ${email}`);
  
  try {
    const usersSnap = await adminDb.collection('users')
      .where('email', '==', email)
      .get();
      
    if (usersSnap.empty) {
      console.log('No user found in "users" collection with this email.');
      // Also check case insensitive or list all users
      const allUsers = await adminDb.collection('users').get();
      console.log(`Total users in DB: ${allUsers.size}`);
      allUsers.forEach(doc => {
        console.log(`- ${doc.id}: ${doc.data().email} (Name: ${doc.data().name})`);
      });
    } else {
      usersSnap.forEach(doc => {
        console.log('User Document found:', doc.id);
        console.log(JSON.stringify(doc.data(), null, 2));
      });
    }

    // Check token usage logs for this email
    console.log(`\nChecking token_usage_logs for email: ${email}`);
    const logsSnap = await adminDb.collection('token_usage_logs')
      .where('user_email', '==', email)
      .get();
    console.log(`Found ${logsSnap.size} logs by user_email`);
    
    let totalLogTokens = 0;
    logsSnap.forEach(ld => {
      const l = ld.data();
      const p = Number(l.prompt_tokens || 0);
      const c = Number(l.candidates_tokens || 0);
      const rowTokens = p + c * 5;
      totalLogTokens += rowTokens;
      console.log(`Log ID: ${ld.id} | Prompt: ${p} | Candidates: ${c} | Calculated: ${rowTokens} | Date: ${l.created_at || l.timestamp}`);
    });
    console.log(`Total calculated tokens from user_email logs: ${totalLogTokens}`);

    // If no logs found by email, let's look for user ID or fetch all logs
    const allLogs = await adminDb.collection('token_usage_logs').get();
    console.log(`\nTotal token_usage_logs in DB: ${allLogs.size}`);
    let totalAllLogTokens = 0;
    allLogs.forEach(ld => {
      const l = ld.data();
      console.log(`Log ID: ${ld.id} | Email: ${l.user_email} | UID: ${l.user_id} | Prompt: ${l.prompt_tokens} | Candidates: ${l.candidates_tokens}`);
    });

  } catch (error) {
    console.error('Error querying database:', error);
  }
}

checkSubscriber();

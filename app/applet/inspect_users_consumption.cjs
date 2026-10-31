const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) {
  initializeApp({
    projectId: 'ai-studio-3e658ca0-5c16-45ce-bb53-8aced7836d45'
  });
}

const db = getFirestore();

async function run() {
  console.log('--- Fetching Users ---');
  const usersSnap = await db.collection('users').get();
  console.log(`Found ${usersSnap.size} users:`);
  
  const users = [];
  usersSnap.forEach(d => {
    users.push({ id: d.id, ...d.data() });
  });

  const logsSnap = await db.collection('token_usage_logs').get();
  console.log(`Total token_usage_logs: ${logsSnap.size}`);

  const quizzesSnap = await db.collection('quizzes').get();
  console.log(`Total quizzes: ${quizzesSnap.size}`);

  const resultsSnap = await db.collection('results').get();
  console.log(`Total results: ${resultsSnap.size}`);

  for (const u of users) {
    const userLogs = [];
    logsSnap.forEach(ld => {
      const l = ld.data();
      if (l.user_id === u.id || (l.user_email && l.user_email.toLowerCase() === (u.email || '').toLowerCase())) {
        userLogs.push(l);
      }
    });

    const userQuizzes = [];
    quizzesSnap.forEach(qd => {
      const q = qd.data();
      if (q.user_id === u.id || q.teacher_id === u.id || (q.teacher_email && q.teacher_email.toLowerCase() === (u.email || '').toLowerCase())) {
        userQuizzes.push({ id: qd.id, ...q });
      }
    });

    let totalLogTokens = 0;
    userLogs.forEach(l => {
      const p = Number(l.prompt_tokens || 0);
      const c = Number(l.candidates_tokens || 0);
      totalLogTokens += (p + c * 5); // Billable formula
    });

    console.log(`User: ${u.name || 'No Name'} | Email: ${u.email} | Sub: ${u.subscription_type || 'none'} (${u.subscription_status || 'inactive'})`);
    console.log(`   Tokens in Doc -> used: ${u.tokens_used}, today: ${u.tokens_used_today}, total: ${u.tokens_used_total}, extra: ${u.extra_tokens || 0}`);
    console.log(`   Direct Logs -> count: ${userLogs.length}, calcTokens: ${totalLogTokens}`);
    console.log(`   Quizzes -> count: ${userQuizzes.length}`);
  }
}

run().catch(console.error);

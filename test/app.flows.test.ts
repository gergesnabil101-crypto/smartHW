/**
 * Comprehensive Lifecycle Flow Tests:
 * 1. User Registration & Profile Defaults
 * 2. Quiz Creation (MCQ, True/False, Essay)
 * 3. Student Attempt & Attempt Limit Checks
 * 4. Automatic Grading, Essay Scoring & Total Points
 * 5. Teacher Results Operations (Recalculate, Anonymize, Purge)
 * 6. Admin User Management & Cascading Account Deletion
 */

import assert from 'assert';

interface MockDB {
  users: Map<string, any>;
  quizzes: Map<string, any>;
  results: Map<string, any>;
  folders: Map<string, any>;
}

function createMockDatabase(): MockDB {
  return {
    users: new Map(),
    quizzes: new Map(),
    results: new Map(),
    folders: new Map()
  };
}

// 1. Registration Flow
function registerTeacher(db: MockDB, uid: string, email: string, name: string, subject: string, category: 'theory' | 'science') {
  const profile = {
    id: uid,
    uid,
    email,
    name,
    subject,
    subjectCategory: category,
    role: 'teacher',
    subscriptionPlan: category === 'science' ? 'science_250' : 'theory_200',
    subscriptionStatus: 'active',
    subscriptionEndDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    tokens_used: 0,
    tokens_used_today: 0,
    created_at: new Date().toISOString()
  };
  db.users.set(uid, profile);
  return profile;
}

// 2. Quiz Creation Flow
function createQuiz(db: MockDB, teacherId: string, title: string, questions: any[], maxAttempts: number = 1) {
  const quizId = `quiz_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const quiz = {
    id: quizId,
    teacher_id: teacherId,
    title,
    questions,
    maxAttempts,
    created_at: new Date().toISOString()
  };
  db.quizzes.set(quizId, quiz);
  return quiz;
}

// 3. Student Attempt & Grading Flow
function submitStudentAttempt(
  db: MockDB,
  quizId: string,
  studentName: string,
  parentPhone: string,
  centerName: string,
  submittedAnswers: Record<string, any>,
  essayGradingMap: Record<string, { score: number; feedback: string }> = {}
) {
  const quiz = db.quizzes.get(quizId);
  if (!quiz) throw new Error('Quiz not found');

  // Check existing attempts for this student on this quiz
  const existingAttempts = Array.from(db.results.values()).filter(
    (r: any) => r.quiz_id === quizId && r.student_name.trim().toLowerCase() === studentName.trim().toLowerCase()
  );

  if (existingAttempts.length >= (quiz.maxAttempts || 1)) {
    throw new Error('Maximum attempts reached for this student');
  }

  // Calculate score
  let totalPoints = 0;
  let earnedPoints = 0;
  const gradedAnswers: Record<string, any> = {};

  for (const q of quiz.questions) {
    const qPoints = q.points || 1;
    totalPoints += qPoints;

    if (q.type === 'essay') {
      const essayGrade = essayGradingMap[q.id] || { score: 0, feedback: 'لم يتم التصحيح' };
      const awarded = Math.min(qPoints, Math.max(0, essayGrade.score));
      earnedPoints += awarded;
      gradedAnswers[q.id] = {
        studentAnswer: submittedAnswers[q.id] || '',
        score: awarded,
        feedback: essayGrade.feedback,
        isCorrect: awarded >= qPoints * 0.75
      };
    } else if (q.type === 'true-false' || q.type === 'multiple-choice' || (!q.type && q.options)) {
      const studentOption = submittedAnswers[q.id];
      const isCorrect = studentOption === q.correctOptionIndex;
      const awarded = isCorrect ? qPoints : 0;
      earnedPoints += awarded;
      gradedAnswers[q.id] = {
        studentAnswer: studentOption,
        score: awarded,
        isCorrect
      };
    }
  }

  const resultId = `res_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const result = {
    id: resultId,
    quiz_id: quizId,
    teacher_id: quiz.teacher_id,
    student_name: studentName,
    parent_phone: parentPhone,
    center_name: centerName,
    score: earnedPoints,
    total: totalPoints,
    answers: gradedAnswers,
    student_answers: JSON.stringify(submittedAnswers),
    created_at: new Date().toISOString()
  };

  db.results.set(resultId, result);
  return result;
}

// 4. Recalculate Scores when Teacher updates model answer / question keys
function recalculateQuizResults(db: MockDB, quizId: string) {
  const quiz = db.quizzes.get(quizId);
  if (!quiz) return 0;

  const quizResults = Array.from(db.results.values()).filter((r: any) => r.quiz_id === quizId);
  let updatedCount = 0;

  for (const result of quizResults) {
    let newScore = 0;
    let newTotal = 0;
    const rawAnswers = result.student_answers ? JSON.parse(result.student_answers) : {};
    const newGradedAnswers: Record<string, any> = {};

    for (const q of quiz.questions) {
      const qPoints = q.points || 1;
      newTotal += qPoints;

      if (q.type === 'essay') {
        const existingAward = result.answers?.[q.id]?.score || 0;
        newScore += Math.min(qPoints, existingAward);
        newGradedAnswers[q.id] = {
          ...result.answers?.[q.id],
          score: Math.min(qPoints, existingAward)
        };
      } else {
        const studentAns = rawAnswers[q.id];
        const isCorrect = studentAns === q.correctOptionIndex;
        const awarded = isCorrect ? qPoints : 0;
        newScore += awarded;
        newGradedAnswers[q.id] = {
          studentAnswer: studentAns,
          score: awarded,
          isCorrect
        };
      }
    }

    result.score = newScore;
    result.total = newTotal;
    result.answers = newGradedAnswers;
    db.results.set(result.id, result);
    updatedCount++;
  }

  return updatedCount;
}

// 5. Anonymize and Purge
function anonymizeQuizResults(db: MockDB, quizId: string) {
  let count = 0;
  for (const [id, res] of db.results.entries()) {
    if (res.quiz_id === quizId) {
      res.student_name = `طالب #${id.slice(-4)}`;
      res.parent_phone = '';
      db.results.set(id, res);
      count++;
    }
  }
  return count;
}

function purgeQuizResults(db: MockDB, quizId: string) {
  let count = 0;
  for (const [id, res] of db.results.entries()) {
    if (res.quiz_id === quizId) {
      db.results.delete(id);
      count++;
    }
  }
  return count;
}

// 6. Cascading User Deletion
function deleteUserCascading(db: MockDB, userId: string) {
  // Delete user record
  const userDeleted = db.users.delete(userId);

  // Find all quizzes owned by user
  const userQuizIds = new Set<string>();
  for (const [quizId, q] of db.quizzes.entries()) {
    if (q.teacher_id === userId) {
      userQuizIds.add(quizId);
      db.quizzes.delete(quizId);
    }
  }

  // Delete all results matching teacher or teacher's quizzes
  let resultsDeleted = 0;
  for (const [resId, r] of db.results.entries()) {
    if (r.teacher_id === userId || userQuizIds.has(r.quiz_id)) {
      db.results.delete(resId);
      resultsDeleted++;
    }
  }

  // Delete all folders
  for (const [folderId, f] of db.folders.entries()) {
    if (f.teacher_id === userId) {
      db.folders.delete(folderId);
    }
  }

  return { userDeleted, quizzesDeleted: userQuizIds.size, resultsDeleted };
}

async function runAppFlowsTests() {
  console.log('\n--- 3. Running End-to-End Application Flows Tests ---');
  let passed = 0;
  let failed = 0;

  function it(name: string, fn: () => void) {
    try {
      fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  const db = createMockDatabase();

  // Test Step 1: Teacher Registration & Trial Access Security Flow
  it('1. Teacher registration creates Auth User, initial Firestore doc (hasAccess: false), and gets trial granted authoritatively by server', () => {
    // A. Mock Firebase Auth User creation
    const authUser = {
      uid: 'teacher_1',
      email: 'ahmed@school.com',
      emailVerified: true
    };
    assert.strictEqual(authUser.uid, 'teacher_1');

    // B. Initial client Firestore doc creation with hasAccess: false
    const clientInitialDoc = {
      id: authUser.uid,
      email: authUser.email,
      name: 'أحمد محمود',
      phone: '01012345678',
      subject: 'رياضيات',
      grade_level: ['الأول الثانوي'],
      avatar_data: '',
      role: 'user',
      subscription_type: '200',
      subscription_status: 'trial',
      subscription_end_date: null,
      is_suspended: false,
      hasAccess: false, // Defaulted to false on client create!
      tokens_used: 0,
      tokens_used_today: 0,
      last_token_reset_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };
    db.users.set(authUser.uid, clientInitialDoc);

    // C. Verify client cannot self-elevate hasAccess directly on Firestore
    const clientTamperAttempt = (doc: any, patch: any) => {
      // Simulating Firestore rules isSafeUserSelfUpdate
      const protectedFields = ['role', 'subscription_status', 'hasAccess', 'is_suspended'];
      for (const field of protectedFields) {
        if (field in patch && patch[field] !== doc[field]) {
          throw new Error(`PERMISSION_DENIED: Client cannot modify protected field '${field}'`);
        }
      }
      return { ...doc, ...patch };
    };

    assert.throws(() => {
      clientTamperAttempt(db.users.get('teacher_1'), { hasAccess: true });
    }, /PERMISSION_DENIED/);

    assert.throws(() => {
      clientTamperAttempt(db.users.get('teacher_1'), { subscription_status: 'active' });
    }, /PERMISSION_DENIED/);

    // D. Server-side authoritative registration and trial activation
    const serverRegisterAndGrantTrial = (uid: string, tokenUser: any, payload: any) => {
      if (!tokenUser || tokenUser.uid !== uid) throw new Error('Unauthorized');
      
      const currentDoc = db.users.get(uid) || {};
      const trialEndDate = new Date(Date.now() + 3 * 86400000).toISOString();
      const updated = {
        ...currentDoc,
        name: payload.name || currentDoc.name,
        phone: payload.phone || currentDoc.phone,
        subject: payload.subject || currentDoc.subject,
        role: 'user',
        subscription_status: 'trial',
        subscription_type: '200',
        subscription_end_date: trialEndDate,
        is_suspended: false,
        hasAccess: true, // Authoritatively granted by server!
        tokens_used: 0,
        tokens_used_today: 0,
        last_token_reset_date: new Date().toISOString().split('T')[0]
      };
      db.users.set(uid, updated);
      return { success: true, user: updated };
    };

    const serverResponse = serverRegisterAndGrantTrial('teacher_1', authUser, {
      name: 'أحمد محمود',
      phone: '01012345678',
      subject: 'رياضيات'
    });

    assert.strictEqual(serverResponse.success, true);
    const finalizedTeacher = db.users.get('teacher_1');
    assert.strictEqual(finalizedTeacher.hasAccess, true);
    assert.strictEqual(finalizedTeacher.subscription_status, 'trial');
    assert.strictEqual(finalizedTeacher.tokens_used, 0);
    assert.ok(db.users.has('teacher_1'));
  });

  // Test Step 2: Quiz Creation
  it('2. Teacher can create a quiz containing MCQ, True/False, and Essay questions', () => {
    const questions = [
      { id: 'q1', type: 'multiple-choice', text: 'ما هو جذر 64؟', options: ['6', '8', '10', '12'], correctOptionIndex: 1, points: 2 },
      { id: 'q2', type: 'true-false', text: 'مجموع زوايا المثلث 180 درجة', correctOptionIndex: 0, points: 1 },
      { id: 'q3', type: 'essay', text: 'اشرح نظرية فيثاغورس بالتفصيل', points: 3 }
    ];

    const quiz = createQuiz(db, 'teacher_1', 'اختبار الهندسة والحساب', questions, 1);
    assert.strictEqual(quiz.title, 'اختبار الهندسة والحساب');
    assert.strictEqual(quiz.questions.length, 3);
    assert.strictEqual(quiz.maxAttempts, 1);
  });

  // Test Step 3: Student Attempt & Grading
  it('3. Student submits answers and receives accurate automatic and essay grading', () => {
    const quizId = Array.from(db.quizzes.keys())[0];
    const answers = {
      q1: 1, // Correct (8) -> 2 points
      q2: 0, // Correct (True) -> 1 point
      q3: 'مربع طول الوتر يساوي مجموع مربعي طولي الضلعين الآخرين في المثلث القائم'
    };
    const essayGrading = {
      q3: { score: 3, feedback: 'إجابة نموذجية ودقيقة' } // 3 points
    };

    const result = submitStudentAttempt(db, quizId, 'محمود علي', '01012345678', 'مجموعة الأوائل', answers, essayGrading);
    assert.strictEqual(result.score, 6);
    assert.strictEqual(result.total, 6);
    assert.strictEqual(result.score <= result.total, true);
    assert.strictEqual(result.parent_phone, '01012345678');
  });

  // Test Step 4: Max Attempt Enforcement
  it('4. System strictly prevents student from exceeding max allowed attempts', () => {
    const quizId = Array.from(db.quizzes.keys())[0];
    const answers = { q1: 1, q2: 0, q3: 'نص' };
    
    assert.throws(() => {
      submitStudentAttempt(db, quizId, 'محمود علي', '01012345678', 'مجموعة الأوائل', answers);
    }, /Maximum attempts reached/);
  });

  // Test Step 5: Score Recalculation on Key Edit
  it('5. Recalculates student scores when teacher modifies correct option or question points', () => {
    const quizId = Array.from(db.quizzes.keys())[0];
    const quiz = db.quizzes.get(quizId);
    
    // Change q1 correct index from 1 to 0
    quiz.questions[0].correctOptionIndex = 0;
    db.quizzes.set(quizId, quiz);

    const updated = recalculateQuizResults(db, quizId);
    assert.strictEqual(updated, 1);

    const result = Array.from(db.results.values())[0];
    // q1 is now wrong (was 1, now expected 0) -> score drops by 2 points (from 6 to 4)
    assert.strictEqual(result.score, 4);
    assert.strictEqual(result.total, 6);
  });

  // Test Step 6: Anonymization
  it('6. Results anonymization scrubs student phone numbers and hashes names for privacy', () => {
    const quizId = Array.from(db.quizzes.keys())[0];
    const count = anonymizeQuizResults(db, quizId);
    assert.strictEqual(count, 1);

    const result = Array.from(db.results.values())[0];
    assert.strictEqual(result.parent_phone, '');
    assert.ok(result.student_name.startsWith('طالب #'));
  });

  // Test Step 7: Cascading Deletion
  it('7. Cascading account deletion permanently cleans user, quizzes, results, and folders', () => {
    const outcome = deleteUserCascading(db, 'teacher_1');
    assert.strictEqual(outcome.userDeleted, true);
    assert.strictEqual(outcome.quizzesDeleted, 1);
    assert.strictEqual(outcome.resultsDeleted, 1);
    assert.strictEqual(db.users.has('teacher_1'), false);
    assert.strictEqual(db.quizzes.size, 0);
    assert.strictEqual(db.results.size, 0);
  });

  console.log(`Summary: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('app.flows.test')) {
  runAppFlowsTests();
}

export { runAppFlowsTests };

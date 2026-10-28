import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, increment } from 'firebase/firestore';

const ADMIN_EMAIL = 'gergesnabil101@gmail.com';
let env: RulesTestEnvironment;
let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  FAIL ${name}: ${e?.message || e}`);
  }
}

const today = new Date().toISOString().split('T')[0];
const registrationDoc = (email: string) => ({
  email,
  name: 'Teacher',
  phone: '01000000000',
  subject: 'math',
  grade_level: ['1'],
  avatar_data: '',
  role: 'user',
  subscription_type: '200',
  subscription_end_date: null,
  subscription_status: 'trial',
  is_suspended: false,
  hasAccess: true,
  tokens_used: 0,
  tokens_used_today: 0,
  last_token_reset_date: today,
  created_at: new Date().toISOString()
});

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

async function main() {
  env = await initializeTestEnvironment({
    projectId: 'demo-smarthw',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });

  const teacher = () => env.authenticatedContext('teacherA', { email: 'a@example.com' }).firestore();
  const otherTeacher = () => env.authenticatedContext('teacherB', { email: 'b@example.com' }).firestore();
  const admin = () => env.authenticatedContext('adminUid', { email: ADMIN_EMAIL }).firestore();
  const anon = () => env.unauthenticatedContext().firestore();

  // Teachers' own profile/token writes are performed server-side (Admin SDK); these tests only
  // cover entitlement escalation and admin activation.
  console.log('users: admin activation');
  await seed('users/teacherA', registrationDoc('a@example.com'));
  await test('admin activates subscription and token package', () =>
    assertSucceeds(updateDoc(doc(admin(), 'users/teacherA'), {
      subscription_status: 'active', subscription_end_date: '2027-01-01T00:00:00.000Z', custom_tokens_millions: 5, extra_tokens: 100000
    })));

  console.log('users: privilege escalation is blocked');
  await seed('users/teacherB', registrationDoc('b@example.com'));
  const escalations: Record<string, unknown> = {
    custom_tokens_millions: 1000,
    extra_tokens: 999999999,
    subscription_end_date: '2099-12-31T00:00:00.000Z',
    subscription_status: 'active',
    trial_extended_until: '2099-12-31T00:00:00.000Z',
    custom_plan_name: 'Pro',
    isAdmin: true,
    role: 'admin',
    hasAccess: false
  };
  for (const [field, value] of Object.entries(escalations)) {
    await test(`teacher cannot set ${field}`, () =>
      assertFails(updateDoc(doc(otherTeacher(), 'users/teacherB'), { [field]: value })));
  }
  await seed('users/legacyUser', { email: 'c@example.com', name: 'Legacy' });
  await test('legacy profile without role cannot add role=admin', () =>
    assertFails(updateDoc(doc(env.authenticatedContext('legacyUser', { email: 'c@example.com' }).firestore(), 'users/legacyUser'), { role: 'admin' })));
  await test('legacy profile without end date cannot add one', () =>
    assertFails(updateDoc(doc(env.authenticatedContext('legacyUser', { email: 'c@example.com' }).firestore(), 'users/legacyUser'), { subscription_end_date: '2099-12-31T00:00:00.000Z' })));
  await test('self-registration cannot start as active', () =>
    assertFails(setDoc(doc(env.authenticatedContext('newUser1', { email: 'n1@example.com' }).firestore(), 'users/newUser1'),
      { ...registrationDoc('n1@example.com'), subscription_status: 'active', subscription_end_date: '2099-12-31T00:00:00.000Z' })));
  await test('self-registration cannot include a token package', () =>
    assertFails(setDoc(doc(env.authenticatedContext('newUser2', { email: 'n2@example.com' }).firestore(), 'users/newUser2'),
      { ...registrationDoc('n2@example.com'), custom_tokens_millions: 100 })));
  await test('teacher cannot edit another teacher profile', () =>
    assertFails(updateDoc(doc(otherTeacher(), 'users/teacherA'), { name: 'hacked' })));

  console.log('students');
  const student = { id: 's1', name: 'Student', phone: '', parent_phone: '', center_name: '', grade_level: '', subject: '', teacher_name: 'A', teacher_id: 'teacherA', exams_taken: 1, last_score: null, total_score: null, last_date: new Date().toISOString(), code: 'ABC123' };
  await test('teacher creates own student code', () => assertSucceeds(setDoc(doc(teacher(), 'students/s1'), student)));
  await test('teacher updates own student code', () => assertSucceeds(setDoc(doc(teacher(), 'students/s1'), { ...student, code: 'XYZ999' }, { merge: true })));
  await test('other teacher cannot overwrite the student', () => assertFails(setDoc(doc(otherTeacher(), 'students/s1'), { ...student, teacher_id: 'teacherB' })));
  await test('other teacher cannot delete the student', () => assertFails(deleteDoc(doc(otherTeacher(), 'students/s1'))));
  await test('teacher deletes own student', () => assertSucceeds(deleteDoc(doc(teacher(), 'students/s1'))));
  await seed('students/s2', { ...student, id: 's2' });
  await test('admin deletes any student', () => assertSucceeds(deleteDoc(doc(admin(), 'students/s2'))));

  console.log('student quiz flow (must keep working)');
  await seed('quizzes/q1', { id: 'q1', user_id: 'teacherA', title: 'Quiz', data: '{}', created_at: new Date().toISOString() });
  await test('anonymous student submits a result', () =>
    assertSucceeds(setDoc(doc(anon(), 'results/r1'), {
      id: 'r1', quiz_id: 'q1', quiz_title: 'Quiz', student_name: 'Student', student_phone: '', parent_phone: '', student_email: '',
      student_code: '', phone: '', center_name: 'عام', score: 5, total: 10, feedback: '[]', student_answers: '{}', is_graded: true,
      created_at: new Date().toISOString(), teacher_id: 'teacherA', user_id: 'teacherA', teacher_name: 'A', subject: '', grade_level: '',
      time_spent_seconds: 60, duration: 60, ai_tokens_used: 0
    })));
  await test('teacher cannot write token usage logs (server-only)', () =>
    assertFails(setDoc(doc(teacher(), 'token_usage_logs/l1'), {
      id: 'l1', timestamp: new Date().toISOString(), user_id: 'teacherA', user_name: 'A', user_email: 'a@example.com',
      operation: 'essay_grading', operation_label: 'x', model: 'gemini-3.8-flash', prompt_tokens: 10, candidates_tokens: 5,
      cached_tokens: 0, total_tokens: 15, cost_usd: 0, cost_egp: 0, cost_sar: 0, quiz_id: '', quiz_title: '', student_name: ''
    })));

  await test('teacher cannot change own token counters (server-only)', () =>
    assertFails(updateDoc(doc(teacher(), 'users/teacherA'), { tokens_used: increment(500), tokens_used_today: 500 })));
  await test('teacher cannot change own tokens_used_total', () =>
    assertFails(updateDoc(doc(teacher(), 'users/teacherA'), { tokens_used_total: 999 })));

  await env.cleanup();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

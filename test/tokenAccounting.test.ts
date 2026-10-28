// Run with the Firestore emulator:
//   npx firebase-tools emulators:exec --only firestore --project demo-smarthw "npx tsx test/tokenAccounting.test.ts"
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  recordTokenUsage, computeBillableTokens, buildTokenLogId, computeCounterUpdate,
  FLASH_OUTPUT_MULTIPLIER, PRO_OUTPUT_MULTIPLIER, isTokenPlanUser
} from '../server/tokenAccounting.ts';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const app = initializeApp({ projectId: 'demo-smarthw' });
const db = getFirestore(app);

let passed = 0, failed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${name}\n      ${e?.message || e}`); }
}
const eq = (a: any, b: any, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };

async function resetUser(uid: string, data: any = {}) {
  await db.collection('users').doc(uid).set({ email: `${uid}@x.com`, name: uid, role: 'user', tokens_used: 0, tokens_used_total: 0, tokens_used_today: 0, ...data });
}
const readUser = async (uid: string) => (await db.collection('users').doc(uid).get()).data() || {};

async function main() {
  console.log('\nToken accounting');

  await test('multipliers are fixed: Flash x5, Pro x6 (profit margin)', () => {
    eq(FLASH_OUTPUT_MULTIPLIER, 5); eq(PRO_OUTPUT_MULTIPLIER, 6);
    eq(computeBillableTokens(1000, 100, 'gemini-3.8-flash'), 1500, 'flash');
    eq(computeBillableTokens(1000, 100, 'gemini-3.1-pro-preview'), 1600, 'pro');
    eq(computeBillableTokens(0, 0, 'gemini-3.8-flash'), 0, 'zero');
  });

  await test('same response within the same minute yields the same log id', () => {
    const now = new Date('2026-10-28T10:00:10Z');
    const p = { userId: 'u1', operation: 'essay_grading' as const, promptTokens: 300, candidatesTokens: 50, quizId: 'q1', studentName: 'Ali' };
    eq(buildTokenLogId(p, now), buildTokenLogId(p, new Date('2026-10-28T10:00:50Z')));
    if (buildTokenLogId(p, now) === buildTokenLogId({ ...p, studentName: 'Omar' }, now)) throw new Error('different student must differ');
  });

  await test('counter update resets today on a new day and always bumps lifetime total', () => {
    const u = computeCounterUpdate({ tokens_used: 100, tokens_used_total: 500, tokens_used_today: 40, last_token_reset_date: '2026-01-01' }, 10, new Date('2026-10-28T10:00:00Z'));
    eq(u.tokens_used, 110); eq(u.tokens_used_total, 510); eq(u.tokens_used_today, 10); eq(u.last_token_reset_date, '2026-10-28');
    const same = computeCounterUpdate({ tokens_used_today: 40, last_token_reset_date: '2026-10-28' }, 10, new Date('2026-10-28T12:00:00Z'));
    eq(same.tokens_used_today, 50);
  });

  await test('token plan detection matches pre-check definition', () => {
    eq(isTokenPlanUser({ subscription_type: 'token_2m' }), true);
    eq(isTokenPlanUser({ custom_tokens_millions: 3 }), true);
    eq(isTokenPlanUser({ subscription_type: 'monthly' }), false, 'monthly is NOT a token plan');
    eq(isTokenPlanUser({ subscription_type: 'monthly', extra_tokens: 1000 }), true);
  });

  await test('one Gemini response deducts exactly once (log + counters)', async () => {
    await resetUser('t1');
    const r = await recordTokenUsage(db, { userId: 't1', operation: 'quiz_generation', model: 'gemini-3.8-flash', promptTokens: 1000, candidatesTokens: 100 });
    eq(r.status, 'recorded');
    const u = await readUser('t1');
    eq(u.tokens_used, 1500); eq(u.tokens_used_total, 1500); eq(u.tokens_used_today, 1500);
    const log = await db.collection('token_usage_logs').doc(r.record!.id).get();
    eq(log.exists, true); eq(log.data()!.total_tokens, 1500);
  });

  await test('a duplicate of the same response is ignored', async () => {
    await resetUser('t2');
    const p = { userId: 't2', operation: 'essay_grading' as const, model: 'gemini-3.1-pro-preview', promptTokens: 200, candidatesTokens: 50, quizId: 'q9', studentName: 'Sara' };
    const a = await recordTokenUsage(db, p);
    const b = await recordTokenUsage(db, p);
    eq(a.status, 'recorded'); eq(b.status, 'duplicate');
    const u = await readUser('t2');
    eq(u.tokens_used, 500); eq(u.tokens_used_total, 500);
    const logs = await db.collection('token_usage_logs').where('user_id', '==', 't2').get();
    eq(logs.size, 1);
  });

  await test('20 concurrent distinct responses sum exactly, no lost increments', async () => {
    await resetUser('t3', { tokens_used: 10, tokens_used_total: 10 });
    await Promise.all(Array.from({ length: 20 }, (_, i) =>
      recordTokenUsage(db, { userId: 't3', operation: 'essay_grading', model: 'gemini-3.8-flash', promptTokens: 100 + i, candidatesTokens: 10, quizId: 'q', studentName: `s${i}` })));
    const u = await readUser('t3');
    const expected = 10 + Array.from({ length: 20 }, (_, i) => 100 + i + 50).reduce((a, b) => a + b, 0);
    eq(u.tokens_used, expected); eq(u.tokens_used_total, expected);
  });

  await test('zero usage metadata writes nothing (no fabricated tokens)', async () => {
    await resetUser('t4');
    const r = await recordTokenUsage(db, { userId: 't4', operation: 'essay_grading', promptTokens: 0, candidatesTokens: 0 });
    eq(r.status, 'skipped');
    eq((await readUser('t4')).tokens_used, 0);
  });

  await test('extra_tokens is never decremented by deduction', async () => {
    await resetUser('t5', { subscription_type: 'monthly', extra_tokens: 5000, tokens_used_today: 999999, last_token_reset_date: new Date().toISOString().split('T')[0] });
    await recordTokenUsage(db, { userId: 't5', operation: 'general', promptTokens: 100, candidatesTokens: 0 });
    eq((await readUser('t5')).extra_tokens, 5000);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });

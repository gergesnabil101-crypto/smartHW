import { normalizeGradingResult, safeParseAiJson, GRADING_RESPONSE_SCHEMA } from '../server/grading.ts';

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${name}\n      ${e?.message || e}`); }
}
const eq = (a: any, b: any, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

console.log('\nGrading normalization');

test('score is computed from steps, not from the model total', () => {
  const r = normalizeGradingResult({ score: 2, steps: [{ description: 'a', points: 1, earned: 1 }, { description: 'b', points: 1, earned: 0 }] }, 2);
  eq(r.score, 1); eq(r.status, 'partial'); eq(r.isCorrect, false);
});

test('steps are scaled so their points add up to the question points', () => {
  const r = normalizeGradingResult({ score: 100, steps: [{ description: 'a', points: 50, earned: 50 }, { description: 'b', points: 50, earned: 25 }] }, 1);
  eq(r.score, 0.75); eq(r.steps[0].points, 0.5); eq(r.steps[1].earned, 0.25); eq(r.isCorrect, true);
});

test('earned can never exceed step points or question points', () => {
  const r = normalizeGradingResult({ steps: [{ description: 'a', points: 1, earned: 5 }] }, 1);
  eq(r.score, 1); eq(r.status, 'correct');
  eq(normalizeGradingResult({ score: 9 }, 2).score, 2);
  eq(normalizeGradingResult({ score: -3 }, 2).score, 0);
});

test('without steps the model score is used and a breakdown is synthesized', () => {
  const r = normalizeGradingResult({ score: 0.5, status: 'correct' }, 1, { isEnglish: true });
  eq(r.score, 0.5); eq(r.status, 'partial', 'status derived in code'); eq(r.steps.length, 2);
});

test('status/isCorrect derived from the score (75% rule)', () => {
  eq(normalizeGradingResult({ score: 1.5 }, 2).isCorrect, true);
  eq(normalizeGradingResult({ score: 1.4 }, 2).isCorrect, false);
  eq(normalizeGradingResult({ score: 2 }, 2).status, 'correct');
});

test('unparsable output -> 0 and needsReview', () => {
  const r = normalizeGradingResult(null, 2, { parseFailed: true });
  eq(r.score, 0); eq(r.needsReview, true);
  eq(normalizeGradingResult({ score: 1 }, 2).needsReview, false);
});

test('numeric strings are accepted, rounding to 2 decimals', () => {
  const r = normalizeGradingResult({ steps: [{ description: 'a', points: '1', earned: '0.333' }, { description: 'b', points: '1', earned: '0.333' }, { description: 'c', points: '1', earned: 0 }] }, 1);
  eq(r.score, 0.22);
});

test('safeParseAiJson handles fences, prose and trailing commas', () => {
  eq(safeParseAiJson('```json\n{"score": 1}\n```').score, 1);
  eq(safeParseAiJson('Result: {"score": 1, "steps": [],}').score, 1);
  eq(safeParseAiJson('not json'), null);
});

test('response schema requires score, status, feedback, steps', () => {
  eq(GRADING_RESPONSE_SCHEMA.required.join(','), 'score,status,feedback,steps');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

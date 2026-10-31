/**
 * Deterministic post-processing of Gemini essay-grading output.
 * The model proposes a per-step breakdown; the CODE computes the final score from it,
 * so totals can never drift from the parts, and every result is clamped to the question's points.
 */

export interface GradingStep { description: string; points: number; earned: number }

export interface NormalizedGrading {
  score: number;
  status: 'correct' | 'partial' | 'incorrect';
  isCorrect: boolean;
  steps: GradingStep[];
  feedback: string;
  /** True when the AI output was unusable and the score fell back to 0 / heuristics: the teacher should review. */
  needsReview: boolean;
}

/** Structured-output schema sent to Gemini (values match @google/genai `Type`). */
export const GRADING_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    score: { type: 'NUMBER', description: 'Total points earned (sum of steps.earned).' },
    status: { type: 'STRING', enum: ['correct', 'partial', 'incorrect'] },
    feedback: { type: 'STRING' },
    steps: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          description: { type: 'STRING' },
          points: { type: 'NUMBER' },
          earned: { type: 'NUMBER' }
        },
        required: ['description', 'points', 'earned']
      }
    }
  },
  required: ['score', 'status', 'feedback', 'steps']
} as const;

export function safeParseAiJson(rawText: string): any {
  if (!rawText || typeof rawText !== 'string') return null;
  let text = rawText.trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(text); } catch {}
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) {
    const candidate = text.substring(first, last + 1);
    try { return JSON.parse(candidate); } catch {}
    try { return JSON.parse(candidate.replace(/,\s*([\]\}])/g, '$1')); } catch {}
  }
  return null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const num = (v: any): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null));

const defaultFeedback = (score: number, qPoints: number, isEnglish: boolean) =>
  score >= qPoints
    ? (isEnglish ? 'Excellent! Correct answer conveying the concept in your own style.' : 'إجابة ممتازة وصحيحة بالمعنى والمفهوم المطلوب معبراً عنها بأسلوبك الخاص.')
    : score > 0
      ? (isEnglish ? 'Partial credit awarded for correct parts.' : 'تم احتساب درجة جزئية عن الأجزاء الصحيحة بالمعنى.')
      : (isEnglish ? 'The answer does not convey the required conceptual meaning.' : 'الإجابة لا تعبر عن المعنى أو المفهوم المطلوب في السؤال.');

/**
 * Rules:
 * 1. If the model returned a usable `steps` array, the score is the sum of `earned`
 *    after scaling the steps' `points` so they add up to exactly `qPoints`.
 * 2. Otherwise the model's `score` is used, clamped to [0, qPoints].
 * 3. `status`/`isCorrect` are derived from the final score in code (>= 75% counts as correct).
 * 4. A missing/unparsable result yields 0 and `needsReview = true`.
 */
export function normalizeGradingResult(
  parsed: any,
  qPoints: number,
  opts: { isEnglish?: boolean; parseFailed?: boolean } = {}
): NormalizedGrading {
  const isEnglish = Boolean(opts.isEnglish);
  const maxPoints = Math.max(0.25, Number(qPoints) || 1);

  if (!parsed || typeof parsed !== 'object') {
    return { score: 0, status: 'incorrect', isCorrect: false, steps: [], feedback: defaultFeedback(0, maxPoints, isEnglish), needsReview: true };
  }

  let steps: GradingStep[] = [];
  if (Array.isArray(parsed.steps)) {
    steps = parsed.steps
      .filter((s: any) => s && typeof s === 'object')
      .map((s: any) => ({
        description: String(s.description || (isEnglish ? 'Step' : 'خطوة')),
        points: Math.max(0, num(s.points) ?? 0),
        earned: Math.max(0, num(s.earned) ?? 0)
      }));
  }

  let score: number;
  const stepPointsSum = steps.reduce((a, s) => a + s.points, 0);

  if (steps.length > 0 && stepPointsSum > 0) {
    const scale = maxPoints / stepPointsSum;
    steps = steps.map(s => {
      const points = round2(s.points * scale);
      return { description: s.description, points, earned: round2(clamp(s.earned * scale, 0, points)) };
    });
    score = steps.reduce((a, s) => a + s.earned, 0);
  } else {
    steps = [];
    score = num(parsed.score) ?? 0;
  }

  score = round2(clamp(score, 0, maxPoints));

  if (steps.length === 0) {
    if (score > 0 && score < maxPoints) {
      steps = [
        { description: isEnglish ? 'Correct Steps / Parts' : 'الخطوات والأجزاء الصحيحة', points: score, earned: score },
        { description: isEnglish ? 'Deduction for incorrect/missing step' : 'خصم الخطوة أو الجزء الخاطئ/الناقص', points: round2(maxPoints - score), earned: 0 }
      ];
    } else if (score >= maxPoints) {
      steps = [{ description: isEnglish ? 'All steps completed correctly' : 'جميع الخطوات مكتملة وصحيحة', points: maxPoints, earned: maxPoints }];
    }
  }

  const status: NormalizedGrading['status'] = score >= maxPoints ? 'correct' : score > 0 ? 'partial' : 'incorrect';
  const feedback = typeof parsed.feedback === 'string' && parsed.feedback.trim() ? parsed.feedback.trim() : defaultFeedback(score, maxPoints, isEnglish);

  return {
    score,
    status,
    isCorrect: score >= maxPoints * 0.75,
    steps,
    feedback,
    needsReview: Boolean(opts.parseFailed)
  };
}

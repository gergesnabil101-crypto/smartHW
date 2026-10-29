import { createHash } from 'crypto';

/**
 * Billing multipliers for output tokens. These define the platform's profit margin
 * and MUST stay fixed: Flash x5, Pro x7 (see test/tokenAccounting.test.ts).
 */
export const FLASH_OUTPUT_MULTIPLIER = 5;
export const PRO_OUTPUT_MULTIPLIER = 7;

export type TokenOperation = 'essay_grading' | 'doc_extraction' | 'quiz_generation' | 'image_ocr' | 'general';

export interface TokenUsageParams {
  userId?: string;
  userName?: string;
  userEmail?: string;
  operation: TokenOperation;
  operationLabel?: string;
  model?: string;
  promptTokens: number;
  candidatesTokens: number;
  cachedTokens?: number;
  quizId?: string;
  quizTitle?: string;
  studentName?: string;
  usdToEgpRate?: number;
  /** Override "now" (tests). */
  now?: Date;
}

export interface TokenLogRecord {
  id: string;
  timestamp: string;
  user_id: string;
  user_name: string;
  user_email: string;
  operation: string;
  operation_label: string;
  model: string;
  prompt_tokens: number;
  candidates_tokens: number;
  cached_tokens: number;
  total_tokens: number;
  cost_usd: number;
  cost_egp: number;
  cost_sar: number;
  quiz_id: string;
  quiz_title: string;
  student_name: string;
  source: 'server';
}

export const OPERATION_LABELS: Record<string, string> = {
  essay_grading: 'تصحيح مقالي بالمعنى',
  doc_extraction: 'استخراج بنك أسئلة من مستند/PDF',
  quiz_generation: 'صياغة وتوليد اختبار ذكي',
  image_ocr: 'معالجة رموز ورسومات (OCR)',
  general: 'معالجة ذكاء اصطناعي'
};

export const isProModel = (model?: string | null): boolean => String(model || '').toLowerCase().includes('pro');

export const getOutputMultiplier = (model?: string | null): number =>
  isProModel(model) ? PRO_OUTPUT_MULTIPLIER : FLASH_OUTPUT_MULTIPLIER;

/** Billable tokens = prompt + candidates * multiplier (x5 Flash, x7 Pro). */
export const computeBillableTokens = (promptTokens: number, candidatesTokens: number, model?: string | null): number => {
  const p = Math.max(0, Math.floor(Number(promptTokens) || 0));
  const c = Math.max(0, Math.floor(Number(candidatesTokens) || 0));
  return p + c * getOutputMultiplier(model);
};

/** Single definition of "token/wallet plan" shared by pre-check and deduction. */
export const isTokenPlanUser = (data: any): boolean => {
  if (!data) return false;
  const subType = String(data.subscription_type || '').toLowerCase();
  const customPlanName = String(data.custom_plan_name || '').toLowerCase();
  return Boolean(
    (data.custom_tokens_millions && Number(data.custom_tokens_millions) > 0) ||
    /token|شحن|رصيد|recharge|charge|pay_as_you_go|balance/i.test(subType) ||
    /token|شحن|رصيد|توكن/i.test(customPlanName) ||
    (data.extra_tokens && Number(data.extra_tokens) > 0)
  );
};

export const todayString = (now: Date = new Date()): string => now.toISOString().split('T')[0];

/**
 * Deterministic log id: the same Gemini response (same user, operation, token counts,
 * quiz, student) within the same minute maps to the same id, so a retry or a duplicate
 * caller can never deduct twice, even across server restarts.
 */
export const buildTokenLogId = (params: TokenUsageParams, now: Date): string => {
  const p = Math.max(0, Number(params.promptTokens) || 0);
  const c = Math.max(0, Number(params.candidatesTokens) || 0);
  const minuteBucket = Math.floor(now.getTime() / 60000);
  const raw = [
    params.userId || params.userEmail || 'anon',
    params.operation,
    params.model || '',
    p,
    c,
    params.quizId || '',
    (params.studentName || '').trim().toLowerCase(),
    minuteBucket
  ].join('|');
  return `tok_${createHash('sha1').update(raw).digest('hex').slice(0, 24)}`;
};

export const buildTokenLogRecord = (params: TokenUsageParams): TokenLogRecord | null => {
  const now = params.now || new Date();
  const model = params.model || 'gemini-3.8-flash';
  const pro = isProModel(model);
  const promptTokens = Math.max(0, Number(params.promptTokens) || 0);
  const candidatesTokens = Math.max(0, Number(params.candidatesTokens) || 0);
  const cachedTokens = Math.max(0, Number(params.cachedTokens) || 0);
  const totalTokens = computeBillableTokens(promptTokens, candidatesTokens, model);
  if (totalTokens <= 0) return null;

  const inRate = pro ? 2.0 : 0.75;
  const outRate = pro ? 12.0 : 1.5;
  const cachedRate = pro ? 0.5 : 0.1875;
  const egpRate = params.usdToEgpRate || 50.0;
  const costUsd = (promptTokens / 1_000_000) * inRate +
                  (candidatesTokens / 1_000_000) * outRate +
                  (cachedTokens / 1_000_000) * cachedRate;

  return {
    id: buildTokenLogId(params, now),
    timestamp: now.toISOString(),
    user_id: params.userId || 'anonymous',
    user_name: params.userName || '',
    user_email: params.userEmail || '',
    operation: params.operation,
    operation_label: params.operationLabel || OPERATION_LABELS[params.operation] || 'استدعاء AI',
    model,
    prompt_tokens: promptTokens,
    candidates_tokens: candidatesTokens,
    cached_tokens: cachedTokens,
    total_tokens: totalTokens,
    cost_usd: costUsd,
    cost_egp: costUsd * egpRate,
    cost_sar: costUsd * 3.75,
    quiz_id: params.quizId || '',
    quiz_title: params.quizTitle || '',
    student_name: params.studentName || '',
    source: 'server'
  };
};

/** Pure counter update: given the stored user data, compute the fields to write. */
export const computeCounterUpdate = (userData: any, tokens: number, now: Date = new Date()) => {
  const today = todayString(now);
  const lastReset = String(userData?.last_token_reset_date || '');
  const previousToday = lastReset === today ? Math.max(0, Number(userData?.tokens_used_today) || 0) : 0;
  return {
    tokens_used: Math.max(0, Number(userData?.tokens_used) || 0) + tokens,
    tokens_used_total: Math.max(0, Number(userData?.tokens_used_total) || 0) + tokens,
    tokens_used_today: previousToday + tokens,
    last_token_reset_date: today,
    last_token_activity_at: now.toISOString()
  };
};

export interface RecordResult {
  status: 'recorded' | 'duplicate' | 'skipped';
  record: TokenLogRecord | null;
}

/**
 * Atomically writes the usage log and increments the user's counters, exactly once per
 * log id. Uses a Firestore transaction so concurrent requests never lose increments.
 * `db` is a firebase-admin Firestore instance.
 */
export async function recordTokenUsage(db: any, params: TokenUsageParams): Promise<RecordResult> {
  const record = buildTokenLogRecord(params);
  if (!record) return { status: 'skipped', record: null };

  const logRef = db.collection('token_usage_logs').doc(record.id);
  const userRef = params.userId ? db.collection('users').doc(params.userId) : null;
  const now = params.now || new Date();

  const status: RecordResult['status'] = await db.runTransaction(async (tx: any) => {
    const existingLog = await tx.get(logRef);
    if (existingLog.exists) return 'duplicate';

    if (userRef) {
      const userSnap = await tx.get(userRef);
      if (userSnap.exists) {
        tx.set(userRef, computeCounterUpdate(userSnap.data(), record.total_tokens, now), { merge: true });
      }
    }
    tx.set(logRef, record);
    return 'recorded';
  });

  return { status, record };
}

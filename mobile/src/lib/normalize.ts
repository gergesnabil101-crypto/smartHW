import type { Quiz, StudentResult } from '../types';

/**
 * Server payloads can carry JSON-encoded strings (`data`, `feedback`,
 * `student_answers`) or already-parsed objects depending on which endpoint
 * produced them and how the document was originally saved. These helpers
 * normalize both shapes into plain objects so screens don't need to care.
 */
export function parseMaybeJson<T>(value: unknown): T | undefined {
  if (value == null) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) return value as T;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Quiz docs in Firestore look like:
 *   { id, user_id, title, folder_id, data: "<json string>" | {...}, ... }
 * while the actual quiz payload (questions, subject, time_limit, ...) lives
 * inside `data`. Some endpoints spread the parsed payload at top level,
 * `/api/user/quizzes` does not — so we merge it ourselves.
 */
export function normalizeQuiz(raw: unknown): Quiz {
  if (!raw || typeof raw !== 'object') return raw as Quiz;
  const doc = raw as Record<string, unknown>;
  const inner = parseMaybeJson<Record<string, unknown>>(doc.data) ?? {};
  // inner first, doc overrides — top-level fields (id, title, folder_id) win,
  // and `questions`/`subject`/etc. fall through from the parsed payload.
  const merged = { ...inner, ...doc } as unknown as Quiz;
  if (!Array.isArray(merged.questions)) merged.questions = [];
  return merged;
}

/**
 * Result docs store `student_answers` and `feedback` as JSON strings —
 * parse them into objects so detail screens can index by question id.
 */
export function normalizeResult(raw: unknown): StudentResult {
  if (!raw || typeof raw !== 'object') return raw as StudentResult;
  const doc = raw as Record<string, unknown>;
  const answers =
    parseMaybeJson<Record<string, unknown>>(doc.student_answers) ??
    parseMaybeJson<Record<string, unknown>>(doc.answers) ??
    {};
  const feedback = parseMaybeJson<Record<string, unknown>>(doc.feedback) ?? {};
  return { ...doc, student_answers: answers, answers, feedback } as unknown as StudentResult;
}

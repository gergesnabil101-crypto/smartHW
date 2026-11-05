import { api } from './api';
import { normalizeQuiz, normalizeResult } from './normalize';
import type { Quiz, Folder, StudentResult, UserProfile, EssayGradingResponse } from '../types';

/**
 * Typed service layer — one function per server endpoint.
 * All screens call these instead of raw fetch so API changes land in one file.
 */

// ---------- Profile ----------
export const getProfile = () => api.get<UserProfile>('/api/user/profile');
export const updateProfile = (data: Partial<UserProfile>) =>
  api.put<{ success: boolean }>('/api/user/profile', data);

// ---------- Folders ----------
export const listFolders = () => api.get<Folder[]>('/api/folders');
export const createFolder = (name: string) =>
  api.post<{ success: boolean }>('/api/folders', { name }, { idempotent: true });
export const deleteFolder = (id: string) => api.delete<{ success: boolean }>(`/api/folders/${id}`);

// ---------- Quizzes (teacher) ----------
export const listMyQuizzes = () =>
  api.get<unknown[]>('/api/user/quizzes').then((list) =>
    (Array.isArray(list) ? list : []).map(normalizeQuiz)
  );
/** Load a quiz for the teacher editor (auth required — returns full payload). */
export const getQuizForEdit = (id: string) =>
  api.get<unknown>(`/api/quizzes/${encodeURIComponent(id)}`).then(normalizeQuiz);
export const saveQuiz = (quiz: {
  id: string;
  title: string;
  data: Quiz;
  folder_id?: string | null;
  grade_level?: string[] | string | null;
  expires_at?: string | number | null;
}) => api.post<{ success: boolean }>('/api/quizzes', quiz, { idempotent: true });
export const deleteQuiz = (id: string) => api.delete<{ success: boolean }>(`/api/quizzes/${id}`);

// ---------- Quiz (student-facing, no auth) ----------
export const getQuizPublic = (id: string) =>
  api.get<unknown>(`/api/quizzes/${encodeURIComponent(id)}`, { auth: false }).then(normalizeQuiz);
export const getTeacherStatus = (teacherId: string) =>
  api.get<{ active: boolean }>(`/api/teachers/${encodeURIComponent(teacherId)}/status`, { auth: false });
export const checkAttempts = (quizId: string, data: { student_name: string; parent_phone?: string; student_phone?: string; student_code?: string }) =>
  api.post<{ allowed: boolean; attemptsUsed?: number; error?: string; student_code?: string }>(
    `/api/quizzes/${encodeURIComponent(quizId)}/check-attempts`,
    data,
    { auth: false }
  );
export const startAttempt = (quizId: string, data: { student_name: string; student_code?: string }) =>
  api.post<{ attemptToken?: string; error?: string }>(
    `/api/quizzes/${encodeURIComponent(quizId)}/start-attempt`,
    data,
    { auth: false }
  );
export const submitQuiz = (
  quizId: string,
  data: {
    student_name: string;
    center_name?: string;
    parent_phone?: string;
    student_phone?: string;
    student_code?: string;
    student_answers: Record<string, unknown>;
    attemptToken?: string;
    time_spent_seconds?: number;
  }
) => api.post<{
  success: boolean;
  id?: string;
  score?: number;
  total?: number;
  feedback?: Record<string, unknown>;
  is_graded?: boolean;
  error?: string;
}>(
  `/api/quizzes/${encodeURIComponent(quizId)}/submit`,
  data,
  { auth: false, idempotent: true }
);

// ---------- AI ----------
export const aiGenerate = <T = { text?: string }>(payload: {
  contents: unknown;
  config?: Record<string, unknown>;
  subjectName?: string;
  planId?: string;
  modelOverride?: string;
  operation: string;
}) => api.post<T>('/api/ai/generate', payload, { timeoutMs: 120000 });

export const gradeEssay = (payload: {
  question: string;
  modelAnswer?: string;
  studentAnswer: string;
  points?: number;
  requiredPoints?: number;
  quizTitle?: string;
  subject?: string;
  planId?: string;
  teacherId?: string;
  quizId?: string;
  studentName?: string;
  keywords?: string[];
  model?: string;
}) => api.post<EssayGradingResponse>('/api/ai-grade-essay', payload, { auth: false, timeoutMs: 120000 });

// ---------- Results (teacher) ----------
export const listTeacherResults = () =>
  api.get<unknown[]>('/api/teacher/results').then((list) =>
    (Array.isArray(list) ? list : []).map(normalizeResult)
  );
export const listQuizResults = (quizId: string) =>
  api.get<unknown[]>(`/api/quizzes/${encodeURIComponent(quizId)}/results`).then((list) =>
    (Array.isArray(list) ? list : []).map(normalizeResult)
  );
export const reviewResult = (resultId: string, data: Record<string, unknown>) =>
  api.patch<{ success: boolean }>(`/api/results/${encodeURIComponent(resultId)}/review`, data);
export const gradeResult = (resultId: string, data: Record<string, unknown>) =>
  api.patch<{ success: boolean }>(`/api/results/${encodeURIComponent(resultId)}/grade`, data);
export const batchRecalculate = (quizId: string) =>
  api.post<{ success: boolean; updated?: number }>('/api/results/batch-recalculate', { quizId });

// ---------- Admin ----------
export const listAdminUsers = () =>
  api.get<{ users: any[]; totalReviewed?: number }>('/api/admin/users').then((r) => r?.users || []);
export const adminUpdateUser = (userId: string, email: string | undefined, updates: Record<string, unknown>) =>
  api.post<{ success: boolean }>('/api/admin/update-user', { userId, email, updates }, { idempotent: true });

// ---------- Misc ----------
export const healthCheck = () => api.get<{ ok: boolean }>('/api/health', { auth: false });

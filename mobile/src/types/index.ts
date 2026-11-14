/**
 * Shared data contracts — mirrors src/types.ts from the web app so the mobile
 * app stays in sync with the server API payloads.
 */

export interface StudentCode {
  code: string;
  student_name: string;
  center_name?: string;
  student_phone?: string;
  parent_phone?: string;
  student_grade?: string;
  used?: boolean;
  used_at?: string;
  result_id?: string;
}

export interface Question {
  id: string;
  text: string;
  image?: string;
  audio?: string;
  options?: string[];
  correctOptionIndex?: number;
  points?: number | string;
  type?: 'multiple-choice' | 'essay' | 'true-false';
  modelAnswer?: string;
  required_points_count?: number;
  keywords?: string[];
}

export interface Quiz {
  id: string;
  title: string;
  folder_id?: string;
  questions: Question[];
  showCorrectAnswers?: boolean;
  showResultsToStudent?: boolean;
  defaultPoints?: number;
  grade_level?: string[] | string;
  subject?: string;
  maxAttempts?: number;
  teacher_id?: string;
  user_id?: string;
  teacher_name?: string;
  is_active?: boolean;
  time_limit?: number;
  expires_at?: string | number | null;
  created_at?: string | number;
  ai_model?: 'flash' | 'pro';
  require_student_code?: boolean;
  student_codes?: StudentCode[];
}

export interface Folder {
  id: string;
  name: string;
  teacher_id?: string;
}

export interface TeacherInfo {
  id?: string;
  name: string;
  subject: string;
  gradeLevel?: string;
  avatar_data?: string;
  phone?: string;
  preferred_ai_model?: 'flash' | 'pro' | 'gemini_pro';
  is_pro?: boolean;
  subscription_type?: string;
}

export interface StudentResult {
  id?: string;
  quiz_id?: string;
  quiz_title?: string;
  student_name: string;
  student_code?: string;
  student_phone?: string;
  parent_phone?: string;
  phone?: string;
  center_name?: string;
  teacher_id?: string;
  user_id?: string;
  teacher_name?: string;
  subject?: string;
  grade_level?: string;
  score: number;
  total: number;
  feedback?: string;
  answers?: Record<string, unknown>;
  student_answers?: Record<string, unknown>;
  is_graded?: boolean;
  reviewed_and_sent?: boolean;
  reviewed_and_sent_at?: string | number;
  created_at: string | number;
  time_spent_seconds?: number;
}

export interface UserProfile {
  id: string;
  uid?: string;
  name?: string;
  email?: string;
  role?: 'teacher' | 'admin' | 'user';
  isAdmin?: boolean;
  subject?: string;
  subjectCategory?: 'theory' | 'science';
  grade_level?: string[];
  phone?: string;
  avatar_data?: string;
  subscription_type?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: 'active' | 'expired' | 'pending' | 'trial';
  subscription_status?: string;
  subscription_end_date?: string;
  is_suspended?: boolean;
  hasAccess?: boolean;
  tokens_used?: number;
  tokens_used_today?: number;
  last_token_reset_date?: string;
  extra_tokens?: number;
  tokens_limit?: number;
  token_balance?: number;
  total_tokens?: number;
  custom_tokens_millions?: number;
  billing_cycle?: string;
  hasPendingSubscription?: boolean;
  preferred_ai_model?: 'flash' | 'pro';
  created_at?: unknown;
}

export interface SubscriptionPlan {
  id: string;
  legacyId?: string;
  category: 'theory' | 'science';
  categoryName: string;
  categoryShort: string;
  name: string;
  fullName: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyDiscount: number;
  popular?: boolean;
  color: 'indigo' | 'emerald' | 'purple' | 'slate' | 'teal' | 'cyan';
  badge?: string;
  features: string[];
  essayLimit: number;
  essayText: string;
  targetAudience: string;
  daily_tokens?: number;
}

/** Response of POST /api/ai-grade-essay */
export interface EssayGradingResponse {
  score: number;
  status?: string;
  feedback: string;
  correctExample?: string;
  steps?: unknown[];
  isCorrect: boolean;
  needs_review?: boolean;
  model?: string;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

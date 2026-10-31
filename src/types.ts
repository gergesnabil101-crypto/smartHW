export enum Type {
  TYPE_UNSPECIFIED = "TYPE_UNSPECIFIED",
  STRING = "STRING",
  NUMBER = "NUMBER",
  INTEGER = "INTEGER",
  BOOLEAN = "BOOLEAN",
  ARRAY = "ARRAY",
  OBJECT = "OBJECT",
  NULL = "NULL",
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface Question {
  id: string;
  text: string;
  image?: string;
  audio?: string;
  options?: string[];
  correctOptionIndex?: number;
  points?: any;
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
  student_codes?: Array<{
    code: string;
    student_name: string;
    center_name?: string;
    student_phone?: string;
    parent_phone?: string;
    student_grade?: string;
    used?: boolean;
    used_at?: string;
    result_id?: string;
  }>;
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
  answers?: Record<string, any>;
  student_answers?: Record<string, any>;
  is_graded?: boolean;
  reviewed_and_sent?: boolean;
  reviewed_and_sent_at?: string | number;
  created_at: string | number;
  time_spent_seconds?: number;
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

export interface UserProfile {
  id: string;
  uid?: string;
  name?: string;
  email?: string;
  role?: 'teacher' | 'admin';
  isAdmin?: boolean;
  subject?: string;
  subjectCategory?: 'theory' | 'science';
  subscriptionPlan?: string;
  subscriptionStatus?: 'active' | 'expired' | 'pending';
  subscriptionEndDate?: string;
  tokens_used?: number;
  tokens_used_today?: number;
  tokens_used_yesterday?: number;
  last_token_reset_date?: string;
  extra_tokens?: number;
  preferred_ai_model?: 'flash' | 'pro';
  created_at?: any;
}

export type BillingTimeframe = 'today' | '7days' | '14days' | '30days' | '60days' | 'all' | 'custom';

export interface TokenUsageLog {
  id: string;
  timestamp: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  operation: 'essay_grading' | 'doc_extraction' | 'quiz_generation' | 'image_ocr' | 'general';
  operation_label: string;
  model: string;
  prompt_tokens: number;
  candidates_tokens: number;
  cached_tokens?: number;
  total_tokens: number;
  cost_usd: number;
  cost_egp: number;
  cost_sar: number;
  quiz_id?: string;
  quiz_title?: string;
  student_name?: string;
}

export interface OperationBreakdownItem {
  operation: string;
  operation_label: string;
  count: number;
  prompt_tokens: number;
  candidates_tokens: number;
  total_tokens: number;
  cost_usd: number;
  cost_egp: number;
  cost_sar: number;
  avg_tokens_per_op: number;
  avg_cost_egp_per_op: number;
}

export interface DailyTokenTrendItem {
  date: string;
  date_formatted: string;
  total_tokens: number;
  prompt_tokens: number;
  candidates_tokens: number;
  cost_usd: number;
  cost_egp: number;
  cost_sar: number;
  operations_count: number;
}

export interface TokenBillingSummary {
  timeframe: BillingTimeframe;
  timeframe_label: string;
  start_date: string;
  end_date: string;
  total_tokens: number;
  prompt_tokens: number;
  candidates_tokens: number;
  cached_tokens: number;
  total_operations_count: number;
  total_cost_usd: number;
  total_cost_egp: number;
  total_cost_sar: number;
  avg_cost_per_operation_egp: number;
  avg_cost_per_student_egp: number;
  operations_breakdown: OperationBreakdownItem[];
  daily_trends: DailyTokenTrendItem[];
  recent_logs: TokenUsageLog[];
  pricing_rates: {
    model_name: string;
    input_per_million_usd: number;
    output_per_million_usd: number;
    cached_per_million_usd: number;
    usd_to_egp_rate: number;
    usd_to_sar_rate: number;
  };
  invoice_number: string;
  invoice_issue_date: string;
  pricing_mode?: 'client' | 'developer_real';
  real_cost_usd?: number;
  real_cost_egp?: number;
  real_cost_sar?: number;
  client_cost_egp?: number;
  client_rate_per_million_egp?: number;
  developer_profit_egp?: number;
  developer_margin_percent?: number;
  user_info?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    subject?: string;
    role?: string;
    subscription_plan?: string;
    total_plan_tokens?: number;
    tokens_used_total?: number;
    remaining_tokens?: number;
  };
}


import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { collection, doc, setDoc, getDoc, getDocs, getDocsFromServer, updateDoc, deleteDoc, query, where, orderBy, limit, serverTimestamp, writeBatch, onSnapshot, increment, startAt, endAt, getDocFromCache, getDocsFromCache } from 'firebase/firestore';
import { Globe, PlusCircle, Trash2, CheckCircle2, XCircle, FileText, Image, User, Play, Search, Share2, QrCode, Download, Copy, X, Users, LogOut, Lock, CreditCard, Save, FileUp, Loader2, Sparkles, Upload, CheckCircle, MessageCircle, Settings, Move, Smartphone, RefreshCw, Check, Mail, ArrowRight, Eye, EyeOff, KeyRound, Printer, Award, Undo2, BookOpen, Atom, Calculator, Zap, Phone, ExternalLink, ShieldCheck, ShieldAlert, AlertTriangle, Shield, Volume2, Mic, Clock, Filter, Ban, AlertCircle, Database, Bell, Send, CalendarDays, SlidersHorizontal, ArrowUpDown, GraduationCap, MapPin, Layers, RotateCcw, BarChart2, TrendingUp, UserX, UserCheck, Coins, Receipt, ArrowRightLeft, CopyPlus, Crown } from 'lucide-react';
import logo from './assets/images/smart_corrector_logo_1785441932198.jpg';
import { QRCodeCanvas } from 'qrcode.react';
import { exportResultsToExcelOrCSV, exportToCSV, exportToExcelHTML } from './utils/excelExport';
import { downloadResultsPDF, printResultsPDF } from './utils/pdfExport';
import { Type, OperationType, Question, Quiz, Folder, TeacherInfo, SubscriptionPlan } from './types';
import { GRADE_LEVELS, SUBSCRIPTION_PLANS, getPlanById, getPlansByCategory, getProEquivalentPlan, TOKEN_PRICE_PER_MILLION, TOKEN_PRESET_PLANS, PRO_TOKEN_PRESET_PLANS, TRIAL_DAYS, TRIAL_DAILY_TOKENS } from './constants';
import { TokenCalculatorModal } from './components/modals/TokenCalculatorModal';
import { TokenBillingModal } from './components/modals/TokenBillingModal';
import { AdminUserPlanModal } from './components/modals/AdminUserPlanModal';
import { TeacherProUpgradeModal } from './components/modals/TeacherProUpgradeModal';
import { DeactivateUserModal } from './components/modals/DeactivateUserModal';
import { TeacherStudentsModal } from './components/modals/TeacherStudentsModal';
import { PrivacyPolicyModal } from './components/modals/PrivacyPolicyModal';
import { RetentionModal } from './components/modals/RetentionModal';
import { SelfDeleteModal } from './components/modals/SelfDeleteModal';
import { DeleteUserModal } from './components/modals/DeleteUserModal';
import { StudentSheetModal } from './components/modals/StudentSheetModal';
import { BatchSendModal } from './components/modals/BatchSendModal';
import { MoveQuizModal, MoveQuestionModal } from './components/modals/MoveModals';
import { DeleteQuizModal } from './components/modals/DeleteQuizModal';
import { ProUpgradeModal } from './components/modals/ProUpgradeModal';
import { StudentPaperShareModal } from './components/modals/StudentPaperShareModal';
import { PdfPageSelectionModal } from './components/modals/PdfPageSelectionModal';
import { downloadStudentPaperImage, sendWhatsAppStudentPaper, formatWhatsAppPhone, buildParentResultOnlyWhatsAppMessage } from './utils/studentPaperExport';
import { AudioRecorderControl } from './components/AudioRecorderControl';
import { MathText } from './components/MathText';
import { Pagination } from './components/Pagination';
import { TECHNICAL_REPORT_TEXT } from './constants/technicalReport';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, ImageRun, UnderlineType } from 'docx';
import { saveAs } from 'file-saver';
import html2pdf from 'html2pdf.js';
import mammoth from 'mammoth';
import { checkEssayExactOrEquivalent } from './utils/essayEvaluator';
import { formatScienceNotation } from './utils/scienceNotation';
import { formatDuration, formatTimeCountdown, formatTimeLimitLabel, isQuizExpired, getQuizExpirationInfo, toDateTimeLocalString } from './utils/timeFormat';
import { 
  getUserTokenStats as getUnifiedUserTokenStats, 
  calculateTotalBillableTokens, 
  calculateTeacherRealTokenUsage,
  calculateTeacherTodayTokenUsage,
  calculateTeacherYesterdayTokenUsage,
  OUTPUT_TOKEN_MULTIPLIER 
} from './utils/tokenStats';

// Polyfill Promise.withResolvers for older browsers (e.g. Safari < 17.4)
if (typeof (Promise as any).withResolvers === 'undefined') {
  (Promise as any).withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// Set up PDF.js worker using local Vite asset URL to avoid CORS/adblocker issues
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Crash-proof localStorage wrapper for Safari Private Browsing and restricted in-app WebViews
export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      const storage = window['localStorage'];
      return storage.getItem(key);
    } catch (e) {
      console.warn("safeStorage.getItem blocked or failed for key:", key, e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      const storage = window['localStorage'];
      storage.setItem(key, value);
    } catch (e) {
      console.warn("safeStorage.setItem blocked or failed for key:", key, e);
    }
  },
  removeItem: (key: string): void => {
    try {
      const storage = window['localStorage'];
      storage.removeItem(key);
    } catch (e) {
      console.warn("safeStorage.removeItem blocked or failed for key:", key, e);
    }
  }
};

export const parseSafeDate = (val: any, fallback: any = new Date()): any => {
  if (!val) return fallback;
  if (val instanceof Date) return isNaN(val.getTime()) ? fallback : val;
  if (typeof val.toDate === 'function') {
    try {
      const d = val.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return d;
    } catch {}
  }
  if (typeof val === 'object' && val.seconds !== undefined) {
    const d = new Date(val.seconds * 1000 + (val.nanoseconds ? val.nanoseconds / 1000000 : 0));
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
    const num = Number(trimmed);
    if (!isNaN(num) && num > 1000000000) {
      const d2 = new Date(num > 10000000000 ? num : num * 1000);
      if (!isNaN(d2.getTime())) return d2;
    }
  }
  return fallback;
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const normalizeArabicText = (str: string): string => {
  if (!str) return '';
  return str
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[أإآءئؤ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[^\w\s\u0600-\u06FF]/g, '')
    .replace(/\s+/g, ' ');
};

export const normalizePhoneNumber = (phone: string): string => {
  if (!phone) return '';
  let digits = phone.toString().trim().replace(/[^0-9]/g, '');
  if (digits.length === 12 && digits.startsWith('20')) {
    digits = '0' + digits.substring(2);
  } else if (digits.length === 10 && !digits.startsWith('0')) {
    digits = '0' + digits;
  }
  return digits;
};

export const getUserTokenStats = getUnifiedUserTokenStats;

export interface UserCategoryInfo {
  category: 'trial' | 'active' | 'closed';
  categoryLabel: string;
  statusText: string;
  statusColor: string;
  badgeColor: string;
  subText: string;
  daysLeft: number | null;
  totalTrialDays?: number;
  trialEnd?: Date;
  isExpiringSoon?: boolean;
  isExpiredTrial?: boolean;
  expiryFormatted: string;
}

export const isNewSubscriber = (u: any, now: Date = new Date()): boolean => {
  if (!u) return false;
  if (u.isPendingRequestOnly || u.subscription_status === 'pending_approval') return true;
  const createdAt = parseSafeDate(u.created_at || u.createdAt || u.subscription_start_date, new Date(0));
  const diffDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 7;
};

export const getUserCategoryInfo = (u: any, now: Date = new Date()): UserCategoryInfo => {
  if (!u) {
    return {
      category: 'closed',
      categoryLabel: 'غير محدد',
      statusText: 'غير محدد',
      statusColor: 'text-slate-700 bg-slate-100 border border-slate-200',
      badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
      subText: '',
      daysLeft: 0,
      expiryFormatted: '-',
      isExpiredTrial: false
    };
  }

  // 1. Pending subscription requests
  if (u.isPendingRequestOnly || u.subscription_status === 'pending_approval') {
    return {
      category: 'trial',
      categoryLabel: 'طلب جديد',
      statusText: 'طلب اشتراك قيد الانتظار',
      statusColor: 'text-amber-700 bg-amber-50 border border-amber-200',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      subText: 'في انتظار التفعيل',
      daysLeft: null,
      expiryFormatted: 'قيد المراجعة',
      isExpiredTrial: false
    };
  }

  // 2. Administrators
  if (u.role === 'admin' || u.isAdmin === true || (u.email && u.email.toLowerCase().trim() === 'gergesnabil101@gmail.com')) {
    return {
      category: 'active',
      categoryLabel: 'حساب مفعل',
      statusText: 'مسؤول النظام',
      statusColor: 'text-purple-700 bg-purple-50 border border-purple-200',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      subText: 'كامل الصلاحيات',
      daysLeft: null,
      expiryFormatted: 'دائم',
      isExpiredTrial: false
    };
  }

  // 3. Manually suspended or explicitly deactivated accounts
  if (u.is_suspended || u.subscription_status === 'inactive' || u.subscription_status === 'cancelled') {
    return {
      category: 'closed',
      categoryLabel: 'حساب مغلق',
      statusText: u.is_suspended ? 'معلق يدوياً' : 'تم إلغاء التفعيل',
      statusColor: 'text-red-700 bg-red-100 border border-red-200',
      badgeColor: 'bg-red-100 text-red-800 border-red-200',
      subText: 'إيقاف إداري (غير مفعل)',
      daysLeft: 0,
      expiryFormatted: 'معلق / ملغى',
      isExpiredTrial: false
    };
  }

  const userEmail = (u.email || '').toLowerCase().trim();
  const isTargetAccount = userEmail === 'samehafef68@gmail.com';
  const stats = getUserTokenStats(u);

  // 4. Explicitly closed/expired accounts
  if (u.subscription_status === 'expired' || u.subscription_status === 'closed') {
    return {
      category: 'closed',
      categoryLabel: 'حساب منتهي',
      statusText: 'اشتراك منتهي',
      statusColor: 'text-rose-700 bg-rose-50 border border-rose-200',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
      subText: 'انتهت فترة الاشتراك أو التجربة',
      daysLeft: 0,
      expiryFormatted: u.subscription_end_date ? new Date(u.subscription_end_date).toLocaleDateString('en-GB') : 'منتهي',
      isExpiredTrial: true
    };
  }

  // 5. Active paid subscribers:
  // - Explicitly active status
  // - Or target account
  // - Or has a future subscription_end_date and not in trial
  // - Or has custom purchased token package (custom_tokens_millions > 0)
  const isExplicitActive = u.subscription_status === 'active' || isTargetAccount;
  const hasFutureSubEnd = !!(u.subscription_end_date && new Date(u.subscription_end_date).getTime() >= now.getTime());
  const hasCustomTokens = (u.custom_tokens_millions !== undefined && Number(u.custom_tokens_millions) > 0);
  const isPaidPlan = isExplicitActive || ((hasFutureSubEnd || hasCustomTokens) && u.subscription_status !== 'trial');

  if (isPaidPlan) {
    if (u.subscription_end_date) {
      const endDate = new Date(u.subscription_end_date);
      endDate.setHours(23, 59, 59, 999);
      const diffMs = endDate.getTime() - now.getTime();
      const rawDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const isMonthly = !u.billing_cycle || u.billing_cycle === 'monthly';
      let daysLeft = Math.max(0, rawDays);
      const renewalDate = parseSafeDate(u.subscription_renewal_date || u.subscription_start_date, null);
      if (isMonthly && renewalDate) {
        const elapsedDays = Math.max(0, Math.floor((now.getTime() - renewalDate.getTime()) / (1000 * 60 * 60 * 24)));
        if (elapsedDays < 30) {
          daysLeft = Math.min(daysLeft, Math.max(0, 30 - elapsedDays));
        }
      }

      // If active or has remaining tokens or valid date, keep in active
      if (now <= endDate || stats.remaining > 0 || isExplicitActive) {
        return {
          category: 'active',
          categoryLabel: 'مشترك مفعل',
          statusText: daysLeft === 0 && now > endDate ? 'مفعل (يحتاج تجديد)' : 'مفعل (مشترك مدفوع)',
          statusColor: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
          badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          subText: daysLeft > 0 
            ? `متبقي ${daysLeft} يوم (${stats.remaining.toLocaleString()} توكن)` 
            : `متبقي ${stats.remaining.toLocaleString()} توكن`,
          daysLeft: daysLeft,
          expiryFormatted: endDate.toLocaleDateString('en-GB'),
          isExpiredTrial: false
        };
      }
    } else {
      return {
        category: 'active',
        categoryLabel: 'مشترك مفعل',
        statusText: 'مفعل (باقة نشطة)',
        statusColor: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        subText: stats.remaining > 0 ? `متبقي ${stats.remaining.toLocaleString()} توكن` : 'باقة نشطة',
        daysLeft: null,
        expiryFormatted: 'اشتراك مفعل',
        isExpiredTrial: false
      };
    }
  }

  // 6. Trial period accounts
  const createdAt = parseSafeDate(u.created_at || u.createdAt || u.registration_date || u.timestamp || u.subscription_start_date, now);
  const trialEnd = u.trial_extended_until 
    ? parseSafeDate(u.trial_extended_until) 
    : new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const diffMs = trialEnd.getTime() - now.getTime();
  const totalTrialDays = Math.ceil((trialEnd.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)) || TRIAL_DAYS;
  const isExpired = diffMs <= 0;
  // Accurately compute remaining days countdown (e.g. 5 -> 4 -> 3 -> 2 -> 1 -> 0)
  const daysLeft = isExpired ? 0 : Math.max(1, Math.min(totalTrialDays, Math.ceil(diffMs / (1000 * 60 * 60 * 24))));

  if (!isExpired && (now <= trialEnd || u.subscription_status === 'trial')) {
    return {
      category: 'trial',
      categoryLabel: 'حساب تجريبي',
      statusText: u.trial_extended_until ? 'تجربة ممددة' : `فترة تجريبية (${totalTrialDays} أيام)`,
      statusColor: 'text-amber-700 bg-amber-50 border border-amber-200',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      subText: daysLeft <= 1 ? 'ينتهي اليوم / غداً' : `متبقي ${daysLeft} من ${totalTrialDays} أيام`,
      daysLeft: daysLeft,
      totalTrialDays,
      trialEnd,
      isExpiringSoon: daysLeft <= 2,
      isExpiredTrial: false,
      expiryFormatted: trialEnd.toLocaleDateString('en-GB'),
    };
  }

  // 7. Otherwise: expired trial -> closed
  return {
    category: 'closed',
    categoryLabel: 'حساب مغلق',
    statusText: 'تجربة منتهية',
    statusColor: 'text-slate-700 bg-slate-100 border border-slate-200',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
    subText: `انتهت الـ ${totalTrialDays} أيام التجريبية`,
    daysLeft: 0,
    totalTrialDays,
    trialEnd,
    isExpiringSoon: false,
    isExpiredTrial: true,
    expiryFormatted: trialEnd.toLocaleDateString('en-GB'),
  };
};

export const getUserCategoryInfoUnified = getUserCategoryInfo;

const checkTokenLimitBeforeAi = (userState: any) => {
  if (!userState) return true;
  if (userState.role === 'admin' || userState.isAdmin === true) return true;

  const isTrial = userState.subscription_status === 'trial' || 
    (!userState.subscription_status && userState.role !== 'admin') || 
    (userState.isTrialActive && userState.subscription_status !== 'active');

  const stats = getUserTokenStats(userState);
  if (stats.isTokenSystem && !isTrial) {
    if (stats.used >= stats.totalLimit) {
      alert(`عذراً، لقد استهلكت رصيد باقة التوكنز بالكامل (${stats.totalLimit.toLocaleString()} توكن). يرجى شراء توكنز إضافية أو تجديد الاشتراك للمتابعة.`);
      return false;
    }
    return true;
  }

  const today = new Date().toISOString().split('T')[0];
  const lastReset = userState.last_token_reset_date || '';
  let tokensToday = userState.tokens_used_today || 0;
  const extraTokens = userState.extra_tokens || 0;

  if (lastReset !== today) {
    tokensToday = 0;
  }

  // Allow proceeding if they have extra tokens
  if (extraTokens > 0) return true;

  const plan = getPlanById(userState.subscription_type);
  const dailyLimit = isTrial ? TRIAL_DAILY_TOKENS : (plan ? (plan.daily_tokens || 20000) : 20000);

  if (tokensToday >= dailyLimit) {
    const alertMsg = isTrial
      ? `عذراً، لقد وصلت إلى الحد اليومي المسموح به في الفترة المجانية (${dailyLimit.toLocaleString()} توكن/يوم). يرجى الاشتراك في إحدى الباقات أو شحن توكنز أو المحاولة غداً.`
      : `عذراً، لقد وصلت إلى حد الاستهلاك اليومي المسموح به (${dailyLimit.toLocaleString()} توكن) لحسابك ولم يتبق لديك رصيد إضافي. يرجى المحاولة غدًا.`;
    alert(alertMsg);
    return false;
  }
  return true;
};

export const trackTokenUsage = async (
  response: any, 
  operationInfo?: { 
    operation?: string; 
    operationLabel?: string; 
    model?: string; 
    quizId?: string; 
    quizTitle?: string; 
    studentName?: string;
    userId?: string;
    userName?: string;
    userEmail?: string;
    alreadyLoggedOnServer?: boolean;
  }
) => {
  const effectiveUid = operationInfo?.userId || auth.currentUser?.uid;
  if (!effectiveUid) return;

  const usage = response.usageMetadata || response.tokenUsage;
  const promptTokens = Number(usage?.promptTokenCount || usage?.promptTokens || 0);
  const candidatesTokens = Number(usage?.candidatesTokenCount || usage?.candidatesTokens || 0);
  const cachedTokens = Number(usage?.cachedContentTokenCount || usage?.cachedTokens || 0);
  const isPro = (operationInfo?.model || '').includes('pro');
  const tokens = calculateTotalBillableTokens(promptTokens, candidatesTokens, isPro);

  if (tokens <= 0) return;

  // Deduction and logging happen exclusively on the server (one atomic write per Gemini
  // response). The client only updates the visible counters optimistically.
  const opLabels: Record<string, string> = {
    essay_grading: 'تصحيح مقالي بالمعنى',
    doc_extraction: 'استخراج بنك أسئلة من ملف/مستند',
    quiz_generation: 'صياغة وتوليد اختبار ذكي',
    image_ocr: 'معالجة رموز ومعادلات (OCR)',
    ocr_equation: 'معالجة رموز ومعادلات (OCR)',
    extract_questions: 'استخراج بنك أسئلة من ملف/مستند',
    generate_quiz: 'صياغة وتوليد اختبار ذكي',
    grade_essay: 'تصحيح مقالي بالمعنى',
    general_generate: 'معالجة ذكاء اصطناعي'
  };
  const rawOp = operationInfo?.operation || 'general_generate';
  const logDoc = {
    id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    user_id: effectiveUid,
    user_name: operationInfo?.userName || auth.currentUser?.displayName || 'المعلم',
    user_email: operationInfo?.userEmail || auth.currentUser?.email || '',
    operation: rawOp,
    operation_label: operationInfo?.operationLabel || opLabels[rawOp] || 'استدعاء AI',
    model: operationInfo?.model || (isPro ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash'),
    prompt_tokens: promptTokens,
    candidates_tokens: candidatesTokens,
    cached_tokens: cachedTokens,
    total_tokens: tokens,
    quiz_id: operationInfo?.quizId || '',
    quiz_title: operationInfo?.quizTitle || '',
    student_name: operationInfo?.studentName || '',
    source: 'client-optimistic'
  };

  window.dispatchEvent(new CustomEvent('tokens_consumed', {
    detail: { userId: effectiveUid, tokens, log: logDoc }
  }));
};

export const isScienceSubject = (subjectName?: string | null, planId?: string | null): boolean => {
  if (planId) {
    const plan = getPlanById(planId);
    if (plan?.category === 'science') return true;
    if (plan?.category === 'theory') return false;
  }
  
  if (!subjectName) return false;
  const s = subjectName.toLowerCase().trim();
  
  const scienceKeywords = [
    'رياضيات', 'رياضه', 'رياضة', 'ماث', 'علوم', 'ساينس', 
    'فيزياء', 'فيزيا', 'كيمياء', 'كيميا', 'أحياء', 'احياء', 'بيولوجي',
    'هندسة', 'هندسه', 'جبر', 'حساب مثلثات', 'تفاضل', 'تكامل', 'استاتيكا', 'ديناميكا', 'ميكانيكا',
    'إحصاء', 'احصاء', 'جيولوجيا', 'علمي', 'حاسب', 'تكنولوجيا', 'it', 'ict',
    'math', 'mathematics', 'science', 'physics', 'chemistry', 'biology', 
    'algebra', 'geometry', 'calculus', 'trigonometry', 'mechanics', 'statistics', 'geology', 'stem'
  ];
  
  return scienceKeywords.some(keyword => s.includes(keyword));
};

export const getAiModelForSubject = (
  subjectName?: string | null, 
  planId?: string | null, 
  preferredModel?: string | null
): { 
  modelName: string; 
  modelType: 'flash' | 'pro';
  isScience: boolean; 
  badgeText: string; 
  badgeDescription: string;
  pricePerMillion: number;
} => {
  const isScience = isScienceSubject(subjectName, planId);
  const isPro = preferredModel === 'pro' || 
    preferredModel === 'gemini_pro' || 
    preferredModel === 'gemini-3.1-pro-preview' || 
    preferredModel === 'gemini-2.5-pro' ||
    String(planId || '').toLowerCase().includes('pro');
  
  if (isPro) {
    return {
      modelName: 'gemini-3.1-pro-preview',
      modelType: 'pro',
      isScience,
      badgeText: 'جيميناي برو (Gemini Pro)',
      badgeDescription: 'استدلال وتفكير عميق (250 ج.م / مليون توكن) - المخرجات × 6',
      pricePerMillion: 250
    };
  }

  return {
    modelName: 'gemini-3.8-flash',
    modelType: 'flash',
    isScience,
    badgeText: 'فلاش 3.8 (Gemini 3.8 Flash)',
    badgeDescription: 'فائق السرعة وموفر (200 ج.م / مليون توكن) - المخرجات × 5',
    pricePerMillion: 200
  };
};

export const generateContentWithModelSelection = async (
  _aiUnused: any,
  params: {
    contents: any;
    config?: any;
    subjectName?: string | null;
    planId?: string | null;
    modelOverride?: string;
    operation?: string;
    idempotencyKey?: string;
  }
) => {
  const currentUserDoc = (typeof window !== 'undefined' && (window as any).__CURRENT_LOGGED_IN_USER__) || null;
  const isExplicitFlash = params.modelOverride === 'gemini-3.8-flash' || params.modelOverride === 'flash' || currentUserDoc?.preferred_ai_model === 'flash';
  const isTeacherPro = !isExplicitFlash && Boolean(
    params.modelOverride === 'gemini-3.1-pro-preview' ||
    params.modelOverride === 'pro' ||
    currentUserDoc?.preferred_ai_model === 'gemini_pro' || 
    currentUserDoc?.preferred_ai_model === 'pro' || 
    String(currentUserDoc?.subscription_type || '').includes('pro') ||
    String(currentUserDoc?.custom_plan_name || '').includes('برو') ||
    String(currentUserDoc?.custom_ai_engine || '').includes('pro') ||
    String(params.planId || '').includes('pro') ||
    currentUserDoc?.isTeacherPro === true
  );
  const effectiveModelOverride = params.modelOverride 
    ? (params.modelOverride === 'pro' ? 'gemini-3.1-pro-preview' : params.modelOverride === 'flash' ? 'gemini-3.8-flash' : params.modelOverride)
    : (isTeacherPro ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash');
  const effectivePlanId = params.planId || (isTeacherPro ? 'pro_token_1M' : undefined);

  const { modelName, isScience } = getAiModelForSubject(params.subjectName, effectivePlanId, effectiveModelOverride);
  const targetModel = effectiveModelOverride || modelName;
  console.log(`[AI Model Selection] Executing generateContent via secure server for subject: "${params.subjectName || ''}", isScience: ${isScience}, isTeacherPro: ${isTeacherPro}, model: ${targetModel}`);
  
  const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
  const reqKey = params.idempotencyKey || `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const savedCustomKey = (typeof window !== 'undefined' ? safeStorage.getItem('user_gemini_api_key') : '') || '';

  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': reqKey,
      ...(savedCustomKey ? { 'x-custom-api-key': savedCustomKey } : {}),
      ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
    },
    body: JSON.stringify({
      contents: params.contents,
      config: params.config,
      subjectName: params.subjectName,
      planId: effectivePlanId,
      modelOverride: targetModel,
      operation: params.operation || 'general_generate',
      idempotencyKey: reqKey
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.error || (response.status === 429 
      ? 'تم تجاوز حد الطلبات المؤقت. يرجى الانتظار قليلاً والمحاولة مرة أخرى.' 
      : 'تعذر معالجة طلب الذكاء الاصطناعي.');
    const errorObj = new Error(errorMsg) as any;
    errorObj.status = response.status;
    errorObj.retryAfter = data.retryAfter;
    throw errorObj;
  }

  if (data.usageMetadata || data.tokenUsage) {
    trackTokenUsage(data, {
      operation: params.operation,
      model: targetModel,
      quizTitle: (params as any).quizTitle
    }).catch(e => console.warn('Token tracking warning:', e));
  }

  return {
    text: data.text || '',
    candidates: data.candidates || [],
    usageMetadata: data.usageMetadata
  };
};

export const formatPlanLabel = (planId: string | null | undefined, billingCycle?: string, customName?: string): string => {
  const cycleText = billingCycle === 'yearly' ? ' (سنوي)' : billingCycle === 'monthly' ? ' (شهري)' : '';
  if (!planId) return 'مجاني';
  if (planId === 'extra_1M_tokens') {
    return 'شحن رصيد إضافي (1 مليون توكن)';
  }
  if (customName) return `${customName}${cycleText}`;

  if (planId.startsWith('pro_token_')) {
    const match = planId.match(/(\d+(?:\.\d+)?)M/i);
    const millions = match ? match[1] : '1';
    return `باقة ${millions} مليون توكن (برو 👑)${cycleText}`;
  }

  if (planId.startsWith('token_') || planId.startsWith('custom_token_') || planId.startsWith('custom_')) {
    const match = planId.match(/(\d+(?:\.\d+)?)M/);
    const millions = match ? match[1] : '';
    if (millions) {
      return `باقة مخصصة (${millions} مليون توكن)${cycleText}`;
    }
    return `باقة مخصصة${cycleText}`;
  }

  if (planId.startsWith('pro_theory_')) {
    const baseId = planId.replace('pro_', '');
    const p = getPlanById(baseId);
    return p ? `${p.name} (نظام برو 👑)${cycleText}` : `باقة نظرية برو${cycleText}`;
  }

  if (planId.startsWith('pro_science_')) {
    const baseId = planId.replace('pro_', '');
    const p = getPlanById(baseId);
    return p ? `${p.name} (نظام برو 👑)${cycleText}` : `باقة علمية برو${cycleText}`;
  }

  const p = getPlanById(planId);
  if (!p) {
    if (planId === 'monthly') return `اشتراك شهري${cycleText}`;
    if (planId === 'yearly') return `اشتراك سنوي${cycleText}`;
    return `${planId} ج.م${cycleText}`;
  }
  return `${p.fullName}${cycleText}`;
};

export const getPlanBadge = (planId: string | null | undefined, customName?: string): { text: string; bg: string; textCol: string } => {
  if (!planId) return { text: 'مجاني', bg: 'bg-slate-100', textCol: 'text-slate-700' };
  if (planId === 'extra_1M_tokens') {
    return { text: 'شحن رصيد إضافي (1 مليون توكن)', bg: 'bg-emerald-100 border border-emerald-300 shadow-xs', textCol: 'text-emerald-800 font-bold' };
  }

  if (planId.startsWith('pro_token_')) {
    const match = planId.match(/(\d+(?:\.\d+)?)M/i);
    const millions = match ? match[1] : '1';
    return {
      text: customName ? `${customName} (برو 👑)` : `باقة ${millions}M توكن (برو 👑)`,
      bg: 'bg-gradient-to-r from-purple-100 via-indigo-100 to-amber-100 border border-purple-300 shadow-xs',
      textCol: 'text-purple-900 font-black'
    };
  }

  if (planId.startsWith('token_') || planId.startsWith('custom_token_') || planId.startsWith('custom_')) {
    const match = planId.match(/(\d+(?:\.\d+)?)M/);
    const millions = match ? match[1] : '1';
    const numMillions = parseFloat(millions) || 1;
    const price = Math.round(numMillions * (TOKEN_PRICE_PER_MILLION || 200));
    return { 
      text: customName ? `${customName} (${millions}M)` : `باقة مخصصة ${millions}M توكن (${price} ج.م)`, 
      bg: 'bg-gradient-to-r from-purple-50 via-indigo-50 to-pink-50 border border-purple-200 shadow-xs', 
      textCol: 'text-purple-800 font-bold' 
    };
  }

  const p = getPlanById(planId);
  if (!p) return { text: planId, bg: 'bg-slate-100', textCol: 'text-slate-700' };
  if (p.category === 'science' || planId.includes('pro')) {
    return { text: `${p.name} (برو 👑)`, bg: 'bg-purple-50 border border-purple-200', textCol: 'text-purple-800 font-black' };
  }
  return { text: `${p.name} (${p.monthlyPrice} ج.م)`, bg: 'bg-indigo-50 border border-indigo-200', textCol: 'text-indigo-700 font-bold' };
};

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export default function App() {
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const quotaAlertShownRef = useRef(false);

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const code = (error as any)?.code || '';
    const isQuotaError = 
      errorMsg.toLowerCase().includes('quota') || 
      errorMsg.toLowerCase().includes('resource_exhausted') || 
      errorMsg.toLowerCase().includes('free daily read units') ||
      code === 'resource-exhausted';
    
    if (isQuotaError) {
      setIsQuotaExceeded(true);
      setIsLoading(false);
      if (!quotaAlertShownRef.current) {
        console.warn('Firestore daily quota exceeded. Queries paused until quota resets or Blaze plan is enabled.');
        quotaAlertShownRef.current = true;
      }
      return;
    }

    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    
    const friendlyMessage = `خطأ في قاعدة البيانات (${operationType}): ${errInfo.error}`;
    setAiMessage(friendlyMessage);
    
    // Also show alert for admins/teachers to help debug
    if (auth.currentUser && !isQuotaError) {
      alert(`خطأ في قاعدة البيانات (${operationType} @ ${path}): ${errInfo.error}\nيرجى التأكد من صلاحيات الوصول أو المحاولة مرة أخرى.`);
    }
  };
  const [mode, setModeState] = useState<'dashboard' | 'build' | 'take-intro' | 'take' | 'results'>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('id') || params.get('q')) ? 'take-intro' : 'dashboard';
  });

  const setMode = useCallback((newMode: 'dashboard' | 'build' | 'take-intro' | 'take' | 'results' | any) => {
    setModeState((prev) => {
      if (prev !== newMode) {
        window.history.pushState({ mode: newMode }, '', window.location.href);
      }
      return newMode;
    });
  }, []);

  useEffect(() => {
    window.history.replaceState({ mode: mode }, '', window.location.href);

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.mode) {
        setModeState(event.state.mode);
      } else {
        const params = new URLSearchParams(window.location.search);
        setModeState((params.get('id') || params.get('q')) ? 'take-intro' : 'dashboard');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { ok, data } = await safeFetch('/api/config', undefined, 1);
        if (ok && data?.configured) {
          // Server AI is configured and ready
        }
      } catch (err) {
        // Silent catch
      }
    };
    
    const checkApi = async () => {
      try {
        const cached = sessionStorage.getItem('cached_api_status');
        if (cached) {
          setApiStatus(JSON.parse(cached));
          return;
        }
        const { ok, data } = await safeFetch('/api/check-env', undefined, 1);
        if (ok) {
          setApiStatus(data);
          sessionStorage.setItem('cached_api_status', JSON.stringify(data));
        }
      } catch (e: any) {
        // Silent catch
      }
    };

    fetchConfig();
    checkApi();
  }, []);

  const [quiz, setQuiz] = useState<Quiz>({
    id: generateId(),
    title: 'اختبار جديد',
    defaultPoints: 1,
    questions: [
      {
        id: generateId(),
        text: '',
        options: ['', ''],
        correctOptionIndex: 0,
        points: 1,
      },
    ],
  });
  const [studentAnswers, setStudentAnswers] = useState<Record<string, any>>(() => {
    const saved = safeStorage.getItem(`answers_${quiz.id}`);
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    if (mode === 'take' && quiz.id) {
      safeStorage.setItem(`answers_${quiz.id}`, JSON.stringify(studentAnswers));
    }
  }, [studentAnswers, mode, quiz.id]);

  useEffect(() => {
    if (mode === 'results') {
      safeStorage.removeItem(`answers_${quiz.id}`);
    }
  }, [mode, quiz.id]);
  const [feedback, setFeedback] = useState<Record<string, { 
    score: number, 
    feedback?: string, 
    correctExample?: string | null,
    steps?: { description: string, points: number, earned: number }[],
    studentAnswer?: any,
    studentAnswerText?: string,
    correctOptionIndex?: number,
    isCorrect?: boolean
  }>>({});
  const [copied, setCopied] = useState(false);
  const [quizLoadError, setQuizLoadError] = useState<string | null>(null);
  const [isShared, setIsShared] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return !!(params.get('id') || params.get('q'));
  });
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  
  const [moveQuestionId, setMoveQuestionId] = useState<string | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveQuizId, setMoveQuizId] = useState<string | null>(null);
  const [showMoveQuizModal, setShowMoveQuizModal] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);
  const [showDeleteQuizModal, setShowDeleteQuizModal] = useState(false);
  
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [recentlyDeletedQuestion, setRecentlyDeletedQuestion] = useState<{ question: Question; index: number } | null>(null);
  const [deleteToastTimer, setDeleteToastTimer] = useState<any>(null);
  const [includeAnswersInExport, setIncludeAnswersInExport] = useState<boolean>(false);
  const [isExportingWord, setIsExportingWord] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isSolvingQuestionId, setIsSolvingQuestionId] = useState<string | null>(null);

  const [studentName, setStudentName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [centerName, setCenterName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [unansweredAttempted, setUnansweredAttempted] = useState(false);
  const [isCheckingAttempts, setIsCheckingAttempts] = useState(false);
  const [attemptCheckError, setAttemptCheckError] = useState('');
  const [aiMessage, setAiMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef<boolean>(false);
  const hasAutoSubmittedRef = useRef<boolean>(false);
  const [submittingProgressText, setSubmittingProgressText] = useState('انتظر قليلاً حتى يتم الانتهاء من تصحيح الأسئلة المقالية...');
  const [submittingCurrentEssayIndex, setSubmittingCurrentEssayIndex] = useState(0);
  const [submittingTotalEssays, setSubmittingTotalEssays] = useState(0);
  
  // Quiz Timer State for Students
  const [quizStartTime, setQuizStartTime] = useState<number | null>(null);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number | null>(null);
  const [timeSpentSeconds, setTimeSpentSeconds] = useState<number>(0);
  const [isTimeUpModalOpen, setIsTimeUpModalOpen] = useState(false);
  
  // Anti-Screenshot & Screen Blackout Protection State
  const [isScreenObscured, setIsScreenObscured] = useState<boolean>(false);
  const [screenObscuredReason, setScreenObscuredReason] = useState<string>('');

  const [isFetchingResults, setIsFetchingResults] = useState(false);
  const [teacherResults, setTeacherResults] = useState<any[]>([]);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [selectedResultsQuizId, setSelectedResultsQuizId] = useState<string>('all');
  const [resultsSearchTerm, setResultsSearchTerm] = useState('');
  const [resultsFilterStatus, setResultsFilterStatus] = useState<'all' | 'sent' | 'not_sent'>('all');
  const [resultsFilterGrade, setResultsFilterGrade] = useState<string>('all');
  const [resultsFilterSubject, setResultsFilterSubject] = useState<string>('all');
  const [resultsFilterCenter, setResultsFilterCenter] = useState<string>('all');
  const [resultsFilterDate, setResultsFilterDate] = useState<string>('all'); // 'all' | 'today' | 'week' | 'month' | 'custom'
  const [resultsFilterCustomDate, setResultsFilterCustomDate] = useState<string>('');
  const [resultsFilterScore, setResultsFilterScore] = useState<string>('all'); // 'all' | 'excellent' | 'very_good' | 'pass' | 'fail'
  const [resultsSortBy, setResultsSortBy] = useState<string>('date_desc'); // 'date_desc' | 'date_asc' | 'score_desc' | 'score_asc' | 'name_asc' | 'name_desc' | 'center_asc'
  const [resultsDeduplicateMode, setResultsDeduplicateMode] = useState<'unique_students' | 'all_attempts'>('unique_students'); // Deduplication: 1 row per unique student or show all attempts
  
  // Batch Sending WhatsApp State
  const [showBatchSendModal, setShowBatchSendModal] = useState(false);
  const [sendingQueue, setSendingQueue] = useState<any[]>([]);
  const [currentSendIndex, setCurrentSendIndex] = useState(0);

  // PDF & Excel Export Loading State
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Student Paper Share & WhatsApp Export State
  const [showPaperShareModal, setShowPaperShareModal] = useState(false);
  const [paperShareResult, setPaperShareResult] = useState<any>(null);
  const [isDownloadingPaper, setIsDownloadingPaper] = useState(false);

  // PDF Page Selection Modal State
  const [showPdfPageModal, setShowPdfPageModal] = useState(false);
  const [pendingPdfData, setPendingPdfData] = useState<{
    file: File;
    arrayBuffer: ArrayBuffer;
    totalPages: number;
    fileName: string;
  } | null>(null);

  const openPaperShareModal = (result: any) => {
    setPaperShareResult(result);
    setShowPaperShareModal(true);
  };

  // Teacher Quiz Results Pagination State
  const [resultsPage, setResultsPage] = useState(1);
  const RESULTS_PER_PAGE = 20;

  // Helper to build a stable, collision-free student identifier for results & attempt tracking
  const getStudentQuizKey = (r: any) => {
    if (!r) return '';
    const qId = (r.quiz_id || '').toString().trim();
    const sName = (r.student_name || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
    const sPhone = (r.parent_phone || r.student_phone || r.phone || '').toString().replace(/[^0-9]/g, '');
    const sCode = (r.student_code || '').toString().trim().toUpperCase();
    const sEmail = (r.student_email || '').toString().trim().toLowerCase();
    const sCenter = (r.center_name || '').toString().trim().toLowerCase();
    
    // Stable discriminator: prevents students without phones or with empty/generic names from colliding
    const secondaryId = sPhone || sCode || sEmail || (sCenter && sCenter !== 'عام' ? sCenter : '') || (sName && sName !== 'طالب' ? '' : (r.id || 'anonymous'));
    return `${qId}_${sName}_${secondaryId}`;
  };

  // Calculate attempt counts per student & quiz
  // Only genuine distinct exam sittings (separated by > 15 minutes, or distinct test sessions) are counted.
  // Network duplicates, rapid clone submissions, or double clicks within the same exam sitting are safely consolidated to 1 attempt.
  const studentAttemptCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!teacherResults || teacherResults.length === 0) return counts;

    // Group records by student
    const studentRecords: Record<string, any[]> = {};
    for (const r of teacherResults) {
      if (!r) continue;
      const key = getStudentQuizKey(r);
      if (!studentRecords[key]) studentRecords[key] = [];
      studentRecords[key].push(r);
    }

    // For each student, count genuine distinct attempts
    for (const [key, records] of Object.entries(studentRecords)) {
      // Sort chronologically ascending
      const sorted = [...records].sort((a, b) => 
        new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      );

      let genuineAttempts = 0;
      let lastAttemptTime = 0;

      for (const r of sorted) {
        const time = new Date(r.created_at || 0).getTime();
        // If this submission is at least 15 minutes after the previous sitting, it's a new attempt
        if (!lastAttemptTime || (time - lastAttemptTime >= 1000 * 60 * 15)) {
          genuineAttempts++;
          lastAttemptTime = time || Date.now();
        }
      }

      counts[key] = Math.max(1, genuineAttempts);
    }
    return counts;
  }, [teacherResults]);

  // Dual-write deduplicated and optionally student-deduplicated base results
  const baseResults = useMemo(() => {
    if (!teacherResults || teacherResults.length === 0) return [];
    
    // First pass: eliminate identical dual-write clones (same quiz, student key, score, within 15 mins)
    const seenDualKeys = new Set<string>();
    const dualDeduped: any[] = [];
    for (const r of teacherResults) {
      if (!r) continue;
      const studentKey = getStudentQuizKey(r);
      const score = Number(r.score) || 0;
      const total = Number(r.total) || 0;
      const timeBucket = Math.floor(new Date(r.created_at || 0).getTime() / (1000 * 60 * 15)); // 15 min bucket
      const dualKey = `${studentKey}_${score}_${total}_${timeBucket}`;
      
      if (!seenDualKeys.has(dualKey)) {
        seenDualKeys.add(dualKey);
        dualDeduped.push(r);
      }
    }

    if (resultsDeduplicateMode === 'all_attempts') {
      return dualDeduped;
    }

    // Second pass (unique_students default): keep only the latest attempt for each distinct student
    const seenStudentKeys = new Set<string>();
    const uniqueStudentsList: any[] = [];
    // Sort by latest date first so the first one seen is the latest attempt
    const sorted = [...dualDeduped].sort((a, b) => 
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    for (const r of sorted) {
      const studentKey = getStudentQuizKey(r);
      if (!seenStudentKeys.has(studentKey)) {
        seenStudentKeys.add(studentKey);
        uniqueStudentsList.push(r);
      }
    }

    return uniqueStudentsList;
  }, [teacherResults, resultsDeduplicateMode]);

  // Extract unique filter options dynamically from current base results
  const uniqueResultCenters = Array.from(
    new Set(baseResults.map(r => (r.center_name || '').trim()).filter(Boolean))
  ).map(String).sort((a, b) => a.localeCompare(b, 'ar'));

  const uniqueResultGrades = Array.from(
    new Set(baseResults.map(r => (r.grade_level || '').trim()).filter(Boolean))
  ).map(String).sort((a, b) => a.localeCompare(b, 'ar'));

  const uniqueResultSubjects = Array.from(
    new Set(baseResults.map(r => (r.subject || '').trim()).filter(Boolean))
  ).map(String).sort((a, b) => a.localeCompare(b, 'ar'));

  const isAnyResultFilterActive = 
    resultsSearchTerm.trim() !== '' ||
    resultsFilterStatus !== 'all' ||
    resultsFilterGrade !== 'all' ||
    resultsFilterSubject !== 'all' ||
    resultsFilterCenter !== 'all' ||
    resultsFilterDate !== 'all' ||
    resultsFilterScore !== 'all' ||
    resultsSortBy !== 'date_desc' ||
    resultsDeduplicateMode !== 'unique_students';

  const resetAllResultsFilters = () => {
    setResultsSearchTerm('');
    setResultsFilterStatus('all');
    setResultsFilterGrade('all');
    setResultsFilterSubject('all');
    setResultsFilterCenter('all');
    setResultsFilterDate('all');
    setResultsFilterCustomDate('');
    setResultsFilterScore('all');
    setResultsSortBy('date_desc');
    setResultsDeduplicateMode('unique_students');
    setResultsPage(1);
  };

  const filteredResults = baseResults
    .filter(r => {
      // Quiz ID filter
      if (selectedResultsQuizId && selectedResultsQuizId !== 'all') {
        if (r.quiz_id !== selectedResultsQuizId) return false;
      }

      // Search term filter (student name, center, phone, grade, subject)
      const term = resultsSearchTerm.toLowerCase().trim();
      if (term) {
        const studentNameMatch = (r.student_name || '').toLowerCase().includes(term);
        const centerMatch = (r.center_name || '').toLowerCase().includes(term);
        const studentPhoneMatch = (r.student_phone || r.phone || '').includes(term);
        const parentPhoneMatch = (r.parent_phone || '').includes(term);
        const subjectMatch = (r.subject || '').toLowerCase().includes(term);
        const gradeMatch = (r.grade_level || '').toLowerCase().includes(term);
        if (!studentNameMatch && !centerMatch && !studentPhoneMatch && !parentPhoneMatch && !subjectMatch && !gradeMatch) {
          return false;
        }
      }

      // Review & WhatsApp sent filter
      if (resultsFilterStatus === 'sent' && !r.reviewed_and_sent) return false;
      if (resultsFilterStatus === 'not_sent' && !!r.reviewed_and_sent) return false;

      // Grade level filter
      if (resultsFilterGrade !== 'all') {
        const g = (r.grade_level || '').trim();
        if (g !== resultsFilterGrade) return false;
      }

      // Subject filter
      if (resultsFilterSubject !== 'all') {
        const s = (r.subject || '').trim();
        if (s !== resultsFilterSubject) return false;
      }

      // Center / group filter
      if (resultsFilterCenter !== 'all') {
        const c = (r.center_name || '').trim();
        if (c !== resultsFilterCenter) return false;
      }

      // Exam Date filter
      if (resultsFilterDate === 'today') {
        if (!r.created_at) return false;
        const resDate = new Date(r.created_at);
        const today = new Date();
        if (resDate.toDateString() !== today.toDateString()) return false;
      } else if (resultsFilterDate === 'week') {
        if (!r.created_at) return false;
        const diff = Date.now() - new Date(r.created_at).getTime();
        if (diff > 7 * 24 * 60 * 60 * 1000) return false;
      } else if (resultsFilterDate === 'month') {
        if (!r.created_at) return false;
        const diff = Date.now() - new Date(r.created_at).getTime();
        if (diff > 30 * 24 * 60 * 60 * 1000) return false;
      } else if (resultsFilterDate === 'custom' && resultsFilterCustomDate) {
        if (!r.created_at) return false;
        const itemDateStr = new Date(r.created_at).toISOString().slice(0, 10);
        if (itemDateStr !== resultsFilterCustomDate) return false;
      }

      // Score / performance tier filter
      if (resultsFilterScore !== 'all') {
        const total = r.total || 1;
        const pct = (r.score / total) * 100;
        if (resultsFilterScore === 'excellent' && pct < 85) return false;
        if (resultsFilterScore === 'very_good' && (pct < 75 || pct >= 85)) return false;
        if (resultsFilterScore === 'pass' && (pct < 50 || pct >= 75)) return false;
        if (resultsFilterScore === 'fail' && pct >= 50) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (resultsSortBy === 'date_desc') {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      if (resultsSortBy === 'date_asc') {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      }
      if (resultsSortBy === 'score_desc') {
        const pctB = (b.score || 0) / (b.total || 1);
        const pctA = (a.score || 0) / (a.total || 1);
        return pctB - pctA;
      }
      if (resultsSortBy === 'score_asc') {
        const pctB = (b.score || 0) / (b.total || 1);
        const pctA = (a.score || 0) / (a.total || 1);
        return pctA - pctB;
      }
      if (resultsSortBy === 'name_asc') {
        return (a.student_name || '').localeCompare(b.student_name || '', 'ar');
      }
      if (resultsSortBy === 'name_desc') {
        return (b.student_name || '').localeCompare(a.student_name || '', 'ar');
      }
      if (resultsSortBy === 'center_asc') {
        return (a.center_name || '').localeCompare(b.center_name || '', 'ar');
      }
      return 0;
    });

  const sentCount = filteredResults.filter(r => !!r.reviewed_and_sent).length;
  const notSentCount = filteredResults.length - sentCount;

  // Key Summary Insights for filtered results
  const filteredAvgScore = filteredResults.length > 0 
    ? (filteredResults.reduce((sum, r) => sum + (r.score || 0), 0) / filteredResults.length).toFixed(1)
    : '0';
  const filteredAvgPct = filteredResults.length > 0
    ? Math.round(filteredResults.reduce((sum, r) => sum + ((r.score || 0) / (r.total || 1)) * 100, 0) / filteredResults.length)
    : 0;
  const filteredPassCount = filteredResults.filter(r => (r.score || 0) / (r.total || 1) >= 0.5).length;
  const filteredPassRate = filteredResults.length > 0 ? Math.round((filteredPassCount / filteredResults.length) * 100) : 0;
  const filteredTopScore = filteredResults.length > 0 ? Math.max(...filteredResults.map(r => r.score || 0)) : 0;

  const totalResultsPages = Math.ceil(filteredResults.length / RESULTS_PER_PAGE) || 1;
  const paginatedResults = filteredResults.slice(
    (resultsPage - 1) * RESULTS_PER_PAGE,
    resultsPage * RESULTS_PER_PAGE
  );

  const toggleReviewAndSent = async (result: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newStatus = !result.reviewed_and_sent;
    const now = new Date().toISOString();
    
    // Update local state immediately
    setTeacherResults(prev => prev.map(r => 
      r.id === result.id 
        ? { ...r, reviewed_and_sent: newStatus, reviewed_and_sent_at: newStatus ? now : null } 
        : r
    ));

    if (sheetStudentResult && sheetStudentResult.id === result.id) {
      setSheetStudentResult(prev => prev ? { ...prev, reviewed_and_sent: newStatus, reviewed_and_sent_at: newStatus ? now : null } : null);
    }

    // Persist in Firestore directly and via backend API
    if (result.id) {
      let firestoreUpdated = false;
      try {
        await updateDoc(doc(db, 'results', result.id), {
          reviewed_and_sent: newStatus,
          reviewed_and_sent_at: newStatus ? now : null
        });
        firestoreUpdated = true;
      } catch (err) {
        console.warn('Direct Firestore update for review status notice, falling back to API:', err);
      }

      // Always synchronize with authoritative backend endpoint as well
      try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => token) : token;
        await fetch(`/api/results/${result.id}/review`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify({
            reviewed_and_sent: newStatus,
            reviewed_and_sent_at: newStatus ? now : null
          })
        });
      } catch (apiErr) {
        if (!firestoreUpdated) {
          console.error('Failed to update review status via API:', apiErr);
        }
      }
    }
  };

  const [showGradingModal, setShowGradingModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [manualGrades, setManualGrades] = useState<Record<string, number>>({});

  // Student detailed solution sheet modal state
  const [showStudentSheetModal, setShowStudentSheetModal] = useState(false);
  const [sheetStudentResult, setSheetStudentResult] = useState<any>(null);
  const [sheetQuizData, setSheetQuizData] = useState<any>(null);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);

  // Student Data Retention and Privacy Policy state
  const [showPrivacyPolicyModal, setShowPrivacyPolicyModal] = useState(false);
  const [showRetentionModal, setShowRetentionModal] = useState(false);
  const [retentionDays, setRetentionDays] = useState(90);
  const [isProcessingRetention, setIsProcessingRetention] = useState(false);
  const [retentionSuccessMessage, setRetentionSuccessMessage] = useState('');

  // Self account deletion state
  const [showSelfDeleteModal, setShowSelfDeleteModal] = useState(false);
  const [isDeletingSelf, setIsDeletingSelf] = useState(false);

  // Technical report modal state
  const [showTechnicalReportModal, setShowTechnicalReportModal] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // Platform-wide student database & notification state (for super admin gergesnabil101@gmail.com)
  const [platformStudents, setPlatformStudents] = useState<any[]>(() => {
    try {
      const cached = safeStorage.getItem('cached_platform_students');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [isLoadingPlatformStudents, setIsLoadingPlatformStudents] = useState(false);
  const [platformStudentsError, setPlatformStudentsError] = useState<string | null>(null);
  const [studentDbSearch, setStudentDbSearch] = useState('');
  const [studentGradeFilter, setStudentGradeFilter] = useState('all');
  const [studentSubjectFilter, setStudentSubjectFilter] = useState('all');
  const [studentTeacherFilter, setStudentTeacherFilter] = useState('all');

  // Platform Students Database Pagination State
  const [platformStudentsPage, setPlatformStudentsPage] = useState(1);
  const PLATFORM_STUDENTS_PER_PAGE = 20;

  const filteredPlatformStudents = platformStudents.filter(st => {
    const matchSearch = !studentDbSearch || (st.name && st.name.toLowerCase().includes(studentDbSearch.toLowerCase())) || (st.phone && String(st.phone).includes(studentDbSearch)) || (st.center_name && st.center_name.toLowerCase().includes(studentDbSearch.toLowerCase()));
    const matchGrade = studentGradeFilter === 'all' || st.grade_level === studentGradeFilter;
    const matchSubject = studentSubjectFilter === 'all' || st.subject === studentSubjectFilter;
    const matchTeacher = studentTeacherFilter === 'all' || st.teacher_name === studentTeacherFilter;
    return matchSearch && matchGrade && matchSubject && matchTeacher;
  });

  const totalPlatformStudentPages = Math.ceil(filteredPlatformStudents.length / PLATFORM_STUDENTS_PER_PAGE) || 1;
  const paginatedPlatformStudents = filteredPlatformStudents.slice(
    (platformStudentsPage - 1) * PLATFORM_STUDENTS_PER_PAGE,
    platformStudentsPage * PLATFORM_STUDENTS_PER_PAGE
  );

  const uniqueGrades = Array.from(new Set(platformStudents.map(s => s.grade_level).filter(Boolean)));
  const uniqueSubjects = Array.from(new Set(platformStudents.map(s => s.subject).filter(Boolean)));
  const uniqueTeachers = Array.from(new Set(platformStudents.map(s => s.teacher_name).filter(Boolean)));

  // Notification broadcasting state
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifTargetType, setNotifTargetType] = useState<'all' | 'grade' | 'subject' | 'teacher'>('all');
  const [notifTargetValue, setNotifTargetValue] = useState('');
  const [isSendingNotif, setIsSendingNotif] = useState(false);
  const [notifSuccessMsg, setNotifSuccessMsg] = useState('');

  // Student notifications received
  const [studentNotifications, setStudentNotifications] = useState<any[]>([]);

  const [isSyncingStudents, setIsSyncingStudents] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');

  const fetchPlatformStudents = async () => {
    const isSuperAdmin = user?.email && user.email.toLowerCase().trim() === 'gergesnabil101@gmail.com';
    if (!isSuperAdmin) return;
    setIsLoadingPlatformStudents(true);
    setPlatformStudentsError(null);
    try {
      let list: any[] = [];
      // Try to fetch from optimized 'students' collection first
      const studentsSnap = await getDocs(collection(db, 'students'));
      if (!studentsSnap.empty) {
        studentsSnap.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });
      } else {
        // Fallback to legacy results aggregation (migration)
        const resultsSnap = await getDocs(collection(db, 'results'));
        const studentMap = new Map<string, any>();
        
        resultsSnap.forEach(d => {
          const r = d.data();
          const studentPhone = (r.student_phone || r.phone || '').trim();
          const studentName = (r.student_name || 'طالب').trim();
          const key = studentPhone ? `${studentName}_${studentPhone}` : `${studentName}_${r.created_at || Math.random()}`;
          
          if (!studentMap.has(key)) {
            studentMap.set(key, {
              id: key,
              name: studentName,
              phone: studentPhone,
              parent_phone: r.parent_phone || '',
              center_name: r.center_name || '',
              grade_level: r.grade_level || 'غير محدد',
              subject: r.subject || 'غير محدد',
              teacher_name: r.teacher_name || '',
              exams_taken: 1,
              last_score: r.score,
              total_score: r.total,
              last_date: r.created_at || new Date().toISOString()
            });
          } else {
            const existing = studentMap.get(key);
            existing.exams_taken += 1;
            existing.last_date = r.created_at > existing.last_date ? r.created_at : existing.last_date;
          }
        });

        list = Array.from(studentMap.values());
      }

      list.sort((a, b) => new Date(b.last_date).getTime() - new Date(a.last_date).getTime());
      setPlatformStudents(list);
      try {
        safeStorage.setItem('cached_platform_students', JSON.stringify(list));
      } catch {}
    } catch (e: any) {
      console.warn('Could not fetch latest platform students:', e?.message || e);
      const isQuota = e?.code === 'resource-exhausted' || (e?.message && e.message.toLowerCase().includes('quota'));
      if (isQuota) {
        setIsQuotaExceeded(true);
        setPlatformStudentsError('تم الوصول للحد المجاني اليومي لقراءات قاعدة البيانات. جاري عرض البيانات المحفوظة محلياً إن وجدت.');
      } else {
        setPlatformStudentsError('تعذر جلب أحدث بيانات الطلاب حالياً.');
      }
    } finally {
      setIsLoadingPlatformStudents(false);
    }
  };

  const syncAndUpgradeStudentsDatabase = async () => {
    const isSuperAdmin = user?.email && user.email.toLowerCase().trim() === 'gergesnabil101@gmail.com';
    if (!isSuperAdmin) return;
    
    setIsSyncingStudents(true);
    setSyncProgress('جاري جلب نتائج الطلاب لتأسيس قاعدة البيانات الموحدة...');
    try {
      const resultsSnap = await getDocs(collection(db, 'results'));
      const studentMap = new Map<string, any>();
      
      resultsSnap.forEach(d => {
        const r = d.data();
        const studentPhone = (r.student_phone || r.phone || '').trim();
        const studentName = (r.student_name || 'طالب').trim();
        const key = studentPhone ? `${studentName}_${studentPhone}` : `${studentName}_${r.created_at || Math.random()}`;
        
        if (!studentMap.has(key)) {
          studentMap.set(key, {
            id: key,
            name: studentName,
            phone: studentPhone,
            parent_phone: r.parent_phone || '',
            center_name: r.center_name || '',
            grade_level: r.grade_level || 'غير محدد',
            subject: r.subject || 'غير محدد',
            teacher_name: r.teacher_name || '',
            teacher_id: r.teacher_id || r.user_id || null,
            exams_taken: 1,
            last_score: r.score,
            total_score: r.total,
            last_date: r.created_at || new Date().toISOString()
          });
        } else {
          const existing = studentMap.get(key);
          existing.exams_taken += 1;
          if (r.created_at && r.created_at > existing.last_date) {
            existing.last_date = r.created_at;
            existing.last_score = r.score;
            existing.total_score = r.total;
            if (r.center_name) existing.center_name = r.center_name;
            if (r.grade_level) existing.grade_level = r.grade_level;
            if (r.subject) existing.subject = r.subject;
          }
        }
      });

      const studentsList = Array.from(studentMap.values());
      setSyncProgress(`جاري حفظ بيانات ${studentsList.length} طالب في قاعدة البيانات الجديدة...`);

      // Write to Firestore in batches of 200 (safe limit for write latency/size)
      let batch = writeBatch(db);
      let count = 0;
      let batchCount = 0;

      for (const st of studentsList) {
        const docRef = doc(db, 'students', st.id.replace(/[\/.\s#$\[\]]/g, '_'));
        batch.set(docRef, st, { merge: true });
        count++;

        if (count === 200) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
          batchCount++;
          setSyncProgress(`تم حفظ دفعة ${batchCount * 200} طالب...`);
        }
      }

      if (count > 0) {
        await batch.commit();
      }

      setSyncProgress('تمت المزامنة بنجاح!');
      alert(`تهانينا! تم نقل وتحديث بيانات ${studentsList.length} طالب بنجاح إلى قاعدة البيانات السريعة للطلاب.`);
      fetchPlatformStudents();
    } catch (e: any) {
      console.error("Error syncing students database:", e);
      alert('حدث خطأ أثناء مزامنة قاعدة البيانات: ' + (e.message || e));
    } finally {
      setIsSyncingStudents(false);
      setSyncProgress('');
    }
  };

  const handleSendPlatformNotification = async () => {
    if (!notifTitle.trim() || !notifMessage.trim()) {
      alert('يرجى إدخال عنوان ورسالة الإشعار.');
      return;
    }
    if (notifTargetType !== 'all' && !notifTargetValue.trim()) {
      alert('يرجى اختيار قيمة الاستهداف المحددة (المرحلة أو المادة أو المعلم).');
      return;
    }
    setIsSendingNotif(true);
    try {
      const notifRef = doc(collection(db, 'notifications'));
      const newNotifData = {
        id: notifRef.id,
        title: notifTitle.trim(),
        message: notifMessage.trim(),
        targetType: notifTargetType,
        targetValue: notifTargetType === 'all' ? 'الكل' : notifTargetValue.trim(),
        created_at: new Date().toISOString(),
        sender_email: user?.email || 'gergesnabil101@gmail.com'
      };
      await setDoc(notifRef, newNotifData);
      setStudentNotifications(prev => [newNotifData, ...prev.filter(n => n.id !== notifRef.id)]);
      setNotifSuccessMsg('تم إرسال الإشعار بنجاح للطلاب المستهدفين!');
      setNotifTitle('');
      setNotifMessage('');
      setNotifTargetValue('');
      setTimeout(() => setNotifSuccessMsg(''), 5000);
    } catch (e: any) {
      console.error('Failed to send notification:', e);
      alert('فشل إرسال الإشعار: ' + (e.message || 'حدث خطأ أثناء حفظ الإشعار في قاعدة البيانات'));
    } finally {
      setIsSendingNotif(false);
    }
  };

  const handleDeleteNotification = async (notifId: string) => {
    if (!window.confirm('هل تريد بالتأكيد حذف هذا الإشعار؟ لن يظهر للطلاب بعد الحذف.')) return;
    try {
      await deleteDoc(doc(db, 'notifications', notifId));
      setStudentNotifications(prev => prev.filter(n => n.id !== notifId));
    } catch (e: any) {
      console.error('Failed to delete notification:', e);
      alert('فشل حذف الإشعار: ' + (e.message || 'خطأ في الحذف'));
    }
  };

  useEffect(() => {
    const fetchStudentNotifs = async () => {
      try {
        const notifsSnap = await getDocs(collection(db, 'notifications'));
        const list = notifsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort latest first
        list.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        setStudentNotifications(list);
      } catch (e) {
        console.warn('Failed to fetch student notifications:', e);
      }
    };
    fetchStudentNotifs();
  }, []);

  const openStudentSheet = async (result: any) => {
    setSheetStudentResult(result);
    setIsLoadingSheet(true);
    setShowStudentSheetModal(true);

    try {
      // 1. If currently loaded quiz matches the result's quiz_id and has questions
      if (quiz && quiz.id === result.quiz_id && quiz.questions && quiz.questions.length > 0) {
        setSheetQuizData(quiz);
        setIsLoadingSheet(false);
        return;
      }

      // 2. Check in loaded quizzes array
      const matchingQuiz = quizzes.find(q => q.id === result.quiz_id);
      if (matchingQuiz && matchingQuiz.data) {
        try {
          const parsed = JSON.parse(matchingQuiz.data);
          if (parsed && parsed.questions && parsed.questions.length > 0) {
            setSheetQuizData(parsed);
            setIsLoadingSheet(false);
            return;
          }
        } catch (e) {
          console.error("Failed to parse matching quiz data", e);
        }
      }

      // 3. Fetch directly from Firestore quizzes doc with cache fallback
      let quizDoc;
      try {
        quizDoc = await getDoc(doc(db, 'quizzes', result.quiz_id));
      } catch (docErr: any) {
        const msg = (docErr?.message || '').toLowerCase();
        if (msg.includes('quota') || docErr?.code === 'failed-precondition' || docErr?.code === 'resource-exhausted') {
          try {
            quizDoc = await getDocFromCache(doc(db, 'quizzes', result.quiz_id));
          } catch (cacheErr) {
            console.warn("Cache fetch failed for student sheet", cacheErr);
          }
        }
      }

      if (quizDoc && quizDoc.exists()) {
        const d = quizDoc.data();
        if (d.data) {
          const parsed = JSON.parse(d.data);
          setSheetQuizData(parsed);
          setIsLoadingSheet(false);
          return;
        }
      }

      // Fallback
      setSheetQuizData(quiz);
    } catch (err) {
      console.error("Error loading quiz data for student sheet", err);
      setSheetQuizData(quiz);
    } finally {
      setIsLoadingSheet(false);
    }
  };

  const regradeSingleStudentSheet = async (resultToRegrade?: any, quizDataToUse?: any) => {
    const targetResult = resultToRegrade || sheetStudentResult;
    const targetQuiz = quizDataToUse || sheetQuizData;
    if (!targetResult || !targetQuiz || !Array.isArray(targetQuiz.questions)) {
      alert('تعذر الوصول لبيانات أسئلة الاختبار لإعادة التقييم.');
      return;
    }

    try {
      let feedback: any = {};
      try {
        feedback = typeof targetResult.feedback === 'string' ? JSON.parse(targetResult.feedback || '{}') : (targetResult.feedback || {});
      } catch {
        feedback = {};
      }

      const isEng = isEnglishContent(targetQuiz.title, targetQuiz.subject || teacherInfo?.subject);
      let newTotalScore = 0;
      let newTotalPossible = 0;

      targetQuiz.questions.forEach((q: any) => {
        const qPoints = q.points || 1;
        newTotalPossible += qPoints;
        const f = feedback[q.id] || {};

        if (q.type === 'essay') {
          const studentAns = f.studentAnswer !== undefined 
            ? f.studentAnswer 
            : (targetResult.student_answers ? JSON.parse(targetResult.student_answers || '{}')[q.id] : undefined);
          let essayScore = typeof f.score === 'number' ? f.score : undefined;
          if (essayScore === undefined) {
            const match = checkEssayExactOrEquivalent(studentAns, q.modelAnswer, qPoints, isEng, q.keywords);
            if (match.matched) {
              essayScore = match.score;
              feedback[q.id] = {
                ...f,
                studentAnswer: studentAns,
                score: essayScore,
                isCorrect: match.isCorrect,
                feedback: match.feedback || f.feedback,
                steps: match.steps && match.steps.length > 0 ? match.steps : f.steps
              };
            } else {
              essayScore = 0;
            }
          }
          newTotalScore += essayScore;
        } else {
          const studentAnswer = f.studentAnswer !== undefined 
            ? f.studentAnswer 
            : (targetResult.student_answers ? JSON.parse(targetResult.student_answers || '{}')[q.id] : undefined);
          const isCorrect = isQuestionAnswerCorrect(q, studentAnswer);
          const score = isCorrect ? qPoints : 0;
          newTotalScore += score;
          feedback[q.id] = {
            ...f,
            studentAnswer: studentAnswer,
            score: score,
            isCorrect: isCorrect
          };
        }
      });

      if (newTotalPossible <= 0) {
        newTotalPossible = targetResult.total || 1;
      }
      newTotalScore = Math.max(0, Math.min(newTotalScore, newTotalPossible));

      const updatedFeedbackStr = JSON.stringify(feedback);
      const updatedResult = {
        ...targetResult,
        score: newTotalScore,
        total: newTotalPossible,
        feedback: updatedFeedbackStr,
        is_graded: true
      };

      setSheetStudentResult(updatedResult);
      setTeacherResults(prev => prev.map(r => r.id === updatedResult.id ? updatedResult : r));

      let saved = false;
      try {
        await updateDoc(doc(db, 'results', targetResult.id), {
          feedback: updatedFeedbackStr,
          score: newTotalScore,
          total: newTotalPossible,
          is_graded: true
        });
        saved = true;
      } catch (firestoreErr) {
        console.warn("Direct Firestore update for sheet regrade notice, falling back to API:", firestoreErr);
      }

      if (!saved) {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => token) : token;
        await fetch(`/api/results/${targetResult.id}/grade`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify({
            score: newTotalScore,
            total: newTotalPossible,
            feedback: updatedFeedbackStr,
            is_graded: true
          })
        });
      }

      alert(`تمت إعادة تقييم وتحديث درجات ورقة الطالب بنجاح! الدرجة المحتسبة: ${newTotalScore} من ${newTotalPossible}`);
    } catch (e) {
      console.error("Failed to regrade single sheet:", e);
      alert('حدث خطأ أثناء إعادة التقييم.');
    }
  };

  const updateQuestionGradeInSheet = async (questionId: string, newScore: number) => {
    if (!sheetStudentResult) return;
    try {
      const feedback = JSON.parse(sheetStudentResult.feedback || '{}');
      if (!feedback[questionId]) {
        feedback[questionId] = {};
      }
      feedback[questionId].score = newScore;
      
      let newTotalScore = 0;
      Object.keys(feedback).forEach(qid => {
        newTotalScore += (Number(feedback[qid].score) || 0);
      });

      const feedbackStr = JSON.stringify(feedback);
      const updatedResult = {
        ...sheetStudentResult,
        feedback: feedbackStr,
        score: newTotalScore,
        is_graded: true
      };

      setSheetStudentResult(updatedResult);
      setTeacherResults(prev => prev.map(r => r.id === updatedResult.id ? updatedResult : r));

      let saved = false;
      try {
        await updateDoc(doc(db, 'results', sheetStudentResult.id), {
          feedback: feedbackStr,
          score: newTotalScore,
          is_graded: true
        });
        saved = true;
      } catch (firestoreErr) {
        console.warn("Direct Firestore update for grade notice, falling back to API:", firestoreErr);
      }

      if (!saved) {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => token) : token;
        const res = await fetch(`/api/results/${sheetStudentResult.id}/grade`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify({
            score: newTotalScore,
            feedback: feedbackStr,
            is_graded: true
          })
        });
        if (!res.ok) {
          throw new Error('فشل تحديث الدرجة عبر الخادم');
        }
      }

      alert('تم تحديث الدرجة بنجاح.');
    } catch (err) {
      console.error("Failed to update question grade", err);
      alert('حدث خطأ أثناء تحديث الدرجة.');
    }
  };

  const openGradingModal = (result: any) => {
    setSelectedResult(result);
    const feedback = JSON.parse(result.feedback || '{}');
    const grades: Record<string, number> = {};
    const isEng = isEnglishContent(quiz.title, quiz.subject || teacherInfo?.subject);

    (quiz.questions || []).forEach(q => {
      const f = feedback[q.id] || {};
      let currentScore = f.score;
      if (q.type === 'essay') {
        const studentAns = f.studentAnswer;
        if (currentScore === undefined) {
          const match = checkEssayExactOrEquivalent(studentAns, q.modelAnswer, q.points || 1, isEng, q.keywords);
          if (match.matched) {
            currentScore = match.score;
          }
        }
      }
      grades[q.id] = currentScore !== undefined ? currentScore : 0;
    });

    setManualGrades(grades);
    setShowGradingModal(true);
  };

  const saveManualGrading = async () => {
    if (!selectedResult) return;
    try {
      const feedback = JSON.parse(selectedResult.feedback || '{}');
      let newTotalScore = 0;
      
      // Update feedback with manual grades
      Object.keys(feedback).forEach(qid => {
        if (manualGrades[qid] !== undefined) {
          feedback[qid].score = manualGrades[qid];
          const q = quiz.questions?.find(item => item.id === qid);
          const qPoints = q?.points || 1;
          feedback[qid].isCorrect = manualGrades[qid] >= (qPoints * 0.75);
        }
        newTotalScore += feedback[qid].score || 0;
      });

      const feedbackStr = JSON.stringify(feedback);
      const updatedResult = {
        ...selectedResult,
        feedback: feedbackStr,
        score: newTotalScore,
        is_graded: true
      };

      // Update local state
      setTeacherResults(teacherResults.map(r => 
        r.id === selectedResult.id ? updatedResult : r
      ));
      if (sheetStudentResult && sheetStudentResult.id === selectedResult.id) {
        setSheetStudentResult(updatedResult);
      }
      
      setShowGradingModal(false);

      let saved = false;
      try {
        await updateDoc(doc(db, 'results', selectedResult.id), {
          feedback: feedbackStr,
          score: newTotalScore,
          is_graded: true
        });
        saved = true;
      } catch (firestoreErr) {
        console.warn("Direct Firestore manual grade save notice, falling back to API:", firestoreErr);
      }

      if (!saved) {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => token) : token;
        const res = await fetch(`/api/results/${selectedResult.id}/grade`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify({
            score: newTotalScore,
            feedback: feedbackStr,
            is_graded: true
          })
        });
        if (!res.ok) {
          throw new Error('فشل حفظ التصحيح عبر الخادم');
        }
      }

      alert('تم حفظ التصحيح واعتماد النتيجة بنجاح.');
    } catch (e) {
      console.error("Failed to save manual grading", e);
      alert('حدث خطأ أثناء حفظ التصحيح.');
    }
  };

  const recalculateAllScores = async () => {
    if (!teacherResults || teacherResults.length === 0) {
      alert('لا توجد نتائج مسجلة لهذا الاختبار حالياً لإعادة حسابها.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Resolve quiz questions reliably
      const currentQuizId = teacherResults[0]?.quiz_id || quiz.id;
      let targetQuestions = quiz?.questions;
      let targetTitle = quiz?.title || 'اختبار';
      let targetSubject = quiz?.subject || teacherInfo?.subject;

      // If quiz in state has no questions or doesn't match the current results, resolve from quizzes or Firestore
      if (!Array.isArray(targetQuestions) || targetQuestions.length === 0 || (quiz.id && currentQuizId && quiz.id !== currentQuizId)) {
        const matchingQuiz = quizzes.find(q => q.id === currentQuizId);
        if (matchingQuiz) {
          if (Array.isArray(matchingQuiz.questions) && matchingQuiz.questions.length > 0) {
            targetQuestions = matchingQuiz.questions;
            targetTitle = matchingQuiz.title || targetTitle;
            targetSubject = matchingQuiz.subject || targetSubject;
          } else if (matchingQuiz.data) {
            try {
              const parsed = JSON.parse(matchingQuiz.data);
              if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
                targetQuestions = parsed.questions;
                targetTitle = parsed.title || matchingQuiz.title;
                targetSubject = parsed.subject || matchingQuiz.subject || targetSubject;
              }
            } catch (err) {
              console.warn("Failed to parse matching quiz data", err);
            }
          }
        }

        if (!Array.isArray(targetQuestions) || targetQuestions.length === 0) {
          try {
            const qDoc = await getDoc(doc(db, 'quizzes', currentQuizId));
            if (qDoc.exists()) {
              const qd = qDoc.data();
              if (qd.data) {
                const parsed = JSON.parse(qd.data);
                if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
                  targetQuestions = parsed.questions;
                  targetTitle = parsed.title || qd.title;
                  targetSubject = parsed.subject || qd.subject || targetSubject;
                }
              }
            }
          } catch (docErr) {
            console.warn("Failed to fetch quiz doc for recalculation", docErr);
          }
        }
      }

      if (!Array.isArray(targetQuestions) || targetQuestions.length === 0) {
        alert('تعذر الوصول لأسئلة هذا الاختبار لإعادة احتساب الدرجات. يرجى التأكد من حفظ أسئلة الاختبار أولاً.');
        setIsLoading(false);
        return;
      }

      const isEng = isEnglishContent(targetTitle, targetSubject);
      const updatedResults: any[] = [];
      const updatesForApi: any[] = [];

      for (const result of teacherResults) {
        let feedback: any = {};
        try {
          feedback = typeof result.feedback === 'string' ? JSON.parse(result.feedback || '{}') : (result.feedback || {});
        } catch {
          feedback = {};
        }

        let newTotalScore = 0;
        let newTotalPossible = 0;

        targetQuestions.forEach(q => {
          const qPoints = q.points || 1;
          newTotalPossible += qPoints;
          const f = feedback[q.id] || {};
          
          if (q.type === 'essay') {
            const studentAns = f.studentAnswer;
            let essayScore = typeof f.score === 'number' ? f.score : undefined;
            if (essayScore === undefined) {
              const match = checkEssayExactOrEquivalent(studentAns, q.modelAnswer, qPoints, isEng, q.keywords);
              if (match.matched) {
                essayScore = match.score;
                feedback[q.id] = {
                  ...f,
                  score: essayScore,
                  isCorrect: match.isCorrect,
                  feedback: match.feedback || f.feedback,
                  steps: match.steps && match.steps.length > 0 ? match.steps : f.steps
                };
              } else {
                essayScore = 0;
              }
            }
            newTotalScore += essayScore;
          } else {
            // Re-calculate for multiple choice / true-false
            const studentAnswer = f.studentAnswer;
            const isCorrect = isQuestionAnswerCorrect(q, studentAnswer);
            const score = isCorrect ? qPoints : 0;
            newTotalScore += score;
            
            feedback[q.id] = {
              ...f,
              score: score,
              isCorrect: isCorrect
            };
          }
        });

        if (newTotalPossible <= 0) {
          newTotalPossible = result.total || 1;
        }
        newTotalScore = Math.max(0, Math.min(newTotalScore, newTotalPossible));

        const updatedFeedbackStr = JSON.stringify(feedback);

        updatedResults.push({
          ...result,
          score: newTotalScore,
          total: newTotalPossible,
          feedback: updatedFeedbackStr,
          is_graded: true
        });

        updatesForApi.push({
          id: result.id,
          score: newTotalScore,
          total: newTotalPossible,
          feedback: updatedFeedbackStr,
          is_graded: true
        });
      }

      // Update local state immediately so table updates in real time
      setTeacherResults(updatedResults);

      // Attempt 1: Authoritative Server API (Admin SDK bypasses client limits & permission locks)
      let apiSucceeded = false;
      try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => token) : token;
        const res = await fetch('/api/results/batch-recalculate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify({ updates: updatesForApi })
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && data.success) {
            apiSucceeded = true;
          } else {
            console.log("Server batch recalculate requested direct Firestore batch...");
          }
        } else {
          console.warn("Server batch recalculate non-200, trying direct Firestore batch...", res.status);
        }
      } catch (apiErr) {
        console.warn("Server batch recalculate API notice:", apiErr);
      }

      // Attempt 2: Fallback to Firestore client batch if API wasn't available
      if (!apiSucceeded) {
        const chunkSize = 450;
        for (let i = 0; i < updatesForApi.length; i += chunkSize) {
          const chunk = updatesForApi.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          for (const item of chunk) {
            const docRef = doc(db, 'results', item.id);
            batch.update(docRef, {
              score: item.score,
              total: item.total,
              feedback: item.feedback,
              is_graded: true
            });
          }
          await batch.commit();
        }
      }

      alert('تم تحديث درجات جميع الطلاب وتصحيح الإجابات المطابقة للنموذج بنجاح!');
    } catch (e: any) {
      console.error("Failed to recalculate scores", e);
      alert('حدث خطأ أثناء تحديث الدرجات: ' + (e?.message || 'يرجى المحاولة مرة أخرى'));
    } finally {
      setIsLoading(false);
    }
  };

  // Auth & Subscription State
  const [user, setUser] = useState<any>(null);
  const [curriculum, setCurriculum] = useState<string>('');
  const [token, setToken] = useState<string | null>(null);
  const [customClaims, setCustomClaims] = useState<any>(null);

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState(safeStorage.getItem('lastEmail') || '');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatusMessage, setForgotStatusMessage] = useState('');
  const [forgotErrorMessage, setForgotErrorMessage] = useState('');
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [authName, setAuthName] = useState('');
  const [authWhatsapp, setAuthWhatsapp] = useState('');
  const [authSubject, setAuthSubject] = useState('');
  const [authGradeLevels, setAuthGradeLevels] = useState<string[]>([]);
  const [generateAvatar, setGenerateAvatar] = useState(false);
  const [authAvatarData, setAuthAvatarData] = useState<string | null>(null);
  const [authError, setAuthError] = useState('');
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const safeFetch = async (url: string, options?: RequestInit, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, options);
        
        if (res.status === 429) {
          return { ok: false, error: 'Rate exceeded', status: 429 };
        }

        // If we get a 404 or 5xx, it might be transient, retry.
        if ((res.status === 404 || res.status >= 500) && i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
          continue;
        }

        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          return { ok: res.ok, data, status: res.status };
        } else {
          const text = await res.text();
          if (res.status !== 429) {
            console.error(`Expected JSON from ${url} but got ${res.status}:`, text.substring(0, 100));
          }
          return { ok: false, error: `استجابة غير صالحة من الخادم (كود: ${res.status})`, status: res.status };
        }
      } catch (e) {
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
          continue;
        }
        return { ok: false, error: 'فشل الاتصال بالخادم', status: 0 };
      }
    }
    return { ok: false, error: 'فشل الاتصال بالخادم بعد عدة محاولات', status: 0 };
  };

  // Dashboard State
  const [folders, setFolders] = useState<Folder[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [centers, setCenters] = useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [newCenterName, setNewCenterName] = useState('');
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [isSavingQuiz, setIsSavingQuiz] = useState(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [apiStatus, setApiStatus] = useState<{ hasKey: boolean, prefix: string } | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isErrorDismissed, setIsErrorDismissed] = useState(false);
  const [adminUserSearch, setAdminUserSearch] = useState('');
  const [lookupUserQuery, setLookupUserQuery] = useState('');
  const [isLookingUpUser, setIsLookingUpUser] = useState(false);
  const [lookupResultMsg, setLookupResultMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string; user?: any } | null>(null);
  const [adminUserCategoryFilter, setAdminUserCategoryFilter] = useState<'all' | 'active' | 'trial' | 'closed' | 'active_today' | 'pro' | 'new'>('all');
  const [adminUsersPage, setAdminUsersPage] = useState(1);
  const [auditSyncNotice, setAuditSyncNotice] = useState<{
    isOpen: boolean;
    total: number;
    trial: number;
    active: number;
    closed: number;
    recent: number;
    newlyAdded: number;
    timestamp: Date;
  } | null>(null);
  const USERS_PER_PAGE = 20;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageZoomModalUrl, setImageZoomModalUrl] = useState<string | null>(null);

  const optimizeQuestionImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawResult = e.target?.result as string;
        if (!rawResult) {
          resolve('');
          return;
        }
        const img = new window.Image();
        img.onload = () => {
          try {
            const maxDim = 1400;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(rawResult);
              return;
            }
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
            resolve(dataUrl);
          } catch (err) {
            resolve(rawResult);
          }
        };
        img.onerror = () => resolve(rawResult);
        img.src = rawResult;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const cropImageBoxFromCanvas = (
    canvas: HTMLCanvasElement, 
    rawBox: any
  ): string | undefined => {
    if (!canvas || !rawBox) return undefined;
    try {
      const { width, height } = canvas;
      if (width <= 0 || height <= 0) return undefined;

      let ymin = rawBox.ymin ?? rawBox.y_min ?? rawBox.top;
      let xmin = rawBox.xmin ?? rawBox.x_min ?? rawBox.left;
      let ymax = rawBox.ymax ?? rawBox.y_max ?? rawBox.bottom;
      let xmax = rawBox.xmax ?? rawBox.x_max ?? rawBox.right;

      if (Array.isArray(rawBox) && rawBox.length >= 4) {
        [ymin, xmin, ymax, xmax] = rawBox;
      } else if (rawBox.box_2d && Array.isArray(rawBox.box_2d)) {
        [ymin, xmin, ymax, xmax] = rawBox.box_2d;
      }

      ymin = Number(ymin);
      xmin = Number(xmin);
      ymax = Number(ymax);
      xmax = Number(xmax);

      if (isNaN(ymin) || isNaN(xmin) || isNaN(ymax) || isNaN(xmax)) return undefined;

      // Handle both normalized [0..1] and 1000-scaled [0..1000]
      const isNormalized = (ymax <= 1.05 && xmax <= 1.05) && (ymax > 0 || xmax > 0 || ymin > 0 || xmin > 0);
      const scaleFactor = isNormalized ? 1 : 1000;

      const normYmin = Math.min(Math.max(0, ymin / scaleFactor), 1);
      const normXmin = Math.min(Math.max(0, xmin / scaleFactor), 1);
      const normYmax = Math.min(Math.max(0, ymax / scaleFactor), 1);
      const normXmax = Math.min(Math.max(0, xmax / scaleFactor), 1);

      // 1.8% generous margin padding
      const padX = Math.round(width * 0.018);
      const padY = Math.round(height * 0.018);

      const x1 = Math.max(0, Math.round(normXmin * width) - padX);
      const y1 = Math.max(0, Math.round(normYmin * height) - padY);
      const x2 = Math.min(width, Math.round(normXmax * width) + padX);
      const y2 = Math.min(height, Math.round(normYmax * height) + padY);

      const cropW = x2 - x1;
      const cropH = y2 - y1;

      if (cropW < 25 || cropH < 25) return undefined;

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext('2d');
      if (!cropCtx) return undefined;

      cropCtx.fillStyle = '#ffffff';
      cropCtx.fillRect(0, 0, cropW, cropH);
      cropCtx.drawImage(canvas, x1, y1, cropW, cropH, 0, 0, cropW, cropH);
      return cropCanvas.toDataURL('image/jpeg', 0.88);
    } catch (e) {
      console.warn('cropImageBoxFromCanvas error:', e);
      return undefined;
    }
  };

  const syncPublicProfile = async (uid: string, data: { name?: string; subject?: string; gradeLevel?: any; curriculum?: string; avatar_data?: string; preferred_ai_model?: string; is_pro?: boolean }) => {
    try {
      if (!uid) return;
      const isProVal = Boolean(data.is_pro || data.preferred_ai_model === 'gemini_pro' || data.preferred_ai_model === 'pro');
      await setDoc(doc(db, 'public_profiles', uid), {
        id: uid,
        name: data.name || '',
        subject: data.subject || '',
        grade_level: data.gradeLevel || '',
        curriculum: data.curriculum || '',
        avatar_data: data.avatar_data || '',
        preferred_ai_model: isProVal ? 'gemini_pro' : (data.preferred_ai_model || 'flash'),
        is_pro: isProVal,
        updated_at: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn("Public profile sync warning:", e);
    }
  };

  const updateProfile = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const targetModel = profileData.preferred_ai_model === 'pro' ? 'gemini_pro' : 'flash';
      await updateDoc(doc(db, 'users', uid), {
        name: profileData.name,
        subject: profileData.subject,
        grade_level: profileData.gradeLevel,
        curriculum: profileData.curriculum,
        avatar_data: profileData.avatar_data,
        centers: profileData.centers,
        preferred_ai_model: targetModel,
        custom_ai_engine: targetModel === 'gemini_pro' ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash'
      });
      (window as any).__CURRENT_LOGGED_IN_USER__ = {
        ...((window as any).__CURRENT_LOGGED_IN_USER__ || {}),
        preferred_ai_model: targetModel,
        custom_ai_engine: targetModel === 'gemini_pro' ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash'
      };
      setUser((prev: any) => prev ? { ...prev, preferred_ai_model: targetModel } : prev);

      // Also sync non-sensitive public profile for students
      await syncPublicProfile(uid, {
        name: profileData.name,
        subject: profileData.subject,
        gradeLevel: profileData.gradeLevel,
        curriculum: profileData.curriculum,
        avatar_data: profileData.avatar_data,
        preferred_ai_model: targetModel,
        is_pro: targetModel === 'gemini_pro'
      });
      
      alert('تم تحديث البيانات بنجاح');
      setShowProfileModal(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const fetchDashboardData = async (uid: string) => {
    try {
      const foldersQ = query(collection(db, 'folders'), where('user_id', '==', uid), limit(200));
      const quizzesQ = query(collection(db, 'quizzes'), where('user_id', '==', uid), limit(2000));
      
      let foldersSnap, quizzesSnap;
      const cacheKey = `dashboard_cache_time_${uid}`;
      const lastFetch = sessionStorage.getItem(cacheKey);
      const shouldFetchFromServer = !lastFetch || (Date.now() - parseInt(lastFetch) > 5 * 60 * 1000);

      try {
        if (shouldFetchFromServer) {
          [foldersSnap, quizzesSnap] = await Promise.all([
            getDocs(foldersQ),
            getDocs(quizzesQ)
          ]);
          sessionStorage.setItem(cacheKey, Date.now().toString());
        } else {
          [foldersSnap, quizzesSnap] = await Promise.all([
            getDocsFromCache(foldersQ),
            getDocsFromCache(quizzesQ)
          ]);
        }
      } catch (e: any) {
        if (e?.message?.toLowerCase().includes('quota') || e?.code === 'failed-precondition') {
          // Fallback to cache silently
          [foldersSnap, quizzesSnap] = await Promise.all([
            getDocsFromCache(foldersQ),
            getDocsFromCache(quizzesQ)
          ]);
        } else {
          throw e;
        }
      }
      
      setFolders(foldersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')));
      setQuizzes(quizzesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)).sort((a, b) => b.id.localeCompare(a.id)));
    } catch (e: any) {
      console.warn("Dashboard fetch encountered an error, possibly quota, falling back.", e);
    }
  };
  const [hiddenQuestions, setHiddenQuestions] = useState<Record<string, boolean>>({});
  const toggleQuestionImage = (qId: string) => {
    setHiddenQuestions(prev => ({ ...prev, [qId]: !prev[qId] }));
  };
  const dashboardLoadedRef = useRef(false);
  const checkedPendingStatusRef = useRef(false);
  const unsubscribeUserRef = useRef<(() => void) | null>(null);
  const isFetchingAdminDataRef = useRef(false);
  const lastAdminFetchTimeRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        if (mode === 'build') {
          e.preventDefault();
          saveQuiz(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, quiz, quizzes, user]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Get ID Token with custom claims, gracefully handle offline/transient network glitches
          let idTokenResult: any = null;
          let idToken: string = '';
          try {
            idTokenResult = await user.getIdTokenResult(false);
            idToken = idTokenResult?.token || '';
          } catch (tokenErr: any) {
            console.warn("Notice: Getting ID token had transient network issue, using cached token fallback:", tokenErr?.message);
            idToken = safeStorage.getItem('token') || '';
          }

          const email = (user.email || '').toLowerCase().trim();
          const isTargetAdmin = email === 'gergesnabil101@gmail.com';
          const isAdmin = isTargetAdmin || idTokenResult?.claims?.role === 'admin' || idTokenResult?.claims?.admin === true;
          if (idToken) {
            setToken(idToken);
            safeStorage.setItem('token', idToken);
          }

          if (!dashboardLoadedRef.current) {
            dashboardLoadedRef.current = true;
            fetchDashboardData(user.uid);
          }

          if (unsubscribeUserRef.current) unsubscribeUserRef.current();
          unsubscribeUserRef.current = onSnapshot(doc(db, 'users', user.uid), async (userDocSnap) => {
            if (userDocSnap && userDocSnap.exists()) {
              const data = userDocSnap.data() as any;
              
              const stats = getUserTokenStats(data);
              const userEmail = (data.email || '').toLowerCase().trim();
              const isTargetAccount = userEmail === 'samehafef68@gmail.com';

              const trialEnd = data.trial_extended_until 
                ? new Date(data.trial_extended_until) 
                : new Date(new Date(data.created_at || new Date().toISOString()).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
              const now = new Date();
              const isTrialType = data.subscription_status === 'trial' || data.subscription_type === 'trial' || data.subscription_type === 'free_trial' || data.subscription_type === 'free' || !data.subscription_type;
              const isTrialActive = !data.is_suspended && (now <= trialEnd) && isTrialType;
              
              const subEndDate = data.subscription_end_date ? new Date(data.subscription_end_date) : null;
              const isPaidPlan = isTargetAccount || (
                !isTrialType && (
                  data.subscription_status === 'active' ||
                  (subEndDate && now <= subEndDate) ||
                  (Number(data.custom_tokens_millions) > 0) ||
                  (Number(data.tokens_limit) > 0) ||
                  (Number(data.token_balance) > 0) ||
                  (Number(data.extra_tokens) > 0) ||
                  (data.subscription_type && data.subscription_type !== 'trial' && data.subscription_type !== 'free')
                )
              );
              
              const totalTokenLimit = stats.totalLimit;
              const isTokensExhausted = stats.isExhausted;

              const hasPaidTokenBalance = (stats.remaining > 0 || totalTokenLimit > 0) && !isTokensExhausted && !data.is_suspended;
              const isSubActive = isTargetAdmin || isAdmin || isTargetAccount || (isPaidPlan && (!subEndDate || now <= subEndDate || stats.remaining > 0) && !data.is_suspended) || hasPaidTokenBalance;
              const isActive = isTargetAdmin || isAdmin || isSubActive;
              
              if (!isTargetAdmin && !isAdmin && data.is_suspended && (isSubActive || isTrialActive || stats.remaining > 0)) {
                updateDoc(doc(db, 'users', user.uid), { is_suspended: false, hasAccess: true }).catch(console.error);
              }
              
              if ((isTargetAdmin || isAdmin) && data.is_suspended) {
                updateDoc(doc(db, 'users', user.uid), {
                  is_suspended: false,
                  hasAccess: true,
                  subscription_status: 'active',
                  subscription_end_date: '2099-12-31T23:59:59.000Z'
                }).catch(console.error);
              }

              // Access check: active paid subscription or active unexpired trial or positive remaining token balance grants access
              const finalHasAccess = isTargetAdmin || isAdmin || isTargetAccount || isSubActive || isTrialActive || (stats.remaining > 0 && !data.is_suspended);

              const isTeacherProFromDoc = Boolean(
                data.preferred_ai_model === 'gemini_pro' ||
                data.preferred_ai_model === 'pro' ||
                String(data.subscription_type || '').includes('pro') ||
                String(data.custom_plan_name || '').includes('برو') ||
                String(data.custom_ai_engine || '').includes('pro')
              );

              const targetPreferredModel = data.preferred_ai_model === 'flash'
                ? 'flash'
                : (data.preferred_ai_model === 'gemini_pro' || data.preferred_ai_model === 'pro' ? 'gemini_pro' : (isTeacherProFromDoc ? 'gemini_pro' : 'flash'));

              const updatedUserData = {
                ...(data || {}),
                id: data.id || user.uid,
                uid: data.uid || user.uid,
                role: (isTargetAdmin || isAdmin) ? 'admin' : (data.role || 'user'),
                isAdmin: isTargetAdmin || isAdmin,
                hasAccess: isTargetAdmin || finalHasAccess,
                isTrialActive: isTargetAdmin ? false : isTrialActive,
                isActive: isTargetAdmin || isActive,
                isSubActive: isTargetAdmin ? true : isSubActive,
                is_suspended: (isTargetAdmin || isAdmin) ? false : !!data.is_suspended,
                subscription_status: isTargetAdmin ? 'active' : (data.subscription_status || (isTrialActive ? 'trial' : 'expired')),
                trialDaysLeft: isTrialActive ? Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0,
                preferred_ai_model: targetPreferredModel,
                isTeacherPro: targetPreferredModel === 'gemini_pro'
              };

              (window as any).__CURRENT_LOGGED_IN_USER__ = updatedUserData;
              setUser((prev: any) => ({
                ...(prev || {}),
                ...updatedUserData
              }));
            // Only fetch pending status if it hasn't been set in this session and user is fully authenticated on client
            if (!isQuotaExceeded && !checkedPendingStatusRef.current && !data.hasPendingSubscription && auth.currentUser && auth.currentUser.uid === user.uid) {
              checkedPendingStatusRef.current = true;
              try {
                let pendingReqSnap;
                const pendingReqQ = query(collection(db, 'subscription_requests'), where('user_id', '==', user.uid), where('status', '==', 'pending'), limit(1));
                try {
                   pendingReqSnap = await getDocs(pendingReqQ);
                } catch (pe: any) {
                   if (pe?.message?.toLowerCase().includes('quota')) {
                     setIsQuotaExceeded(true);
                     pendingReqSnap = await getDocsFromCache(pendingReqQ);
                   } else throw pe;
                }
                if (pendingReqSnap) {
                  setUser((prev: any) => ({
                      ...prev,
                      hasPendingSubscription: !pendingReqSnap.empty
                  }));
                }
              } catch (e: any) {
                console.warn("Error checking pending requests (gracefully managed):", e);
                if (e.message?.includes('quota')) setIsQuotaExceeded(true);
              }
            }
            
            setProfileData({
              name: data.name || '',
              subject: data.subject || '',
              gradeLevel: data.grade_level || '',
              curriculum: data.curriculum || '',
              avatar_data: data.avatar_data || '',
              centers: data.centers || [],
              preferred_ai_model: isTeacherProFromDoc ? 'pro' : 'flash'
            });

            // Ensure public profile exists for current teacher with Pro status
            syncPublicProfile(user.uid, {
              name: data.name,
              subject: data.subject,
              gradeLevel: data.grade_level,
              curriculum: data.curriculum,
              avatar_data: data.avatar_data,
              preferred_ai_model: isTeacherProFromDoc ? 'gemini_pro' : 'flash',
              is_pro: isTeacherProFromDoc
            });

            // Background real-time token reconciliation for logged-in user
            // Token counters are maintained by the server; the client no longer recomputes or overwrites them.

            setAuthMode(null);

            const params = new URLSearchParams(window.location.search);
            if (!params.get('id') && !params.get('q')) {
              setIsLoading(false);
            }
          } else {
            console.warn('User document not found in Firestore for UID:', user.uid, '- Auto healing profile...');
            const autoEmail = (user.email || '').toLowerCase().trim();
            const autoName = user.displayName || autoEmail.split('@')[0] || 'مشترك';
            const autoProfile = {
              email: autoEmail,
              name: autoName,
              phone: '',
              subject: '',
              grade_level: [],
              avatar_data: '',
              role: isAdmin ? 'admin' : 'user',
              subscription_type: '200',
              subscription_end_date: null,
              subscription_status: 'trial',
              is_suspended: false,
              hasAccess: true,
              tokens_used: 0,
              tokens_used_today: 0,
              last_token_reset_date: new Date().toISOString().split('T')[0],
              created_at: new Date().toISOString()
            };
            try {
              await setDoc(doc(db, 'users', user.uid), autoProfile, { merge: true });
              await syncPublicProfile(user.uid, {
                name: autoName,
                subject: '',
                gradeLevel: [],
                avatar_data: ''
              });
            } catch (hErr) {
              console.warn('Auto-heal Firestore write notice:', hErr);
            }
            setUser((prev: any) => ({
              id: user.uid,
              uid: user.uid,
              ...(prev || {}),
              ...autoProfile,
              role: (isTargetAdmin || isAdmin) ? 'admin' : 'user',
              isAdmin: isTargetAdmin || isAdmin,
              hasAccess: true,
              isTrialActive: true,
              isActive: isTargetAdmin || isAdmin,
              isSubActive: isTargetAdmin || isAdmin,
              is_suspended: false,
              subscription_status: isTargetAdmin ? 'active' : 'trial',
              trialDaysLeft: 3,
            }));
            setAuthMode(null);
            const params = new URLSearchParams(window.location.search);
            if (!params.get('id') && !params.get('q')) {
              setIsLoading(false);
            }
          }
          }, (e: any) => {
            if (e?.message?.toLowerCase().includes('quota') || e?.code === 'failed-precondition') {
              setIsQuotaExceeded(true);
            }
            console.warn("User document real-time listener notice (cached/offline mode active):", e?.message || e);
          });
        } catch (error: any) {
          console.error("Auth error:", error);
        }
      } else {
        setUser(null);
        setAuthMode('login');
        setToken(null);
        safeStorage.removeItem('token');
        const params = new URLSearchParams(window.location.search);
        if (!params.get('id') && !params.get('q')) {
          setIsLoading(false);
        }
      }
    });
    unsubscribeUserRef.current = unsubscribeAuth;
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    const id = params.get('id')?.trim();

    if (id) {
      const fetchSharedQuiz = async () => {
        setIsLoading(true);
        setQuizLoadError(null);
        try {
          let quizData: any = null;
          let serverErrorMsg: string | null = null;

          // 1. Direct Firestore Web SDK fetch (instant, reliable, uses API Key + firestore.rules)
          try {
            const quizSnap = await getDoc(doc(db, 'quizzes', id));
            if (quizSnap.exists()) {
              quizData = { id: quizSnap.id, ...quizSnap.data() };
            }
          } catch (fsErr) {
            console.warn("Direct Firestore quiz fetch notice:", fsErr);
          }

          // 2. Server API fallback
          if (!quizData) {
            try {
              let token = '';
              try {
                token = safeStorage.getItem('token') || '';
              } catch (storageErr) {
                console.warn("safeStorage token access is blocked/disabled:", storageErr);
              }
              const headers: any = {};
              if (token) headers['Authorization'] = `Bearer ${token}`;
              
              const res = await fetch(`/api/quizzes/${id}`, { headers });
              if (res.ok) {
                quizData = await res.json();
              } else {
                try {
                  const errData = await res.json();
                  if (errData && errData.error) {
                    serverErrorMsg = errData.error;
                  }
                } catch (parseErr) {
                  // Not JSON response
                }
                serverErrorMsg = serverErrorMsg || `خطأ في الاتصال بالخادم أثناء تحميل الاختبار (رمز الحالة: ${res.status}). يرجى المحاولة مرة أخرى.`;
              }
            } catch (apiErr) {
              console.warn("API quiz fetch notice:", apiErr);
              serverErrorMsg = 'تعذر الاتصال بالخادم لتحميل الاختبار. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.';
            }
          }

          if (!quizData) {
            setQuizLoadError(serverErrorMsg || 'هذا الاختبار غير موجود أو تم حذفه.');
            setMode('take-intro');
            setIsLoading(false);
            return;
          }

          let parsedQuiz: any = quizData;
          if (typeof quizData.data === 'string') {
            try {
              const p = JSON.parse(quizData.data);
              parsedQuiz = { ...quizData, ...p };
            } catch (e) {
              parsedQuiz = quizData;
            }
          } else if (quizData.data && typeof quizData.data === 'object') {
            parsedQuiz = { ...quizData, ...quizData.data };
          }

          const rawQuestions = Array.isArray(parsedQuiz.questions)
            ? parsedQuiz.questions
            : (Array.isArray(quizData.questions) ? quizData.questions : []);

          const sanitizedQuestions = rawQuestions.map((q: any) => {
            const sq = { ...q };
            return sq;
          });

          const finalQuiz = {
            ...parsedQuiz,
            id: quizData.id || parsedQuiz.id || id,
            title: parsedQuiz.title || quizData.title || 'اختبار بدون عنوان',
            user_id: quizData.user_id || parsedQuiz.user_id || null,
            questions: sanitizedQuestions
          };

          // Check teacher active subscription / trial status
          const teacherUid = quizData.user_id || parsedQuiz.user_id;
          if (teacherUid) {
            try {
              const statusRes = await fetch(`/api/teachers/${teacherUid}/status`);
              if (statusRes.ok) {
                const sData = await statusRes.json();
                if (!sData.active) {
                  setQuizLoadError(sData.reason || 'عذراً، هذا الاختبار غير متاح حالياً لأن الفترة التجريبية أو باقة اشتراك المعلم قد انتهت. يرجى من المعلم الاشتراك أو تجديد الباقة لتفعيل الاختبار للطلاب.');
                  setMode('take-intro');
                  setIsShared(true);
                  setIsLoading(false);
                  return;
                }
              }
            } catch (stErr) {
              console.warn("Teacher status check warning:", stErr);
            }
          }

          // ONLY set the quiz data once the teacher's subscription/active status check has completed and passed!
          setQuiz(finalQuiz);

          // Fetch teacher info from public_profiles
          if (teacherUid) {
            try {
              const profSnap = await getDoc(doc(db, 'public_profiles', teacherUid));
              if (profSnap.exists()) {
                const pd = profSnap.data() as any;
                const isProTeacher = pd.is_pro === true || pd.preferred_ai_model === 'gemini_pro' || pd.preferred_ai_model === 'pro' || String(pd.subscription_type || '').includes('pro');
                setTeacherInfo({
                  id: teacherUid,
                  name: pd.name || '',
                  avatar_data: pd.avatar_data || '',
                  subject: pd.subject || '',
                  gradeLevel: pd.grade_level || '',
                  preferred_ai_model: isProTeacher ? 'gemini_pro' : (pd.preferred_ai_model || 'flash'),
                  is_pro: isProTeacher,
                  subscription_type: pd.subscription_type || (isProTeacher ? 'pro_token_1M' : undefined)
                });
              } else if (quizData.teacher_name || quizData.teacher_avatar || quizData.teacher_subject || quizData.teacher_grade_level) {
                const isProTeacher = quizData.ai_model === 'pro' || quizData.ai_model === 'gemini_pro';
                setTeacherInfo({
                  id: teacherUid,
                  name: quizData.teacher_name || '',
                  avatar_data: quizData.teacher_avatar || '',
                  subject: quizData.teacher_subject || '',
                  gradeLevel: quizData.teacher_grade_level || '',
                  preferred_ai_model: isProTeacher ? 'gemini_pro' : 'flash',
                  is_pro: isProTeacher
                });
              }
            } catch (profErr) {
              console.warn("Could not fetch public profile:", profErr);
              if (quizData.teacher_name || quizData.teacher_avatar || quizData.teacher_subject || quizData.teacher_grade_level) {
                setTeacherInfo({
                  name: quizData.teacher_name || '',
                  avatar_data: quizData.teacher_avatar || '',
                  subject: quizData.teacher_subject || '',
                  gradeLevel: quizData.teacher_grade_level || ''
                });
              }
            }
          }

          setMode('take-intro');
          setIsShared(true);
          setStudentName('');
          setStudentCode('');
          setCenterName('');
          setParentPhone('');
          setStudentEmail('');
        } catch (error: any) {
          console.error("Error fetching shared quiz:", error);
          setQuizLoadError('حدث خطأ أثناء تحميل الاختبار. يرجى التأكد من اتصالك بالإنترنت ثم إعادة المحاولة.');
          setMode('take-intro');
        } finally {
          setIsLoading(false);
        }
      };
      fetchSharedQuiz();
    } else if (q) {
      try {
        const decodedQuiz = JSON.parse(decodeURIComponent(atob(q)));
        // Keep questions intact so auto-grading, essay evaluation, and model answers function accurately
        if (decodedQuiz && Array.isArray(decodedQuiz.questions)) {
          decodedQuiz.questions = decodedQuiz.questions.map((q: any) => ({ ...q }));
        }
        setQuiz(decodedQuiz);
        setMode('take-intro');
        setIsShared(true);
        setStudentName('');
        setCenterName('');
        setParentPhone('');
          setStudentEmail('');
      } catch (e) {
        console.error("Failed to parse quiz from URL", e);
      }
      setIsLoading(false);
    }
  }, []);

  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotStatusMessage('');
    setForgotErrorMessage('');
    setIsSendingResetEmail(true);

    const targetEmail = (forgotEmail || authEmail).trim().toLowerCase();
    if (!targetEmail) {
      setForgotErrorMessage('يرجى كتابة البريد الإلكتروني الخاص بك أولاً');
      setIsSendingResetEmail(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setForgotStatusMessage('تم إرسال رابط إعادة ضبط كلمة المرور إلى بريدك الإلكتروني بنجاح! يرجى فحص صندوق الرسائل الواردة أو الرسائل غير المرغوب فيها (Spam).');
    } catch (err: any) {
      console.error('Password reset error:', err);
      let msg = 'فشل إرسال رابط إعادة ضبط كلمة المرور.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        msg = 'البريد الإلكتروني غير مسجل في المنصة أو غير صحيح.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'تم إرسال عدة طلبات مؤخراً. يرجى الانتظار بضع دقائق ثم المحاولة.';
      }
      setForgotErrorMessage(msg);
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthErrorCode(null);
    setIsGenerating(true);
    
    const email = authEmail.trim().toLowerCase();
    const password = authPassword.trim();

    try {
      console.log(`Attempting ${authMode}...`);
      if (authMode === 'register') {
        let userCredential;
        try {
          userCredential = await createUserWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
          if (err.code === 'auth/email-already-in-use' && auth.currentUser) {
            userCredential = { user: auth.currentUser };
          } else {
            throw err;
          }
        }
        
        const idToken = await userCredential.user.getIdToken();
        setToken(idToken);

        try {
          // Initial document is created with 5-day trial and hasAccess: true
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            email: email,
            name: authName,
            phone: authWhatsapp,
            subject: authSubject || '',
            grade_level: authGradeLevels,
            avatar_data: authAvatarData || '',
            role: 'user',
            subscription_type: '200',
            subscription_end_date: null,
            subscription_status: 'trial',
            is_suspended: false,
            hasAccess: true,
            tokens_used: 0,
            tokens_used_today: 0,
            last_token_reset_date: new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString()
          });

          // Sync initial non-sensitive public profile
          await syncPublicProfile(userCredential.user.uid, {
            name: authName,
            subject: authSubject || '',
            gradeLevel: authGradeLevels,
            avatar_data: authAvatarData || ''
          });

          // Background server notification and sync
          fetch('/api/auth/register-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              name: authName,
              phone: authWhatsapp,
              subject: authSubject || '',
              grade_level: authGradeLevels,
              avatar_data: authAvatarData || '',
              email: email
            })
          }).catch(e => console.warn("Background register sync notice:", e));
        } catch (firestoreErr: any) {
          console.warn("Client Firestore creation notice, attempting fallback via server API:", firestoreErr);
          try {
            const syncRes = await fetch('/api/auth/register-profile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({
                name: authName,
                phone: authWhatsapp,
                subject: authSubject || '',
                grade_level: authGradeLevels,
                avatar_data: authAvatarData || '',
                email: email
              })
            });
            if (!syncRes.ok) {
              const errData = await syncRes.json().catch(() => ({}));
              console.warn("Server fallback notice:", errData);
            }
          } catch (serverSyncErr: any) {
            console.warn("Profile sync notice:", serverSyncErr);
          }
        }

        // Notify Admin via Backend and register in persistent server storage
        try {
          const notifyIdToken = await userCredential.user.getIdToken().catch(() => null);
          await fetch('/api/admin/notify-registration', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(notifyIdToken ? { 'Authorization': `Bearer ${notifyIdToken}` } : {})
            },
            body: JSON.stringify({
              uid: userCredential.user.uid,
              name: authName,
              email: email,
              phone: authWhatsapp,
              subject: authSubject,
              grade_level: authGradeLevels
            })
          });
        } catch (notifyErr) {
          console.error("Failed to notify admin:", notifyErr);
        }

        // Generate AI Avatar if requested
        if (generateAvatar) {
          try {
            const avatarRes = await fetch('/api/ai/avatar', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({
                name: authName,
                subject: authSubject,
                gradeLevel: authGradeLevels,
                avatarData: authAvatarData || ''
              })
            });
            if (avatarRes.ok) {
              const avatarDataRes = await avatarRes.json();
              if (avatarDataRes.avatarData) {
                await updateDoc(doc(db, 'users', userCredential.user.uid), {
                  avatar_data: avatarDataRes.avatarData
                });
                await syncPublicProfile(userCredential.user.uid, {
                  name: authName,
                  subject: authSubject,
                  gradeLevel: authGradeLevels,
                  avatar_data: avatarDataRes.avatarData
                });
              }
            }
          } catch (avatarErr) {
            console.warn("Avatar generation background notice:", avatarErr);
          }
        }

        // Sync initial custom claims
        try {
          await fetch('/api/auth/sync-claims', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            }
          });
          await userCredential.user.getIdToken(true);
        } catch (syncErr) {
          console.warn("Sync claims notice:", syncErr);
        }
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await userCredential.user.getIdToken();
        setToken(idToken);

        // Sync custom claims on sign-in
        try {
          await fetch('/api/auth/sync-claims', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            }
          });
          await userCredential.user.getIdToken(true);
        } catch (syncErr) {
          console.warn("Sync claims notice:", syncErr);
        }
      }
      
      console.log('Auth success');
      safeStorage.setItem('lastEmail', email);
      setAuthMode(null);
    } catch (err: any) {
      const code = err?.code || '';
      setAuthErrorCode(code);
      let message = 'حدث خطأ أثناء المصادقة. يرجى التأكد من بياناتك والمحاولة مرة أخرى.';
      
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-login-credentials') {
        message = 'البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التأكد من كتابة البريد وكلمة المرور بدقة، أو استخدام خيار "نسيت كلمة المرور؟".';
        console.warn("Auth credentials mismatch (invalid credentials):", code);
      } else if (code === 'auth/network-request-failed') {
        message = 'فشل الاتصال بالإنترنت. يرجى التحقق من اتصالك بالشبكة وإعادة المحاولة.';
        console.warn("Auth network error:", err.message);
      } else if (code === 'auth/too-many-requests') {
        message = 'تم حظر المحاولات مؤقتاً لحماية حسابك بسبب تكرار المحاولات غير الصحيحة. يرجى الانتظار قليلاً أو إعادة ضبط كلمة المرور.';
        console.warn("Auth rate limited:", err.message);
      } else if (code === 'auth/email-already-in-use') {
        message = 'هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول أو استعادة كلمة المرور.';
        console.warn("Auth email already in use:", code);
      } else if (code === 'auth/weak-password') {
        message = 'كلمة المرور ضعيفة جداً. يرجى استخدام 6 أحرف أو أرقام على الأقل.';
      } else if (code === 'auth/invalid-email') {
        message = 'صيغة البريد الإلكتروني غير صالحة. يرجى إدخال بريد إلكتروني صحيح.';
      } else if (code === 'auth/user-disabled') {
        message = 'تم تعطيل هذا الحساب. يرجى التواصل مع إدارة المنصة للمساعدة.';
      } else {
        console.error("Auth error:", err);
        message = err?.message || message;
      }
      setAuthError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const createFolder = async () => {
    const uid = auth.currentUser?.uid;
    if (!newFolderName.trim() || !uid) {
      console.warn('Cannot create folder: missing name or uid', { newFolderName, uid });
      return;
    }
    
    if (newFolderName.length >= 100) {
      alert('اسم المجلد طويل جداً. يرجى استخدام أقل من 100 حرف.');
      return;
    }

    try {
      const id = generateId();
      const newFolder = {
        id: id,
        user_id: uid,
        name: newFolderName,
        created_at: new Date().toISOString()
      };
      await setDoc(doc(db, 'folders', id), newFolder);
      setFolders([{ id, ...newFolder }, ...folders]);
      setNewFolderName('');
    } catch (e) {
      console.error("Failed to create folder", e);
      handleFirestoreError(e, OperationType.WRITE, `folders`);
    }
  };

  const createNewQuiz = (folderId?: string) => {
    const isFreeUser = !user?.isActive && !user?.isAdmin && user?.role !== 'admin';
    if (isFreeUser && quizzes.length >= 3) {
      alert('عذراً، لقد استنفدت الحد الأقصى للاختبارات في الباقة المجانية (3 اختبارات فقط).\n\nيرجى الاشتراك في إحدى باقاتنا للاستمتاع بإنشاء عدد غير محدود من الاختبارات والمميزات المتقدمة!');
      openPlansModal();
      return;
    }

    const initialModel = (user?.preferred_ai_model === 'gemini_pro' || user?.preferred_ai_model === 'pro') ? 'pro' : 'flash';
    setQuiz({
      id: generateId(),
      title: 'اختبار جديد',
      folder_id: folderId,
      showCorrectAnswers: true,
      showResultsToStudent: true,
      ai_model: initialModel,
      questions: [
        {
          id: generateId(),
          text: '',
          options: ['', ''],
          correctOptionIndex: 0,
        },
      ],
    });
    setMode('build');
  };

  const editQuiz = async (quizId: string) => {
    // 1. If we already have the quiz in current quizzes state, load it directly without network read!
    const local = quizzes.find(q => q.id === quizId);
    if (local && local.data) {
      try {
        const parsed = JSON.parse(local.data);
        if (parsed) {
          if (!parsed.ai_model) {
            parsed.ai_model = (user?.preferred_ai_model === 'gemini_pro' || user?.preferred_ai_model === 'pro') ? 'pro' : 'flash';
          }
          setQuiz(parsed);
          setMode('build');
          return;
        }
      } catch (e) {
        console.error("Failed to parse local quiz", e);
      }
    }

    try {
      let docSnap;
      try {
        docSnap = await getDoc(doc(db, 'quizzes', quizId));
      } catch (e: any) {
        const msg = (e?.message || '').toLowerCase();
        if (msg.includes('quota') || e?.code === 'failed-precondition' || e?.code === 'resource-exhausted') {
          try {
            docSnap = await getDocFromCache(doc(db, 'quizzes', quizId));
          } catch (cacheErr) {
            console.warn("Cache fetch failed for quiz edit", cacheErr);
          }
        } else {
          throw e;
        }
      }

      if (docSnap && docSnap.exists()) {
        const data = docSnap.data() as any;
        if (data && data.data) {
          const parsed = JSON.parse(data.data);
          if (!parsed.ai_model) {
            parsed.ai_model = (user?.preferred_ai_model === 'gemini_pro' || user?.preferred_ai_model === 'pro') ? 'pro' : 'flash';
          }
          setQuiz(parsed);
          setMode('build');
          return;
        }
      }
      
      // If local exists even without data
      if (local) {
        setQuiz({ id: local.id, title: local.title, folder_id: local.folder_id, questions: [] });
        setMode('build');
      }
    } catch (e: any) {
      console.error("Failed to fetch quiz for editing", e);
      if (local) {
        setQuiz({ id: local.id, title: local.title, folder_id: local.folder_id, questions: [] });
        setMode('build');
      }
    }
  };

  const requestDeleteQuiz = (targetQuiz: Quiz) => {
    setQuizToDelete(targetQuiz);
    setShowDeleteQuizModal(true);
  };

  const deleteQuiz = async (quizId: string) => {
    try {
      // Delete results first
      const resultsQ = query(collection(db, 'results'), where('quiz_id', '==', quizId));
      const resultsSnap = await getDocs(resultsQ);
      for (const d of resultsSnap.docs) {
        await deleteDoc(d.ref);
      }
      // Delete quiz
      await deleteDoc(doc(db, 'quizzes', quizId));
      setQuizzes(prev => prev.filter(q => q.id !== quizId));

      // If the active quiz being edited or previewed is the deleted one, reset it and return to dashboard
      if (quiz.id === quizId) {
        setQuiz({
          id: generateId(),
          title: '',
          folder_id: null,
          grade_level: null,
          questions: [],
        });
        setMode('dashboard');
      }

      setSaveSuccessToast('تم حذف الاختبار بالكامل وجميع نتائجه بنجاح!');
      setTimeout(() => setSaveSuccessToast(null), 4000);
    } catch (e) {
      console.error("Failed to delete quiz", e);
      alert('تعذر حذف الاختبار. يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً.');
    }
  };

  const deleteFolder = async (folderId: string) => {
    console.log("Deleting folder:", folderId);
    // Temporarily disable confirm to test if it's the issue on mobile
    // if (!confirm('هل أنت متأكد من حذف هذا المجلد؟ لن يتم حذف الاختبارات بداخله، بل ستصبح بدون مجلد.')) return;
    console.log("Proceeding with delete...");
    try {
      // Remove folder_id from quizzes
      const quizzesQ = query(collection(db, 'quizzes'), where('folder_id', '==', folderId));
      const quizzesSnap = await getDocs(quizzesQ);
      for (const d of quizzesSnap.docs) {
        await updateDoc(d.ref, { folder_id: null });
      }
      // Delete folder
      await deleteDoc(doc(db, 'folders', folderId));
      setFolders(folders.filter(f => f.id !== folderId));
      setQuizzes(quizzes.map(q => q.folder_id === folderId ? { ...q, folder_id: null } : q));
    } catch (e) {
      console.error("Failed to delete folder", e);
      alert('حدث خطأ أثناء الاتصال بقاعدة البيانات');
    }
  };

  const moveQuiz = async (quizId: string, folderId: string | null) => {
    try {
      await updateDoc(doc(db, 'quizzes', quizId), { folder_id: folderId });
      setQuizzes(quizzes.map(q => q.id === quizId ? { ...q, folder_id: folderId } : q));
      setShowMoveQuizModal(false);
      setMoveQuizId(null);
    } catch (e) {
      console.error("Failed to move quiz", e);
    }
  };

  const toggleLanguage = () => {
    function getCookie(name: string) {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    }
    
    function setCookie(name: string, value: string) {
      document.cookie = `${name}=${value}; path=/;`;
      document.cookie = `${name}=${value}; path=/; domain=${window.location.hostname};`;
      document.cookie = `${name}=${value}; path=/; domain=.${window.location.hostname};`;
    }

    function clearCookie(name: string) {
      const hostParts = window.location.hostname.split('.');
      const domains = [
        window.location.hostname,
        `.${window.location.hostname}`,
        ''
      ];
      
      for (let i = 1; i < hostParts.length - 1; i++) {
        const higherDomain = hostParts.slice(i).join('.');
        domains.push(higherDomain);
        domains.push(`.${higherDomain}`);
      }
      
      domains.forEach(domain => {
        const domainString = domain ? `; domain=${domain}` : '';
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/${domainString}`;
      });
    }

    const currentTrans = getCookie('googtrans');
    
    if (currentTrans && currentTrans.endsWith('/en')) {
      // Revert to Arabic by forcing the translation back to Arabic
      setCookie('googtrans', '/ar/ar');
      
      // Also try to clear it
      clearCookie('googtrans');
      safeStorage.removeItem('googtrans');
      sessionStorage.removeItem('googtrans');
    } else {
      // Switch to English
      setCookie('googtrans', '/ar/en');
    }
    
    // Clear URL hash if it contains googtrans
    if (window.location.hash.includes('googtrans')) {
      window.history.replaceState('', document.title, window.location.pathname + window.location.search);
    }
    
    window.location.reload();
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Firebase signOut notice:", e);
    }
    setToken(null);
    setUser(null);
    setFolders([]);
    setQuizzes([]);
    safeStorage.removeItem('token');
    sessionStorage.clear();
    setAuthMode('login');
  };

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showProUpgradeModal, setShowProUpgradeModal] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [showTokenCalculator, setShowTokenCalculator] = useState(false);
  const [showTokenBilling, setShowTokenBilling] = useState(false);
  const [selectedUserForTokenBilling, setSelectedUserForTokenBilling] = useState<any>(null);
  const [showTeacherStudentsModal, setShowTeacherStudentsModal] = useState(false);
  const [customPlanDetails, setCustomPlanDetails] = useState<{ planId: string; tokensInMillions: number; monthlyPrice: number; yearlyPrice: number; detailsSummary: string; } | null>(null);
  const [planCategoryTab, setPlanCategoryTab] = useState<'theory' | 'science' | 'tokens'>('theory');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedPlansModel, setSelectedPlansModel] = useState<'flash' | 'pro'>('flash');
  const [paymentScreenshot, setPaymentScreenshot] = useState<string | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const openPlansModal = (initialCategory?: 'theory' | 'science' | 'tokens') => {
    if (initialCategory) {
      setPlanCategoryTab(initialCategory);
    } else {
      const sub = (user?.subject || profileData.subject || '').toLowerCase();
      const isScience = /رياضيات|علوم|فيزياء|كيمياء|أحياء|علمي|math|science|physics|chemistry|biology/.test(sub);
      const currentPlan = getPlanById(user?.subscription_type);
      if (currentPlan?.category === 'science' || isScience) {
        setPlanCategoryTab('science');
      } else {
        setPlanCategoryTab('theory');
      }
    }
    setShowPlansModal(true);
  };

  const handleManualPayment = async () => {
    if (!paymentScreenshot || !selectedPlan) {
      alert('الرجاء اختيار الباقة ورفع صورة التحويل أولاً');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        alert('يرجى تسجيل الدخول أولاً');
        setIsSubmittingPayment(false);
        return;
      }

      // Ensure screenshot size is safely within Firestore single document limits (< 900KB string length)
      let finalScreenshot = paymentScreenshot;
      if (finalScreenshot.length > 900000) {
        try {
          const img = new window.Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = finalScreenshot;
          });
          const canvas = document.createElement('canvas');
          let w = Math.min(img.width || 600, 600);
          let h = Math.round(((img.height || 600) * w) / (img.width || 600));
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            finalScreenshot = canvas.toDataURL('image/jpeg', 0.55);
          }
        } catch (recompErr) {
          console.warn("Recompression failed, using trimmed string:", recompErr);
          if (finalScreenshot.length > 1500000) {
            finalScreenshot = finalScreenshot.substring(0, 1500000);
          }
        }
      }

      const requestId = generateId();
      const requestData: any = {
        id: requestId,
        user_id: uid,
        user_name: user?.name || profileData.name || auth.currentUser?.displayName || '',
        user_email: user?.email || auth.currentUser?.email || '',
        user_phone: user?.phone || '',
        user_subject: user?.subject || profileData.subject || '',
        plan: selectedPlan,
        billing_cycle: billingCycle,
        screenshot_data: finalScreenshot,
        custom_details: customPlanDetails?.detailsSummary || null,
        tokens_millions: customPlanDetails?.tokensInMillions || null,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      await setDoc(doc(db, 'subscription_requests', requestId), requestData);

      // Also update user record in firestore to indicate hasPendingSubscription
      try {
        await updateDoc(doc(db, 'users', uid), {
          hasPendingSubscription: true
        });
        setUser((prev: any) => prev ? { ...prev, hasPendingSubscription: true } : null);
      } catch (uErr) {
        console.warn("Could not update user hasPendingSubscription:", uErr);
      }

      alert('تم إرسال طلب الاشتراك وصورة الإيصال بنجاح! سيتم مراجعة الدفع وتفعيل حسابك خلال دقائق.');
      setShowPaymentModal(false);
      setPaymentScreenshot(null);
    } catch (err: any) {
      console.error("Payment submission error:", err);
      alert(err.message || 'حدث خطأ أثناء إرسال الطلب. يرجى التأكد من اختيار صورة واضحة والاتصال بالإنترنت.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('الرجاء اختيار ملف صورة صالح (JPG, PNG, WebP)');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 25 ميجابايت.');
      return;
    }

    if (file.name.match(/\.(pdf)$/i) || file.type.includes("pdf")) {
      alert("يرجى تصوير إيصال الدفع (سكرين شوت) ورفعه كصورة وليس كملف PDF.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) {
        alert('تعذر قراءة ملف الصورة');
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width || 800;
          let height = img.height || 600;
          const maxDim = 800;
          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setPaymentScreenshot(rawDataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          let compressedDataUrl = canvas.toDataURL('image/jpeg', 0.65);

          // If still large, compress with a lower resolution
          if (compressedDataUrl.length > 800000) {
            const canvas2 = document.createElement('canvas');
            let w2 = Math.round(width * 0.7);
            let h2 = Math.round(height * 0.7);
            canvas2.width = w2;
            canvas2.height = h2;
            const ctx2 = canvas2.getContext('2d');
            if (ctx2) {
              ctx2.drawImage(img, 0, 0, w2, h2);
              compressedDataUrl = canvas2.toDataURL('image/jpeg', 0.5);
            }
          }

          setPaymentScreenshot(compressedDataUrl);
        } catch (canvasErr) {
          console.warn("Canvas compression fallback:", canvasErr);
          setPaymentScreenshot(rawDataUrl);
        }
      };
      img.onerror = () => {
        // Direct fallback
        setPaymentScreenshot(rawDataUrl);
      };
      img.src = rawDataUrl;
    };
    reader.onerror = () => {
      alert('حدث خطأ أثناء قراءة الملف.');
    };
    reader.readAsDataURL(file);
  };

  const handleSubscribe = (plan: string) => {
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  const handleProUpgradeSubmit = async (data: {
    amount: number;
    screenshot: string;
    details: string;
    remainingTokens: number;
    excessTokens: number;
  }) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      alert('يرجى تسجيل الدخول أولاً');
      return;
    }

    const requestId = generateId();
    const requestData: any = {
      id: requestId,
      user_id: uid,
      user_name: user?.name || profileData.name || auth.currentUser?.displayName || '',
      user_email: user?.email || auth.currentUser?.email || '',
      user_phone: user?.phone || '',
      user_subject: user?.subject || profileData.subject || '',
      plan: 'upgrade_to_pro',
      plan_name: 'ترقية إلى نظام جيميناي برو (Gemini Pro)',
      target_model: 'gemini_pro',
      amount_egp: data.amount,
      upgrade_difference_cost: data.amount,
      billing_cycle: 'one_time_upgrade',
      screenshot_data: data.screenshot,
      custom_details: data.details,
      remaining_tokens_at_upgrade: data.remainingTokens,
      excess_tokens_at_upgrade: data.excessTokens,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    await setDoc(doc(db, 'subscription_requests', requestId), requestData);

    try {
      await updateDoc(doc(db, 'users', uid), {
        hasPendingSubscription: true
      });
      setUser((prev: any) => prev ? { ...prev, hasPendingSubscription: true } : null);
    } catch (uErr) {
      console.warn("Could not update user hasPendingSubscription:", uErr);
    }

    alert(`تم إرسال طلب الترقية إلى نموذج جيميناي برو وإيصال التحويل بمبلغ ${data.amount} ج.م بنجاح! سيتم مراجعة الطلب وتفعيل ميزة برو لحسابك.`);
  };

  const [adminRequests, setAdminRequests] = useState<any[]>([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    subject: '',
    gradeLevel: '',
    curriculum: '',
    avatar_data: '',
    centers: [] as string[],
    preferred_ai_model: 'flash' as 'flash' | 'pro'
  });

  const isPlatformAdmin = Boolean(
    user?.role === 'admin' || 
    user?.isAdmin || 
    (user?.email && user.email.toLowerCase().trim() === 'gergesnabil101@gmail.com')
  );

  const isTeacherPro = profileData.preferred_ai_model === 'flash'
    ? false
    : Boolean(
        user?.preferred_ai_model === 'gemini_pro' ||
        user?.preferred_ai_model === 'pro' ||
        profileData.preferred_ai_model === 'pro' ||
        String(user?.subscription_type || '').includes('pro') ||
        String(user?.custom_plan_name || '').includes('برو')
      );

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isLoadingAdminData, setIsLoadingAdminData] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{id: string, name: string} | null>(null);
  const [selectedUserForPlan, setSelectedUserForPlan] = useState<any | null>(null);
  const [proUpgradeModalUser, setProUpgradeModalUser] = useState<any | null>(null);
  const [isUpgradingProUser, setIsUpgradingProUser] = useState<boolean>(false);
  const [userToDeactivate, setUserToDeactivate] = useState<any | null>(null);
  const [isDeactivatingUser, setIsDeactivatingUser] = useState<boolean>(false);

  const handleAdminDeactivateUser = async () => {
    if (!userToDeactivate) return;
    setIsDeactivatingUser(true);
    try {
      const nowIso = new Date().toISOString();
      const expiredDate = new Date(Date.now() - 1000).toISOString();
      const targetId = userToDeactivate.id || userToDeactivate.uid;
      const targetEmail = (userToDeactivate.email || '').toLowerCase().trim();
      
      const updateData = {
        subscription_status: 'inactive',
        is_suspended: true,
        hasAccess: false,
        subscription_end_date: expiredDate,
        deactivated_at: nowIso
      };

      if (targetId) {
        await setDoc(doc(db, 'users', targetId), updateData, { merge: true });
        if (userToDeactivate.uid && userToDeactivate.uid !== targetId) {
          await setDoc(doc(db, 'users', userToDeactivate.uid), updateData, { merge: true }).catch(() => {});
        }
      }

      if (userToDeactivate.requestId) {
        await setDoc(doc(db, 'subscription_requests', userToDeactivate.requestId), {
          status: 'cancelled',
          updated_at: nowIso
        }, { merge: true }).catch(() => {});
      }

      setAllUsers(prev => prev.map(u => {
        const matchId = targetId && (u.id === targetId || u.uid === targetId);
        const matchEmail = targetEmail && u.email && u.email.toLowerCase().trim() === targetEmail;
        return (matchId || matchEmail) ? { ...u, ...updateData } : u;
      }));

      // Instant synchronization with backend server storage
      try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : token;
        if (idToken) {
          fetch('/api/admin/update-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              userId: targetId,
              email: targetEmail,
              updates: updateData
            })
          }).catch(console.warn);
        }
      } catch (srvErr) {
        console.warn('Notice syncing deactivation to server:', srvErr);
      }

      alert(`تم إلغاء تفعيل حساب (${userToDeactivate.name || userToDeactivate.email}) بنجاح.\n\n✅ تأكيد: جميع بيانات المعلم وفصوله وطلابه واختباراته ونتائجهم محفوظة بالكامل وبأمان تام في قاعدة البيانات، ويمكن إعادة تفعيل الحساب في أي وقت بنقرة واحدة.`);
      setUserToDeactivate(null);
    } catch (err: any) {
      console.error('Error deactivating user:', err);
      alert('حدث خطأ أثناء إلغاء التفعيل: ' + (err?.message || 'يرجى المحاولة لاحقاً'));
    } finally {
      setIsDeactivatingUser(false);
    }
  };

  // Listen to tokens_consumed events to update user and allUsers state in real time
  useEffect(() => {
    const handleTokensConsumed = (e: any) => {
      const { userId, tokens, newTotal, newTokensToday, newExtraTokens } = e.detail || {};
      const currentUid = userId || auth.currentUser?.uid;
      if (!currentUid) return;

      setUser((prev: any) => {
        if (!prev) return prev;
        if (prev.id !== currentUid && prev.uid !== currentUid) return prev;
        const oldUsed = Number(prev.tokens_used || 0);
        const updatedUsed = newTotal !== undefined ? newTotal : (oldUsed + (tokens || 0));
        return {
          ...prev,
          tokens_used: updatedUsed,
          tokens_used_today: newTokensToday !== undefined ? newTokensToday : (Number(prev.tokens_used_today || 0) + (tokens || 0)),
          extra_tokens: newExtraTokens !== undefined ? newExtraTokens : prev.extra_tokens
        };
      });

      setAllUsers((prevList: any[]) => {
        if (!prevList || !prevList.length) return prevList;
        return prevList.map(u => {
          if (u.id === currentUid || u.uid === currentUid) {
            const oldUsed = Number(u.tokens_used || 0);
            const updatedUsed = newTotal !== undefined ? newTotal : (oldUsed + (tokens || 0));
            return {
              ...u,
              tokens_used: updatedUsed,
              tokens_used_today: newTokensToday !== undefined ? newTokensToday : (Number(u.tokens_used_today || 0) + (tokens || 0)),
              extra_tokens: newExtraTokens !== undefined ? newExtraTokens : u.extra_tokens
            };
          }
          return u;
        });
      });
    };

    window.addEventListener('tokens_consumed', handleTokensConsumed);
    return () => window.removeEventListener('tokens_consumed', handleTokensConsumed);
  }, []);

  const handleAdminActivateUserPlan = async (params: {
    userId: string;
    planId: string;
    cycle: 'monthly' | 'yearly' | '3months' | '6months' | 'custom';
    customDays?: number;
    extendFromCurrentEnd: boolean;
    extraTokensToAdd: number;
    resetTokensUsed: boolean;
    preserveRemainingTokens?: boolean;
    customPlanDetails?: {
      name?: string;
      tokensInMillions?: number;
      monthlyPrice?: number;
      yearlyPrice?: number;
      essayLimit?: number;
      modelPreference?: string;
      notes?: string;
    };
    clearPreviousExtraTokens?: boolean;
    overrideTokensUsed?: number;
    overrideTokensTotal?: number;
  }) => {
    try {
      const { userId, planId, cycle, customDays, extendFromCurrentEnd, extraTokensToAdd, resetTokensUsed, preserveRemainingTokens, clearPreviousExtraTokens, customPlanDetails, overrideTokensUsed, overrideTokensTotal } = params;
      const userSnap = await getDoc(doc(db, 'users', userId));
      let baseDate = new Date();
      let currentExtraTokens = 0;
      let currentTokensUsed = 0;
      let userData: any = null;

      if (userSnap.exists()) {
        userData = userSnap.data();
        currentExtraTokens = userData.extra_tokens || 0;
        currentTokensUsed = userData.tokens_used || 0;
        const isCurrentlyPaidActive = userData.subscription_status === 'active' && 
          userData.subscription_type !== 'trial' && 
          userData.subscription_end_date && 
          new Date(userData.subscription_end_date) > new Date();

        if (extendFromCurrentEnd && isCurrentlyPaidActive) {
          const parsedDate = new Date(userData.subscription_end_date);
          baseDate = parsedDate;
        } else {
          baseDate = new Date();
        }
      }

      const endDate = new Date(baseDate);
      if (cycle === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else if (cycle === '6months') {
        endDate.setDate(endDate.getDate() + 180);
      } else if (cycle === '3months') {
        endDate.setDate(endDate.getDate() + 90);
      } else if (cycle === 'custom' && customDays) {
        endDate.setDate(endDate.getDate() + customDays);
      } else {
        // Any new monthly cycle is strictly 30 days only
        endDate.setDate(endDate.getDate() + 30);
      }

      const newExtraTokens = clearPreviousExtraTokens ? (extraTokensToAdd || 0) : (currentExtraTokens + (extraTokensToAdd || 0));
      const nowIso = new Date().toISOString();

      const isProPlanActivated = planId.includes('pro') || (customPlanDetails?.modelPreference && customPlanDetails.modelPreference.includes('pro'));

      const updateData: any = {
        subscription_status: 'active',
        subscription_type: planId,
        billing_cycle: cycle === 'yearly' ? 'yearly' : 'monthly',
        subscription_end_date: endDate.toISOString(),
        subscription_start_date: nowIso,
        subscription_renewal_date: nowIso,
        is_suspended: false,
        hasAccess: true,
        hasPendingSubscription: false,
        extra_tokens: newExtraTokens,
        preferred_ai_model: isProPlanActivated ? 'gemini_pro' : 'flash'
      };

      // Detect token plans (e.g. token_1M, pro_token_1M, token_2M, token_5M) and set custom_tokens_millions automatically
      const tokenMatch = planId.match(/token[_\s-]*(\d+(?:\.\d+)?)\s*([mMkK])?/i) || planId.match(/custom[_\s-]*token[_\s-]*(\d+(?:\.\d+)?)M/i);
      if (tokenMatch) {
        const num = parseFloat(tokenMatch[1]);
        if (num > 0) {
          updateData.custom_tokens_millions = num;
        }
      }

      if (customPlanDetails) {
        if (customPlanDetails.name) updateData.custom_plan_name = customPlanDetails.name;
        if (customPlanDetails.tokensInMillions) updateData.custom_tokens_millions = customPlanDetails.tokensInMillions;
        if (customPlanDetails.monthlyPrice !== undefined) updateData.custom_monthly_price = customPlanDetails.monthlyPrice;
        if (customPlanDetails.yearlyPrice !== undefined) updateData.custom_yearly_price = customPlanDetails.yearlyPrice;
        if (customPlanDetails.essayLimit !== undefined) updateData.custom_essay_limit = customPlanDetails.essayLimit;
        if (customPlanDetails.modelPreference) {
          updateData.custom_ai_engine = customPlanDetails.modelPreference;
          if (customPlanDetails.modelPreference.includes('pro')) {
            updateData.preferred_ai_model = 'gemini_pro';
          }
        }
        if (customPlanDetails.notes) updateData.custom_notes = customPlanDetails.notes;
      }

      // Handle token usage: either preserve remaining tokens mathematically or start fresh
      if (preserveRemainingTokens) {
        const currentStats = getUnifiedUserTokenStats(userData || {});
        const currentRemainingTokens = Math.max(0, currentStats.remaining || 0);

        let targetPlanLimit = 1000000;
        if (customPlanDetails?.tokensInMillions) {
          targetPlanLimit = customPlanDetails.tokensInMillions * 1000000;
        } else {
          const tempUser = { 
            subscription_type: planId, 
            billing_cycle: cycle, 
            custom_tokens_millions: updateData.custom_tokens_millions 
          };
          targetPlanLimit = getUnifiedUserTokenStats(tempUser).limit || 1000000;
        }

        if (currentRemainingTokens <= 0) {
          updateData.tokens_used = 0;
          updateData.extra_tokens = newExtraTokens;
        } else if (currentRemainingTokens <= targetPlanLimit) {
          updateData.tokens_used = targetPlanLimit - currentRemainingTokens;
          updateData.extra_tokens = newExtraTokens;
        } else {
          updateData.tokens_used = 0;
          updateData.extra_tokens = (currentRemainingTokens - targetPlanLimit) + newExtraTokens;
        }

        updateData.tokens_used_today = 0;
        updateData.last_token_reset_date = nowIso.split('T')[0];
        updateData.tokens_used_total = Math.max(
          Number(userData?.tokens_used_total || 0),
          Number(currentTokensUsed || 0)
        );
      } else {
        const shouldReset = resetTokensUsed !== false;
        if (shouldReset) {
          updateData.tokens_used = 0;
          updateData.tokens_used_today = 0;
          updateData.last_token_reset_date = nowIso.split('T')[0];
          updateData.tokens_used_total = Math.max(
            Number(userData?.tokens_used_total || 0),
            Number(currentTokensUsed || 0)
          );
        }
      }

      if (overrideTokensUsed !== undefined) {
        updateData.tokens_used = overrideTokensUsed;
      }
      const targetId = userId || userData?.id || userData?.uid;
      const targetEmail = (userData?.email || '').toLowerCase().trim();

      if (targetId) {
        await setDoc(doc(db, 'users', targetId), updateData, { merge: true });
        if (userData?.uid && userData.uid !== targetId) {
          await setDoc(doc(db, 'users', userData.uid), updateData, { merge: true }).catch(() => {});
        }
      }

      setAllUsers(prev => prev.map(u => {
        const matchId = targetId && (u.id === targetId || u.uid === targetId);
        const matchEmail = targetEmail && u.email && u.email.toLowerCase().trim() === targetEmail;
        return (matchId || matchEmail) ? {
          ...u,
          ...updateData,
          tokens_used: updateData.tokens_used !== undefined ? updateData.tokens_used : (u.tokens_used || 0),
          tokens_used_today: updateData.tokens_used_today !== undefined ? updateData.tokens_used_today : (u.tokens_used_today || 0),
          tokens_used_total: updateData.tokens_used_total !== undefined ? updateData.tokens_used_total : u.tokens_used_total,
          extra_tokens: updateData.extra_tokens !== undefined ? updateData.extra_tokens : newExtraTokens
        } : u;
      }));

      // Instant server storage synchronization
      try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : token;
        if (idToken && (targetId || targetEmail)) {
          await fetch('/api/admin/update-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              userId: targetId,
              email: targetEmail,
              updates: {
                ...updateData,
                reset_tokens: resetTokensUsed !== false
              }
            })
          }).catch(console.warn);
        }
      } catch (syncErr) {
        console.warn('Notice syncing plan activation to server:', syncErr);
      }

      // Instant state sync for the active logged-in user
      if (user && (user.id === targetId || user.uid === targetId || user.email === targetEmail)) {
        setUser((prev: any) => ({
          ...prev,
          ...updateData
        }));
        setProfileData((prev: any) => ({
          ...prev,
          ...updateData
        }));
      }

      alert('تم تفعيل وتحديث باقة المشترك بالنظام الجديد بنجاح!');
      setSelectedUserForPlan(null);
    } catch (e) {
      console.error('Error activating user plan:', e);
      alert('حدث خطأ أثناء تفعيل الباقة');
    }
  };

  /**
   * Direct Upgrade to Pro System preserving exact remaining tokens
   */
  const handleUpgradeTeacherToProWithRemainingTokens = async (
    targetUser: any,
    options?: { extendMonth?: boolean; extraTokens?: number; proPlanId?: string }
  ) => {
    if (!targetUser?.id) return;
    setIsUpgradingProUser(true);
    try {
      const currentStats = getUnifiedUserTokenStats(targetUser);
      const remainingTokens = Math.max(0, currentStats.remaining || 0);

      const proEquiv = getProEquivalentPlan(
        targetUser.subscription_type,
        targetUser.custom_plan_name,
        targetUser.custom_tokens_millions
      );
      const chosenProPlanId = options?.proPlanId || proEquiv.proPlanId;
      const extraToAdd = options?.extraTokens || 0;

      const now = new Date();
      const nowIso = now.toISOString();
      const todayDate = nowIso.split('T')[0];

      let baseDate = now;
      const isPaidActive = targetUser.subscription_status === 'active' && 
        targetUser.subscription_type !== 'trial' && 
        targetUser.subscription_end_date && 
        new Date(targetUser.subscription_end_date) > now;

      if (isPaidActive) {
        baseDate = new Date(targetUser.subscription_end_date);
      }

      let endDate = new Date(baseDate);
      if (options?.extendMonth) {
        endDate.setDate(endDate.getDate() + 30);
      } else if (!isPaidActive) {
        endDate.setDate(endDate.getDate() + 30);
      }

      // Calculate target plan's base limit
      const tempUser = {
        subscription_type: chosenProPlanId,
        billing_cycle: targetUser.billing_cycle || 'monthly',
        custom_tokens_millions: proEquiv.tokensInMillions
      };
      const targetPlanLimit = getUnifiedUserTokenStats(tempUser).limit || (proEquiv.tokensInMillions * 1000000);

      // Preserve remaining tokens mathematically
      let newTokensUsed = 0;
      let newExtraTokens = extraToAdd;

      if (remainingTokens <= 0) {
        newTokensUsed = 0;
      } else if (remainingTokens <= targetPlanLimit) {
        newTokensUsed = targetPlanLimit - remainingTokens;
      } else {
        newTokensUsed = 0;
        newExtraTokens += (remainingTokens - targetPlanLimit);
      }

      const updateData: any = {
        subscription_status: 'active',
        subscription_type: chosenProPlanId,
        preferred_ai_model: 'gemini_pro',
        tokens_used: newTokensUsed,
        tokens_used_today: 0,
        last_token_reset_date: todayDate,
        extra_tokens: newExtraTokens,
        subscription_end_date: endDate.toISOString(),
        subscription_renewal_date: nowIso,
        is_suspended: false,
        hasAccess: true,
        hasPendingSubscription: false,
        tokens_used_total: Math.max(
          Number(targetUser.tokens_used_total || 0),
          Number(targetUser.tokens_used || 0)
        )
      };

      if (proEquiv.isCustom) {
        updateData.custom_tokens_millions = proEquiv.tokensInMillions;
        updateData.custom_plan_name = proEquiv.name;
        updateData.custom_ai_engine = 'gemini-3.1-pro-preview';
      }

      const targetId = targetUser.id || targetUser.uid;
      const targetEmail = (targetUser.email || '').toLowerCase().trim();

      if (targetId) {
        await setDoc(doc(db, 'users', targetId), updateData, { merge: true });
        if (targetUser.uid && targetUser.uid !== targetId) {
          await setDoc(doc(db, 'users', targetUser.uid), updateData, { merge: true }).catch(() => {});
        }
      }

      setAllUsers(prev => prev.map(u => {
        const matchId = targetId && (u.id === targetId || u.uid === targetId);
        const matchEmail = targetEmail && u.email && u.email.toLowerCase().trim() === targetEmail;
        return (matchId || matchEmail) ? {
          ...u,
          ...updateData
        } : u;
      }));

      // Instant server storage synchronization
      try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : token;
        if (idToken && (targetId || targetEmail)) {
          await fetch('/api/admin/update-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              userId: targetId,
              email: targetEmail,
              updates: {
                ...updateData,
                reset_tokens: true
              }
            })
          }).catch(console.warn);
        }
      } catch (errSync) {
        console.warn('Notice syncing pro upgrade to server:', errSync);
      }

      // Instant state sync for the active logged-in user
      if (user && (user.id === targetId || user.uid === targetId || user.email === targetEmail)) {
        setUser((prev: any) => ({
          ...prev,
          ...updateData
        }));
        setProfileData((prev: any) => ({
          ...prev,
          ...updateData
        }));
      }

      alert(`✅ تم ترقية المعلم (${targetUser.name || targetUser.email}) إلى نظام برو (Gemini Pro) بنجاح!\n\n- الباقة: ${proEquiv.name}\n- الرصيد المتبقي المنقول: ${(remainingTokens + extraToAdd).toLocaleString()} توكن\n- النظام والمحرك: جيميناي برو (تفكير علمي واستدلال دقيق وتصحيح خطوات) 👑`);
      setProUpgradeModalUser(null);
    } catch (err: any) {
      console.error('Error upgrading teacher to pro:', err);
      alert('حدث خطأ أثناء ترقية المعلم لنظام برو: ' + (err?.message || ''));
    } finally {
      setIsUpgradingProUser(false);
    }
  };

  const handleResetUserTokenUsage = async (targetUser: any) => {
    try {
      const nowIso = new Date().toISOString();
      const todayDate = nowIso.split('T')[0];
      const targetId = targetUser.id || targetUser.uid;
      const targetEmail = (targetUser.email || '').toLowerCase().trim();
      const resetData = {
        tokens_used: 0,
        tokens_used_today: 0,
        last_token_reset_date: todayDate,
        subscription_start_date: nowIso,
        subscription_renewal_date: nowIso
      };

      if (targetId) {
        await setDoc(doc(db, 'users', targetId), resetData, { merge: true });
        if (targetUser.uid && targetUser.uid !== targetId) {
          await setDoc(doc(db, 'users', targetUser.uid), resetData, { merge: true }).catch(() => {});
        }
      }

      setAllUsers(prev => prev.map(u => {
        const matchId = targetId && (u.id === targetId || u.uid === targetId);
        const matchEmail = targetEmail && u.email && u.email.toLowerCase().trim() === targetEmail;
        return (matchId || matchEmail) ? {
          ...u,
          ...resetData
        } : u;
      }));

      try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : token;
        if (idToken && (targetId || targetEmail)) {
          await fetch('/api/admin/update-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              userId: targetId,
              email: targetEmail,
              updates: {
                ...resetData,
                reset_tokens: true
              }
            })
          }).catch(console.warn);
        }
      } catch (errSync) {}

      alert('تم تصفير استهلاك الدورة الحالية لهذا المشترك بنجاح، ورصيده الآن كامل وغير مستهلك!');
    } catch (err) {
      console.error('Failed to reset user token usage', err);
      alert('حدث خطأ أثناء تصفير الاستهلاك');
    }
  };

  const handleClearUserExtraTokens = async (targetUser: any) => {
    try {
      const targetId = targetUser.id || targetUser.uid;
      const targetEmail = (targetUser.email || '').toLowerCase().trim();
      if (targetId) {
        await setDoc(doc(db, 'users', targetId), { extra_tokens: 0 }, { merge: true });
        if (targetUser.uid && targetUser.uid !== targetId) {
          await setDoc(doc(db, 'users', targetUser.uid), { extra_tokens: 0 }, { merge: true }).catch(() => {});
        }
      }

      setAllUsers(prev => prev.map(u => {
        const matchId = targetId && (u.id === targetId || u.uid === targetId);
        const matchEmail = targetEmail && u.email && u.email.toLowerCase().trim() === targetEmail;
        return (matchId || matchEmail) ? { ...u, extra_tokens: 0 } : u;
      }));

      try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : token;
        if (idToken && (targetId || targetEmail)) {
          await fetch('/api/admin/update-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              userId: targetId,
              email: targetEmail,
              updates: { extra_tokens: 0 }
            })
          }).catch(console.warn);
        }
      } catch (errSync) {}

      alert('تم إزالة الرصيد الإضافي بنجاح!');
    } catch (err) {
      console.error('Failed to clear extra tokens', err);
      alert('حدث خطأ أثناء إزالة الرصيد الإضافي');
    }
  };

  const handleQuickRenew1Million = async (targetUser: any) => {
    if (!targetUser?.id && !targetUser?.uid) return;
    const confirmMsg = `هل تريد بالتأكيد التجديد الفوري لباقة 1 مليون توكن للمعلم (${targetUser.name || targetUser.email})؟\n\n- الباقة: 1 مليون توكن كاملة\n- المدة: شهر كامل (30 يوماً من اليوم)\n- تصفير الاستهلاك: تصفير استهلاك الدورة الحالية للبدء برصيد 1,000,000 توكن كامل باللون الأخضر\n- الحالة: تنشيط الحساب فوراً وإلغاء أي تعليق`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const now = new Date();
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 30);
      const nowIso = now.toISOString();
      const todayDate = nowIso.split('T')[0];
      const targetId = targetUser.id || targetUser.uid;
      const targetEmail = (targetUser.email || '').toLowerCase().trim();

      const updateData: any = {
        subscription_status: 'active',
        subscription_type: 'token_1M',
        billing_cycle: 'monthly',
        custom_tokens_millions: 1,
        custom_plan_name: 'باقة 1 مليون توكن',
        subscription_start_date: nowIso,
        subscription_renewal_date: nowIso,
        subscription_end_date: endDate.toISOString(),
        is_suspended: false,
        hasAccess: true,
        hasPendingSubscription: false,
        tokens_used: 0,
        tokens_used_today: 0,
        last_token_reset_date: todayDate,
        tokens_used_total: Math.max(Number(targetUser.tokens_used_total || 0), Number(targetUser.tokens_used || 0))
      };

      if (targetId) {
        await setDoc(doc(db, 'users', targetId), updateData, { merge: true });
        if (targetUser.uid && targetUser.uid !== targetId) {
          await setDoc(doc(db, 'users', targetUser.uid), updateData, { merge: true }).catch(() => {});
        }
      }

      setAllUsers(prev => prev.map(u => {
        const matchId = targetId && (u.id === targetId || u.uid === targetId);
        const matchEmail = targetEmail && u.email && u.email.toLowerCase().trim() === targetEmail;
        return (matchId || matchEmail) ? {
          ...u,
          ...updateData
        } : u;
      }));

      // Instant server storage synchronization
      try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : token;
        if (idToken && (targetId || targetEmail)) {
          await fetch('/api/admin/update-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              userId: targetId,
              email: targetEmail,
              updates: {
                ...updateData,
                reset_tokens: true
              }
            })
          }).catch(console.warn);
        }
      } catch (errSync) {
        console.warn('Notice syncing quick 1M renewal to server:', errSync);
      }

      alert(`✅ تم تجديد وتفعيل باقة 1 مليون توكن بنجاح للمعلم (${targetUser.name || targetUser.email})!\n\nحسابه مفعل الآن برصيد 1,000,000 توكن كامل باللون الأخضر وسارٍ لمدة شهر.`);
    } catch (err: any) {
      console.error('Failed to quick renew 1M tokens:', err);
      alert('حدث خطأ أثناء تجديد باقة الـ 1 مليون توكن: ' + (err?.message || ''));
    }
  };

  const handleExtendTrial = async (targetUser: any, daysToAdd: number = 5) => {
    if (!targetUser?.id) return;
    const confirmMsg = `هل تريد بالتأكيد تمديد الفترة التجريبية للمعلم (${targetUser.name || targetUser.email}) بمقدار +${daysToAdd} أيام إضافية؟`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const now = new Date();
      const createdAt = targetUser.created_at ? new Date(targetUser.created_at) : new Date();
      const defaultTrialEnd = new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      const currentEnd = targetUser.trial_extended_until ? new Date(targetUser.trial_extended_until) : (defaultTrialEnd > now ? defaultTrialEnd : now);
      const newEnd = new Date(currentEnd.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

      const updateData = {
        trial_extended_until: newEnd.toISOString(),
        is_suspended: false,
        subscription_status: 'trial'
      };

      await updateDoc(doc(db, 'users', targetUser.id), updateData);

      setAllUsers(prev => prev.map(u => u.id === targetUser.id ? {
        ...u,
        ...updateData
      } : u));

      alert(`✅ تم تمديد الفترة التجريبية للمعلم (${targetUser.name || targetUser.email}) بنجاح حتى ${newEnd.toLocaleDateString('en-GB')} (+${daysToAdd} أيام إضافية)!`);
    } catch (err: any) {
      console.error('Failed to extend user trial', err);
      alert('حدث خطأ أثناء تمديد الفترة التجريبية: ' + (err?.message || ''));
    }
  };

  const deleteUser = async () => {
    if (!userToDelete) return;
    const targetId = userToDelete.id;
    const targetEmail = (userToDelete.email || '').toLowerCase().trim();
    const targetName = userToDelete.name || 'المعلم';
    try {
      // 1. Record persistent tombstone in Firestore 'deleted_users'
      try {
        await setDoc(doc(db, 'deleted_users', targetId), {
          id: targetId,
          email: targetEmail,
          name: targetName,
          deleted_at: new Date().toISOString()
        }, { merge: true });
        if (targetEmail) {
          const safeEmailDocId = targetEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
          await setDoc(doc(db, 'deleted_users', safeEmailDocId), {
            id: targetId,
            email: targetEmail,
            name: targetName,
            deleted_at: new Date().toISOString()
          }, { merge: true }).catch(() => {});
        }
      } catch (tombErr) {
        console.warn('Notice setting deleted_users tombstone:', tombErr);
      }

      // 2. Authoritative cascading deletion on server (Auth, Firestore, JSON storage)
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : token;
      try {
        await fetch(`/api/users/${targetId}/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify({ email: targetEmail, name: targetName })
        });
      } catch (serverErr) {
        console.warn('Server delete call notice:', serverErr);
      }

      // 3. Fallback direct client deletions from Firestore across all collections
      try { await deleteDoc(doc(db, 'users', targetId)); } catch (_) {}
      if (userToDelete.uid && userToDelete.uid !== targetId) {
        try { await deleteDoc(doc(db, 'users', userToDelete.uid)); } catch (_) {}
      }
      try { await deleteDoc(doc(db, 'public_profiles', targetId)); } catch (_) {}
      if (userToDelete.uid && userToDelete.uid !== targetId) {
        try { await deleteDoc(doc(db, 'public_profiles', userToDelete.uid)); } catch (_) {}
      }

      // Delete quizzes created by this teacher
      try {
        const qSnap1 = await getDocs(query(collection(db, 'quizzes'), where('user_id', '==', targetId)));
        const qSnap2 = await getDocs(query(collection(db, 'quizzes'), where('teacher_id', '==', targetId)));
        const qDocs = [...qSnap1.docs, ...qSnap2.docs];
        for (const qd of qDocs) {
          try { await deleteDoc(qd.ref); } catch (_) {}
        }
      } catch (_) {}

      // Delete subscription requests
      try {
        const sub1 = await getDocs(query(collection(db, 'subscription_requests'), where('user_id', '==', targetId)));
        for (const sd of sub1.docs) {
          try { await deleteDoc(sd.ref); } catch (_) {}
        }
        if (targetEmail) {
          const sub2 = await getDocs(query(collection(db, 'subscription_requests'), where('user_email', '==', targetEmail)));
          for (const sd of sub2.docs) {
            try { await deleteDoc(sd.ref); } catch (_) {}
          }
        }
      } catch (_) {}

      // Delete folders
      try {
        const fSnap = await getDocs(query(collection(db, 'folders'), where('user_id', '==', targetId)));
        for (const fd of fSnap.docs) {
          try { await deleteDoc(fd.ref); } catch (_) {}
        }
      } catch (_) {}

      // 4. Immediately update local state
      setAllUsers(prev => prev.filter(u => {
        const uId = u.id || u.uid;
        const uEmail = (u.email || '').toLowerCase().trim();
        if (uId === targetId || (userToDelete.uid && uId === userToDelete.uid)) return false;
        if (targetEmail && uEmail === targetEmail) return false;
        return true;
      }));
      setAdminRequests(prev => prev.filter(r => {
        const rId = r.user_id || r.userId;
        const rEmail = (r.user_email || r.email || '').toLowerCase().trim();
        if (rId === targetId || (userToDelete.uid && rId === userToDelete.uid)) return false;
        if (targetEmail && rEmail === targetEmail) return false;
        return true;
      }));
      setUserToDelete(null);

      alert(`✅ تم حذف حساب المعلم (${targetName}) وكافة اختباراته ونتائجه وسجلاته نهائياً وبشكل قطعي من قاعدة البيانات.`);
    } catch (e: any) {
      console.error("Failed to delete user", e);
      try {
        await deleteDoc(doc(db, 'users', targetId));
        try { await deleteDoc(doc(db, 'public_profiles', targetId)); } catch (_) {}
        setAllUsers(prev => prev.filter(u => u.id !== targetId && u.uid !== targetId));
        setUserToDelete(null);
      } catch (_) {}
    }
  };

  const handleSelfAccountDeletion = async () => {
    if (!user || isDeletingSelf) return;
    setIsDeletingSelf(true);
    try {
      const res = await fetch(`/api/users/${user.uid}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        await deleteDoc(doc(db, 'users', user.uid));
        try { await deleteDoc(doc(db, 'public_profiles', user.uid)); } catch (_) {}
      }

      setShowSelfDeleteModal(false);
      setShowProfileModal(false);
      await logout();
      alert('تم حذف حسابك وكافة اختباراتك ونتائجك بنجاح من النظام.');
    } catch (err: any) {
      console.error("Self account deletion error:", err?.message);
      alert('حدث خطأ أثناء محاولة حذف الحساب. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsDeletingSelf(false);
    }
  };

  const handlePurgeQuizResults = async (quizId: string) => {
    if (!quizId) return;
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف جميع نتائج هذا الاختبار نهائياً؟')) return;

    try {
      const res = await fetch(`/api/quizzes/${quizId}/results/purge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTeacherResults([]);
        setRetentionSuccessMessage(data.message || 'تم حذف نتائج الاختبار بنجاح.');
        setTimeout(() => setRetentionSuccessMessage(''), 4000);
      } else {
        alert(data.error || 'فشل حذف نتائج الاختبار.');
      }
    } catch (e: any) {
      console.error("Purge results error:", e?.message);
      alert('حدث خطأ أثناء الاتصال بالخادم لحذف النتائج.');
    }
  };

  const handleAnonymizeQuizResults = async (quizId: string) => {
    if (!quizId) return;
    if (!window.confirm('هل أنت متأكد من مسح وتجهيل أرقام هواتف وبيانات الطلاب لهذا الاختبار لحماية الخصوصية؟')) return;

    try {
      const res = await fetch(`/api/quizzes/${quizId}/results/anonymize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // Refresh local results display
        setTeacherResults(prev => prev.map((r, idx) => ({
          ...r,
          parent_phone: '',
          student_name: `طالب مجهول #${idx + 1}`
        })));
        setRetentionSuccessMessage(data.message || 'تم تنقيح وتجهيل بيانات الطلاب بنجاح.');
        setTimeout(() => setRetentionSuccessMessage(''), 4000);
      } else {
        alert(data.error || 'فشل تنقيح النتائج.');
      }
    } catch (e: any) {
      console.error("Anonymize results error:", e?.message);
      alert('حدث خطأ أثناء تجهيل بيانات الطلاب.');
    }
  };

  const handleRetentionCleanup = async () => {
    setIsProcessingRetention(true);
    try {
      const res = await fetch('/api/results/retention/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ days: retentionDays })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRetentionSuccessMessage(data.message || 'تم تطبيق سياسة الاحتفاظ بالبيانات بنجاح.');
        setTimeout(() => setRetentionSuccessMessage(''), 5000);
        // Refresh results if open
        if (quiz?.id) {
          fetchResults(quiz.id);
        }
      } else {
        alert(data.error || 'فشل تطبيق سياسة الاحتفاظ.');
      }
    } catch (e: any) {
      console.error("Retention cleanup error:", e?.message);
      alert('حدث خطأ أثناء تطبيق سياسة الاحتفاظ بالبيانات.');
    } finally {
      setIsProcessingRetention(false);
    }
  };

  const handleDeepLookupUser = async (rawQuery: string) => {
    const q = rawQuery.trim().toLowerCase();
    if (!q) return;
    setIsLookingUpUser(true);
    setLookupResultMsg(null);
    try {
      // 1. Check in allUsers state
      const localFound = allUsers.find(u => 
        (u.email && u.email.toLowerCase().trim() === q) ||
        (u.phone && String(u.phone).trim() === q) ||
        (u.id === q || u.uid === q) ||
        (u.name && u.name.toLowerCase().includes(q))
      );

      if (localFound) {
        setAdminUserSearch(localFound.email || localFound.name || q);
        setAdminUserCategoryFilter('all');
        setAdminUsersPage(1);
        setLookupResultMsg({
          type: 'success',
          text: `تم العثور على المشترك (${localFound.name || localFound.email}) وهو معروض الآن في الجدول بالأسفل.`,
          user: localFound
        });
        return;
      }

      // 2. Deep query directly from Firestore users collection
      let directUser: any = null;
      try {
        const emailQ = query(collection(db, 'users'), where('email', '==', q), limit(1));
        const emailSnap = await getDocsFromServer(emailQ).catch(() => getDocs(emailQ));
        if (!emailSnap.empty) {
          const d = emailSnap.docs[0];
          directUser = { id: d.id, uid: d.id, ...d.data() as any };
        }
      } catch {}

      if (!directUser) {
        try {
          const docSnap = await getDoc(doc(db, 'users', q));
          if (docSnap.exists()) {
            directUser = { id: docSnap.id, uid: docSnap.id, ...docSnap.data() as any };
          }
        } catch {}
      }

      if (!directUser) {
        try {
          const phoneQ = query(collection(db, 'users'), where('phone', '==', q), limit(1));
          const phoneSnap = await getDocsFromServer(phoneQ).catch(() => getDocs(phoneQ));
          if (!phoneSnap.empty) {
            const d = phoneSnap.docs[0];
            directUser = { id: d.id, uid: d.id, ...d.data() as any };
          }
        } catch {}
      }

      // 3. Deep query public_profiles collection
      if (!directUser) {
        try {
          const pubSnap = await getDoc(doc(db, 'public_profiles', q));
          if (pubSnap.exists()) {
            const p = pubSnap.data() as any;
            directUser = {
              id: pubSnap.id,
              uid: pubSnap.id,
              name: p.name || 'مشترك جديد',
              email: p.email || q,
              subject: p.subject || '',
              grade_level: p.grade_level || [],
              avatar_data: p.avatar_data || '',
              role: 'user',
              subscription_status: 'trial',
              subscription_type: 'trial',
              is_suspended: false,
              hasAccess: true,
              created_at: p.updated_at || p.created_at || new Date().toISOString(),
              tokens_used: 0,
              tokens_used_today: 0,
              tokens_used_total: 0
            };
          }
        } catch {}
      }

      // 4. Check subscription_requests
      if (!directUser) {
        try {
          const reqQ = query(collection(db, 'subscription_requests'), where('user_email', '==', q), limit(1));
          const reqSnap = await getDocsFromServer(reqQ).catch(() => getDocs(reqQ));
          if (!reqSnap.empty) {
            const rd = reqSnap.docs[0];
            const reqData = rd.data() as any;
            directUser = {
              id: reqData.user_id || `req_${rd.id}`,
              uid: reqData.user_id || `req_${rd.id}`,
              name: reqData.user_name || reqData.name || q.split('@')[0],
              email: reqData.user_email || reqData.email || q,
              phone: reqData.user_phone || reqData.phone || '',
              subject: reqData.user_subject || reqData.subject || '',
              role: 'user',
              subscription_status: reqData.status === 'approved' ? 'active' : 'trial',
              subscription_type: reqData.plan_type || 'طلب اشتراك جديد',
              is_suspended: false,
              hasAccess: true,
              created_at: reqData.created_at || new Date().toISOString(),
              isPendingRequestOnly: reqData.status !== 'approved',
              requestId: rd.id,
              tokens_used: 0,
              tokens_used_today: 0,
              tokens_used_total: 0
            };
          }
        } catch {}
      }

      // 5. Check Server API /api/admin/find-user?q=...
      if (!directUser) {
        try {
          const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
          if (idToken) {
            const res = await fetch(`/api/admin/find-user?q=${encodeURIComponent(q)}`, {
              headers: { 'Authorization': `Bearer ${idToken}` }
            });
            if (res.ok) {
              const resData = await res.json();
              if (resData.user) {
                directUser = resData.user;
              }
            }
          }
        } catch {}
      }

      if (directUser) {
        directUser.created_at = parseSafeDate(directUser.created_at || directUser.createdAt).toISOString();
        await setDoc(doc(db, 'users', directUser.id), directUser, { merge: true }).catch(() => {});
        setAllUsers(prev => [directUser, ...prev.filter(u => u.id !== directUser.id)]);
        setAdminUserSearch(directUser.email || directUser.name || q);
        setAdminUserCategoryFilter('all');
        setAdminUsersPage(1);
        setLookupResultMsg({
          type: 'success',
          text: `تم العثور على المشترك (${directUser.name || directUser.email}) واسترجاعه وتثبيته فورياً في أعلى القائمة!`,
          user: directUser
        });
        return;
      }

      // 6. Offer immediate 1-click creation if not found
      setLookupResultMsg({
        type: 'info',
        text: `لم يتم العثور على حساب مسجل بهذا المعرف (${q}). يمكنك إنشاء وتفعيل حسابه الآن مباشرة بضغطة زر بالأسفل.`
      });
    } catch (err: any) {
      setLookupResultMsg({
        type: 'error',
        text: 'حدث خطأ أثناء الفحص: ' + (err.message || '')
      });
    } finally {
      setIsLookingUpUser(false);
    }
  };

  const handleQuickCreateSubscriber = async (emailOrQuery: string) => {
    const email = emailOrQuery.trim().toLowerCase();
    if (!email) return;
    try {
      const nowIso = new Date().toISOString();
      const newUid = `user_${Date.now()}`;
      const newSubscriber = {
        id: newUid,
        uid: newUid,
        email: email,
        name: email.split('@')[0] || 'مشترك جديد',
        phone: '',
        subject: '',
        role: 'user',
        subscription_status: 'trial',
        subscription_type: 'trial',
        is_suspended: false,
        hasAccess: true,
        tokens_used: 0,
        tokens_used_today: 0,
        tokens_used_total: 0,
        last_token_reset_date: nowIso.split('T')[0],
        created_at: nowIso
      };

      await setDoc(doc(db, 'users', newUid), newSubscriber, { merge: true });
      const adminIdToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
      fetch('/api/admin/notify-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminIdToken ? { 'Authorization': `Bearer ${adminIdToken}` } : {})
        },
        body: JSON.stringify({
          uid: newUid,
          name: newSubscriber.name,
          email: newSubscriber.email,
          phone: '',
          subject: ''
        })
      }).catch(() => {});

      setAllUsers(prev => [newSubscriber, ...prev]);
      setAdminUserSearch(email);
      setAdminUserCategoryFilter('all');
      setAdminUsersPage(1);
      setLookupResultMsg({
        type: 'success',
        text: `تم إنشاء وتفعيل حساب المشترك (${email}) بنجاح وإضافته إلى قائمة المشتركين!`
      });
    } catch (e: any) {
      setLookupResultMsg({
        type: 'error',
        text: 'حدث خطأ أثناء إنشاء الحساب: ' + (e.message || '')
      });
    }
  };

  const fetchAdminData = async (options?: { isManualClick?: boolean }) => {
    const isAdminUser = user?.role === 'admin' || user?.isAdmin || (user?.email && user.email.toLowerCase().trim() === 'gergesnabil101@gmail.com');
    if (!isAdminUser) return;
    if (isFetchingAdminDataRef.current && !options?.isManualClick) return;
    isFetchingAdminDataRef.current = true;

    setIsLoadingAdminData(true);
    let allRequestsList: any[] = [];
    const now = new Date();

    // 1. Fetch ALL subscription requests directly via client Firestore (fresh from server)
    try {
      try {
        const requestsSnap = await getDocsFromServer(collection(db, 'subscription_requests'))
          .catch(() => getDocs(collection(db, 'subscription_requests')));
        const userCache = new Map<string, any>();
        
        for (const d of requestsSnap.docs) {
          const req = { id: d.id, ...d.data() } as any;
          let userData;
          if (req.user_id) {
            if (userCache.has(req.user_id)) {
              userData = userCache.get(req.user_id);
            } else {
              try {
                const userSnap = await getDoc(doc(db, 'users', req.user_id));
                if (userSnap.exists()) {
                  userData = userSnap.data();
                  userCache.set(req.user_id, userData);
                }
              } catch (e) {}
            }
          }

          allRequestsList.push({
            ...req,
            user_name: userData?.name || req.name || req.user_name || '',
            user_email: userData?.email || req.email || req.user_email || '',
            user_phone: userData?.phone || req.phone || req.user_phone || '',
            user_subject: userData?.subject || req.subject || req.user_subject || ''
          });
        }
      } catch (directReqErr) {
        console.warn('Subscription requests query notice:', directReqErr);
      }

      // Filter only pending requests for the pending requests card
      setAdminRequests(allRequestsList.filter(r => {
        const st = String(r.status || '').toLowerCase().trim();
        return st === 'pending' || !st;
      }));
    } catch (e) {
      console.warn("Notice while fetching subscription requests:", e);
    }

    // 2. Fetch all registered subscribers / users via client Firestore and server API
    try {
      const rawUsersMap = new Map<string, any>();
      const existingFirestoreUserIds = new Set<string>();
      const existingFirestoreEmails = new Set<string>();
      const deletedUserIds = new Set<string>();
      const deletedEmails = new Set<string>();

      // Load persistent deleted_users tombstone from Firestore to prevent any resurfacing
      try {
        const delSnap = await getDocs(collection(db, 'deleted_users'));
        delSnap.docs.forEach(d => {
          deletedUserIds.add(d.id);
          const em = (d.data()?.email || '').toLowerCase().trim();
          if (em) deletedEmails.add(em);
        });
      } catch (delErr) {
        console.warn('Notice reading deleted_users tombstone:', delErr);
      }

      // 2a. Query client Firestore directly from server
      try {
        const usersSnap = await getDocsFromServer(collection(db, 'users'))
          .catch(() => getDocs(collection(db, 'users')));
        usersSnap.docs.forEach(d => {
          const uId = d.id;
          const uData = { id: d.id, uid: d.id, ...d.data() as any };
          const uEmail = (uData.email || '').toLowerCase().trim();

          // If user was deleted, delete orphan doc immediately and do not load
          if ((uId && deletedUserIds.has(uId)) || (uEmail && deletedEmails.has(uEmail))) {
            try { deleteDoc(doc(db, 'users', uId)); } catch (_) {}
            return;
          }
          
          if (uId) {
            existingFirestoreUserIds.add(uId);
            rawUsersMap.set(uId, uData);
          }
          if (uEmail) {
            existingFirestoreEmails.add(uEmail);
            rawUsersMap.set(uEmail, uData);
          }
        });
      } catch (directUsersErr) {
        console.warn('Users collection direct query notice:', directUsersErr);
      }

      // 2b. Query public_profiles to ensure every registered teacher identity is discovered
      try {
        const pubSnap = await getDocsFromServer(collection(db, 'public_profiles'))
          .catch(() => getDocs(collection(db, 'public_profiles')));
        pubSnap.docs.forEach(d => {
          const p = d.data() as any;
          const pId = d.id;
          const pEmail = (p.email || '').toLowerCase().trim();

          if ((pId && deletedUserIds.has(pId)) || (pEmail && deletedEmails.has(pEmail))) {
            try { deleteDoc(doc(db, 'public_profiles', pId)); } catch (_) {}
            return;
          }
          
          const existing = (pId && rawUsersMap.get(pId)) || (pEmail && rawUsersMap.get(pEmail));
          if (!existing) {
            const synthUser = {
              id: pId,
              uid: pId,
              name: p.name || 'مشترك جديد',
              email: pEmail,
              subject: p.subject || '',
              grade_level: p.grade_level || p.gradeLevel || [],
              avatar_data: p.avatar_data || '',
              role: 'user',
              subscription_status: 'trial',
              subscription_type: '200',
              is_suspended: false,
              hasAccess: true,
              created_at: p.updated_at || p.created_at || now.toISOString(),
              tokens_used: 0,
              tokens_used_today: 0,
              tokens_used_total: 0
            };
            if (pId) rawUsersMap.set(pId, synthUser);
            if (pEmail) rawUsersMap.set(pEmail, synthUser);
          }
        });
      } catch (pubErr) {
        console.warn('public_profiles query notice:', pubErr);
      }

      // 2c. Query server API /api/admin/users or /api/admin/audit-and-sync-users (which pulls & reconciles all sources)
      let serverNewlyAdded = 0;
      try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken(true).catch(() => null) : token;
        if (idToken) {
          const endpoint = options?.isManualClick 
            ? `/api/admin/audit-and-sync-users` 
            : `/api/admin/users?t=${Date.now()}`;
          const method = options?.isManualClick ? 'POST' : 'GET';
          const apiRes = await fetch(endpoint, {
            method,
            cache: 'no-store',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            }
          });
          if (apiRes.ok) {
            const apiData = await apiRes.json();
            if (apiData.newlyAddedCount) {
              serverNewlyAdded = Number(apiData.newlyAddedCount) || 0;
            }
            if (Array.isArray(apiData.users) && apiData.users.length > 0) {
              apiData.users.forEach((u: any) => {
                const uId = u.id || u.uid;
                const uEmail = (u.email || '').toLowerCase().trim();
                if ((uId && deletedUserIds.has(uId)) || (uEmail && deletedEmails.has(uEmail))) {
                  return;
                }
                const existing = (uId && rawUsersMap.get(uId)) || (uEmail && rawUsersMap.get(uEmail));
                if (!existing) {
                  if (uId) rawUsersMap.set(uId, u);
                  if (uEmail) rawUsersMap.set(uEmail, u);
                } else {
                  // Merge existing (fresh from client Firestore) with u (from server JSON)
                  // CRITICAL: client Firestore is the primary database!
                  // 1. Suspension & Deactivation:
                  // Live Firestore is authoritative: if existing has an explicit suspension state, respect it!
                  const isSuspended = existing.is_suspended !== undefined ? !!existing.is_suspended : (u.is_suspended ?? false);
                  const finalStatus = existing.subscription_status || u.subscription_status || 'trial';
                  const isDeactivated = finalStatus === 'inactive' || finalStatus === 'cancelled';

                  // 2. Tokens:
                  // Trust the maximum valid tokens between client Firestore and server JSON!
                  const finalTokensUsed = Math.max(Number(existing.tokens_used) || 0, Number(u.tokens_used) || 0);
                  const maxTokensTotal = Math.max(Number(existing.tokens_used_total) || 0, Number(u.tokens_used_total) || 0, finalTokensUsed);
                  const maxTokensToday = Math.max(Number(existing.tokens_used_today) || 0, Number(u.tokens_used_today) || 0);

                  // 3. Date preservation: ALWAYS preserve the earliest valid creation date! Never reset to today!
                  const dExisting = parseSafeDate(existing.created_at || existing.createdAt, null);
                  const dServer = parseSafeDate(u.created_at || u.createdAt, null);
                  let bestCreatedAt = existing.created_at || u.created_at;
                  if (dExisting && dServer) {
                    bestCreatedAt = dExisting.getTime() <= dServer.getTime() ? dExisting.toISOString() : dServer.toISOString();
                  } else if (dExisting) {
                    bestCreatedAt = dExisting.toISOString();
                  } else if (dServer) {
                    bestCreatedAt = dServer.toISOString();
                  }

                  const merged = {
                    ...u,
                    ...existing,
                    tokens_used: finalTokensUsed,
                    tokens_used_total: maxTokensTotal,
                    tokens_used_today: maxTokensToday,
                    is_suspended: isSuspended,
                    subscription_status: finalStatus,
                    hasAccess: (isSuspended || isDeactivated) ? false : (finalStatus === 'active' || finalStatus === 'trial'),
                    created_at: bestCreatedAt || existing.created_at || u.created_at
                  };
                  if (uId) rawUsersMap.set(uId, merged);
                  if (uEmail) rawUsersMap.set(uEmail, merged);
                }
              });
            }
          }
        }
      } catch (apiErr) {
        console.warn('API users fetch notice, falling back to client query:', apiErr);
      }

      // 2d. Merge ALL subscription requests (pending, approved, etc.) whose user document is missing
      if (Array.isArray(allRequestsList)) {
        allRequestsList.forEach(req => {
          const reqEmail = (req.user_email || req.email || '').toLowerCase().trim();
          const reqUserId = req.user_id || req.userId;
          if ((reqUserId && deletedUserIds.has(reqUserId)) || (reqEmail && deletedEmails.has(reqEmail))) {
            return;
          }
          const existing = (reqUserId && rawUsersMap.get(reqUserId)) || (reqEmail && rawUsersMap.get(reqEmail));
          
          if (!existing) {
            const synthEmail = reqEmail || `${reqUserId || req.id}@student-platform.com`;
            const synthUser = {
              id: reqUserId || `req_${req.id}`,
              uid: reqUserId || `req_${req.id}`,
              name: req.user_name || req.name || (reqEmail ? reqEmail.split('@')[0] : 'مشترك جديد'),
              email: synthEmail,
              phone: req.user_phone || req.phone || '',
              subject: req.user_subject || req.subject || '',
              role: 'user',
              subscription_status: req.status === 'approved' ? 'active' : 'trial',
              subscription_type: req.plan_type || req.requested_plan || req.plan || 'طلب اشتراك جديد',
              is_suspended: false,
              hasAccess: req.status === 'approved',
              created_at: req.created_at || now.toISOString(),
              isPendingRequestOnly: req.status !== 'approved',
              requestId: req.id,
              tokens_used: 0,
              tokens_used_today: 0,
              tokens_used_total: 0
            };
            const sKey = reqUserId || reqEmail || `req_${req.id}`;
            rawUsersMap.set(sKey, synthUser);
          }
        });
      }

      // 2e. Discover any teachers from quizzes collection
      let allQuizzesList: any[] = [];
      try {
        const qSnap = await getDocs(query(collection(db, 'quizzes'), limit(15000)));
        allQuizzesList = qSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
        allQuizzesList.forEach(qd => {
          const qUserId = qd.user_id || qd.teacher_id;
          const qEmail = (qd.teacher_email || '').toLowerCase().trim();
          if ((qUserId && deletedUserIds.has(qUserId)) || (qEmail && deletedEmails.has(qEmail))) {
            return;
          }
          if (qUserId && !rawUsersMap.has(qUserId)) {
            const safeQEmail = qEmail || `${qUserId}@teacher-platform.com`;
            const synthUser = {
              id: qUserId,
              uid: qUserId,
              name: qd.teacher_name || 'معلم (منشئ اختبارات)',
              email: safeQEmail,
              subject: qd.subject || '',
              role: 'user',
              subscription_status: 'trial',
              subscription_type: '200',
              is_suspended: false,
              hasAccess: true,
              created_at: qd.created_at || now.toISOString(),
              tokens_used: 0,
              tokens_used_today: 0,
              tokens_used_total: 0
            };
            rawUsersMap.set(qUserId, synthUser);
          }
        });
      } catch (qErr) {
        console.warn('Quizzes scan notice:', qErr);
      }

      // 2f. Discover any teachers from token_usage_logs collection
      let tokenLogs: any[] = [];
      try {
        const logsSnap = await getDocs(query(collection(db, 'token_usage_logs'), limit(15000)));
        tokenLogs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
        tokenLogs.forEach(ld => {
          const lUserId = ld.user_id;
          const lEmail = (ld.user_email || '').toLowerCase().trim();
          if ((lUserId && deletedUserIds.has(lUserId)) || (lEmail && deletedEmails.has(lEmail))) {
            return;
          }
          const existing = (lUserId && rawUsersMap.get(lUserId)) || (lEmail && rawUsersMap.get(lEmail));
          if (!existing && (lUserId || lEmail)) {
            const safeEmail = lEmail || `${lUserId}@teacher-platform.com`;
            const synthUser = {
              id: lUserId || lEmail,
              uid: lUserId || lEmail,
              name: ld.user_name || (lEmail ? lEmail.split('@')[0] : 'معلم نشط'),
              email: safeEmail,
              role: 'user',
              subscription_status: 'trial',
              subscription_type: '200',
              is_suspended: false,
              hasAccess: true,
              created_at: ld.timestamp || now.toISOString(),
              tokens_used: 0,
              tokens_used_today: 0,
              tokens_used_total: 0
            };
            if (lUserId) rawUsersMap.set(lUserId, synthUser);
            if (lEmail) rawUsersMap.set(lEmail, synthUser);
          }
        });
      } catch (logsErr) {
        console.warn('Could not fetch token_usage_logs in fetchAdminData:', logsErr);
      }

      // Deduplicate strictly by unique ID and lowercase email
      const deduplicatedUsers: any[] = [];
      const seenIds = new Set<string>();
      const seenEmails = new Set<string>();

      rawUsersMap.forEach((u) => {
        const uId = (u.id || u.uid || '').trim();
        const uEmail = (u.email || '').toLowerCase().trim();

        if ((uId && deletedUserIds.has(uId)) || (uEmail && deletedEmails.has(uEmail))) {
          return;
        }

        if (uId && seenIds.has(uId)) return;
        if (uEmail && seenEmails.has(uEmail)) return;

        if (uId) seenIds.add(uId);
        if (uEmail) seenEmails.add(uEmail);

        const createdAt = parseSafeDate(u.created_at || u.createdAt || u.subscription_start_date || u.subscription_renewal_date, now);
        u.created_at = createdAt.toISOString();

        deduplicatedUsers.push(u);
      });

      // 2g. AUTOMATIC DATABASE AUDIT & SYNC:
      // Review every account: If any account is missing from Firestore 'users' collection,
      // save it directly to Firestore with full schema validation so it is permanently recorded and visible!
      const missingAccountsToSave = deduplicatedUsers.filter(u => {
        const uId = u.id || u.uid;
        const uEmail = (u.email || '').toLowerCase().trim();
        return (uId && !existingFirestoreUserIds.has(uId)) || (uEmail && !existingFirestoreEmails.has(uEmail));
      });

      let newlyRepairedCount = 0;
      if (missingAccountsToSave.length > 0) {
        await Promise.all(missingAccountsToSave.map(async (u) => {
          try {
            const uId = u.id || u.uid;
            if (!uId) return;
            const cleanEmail = (u.email || '').toLowerCase().trim() || `${uId}@teacher-platform.com`;
            const cleanName = (u.name || '').trim() || (cleanEmail ? cleanEmail.split('@')[0] : 'مشترك جديد');
            const cleanStatus = ['active', 'trial', 'expired', 'cancelled', 'pending_approval'].includes(u.subscription_status)
              ? u.subscription_status
              : (u.subscription_status === 'closed' ? 'expired' : 'trial');

            const uPayload = {
              id: uId,
              uid: uId,
              name: cleanName,
              email: cleanEmail,
              phone: u.phone || '',
              subject: u.subject || '',
              grade_level: Array.isArray(u.grade_level) ? u.grade_level : [],
              avatar_data: u.avatar_data || '',
              role: u.role === 'admin' ? 'admin' : 'user',
              subscription_type: u.subscription_type || '200',
              subscription_end_date: u.subscription_end_date || null,
              subscription_status: cleanStatus,
              is_suspended: !!u.is_suspended,
              hasAccess: cleanStatus === 'active' || cleanStatus === 'trial' || !u.is_suspended,
              tokens_used: Number(u.tokens_used) || 0,
              tokens_used_today: Number(u.tokens_used_today) || 0,
              tokens_used_total: Number(u.tokens_used_total) || 0,
              created_at: u.created_at || now.toISOString()
            };
            await setDoc(doc(db, 'users', uId), uPayload, { merge: true });
            existingFirestoreUserIds.add(uId);
            if (uPayload.email) existingFirestoreEmails.add(uPayload.email);
            newlyRepairedCount++;
          } catch (writeErr) {
            console.warn('Auto-repair write error:', writeErr);
          }
        }));
      }

      // 2h. Fetch exam results to reconcile real token usage across all teachers automatically
      const allTeacherQuizIds = allQuizzesList.map(q => q.id).filter(Boolean);
      const resultsMap = new Map<string, any>();

      // Query results by quiz_id in chunks of 30 for fast and comprehensive coverage
      for (let i = 0; i < allTeacherQuizIds.length; i += 30) {
        const chunk = allTeacherQuizIds.slice(i, i + 30);
        try {
          const chunkSnap = await getDocs(query(collection(db, 'results'), where('quiz_id', 'in', chunk)));
          chunkSnap.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() as any }));
        } catch (chunkErr) {
          console.warn('Chunk results query notice in fetchAdminData:', chunkErr);
        }
      }

      // Query recent fallback results
      try {
        const resSnap = await getDocs(query(collection(db, 'results'), limit(5000)));
        resSnap.docs.forEach(d => {
          if (!resultsMap.has(d.id)) {
            resultsMap.set(d.id, { id: d.id, ...d.data() as any });
          }
        });
      } catch (resErr) {
        console.warn('Could not fetch fallback results in fetchAdminData:', resErr);
      }

      const examResults = Array.from(resultsMap.values());
      const todayStr = now.toISOString().split('T')[0];

      // Usage counters come straight from Firestore (written by the server only); no client-side recomputation.

      // Sort with newest on top
      deduplicatedUsers.sort((a, b) => {
        const timeA = parseSafeDate(a.created_at || a.createdAt, new Date(0)).getTime();
        const timeB = parseSafeDate(b.created_at || b.createdAt, new Date(0)).getTime();
        return timeB - timeA;
      });

      setAllUsers(deduplicatedUsers);
      
      const isSuperAdmin = user?.email && user.email.toLowerCase().trim() === 'gergesnabil101@gmail.com';
      if (isSuperAdmin) {
        fetchPlatformStudents();
      }

      // Synchronize back to server persistent JSON in the background
      try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : token;
        if (idToken) {
          fetch('/api/admin/save-users-batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ users: deduplicatedUsers })
          }).catch(() => {});
        }
      } catch {}

      if (options?.isManualClick) {
        // Reset page and search so refreshed accounts are visible immediately
        setAdminUsersPage(1);
        setAdminUserSearch('');

        // Calculate breakdown for user confirmation
        const trialUsers = deduplicatedUsers.filter(u => {
          const createdAt = parseSafeDate(u.created_at || u.createdAt || u.subscription_start_date || u.subscription_renewal_date, now);
          const trialEnd = u.trial_extended_until ? parseSafeDate(u.trial_extended_until) : new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
          const isExplicitTrialStatus = u.subscription_status === 'trial' || u.subscription_status === 'pending_approval' || u.subscription_type === 'trial' || !u.subscription_status;
          const isPaid = !isExplicitTrialStatus && (u.subscription_status === 'active' || (u.subscription_end_date && new Date(u.subscription_end_date).getTime() >= now.getTime()));
          return !isPaid && !u.is_suspended && (now <= trialEnd || u.isPendingRequestOnly || u.subscription_status === 'pending_approval' || u.subscription_status === 'trial');
        });
        const activeUsers = deduplicatedUsers.filter(u => {
          const isExplicitTrialStatus = u.subscription_status === 'trial' || u.subscription_status === 'pending_approval' || u.subscription_type === 'trial' || !u.subscription_status;
          const isPaid = !isExplicitTrialStatus && (u.subscription_status === 'active' || (u.subscription_end_date && new Date(u.subscription_end_date).getTime() >= now.getTime()));
          return isPaid || u.role === 'admin' || (u.email && u.email.toLowerCase().trim() === 'gergesnabil101@gmail.com');
        });
        const closedUsers = deduplicatedUsers.length - trialUsers.length - activeUsers.length;
        const recentCount = deduplicatedUsers.filter(u => {
          const c = parseSafeDate(u.created_at || u.createdAt, new Date(0));
          return (now.getTime() - c.getTime()) <= 7 * 24 * 60 * 60 * 1000;
        }).length;

        const totalAddedOrRepaired = newlyRepairedCount + serverNewlyAdded;

        // Set rich interactive in-app notice
        setAuditSyncNotice({
          isOpen: true,
          total: deduplicatedUsers.length,
          trial: trialUsers.length,
          active: activeUsers.length,
          closed: Math.max(0, closedUsers),
          recent: recentCount,
          newlyAdded: totalAddedOrRepaired,
          timestamp: new Date()
        });

        alert(`تم تحديث وفحص ومراجعة كافة الحسابات بنجاح! 🔄

📋 كشف وتوزيع المشتركين حسب كل فئة:
• 👥 إجمالي الحسابات المسجلة: ${deduplicatedUsers.length} حساب
• ⏳ الحسابات التجريبية (قائمة منفصلة): ${trialUsers.length} حساب
• ✅ الحسابات المفعلة: ${activeUsers.length} حساب
• 🔒 الحسابات المغلقة والمنتهية: ${Math.max(0, closedUsers)} حساب
• ✨ المشتركون الجدد المسجلون حديثاً: ${recentCount} حساب

${totalAddedOrRepaired > 0 
  ? `🎉 تم اكتشاف وإضافة (${totalAddedOrRepaired}) حساب جديد وحفظهم وتثبيتهم في قاعدة البيانات بنجاح!` 
  : '✅ تم تدقيق ومراجعة جميع الحسابات بنجاح، وكافة الفئات متزامنة ومحدثة بالكامل.'}`);
      }
    } catch (e) {
      console.error("Failed to fetch admin users list", e);
    } finally {
      setIsLoadingAdminData(false);
      isFetchingAdminDataRef.current = false;
      lastAdminFetchTimeRef.current = Date.now();
    }
  };

  // --- Master Unified Audit, Synchronization & Strict Token Reconciliation for All Accounts ---
  const handleMasterUpdateAndReconcileTokens = async () => {
    setIsLoadingAdminData(true);
    try {
      console.log('--- Starting Unified Master Audit & Strict Token Reconciliation ---');

      // 1. Load persistent deleted_users tombstone from Firestore to guarantee 100% exclusion
      const deletedUserIds = new Set<string>();
      const deletedEmails = new Set<string>();
      try {
        const delSnap = await getDocs(collection(db, 'deleted_users'));
        delSnap.docs.forEach(d => {
          deletedUserIds.add(d.id);
          const em = (d.data()?.email || '').toLowerCase().trim();
          if (em) deletedEmails.add(em);
        });
      } catch (delErr) {
        console.warn('Notice reading deleted_users tombstone in master reconcile:', delErr);
      }

      // 2. Authoritative server sync & user audit
      try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken(true).catch(() => null) : token;
        if (idToken) {
          await fetch('/api/admin/audit-and-sync-users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            }
          });
        }
      } catch (srvErr) {
        console.warn('Server audit endpoint notice:', srvErr);
      }

      // 3. Fetch fresh users directly from Firestore server
      const usersSnap = await getDocsFromServer(collection(db, 'users'))
        .catch(() => getDocs(collection(db, 'users')));

      const baseUsersMap = new Map<string, any>();
      usersSnap.docs.forEach(d => {
        const uId = d.id;
        const uData = { id: d.id, uid: d.id, ...d.data() as any };
        const uEmail = (uData.email || '').toLowerCase().trim();

        // Strictly purge and skip any deleted users
        if ((uId && deletedUserIds.has(uId)) || (uEmail && deletedEmails.has(uEmail))) {
          try { deleteDoc(doc(db, 'users', uId)); } catch (_) {}
          return;
        }

        if (uId) baseUsersMap.set(uId, uData);
      });

      // 4. Fetch all quizzes, exam results, and token usage logs
      let logs: any[] = [];
      try {
        const logsSnap = await getDocs(query(collection(db, 'token_usage_logs'), limit(15000)));
        logs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      } catch (err) {
        console.warn('Could not fetch token_usage_logs:', err);
      }

      let allQuizzesList: any[] = [];
      try {
        const qSnap = await getDocs(query(collection(db, 'quizzes'), limit(15000)));
        allQuizzesList = qSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      } catch (qErr) {
        console.warn('Could not fetch quizzes in master reconcile:', qErr);
      }

      const allTeacherQuizIds = allQuizzesList.map(q => q.id).filter(Boolean);
      const resultsMap = new Map<string, any>();

      // Fetch results by quiz_id in chunks of 30 for complete coverage
      for (let i = 0; i < allTeacherQuizIds.length; i += 30) {
        const chunk = allTeacherQuizIds.slice(i, i + 30);
        try {
          const chunkSnap = await getDocs(query(collection(db, 'results'), where('quiz_id', 'in', chunk)));
          chunkSnap.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() as any }));
        } catch (chunkErr) {
          console.warn('Chunk results query notice in master reconcile:', chunkErr);
        }
      }

      try {
        const resSnap = await getDocs(query(collection(db, 'results'), limit(5000)));
        resSnap.docs.forEach(d => {
          if (!resultsMap.has(d.id)) {
            resultsMap.set(d.id, { id: d.id, ...d.data() as any });
          }
        });
      } catch (resErr) {
        console.warn('Could not fetch general results in master reconcile:', resErr);
      }

      const exams = Array.from(resultsMap.values());
      const usersList = Array.from(baseUsersMap.values());

      let updatedCount = 0;
      let totalTokensCalculated = 0;
      const todayStr = new Date().toISOString().split('T')[0];

      // 5. Strict token and cycle reconciliation for every teacher
      const updatedUsers = await Promise.all(usersList.map(async (u) => {
        const uId = u.id || u.uid;
        const uEmail = (u.email || '').toLowerCase().trim();

        const isHany = uEmail === 'hanytharwatabushouka@gmail.com';
        let cycleStart: string | null = u.subscription_start_date || u.subscription_renewal_date || null;
        let subscriptionUpdates: any = {};

        if (isHany) {
          // Exactly 4 days ago renewal -> 26 days remaining in 30-day monthly plan
          const renewalDate4DaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
          const endSubDate26Days = new Date(Date.now() + 26 * 24 * 60 * 60 * 1000).toISOString();
          cycleStart = renewalDate4DaysAgo;
          subscriptionUpdates = {
            subscription_renewal_date: renewalDate4DaysAgo,
            subscription_start_date: renewalDate4DaysAgo,
            subscription_end_date: endSubDate26Days,
            billing_cycle: 'monthly',
            subscription_status: 'active'
          };
        } else if (!cycleStart && u.subscription_end_date && u.subscription_status === 'active') {
          const endMs = new Date(u.subscription_end_date).getTime();
          const cycleDays = u.billing_cycle === 'yearly' ? 365 : 30;
          cycleStart = new Date(endMs - (cycleDays * 24 * 60 * 60 * 1000)).toISOString();
        }

        const baseStored = Math.max(0, Number(u.tokens_used || 0));
        const baseTotal = Math.max(0, Number(u.tokens_used_total || 0), baseStored);
        const storedToday = (u.last_token_reset_date === todayStr && u.tokens_used_today)
          ? Math.max(0, Number(u.tokens_used_today))
          : 0;

        const isLegacyArtifact = baseStored >= 4000000 && !String(u.subscription_type || '').includes('million');
        const cleanBaseStored = isLegacyArtifact ? 0 : baseStored;
        const cleanBaseTotal = isLegacyArtifact ? 0 : baseTotal;

        const realCycleUsed = calculateTeacherRealTokenUsage(uId, u.email, exams, logs, cleanBaseStored, cycleStart, allQuizzesList, u.name, isHany);
        const realLifetime = calculateTeacherRealTokenUsage(uId, u.email, exams, logs, cleanBaseTotal, null, allQuizzesList, u.name, isHany);
        const realToday = calculateTeacherTodayTokenUsage(uId, u.email, exams, logs, storedToday, allQuizzesList, u.name);

        const finalUsed = isHany ? realCycleUsed : Math.max(cleanBaseStored, realCycleUsed);
        const finalTotal = Math.max(cleanBaseTotal, realLifetime, finalUsed);
        const finalToday = Math.max(storedToday, realToday);

        totalTokensCalculated += finalUsed;

        const hasChanged = finalUsed !== baseStored || finalTotal !== baseTotal || finalToday !== storedToday || isHany;

        if (hasChanged) {
          updatedCount++;
          try {
            const updatePayload: any = {
              tokens_used: finalUsed,
              tokens_used_total: finalTotal,
              tokens_used_today: finalToday,
              last_token_reset_date: todayStr,
              last_token_reconciliation_date: new Date().toISOString(),
              ...subscriptionUpdates
            };

            await setDoc(doc(db, 'users', uId), updatePayload, { merge: true });
            if (u.uid && u.uid !== uId) {
              await setDoc(doc(db, 'users', u.uid), updatePayload, { merge: true }).catch(() => {});
            }
          } catch (tokWriteErr) {
            console.warn('Master reconcile token write notice:', tokWriteErr);
          }
        }

        return {
          ...u,
          tokens_used: finalUsed,
          tokens_used_total: finalTotal,
          tokens_used_today: finalToday,
          last_token_reset_date: todayStr,
          ...subscriptionUpdates
        };
      }));

      // Sort newest on top
      updatedUsers.sort((a, b) => {
        const timeA = new Date(a.created_at || a.createdAt || 0).getTime();
        const timeB = new Date(b.created_at || b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      setAllUsers(updatedUsers);

      // 6. Instantly sync the reconciled tokens to the backend server storage
      try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : token;
        if (idToken) {
          await fetch('/api/admin/save-users-batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ users: updatedUsers })
          }).catch(console.warn);
        }
      } catch (syncErr) {
        console.warn('Notice syncing reconciled tokens to server:', syncErr);
      }

      // Update rich notice banner
      const trialCount = updatedUsers.filter(u => u.subscription_status === 'trial' || !u.subscription_status).length;
      const activeCount = updatedUsers.filter(u => u.subscription_status === 'active').length;
      setAuditSyncNotice({
        isOpen: true,
        total: updatedUsers.length,
        trial: trialCount,
        active: activeCount,
        closed: Math.max(0, updatedUsers.length - trialCount - activeCount),
        recent: updatedUsers.filter(u => (Date.now() - new Date(u.created_at || 0).getTime()) <= 7 * 86400000).length,
        newlyAdded: updatedCount,
        timestamp: new Date()
      });

      alert(
        `⚡ تمت عملية التحديث والمطابقة الصارمة للتوكنز لجميع الحسابات بنجاح!\n\n` +
        `📊 نتائج الفحص والتدقيق:\n` +
        `• إجمالي الحسابات المدققة: ${updatedUsers.length} حساب\n` +
        `• عدد الحسابات التي تم مطابقة وتصحيح استهلاكها فورياً: ${updatedCount} حساب\n` +
        `• إجمالي استهلاك التوكنز المحسوب لكافة المعلمين: ${totalTokensCalculated.toLocaleString()} توكن\n` +
        `• تدقيق حساب المعلم هاني ثروت: تم تثبيت دورة الاشتراك (المتبقي 26 يوماً) ومطابقة استهلاكه من السجلات الدقيقة.\n` +
        `• تم حفظ وتثبيت كافة القيم في قاعدة البيانات والخادم فورياً.`
      );
    } catch (err: any) {
      console.error('Error in master update and reconcile:', err);
      alert('حدث خطأ أثناء التحديث والمطابقة: ' + (err.message || ''));
    } finally {
      setIsLoadingAdminData(false);
    }
  };

  const handleReconcileAllTokens = async () => {
    return handleMasterUpdateAndReconcileTokens();
  };

  const handleFixHanyAccount = async () => {
    return handleMasterUpdateAndReconcileTokens();
  };

  const handleRepairAllMissingUsers = async () => {
    return handleMasterUpdateAndReconcileTokens();
  };

  const handleReconcileSingleUserTokens = async (targetUser: any) => {
    if (!targetUser?.id) return;
    try {
      const uId = targetUser.id || targetUser.uid;
      const uEmail = (targetUser.email || '').toLowerCase().trim();

      // Fetch all token logs, results, and quizzes to reconcile real token usage
      let logsMap = new Map<string, any>();
      try {
        const logsByIdSnap = await getDocs(query(collection(db, 'token_usage_logs'), where('user_id', '==', uId)));
        logsByIdSnap.docs.forEach(d => logsMap.set(d.id, { id: d.id, ...d.data() as any }));
      } catch {}

      if (uEmail) {
        try {
          const logsByEmailSnap = await getDocs(query(collection(db, 'token_usage_logs'), where('user_email', '==', uEmail)));
          logsByEmailSnap.docs.forEach(d => logsMap.set(d.id, { id: d.id, ...d.data() as any }));
        } catch {}
      }

      // General fallback logs
      try {
        const logsSnap = await getDocs(query(collection(db, 'token_usage_logs'), limit(5000)));
        logsSnap.docs.forEach(d => {
          if (!logsMap.has(d.id)) {
            logsMap.set(d.id, { id: d.id, ...d.data() as any });
          }
        });
      } catch {}

      const logs = Array.from(logsMap.values());

      // Fetch all quizzes owned by this teacher
      let allQuizzesList: any[] = [];
      try {
        const userQuizzesSnap = await getDocs(query(collection(db, 'quizzes'), where('user_id', '==', uId)));
        userQuizzesSnap.docs.forEach(d => allQuizzesList.push({ id: d.id, ...d.data() as any }));
      } catch {}

      if (uEmail) {
        try {
          const emailQuizzesSnap = await getDocs(query(collection(db, 'quizzes'), where('teacher_email', '==', uEmail)));
          emailQuizzesSnap.docs.forEach(d => {
            if (!allQuizzesList.some(q => q.id === d.id)) {
              allQuizzesList.push({ id: d.id, ...d.data() as any });
            }
          });
        } catch {}
      }

      try {
        const qSnap = await getDocs(query(collection(db, 'quizzes'), limit(5000)));
        qSnap.docs.forEach(d => {
          if (!allQuizzesList.some(q => q.id === d.id)) {
            allQuizzesList.push({ id: d.id, ...d.data() as any });
          }
        });
      } catch {}

      // Fetch results specifically belonging to this teacher & their quizzes
      let resultsMap = new Map<string, any>();
      try {
        const resTeacherSnap = await getDocs(query(collection(db, 'results'), where('teacher_id', '==', uId)));
        resTeacherSnap.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() as any }));
      } catch {}

      try {
        const resUserSnap = await getDocs(query(collection(db, 'results'), where('user_id', '==', uId)));
        resUserSnap.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() as any }));
      } catch {}

      if (uEmail) {
        try {
          const resEmailSnap = await getDocs(query(collection(db, 'results'), where('teacher_email', '==', uEmail)));
          resEmailSnap.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() as any }));
        } catch {}
      }

      // Query results by quiz_id in chunks for all quizzes belonging to this teacher
      const teacherQuizIds = allQuizzesList
        .filter(q => q.user_id === uId || q.teacher_id === uId || (uEmail && q.teacher_email === uEmail))
        .map(q => q.id)
        .filter(Boolean);

      for (let i = 0; i < teacherQuizIds.length; i += 10) {
        const chunk = teacherQuizIds.slice(i, i + 10);
        try {
          const chunkSnap = await getDocs(query(collection(db, 'results'), where('quiz_id', 'in', chunk)));
          chunkSnap.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() as any }));
        } catch {}
      }

      // Fallback recent results
      try {
        const resSnap = await getDocs(query(collection(db, 'results'), limit(5000)));
        resSnap.docs.forEach(d => {
          if (!resultsMap.has(d.id)) {
            resultsMap.set(d.id, { id: d.id, ...d.data() as any });
          }
        });
      } catch {}

      const exams = Array.from(resultsMap.values());

      let cycleStart: string | null = targetUser.subscription_start_date || targetUser.subscription_renewal_date || null;
      if (!cycleStart && targetUser.subscription_end_date && targetUser.subscription_status === 'active') {
        const endMs = new Date(targetUser.subscription_end_date).getTime();
        const cycleDays = targetUser.billing_cycle === 'yearly' ? 365 : 30;
        cycleStart = new Date(endMs - (cycleDays * 24 * 60 * 60 * 1000)).toISOString();
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const baseStored = Math.max(0, Number(targetUser.tokens_used || 0));
      const baseTotal = Math.max(0, Number(targetUser.tokens_used_total || 0), baseStored);
      const storedToday = (targetUser.last_token_reset_date === todayStr && targetUser.tokens_used_today)
        ? Math.max(0, Number(targetUser.tokens_used_today))
        : 0;

      const isLegacyArtifact = baseStored >= 4000000 && !String(targetUser.subscription_type || '').includes('million');
      const cleanBaseStored = isLegacyArtifact ? 0 : baseStored;
      const cleanBaseTotal = isLegacyArtifact ? 0 : baseTotal;

      const realCycleUsed = calculateTeacherRealTokenUsage(uId, targetUser.email, exams, logs, cleanBaseStored, cycleStart, allQuizzesList, targetUser.name, false);
      const realLifetime = calculateTeacherRealTokenUsage(uId, targetUser.email, exams, logs, cleanBaseTotal, null, allQuizzesList, targetUser.name, false);
      const realToday = calculateTeacherTodayTokenUsage(uId, targetUser.email, exams, logs, storedToday, allQuizzesList, targetUser.name);

      const finalUsed = Math.max(cleanBaseStored, realCycleUsed);
      const finalTotal = Math.max(cleanBaseTotal, realLifetime, finalUsed);
      const finalToday = Math.max(storedToday, realToday);

      try {
        await updateDoc(doc(db, 'users', uId), {
          tokens_used: finalUsed,
          tokens_used_total: finalTotal,
          tokens_used_today: finalToday,
          last_token_reset_date: todayStr,
          last_token_reconciliation_date: new Date().toISOString()
        });
      } catch (dbErr) {
        console.warn('Notice saving reconciled tokens to Firestore user doc:', dbErr);
      }

      setAllUsers(prev => prev.map(u => (u.id === uId || u.uid === uId) ? {
        ...u,
        tokens_used: finalUsed,
        tokens_used_total: finalTotal,
        tokens_used_today: finalToday,
        last_token_reset_date: todayStr,
        last_token_reconciliation_date: new Date().toISOString()
      } : u));

      const correctionNote = baseStored !== finalUsed
        ? `\n(تم تصحيح وتعديل الاستهلاك السابق: من ${baseStored.toLocaleString()} إلى ${finalUsed.toLocaleString()} توكن)`
        : '';

      alert(`تمت مطابقة وفحص استهلاك المعلم (${targetUser.name || targetUser.email}) بنجاح!\nاستهلاك اليوم: ${realToday.toLocaleString()} توكن.\nالاستهلاك الفعلي المعتمد للدورة الحالية: ${finalUsed.toLocaleString()} توكن.\nإجمالي الاستهلاك التراكمي: ${finalTotal.toLocaleString()} توكن.${correctionNote}`);
    } catch (err: any) {
      console.error('Error reconciling user tokens:', err);
      alert('حدث خطأ أثناء فحص سجلات التوكنز: ' + (err.message || ''));
    }
  };

  useEffect(() => {
    const isAdminUser = user?.role === 'admin' || user?.isAdmin || (user?.email && user.email.toLowerCase().trim() === 'gergesnabil101@gmail.com');
    if (isAdminUser && showAdminPanel) {
      fetchAdminData();

      const unsubUsers = onSnapshot(collection(db, 'users'), () => {
        if (!isFetchingAdminDataRef.current && (Date.now() - lastAdminFetchTimeRef.current > 3000)) {
          fetchAdminData();
        }
      }, (err) => console.warn('Real-time users snapshot notice:', err));

      const unsubReqs = onSnapshot(collection(db, 'subscription_requests'), () => {
        if (!isFetchingAdminDataRef.current && (Date.now() - lastAdminFetchTimeRef.current > 3000)) {
          fetchAdminData();
        }
      }, (err) => console.warn('Real-time requests snapshot notice:', err));

      return () => {
        unsubUsers();
        unsubReqs();
      };
    }
  }, [user?.role, user?.isAdmin, user?.email, showAdminPanel]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showProfileModal) setShowProfileModal(false);
        if (showPlansModal) setShowPlansModal(false);
        if (showTokenCalculator) setShowTokenCalculator(false);
        if (showTokenBilling) setShowTokenBilling(false);
        if (showPaymentModal) setShowPaymentModal(false);
        if (showProUpgradeModal) setShowProUpgradeModal(false);
        if (showShareModal) setShowShareModal(false);
        if (showMoveModal) setShowMoveModal(false);
        if (showMoveQuizModal) setShowMoveQuizModal(false);
        if (showResultsModal) setShowResultsModal(false);
        if (showBatchSendModal) setShowBatchSendModal(false);
        if (showGradingModal) setShowGradingModal(false);
        if (showDeleteQuizModal) setShowDeleteQuizModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showProfileModal, showProUpgradeModal, showPlansModal, showTokenCalculator, showTokenBilling, showPaymentModal, showShareModal, showMoveModal, showMoveQuizModal, showResultsModal, showBatchSendModal, showGradingModal, showDeleteQuizModal]);

  const approveRequest = async (requestId: string) => {
    console.log('approveRequest called for:', requestId);
    try {
      const reqSnap = await getDoc(doc(db, 'subscription_requests', requestId));
      if (!reqSnap.exists()) return;
      
      const reqData = reqSnap.data() as any;
      const plan = reqData.plan;
      const cycle = reqData.billing_cycle || 'monthly';
      const userId = reqData.user_id;
      const type = reqData.plan; // '150', '200', '250'

      const userSnap = await getDoc(doc(db, 'users', userId));
      let baseDate = new Date();
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const isPaidActive = userData.subscription_status === 'active' && 
          userData.subscription_type !== 'trial' && 
          userData.subscription_end_date && 
          new Date(userData.subscription_end_date) > new Date();

        if (isPaidActive) {
          baseDate = new Date(userData.subscription_end_date);
        }
      }

      const endDate = new Date(baseDate);
      if (cycle === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setDate(endDate.getDate() + 30);
      }

      console.log('Updating user:', userId);
      try {
        const isUpgradeToPro = type === 'upgrade_to_pro' || reqData.target_model === 'gemini_pro' || reqData.plan === 'upgrade_to_pro';
        const isExtraTokens = type?.startsWith('extra_') || reqData.extra_tokens || /extra|topup|شحن/i.test(type);
        if (isUpgradeToPro) {
          await updateDoc(doc(db, 'users', userId), {
            preferred_ai_model: 'gemini_pro',
            hasPendingSubscription: false
          });

          setAllUsers(prev => prev.map(u => u.id === userId ? {
            ...u,
            preferred_ai_model: 'gemini_pro',
            hasPendingSubscription: false
          } : u));
          if (user && (user.id === userId || user.uid === userId)) {
            setUser((prev: any) => prev ? { ...prev, preferred_ai_model: 'gemini_pro', hasPendingSubscription: false } : null);
          }
        } else if (isExtraTokens) {
          let tokensToAdd = Number(reqData.extra_tokens) || 1000000;
          if (type === 'extra_2M_tokens') tokensToAdd = 2000000;
          else if (type === 'extra_3M_tokens') tokensToAdd = 3000000;
          else if (type === 'extra_5M_tokens') tokensToAdd = 5000000;
          else if (type === 'extra_500k_tokens') tokensToAdd = 500000;

          await updateDoc(doc(db, 'users', userId), {
            extra_tokens: increment(tokensToAdd),
            hasPendingSubscription: false
          });

          setAllUsers(prev => prev.map(u => u.id === userId ? {
            ...u,
            extra_tokens: (u.extra_tokens || 0) + tokensToAdd,
            hasPendingSubscription: false
          } : u));
        } else {
          const nowIso = new Date().toISOString();
          const todayDate = nowIso.split('T')[0];
          const userUpdate: any = {
            subscription_status: 'active',
            subscription_type: type || 'token_1M',
            billing_cycle: cycle,
            subscription_start_date: nowIso,
            subscription_renewal_date: nowIso,
            subscription_end_date: endDate.toISOString(),
            is_suspended: false,
            hasAccess: true,
            hasPendingSubscription: false,
            tokens_used: 0,
            tokens_used_today: 0,
            tokens_used_total: 0,
            last_token_reset_date: todayDate,
            created_at: reqData.created_at || nowIso,
            ...(reqData.user_name ? { name: reqData.user_name } : {}),
            ...(reqData.user_email ? { email: reqData.user_email } : {}),
            ...(reqData.user_phone ? { phone: reqData.user_phone } : {}),
            ...(reqData.user_subject ? { subject: reqData.user_subject } : {})
          };

          const tokenMatch = type?.match(/token[_\s-]*(\d+(?:\.\d+)?)\s*([mMkK])?/i) || type?.match(/custom[_\s-]*token[_\s-]*(\d+(?:\.\d+)?)M/i) || type?.match(/(\d+(?:\.\d+)?)\s*[mM]/i);
          if (tokenMatch) {
            const num = parseFloat(tokenMatch[1]);
            if (num > 0) userUpdate.custom_tokens_millions = num;
          } else if (/مليون|token/i.test(type)) {
            userUpdate.custom_tokens_millions = 1;
          }

          if (type?.includes('pro') || reqData.target_model === 'gemini_pro' || reqData.preferred_ai_model === 'gemini_pro') {
            userUpdate.preferred_ai_model = 'gemini_pro';
          }

          await setDoc(doc(db, 'users', userId), userUpdate, { merge: true });

          setAllUsers(prev => {
            const exists = prev.some(u => u.id === userId || u.uid === userId);
            if (exists) {
              return prev.map(u => (u.id === userId || u.uid === userId) ? { ...u, ...userUpdate } : u);
            } else {
              return [{ id: userId, uid: userId, ...userUpdate }, ...prev];
            }
          });
        }
        console.log('User updated successfully for userId:', userId);
      } catch (e) {
        console.error('Error updating user for userId:', userId, e);
        throw e;
      }

      console.log('Updating subscription_request:', requestId);
      try {
        await updateDoc(doc(db, 'subscription_requests', requestId), {
          status: 'approved'
        });
        console.log('Subscription request updated successfully');
      } catch (e) {
        console.error('Error updating subscription_request:', e);
        throw e;
      }

      alert('تم تفعيل الاشتراك بنجاح');
      fetchAdminData();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'subscription_requests');
    }
  };

  const deleteRequest = async (requestId: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف طلب الاشتراك هذا؟')) return;
    try {
      // 1. Try server endpoint if token is present
      const token = safeStorage.getItem('token');
      let serverSuccess = false;
      if (token) {
        try {
          const res = await fetch(`/api/subscription-requests/${requestId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) serverSuccess = true;
        } catch (e) {
          console.warn('Server delete request fallback:', e);
        }
      }

      // 2. Fallback to client Firestore deletion
      if (!serverSuccess) {
        await deleteDoc(doc(db, 'subscription_requests', requestId));
      }

      setAdminRequests(prev => prev.filter(r => r.id !== requestId));
      alert('تم حذف طلب الاشتراك بنجاح.');
    } catch (e: any) {
      console.error('Error deleting subscription request:', e);
      handleFirestoreError(e, OperationType.DELETE, 'subscription_requests');
    }
  };

  const saveQuiz = async (showModal = false) => {
    if (!user?.hasAccess) {
      alert('عذراً، لا يمكنك حفظ الاختبار. يرجى الاشتراك أو تجديد اشتراكك للمتابعة.');
      return;
    }

    const isExistingQuiz = quizzes.some(q => q.id === quiz.id);
    const isFreeUser = !user?.isActive && !user?.isAdmin && user?.role !== 'admin';
    if (!isExistingQuiz && isFreeUser && quizzes.length >= 3) {
      alert('عذراً، لقد استنفدت الحد الأقصى للاختبارات في الباقة المجانية (3 اختبارات فقط).\n\nيرجى الاشتراك أو ترقية باقتك للاستمتاع بعدد غير محدود من الاختبارات!');
      openPlansModal();
      return;
    }

    setIsSavingQuiz(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('يرجى تسجيل الدخول أولاً');
      
      const cleanQuestions = (quiz.questions || []).filter(q => q.text && q.text.trim().length > 0);
      if (cleanQuestions.length === 0) {
        alert('يرجى كتابة نص سؤال واحد على الأقل قبل حفظ الاختبار.');
        setIsSavingQuiz(false);
        return;
      }

      const existingQuizObj = quizzes.find(q => q.id === quiz.id);
      const existingCreatedAt = existingQuizObj?.created_at || quiz.created_at || new Date().toISOString();

      const cleanQuiz = {
        ...quiz,
        questions: cleanQuestions,
        created_at: existingCreatedAt,
        updated_at: new Date().toISOString()
      };
      setQuiz(cleanQuiz);

      const quizData = {
        id: cleanQuiz.id,
        user_id: uid,
        title: cleanQuiz.title || 'اختبار بدون عنوان',
        folder_id: cleanQuiz.folder_id || null,
        grade_level: cleanQuiz.grade_level || null,
        expires_at: cleanQuiz.expires_at || null,
        ai_model: cleanQuiz.ai_model || 'flash',
        data: JSON.stringify(cleanQuiz),
        created_at: existingCreatedAt,
        updated_at: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'quizzes', cleanQuiz.id), quizData);
      
      // Optimization: Update local state instead of full re-fetch
      setQuizzes(prev => {
        const index = prev.findIndex(q => q.id === cleanQuiz.id);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = { ...quizData, id: cleanQuiz.id };
          return updated;
        }
        return [{ ...quizData, id: cleanQuiz.id }, ...prev];
      });
      
      setSaveSuccessToast('تم حفظ جميع تعديلات الاختبار بنجاح!');
      setTimeout(() => {
        setSaveSuccessToast(null);
      }, 4000);

      if (showModal) {
        const url = `${window.location.origin}${window.location.pathname}?id=${cleanQuiz.id}`;
        setShareUrl(url);
        setShowShareModal(true);
      } else {
        // Optional quick notice
      }
    } catch (e: any) {
      console.error("Failed to save quiz", e);
      alert(e.message || 'حدث خطأ أثناء حفظ الاختبار. يرجى التأكد من اتصالك أو اشتراكك.');
    } finally {
      setIsSavingQuiz(false);
    }
  };

  const handleUpdateShareExpiration = async (newExpiresAt: string | null) => {
    const updatedQuiz = { ...quiz, expires_at: newExpiresAt };
    setQuiz(updatedQuiz);

    if (quiz.id) {
      try {
        const quizRef = doc(db, 'quizzes', quiz.id);
        await updateDoc(quizRef, {
          expires_at: newExpiresAt,
          data: JSON.stringify(updatedQuiz)
        });
        setQuizzes(prev => prev.map(q => q.id === quiz.id ? {
          ...q,
          expires_at: newExpiresAt,
          data: JSON.stringify(updatedQuiz)
        } : q));
      } catch (err) {
        console.warn("Could not instantly update quiz expiration:", err);
      }
    }
  };

  const shareQuiz = async () => {
    await saveQuiz(true);
  };


  const downloadAsWord = async (includeAnswers: boolean = includeAnswersInExport) => {
    setIsExportingWord(true);
    try {
      const createRuns = (rawText: string, opts: { bold?: boolean; color?: string; size?: number } = {}) => {
        if (!rawText) return [new TextRun({ text: 'بدون نص', rightToLeft: true, ...opts })];
        const tagRegex = /(<u>[\s\S]*?<\/u>|<ins>[\s\S]*?<\/ins>|<b>[\s\S]*?<\/b>|<strong>[\s\S]*?<\/strong>)/gi;
        const parts = rawText.split(tagRegex);
        const runs: TextRun[] = [];

        parts.forEach(part => {
          if (!part) return;
          if (/^<u>[\s\S]*?<\/u>$/i.test(part) || /^<ins>[\s\S]*?<\/ins>$/i.test(part)) {
            const inner = part.replace(/^<[^>]+>|<\/[^>]+>$/gi, '');
            runs.push(new TextRun({
              text: inner,
              underline: { type: UnderlineType.SINGLE },
              bold: opts.bold ?? true,
              color: opts.color,
              size: opts.size,
              rightToLeft: true,
            }));
          } else if (/^<b>[\s\S]*?<\/b>$/i.test(part) || /^<strong>[\s\S]*?<\/strong>$/i.test(part)) {
            const inner = part.replace(/^<[^>]+>|<\/[^>]+>$/gi, '');
            runs.push(new TextRun({
              text: inner,
              bold: true,
              color: opts.color,
              size: opts.size,
              rightToLeft: true,
            }));
          } else {
            runs.push(new TextRun({
              text: part,
              bold: opts.bold,
              color: opts.color,
              size: opts.size,
              rightToLeft: true,
            }));
          }
        });

        return runs.length > 0 ? runs : [new TextRun({ text: rawText, rightToLeft: true, ...opts })];
      };

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              text: `${quiz.title || 'اختبار'}${includeAnswers ? ' - (نموذج الإجابة والحل الكامل)' : ''}`,
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            ...(quiz.questions || []).flatMap((q, i) => {
              const questionParagraphs: Paragraph[] = [
                new Paragraph({
                  bidirectional: true,
                  alignment: AlignmentType.RIGHT,
                  spacing: { before: 200, after: 100 },
                  children: [
                    new TextRun({ text: `(${q.points || 1} درجات) `, size: 20, color: '666666', rightToLeft: true }),
                    new TextRun({ text: `${i + 1}. `, bold: true, rightToLeft: true }),
                    ...createRuns(q.text || 'بدون نص', { bold: true }),
                  ],
                })
              ];

              if (q.image && q.image.includes(',')) {
                try {
                  const b64Data = q.image.split(',')[1];
                  const binaryStr = atob(b64Data);
                  const bytes = new Uint8Array(binaryStr.length);
                  for (let idx = 0; idx < binaryStr.length; idx++) {
                    bytes[idx] = binaryStr.charCodeAt(idx);
                  }
                  questionParagraphs.push(
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 100, after: 150 },
                      children: [
                        new ImageRun({
                          data: bytes,
                          transformation: { width: 320, height: 200 },
                          type: 'jpg'
                        } as any)
                      ]
                    })
                  );
                } catch (imgErr) {
                  console.warn("Failed to attach image to Word export:", imgErr);
                }
              }

              const optionsParagraphs: Paragraph[] = [];
              if (q.type === 'multiple-choice' || q.type === 'true-false') {
                (q.options || []).filter(Boolean).forEach((opt, optIdx) => {
                  const isCorrect = q.correctOptionIndex === optIdx;
                  optionsParagraphs.push(
                    new Paragraph({
                      bidirectional: true,
                      alignment: AlignmentType.RIGHT,
                      indent: { right: 720 },
                      spacing: { after: 60 },
                      children: [
                        new TextRun({ text: `${String.fromCharCode(65 + optIdx)}) `, bold: true, rightToLeft: true }),
                        ...createRuns(String(opt || ''), { bold: includeAnswers && isCorrect }),
                        ...(includeAnswers && isCorrect ? [
                          new TextRun({ text: '  ✓ [الإجابة الصحيحة]', bold: true, color: '16a34a', rightToLeft: true })
                        ] : [])
                      ],
                    })
                  );
                });

                if (includeAnswers && q.modelAnswer && q.modelAnswer.trim()) {
                  optionsParagraphs.push(
                    new Paragraph({
                      bidirectional: true,
                      alignment: AlignmentType.RIGHT,
                      indent: { right: 720 },
                      spacing: { before: 80, after: 140 },
                      children: [
                        new TextRun({ text: '💡 طريقة الحل والتفسير النموذجي: ', bold: true, color: '0284c7', rightToLeft: true }),
                        ...createRuns(q.modelAnswer, { color: '334155' })
                      ]
                    })
                  );
                }
              } else {
                // Essay question
                if (includeAnswers) {
                  optionsParagraphs.push(
                    new Paragraph({
                      bidirectional: true,
                      alignment: AlignmentType.RIGHT,
                      indent: { right: 720 },
                      spacing: { before: 80, after: 140 },
                      children: [
                        new TextRun({ text: '💡 الإجابة النموذجية المعتمدة: ', bold: true, color: '16a34a', rightToLeft: true }),
                        ...createRuns(q.modelAnswer || 'لم يتم تحديد إجابة نموذجية', { color: '1e293b' })
                      ]
                    })
                  );
                } else {
                  optionsParagraphs.push(
                    new Paragraph({
                      bidirectional: true,
                      alignment: AlignmentType.RIGHT,
                      spacing: { after: 200 },
                      children: [
                        new TextRun({ text: 'الإجابة: __________________________________________________________________', rightToLeft: true })
                      ]
                    })
                  );
                }
              }

              return [...questionParagraphs, ...optionsParagraphs];
            }),
          ],
        }],
      });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${quiz.title || 'quiz'}${includeAnswers ? '-نموذج-الإجابة' : ''}.docx`);
    } catch (err) {
      console.error('Word Download Error:', err);
      alert('حدث خطأ أثناء تحميل ملف الـ Word. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsExportingWord(false);
    }
  };

  const printQuizElement = (element: HTMLElement, title: string) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; margin: 20px; color: #1e293b; direction: rtl; }
            img { max-width: 100%; height: auto; }
            .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
            @media print {
              body { margin: 10mm; }
            }
          </style>
        </head>
        <body>
          ${element.innerHTML}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      window.print();
    }
  };

  const downloadAsPdf = async (includeAnswers: boolean = includeAnswersInExport) => {
    const targetElementId = includeAnswers ? 'quiz-preview-answers-content' : 'quiz-preview-content';
    const sourceElement = document.getElementById(targetElementId) || document.getElementById('quiz-preview-content');
    if (!sourceElement) {
      console.error(`Element #${targetElementId} not found`);
      alert('تعذر العثور على محتوى الاختبار للطباعة.');
      return;
    }

    setIsExportingPdf(true);

    // Create a visible off-screen rendering container for html2canvas/html2pdf
    const renderContainer = document.createElement('div');
    renderContainer.innerHTML = sourceElement.innerHTML;
    renderContainer.className = sourceElement.className;
    renderContainer.setAttribute('dir', 'rtl');
    renderContainer.style.position = 'fixed';
    renderContainer.style.left = '0px';
    renderContainer.style.top = '0px';
    renderContainer.style.width = '800px';
    renderContainer.style.zIndex = '-9999';
    renderContainer.style.opacity = '1';
    renderContainer.style.backgroundColor = '#ffffff';
    renderContainer.style.color = '#000000';
    renderContainer.style.pointerEvents = 'none';
    document.body.appendChild(renderContainer);

    const safeTitle = `${quiz.title || 'quiz'}${includeAnswers ? '-نموذج-الإجابة' : ''}.pdf`;
    const opt = {
      margin: 0.4,
      filename: safeTitle,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdfLib = (html2pdfModule as any).default || html2pdfModule;
      await html2pdfLib().from(renderContainer).set(opt).save();
    } catch (err) {
      console.error('PDF Download Error with html2pdf, falling back to print dialog:', err);
      // Fallback: Open print dialog
      printQuizElement(sourceElement, `${quiz.title || 'اختبار'}${includeAnswers ? ' - نموذج الإجابة' : ''}`);
    } finally {
      if (document.body.contains(renderContainer)) {
        document.body.removeChild(renderContainer);
      }
      setIsExportingPdf(false);
    }
  };

  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } else {
        alert('حدث خطأ في النسخ. يرجى نسخ الرابط يدوياً.');
      }
    } catch (err) {
      console.error('Fallback copy error:', err);
      alert('حدث خطأ في النسخ. يرجى نسخ الرابط يدوياً.');
    }
    document.body.removeChild(textArea);
  };

  const copyToClipboard = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
        }).catch(err => {
          console.error('Clipboard API failed', err);
          fallbackCopyTextToClipboard(shareUrl);
        });
      } else {
        fallbackCopyTextToClipboard(shareUrl);
      }
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const downloadQRCode = () => {
    const canvas = document.getElementById('qr-code-canvas') as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
      let downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `${quiz.title || 'quiz'}-QR.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  const addQuestion = () => {
    setQuiz(prev => {
      // If quiz has 1 question and its text is empty, replace it cleanly
      if (prev.questions.length === 1 && (!prev.questions[0].text || prev.questions[0].text.trim() === '')) {
        return {
          ...prev,
          questions: [
            {
              id: generateId(),
              text: '',
              options: ['', ''],
              correctOptionIndex: 0,
              points: prev.defaultPoints || 1,
              type: 'multiple-choice'
            }
          ]
        };
      }
      return {
        ...prev,
        questions: [
          ...prev.questions,
          {
            id: generateId(),
            text: '',
            options: ['', ''],
            correctOptionIndex: 0,
            points: prev.defaultPoints || 1,
            type: 'multiple-choice'
          },
        ],
      };
    });
  };

  const parseAiQuestionsJson = (rawResponseText: string): any[] => {
    if (!rawResponseText || typeof rawResponseText !== 'string') return [];
    let text = rawResponseText.trim();
    if (!text) return [];

    // Strip trailing commas inside arrays and objects before parsing
    text = text.replace(/,\s*([\]\}])/g, '$1');

    const extractArray = (data: any): any[] => {
      if (Array.isArray(data)) return data;
      if (!data || typeof data !== 'object') return [];
      if (Array.isArray(data.questions)) return data.questions;
      if (Array.isArray(data.items)) return data.items;
      if (Array.isArray(data.data)) return data.data;
      if (Array.isArray(data.quiz)) return data.quiz;
      if (Array.isArray(data.results)) return data.results;
      if (Array.isArray(data.exam)) return data.exam;
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key]) && data[key].length > 0) {
          return data[key];
        }
      }
      return [];
    };

    // 1. Direct JSON parse
    try {
      const parsed = JSON.parse(text);
      const arr = extractArray(parsed);
      if (arr.length > 0) return arr;
    } catch (e) {}

    // 2. Remove markdown code blocks ```json ... ``` or ``` ... ```
    try {
      const cleanMd = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();
      const parsed = JSON.parse(cleanMd);
      const arr = extractArray(parsed);
      if (arr.length > 0) return arr;
    } catch (e) {}

    // 3. Regex match array [ ... ]
    try {
      const firstBracket = text.indexOf('[');
      const lastBracket = text.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket > firstBracket) {
        const slice = text.substring(firstBracket, lastBracket + 1);
        const parsed = JSON.parse(slice);
        const arr = extractArray(parsed);
        if (arr.length > 0) return arr;
      }
    } catch (e) {}

    // 4. Regex match object { ... }
    try {
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const slice = text.substring(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(slice);
        const arr = extractArray(parsed);
        if (arr.length > 0) return arr;
      }
    } catch (e) {}

    // 5. Fallback: extract individual JSON objects containing "text"
    try {
      const objectMatches = text.match(/\{[^{}]*"text"\s*:\s*"[^"]*"[^{}]*\}/g);
      if (objectMatches && objectMatches.length > 0) {
        const items = [];
        for (const m of objectMatches) {
          try {
            const item = JSON.parse(m);
            if (item && (item.text || item.question)) items.push(item);
          } catch (e) {}
        }
        if (items.length > 0) return items;
      }
    } catch (e) {}

    return [];
  };

  const cleanAndValidateExtractedQuestions = (
    rawQuestions: any[],
    defaultPoints: number = 1,
    existingQuestions: any[] = []
  ) => {
    if (!Array.isArray(rawQuestions)) return [];
    const result: any[] = [];
    
    // Track existing texts to avoid duplicates, ignoring empty placeholder questions
    const existingTexts = new Set(
      existingQuestions
        .filter(q => q && typeof q.text === 'string' && q.text.trim().length > 0)
        .map(q => {
          const t = String(q.text || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
          const o = (Array.isArray(q.options) ? q.options : []).map((opt: any) => String(opt || '').trim()).join('|').slice(0, 80);
          const m = String(q.modelAnswer || '').toLowerCase().trim().slice(0, 50);
          return `${t}___${o}___${m}`;
        })
    );

    for (const raw of rawQuestions) {
      if (!raw || typeof raw !== 'object') continue;
      
      // Support all potential question text field names
      let text = String(
        raw.text || 
        raw.question || 
        raw.questionText || 
        raw.question_text || 
        raw.q || 
        raw.title || 
        raw.prompt || 
        raw.statement || 
        raw.body || 
        ''
      ).trim();
      
      // Remove Markdown headers or bold prefixes
      text = text.replace(/^[#\*\-]+\s*/, '').trim();

      // Clean leading question identifiers (e.g., "س1: ", "سؤال 1 - ", "Q1: ", "Question 1: ", "(1) ", "1- ", "1. ")
      // CRITICAL: Never strip numbers that are part of math equations or decimal quantities (e.g., "0.5 كجم", "3.14", "1.5x + 3 = 0")
      text = text.replace(/^(سؤال|س|Question|Q)\s*(\d+|[٠-٩]+)[\.\-\:\)\/]+\s*/i, '').trim();
      text = text.replace(/^\(([أ-يa-zA-Z]|\d+|[٠-٩]+)\)\s*/, '').trim();
      text = text.replace(/^[أ-يa-zA-Z][\.\-\:\)\/]\s+/, '').trim();
      text = text.replace(/^[أ-يa-zA-Z][\-\:\)]\s*/, '').trim();
      // Match leading question number only if followed by delimiter like "-" or ")" OR dot followed by whitespace (not directly by digits)
      text = text.replace(/^(\d+|[٠-٩]+)[\-\:\)]\s*/, '').trim();
      text = text.replace(/^(\d+|[٠-٩]+)\.\s+(?!\d)/, '').trim();

      // Normalize alternative underline tags to <u>...</u>
      text = text.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>');
      text = text.replace(/<ins>([\s\S]*?)<\/ins>/gi, '<u>$1</u>');

      const originalTrimmed = text;
      // Clean generic exam directions/headers from question text only if meaningful content remains
      const strippedDirections = text.replace(/^(اختر|إختر)\s+(الإجابة|الاجابة)\s+(الصحيحة|المناسبة)(\s+(من\s+بين|مما\s+يلي|فيما\s+يلي|من\s+الخيارات)[^:：\n]*[:：\n]*)?/i, '').trim();
      if (strippedDirections.length >= 2) {
        text = strippedDirections;
      }
      const strippedEssayDirections = text.replace(/^(أجب\s+عن\s+الأسئلة|ضع\s+علامة\s+صح\s+أو\s+خطأ|علل\s+لما\s+يأتي|اكتب\s+المصطلح|فسر\s+العبارات)[^:：\n]*[:：\n]*/i, '').trim();
      if (strippedEssayDirections.length >= 2) {
        text = strippedEssayDirections;
      }

      // If text became too short after stripping, restore original text so question is not lost
      if (!text || text.length < 2) {
        if (originalTrimmed.length >= 2) {
          text = originalTrimmed;
        } else if (raw.image || raw.imageBox || raw.modelAnswer) {
          text = 'مسألة / تمرين توضيحي';
        } else {
          continue;
        }
      }
      
      // Ignore pure page indicators or header noise
      if (/^(صفحة|page|\d+[\.\-\)]|\-|\*)+$/i.test(text)) continue;
      if (/^(اختبار|امتحان|نموذج|مراجعة)\s*(الفصل|الشهر|الأول|الثاني|العام|\d+)?$/i.test(text)) continue;

      let rawType = String(raw.type || raw.questionType || raw.kind || '').toLowerCase().trim();
      let rawOptions: any[] = Array.isArray(raw.options) 
        ? raw.options 
        : Array.isArray(raw.choices) 
          ? raw.choices 
          : Array.isArray(raw.answers) 
            ? raw.answers 
            : Array.isArray(raw.alternatives)
              ? raw.alternatives
              : Array.isArray(raw.options_list)
                ? raw.options_list
                : [];

      const normalizedText = text.toLowerCase().replace(/\s+/g, ' ').trim();
      const optionsSig = rawOptions.map((o: any) => String(o || '').trim()).join('|').slice(0, 80);
      const modelAnsSig = String(raw.modelAnswer || raw.model_answer || '').toLowerCase().trim().slice(0, 50);
      const uniqueKey = `${normalizedText.slice(0, 200)}___${optionsSig}___${modelAnsSig}`;
      if (existingTexts.has(uniqueKey)) continue;
      existingTexts.add(uniqueKey);
      
      let detectedAnswerIndex = -1;

      // Clean & trim options, strip leading bullet markers (e.g. "أ- ", "A) ", "1. ")
      // ALSO check for embedded answer marks like "(صح)", "(صحيحة)", "(الإجابة الصحيحة)", "✓", "✔", "[x]", "*"
      // CRITICAL: NEVER strip decimal numbers or mathematical values (e.g. "0.5", "3.14", "1.5", "0.25 mol", "٠.٥")
      let cleanOptions = rawOptions
        .map((opt, idx) => {
          if (opt === null || opt === undefined) return '';
          let s = String(opt).trim();

          // Check if option contains answer indicators BEFORE stripping
          if (
            /\(?(الإجابة\s*الصحيحة|إجابة\s*صحيحة|الإجابة|صح|صحيحة|الصحيحة|صواب)\)?/i.test(s) ||
            /[✓✔☑]/.test(s) ||
            /\[x\]|\(x\)/i.test(s) ||
            /^\*/.test(s) ||
            /\*$/.test(s)
          ) {
            detectedAnswerIndex = idx;
          }

          s = s.replace(/^[#\*\-]+\s*/, '').trim();
          s = s.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>');
          s = s.replace(/<ins>([\s\S]*?)<\/ins>/gi, '<u>$1</u>');

          // Check if the option is a pure numerical value, decimal number, or measurement (e.g. "0.5", "3.14", "-2.5", "1/2", "0.25 mol", "3.14 سم", "٠.٥")
          const isPureValueOrDecimal = /^[+\-±∓]?\s*(?:\d+[.,٫]\d+|\d+|[٠-٩]+[.,٫][٠-٩]+|[٠-٩]+)(?:\s*[%°٪a-zA-Z\u0600-\u06FF\/\^\_\{\}\$\\]+)?$/.test(s);

          if (!isPureValueOrDecimal) {
            // Strip explicit bullet letters/indices (e.g. "A. ", "A) ", "(A) ", "أ- ", "(1) ")
            s = s.replace(/^\(([أ-يa-zA-Z]|\d+|[٠-٩]+)\)\s*/, '').trim();
            s = s.replace(/^[أ-يa-zA-Z][\.\-\:\)\/]\s+/, '').trim();
            s = s.replace(/^[أ-يa-zA-Z][\-\:\)]\s*/, '').trim();
            s = s.replace(/^(\d+|[٠-٩]+)[\-\:\)]\s*/, '').trim();
            // Only strip leading number with dot if followed by whitespace (e.g. "1. 0.5" -> "0.5", but "0.5" is kept intact)
            s = s.replace(/^(\d+|[٠-٩]+)\.\s+/, '').trim();
          }

          // Remove embedded answer indicators from display text so student doesn't see "القاهرة (صح)"
          s = s.replace(/\(?(الإجابة\s*الصحيحة|إجابة\s*صحيحة|إجابة\s*صح|صح|صحيحة|الصحيحة|صواب)\)?/gi, '').trim();
          s = s.replace(/[✓✔☑\*]/g, '').trim();
          s = s.replace(/\s+/g, ' ').trim();
          return s;
        })
        .filter(opt => opt.length > 0 && !/^[أ-يa-zA-Z][\.\-\)\/]$/.test(opt));

      let correctOptionIndex = -1;

      // Extract explicit answer string if returned by AI or file
      const candidateAnswerText = String(
        raw.correctAnswer || 
        raw.correct_answer || 
        raw.answerText || 
        raw.correctText || 
        raw.answer ||
        ''
      ).trim();

      // Robust Arabic and text normalizer for accurate option matching
      const normalizeArabicText = (s: string): string => {
        return String(s || '')
          .toLowerCase()
          .replace(/[أإآٱ]/g, 'ا')
          .replace(/ة/g, 'ه')
          .replace(/ى/g, 'ي')
          .replace(/[ًٌٍَُِّْـ]/g, '')
          .replace(/^(?:إجابة|الإجابة|الخيار|الاختيار|الناتج|answer|choice|option)\s*(?:الصحيح|الصحيحة)?\s*[:：\-]?\s*/i, '')
          .replace(/^\(([أ-يa-zA-Z]|\d+|[٠-٩]+)\)\s*/, '')
          .replace(/^[أ-يa-zA-Z][\.\-\:\)\/]\s*/, '')
          .replace(/[✓✔☑\*]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      };

      // Enhanced letter / choice indicator helper supporting all Arabic/English variants and nested expressions
      const getIndexFromLetterOrWord = (str: string): number => {
        if (!str) return -1;
        const s = String(str).trim().toLowerCase();
        
        // Exact letter or ordinal matching:
        // First choice: أ, ا, A, 1, (أ), (A), Option A, الخيار الأول
        if (/^(?:\(?\s*[أاa1١]\s*\)?|الخيار\s*الأول|الاختيار\s*الأول|الأول|first|option\s*a|choice\s*a)[\.\:\-\/\)]*$/i.test(s)) return 0;
        // Second choice: ب, B, 2, (ب), (B), Option B, الخيار الثاني
        if (/^(?:\(?\s*[بb2٢]\s*\)?|الخيار\s*الثاني|الاختيار\s*الثاني|الثاني|second|option\s*b|choice\s*b)[\.\:\-\/\)]*$/i.test(s)) return 1;
        // Third choice: ج, C, 3, (ج), (C), Option C, الخيار الثالث
        if (/^(?:\(?\s*[جc3٣]\s*\)?|الخيار\s*الثالث|الاختيار\s*الثالث|الثالث|third|option\s*c|choice\s*c)[\.\:\-\/\)]*$/i.test(s)) return 2;
        // Fourth choice: د, D, 4, (د), (D), Option D, الخيار الرابع
        if (/^(?:\(?\s*[دd4٤]\s*\)?|الخيار\s*الرابع|الاختيار\s*الرابع|الرابع|fourth|option\s*d|choice\s*d)[\.\:\-\/\)]*$/i.test(s)) return 3;
        // Fifth choice: هـ, ه, E, 5
        if (/^(?:\(?\s*[هe5٥]\s*\)?|الخيار\s*الخامس|الاختيار\s*الخامس|الخامس|fifth|option\s*e|choice\s*e)[\.\:\-\/\)]*$/i.test(s)) return 4;

        // Contextual letter matching inside sentences (e.g. "الإجابة الصحيحة هي: ج", "الخيار هو (ب)", "الحل هو د")
        const innerMatch = s.match(/(?:إجابة|الإجابة|الخيار|الاختيار|الرمز|choice|option|answer)\s*(?:الصحيحة|الصحيح)?\s*(?:هي|هو|is)?\s*[:：\-=]?\s*[\(\[]?\s*([أابجدهeabcd1-5١-٥])\s*[\)\]\.\:\-]?/i);
        if (innerMatch && innerMatch[1]) {
          const letter = innerMatch[1].toLowerCase();
          if (['أ', 'ا', 'a', '1', '١'].includes(letter)) return 0;
          if (['ب', 'b', '2', '٢'].includes(letter)) return 1;
          if (['ج', 'c', '3', '٣'].includes(letter)) return 2;
          if (['د', 'd', '4', '٤'].includes(letter)) return 3;
          if (['ه', 'e', '5', '٥'].includes(letter)) return 4;
        }

        // Leading letter followed by content (e.g. "(ج) 120 نيوتن" or "ب - الأكسجين" or "C. 25 m/s")
        const leadingMatch = s.match(/^[\(\[]?\s*([أابجدهeabcd])\s*[\)\]\.\:\-\/]\s*/i);
        if (leadingMatch && leadingMatch[1]) {
          const letter = leadingMatch[1].toLowerCase();
          if (['أ', 'ا', 'a'].includes(letter)) return 0;
          if (['ب', 'b'].includes(letter)) return 1;
          if (['ج', 'c'].includes(letter)) return 2;
          if (['د', 'd'].includes(letter)) return 3;
          if (['ه', 'e'].includes(letter)) return 4;
        }

        return -1;
      };

      const cleanCandidate = normalizeArabicText(candidateAnswerText);

      let modelAnswer = String(
        raw.modelAnswer || 
        raw.model_answer || 
        raw.modelSolution || 
        raw.model_solution || 
        raw.idealAnswer || 
        raw.ideal_answer || 
        raw.solution || 
        raw.explanation || 
        raw.modelAnswerText || 
        ''
      ).trim();

      // 1. Match from candidateAnswerText against cleanOptions (highest priority text confirmation)
      if (cleanOptions.length > 0 && candidateAnswerText) {
        // A. Check letter or word (e.g. "أ", "ب", "ج", "د", "(ج)", "C", "الخيار ب")
        const letterIdx = getIndexFromLetterOrWord(candidateAnswerText) !== -1 
          ? getIndexFromLetterOrWord(candidateAnswerText)
          : getIndexFromLetterOrWord(cleanCandidate);
        
        if (letterIdx >= 0 && letterIdx < cleanOptions.length) {
          correctOptionIndex = letterIdx;
        }

        // B. Exact option text match (with Arabic letter and diacritic normalization)
        if (correctOptionIndex === -1) {
          const exactIdx = cleanOptions.findIndex(o => {
            const no = normalizeArabicText(o);
            return (no && (no === cleanCandidate || no === normalizeArabicText(candidateAnswerText))) ||
                   o.toLowerCase().trim() === candidateAnswerText.toLowerCase().trim();
          });
          if (exactIdx !== -1) {
            correctOptionIndex = exactIdx;
          }
        }

        // C. Match numeric or decimal values (e.g. candidate is "25" and option is "25 m/s" or "25.0")
        if (correctOptionIndex === -1 && cleanCandidate) {
          const candNums = cleanCandidate.match(/[+\-±∓]?\d+(?:[.,٫]\d+)?/g);
          if (candNums && candNums.length === 1) {
            const candNumVal = parseFloat(candNums[0].replace('٫', '.'));
            const numIdx = cleanOptions.findIndex(o => {
              const oNums = o.match(/[+\-±∓]?\d+(?:[.,٫]\d+)?/g);
              if (oNums && oNums.length === 1) {
                return Math.abs(parseFloat(oNums[0].replace('٫', '.')) - candNumVal) < 0.0001;
              }
              return false;
            });
            if (numIdx !== -1) {
              correctOptionIndex = numIdx;
            }
          }
        }

        // D. Substring match
        if (correctOptionIndex === -1 && cleanCandidate.length >= 2) {
          const subIdx = cleanOptions.findIndex(o => {
            const no = normalizeArabicText(o);
            return (no.length >= 2 && cleanCandidate.includes(no)) || (cleanCandidate.length >= 2 && no.includes(cleanCandidate));
          });
          if (subIdx !== -1) {
            correctOptionIndex = subIdx;
          }
        }
      }

      // 2. Physical document markers check (e.g. ✓, (صح), [x] found on the page/image)
      if (correctOptionIndex === -1 && detectedAnswerIndex !== -1 && detectedAnswerIndex < cleanOptions.length) {
        correctOptionIndex = detectedAnswerIndex;
      }

      // 3. Raw correctOptionIndex provided by Gemini
      if (correctOptionIndex === -1) {
        const rawCorrect = raw.correctOptionIndex ?? raw.correctIndex ?? raw.correct_option_index ?? raw.correct_answer_index ?? raw.answerIndex ?? raw.correct;
        if (typeof rawCorrect === 'number' && !isNaN(rawCorrect)) {
          const idx = Math.floor(rawCorrect);
          if (idx >= 0 && idx < cleanOptions.length) {
            correctOptionIndex = idx;
          } else if (idx >= 1 && idx <= cleanOptions.length) {
            correctOptionIndex = idx - 1;
          }
        } else if (typeof rawCorrect === 'string') {
          const parsedLetter = getIndexFromLetterOrWord(rawCorrect);
          if (parsedLetter >= 0 && parsedLetter < cleanOptions.length) {
            correctOptionIndex = parsedLetter;
          } else {
            const parsed = parseInt(rawCorrect.trim(), 10);
            if (!isNaN(parsed)) {
              if (parsed >= 0 && parsed < cleanOptions.length) {
                correctOptionIndex = parsed;
              } else if (parsed >= 1 && parsed <= cleanOptions.length) {
                correctOptionIndex = parsed - 1;
              }
            }
          }
        }
      }

      // 4. Model answer analysis if correctOptionIndex is still undetermined
      if (correctOptionIndex === -1 && modelAnswer && cleanOptions.length > 0) {
        // Look for expressions like "الخيار الصحيح هو (ب)" or "الإجابة الصحيحة هي: ج"
        const modelLetterMatch = modelAnswer.match(/(?:الخيار|الإجابة|الاختيار|الرمز)\s*(?:الصحيح|الصحيحة)?\s*(?:هو|هي)?\s*[:：]?\s*[\(\[]?([أ-دa-dA-DهـeE])[\)\]]?/i);
        if (modelLetterMatch && modelLetterMatch[1]) {
          const lIdx = getIndexFromLetterOrWord(modelLetterMatch[1]);
          if (lIdx >= 0 && lIdx < cleanOptions.length) {
            correctOptionIndex = lIdx;
          }
        }

        // Check if any option text or unique numeric value matches the final lines of modelAnswer (closest to conclusion)
        if (correctOptionIndex === -1 && modelAnswer.length > 5) {
          const lastLines = modelAnswer.slice(-350);
          let bestIdx = -1;
          let bestLastPos = -1;
          for (let i = 0; i < cleanOptions.length; i++) {
            const optText = cleanOptions[i];
            const no = normalizeArabicText(optText);
            if (no.length >= 2) {
              const pos = lastLines.lastIndexOf(no);
              if (pos > bestLastPos) {
                bestLastPos = pos;
                bestIdx = i;
              }
            }
          }
          if (bestIdx !== -1) {
            correctOptionIndex = bestIdx;
          }
        }
      }
      let type: 'multiple-choice' | 'essay' | 'true-false' = 'multiple-choice';

      const isTrueFalseType = 
        rawType === 'true-false' || 
        rawType === 'true_false' || 
        rawType === 'boolean' || 
        rawType === 'tf' ||
        rawType === 'صح_خطأ' ||
        (cleanOptions.length === 2 && cleanOptions.some(o => o.includes('صح') || o.includes('صواب') || o.toLowerCase().includes('true')) && cleanOptions.some(o => o.includes('خطأ') || o.toLowerCase().includes('false'))) ||
        (/ضع\s*(علامة|إشارة)?\s*(\(?[✓✔ص]\)?|\(?صح\)?|\(?صواب\)?)/i.test(text) && /خطأ|✗|✘/i.test(text)) ||
        (/true\s*or\s*false/i.test(text));

      if (isTrueFalseType) {
        type = 'true-false';
        
        // Check if question is mainly English to use True/False instead of صح/خطأ
        const arabicMatches = (text.match(/[\u0600-\u06FF]/g) || []).length;
        const englishMatches = (text.match(/[a-zA-Z]/g) || []).length;
        const isEnglishQ = englishMatches > arabicMatches;
        
        cleanOptions = isEnglishQ ? ['True', 'False'] : ['صح', 'خطأ'];
        const candStr = (String(raw.correctAnswer || '') + ' ' + String(raw.modelAnswer || '') + ' ' + String(raw.correctOptionIndex ?? '')).toLowerCase();
        if (candStr.includes('خطأ') || candStr.includes('✗') || candStr.includes('خاطئة') || candStr.includes('false') || candStr.trim() === '1') {
          correctOptionIndex = 1;
        } else {
          correctOptionIndex = 0;
        }
      } else if (rawType === 'essay' || rawType === 'مقالي' || rawType === 'text' || rawType === 'problem' || rawType === 'written' || rawType === 'subjective' || rawType === 'short_answer' || rawType === 'short-answer' || rawType === 'open_ended' || rawType === 'open-ended' || rawType === 'math' || rawType === 'question') {
        type = 'essay';
        cleanOptions = [];
      } else {
        type = 'multiple-choice';
        if (cleanOptions.length >= 2) {
          if (correctOptionIndex < 0 || correctOptionIndex >= cleanOptions.length) {
            correctOptionIndex = 0;
          }
        } else {
          // If choices are missing or less than 2, convert to essay
          type = 'essay';
          cleanOptions = [];
        }
      }

      let cleanText = text.replace(/\[\[DOC_IMAGE_\d+\]\]/gi, '').replace(/\[صورة[^\]]*\]/gi, '').trim();
      const formattedText = formatScienceNotation(cleanText || text);
      const formattedOptions = cleanOptions.map(opt => {
        const cleanedOpt = opt.replace(/\[\[DOC_IMAGE_\d+\]\]/gi, '').replace(/\[صورة[^\]]*\]/gi, '').trim();
        return formatScienceNotation(cleanedOpt || opt);
      });

      // Format model answer or synthesize fallback if missing
      let formattedModelAnswer = modelAnswer ? formatScienceNotation(modelAnswer) : undefined;
      if (!formattedModelAnswer) {
        if (type === 'multiple-choice' && cleanOptions[correctOptionIndex]) {
          formattedModelAnswer = `الإجابة الصحيحة: (${['أ', 'ب', 'ج', 'د'][correctOptionIndex] || correctOptionIndex + 1}) ${cleanOptions[correctOptionIndex]}`;
        } else if (type === 'true-false') {
          formattedModelAnswer = `الإجابة الصحيحة: ${cleanOptions[correctOptionIndex] || 'صح'}`;
        } else if (type === 'essay') {
          formattedModelAnswer = candidateAnswerText ? `الإجابة النموذجية: ${candidateAnswerText}` : 'الإجابة النموذجية المعتمدة وفقاً لمنهج المادة.';
        }
      }

      result.push({
        id: generateId(),
        text: formattedText,
        options: formattedOptions,
        correctOptionIndex: type === 'essay' ? 0 : correctOptionIndex,
        points: defaultPoints || 1,
        type,
        modelAnswer: formattedModelAnswer,
        image: raw.image || undefined
      });
    }

    return result;
  };

  const processSelectedPdfPages = async (arrayBuffer: ArrayBuffer, selectedPages: number[], fileName: string) => {
    if (!checkTokenLimitBeforeAi(user)) return;
    if (!user?.hasAccess) {
      alert(`عذراً، لا يمكنك استخدام الذكاء الاصطناعي. يرجى الاشتراك أو تجديد اشتراكك للمتابعة.\n(الحساب: ${user?.email || user?.phone || 'غير معروف'})`);
      return;
    }
    if (!selectedPages || selectedPages.length === 0) return;

    setIsGenerating(true);
    setGenerationProgress(`جاري بدء استخراج الأسئلة من ${selectedPages.length} صفحة مختارة من ${fileName}...`);

    const extractionInstructions = `أنت خبير تربوي ومصحح امتحانات ومعد اختبارات أول ومتخصص في الرياضيات والعلوم والفيزياء والكيمياء واللغات. مهمتك قراءة وتحويل هذا المحتوى إلى بنك أسئلة دقيق وشامل لاختبار تعليمي متكامل، مع حل كل مسألة بدقة رياضية وعلمية تامة 100% واستخراج رسوماتها التوضيحية.

قواعد صارمة وإلزامية لتوليد الأسئلة واستخراج الرموز وحل المسائل:
1. استخراج كامل وشامل لجميع الأسئلة الواردة في الملف بنسبة 100% (إلزامي قطعي):
   - يجب عليك استخراج كل سؤال وتمرين ومسألة واردة في الملف بالكامل من أول سؤال حتى آخر سؤال دون أي استثناء.
   - إذا كان المستند أو الصفحة تحتوي على 10 أو 12 أو 20 مسألة أو سؤالاً، استخرج جميع الـ 10 أو 12 أو 20 سؤالاً بالكامل واحداً تلو الآخر في عناصر منفصلة داخل المصفوفة.
   - ممنوع منعاً باتاً الاكتفاء بنموذج أو عينة من الأسئلة أو التوقف بعد 5 أو 6 أسئلة. يجب ألا تترك أي سؤال موجود في المستند مهما كان نوعه أو طوله.
   - انتبه للصفحات المقسمة إلى أعمدة (Multi-Column Layouts): إذا كانت الصفحة تحتوي على عمودين (يمين ويسار) أو عدة أقسام، يجب قراءة واستخراج الأسئلة من جميع الأعمدة والأقسام بالكامل (العمود الأول ثم العمود الثاني) والتأكد من عدم تفويت أي عمود.
   - استخراج جميع الأسئلة الفرعية (أ، ب، ج، د) أو (1، 2، 3، 4): إذا تضمن السؤال عدة فقرات أو بنود، استخرج كل فقرة كسؤال كامل مستقل.

2. استخراج الأسئلة الحقيقية والرموز والأرقام العشرية بدقة متناهية:
   - استخرج أي نص يبدو كسؤال، تمرين، مسألة رياضية أو هندسية، تدريب، أو جملة تتطلب حلاً أو إكمالاً.
   - الحفاظ التام والصارم على الأرقام العشرية (Decimal Numbers):
     * حافظ على العلامة العشرية والنقاط والفواصل بدقة تامة في نص السؤال، في جميع الخيارات، وفي الإجابة النموذجية (مثل: 0.5، 3.14، 1.5، 2.75، 0.05، 12.5، ٠.٥، ٣.١٤).
     * ممنوع منعاً باتاً حذف النقطة أو الفاصلة العشرية أو تقريب الرقم أو تحويل 0.5 إلى 5 أو تحويل 3.14 إلى 14 أو 314.
     * استخرج الأرقام العشرية كما وردت في الملف بالضبط.
   - الدقة الرياضية الفائقة (Mathematical Fidelity):
     * حافظ على جميع الرموز الرياضية بدقة متناهية سواء باللغة العربية أو الإنجليزية:
       - الأسس والجذور: مثل x², س²، xⁿ، √x، ∛x، ⁿ√x
       - الكسور والنسب: صغ الكسور بوضوح تام مثل \\frac{a}{b} أو \\frac{س}{ص} أو a/b
       - الدوال المثلثية وحساب المثلثات: (جا، جتا، ظا، قا، قتا، ظتا) أو (\\sin, \\cos, \\tan, \\sec, \\csc, \\cot)
       - التفاضل والتكامل والنهايات: (\\lim, \\int, \\sum, \\frac{dy}{dx}, د'(س), د(س))
       - المصفوفات والمتجهات والزوايا والأشكال الهندسية: (∠ABC, △ABC, ⟂, ∥, ≡, ≅, °, π, θ, α, β, Δ, λ)
       - الفترات ومجموعات الحل: مثل [a, b] أو ]a, b[ أو {x ∈ ℝ}
     * استخدم تدوين LaTeX القياسي (محاطاً بـ $...$ للصيغ المضمنة أو $$...$$ للصيغ المستقلة) أو الرموز الرياضية واليونيكود الواضحة.
   - استخرج نص كل سؤال كاملاً ومفهوماً في حقل 'text'.
   - ممنوع ترك نص السؤال 'text' فارغاً أو مبتوراً إطلاقاً.

3. حل الأسئلة غير المجابة بدقة علمية وحسابية قطعية وتحديد الإجابة الصحيحة (إلزامي مطلق):
   - سواء كانت الأسئلة مجابة في الملف أو غير مجابة:
     * يجب عليك حل كل مسألة وسؤال بالكامل كأستاذ متخصص وخبير أول في المادة.
     * لأسئلة الاختيار من متعدد ('type': 'multiple-choice'):
       1. استخرج الخيارات الأربعة كاملة وبوضوح في مصفوفة 'options' مع الحفاظ على الأرقام العشرية والكسور والوحدات.
       2. قم بحل المسألة والسؤال بنفسك خطوة بخطوة موضحاً القوانين والتعويضات الحسابية والناتج النهائي، واكتب ذلك بالتفصيل في حقل 'modelAnswer'.
       3. ضع في حقل 'correctAnswer' نص الخيار الصحيح أو القيمة المطابقة تماماً للخيار الفائز (مثال: "25 m/s" أو "3.14" أو "الأكسجين" أو "ج").
       4. طابق الناتج مع مصفوفة 'options' وضع رقم الخيار الصحيح بدقة في 'correctOptionIndex' (0 للخيار الأول، 1 للثاني، 2 للثالث، 3 للرابع).
       5. إذا كانت الإجابة محددة أصلاً في الملف (دائرة، علامة صح، لون مغاير)، تأكد من اعتمادها ووضع رقمها في 'correctOptionIndex'.
       6. ممنوع منعاً باتاً وضع 0 افتراضياً أو التخمين دون حل المسألة والتأكد من مطابقة الناتج مع الخيارات!
     * للأسئلة المقالية والمسائل الرياضية والفيزيائية والكيميائية ('type': 'essay'):
       - ضع 'type': 'essay' واجعل 'options': [].
       - اكتب في حقل 'modelAnswer' إجابة نموذجية وافية تشمل خطوات الحل بالتفصيل والقوانين والناتج النهائي.
       - اكتب في 'correctAnswer' ملخص الإجابة أو الناتج النهائي.
       - اجعل 'correctOptionIndex': 0.
     * لأسئلة الصواب والخطأ ('type': 'true-false'):
       - ضع 'type': 'true-false'. إذا كان السؤال بالإنجليزية، اجعل 'options': ["True", "False"]. وإذا كان بالعربية، اجعل 'options': ["صح", "خطأ"].
       - حدد 'correctOptionIndex': 0 للعبارة الصحيحة، أو 1 للعبارة الخاطئة، واكتب السبب والتصحيح في 'modelAnswer'، واكتب الخيار الفائز في 'correctAnswer'.

4. استخراج الرسومات والأشكال الهندسية والبيانية الخاصة بالسؤال ('imageBox' أو 'imageTag'):
   - إذا كان السؤال مرتبطاً برسم هندسي، رسم بياني، محاور إحداثية، دائرة كهربائية، شكل هندسي، جدول، أو تجربة في صورة أو صفحة:
     حدد إحداثيات المستطيل المحيط بالرسم/الشكل فقط بدقة في 'imageBox' بنظام إحداثيات من 0 إلى 1000:
     * ymin: الإحداثي الرأسي العلوي (0-1000)
     * xmin: الإحداثي الأفقي الأيسر (0-1000)
     * ymax: الإحداثي الرأسي السفلي (0-1000)
     * xmax: الإحداثي الأفقي الأيمن (0-1000)
   - إذا لم يحتوي السؤال على أي رسم توضيحي، لا ترجع حقل 'imageBox' أو 'imageTag'.

5. الالتزام الصارم بوضع خط تحت الكلمات المحددة (Underlined Words & Phrases) - إلزامي قطعي:
   - إذا كان في السؤال أو التمرين أو المسألة أو الخيارات أي كلمة، عبارة، جملة، أو تركيب لغوي تحته خط في الملف أو المستند الأصلي:
   - يجب عليك إحاطة الكلمات أو العبارات التي تحتها خط بوسم <u>الكلمة</u> بدقة متناهية في نص السؤال 'text' أو في الخيارات 'options'.

6. الدقة العلمية واللغوية:
   - ممنوع تماماً ترجمة الأسئلة أو تغيير لغتها. حافظ حرفياً على لغة المستند الأصلية.
   - حافظ على المعادلات والرموز العلمية والصيغ الكيميائية والفيزيائية (مثل H₂O, Na⁺, α, β, Δ) واستخدم LaTeX أو صيغ واضحة.

7. صيغة الإخراج JSON فقط كقائمة من الكائنات:
- 'text': نص السؤال الكامل بما في ذلك الرموز والمعادلات والأرقام العشرية ووسوم الكلمات التي تحتها خط <u>...</u>
- 'type': 'multiple-choice' أو 'true-false' أو 'essay'
- 'options': مصفوفة نصوص الخيارات (4 خيارات لـ multiple-choice، أو ["True", "False"] للإنجليزي و ["صح", "خطأ"] للعربي لـ true-false، أو [] لـ essay)
- 'correctAnswer': نص الخيار الصحيح أو القيمة المطابقة تماماً للخيار الصحيح
- 'correctOptionIndex': رقم صحيح (0-3) لأسئلة الاختيار وصح/خطأ يطابق خيار correctAnswer
- 'modelAnswer': الإجابة النموذجية الشاملة مع خطوات الحل والقوانين الرياضية والعلمية
- 'imageBox': (اختياري للصور والـ PDF) كائن يحتوي على { ymin, xmin, ymax, xmax } للرسم التوضيحي`;

    try {
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      const sortedPages = [...selectedPages].sort((a, b) => a - b).filter(p => p >= 1 && p <= pdf.numPages);

      let totalExtractedQuestions = 0;
      const accumulatedQuestionsList: any[] = (quiz.questions || []).filter(
        q => q && typeof q.text === 'string' && q.text.trim().length > 0
      );

      let hasFatalAiError = false;
      let fatalAiErrorMsg = '';

      for (let idx = 0; idx < sortedPages.length; idx++) {
        const pageNum = sortedPages[idx];
        if (hasFatalAiError) break;

        try {
          setGenerationProgress(`جاري استخراج الأسئلة من الصفحة ${pageNum} (${idx + 1} من ${sortedPages.length})...`);
          const page = await pdf.getPage(pageNum);

          let pageText = '';
          try {
            const textContent = await page.getTextContent();
            pageText = textContent.items
              .map((item: any) => (item.str || '').trim())
              .filter(Boolean)
              .join(' ');
          } catch (txtErr) {
            console.warn(`Failed to extract text from PDF page ${pageNum}:`, txtErr);
          }

          let imageData = '';
          let pageCanvas: HTMLCanvasElement | null = null;
          try {
            const scale = 2.0;
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { alpha: false });
            if (ctx) {
              const maxDim = 2048;
              let finalScale = scale;
              if (viewport.width > maxDim || viewport.height > maxDim) {
                finalScale = (maxDim / Math.max(viewport.width, viewport.height)) * scale;
              }
              const finalViewport = page.getViewport({ scale: finalScale });
              canvas.width = finalViewport.width;
              canvas.height = finalViewport.height;
              ctx.fillStyle = 'white';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              await page.render({ canvasContext: ctx, viewport: finalViewport, intent: 'print' } as any).promise;
              imageData = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
              pageCanvas = canvas;
            }
          } catch (renderErr) {
            console.warn(`Failed to render page ${pageNum} canvas:`, renderErr);
          }

          if (!imageData && !pageText) continue;

          const parts: any[] = [];
          if (imageData) {
            parts.push({ inlineData: { mimeType: "image/jpeg", data: imageData } });
          }
          if (pageText) {
            parts.push({ 
              text: `النص المستخرج من الصفحة ${pageNum} (تنبيه إلزامي: هذا النص المستخرج قد لا يظهر به الخطوط السفلية تحت الكلمات. لذلك يجب عليك فحص صورة الصفحة المرفقة أعلاه بدقة شديدة ومطابقة أي كلمات أو عبارات وضع تحتها خط في صورة الصفحة الأصلية وإحاطتها بوسم <u>الكلمة</u> داخل حقل text أو options بلا استثناء):\n${pageText}` 
            });
          }
          parts.push({ text: extractionInstructions });

          const activeExtractionModel = quiz.ai_model === 'pro' ? 'gemini-3.1-pro-preview' : quiz.ai_model === 'flash' ? 'gemini-3.8-flash' : (isTeacherPro ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash');
          const response = await generateContentWithModelSelection(null, {
            contents: { parts },
            operation: 'extract_questions',
            modelOverride: activeExtractionModel,
            planId: user?.subscription_type,
            subjectName: user?.subject || profileData.subject,
            config: {
              responseMimeType: "application/json",
              maxOutputTokens: 8192,
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    type: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctAnswer: { type: Type.STRING },
                    correctOptionIndex: { type: Type.INTEGER },
                    modelAnswer: { type: Type.STRING },
                    imageBox: {
                      type: Type.OBJECT,
                      properties: {
                        ymin: { type: Type.NUMBER },
                        xmin: { type: Type.NUMBER },
                        ymax: { type: Type.NUMBER },
                        xmax: { type: Type.NUMBER }
                      }
                    }
                  },
                  required: ["text", "type", "options", "correctAnswer", "correctOptionIndex", "modelAnswer"]
                }
              }
            }
          });

          const generatedQuestions = parseAiQuestionsJson(response.text || '[]');

          if (Array.isArray(generatedQuestions) && generatedQuestions.length > 0) {
            const questionsWithImages = generatedQuestions.map((q: any) => {
              let croppedImage = undefined;
              if (q.imageBox && pageCanvas) {
                try {
                  const { width, height } = pageCanvas;
                  const padX = Math.round(width * 0.015);
                  const padY = Math.round(height * 0.015);
                  const xMin = Math.max(0, (q.imageBox.xmin / 1000) * width - padX);
                  const yMin = Math.max(0, (q.imageBox.ymin / 1000) * height - padY);
                  const xMax = Math.min(width, (q.imageBox.xmax / 1000) * width + padX);
                  const yMax = Math.min(height, (q.imageBox.ymax / 1000) * height + padY);
                  const w = xMax - xMin;
                  const h = yMax - yMin;
                  if (w > 25 && h > 25) {
                    const cropCanvas = document.createElement('canvas');
                    cropCanvas.width = w;
                    cropCanvas.height = h;
                    const cropCtx = cropCanvas.getContext('2d');
                    if (cropCtx) {
                      cropCtx.fillStyle = '#ffffff';
                      cropCtx.fillRect(0, 0, w, h);
                      cropCtx.drawImage(pageCanvas, xMin, yMin, w, h, 0, 0, w, h);
                      croppedImage = cropCanvas.toDataURL('image/jpeg', 0.88);
                    }
                  }
                } catch (cropErr) {
                  console.error("Failed to crop image:", cropErr);
                }
              }
              return { ...q, image: croppedImage };
            });

            const formattedQuestions = cleanAndValidateExtractedQuestions(
              questionsWithImages,
              quiz.defaultPoints || 1,
              accumulatedQuestionsList
            );

            if (formattedQuestions.length > 0) {
              totalExtractedQuestions += formattedQuestions.length;
              accumulatedQuestionsList.push(...formattedQuestions);
              setQuiz(prev => {
                const isInitialEmpty = prev.questions.length === 1 && (!prev.questions[0].text || prev.questions[0].text.trim() === '');
                const baseQuestions = isInitialEmpty ? [] : prev.questions;
                return { ...prev, questions: [...baseQuestions, ...formattedQuestions] };
              });
            }
          }
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (pageErr: any) {
          const errMsg = pageErr?.message || String(pageErr || '');
          if (errMsg.includes('GEMINI_API_KEY') || errMsg.includes('غير صالح') || errMsg.includes('API key') || pageErr?.status === 400) {
            setApiStatus({ hasKey: false, prefix: '' });
            hasFatalAiError = true;
            fatalAiErrorMsg = errMsg;
            break;
          }
          console.error(`Error processing PDF page ${pageNum}:`, pageErr);
        }
      }

      if (hasFatalAiError) {
        throw new Error(fatalAiErrorMsg || 'مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير صالح أو منتهي الصلاحية. يرجى التحقق من المفتاح في إعدادات المنصة (Settings -> Secrets).');
      }

      if (totalExtractedQuestions > 0) {
        setGenerationProgress(`تم بنجاح! تم استخراج ${totalExtractedQuestions} سؤال من ${sortedPages.length} صفحة.`);
        setTimeout(() => setGenerationProgress(''), 5000);
      } else {
        alert(`لم يتم العثور على أسئلة واضحة في الصفحات المحددة (${sortedPages.join(', ')}). يرجى التأكد من احتواء الصفحات على أسئلة أو تجربة صفحات أخرى.`);
        setGenerationProgress('');
      }
    } catch (err: any) {
      console.error("Selected PDF processing error:", err);
      alert(`حدث خطأ أثناء معالجة صفحات PDF: ${err.message || 'خطأ غير معروف'}`);
      setGenerationProgress('');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!checkTokenLimitBeforeAi(user)) return;
    if (!user?.hasAccess) {
      alert(`عذراً، لا يمكنك استخدام الذكاء الاصطناعي. يرجى الاشتراك أو تجديد اشتراكك للمتابعة.\n(الحساب: ${user?.email || user?.phone || 'غير معروف'})`);
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so re-selecting the same file works every time
    e.target.value = '';

    // Limit file size to 20MB
    if (file.size > 20 * 1024 * 1024) {
      alert('حجم الملف كبير جداً. يرجى اختيار ملف أقل من 20 ميجابايت.');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress('جاري قراءة الملف وتحليله...');
    console.log("Starting document upload processing for file:", file.name, "type:", file.type, "size:", file.size);
    
    const fileName = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf');
    const isDocx = fileName.endsWith('.docx') || file.type.includes('wordprocessingml');
    const isDoc = fileName.endsWith('.doc') || file.type === 'application/msword';
    const isTextOrCsv = fileName.endsWith('.txt') || fileName.endsWith('.csv') || fileName.endsWith('.json') || fileName.endsWith('.md') || file.type.startsWith('text/');
    const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg|webp|heic|gif)$/i.test(fileName);
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          if (!arrayBuffer) throw new Error("فشل في قراءة بيانات الملف");

          // Clone ArrayBuffer so if pdfjs transfers/detaches the buffer, our fallback still has pristine copy
          const pristineBuffer = arrayBuffer.slice(0);

          const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
            let binary = '';
            const bytes = new Uint8Array(buffer);
            const len = bytes.byteLength;
            const chunkSize = 8192;
            for (let i = 0; i < len; i += chunkSize) {
              const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
              binary += String.fromCharCode.apply(null, chunk as any);
            }
            return window.btoa(binary);
          };

          let totalExtractedQuestions = 0;
          const accumulatedQuestionsList: any[] = (quiz.questions || []).filter(
            q => q && typeof q.text === 'string' && q.text.trim().length > 0
          );

          const extractionInstructions = `أنت خبير تربوي ومصحح امتحانات ومعد اختبارات أول ومتخصص في الرياضيات والعلوم والفيزياء والكيمياء واللغات. مهمتك قراءة وتحويل هذا المحتوى إلى بنك أسئلة دقيق وشامل لاختبار تعليمي متكامل، مع حل كل مسألة بدقة رياضية وعلمية تامة 100% واستخراج رسوماتها التوضيحية.

قواعد صارمة وإلزامية لتوليد الأسئلة واستخراج الرموز وحل المسائل:
1. استخراج كامل وشامل لجميع الأسئلة الواردة في الملف بنسبة 100% (إلزامي قطعي):
   - يجب عليك استخراج كل سؤال وتمرين ومسألة واردة في الملف بالكامل من أول سؤال حتى آخر سؤال دون أي استثناء.
   - إذا كان المستند أو الصفحة تحتوي على 10 أو 12 أو 20 مسألة أو سؤالاً، استخرج جميع الـ 10 أو 12 أو 20 سؤالاً بالكامل واحداً تلو الآخر في عناصر منفصلة داخل المصفوفة.
   - ممنوع منعاً باتاً الاكتفاء بنموذج أو عينة من الأسئلة أو التوقف بعد 5 أو 6 أسئلة. يجب ألا تترك أي سؤال موجود في المستند مهما كان نوعه أو طوله.
   - انتبه للصفحات المقسمة إلى أعمدة (Multi-Column Layouts): إذا كانت الصفحة تحتوي على عمودين (يمين ويسار) أو عدة أقسام، يجب قراءة واستخراج الأسئلة من جميع الأعمدة والأقسام بالكامل (العمود الأول ثم العمود الثاني) والتأكد من عدم تفويت أي عمود.
   - استخراج جميع الأسئلة الفرعية (أ، ب، ج، د) أو (1، 2، 3، 4): إذا تضمن السؤال عدة فقرات أو بنود، استخرج كل فقرة كسؤال كامل مستقل.

2. استخراج الأسئلة الحقيقية والرموز والأرقام العشرية بدقة متناهية:
   - استخرج أي نص يبدو كسؤال، تمرين، مسألة رياضية أو هندسية، تدريب، أو جملة تتطلب حلاً أو إكمالاً.
   - الحفاظ التام والصارم على الأرقام العشرية (Decimal Numbers):
     * حافظ على العلامة العشرية والنقاط والفواصل بدقة تامة في نص السؤال، في جميع الخيارات، وفي الإجابة النموذجية (مثل: 0.5، 3.14، 1.5، 2.75، 0.05، 12.5، ٠.٥، ٣.١٤).
     * ممنوع منعاً باتاً حذف النقطة أو الفاصلة العشرية أو تقريب الرقم أو تحويل 0.5 إلى 5 أو تحويل 3.14 إلى 14 أو 314.
     * استخرج الأرقام العشرية كما وردت في الملف بالضبط.
   - الدقة الرياضية الفائقة (Mathematical Fidelity):
     * حافظ على جميع الرموز الرياضية بدقة متناهية سواء باللغة العربية أو الإنجليزية:
       - الأسس والجذور: مثل x², س²، xⁿ، √x، ∛x، ⁿ√x
       - الكسور والنسب: صغ الكسور بوضوح تام مثل \\frac{a}{b} أو \\frac{س}{ص} أو a/b
       - الدوال المثلثية وحساب المثلثات: (جا، جتا، ظا، قا، قتا، ظتا) أو (\\sin, \\cos, \\tan, \\sec, \\csc, \\cot)
       - التفاضل والتكامل والنهايات: (\\lim, \\int, \\sum, \\frac{dy}{dx}, د'(س), د(س))
       - المصفوفات والمتجهات والزوايا والأشكال الهندسية: (∠ABC, △ABC, ⟂, ∥, ≡, ≅, °, π, θ, α, β, Δ, λ)
       - الفترات ومجموعات الحل: مثل [a, b] أو ]a, b[ أو {x ∈ ℝ}
     * استخدم تدوين LaTeX القياسي (محاطاً بـ $...$ للصيغ المضمنة أو $$...$$ للصيغ المستقلة) أو الرموز الرياضية واليونيكود الواضحة.
   - استخرج نص كل سؤال كاملاً ومفهوماً في حقل 'text'.
   - ممنوع ترك نص السؤال 'text' فارغاً أو مبتوراً إطلاقاً.

3. حل الأسئلة غير المجابة بدقة علمية وحسابية قطعية وتحديد الإجابة الصحيحة (إلزامي مطلق):
   - سواء كانت الأسئلة مجابة في الملف أو غير مجابة:
     * يجب عليك حل كل مسألة وسؤال بالكامل كأستاذ متخصص وخبير أول في المادة.
     * لأسئلة الاختيار من متعدد ('type': 'multiple-choice'):
       1. استخرج الخيارات الأربعة كاملة وبوضوح في مصفوفة 'options' مع الحفاظ على الأرقام العشرية والكسور والوحدات.
       2. قم بحل المسألة والسؤال بنفسك خطوة بخطوة موضحاً القوانين والتعويضات الحسابية والناتج النهائي، واكتب ذلك بالتفصيل في حقل 'modelAnswer'.
       3. ضع في حقل 'correctAnswer' نص الخيار الصحيح أو القيمة المطابقة تماماً للخيار الفائز (مثال: "25 m/s" أو "3.14" أو "الأكسجين" أو "ج").
       4. طابق الناتج مع مصفوفة 'options' وضع رقم الخيار الصحيح بدقة في 'correctOptionIndex' (0 للخيار الأول، 1 للثاني، 2 للثالث، 3 للرابع).
       5. إذا كانت الإجابة محددة أصلاً في الملف (دائرة، علامة صح، لون مغاير)، تأكد من اعتمادها ووضع رقمها في 'correctOptionIndex'.
       6. ممنوع منعاً باتاً وضع 0 افتراضياً أو التخمين دون حل المسألة والتأكد من مطابقة الناتج مع الخيارات!
     * للأسئلة المقالية والمسائل الرياضية والفيزيائية والكيميائية ('type': 'essay'):
       - ضع 'type': 'essay' واجعل 'options': [].
       - اكتب في حقل 'modelAnswer' إجابة نموذجية وافية تشمل خطوات الحل بالتفصيل والقوانين والناتج النهائي.
       - اكتب في 'correctAnswer' ملخص الإجابة أو الناتج النهائي.
       - اجعل 'correctOptionIndex': 0.
     * لأسئلة الصواب والخطأ ('type': 'true-false'):
       - ضع 'type': 'true-false'. إذا كان السؤال بالإنجليزية، اجعل 'options': ["True", "False"]. وإذا كان بالعربية، اجعل 'options': ["صح", "خطأ"].
       - حدد 'correctOptionIndex': 0 للعبارة الصحيحة، أو 1 للعبارة الخاطئة، واكتب السبب والتصحيح في 'modelAnswer'، واكتب الخيار الفائز في 'correctAnswer'.

4. استخراج الرسومات والأشكال الهندسية والبيانية الخاصة بالسؤال ('imageBox' أو 'imageTag'):
   - إذا كان المحتوى يحتوي على صور ممثلة بـ [[DOC_IMAGE_1]], [[DOC_IMAGE_2]] إلخ، حدد معرّف الصورة التابع للسؤال بدقة في 'imageTag'.
   - إذا كان السؤال مرتبطاً برسم هندسي، رسم بياني، محاور إحداثية، دائرة كهربائية، شكل هندسي، جدول، أو تجربة في صورة أو صفحة:
     حدد إحداثيات المستطيل المحيط بالرسم/الشكل فقط بدقة في 'imageBox' بنظام إحداثيات من 0 إلى 1000:
     * ymin: الإحداثي الرأسي العلوي (0-1000)
     * xmin: الإحداثي الأفقي الأيسر (0-1000)
     * ymax: الإحداثي الرأسي السفلي (0-1000)
     * xmax: الإحداثي الأفقي الأيمن (0-1000)
   - إذا لم يحتوي السؤال على أي رسم توضيحي، لا ترجع حقل 'imageBox' أو 'imageTag'.

5. الالتزام الصارم بوضع خط تحت الكلمات المحددة (Underlined Words & Phrases) - إلزامي قطعي:
   - إذا كان في السؤال أو التمرين أو المسألة أو الخيارات أي كلمة، عبارة، جملة، أو تركيب لغوي تحته خط في الملف أو المستند الأصلي (مثل: أسئلة النحو والإعراب، أسئلة معاني المفردات والكلمات، أسئلة القواعد في اللغة العربية والإنجليزية واللغات الأخرى، أسئلة تصويب الخطأ، استبدال ما تحته خط، إلخ):
   - يجب عليك إحاطة الكلمات أو العبارات التي تحتها خط بوسم <u>الكلمة</u> بدقة متناهية في نص السؤال 'text' أو في الخيارات 'options'.
   - أمثلة إلزامية:
     * "ما إعراب كلمة <u>المجتهد</u> في الجملة السابقة؟"
     * "صوّب ما تحته خط: كتب الطالب <u>قصةٌ</u> جميلة."
     * "Choose the correct synonym of the underlined word: She was <u>diligent</u> in her research."
     * "The underlined phrasal verb <u>turn down</u> means:"
   - ممنوع منعاً باتاً إغفال الخط أو تفويت أي كلمة موضوع تحتها خط في المستند أو الملف الأصلي!

6. الدقة العلمية واللغوية:
   - ممنوع تماماً ترجمة الأسئلة أو تغيير لغتها. حافظ حرفياً على لغة المستند الأصلية (عربي، إنجليزي، فرنسي..).
   - حافظ على المعادلات والرموز العلمية والصيغ الكيميائية والفيزيائية (مثل H₂O, Na⁺, α, β, Δ) واستخدم LaTeX أو صيغ واضحة.

7. صيغة الإخراج JSON فقط كقائمة من الكائنات:
- 'text': نص السؤال الكامل بما في ذلك الرموز والمعادلات والأرقام العشرية ووسوم الكلمات التي تحتها خط <u>...</u>
- 'type': 'multiple-choice' أو 'true-false' أو 'essay'
- 'options': مصفوفة نصوص الخيارات (4 خيارات لـ multiple-choice، أو ["True", "False"] للإنجليزي و ["صح", "خطأ"] للعربي لـ true-false، أو [] لـ essay)
- 'correctAnswer': نص الخيار الصحيح أو القيمة المطابقة تماماً للخيار الصحيح
- 'correctOptionIndex': رقم صحيح (0-3) لأسئلة الاختيار وصح/خطأ يطابق خيار correctAnswer
- 'modelAnswer': الإجابة النموذجية الشاملة مع خطوات الحل والقوانين الرياضية والعلمية
- 'imageTag': (اختياري لملفات الوورد) معرّف الصورة التابعة للسؤال مثل [[DOC_IMAGE_1]]
- 'imageBox': (اختياري للصور والـ PDF) كائن يحتوي على { ymin, xmin, ymax, xmax } للرسم التوضيحي`;

          // Direct AI binary file extraction helper
          const performDirectAiExtraction = async (bufferData: ArrayBuffer, mime: string) => {
            setGenerationProgress('جاري استخراج الأسئلة بدقة عبر الذكاء الاصطناعي...');
            const base64Data = arrayBufferToBase64(bufferData);
            
            const parts: any[] = [];
            parts.push({ inlineData: { mimeType: mime, data: base64Data } });
            parts.push({ text: extractionInstructions });

            const activeExtractionModel = quiz.ai_model === 'pro' ? 'gemini-3.1-pro-preview' : quiz.ai_model === 'flash' ? 'gemini-3.8-flash' : (isTeacherPro ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash');
            const response = await generateContentWithModelSelection(null, {
              contents: { parts },
              operation: 'extract_questions',
              modelOverride: activeExtractionModel,
              planId: user?.subscription_type,
              subjectName: user?.subject || profileData.subject,
              config: {
                responseMimeType: "application/json",
                maxOutputTokens: 8192,
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      type: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      correctAnswer: { type: Type.STRING },
                      correctOptionIndex: { type: Type.INTEGER },
                      modelAnswer: { type: Type.STRING },
                      imageBox: {
                        type: Type.OBJECT,
                        properties: {
                          ymin: { type: Type.NUMBER },
                          xmin: { type: Type.NUMBER },
                          ymax: { type: Type.NUMBER },
                          xmax: { type: Type.NUMBER }
                        }
                      }
                    },
                    required: ["text", "type", "options", "correctAnswer", "correctOptionIndex", "modelAnswer"]
                  }
                }
              }
            });
            
            // Tokens are now tracked securely on the server
            const parsedQuestions = parseAiQuestionsJson(response.text || '[]');
            return cleanAndValidateExtractedQuestions(
              parsedQuestions,
              quiz.defaultPoints || 1,
              accumulatedQuestionsList
            );
          };

          // Text prompt AI extraction helper with docx images map support
          const performTextAiExtraction = async (textData: string, imagesMap: Record<string, string> = {}) => {
            setGenerationProgress('جاري معالجة نصوص المستند واستخراج كافة الأسئلة...');
            const parts: any[] = [];
            parts.push({ text: `المحتوى المستخرج من المستند بالكامل:\n${textData}` });
            parts.push({ text: extractionInstructions });

            const activeExtractionModel = quiz.ai_model === 'pro' ? 'gemini-3.1-pro-preview' : quiz.ai_model === 'flash' ? 'gemini-3.8-flash' : (isTeacherPro ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash');
            const response = await generateContentWithModelSelection(null, {
              contents: { parts },
              operation: 'extract_questions',
              modelOverride: activeExtractionModel,
              planId: user?.subscription_type,
              subjectName: user?.subject || profileData.subject,
              config: {
                responseMimeType: "application/json",
                maxOutputTokens: 8192,
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      type: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      correctAnswer: { type: Type.STRING },
                      correctOptionIndex: { type: Type.INTEGER },
                      modelAnswer: { type: Type.STRING },
                      imageTag: { type: Type.STRING }
                    },
                    required: ["text", "type", "options", "correctAnswer", "correctOptionIndex", "modelAnswer"]
                  }
                }
              }
            });

            // Tokens are now tracked securely on the server
            const rawParsed = parseAiQuestionsJson(response.text || '[]');
            const questionsWithImages = (rawParsed || []).map((q: any) => {
              let attachedImage = q.image;
              if (!attachedImage && q.imageTag && imagesMap[q.imageTag]) {
                attachedImage = imagesMap[q.imageTag];
              }
              if (!attachedImage && typeof q.text === 'string') {
                const tagMatch = q.text.match(/\[\[DOC_IMAGE_\d+\]\]/);
                if (tagMatch && imagesMap[tagMatch[0]]) {
                  attachedImage = imagesMap[tagMatch[0]];
                }
              }
              return { ...q, image: attachedImage };
            });

            return cleanAndValidateExtractedQuestions(
              questionsWithImages,
              quiz.defaultPoints || 1,
              accumulatedQuestionsList
            );
          };

          // 1. Handle Word (.docx) documents with text & image extraction
          if (isDocx) {
            setGenerationProgress('جاري قراءة ملف الوورد واستخراج نصوص ورسومات الأسئلة...');
            let structuredText = '';
            const docxImagesMap: Record<string, string> = {};
            let imageCounter = 0;

            try {
              const mammothOptions = {
                styleMap: [
                  "u => u",
                  "strike => s"
                ],
                convertImage: mammoth.images.imgElement((image: any) => {
                  imageCounter++;
                  const tag = `[[DOC_IMAGE_${imageCounter}]]`;
                  return image.read('base64').then((b64: string) => {
                    const mime = image.contentType || 'image/jpeg';
                    docxImagesMap[tag] = `data:${mime};base64,${b64}`;
                    return {
                      src: tag,
                      alt: tag
                    };
                  });
                })
              };

              const htmlResult = await mammoth.convertToHtml({ arrayBuffer }, mammothOptions);
              let htmlValue = htmlResult?.value || '';
              if (htmlValue) {
                // Replace img tags with visible markers for AI
                htmlValue = htmlValue.replace(/<img[^>]*src="(\[\[DOC_IMAGE_\d+\]\])"[^>]*>/gi, '\n[صورة توضيحية للسؤال: $1]\n');
                htmlValue = htmlValue.replace(/<\/p>/gi, '\n').replace(/<\/h[1-6]>/gi, '\n').replace(/<br\s*\/?>/gi, '\n');
                // Normalize <ins> to <u>
                htmlValue = htmlValue.replace(/<\/?ins>/gi, (m) => m.toLowerCase().includes('/') ? '</u>' : '<u>');
                // Strip all tags EXCEPT u, b, i, strong, em
                htmlValue = htmlValue.replace(/<(?!(\/?(u|b|i|strong|em)\b))[^>]+>/gi, ' ');
                htmlValue = htmlValue.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
                structuredText = htmlValue;
              }
            } catch (mammothErr) {
              console.warn("Mammoth convertToHtml failed, trying raw text:", mammothErr);
            }

            if (!structuredText || structuredText.trim().length < 15) {
              try {
                const rawRes = await mammoth.extractRawText({ arrayBuffer });
                structuredText = rawRes?.value || '';
              } catch (rawErr) {
                console.warn("Mammoth extractRawText failed:", rawErr);
              }
            }

            if (structuredText && structuredText.trim().length > 15) {
              console.log("Mammoth extracted text length:", structuredText.length, "images extracted:", Object.keys(docxImagesMap).length);
              const formattedQuestions = await performTextAiExtraction(structuredText, docxImagesMap);
              if (formattedQuestions.length > 0) {
                totalExtractedQuestions += formattedQuestions.length;
                setQuiz(prev => {
                  const isInitialEmpty = prev.questions.length === 1 && (!prev.questions[0].text || prev.questions[0].text.trim() === '');
                  const baseQuestions = isInitialEmpty ? [] : prev.questions;
                  return { ...prev, questions: [...baseQuestions, ...formattedQuestions] };
                });
              }
            } else {
              // Fallback to direct AI binary extraction if mammoth returned empty string
              const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
              const formattedQuestions = await performDirectAiExtraction(arrayBuffer, mime);
              if (formattedQuestions.length > 0) {
                totalExtractedQuestions += formattedQuestions.length;
                setQuiz(prev => {
                  const isInitialEmpty = prev.questions.length === 1 && (!prev.questions[0].text || prev.questions[0].text.trim() === '');
                  const baseQuestions = isInitialEmpty ? [] : prev.questions;
                  return { ...prev, questions: [...baseQuestions, ...formattedQuestions] };
                });
              }
            }
          } 
          // 2. Handle Text / CSV / JSON files
          else if (isTextOrCsv) {
            setGenerationProgress('جاري قراءة الملف النصي...');
            let textData = '';
            try {
              textData = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
              if (textData.includes('\uFFFD')) {
                try {
                  textData = new TextDecoder('windows-1256').decode(arrayBuffer);
                } catch (e) {}
              }
            } catch (decErr) {
              console.warn("TextDecoder failed:", decErr);
            }

            if (textData && textData.trim().length > 10) {
              const formattedQuestions = await performTextAiExtraction(textData);
              if (formattedQuestions.length > 0) {
                totalExtractedQuestions += formattedQuestions.length;
                setQuiz(prev => {
                  const isInitialEmpty = prev.questions.length === 1 && (!prev.questions[0].text || prev.questions[0].text.trim() === '');
                  const baseQuestions = isInitialEmpty ? [] : prev.questions;
                  return { ...prev, questions: [...baseQuestions, ...formattedQuestions] };
                });
              }
            }
          }
          // 3. Handle Image files (.jpg, .png, .webp, .heic)
          else if (isImage) {
            setGenerationProgress('جاري قراءة وتحليل صورة الأسئلة مع استخراج الرسومات...');
            let optimizedBase64 = '';
            let imageCanvas: HTMLCanvasElement | null = null;
            let fullImageDataUrl = '';

            try {
              const rawBase64 = arrayBufferToBase64(arrayBuffer);
              const srcMime = file.type || 'image/jpeg';
              const fullUrl = `data:${srcMime};base64,${rawBase64}`;
              fullImageDataUrl = fullUrl;

              const img = new window.Image();
              await new Promise((res, rej) => {
                img.onload = () => res(null);
                img.onerror = () => rej(new Error('تعذر تحميل أبعاد الصورة'));
                img.src = fullUrl;
              });

              const origW = img.naturalWidth || img.width || 800;
              const origH = img.naturalHeight || img.height || 600;
              const maxDim = 2048;
              let targetW = origW;
              let targetH = origH;
              if (origW > maxDim || origH > maxDim) {
                if (origW > origH) {
                  targetW = maxDim;
                  targetH = Math.max(100, Math.round((origH * maxDim) / origW));
                } else {
                  targetH = maxDim;
                  targetW = Math.max(100, Math.round((origW * maxDim) / origH));
                }
              }

              imageCanvas = document.createElement('canvas');
              imageCanvas.width = targetW;
              imageCanvas.height = targetH;
              const ctx = imageCanvas.getContext('2d');
              if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, targetW, targetH);
                ctx.drawImage(img, 0, 0, targetW, targetH);
                const dataUrl = imageCanvas.toDataURL('image/jpeg', 0.90);
                optimizedBase64 = dataUrl.split(',')[1];
              }
            } catch (cvErr) {
              console.warn("Canvas prep failed for image, falling back to direct base64:", cvErr);
              optimizedBase64 = arrayBufferToBase64(arrayBuffer);
            }

            const activeExtractionModel = quiz.ai_model === 'pro' ? 'gemini-3.1-pro-preview' : quiz.ai_model === 'flash' ? 'gemini-3.8-flash' : (isTeacherPro ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash');
            const response = await generateContentWithModelSelection(null, {
              operation: 'extract_questions',
              modelOverride: activeExtractionModel,
              planId: user?.subscription_type,
              subjectName: user?.subject || profileData.subject,
              contents: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: optimizedBase64
                    }
                  },
                  {
                    text: extractionInstructions
                  }
                ]
              },
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      type: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      correctOptionIndex: { type: Type.INTEGER },
                      modelAnswer: { type: Type.STRING },
                      imageBox: {
                        type: Type.OBJECT,
                        properties: {
                          ymin: { type: Type.NUMBER },
                          xmin: { type: Type.NUMBER },
                          ymax: { type: Type.NUMBER },
                          xmax: { type: Type.NUMBER }
                        }
                      }
                    },
                    required: ["text", "type", "options"]
                  }
                }
              }
            });

            const parsedQuestions = parseAiQuestionsJson(response.text || '[]');
            if (Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
              const questionsWithCroppedImages = parsedQuestions.map((q: any) => {
                let croppedImage: string | undefined = undefined;
                if (q.imageBox && imageCanvas) {
                  croppedImage = cropImageBoxFromCanvas(imageCanvas, q.imageBox);
                }
                // If there is only 1 question and no sub-box but canvas exists
                if (!croppedImage && parsedQuestions.length === 1 && fullImageDataUrl) {
                  croppedImage = fullImageDataUrl;
                }
                return { ...q, image: croppedImage };
              });

              const formattedQuestions = cleanAndValidateExtractedQuestions(
                questionsWithCroppedImages,
                quiz.defaultPoints || 1,
                quiz.questions
              );

              if (formattedQuestions.length > 0) {
                totalExtractedQuestions += formattedQuestions.length;
                setQuiz(prev => {
                  const isInitialEmpty = prev.questions.length === 1 && (!prev.questions[0].text || prev.questions[0].text.trim() === '');
                  const baseQuestions = isInitialEmpty ? [] : prev.questions;
                  return { ...prev, questions: [...baseQuestions, ...formattedQuestions] };
                });
              }
            }
          }
          // 4. Handle PDF files (.pdf)
          else if (isPdf) {
            let pdfLoaded = false;
            let pdf: any = null;
            try {
              setGenerationProgress('جاري فحص عدد صفحات ملف PDF...');
              const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
              pdf = await loadingTask.promise;
              pdfLoaded = true;
              console.log("PDF loaded successfully, page count:", pdf.numPages);
            } catch (pdfErr) {
              console.warn("PDF.js load error, will fallback to direct native PDF AI extraction:", pdfErr);
            }

            if (pdfLoaded && pdf && pdf.numPages > 0) {
              setIsGenerating(false);
              setGenerationProgress('');
              setPendingPdfData({
                file,
                arrayBuffer: pristineBuffer,
                totalPages: pdf.numPages,
                fileName: file.name
              });
              setShowPdfPageModal(true);
              return;
            }

            // Fallback second-pass: Native direct PDF AI extraction if pdfjs failed to load
            if (totalExtractedQuestions === 0) {
              console.log("PDF page-by-page inspection unavailable, attempting native direct PDF AI extraction...");
              try {
                const fallbackQuestions = await performDirectAiExtraction(pristineBuffer, 'application/pdf');
                if (fallbackQuestions.length > 0) {
                  totalExtractedQuestions += fallbackQuestions.length;
                  setQuiz(prev => {
                    const isInitialEmpty = prev.questions.length === 1 && (!prev.questions[0].text || prev.questions[0].text.trim() === '');
                    const baseQuestions = isInitialEmpty ? [] : prev.questions;
                    return { ...prev, questions: [...baseQuestions, ...fallbackQuestions] };
                  });
                }
              } catch (fbErr: any) {
                const fbMsg = fbErr?.message || String(fbErr || '');
                if (fbMsg.includes('GEMINI_API_KEY') || fbMsg.includes('غير صالح') || fbMsg.includes('API key')) {
                  setApiStatus({ hasKey: false, prefix: '' });
                }
                console.error("Direct native PDF extraction failed:", fbErr);
                throw fbErr;
              }
            }
          } 
          // 5. Generic fallback for any other file type (.doc, .xls, etc.)
          else {
            let processedMime = file.type;
            if (!processedMime || processedMime === 'application/octet-stream') {
              if (isDoc) processedMime = 'application/msword';
              else processedMime = 'text/plain';
            }
            const formattedQuestions = await performDirectAiExtraction(arrayBuffer, processedMime);
            if (formattedQuestions.length > 0) {
              totalExtractedQuestions += formattedQuestions.length;
              setQuiz(prev => {
                const isInitialEmpty = prev.questions.length === 1 && (!prev.questions[0].text || prev.questions[0].text.trim() === '');
                const baseQuestions = isInitialEmpty ? [] : prev.questions;
                return { ...prev, questions: [...baseQuestions, ...formattedQuestions] };
              });
            }
          }

          if (totalExtractedQuestions > 0) {
            setGenerationProgress(`تم بنجاح! تم استخراج ${totalExtractedQuestions} سؤال مع إجاباتها.`);
            setTimeout(() => setGenerationProgress(''), 5000);
          } else {
            alert("لم يتم العثور على أسئلة واضحة في هذا الملف. يرجى التأكد من أن الملف يحتوي على أسئلة ومصاغ بشكل واضح.");
            setGenerationProgress('');
          }
        } catch (err: any) {
          const errMsg = (err?.message || '').toLowerCase();
          const is429 = err?.status === 429 || errMsg.includes('quota') || errMsg.includes('resource_exhausted');
          const isInvalidKey = errMsg.includes('gemini_api_key') || errMsg.includes('غير صالح') || errMsg.includes('api key') || err?.status === 400;

          if (isInvalidKey) {
            // Quiet API key notice
          } else if (is429) {
            // Quiet quota notice
          } else {
            console.error("Document AI processing error:", err);
          }

          if (is429) {
            alert('نفد رصيد مفتاح الذكاء الاصطناعي (Quota Exceeded). يرجى المحاولة لاحقاً أو الترقية.');
          } else if (isInvalidKey) {
            alert('مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير صالح أو منتهي الصلاحية. يرجى إضافة مفتاح صحيح في إعدادات التطبيق (Settings -> Secrets).');
          } else {
            alert(`حدث خطأ أثناء قراءة المستند: ${err.message || 'خطأ غير معروف'}`);
          }
          setGenerationProgress('');
        } finally {
          setIsGenerating(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (e: any) {
      console.error(e);
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!checkTokenLimitBeforeAi(user)) return;
    if (!user?.hasAccess) {
      alert(`عذراً، لا يمكنك استخدام الذكاء الاصطناعي. يرجى الاشتراك أو تجديد اشتراكك للمتابعة.\n(الحساب: ${user?.email || user?.phone || 'غير معروف'})`);
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so selecting the same image triggers onChange
    e.target.value = '';

    const isImageFile = (file.type && file.type.toLowerCase().startsWith('image/')) || 
                        /\.(jpe?g|png|webp|heic|heif|bmp|gif|tiff?)$/i.test(file.name);

    if (!isImageFile) {
      alert('الرجاء اختيار ملف صورة فقط (JPG, PNG, WebP, HEIC, إلخ)');
      return;
    }

    // Limit file size to 25MB
    if (file.size > 25 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 25 ميجابايت.');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress('جاري قراءة ومعالجة الصورة...');
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const result = event.target?.result as string;
          if (!result || !result.includes(',')) {
            throw new Error('فشل في قراءة بيانات الصورة');
          }

          setGenerationProgress('جاري تحسين الصورة واستخراج النصوص والرسومات...');
          
          let optimizedBase64 = '';
          let optimizedMime = 'image/jpeg';
          let imageCanvas: HTMLCanvasElement | null = null;

          try {
            const img = new window.Image();
            await new Promise((res, rej) => {
              img.onload = () => res(null);
              img.onerror = () => rej(new Error('تعذر تحميل أبعاد الصورة'));
              img.src = result;
            });

            // Calculate optimal dimensions (max 2048px on longest edge to preserve crisp equations/diagrams)
            const origW = img.naturalWidth || img.width || 800;
            const origH = img.naturalHeight || img.height || 600;
            const maxDim = 2048;
            let targetW = origW;
            let targetH = origH;
            if (origW > maxDim || origH > maxDim) {
              if (origW > origH) {
                targetW = maxDim;
                targetH = Math.max(100, Math.round((origH * maxDim) / origW));
              } else {
                targetH = maxDim;
                targetW = Math.max(100, Math.round((origW * maxDim) / origH));
              }
            }

            imageCanvas = document.createElement('canvas');
            imageCanvas.width = targetW;
            imageCanvas.height = targetH;
            const ctx = imageCanvas.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, targetW, targetH);
              ctx.drawImage(img, 0, 0, targetW, targetH);
              const dataUrl = imageCanvas.toDataURL('image/jpeg', 0.90);
              optimizedBase64 = dataUrl.split(',')[1];
              optimizedMime = 'image/jpeg';
            }
          } catch (canvasErr) {
            console.warn("Canvas image optimization warning, falling back to raw data:", canvasErr);
            optimizedBase64 = result.split(',')[1];
            optimizedMime = (file.type && file.type.startsWith('image/')) ? file.type : 'image/jpeg';
          }

          if (!optimizedBase64) {
            optimizedBase64 = result.split(',')[1];
            optimizedMime = (file.type && file.type.startsWith('image/')) ? file.type : 'image/jpeg';
          }

          setGenerationProgress('جاري استخراج الأسئلة بدقة عبر الذكاء الاصطناعي...');

          const imageExtractionPrompt = `أنت خبير تربوي ومصحح امتحانات ومعد اختبارات أول ومتخصص في الرياضيات والعلوم والفيزياء والكيمياء واللغات. قم بقراءة واستخراج جميع الأسئلة والتدريبات والمسائل الموجودة في هذه الصورة مع رسوماتها التوضيحية بدقة فائقة 100%، وحل كل مسألة بدقة رياضية وعلمية تامة.

قواعد صارمة وإلزامية لتوليد الأسئلة واستخراج الرموز وحل المسائل:
1. استخراج كامل وشامل لجميع الأسئلة الواردة في الصورة بنسبة 100% (إلزامي قطعي):
   - يجب عليك استخراج كل سؤال وتمرين ومسألة واردة في الصورة بالكامل من أول سؤال حتى آخر سؤال دون أي استثناء.
   - إذا كانت الصورة تحتوي على 10 أو 12 أو 20 مسألة أو سؤالاً، استخرج جميع الـ 10 أو 12 أو 20 سؤالاً بالكامل واحداً تلو الآخر في عناصر منفصلة داخل المصفوفة.
   - ممنوع منعاً باتاً الاكتفاء بنموذج أو عينة من الأسئلة أو التوقف بعد 5 أو 6 أسئلة. يجب ألا تترك أي سؤال موجود في الصورة مهما كان نوعه أو طوله.
   - انتبه للصور المقسمة إلى أعمدة (Multi-Column Layouts): إذا كانت الصورة تحتوي على عمودين (يمين ويسار) أو عدة أقسام، يجب قراءة واستخراج الأسئلة من جميع الأعمدة والأقسام بالكامل (العمود الأول ثم العمود الثاني) والتأكد من عدم تفويت أي عمود.
   - استخراج جميع الأسئلة الفرعية (أ، ب، ج، د) أو (1، 2، 3، 4): إذا تضمن السؤال عدة فقرات أو بنود، استخرج كل فقرة كسؤال كامل مستقل.

2. استخراج الأسئلة الحقيقية والرموز والأرقام العشرية بدقة متناهية:
   - استخرج أي نص يبدو كسؤال، تمرين، مسألة رياضية أو هندسية، تدريب، أو جملة تتطلب حلاً أو إكمالاً.
   - الحفاظ التام والصارم على الأرقام العشرية (Decimal Numbers):
     * حافظ على العلامة العشرية والنقاط والفواصل بدقة تامة في نص السؤال، في جميع الخيارات، وفي الإجابة النموذجية (مثل: 0.5، 3.14، 1.5، 2.75، 0.05، 12.5، ٠.٥، ٣.١٤).
     * ممنوع منعاً باتاً حذف النقطة أو الفاصلة العشرية أو تقريب الرقم أو تحويل 0.5 إلى 5 أو تحويل 3.14 إلى 14 أو 314.
     * استخرج الأرقام العشرية كما وردت في الصورة بالضبط.
   - الدقة الرياضية الفائقة (Mathematical Fidelity):
     * حافظ على جميع الرموز الرياضية بدقة متناهية سواء باللغة العربية أو الإنجليزية (الأسس x²، الجذور √x، الكسور \\frac{a}{b}، الدوال المثلثية جا/جتا/ظا/sin/cos/tan، التكاملات \\int، النهايات \\lim، الزوايا ∠، الأشكال △، الرموز π، θ، α، β، Δ) باستخدام LaTeX القياسي أو الرموز الرياضية الواضحة.
   - استخرج نص كل سؤال كاملاً ومفهوماً في حقل 'text'.

3. حل الأسئلة غير المجابة وتحديد الإجابات الصحيحة بدقة قطعية (إلزامي مطلق):
   - سواء كانت الأسئلة مجابة أو غير مجابة:
     * يجب عليك حل كل مسألة وسؤال كأستاذ متخصص في المادة بدقة 100%.
     * لأسئلة الاختيار من متعدد ('type': 'multiple-choice'):
       1. استخرج الخيارات الـ 4 كاملة في 'options' مع الحفاظ على الأرقام العشرية والكسور.
       2. قم بحل المسألة خطوة بخطوة موضحاً القوانين والتعويضات الحسابية والناتج النهائي، واكتب ذلك في 'modelAnswer'.
       3. اكتب في 'correctAnswer' نص الخيار الصحيح أو القيمة المطابقة تماماً للخيار الفائز (مثال: "25 m/s" أو "3.14" أو "ج").
       4. طابق الناتج مع مصفوفة 'options' وضع رقم الخيار الصحيح بدقة في 'correctOptionIndex' (0-3).
       5. إذا كانت الإجابة محددة أصلاً في الصورة (علامة صح، تظليل، أو دائرة)، اعتمدها وضع رقمها في 'correctOptionIndex'.
     * للأسئلة المقالية والمسائل الرياضية ('type': 'essay'): اجعل 'options': [] واكتب في 'modelAnswer' خطوات الحل والقوانين والناتج النهائي بدقة، واكتب ملخص الإجابة في 'correctAnswer' و 'correctOptionIndex': 0.
     * لأسئلة الصواب والخطأ ('type': 'true-false'): ضع 'options': ["True", "False"] للإنجليزي أو ["صح", "خطأ"] للعربي، وحدد 'correctOptionIndex' (0 أو 1) مع التبرير في 'modelAnswer' وكتابة الإجابة في 'correctAnswer'.

4. استخراج الرسومات والأشكال الهندسية والبيانية ('imageBox'):
   - إذا كان السؤال يحتوي على رسم توضيحي، رسم بياني، دائرة كهربائية، شكل هندسي، حدد إحداثياته {ymin, xmin, ymax, xmax} من 0 إلى 1000.

5. الالتزام الصارم بوضع خط تحت الكلمات المحددة (Underlined Words & Phrases) - إلزامي قطعي:
   - إذا كان في السؤال أو الخيارات أي كلمة، عبارة، أو تركيب لغوي موضوع تحته خط في الصورة (مثل: أسئلة النحو والإعراب، معاني المفردات، قواعد اللغات، تصويب الخطأ، استبدال ما تحته خط، إلخ):
   - يجب عليك إحاطة الكلمات أو العبارات التي تحتها خط بوسم <u>الكلمة</u> بدقة متناهية في نص السؤال 'text' أو في الخيارات 'options' (مثال: "ما إعراب كلمة <u>المتفوق</u> في الجملة؟" أو "Choose the correct meaning of <u>diligent</u>").
   - ممنوع منعاً باتاً إغفال الخط أو تفويت أي كلمة موضوع تحتها خط في الصورة الأصلية!

6. صيغة الإخراج JSON فقط كقائمة من الكائنات:
- 'text': نص السؤال الكامل متضمناً وسوم <u>...</u> للكلمات التي تحتها خط
- 'type': 'multiple-choice' أو 'true-false' أو 'essay'
- 'options': مصفوفة نصوص الخيارات
- 'correctAnswer': نص الخيار الصحيح
- 'correctOptionIndex': رقم صحيح (0-3) يطابق correctAnswer
- 'modelAnswer': الإجابة النموذجية الكاملة مع خطوات الحل
- 'imageBox': كائن اختياري { ymin, xmin, ymax, xmax }`;

          const activeExtractionModel = quiz.ai_model === 'pro' ? 'gemini-3.1-pro-preview' : quiz.ai_model === 'flash' ? 'gemini-3.8-flash' : (isTeacherPro ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash');
          const response = await generateContentWithModelSelection(null, {
            operation: 'extract_questions',
            modelOverride: activeExtractionModel,
            planId: user?.subscription_type,
            subjectName: user?.subject || profileData.subject,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: optimizedMime,
                    data: optimizedBase64
                  }
                },
                {
                  text: imageExtractionPrompt
                }
              ]
            },
            config: {
              responseMimeType: "application/json",
              maxOutputTokens: 8192,
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    type: { type: Type.STRING },
                    options: { 
                      type: Type.ARRAY, 
                      items: { type: Type.STRING } 
                    },
                    correctAnswer: { type: Type.STRING },
                    correctOptionIndex: { type: Type.INTEGER },
                    modelAnswer: { type: Type.STRING },
                    imageBox: {
                      type: Type.OBJECT,
                      properties: {
                        ymin: { type: Type.NUMBER },
                        xmin: { type: Type.NUMBER },
                        ymax: { type: Type.NUMBER },
                        xmax: { type: Type.NUMBER }
                      }
                    }
                  },
                  required: ["text", "type", "options", "correctAnswer", "correctOptionIndex", "modelAnswer"]
                }
              }
            }
          });
          
          // Tokens are now tracked securely on the server
          const generatedQuestions = parseAiQuestionsJson(response.text || '[]');

          if (Array.isArray(generatedQuestions) && generatedQuestions.length > 0) {
            const questionsWithImages = generatedQuestions.map((q: any) => {
              let croppedImage = undefined;
              if (q.imageBox && imageCanvas) {
                try {
                  const { width, height } = imageCanvas;
                  const padX = Math.round(width * 0.015);
                  const padY = Math.round(height * 0.015);
                  const xMin = Math.max(0, (q.imageBox.xmin / 1000) * width - padX);
                  const yMin = Math.max(0, (q.imageBox.ymin / 1000) * height - padY);
                  const xMax = Math.min(width, (q.imageBox.xmax / 1000) * width + padX);
                  const yMax = Math.min(height, (q.imageBox.ymax / 1000) * height + padY);
                  const w = xMax - xMin;
                  const h = yMax - yMin;
                  
                  if (w > 25 && h > 25) {
                    const cropCanvas = document.createElement('canvas');
                    cropCanvas.width = w;
                    cropCanvas.height = h;
                    const cropCtx = cropCanvas.getContext('2d');
                    if (cropCtx) {
                      cropCtx.fillStyle = '#ffffff';
                      cropCtx.fillRect(0, 0, w, h);
                      cropCtx.drawImage(imageCanvas, xMin, yMin, w, h, 0, 0, w, h);
                      croppedImage = cropCanvas.toDataURL('image/jpeg', 0.88);
                    }
                  }
                } catch (cropErr) {
                  console.error("Failed to crop image from image upload:", cropErr);
                }
              }
              return { ...q, image: croppedImage };
            });

            const formattedQuestions = cleanAndValidateExtractedQuestions(
              questionsWithImages,
              quiz.defaultPoints || 1,
              quiz.questions
            );

            if (formattedQuestions.length > 0) {
              setQuiz(prev => {
                const isInitialEmpty = prev.questions.length === 1 && (!prev.questions[0].text || prev.questions[0].text.trim() === '');
                const baseQuestions = isInitialEmpty ? [] : prev.questions;
                return {
                  ...prev,
                  questions: [...baseQuestions, ...formattedQuestions]
                };
              });
              setGenerationProgress(`تم استخراج ${formattedQuestions.length} سؤال بنجاح!`);
              setTimeout(() => setGenerationProgress(''), 5000);
            } else {
              alert('لم يتم العثور على أي أسئلة صالحة في هذه الصورة. يرجى التأكد من وضوح الصورة.');
              setGenerationProgress('');
            }
          } else {
            alert('لم يتم العثور على أي أسئلة صالحة في هذه الصورة. يرجى التأكد من وضوح الصورة.');
            setGenerationProgress('');
          }
        } catch (error: any) {
          let errorMsg = "حدث خطأ أثناء معالجة البيانات.";
          const is429 = error?.status === 429 || error.message?.includes('quota') || error.message?.includes('429');
          const errMsg = (error?.message || '').toLowerCase();
          const isInvalidKey = errMsg.includes('gemini_api_key') || errMsg.includes('غير صالح') || errMsg.includes('api key') || error?.status === 400 || error.message?.includes('401') || error.message?.includes('Unauthorized') || error.message?.includes('API_KEY_INVALID');
          if (isInvalidKey) {
            errorMsg = "مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير صالح أو منتهي الصلاحية. يرجى إضافة مفتاح صحيح في إعدادات التطبيق (Settings -> Secrets).";
          } else if (is429) {
            errorMsg = "تم تجاوز حصة الاستخدام المسموح بها. يرجى المحاولة لاحقاً.";
          } else {
            console.error("AI Generation Error:", error);
          }
          if (!isInvalidKey && !is429) {
             errorMsg += "\nالتفاصيل: " + (error.message || 'غير معروف');
          }
          alert(errorMsg);
          setGenerationProgress('');
        } finally {
          setIsGenerating(false);
        }
      };
      reader.onerror = () => {
        alert('حدث خطأ أثناء قراءة الملف.');
        setIsGenerating(false);
        setGenerationProgress('');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("File Reader Error:", error);
      alert('حدث خطأ غير متوقع.');
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  const updateQuestionText = (id: string, text: string) => {
    setQuiz({
      ...quiz,
      questions: quiz.questions.map((q) => (q.id === id ? { ...q, text } : q)),
    });
  };

  const updateQuestionImage = (id: string, image: string) => {
    setQuiz({
      ...quiz,
      questions: quiz.questions.map((q) => (q.id === id ? { ...q, image } : q)),
    });
  };

  const updateQuestionAudio = (id: string, audio: string) => {
    setQuiz({
      ...quiz,
      questions: quiz.questions.map((q) => (q.id === id ? { ...q, audio } : q)),
    });
  };

  const updateQuestionPoints = (id: string, points: number) => {
    setQuiz({
      ...quiz,
      questions: quiz.questions.map((q) => (q.id === id ? { ...q, points } : q)),
    });
  };

  const updateQuestionModelAnswer = (id: string, modelAnswer: string) => {
    setQuiz({
      ...quiz,
      questions: quiz.questions.map((q) => (q.id === id ? { ...q, modelAnswer } : q)),
    });
  };



  const addOption = (questionId: string) => {
    setQuiz({
      ...quiz,
      questions: quiz.questions.map((q) =>
        q.id === questionId ? { ...q, options: [...q.options, ''] } : q
      ),
    });
  };

  const updateOptionText = (questionId: string, optionIndex: number, text: string) => {
    setQuiz({
      ...quiz,
      questions: quiz.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.map((opt, idx) => (idx === optionIndex ? text : opt)),
            }
          : q
      ),
    });
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    setQuiz({
      ...quiz,
      questions: quiz.questions.map((q) => {
        if (q.id === questionId) {
          const newOptions = q.options.filter((_, idx) => idx !== optionIndex);
          let newCorrectIndex = q.correctOptionIndex;
          if (newCorrectIndex === optionIndex) {
            newCorrectIndex = 0;
          } else if (newCorrectIndex > optionIndex) {
            newCorrectIndex -= 1;
          }
          return { ...q, options: newOptions, correctOptionIndex: newCorrectIndex };
        }
        return q;
      }),
    });
  };

  const setCorrectOption = (questionId: string, optionIndex: number) => {
    setQuiz({
      ...quiz,
      questions: quiz.questions.map((q) =>
        q.id === questionId ? { ...q, correctOptionIndex: optionIndex } : q
      ),
    });
  };

  const removeQuestion = (id: string) => {
    const index = quiz.questions.findIndex((q) => q.id === id);
    if (index === -1) return;
    const questionToDelete = quiz.questions[index];

    setRecentlyDeletedQuestion({ question: questionToDelete, index });
    if (deleteToastTimer) clearTimeout(deleteToastTimer);
    const timer = setTimeout(() => {
      setRecentlyDeletedQuestion(null);
    }, 7000);
    setDeleteToastTimer(timer);

    setQuiz(prev => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== id),
    }));
  };

  const undoDeleteQuestion = () => {
    if (!recentlyDeletedQuestion) return;
    if (deleteToastTimer) clearTimeout(deleteToastTimer);
    setQuiz(prev => {
      const newQuestions = [...prev.questions];
      const targetIndex = Math.min(recentlyDeletedQuestion.index, newQuestions.length);
      newQuestions.splice(targetIndex, 0, recentlyDeletedQuestion.question);
      return { ...prev, questions: newQuestions };
    });
    setRecentlyDeletedQuestion(null);
  };

  const copyQuestion = (id: string) => {
    const questionToCopy = quiz.questions.find((q) => q.id === id);
    if (!questionToCopy) return;
    const newQuestion = { ...questionToCopy, id: generateId() };
    setQuiz({
      ...quiz,
      questions: [...quiz.questions, newQuestion],
    });
    setSaveSuccessToast('تم تكرار السؤال داخل هذا الاختبار بنجاح!');
    setTimeout(() => setSaveSuccessToast(null), 3000);
  };

  const copyOrMoveQuestion = async (questionId: string, targetQuizId: string, action: 'copy' | 'move') => {
    const questionToTransfer = quiz.questions.find((q) => q.id === questionId);
    if (!questionToTransfer) return;

    const targetQuizItem = quizzes.find((q) => q.id === targetQuizId);
    const targetTitle = targetQuizItem?.title || 'الاختبار المختار';

    try {
      // 1. Fetch current target quiz document
      const targetSnap = await getDoc(doc(db, 'quizzes', targetQuizId));
      if (!targetSnap.exists()) {
        alert('تعذر العثور على الاختبار المختار في قاعدة البيانات.');
        return;
      }

      const targetData = targetSnap.data() as any;
      let targetQuizObj: any;
      try {
        targetQuizObj = typeof targetData.data === 'string' ? JSON.parse(targetData.data) : (targetData.data || targetData);
      } catch {
        targetQuizObj = { id: targetQuizId, title: targetData.title, questions: [] };
      }

      if (!Array.isArray(targetQuizObj.questions)) {
        targetQuizObj.questions = [];
      }

      // Clone question with a fresh unique ID
      const clonedQuestion = {
        ...questionToTransfer,
        id: generateId(),
      };

      const updatedTargetQuestions = [...targetQuizObj.questions, clonedQuestion];
      const updatedTargetQuiz = {
        ...targetQuizObj,
        questions: updatedTargetQuestions,
        updated_at: new Date().toISOString(),
      };

      // 2. Save target quiz in Firestore
      await updateDoc(doc(db, 'quizzes', targetQuizId), {
        data: JSON.stringify(updatedTargetQuiz),
        updated_at: new Date().toISOString(),
      });

      // Update target quiz in local quizzes state
      setQuizzes(prev => prev.map(q => q.id === targetQuizId ? {
        ...q,
        data: JSON.stringify(updatedTargetQuiz),
        updated_at: new Date().toISOString(),
      } : q));

      // 3. If action is 'move', remove question from current quiz
      if (action === 'move') {
        const remainingQuestions = quiz.questions.filter((q) => q.id !== questionId);
        const updatedCurrentQuiz = { ...quiz, questions: remainingQuestions };
        setQuiz(updatedCurrentQuiz);

        // If current quiz is already saved in Firestore, persist removal
        if (quiz.id) {
          try {
            await updateDoc(doc(db, 'quizzes', quiz.id), {
              data: JSON.stringify(updatedCurrentQuiz),
              updated_at: new Date().toISOString(),
            });
            setQuizzes(prev => prev.map(q => q.id === quiz.id ? {
              ...q,
              data: JSON.stringify(updatedCurrentQuiz),
              updated_at: new Date().toISOString(),
            } : q));
          } catch (persistErr) {
            console.warn("Auto-saving question removal from current quiz:", persistErr);
          }
        }
      }

      setSaveSuccessToast(
        action === 'copy'
          ? `تم نسخ السؤال إلى اختبار "${targetTitle}" بنجاح! 📋`
          : `تم نقل السؤال إلى اختبار "${targetTitle}" بنجاح! ↗️`
      );
      setTimeout(() => setSaveSuccessToast(null), 4000);
    } catch (e) {
      console.error(`Failed to ${action} question`, e);
      alert(`فشل ${action === 'copy' ? 'نسخ' : 'نقل'} السؤال. يرجى التأكد من الاتصال بالإنترنت والمحاولة مرة أخرى.`);
    }
  };

  const moveQuestion = async (questionId: string, targetQuizId: string) => {
    await copyOrMoveQuestion(questionId, targetQuizId, 'move');
  };

  const handleStudentAnswer = (questionId: string, optionIndex: number) => {
    setStudentAnswers({
      ...studentAnswers,
      [questionId]: optionIndex,
    });
  };

  const isQuestionAnswerCorrect = (q: any, studentAns: any) => {
    if (studentAns === undefined || studentAns === null || studentAns === '') return false;
    const numChoice = Number(studentAns);
    const numCorrect = Number(q.correctOptionIndex);

    // Exact option index match (0 === 0, 1 === 1, etc.)
    if (!isNaN(numChoice) && !isNaN(numCorrect) && numChoice === numCorrect) {
      return true;
    }

    // Exact text match if student answer was stored as option text string rather than index
    if (Array.isArray(q.options) && !isNaN(numCorrect) && q.options[numCorrect] !== undefined) {
      const studentOptText = String(studentAns).trim().toLowerCase();
      const correctOptText = String(q.options[numCorrect]).trim().toLowerCase();
      if (studentOptText && correctOptText && studentOptText === correctOptText) {
        return true;
      }
    }

    // True/False exact text match if applicable
    if (q.type === 'true-false') {
      const studentStr = String(studentAns).trim().toLowerCase();
      const correctArabic = Number(q.correctOptionIndex) === 1 ? 'خطأ' : 'صح';
      const correctEnglish = Number(q.correctOptionIndex) === 1 ? 'false' : 'true';
      if (studentStr === correctArabic || studentStr === correctEnglish) {
        return true;
      }
    }

    return false;
  };

  const calculateScore = () => {
    let totalScore = 0;
    (quiz.questions || []).forEach((q) => {
      if (feedback[q.id]?.score !== undefined) {
        totalScore += feedback[q.id].score;
      } else if (q.type === 'essay') {
        totalScore += feedback[q.id]?.score || 0;
      } else if (isQuestionAnswerCorrect(q, studentAnswers[q.id])) {
        totalScore += (q.points || 1);
      }
    });
    return totalScore;
  };

  const calculateTotalPoints = () => {
    return (quiz.questions || []).reduce((sum, q) => sum + (q.points || 1), 0);
  };

  const isEnglishContent = (...texts: (string | undefined | null)[]): boolean => {
    const combined = texts.filter(Boolean).join(' ');
    if (!combined.trim()) return false;
    const arabicMatches = (combined.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
    const englishMatches = (combined.match(/[a-zA-Z]/g) || []).length;
    if (englishMatches > 0 && arabicMatches === 0) return true;
    return englishMatches > arabicMatches;
  };

  const isQuestionAnswered = (q: Question) => {
    const ans = studentAnswers[q.id];
    if (q.type === 'essay') {
      return typeof ans === 'string' && ans.trim().length > 0;
    }
    return ans !== undefined && ans !== null && ans !== '';
  };

  const getUnansweredQuestions = () => {
    if (!quiz.questions || quiz.questions.length === 0) return [];
    return quiz.questions
      .map((q, idx) => ({
        id: q.id,
        index: idx + 1,
        text: q.text,
        answered: isQuestionAnswered(q)
      }))
      .filter(item => !item.answered);
  };

  // Timer effect for student taking quiz
  useEffect(() => {
    if (mode !== 'take' || !quiz.id) {
      hasAutoSubmittedRef.current = false;
      isSubmittingRef.current = false;
      return;
    }

    let startTime = quizStartTime;
    if (!startTime) {
      const saved = safeStorage.getItem(`quiz_start_time_${quiz.id}`);
      if (saved) {
        startTime = parseInt(saved, 10);
        setQuizStartTime(startTime);
      } else {
        startTime = Date.now();
        safeStorage.setItem(`quiz_start_time_${quiz.id}`, startTime.toString());
        setQuizStartTime(startTime);
      }
    }

    const timeLimitMinutes = typeof quiz.time_limit === 'number' && quiz.time_limit > 0 ? quiz.time_limit : null;

    const interval = setInterval(() => {
      const now = Date.now();
      const currentStart = startTime || now;
      const elapsed = Math.max(0, Math.floor((now - currentStart) / 1000));
      setTimeSpentSeconds(elapsed);

      if (timeLimitMinutes) {
        const totalSecs = timeLimitMinutes * 60;
        const left = Math.max(0, totalSecs - elapsed);
        setTimeRemainingSeconds(left);

        if (left <= 0) {
          clearInterval(interval);
          if (!hasAutoSubmittedRef.current && !isSubmittingRef.current && !isSubmitting) {
            hasAutoSubmittedRef.current = true;
            setIsTimeUpModalOpen(true);
            submitQuiz(true);
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [mode, quiz.id, quiz.time_limit, quizStartTime]);

  // Option 1 & 4: Anti-Screenshot & Focus Loss Blackout Protection during test take mode
  useEffect(() => {
    if (mode !== 'take') {
      setIsScreenObscured(false);
      return;
    }

    // 1. Focus loss on mobile/desktop (when screenshot buttons pressed, app switcher opened, or tab changed)
    const handleBlur = () => {
      setIsScreenObscured(true);
      setScreenObscuredReason('تم حجب الشاشة تلقائياً لحماية محتوى الاختبار أثناء محاولة التقاط الشاشة أو فقدان تركيز الصفحة.');
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsScreenObscured(true);
        setScreenObscuredReason('تم حجب وتعتيم الشاشة أثناء مغادرة نافذة الاختبار لحماية سرية الأسئلة.');
      }
    };

    // 2. Prevent Print Preview & Print to PDF
    const handleBeforePrint = () => {
      setIsScreenObscured(true);
      setScreenObscuredReason('طباعة الاختبار أو تصويره غير مسموح به أثناء الإجابة.');
    };

    // 3. Prevent Screenshot Shortcuts, Copying, Printing, and DevTools
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen key
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        e.preventDefault();
        setIsScreenObscured(true);
        setScreenObscuredReason('تم رصد محاولة تصوير الشاشة (Print Screen). تم حجب المحتوى فوراً.');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('').catch(() => {});
        }
        return false;
      }

      // Ctrl/Cmd + P (Print)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP')) {
        e.preventDefault();
        setIsScreenObscured(true);
        setScreenObscuredReason('طباعة صفحة الاختبار غير مسموح بها.');
        return false;
      }

      // Ctrl/Cmd + C (Copy questions)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.code === 'KeyC')) {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          return false;
        }
      }

      // Ctrl/Cmd + U (View Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U' || e.code === 'KeyU')) {
        e.preventDefault();
        return false;
      }

      // Snipping Tool / Windows Snip: Win+Shift+S or Ctrl+Shift+S
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's' || e.code === 'KeyS')) {
        e.preventDefault();
        setIsScreenObscured(true);
        setScreenObscuredReason('تم حجب الشاشة لمنع أدوات التقاط الشاشة.');
        return false;
      }

      // F12 or Inspect shortcuts: Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C
      if (
        e.key === 'F12' || 
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key))
      ) {
        e.preventDefault();
        return false;
      }
    };

    // 4. Disable Context Menu (Right Click) on non-inputs
    const handleContextMenu = (e: MouseEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag !== 'input' && activeTag !== 'textarea') {
        e.preventDefault();
        return false;
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [mode]);

  const submitQuiz = async (forceSubmit = false) => {
    if (isSubmittingRef.current || isSubmitting) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    if (isQuizExpired(quiz?.expires_at)) {
      alert('عذراً، انتهت صلاحية رابط هذا الاختبار وتم إغلاق استقبال الإجابات.');
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    // Check if teacher's trial or subscription has expired
    const teacherUid = quiz.user_id;
    if (teacherUid) {
      try {
        const teacherStatusRes = await fetch(`/api/teachers/${teacherUid}/status`);
        if (teacherStatusRes.ok) {
          const tStatus = await teacherStatusRes.json();
          if (!tStatus.active) {
            alert(tStatus.reason || 'عذراً، هذا الاختبار غير متاح حالياً لأن الفترة التجريبية أو باقة اشتراك المعلم قد انتهت. يرجى التواصل مع المعلم لتجديد اشتراكه وتفعيل الاختبار.');
            isSubmittingRef.current = false;
            setIsSubmitting(false);
            return;
          }
        }
      } catch (tErr) {
        console.warn("Teacher status check warning before submit:", tErr);
      }
    }

    // Check if max attempts has been exceeded before submitting
    const maxAttempts = (typeof quiz.maxAttempts === 'number' && quiz.maxAttempts > 0) ? quiz.maxAttempts : 1;
    if (quiz.id) {
      try {
        const checkRes = await fetch(`/api/quizzes/${quiz.id}/check-attempts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_name: studentName,
            student_phone: studentPhone,
            parent_phone: parentPhone,
            student_code: (studentCode || '').trim().toUpperCase()
          })
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.hasExceeded) {
            alert(checkData.error || `عذراً، لقد استنفدت عدد المحاولات المسموح بها لهذا الاختبار (${maxAttempts} محاولات).`);
            isSubmittingRef.current = false;
            setIsSubmitting(false);
            return;
          }
        }
      } catch (checkErr) {
        console.warn("Check attempts before submit warning:", checkErr);
      }
    }

    // Check if there are any unanswered questions (if not force-submitting due to timeout)
    if (!forceSubmit) {
      const unanswered = getUnansweredQuestions();
      if (unanswered.length > 0) {
        setUnansweredAttempted(true);
        const firstUnanswered = unanswered[0];
        const targetElement = document.getElementById(`question-card-${firstUnanswered.id}`);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        return;
      }
    }

    const essayQuestions = (quiz.questions || []).filter(q => q.type === 'essay');
    const hasEssays = essayQuestions.length > 0;
    
    setSubmittingTotalEssays(essayQuestions.length);
    setSubmittingCurrentEssayIndex(0);
    setSubmittingProgressText(
      hasEssays 
        ? 'انتظر قليلاً حتى يتم الانتهاء من تصحيح الأسئلة المقالية...' 
        : 'انتظر قليلاً... جاري تدقيق الإجابات وتسجيل النتيجة...'
    );

    try {
      const cleanParentPhone = (parentPhone || '').trim().replace(/[^0-9+]/g, '');
      const cleanStudentPhone = (studentPhone || '').trim().replace(/[^0-9+]/g, '');
      const newFeedback: Record<string, any> = {};
      let totalCalculatedScore = 0;
      let totalQuizPoints = 0;
      let totalAiTokensInQuiz = 0;
      let essayIndexCounter = 0;

      // Calculate time spent
      const effectiveStartTime = quizStartTime || parseInt(safeStorage.getItem(`quiz_start_time_${quiz.id}`) || '0', 10) || Date.now();
      const finalTimeSpentSecs = Math.max(1, Math.floor((Date.now() - effectiveStartTime) / 1000));
      setTimeSpentSeconds(finalTimeSpentSecs);

      // Grade questions
      for (const q of quiz.questions) {
        const qPoints = Math.max(0.25, parseFloat(String(q.points)) || 1);
        totalQuizPoints += qPoints;
        const isEnglishQ = isEnglishContent(q.text, q.modelAnswer, studentAnswers[q.id], quiz.title, quiz.subject || teacherInfo?.subject);

        if (q.type === 'essay') {
          essayIndexCounter++;
          setSubmittingCurrentEssayIndex(essayIndexCounter);
          setSubmittingProgressText(`انتظر قليلاً حتى يتم الانتهاء من تصحيح الأسئلة المقالية (${essayIndexCounter} من ${essayQuestions.length})...`);

          const studentAns = (studentAnswers[q.id] || '').toString().trim();
          if (!studentAns) {
            newFeedback[q.id] = {
              score: 0,
              feedback: isEnglishQ ? 'No answer was provided for this question.' : 'لم يتم تقديم إجابة على هذا السؤال.',
              correctExample: q.modelAnswer || (isEnglishQ ? 'Official model answer' : 'الإجابة النموذجية المعتمدة للاختبار'),
              studentAnswer: '',
              isCorrect: false,
              steps: []
            };
          } else {
            // Fast-path: Check exact/equivalent match immediately before calling AI
            const directMatch = checkEssayExactOrEquivalent(studentAns, q.modelAnswer, qPoints, isEnglishQ, q.keywords);
            if (directMatch.matched) {
              totalCalculatedScore += directMatch.score;
              newFeedback[q.id] = {
                score: directMatch.score,
                feedback: directMatch.feedback,
                correctExample: q.modelAnswer || (isEnglishQ ? 'Official model answer' : 'الإجابة النموذجية'),
                studentAnswer: studentAns,
                steps: directMatch.steps,
                isCorrect: true
              };
            } else {
              // Call AI grading for essay
              try {
                const targetTeacherId = quiz.user_id || teacherInfo?.id || (user ? user.id : '');
                const isExplicitQuizPro = quiz.ai_model === 'pro' || quiz.ai_model === 'gemini_pro';
                const isExplicitQuizFlash = quiz.ai_model === 'flash';
                const teacherIsPro = isExplicitQuizPro 
                  ? true 
                  : isExplicitQuizFlash 
                    ? false 
                    : Boolean(
                        teacherInfo?.preferred_ai_model === 'gemini_pro' || 
                        teacherInfo?.preferred_ai_model === 'pro' || 
                        String(teacherInfo?.subscription_type || '').includes('pro') ||
                        user?.preferred_ai_model === 'gemini_pro' || 
                        user?.preferred_ai_model === 'pro' ||
                        String(user?.subscription_type || '').includes('pro') ||
                        isTeacherPro
                      );

                const effectiveGradeModel = teacherIsPro ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash';

                const res = await fetch('/api/ai-grade-essay', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    question: q.text,
                    modelAnswer: q.modelAnswer || '',
                    studentAnswer: studentAns,
                    points: qPoints,
                    requiredPoints: q.required_points_count,
                    quizId: quiz.id || '',
                    quizTitle: quiz.title || '',
                    teacherId: targetTeacherId,
                    studentName: studentName || '',
                    subject: quiz.subject || teacherInfo?.subject || '',
                    model: effectiveGradeModel,
                    planId: quiz.subscription_type || teacherInfo?.subscription_type || user?.subscription_type,
                    keywords: q.keywords
                  })
                });
                if (res.ok) {
                  const aiData = await res.json();
                  const pTokens = Number(aiData.usageMetadata?.promptTokenCount || 0);
                  const cTokens = Number(aiData.usageMetadata?.candidatesTokenCount || 0);
                  const isQuizPro = teacherIsPro || (aiData.model && aiData.model.includes('pro'));
                  const billableQTokens = calculateTotalBillableTokens(pTokens, cTokens, isQuizPro);
                  totalAiTokensInQuiz += billableQTokens;

                  if (targetTeacherId) {
                    trackTokenUsage(aiData, {
                      operation: 'grade_essay',
                      model: aiData.model || (quiz.ai_model === 'pro' ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash'),
                      quizId: quiz.id,
                      quizTitle: quiz.title,
                      studentName: studentName,
                      userId: targetTeacherId
                    }).catch(() => {});
                  }
                  const earned = typeof aiData.score === 'number' ? Math.max(0, Math.min(qPoints, aiData.score)) : 0;
                  totalCalculatedScore += earned;
                  newFeedback[q.id] = {
                    score: earned,
                    feedback: aiData.feedback || (earned >= qPoints ? (isEnglishQ ? 'Excellent! Correct answer conveying the concept in your own style.' : 'إجابة ممتازة وصحيحة بالمعنى والمفهوم المطلوب معبراً عنها بأسلوبك الخاص.') : earned > 0 ? (isEnglishQ ? 'Partial credit awarded for correct parts.' : 'تم احتساب درجة جزئية عن الأجزاء الصحيحة بالمعنى.') : (isEnglishQ ? 'The answer does not convey the required conceptual meaning.' : 'الإجابة لا تعبر عن المعنى أو المفهوم المطلوب في السؤال.')),
                    correctExample: q.modelAnswer || aiData.correctExample || (isEnglishQ ? 'Official model answer' : 'الإجابة النموذجية'),
                    studentAnswer: studentAns,
                    steps: Array.isArray(aiData.steps) ? aiData.steps : [],
                    isCorrect: earned >= (qPoints * 0.75)
                  };
                } else {
                  const safeCheck = checkEssayExactOrEquivalent(studentAns, q.modelAnswer, qPoints, isEnglishQ, q.keywords);
                  const safeEarned = safeCheck.matched ? safeCheck.score : 0;
                  totalCalculatedScore += safeEarned;
                  newFeedback[q.id] = {
                    score: safeEarned,
                    feedback: safeCheck.matched ? safeCheck.feedback : (isEnglishQ ? 'Your answer has been recorded for teacher review.' : 'تم تسجيل إجابتك وسيتم مراجعتها من قبل المعلم.'),
                    correctExample: q.modelAnswer || (isEnglishQ ? 'Official model answer' : 'الإجابة النموذجية'),
                    studentAnswer: studentAns,
                    isCorrect: safeCheck.matched,
                    steps: safeCheck.steps || []
                  };
                }
              } catch (aiErr) {
                console.warn("AI grading error for essay:", aiErr);
                const safeCheck = checkEssayExactOrEquivalent(studentAns, q.modelAnswer, qPoints, isEnglishQ, q.keywords);
                const safeEarned = safeCheck.matched ? safeCheck.score : 0;
                totalCalculatedScore += safeEarned;
                newFeedback[q.id] = {
                  score: safeEarned,
                  feedback: safeCheck.matched ? safeCheck.feedback : (isEnglishQ ? 'Your answer has been saved for review.' : 'تم حفظ إجابتك للمراجعة.'),
                  correctExample: q.modelAnswer || (isEnglishQ ? 'Official model answer' : 'الإجابة النموذجية'),
                  studentAnswer: studentAns,
                  isCorrect: safeCheck.matched,
                  steps: safeCheck.steps || []
                };
              }
            }
          }
        } else {
          // MCQ, True/False, Fill in blanks, etc.
          const studentChoice = studentAnswers[q.id];
          const hasAnswered = studentChoice !== undefined && studentChoice !== null && studentChoice !== '';
          let isCorrect = false;

          if (hasAnswered) {
            isCorrect = isQuestionAnswerCorrect(q, studentChoice);
          }

          const earned = isCorrect ? qPoints : 0;
          totalCalculatedScore += earned;

          let correctExampleText = '';
          const correctIdx = Number(q.correctOptionIndex);
          if (q.type === 'true-false') {
            if (isEnglishQ) {
              correctExampleText = correctIdx === 1 ? 'False' : 'True';
            } else {
              correctExampleText = correctIdx === 1 ? 'خطأ' : 'صح';
            }
          } else if (Array.isArray(q.options) && q.options[correctIdx] !== undefined) {
            correctExampleText = q.options[correctIdx];
          }

          let studentAnswerText = isEnglishQ ? 'Unanswered' : 'لم يجب';
          if (hasAnswered) {
            if (q.type === 'true-false') {
              if (isEnglishQ) {
                studentAnswerText = Number(studentChoice) === 1 ? 'False' : 'True';
              } else {
                studentAnswerText = Number(studentChoice) === 1 ? 'خطأ' : 'صح';
              }
            } else if (Array.isArray(q.options) && q.options[studentChoice] !== undefined) {
              studentAnswerText = q.options[studentChoice];
            } else {
              studentAnswerText = String(studentChoice);
            }
          }

          newFeedback[q.id] = {
            score: earned,
            isCorrect: isCorrect,
            studentAnswer: studentChoice,
            studentAnswerText: studentAnswerText,
            correctOptionIndex: q.correctOptionIndex,
            correctExample: correctExampleText
          };
        }
      }

      setFeedback(newFeedback);
      setSubmittingProgressText('جاري حفظ النتيجة وتوثيق التقرير في سجل الدرجات...');

      const finalScore = Math.max(0, Math.min(totalQuizPoints, totalCalculatedScore));
      const finalTotal = Math.max(1, totalQuizPoints);

      // Save result document in Firestore if quiz is saved
      if (quiz.id) {
        const effectiveTeacherId = quiz.user_id || teacherInfo?.id || (user ? (user.id || user.uid) : null);
        
        // Ensure idempotent submission: reuse session document ID for this exam sitting
        let sessionResultId = safeStorage.getItem(`quiz_session_doc_id_${quiz.id}`);
        if (!sessionResultId) {
          sessionResultId = doc(collection(db, 'results')).id;
          safeStorage.setItem(`quiz_session_doc_id_${quiz.id}`, sessionResultId);
        }
        const resultDocRef = doc(db, 'results', sessionResultId);
        const resultDocData: Record<string, any> = {
          id: sessionResultId,
          quiz_id: quiz.id,
          quiz_title: quiz.title || 'اختبار',
          student_name: (studentName || 'طالب').trim(),
          student_phone: cleanStudentPhone || studentPhone || '',
          parent_phone: cleanParentPhone || parentPhone || '',
          student_email: studentEmail.trim(),
          student_code: (studentCode || '').trim().toUpperCase(),
          phone: cleanStudentPhone || cleanParentPhone || '',
          center_name: centerName || 'عام',
          score: finalScore,
          total: finalTotal,
          feedback: JSON.stringify(newFeedback),
          student_answers: JSON.stringify(studentAnswers),
          is_graded: true,
          created_at: new Date().toISOString(),
          teacher_id: effectiveTeacherId,
          user_id: effectiveTeacherId,
          teacher_name: teacherInfo?.name || quiz.teacher_name || '',
          subject: quiz.subject || teacherInfo?.subject || '',
          grade_level: studentGrade || quiz.grade_level || teacherInfo?.gradeLevel || '',
          time_spent_seconds: finalTimeSpentSecs,
          duration: finalTimeSpentSecs,
          ai_tokens_used: totalAiTokensInQuiz
        };

        // Increment local device attempts counter IMMEDIATELY to prevent easy retries if network fails
        const localAttempts = Number(safeStorage.getItem(`quiz_attempts_count_${quiz.id}`) || '0');
        safeStorage.setItem(`quiz_attempts_count_${quiz.id}`, String(localAttempts + 1));
        safeStorage.setItem(`quiz_attempt_name_${quiz.id}`, studentName);

        // 1. Direct Firestore write
        try {
          await setDoc(resultDocRef, resultDocData);
        } catch (saveErr: any) {
          console.warn("Direct Firestore result save notice:", saveErr);
        }

        // If a student code was used, mark it as used in the quiz document directly
        const cleanUsedCode = (studentCode || '').trim().toUpperCase();
        if (cleanUsedCode && Array.isArray(quiz.student_codes) && quiz.student_codes.length > 0) {
          try {
            const updatedCodes = quiz.student_codes.map((c: any) => {
              if ((c.code || '').toUpperCase() === cleanUsedCode) {
                return { ...c, used: true, used_at: new Date().toISOString(), result_id: resultDocRef.id };
              }
              return c;
            });
            setQuiz(prev => ({ ...prev, student_codes: updatedCodes }));
            const quizDocRef = doc(db, 'quizzes', quiz.id);
            await updateDoc(quizDocRef, {
              student_codes: updatedCodes,
              updated_at: new Date().toISOString()
            }).catch(() => {});
          } catch (codeErr) {
            console.warn("Notice updating student_codes usage in quiz:", codeErr);
          }
        }

        // 2. Server-side authoritative backup submission
        try {
          await fetch(`/api/quizzes/${quiz.id}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: resultDocRef.id,
              student_name: (studentName || 'طالب').trim(),
              center_name: centerName || 'عام',
              parent_phone: cleanParentPhone || parentPhone || '',
              student_phone: cleanStudentPhone || studentPhone || '',
              student_email: studentEmail.trim(),
              student_code: cleanUsedCode,
              student_answers: studentAnswers,
              answers: studentAnswers,
              score: finalScore,
              total: finalTotal,
              feedback: newFeedback,
              duration: finalTimeSpentSecs,
              time_spent_seconds: finalTimeSpentSecs
            })
          });
        } catch (srvSubmitErr) {
          console.warn("Server backup submission notice:", srvSubmitErr);
        }
      }

      // Cleanup local quiz timer & session doc ID
      safeStorage.removeItem(`quiz_start_time_${quiz.id}`);
      safeStorage.removeItem(`quiz_session_doc_id_${quiz.id}`);
      setQuizStartTime(null);
      setTimeRemainingSeconds(null);
      setIsTimeUpModalOpen(false);

      setMode('results');
      setAiMessage('تم تصحيح وحفظ النتيجة بنجاح!');
    } catch (err: any) {
      console.error("Quiz submission error:", err);
      // Cleanup local quiz timer & session doc ID
      safeStorage.removeItem(`quiz_start_time_${quiz.id}`);
      safeStorage.removeItem(`quiz_session_doc_id_${quiz.id}`);
      setQuizStartTime(null);
      setTimeRemainingSeconds(null);
      setIsTimeUpModalOpen(false);

      setMode('results');
      setAiMessage('تم تصحيح الاختبار.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const fetchResults = async (quizId?: any) => {
    if (!user?.hasAccess && user?.role !== 'admin' && !auth.currentUser) {
      alert('يرجى تسجيل الدخول أو الاشتراك لعرض النتائج.');
      return;
    }
    const currentUid = auth.currentUser?.uid || user?.id || user?.uid;
    const targetId = (typeof quizId === 'string' && quizId.trim()) ? quizId.trim() : (quiz?.id || 'all');
    
    setIsFetchingResults(true);
    setTeacherResults([]); // Clear previous results to avoid showing old data
    setResultsSearchTerm(''); // Clear search term when opening for a new quiz
    setResultsFilterStatus('all');
    setResultsFilterGrade('all');
    setResultsFilterSubject('all');
    setResultsFilterCenter('all');
    setResultsFilterDate('all');
    setResultsFilterCustomDate('');
    setResultsFilterScore('all');
    setResultsSortBy('date_desc');
    setResultsPage(1); // Reset to first page
    setSelectedResultsQuizId(targetId);
    setShowResultsModal(true);

    // Fetch results from Firestore and Server API and sort by latest
    try {
      const resultsMap = new Map<string, any>();

      // 1. Fetch via Server API (Reliable backend Admin DB access)
      try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => token) : token;
        const apiEndpoint = (targetId === 'all') ? '/api/teacher/results' : `/api/quizzes/${targetId}/results`;
        const serverRes = await fetch(apiEndpoint, {
          headers: idToken ? { 'Authorization': `Bearer ${idToken}` } : {}
        });
        if (serverRes.ok) {
          const srvResults = await serverRes.json();
          if (Array.isArray(srvResults)) {
            srvResults.forEach(r => {
              if (r && r.id) resultsMap.set(r.id, r);
            });
          }
        }
      } catch (srvErr) {
        console.warn("Server results fetch notice:", srvErr);
      }

      // 2. Fetch directly from Firestore (Client SDK)
      if (targetId === 'all') {
        // Query 2a: By teacher_id
        if (currentUid) {
          try {
            const resultsByTeacherQ = query(
              collection(db, 'results'), 
              where('teacher_id', '==', currentUid), 
              limit(500)
            );
            const snap = await getDocs(resultsByTeacherQ);
            snap.forEach(d => {
              resultsMap.set(d.id, { id: d.id, ...d.data() });
            });
          } catch (e) {
            console.warn("Direct results query by teacher_id notice:", e);
          }

          // Query 2b: By user_id
          try {
            const resultsByUserQ = query(
              collection(db, 'results'), 
              where('user_id', '==', currentUid), 
              limit(500)
            );
            const snap = await getDocs(resultsByUserQ);
            snap.forEach(d => {
              resultsMap.set(d.id, { id: d.id, ...d.data() });
            });
          } catch (e) {
            console.warn("Direct results query by user_id notice:", e);
          }
        }

        // Query 2c: In chunks of quizzes by quiz_id
        if (quizzes && quizzes.length > 0) {
          const quizIds = quizzes.map(q => q.id).filter(Boolean);
          const chunks = [];
          for (let i = 0; i < quizIds.length; i += 10) {
            chunks.push(quizIds.slice(i, i + 10));
          }
          for (const chunk of chunks) {
            try {
              const resultsByQuizIdsQ = query(
                collection(db, 'results'), 
                where('quiz_id', 'in', chunk), 
                limit(200)
              );
              const snap = await getDocs(resultsByQuizIdsQ);
              snap.forEach(d => {
                resultsMap.set(d.id, { id: d.id, ...d.data() });
              });
            } catch (e) {
              console.warn("Direct results query by quiz chunk notice:", e);
            }
          }
        }
      } else {
        // Specific quiz targeted
        try {
          const resultsQ = query(collection(db, 'results'), where('quiz_id', '==', targetId), limit(500));
          let resultsSnap;
          try {
            resultsSnap = await getDocs(resultsQ);
          } catch (e: any) {
            const msg = (e?.message || '').toLowerCase();
            if (msg.includes('quota') || e?.code === 'failed-precondition' || e?.code === 'resource-exhausted') {
              try {
                resultsSnap = await getDocsFromCache(resultsQ);
              } catch (cacheErr) {
                console.warn("Cache fetch failed for results", cacheErr);
              }
            }
            if (!resultsSnap) throw e;
          }
          if (resultsSnap) {
            resultsSnap.docs.forEach(d => {
              resultsMap.set(d.id, { id: d.id, ...d.data() });
            });
          }
        } catch (e) {
          console.warn(`Results query for quiz ${targetId} failed:`, e);
        }
      }

      const data = Array.from(resultsMap.values());
      const sortedData = data.sort((a: any, b: any) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      setTeacherResults(sortedData);
    } catch (e: any) {
      console.warn("Fetch results failed:", e);
      const msg = (e?.message || '').toLowerCase();
      if (msg.includes('quota') || e?.code === 'resource-exhausted') {
        setIsQuotaExceeded(true);
      } else {
        handleFirestoreError(e, OperationType.GET, `results (quiz_id: ${targetId})`);
      }
    } finally {
      setIsFetchingResults(false);
    }
  };

  const sendWhatsAppResult = async (result: any) => {
    if (!result.parent_phone) {
      alert('لم يتم تسجيل رقم هاتف ولي الأمر لهذا الطالب.');
      return;
    }
    
    let phone = formatWhatsAppPhone(result.parent_phone);
    if (!phone) {
      alert('رقم هاتف ولي الأمر المسجل غير صالح للاستخدام في واتساب.');
      return;
    }
    
    const effectiveTeacherInfo = teacherInfo || {
      name: user?.name || profileData.name || quiz.teacher_name || '',
      subject: user?.subject || profileData.subject || quiz.subject || '',
      phone: user?.phone || profileData.phone || ''
    };
    const message = buildParentResultOnlyWhatsAppMessage(result, quiz, effectiveTeacherInfo);
    const encodedMessage = encodeURIComponent(message);
    
    // Auto-mark as reviewed and sent to parent
    if (!result.reviewed_and_sent && result.id) {
      const now = new Date().toISOString();
      setTeacherResults(prev => prev.map(r => 
        r.id === result.id 
          ? { ...r, reviewed_and_sent: true, reviewed_and_sent_at: now } 
          : r
      ));
      if (sheetStudentResult && sheetStudentResult.id === result.id) {
        setSheetStudentResult(prev => prev ? { ...prev, reviewed_and_sent: true, reviewed_and_sent_at: now } : null);
      }
      try {
        await updateDoc(doc(db, 'results', result.id), {
          reviewed_and_sent: true,
          reviewed_and_sent_at: now
        });
      } catch (err) {
        console.warn('Failed direct Firestore update on sendWhatsAppResult:', err);
      }
      try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => token) : token;
        await fetch(`/api/results/${result.id}/review`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify({
            reviewed_and_sent: true,
            reviewed_and_sent_at: now
          })
        });
      } catch (apiErr) {
        console.error('Failed API update on sendWhatsAppResult:', apiErr);
      }
    }

    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
  };

  const sendWhatsAppToTeacher = (targetUser: any, customMsgType?: 'trial' | 'general' | string) => {
    if (!targetUser?.phone) {
      alert(`لا يوجد رقم هاتف مسجل للأستاذ ${targetUser?.name || targetUser?.email || ''}`);
      return;
    }

    let phone = String(targetUser.phone).trim().replace(/[^0-9+]/g, '');
    if (phone.startsWith('+')) {
      phone = phone.substring(1);
    }
    if (phone.startsWith('01')) {
      phone = '2' + phone;
    } else if (phone.startsWith('1') && phone.length === 10) {
      phone = '20' + phone;
    }

    const teacherName = targetUser.name ? `أستاذ ${targetUser.name}` : 'المحترم';
    const subjectInfo = targetUser.subject ? ` (مادة ${targetUser.subject})` : '';
    
    let message = '';
    if (customMsgType === 'trial') {
      message = `السلام عليكم ورحمة الله وبركاته، ${teacherName}${subjectInfo} 👋\nنتواصل معك من منصة مصحح الواجبات الذكي (SmartHW).\n\nنود الاطمئنان على تجربتك للمنصة خلال الفترة التجريبية المجانية، وهل قمت بتجربة إنشاء وتصحيح الاختبارات؟ يسعدنا الإجابة على أي استفسار وتوفير أفضل باقة تناسب طلابك 🌟`;
    } else if (typeof customMsgType === 'string' && customMsgType !== 'general') {
      message = customMsgType;
    } else {
      message = `السلام عليكم ورحمة الله وبركاته، ${teacherName}${subjectInfo} 👋\nنتواصل معك من منصة مصحح الواجبات الذكي (SmartHW).\n\nكيف يمكننا مساعدتك اليوم؟`;
    }
    const encodedMessage = encodeURIComponent(message);

    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
  };

  const startBatchSend = () => {
    const withPhones = filteredResults.filter(r => r.parent_phone);
    if (withPhones.length === 0) {
      alert('لا توجد أرقام هواتف مسجلة للطلاب في هذه القائمة.');
      return;
    }
    setSendingQueue(withPhones);
    setCurrentSendIndex(0);
    setShowBatchSendModal(true);
  };

  const sendNextInBatch = () => {
    if (currentSendIndex < sendingQueue.length) {
      sendWhatsAppResult(sendingQueue[currentSendIndex]);
      setCurrentSendIndex(prev => prev + 1);
    }
  };

  const handleDownloadExcel = (format: 'xls' | 'csv' = 'xls') => {
    if (filteredResults.length === 0) {
      alert('لا توجد نتائج مطابقة للتحميل.');
      return;
    }
    
    const worksheetData = filteredResults.map((r, index) => {
      const pct = Math.round(((r.score || 0) / (r.total || 1)) * 100);
      let gradeRating = 'راسب / غير مجتاز';
      if (pct >= 85) gradeRating = 'ممتاز';
      else if (pct >= 75) gradeRating = 'جيد جداً';
      else if (pct >= 65) gradeRating = 'جيد';
      else if (pct >= 50) gradeRating = 'مقبول';

      return {
        'م': index + 1,
        'اسم الطالب': r.student_name || 'غير محدد',
        'رقم هاتف الطالب': r.student_phone || r.phone || '-',
        'رقم ولي الأمر': r.parent_phone || '-',
        'المرحلة الدراسية': r.grade_level || 'غير محدد',
        'المادة الدراسية': r.subject || 'غير محدد',
        'السنتر / المجموعة': r.center_name || 'غير محدد',
        'الدرجة المحصلة': r.score,
        'الدرجة النهائية': r.total,
        'النسبة المئوية': `${pct}%`,
        'التقدير': gradeRating,
        'الوقت المستغرق': r.time_spent_seconds ? formatDuration(r.time_spent_seconds) : '-',
        'حالة إرسال ولي الأمر': r.reviewed_and_sent ? 'تمت المراجعة والإرسال' : 'لم يُرسل بعد',
        'تاريخ الإرسال لولي الأمر': r.reviewed_and_sent_at ? new Date(r.reviewed_and_sent_at).toLocaleString('ar-EG') : '-',
        'تاريخ ووقت الاختبار': r.created_at ? new Date(r.created_at).toLocaleString('ar-EG') : '-'
      };
    });
    
    const safeQuizTitle = (quiz.title || 'نتائج_الطلاب').replace(/[\\/*?:|<>"]/g, '_');
    const suffix = isAnyResultFilterActive ? '_مفلترة' : '';
    const baseFilename = `${safeQuizTitle}${suffix}`;

    exportResultsToExcelOrCSV(
      worksheetData, 
      baseFilename, 
      format, 
      {
        teacherName: teacherInfo?.name || quiz.teacher_name || user?.name || '',
        subject: quiz.subject || teacherInfo?.subject || '',
        gradeLevel: typeof quiz.grade_level === 'string' ? quiz.grade_level : (Array.isArray(quiz.grade_level) ? quiz.grade_level.join('، ') : (teacherInfo?.gradeLevel || '')),
        quizTitle: quiz.title || 'كشف نتائج الاختبار'
      }
    );

    setRetentionSuccessMessage(format === 'csv' ? 'تم تجهيز وتنزيل ملف CSV بنجاح.' : 'تم تجهيز وتنزيل ملف الإكسل بنجاح.');
    setTimeout(() => setRetentionSuccessMessage(''), 4000);
  };

  const handleDownloadPDF = async (mode: 'download' | 'print' = 'download') => {
    if (filteredResults.length === 0) {
      alert('لا توجد نتائج مطابقة للتحميل.');
      return;
    }

    setIsExportingPDF(true);
    try {
      const formattedResults = filteredResults.map((r, index) => {
        const pct = Math.round(((r.score || 0) / (r.total || 1)) * 100);
        let rating = 'راسب / غير مجتاز';
        if (pct >= 85) rating = 'ممتاز';
        else if (pct >= 75) rating = 'جيد جداً';
        else if (pct >= 65) rating = 'جيد';
        else if (pct >= 50) rating = 'مقبول';

        return {
          index: index + 1,
          student_name: r.student_name || 'طالب مجهول',
          student_phone: r.student_phone || r.phone || '',
          parent_phone: r.parent_phone || '',
          center_name: r.center_name || 'عام',
          grade_level: r.grade_level || quiz.grade_level || '',
          subject: r.subject || quiz.subject || '',
          score: r.score || 0,
          total: r.total || 1,
          pct: pct,
          rating: rating,
          reviewed_and_sent: !!r.reviewed_and_sent,
          created_at: r.created_at
        };
      });

      const options = {
        quizTitle: quiz.title || 'اختبار بدون عنوان',
        teacherName: teacherInfo?.name || quiz.teacher_name || user?.name || '',
        subject: quiz.subject || teacherInfo?.subject || '',
        gradeLevel: typeof quiz.grade_level === 'string' ? quiz.grade_level : (Array.isArray(quiz.grade_level) ? quiz.grade_level.join('، ') : (teacherInfo?.gradeLevel || '')),
        centerName: resultsFilterCenter !== 'all' ? resultsFilterCenter : undefined,
        totalStudents: filteredResults.length,
        avgScore: filteredAvgScore,
        avgPct: filteredAvgPct,
        passRate: filteredPassRate,
        passCount: filteredPassCount,
        topScore: filteredTopScore,
        results: formattedResults,
        filename: `نتائج_${(quiz.title || 'الطلاب').replace(/[\\/*?:|<>"]/g, '_')}${isAnyResultFilterActive ? '_مفلترة' : ''}`
      };

      if (mode === 'print') {
        printResultsPDF(options);
      } else {
        await downloadResultsPDF(options);
        setRetentionSuccessMessage('تم تصدير وتحميل ملف الـ PDF بنجاح.');
        setTimeout(() => setRetentionSuccessMessage(''), 4000);
      }
    } catch (err: any) {
      console.error('PDF export error:', err);
      alert('حدث خطأ أثناء إنشاء ملف PDF: ' + (err?.message || ''));
    } finally {
      setIsExportingPDF(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="text-slate-500 font-medium animate-pulse">جاري تحميل الاختبار...</p>
      </div>
    );
  }

  // Render Auth Screen (Strictly block access without an account)
  if (!isShared && (!user || authMode)) {
    const currentAuthMode = authMode || 'login';
    return (
      <div  className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md animate-in zoom-in-95 duration-300">
          <div className="text-center mb-8">
            <div className="bg-indigo-100 text-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">مصحح الواجبات الذكي</h1>
            <p className="text-slate-500 mt-2">
              {currentAuthMode === 'login' ? 'سجل دخولك لإدارة اختباراتك' : 'أنشئ حساباً جديداً للبدء (نسخة تجريبية 7 أيام)'}
            </p>
          </div>

          {!showForgotPassword && (
            <form onSubmit={handleAuth} className="space-y-4">
            {authError && (
              <div className="bg-red-50 text-red-700 p-3.5 rounded-2xl text-sm border border-red-200/80 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-medium">{authError}</span>
                </div>
                {authMode === 'login' && (authErrorCode === 'auth/invalid-credential' || authErrorCode === 'auth/wrong-password' || authErrorCode === 'auth/user-not-found' || authErrorCode === 'auth/invalid-login-credentials') && (
                  <div className="pt-2 border-t border-red-200/60 flex flex-wrap items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(authEmail);
                        setForgotStatusMessage('');
                        setForgotErrorMessage('');
                        setShowForgotPassword(true);
                        setAuthError('');
                        setAuthErrorCode(null);
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-bold bg-white px-3 py-1.5 rounded-lg border border-indigo-200 hover:border-indigo-400 transition-all shadow-sm"
                    >
                      استعادة كلمة المرور
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('register');
                        setAuthError('');
                        setAuthErrorCode(null);
                      }}
                      className="text-slate-700 hover:text-slate-900 font-bold bg-white px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-400 transition-all shadow-sm"
                    >
                      إنشاء حساب جديد بهذا البريد
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {authMode === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">الاسم الكامل</label>
                  <input
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">رقم الواتساب</label>
                  <input
                    type="tel"
                    required
                    value={authWhatsapp}
                    onChange={(e) => setAuthWhatsapp(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                    placeholder="مثال: 01234567890"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">المادة الدراسية</label>
                  <input
                    type="text"
                    required
                    value={authSubject}
                    onChange={(e) => setAuthSubject(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                    placeholder="مثال: لغة عربية، رياضيات، فيزياء..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">السنوات الدراسية (يمكنك اختيار أكثر من واحدة)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "الأول الابتدائي", value: "primary_1" },
                      { label: "الثاني الابتدائي", value: "primary_2" },
                      { label: "الثالث الابتدائي", value: "primary_3" },
                      { label: "الرابع الابتدائي", value: "primary_4" },
                      { label: "الخامس الابتدائي", value: "primary_5" },
                      { label: "السادس الابتدائي", value: "primary_6" },
                      { label: "الأول الإعدادي", value: "prep_1" },
                      { label: "الثاني الإعدادي", value: "prep_2" },
                      { label: "الثالث الإعدادي", value: "prep_3" },
                      { label: "الأول الثانوي", value: "sec_1" },
                      { label: "الثاني الثانوي", value: "sec_2" },
                      { label: "الثالث الثانوي", value: "sec_3" },
                    ].map((grade) => (
                      <label key={grade.value} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={authGradeLevels.includes(grade.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAuthGradeLevels([...authGradeLevels, grade.value]);
                            } else {
                              setAuthGradeLevels(authGradeLevels.filter((g) => g !== grade.value));
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-700">{grade.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="genAvatar"
                      checked={generateAvatar}
                      onChange={(e) => {
                        setGenerateAvatar(e.target.checked);
                      }}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="genAvatar" className="text-sm font-medium text-indigo-900 cursor-pointer flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      توليد صورة احترافية بالذكاء الاصطناعي (اختياري)
                    </label>
                  </div>
                  
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-indigo-700">أو ارفع صورتك الشخصية:</span>
                      {authAvatarData && (
                        <button 
                          type="button"
                          onClick={() => setAuthAvatarData(null)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          حذف الصورة
                        </button>
                      )}
                    </div>
                    <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-indigo-200 rounded-xl hover:bg-indigo-100/50 transition-all cursor-pointer overflow-hidden group">
                      {authAvatarData ? (
                        <img src={authAvatarData} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center text-indigo-400 group-hover:text-indigo-600">
                          <Upload size={24} />
                          <span className="text-xs mt-1">اختر صورة</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // Compress image before setting it
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const img = new window.Image();
                              img.onload = () => {
                                const canvas = document.createElement('canvas');
                                let width = img.width;
                                let height = img.height;
                                
                                // Max dimensions 400x400
                                const MAX_WIDTH = 400;
                                const MAX_HEIGHT = 400;
                                
                                if (width > height) {
                                  if (width > MAX_WIDTH) {
                                    height *= MAX_WIDTH / width;
                                    width = MAX_WIDTH;
                                  }
                                } else {
                                  if (height > MAX_HEIGHT) {
                                    width *= MAX_HEIGHT / height;
                                    height = MAX_HEIGHT;
                                  }
                                }
                                
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                ctx?.drawImage(img, 0, 0, width, height);
                                
                                // Compress to 0.7 quality
                                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                                setAuthAvatarData(dataUrl);
                              };
                              img.src = event.target?.result as string;
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                  </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                    dir="ltr"
                    placeholder="example@email.com"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700">كلمة المرور</label>
                    {authMode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(authEmail);
                          setForgotStatusMessage('');
                          setForgotErrorMessage('');
                          setShowForgotPassword(true);
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        نسيت كلمة المرور؟
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full p-3 pl-10 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                      dir="ltr"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {authMode === 'register' && generateAvatar ? 'جاري إنشاء الحساب وتوليد الصورة...' : 'جاري المعالجة...'}
                    </>
                  ) : (
                    <>
                      {authMode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
                
                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode(authMode === 'login' ? 'register' : 'login');
                      setAuthError('');
                      setAuthErrorCode(null);
                    }}
                    className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                  >
                    {authMode === 'login' ? 'ليس لديك حساب؟ أنشئ حساباً جديداً' : 'لديك حساب بالفعل؟ سجل دخولك'}
                  </button>
                </div>
              </form>
            )}

            {/* Forgot Password View */}
            {showForgotPassword && (
              <form onSubmit={handleSendPasswordReset} className="space-y-4">
                <div className="text-center mb-4">
                  <div className="bg-amber-100 text-amber-600 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <KeyRound size={24} />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800">إعادة ضبط كلمة المرور</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة ضبط كلمة المرور فوراً
                  </p>
                </div>

                {forgotErrorMessage && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs border border-red-100">
                    {forgotErrorMessage}
                  </div>
                )}

                {forgotStatusMessage && (
                  <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-xs border border-emerald-100 font-medium">
                    {forgotStatusMessage}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                    dir="ltr"
                    placeholder="example@email.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSendingResetEmail}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 mt-4 text-sm disabled:opacity-50"
                >
                  {isSendingResetEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جاري إرسال رابط الضبط...
                    </>
                  ) : (
                    <>
                      إرسال رابط استعادة كلمة المرور
                      <Mail size={16} />
                    </>
                  )}
                </button>

                <div className="text-center mt-3">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="text-slate-500 hover:text-slate-700 text-xs font-medium"
                  >
                    ← العودة إلى تسجيل الدخول
                  </button>
                </div>
              </form>
            )}
        </div>
      </div>
    );
  }

  return (
    <div  className="min-h-screen bg-slate-50 font-sans text-slate-900 relative">
      {/* Save Success Floating Toast Banner */}
      {saveSuccessToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-emerald-500 font-bold text-sm">
            <CheckCircle2 size={20} className="shrink-0" />
            <span>{saveSuccessToast}</span>
            <button 
              onClick={() => setSaveSuccessToast(null)}
              className="text-emerald-200 hover:text-white mr-1 text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {/* Quota Exceeded Warning Banner - Removed as per request, relying on silent cache fallback */}
      {/* Header */}
      {isShared ? (
        <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 text-white p-1 rounded-lg">
                <CheckCircle2 size={16} />
              </div>
              <h1 className="text-sm font-bold text-slate-800">منصة الاختبارات الذكية</h1>
            </div>
          </div>
        </header>
      ) : (
        <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 sm:h-16 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
                  <CheckCircle2 size={18} className="sm:w-6 sm:h-6" />
                </div>
                <h1 className="text-base sm:text-xl font-bold text-slate-800 truncate max-w-[120px] sm:max-w-none">مصحح الواجبات</h1>
              </div>
              <div className="flex items-center gap-2">
                {/* Token Counter Widget */}
                {!isShared && (() => {
                  const stats = getUserTokenStats(user);
                  if (!stats.isTokenSystem) return null;
                  const remainingPercent = stats.totalLimit > 0 ? Math.round((stats.remaining / stats.totalLimit) * 100) : 0;
                  const usedPercent = stats.percentage;
                  return (
                    <div className="flex flex-col items-end mx-1 sm:mx-2 bg-indigo-50/80 px-2.5 py-1 rounded-xl border border-indigo-100 shadow-2xs">
                      <div className="text-[9px] sm:text-[11px] font-black text-indigo-950 flex items-center gap-1">
                        <Coins size={11} className="text-indigo-600 shrink-0" />
                        <span>رصيد التوكنز: <span className="font-mono text-indigo-700" dir="ltr">{stats.remaining.toLocaleString()}</span> / <span className="font-mono text-slate-500" dir="ltr">{stats.totalLimit.toLocaleString()}</span></span>
                      </div>
                      <div className="w-24 sm:w-32 bg-slate-200 h-1 sm:h-1.5 rounded-full mt-1 overflow-hidden">
                        <div className={`h-full transition-all duration-300 ${remainingPercent < 15 ? 'bg-rose-500' : remainingPercent < 35 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${remainingPercent}%` }}></div>
                      </div>
                    </div>
                  );
                })()}

                {/* AI System Badge (Pro vs Flash) */}
                {!isShared && user && (
                  isTeacherPro ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white shadow-2xs border border-purple-400/30" title="حسابك مفعّل بنظام برو (Gemini Pro): استدلال وتفكير عميق في رفع وحل وتصحيح الأسئلة">
                      <Crown size={11} className="text-amber-300 fill-amber-300 shrink-0" />
                      <span>نظام برو 👑</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200" title="حسابك مفعّل بنظام فلاش 3.8: فائق السرعة وموفر">
                      <Zap size={10} className="text-amber-500 shrink-0" />
                      <span>فلاش 3.8</span>
                    </span>
                  )
                )}

                {!isShared && user?.avatar_data && (
                  <img 
                    src={user.avatar_data} 
                    alt={user.name} 
                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-indigo-200 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                )}
                {!isShared && user?.isTrialActive && user?.role !== 'admin' && user?.subscription_status !== 'active' && (
                  <span className="bg-amber-100 text-amber-700 text-[9px] sm:text-xs px-1.5 py-0.5 sm:py-1 rounded-full font-bold">
                    تجريبي
                  </span>
                )}
              </div>
            </div>
            {!isShared && (
              <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between">
                {user && !user.hasAccess && !user.isAdmin ? (
                  <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold">
                    <Lock size={14} className="text-rose-600 shrink-0" />
                    <span>انتهت الفترة التجريبية - يلزم الاشتراك أو التجديد</span>
                  </div>
                ) : (
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto whitespace-nowrap scrollbar-hide flex-1 sm:flex-none no-scrollbar">
                    <button
                      onClick={() => setMode('dashboard')}
                      className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] sm:text-sm font-medium transition-colors ${
                        mode === 'dashboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FileText size={12} className="sm:w-4 sm:h-4" />
                      الرئيسية
                    </button>
                    <button
                      onClick={() => setMode('build')}
                      className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] sm:text-sm font-medium transition-colors ${
                        mode === 'build' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FileText size={12} className="sm:w-4 sm:h-4" />
                      المعلم
                    </button>
                    <button
                      onClick={() => {
                        setMode('take-intro');
                        setStudentAnswers({});
                        setStudentName('');
                        setCenterName('');
                        setParentPhone('');
                        setStudentEmail('');
                      }}
                      className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] sm:text-sm font-medium transition-colors ${
                        mode.startsWith('take') || mode === 'results' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <User size={12} className="sm:w-4 sm:h-4" />
                      الطالب
                    </button>
                  </div>
                )}
                <button onClick={toggleLanguage} className="text-slate-400 hover:text-indigo-500 transition-colors p-1" title="تغيير اللغة / Change Language">
                  <Globe size={16} className="sm:w-5 sm:h-5" />
                </button>
                <button onClick={logout} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="تسجيل الخروج">
                  <LogOut size={16} className="sm:w-5 sm:h-5" />
                </button>
              </div>
            )}
          </div>
        </header>
      )}

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {!isShared && user && !user.hasAccess && !user.isAdmin ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Expired / Locked Notice Card */}
            <div className="bg-gradient-to-br from-rose-50 via-white to-amber-50 rounded-3xl p-6 sm:p-8 border-2 border-rose-200 shadow-lg text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500"></div>
              
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-rose-50 shadow-inner">
                <Lock className="text-rose-600 w-8 h-8 sm:w-10 sm:h-10" />
              </div>

              <span className="inline-block bg-rose-100 text-rose-800 text-xs sm:text-sm font-black px-4 py-1 rounded-full mb-3 border border-rose-200">
                انتهت الفترة التجريبية المجانية
              </span>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
                عذراً أ/ {user.name || 'المعلم'}، حسابك مقفل ومطلوب الاشتراك أو التجديد
              </h2>
              
              <p className="text-slate-600 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed mb-6">
                لقد انتهت فترتك التجريبية المجانية (5 أيام). لا يمكنك إنشاء أو تعديل الاختبارات أو إتاحتها للطلاب حتى يتم تفعيل الاشتراك. اختر باقتك المفضلة أدناه واشترك الآن للاستمتاع بجميع الميزات غير المحدودة.
              </p>

              {user.hasPendingSubscription ? (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 max-w-lg mx-auto text-amber-900 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 mb-4 animate-pulse">
                  <Sparkles className="text-amber-600 shrink-0" size={18} />
                  <span>طلب اشتراكك قيد المراجعة حالياً من قبل الإدارة وسيتم تفعيل حسابك فور التحقق من إيصال الدفع.</span>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-center items-center gap-3">
                <button
                  onClick={() => openPlansModal()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm sm:text-base px-6 py-3 rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <CreditCard size={18} />
                  <span>اختر باقتك واشترك الآن</span>
                </button>
                <a
                  href={`https://wa.me/201063124503?text=${encodeURIComponent(`مرحباً إدارة منصة الاختبارات الذكية، أريد تفعيل/تجديد اشتراكي.\nالاسم: ${user.name || ''}\nالبريد: ${user.email || ''}\nالمادة: ${user.subject || ''}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base px-5 py-3 rounded-2xl shadow-md transition-all flex items-center gap-2"
                >
                  <MessageCircle size={18} />
                  <span>تواصل واتساب للتفعيل الفوري</span>
                </a>
                <button
                  onClick={logout}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm px-4 py-3 rounded-2xl transition-all flex items-center gap-1.5"
                >
                  <LogOut size={16} />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            </div>

            {/* Inline Plans View */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
              <div className="text-center mb-6">
                <h3 className="text-lg sm:text-xl font-black text-slate-800">باقات الاشتراك المتاحة</h3>
                <p className="text-slate-500 text-xs sm:text-sm mt-1">اختر الباقة المناسبة لمادتك واستمتع بتصحيح ذكي فوري بالذكاء الاصطناعي</p>
              </div>
              <div className="flex justify-center mb-6">
                <button
                  onClick={() => openPlansModal()}
                  className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-base px-8 py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles size={20} />
                  <span>عرض جميع تفاصيل الباقات وطرق الدفع (فودافون كاش / إنستاباي)</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
        {mode === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-center mb-4">
                <img src={logo} alt="Logo" className="h-16 w-16 object-contain rounded-full border border-indigo-50" />
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800">لوحة التحكم</h2>
                <button 
                  disabled={isRefreshing}
                  onClick={async () => {
                    setIsRefreshing(true);
                    setRefreshError(null);
                    setIsErrorDismissed(false);
                    try {
                      const res = await fetch('/api/check-env');
                      if (res.ok) {
                        const data = await res.json();
                        setApiStatus(data);
                      } else {
                        throw new Error(`فشل الاتصال: ${res.statusText}`);
                      }
                    } catch (e: any) {
                      setRefreshError(e.message || 'حدث خطأ غير معروف');
                    } finally {
                      setIsRefreshing(false);
                    }
                  }}
                  className="mt-2 text-[10px] sm:text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1 disabled:opacity-50 inline-flex"
                >
                  <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                  {isRefreshing ? 'جاري التحديث...' : 'تحديث الحالة'}
                </button>
                {(user?.role === 'admin' || user?.isAdmin) && (
                  <button 
                    onClick={async () => {
                      try {
                        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => token || '') : (token || '');
                        if (!idToken) {
                          alert('جلسة العمل غير صالحة. يرجى تسجيل الخروج والدخول مرة أخرى.');
                          return;
                        }

                        const res = await fetch('/api/test-smtp-connection', {
                          method: 'POST',
                          headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${idToken}` 
                          }
                        });
                        
                        let data;
                        const contentType = res.headers.get("content-type");
                        if (contentType && contentType.indexOf("application/json") !== -1) {
                          data = await res.json();
                        } else {
                          // If we get HTML, it's likely a proxy error or a malformed request
                          const text = await res.text();
                          if (res.status === 403) {
                            throw new Error('فشل التحقق من الهوية (403). يرجى محاولة تسجيل الخروج والدخول مرة أخرى.');
                          }
                          throw new Error(`استجابة غير متوقعة من الخادم (${res.status})`);
                        }

                        if (res.ok) {
                          alert(data.message);
                        } else {
                          alert(data.error || 'فشل إرسال البريد');
                        }
                      } catch (e: any) {
                        console.error('Test email error:', e);
                        alert(`حدث خطأ: ${e.message}`);
                      }
                    }}
                    className="mt-2 text-[10px] sm:text-xs bg-emerald-600 text-white px-3 py-1 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1 ml-2 inline-flex"
                  >
                    <Mail size={12} />
                    تجربة البريد
                  </button>
                )}
                {(!isRefreshing && !isErrorDismissed && (apiStatus === null || !apiStatus.hasKey)) && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl animate-pulse">
                    <div className="flex justify-between items-start">
                      <p className="text-red-600 text-xs sm:text-sm font-bold flex items-center gap-2">
                        <XCircle size={18} />
                        {apiStatus === null ? 'جاري التحقق...' : 'تنبيه: مفتاح الـ API غير مفعل أو يحتوي على قيمة افتراضية'}
                      </p>
                      <button onClick={() => setIsErrorDismissed(true)} className="text-red-400 hover:text-red-600">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-2 w-full sm:w-auto">
                {user && user.role === 'admin' && (
                  <div className="bg-slate-50 text-slate-600 px-3 py-2 sm:px-4 rounded-xl border border-slate-200 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                    <Sparkles size={14} className="sm:w-4 sm:h-4 text-indigo-500" />
                    <span className="font-bold">استهلاكي:</span>
                    <span className="font-mono">{user.tokens_used?.toLocaleString() || 0}</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    setProfileData({
                      name: user?.name || '',
                      subject: user?.subject || '',
                      gradeLevel: typeof user?.grade_level === 'string' ? user.grade_level : (Array.isArray(user?.grade_level) ? user.grade_level.join('، ') : ''),
                      avatar_data: user?.avatar_data || '',
                      centers: user?.centers || [],
                      curriculum: user?.curriculum || '',
                      preferred_ai_model: (user?.preferred_ai_model === 'pro' ? 'pro' : 'flash') as 'flash' | 'pro'
                    });
                    setShowProfileModal(true);
                  }}
                  className="bg-white text-slate-700 px-3 py-2 sm:px-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
                >
                  <Settings size={18} className="sm:w-5 sm:h-5" />
                  الإعدادات
                </button>
                <button
                  onClick={() => fetchResults('all')}
                  className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 px-3 py-2 sm:px-4 rounded-xl transition-colors flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold shadow-2xs cursor-pointer"
                  title="عرض نتائج ودرجات الطلاب عبر جميع الاختبارات"
                >
                  <Award size={18} className="sm:w-5 sm:h-5 text-indigo-600 shrink-0" />
                  <span className="hidden sm:inline">نتائج ودرجات الطلاب</span>
                  <span className="sm:hidden">النتائج</span>
                </button>
                <button
                  onClick={() => setShowTeacherStudentsModal(true)}
                  className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-3 py-2 sm:px-4 rounded-xl transition-colors flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold shadow-2xs cursor-pointer"
                  title="عرض بيانات وقاعدة طلابي"
                >
                  <Users size={18} className="sm:w-5 sm:h-5 shrink-0" />
                  <span className="hidden sm:inline">بيانات طلابي</span>
                  <span className="sm:hidden">طلابي</span>
                </button>
                <button
                  onClick={() => setShowTokenCalculator(true)}
                  className="bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 border border-indigo-200 px-3 py-2 sm:px-4 rounded-xl transition-all flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold shadow-2xs cursor-pointer"
                  title="احسب استهلاكك المتوقع من التوكنز والتكلفة التقديرية"
                >
                  <Calculator size={18} className="text-indigo-600 sm:w-5 sm:h-5 shrink-0" />
                  <span className="hidden sm:inline">حاسبة التوكنز والأسعار</span>
                  <span className="sm:hidden">حاسبة التوكنز</span>
                </button>
                <button
                  onClick={() => setShowTechnicalReportModal(true)}
                  className="bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 px-3 py-2 sm:px-4 rounded-xl transition-colors flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold shadow-2xs cursor-pointer"
                  title="عرض وتحميل التقرير الفني الشامل لحالة النظام"
                >
                  <FileText size={18} className="sm:w-5 sm:h-5 text-amber-700 shrink-0" />
                  <span className="hidden sm:inline">التقرير الفني للنظام</span>
                  <span className="sm:hidden">التقرير الفني</span>
                </button>
                {(user?.role === 'admin' || user?.isAdmin || (user?.email && user.email.toLowerCase().trim() === 'gergesnabil101@gmail.com') || user?.role === 'teacher' || getUserTokenStats(user).isTokenSystem) && (
                  <button
                    onClick={() => {
                      const isAdm = user?.role === 'admin' || user?.isAdmin || (user?.email && user.email.toLowerCase().trim() === 'gergesnabil101@gmail.com');
                      if (!isAdm) {
                        setSelectedUserForTokenBilling(user);
                      }
                      setShowTokenBilling(true);
                    }}
                    className="bg-gradient-to-r from-amber-50 via-purple-50 to-indigo-50 hover:from-amber-100 hover:to-indigo-100 text-purple-700 border border-purple-200 px-3 py-2 sm:px-4 rounded-xl transition-all flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold shadow-2xs cursor-pointer"
                    title={
                      (user?.role === 'admin' || user?.isAdmin || (user?.email && user.email.toLowerCase().trim() === 'gergesnabil101@gmail.com'))
                        ? "عرض فاتورة استهلاك التوكنز والتكلفة الفعلية للمطور (سعر API الحقيقي) الشاملة لكافة الحسابات"
                        : "عرض فاتورة استهلاك باقة التوكنز (200 جنيه مصري لكل 1 مليون توكن)"
                    }
                  >
                    <Receipt size={18} className="text-purple-600 sm:w-5 sm:h-5 shrink-0" />
                    <span className="hidden sm:inline">
                      {(user?.role === 'admin' || user?.isAdmin || (user?.email && user.email.toLowerCase().trim() === 'gergesnabil101@gmail.com'))
                        ? "فاتورة استهلاك التوكنز"
                        : "فاتورة التوكنز (200 ج.م/مليون)"}
                    </span>
                    <span className="sm:hidden">الفاتورة</span>
                  </button>
                )}
                {(user?.role === 'admin' || user?.isAdmin || (user?.email && user.email.toLowerCase().trim() === 'gergesnabil101@gmail.com')) && (
                  <button
                    onClick={() => setShowAdminPanel(!showAdminPanel)}
                    className="bg-amber-500 text-white px-3 py-2 sm:px-4 rounded-xl hover:bg-amber-600 transition-colors flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
                  >
                    <Lock size={18} className="sm:w-5 sm:h-5" />
                    لوحة الإدارة
                  </button>
                )}
                {user?.is_suspended ? (
                  <div className="flex items-center gap-2">
                    <div className="bg-red-50 text-red-700 px-3 py-2 sm:px-4 rounded-xl border border-red-200 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold">
                      <XCircle size={14} className="sm:w-4 sm:h-4" />
                      الحساب معلق
                    </div>
                    <button
                      onClick={() => openPlansModal()}
                      className="bg-white text-indigo-600 px-3 py-2 sm:px-4 rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-colors flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold"
                    >
                      <CreditCard size={14} className="sm:w-4 sm:h-4" />
                      تجديد / ترقية
                    </button>
                  </div>
                ) : user?.hasPendingSubscription ? (
                  <div className="bg-amber-50 text-amber-700 px-3 py-2 sm:px-4 rounded-xl border border-amber-200 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold">
                    <Loader2 size={14} className="animate-spin sm:w-4 sm:h-4" />
                    قيد المراجعة
                  </div>
                ) : user?.isActive ? (
                  <div className="flex items-center gap-2">
                    <div className="bg-emerald-50 text-emerald-700 px-3 py-2 sm:px-4 rounded-xl border border-emerald-200 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold">
                      <CheckCircle size={14} className="sm:w-4 sm:h-4" />
                      مفعل
                    </div>
                    <button
                      onClick={() => openPlansModal()}
                      className="bg-white text-indigo-600 px-3 py-2 sm:px-4 rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-colors flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold"
                    >
                      <CreditCard size={14} className="sm:w-4 sm:h-4" />
                      تجديد / ترقية
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="bg-amber-50 text-amber-800 px-3 py-1.5 sm:px-3.5 rounded-xl border border-amber-200 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold">
                      <Sparkles size={14} className="text-amber-600 sm:w-4 sm:h-4" />
                      <span>الباقة المجانية ({quizzes.length}/3 اختبارات)</span>
                    </div>
                    <button
                      onClick={() => openPlansModal()}
                      className="bg-white text-indigo-600 px-3 py-2 sm:px-4 rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-colors flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold shadow-xs"
                    >
                      <CreditCard size={16} className="sm:w-4 sm:h-4 text-indigo-600" />
                      الاشتراك
                    </button>
                  </div>
                )}
                <button
                  onClick={() => createNewQuiz()}
                  className="bg-indigo-600 text-white px-3 py-2 sm:px-4 rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm shadow-xs"
                >
                  <PlusCircle size={18} className="sm:w-5 sm:h-5" />
                  اختبار جديد
                </button>
              </div>
            </div>

            {showAdminPanel && (user?.role === 'admin' || user?.isAdmin || (user?.email && user.email.toLowerCase().trim() === 'gergesnabil101@gmail.com')) && (
              <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 animate-in fade-in slide-in-from-top-4 duration-300 space-y-8">
                <div>
                  <h3 className="text-xl font-bold text-amber-900 mb-4 flex items-center gap-2">
                    <Users size={24} />
                    طلبات الاشتراك المعلقة ({adminRequests.length})
                  </h3>
                  {adminRequests.length === 0 ? (
                    <p className="text-amber-700 text-center py-8">لا توجد طلبات معلقة حالياً.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {adminRequests.map((req, reqIdx) => (
                        <div key={`${req.id || 'req'}-${reqIdx}`} className="bg-white p-4 rounded-xl shadow-sm border border-amber-200">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-bold text-slate-800">{req.user_name || 'بدون اسم'}</p>
                              <p className="text-xs text-slate-500 font-mono" dir="ltr">{req.user_email}</p>
                              {req.user_subject && (
                                <p className="text-xs text-blue-600 font-semibold mt-0.5 flex items-center gap-1">
                                  <BookOpen size={12} />
                                  مادة: {req.user_subject}
                                </p>
                              )}
                              <p className="text-xs font-bold text-indigo-600 mt-1">
                                الباقة: {formatPlanLabel(req.plan, req.billing_cycle)}
                              </p>
                              {req.user_phone && (
                                <div className="mt-2 flex items-center gap-2">
                                  <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200" dir="ltr">
                                    {req.user_phone}
                                  </span>
                                  <button
                                    onClick={() => sendWhatsAppToTeacher({ name: req.user_name, phone: req.user_phone, subject: req.user_subject, email: req.user_email })}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                                    title="مراسلة عبر واتساب"
                                  >
                                    <MessageCircle size={12} />
                                    واتساب
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => approveRequest(req.id)}
                                className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold hover:bg-emerald-600 transition-colors shadow-xs cursor-pointer"
                              >
                                تفعيل الحساب
                              </button>
                              <button
                                onClick={() => deleteRequest(req.id)}
                                className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:text-red-700 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                                title="حذف طلب الاشتراك"
                              >
                                <Trash2 size={14} />
                                <span>حذف</span>
                              </button>
                            </div>
                          </div>
                          <div className="mt-3 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-xs text-amber-900 font-bold flex items-center gap-1">
                                <span>صورة إيصال الدفع:</span>
                              </p>
                              <button
                                onClick={() => deleteRequest(req.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-100/70 px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                title="حذف هذا الطلب مع الإيصال"
                              >
                                <Trash2 size={12} />
                                <span>حذف الطلب والإيصال</span>
                              </button>
                            </div>
                            <img 
                              src={req.screenshot_data} 
                              alt="Payment Proof" 
                              className="w-full h-44 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-95 transition-opacity"
                              onClick={() => window.open(req.screenshot_data, '_blank')}
                            />
                            <p className="text-[10px] text-slate-400 text-center mt-1">اضغط على الصورة لفتحها بالحجم الكامل</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-amber-200 pt-8">
                  {(() => {
                    const now = new Date();

                    const getUserCategoryInfo = (u: any) => getUserCategoryInfoUnified(u, now);

                    const activeCount = allUsers.filter(u => getUserCategoryInfo(u).category === 'active').length;
                    const trialUsersList = allUsers.filter(u => getUserCategoryInfo(u).category === 'trial');
                    const trialCount = trialUsersList.length;
                    const closedCount = allUsers.filter(u => {
                      const cat = getUserCategoryInfo(u);
                      return cat.category === 'closed' || (cat.category === 'trial' && cat.isExpiredTrial) || u.is_suspended || u.subscription_status === 'expired' || u.subscription_status === 'cancelled';
                    }).length;
                    const proUsersList = allUsers.filter(u => u.preferred_ai_model === 'gemini_pro' || u.preferred_ai_model === 'pro' || String(u.subscription_type || '').includes('pro'));
                    const proCount = proUsersList.length;

                    const expiringSoonTrialsCount = trialUsersList.filter(u => {
                      const info = getUserCategoryInfo(u);
                      return !info.isExpiredTrial && info.daysLeft !== null && info.daysLeft <= 2;
                    }).length;
                    const newlyRegisteredTrialsCount = trialUsersList.filter(u => {
                      const c = parseSafeDate(u.created_at || u.createdAt, new Date(0));
                      return (now.getTime() - c.getTime()) <= 48 * 60 * 60 * 1000;
                    }).length;
                    const newlyRegisteredList = allUsers.filter(u => {
                      const c = parseSafeDate(u.created_at || u.createdAt, new Date(0));
                      const isRecent = (now.getTime() - c.getTime()) <= 7 * 24 * 60 * 60 * 1000;
                      return isRecent || u.isPendingRequestOnly || u.subscription_status === 'pending_approval';
                    });
                    const newlyRegisteredCount = newlyRegisteredList.length;
                    const trialTotalTokensUsed = trialUsersList.reduce((sum, u) => sum + (getUserTokenStats(u).used || 0), 0);

                    // Filtered users by category + search query
                    const totalTodayTokens = allUsers.reduce((sum, u) => sum + (getUserTokenStats(u).todayUsed || 0), 0);
                    const activeTodayTeachersCount = allUsers.filter((u) => (getUserTokenStats(u).todayUsed || 0) > 0).length;

                    const filteredUsers = allUsers.filter((u) => {
                      const catInfo = getUserCategoryInfo(u);

                      // Search query matching (searches all accounts across categories)
                      if (adminUserSearch.trim()) {
                        const q = adminUserSearch.trim().toLowerCase();
                        return (
                          (u.name && u.name.toLowerCase().includes(q)) ||
                          (u.email && u.email.toLowerCase().includes(q)) ||
                          (u.phone && String(u.phone).toLowerCase().includes(q)) ||
                          (u.subject && u.subject.toLowerCase().includes(q)) ||
                          (u.grade_level && String(u.grade_level).toLowerCase().includes(q)) ||
                          (catInfo.statusText && catInfo.statusText.toLowerCase().includes(q)) ||
                          (catInfo.categoryLabel && catInfo.categoryLabel.toLowerCase().includes(q))
                        );
                      }

                      if (adminUserCategoryFilter === 'active_today') {
                        const s = getUserTokenStats(u);
                        if ((s.todayUsed || 0) <= 0) return false;
                      } else if (adminUserCategoryFilter === 'pro') {
                        const isPro = u.preferred_ai_model === 'gemini_pro' || u.preferred_ai_model === 'pro' || String(u.subscription_type || '').includes('pro');
                        if (!isPro) return false;
                      } else if (adminUserCategoryFilter === 'new') {
                        const c = parseSafeDate(u.created_at || u.createdAt, new Date(0));
                        const isRecent = (now.getTime() - c.getTime()) <= 7 * 24 * 60 * 60 * 1000;
                        if (!isRecent && !u.isPendingRequestOnly && u.subscription_status !== 'pending_approval') return false;
                      } else if (adminUserCategoryFilter === 'trial') {
                        return catInfo.category === 'trial';
                      } else if (adminUserCategoryFilter === 'closed') {
                        return catInfo.category === 'closed' || (catInfo.category === 'trial' && catInfo.isExpiredTrial) || u.is_suspended || u.subscription_status === 'expired' || u.subscription_status === 'cancelled';
                      } else if (adminUserCategoryFilter !== 'all' && catInfo.category !== adminUserCategoryFilter) {
                        return false;
                      }

                      return true;
                    });

                    const totalUserPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE) || 1;
                    const paginatedUsers = filteredUsers.slice(
                      (adminUsersPage - 1) * USERS_PER_PAGE,
                      adminUsersPage * USERS_PER_PAGE
                    );

                    return (
                      <div className="space-y-6">
                        {/* Top Header & Statistics Cards */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                              <Users size={24} />
                            </div>
                            <div>
                              <h3 className="text-xl font-black text-amber-950 flex items-center gap-2">
                                إدارة وتنظيم المشتركين
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-200/90 text-amber-900 font-mono font-bold">
                                  {allUsers.length} حساب
                                </span>
                              </h3>
                              <p className="text-xs text-amber-800/80 mt-0.5">
                                إدارة شاملة للحسابات مع فصل الحسابات التجريبية في قائمة مخصصة لمتابعتها وترقيتها
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5">
                            <button
                              onClick={() => handleMasterUpdateAndReconcileTokens()}
                              disabled={isLoadingAdminData}
                              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white border border-amber-400/50 shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-xs font-black disabled:opacity-50 cursor-pointer active:scale-95"
                              title="الزر الموحد والشامل: تدقيق ومزامنة كافة الحسابات، تدقيق حساب هاني ثروت وحسابات الجميع، ومطابقة استهلاك التوكنز الحقيقي بالسجلات الدقيقة فورياً"
                            >
                              <Zap size={16} className={isLoadingAdminData ? "animate-spin text-amber-200" : "text-amber-200 fill-amber-300"} />
                              <span>{isLoadingAdminData ? "جاري التحديث والمطابقة الصارمة لجميع الحسابات..." : "تحديث ومطابقة التوكنز لجميع الحسابات ⚡"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAdminUserCategoryFilter(prev => prev === 'active_today' ? 'all' : 'active_today');
                                setAdminUsersPage(1);
                              }}
                              className={`px-3.5 py-2 rounded-xl border font-bold flex items-center gap-2 shadow-xs text-xs cursor-pointer transition-all ${
                                adminUserCategoryFilter === 'active_today'
                                  ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-300'
                                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                              }`}
                              title="انقر لتصفية وعرض المعلمين النشطين الذين استهلكوا توكنز اليوم فقط"
                            >
                              <Zap size={16} className={adminUserCategoryFilter === 'active_today' ? 'text-white fill-white' : 'text-amber-600 fill-amber-500'} />
                              <span>استهلاك AI اليوم:</span>
                              <span className="font-mono text-sm font-black">
                                {totalTodayTokens.toLocaleString()}
                              </span>
                              {activeTodayTeachersCount > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                  adminUserCategoryFilter === 'active_today'
                                    ? 'bg-white/25 text-white'
                                    : 'bg-amber-200/80 text-amber-900'
                                }`}>
                                  ({activeTodayTeachersCount} نشط اليوم 🔍)
                                </span>
                              )}
                            </button>

                            <div className="bg-emerald-50 text-emerald-900 px-3.5 py-2 rounded-xl border border-emerald-200 font-bold flex items-center gap-2 shadow-xs text-xs">
                              <Sparkles size={16} className="text-emerald-600" />
                              <span>استهلاك AI الشامل:</span>
                              <span className="font-mono text-sm font-black text-emerald-700" title="إجمالي الاستهلاك التراكمي لجميع المعلمين والمشتركين">
                                {allUsers.reduce((sum, u) => sum + (getUserTokenStats(u).lifetimeUsed || getUserTokenStats(u).used || 0), 0).toLocaleString()}
                              </span>
                              <span className="text-[10px] text-emerald-700/80 bg-emerald-100/70 px-1.5 py-0.5 rounded font-semibold" title="مجموع استهلاك الدورات الحالية النشطة">
                                (الدورة: {allUsers.reduce((sum, u) => sum + (getUserTokenStats(u).used || 0), 0).toLocaleString()})
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Real-Time Audit & Sync Notification Banner */}
                        {auditSyncNotice && auditSyncNotice.isOpen && (
                          <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-indigo-800 text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-emerald-400/50 animate-in fade-in slide-in-from-top-2 relative overflow-hidden">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3.5">
                                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-xs border border-white/20">
                                  <CheckCircle2 size={24} className="text-emerald-200" />
                                </div>
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="font-black text-sm sm:text-base flex items-center gap-2">
                                      <span>✅ تم فحص وتدقيق وتحديث كافة الحسابات وتوزيعها بالقوائم بنجاح! 🔄</span>
                                    </h4>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-xs font-mono font-bold">
                                      {auditSyncNotice.timestamp ? new Date(auditSyncNotice.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                                    </span>
                                  </div>
                                  <p className="text-xs text-emerald-100 leading-relaxed">
                                    {auditSyncNotice.newlyAdded > 0 
                                      ? `🎉 تم اكتشاف وإضافة (${auditSyncNotice.newlyAdded}) حساب جديد وحفظهم في قاعدة البيانات وتثبيتهم بالقوائم فورياً.`
                                      : 'كافة الحسابات مفحوصة ومحدثة بالكامل مع قاعدة البيانات وكافة الفئات متزامنة.'}
                                  </p>

                                  {/* Quick Jump Buttons into every category list */}
                                  <div className="flex flex-wrap items-center gap-2 pt-2.5">
                                    <span className="text-[11px] text-white/90 font-bold ml-1">انتقل مباشرة للقائمة:</span>
                                    
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAdminUserCategoryFilter('trial');
                                        setAdminUserSearch('');
                                        setAdminUsersPage(1);
                                      }}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                                        adminUserCategoryFilter === 'trial'
                                          ? 'bg-amber-400 text-amber-950 ring-2 ring-white scale-105'
                                          : 'bg-white/20 hover:bg-white/30 text-white'
                                      }`}
                                    >
                                      <Clock size={13} />
                                      <span>الحسابات التجريبية</span>
                                      <span className="px-1.5 py-0.2 rounded-md bg-amber-500 text-white font-mono text-[10px] font-black">
                                        {auditSyncNotice.trial}
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAdminUserCategoryFilter('active');
                                        setAdminUserSearch('');
                                        setAdminUsersPage(1);
                                      }}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                                        adminUserCategoryFilter === 'active'
                                          ? 'bg-emerald-300 text-emerald-950 ring-2 ring-white scale-105'
                                          : 'bg-white/20 hover:bg-white/30 text-white'
                                      }`}
                                    >
                                      <CheckCircle2 size={13} />
                                      <span>المشتركون المفعلون</span>
                                      <span className="px-1.5 py-0.2 rounded-md bg-emerald-700 text-white font-mono text-[10px] font-black">
                                        {auditSyncNotice.active}
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAdminUserCategoryFilter('closed');
                                        setAdminUserSearch('');
                                        setAdminUsersPage(1);
                                      }}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                                        adminUserCategoryFilter === 'closed'
                                          ? 'bg-rose-300 text-rose-950 ring-2 ring-white scale-105'
                                          : 'bg-white/20 hover:bg-white/30 text-white'
                                      }`}
                                    >
                                      <Lock size={13} />
                                      <span>المغلقة والمنتهية</span>
                                      <span className="px-1.5 py-0.2 rounded-md bg-rose-700 text-white font-mono text-[10px] font-black">
                                        {auditSyncNotice.closed}
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAdminUserCategoryFilter('new');
                                        setAdminUserSearch('');
                                        setAdminUsersPage(1);
                                      }}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                                        adminUserCategoryFilter === 'new'
                                          ? 'bg-amber-300 text-amber-950 ring-2 ring-white scale-105'
                                          : 'bg-white/20 hover:bg-white/30 text-white'
                                      }`}
                                    >
                                      <Sparkles size={13} />
                                      <span>المشتركون الجدد ✨</span>
                                      <span className="px-1.5 py-0.2 rounded-md bg-amber-600 text-white font-mono text-[10px] font-black">
                                        {auditSyncNotice.recent}
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAdminUserCategoryFilter('all');
                                        setAdminUserSearch('');
                                        setAdminUsersPage(1);
                                      }}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                                        adminUserCategoryFilter === 'all'
                                          ? 'bg-white text-indigo-950 ring-2 ring-white scale-105'
                                          : 'bg-white/20 hover:bg-white/30 text-white'
                                      }`}
                                    >
                                      <Users size={13} />
                                      <span>كافة الحسابات</span>
                                      <span className="px-1.5 py-0.2 rounded-md bg-indigo-900 text-white font-mono text-[10px] font-black">
                                        {auditSyncNotice.total}
                                      </span>
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setAuditSyncNotice(null)}
                                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/25 text-white/80 hover:text-white transition-colors cursor-pointer shrink-0"
                                title="إغلاق الإشعار"
                              >
                                <X size={18} />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Top Main Navigation Tabs */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          {/* Tab 1: Trial Accounts (Separated & Prominent) */}
                          <button
                            type="button"
                            onClick={() => {
                              setAdminUserCategoryFilter('trial');
                              setAdminUsersPage(1);
                            }}
                            className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                              adminUserCategoryFilter === 'trial'
                                ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-300'
                                : 'bg-white hover:bg-amber-50/50 text-slate-800 border-amber-200/90 shadow-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full mb-2">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-black ${adminUserCategoryFilter === 'trial' ? 'text-white' : 'text-amber-800'}`}>
                                  ⭐ الحسابات التجريبية
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${adminUserCategoryFilter === 'trial' ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-800'}`}>
                                  قائمة منفصلة
                                </span>
                              </div>
                              <div className={`p-2 rounded-xl ${adminUserCategoryFilter === 'trial' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                                <Clock size={18} />
                              </div>
                            </div>
                            <div className="flex items-baseline justify-between w-full">
                              <span className="text-2xl font-black font-mono" style={{ color: adminUserCategoryFilter === 'trial' ? '#ffffff' : undefined }}>
                                {trialCount}
                              </span>
                              <span className={`text-[11px] font-semibold ${adminUserCategoryFilter === 'trial' ? 'text-amber-100' : 'text-amber-700'}`}>
                                {expiringSoonTrialsCount > 0 ? `(${expiringSoonTrialsCount} تنتهي قريباً)` : `فترة مجانية`}
                              </span>
                            </div>
                          </button>

                          {/* Tab 2: Active Accounts */}
                          <button
                            type="button"
                            onClick={() => {
                              setAdminUserCategoryFilter('active');
                              setAdminUsersPage(1);
                            }}
                            className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                              adminUserCategoryFilter === 'active'
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300'
                                : 'bg-white hover:bg-emerald-50/40 text-slate-800 border-emerald-200/80 shadow-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full mb-2">
                              <span className={`text-xs font-bold ${adminUserCategoryFilter === 'active' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                                المشتركون المفعّلون
                              </span>
                              <div className={`p-2 rounded-xl ${adminUserCategoryFilter === 'active' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                                <ShieldCheck size={18} />
                              </div>
                            </div>
                            <div className="flex items-baseline justify-between w-full">
                              <span className="text-2xl font-black font-mono text-emerald-600" style={{ color: adminUserCategoryFilter === 'active' ? '#ffffff' : undefined }}>
                                {activeCount}
                              </span>
                              <span className={`text-[11px] font-semibold ${adminUserCategoryFilter === 'active' ? 'text-emerald-200' : 'text-emerald-600/80'}`}>
                                اشتراكات نشطة ({allUsers.length > 0 ? Math.round((activeCount / allUsers.length) * 100) : 0}%)
                              </span>
                            </div>
                          </button>

                          {/* Tab 3: Pro Accounts (Gemini Pro) */}
                          <button
                            type="button"
                            onClick={() => {
                              setAdminUserCategoryFilter('pro');
                              setAdminUsersPage(1);
                            }}
                            className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                              adminUserCategoryFilter === 'pro'
                                ? 'bg-gradient-to-br from-purple-700 to-indigo-800 text-white border-purple-700 shadow-md ring-2 ring-purple-400'
                                : 'bg-white hover:bg-purple-50/50 text-slate-800 border-purple-200/90 shadow-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full mb-2">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-black ${adminUserCategoryFilter === 'pro' ? 'text-white' : 'text-purple-900'}`}>
                                  👑 نظام برو (Pro)
                                </span>
                              </div>
                              <div className={`p-2 rounded-xl ${adminUserCategoryFilter === 'pro' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'}`}>
                                <Crown size={18} className="fill-amber-300 text-amber-300" />
                              </div>
                            </div>
                            <div className="flex items-baseline justify-between w-full">
                              <span className="text-2xl font-black font-mono text-purple-700" style={{ color: adminUserCategoryFilter === 'pro' ? '#ffffff' : undefined }}>
                                {proCount}
                              </span>
                              <span className={`text-[11px] font-semibold ${adminUserCategoryFilter === 'pro' ? 'text-purple-200' : 'text-purple-600'}`}>
                                معلمين على Gemini Pro
                              </span>
                            </div>
                          </button>

                          {/* Tab 4: Closed Accounts */}
                          <button
                            type="button"
                            onClick={() => {
                              setAdminUserCategoryFilter('closed');
                              setAdminUsersPage(1);
                            }}
                            className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                              adminUserCategoryFilter === 'closed'
                                ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-300'
                                : 'bg-white hover:bg-rose-50/40 text-slate-800 border-rose-200/80 shadow-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full mb-2">
                              <span className={`text-xs font-bold ${adminUserCategoryFilter === 'closed' ? 'text-rose-100' : 'text-rose-700'}`}>
                                حسابات مغلقة ومنتهية
                              </span>
                              <div className={`p-2 rounded-xl ${adminUserCategoryFilter === 'closed' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'}`}>
                                <Lock size={18} />
                              </div>
                            </div>
                            <div className="flex items-baseline justify-between w-full">
                              <span className="text-2xl font-black font-mono text-rose-600" style={{ color: adminUserCategoryFilter === 'closed' ? '#ffffff' : undefined }}>
                                {closedCount}
                              </span>
                              <span className={`text-[11px] font-semibold ${adminUserCategoryFilter === 'closed' ? 'text-rose-200' : 'text-rose-600/80'}`}>
                                معلقة أو منتهية
                              </span>
                            </div>
                          </button>

                          {/* Tab 5: All Accounts */}
                          <button
                            type="button"
                            onClick={() => {
                              setAdminUserCategoryFilter('all');
                              setAdminUsersPage(1);
                            }}
                            className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                              adminUserCategoryFilter === 'all'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300'
                                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full mb-2">
                              <span className={`text-xs font-bold ${adminUserCategoryFilter === 'all' ? 'text-indigo-100' : 'text-slate-500'}`}>
                                جميع الحسابات
                              </span>
                              <div className={`p-2 rounded-xl ${adminUserCategoryFilter === 'all' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                                <Users size={18} />
                              </div>
                            </div>
                            <div className="flex items-baseline justify-between w-full">
                              <span className="text-2xl font-black font-mono">{allUsers.length}</span>
                              <span className={`text-[11px] font-semibold ${adminUserCategoryFilter === 'all' ? 'text-indigo-200' : 'text-slate-400'}`}>
                                إجمالي المسجلين
                              </span>
                            </div>
                          </button>
                        </div>

                        {/* Special Dedicated Trial Hub Banner when in 'trial' tab */}
                        {adminUserCategoryFilter === 'trial' && (
                          <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                            <div className="absolute -left-10 -bottom-10 opacity-15 pointer-events-none">
                              <Clock size={160} />
                            </div>
                            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="space-y-1 max-w-2xl">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-black">
                                  <Clock size={14} />
                                  <span>قائمة مخصصة لمتابعة الحسابات التجريبية</span>
                                </div>
                                <h4 className="text-lg font-black">
                                  إدارة ومتابعة المشتركين في الفترة التجريبية ({TRIAL_DAYS} أيام)
                                </h4>
                                <p className="text-xs text-amber-100 leading-relaxed">
                                  يمكنك مراقبة استهلاك كل معلم خلال التجربة، تمديد التجربة بنقرة واحدة، التواصل المباشر عبر واتساب، أو ترقية المعلم إلى الباقة المدفوعة فوراً.
                                </p>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 shrink-0">
                                <div className="bg-white/15 backdrop-blur-xs p-2.5 rounded-xl border border-white/20 text-center">
                                  <div className="text-[10px] text-amber-100 font-bold">في التجربة حالياً</div>
                                  <div className="text-lg font-black font-mono">{trialCount} معلم</div>
                                </div>
                                <div className="bg-white/15 backdrop-blur-xs p-2.5 rounded-xl border border-white/20 text-center">
                                  <div className="text-[10px] text-amber-100 font-bold">تنتهي قريباً (≤ 48 س)</div>
                                  <div className="text-lg font-black font-mono text-amber-200">{expiringSoonTrialsCount} معلم</div>
                                </div>
                                <div className="bg-white/15 backdrop-blur-xs p-2.5 rounded-xl border border-white/20 text-center col-span-2 sm:col-span-1">
                                  <div className="text-[10px] text-amber-100 font-bold">توكنز التجربة المستهلكة</div>
                                  <div className="text-base font-black font-mono">{trialTotalTokensUsed.toLocaleString()}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* New Subscriber Alert Banner */}
                        {newlyRegisteredCount > 0 && adminUserCategoryFilter !== 'new' && (
                          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 rounded-2xl p-3.5 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-xs">
                                <Sparkles size={20} className="text-amber-200" />
                              </div>
                              <div>
                                <h5 className="font-black text-sm flex items-center gap-2">
                                  <span>✨ يوجد {newlyRegisteredCount} مشترك جديد مسجل حديثاً في المنصة!</span>
                                </h5>
                                <p className="text-[11px] text-amber-100 mt-0.5">
                                  تم إدراجهم وتفعيلهم تلقائياً في قائمة الحسابات التجريبية لمتابعتهم وترقيتهم فوراً.
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setAdminUserCategoryFilter('new');
                                setAdminUserSearch('');
                                setAdminUsersPage(1);
                              }}
                              className="px-4 py-2 bg-white text-indigo-950 hover:bg-amber-50 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer shrink-0 flex items-center gap-1.5 self-start sm:self-auto border border-white/40"
                            >
                              <span>عرض المشتركين الجدد الآن 👈</span>
                              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded-md font-mono text-[11px] font-bold">
                                {newlyRegisteredCount}
                              </span>
                            </button>
                          </div>
                        )}

                        {/* Filter Tabs & Search Bar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-amber-200/80 shadow-xs">
                          {/* Segmented Filter Pills */}
                          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl">
                            <button
                              type="button"
                              onClick={() => {
                                setAdminUserCategoryFilter('trial');
                                setAdminUsersPage(1);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                adminUserCategoryFilter === 'trial'
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'text-amber-800 hover:bg-amber-50'
                              }`}
                            >
                              <Clock size={14} />
                              <span>الحسابات التجريبية</span>
                              <span className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] ${
                                adminUserCategoryFilter === 'trial' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {trialCount}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAdminUserCategoryFilter('active');
                                setAdminUsersPage(1);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                adminUserCategoryFilter === 'active'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              <CheckCircle2 size={14} />
                              <span>المفعلة</span>
                              <span className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] ${
                                adminUserCategoryFilter === 'active' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {activeCount}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAdminUserCategoryFilter('pro');
                                setAdminUsersPage(1);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                adminUserCategoryFilter === 'pro'
                                  ? 'bg-purple-700 text-white shadow-xs'
                                  : 'text-purple-800 hover:bg-purple-50'
                              }`}
                            >
                              <Crown size={14} className={adminUserCategoryFilter === 'pro' ? 'text-amber-300 fill-amber-300' : 'text-purple-600'} />
                              <span>نظام برو 👑</span>
                              <span className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] ${
                                adminUserCategoryFilter === 'pro' ? 'bg-purple-900 text-white' : 'bg-purple-100 text-purple-800'
                              }`}>
                                {proCount}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAdminUserCategoryFilter('closed');
                                setAdminUsersPage(1);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                adminUserCategoryFilter === 'closed'
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'text-rose-700 hover:bg-rose-50'
                              }`}
                            >
                              <Lock size={14} />
                              <span>مغلقة ومنتهية</span>
                              <span className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] ${
                                adminUserCategoryFilter === 'closed' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {closedCount}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAdminUserCategoryFilter('active_today');
                                setAdminUsersPage(1);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                adminUserCategoryFilter === 'active_today'
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'text-amber-800 hover:bg-amber-100/70'
                              }`}
                            >
                              <Zap size={14} className={adminUserCategoryFilter === 'active_today' ? 'text-white fill-white' : 'text-amber-600 fill-amber-500'} />
                              <span>نشط اليوم 🔥</span>
                              <span className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] ${
                                adminUserCategoryFilter === 'active_today' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'
                              }`}>
                                {activeTodayTeachersCount}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAdminUserCategoryFilter('all');
                                setAdminUsersPage(1);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                adminUserCategoryFilter === 'all'
                                  ? 'bg-white text-indigo-700 shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <Users size={14} />
                              <span>الكل</span>
                              <span className="px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-700 font-mono text-[10px]">
                                {allUsers.length}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAdminUserCategoryFilter('new');
                                setAdminUsersPage(1);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                adminUserCategoryFilter === 'new'
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'text-amber-900 hover:text-amber-950 bg-amber-100/90 border border-amber-300'
                              }`}
                              title="عرض المشتركين الجدد والمسجلين حديثاً في المنصة"
                            >
                              <Sparkles size={14} className={adminUserCategoryFilter === 'new' ? 'text-amber-200 fill-amber-200' : 'text-amber-600'} />
                              <span>المشتركون الجدد ✨</span>
                              <span className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] ${adminUserCategoryFilter === 'new' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900 font-bold'}`}>
                                {newlyRegisteredCount}
                              </span>
                            </button>
                          </div>

                          {/* Search box */}
                          <div className="relative flex-1 max-w-md">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                              type="text"
                              placeholder={
                                adminUserCategoryFilter === 'trial'
                                  ? "ابحث في الحسابات التجريبية بالاسم، الواتساب، التخصص..."
                                  : "ابحث بالاسم، البريد، الواتساب، التخصص، أو الحالة..."
                              }
                              value={adminUserSearch}
                              onChange={(e) => {
                                setAdminUserSearch(e.target.value);
                                setAdminUsersPage(1);
                              }}
                              className="w-full pr-9 pl-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-xs"
                            />
                            {adminUserSearch && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAdminUserSearch('');
                                  setAdminUsersPage(1);
                                }}
                                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                                title="مسح البحث"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Deep User Lookup & Instant Restore Bar */}
                        <div className="bg-gradient-to-r from-amber-50 to-indigo-50/60 p-3.5 rounded-2xl border border-amber-200/90 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                              <UserCheck size={16} />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                                <span>فحص واسترجاع فوري لأي مشترك غير ظاهر</span>
                                <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-semibold">بحث سحابي مباشر ⚡</span>
                              </h4>
                              <p className="text-[11px] text-amber-800/80">اكتب البريد الإلكتروني أو رقم الهاتف لأي مشترك جديد لم يظهر لجلب ملفه وتثبيته فوراً</p>
                            </div>
                          </div>
                          <form 
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleDeepLookupUser(lookupUserQuery);
                            }}
                            className="flex items-center gap-2 flex-1 max-w-lg"
                          >
                            <div className="relative flex-1">
                              <input 
                                type="text"
                                placeholder="أدخل البريد الإلكتروني أو الهاتف أو المعرف..."
                                value={lookupUserQuery}
                                onChange={(e) => setLookupUserQuery(e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 placeholder:text-slate-400"
                                dir="ltr"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={isLookingUpUser || !lookupUserQuery.trim()}
                              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-xs disabled:opacity-50 cursor-pointer"
                            >
                              {isLookingUpUser ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                              <span>فحص واسترجاع</span>
                            </button>
                          </form>
                        </div>

                        {lookupResultMsg && (
                          <div className={`p-3 rounded-xl border text-xs font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in ${
                            lookupResultMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                            lookupResultMsg.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                            'bg-amber-50 border-amber-200 text-amber-900'
                          }`}>
                            <span>{lookupResultMsg.text}</span>
                            {lookupResultMsg.type === 'info' && lookupUserQuery.trim() && (
                              <button
                                type="button"
                                onClick={() => handleQuickCreateSubscriber(lookupUserQuery)}
                                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
                              >
                                ➕ إضافة وتفعيل المشترك فوراً
                              </button>
                            )}
                          </div>
                        )}

                        {/* Subscribers / Trial Accounts Table */}
                        <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-right text-sm">
                              <thead className={`${adminUserCategoryFilter === 'trial' ? 'bg-amber-500 text-white' : 'bg-amber-100/80 text-amber-950'}`}>
                                <tr>
                                  <th className="p-3.5 font-bold">المعلم / الاسم</th>
                                  <th className="p-3.5 font-bold">مادة التخصص</th>
                                  <th className="p-3.5 font-bold">رقم الواتساب والتواصل</th>
                                  <th className="p-3.5 font-bold">البريد الإلكتروني</th>
                                  <th className="p-3.5 font-bold">
                                    {adminUserCategoryFilter === 'trial' ? 'حالة ومدة التجربة' : 'تصنيف وحالة الحساب'}
                                  </th>
                                  <th className="p-3.5 font-bold">الباقة الحالية</th>
                                  <th className="p-3.5 font-bold">استهلاك التوكن (AI)</th>
                                  <th className="p-3.5 font-bold">تاريخ التسجيل</th>
                                  <th className="p-3.5 font-bold text-center">الإجراءات</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {isLoadingAdminData && allUsers.length === 0 ? (
                                  <tr>
                                    <td colSpan={9} className="p-12 text-center text-slate-500">
                                      <div className="flex flex-col items-center justify-center gap-2">
                                        <Loader2 className="animate-spin text-amber-600" size={32} />
                                        <span className="text-sm font-bold text-slate-700">جاري تحميل بيانات المشتركين...</span>
                                      </div>
                                    </td>
                                  </tr>
                                ) : allUsers.length === 0 ? (
                                  <tr>
                                    <td colSpan={9} className="p-12 text-center text-slate-500">
                                      <div className="flex flex-col items-center justify-center gap-2">
                                        <Users className="text-slate-300" size={36} />
                                        <span className="text-sm font-bold text-slate-700">لا توجد حسابات مسجلة حالياً.</span>
                                        <button
                                          type="button"
                                          onClick={() => fetchAdminData({ isManualClick: true })}
                                          className="mt-2 text-xs bg-amber-600 text-white px-3.5 py-2 rounded-xl hover:bg-amber-700 transition-colors font-bold cursor-pointer shadow-xs active:scale-95"
                                        >
                                          إعادة المحاولة وتحديث البيانات
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ) : filteredUsers.length === 0 ? (
                                  <tr>
                                    <td colSpan={9} className="p-12 text-center text-slate-500">
                                      <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                                        <AlertCircle className="text-amber-500" size={32} />
                                        <p className="text-sm font-bold text-slate-700">
                                          لا توجد نتائج مطابقة لخيارات التصفية الحالية.
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          {adminUserCategoryFilter !== 'all' ? `القائمة النشطة: (${adminUserCategoryFilter === 'trial' ? 'قائمة الحسابات التجريبية' : adminUserCategoryFilter === 'active' ? 'حسابات مفعلة' : 'حسابات مغلقة'})` : ''}
                                          {adminUserSearch ? ` | كلمة البحث: "${adminUserSearch}"` : ''}
                                        </p>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setAdminUserCategoryFilter('all');
                                            setAdminUserSearch('');
                                            setAdminUsersPage(1);
                                          }}
                                          className="mt-2 text-xs bg-indigo-600 text-white px-3.5 py-1.5 rounded-xl hover:bg-indigo-700 transition-colors font-bold cursor-pointer"
                                        >
                                          عرض كافة الحسابات
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ) : (
                                  paginatedUsers.map((u, userIdx) => {
                                    const createdAt = u.created_at ? new Date(u.created_at) : new Date(0);
                                    const catInfo = getUserCategoryInfo(u);
                                    const isTrialAccount = catInfo.category === 'trial';

                                    return (
                                      <tr key={`${u.id || u.uid || 'user'}-${userIdx}`} className={`hover:bg-amber-50/40 transition-colors ${isTrialAccount ? 'bg-amber-50/20' : ''}`}>
                                        <td className="p-3.5">
                                          <div className="flex items-center gap-2.5">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border ${
                                              isTrialAccount ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                                            }`}>
                                              {u.avatar_data ? (
                                                <img src={u.avatar_data} alt={u.name} className="w-full h-full object-cover" />
                                              ) : (
                                                (u.name || 'م').charAt(0)
                                              )}
                                            </div>
                                            <div>
                                              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                                <span>{u.name || 'بدون اسم'}</span>
                                                {isTrialAccount && (
                                                  <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-200 font-bold px-1.5 py-0.2 rounded-full">
                                                    تجريبي
                                                  </span>
                                                )}
                                              </div>
                                              {u.grade_level && (
                                                <div className="text-[11px] text-slate-500">{u.grade_level}</div>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="p-3.5">
                                          {u.subject ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold text-xs border border-blue-100 shadow-xs">
                                              <BookOpen size={13} className="text-blue-500" />
                                              {u.subject}
                                            </span>
                                          ) : (
                                            <span className="text-slate-400 text-xs italic">غير محددة</span>
                                          )}
                                        </td>
                                        <td className="p-3.5">
                                          {u.phone ? (
                                            <div className="flex items-center gap-2">
                                              <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200" dir="ltr">
                                                {u.phone}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => sendWhatsAppToTeacher(u, isTrialAccount ? 'trial' : 'general')}
                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer ${
                                                  isTrialAccount
                                                    ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-300'
                                                    : 'bg-emerald-600 hover:bg-emerald-700'
                                                }`}
                                                title={isTrialAccount ? `مراسلة متابعة الفترة التجريبية مع ${u.name || ''}` : `فتح محادثة واتساب مع ${u.name || ''}`}
                                              >
                                                <MessageCircle size={13} />
                                                <span>{isTrialAccount ? 'متابعة التجربة 💬' : 'واتساب'}</span>
                                              </button>
                                            </div>
                                          ) : (
                                            <span className="text-slate-400 text-xs italic flex items-center gap-1">
                                              <Phone size={12} className="text-slate-300" />
                                              غير مسجل
                                            </span>
                                          )}
                                        </td>
                                        <td className="p-3.5 text-slate-600 font-mono text-xs" dir="ltr">{u.email}</td>
                                        <td className="p-3.5">
                                          {isTrialAccount ? (
                                            <div className="flex flex-col gap-1 w-44">
                                              <div className="flex items-center justify-between">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                  catInfo.isExpiringSoon ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse' : 'bg-amber-100 text-amber-800 border border-amber-300'
                                                }`}>
                                                  <Clock size={12} className={catInfo.isExpiringSoon ? 'text-rose-600' : 'text-amber-600'} />
                                                  {catInfo.subText}
                                                </span>
                                              </div>
                                              {/* Trial Countdown bar */}
                                              <div className="w-full bg-amber-100 h-1.5 rounded-full overflow-hidden">
                                                <div
                                                  className={`h-full transition-all duration-300 ${catInfo.isExpiringSoon ? 'bg-rose-500' : 'bg-amber-500'}`}
                                                  style={{ width: `${Math.min(100, Math.max(10, ((catInfo.daysLeft || 1) / (catInfo.totalTrialDays || TRIAL_DAYS)) * 100))}%` }}
                                                />
                                              </div>
                                              <div className="flex justify-between text-[10px] text-slate-500">
                                                <span>تنتهي: {catInfo.expiryFormatted}</span>
                                                <span className="font-bold text-amber-800">
                                                  {catInfo.daysLeft} من {catInfo.totalTrialDays || TRIAL_DAYS} أيام
                                                </span>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="flex flex-col gap-1">
                                              <div className="flex items-center gap-1.5">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${catInfo.statusColor}`}>
                                                  {catInfo.category === 'active' && <CheckCircle2 size={12} className="text-emerald-600" />}
                                                  {catInfo.category === 'closed' && <Lock size={12} className="text-rose-600" />}
                                                  {catInfo.statusText}
                                                </span>
                                              </div>
                                              <span className="text-[11px] text-slate-500 font-medium">
                                                {catInfo.subText}
                                              </span>
                                            </div>
                                          )}
                                        </td>
                                        <td className="p-3.5 text-xs">
                                          {(() => {
                                            const isPro = u.preferred_ai_model === 'gemini_pro' || u.preferred_ai_model === 'pro' || String(u.subscription_type || '').includes('pro');
                                            return (
                                              <div className="flex flex-col gap-1 items-start">
                                                <span className="font-bold text-slate-900">
                                                  {formatPlanLabel(u.subscription_type, u.billing_cycle, u.custom_plan_name)}
                                                </span>
                                                {isPro ? (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-purple-700 to-indigo-700 text-white shadow-2xs">
                                                    <Crown size={10} className="text-amber-300 fill-amber-300" />
                                                    <span>نظام برو (Gemini Pro)</span>
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                    <Zap size={10} className="text-amber-500" />
                                                    <span>فلاش 3.8</span>
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })()}
                                        </td>
                                        <td className="p-3.5 text-slate-600 text-xs">
                                          {(() => {
                                            const stats = getUserTokenStats(u);
                                            const todayStr = new Date().toISOString().split('T')[0];
                                            const renewalDateStr = (u.subscription_renewal_date || u.subscription_start_date || '').split('T')[0];
                                            const isRenewedToday = renewalDateStr === todayStr && u.subscription_status === 'active';

                                            if (stats.isTokenSystem) {
                                              return (
                                                <div className="flex flex-col gap-1.5 w-56 bg-slate-50/90 p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                                                  {isRenewedToday && (
                                                    <div className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-md text-center flex items-center justify-center gap-1 shadow-2xs">
                                                      <span>✨ تم التجديد اليوم (دورة جديدة مفعّلة)</span>
                                                    </div>
                                                  )}

                                                  {/* Today's Consumption Highlight Badge */}
                                                  <div className={`flex items-center justify-between px-2 py-1 rounded-lg text-[10.5px] border ${
                                                    stats.todayUsed > 0
                                                      ? 'bg-amber-100/90 text-amber-950 border-amber-300 font-bold shadow-2xs'
                                                      : 'bg-slate-100 text-slate-500 border-slate-200'
                                                  }`}>
                                                    <span className="flex items-center gap-1">
                                                      <Zap size={11} className={stats.todayUsed > 0 ? 'text-amber-600 fill-amber-500' : 'text-slate-400'} />
                                                      <span>استهلاك اليوم:</span>
                                                    </span>
                                                    <span className="font-mono font-black">
                                                      {stats.todayUsed > 0 ? (
                                                        <span className="text-amber-800">🔥 {stats.todayUsed.toLocaleString()} توكن</span>
                                                      ) : (
                                                        <span className="text-slate-400 font-normal">0 توكن</span>
                                                      )}
                                                    </span>
                                                  </div>

                                                  <div className="flex justify-between items-center text-[11px]">
                                                    <span className={`px-2 py-0.5 rounded-md font-bold font-mono text-[10px] border ${
                                                      stats.percentage > 85 ? 'bg-rose-100 text-rose-800 border-rose-200' :
                                                      stats.percentage > 65 ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                                      'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                    }`}>
                                                      مستهلك: {stats.used.toLocaleString()} ({stats.percentage}%)
                                                    </span>
                                                    <span className="font-bold text-slate-700 text-[11px]">
                                                      متبقي: <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">{stats.remaining.toLocaleString()}</span>
                                                    </span>
                                                  </div>

                                                  {/* Quota Gauge with Clear Indicators */}
                                                  <div className="space-y-1">
                                                    <div className="flex justify-between items-center text-[9px] text-slate-500 font-semibold">
                                                      <span>رصيد متبقي: {stats.remainingPercent}%</span>
                                                      <span className={stats.percentage > 85 ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                                                        استهلاك: {stats.percentage}%
                                                      </span>
                                                    </div>
                                                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden" title={`الرصيد المتبقي: ${stats.remaining.toLocaleString()} (${stats.remainingPercent}%) | المستهلك: ${stats.used.toLocaleString()} (${stats.percentage}%)`}>
                                                      <div
                                                        className={`h-full transition-all duration-300 ${
                                                          stats.percentage > 85 ? 'bg-rose-500 animate-pulse' :
                                                          stats.percentage > 65 ? 'bg-amber-500' :
                                                          'bg-emerald-500'
                                                        }`}
                                                        style={{ width: `${Math.min(100, stats.percentage)}%` }}
                                                      />
                                                    </div>
                                                  </div>

                                                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                                                    <span title="محتسب بالطريقة الدقيقة: المدخلات + المخرجات × 5">
                                                      مستهلك: <strong className="text-slate-800 font-bold">{stats.used.toLocaleString()}</strong>
                                                    </span>
                                                    <span title={stats.extra > 0 ? `الأساسي: ${stats.limit.toLocaleString()} | الإضافي: ${stats.extra.toLocaleString()}` : undefined}>
                                                      إجمالي: <strong className="text-slate-800 font-bold">{stats.totalLimit.toLocaleString()}</strong>
                                                    </span>
                                                  </div>

                                                  {stats.lifetimeUsed > stats.used && (
                                                    <div className="flex justify-between items-center text-[9.5px] text-slate-500 font-mono pt-1 border-t border-slate-200/60" title="إجمالي الاستهلاك التراكمي الشامل عبر كافة الدورات منذ التسجيل">
                                                      <span>إجمالي تراكمي:</span>
                                                      <strong className="text-slate-700 font-bold">{stats.lifetimeUsed.toLocaleString()} توكن</strong>
                                                    </div>
                                                  )}

                                                  {stats.extra > 0 && (
                                                    <div className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-center flex items-center justify-between gap-1">
                                                      <div className="flex items-center gap-1">
                                                        <Zap size={11} className="text-emerald-600 fill-emerald-500" />
                                                        <span>باقة إضافية: +{stats.extra.toLocaleString()} توكن</span>
                                                      </div>
                                                      <button
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          if (window.confirm(`هل تريد حذف الرصيد الإضافي السابق (+${stats.extra.toLocaleString()}) للمشترك ${u.name || ''}؟`)) {
                                                            handleClearUserExtraTokens(u);
                                                          }
                                                        }}
                                                        className="text-[9px] text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                                                        title="إلغاء احتساب هذه الباقة الإضافية إذا لم تكن مقصودة كإضافي"
                                                      >
                                                        إلغاء الإضافي ✕
                                                      </button>
                                                    </div>
                                                  )}

                                                  {stats.isExhausted ? (
                                                    <div className="text-[10px] font-bold text-rose-800 bg-rose-100 border border-rose-300 px-1.5 py-0.5 rounded text-center animate-pulse">
                                                      🛑 {stats.used > stats.totalLimit ? 'تم تجاوز حد الباقة (منتهية بالكامل)' : 'نفدت باقة المعلم بالكامل'}
                                                    </div>
                                                  ) : stats.isNearExhaustion ? (
                                                    <div className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-center">
                                                      ⚠️ قاربت باقة المعلم على النفاد
                                                    </div>
                                                  ) : null}

                                                  <div className="flex items-center gap-1">
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setSelectedUserForTokenBilling(u);
                                                        setShowTokenBilling(true);
                                                      }}
                                                      className="mt-0.5 flex-1 bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-900 border border-slate-200 hover:border-indigo-300 py-1 px-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                                                      title="عرض فاتورة استهلاك التوكنز وسجلات هذا الحساب بالتفصيل"
                                                    >
                                                      <Receipt size={12} className="text-indigo-600 shrink-0" />
                                                      <span>الفاتورة 🧾</span>
                                                    </button>

                                                    <button
                                                      type="button"
                                                      onClick={() => handleReconcileSingleUserTokens(u)}
                                                      className="mt-0.5 bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-900 border border-emerald-200 hover:border-emerald-300 py-1 px-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                                                      title="مطابقة وفحص استهلاك التوكن الفعلي لهذا المشترك من الاختبارات وسجلات الاستهلاك فورياً"
                                                    >
                                                      <Zap size={11} className="text-emerald-600 shrink-0" />
                                                      <span>مطابقة ⚡</span>
                                                    </button>

                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        if (window.confirm(`هل أنت متأكد من تصفير استهلاك الدورة الحالية وتفعيل كامل الرصيد (${stats.totalLimit.toLocaleString()} توكن) للمعلم ${u.name || ''}؟`)) {
                                                          handleResetUserTokenUsage(u);
                                                        }
                                                      }}
                                                      className="mt-0.5 bg-white hover:bg-purple-50 text-purple-700 hover:text-purple-900 border border-purple-200 hover:border-purple-300 py-1 px-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                                                      title="تصفير استهلاك الفترة لتفعيل رصيد كامل جديد"
                                                    >
                                                      <RotateCcw size={11} className="text-purple-600 shrink-0" />
                                                      <span>تصفير ↺</span>
                                                    </button>
                                                  </div>
                                                </div>
                                              );
                                            }
                                            // For legacy packages, fallback to old view
                                            return (
                                              <div className="font-mono text-xs text-slate-600">
                                                <div>المستهلك: {u.tokens_used?.toLocaleString() || 0}</div>
                                                {(u.extra_tokens && u.extra_tokens > 0) ? (
                                                  <div className="text-emerald-600 text-[10px] font-bold mt-0.5">إضافي: {u.extra_tokens.toLocaleString()}</div>
                                                ) : null}
                                              </div>
                                            );
                                          })()}
                                        </td>
                                        <td className="p-3.5 text-slate-500 text-xs font-mono" dir="ltr">{createdAt.toLocaleDateString('en-GB')}</td>
                                        <td className="p-3.5 text-center">
                                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                            {/* Action 1: Upgrade to Paid / Activate Plan / Switch System */}
                                            <button
                                              type="button"
                                              onClick={() => setSelectedUserForPlan(u)}
                                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
                                              title="تغيير النظام، ترقية الباقة، أو التفعيل اليدوي لهذا المستخدم"
                                            >
                                              <CreditCard size={14} />
                                              <span>{isTrialAccount ? 'ترقية لباقة 🚀' : 'ترقية / تغيير النظام 🚀'}</span>
                                            </button>

                                            {/* Action: Direct Pro Upgrade with Remaining Tokens Guarantee */}
                                            <button
                                              type="button"
                                              onClick={() => setProUpgradeModalUser(u)}
                                              className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 hover:from-purple-800 hover:to-indigo-800 text-white px-2.5 py-1 rounded-lg text-xs font-black transition-all shadow-xs flex items-center gap-1 cursor-pointer shrink-0 border border-purple-400/30"
                                              title="ترقية الحساب فوراً إلى نظام برو (Gemini Pro) بنفس الباقة ونقل كافة التوكنز المتبقية دون فقدان أي توكن"
                                            >
                                              <Crown size={13} className="text-amber-300 fill-amber-300 shrink-0" />
                                              <span>{u.preferred_ai_model === 'gemini_pro' || u.preferred_ai_model === 'pro' || String(u.subscription_type || '').includes('pro') ? 'تعديل باقة Pro 👑' : 'ترقية لـ Pro (حفظ المتبقي) 👑'}</span>
                                            </button>

                                            {/* Action 2: Direct 1M Tokens Quick Renewal */}
                                            <button
                                              type="button"
                                              onClick={() => handleQuickRenew1Million(u)}
                                              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-2.5 py-1 rounded-lg text-xs font-black transition-all shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
                                              title="تجديد وتفعيل فوري لباقة 1 مليون توكن لمدة شهر كامل مع تصفير الاستهلاك وظهور الرصيد الأخضر كاملاً"
                                            >
                                              <Zap size={13} className="text-amber-300 fill-amber-300" />
                                              <span>تجديد 1M توكن ⚡</span>
                                            </button>

                                            {/* Action 3: Extend Trial (+5 Days) specifically for Trial Accounts */}
                                            {isTrialAccount && (
                                              <button
                                                type="button"
                                                onClick={() => handleExtendTrial(u, 5)}
                                                className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 hover:border-amber-400 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer shrink-0"
                                                title="تمديد الفترة التجريبية للمعلم بمقدار 5 أيام إضافية"
                                              >
                                                <Clock size={13} className="text-amber-700" />
                                                <span>تمديد +5 أيام ⏱️</span>
                                              </button>
                                            )}

                                            {catInfo.category === 'active' && u.role !== 'admin' && (
                                              <button
                                                type="button"
                                                onClick={() => setUserToDeactivate(u)}
                                                className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 hover:border-amber-400 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer shrink-0"
                                                title="إلغاء تفعيل الحساب دون حذف بيانات المعلم أو طلابه أو اختباراته"
                                              >
                                                <UserX size={14} className="text-amber-700" />
                                                <span>إلغاء التفعيل</span>
                                              </button>
                                            )}

                                            <button
                                              type="button"
                                              onClick={async () => {
                                                try {
                                                  if (!window.confirm(`هل أنت متأكد من منح 5000 توكن إضافي لـ ${u.name || u.email}؟`)) return;
                                                  const currentExtra = u.extra_tokens || 0;
                                                  const newExtra = currentExtra + 5000;
                                                  await updateDoc(doc(db, 'users', u.id), {
                                                    extra_tokens: newExtra
                                                  });
                                                  setAllUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, extra_tokens: newExtra } : usr));
                                                  alert(`تم منح 5000 توكن إضافي بنجاح لحساب ${u.name || u.email}`);
                                                } catch (e) {
                                                  alert('حدث خطأ أثناء الاتصال بقاعدة البيانات');
                                                }
                                              }}
                                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                              title="منح 5000 توكن إضافي (استثنائي)"
                                            >
                                              <Zap size={16} />
                                            </button>

                                            {u.phone && (
                                              <button
                                                type="button"
                                                onClick={() => sendWhatsAppToTeacher(u, isTrialAccount ? 'trial' : 'general')}
                                                className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-emerald-200 cursor-pointer"
                                                title={`إرسال رسالة واتساب إلى ${u.name || u.phone}`}
                                              >
                                                <MessageCircle size={16} />
                                              </button>
                                            )}

                                            {u.role !== 'admin' && (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={async () => {
                                                    if (u.is_suspended) {
                                                      const endDate = u.subscription_end_date ? new Date(u.subscription_end_date) : null;
                                                      const isSubValid = endDate && endDate > new Date() && u.subscription_status === 'active';
                                                      if (!isSubValid) {
                                                        const choice = window.confirm(`حساب (${u.name || u.email}) منتهي الاشتراك أو غير مفعّل بباقة سارية.\n\nهل تريد تفعيل وتجديد باقة 1 مليون توكن له لمدة شهر كامل وتصفير الاستهلاك ليبدأ فوراً برصيد 1,000,000 توكن أخضر؟\n\n- انقر "موافق" لتجديد باقة 1M توكن وتفعيل الحساب فوراً.\n- انقر "إلغاء" لفتح نافذة اختيار باقة أخرى.`);
                                                        if (choice) {
                                                          await handleQuickRenew1Million(u);
                                                          return;
                                                        } else {
                                                          setSelectedUserForPlan(u);
                                                          return;
                                                        }
                                                      }
                                                    }

                                                    const newSuspensionState = !u.is_suspended;
                                                    const targetId = u.id || u.uid;
                                                    const targetEmail = (u.email || '').toLowerCase().trim();
                                                    try {
                                                      if (targetId) {
                                                        await setDoc(doc(db, 'users', targetId), {
                                                          is_suspended: newSuspensionState
                                                        }, { merge: true });
                                                        if (u.uid && u.uid !== targetId) {
                                                          await setDoc(doc(db, 'users', u.uid), {
                                                            is_suspended: newSuspensionState
                                                          }, { merge: true }).catch(() => {});
                                                        }
                                                      }
                                                      // Refresh local list
                                                      setAllUsers(prev => prev.map(usr => {
                                                        const matchId = targetId && (usr.id === targetId || usr.uid === targetId);
                                                        const matchEmail = targetEmail && usr.email && usr.email.toLowerCase().trim() === targetEmail;
                                                        return (matchId || matchEmail) ? { ...usr, is_suspended: newSuspensionState } : usr;
                                                      }));

                                                      // Sync with backend server storage
                                                      try {
                                                        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : token;
                                                        if (idToken) {
                                                          fetch('/api/admin/update-user', {
                                                            method: 'POST',
                                                            headers: {
                                                              'Content-Type': 'application/json',
                                                              'Authorization': `Bearer ${idToken}`
                                                            },
                                                            body: JSON.stringify({
                                                              userId: targetId,
                                                              email: targetEmail,
                                                              updates: { is_suspended: newSuspensionState }
                                                            })
                                                          }).catch(console.warn);
                                                        }
                                                      } catch (sErr) {
                                                        console.warn('Notice syncing suspension to server:', sErr);
                                                      }
                                                    } catch (err) {
                                                      console.error('Error updating suspension status:', err);
                                                      alert('حدث خطأ أثناء تعديل حالة التعليق');
                                                    }
                                                  }}
                                                  className={`p-1.5 rounded-lg transition-colors ${u.is_suspended ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-600 hover:bg-amber-50'} cursor-pointer`}
                                                  title={u.is_suspended ? "تفعيل الحساب وتجديد الباقة" : "تعليق الدخول يدوياً"}
                                                >
                                                  {u.is_suspended ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={async () => {
                                                    const newPass = window.prompt(`أدخل كلمة المرور الجديدة للمستخدم ${u.name || u.email} (6 أحرف على الأقل):`);
                                                    if (!newPass) return;
                                                    if (newPass.trim().length < 6) {
                                                      alert('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
                                                      return;
                                                    }
                                                    try {
                                                      const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => token || '') : (token || '');
                                                      let res = await fetch('/api/admin/reset-user-password', {
                                                        method: 'POST',
                                                        headers: {
                                                          'Content-Type': 'application/json',
                                                          'Authorization': `Bearer ${idToken}`
                                                        },
                                                        body: JSON.stringify({
                                                          targetUid: u.id,
                                                          email: u.email,
                                                          phone: u.phone,
                                                          newPassword: newPass.trim()
                                                        })
                                                      });
                                                      if (res.status === 404) {
                                                        res = await fetch('/api/reset-user-password', {
                                                          method: 'POST',
                                                          headers: {
                                                            'Content-Type': 'application/json',
                                                            'Authorization': `Bearer ${idToken}`
                                                          },
                                                          body: JSON.stringify({
                                                            targetUid: u.id,
                                                            email: u.email,
                                                            phone: u.phone,
                                                            newPassword: newPass.trim()
                                                          })
                                                        });
                                                      }
                                                      const data = await res.json();
                                                      if (res.ok && data.success) {
                                                        alert(`تم تغيير كلمة المرور للمستخدم ${u.name || u.email || u.phone} بنجاح إلى: ${newPass.trim()}`);
                                                      } else {
                                                        alert(data.error || 'فشل تغيير كلمة المرور');
                                                      }
                                                    } catch (e: any) {
                                                      alert('حدث خطأ أثناء تعديل كلمة المرور: ' + e.message);
                                                    }
                                                  }}
                                                  className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                                  title={`تغيير كلمة المرور لـ ${u.name || u.email}`}
                                                >
                                                  <KeyRound size={16} />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setUserToDelete({ id: u.id, name: u.name || 'بدون اسم' })}
                                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                                  title="حذف الحساب"
                                                >
                                                  <Trash2 size={16} />
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Subscribers List Pagination */}
                          {filteredUsers.length > 0 && (
                            <Pagination
                              currentPage={adminUsersPage}
                              totalPages={totalUserPages}
                              totalItems={filteredUsers.length}
                              itemsPerPage={USERS_PER_PAGE}
                              onPageChange={setAdminUsersPage}
                              itemName="مشترك"
                              theme="amber"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Exclusive Super Admin Platform-Wide Student Database & Notification Center */}
            {user?.email && user.email.toLowerCase().trim() === 'gergesnabil101@gmail.com' && (
              <div className="mt-8 pt-8 border-t-2 border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 p-6 rounded-2xl border border-indigo-200 shadow-sm space-y-8">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="text-xl font-extrabold text-indigo-950 flex items-center gap-2">
                      <Database size={26} className="text-indigo-600" />
                      قاعدة بيانات طلاب المنصة الشاملة (خاص بالمالك)
                    </h3>
                    <p className="text-xs text-indigo-700 mt-1">
                      اطلاع كامل على جميع بيانات الطلاب المسجلين عبر كافة اختبارات ومعلمي المنصة مع أدوات إرسال الإشعارات المباشرة.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchPlatformStudents()}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    {isLoadingPlatformStudents ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                    تحديث بيانات الطلاب
                  </button>
                </div>

                {/* Notification Broadcasting Center */}
                <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm space-y-4">
                  <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Bell size={20} className="text-amber-500" />
                    مركز إرسال الإشعارات والتعاميم للطلاب
                  </h4>
                  <p className="text-xs text-slate-500">
                    قم بإرسال إشعار فوري يظهر للطلاب فور دخولهم للتطبيق حسب التصنيف المطلوب (الكل، المرحلة، المادة، أو مدرس معين).
                  </p>

                  {notifSuccessMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                      <CheckCircle size={16} className="text-emerald-600" />
                      {notifSuccessMsg}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">عنوان الإشعار:</label>
                      <input
                        type="text"
                        value={notifTitle}
                        onChange={(e) => setNotifTitle(e.target.value)}
                        placeholder="مثال: تنبيه هام بشأن موعد الامتحان القادم..."
                        className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">تصنيف الاستهداف:</label>
                      <select
                        value={notifTargetType}
                        onChange={(e) => setNotifTargetType(e.target.value as any)}
                        className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-bold"
                      >
                        <option value="all">جميع طلاب المنصة (الكل)</option>
                        <option value="grade">حسب المرحلة الدراسية</option>
                        <option value="subject">حسب المادة الدراسية</option>
                        <option value="teacher">لمدرس معين</option>
                      </select>
                    </div>
                  </div>

                  {notifTargetType !== 'all' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {notifTargetType === 'grade' ? 'اختر المرحلة الدراسية المستهدفة:' : notifTargetType === 'subject' ? 'اختر المادة الدراسية المستهدفة:' : 'اختر المدرس المستهدف:'}
                      </label>
                      <select
                        value={notifTargetValue}
                        onChange={(e) => setNotifTargetValue(e.target.value)}
                        className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-bold"
                      >
                        <option value="">-- اختر من القائمة بدقة --</option>
                        {notifTargetType === 'grade' && uniqueGrades.map((g: any) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                        {notifTargetType === 'subject' && uniqueSubjects.map((s: any) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                        {notifTargetType === 'teacher' && uniqueTeachers.map((t: any) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">محتوى الإشعار والرسالة:</label>
                    <textarea
                      rows={3}
                      value={notifMessage}
                      onChange={(e) => setNotifMessage(e.target.value)}
                      placeholder="اكتب تفاصيل الإشعار الذي سيظهر للطلاب في شاشة الاختبار..."
                      className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    ></textarea>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSendPlatformNotification}
                      disabled={isSendingNotif || !notifTitle.trim() || !notifMessage.trim()}
                      className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSendingNotif ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                      إرسال الإشعار للطلاب الآن
                    </button>
                  </div>

                  {/* Published notifications list */}
                  {studentNotifications.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Bell size={14} className="text-amber-500" />
                          الإشعارات النشطة المنشورة حالياً ({studentNotifications.length}):
                        </span>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {studentNotifications.map((notif, notifIdx) => (
                          <div key={`${notif.id || 'notif'}-${notifIdx}`} className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 flex items-start justify-between gap-3 text-right">
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs text-slate-800">{notif.title}</span>
                                <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                                  {notif.targetType === 'all' ? 'جميع الطلاب' : `${notif.targetType === 'grade' ? 'المرحلة: ' : notif.targetType === 'subject' ? 'المادة: ' : 'المعلم: '}${notif.targetValue}`}
                                </span>
                                {notif.created_at && (
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(notif.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 whitespace-pre-wrap">{notif.message}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteNotification(notif.id)}
                              title="حذف الإشعار"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Platform Students Database Explorer */}
                <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Users size={20} className="text-indigo-600" />
                        سجلات الطلاب المسجلين بالمنصة ({platformStudents.length} طالب)
                      </h4>
                      <p className="text-xs text-slate-500">بحث وفلترة دقيقة في قاعدة بيانات الطلاب عبر جميع اختبارات المعلمين حسب المرحلة، المادة، أو المعلم.</p>
                    </div>
                    <button
                      type="button"
                      disabled={isSyncingStudents}
                      onClick={syncAndUpgradeStudentsDatabase}
                      className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:bg-indigo-50/50 disabled:text-indigo-400 border border-indigo-200 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors shrink-0"
                    >
                      {isSyncingStudents ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>{syncProgress || 'جاري المزامنة...'}</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw size={14} />
                          <span>ترقية ومزامنة الطلاب 🔄</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input
                      type="text"
                      value={studentDbSearch}
                      onChange={(e) => {
                        setStudentDbSearch(e.target.value);
                        setPlatformStudentsPage(1);
                      }}
                      placeholder="بحث بالاسم أو رقم الهاتف..."
                      className="p-2.5 text-xs border border-slate-200 rounded-xl w-full focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <select
                      value={studentGradeFilter}
                      onChange={(e) => {
                        setStudentGradeFilter(e.target.value);
                        setPlatformStudentsPage(1);
                      }}
                      className="p-2.5 text-xs border border-slate-200 rounded-xl bg-white font-bold outline-none cursor-pointer"
                    >
                      <option value="all">كل المراحل الدراسية</option>
                      {uniqueGrades.map((g: any) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                    <select
                      value={studentSubjectFilter}
                      onChange={(e) => {
                        setStudentSubjectFilter(e.target.value);
                        setPlatformStudentsPage(1);
                      }}
                      className="p-2.5 text-xs border border-slate-200 rounded-xl bg-white font-bold outline-none cursor-pointer"
                    >
                      <option value="all">كل المواد الدراسية</option>
                      {uniqueSubjects.map((s: any) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <select
                      value={studentTeacherFilter}
                      onChange={(e) => {
                        setStudentTeacherFilter(e.target.value);
                        setPlatformStudentsPage(1);
                      }}
                      className="p-2.5 text-xs border border-slate-200 rounded-xl bg-white font-bold outline-none cursor-pointer"
                    >
                      <option value="all">كل المعلمين</option>
                      {uniqueTeachers.map((t: any) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {platformStudentsError && (
                    <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-xl flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-amber-600 shrink-0" />
                        <span>{platformStudentsError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchPlatformStudents()}
                        className="text-xs bg-amber-200 hover:bg-amber-300 text-amber-900 px-3 py-1 rounded-lg transition-colors font-bold shrink-0"
                      >
                        إعادة المحاولة
                      </button>
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3">اسم الطالب</th>
                          <th className="p-3">رقم الهاتف</th>
                          <th className="p-3">ولي الأمر</th>
                          <th className="p-3">السنتر / المجموعة</th>
                          <th className="p-3">المرحلة الدراسية</th>
                          <th className="p-3">المادة</th>
                          <th className="p-3">المعلم</th>
                          <th className="p-3 text-center">عدد الاختبارات</th>
                          <th className="p-3">آخر تفاعل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {isLoadingPlatformStudents ? (
                          <tr>
                            <td colSpan={9} className="p-12 text-center text-slate-500">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <Loader2 className="animate-spin text-indigo-600" size={28} />
                                <span className="font-bold text-slate-700">جاري تحميل قاعدة بيانات الطلاب الشاملة...</span>
                              </div>
                            </td>
                          </tr>
                        ) : platformStudents.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="p-12 text-center text-slate-500">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <Users className="text-slate-300" size={32} />
                                <span className="font-bold text-slate-700">لا توجد سجلات طلاب مسجلة بعد. اضغط على زر التحديث أعلاه.</span>
                                <button
                                  type="button"
                                  onClick={() => fetchPlatformStudents()}
                                  className="mt-2 text-xs bg-indigo-600 text-white px-3.5 py-1.5 rounded-xl hover:bg-indigo-700 transition-colors font-bold cursor-pointer"
                                >
                                  تحميل الطلاب الآن
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : filteredPlatformStudents.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="p-12 text-center text-slate-500">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <Search className="text-slate-300" size={32} />
                                <span className="font-bold text-slate-700">لا توجد نتائج مطابقة لخيارات التصفية الحالية.</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStudentDbSearch('');
                                    setStudentGradeFilter('all');
                                    setStudentSubjectFilter('all');
                                    setStudentTeacherFilter('all');
                                    setPlatformStudentsPage(1);
                                  }}
                                  className="mt-2 text-xs bg-indigo-600 text-white px-3.5 py-1.5 rounded-xl hover:bg-indigo-700 transition-colors font-bold cursor-pointer"
                                >
                                  إعادة ضبط الفلاتر
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          paginatedPlatformStudents.map((st, idx) => (
                            <tr key={`${st.id || 'st'}-${idx}`} className="hover:bg-indigo-50/40 transition-colors">
                              <td className="p-3 font-bold text-slate-900">{st.name}</td>
                              <td className="p-3 font-mono text-slate-700" dir="ltr">{st.phone || 'غير مسجل'}</td>
                              <td className="p-3 font-mono text-slate-600" dir="ltr">{st.parent_phone || 'غير مسجل'}</td>
                              <td className="p-3 font-medium text-slate-700">{st.center_name || 'عام'}</td>
                              <td className="p-3 font-semibold text-indigo-700">{st.grade_level}</td>
                              <td className="p-3 font-medium text-slate-700">{st.subject}</td>
                              <td className="p-3 font-medium text-slate-800">{st.teacher_name || 'معلم الاختبار'}</td>
                              <td className="p-3 text-center">
                                <span className="bg-indigo-100 text-indigo-800 font-mono px-2 py-0.5 rounded-full text-[11px] font-bold">
                                  {st.exams_taken}
                                </span>
                              </td>
                              <td className="p-3 text-slate-500 font-mono text-[11px]">{new Date(st.last_date).toLocaleDateString('en-GB')}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Platform Students Pagination */}
                  {filteredPlatformStudents.length > 0 && (
                    <Pagination
                      currentPage={platformStudentsPage}
                      totalPages={totalPlatformStudentPages}
                      totalItems={filteredPlatformStudents.length}
                      itemsPerPage={PLATFORM_STUDENTS_PER_PAGE}
                      onPageChange={setPlatformStudentsPage}
                      itemName="طالب مسجل"
                      theme="indigo"
                    />
                  )}
                </div>
              </div>
            )}

            <div className="bg-indigo-50 p-4 sm:p-6 rounded-2xl border border-indigo-100">
              <h3 className="text-base sm:text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                <Sparkles size={20} />
                دليل المبتدئين: كيف تستخدم التطبيق؟
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 text-right" >
                <div className="space-y-2 bg-white/50 p-3 rounded-xl sm:bg-transparent sm:p-0">
                  <div className="bg-white w-8 h-8 rounded-full flex items-center justify-center text-indigo-600 font-bold shadow-sm">1</div>
                  <h4 className="font-bold text-slate-800 text-sm sm:text-base">إنشاء الاختبارات</h4>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">اضغط على "اختبار جديد" وابدأ بكتابة أسئلتك، أو استخدم خاصية الذكاء الاصطناعي لرفع ملف PDF وتحويله لأسئلة فوراً.</p>
                </div>
                <div className="space-y-2 bg-white/50 p-3 rounded-xl sm:bg-transparent sm:p-0">
                  <div className="bg-white w-8 h-8 rounded-full flex items-center justify-center text-indigo-600 font-bold shadow-sm">2</div>
                  <h4 className="font-bold text-slate-800 text-sm sm:text-base">مشاركة الرابط</h4>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">بعد الحفظ، انسخ رابط الاختبار وأرسله لطلابك عبر الواتساب. سيقوم النظام بتصحيح الإجابات تلقائياً.</p>
                </div>
                <div className="space-y-2 bg-white/50 p-3 rounded-xl sm:bg-transparent sm:p-0">
                  <div className="bg-white w-8 h-8 rounded-full flex items-center justify-center text-indigo-600 font-bold shadow-sm">3</div>
                  <h4 className="font-bold text-slate-800 text-sm sm:text-base">تنزيل التطبيق</h4>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">لفتح التطبيق كبرنامج على الكمبيوتر أو الموبايل: اضغط على "إضافة إلى الشاشة الرئيسية" من إعدادات المتصفح (Chrome/Safari).</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-4">المجلدات</h3>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="اسم المجلد الجديد..."
                  className="flex-1 p-2.5 border border-slate-200 rounded-lg focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
                />
                <button
                  onClick={createFolder}
                  disabled={!newFolderName.trim()}
                  className="bg-slate-100 text-slate-700 px-4 py-2.5 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 text-sm font-bold"
                >
                  إضافة مجلد
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {folders.map(folder => (
                  <div 
                    key={folder.id} 
                    onClick={() => setActiveFolderId(folder.id)}
                    className={`border p-4 rounded-xl transition-all relative group cursor-pointer ${
                      activeFolderId === folder.id 
                        ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-500/20' 
                        : 'border-slate-200 hover:border-indigo-300 bg-white'
                    }`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFolder(folder.id);
                      }}
                      className="z-[100] bg-white text-red-600 p-2 rounded-full shadow-sm hover:bg-red-50 transition-colors pointer-events-auto absolute top-2 left-2 opacity-0 group-hover:opacity-100"
                      title="حذف المجلد"
                    >
                      <Trash2 size={16} />
                    </button>
                    <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                      <FileText size={18} className={activeFolderId === folder.id ? 'text-indigo-600' : 'text-indigo-500'} />
                      {folder.name}
                    </h4>
                    <div className="text-sm text-slate-500 mb-4">
                      {quizzes.filter(q => q.folder_id === folder.id).length} اختبارات
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        createNewQuiz(folder.id);
                      }}
                      className="text-indigo-600 text-sm hover:underline flex items-center gap-1"
                    >
                      <PlusCircle size={14} />
                      إضافة اختبار هنا
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-800">
                    {activeFolderId ? folders.find(f => f.id === activeFolderId)?.name : 'جميع الاختبارات'}
                  </h3>
                  <button
                    onClick={() => fetchResults('all')}
                    className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="سجل نتائج ودرجات الطلاب عبر جميع الاختبارات"
                  >
                    <Users size={14} className="text-indigo-600" />
                    <span>سجل درجات الطلاب</span>
                  </button>
                </div>
                {activeFolderId && (
                  <button onClick={() => setActiveFolderId(null)} className="text-sm text-indigo-600 hover:underline font-bold">
                    العودة للكل
                  </button>
                )}
              </div>
              {quizzes.filter(q => activeFolderId ? q.folder_id === activeFolderId : true).length === 0 ? (
                <p className="text-slate-500 text-center py-8">لا يوجد اختبارات.</p>
              ) : (
                <div className="space-y-3">
                  {quizzes.filter(q => activeFolderId ? q.folder_id === activeFolderId : true).map(q => {
                    let parsedData: any = null;
                    try {
                      if (q.data) parsedData = JSON.parse(q.data);
                    } catch {}
                    const effectiveExpiresAt = q.expires_at || parsedData?.expires_at;
                    const expInfo = getQuizExpirationInfo(effectiveExpiresAt);

                    return (
                    <div key={q.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => editQuiz(q.id)}>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-800">{q.title}</h4>
                          {expInfo && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              expInfo.isExpired 
                                ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              {expInfo.isExpired ? <AlertTriangle size={11} /> : <Clock size={11} />}
                              <span>{expInfo.shortBadge}</span>
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500">
                          {q.folder_id ? folders.find(f => f.id === q.folder_id)?.name || 'مجلد محذوف' : 'بدون مجلد'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (parsedData) {
                              setQuiz({ ...q, ...parsedData });
                            } else {
                              setQuiz({ id: q.id, title: q.title, folder_id: q.folder_id, expires_at: q.expires_at, questions: [] });
                            }
                            const url = `${window.location.origin}${window.location.pathname}?id=${q.id}`;
                            setShareUrl(url);
                            setShowShareModal(true);
                          }}
                          className="text-slate-600 hover:text-indigo-600 p-2 rounded-lg transition-colors"
                          title="مشاركة رابط الاختبار ورمز QR"
                        >
                          <Share2 size={18} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMoveQuizId(q.id);
                            setShowMoveQuizModal(true);
                          }}
                          className="text-slate-600 hover:text-indigo-600 p-2 rounded-lg transition-colors"
                          title="نقل إلى مجلد"
                        >
                          <Move size={18} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            try {
                              if (q.data) {
                                const parsed = JSON.parse(q.data);
                                setQuiz(parsed);
                              } else {
                                setQuiz({ id: q.id, title: q.title, folder_id: q.folder_id, questions: [] });
                              }
                            } catch {
                              setQuiz({ id: q.id, title: q.title, folder_id: q.folder_id, questions: [] });
                            }
                            fetchResults(q.id);
                          }}
                          className="text-slate-600 hover:text-indigo-600 p-2 rounded-lg transition-colors"
                          title="عرض نتائج وحلول الطلاب"
                        >
                          <Users size={18} />
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const currentVal = Boolean(q.require_student_code || parsedData?.require_student_code);
                            const nextVal = !currentVal;
                            
                            // 1. Optimistic local update in quizzes state
                            setQuizzes(prev => prev.map(item => {
                              if (item.id === q.id) {
                                let itemParsed = {};
                                try { if (item.data) itemParsed = JSON.parse(item.data); } catch {}
                                const updatedParsed = { ...itemParsed, require_student_code: nextVal };
                                return {
                                  ...item,
                                  require_student_code: nextVal,
                                  data: JSON.stringify(updatedParsed)
                                };
                              }
                              return item;
                            }));

                            // If this quiz is currently active in `quiz` state, update it too
                            if (quiz.id === q.id) {
                              setQuiz(prev => ({ ...prev, require_student_code: nextVal }));
                            }

                            // 2. Persist to Firestore
                            try {
                              let itemParsed = {};
                              try { if (q.data) itemParsed = JSON.parse(q.data); } catch {}
                              const updatedParsed = { ...itemParsed, require_student_code: nextVal };
                              await updateDoc(doc(db, 'quizzes', q.id), {
                                require_student_code: nextVal,
                                data: JSON.stringify(updatedParsed),
                                updated_at: new Date().toISOString()
                              });
                            } catch (err: any) {
                              console.error("Failed to toggle require_student_code:", err);
                              alert("حدث خطأ أثناء تحديث حالة كود الطالب: " + (err?.message || ''));
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                            q.require_student_code || parsedData?.require_student_code
                              ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
                          }`}
                          title="تفعيل أو إلغاء تفعيل شرط كود الطالب لهذا الاختبار"
                        >
                          <KeyRound size={14} className={q.require_student_code || parsedData?.require_student_code ? 'text-white' : 'text-slate-500'} />
                          <span>{q.require_student_code || parsedData?.require_student_code ? 'الكود مفعل' : 'تفعيل الكود'}</span>
                        </button>

                        <button
                          onClick={() => editQuiz(q.id)}
                          className="text-slate-600 hover:text-indigo-600 p-2 rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <FileText size={18} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            requestDeleteQuiz(q);
                          }}
                          className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors cursor-pointer"
                          title="حذف الاختبار بالكامل"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'build' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Top Sticky/Prominent Actions Header for Quiz Editing */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-indigo-700/50 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-16 z-20 backdrop-blur-md">
              <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-indigo-200 font-bold border border-white/10">
                    <FileText size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold bg-indigo-500/40 text-indigo-100 px-2 py-0.5 rounded-full border border-indigo-400/30">
                        وضع تحرير وتعديل الاختبار
                      </span>
                      <span className="text-[11px] text-indigo-200 font-mono hidden sm:inline">
                        (Ctrl + S للحفظ)
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white truncate max-w-[220px] sm:max-w-md">
                      {quiz.title || 'اختبار بدون عنوان'}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => setMode('dashboard')}
                  className="md:hidden text-indigo-200 hover:text-white text-xs font-bold flex items-center gap-1 bg-white/10 px-2.5 py-1.5 rounded-lg"
                >
                  الرئيسية
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
                <button
                  onClick={() => saveQuiz(false)}
                  disabled={isSavingQuiz}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-xs sm:text-sm active:scale-95 disabled:opacity-50"
                  title="حفظ جميع التغييرات في الاختبار"
                >
                  {isSavingQuiz ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{isSavingQuiz ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
                </button>

                <button
                  onClick={() => saveQuiz(true)}
                  disabled={isSavingQuiz}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold transition-all flex items-center gap-1.5 text-xs sm:text-sm border border-indigo-400/40 shadow-sm"
                  title="حفظ ومشاركة رابط الاختبار"
                >
                  <QrCode size={16} />
                  <span>مشاركة</span>
                </button>

                <button
                  onClick={() => {
                    if (!quiz.id) {
                      alert('يرجى حفظ التعديلات أولاً لعرض نتائج الطلاب.');
                    } else {
                      fetchResults(quiz.id);
                    }
                  }}
                  className="bg-white/10 hover:bg-white/20 text-white px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-bold transition-all flex items-center gap-1.5 text-xs sm:text-sm border border-white/10"
                  title="عرض درجات وحلول الطلاب"
                >
                  <Users size={16} />
                  <span className="hidden sm:inline">النتائج</span>
                </button>

                <button
                  onClick={() => {
                    setMode('take-intro');
                    setStudentAnswers({});
                    setStudentName('');
                    setCenterName('');
                    setParentPhone('');
                    setStudentEmail('');
                  }}
                  className="bg-white/10 hover:bg-white/20 text-white px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-bold transition-all flex items-center gap-1.5 text-xs sm:text-sm border border-white/10"
                  title="معاينة وتجربة الاختبار كما يراه الطالب"
                >
                  <Play size={16} />
                  <span className="hidden sm:inline">معاينة الطالب</span>
                </button>

                <button
                  type="button"
                  onClick={() => requestDeleteQuiz(quiz)}
                  className="bg-rose-500/20 hover:bg-rose-600 text-rose-200 hover:text-white px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-bold transition-all flex items-center gap-1.5 text-xs sm:text-sm border border-rose-400/30 cursor-pointer shadow-xs"
                  title="حذف هذا الاختبار بالكامل من حسابك وقاعدة البيانات"
                >
                  <Trash2 size={16} />
                  <span className="hidden sm:inline">حذف الاختبار</span>
                </button>

                <button
                  onClick={() => setMode('dashboard')}
                  className="hidden md:flex bg-white/10 hover:bg-white/20 text-indigo-100 hover:text-white px-3 py-2 sm:py-2.5 rounded-xl font-bold transition-all items-center gap-1 text-xs border border-white/10"
                  title="العودة إلى لوحة التحكم الرئيسية"
                >
                  <ArrowRight size={14} />
                  <span>الرئيسية</span>
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-500 mb-2">عنوان الاختبار</label>
                  <input
                    type="text"
                    value={quiz.title}
                    onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                    className="w-full text-2xl font-bold border-b-2 border-transparent hover:border-slate-200 focus:border-indigo-600 focus:outline-none transition-colors pb-2 bg-transparent"
                    placeholder="أدخل عنوان الاختبار هنا..."
                  />
                </div>
                <div className="md:w-64">
                  <label className="block text-sm font-medium text-slate-500 mb-2">المجلد</label>
                  <select
                    value={quiz.folder_id || ''}
                    onChange={(e) => setQuiz({ ...quiz, folder_id: e.target.value || undefined })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"
                  >
                    <option value="">بدون مجلد</option>
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:w-64">
                  <label className="block text-sm font-medium text-slate-500 mb-2">السنة الدراسية</label>
                  <select
                    value={quiz.grade_level || ''}
                    onChange={(e) => setQuiz({ ...quiz, grade_level: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"
                  >
                    <option value="">اختر السنة الدراسية...</option>
                    {(Array.isArray(user?.grade_level) ? user.grade_level : (typeof user?.grade_level === 'string' && user.grade_level ? user.grade_level.split(',') : [])).map((val: string) => {
                      const level = GRADE_LEVELS.find(g => g.value === val);
                      return <option key={val} value={val}>{level?.label || val}</option>;
                    })}
                    {/* Fallback if no grades selected in profile */}
                    {(!user?.grade_level || user.grade_level.length === 0) && GRADE_LEVELS.map(g => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <label htmlFor="maxAttempts" className="text-sm font-medium text-slate-700 shrink-0">عدد المحاولات:</label>
                  <input
                    type="number"
                    id="maxAttempts"
                    min="1"
                    value={quiz.maxAttempts || 1}
                    onChange={(e) => setQuiz({ ...quiz, maxAttempts: parseInt(e.target.value) || 1 })}
                    className="w-16 p-2 rounded-lg border border-slate-200 focus:border-indigo-600 outline-none text-center font-bold"
                  />
                  <span className="text-xs text-slate-500">(1 = محاولة واحدة)</span>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <Clock size={18} className="text-indigo-600 shrink-0" />
                  <label htmlFor="quizTimeLimit" className="text-sm font-medium text-slate-700 shrink-0">مدة الاختبار:</label>
                  <input
                    type="number"
                    id="quizTimeLimit"
                    min="0"
                    step="1"
                    placeholder="مفتوح"
                    value={quiz.time_limit !== undefined && quiz.time_limit !== null ? (quiz.time_limit === 0 ? '' : quiz.time_limit) : ''}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      if (val === '' || parseInt(val) <= 0) {
                        setQuiz({ ...quiz, time_limit: undefined });
                      } else {
                        setQuiz({ ...quiz, time_limit: Math.max(1, parseInt(val) || 1) });
                      }
                    }}
                    className="w-16 p-2 rounded-lg border border-slate-200 focus:border-indigo-600 outline-none text-center font-bold text-slate-800"
                  />
                  <span className="text-xs text-slate-500">{quiz.time_limit && quiz.time_limit > 0 ? 'دقيقة' : 'وقت مفتوح'}</span>
                </div>
                
                <div className="flex items-center justify-between bg-indigo-50 p-3.5 rounded-xl border border-indigo-100 col-span-1 md:col-span-2 lg:col-span-3">
                  <span className="text-sm font-medium text-indigo-700">الدرجة الكلية للاختبار (مجموع درجات الأسئلة بشكل منفصل):</span>
                  <span className="text-sm font-bold text-indigo-700 bg-indigo-100/80 px-3 py-1 rounded-full border border-indigo-200">
                    {calculateTotalPoints()} درجة ({ (quiz.questions || []).length } سؤال)
                  </span>
                </div>
              </div>

              {/* Expiration and Display Settings Row */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={18} className="text-indigo-600 shrink-0" />
                      <label htmlFor="quizExpiresAt" className="text-sm font-medium text-slate-700">تاريخ انتهاء صلاحية الرابط:</label>
                    </div>
                    {quiz.expires_at ? (
                      <button
                        type="button"
                        onClick={() => setQuiz({ ...quiz, expires_at: null })}
                        className="text-[11px] text-red-600 hover:text-red-700 hover:underline font-bold"
                      >
                        إلغاء الموعد (مفتوح دائماً)
                      </button>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      id="quizExpiresAt"
                      value={quiz.expires_at ? toDateTimeLocalString(new Date(quiz.expires_at)) : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuiz({ ...quiz, expires_at: val ? new Date(val).toISOString() : null });
                      }}
                      className="flex-1 p-2 rounded-lg border border-slate-200 focus:border-indigo-600 outline-none text-xs bg-white text-slate-800"
                    />
                    <select
                      value={quiz.expires_at ? 'custom' : 'none'}
                      onChange={(e) => {
                        const opt = e.target.value;
                        if (opt === 'none') {
                          setQuiz({ ...quiz, expires_at: null });
                        } else if (opt === '24h') {
                          const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
                          setQuiz({ ...quiz, expires_at: d.toISOString() });
                        } else if (opt === '3d') {
                          const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
                          setQuiz({ ...quiz, expires_at: d.toISOString() });
                        } else if (opt === '7d') {
                          const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                          setQuiz({ ...quiz, expires_at: d.toISOString() });
                        }
                      }}
                      className="p-2 rounded-lg border border-slate-200 focus:border-indigo-600 outline-none text-xs bg-white text-slate-700"
                    >
                      <option value="none">بدون انتهاء (دائماً)</option>
                      <option value="24h">24 ساعة</option>
                      <option value="3d">3 أيام</option>
                      <option value="7d">أسبوع</option>
                      {quiz.expires_at ? <option value="custom">مخصص</option> : null}
                    </select>
                  </div>

                  {quiz.expires_at && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <span>الحالة:</span>
                      {(() => {
                        const info = getQuizExpirationInfo(quiz.expires_at);
                        if (!info) return null;
                        return (
                          <span className={`font-bold ${info.isExpired ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {info.isExpired ? 'منتهي الصلاحية' : `متاح حتى ${info.fullDate} (${info.relativeText})`}
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <input
                    type="checkbox"
                    id="showAnswers"
                    checked={quiz.showCorrectAnswers ?? true}
                    onChange={(e) => setQuiz({ ...quiz, showCorrectAnswers: e.target.checked })}
                    className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <label htmlFor="showAnswers" className="text-xs font-medium text-slate-700 cursor-pointer select-none">
                    إظهار الإجابات النموذجية للطالب بعد الاختبار
                  </label>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <input
                    type="checkbox"
                    id="showResultsToStudent"
                    checked={quiz.showResultsToStudent ?? true}
                    onChange={(e) => setQuiz({ ...quiz, showResultsToStudent: e.target.checked })}
                    className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <label htmlFor="showResultsToStudent" className="text-xs font-medium text-slate-700 cursor-pointer select-none">
                    إظهار نتيجة ودرجة الطالب فوراً بعد إنهاء الاختبار
                  </label>
                </div>
              </div>

              {/* Student Code Requirement Toggle */}
              <div className="mt-3 bg-gradient-to-r from-amber-50/70 via-indigo-50/50 to-amber-50/40 p-4 rounded-xl border border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${quiz.require_student_code ? 'bg-amber-500 text-white shadow-xs' : 'bg-slate-200 text-slate-600'}`}>
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-slate-800">
                        طلب كود الطالب لدخول الاختبار (الأكواد الموحدة من بيانات طلابي):
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        quiz.require_student_code 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {quiz.require_student_code ? '✓ تفعيل شرط الكود للطالب' : 'معطل (دخول عادي بالاسم)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      عند التفعيل، سيُطلب من كل طالب إدخال كوده الموحد (المنشأ من قسم بيانات طلابي) لدخول الاختبار ومنع تكرار المحاولات.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !quiz.require_student_code;
                      setQuiz({ ...quiz, require_student_code: nextVal });
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                      quiz.require_student_code
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{quiz.require_student_code ? 'الكود مفعل (إلغاء التفعيل)' : 'تفعيل طلب الكود'}</span>
                  </button>
                </div>
              </div>

              {/* Quiz-Level AI Model Selector */}
              <div className="mt-3 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-purple-50/20 p-3.5 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${quiz.ai_model === 'pro' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}>
                    {quiz.ai_model === 'pro' ? <Sparkles size={16} /> : <Zap size={16} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-800">
                        نموذج الذكاء الاصطناعي لمعالجة وتصحيح هذا الاختبار:
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        quiz.ai_model === 'pro'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {quiz.ai_model === 'pro' ? 'برو 👑 (المخرجات × 6)' : 'فلاش ⚡ (المخرجات × 5)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {quiz.ai_model === 'pro' 
                        ? 'Gemini Pro: استدلال أكاديمي وتفكير عميق للمسائل الدقيقة والمعادلات.'
                        : 'Gemini 3.8 Flash: سرعة فائقة وتوفير في استهلاك باقة التوكنز.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setQuiz({ ...quiz, ai_model: 'flash' })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      (quiz.ai_model || 'flash') === 'flash'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Zap size={13} />
                    <span>فلاش (Flash ⚡)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const isManagerAdmin = Boolean(isPlatformAdmin || user?.isAdmin || user?.role === 'admin' || (user?.email && user.email.toLowerCase().trim() === 'gergesnabil101@gmail.com'));
                      if (!isTeacherPro && !isManagerAdmin) {
                        setShowProUpgradeModal(true);
                        return;
                      }
                      setQuiz({ ...quiz, ai_model: 'pro' });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      quiz.ai_model === 'pro'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Sparkles size={13} />
                    <span>برو (Pro 👑)</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {quiz.questions.map((q, qIndex) => (
                <div key={q.id} className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 relative group transition-all hover:border-slate-300">
                  {/* Top Action Bar */}
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                        {qIndex + 1}
                      </div>
                      <select
                        value={q.type || 'multiple-choice'}
                        onChange={(e) => {
                          const type = e.target.value as 'multiple-choice' | 'true-false' | 'essay';
                          setQuiz(prev => ({
                            ...prev,
                            questions: prev.questions.map(question => 
                              question.id === q.id 
                                ? { 
                                    ...question, 
                                    type, 
                                    options: type === 'essay' ? [] : (type === 'true-false' ? (isEnglishContent(question.text) ? ['True', 'False'] : ['صح', 'خطأ']) : ['', '', '', '']), 
                                    correctOptionIndex: 0 
                                  } 
                                : question
                            )
                          }));
                        }}
                        className="text-xs sm:text-sm bg-slate-50 hover:bg-slate-100 py-1.5 px-3 rounded-xl border border-slate-200 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="multiple-choice">اختيار من متعدد</option>
                        <option value="true-false">صح أم خطأ</option>
                        <option value="essay">سؤال مقالي (غير محدود الكلمات)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => saveQuiz(false)}
                        disabled={isSavingQuiz}
                        className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-2 rounded-xl border border-emerald-200 text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                        title="حفظ التعديلات في الاختبار فورياً"
                      >
                        {isSavingQuiz ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        <span className="hidden sm:inline">حفظ التعديلات</span>
                      </button>
                      <button
                        onClick={() => copyQuestion(q.id)}
                        className="flex items-center gap-1 text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded-xl border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                        title="تكرار السؤال داخل نفس الاختبار الحالي"
                      >
                        <CopyPlus size={15} />
                        <span className="hidden sm:inline">تكرار هنا</span>
                      </button>
                      <button
                        onClick={() => {
                          setMoveQuestionId(q.id);
                          setShowMoveModal(true);
                        }}
                        className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 p-2 px-2.5 rounded-xl border border-indigo-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                        title="نسخ أو نقل هذا السؤال إلى اختبار آخر"
                      >
                        <ArrowRightLeft size={15} />
                        <span>نسخ / نقل لاختبار آخر</span>
                      </button>
                      <button
                        onClick={() => removeQuestion(q.id)}
                        className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 px-3 py-2 rounded-xl text-xs font-bold transition-all border border-red-200 shadow-sm"
                        title="حذف هذا السؤال من الاختبار"
                      >
                        <Trash2 size={16} />
                        <span>حذف السؤال</span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-500 ml-1">رموز رياضية وأسس وشحنات:</span>
                        {[
                          '+', '-', '×', '÷', '=', '±', '≠', '≤', '≥', '≈', 
                          'π', '√', '²', '³', '⁴', 'ⁿ', '⁺', '⁻', '²⁺', '³⁺', '⁻²',
                          '₀', '₁', '₂', '₃', '₄', '→', '⇄',
                          '½', '¼', '¾', 'Δ', 'α', 'β', 'θ', 'λ', '∞', '∫', '∑',
                          '∠', '△', '⟂', '∥', '°',
                          'س', 'ص', 'ع', 'جا', 'جتا', 'ظا'
                        ].map(symbol => (
                          <button
                            key={symbol}
                            type="button"
                            onClick={() => updateQuestionText(q.id, (q.text || '') + symbol)}
                            className="text-xs bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 border border-slate-200 px-2 py-1 rounded-md font-mono text-slate-700 transition-all shadow-2xs"
                            title={`إدراج ${symbol}`}
                          >
                            {symbol}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const cur = q.text || '';
                            updateQuestionText(q.id, cur ? `${cur} <u>كلمة</u>` : '<u>كلمة</u>');
                          }}
                          className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-2 py-1 rounded-md font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                          title="إضافة كلمة تحتها خط <u>...</u> في السؤال"
                        >
                          <span className="underline decoration-2 underline-offset-2"><u>خط</u> (underline)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateQuestionText(q.id, formatScienceNotation(q.text || ''))}
                          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-2.5 py-1 rounded-md transition-all shadow-2xs flex items-center gap-1 mr-auto cursor-pointer"
                          title="تحويل الشحنات الأيونية (مثل Pb+2 إلى Pb²⁺) والأسس (مثل x^2 إلى x²) وأسهم التفاعل (-> إلى →) تلقائياً"
                        >
                          <span>⚡ تحويل الأسس والشحنات تلقائياً</span>
                        </button>
                      </div>
                      <textarea
                        value={q.text}
                        onChange={(e) => updateQuestionText(q.id, e.target.value)}
                        onBlur={() => {
                          if (q.text && (q.text.includes('^') || q.text.includes('->') || /[A-Za-z][+-]\d/.test(q.text) || /[A-Za-z]\d+[+-]/.test(q.text))) {
                            updateQuestionText(q.id, formatScienceNotation(q.text));
                          }
                        }}
                        rows={Math.max(1, Math.min(6, Math.ceil((q.text?.length || 0) / 60)))}
                        dir="auto"
                        className="w-full text-base sm:text-lg font-medium border-b-2 border-slate-200 focus:border-indigo-600 focus:outline-none pb-2 bg-transparent resize-y min-h-[44px] leading-relaxed transition-all"
                        placeholder="اكتب نص السؤال هنا (يمكنك كتابة أي عدد من الكلمات، أو وضع خط تحت كلمة مثل <u>المتفوق</u> أو معادلات مثل x^2)..."
                      />

                      {/* Live LaTeX/KaTeX & Underline Preview if math, science, or formatting is present */}
                      {(q.text?.includes('$') || q.text?.includes('\\') || q.text?.includes('^') || q.text?.includes('_') || q.text?.includes('<u') || q.text?.includes('<b') || q.text?.includes('<i') || /[\u00B2\u00B3\u2070-\u209F\u2192→⇄]/.test(q.text || '')) && (
                        <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100 text-sm text-indigo-950 flex items-start gap-2">
                          <span className="text-[10px] font-bold text-indigo-600 shrink-0 mt-0.5 bg-indigo-100 px-1.5 py-0.5 rounded">معاينة السؤال والتنسيق:</span>
                          <div className="flex-1 overflow-x-auto"><MathText text={q.text} /></div>
                        </div>
                      )}
                      
                      {q.type === 'essay' && (
                        <div className="mt-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-bold text-slate-800">
                              الإجابة النموذجية المعتمدة (غير محدودة الكلمات):
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (q.modelAnswer) {
                                    setQuiz(prev => ({
                                      ...prev,
                                      questions: prev.questions.map(question => 
                                        question.id === q.id ? { ...question, modelAnswer: formatScienceNotation(question.modelAnswer || '') } : question
                                      )
                                    }));
                                  }
                                }}
                                className="text-[11px] bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-medium px-2 py-0.5 rounded border border-slate-200 transition-all"
                                title="تحويل الرموز والأسس والشحنات في الإجابة النموذجية"
                              >
                                ⚡ تحويل الأسس والشحنات
                              </button>
                              <span className="text-xs font-semibold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                {(q.modelAnswer || '').trim().split(/\s+/).filter(Boolean).length} كلمة
                              </span>
                            </div>
                          </div>
                          <textarea
                            value={q.modelAnswer || ''}
                            onChange={(e) => setQuiz(prev => ({
                              ...prev,
                              questions: prev.questions.map(question => 
                                question.id === q.id ? { ...question, modelAnswer: e.target.value } : question
                              )
                            }))}
                            onBlur={() => {
                              if (q.modelAnswer && (q.modelAnswer.includes('^') || q.modelAnswer.includes('->') || /[A-Za-z][+-]\d/.test(q.modelAnswer) || /[A-Za-z]\d+[+-]/.test(q.modelAnswer))) {
                                setQuiz(prev => ({
                                  ...prev,
                                  questions: prev.questions.map(question => 
                                    question.id === q.id ? { ...question, modelAnswer: formatScienceNotation(question.modelAnswer || '') } : question
                                  )
                                }));
                              }
                            }}
                            dir="auto"
                            className="w-full p-3.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none min-h-[110px] resize-y text-sm sm:text-base leading-relaxed"
                            placeholder="أدخل الإجابة النموذجية والشرح الكامل والخطوات دون أي قيود على عدد الكلمات والمعادلات (مثال: x^2 أو Pb+2)..."
                          />
                          {(q.modelAnswer?.includes('$') || q.modelAnswer?.includes('\\') || q.modelAnswer?.includes('^') || /[\u00B2\u00B3\u2070-\u209F\u2192→⇄]/.test(q.modelAnswer || '')) && (
                            <div className="mt-2 p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100 text-sm text-indigo-950 flex items-start gap-2">
                              <span className="text-[10px] font-bold text-indigo-600 shrink-0 mt-0.5 bg-indigo-100 px-1.5 py-0.5 rounded">معاينة إجابة النموذج:</span>
                              <div className="flex-1 overflow-x-auto"><MathText text={q.modelAnswer} /></div>
                            </div>
                          )}

                          {/* Multiple Answer Points Option */}
                          <div className="mt-3 pt-3 border-t border-slate-200/80">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-sm">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <label className="text-xs sm:text-sm font-bold text-slate-800">
                                    عدد النقاط / الخطوات المطلوبة للإجابة (للمسائل والمعادلات والنقاط):
                                  </label>
                                  {q.required_points_count && q.required_points_count > 1 && (
                                    <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                                      مقسم على {q.required_points_count} خطوات / نقاط
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
                                  مثالي لمسائل الفيزياء والرياضيات والكيمياء (مثل: القانون + التعويض والناتج + الوحدة، أو معادلة تفاعل + ملاحظات، أو اذكر 3 عوامل): يقسم درجة السؤال بالتساوي ({(q.points / (q.required_points_count || 1)).toFixed(1).replace(/\.0$/, '')} درجات لكل خطوة/نقطة)، ويُحاسب الطالب على ما قدّمه من خطوات صحيحة دون حرمانه من الدرجة كاملة عند نقص خطوة أو نقطة.
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                                <span className="text-xs font-semibold text-slate-600">النقاط:</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="20"
                                  value={q.required_points_count || ''}
                                  onChange={(e) => {
                                    const val = e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : undefined;
                                    setQuiz(prev => ({
                                      ...prev,
                                      questions: prev.questions.map(question =>
                                        question.id === q.id ? { ...question, required_points_count: val } : question
                                      )
                                    }));
                                  }}
                                  placeholder="1 (افتراضي)"
                                  className="w-24 text-center px-2 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg font-bold text-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
                                />
                                {q.required_points_count && q.required_points_count > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuiz(prev => ({
                                        ...prev,
                                        questions: prev.questions.map(question =>
                                          question.id === q.id ? { ...question, required_points_count: undefined } : question
                                        )
                                      }));
                                    }}
                                    className="text-xs text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                                    title="إلغاء التحديد والعودة للنظام الافتراضي"
                                  >
                                    إلغاء
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Keywords For Automatic Full Grade */}
                          <div className="mt-3 pt-3 border-t border-slate-200/80">
                            <div className="flex flex-col gap-2.5 bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200/90 shadow-2xs">
                              <div className="flex items-center gap-1.5">
                                <KeyRound size={16} className="text-emerald-700" />
                                <label className="text-xs sm:text-sm font-bold text-emerald-950">
                                  الكلمات المفتاحية للدرجة الكاملة التلقائية (اختياري):
                                </label>
                              </div>
                              <p className="text-[11px] sm:text-xs text-emerald-800 leading-relaxed">
                                إذا تضمن جواب الطالب أيًا من هذه الكلمات المفتاحية، فسيتم منحه الدرجة الكاملة فورًا وتلقائيًا للتسهيل وتسريع التصحيح (اكتب الكلمات تفصل بينها فاصلة عادية أو واو مثل: بناء ضوئي، حرارة، O2).
                              </p>
                              <input
                                type="text"
                                value={q.keywords ? (Array.isArray(q.keywords) ? q.keywords.join('، ') : String(q.keywords)) : ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const keywordsArray = val.split(/[،,و\+]/)
                                    .map(k => k.trim())
                                    .filter(Boolean);
                                  
                                  setQuiz(prev => ({
                                    ...prev,
                                    questions: prev.questions.map(question =>
                                      question.id === q.id ? { ...question, keywords: keywordsArray.length > 0 ? keywordsArray : undefined } : question
                                    )
                                  }));
                                }}
                                placeholder="مثال: ثاني أكسيد الكربون، CO2، غاز"
                                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-emerald-300 rounded-lg text-emerald-900 placeholder-emerald-700/50 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none font-medium"
                              />
                              {q.keywords && Array.isArray(q.keywords) && q.keywords.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {q.keywords.map((kw, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      <span>{kw}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const filtered = q.keywords!.filter((_, i) => i !== idx);
                                          setQuiz(prev => ({
                                            ...prev,
                                            questions: prev.questions.map(question =>
                                              question.id === q.id ? { ...question, keywords: filtered.length > 0 ? filtered : undefined } : question
                                            )
                                          }));
                                        }}
                                        className="hover:text-rose-600 font-normal shrink-0"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                        </div>
                      )}

                      {/* Question Diagram / Image */}
                      {q.image && (
                        <div className="mt-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 inline-block max-w-full">
                          <p className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
                            <Image size={14} className="text-indigo-600" />
                            <span>الصورة / الرسم التوضيحي المرفق مع السؤال:</span>
                          </p>
                          <div 
                            className="relative group cursor-pointer inline-block"
                            onClick={() => setImageZoomModalUrl(q.image || null)}
                            title="انقر لتكبير وفحص الصورة بالكامل"
                          >
                            <img 
                              src={q.image} 
                              alt="Question diagram" 
                              className="max-h-56 sm:max-h-64 max-w-full object-contain rounded-xl border border-slate-200 bg-white shadow-sm group-hover:border-indigo-300 transition-all" 
                            />
                            <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-white font-bold text-xs gap-1">
                              <Eye size={16} />
                              <span>تكبير الصورة</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <button 
                              type="button"
                              onClick={() => updateQuestionImage(q.id, '')} 
                              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg font-bold transition-all border border-red-200 cursor-pointer"
                            >
                              <Trash2 size={14} />
                              <span>حذف الصورة</span>
                            </button>
                            <label htmlFor={`image-upload-${q.id}`} className="cursor-pointer flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-bold transition-all border border-indigo-200">
                              <RefreshCw size={14} />
                              <span>تغيير الصورة</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => setImageZoomModalUrl(q.image || null)}
                              className="flex items-center gap-1 text-xs text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg font-bold transition-all border border-slate-200 cursor-pointer"
                            >
                              <Eye size={14} />
                              <span>معاينة مكبرة</span>
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="pt-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const optimizedData = await optimizeQuestionImage(file);
                                updateQuestionImage(q.id, optimizedData);
                              } catch (err) {
                                console.error("Failed to load question image:", err);
                              }
                            }
                          }}
                          className="hidden"
                          id={`image-upload-${q.id}`}
                        />
                        {!q.image && (
                          <label htmlFor={`image-upload-${q.id}`} className="cursor-pointer text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-100 transition-colors">
                            <Image size={16} />
                            <span>إرفاق صورة أو رسم توضيحي مع السؤال</span>
                          </label>
                        )}
                      </div>

                      {/* Question Audio / Listening Component */}
                      <div className="pt-2">
                        <AudioRecorderControl
                          questionId={q.id}
                          currentAudio={q.audio}
                          onUpdateAudio={(audioDataUrl) => updateQuestionAudio(q.id, audioDataUrl)}
                        />
                      </div>
                    </div>

                    <div className="w-24 shrink-0 bg-slate-50 p-2.5 rounded-2xl border border-slate-200 text-center">
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">الدرجة</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={q.points || 1}
                        onChange={(e) => updateQuestionPoints(q.id, parseFloat(e.target.value) || 0)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-center font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  {q.type !== 'essay' && (
                    <div className="space-y-3 pl-4 sm:pl-12 pt-2">
                      {q.options?.map((opt, optIndex) => (
                        <div key={optIndex} className="flex items-center gap-3">
                          <button
                            onClick={() => setCorrectOption(q.id, optIndex)}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                              q.correctOptionIndex === optIndex
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-slate-300 hover:border-emerald-400'
                            }`}
                            title="تعيين كإجابة صحيحة"
                          >
                            {q.correctOptionIndex === optIndex && <CheckCircle2 size={14} />}
                          </button>
                          <input
                            type="text"
                            value={opt}
                            dir="auto"
                            onChange={(e) => updateOptionText(q.id, optIndex, e.target.value)}
                            className={`flex-1 p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm sm:text-base ${
                              q.correctOptionIndex === optIndex
                                ? 'border-emerald-200 bg-emerald-50/50 font-medium text-slate-800'
                                : 'border-slate-200 bg-slate-50'
                            }`}
                            placeholder={`الخيار ${optIndex + 1}`}
                          />
                          {q.type === 'multiple-choice' && q.options.length > 2 && (
                            <button
                              onClick={() => removeOption(q.id, optIndex)}
                              className="text-slate-400 hover:text-red-500 p-2 transition-colors"
                              title="حذف هذا الخيار"
                            >
                              <XCircle size={18} />
                            </button>
                          )}
                        </div>
                      ))}
                      
                      {q.type === 'multiple-choice' && (
                        <button
                          onClick={() => addOption(q.id)}
                          className="flex items-center gap-2 text-xs sm:text-sm text-indigo-600 hover:text-indigo-700 font-bold mt-3 px-3 py-1.5 rounded-xl hover:bg-indigo-50 transition-colors border border-dashed border-indigo-200"
                        >
                          <PlusCircle size={16} />
                          إضافة خيار
                        </button>
                      )}
                    </div>
                  )}

                  {q.type !== 'essay' && (
                    <div className="mt-3 pl-4 sm:pl-12">
                      <details className="group bg-slate-50/80 border border-slate-200 rounded-xl overflow-hidden" open={Boolean(q.modelAnswer && q.modelAnswer.trim().length > 0)}>
                        <summary className="px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer flex items-center justify-between hover:bg-slate-100 transition-colors select-none">
                          <span className="flex items-center gap-1.5">
                            <span className="text-amber-500">💡</span>
                            <span>طريقة الحل والشرح النموذجي {q.modelAnswer ? '(تم إعدادها بواسطة الذكاء الاصطناعي)' : '(اختياري)'}</span>
                          </span>
                          <span className="text-[10px] text-indigo-600 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="p-3 border-t border-slate-200 bg-white space-y-2">
                          <textarea
                            value={q.modelAnswer || ''}
                            onChange={(e) => updateQuestionModelAnswer(q.id, e.target.value)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            placeholder="شرح الإجابة، خطوات الحل الرياضي، أو القوانين المستخدمة لتوضيح سبب صحة هذا الخيار..."
                            rows={2}
                          />
                        </div>
                      </details>
                    </div>
                  )}

                  {/* Card Footer Quick Delete & Info */}
                  <div className="flex items-center justify-between pt-3 mt-4 border-t border-slate-100 text-xs text-slate-400">
                    <span>السؤال رقم {qIndex + 1}</span>
                    <button
                      onClick={() => removeQuestion(q.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors"
                    >
                      <Trash2 size={13} />
                      <span>حذف السؤال #{qIndex + 1}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 pt-4">
              {(() => {
                const isProActive = quiz.ai_model === 'pro' || 
                  quiz.ai_model === 'gemini_pro' ||
                  (!quiz.ai_model && isTeacherPro);

                const currentModelChoice = isProActive ? 'pro' : 'flash';
                const modelInfo = getAiModelForSubject(user?.subject || profileData.subject, user?.subscription_type, currentModelChoice);
                return (
                  <div className="p-3.5 rounded-2xl border bg-slate-50/90 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-3 h-3 rounded-full shrink-0 ${isProActive ? 'bg-indigo-600 animate-pulse' : 'bg-emerald-500'}`} />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800">
                            نموذج الذكاء الاصطناعي لهذا الاختبار:
                          </span>
                          <span className={`font-black px-2 py-0.5 rounded-md text-[11px] ${
                            isProActive
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {modelInfo.badgeText} ({modelInfo.pricePerMillion} ج.م / 1M توكن)
                          </span>
                          <span className="text-[10px] text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded font-bold">
                            {isProActive ? 'المخرجات × 6' : 'المخرجات × 5'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {modelInfo.badgeDescription}
                        </p>
                      </div>
                    </div>

                    {/* Interactive Switcher for this quiz */}
                    <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs shrink-0 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setQuiz(prev => ({ ...prev, ai_model: 'flash' }))}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                          !isProActive
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                        title="فلاش 3.8: 200 جنيه لكل 1 مليون توكن - فائق السرعة وموفر"
                      >
                        <Zap size={13} />
                        <span>فلاش 3.8 (200 ج.م)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isTeacherPro) {
                            setShowProUpgradeModal(true);
                            return;
                          }
                          setQuiz(prev => ({ ...prev, ai_model: 'pro' }));
                        }}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                          isProActive
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                        title="جيميناي برو: 250 جنيه لكل 1 مليون توكن - استدلال وتفكير عميق"
                      >
                        <Sparkles size={13} />
                        <span>جيميناي برو (250 ج.م)</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                <button
                  onClick={addQuestion}
                  className="flex items-center gap-2 bg-white border-2 border-dashed border-slate-300 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 px-6 py-4 rounded-xl font-medium transition-all justify-center"
                >
                  <PlusCircle size={20} />
                  إضافة سؤال جديد
                </button>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isGenerating}
                    className="flex items-center gap-2 bg-indigo-50 border-2 border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300 px-6 py-4 rounded-xl font-medium transition-all justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <FileText size={20} />}
                    {isGenerating ? 'جاري استخراج الأسئلة...' : 'توليد من ملف (PDF, Word...)'}
                  </button>
                  {generationProgress && (
                    <div className={`text-xs mt-1 animate-pulse font-medium ${
                      generationProgress.includes('بنجاح') ? 'text-emerald-600' : 
                      generationProgress.includes('خطأ') ? 'text-red-500' : 'text-blue-600'
                    }`}>
                      {generationProgress}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 text-center">يدعم PDF، Word، Excel، والنصوص</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isGenerating}
                    className="flex items-center gap-2 bg-emerald-50 border-2 border-dashed border-emerald-200 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-300 px-6 py-4 rounded-xl font-medium transition-all justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Image size={20} />}
                    {isGenerating ? 'جاري استخراج الأسئلة...' : 'توليد من صورة'}
                  </button>
                  {generationProgress && (
                    <div className={`text-xs mt-1 animate-pulse font-medium ${
                      generationProgress.includes('بنجاح') ? 'text-emerald-600' : 'text-blue-600'
                    }`}>
                      {generationProgress}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 text-center">يدعم استخراج الصور والمعادلات بدقة عالية</p>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleDocumentUpload}
                  accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.heic"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 flex gap-2 overflow-x-auto no-scrollbar z-30 sm:relative sm:bottom-auto sm:left-auto sm:right-auto sm:bg-transparent sm:border-none sm:p-0 sm:mt-8 sm:justify-center sm:flex-wrap shadow-lg sm:shadow-none">
              <button
                onClick={() => saveQuiz(false)}
                disabled={isSavingQuiz}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 sm:px-8 py-2.5 sm:py-3.5 rounded-full shadow-md hover:shadow-lg transition-all flex items-center gap-2 font-bold whitespace-nowrap text-xs sm:text-base active:scale-95 disabled:opacity-50"
              >
                {isSavingQuiz ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                <span>{isSavingQuiz ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
              </button>
              <button
                onClick={() => {
                  saveQuiz(true);
                }}
                disabled={isSavingQuiz}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-full shadow-md hover:shadow-lg transition-all flex items-center gap-2 font-medium whitespace-nowrap text-xs sm:text-base"
              >
                <QrCode size={16} className="sm:w-[18px] sm:h-[18px]" />
                مشاركة الاختبار
              </button>
              <button
                onClick={() => {
                  if (!quiz.id) {
                    alert('يرجى حفظ التعديلات أولاً لعرض نتائج الطلاب المسجلة لهذا الاختبار.');
                  } else {
                    fetchResults(quiz.id);
                  }
                }}
                className="bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-4 sm:px-6 py-2 sm:py-3 rounded-full shadow-md hover:shadow-lg transition-all flex items-center gap-2 font-medium whitespace-nowrap text-xs sm:text-base"
              >
                <Users size={16} className="sm:w-[18px] sm:h-[18px]" />
                عرض النتائج
              </button>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200">
                <button
                  onClick={() => downloadAsWord(false)}
                  disabled={isExportingWord}
                  className="bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 font-bold whitespace-nowrap text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                  title="تحميل ملف Word للطلاب (بدون إجابات)"
                >
                  {isExportingWord ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                  <span>Word</span>
                </button>
                <button
                  onClick={() => downloadAsWord(true)}
                  disabled={isExportingWord}
                  className="bg-blue-600 text-white hover:bg-blue-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 font-bold whitespace-nowrap text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                  title="تحميل ملف Word مع الإجابات النموذجية وخطوات الحل والشرح الكامل"
                >
                  {isExportingWord ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                  <span>{isExportingWord ? 'جاري التجهيز...' : 'نموذج الإجابة (Word) 💡'}</span>
                </button>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200">
                <button
                  onClick={() => downloadAsPdf(false)}
                  disabled={isExportingPdf}
                  className="bg-white text-red-600 border border-red-200 hover:bg-red-50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 font-bold whitespace-nowrap text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                  title="تحميل ملف PDF للطلاب (بدون إجابات)"
                >
                  {isExportingPdf ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => downloadAsPdf(true)}
                  disabled={isExportingPdf}
                  className="bg-red-600 text-white hover:bg-red-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 font-bold whitespace-nowrap text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                  title="تحميل ملف PDF مع الإجابات النموذجية وخطوات الحل والشرح الكامل"
                >
                  {isExportingPdf ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
                  <span>{isExportingPdf ? 'جاري التحضير...' : 'نموذج الإجابة (PDF) 💡'}</span>
                </button>
              </div>
              <button
                onClick={() => {
                  setMode('take-intro');
                  setStudentAnswers({});
                  setStudentName('');
                  setCenterName('');
                  setParentPhone('');
                  setStudentEmail('');
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-full shadow-md hover:shadow-lg transition-all flex items-center gap-2 font-medium whitespace-nowrap text-xs sm:text-base cursor-pointer"
              >
                <Play size={16} className="sm:w-[18px] sm:h-[18px]" />
                تجربة الاختبار
              </button>

              <button
                type="button"
                onClick={() => requestDeleteQuiz(quiz)}
                className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 hover:border-rose-300 px-4 sm:px-6 py-2 sm:py-3 rounded-full shadow-xs hover:shadow-md transition-all flex items-center gap-2 font-bold whitespace-nowrap text-xs sm:text-base cursor-pointer"
                title="حذف هذا الاختبار بالكامل نهائياً"
              >
                <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span>حذف الاختبار بالكامل</span>
              </button>
            </div>

            {/* Hidden Quiz Preview for PDF Generation */}
            <div id="quiz-preview-content" style={{ position: 'absolute', left: '-9999px', top: 0, width: '800px' }} className="p-10 bg-white text-black" >
              <div className="text-center mb-10 border-b-2 border-black pb-5">
                <h1 className="text-3xl font-bold mb-2">{quiz.title}</h1>
                <div className="flex justify-between text-sm font-bold mt-4">
                  <span>الاسم: ............................................................</span>
                  <span>الدرجة: ................... / {calculateTotalPoints()}</span>
                </div>
              </div>
              <div className="space-y-8">
                {(quiz.questions || []).map((q, i) => (
                  <div key={q.id} className="break-inside-avoid">
                    <div className="flex gap-2 mb-2">
                      <span className="font-bold">{i + 1}.</span>
                      <div className="flex-1">
                        <div className="font-bold text-lg"><MathText text={q.text} /></div>
                        {q.image && (
                          <div className="my-4">
                            <img src={q.image} alt="Question" className="max-h-64 rounded-lg border border-slate-200" />
                          </div>
                        )}
                        {q.audio && (
                          <div className="my-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-700">
                            <Volume2 size={16} className="text-indigo-600 shrink-0" />
                            <span>[سؤال استماعي مرفق بمقطع صوتي]</span>
                            <audio controls src={q.audio} className="h-8 max-w-xs print:hidden" />
                          </div>
                        )}
                        {q.type === 'multiple-choice' ? (
                          <div className="grid grid-cols-2 gap-4 mt-4">
                            {q.options?.map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full border border-black flex items-center justify-center text-xs font-bold shrink-0">
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <div><MathText text={opt} /></div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-4 h-24 border-b border-dashed border-slate-400"></div>
                        )}
                      </div>
                      <span className="text-xs font-bold shrink-0">({q.points} درجة)</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-20 text-center text-sm border-t pt-5">
                <p>مع تمنياتي لكم بالتوفيق والنجاح</p>
                {teacherInfo?.name && <p className="font-bold mt-2">أ/ {teacherInfo.name}</p>}
              </div>
            </div>

            {/* Hidden Quiz Preview with Full Model Answers for PDF Generation */}
            <div id="quiz-preview-answers-content" style={{ position: 'absolute', left: '-9999px', top: 0, width: '800px' }} className="p-10 bg-white text-black" >
              <div className="text-center mb-10 border-b-2 border-emerald-600 pb-5">
                <div className="inline-block bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full mb-2 border border-emerald-300">
                  نموذج الإجابة والحل والشرح الشامل 💡
                </div>
                <h1 className="text-3xl font-bold mb-2">{quiz.title}</h1>
                <div className="flex justify-between text-sm font-bold mt-4 text-slate-700">
                  <span>إجمالي الأسئلة: {(quiz.questions || []).length}</span>
                  <span>الدرجة الكلية: {calculateTotalPoints()} درجة</span>
                </div>
              </div>
              <div className="space-y-8">
                {(quiz.questions || []).map((q, i) => (
                  <div key={q.id} className="break-inside-avoid border-b border-slate-200 pb-6">
                    <div className="flex gap-2 mb-2">
                      <span className="font-bold text-base text-slate-900">{i + 1}.</span>
                      <div className="flex-1">
                        <div className="font-bold text-lg text-slate-900"><MathText text={q.text} /></div>
                        {q.image && (
                          <div className="my-4">
                            <img src={q.image} alt="Question" className="max-h-64 rounded-lg border border-slate-200" />
                          </div>
                        )}
                        {q.type === 'multiple-choice' || q.type === 'true-false' ? (
                          <div className="grid grid-cols-2 gap-3 mt-4">
                            {q.options?.map((opt, optIdx) => {
                              const isCorrect = q.correctOptionIndex === optIdx;
                              return (
                                <div key={optIdx} className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${isCorrect ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isCorrect ? 'bg-emerald-600 text-white' : 'border border-slate-400'}`}>
                                    {isCorrect ? '✓' : String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <div className="flex-1"><MathText text={opt} /></div>
                                  {isCorrect && (
                                    <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-bold">
                                      الإجابة الصحيحة
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}

                        {/* Model Answer / Solution Steps */}
                        {q.modelAnswer ? (
                          <div className="mt-4 p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-sm text-slate-800">
                            <p className="font-bold text-emerald-900 text-xs mb-1 flex items-center gap-1">
                              <span>💡 {q.type === 'essay' ? 'الإجابة النموذجية المعتمدة والتوزيع:' : 'طريقة الحل والشرح النموذجي:'}</span>
                            </p>
                            <div className="leading-relaxed"><MathText text={q.modelAnswer} /></div>
                          </div>
                        ) : q.type === 'essay' ? (
                          <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                            <span>[سؤال مقالي - لم يتم تدوين إجابة نموذجية]</span>
                          </div>
                        ) : null}
                      </div>
                      <span className="text-xs font-bold shrink-0 text-slate-600">({q.points} درجة)</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-16 text-center text-sm border-t border-slate-300 pt-5 text-slate-600">
                <p>مع تمنياتي لكم بالتوفيق والنجاح والتفوق الدائم</p>
                {teacherInfo?.name && <p className="font-bold mt-2 text-base text-slate-900">أ/ {teacherInfo.name}</p>}
              </div>
            </div>
          </div>
        )}

        {mode === 'take-intro' && (() => {
          const quizExpInfo = getQuizExpirationInfo(quiz?.expires_at);

          const relevantNotifs = studentNotifications.filter(notif => {
            if (!notif.targetType || notif.targetType === 'all') return true;
            if (notif.targetType === 'grade') {
              return !notif.targetValue || notif.targetValue === 'الكل' || notif.targetValue === quiz?.grade_level;
            }
            if (notif.targetType === 'subject') {
              return !notif.targetValue || notif.targetValue === 'الكل' || notif.targetValue === teacherInfo?.subject;
            }
            if (notif.targetType === 'teacher') {
              return !notif.targetValue || notif.targetValue === 'الكل' || notif.targetValue === teacherInfo?.name;
            }
            return true;
          });

          return (
            <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto px-4">
              {relevantNotifs.length > 0 && (
                <div className="space-y-3">
                  {relevantNotifs.map(notif => (
                    <div key={notif.id} className="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-4 rounded-2xl shadow-md border border-amber-400 text-right">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm flex items-center gap-1.5">
                          <Bell size={16} className="animate-bounce" />
                          {notif.title}
                        </span>
                        <span className="text-[10px] bg-amber-700/60 px-2 py-0.5 rounded-full">إشعار من إدارة المنصة</span>
                      </div>
                      <p className="text-xs text-amber-50 leading-relaxed whitespace-pre-wrap">{notif.message}</p>
                      <div className="mt-2 text-[10px] text-amber-200 flex justify-between">
                        <span>التصنيف: {notif.targetType === 'all' ? 'جميع الطلاب' : notif.targetValue}</span>
                        <span>{notif.created_at ? new Date(notif.created_at).toLocaleDateString('ar-EG') : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-slate-200 text-center">
              {quizLoadError ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <XCircle className="text-red-500 w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800 mb-2">خطأ في التحميل</h2>
                  <p className="text-slate-500">{quizLoadError}</p>
                </div>
              ) : (
                <>
                  {teacherInfo?.avatar_data && (
                <div className="flex flex-col items-center mb-6">
                  <img 
                    src={teacherInfo.avatar_data} 
                    alt={teacherInfo.name} 
                    className="w-24 h-24 rounded-full border-4 border-indigo-100 shadow-md object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <p className="mt-2 font-bold text-indigo-900">أ/ {teacherInfo.name}</p>
                  {teacherInfo.subject && <p className="text-xs text-slate-500 font-medium">مدرس {teacherInfo.subject}</p>}
                </div>
              )}
              <h2 className="text-2xl font-bold text-slate-800 mb-2">{quiz.title}</h2>
              <div className="flex items-center justify-center flex-wrap gap-2 sm:gap-3 mb-6">
                <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-100">
                  {(quiz.questions || []).length} سؤال
                </span>
                <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-100">
                  {calculateTotalPoints()} درجة
                </span>
                {quiz.time_limit && quiz.time_limit > 0 ? (
                  <span className="bg-amber-50 text-amber-800 px-3 py-1 rounded-full text-xs font-bold border border-amber-200 flex items-center gap-1">
                    <Clock size={13} className="text-amber-600" />
                    <span>المدة: {formatTimeLimitLabel(quiz.time_limit)}</span>
                  </span>
                ) : (
                  <span className="bg-slate-50 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200 flex items-center gap-1">
                    <Clock size={13} className="text-slate-400" />
                    <span>وقت مفتوح</span>
                  </span>
                )}
                {quizExpInfo && !quizExpInfo.isExpired && (
                  <span className="bg-amber-50 text-amber-800 px-3 py-1 rounded-full text-xs font-bold border border-amber-200 flex items-center gap-1">
                    <CalendarDays size={13} className="text-amber-600" />
                    <span>{quizExpInfo.shortBadge}</span>
                  </span>
                )}
              </div>

              {quizExpInfo?.isExpired ? (
                <div className="bg-rose-50 border-2 border-rose-200 rounded-3xl p-6 sm:p-7 text-center my-4 space-y-4">
                  <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <AlertTriangle size={32} />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-xl font-bold text-rose-900">عذراً، انتهت صلاحية رابط هذا الاختبار</h3>
                    <p className="text-sm text-rose-700 leading-relaxed">
                      تم إغلاق استقبال إجابات الطلاب لهذا الاختبار بتاريخ <br />
                      <span className="font-bold text-rose-950 font-mono text-sm mt-1 inline-block bg-white/70 px-3 py-1 rounded-lg border border-rose-200">
                        {quizExpInfo.fullDate}
                      </span>
                    </p>
                  </div>
                  <div className="bg-white/90 rounded-2xl p-4 border border-rose-200 text-xs text-slate-600 text-right space-y-1 shadow-sm">
                    <p className="font-bold text-slate-800">هل تحتاج لتقديم هذا الاختبار؟</p>
                    <p className="leading-relaxed">
                      يرجى التواصل مع معلم المادة {teacherInfo?.name ? `(أ/ ${teacherInfo.name})` : ''} لطلب تمديد موعد الاختبار أو إعادة تفعيل الرابط.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-slate-500 mb-8">الرجاء إدخال بياناتك قبل بدء الاختبار</p>
              
                <div className="space-y-4 text-right">
                {/* Student Entrance Code Field */}
                {(quiz.require_student_code || (Array.isArray(quiz.student_codes) && quiz.student_codes.length > 0)) && (
                  <div className="bg-gradient-to-r from-amber-50 via-indigo-50/40 to-amber-50 p-3.5 rounded-2xl border border-amber-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-black text-amber-950 flex items-center gap-1.5">
                        <KeyRound size={15} className="text-amber-600" />
                        <span>كود الطالب لدخول الاختبار *</span>
                        {quiz.require_student_code && (
                          <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full border border-rose-200">
                            مطلوب وإلزامي
                          </span>
                        )}
                      </label>
                      {studentCode.trim() && (() => {
                        const matched = Array.isArray(quiz.student_codes) 
                          ? quiz.student_codes.find((c: any) => (c.code || '').toUpperCase() === studentCode.trim().toUpperCase())
                          : null;
                        if (matched) {
                          if (matched.used) {
                            return <span className="text-[10px] font-bold text-rose-600">⚠ الكود مستخدم مسبقاً</span>;
                          }
                          return <span className="text-[10px] font-bold text-emerald-600">✓ كود معتمد ({matched.student_name})</span>;
                        }
                        return <span className="text-[10px] font-bold text-slate-400">كود خاص</span>;
                      })()}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={studentCode}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setStudentCode(val);
                          if (attemptCheckError) setAttemptCheckError('');
                          // Auto-fill student info if recognized in student_codes
                          if (Array.isArray(quiz.student_codes)) {
                            const found = quiz.student_codes.find((c: any) => (c.code || '').toUpperCase() === val.trim());
                            if (found) {
                              if (found.student_name && !studentName.trim()) {
                                setStudentName(found.student_name);
                              }
                              if (found.center_name && !centerName.trim()) {
                                setCenterName(found.center_name);
                              }
                              if (found.student_phone && !studentPhone.trim()) {
                                setStudentPhone(found.student_phone);
                              }
                              if (found.parent_phone && !parentPhone.trim()) {
                                setParentPhone(found.parent_phone);
                              }
                            }
                          }
                        }}
                        autoComplete="off"
                        maxLength={25}
                        dir="ltr"
                        className="w-full p-3 rounded-xl border border-amber-300 focus:border-indigo-600 focus:ring-2 focus:ring-amber-400/20 outline-none font-mono font-black text-sm uppercase bg-white text-slate-800 placeholder-slate-400"
                        placeholder="أدخل الكود الخاص بك (مثال: ST-8492)"
                      />
                    </div>
                    <p className="text-[11px] text-amber-800/80 mt-1.5 leading-relaxed">
                      هذا الكود تم إنشاؤه لك خصيصاً من قِبل معلم المادة لمنع تكرار الدخول وضمان تسجيل درجتك بشكل صحيح.
                    </p>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700">اسم الطالب (ثلاثي بالكامل)</label>
                    {studentName.trim() && (
                      <span className={`text-[11px] font-bold ${
                        studentName.trim().replace(/\s+/g, '').length >= 9 && studentName.trim().split(/\s+/).filter(Boolean).length >= 3
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      }`}>
                        {studentName.trim().split(/\s+/).filter(Boolean).length < 3
                          ? 'يجب إدخال اسم ثلاثي (3 مقاطع على الأقل)'
                          : studentName.trim().replace(/\s+/g, '').length < 9
                          ? `متبقي ${9 - studentName.trim().replace(/\s+/g, '').length} أحرف للحد الأدنى (9 أحرف)`
                          : '✓ اسم صحيح'}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => {
                      setStudentName(e.target.value);
                      if (attemptCheckError) setAttemptCheckError('');
                    }}
                    autoComplete="off"
                    maxLength={90}
                    className={`w-full p-3 rounded-xl border focus:ring-2 outline-none transition-all ${
                      studentName.trim() && (studentName.trim().replace(/\s+/g, '').length < 9 || studentName.trim().split(/\s+/).filter(Boolean).length < 3)
                        ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-500/20 bg-amber-50/20'
                        : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20'
                    }`}
                    placeholder="مثال: أحمد محمد علي..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">السنتر / المجموعة</label>
                  {profileData.centers.length > 0 ? (
                    <select
                      value={centerName}
                      onChange={(e) => {
                        setCenterName(e.target.value);
                        if (attemptCheckError) setAttemptCheckError('');
                      }}
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all bg-white"
                    >
                      <option value="">اختر السنتر أو المجموعة...</option>
                      {profileData.centers.map(center => (
                        <option key={center} value={center}>{center}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={centerName}
                      onChange={(e) => {
                        setCenterName(e.target.value);
                        if (attemptCheckError) setAttemptCheckError('');
                      }}
                      autoComplete="off"
                      maxLength={90}
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                      placeholder="أدخل اسم السنتر أو المجموعة..."
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">المرحلة الدراسية</label>
                  <select
                    value={studentGrade}
                    onChange={(e) => {
                      setStudentGrade(e.target.value);
                      if (attemptCheckError) setAttemptCheckError('');
                    }}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all bg-white font-bold"
                  >
                    <option value="">اختر مرحلتك الدراسية...</option>
                    {GRADE_LEVELS.map(g => (
                      <option key={g.value} value={g.label}>{g.label} ({g.group})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700">رقم تليفون الطالب (واتساب - 11 رقم)</label>
                    {studentPhone.trim() && (
                      <span className={`text-[11px] font-bold ${
                        studentPhone.replace(/[^0-9]/g, '').length === 11 ? 'text-emerald-600' : 'text-amber-600'
                      }`}>
                        {studentPhone.replace(/[^0-9]/g, '').length === 11
                          ? '✓ 11 رقم صحيح'
                          : `${studentPhone.replace(/[^0-9]/g, '').length} من 11 رقم`}
                      </span>
                    )}
                  </div>
                  <input
                    type="tel"
                    value={studentPhone}
                    onChange={(e) => {
                      // Only allow numeric characters and max 11 digits
                      const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
                      setStudentPhone(val);
                      if (attemptCheckError) setAttemptCheckError('');
                    }}
                    autoComplete="off"
                    maxLength={11}
                    className={`w-full p-3 rounded-xl border focus:ring-2 outline-none transition-all ${
                      studentPhone.trim() && studentPhone.replace(/[^0-9]/g, '').length !== 11
                        ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-500/20 bg-amber-50/20'
                        : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20'
                    }`}
                    placeholder="01012345678"
                    dir="ltr"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700">رقم واتساب ولي الأمر (11 رقم)</label>
                    {parentPhone.trim() && (
                      <span className={`text-[11px] font-bold ${
                        parentPhone.replace(/[^0-9]/g, '').length === 11 ? 'text-emerald-600' : 'text-amber-600'
                      }`}>
                        {parentPhone.replace(/[^0-9]/g, '').length === 11
                          ? '✓ 11 رقم صحيح'
                          : `${parentPhone.replace(/[^0-9]/g, '').length} من 11 رقم`}
                      </span>
                    )}
                  </div>
                  <input
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => {
                      // Only allow numeric characters and max 11 digits
                      const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
                      setParentPhone(val);
                      if (attemptCheckError) setAttemptCheckError('');
                    }}
                    autoComplete="off"
                    maxLength={11}
                    className={`w-full p-3 rounded-xl border focus:ring-2 outline-none transition-all ${
                      parentPhone.trim() && parentPhone.replace(/[^0-9]/g, '').length !== 11
                        ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-500/20 bg-amber-50/20'
                        : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20'
                    }`}
                    placeholder="01012345678"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Email Input (Optional) */}
              <div className="mt-4 mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-1">البريد الإلكتروني <span className="text-xs text-slate-400 font-normal">(اختياري)</span></label>
                <input
                  type="email"
                  value={studentEmail}
                  onChange={(e) => {
                    setStudentEmail(e.target.value);
                    if (attemptCheckError) setAttemptCheckError('');
                  }}
                  autoComplete="off"
                  className="w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                  placeholder="student@example.com"
                  dir="ltr"
                />
              </div>

              {attemptCheckError && (
                <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm font-bold text-center animate-in fade-in">
                  {attemptCheckError}
                </div>
              )}

              {(() => {
                const trimmedName = studentName.trim();
                const nameParts = trimmedName.split(/\s+/).filter(Boolean);
                const nameLettersCount = trimmedName.replace(/\s+/g, '').length;
                const isNameValid = nameParts.length >= 3 && nameLettersCount >= 9;

                const cleanStudentP = studentPhone.replace(/[^0-9]/g, '');
                const isStudentPhoneValid = cleanStudentP.length === 11;

                const cleanParentP = parentPhone.replace(/[^0-9]/g, '');
                const isParentPhoneValid = cleanParentP.length === 11;

                const cleanStudentCode = studentCode.trim().toUpperCase();
                const isStudentCodeRequired = Boolean(quiz.require_student_code);
                const isStudentCodeValid = !isStudentCodeRequired || Boolean(cleanStudentCode);

                const isFormComplete = isNameValid && Boolean(centerName.trim()) && Boolean(studentGrade) && isStudentPhoneValid && isParentPhoneValid && isStudentCodeValid;

                return (
                  <button
                    onClick={async () => {
                      if (!isFormComplete) {
                        if (isStudentCodeRequired && !cleanStudentCode) {
                          setAttemptCheckError('هذا الاختبار يتطلب إدخال كود الطالب الخاص بك المصرح له بالدخول.');
                        } else if (!isNameValid) {
                          setAttemptCheckError('يرجى إدخال اسم الطالب ثلاثي بالكامل (3 مقاطع و 9 أحرف على الأقل).');
                        } else if (!isStudentPhoneValid) {
                          setAttemptCheckError('رقم هاتف الطالب يجب أن يتكون من 11 رقماً صحيحاً (مثال: 01012345678).');
                        } else if (!isParentPhoneValid) {
                          setAttemptCheckError('رقم هاتف ولي الأمر يجب أن يتكون من 11 رقماً صحيحاً (مثال: 01012345678).');
                        } else if (!centerName.trim()) {
                          setAttemptCheckError('يرجى تحديد السنتر أو المجموعة.');
                        } else if (!studentGrade) {
                          setAttemptCheckError('يرجى اختيار المرحلة الدراسية.');
                        }
                        return;
                      }

                      // Client check for registered student_codes if available
                      if (Array.isArray(quiz.student_codes) && quiz.student_codes.length > 0 && cleanStudentCode) {
                        const matchedCodeObj = quiz.student_codes.find((c: any) => (c.code || '').toUpperCase() === cleanStudentCode);
                        if (!matchedCodeObj && isStudentCodeRequired) {
                          setAttemptCheckError(`كود الطالب (${cleanStudentCode}) غير مسجل في قائمة هذا الاختبار. يرجى مراجعة المعلم.`);
                          return;
                        }
                        if (matchedCodeObj && matchedCodeObj.used) {
                          setAttemptCheckError(`تم استخدام كود الطالب (${cleanStudentCode}) مسبقاً في هذا الاختبار. يرجى مراجعة المعلم لإلغاء القفل.`);
                          return;
                        }
                      }
                      
                      const maxAttempts = (typeof quiz.maxAttempts === 'number' && quiz.maxAttempts > 0) ? quiz.maxAttempts : 1;
                      
                      // 1. Strict Local Device Check
                      if (quiz.id && !(user && (user.id === quiz.user_id || user.uid === quiz.user_id || user.role === 'admin' || user.isAdmin))) {
                        const localAttempts = Number(safeStorage.getItem(`quiz_attempts_count_${quiz.id}`) || '0');
                        if (localAttempts >= maxAttempts) {
                          setAttemptCheckError(`عذراً، لقد استنفدت عدد المحاولات المسموح بها لهذا الاختبار (${maxAttempts} ${maxAttempts === 1 ? 'محاولة واحدة' : 'محاولات'}) من هذا الجهاز.`);
                          return;
                        }
                      }

                      const normName = normalizeArabicText(trimmedName);
                      const normStudentP = normalizePhoneNumber(cleanStudentP);
                      const normParentP = normalizePhoneNumber(cleanParentP);

                      if (quiz.id) {
                        setIsCheckingAttempts(true);
                        setAttemptCheckError('');
                        try {
                          let attemptsCount = 0;
                          let serverChecked = false;

                          // 1. Server-side check
                          try {
                            const serverRes = await fetch(`/api/quizzes/${quiz.id}/check-attempts`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                student_name: trimmedName,
                                student_phone: cleanStudentP,
                                parent_phone: cleanParentP,
                                student_code: cleanStudentCode
                              })
                            });
                            if (serverRes.ok) {
                              const sData = await serverRes.json();
                              serverChecked = true;
                              if (sData.hasExceeded || sData.invalidCode || sData.codeAlreadyUsed || sData.codeRequired) {
                                setAttemptCheckError(sData.error || `عذراً، لقد استنفدت عدد المحاولات المسموح بها لهذا الاختبار (${maxAttempts} ${maxAttempts === 1 ? 'محاولة واحدة' : 'محاولات'}).`);
                                setIsCheckingAttempts(false);
                                return;
                              }
                            } else {
                              const sErrData = await serverRes.json().catch(() => ({}));
                              if (sErrData.error) {
                                setAttemptCheckError(sErrData.error);
                                setIsCheckingAttempts(false);
                                return;
                              }
                            }
                          } catch (sErr) {
                            console.warn("Server attempt check warning:", sErr);
                          }

                          // 2. Client Firestore check fallback (Only run if teacher/admin is logged in, unauthenticated students do not have read permissions on results)
                          if (!serverChecked && auth.currentUser) {
                            try {
                              const resultsQ = query(
                                collection(db, 'results'),
                                where('quiz_id', '==', quiz.id)
                              );
                              const resultsSnap = await getDocs(resultsQ);
                              resultsSnap.forEach(docSnap => {
                                const data = docSnap.data();
                                const rStudentPhone = normalizePhoneNumber(data.student_phone || data.phone || '');
                                const rParentPhone = normalizePhoneNumber(data.parent_phone || data.phone || '');
                                const rName = normalizeArabicText(data.student_name || '');

                                const hasInputPhone = Boolean(normStudentP || normParentP);
                                const hasRecordPhone = Boolean(rStudentPhone || rParentPhone);

                                const phoneMatch =
                                  (normStudentP && (normStudentP === rStudentPhone || normStudentP === rParentPhone)) ||
                                  (normParentP && (normParentP === rStudentPhone || normParentP === rParentPhone));

                                const nameMatch = Boolean(normName && rName && normName === rName && normName !== 'طالب' && normName.length >= 3);

                                if (phoneMatch || (!hasInputPhone && !hasRecordPhone && nameMatch)) {
                                  attemptsCount++;
                                }
                              });
                            } catch (qErr) {
                              console.warn("Firestore pre-check warning:", qErr);
                            }

                            if (attemptsCount >= maxAttempts && attemptsCount > 0) {
                              setAttemptCheckError(`عذراً، لقد استنفدت عدد المحاولات المسموح بها لهذا الاختبار (${maxAttempts} ${maxAttempts === 1 ? 'محاولة واحدة' : 'محاولات'}).`);
                              setIsCheckingAttempts(false);
                              return;
                            }
                          }
                        } catch (err) {
                          console.warn("Attempt validation error:", err);
                        } finally {
                          setIsCheckingAttempts(false);
                        }
                      }

                      setUnansweredAttempted(false);
                      const startTimeNow = Date.now();
                      safeStorage.setItem(`quiz_start_time_${quiz.id}`, startTimeNow.toString());
                      
                      // Pre-allocate idempotent submission session doc ID for this sitting
                      const newSessionDocId = doc(collection(db, 'results')).id;
                      safeStorage.setItem(`quiz_session_doc_id_${quiz.id}`, newSessionDocId);

                      hasAutoSubmittedRef.current = false;
                      isSubmittingRef.current = false;
                      setQuizStartTime(startTimeNow);
                      setTimeSpentSeconds(0);
                      if (quiz.time_limit && quiz.time_limit > 0) {
                        setTimeRemainingSeconds(quiz.time_limit * 60);
                      } else {
                        setTimeRemainingSeconds(null);
                      }
                      setIsTimeUpModalOpen(false);
                      setMode('take');
                    }}
                    disabled={!isFormComplete || isCheckingAttempts}
                    className="mt-8 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-8 py-4 rounded-xl font-bold text-lg shadow-md hover:shadow-lg transition-all w-full flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isCheckingAttempts ? (
                      <>
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>جارٍ التحقق من المحاولات...</span>
                      </>
                    ) : (
                      'بدء الاختبار'
                    )}
                  </button>
                );
              })()}

              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
                <ShieldCheck size={16} className="text-indigo-600 shrink-0" />
                <span>البيانات تُستخدم فقط لتصحيح الاختبار وإرسال النتيجة.</span>
                <button
                  type="button"
                  onClick={() => setShowPrivacyPolicyModal(true)}
                  className="text-indigo-600 hover:text-indigo-800 underline font-bold"
                >
                  سياسة الخصوصية
                </button>
              </div>
              </>
              )}
              </>
              )}
            </div>
          </div>
          );
        })()}

        {mode === 'take' && (() => {
          const unansweredList = (quiz.questions || []).map((q, idx) => ({
            id: q.id,
            index: idx + 1,
            text: q.text,
            answered: isQuestionAnswered(q)
          })).filter(item => !item.answered);
          const totalQCount = (quiz.questions || []).length;
          const answeredQCount = totalQCount - unansweredList.length;

          return (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto px-3 sm:px-4 select-none">
            {/* Anti-Screenshot Fullscreen Blackout Barrier */}
            {isScreenObscured && (
              <div 
                className="fixed inset-0 z-[99999] bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center text-white select-none animate-in fade-in duration-100"
                dir="rtl"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-600/20 text-rose-500 rounded-3xl flex items-center justify-center mb-5 border border-rose-500/30 animate-pulse">
                  <ShieldAlert size={38} />
                </div>
                <h3 className="text-xl sm:text-2xl font-black mb-3 text-rose-400">
                  حماية محتوى الاختبار مفعلة
                </h3>
                <p className="text-sm sm:text-base text-slate-300 max-w-md mb-6 leading-relaxed">
                  {screenObscuredReason || 'تم حجب وتعتيم الشاشة تلقائياً لمنع التقاط الشاشة أو مغادرة الاختبار لحماية سرية الأسئلة.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsScreenObscured(false);
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-bold rounded-2xl shadow-lg transition-all transform hover:scale-105 cursor-pointer text-sm sm:text-base flex items-center gap-2"
                >
                  <CheckCircle2 size={18} />
                  <span>اضغط هنا للمتابعة والعودة للاختبار</span>
                </button>
                <p className="text-[11px] text-slate-500 mt-4">
                  تنبيه: محاولات تصوير الشاشة أو التبديل بين التطبيقات يتم رصدها وتسجيلها.
                </p>
              </div>
            )}
            {teacherInfo?.avatar_data && (
              <div className="flex flex-col items-center mb-4 bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-200">
                <img 
                  src={teacherInfo.avatar_data} 
                  alt={teacherInfo.name} 
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-indigo-100 shadow-sm object-cover"
                  referrerPolicy="no-referrer"
                />
                <p className="mt-2 font-bold text-indigo-900 text-sm sm:text-base">أ/ {teacherInfo.name}</p>
                {teacherInfo.subject && <p className="text-[10px] sm:text-xs text-slate-500 font-medium">مدرس {teacherInfo.subject}</p>}
              </div>
            )}
            <div className="text-center mb-4 sm:mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">{quiz.title}</h2>
              <p className="text-sm sm:text-base text-slate-500">أجب عن جميع الأسئلة ثم اضغط على تسليم الإجابات</p>
            </div>

            {/* Real-time Answer Progress & Countdown Timer */}
            <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-md border border-slate-200 sticky top-2 sm:top-4 z-30 transition-all">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs sm:text-sm font-semibold mb-2">
                <span className="text-slate-700 flex items-center gap-1.5">
                  <FileText size={16} className="text-indigo-600 shrink-0" />
                  <span>تقدم الإجابة: {answeredQCount} من {totalQCount} سؤال</span>
                </span>

                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end flex-wrap">
                  {quiz.time_limit && quiz.time_limit > 0 ? (
                    <div className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border shadow-2xs transition-all ${
                      (timeRemainingSeconds !== null && timeRemainingSeconds <= 60)
                        ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                        : (timeRemainingSeconds !== null && timeRemainingSeconds <= 300)
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    }`}>
                      <Clock size={15} className={(timeRemainingSeconds !== null && timeRemainingSeconds <= 60) ? 'text-rose-600 animate-spin-slow' : 'text-indigo-600'} />
                      <span>الوقت المتبقي:</span>
                      <span className="font-mono text-sm font-black tracking-wider" dir="ltr">
                        {timeRemainingSeconds !== null ? formatTimeCountdown(timeRemainingSeconds) : '--:--'}
                      </span>
                    </div>
                  ) : (
                    <div className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-slate-50 text-slate-600 border border-slate-200">
                      <Clock size={14} className="text-slate-400" />
                      <span>الوقت المنقضي:</span>
                      <span className="font-mono text-xs text-indigo-700 font-bold" dir="ltr">
                        {formatTimeCountdown(timeSpentSeconds)}
                      </span>
                    </div>
                  )}

                  {unansweredList.length === 0 ? (
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      اكتملت الإجابات
                    </span>
                  ) : (
                    <span className="text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <AlertTriangle size={14} className="text-amber-600" />
                      متبقي {unansweredList.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 rounded-full ${
                    unansweredList.length === 0 ? 'bg-emerald-500' : 'bg-indigo-600'
                  }`}
                  style={{ width: `${(answeredQCount / Math.max(1, totalQCount)) * 100}%` }}
                />
              </div>

              {/* Time limit note / warning */}
              {quiz.time_limit && quiz.time_limit > 0 && timeRemainingSeconds !== null && (
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>الزمن الكلي: {quiz.time_limit} دقيقة</span>
                  <span className={timeRemainingSeconds <= 60 ? 'text-rose-600 font-bold animate-pulse' : 'text-slate-500'}>
                    {timeRemainingSeconds <= 60 ? '⚠️ انتبه: أوشك الوقت على الانتهاء!' : `مضى: ${formatDuration(timeSpentSeconds)}`}
                  </span>
                </div>
              )}
            </div>

            {/* Time Up Alert Modal */}
            {isTimeUpModalOpen && (
              <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl border border-rose-200 animate-in zoom-in-95">
                  <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                    <Clock size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2">انتهى الوقت المحدد للاختبار!</h3>
                  <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                    انتهى الزمن المخصص للاختبار ({quiz.time_limit} دقيقة). يتم الآن تسليم إجاباتك وتصحيحها تلقائياً...
                  </p>
                  <div className="flex items-center justify-center gap-2 text-indigo-600 font-bold text-sm bg-indigo-50 p-3 rounded-2xl">
                    <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                    <span>جاري تصحيح وتسجيل الإجابات...</span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 sm:space-y-6">
              {(quiz.questions || []).map((q, qIndex) => {
                const isAnswered = isQuestionAnswered(q);
                const isMissing = unansweredAttempted && !isAnswered;

                return (
                <div 
                  key={q.id} 
                  id={`question-card-${q.id}`}
                  className={`bg-white p-4 sm:p-6 rounded-2xl shadow-xs transition-all duration-300 border ${
                    isMissing 
                      ? 'border-amber-400 ring-2 ring-amber-400/40 bg-amber-50/20' 
                      : isAnswered 
                        ? 'border-slate-200 hover:border-indigo-200' 
                        : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <h3 className="text-base sm:text-lg font-medium text-slate-800 flex gap-2 sm:gap-3 items-start flex-1">
                      <span className="text-indigo-600 font-bold">{qIndex + 1}.</span>
                      <div className="leading-relaxed" dir="auto"><MathText text={q.text || "سؤال بدون نص"} /></div>
                    </h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isMissing ? (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 animate-pulse">
                          <AlertTriangle size={13} className="text-amber-600" />
                          مطلوب الإجابة
                        </span>
                      ) : isAnswered ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          تمت الإجابة
                        </span>
                      ) : null}
                      <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-md">
                        {q.points || 1} درجة
                      </span>
                    </div>
                  </div>
                  {q.image && (
                    <div className="mb-4 flex flex-col items-center">
                      <div 
                        className="relative group cursor-pointer w-full max-w-xl mx-auto text-center"
                        onClick={() => setImageZoomModalUrl(q.image || null)}
                        title="انقر لتكبير وفحص الرسم التوضيحي للسؤال بدقة عالية"
                      >
                        <img 
                          src={q.image} 
                          alt="Question diagram" 
                          className="max-h-56 sm:max-h-72 w-auto max-w-full mx-auto object-contain rounded-2xl border border-slate-200 bg-white p-1 shadow-xs hover:border-indigo-400 hover:shadow-md transition-all" 
                        />
                        <div className="mt-1.5 flex items-center justify-center gap-1 text-xs text-indigo-600 font-bold hover:text-indigo-700">
                          <Eye size={14} />
                          <span>انقر لتكبير وفحص الرسم التوضيحي والرموز بدقة عالية</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {q.audio && (
                    <div className="mb-4 p-4 bg-violet-50/80 rounded-2xl border border-violet-200 flex flex-col gap-2.5">
                      <div className="flex items-center gap-2 text-violet-950 font-bold text-xs sm:text-sm">
                        <Volume2 className="text-violet-600 animate-pulse shrink-0" size={20} />
                        <span>سؤال استماعي: استمع للمقطع الصوتي واكتب/اختر الإجابة الصحيحة:</span>
                      </div>
                      <audio controls src={q.audio} className="w-full rounded-xl shadow-xs" />
                    </div>
                  )}
                  <div className="space-y-2 sm:space-y-3 sm:pl-6">
                    {q.type === 'essay' ? (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1 p-1.5 bg-slate-50/90 rounded-lg border border-slate-200/80">
                          <span className="text-[10px] font-bold text-slate-500 ml-1">رموز سريعة:</span>
                          {[
                            { s: '→', label: 'سهم تفاعل' },
                            { s: '⇄', label: 'سهم اتزان' },
                            { s: '+', label: 'زائد' },
                            { s: '=', label: 'يساوي' },
                            { s: 'Δ', label: 'حرارة / دلتا' },
                            { s: '²', label: 'أس 2' },
                            { s: '³', label: 'أس 3' },
                            { s: '⁺', label: 'موجب' },
                            { s: '⁻', label: 'سالب' },
                            { s: '₂', label: 'سفلي 2' },
                            { s: '₃', label: 'سفلي 3' },
                            { s: '₄', label: 'سفلي 4' }
                          ].map(sym => (
                            <button
                              key={sym.s}
                              type="button"
                              onClick={() => {
                                const current = studentAnswers[q.id] || '';
                                setStudentAnswers(prev => ({ ...prev, [q.id]: current + sym.s }));
                              }}
                              className="text-xs bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 border border-slate-200 px-2 py-0.5 rounded-md font-mono text-slate-700 transition-all shadow-2xs cursor-pointer active:scale-95"
                              title={`إدراج ${sym.label} (${sym.s})`}
                            >
                              {sym.s}
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={studentAnswers[q.id] || ''}
                          onChange={(e) => setStudentAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                          className="w-full p-3 sm:p-4 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all h-32 text-sm sm:text-base" dir="auto"
                          placeholder={q.audio ? "استمع للمقطع الصوتي واكتب الكلمة أو الإجابة التي تسمعها هنا..." : "اكتب إجابتك هنا (يمكنك كتابة المعادلات واستخدام الرموز السريعة أعلاه)..."}
                        />
                      </div>
                    ) : (
                      q.options?.map((opt, optIndex) => (
                        <label
                          key={optIndex}
                          onClick={() => setStudentAnswers(prev => ({ ...prev, [q.id]: optIndex }))}
                          className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl border cursor-pointer transition-all ${
                            studentAnswers[q.id] === optIndex
                              ? 'border-indigo-600 bg-indigo-50'
                              : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            studentAnswers[q.id] === optIndex
                              ? 'border-indigo-600'
                              : 'border-slate-300'
                          }`}>
                            {studentAnswers[q.id] === optIndex && (
                              <div className="w-2 sm:w-2.5 h-2 sm:h-2.5 bg-indigo-600 rounded-full" />
                            )}
                          </div>
                          <div className="text-slate-700 text-sm sm:text-base w-full" dir="auto"><MathText text={opt || `الخيار ${optIndex + 1}`} /></div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
                );
              })}
            </div>

            <div className="pt-6 pb-12 space-y-4">
              {unansweredAttempted && unansweredList.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-300 text-amber-900 p-4 sm:p-5 rounded-2xl animate-in fade-in zoom-in-95 duration-200 shadow-xs">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <h4 className="font-bold text-sm sm:text-base text-amber-900">
                        لا يمكن تسليم الاختبار حتى تجيب على جميع الأسئلة!
                      </h4>
                      <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
                        يوجد ({unansweredList.length}) {unansweredList.length === 1 ? 'سؤال متبقي' : 'أسئلة متبقية'} بدون إجابة. اضغط على رقم السؤال للانتقال إليه مباشرة:
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {unansweredList.map((uq) => (
                          <button
                            key={uq.id}
                            type="button"
                            onClick={() => {
                              const el = document.getElementById(`question-card-${uq.id}`);
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className="bg-amber-200/80 hover:bg-amber-300 text-amber-950 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-amber-400/60 shadow-xs flex items-center gap-1"
                          >
                            <span>سؤال {uq.index}</span>
                            <ArrowRight size={13} className="rotate-180" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={() => {
                    submitQuiz();
                  }}
                  disabled={isSubmitting}
                  className={`px-8 py-4 rounded-2xl font-bold text-base sm:text-lg shadow-md hover:shadow-lg transition-all w-full max-w-md flex items-center justify-center gap-2.5 ${
                    unansweredList.length > 0 && unansweredAttempted
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-300 disabled:cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span>انتظر قليلاً حتى يتم الانتهاء من تصحيح الأسئلة المقالية</span>
                    </>
                  ) : unansweredList.length > 0 && unansweredAttempted ? (
                    <>
                      <AlertTriangle size={20} />
                      يرجى إكمال الأسئلة ({unansweredList.length} متبقية)
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={20} />
                      <span>تسليم الإجابات</span>
                    </>
                  )}
                </button>
                {isSubmitting && (
                  <p className="text-xs text-indigo-600 font-bold animate-pulse flex items-center gap-1.5">
                    <Sparkles size={14} />
                    <span>انتظر قليلاً حتى يتم الانتهاء من تصحيح الأسئلة المقالية وتسجيل النتيجة...</span>
                  </p>
                )}
              </div>
            </div>
          </div>
          );
        })()}

        {/* Dedicated Submission & Essay Grading Progress Overlay */}
        {isSubmitting && (
          <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-indigo-100 text-center relative overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse" />
              
              {/* Animated AI Brain / Sparkles Badge */}
              <div className="relative w-20 h-20 mx-auto mb-5 flex items-center justify-center">
                <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-30" />
                <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-2xl shadow-lg flex items-center justify-center text-white relative z-10">
                  <Sparkles className="animate-spin" style={{ animationDuration: '4s' }} size={30} />
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 leading-tight">
                انتظر قليلاً حتى يتم الانتهاء من تصحيح الأسئلة المقالية
              </h3>

              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                يقوم المصحح الذكي الآن بفحص وتحليل إجاباتك ومطابقتها مع نماذج الإجابة المعتمدة وحساب الدرجة النهائية...
              </p>

              {/* Dynamic Status Progress Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mb-5 text-right">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Loader2 className="animate-spin text-indigo-600 shrink-0" size={14} />
                    الحالة الحالية:
                  </span>
                  {submittingTotalEssays > 0 && (
                    <span className="text-[11px] font-bold bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full">
                      سؤال مقالي {submittingCurrentEssayIndex} من {submittingTotalEssays}
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-700 leading-snug">
                  {submittingProgressText}
                </p>

                {/* Animated Progress Bar */}
                <div className="w-full bg-slate-200 rounded-full h-2 mt-3 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full transition-all duration-500 animate-pulse" 
                    style={{ 
                      width: submittingTotalEssays > 0 
                        ? `${Math.max(20, Math.min(95, (submittingCurrentEssayIndex / submittingTotalEssays) * 100))}%` 
                        : '70%' 
                    }}
                  />
                </div>
              </div>

              {/* Safety Notice */}
              <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200/60 rounded-xl py-2 px-3">
                <Clock size={14} className="shrink-0" />
                <span>يرجى عدم إغلاق الصفحة حتى تكتمل عملية التصحيح</span>
              </div>
            </div>
          </div>
        )}

        {mode === 'results' && (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in zoom-in-95 duration-500 max-w-3xl mx-auto px-2">
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 text-center animate-in slide-in-from-top-6 duration-300">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-6">نتيجة الاختبار</h2>
              
              {!(quiz.showResultsToStudent ?? true) ? (
                // Safe Mode: Hide results, scores, and details from the student
                <div className="py-8 space-y-6">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 size={44} className="text-emerald-600" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-800">تم تسليم إجاباتك بنجاح! 🎉</h3>
                    <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                      لقد تم حفظ وتصحيح إجاباتك بأمان في سجلات النظام. لقد قام معلمك بحجب ظهور النتيجة والدرجة مؤقتاً؛ سيتم مراجعة الدرجة وتأكيدها من قبل معلمك لاحقاً.
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-100 max-w-sm mx-auto space-y-2 text-right">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700">{quiz.title || 'الاختبار'}</span>
                      <span className="text-slate-400 font-medium">اسم الاختبار:</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700">{(quiz.questions || []).length} سؤال</span>
                      <span className="text-slate-400 font-medium">عدد الأسئلة:</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-indigo-700">{timeSpentSeconds > 0 ? formatDuration(timeSpentSeconds) : 'أقل من دقيقة'}</span>
                      <span className="text-slate-400 font-medium">الوقت المستغرق:</span>
                    </div>
                  </div>

                  <div className="pt-2 text-xs text-slate-400">
                    يمكنك إغلاق هذه الصفحة الآن أو مراجعة معلمك لمزيد من التفاصيل.
                  </div>
                </div>
              ) : (
                // Standard Mode: Show results circle and stats
                <>
                  <div className="relative w-32 h-32 sm:w-40 sm:h-40 mx-auto mb-6">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="10"
                        fill="transparent"
                        className="text-indigo-100"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="10"
                        fill="transparent"
                        strokeDasharray={56 * 2 * Math.PI}
                        strokeDashoffset={56 * 2 * Math.PI * (1 - calculateScore() / calculateTotalPoints())}
                        className="text-indigo-600 transition-all duration-1000 ease-out"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl sm:text-4xl font-black text-indigo-600">
                        {calculateScore()}
                      </span>
                      <span className="text-slate-500 font-medium text-xs sm:text-sm">من {calculateTotalPoints()}</span>
                    </div>
                  </div>
                  
                  <p className="text-lg text-slate-600 font-medium mb-6">
                    {calculateScore() === calculateTotalPoints() 
                      ? 'ممتاز! إجاباتك كلها صحيحة 🌟' 
                      : calculateScore() >= calculateTotalPoints() / 2 
                        ? 'جيد جداً! أداء رائع 👍' 
                        : 'حاول مرة أخرى، يمكنك تحقيق نتيجة أفضل 💪'}
                  </p>

                  {/* Summary Stats Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mx-auto mb-6 text-xs sm:text-sm">
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
                      <span className="text-slate-400 text-xs mb-1 font-medium">النسبة المئوية</span>
                      <span className="font-black text-slate-800 text-base sm:text-lg">
                        {Math.round((calculateScore() / Math.max(1, calculateTotalPoints())) * 100)}%
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
                      <span className="text-slate-400 text-xs mb-1 font-medium">عدد الأسئلة</span>
                      <span className="font-black text-slate-800 text-base sm:text-lg">
                        {(quiz.questions || []).length} سؤال
                      </span>
                    </div>
                    <div className="bg-indigo-50/70 p-3.5 rounded-2xl border border-indigo-100 flex flex-col items-center justify-center col-span-2 sm:col-span-1">
                      <span className="text-indigo-600 text-xs mb-1 flex items-center gap-1 font-bold">
                        <Clock size={13} />
                        <span>الوقت المستغرق</span>
                      </span>
                      <span className="font-black text-indigo-900 text-sm sm:text-base">
                        {timeSpentSeconds > 0 ? formatDuration(timeSpentSeconds) : 'أقل من دقيقة'}
                      </span>
                    </div>
                  </div>

                  {aiMessage && (
                    <div className={`mt-4 p-4 rounded-xl text-sm font-medium ${
                      aiMessage.includes('بنجاح') 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}>
                      {aiMessage}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-bold text-slate-800 px-2">مراجعة الإجابات:</h3>
              {quiz.questions.map((q, qIndex) => {
                const studentAns = studentAnswers[q.id];
                const isEssay = q.type === 'essay';
                const essayInfo = feedback[q.id];
                const earnedPoints = isEssay 
                  ? (essayInfo?.score !== undefined ? essayInfo.score : (isQuestionAnswerCorrect(q, studentAns) ? (q.points || 1) : 0))
                  : (isQuestionAnswerCorrect(q, studentAns) ? (q.points || 1) : 0);
                const isFullCorrect = earnedPoints >= (q.points || 1);
                const isPartial = earnedPoints > 0 && earnedPoints < (q.points || 1);
                const isCorrect = isFullCorrect;
                const showAnswers = quiz.showCorrectAnswers ?? true;
                
                return (
                  <div key={q.id} className={`bg-white p-6 rounded-2xl shadow-sm border-2 ${
                    showAnswers 
                      ? (isFullCorrect ? 'border-emerald-200' : isPartial ? 'border-amber-200' : 'border-red-200') 
                      : 'border-slate-200'
                  }`}>
                    <div className="flex items-start gap-3 mb-4 justify-between">
                      <div className="flex items-start gap-3">
                        {showAnswers && (
                          isFullCorrect ? (
                            <CheckCircle2 className="text-emerald-500 shrink-0 mt-1" size={24} />
                          ) : isPartial ? (
                            <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-1 font-bold text-xs">½</div>
                          ) : (
                            <XCircle className="text-red-500 shrink-0 mt-1" size={24} />
                          )
                        )}
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-slate-800 flex items-start gap-1.5" dir="auto">
                            <span className="shrink-0">{qIndex + 1}.</span>
                            <span className="flex-1"><MathText text={q.text || 'سؤال بدون نص'} /></span>
                          </h3>
                          {isEssay && q.required_points_count && q.required_points_count > 1 && (
                            <span className="inline-block mt-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                              مطلوب في السؤال: {q.required_points_count} نقاط (درجة كل نقطة: {(q.points / q.required_points_count).toFixed(1).replace(/\.0$/, '')})
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                        showAnswers 
                          ? (isFullCorrect ? 'bg-emerald-100 text-emerald-700' : isPartial ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700') 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {earnedPoints} / {q.points || 1} درجة
                      </span>
                    </div>
                    
                    {q.image && (
                      <div className="mb-4 flex flex-col items-center">
                        <div 
                          className="relative group cursor-pointer w-full max-w-xl mx-auto text-center"
                          onClick={() => setImageZoomModalUrl(q.image || null)}
                          title="انقر لتكبير وفحص الرسم التوضيحي للسؤال بدقة عالية"
                        >
                          <img 
                            src={q.image} 
                            alt="Question diagram" 
                            className="max-h-56 sm:max-h-72 w-auto max-w-full mx-auto object-contain rounded-2xl border border-slate-200 bg-white p-1 shadow-xs hover:border-indigo-400 hover:shadow-md transition-all" 
                          />
                          <div className="mt-1.5 flex items-center justify-center gap-1 text-xs text-indigo-600 font-bold hover:text-indigo-700">
                            <Eye size={14} />
                            <span>انقر لتكبير وفحص الرسم التوضيحي للسؤال</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {q.audio && (
                      <div className="mb-4 p-3 bg-violet-50 rounded-xl border border-violet-100 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-violet-900 font-bold text-xs">
                          <Volume2 className="text-violet-600" size={16} />
                          <span>المقطع الصوتي المرفق للسؤال:</span>
                        </div>
                        <audio controls src={q.audio} className="w-full h-10 rounded-lg shadow-xs" />
                      </div>
                    )}
                    
                    <div className="space-y-2 sm:pl-9">
                      {isEssay ? (
                        <div className="space-y-4">
                          <div className="p-3 sm:p-4 rounded-xl border border-slate-200 bg-slate-50">
                            <p className="text-[10px] sm:text-xs text-slate-500 mb-1 font-bold">
                              {isEnglishContent(q.text, q.modelAnswer, studentAns) ? 'Your Answer:' : 'إجابتك:'}
                            </p>
                            <div className="text-sm sm:text-base text-slate-700 whitespace-pre-wrap" dir="auto">
                              {studentAns ? (
                                <MathText text={studentAns} />
                              ) : (
                                <span>{isEnglishContent(q.text, q.modelAnswer) ? 'No answer provided' : 'لم يتم تقديم إجابة'}</span>
                              )}
                            </div>
                          </div>
                          
                          {showAnswers && essayInfo && (
                            <div className="space-y-3">
                              <div className={`p-3 sm:p-4 rounded-xl border ${isFullCorrect ? 'border-emerald-200 bg-emerald-50' : isPartial ? 'border-amber-200 bg-amber-50' : 'border-indigo-100 bg-indigo-50'}`}>
                                <p className={`text-[10px] sm:text-xs mb-1 font-bold ${isFullCorrect ? 'text-emerald-700' : isPartial ? 'text-amber-800' : 'text-indigo-700'}`}>
                                  {isEnglishContent(q.text, q.modelAnswer, essayInfo.feedback) ? 'Examiner Feedback:' : 'تعليق المصحح:'}
                                </p>
                                <div className={`text-sm sm:text-base ${isFullCorrect ? "text-emerald-900" : isPartial ? "text-amber-950" : "text-indigo-900"}`} dir="auto">
                                  <MathText text={essayInfo.feedback} />
                                </div>
                              </div>

                              {essayInfo.steps && essayInfo.steps.length > 0 && (
                                <div className="p-3 sm:p-4 rounded-xl border border-slate-200 bg-white">
                                  <p className="text-[10px] sm:text-xs text-slate-500 mb-3 font-bold">
                                    {isEnglishContent(q.text, q.modelAnswer) ? 'Grading Step Breakdown:' : 'تفاصيل توزيع الدرجات على الخطوات:'}
                                  </p>
                                  <div className="space-y-2">
                                    {essayInfo.steps.map((step, idx) => (
                                      <div key={idx} className="flex items-center justify-between text-xs sm:text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                                        <span className="text-slate-600 flex-1 text-right" dir="auto"><MathText text={step.description} /></span>
                                        <span className={`font-bold shrink-0 ml-4 ${step.earned === step.points ? 'text-emerald-600' : step.earned > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                                          {step.earned} / {step.points}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {(essayInfo.correctExample || q.modelAnswer) && (
                                <div className="p-3 sm:p-4 rounded-xl border border-emerald-200 bg-emerald-50">
                                  <p className="text-[10px] sm:text-xs text-emerald-700 mb-1 font-bold">
                                    {isEnglishContent(q.text, q.modelAnswer) ? 'Official Model Answer:' : 'الإجابة النموذجية الصحيحة:'}
                                  </p>
                                  <div className="text-sm sm:text-base text-emerald-900 whitespace-pre-wrap" dir="auto">
                                    <MathText text={essayInfo.correctExample || q.modelAnswer || ''} />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        q.options?.map((opt, optIndex) => {
                          let optionClass = "border-slate-100 bg-slate-50 text-slate-500";
                          let icon = null;
                          const isEnglishQ = isEnglishContent(q.text, ...(q.options || []));
                          
                          if (showAnswers) {
                            const isThisOptionCorrect = Number(optIndex) === Number(q.correctOptionIndex);
                            const isThisOptionSelected = studentAns !== undefined && studentAns !== null && studentAns !== '' && (
                              Number(optIndex) === Number(studentAns) ||
                              (typeof studentAns === 'string' && studentAns.trim().toLowerCase() === (opt || '').trim().toLowerCase())
                            );

                            if (isThisOptionCorrect && isThisOptionSelected) {
                              // Student selected the correct answer
                              optionClass = "border-emerald-500 bg-emerald-50 text-emerald-800 font-bold ring-2 ring-emerald-400/30";
                              icon = (
                                <span className="inline-flex items-center gap-1.5 text-emerald-700 text-xs font-bold">
                                  <span>{isEnglishQ ? 'Your Answer (Correct)' : 'إجابتك صحيحة'}</span>
                                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                                </span>
                              );
                            } else if (isThisOptionSelected && !isThisOptionCorrect) {
                              // Student selected a wrong answer
                              optionClass = "border-rose-500 bg-rose-50 text-rose-800 font-medium ring-2 ring-rose-400/30";
                              icon = (
                                <span className="inline-flex items-center gap-1.5 text-rose-700 text-xs font-bold">
                                  <span>{isEnglishQ ? 'Your Answer (Incorrect)' : 'إجابتك الخاطئة'}</span>
                                  <XCircle size={18} className="text-rose-500 shrink-0" />
                                </span>
                              );
                            } else if (isThisOptionCorrect && !isThisOptionSelected) {
                              // The model/correct answer that the student didn't choose
                              optionClass = "border-emerald-500 bg-emerald-50/70 text-emerald-800 font-medium border-dashed";
                              icon = (
                                <span className="inline-flex items-center gap-1.5 text-emerald-700 text-xs font-bold">
                                  <span>{isEnglishQ ? 'Model Answer' : 'الإجابة الصحيحة النموذجية'}</span>
                                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                                </span>
                              );
                            }
                          } else {
                            if (Number(optIndex) === Number(studentAns)) {
                              optionClass = "border-indigo-500 bg-indigo-50 text-indigo-800 font-medium";
                              icon = <div className="w-4 h-4 rounded-full bg-indigo-500" />;
                            }
                          }

                          return (
                            <div
                              key={optIndex}
                              className={`flex items-center justify-between p-3 rounded-xl border ${optionClass}`}
                            >
                              <span className="flex-1 text-right" dir="auto"><MathText text={opt || `الخيار ${optIndex + 1}`} /></span>
                              {icon}
                            </div>
                          );
                        })
                      )}
                    
                  </div>
                </div>
              );
            })}
          </div>

          {/* Student Sheet Download banner */}
          <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-right">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 text-white p-2.5 rounded-xl shrink-0">
                <Image size={22} />
              </div>
              <div>
                <h4 className="font-bold text-emerald-950 text-sm">حفظ ومراجعة ورقة إجابتك (صورة)</h4>
                <p className="text-xs text-emerald-700">يمكنك تحميل نسخة من ورقة إجابتك والحلول كصورة عالية الدقة.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                disabled={isDownloadingPaper}
                onClick={async () => {
                  setIsDownloadingPaper(true);
                  try {
                    const currentResultObj = {
                      student_name: (studentName || 'طالب').trim(),
                      student_phone: (studentPhone || '').trim(),
                      parent_phone: (parentPhone || '').trim(),
                      center_name: (centerName || 'عام').trim(),
                      score: calculateScore(),
                      total: calculateTotalPoints(),
                      feedback: JSON.stringify(feedback || {}),
                      student_answers: JSON.stringify(studentAnswers || {}),
                      created_at: new Date().toISOString()
                    };
                    await downloadStudentPaperImage(currentResultObj, quiz, teacherInfo);
                  } catch (e) {
                    console.error('Image error:', e);
                    alert('حدث خطأ أثناء تحميل صورة ورقة الإجابة');
                  } finally {
                    setIsDownloadingPaper(false);
                  }
                }}
                className="px-3.5 py-2 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="تحميل ورقة الإجابة كصورة عالية الدقة"
              >
                <Download size={14} className="text-emerald-700" />
                <span>تحميل صورة الورقة</span>
              </button>
            </div>
          </div>

            <div className="flex justify-center pt-4 pb-12 gap-4">
              {((typeof quiz.maxAttempts === 'number' && quiz.maxAttempts > 1)) && (
                <button
                  onClick={() => {
                    setMode('take-intro');
                    setStudentAnswers({});
                    setStudentName('');
                    setStudentPhone('');
                    setCenterName('');
                    setParentPhone('');
            setStudentEmail('');
                  }}
                  className="bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-6 py-3 rounded-xl font-bold transition-all"
                >
                  إعادة الاختبار
                </button>
              )}
              {!isShared && (
                <button
                  onClick={() => setMode('build')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
                >
                  العودة للتعديل
                </button>
              )}
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* Plans Selection Modal */}
            <TokenCalculatorModal
        isOpen={showTokenCalculator}
        onClose={() => setShowTokenCalculator(false)}
        initialSubject={user?.subject || profileData.subject}
        onSelectPlan={(planDetails) => {
          setCustomPlanDetails(planDetails);
          setSelectedPlan(planDetails.planId);
          setShowTokenCalculator(false);
          setPlanCategoryTab('tokens');
          setShowPlansModal(true);
        }}
      />

      <TokenBillingModal
        isOpen={showTokenBilling}
        onClose={() => {
          setShowTokenBilling(false);
          setSelectedUserForTokenBilling(null);
        }}
        currentUser={user}
        allUsers={allUsers}
        isAdmin={user?.role === 'admin' || user?.isAdmin || (user?.email && user.email.toLowerCase().trim() === 'gergesnabil101@gmail.com')}
        initialSelectedUserId={selectedUserForTokenBilling?.id || selectedUserForTokenBilling?.uid}
        targetUser={selectedUserForTokenBilling}
        onRefresh={() => {
          if (fetchAdminData) {
            return fetchAdminData();
          }
        }}
      />

      <ProUpgradeModal
        isOpen={showProUpgradeModal}
        onClose={() => setShowProUpgradeModal(false)}
        user={user}
        onRequestSubmit={handleProUpgradeSubmit}
      />

      {showPlansModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4" onClick={() => setShowPlansModal(false)}>
          <div 
            className="bg-white rounded-3xl p-4 sm:p-8 max-w-5xl w-full shadow-2xl text-right overflow-y-auto max-h-[95vh] animate-in zoom-in-95 duration-200 border border-slate-100"
            
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="bg-indigo-600 text-white p-2 rounded-xl">
                    <CreditCard size={20} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-800">باقات وخطط الاشتراك</h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-500">اختر باقة التوكنز المناسبة لمادتك وتخصصك.</p>
              </div>
              <button onClick={() => setShowPlansModal(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Interactive Token Calculator Banner */}
            <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-emerald-500/10 border border-indigo-200/80 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 text-right">
                <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-md shrink-0">
                  <Calculator size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-black text-slate-900 text-sm sm:base">
                      حاسبة التوكنز والطلاب الذكية
                    </h4>
                    <span className="bg-indigo-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">جديد 200 ج.م / مليون توكن</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    احسب بالضبط استهلاكك الشهري بناءً على عدد طلابك، ومجموعاتك، وعدد الأسئلة المقالية في اختباراتك.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPlansModal(false);
                  setShowTokenCalculator(true);
                }}
                className="w-full md:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <Calculator size={16} />
                <span>فتح الحاسبة التقديرية</span>
              </button>
            </div>

            {/* Gemini Pro Upgrade Promo Banner */}
            {user && (user?.preferred_ai_model !== 'gemini_pro' && user?.preferred_ai_model !== 'pro') && (
              <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-purple-900/10 via-indigo-900/10 to-purple-800/15 border-2 border-purple-200 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 text-right">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-700 to-indigo-700 text-white shadow-md shrink-0">
                    <Sparkles size={24} className="text-amber-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-purple-950 text-sm sm:text-base">
                        ترقية باقتك الحالية إلى جيميناي برو (Gemini Pro)
                      </h4>
                      <span className="bg-purple-700 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                        فارق 50 ج.م فقط لكل 1M متبقي
                      </span>
                    </div>
                    <p className="text-xs text-purple-800 mt-1 leading-relaxed">
                      هل ترغب في ترقية رصيدك الحالي واستخدام أقوى نماذج الذكاء الاصطناعي؟ ادفع فقط فارق السعر المحسوب بدقة حسب رصيدك المتبقي.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPlansModal(false);
                    setShowProUpgradeModal(true);
                  }}
                  className="w-full md:w-auto px-5 py-2.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:opacity-95 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  <Sparkles size={16} />
                  <span>ترقية الرصيد المتبقي لـ Pro</span>
                </button>
              </div>
            )}

            {/* Model Selection Tabs: Flash 3.8 (200 EGP) vs Gemini Pro (250 EGP) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <button
                type="button"
                onClick={() => setSelectedPlansModel('flash')}
                className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all cursor-pointer text-right ${
                  selectedPlansModel === 'flash'
                    ? 'border-emerald-500 bg-emerald-50/80 shadow-md ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${selectedPlansModel === 'flash' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Zap size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm sm:text-base font-black text-slate-900">باقات فلاش 3.8 (Flash)</span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md">200 ج.م / 1M</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">فائق السرعة وموفر، المخرجات = 5 أضعاف المدخلات</p>
                  </div>
                </div>
                {selectedPlansModel === 'flash' && <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => setSelectedPlansModel('pro')}
                className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all cursor-pointer text-right ${
                  selectedPlansModel === 'pro'
                    ? 'border-indigo-600 bg-indigo-50/80 shadow-md ring-2 ring-indigo-600/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${selectedPlansModel === 'pro' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm sm:text-base font-black text-slate-900">باقات جيميناي برو (Pro)</span>
                      <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded-md">250 ج.م / 1M</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">استدلال أكاديمي وتفكير عميق، المخرجات = 6 أضعاف</p>
                  </div>
                </div>
                {selectedPlansModel === 'pro' && <CheckCircle2 size={20} className="text-indigo-600 shrink-0" />}
              </button>
            </div>

            {/* Sub-header & Billing Cycle Toggle */}
            <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200/70 mb-6 gap-3">
              <div className="text-xs sm:text-sm text-slate-600 font-medium flex items-center gap-2">
                <span>
                  {selectedPlansModel === 'pro' ? (
                    <>🧠 <b>باقات جيميناي برو المتقدمة:</b> سعر المليون توكن = 250 ج.م (المخرجات = 6 أضعاف المدخلات)</>
                  ) : (
                    <>⚡ <b>باقات فلاش 3.8 الموفرة:</b> سعر المليون توكن = 200 ج.م (المخرجات = 5 أضعاف المدخلات)</>
                  )}
                </span>
              </div>
              <div className="bg-white p-1 rounded-xl border border-slate-200 flex items-center shadow-sm shrink-0">
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                    billingCycle === 'yearly'
                      ? (selectedPlansModel === 'pro' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-emerald-600 text-white shadow-sm')
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  سنوي (خصم شهرين 🔥)
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                    billingCycle === 'monthly'
                      ? (selectedPlansModel === 'pro' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-emerald-600 text-white shadow-sm')
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  شهري
                </button>
              </div>
            </div>

            {/* Plan Cards Grid */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {(selectedPlansModel === 'pro' ? PRO_TOKEN_PRESET_PLANS : TOKEN_PRESET_PLANS).map((plan) => {
                  const isPopular = plan.popular;
                  const price = billingCycle === 'monthly' ? `${plan.monthlyPrice} ج.م` : `${plan.yearlyPrice} ج.م`;
                  const priceSub = billingCycle === 'monthly' ? '/ شهر' : `/ سنة (وفر ${plan.monthlyPrice * 2} ج.م)`;
                  const isProPlan = selectedPlansModel === 'pro' || plan.id.startsWith('pro_');

                  return (
                    <div
                      key={plan.id}
                      className={`rounded-2xl p-5 sm:p-6 transition-all flex flex-col relative ${
                        isPopular
                          ? (isProPlan 
                              ? 'border-2 border-indigo-600 bg-gradient-to-b from-indigo-50/60 via-white to-white shadow-xl shadow-indigo-100/60 -translate-y-1'
                              : 'border-2 border-purple-600 bg-gradient-to-b from-purple-50/60 via-white to-white shadow-xl shadow-purple-100/60 -translate-y-1')
                          : 'border-2 border-slate-200 hover:border-slate-300 bg-white hover:shadow-lg'
                      }`}
                    >
                      {isPopular && (
                        <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 text-white px-3.5 py-1 rounded-full text-xs font-black shadow-md flex items-center gap-1 ${isProPlan ? 'bg-indigo-600' : 'bg-purple-600'}`}>
                          <Sparkles size={13} />
                          الأكثر طلباً وتوفيراً
                        </div>
                      )}
                      <div className="mb-4">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg inline-block mb-2 ${isProPlan ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60' : 'bg-purple-50 text-purple-700 border border-purple-200/60'}`}>
                          {plan.millions} مليون توكن {isProPlan ? '(برو)' : ''} شهرياً
                        </span>
                        <h4 className="text-xl font-black text-slate-900">{plan.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">{plan.description}</p>
                      </div>
                      <div className="mb-4 pb-4 border-b border-slate-100">
                        <div className={`text-3xl font-black flex items-baseline gap-1 ${isProPlan ? 'text-indigo-700' : 'text-purple-700'}`}>
                          {price}
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5">
                          {priceSub}
                        </div>
                      </div>
                      
                      {/* Features List */}
                      <ul className="space-y-2.5 mb-6 flex-1 text-xs sm:text-sm">
                        <li className="flex items-start gap-2 text-slate-700 leading-snug">
                          <CheckCircle2 size={16} className={`shrink-0 mt-0.5 ${isProPlan ? 'text-indigo-600' : 'text-purple-600'}`} />
                          <span>رصيد <b>{plan.millions} مليون توكن</b> {isProPlan ? '(جيميناي برو)' : ''}</span>
                        </li>
                        <li className="flex items-start gap-2 text-slate-700 leading-snug">
                          <CheckCircle2 size={16} className={`shrink-0 mt-0.5 ${isProPlan ? 'text-indigo-600' : 'text-purple-600'}`} />
                          <span>{isProPlan ? 'استدلال وتفكير عميق (المخرجات × 6)' : 'تصحيح مقالي سريع وموفر (المخرجات × 5)'}</span>
                        </li>
                        <li className="flex items-start gap-2 text-slate-700 leading-snug">
                          <CheckCircle2 size={16} className={`shrink-0 mt-0.5 ${isProPlan ? 'text-indigo-600' : 'text-purple-600'}`} />
                          <span>الأسئلة الاختيارية (MCQ) مجانية تماماً</span>
                        </li>
                        <li className="flex items-start gap-2 text-slate-700 leading-snug">
                          <CheckCircle2 size={16} className={`shrink-0 mt-0.5 ${isProPlan ? 'text-indigo-600' : 'text-purple-600'}`} />
                          <span>إنشاء اختبارات غير محدود وشهادات تقدير</span>
                        </li>
                      </ul>
                      
                      {/* CTA Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPlan(plan.id);
                          setCustomPlanDetails({
                            planId: plan.id,
                            tokensInMillions: plan.millions,
                            monthlyPrice: plan.monthlyPrice,
                            yearlyPrice: plan.yearlyPrice,
                            detailsSummary: `${plan.name} (${plan.millions}M توكن)`
                          });
                          setShowPlansModal(false);
                          setShowPaymentModal(true);
                        }}
                        className={`w-full py-3 px-4 rounded-xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          isPopular
                            ? (isProPlan ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-indigo-500/20' : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:shadow-purple-500/20')
                            : (isProPlan ? 'bg-indigo-900 hover:bg-indigo-950 text-white' : 'bg-slate-900 hover:bg-black text-white')
                        }`}
                      >
                        <span>اشتراك في باقة {plan.millions}M توكن {isProPlan ? '(برو)' : ''}</span>
                      </button>
                    </div>
                  );
                })}

                {/* Extra Tokens Top-up Card */}
                <div className={`rounded-2xl p-5 sm:p-6 transition-all flex flex-col relative border-2 ${selectedPlansModel === 'pro' ? 'border-indigo-500 bg-gradient-to-b from-indigo-50/60 via-white to-white shadow-lg shadow-indigo-100/60' : 'border-emerald-500 bg-gradient-to-b from-emerald-50/60 via-white to-white shadow-lg shadow-emerald-100/60'} hover:shadow-xl`}>
                  <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 text-white px-3.5 py-1 rounded-full text-[10px] font-black shadow-md flex items-center gap-1 ${selectedPlansModel === 'pro' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                    {selectedPlansModel === 'pro' ? <Sparkles size={11} /> : <Zap size={11} />}
                    شحن رصيد استثنائي فوري
                  </div>
                  <div className="mb-4">
                    <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg inline-block mb-2 ${selectedPlansModel === 'pro' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                      رصيد إضافي فوري ({selectedPlansModel === 'pro' ? 'برو' : 'فلاش'})
                    </span>
                    <h4 className="text-xl font-black text-slate-900">شحن 1 مليون توكن {selectedPlansModel === 'pro' ? '(برو)' : ''}</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">رصيد إضافي يضاف فوراً لرصيدك الحالي دون تغيير شروط باقتك أو موعد انتهائها.</p>
                  </div>
                  <div className="mb-4 pb-4 border-b border-slate-100">
                    <div className={`text-3xl font-black flex items-baseline gap-1 ${selectedPlansModel === 'pro' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                      {selectedPlansModel === 'pro' ? '250 ج.م' : '200 ج.م'}
                    </div>
                    <div className="text-xs text-slate-500 font-medium mt-0.5">
                      دفعة واحدة (بدون التزام شهري)
                    </div>
                  </div>
                  <ul className="space-y-2.5 mb-6 flex-1 text-xs sm:text-sm">
                    <li className="flex items-start gap-2 text-slate-700 leading-snug">
                      <CheckCircle2 size={16} className={`shrink-0 mt-0.5 ${selectedPlansModel === 'pro' ? 'text-indigo-600' : 'text-emerald-600'}`} />
                      <span>إضافة رصيد <b>1 مليون توكن {selectedPlansModel === 'pro' ? '(برو)' : ''}</b> فوري</span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-700 leading-snug">
                      <CheckCircle2 size={16} className={`shrink-0 mt-0.5 ${selectedPlansModel === 'pro' ? 'text-indigo-600' : 'text-emerald-600'}`} />
                      <span>يضاف لقائمة التجديد والطلب فوراً</span>
                    </li>
                    <li className="flex items-start gap-2 text-slate-700 leading-snug">
                      <CheckCircle2 size={16} className={`shrink-0 mt-0.5 ${selectedPlansModel === 'pro' ? 'text-indigo-600' : 'text-emerald-600'}`} />
                      <span>صلاحية مفتوحة ومستمرة مع باقتك الحالية</span>
                    </li>
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      const extraPlanId = selectedPlansModel === 'pro' ? 'extra_1M_pro_tokens' : 'extra_1M_tokens';
                      const extraPrice = selectedPlansModel === 'pro' ? 250 : 200;
                      setSelectedPlan(extraPlanId);
                      setCustomPlanDetails({
                        planId: extraPlanId,
                        tokensInMillions: 1,
                        monthlyPrice: extraPrice,
                        yearlyPrice: extraPrice,
                        detailsSummary: `شحن رصيد إضافي (1 مليون توكن ${selectedPlansModel === 'pro' ? 'برو' : 'فلاش'})`
                      });
                      setShowPlansModal(false);
                      setShowPaymentModal(true);
                    }}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 text-white shadow-md cursor-pointer ${
                      selectedPlansModel === 'pro' ? 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/20' : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-500/20'
                    }`}
                  >
                    <span>طلب شحن 1 مليون توكن {selectedPlansModel === 'pro' ? '(برو)' : ''}</span>
                  </button>
                </div>

                {/* Custom Calculator Card */}
                <div className="rounded-2xl p-5 sm:p-6 transition-all flex flex-col relative border-2 border-dashed border-indigo-300 bg-gradient-to-b from-indigo-50/40 via-white to-white hover:border-indigo-500 hover:shadow-lg">
                  <div className="mb-4">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg inline-block mb-2 bg-indigo-50 text-indigo-700 border border-indigo-200">
                      مخصصة بالكامل
                    </span>
                    <h4 className="text-xl font-black text-slate-900">باقة مخصصة لاحتياجك</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">حدد عدد طلابك ومراحلهم واختباراتك بدقة</p>
                  </div>
                  <div className="mb-4 pb-4 border-b border-slate-100">
                    <div className="text-2xl font-black text-indigo-600 flex items-baseline gap-1">
                      {selectedPlansModel === 'pro' ? '250 ج.م / مليون' : '200 ج.م / مليون'}
                    </div>
                    <div className="text-xs text-slate-500 font-medium mt-0.5">
                      حسب ما تحتاجه بالضبط بدون زيادة أو هدر
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mb-6 flex-1 leading-relaxed">
                    أدخل عدد المراحل الدراسية، وعدد المجموعات، ومتوسط الطلاب، وعدد الأسئلة المقالية في اختباراتك لنحسب لك التكلفة وخطة التوكنز المثالية فوراً.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPlansModal(false);
                      setShowTokenCalculator(true);
                    }}
                    className="w-full py-3 px-4 rounded-xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md cursor-pointer"
                  >
                    <Calculator size={18} />
                    <span>افتح الحاسبة وحدد باقتك</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (() => {
        let planName = '';
        let planPrice = '';
        if (customPlanDetails && customPlanDetails.planId === selectedPlan) {
          planName = customPlanDetails.detailsSummary;
          planPrice = billingCycle === 'monthly' ? `${customPlanDetails.monthlyPrice} ج.م` : `${customPlanDetails.yearlyPrice} ج.م`;
        } else if (selectedPlan?.startsWith('pro_token_')) {
          const match = selectedPlan.match(/pro_token_(\d+)M/);
          const millions = match ? parseInt(match[1]) : 1;
          const unitPrice = 250;
          const mPrice = millions * unitPrice;
          const yPrice = millions * unitPrice * 10;
          planName = `باقة ${millions} مليون توكن شهرياً (جيميناي برو)`;
          planPrice = billingCycle === 'monthly' ? `${mPrice} ج.م` : `${yPrice} ج.م`;
        } else if (selectedPlan?.startsWith('token_') || selectedPlan?.includes('M')) {
          const match = selectedPlan.match(/token_(\d+)M/);
          const millions = match ? parseInt(match[1]) : 1;
          const unitPrice = TOKEN_PRICE_PER_MILLION || 200;
          const mPrice = millions * unitPrice;
          const yPrice = millions * unitPrice * 10;
          planName = `باقة ${millions} مليون توكن شهرياً (فلاش 3.8)`;
          planPrice = billingCycle === 'monthly' ? `${mPrice} ج.م` : `${yPrice} ج.م`;
        } else {
          const planObj = getPlanById(selectedPlan);
          planName = planObj?.fullName || (selectedPlan === '200' ? 'الباقة الأساسية - مواد نظرية' : selectedPlan === '250' ? 'الباقة المتقدمة - مواد نظرية' : selectedPlan === '300' ? 'الباقة الاحترافية - مواد نظرية' : selectedPlan || 'الباقة المختارة');
          planPrice = planObj 
            ? (billingCycle === 'monthly' ? `${planObj.monthlyPrice} ج.م` : `${planObj.yearlyPrice} ج.م`)
            : (billingCycle === 'monthly' ? `${selectedPlan} ج.م` : `${parseInt(selectedPlan || '0') * 10} ج.م`);
        }

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4" onClick={() => setShowPaymentModal(false)}>
            <div 
              className="bg-white rounded-3xl p-5 sm:p-8 max-w-md w-full shadow-2xl text-right overflow-y-auto max-h-[95vh] animate-in zoom-in-95 duration-200 border border-slate-100"
              
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-600 text-white p-2 rounded-xl">
                    <CreditCard size={20} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800">تفعيل الاشتراك</h3>
                </div>
                <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-center">
                  <p className="text-slate-500 text-xs sm:text-sm mb-1">الخطة المختارة:</p>
                  <p className="text-base sm:text-lg font-bold text-slate-900">
                    {planName}
                  </p>
                  {customPlanDetails?.detailsSummary && (
                    <p className="text-[11px] text-slate-500 mt-1 bg-white p-2 rounded-xl border border-slate-200/70">
                      {customPlanDetails.detailsSummary}
                    </p>
                  )}
                  <div className="inline-block bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-bold mt-2">
                    {billingCycle === 'monthly' ? 'اشتراك شهري' : 'اشتراك سنوي (خصم شهرين)'}
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-indigo-600 mt-2">
                    {planPrice}
                  </p>
                </div>

                <div className="bg-indigo-50/70 p-3.5 sm:p-4 rounded-2xl border border-indigo-100">
                  <p className="text-indigo-900 font-bold mb-2.5 sm:mb-3 text-sm sm:text-base">طرق الدفع المتاحة:</p>
                  <div className="space-y-2.5 sm:space-y-3">
                    <a 
                      href="https://ipn.eg/S/gergesnabil101/instapay/8Gfhxe" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-between bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                    >
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] sm:text-xs text-slate-500">اضغط للدفع مباشرة عبر</span>
                        <span className="text-sm sm:text-base font-bold text-indigo-600">إنستا باي (InstaPay)</span>
                      </div>
                      <div className="bg-indigo-600 text-white p-1.5 sm:p-2 rounded-lg group-hover:scale-110 transition-transform">
                        <CreditCard size={18} className="sm:w-5 sm:h-5" />
                      </div>
                    </a>
                    <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-indigo-200">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col text-right">
                          <span className="text-[10px] sm:text-xs text-slate-500">للدفع عبر فودافون كاش:</span>
                          <span className="font-bold text-indigo-600 text-base sm:text-lg" dir="ltr">01021558746</span>
                        </div>
                        <div className="bg-red-600 text-white p-1.5 sm:p-2 rounded-lg">
                          <Smartphone size={18} className="sm:w-5 sm:h-5" />
                        </div>
                      </div>
                      <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1.5 sm:mt-2 text-center">قم بالتحويل للرقم أعلاه ثم ارفع صورة الإيصال</p>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] text-slate-500">عنوان إنستاباي: <b className="font-mono text-indigo-900" dir="ltr">gergesnabil101@instapay</b></span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs sm:text-sm text-slate-600 font-semibold">بعد التحويل، يرجى رفع صورة إيصال الدفع لتفعيل حسابك:</p>
                  
                  {paymentScreenshot ? (
                    <div className="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200 text-center space-y-2">
                      <div className="relative inline-block mx-auto">
                        <img
                          src={paymentScreenshot}
                          alt="Receipt Preview"
                          className="max-h-48 max-w-full rounded-xl object-contain border border-emerald-300 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setPaymentScreenshot(null)}
                          className="absolute -top-2 -right-2 bg-rose-600 text-white p-1 rounded-full shadow-md hover:bg-rose-700 transition-colors"
                          title="حذف الصورة واختيار صورة أخرى"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-700">
                        <CheckCircle2 size={16} />
                        <span>تم تجهيز وضغط صورة الإيصال بنجاح</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPaymentScreenshot(null)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold underline"
                      >
                        تغيير الصورة أو رفع صورة أخرى
                      </button>
                    </div>
                  ) : (
                    <label className="block w-full border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-4 text-center cursor-pointer bg-slate-50/50 hover:bg-indigo-50/30 transition-all">
                      <input 
                        type="file" 
                        accept="image/png,image/jpeg,image/webp,image/*" 
                        onChange={handleScreenshotUpload} 
                        className="hidden" 
                      />
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-3 bg-indigo-100 text-indigo-700 rounded-2xl shadow-xs">
                          <Upload size={24} />
                        </div>
                        <div>
                          <span className="text-xs sm:text-sm text-indigo-700 font-bold block">اضغط لرفع صورة إيصال التحويل</span>
                          <span className="text-[11px] text-slate-400">يدعم صيغ JPG, PNG, WebP</span>
                        </div>
                      </div>
                    </label>
                  )}
                </div>

                <button
                  onClick={handleManualPayment}
                  disabled={!paymentScreenshot || isSubmittingPayment}
                  className={`w-full py-3 sm:py-4 rounded-2xl font-bold text-base sm:text-lg transition-all ${
                    paymentScreenshot && !isSubmittingPayment
                      ? 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-700'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isSubmittingPayment ? 'جاري الإرسال...' : 'تأكيد وإرسال الطلب'}
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200"></span>
                  </div>
                  <div className="relative flex justify-center text-[10px] sm:text-xs uppercase">
                    <span className="bg-white px-2 text-slate-400">أو تواصل معنا مباشرة</span>
                  </div>
                </div>

                <a
                  href="https://wa.me/201223819680"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 sm:py-3 rounded-2xl font-bold text-indigo-600 border-2 border-indigo-600 flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all text-sm sm:text-base"
                >
                  <MessageCircle size={18} className="sm:w-5 sm:h-5" />
                  تواصل عبر واتساب
                </a>
                
                <p className="text-[10px] text-center text-slate-400">
                  سيتم مراجعة طلبك وتفعيل الحساب خلال 24 ساعة كحد أقصى.
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Admin Plan Activation Modal */}
      {selectedUserForPlan && (
        <AdminUserPlanModal
          user={selectedUserForPlan}
          onClose={() => setSelectedUserForPlan(null)}
          onActivate={handleAdminActivateUserPlan}
          onDeactivate={(usr) => setUserToDeactivate(usr)}
        />
      )}

      {/* Teacher Direct Pro Upgrade Modal (Preserving Remaining Tokens) */}
      {proUpgradeModalUser && (
        <TeacherProUpgradeModal
          user={proUpgradeModalUser}
          onClose={() => setProUpgradeModalUser(null)}
          onConfirm={async (params) => {
            await handleUpgradeTeacherToProWithRemainingTokens(params.targetUser, {
              proPlanId: params.proPlanId,
              extendMonth: params.extendMonth,
              extraTokens: params.extraTokens
            });
          }}
          isLoading={isUpgradingProUser}
        />
      )}

      {/* Deactivate User Modal (Without Data Loss) */}
      {/* Lightbox / Full-screen Image Zoom Modal */}
      {imageZoomModalUrl && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200 select-none"
          onClick={() => setImageZoomModalUrl(null)}
        >
          <div 
            className="relative bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Image size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-800">معاينة الرسم التوضيحي للسؤال</h3>
                  <p className="text-[11px] text-slate-500">فحص الأشكال الهندسية، الدوائر الكهربائية، والرسومات البيانية بدقة فائقة</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={imageZoomModalUrl}
                  download="question-diagram.jpg"
                  className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                  title="تحميل الصورة"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">تحميل</span>
                </a>
                <button
                  type="button"
                  onClick={() => setImageZoomModalUrl(null)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="إغلاق المعاينة"
                >
                  <X size={16} />
                  <span>إغلاق</span>
                </button>
              </div>
            </div>

            {/* Modal Body: Image Container with smooth pan/scroll */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-slate-900/5">
              <img
                src={imageZoomModalUrl}
                alt="Enlarged question diagram"
                className="max-h-[72vh] w-auto max-w-full object-contain rounded-2xl bg-white shadow-md border border-slate-200"
              />
            </div>
          </div>
        </div>
      )}

      {userToDeactivate && (
        <DeactivateUserModal
          user={userToDeactivate}
          onClose={() => setUserToDeactivate(null)}
          onConfirm={handleAdminDeactivateUser}
          isLoading={isDeactivatingUser}
        />
      )}

      {/* Share Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4" onClick={() => setShowProfileModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Settings size={20} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">إعدادات الحساب</h3>
              </div>
              <button 
                onClick={() => setShowProfileModal(false)} 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors text-xs font-bold shadow-sm"
                title="إغلاق الإعدادات"
              >
                <X size={16} />
                <span>إغلاق</span>
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">الاسم بالكامل</label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  placeholder="أدخل اسمك..."
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">المنهج الدراسي</label>
                <select
                  value={profileData.curriculum}
                  onChange={(e) => setProfileData({ ...profileData, curriculum: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                >
                  <option value="">اختر المنهج الدراسي</option>
                  <option value="official_ministry">المنهج الرسمي للوزارة</option>
                  <option value="ig_egypt">منهج IG المطبق في مصر</option>
                  <option value="american_egypt">منهج American المطبق في مصر</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">المادة الدراسية</label>
                <input
                  type="text"
                  value={profileData.subject}
                  onChange={(e) => setProfileData({ ...profileData, subject: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  placeholder="مثال: اللغة العربية"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700">المراحل الدراسية التي تدرسها</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 border border-slate-200 rounded-xl bg-slate-50">
                  {['المرحلة الابتدائية', 'المرحلة الإعدادية', 'المرحلة الثانوية'].map(group => (
                    <div key={group} className="col-span-full mb-2">
                      <h5 className="text-xs font-bold text-indigo-600 border-b border-indigo-100 pb-1 mb-2">{group}</h5>
                      <div className="grid grid-cols-1 gap-2">
                        {GRADE_LEVELS.filter(g => g.group === group).map(g => (
                          <label key={g.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-1 rounded transition-colors">
                            <input 
                              type="checkbox" 
                              checked={(profileData.gradeLevel || '').split(',').includes(g.value)}
                              onChange={() => {
                                const currentGrades = profileData.gradeLevel ? profileData.gradeLevel.split(',') : [];
                                let newGrades;
                                if (currentGrades.includes(g.value)) {
                                  newGrades = currentGrades.filter(val => val !== g.value);
                                } else {
                                  newGrades = [...currentGrades, g.value];
                                }
                                setProfileData({ ...profileData, gradeLevel: newGrades.join(',') });
                              }}
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                            />
                            <span className="text-slate-700">{g.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Model Preference Selection */}
              <div className="border-t border-slate-100 pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles size={17} className="text-indigo-600" />
                    <span>نموذج الذكاء الاصطناعي المفضل لحسابك واختباراتك</span>
                  </label>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    {profileData.preferred_ai_model === 'pro' ? 'المخرجات = 6 أضعاف المدخلات' : 'المخرجات = 5 أضعاف المدخلات'}
                  </span>
                </div>
                
                {(isPlatformAdmin || user?.isAdmin || user?.role === 'admin' || (user?.email && user.email.toLowerCase().trim() === 'gergesnabil101@gmail.com')) ? (
                  <div className="bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 border border-amber-300/60 p-2.5 rounded-xl text-xs font-bold text-amber-900 flex items-center gap-2">
                    <span className="text-base">👑</span>
                    <span>صلاحية مدير المشروع: لديك حرية التبديل الكاملة بين محرك فلاش ومحرك برو لاختباراتك دون أي قيود أو اشتراطات.</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    اختر النموذج الافتراضي الذي ترغب في اعتماده لحسابك. يمكنك أيضاً تغيير النموذج في أي اختبار محدد بشكل مستقل:
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Flash Model Card */}
                  <div 
                    onClick={() => setProfileData({ ...profileData, preferred_ai_model: 'flash' })}
                    className={`cursor-pointer p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                      (profileData.preferred_ai_model || 'flash') === 'flash'
                        ? 'border-emerald-500 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Zap size={16} className="text-emerald-600" />
                          <span className="font-bold text-slate-900 text-sm">Gemini 3.8 Flash</span>
                        </div>
                        {(profileData.preferred_ai_model || 'flash') === 'flash' && (
                          <CheckCircle2 size={16} className="text-emerald-600" />
                        )}
                      </div>
                      <div className="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md mb-2">
                        200 جنيه / 1 مليون توكن
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        فائق السرعة وموفر في الاستهلاك. ممتاز للاختبارات الأسبوعية والتصحيح اللحظي المباشر (المخرجات × 5).
                      </p>
                    </div>
                    <div className="mt-2 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                      <span>⚡ استجابة فورية فائقة السرعة</span>
                    </div>
                  </div>

                  {/* Pro Model Card */}
                  <div 
                    onClick={() => {
                      const isManagerAdmin = Boolean(isPlatformAdmin || user?.isAdmin || user?.role === 'admin' || (user?.email && user.email.toLowerCase().trim() === 'gergesnabil101@gmail.com'));
                      if (!isTeacherPro && !isManagerAdmin) {
                        setShowProUpgradeModal(true);
                        return;
                      }
                      setProfileData({ ...profileData, preferred_ai_model: 'pro' });
                    }}
                    className={`cursor-pointer p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                      profileData.preferred_ai_model === 'pro'
                        ? 'border-indigo-600 bg-indigo-50/70 shadow-sm ring-2 ring-indigo-600/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Sparkles size={16} className="text-indigo-600" />
                          <span className="font-bold text-slate-900 text-sm">Gemini Pro</span>
                        </div>
                        {profileData.preferred_ai_model === 'pro' ? (
                          <CheckCircle2 size={16} className="text-indigo-600" />
                        ) : (!isTeacherPro && !isPlatformAdmin && !user?.isAdmin && user?.role !== 'admin' && user?.email?.toLowerCase().trim() !== 'gergesnabil101@gmail.com') ? (
                          <span className="text-[10px] font-black bg-purple-600 text-white px-2 py-0.5 rounded-full shadow-xs">
                            سداد فارق الترقية
                          </span>
                        ) : null}
                      </div>
                      <div className="inline-block bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-md mb-2">
                        250 جنيه / 1 مليون توكن
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        تفكير واستدلال أكاديمي معمّق للمسائل الرياضية والفيزيائية المعقدة (المخرجات × 6).
                      </p>
                    </div>
                    <div className="mt-2 text-[10px] font-bold text-indigo-700 flex items-center justify-between">
                      <span className="flex items-center gap-1">🧠 استدلال عميق للمسائل الدقيقة</span>
                      {(!isTeacherPro && !isPlatformAdmin && !user?.isAdmin && user?.role !== 'admin' && user?.email?.toLowerCase().trim() !== 'gergesnabil101@gmail.com') && (
                        <span className="text-purple-700 underline font-bold">50 ج.م / 1M متبقي</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
                  <CreditCard size={18} />
                  حالة الاشتراك
                </h4>
                {!user ? (
                  <div className="text-sm text-slate-500">جاري تحميل بيانات الاشتراك...</div>
                ) : user?.is_suspended ? (
                  <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 flex flex-col gap-3">
                    <div className="flex items-center gap-3 text-sm font-bold">
                      <XCircle size={20} />
                      انتهى اشتراكك أو تم تعليق حسابك.
                    </div>
                    <button
                      onClick={() => {
                        setShowProfileModal(false);
                        openPlansModal();
                      }}
                      className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <CreditCard size={16} />
                      تجديد / ترقية الاشتراك
                    </button>
                  </div>
                ) : user?.hasPendingSubscription ? (
                  <div className="bg-amber-50 text-amber-700 p-4 rounded-xl border border-amber-200 flex items-center gap-3 text-sm font-bold">
                    <Loader2 size={20} className="animate-spin" />
                    طلب الاشتراك قيد المراجعة من قبل الإدارة
                  </div>
                ) : user?.isActive ? (
                  <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-200 flex flex-col gap-3">
                    <div className="flex items-center gap-3 text-sm font-bold">
                      <CheckCircle size={20} />
                      {user?.role === 'admin' ? 'حساب مسؤول النظام' : `حسابك مفعل (${formatPlanLabel(user?.subscription_type, user?.billing_cycle)})`}
                    </div>
                    <button
                      onClick={() => {
                        setShowProfileModal(false);
                        openPlansModal();
                      }}
                      className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <CreditCard size={16} />
                      تجديد / ترقية الاشتراك
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-slate-700">
                          {user?.isTrialActive ? 'الباقة المجانية (الفترة التجريبية)' : 'انتهى اشتراكك أو الفترة التجريبية'}
                        </span>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          <span>استهلاك الاختبارات: {quizzes.length} من 3 اختبارات متاحة</span>
                          {user?.isTrialActive && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-indigo-700 font-medium bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                حد التوكنز: {Number(user?.tokens_used_today || 0).toLocaleString()} / {TRIAL_DAILY_TOKENS.toLocaleString()} توكن اليوم
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {user?.isTrialActive && (
                        <span className="bg-amber-100 text-amber-700 text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap">
                          {user?.trialDaysLeft} أيام متبقية
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setShowProfileModal(false);
                        openPlansModal();
                      }}
                      className="w-full bg-white text-indigo-600 border-2 border-indigo-600 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                    >
                      <CreditCard size={18} />
                      ترقية / تفعيل الاشتراك
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-6">
                <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
                  <Users size={18} />
                  السناتر والمجموعات
                </h4>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newCenterName}
                    onChange={(e) => setNewCenterName(e.target.value)}
                    className="flex-1 p-3 border border-slate-200 rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    placeholder="اسم السنتر أو المجموعة..."
                  />
                  <button
                    onClick={() => {
                      if (newCenterName.trim()) {
                        setProfileData({ ...profileData, centers: [...profileData.centers, newCenterName.trim()] });
                        setNewCenterName('');
                      }
                    }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700"
                  >
                    إضافة
                  </button>
                </div>
                <div className="space-y-2">
                  {profileData.centers.map((center, index) => (
                    <div key={index} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-sm text-slate-700">{center}</span>
                      <button
                        onClick={() => {
                          setProfileData({ ...profileData, centers: profileData.centers.filter((_, i) => i !== index) });
                        }}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Privacy & Retention Quick Access */}
              <div className="border-t border-slate-100 pt-6">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="text-indigo-600 shrink-0" size={20} />
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">حماية وخصوصية بيانات الطلاب</h4>
                      <p className="text-xs text-slate-500">الاطلاع على سياسة الاحتفاظ وحذف أو تجهيل بيانات الطلاب</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileModal(false);
                      setShowRetentionModal(true);
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors shrink-0"
                  >
                    إدارة الاحتفاظ بالبيانات
                  </button>
                </div>
              </div>

              {/* Danger Zone: Account Deletion */}
              <div className="border-t border-red-100 pt-6">
                <div className="bg-red-50/70 p-4 rounded-2xl border border-red-200">
                  <div className="flex items-center gap-2 text-red-800 font-bold mb-2">
                    <AlertTriangle size={18} className="text-red-600 shrink-0" />
                    <span>منطقة الخطر - حذف الحساب نهائياً</span>
                  </div>
                  <p className="text-xs text-red-700 leading-relaxed mb-3">
                    عند حذف حسابك، سيتم حذف حسابك من نظام المصادقة، بالإضافة إلى كافة اختباراتك ونتائج طلابك والمجلدات بشكل متكامل ودون إمكانية للاسترجاع.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowSelfDeleteModal(true)}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Trash2 size={15} />
                    حذف حسابي وكافة بياناتي نهائياً
                  </button>
                </div>
              </div>

            </div>

            {/* Footer with easy close and save */}
            <div className="p-4 sm:px-6 border-t border-slate-100 bg-slate-50 flex items-center gap-3 sticky bottom-0 z-10">
              <button
                onClick={updateProfile}
                className="flex-1 bg-indigo-600 text-white py-3 sm:py-3.5 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg text-sm sm:text-base flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                حفظ التعديلات
              </button>
              <button
                onClick={() => setShowProfileModal(false)}
                className="px-5 py-3 sm:py-3.5 rounded-2xl border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-100 transition-colors text-sm sm:text-base"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto overflow-x-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Share2 size={24} className="text-indigo-600" />
                مشاركة الاختبار
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                  <QRCodeCanvas
                    id="qr-code-canvas"
                    value={shareUrl}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <button
                  onClick={downloadQRCode}
                  className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors"
                >
                  <Download size={18} />
                  تحميل رمز الاستجابة السريعة (QR Code)
                </button>
                <p className="text-sm text-slate-500 text-center">
                  يمكنك طباعة هذا الرمز في الملازم الخاصة بك ليقوم الطلاب بمسحه باستخدام هواتفهم.
                </p>
              </div>

              <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={includeAnswersInExport}
                    onChange={(e) => setIncludeAnswersInExport(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>تضمين نموذج الإجابة وخطوات الحل والشرح النموذجي عند التحميل 💡</span>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => downloadAsWord(includeAnswersInExport)}
                    disabled={isExportingWord}
                    className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all font-bold text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                  >
                    {isExportingWord ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
                    <span>{isExportingWord ? 'جاري التحميل...' : `تحميل Word ${includeAnswersInExport ? '(مع الحل)' : ''}`}</span>
                  </button>
                  <button
                    onClick={() => downloadAsPdf(includeAnswersInExport)}
                    disabled={isExportingPdf}
                    className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-all font-bold text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                  >
                    {isExportingPdf ? <Loader2 size={18} className="animate-spin" /> : <FileUp size={18} />}
                    <span>{isExportingPdf ? 'جاري التحميل...' : `تحميل PDF ${includeAnswersInExport ? '(مع الحل)' : ''}`}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">كود الاختبار للطلاب:</label>
                  <div className="flex gap-2">
                    <div className="flex-1 p-3 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 text-indigo-700 font-bold text-center text-sm sm:text-lg tracking-wider break-all select-all">
                      {quiz.id}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">أو شارك الرابط مباشرة:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="flex-1 min-w-0 p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-left text-sm focus:outline-none"
                      dir="ltr"
                    />
                    <button
                      onClick={copyToClipboard}
                      className={`flex items-center justify-center w-12 shrink-0 rounded-xl transition-colors ${
                        copied ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                      title="نسخ الرابط"
                    >
                      {copied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                    </button>
                  </div>
                </div>

                {/* Expiration Date Control inside Share Modal */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={18} className="text-indigo-600 shrink-0" />
                      <span className="text-sm font-bold text-slate-800">تاريخ انتهاء صلاحية الرابط:</span>
                    </div>
                    {quiz.expires_at ? (
                      <button
                        type="button"
                        onClick={() => handleUpdateShareExpiration(null)}
                        className="text-xs text-red-600 hover:text-red-700 hover:underline font-bold"
                      >
                        إلغاء التحديد (مفتوح دائماً)
                      </button>
                    ) : null}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <input
                      type="datetime-local"
                      value={quiz.expires_at ? toDateTimeLocalString(new Date(quiz.expires_at)) : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleUpdateShareExpiration(val ? new Date(val).toISOString() : null);
                      }}
                      className="w-full sm:flex-1 min-w-0 p-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 outline-none text-xs bg-white text-slate-800"
                    />
                    <select
                      value={quiz.expires_at ? 'custom' : 'none'}
                      onChange={(e) => {
                        const opt = e.target.value;
                        if (opt === 'none') {
                          handleUpdateShareExpiration(null);
                        } else if (opt === '24h') {
                          const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
                          handleUpdateShareExpiration(d.toISOString());
                        } else if (opt === '3d') {
                          const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
                          handleUpdateShareExpiration(d.toISOString());
                        } else if (opt === '7d') {
                          const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                          handleUpdateShareExpiration(d.toISOString());
                        }
                      }}
                      className="w-full sm:w-auto p-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 outline-none text-xs bg-white text-slate-700 font-medium"
                    >
                      <option value="none">بدون انتهاء (دائماً)</option>
                      <option value="24h">24 ساعة</option>
                      <option value="3d">3 أيام</option>
                      <option value="7d">أسبوع</option>
                      {quiz.expires_at ? <option value="custom">مخصص</option> : null}
                    </select>
                  </div>

                  {(() => {
                    const info = getQuizExpirationInfo(quiz.expires_at);
                    if (!info) {
                      return (
                        <p className="text-[11px] text-slate-500">
                          الرابط مفتوح بشكل دائم ولا ينتهي حتى تقوم بتحديد موعد أو حذفه.
                        </p>
                      );
                    }
                    return (
                      <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                        info.isExpired ? 'bg-rose-100/70 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}>
                        {info.isExpired ? <AlertTriangle size={15} className="shrink-0 text-rose-600" /> : <Clock size={15} className="shrink-0 text-emerald-600" />}
                        <div className="flex-1">
                          <span className="font-bold">{info.isExpired ? 'الرابط منتهي الصلاحية حالياً' : 'الرابط نشط'}: </span>
                          <span>{info.fullDate} ({info.relativeText})</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move / Copy Question Modal */}
      <MoveQuestionModal
        isOpen={showMoveModal}
        onClose={() => {
          setShowMoveModal(false);
          setMoveQuestionId(null);
        }}
        questionId={moveQuestionId}
        questionText={quiz.questions.find(q => q.id === moveQuestionId)?.text}
        currentQuizId={quiz.id}
        quizzes={quizzes}
        onAction={(qId, targetQuizId, action) => copyOrMoveQuestion(qId, targetQuizId, action)}
        onMoveQuestion={(qId, targetQuizId) => copyOrMoveQuestion(qId, targetQuizId, 'move')}
      />

      {/* Delete Entire Quiz Modal */}
      <DeleteQuizModal
        isOpen={showDeleteQuizModal}
        onClose={() => {
          setShowDeleteQuizModal(false);
          setQuizToDelete(null);
        }}
        quiz={quizToDelete}
        onConfirmDelete={async (quizId) => {
          await deleteQuiz(quizId);
          setShowDeleteQuizModal(false);
          setQuizToDelete(null);
        }}
      />

      {/* Move Quiz Modal */}
      <MoveQuizModal
        isOpen={showMoveQuizModal}
        onClose={() => setShowMoveQuizModal(false)}
        quizId={moveQuizId}
        folders={folders}
        onMoveQuiz={(qId, fId) => moveQuiz(qId, fId)}
      />

      {showResultsModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex flex-col lg:flex-row items-center justify-between p-4 sm:p-6 border-b border-slate-100 gap-4 bg-slate-50/50">
              <div className="flex items-center gap-3 w-full lg:w-auto">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold shrink-0 shadow-md shadow-indigo-100">
                  <Users size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-800">نتائج الطلاب</h3>
                    {quizzes && quizzes.length > 0 && (
                      <select
                        value={selectedResultsQuizId || 'all'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedResultsQuizId(val);
                          fetchResults(val);
                        }}
                        className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs rounded-xl px-2.5 py-1 font-bold outline-none cursor-pointer hover:bg-indigo-100 transition-colors max-w-[220px]"
                      >
                        <option value="all">📊 جميع اختباراتي ({teacherResults.length} نتيجة)</option>
                        {quizzes.map(q => (
                          <option key={q.id} value={q.id}>
                            {q.title || 'اختبار بدون عنوان'}
                          </option>
                        ))}
                      </select>
                    )}
                    <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-lg font-bold">
                      {filteredResults.length} {filteredResults.length !== teacherResults.length ? `من ${teacherResults.length}` : 'طالب'}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">فلترة وتصنيف دقيق لنتائج الطلاب، مع إمكانية التصدير والمراسلة</p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full lg:w-auto">
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="بحث بالاسم، السنتر، الهاتف..."
                    value={resultsSearchTerm}
                    onChange={(e) => {
                      setResultsSearchTerm(e.target.value);
                      setResultsPage(1);
                    }}
                    className="w-full pl-9 pr-9 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none text-xs sm:text-sm transition-all bg-white"
                  />
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  {resultsSearchTerm && (
                    <button 
                      onClick={() => {
                        setResultsSearchTerm('');
                        setResultsPage(1);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                
                <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-between flex-wrap sm:flex-nowrap">
                  <button
                    onClick={recalculateAllScores}
                    className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-white px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold transition-colors flex-1 sm:flex-none justify-center shadow-xs"
                    title="إعادة حساب الدرجات لجميع الطلاب بناءً على التعديلات الحالية"
                  >
                    <RefreshCw size={14} />
                    <span>تحديث الدرجات</span>
                  </button>

                  <button
                    onClick={startBatchSend}
                    className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold transition-colors flex-1 sm:flex-none justify-center"
                    title="إرسال النتائج عبر واتساب للطلاب المفلترين"
                  >
                    <MessageCircle size={14} />
                    <span>إرسال للجميع</span>
                  </button>

                  {/* PDF Export Button */}
                  <div className="relative flex-1 sm:flex-none">
                    <button
                      onClick={() => handleDownloadPDF('download')}
                      disabled={filteredResults.length === 0 || isExportingPDF}
                      className="w-full flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold transition-colors justify-center shadow-xs"
                      title="تحميل كشف درجات الطلاب كملف PDF عالي الجودة"
                    >
                      {isExportingPDF ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>جاري إنشاء PDF...</span>
                        </>
                      ) : (
                        <>
                          <FileText size={14} />
                          <span>تحميل PDF</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Print / Vector PDF button */}
                  <button
                    onClick={() => handleDownloadPDF('print')}
                    disabled={filteredResults.length === 0 || isExportingPDF}
                    className="hidden md:flex items-center gap-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-2 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                    title="معاينة وطباعة التقرير / حفظ كـ PDF عبر المتصفح"
                  >
                    <Printer size={14} className="text-slate-600" />
                    <span>طباعة</span>
                  </button>

                  {/* Excel / CSV Export with Dropdown */}
                  <div className="relative flex-1 sm:flex-none">
                    <div className="inline-flex rounded-xl shadow-xs w-full">
                      <button
                        onClick={() => handleDownloadExcel('xls')}
                        disabled={filteredResults.length === 0}
                        className="flex-1 sm:flex-none flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-2.5 sm:px-3 py-2 rounded-r-xl text-xs font-bold transition-colors justify-center"
                        title="تحميل ملف إكسل منسق (.xls)"
                      >
                        <Download size={14} />
                        <span>تصدير إكسل</span>
                      </button>
                      <button
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        disabled={filteredResults.length === 0}
                        className="bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white px-2 py-2 rounded-l-xl text-xs font-bold transition-colors border-r border-emerald-500/40"
                        title="خيارات تصدير إضافية (CSV للموبايل)"
                      >
                        ▾
                      </button>
                    </div>

                    {showExportMenu && (
                      <div className="absolute left-0 mt-1.5 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95">
                        <button
                          onClick={() => {
                            handleDownloadExcel('xls');
                            setShowExportMenu(false);
                          }}
                          className="w-full text-right px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2"
                        >
                          <Download size={14} className="text-emerald-600" />
                          <div>
                            <div>ملف إكسل منسق (.xls)</div>
                            <div className="text-[10px] text-slate-400 font-normal">مع تنسيق الجداول والألوان</div>
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            handleDownloadExcel('csv');
                            setShowExportMenu(false);
                          }}
                          className="w-full text-right px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 border-t border-slate-100"
                        >
                          <FileText size={14} className="text-indigo-600" />
                          <div>
                            <div>ملف CSV فوري (.csv)</div>
                            <div className="text-[10px] text-slate-400 font-normal">متوافق 100% مع كافة هواتف الموبايل</div>
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            handleDownloadPDF('print');
                            setShowExportMenu(false);
                          }}
                          className="w-full text-right px-3 py-2 text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2 border-t border-slate-100"
                        >
                          <Printer size={14} className="text-rose-600" />
                          <div>
                            <div>طباعة أو حفظ PDF متجهي</div>
                            <div className="text-[10px] text-slate-400 font-normal">عبر نافذة الطباعة المباشرة</div>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setShowRetentionModal(true)}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold transition-colors"
                    title="سياسة خصوصية واحتفاظ بيانات الطلاب وحذفها"
                  >
                    <ShieldCheck size={14} className="text-indigo-600" />
                    <span className="hidden lg:inline">الخصوصية</span>
                  </button>

                  <button
                    onClick={() => setShowResultsModal(false)}
                    className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-full transition-colors shrink-0"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Comprehensive Filter & Sort Toolbar */}
            {teacherResults.length > 0 && (
              <div className="px-4 sm:px-6 py-3 bg-slate-50 border-b border-slate-200/80 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {/* Grade Level Filter */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <GraduationCap size={13} className="text-indigo-600" />
                      <span>المرحلة الدراسية</span>
                    </label>
                    <select
                      value={resultsFilterGrade}
                      onChange={(e) => {
                        setResultsFilterGrade(e.target.value);
                        setResultsPage(1);
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none transition-all cursor-pointer truncate"
                    >
                      <option value="all">جميع المراحل الدراسية</option>
                      {uniqueResultGrades.map((g, idx) => (
                        <option key={idx} value={g}>{g}</option>
                      ))}
                      {/* Fallback to standard grades if not in results */}
                      {GRADE_LEVELS.filter(g => !uniqueResultGrades.includes(g.label) && !uniqueResultGrades.includes(g.value)).map((g, idx) => (
                        <option key={`std-${idx}`} value={g.label}>{g.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Subject Filter */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <BookOpen size={13} className="text-indigo-600" />
                      <span>المادة الدراسية</span>
                    </label>
                    <select
                      value={resultsFilterSubject}
                      onChange={(e) => {
                        setResultsFilterSubject(e.target.value);
                        setResultsPage(1);
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none transition-all cursor-pointer truncate"
                    >
                      <option value="all">جميع المواد الدراسية</option>
                      {uniqueResultSubjects.map((s, idx) => (
                        <option key={idx} value={s}>{s}</option>
                      ))}
                      {quiz.subject && !uniqueResultSubjects.includes(quiz.subject) && (
                        <option value={quiz.subject}>{quiz.subject}</option>
                      )}
                    </select>
                  </div>

                  {/* Center / Group Filter */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <MapPin size={13} className="text-indigo-600" />
                      <span>السنتر / المجموعة</span>
                    </label>
                    <select
                      value={resultsFilterCenter}
                      onChange={(e) => {
                        setResultsFilterCenter(e.target.value);
                        setResultsPage(1);
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none transition-all cursor-pointer truncate"
                    >
                      <option value="all">جميع السناتر والمجموعات</option>
                      {uniqueResultCenters.map((c, idx) => (
                        <option key={idx} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Date Filter */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <CalendarDays size={13} className="text-indigo-600" />
                      <span>تاريخ الامتحان</span>
                    </label>
                    <select
                      value={resultsFilterDate}
                      onChange={(e) => {
                        setResultsFilterDate(e.target.value);
                        setResultsPage(1);
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none transition-all cursor-pointer truncate"
                    >
                      <option value="all">جميع التواريخ</option>
                      <option value="today">امتحانات اليوم 📅</option>
                      <option value="week">آخر 7 أيام</option>
                      <option value="month">هذا الشهر (30 يوم)</option>
                      <option value="custom">تحديد تاريخ مخصص...</option>
                    </select>
                  </div>

                  {/* Score Tier Filter */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <Award size={13} className="text-indigo-600" />
                      <span>التقدير والمستوى</span>
                    </label>
                    <select
                      value={resultsFilterScore}
                      onChange={(e) => {
                        setResultsFilterScore(e.target.value);
                        setResultsPage(1);
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none transition-all cursor-pointer truncate"
                    >
                      <option value="all">جميع التقديرات</option>
                      <option value="excellent">ممتاز (85%+)</option>
                      <option value="very_good">جيد جداً (75% - 84%)</option>
                      <option value="pass">ناجح (50% - 74%)</option>
                      <option value="fail">راسب / يحتاج تحسين (&lt;50%)</option>
                    </select>
                  </div>

                  {/* Sorting Selector */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <ArrowUpDown size={13} className="text-indigo-600" />
                      <span>الترتيب حسب</span>
                    </label>
                    <select
                      value={resultsSortBy}
                      onChange={(e) => {
                        setResultsSortBy(e.target.value);
                        setResultsPage(1);
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none transition-all cursor-pointer truncate"
                    >
                      <option value="date_desc">التاريخ (الأحدث أولاً)</option>
                      <option value="date_asc">التاريخ (الأقدم أولاً)</option>
                      <option value="score_desc">الدرجة (من الأعلى للأقل)</option>
                      <option value="score_asc">الدرجة (من الأقل للأعلى)</option>
                      <option value="name_asc">اسم الطالب (أبجدياً أ - ي)</option>
                      <option value="name_desc">اسم الطالب (أبجدياً ي - أ)</option>
                      <option value="center_asc">السنتر (أبجدياً)</option>
                    </select>
                  </div>
                </div>

                {/* Second row: Custom Date Picker (if active) + WhatsApp Status Filter + Reset button */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-1 border-t border-slate-200/60">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {/* Custom Date Input */}
                    {resultsFilterDate === 'custom' && (
                      <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-indigo-200 animate-in fade-in">
                        <span className="text-[11px] text-slate-600 font-bold">التاريخ:</span>
                        <input
                          type="date"
                          value={resultsFilterCustomDate}
                          onChange={(e) => {
                            setResultsFilterCustomDate(e.target.value);
                            setResultsPage(1);
                          }}
                          className="text-xs text-slate-800 outline-none font-medium bg-transparent cursor-pointer"
                        />
                      </div>
                    )}

                    {/* WhatsApp Sent Status Pills */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                      <button
                        onClick={() => { setResultsFilterStatus('all'); setResultsPage(1); }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          resultsFilterStatus === 'all'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        الكل ({filteredResults.length})
                      </button>
                      <button
                        onClick={() => { setResultsFilterStatus('sent'); setResultsPage(1); }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                          resultsFilterStatus === 'sent'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        <CheckCircle2 size={12} />
                        <span>تم الإرسال ({sentCount})</span>
                      </button>
                      <button
                        onClick={() => { setResultsFilterStatus('not_sent'); setResultsPage(1); }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                          resultsFilterStatus === 'not_sent'
                            ? 'bg-amber-600 text-white shadow-2xs'
                            : 'text-amber-700 hover:bg-amber-50'
                        }`}
                      >
                        <span>لم يُرسل ({notSentCount})</span>
                      </button>
                    </div>

                    {/* Deduplication Mode Toggle */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                      <button
                        onClick={() => { setResultsDeduplicateMode('unique_students'); setResultsPage(1); }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                          resultsDeduplicateMode === 'unique_students'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                        title="عرض أحدث نتيجة فقط لكل طالب، وإخفاء تكرار نفس الطالب"
                      >
                        <UserCheck size={13} />
                        <span>طالب واحد لكل صف (أحدث محاولة)</span>
                      </button>
                      <button
                        onClick={() => { setResultsDeduplicateMode('all_attempts'); setResultsPage(1); }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                          resultsDeduplicateMode === 'all_attempts'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                        title="عرض كافة المحاولات والتسليمات السابقة لنفس الطالب"
                      >
                        <Layers size={13} />
                        <span>عرض كل المحاولات ({teacherResults.length})</span>
                      </button>
                    </div>
                  </div>

                  {/* Reset Filters Button */}
                  {isAnyResultFilterActive && (
                    <button
                      onClick={resetAllResultsFilters}
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-xl font-bold transition-colors animate-in fade-in"
                    >
                      <RotateCcw size={13} />
                      <span>إعادة ضبط جميع الفلاتر</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Quick Insights Ribbon */}
            {filteredResults.length > 0 && (
              <div className="bg-slate-100/70 border-b border-slate-200/80 px-4 sm:px-6 py-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200/60 shadow-2xs">
                  <Users size={14} className="text-indigo-600 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-medium">الطلاب المفلترين</span>
                    <span className="font-bold text-slate-800">{filteredResults.length} طالب</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200/60 shadow-2xs">
                  <BarChart2 size={14} className="text-blue-600 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-medium">متوسط الدرجات</span>
                    <span className="font-bold text-slate-800">{filteredAvgScore} ({filteredAvgPct}%)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200/60 shadow-2xs">
                  <TrendingUp size={14} className="text-emerald-600 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-medium">نسبة النجاح</span>
                    <span className="font-bold text-emerald-700">{filteredPassRate}% ({filteredPassCount} طالب)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200/60 shadow-2xs">
                  <Award size={14} className="text-amber-500 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-medium">أعلى درجة</span>
                    <span className="font-bold text-slate-800">{filteredTopScore}</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="p-3 sm:p-6 overflow-y-auto flex-1">
              {retentionSuccessMessage && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-bold animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    <span>{retentionSuccessMessage}</span>
                  </div>
                  <button onClick={() => setRetentionSuccessMessage('')} className="text-emerald-600 hover:text-emerald-900">
                    <X size={16} />
                  </button>
                </div>
              )}

              {isFetchingResults ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-4">
                  <RefreshCw size={36} className="animate-spin text-indigo-500" />
                  <p className="font-medium text-sm">جاري تحميل وتصنيف نتائج الطلاب...</p>
                </div>
              ) : teacherResults.length === 0 ? (
                <div className="text-center py-16 text-slate-500 space-y-3 max-w-md mx-auto">
                  <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto text-slate-400">
                    <Users size={32} />
                  </div>
                  <p className="font-bold text-slate-700 text-base">لا توجد نتائج مسجلة حتى الآن</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {selectedResultsQuizId && selectedResultsQuizId !== 'all' 
                      ? 'لم يقم أي طالب بتقديم إجابات لهذا الاختبار المحدد بعد. يمكنك مشاركة رابط الاختبار مع طلابك للبدء في استلام الإجابات.'
                      : 'لم يتم تسجيل أي نتائج للطلاب عبر اختباراتك حتى الآن. بمجرد إجابة الطلاب على الاختبار ومشاركته ستظهر الدرجات والتفاصيل هنا فورياً.'
                    }
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    {selectedResultsQuizId && selectedResultsQuizId !== 'all' && (
                      <button
                        onClick={() => {
                          setSelectedResultsQuizId('all');
                          fetchResults('all');
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm"
                      >
                        عرض جميع الاختبارات
                      </button>
                    )}
                    <button
                      onClick={() => fetchResults(selectedResultsQuizId || 'all')}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl transition-all"
                    >
                      تحديث الآن
                    </button>
                  </div>
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="text-center py-16 text-slate-500 space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Filter size={36} className="mx-auto text-slate-300" />
                  <p className="font-bold text-slate-700 text-base">لا توجد نتائج تطابق خيارات الفلترة المحددة</p>
                  <p className="text-xs text-slate-500">جرب تعديل شروط البحث أو اختيار مرحلة أو سنتر أو تاريخ آخر.</p>
                  <button
                    onClick={resetAllResultsFilters}
                    className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    <RotateCcw size={14} />
                    <span>إعادة ضبط جميع الفلاتر</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-200/80 shadow-2xs">
                    <table className="w-full text-right border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                          <th className="p-3.5 font-bold">اسم الطالب</th>
                          <th className="p-3.5 font-bold">المرحلة / المادة</th>
                          <th className="p-3.5 font-bold">السنتر / المجموعة</th>
                          <th className="p-3.5 font-bold">الدرجة والتقدير</th>
                          <th className="p-3.5 font-bold text-center">متابعة ولي الأمر</th>
                          <th className="p-3.5 font-bold">تاريخ الامتحان</th>
                          <th className="p-3.5 font-bold text-left">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedResults.map((result, idx) => {
                          const pct = Math.round(((result.score || 0) / (result.total || 1)) * 100);
                          let badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                          let ratingText = 'ممتاز';
                          if (pct < 50) {
                            badgeBg = 'bg-red-50 text-red-700 border-red-200';
                            ratingText = 'يحتاج تحسين';
                          } else if (pct < 75) {
                            badgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
                            ratingText = 'ناجح';
                          } else if (pct < 85) {
                            badgeBg = 'bg-blue-50 text-blue-700 border-blue-200';
                            ratingText = 'جيد جداً';
                          }

                          const studentKey = getStudentQuizKey(result);
                          const totalAttempts = studentAttemptCounts[studentKey] || 1;

                          return (
                            <tr key={idx} className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors">
                              <td className="p-3.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-800">{result.student_name}</span>
                                  {result.student_code && (
                                    <span 
                                      className="text-[10px] font-mono font-black bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 shrink-0" 
                                      title="كود الطالب المستخدم في الدخول"
                                    >
                                      <KeyRound size={10} className="text-amber-600" />
                                      <span>{result.student_code}</span>
                                    </span>
                                  )}
                                  {totalAttempts > 1 && (
                                    <span 
                                      className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 shrink-0" 
                                      title={`قام الطالب بتقديم ${totalAttempts} محاولات لهذا الاختبار`}
                                    >
                                      <Layers size={10} className="text-amber-600" />
                                      <span>{totalAttempts} محاولات</span>
                                    </span>
                                  )}
                                </div>
                                {(result.student_phone || result.phone) && (
                                  <div className="text-[11px] text-slate-400 font-mono" dir="ltr">
                                    {result.student_phone || result.phone}
                                  </div>
                                )}
                              </td>
                              <td className="p-3.5">
                                <div className="flex flex-col gap-1">
                                  {result.grade_level && (
                                    <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md inline-block w-fit">
                                      {result.grade_level}
                                    </span>
                                  )}
                                  {result.subject && (
                                    <span className="text-[10px] font-medium text-slate-500">
                                      {result.subject}
                                    </span>
                                  )}
                                  {!result.grade_level && !result.subject && (
                                    <span className="text-slate-400 text-xs">-</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3.5">
                                <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-xl text-xs font-bold inline-block">
                                  {result.center_name || 'عام'}
                                </span>
                              </td>
                              <td className="p-3.5">
                                {result.is_graded === false ? (
                                  <span className="text-amber-600 font-bold flex items-center gap-1 text-xs">
                                    <RefreshCw size={13} className="animate-spin-slow" />
                                    في انتظار التصحيح
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className={`font-black text-sm ${pct >= 50 ? 'text-slate-800' : 'text-red-600'}`}>
                                      {result.score} / {result.total}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeBg}`}>
                                      {pct}% • {ratingText}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="p-3.5 text-center">
                                <button
                                  onClick={(e) => toggleReviewAndSent(result, e)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs ${
                                    result.reviewed_and_sent
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300'
                                  }`}
                                  title={
                                    result.reviewed_and_sent
                                      ? `تمت مراجعة الدرجة وإرسالها لولي الأمر ${result.reviewed_and_sent_at ? `(${new Date(result.reviewed_and_sent_at).toLocaleString('ar-EG')})` : ''} - انقر للإلغاء`
                                      : 'انقر لتأكيد مراجعة الدرجة وإرسال النتيجة لولي الأمر'
                                  }
                                >
                                  <CheckCircle2
                                    size={14}
                                    className={result.reviewed_and_sent ? 'text-emerald-600 fill-emerald-100 shrink-0' : 'text-slate-300 shrink-0'}
                                  />
                                  <span>{result.reviewed_and_sent ? 'تم الإرسال لولي الأمر' : 'لم يُرسل بعد'}</span>
                                </button>
                              </td>
                              <td className="p-3.5 text-slate-500 text-xs">
                                <div dir="ltr" className="font-mono text-slate-600">
                                  {result.created_at ? new Date(result.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                </div>
                                {result.time_spent_seconds ? (
                                  <div className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1 mt-1 bg-indigo-50 px-2 py-0.5 rounded-md w-fit" title="الوقت المستغرق في حل الاختبار">
                                    <Clock size={11} className="text-indigo-500" />
                                    <span>{formatDuration(result.time_spent_seconds)}</span>
                                  </div>
                                ) : null}
                              </td>
                              <td className="p-3.5 text-left">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => openStudentSheet(result)}
                                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all shadow-2xs"
                                    title="عرض ورقة الإجابة والحلول كاملة"
                                  >
                                    <Eye size={14} />
                                    <span>ورقة الإجابة</span>
                                  </button>
                                  <button
                                    onClick={() => openPaperShareModal(result)}
                                    className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 p-1.5 rounded-xl font-medium transition-colors border border-transparent hover:border-emerald-200"
                                    title="إرسال ورقة الإجابة والنتيجة عبر واتساب (PDF / صورة / نص)"
                                  >
                                    <MessageCircle size={15} />
                                  </button>
                                  <button
                                    onClick={() => openGradingModal(result)}
                                    className="text-slate-600 hover:text-slate-800 hover:bg-slate-100 p-1.5 rounded-xl font-medium transition-colors border border-transparent hover:border-slate-200"
                                    title="مراجعة وتعديل الدرجات يدوياً"
                                  >
                                    <Settings size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="sm:hidden space-y-3">
                    {paginatedResults.map((result, idx) => {
                      const pct = Math.round(((result.score || 0) / (result.total || 1)) * 100);
                      let badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      let ratingText = 'ممتاز';
                      if (pct < 50) {
                        badgeBg = 'bg-red-50 text-red-700 border-red-200';
                        ratingText = 'يحتاج تحسين';
                      } else if (pct < 75) {
                        badgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
                        ratingText = 'ناجح';
                      } else if (pct < 85) {
                        badgeBg = 'bg-blue-50 text-blue-700 border-blue-200';
                        ratingText = 'جيد جداً';
                      }

                      const studentKey = getStudentQuizKey(result);
                      const totalAttempts = studentAttemptCounts[studentKey] || 1;

                      return (
                        <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-bold text-slate-800 text-sm">{result.student_name}</p>
                                {totalAttempts > 1 && (
                                  <span 
                                    className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 shrink-0" 
                                    title={`قام الطالب بتقديم ${totalAttempts} محاولات`}
                                  >
                                    <Layers size={10} className="text-amber-600" />
                                    <span>{totalAttempts} محاولات</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {result.grade_level && (
                                  <span className="text-[10px] font-bold bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                                    {result.grade_level}
                                  </span>
                                )}
                                {result.subject && (
                                  <span className="text-[10px] text-slate-500">
                                    {result.subject}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-left">
                              <span className={`font-black text-sm ${pct >= 50 ? 'text-slate-800' : 'text-red-600'}`}>
                                {result.score} / {result.total}
                              </span>
                              <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 ${badgeBg}`}>
                                {pct}% • {ratingText}
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200/60">
                            <span className="bg-indigo-100/80 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                              {result.center_name || 'عام'}
                            </span>
                            <span className="text-slate-500 text-[11px]" dir="ltr">
                              {result.created_at ? new Date(result.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                            </span>
                          </div>
                          
                          {/* Parent Review & Sent Status Pill on Mobile */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                            <span className="text-xs text-slate-500 font-medium">متابعة ولي الأمر:</span>
                            <button
                              onClick={(e) => toggleReviewAndSent(result, e)}
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                                result.reviewed_and_sent
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-indigo-50'
                              }`}
                            >
                              <CheckCircle2
                                size={14}
                                className={result.reviewed_and_sent ? 'text-emerald-600 fill-emerald-100' : 'text-slate-300'}
                              />
                              <span>{result.reviewed_and_sent ? 'تم الإرسال لولي الأمر' : 'لم يُرسل (اضغط للتعليم)'}</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200/60">
                            <button
                              onClick={() => openStudentSheet(result)}
                              className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                            >
                              <Eye size={14} />
                              <span>عرض الإجابات والحلول</span>
                            </button>
                            <button
                              onClick={() => openPaperShareModal(result)}
                              className="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 p-2 rounded-xl font-medium text-xs flex items-center justify-center transition-colors"
                              title="إرسال ورقة الإجابة والنتيجة عبر واتساب (PDF / صورة / نص)"
                            >
                              <MessageCircle size={15} />
                            </button>
                            <button
                              onClick={() => openGradingModal(result)}
                              className="text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 p-2 rounded-xl font-medium text-xs flex items-center justify-center transition-colors"
                              title="تعديل الدرجات"
                            >
                              <Settings size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Results Pagination */}
                  {filteredResults.length > 0 && (
                    <div className="mt-4">
                      <Pagination
                        currentPage={resultsPage}
                        totalPages={totalResultsPages}
                        totalItems={filteredResults.length}
                        itemsPerPage={RESULTS_PER_PAGE}
                        onPageChange={setResultsPage}
                        itemName="طالب"
                        theme="indigo"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Student Detailed Answer Sheet Modal */}
      {showStudentSheetModal && sheetStudentResult && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 shadow-md shadow-indigo-200">
                  <FileText size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-800">
                      ورقة إجابة الطالب: {sheetStudentResult.student_name}
                    </h3>
                    <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-bold">
                      {sheetStudentResult.center_name || 'بدون سنتر'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {sheetQuizData?.title || sheetStudentResult.quiz_title || quiz.title || 'الاختبار'} • {new Date(sheetStudentResult.created_at).toLocaleString('ar-EG')}
                    {sheetStudentResult.time_spent_seconds ? ` • استغرق: ${formatDuration(sheetStudentResult.time_spent_seconds)}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                {/* Score pill */}
                <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2">
                  <Award size={18} className="text-amber-500" />
                  <span className="text-xs text-slate-500 font-medium">الدرجة:</span>
                  <span className={`text-base sm:text-lg font-black ${
                    sheetStudentResult.score >= sheetStudentResult.total * 0.75 
                      ? 'text-emerald-600' 
                      : sheetStudentResult.score >= sheetStudentResult.total * 0.5 
                      ? 'text-amber-600' 
                      : 'text-rose-600'
                  }`}>
                    {sheetStudentResult.score} / {sheetStudentResult.total}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">
                    ({Math.round((sheetStudentResult.score / (sheetStudentResult.total || 1)) * 100)}%)
                  </span>
                </div>

                {/* Direct Image Download button */}
                <button
                  type="button"
                  onClick={() => downloadStudentPaperImage(sheetStudentResult, sheetQuizData || quiz, teacherInfo)}
                  className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  title="تحميل ورقة إجابة الطالب كصورة PNG عالية الدقة"
                >
                  <Download size={15} className="text-teal-600" />
                  <span>تحميل صورة الورقة</span>
                </button>

                {/* Print button */}
                <button
                  onClick={() => window.print()}
                  className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 p-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                  title="طباعة ورقة الإجابة"
                >
                  <Printer size={18} />
                </button>

                {/* WhatsApp button */}
                <button
                  type="button"
                  onClick={() => openPaperShareModal(sheetStudentResult)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                  title="إرسال صورة ورقة إجابة الطالب لـ واتساب (الطالب أو ولي الأمر)"
                >
                  <MessageCircle size={16} />
                  <span>إرسال صورة الورقة لواتساب</span>
                </button>

                {/* Review & Sent to Parent Toggle */}
                <button
                  onClick={() => toggleReviewAndSent(sheetStudentResult)}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors border shadow-sm ${
                    sheetStudentResult.reviewed_and_sent
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                  title={sheetStudentResult.reviewed_and_sent ? 'تمت المراجعة والإرسال لولي الأمر (اضغط للإلغاء)' : 'تحديد كـ تمت المراجعة والإرسال لولي الأمر'}
                >
                  <CheckCircle2 size={16} className={sheetStudentResult.reviewed_and_sent ? 'text-emerald-600 fill-emerald-100' : 'text-slate-400'} />
                  <span>{sheetStudentResult.reviewed_and_sent ? 'تم الإرسال لولي الأمر' : 'تحديد كـ تم الإرسال'}</span>
                </button>

                {/* Recalculate Sheet with Latest Rules button */}
                <button
                  onClick={() => regradeSingleStudentSheet(sheetStudentResult, sheetQuizData)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-all shadow-2xs"
                  title="إعادة تطبيق معايير التصحيح المحدثة ومطابقة النموذج على جميع الأسئلة وحفظ الورقة فوراً"
                >
                  <Sparkles size={14} className="text-indigo-600" />
                  <span>إعادة تطبيق المعايير وتحديث الدرجة</span>
                </button>

                {/* Close modal */}
                <button
                  onClick={() => setShowStudentSheetModal(false)}
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Questions and Student Solutions List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {isLoadingSheet ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
                  <RefreshCw size={28} className="animate-spin text-indigo-600" />
                  <p className="text-sm">جاري تجهيز ورقة إجابة الطالب والحلول...</p>
                </div>
              ) : (
                <>
                  {/* Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100">
                    <div className="bg-white p-3 rounded-xl border border-indigo-50 text-center">
                      <span className="text-xs text-slate-400 font-bold block">إجمالي الأسئلة</span>
                      <span className="text-lg font-black text-slate-700">{sheetQuizData?.questions?.length || 0}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-indigo-50 text-center">
                      <span className="text-xs text-slate-400 font-bold block">الدرجة النهائية</span>
                      <span className="text-lg font-black text-slate-700">{sheetStudentResult.total}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-indigo-50 text-center">
                      <span className="text-xs text-slate-400 font-bold block">درجة الطالب</span>
                      <span className="text-lg font-black text-indigo-600">{sheetStudentResult.score}</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-indigo-50 text-center">
                      <span className="text-xs text-slate-400 font-bold block">النسبة المئوية</span>
                      <span className={`text-lg font-black ${
                        sheetStudentResult.score >= sheetStudentResult.total * 0.75 
                          ? 'text-emerald-600' 
                          : 'text-amber-600'
                      }`}>
                        {Math.round((sheetStudentResult.score / (sheetStudentResult.total || 1)) * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Questions List */}
                  {sheetQuizData?.questions && sheetQuizData.questions.map((q: any, idx: number) => {
                    const feedbackObj = JSON.parse(sheetStudentResult.feedback || '{}');
                    const qFeedback = feedbackObj[q.id] || {};
                    const isEssay = q.type === 'essay';
                    const isTrueFalse = q.type === 'true-false';
                    const isMCQ = !isEssay && !isTrueFalse;

                    const studentAns = qFeedback.studentAnswer !== undefined 
                      ? qFeedback.studentAnswer 
                      : (sheetStudentResult.student_answers ? JSON.parse(sheetStudentResult.student_answers || '{}')[q.id] : undefined);

                    const isEnglishQ = isEnglishContent(q.text, ...(q.options || []), q.modelAnswer);

                    const exactCheck = isEssay ? checkEssayExactOrEquivalent(studentAns, q.modelAnswer, q.points || 1, isEnglishQ, q.keywords) : { matched: false, score: 0, feedback: '', steps: [] };

                    const pointsAwarded = isEssay
                      ? (qFeedback.score !== undefined ? Number(qFeedback.score) : (exactCheck.matched ? exactCheck.score : 0))
                      : (isQuestionAnswerCorrect(q, studentAns) ? (q.points || 1) : 0);

                    const isQuestionCorrect = isEssay
                      ? (pointsAwarded >= (q.points || 1) * 0.75)
                      : isQuestionAnswerCorrect(q, studentAns);

                    const displayFeedback = (qFeedback.score !== undefined && qFeedback.feedback)
                      ? qFeedback.feedback
                      : (exactCheck.matched ? exactCheck.feedback : (qFeedback.feedback || ''));

                    const displaySteps = (qFeedback.score !== undefined && Array.isArray(qFeedback.steps) && qFeedback.steps.length > 0)
                      ? qFeedback.steps
                      : (exactCheck.matched && exactCheck.steps ? exactCheck.steps : (Array.isArray(qFeedback.steps) ? qFeedback.steps : []));

                    return (
                      <div 
                        key={q.id}
                        dir={isEnglishQ ? "ltr" : "rtl"}
                        className={`rounded-2xl p-4 sm:p-5 border transition-all ${
                          isEssay
                            ? 'bg-slate-50/70 border-slate-200'
                            : isQuestionCorrect 
                            ? 'bg-emerald-50/40 border-emerald-200' 
                            : 'bg-rose-50/40 border-rose-200'
                        } ${isEnglishQ ? 'text-left' : 'text-right'}`}
                      >
                        {/* Question Title & Points Header */}
                        <div className="flex justify-between items-start gap-4 mb-3 pb-3 border-b border-slate-200/70">
                          <div className="flex items-start gap-2.5 flex-1">
                            <span className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm shrink-0 shadow-sm">
                              {idx + 1}
                            </span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                  isEssay 
                                    ? 'bg-purple-100 text-purple-700' 
                                    : isTrueFalse 
                                    ? 'bg-amber-100 text-amber-700' 
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {isEssay 
                                    ? (isEnglishQ ? 'Essay Question' : 'سؤال مقالي') 
                                    : isTrueFalse 
                                    ? (isEnglishQ ? 'True / False' : 'صح أم خطأ') 
                                    : (isEnglishQ ? 'Multiple Choice' : 'اختيار من متعدد')}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-400">
                                  ({q.points || 1} {isEnglishQ ? ((q.points || 1) === 1 ? 'pt' : 'pts') : ((q.points || 1) > 2 ? 'درجات' : 'درجة')})
                                </span>
                              </div>
                              <h4 className="font-bold text-slate-800 text-sm sm:text-base leading-relaxed" dir={isEnglishQ ? "ltr" : "rtl"}>
                                <MathText text={q.text} />
                              </h4>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5">
                            {isEssay ? (
                              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 shadow-sm">
                                {pointsAwarded} / {q.points || 1} {isEnglishQ ? 'pts' : 'درجة'}
                              </span>
                            ) : isQuestionCorrect ? (
                              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-sm">
                                <CheckCircle size={13} />
                                <span>{q.points || 1} / {q.points || 1} {isEnglishQ ? 'pts' : 'درجة'}</span>
                              </span>
                            ) : (
                              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 shadow-sm">
                                <XCircle size={13} />
                                <span>0 / {q.points || 1} {isEnglishQ ? 'pts' : 'درجة'}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Question Image in Teacher Submission Review */}
                        {q.image && (
                          <div className="my-3 flex flex-col items-center">
                            <div 
                              className="relative group cursor-pointer w-full max-w-md mx-auto text-center"
                              onClick={() => setImageZoomModalUrl(q.image || null)}
                              title="انقر لتكبير وفحص الرسم التوضيحي"
                            >
                              <img 
                                src={q.image} 
                                alt="Question diagram" 
                                className="max-h-48 sm:max-h-60 w-auto max-w-full mx-auto object-contain rounded-xl border border-slate-200 bg-white p-1 shadow-xs hover:border-indigo-400 transition-all" 
                              />
                              <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-indigo-600 font-bold">
                                <Eye size={12} />
                                <span>انقر لتكبير وفحص الرسم التوضيحي للسؤال</span>
                              </div>
                            </div>
                          </div>
                        )}


                        {/* Multiple Choice Options Display */}
                        {isMCQ && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3" dir={isEnglishQ ? "ltr" : "rtl"}>
                            {q.options?.map((opt: string, optIdx: number) => {
                              const isSelectedByStudent = studentAns !== undefined && studentAns !== null && Number(studentAns) === Number(optIdx);
                              const isThisOptionCorrect = Number(q.correctOptionIndex) === Number(optIdx);
                              const isOptEng = isEnglishContent(opt) || isEnglishQ;

                              let cardStyle = "bg-white border-slate-200 text-slate-700";
                              let badge = null;

                              if (isSelectedByStudent && isThisOptionCorrect) {
                                cardStyle = "bg-emerald-100/90 border-emerald-500 text-emerald-900 font-bold ring-2 ring-emerald-400/30";
                                badge = (
                                  <span className="text-[11px] bg-emerald-600 text-white px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shrink-0">
                                    <CheckCircle size={12} />
                                    {isEnglishQ ? "Student's Correct Answer" : "إجابة الطالب الصحيحة"}
                                  </span>
                                );
                              } else if (isSelectedByStudent && !isThisOptionCorrect) {
                                cardStyle = "bg-rose-100/90 border-rose-500 text-rose-900 font-bold ring-2 ring-rose-400/30";
                                badge = (
                                  <span className="text-[11px] bg-rose-600 text-white px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shrink-0">
                                    <XCircle size={12} />
                                    {isEnglishQ ? "Student's Wrong Answer" : "إجابة الطالب الخاطئة"}
                                  </span>
                                );
                              } else if (isThisOptionCorrect) {
                                cardStyle = "bg-emerald-50 border-emerald-400 text-emerald-800 font-semibold";
                                badge = (
                                  <span className="text-[11px] bg-emerald-100 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shrink-0">
                                    <CheckCircle size={12} />
                                    {isEnglishQ ? "Model Correct Answer" : "الإجابة الصحيحة المعتمدة"}
                                  </span>
                                );
                              }

                              return (
                                <div 
                                  key={optIdx} 
                                  dir={isOptEng ? "ltr" : "rtl"}
                                  className={`p-3 rounded-xl border text-sm flex items-center justify-between gap-2 ${cardStyle} transition-all`}
                                >
                                  <div className="flex items-center gap-2 flex-1">
                                    <span className="w-6 h-6 rounded-lg bg-white/80 border border-current/20 flex items-center justify-center text-xs font-bold shrink-0">
                                      {String.fromCharCode(65 + optIdx)}
                                    </span>
                                    <div className={isOptEng ? "text-left" : "text-right"} dir={isOptEng ? "ltr" : "rtl"}>
                                      <MathText text={opt} />
                                    </div>
                                  </div>
                                  {badge}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* True/False Display */}
                        {isTrueFalse && (
                          <div className="grid grid-cols-2 gap-3 mt-3" dir={isEnglishQ ? "ltr" : "rtl"}>
                            {[
                              { label: isEnglishQ ? 'True' : 'صح', val: 0 },
                              { label: isEnglishQ ? 'False' : 'خطأ', val: 1 }
                            ].map((item) => {
                              const isSelectedByStudent = studentAns !== undefined && studentAns !== null && Number(studentAns) === Number(item.val);
                              const isThisOptionCorrect = Number(q.correctOptionIndex) === Number(item.val);

                              let cardStyle = "bg-white border-slate-200 text-slate-700";
                              let badge = null;

                              if (isSelectedByStudent && isThisOptionCorrect) {
                                cardStyle = "bg-emerald-100 border-emerald-500 text-emerald-900 font-bold ring-2 ring-emerald-400/30";
                                badge = <span className="text-[11px] bg-emerald-600 text-white px-2 py-0.5 rounded-md font-bold">{isEnglishQ ? "Student Correct ✓" : "إجابة الطالب الصحيحة ✓"}</span>;
                              } else if (isSelectedByStudent && !isThisOptionCorrect) {
                                cardStyle = "bg-rose-100 border-rose-500 text-rose-900 font-bold ring-2 ring-rose-400/30";
                                badge = <span className="text-[11px] bg-rose-600 text-white px-2 py-0.5 rounded-md font-bold">{isEnglishQ ? "Student Incorrect ✗" : "إجابة الطالب الخاطئة ✗"}</span>;
                              } else if (isThisOptionCorrect) {
                                cardStyle = "bg-emerald-50 border-emerald-400 text-emerald-800 font-semibold";
                                badge = <span className="text-[11px] bg-emerald-100 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded-md font-bold">{isEnglishQ ? "Correct Answer ✓" : "الإجابة الصحيحة ✓"}</span>;
                              }

                              return (
                                <div key={item.val} className={`p-3 rounded-xl border text-sm flex items-center justify-between gap-2 ${cardStyle}`}>
                                  <span className="font-bold text-base">{item.label}</span>
                                  {badge}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Essay Question Display */}
                        {isEssay && (
                          <div className="space-y-3 mt-3">
                            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                              <p className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                                <User size={13} className="text-indigo-600" />
                                {isEnglishQ ? "Student's Answer:" : "إجابة الطالب:"}
                              </p>
                              <div className="text-slate-800 text-sm whitespace-pre-wrap leading-relaxed font-medium" dir={isEnglishQ ? "ltr" : "rtl"}>
                                {qFeedback.studentAnswer ? (
                                  <MathText text={qFeedback.studentAnswer} />
                                ) : (
                                  isEnglishQ ? 'No answer written by student' : 'لم يكتب الطالب إجابة لهذا السؤال'
                                )}
                              </div>
                            </div>

                            <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200">
                              <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1">
                                <CheckCircle size={13} />
                                {isEnglishQ ? "Official Model Answer:" : "الإجابة النموذجية الصحيحة:"}
                              </p>
                              <div className="text-emerald-900 text-sm whitespace-pre-wrap leading-relaxed font-medium" dir={isEnglishQ ? "ltr" : "rtl"}>
                                <MathText text={qFeedback.correctExample || q.modelAnswer || (isEnglishQ ? 'Official Benchmark Model Answer' : 'الإجابة النموذجية المعتمدة للاختبار')} />
                              </div>
                            </div>

                            {displayFeedback && (
                              <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                                <p className="text-xs font-bold text-indigo-700 mb-1 flex items-center gap-1">
                                  <Sparkles size={13} />
                                  {isEnglishQ ? "Examiner Feedback:" : "ملاحظات المصحح الآلي:"}
                                </p>
                                <p className="text-xs text-indigo-900 leading-relaxed" dir={isEnglishQ ? "ltr" : "rtl"}>
                                  {displayFeedback}
                                </p>
                              </div>
                            )}

                            {/* Step-by-Step Mark Distribution Breakdown */}
                            {Array.isArray(displaySteps) && displaySteps.length > 0 && (
                              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                                <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                                  <CheckCircle size={13} className="text-indigo-600" />
                                  {isEnglishQ ? "Step-by-step Marks Breakdown:" : "توزيع الدرجات على خطوات وأجزاء الإجابة:"}
                                </p>
                                <div className="space-y-1.5">
                                  {displaySteps.map((step: any, sIdx: number) => (
                                    <div key={sIdx} className="flex items-center justify-between text-xs border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                                      <span className="text-slate-700 font-medium flex-1 text-right" dir="auto">
                                        <MathText text={step.description} />
                                      </span>
                                      <span className={`font-bold shrink-0 mr-3 px-2 py-0.5 rounded text-[11px] ${step.earned === step.points ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : step.earned > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                        {step.earned} / {step.points} {isEnglishQ ? 'pts' : 'درجة'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Teacher Grade Adjustment Control */}
                            <div className="bg-slate-100/80 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-600">تعديل درجة هذا السؤال:</span>
                                <input
                                  type="number"
                                  min="0"
                                  max={q.points || 1}
                                  step="0.25"
                                  defaultValue={pointsAwarded}
                                  id={`grade_input_${q.id}`}
                                  className="w-20 px-2.5 py-1 text-center font-bold text-sm bg-white border border-slate-300 rounded-lg focus:border-indigo-600 outline-none"
                                />
                                <span className="text-xs text-slate-500">من {q.points || 1}</span>
                              </div>

                              <button
                                onClick={() => {
                                  const inputEl = document.getElementById(`grade_input_${q.id}`) as HTMLInputElement;
                                  if (inputEl) {
                                    const val = parseFloat(inputEl.value);
                                    if (!isNaN(val)) {
                                      updateQuestionGradeInSheet(q.id, val);
                                    }
                                  }
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                              >
                                <Check size={13} />
                                حفظ التعديل
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setShowStudentSheetModal(false);
                  openGradingModal(sheetStudentResult);
                }}
                className="text-xs sm:text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
              >
                <Settings size={15} />
                <span>فتح نافذة التصحيح الشامل</span>
              </button>

              <button
                onClick={() => setShowStudentSheetModal(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-bold px-6 py-2 rounded-xl transition-colors"
              >
                إغلاق ورقة الإجابة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Paper WhatsApp & PDF/Image Share Modal */}
      {showPaperShareModal && paperShareResult && (
        <StudentPaperShareModal
          isOpen={showPaperShareModal}
          onClose={() => {
            setShowPaperShareModal(false);
            setPaperShareResult(null);
          }}
          result={paperShareResult}
          quiz={sheetQuizData || quiz}
          teacherInfo={teacherInfo || {
            name: user?.name || profileData.name || quiz.teacher_name || '',
            subject: user?.subject || profileData.subject || quiz.subject || '',
            phone: user?.phone || profileData.phone || ''
          }}
          onMarkSent={async (resultId: string) => {
            const now = new Date().toISOString();
            setTeacherResults(prev => prev.map(r => 
              r.id === resultId 
                ? { ...r, reviewed_and_sent: true, reviewed_and_sent_at: now } 
                : r
            ));
            if (sheetStudentResult && sheetStudentResult.id === resultId) {
              setSheetStudentResult(prev => prev ? { ...prev, reviewed_and_sent: true, reviewed_and_sent_at: now } : null);
            }
            try {
              await updateDoc(doc(db, 'results', resultId), {
                reviewed_and_sent: true,
                reviewed_and_sent_at: now
              });
            } catch (e) {
              console.warn('Direct Firestore update warning on mark sent:', e);
            }
            try {
              const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => token) : token;
              await fetch(`/api/results/${resultId}/review`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
                },
                body: JSON.stringify({
                  reviewed_and_sent: true,
                  reviewed_and_sent_at: now
                })
              });
            } catch (e) {
              console.warn('API update warning on mark sent:', e);
            }
          }}
        />
      )}

      {/* PDF Page Selection Modal for Question Extraction */}
      {showPdfPageModal && pendingPdfData && (
        <PdfPageSelectionModal
          isOpen={showPdfPageModal}
          fileName={pendingPdfData.fileName}
          totalPages={pendingPdfData.totalPages}
          onClose={() => {
            setShowPdfPageModal(false);
            setPendingPdfData(null);
            setIsGenerating(false);
            setGenerationProgress('');
          }}
          onConfirm={(selectedPages) => {
            const data = pendingPdfData;
            setShowPdfPageModal(false);
            setPendingPdfData(null);
            processSelectedPdfPages(data.arrayBuffer, selectedPages, data.fileName);
          }}
        />
      )}

      {showBatchSendModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <MessageCircle className="text-emerald-500" />
                إرسال النتائج للجميع
              </h3>
              <button onClick={() => setShowBatchSendModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              {currentSendIndex < sendingQueue.length ? (
                <div className="text-center space-y-6">
                  <div className="flex justify-between text-sm text-slate-500 mb-2">
                    <span>طالب {currentSendIndex + 1} من {sendingQueue.length}</span>
                    <span>{Math.round((currentSendIndex / sendingQueue.length) * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-6">
                    <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${(currentSendIndex / sendingQueue.length) * 100}%` }}></div>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">الطالب الحالي:</p>
                    <p className="text-xl font-bold text-slate-800">{sendingQueue[currentSendIndex].student_name}</p>
                    <p className="text-emerald-600 font-bold mt-2">{sendingQueue[currentSendIndex].score} / {sendingQueue[currentSendIndex].total}</p>
                  </div>

                  <p className="text-sm text-slate-600">
                    سيتم فتح نافذة واتساب جديدة. اضغط إرسال هناك ثم عد إلى هنا للطالب التالي.
                  </p>

                  <button
                    onClick={sendNextInBatch}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={20} />
                    فتح واتساب وإرسال
                  </button>
                  
                  <button
                    onClick={() => setCurrentSendIndex(prev => prev + 1)}
                    className="w-full text-slate-500 hover:text-slate-700 py-2 text-sm font-medium"
                  >
                    تخطي هذا الطالب
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-4 py-6">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} />
                  </div>
                  <h4 className="text-xl font-bold text-slate-800">تم الانتهاء!</h4>
                  <p className="text-slate-600">تم المرور على جميع الطلاب في القائمة.</p>
                  <button
                    onClick={() => setShowBatchSendModal(false)}
                    className="mt-4 bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded-xl font-medium transition-colors"
                  >
                    إغلاق
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showGradingModal && selectedResult && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 text-amber-600 p-2 rounded-xl">
                  <Settings size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">تصحيح إجابات: {selectedResult.student_name}</h3>
                  <p className="text-xs text-slate-500">مراجعة وتعديل درجات الأسئلة المقالية</p>
                </div>
              </div>
              <button
                onClick={() => setShowGradingModal(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {quiz.questions.filter(q => q.type === 'essay').map((q, idx) => {
                const feedback = JSON.parse(selectedResult.feedback || '{}');
                const f = feedback[q.id] || {};
                const isEng = isEnglishContent(q.text, q.modelAnswer, f.studentAnswer);
                const exactCheck = checkEssayExactOrEquivalent(f.studentAnswer, q.modelAnswer, q.points || 1, isEng, q.keywords);
                const currentScore = manualGrades[q.id] ?? (f.score || 0);

                return (
                  <div key={q.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                    <div className="flex justify-between items-start gap-4">
                      <h4 className="font-bold text-slate-800 flex-1">
                        <span className="text-indigo-600 ml-2">{idx + 1}.</span>
                        {q.text}
                      </h4>
                      <div className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-500 shrink-0">
                        {q.points} درجة
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-slate-400 uppercase">إجابة الطالب:</p>
                        {exactCheck.matched && exactCheck.score >= (q.points || 1) && (
                          <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Sparkles size={12} className="text-emerald-600" />
                            إجابة مطابقة للنموذج
                          </span>
                        )}
                      </div>
                      <p className="text-slate-700 whitespace-pre-wrap font-medium">{f.studentAnswer || 'لا توجد إجابة'}</p>
                    </div>

                    <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                      <p className="text-xs font-bold text-emerald-700 uppercase mb-1">الإجابة النموذجية الصحيحة:</p>
                      <p className="text-emerald-900 text-sm whitespace-pre-wrap font-medium">{f.correctExample || q.modelAnswer || 'غير محددة'}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-500 block">الدرجة المستحقة:</label>
                          <button
                            type="button"
                            onClick={() => setManualGrades({ ...manualGrades, [q.id]: q.points || 1 })}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors"
                          >
                            منح الدرجة الكاملة ({q.points || 1})
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max={q.points}
                            step="0.25"
                            value={currentScore}
                            onChange={(e) => setManualGrades({ ...manualGrades, [q.id]: parseFloat(e.target.value) || 0 })}
                            className="w-24 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-600 outline-none text-center font-bold text-slate-800"
                          />
                          <span className="text-slate-400 text-sm">من {q.points}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 block">تقييم المصحح / الذكاء الاصطناعي:</label>
                        <div className="text-sm text-slate-600 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                          {exactCheck.matched ? exactCheck.feedback : (f.feedback || 'تم تقييم الإجابة.')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {quiz.questions.filter(q => q.type === 'essay').length === 0 && (
                <div className="text-center py-12">
                  <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Settings size={32} className="text-slate-400" />
                  </div>
                  <p className="text-slate-500">لا توجد أسئلة مقالية في هذا الاختبار.</p>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-3">
              <button
                onClick={saveManualGrading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
              >
                <Check size={20} />
                حفظ الدرجات واعتماد النتيجة
              </button>
              <button
                onClick={() => setShowGradingModal(false)}
                className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-white transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Support Button */}
      {mode !== 'take-intro' && mode !== 'take' && (
        <a
          href="https://wa.me/201223819680"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 left-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-lg hover:bg-[#128C7E] transition-all flex items-center justify-center"
        >
          <MessageCircle size={28} />
        </a>
      )}

      {/* Undo Deleted Question Toast */}
      {recentlyDeletedQuestion && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-slate-900/95 backdrop-blur text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-200" >
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-medium text-slate-200">
              تم حذف السؤال ({recentlyDeletedQuestion.question.text ? (recentlyDeletedQuestion.question.text.slice(0, 25) + '...') : `#${recentlyDeletedQuestion.index + 1}`})
            </span>
          </div>
          <button
            onClick={undoDeleteQuestion}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all shadow-md active:scale-95"
          >
            <Undo2 size={15} />
            <span>تراجع عن الحذف</span>
          </button>
          <button
            onClick={() => setRecentlyDeletedQuestion(null)}
            className="text-slate-400 hover:text-white transition-colors p-1"
            title="إغلاق"
          >
            <X size={16} />
          </button>
        </div>
      )}



      {/* Delete User Confirmation Modal (Admin) */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full text-right" >
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Trash2 className="text-red-500" size={24} />
              تأكيد حذف المستخدم والبيانات التابعة
            </h3>
            <p className="text-slate-600 mb-6 leading-relaxed text-sm">
              هل أنت متأكد من حذف حساب <span className="font-bold text-slate-800">"{userToDelete.name}"</span> نهائياً؟ 
              <br />
              <span className="text-red-600 text-xs font-bold mt-2 block bg-red-50 p-2.5 rounded-xl border border-red-100">
                ⚠️ سيتم تنفيذ حذف متكامل يشمل حساب Firebase Auth ومستند المستخدم وكافة اختباراته ونتائجه ومجلداته نهائياً.
              </span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors font-bold text-sm"
              >
                إلغاء
              </button>
              <button
                onClick={deleteUser}
                className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-bold text-sm"
              >
                تأكيد الحذف المتكامل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Technical Audit Report Modal */}
      {showTechnicalReportModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200" onClick={() => setShowTechnicalReportModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 text-right" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-amber-50/60 sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-2xs">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base sm:text-lg">التقرير الفني الشامل للنظام</h3>
                  <p className="text-xs text-slate-500 font-medium">حالة المعالجات الأمنية والتشغيلية المطبقة</p>
                </div>
              </div>
              <button 
                onClick={() => setShowTechnicalReportModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-mono bg-slate-50 border-y border-slate-200 select-text" dir="ltr">
              {TECHNICAL_REPORT_TEXT}
            </div>

            <div className="p-4 bg-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <a
                  href="/api/technical-report"
                  download="technical_report.txt"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors cursor-pointer text-center decoration-transparent"
                >
                  <Download size={16} />
                  تحميل ملف TXT
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(TECHNICAL_REPORT_TEXT);
                    setCopiedReport(true);
                    setTimeout(() => setCopiedReport(false), 2500);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {copiedReport ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                  {copiedReport ? 'تم النسخ!' : 'نسخ التقرير'}
                </button>
              </div>
              <button
                onClick={() => setShowTechnicalReportModal(false)}
                className="text-slate-500 hover:text-slate-700 text-xs sm:text-sm font-bold px-3 py-2 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Self Account Deletion Modal (Teacher Danger Zone) */}
      {showSelfDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full text-right shadow-2xl animate-in zoom-in-95 duration-200" >
            <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mb-5 text-red-600 mx-auto">
              <AlertTriangle size={28} />
            </div>
            
            <h3 className="text-xl font-bold text-slate-800 text-center mb-2">
              تأكيد حذف الحساب نهائياً
            </h3>
            <p className="text-slate-500 text-xs sm:text-sm text-center mb-6 leading-relaxed">
              هذا الإجراء نهائي ولا يمكن التراجع عنه. سيتم مسح بياناتك بصورة متكاملة فوراً.
            </p>

            <div className="bg-red-50/80 p-4 rounded-2xl border border-red-200 mb-6 space-y-2 text-xs text-red-800">
              <div className="font-bold flex items-center gap-1.5 text-red-900">
                <Trash2 size={15} />
                البيانات التي سيتم حذفها نهائياً:
              </div>
              <ul className="list-disc list-inside space-y-1 text-red-700 pr-1">
                <li>حساب الدخول والمصادقة (Firebase Auth).</li>
                <li>الملف الشخصي والإعدادات والاشتراكات.</li>
                <li>جميع الاختبارات والأسئلة والواجبات المنشأة.</li>
                <li>جميع نتائج الطلاب وإجاباتهم المسجلة.</li>
                <li>كافة المجلدات والتقسيمات الخاصة بك.</li>
              </ul>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                disabled={isDeletingSelf}
                onClick={() => setShowSelfDeleteModal(false)}
                className="flex-1 py-3 px-4 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors font-bold text-sm"
              >
                تراجع
              </button>
              <button
                type="button"
                disabled={isDeletingSelf}
                onClick={handleSelfAccountDeletion}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:bg-red-300"
              >
                {isDeletingSelf ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>جارٍ الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>نعم، احذف حسابي الآن</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Students Modal */}
      {showTeacherStudentsModal && (
        <TeacherStudentsModal
          isOpen={showTeacherStudentsModal}
          onClose={() => setShowTeacherStudentsModal(false)}
          quizzes={quizzes}
          teacherId={user?.uid}
          teacherName={user?.name || auth.currentUser?.displayName}
          teacherSubject={user?.subject}
        />
      )}

      {/* Student & Teacher Data Retention & Privacy Policy Modal */}
      {showPrivacyPolicyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200" onClick={() => setShowPrivacyPolicyModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"  onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <ShieldCheck size={22} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-800">سياسة الخصوصية وحماية بيانات الطلاب</h3>
              </div>
              <button 
                onClick={() => setShowPrivacyPolicyModal(false)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                title="إغلاق"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto text-slate-700 text-sm leading-relaxed">
              <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100 flex items-start gap-3">
                <Shield className="text-indigo-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="font-bold text-indigo-900 mb-1">التزام الأمان والخصوصية (Zero Leakage)</h4>
                  <p className="text-xs text-indigo-800 leading-relaxed">
                    نحن نلتزم بأعلى معايير حماية البيانات وسرية معلومات الطلاب والمعلمين، ونضمن عدم مشاركة أو بيع أي بيانات لأي طرف ثالث تحت أي ظرف.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                  <h5 className="font-bold text-slate-800 text-sm mb-1.5 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">1</span>
                    الغرض من جمع البيانات
                  </h5>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    تُجمع أسماء الطلاب وأرقام هواتف أولياء الأمور حصرياً لتمكين المعلم من رصد الدرجات، التحقق من عدد المحاولات، وإرسال تقارير الأداء المباشرة لولي الأمر عبر واتساب.
                  </p>
                </div>

                <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                  <h5 className="font-bold text-slate-800 text-sm mb-1.5 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">2</span>
                    مدة الاحتفاظ بالبيانات (Retention Period)
                  </h5>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    تحتفظ المنصة بالنتائج وسجلات الدرجات خلال الفصل أو العام الدراسي، ويستطيع المعلم في أي وقت تنقيح وحذف النتائج يدوياً أو تفعيل الحذف التلقائي للنتائج بعد 30، 60، أو 90 يوماً.
                  </p>
                </div>

                <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                  <h5 className="font-bold text-slate-800 text-sm mb-1.5 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">3</span>
                    حق الحذف وتجهيل الهوية (Right to Erasure)
                  </h5>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    يمتلك المعلم الأدوات الكاملة لمسح أرقام هواتف الطلاب فور انتهاء الاختبار، أو تجهيل هوية الطلاب مع الاحتفاظ بالإحصائيات العامة، أو حذف جميع السجلات بضغطة زر واحدة.
                  </p>
                </div>

                <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                  <h5 className="font-bold text-slate-800 text-sm mb-1.5 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">4</span>
                    أمان السجلات ونماذج الإجابة
                  </h5>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    لا يتم إرسال نماذج الإجابات أو الإجابات الصحيحة إلى هواتف الطلاب أثناء الامتحان، ويتم التصحيح والتحقق من الهوية على خوادم آمنة مع تشفير كافة الاتصالات ببروتوكولات TLS القياسية.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPrivacyPolicyModal(false)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors"
              >
                فهمت ذلك
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Retention & Erasure Management Modal (Teacher & Admin) */}
      {showRetentionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200" onClick={() => setShowRetentionModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"  onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <ShieldCheck size={22} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-800">إدارة الاحتفاظ بالبيانات والخصوصية</h3>
              </div>
              <button 
                onClick={() => setShowRetentionModal(false)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                title="إغلاق"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto text-right">
              {retentionSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{retentionSuccessMessage}</span>
                </div>
              )}

              {/* Policy Quick Overview */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <h4 className="font-bold text-slate-800 text-sm mb-1">سياسة الاحتفاظ ببيانات الطلاب</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  تتيح لك المنصة التحكم الكامل في بيانات الطلاب وأرقام هواتفهم، وتنفيذ عمليات الحذف والتجهيل امتثالاً لمعايير الخصوصية.
                </p>
              </div>

              {/* Action 1: Current Quiz Quick Actions */}
              {quiz?.id && (
                <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <FileText size={16} className="text-indigo-600" />
                    إجراءات الاختبار الحالي ({quiz.title || 'الاختبار الحالي'})
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => handleAnonymizeQuizResults(quiz.id)}
                      className="p-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold transition-all text-right flex flex-col gap-1"
                    >
                      <div className="flex items-center gap-1.5 text-amber-800">
                        <ShieldAlert size={15} />
                        <span>تجهيل الهوية ومسح الأرقام</span>
                      </div>
                      <span className="text-[10px] text-amber-700 font-normal">
                        مسح أرقام هواتف أولياء الأمور وتجهيل أسماء الطلاب مع الحفاظ على الدرجات.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePurgeQuizResults(quiz.id)}
                      className="p-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-900 rounded-xl text-xs font-bold transition-all text-right flex flex-col gap-1"
                    >
                      <div className="flex items-center gap-1.5 text-red-800">
                        <Trash2 size={15} />
                        <span>حذف نتائج هذا الاختبار</span>
                      </div>
                      <span className="text-[10px] text-red-700 font-normal">
                        مسح كافة نتائج وإجابات الطلاب المسجلة لهذا الاختبار نهائياً.
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Action 2: Time-based Cleanup */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <RefreshCw size={16} className="text-indigo-600" />
                  الحذف الدوري حسب فترة الاحتفاظ (Cleanup by Retention)
                </h4>
                <p className="text-xs text-slate-500">
                  حذف نتائج الطلاب القديمة تلقائياً لتفريغ المساحة وحماية خصوصية الطلاب السابقين:
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <select
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(Number(e.target.value))}
                    className="w-full sm:w-1/2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-600"
                  >
                    <option value={30}>حذف النتائج الأقدم من 30 يوماً</option>
                    <option value={60}>حذف النتائج الأقدم من 60 يوماً</option>
                    <option value={90}>حذف النتائج الأقدم من 90 يوماً (موصى به)</option>
                    <option value={180}>حذف النتائج الأقدم من 180 يوماً</option>
                    <option value={365}>حذف النتائج الأقدم من سنة كاملة</option>
                  </select>

                  <button
                    type="button"
                    disabled={isProcessingRetention}
                    onClick={handleRetentionCleanup}
                    className="w-full sm:w-1/2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:bg-indigo-300"
                  >
                    {isProcessingRetention ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>جارٍ التنظيف...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={15} />
                        <span>تطبيق الحذف الآن</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setShowRetentionModal(false);
                  setShowPrivacyPolicyModal(true);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline"
              >
                قراءة نص السياسة الكاملة
              </button>
              <button
                type="button"
                onClick={() => setShowRetentionModal(false)}
                className="px-5 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

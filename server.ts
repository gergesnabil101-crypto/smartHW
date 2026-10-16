import express from 'express';
import 'dotenv/config';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import Stripe from 'stripe';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import nodemailer from 'nodemailer';
import { initializeApp, getApps } from 'firebase-admin/app';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAppCheck } from 'firebase-admin/app-check';

// Load Firebase configuration
let firebaseConfig: any = {};
try {
  const configData = fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8');
  firebaseConfig = JSON.parse(configData);
} catch (e) {
  console.warn('Could not read firebase-applet-config.json:', e);
}

// Initialize Firebase Admin SDK
if (getApps().length === 0) {
  initializeApp({
    projectId: firebaseConfig.projectId || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0552360485',
  });
}

const defaultAdminApp = getApps()[0];
const adminAuth = getAuth(defaultAdminApp);
const adminDb = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(defaultAdminApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(defaultAdminApp);

let adminAppCheck: any = null;
try {
  adminAppCheck = getAppCheck();
} catch (e) {
  console.warn('Firebase App Check initialization warning:', e);
}

console.log('🔥 Firebase Admin SDK initialized successfully with Firestore database:', firebaseConfig.firestoreDatabaseId || '(default)');

// Safe SQLite Data Preservation & One-Time Migration to Firestore
async function preserveAndMigrateSQLite() {
  const dbPath = 'app.db';
  if (!fs.existsSync(dbPath)) return;

  try {
    const Database = (await import('better-sqlite3')).default;
    const sqliteDb = new Database(dbPath, { readonly: true });

    const archiveData: Record<string, any[]> = {};
    const tables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];

    for (const t of tables) {
      if (t.name.startsWith('sqlite_')) continue;
      try {
        const rows = sqliteDb.prepare(`SELECT * FROM ${t.name}`).all();
        archiveData[t.name] = rows;
      } catch (err) {
        console.warn(`Error reading table ${t.name}:`, err);
      }
    }

    // Save persistent JSON archive
    fs.writeFileSync('sqlite_backup_archive.json', JSON.stringify(archiveData, null, 2));
    console.log('💾 SQLite snapshot safely preserved in sqlite_backup_archive.json');

    // Safe migration to Firestore without overwriting newer data
    if (archiveData.users && archiveData.users.length > 0) {
      console.log(`Migrating ${archiveData.users.length} users from SQLite to Firestore...`);
      for (const u of archiveData.users) {
        if (!u.id) continue;
        const userRef = adminDb.collection('users').doc(u.id);
        const existing = await userRef.get();
        if (!existing.exists) {
          await userRef.set({
            email: u.email || '',
            name: u.name || '',
            phone: u.phone || '',
            subject: u.subject || '',
            grade_level: u.grade_level ? u.grade_level.split(',') : [],
            avatar_data: u.avatar_data || '',
            role: u.role || 'user',
            subscription_type: u.subscription_type || '200',
            subscription_end_date: u.subscription_end_date || null,
            subscription_status: u.role === 'admin' ? 'active' : 'trial',
            is_suspended: false,
            hasAccess: true,
            created_at: u.created_at || new Date().toISOString()
          }, { merge: true });
        }
      }
    }

    if (archiveData.folders && archiveData.folders.length > 0) {
      for (const f of archiveData.folders) {
        if (!f.id) continue;
        const folderRef = adminDb.collection('folders').doc(f.id);
        const existing = await folderRef.get();
        if (!existing.exists) {
          await folderRef.set({
            user_id: f.user_id || '',
            name: f.name || 'مجلد',
            created_at: f.created_at || new Date().toISOString()
          }, { merge: true });
        }
      }
    }

    if (archiveData.quizzes && archiveData.quizzes.length > 0) {
      for (const q of archiveData.quizzes) {
        if (!q.id) continue;
        const quizRef = adminDb.collection('quizzes').doc(q.id);
        const existing = await quizRef.get();
        if (!existing.exists) {
          await quizRef.set({
            user_id: q.user_id || '',
            folder_id: q.folder_id || null,
            title: q.title || 'اختبار',
            data: q.data || '{}',
            grade_level: q.grade_level || null,
            created_at: q.created_at || new Date().toISOString()
          }, { merge: true });
        }
      }
    }

    if (archiveData.results && archiveData.results.length > 0) {
      for (const r of archiveData.results) {
        const resultId = `res_${r.id || Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const resRef = adminDb.collection('results').doc(resultId);
        const existing = await resRef.get();
        if (!existing.exists) {
          await resRef.set({
            quiz_id: r.quiz_id || '',
            student_name: r.student_name || 'طالب',
            center_name: r.center_name || 'عام',
            parent_phone: r.parent_phone || '',
            score: Number(r.score) || 0,
            total: Number(r.total) || 1,
            feedback: r.feedback || '',
            created_at: r.created_at || new Date().toISOString()
          }, { merge: true });
        }
      }
    }

    sqliteDb.close();
    console.log('✅ SQLite migration checked and completed.');
  } catch (e) {
    console.warn('SQLite migration check notice:', e);
  }
}

// Run preservation and migration check
preserveAndMigrateSQLite().catch(err => console.error('SQLite migration error:', err));

// Email Transporter Helper
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
    // Strict TLS certificate verification is enforced by default
  });
}

async function sendEmail(to: string, subject: string, text: string) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[Email Simulation] To: ${to} | Subject: ${subject}`);
    return;
  }

  const fromUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  try {
    await transporter.sendMail({
      from: `"مصحح الواجبات الذكي" <${fromUser}>`,
      to,
      subject,
      text,
    });
    console.log(`Email successfully sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
  }
}

async function sendAdminEmail(subject: string, text: string) {
  const adminEmail = process.env.ADMIN_EMAIL || 'gergesnabil101@gmail.com';
  await sendEmail(adminEmail, subject, text);
}

// --- Gemini Security Infrastructure & Policy Enforcement ---

// 1. Telemetry & Client Initialization
function getGeminiClient(overrideKey?: string): GoogleGenAI {
  let apiKey = (overrideKey || process.env.CUSTOM_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY || '').toString();
  apiKey = apiKey.trim().replace(/^["']|["']$/g, '');
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'TODO_KEYHERE' || apiKey.includes('MY_GEMINI_API_KEY')) {
    throw new Error('لم يتم تعيين مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) أو أنه غير صالح. يرجى التأكد من إضافة مفتاح صالح في إعدادات البيئة (Settings -> Secrets) أو في إعدادات المعلم.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

function handleAiError(res: any, err: any, fallbackMessage: string = 'حدث خطأ أثناء معالجة الطلب بواسطة الذكاء الاصطناعي') {
  const errStr = (err?.message || '') + ' ' + (typeof err === 'object' ? JSON.stringify(err) : String(err));
  const isInvalidKey = errStr.includes('API_KEY_INVALID') || 
                       errStr.includes('API key not valid') || 
                       errStr.includes('INVALID_ARGUMENT') ||
                       errStr.includes('مفتاح الذكاء الاصطناعي') ||
                       errStr.includes('GEMINI_API_KEY') ||
                       err?.status === 400 || err?.statusCode === 400 || err?.error?.code === 400;

  const is429 = err?.status === 429 || err?.statusCode === 429 || errStr.includes('429') || errStr.toLowerCase().includes('quota') || errStr.toLowerCase().includes('rate limit');

  if (isInvalidKey) {
    return res.status(400).json({
      error: 'مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير صالح أو منتهي الصلاحية. يرجى التحقق من المفتاح في إعدادات المنصة (Settings -> Secrets).'
    });
  }

  if (is429) {
    res.setHeader('Retry-After', '5');
    return res.status(429).json({
      error: 'تم تجاوز حصة الاستخدام المسموح بها لمفتاح الذكاء الاصطناعي. يرجى المحاولة لاحقاً.'
    });
  }

  console.error('[AI Processing Notice]:', err?.message || err);
  return res.status(err?.status || 500).json({
    error: err?.message || fallbackMessage
  });
}

// 2. Strict Whitelist of Allowed Models & Operations
const ALLOWED_GEMINI_MODELS = new Set([
  'gemini-3.8-flash',
  'gemini-3.1-pro-preview',
  'gemini-2.5-pro',
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash-lite-image',
  'gemini-3.1-flash-image'
]);

const ALLOWED_AI_OPERATIONS = new Set([
  'generate_quiz',
  'extract_questions',
  'extract_document',
  'extract_pdf',
  'extract_text',
  'extract_image',
  'parse_document',
  'regenerate_question',
  'grade_essay',
  'generate_avatar',
  'general_generate'
]);

// 3. Concurrency Limiter & FIFO Queue
class ConcurrencyQueue {
  private maxConcurrent: number;
  private running = 0;
  private queue: Array<{
    task: () => Promise<any>;
    resolve: (val: any) => void;
    reject: (err: any) => void;
  }> = [];

  constructor(maxConcurrent = 12) {
    this.maxConcurrent = maxConcurrent;
  }

  async execute<T>(task: () => Promise<T>, timeoutMs = 180000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let isSettled = false;
      const queueItem = {
        task,
        resolve: (val: any) => {
          if (isSettled) return;
          isSettled = true;
          clearTimeout(timeoutTimer);
          resolve(val);
        },
        reject: (err: any) => {
          if (isSettled) return;
          isSettled = true;
          clearTimeout(timeoutTimer);
          reject(err);
        }
      };

      const timeoutTimer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          const idx = this.queue.indexOf(queueItem);
          if (idx !== -1) {
            this.queue.splice(idx, 1);
          }
          const timeoutErr: any = new Error('انتهت مهلة الانتظار في طابور معالجة الذكاء الاصطناعي.');
          timeoutErr.status = 503;
          reject(timeoutErr);
        }
      }, timeoutMs);

      this.queue.push(queueItem);
      this.processNext();
    });
  }

  private processNext() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) return;
    const next = this.queue.shift();
    if (!next) return;

    this.running++;
    next.task()
      .then(res => next.resolve(res))
      .catch(err => next.reject(err))
      .finally(() => {
        this.running--;
        this.processNext();
      });
  }
}

const geminiConcurrencyQueue = new ConcurrencyQueue(8);

// 4. Sensitive Data Masking & Log Sanitization (Anti-PII Protection)
function maskStudentName(name?: string): string {
  if (!name || !name.trim()) return '***';
  const trimmed = name.trim();
  if (trimmed.length <= 2) return trimmed[0] + '*';
  return trimmed[0] + '***' + trimmed[trimmed.length - 1];
}

function maskPhoneNumber(phone?: string): string {
  if (!phone || !phone.trim()) return '***';
  const clean = phone.trim().replace(/[^0-9+]/g, '');
  if (clean.length <= 4) return '****';
  return clean.substring(0, 3) + '****' + clean.substring(clean.length - 2);
}

// 5. Cloudflare Turnstile & Bot Verification
async function verifyTurnstileOrBot(token?: string, remoteIp?: string): Promise<{ success: boolean; error?: string }> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  // If not configured in environment, allow non-empty or mock tokens for development & testing
  if (!secretKey) {
    if (token && token.trim().length > 0) return { success: true };
    return { success: true };
  }

  if (!token) {
    return { success: false, error: 'رمز التحقق من الروبوت (Turnstile Token) مطلوب.' };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp) formData.append('remoteip', remoteIp);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const data: any = await response.json();
    if (data.success) {
      return { success: true };
    } else {
      return { success: false, error: 'فشل التحقق من الروبوت (Turnstile verification failed).' };
    }
  } catch (err: any) {
    console.warn('Turnstile verification network notice (graceful fallback):', err.message);
    return { success: true };
  }
}

function normalizeArabicText(str: string): string {
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
}

function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let digits = phone.toString().trim().replace(/[^0-9]/g, '');
  if (digits.length === 12 && digits.startsWith('20')) {
    digits = '0' + digits.substring(2);
  } else if (digits.length === 10 && !digits.startsWith('0')) {
    digits = '0' + digits;
  }
  return digits;
}

// 6. Signed Attempt Token Management (HMAC-SHA256 Session Protection)
const ATTEMPT_TOKEN_SECRET = process.env.ATTEMPT_TOKEN_SECRET || process.env.JWT_SECRET || 'quiz_attempt_secret_signing_key_2026';

function generateAttemptToken(quizId: string, studentKey: string, maxAttempts: number): string {
  const payload = {
    quizId,
    studentKey,
    maxAttempts,
    issuedAt: Date.now(),
    nonce: crypto.randomBytes(8).toString('hex')
  };
  const str = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', ATTEMPT_TOKEN_SECRET).update(str).digest('hex');
  return Buffer.from(str).toString('base64url') + '.' + signature;
}

function verifyAttemptToken(token: string, expectedQuizId: string): { valid: boolean; payload?: any; error?: string } {
  if (!token) return { valid: false, error: 'رمز جلسة المحاولة (Attempt Token) مفقود.' };
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false, error: 'صيغة رمز المحاولة غير صحيحة.' };
    const str = Buffer.from(parts[0], 'base64url').toString('utf-8');
    const signature = parts[1];
    const expectedSig = crypto.createHmac('sha256', ATTEMPT_TOKEN_SECRET).update(str).digest('hex');
    if (signature !== expectedSig) {
      return { valid: false, error: 'توقيع رمز المحاولة غير صالح.' };
    }
    const payload = JSON.parse(str);
    if (payload.quizId !== expectedQuizId) {
      return { valid: false, error: 'رمز المحاولة لا يطابق هذا الاختبار.' };
    }
    // Token validity window: 6 hours
    if (Date.now() - payload.issuedAt > 6 * 60 * 60 * 1000) {
      return { valid: false, error: 'انتهت صلاحية جلسة الاختبار. يرجى إعادة فتح الاختبار.' };
    }
    return { valid: true, payload };
  } catch (e: any) {
    return { valid: false, error: 'تعذر التحقق من صحة رمز المحاولة.' };
  }
}

// 7. Idempotency Manager (Duplicate and spam click prevention)
interface IdempotencyEntry {
  inFlight?: Promise<any>;
  result?: any;
  statusCode: number;
  createdAt: number;
}
const idempotencyStore = new Map<string, IdempotencyEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of idempotencyStore.entries()) {
    if (now - entry.createdAt > 10 * 60 * 1000) {
      idempotencyStore.delete(key);
    }
  }
}, 60 * 1000);

// 8. Multi-Tier Rate Limiters (IP, Quiz ID, Teacher ID, Attempt Token)
interface SlidingRateLimit {
  count: number;
  windowStart: number;
}
const ipRateLimitStore = new Map<string, SlidingRateLimit>();
const userRateLimitStore = new Map<string, SlidingRateLimit>();
const quizRateLimitStore = new Map<string, SlidingRateLimit>();
const teacherRateLimitStore = new Map<string, SlidingRateLimit>();
const attemptTokenRateLimitStore = new Map<string, SlidingRateLimit>();

function checkRateLimitMap(store: Map<string, SlidingRateLimit>, key: string, maxPerMinute: number): boolean {
  const now = Date.now();
  let record = store.get(key);
  if (!record || now - record.windowStart > 60000) {
    record = { count: 1, windowStart: now };
    store.set(key, record);
    return true;
  }
  if (record.count >= maxPerMinute) {
    return false;
  }
  record.count++;
  return true;
}

function checkIpRateLimit(ip: string, maxPerMinute = 30): boolean {
  return checkRateLimitMap(ipRateLimitStore, ip, maxPerMinute);
}

function checkUserRateLimit(uid: string, maxPerMinute: number): boolean {
  return checkRateLimitMap(userRateLimitStore, uid, maxPerMinute);
}

function checkQuizRateLimit(quizId: string, maxPerMinute = 60): boolean {
  return checkRateLimitMap(quizRateLimitStore, quizId, maxPerMinute);
}

function checkTeacherRateLimit(teacherId: string, maxPerMinute = 100): boolean {
  return checkRateLimitMap(teacherRateLimitStore, teacherId, maxPerMinute);
}

function checkAttemptTokenRateLimit(attemptToken: string, maxPerMinute = 12): boolean {
  const tokenHash = crypto.createHash('sha256').update(attemptToken).digest('hex').substring(0, 16);
  return checkRateLimitMap(attemptTokenRateLimitStore, tokenHash, maxPerMinute);
}

// 9. Teacher Active Subscription & Status Check Helper
function checkTeacherSubscriptionStatus(data: any): { allowed: boolean; error?: string; status: string } {
  if (!data) {
    return { allowed: false, error: 'حساب المعلم غير موجود.', status: 'not_found' };
  }

  // Admin bypass
  const isAdmin = data.role === 'admin' || data.isAdmin === true || (data.email && String(data.email).toLowerCase().trim() === 'gergesnabil101@gmail.com');
  if (isAdmin) {
    return { allowed: true, status: 'admin' };
  }

  // Account suspension check
  if (data.is_suspended) {
    return { allowed: false, error: 'تم إيقاف هذا الحساب مؤقتاً. يرجى مراجعة إدارة المنصة للتفعيل.', status: 'suspended' };
  }

  const now = Date.now();
  const status = data.subscription_status || 'trial';

  // Check Token System Depletion
  const subType = String(data.subscription_type || '').toLowerCase();
  const customPlanName = String(data.custom_plan_name || '').toLowerCase();
  const isTokenPlan = Boolean(
    (data.custom_tokens_millions && Number(data.custom_tokens_millions) > 0) ||
    /token|شحن|رصيد|recharge|charge|pay_as_you_go|balance/i.test(subType) ||
    /token|شحن|رصيد|توكن/i.test(customPlanName) ||
    (data.extra_tokens && Number(data.extra_tokens) > 0)
  );

  if (isTokenPlan) {
    let tokenLimit = 0;
    if (data.custom_tokens_millions && Number(data.custom_tokens_millions) > 0) {
      tokenLimit = Number(data.custom_tokens_millions) * 1000000;
    } else {
      const tokenMatch = subType.match(/token[_\s-]*(\d+(?:\.\d+)?)\s*([mMkK])?/i) ||
                         subType.match(/(?:custom[_\s-]*)?(\d+(?:\.\d+)?)\s*[mM]/i);
      if (tokenMatch) {
        const num = parseFloat(tokenMatch[1]) || 0;
        const unit = (tokenMatch[2] || 'm').toLowerCase();
        const multiplier = unit === 'k' ? 1000 : 1000000;
        tokenLimit = num * multiplier;
      }
    }
    const extraTokens = Number(data.extra_tokens) || 0;
    const totalAllowed = tokenLimit + extraTokens;
    const usedTokens = Number(data.tokens_used) || 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const renewalDateStr = (data.subscription_renewal_date || data.subscription_start_date || '').split('T')[0];
    const isRenewedToday = renewalDateStr === todayStr;

    if (!isRenewedToday && totalAllowed > 0 && usedTokens >= totalAllowed) {
      return {
        allowed: false,
        error: 'انتهى رصيد توكنز باقة المعلم بالكامل. يرجى شحن رصيد إضافي أو تجديد الباقة لتفعيل الاختبارات واستئناف الخدمة للطلاب.',
        status: 'tokens_depleted'
      };
    }
  }

  // Active paid plan check
  if (status === 'active') {
    if (data.subscription_end_date) {
      const endDate = new Date(data.subscription_end_date);
      if (!isNaN(endDate.getTime()) && endDate.getTime() < now) {
        return { allowed: false, error: 'انتهت فترة اشتراك المعلم. يرجى تجديد الاشتراك لتفعيل الاختبارات ومتابعة الاستخدام.', status: 'expired' };
      }
    }
    return { allowed: true, status: 'active' };
  }

  // Token pack / wallet balance check (if not active, check if they have active extra tokens)
  const extraTokens = Number(data.extra_tokens) || 0;
  if (extraTokens > 0) {
    return { allowed: true, status: 'active_tokens' };
  }

  // Free trial period check (Strict 5 days from created_at)
  if (status === 'trial' || !data.subscription_status) {
    let trialEndDate: Date | null = null;
    if (data.subscription_end_date) {
      trialEndDate = new Date(data.subscription_end_date);
    } else if (data.created_at) {
      const d = new Date(data.created_at);
      d.setDate(d.getDate() + 5); // 5 days free trial
      trialEndDate = d;
    }

    if (trialEndDate && !isNaN(trialEndDate.getTime()) && trialEndDate.getTime() < now) {
      return { 
        allowed: false, 
        error: 'انتهت الفترة التجريبية المجانية لهذا الحساب (5 أيام). يرجى الاشتراك في إحدى الباقات لتفعيل الاختبارات واستئناف الخدمة.', 
        status: 'trial_expired' 
      };
    }
    return { allowed: true, status: 'trial' };
  }

  return { allowed: false, error: 'حساب المعلم غير مفعل حالياً. يرجى الاشتراك أو تجديد الباقة لتفعيل الاختبارات.', status: 'inactive' };
}

// Teacher Active Subscription & Daily Quota Pre-Check Before Calling Gemini
async function verifyTeacherActiveSubscriptionAndQuota(
  teacherId: string, 
  requestedTokens = 500
): Promise<{ allowed: boolean; error?: string; remainingTokens?: number }> {
  if (!teacherId) {
    return { allowed: true, remainingTokens: 999999 };
  }

  try {
    const userDoc = await adminDb.collection('users').doc(teacherId).get();
    if (!userDoc.exists) {
      return { allowed: false, error: 'حساب المعلم غير موجود.' };
    }
    const data = userDoc.data() || {};
    
    // Check teacher status using strict rule
    const statusCheck = checkTeacherSubscriptionStatus(data);
    if (!statusCheck.allowed) {
      return { allowed: false, error: statusCheck.error };
    }

    if (statusCheck.status === 'admin') {
      return { allowed: true, remainingTokens: 999999 };
    }

    const isTrial = statusCheck.status === 'trial';

    // Check token balance & limits
    const subType = String(data.subscription_type || '').toLowerCase();
    const customPlanName = String(data.custom_plan_name || '').toLowerCase();
    const isTokenPlan = Boolean(
      (data.custom_tokens_millions && Number(data.custom_tokens_millions) > 0) ||
      /token|شحن|رصيد|recharge|charge|pay_as_you_go|balance/i.test(subType) ||
      /token|شحن|رصيد|توكن/i.test(customPlanName) ||
      (data.extra_tokens && Number(data.extra_tokens) > 0)
    );

    // If teacher is on the Token Charging / Wallet System: Freedom of usage based on charged balance
    if (isTokenPlan) {
      let tokenLimit = 0;
      if (data.custom_tokens_millions && Number(data.custom_tokens_millions) > 0) {
        tokenLimit = Number(data.custom_tokens_millions) * 1000000;
      } else {
        const tokenMatch = subType.match(/token[_\s-]*(\d+(?:\.\d+)?)\s*([mMkK])?/i) ||
                           subType.match(/(?:custom[_\s-]*)?(\d+(?:\.\d+)?)\s*[mM]/i);
        if (tokenMatch) {
          const num = parseFloat(tokenMatch[1]) || 0;
          const unit = (tokenMatch[2] || 'm').toLowerCase();
          const multiplier = unit === 'k' ? 1000 : 1000000;
          tokenLimit = num * multiplier;
        } else {
          tokenLimit = 1000000; // Default 1M for generic token/recharge plans
        }
      }
      const extraTokens = Number(data.extra_tokens) || 0;
      const totalAllowed = tokenLimit + extraTokens;
      let usedTokens = Number(data.tokens_used) || 0;

      const todayStr = new Date().toISOString().split('T')[0];
      const renewalDateStr = (data.subscription_renewal_date || data.subscription_start_date || '').split('T')[0];
      const isRenewedToday = renewalDateStr === todayStr;

      // If teacher renewed today but tokens_used still holds past historical usage from before renewal,
      // reset for the new cycle so the teacher gets their full fresh balance!
      if (isRenewedToday && usedTokens >= totalAllowed && totalAllowed > 0) {
        usedTokens = (data.last_token_reset_date === todayStr) ? Number(data.tokens_used_today || 0) : 0;
        userDoc.ref.set({
          tokens_used: usedTokens,
          last_token_reset_date: todayStr
        }, { merge: true }).catch(() => {});
      }

      if (totalAllowed > 0 && usedTokens + requestedTokens > totalAllowed) {
        return {
          allowed: false,
          error: `عذراً، لقد استنفدت رصيد باقة التوكنز بالكامل (${usedTokens.toLocaleString()} / ${totalAllowed.toLocaleString()} توكن). يرجى شحن رصيد إضافي للمتابعة.`
        };
      }

      return { allowed: true, remainingTokens: Math.max(0, totalAllowed - (usedTokens + requestedTokens)) };
    }

    // Fallback for daily quota plans or trial accounts:
    // Free trial accounts are strictly limited to 50,000 tokens daily.
    const todayStr = new Date().toISOString().split('T')[0];
    let tokensToday = data.tokens_used_today || 0;
    if (data.last_token_reset_date !== todayStr) {
      tokensToday = 0;
    }

    let maxDailyTokens = 50000; // في الفترة المجانية: 50 ألف توكنز يومياً
    if (isTrial) {
      maxDailyTokens = 50000; // 50,000 tokens daily for free trial
    } else {
      const planType = subType || '200';
      if (planType === '100' || planType === 'theory_200') maxDailyTokens = 25000;
      else if (planType === '200' || planType === 'science_250') maxDailyTokens = 50000;
      else if (planType === '500' || planType === 'unlimited' || planType === 'monthly' || planType === 'yearly' || planType === 'theory_yearly' || planType === 'science_yearly') maxDailyTokens = 150000;
      else maxDailyTokens = 50000;
    }

    const extraTokens = data.extra_tokens || 0;
    if (tokensToday + requestedTokens > maxDailyTokens && extraTokens <= 0) {
      return {
        allowed: false,
        error: isTrial
          ? `عذراً، لقد وصلت إلى الحد اليومي المسموح به في الفترة المجانية (${maxDailyTokens.toLocaleString()} توكن/يوم). يرجى الاشتراك في إحدى الباقات أو شحن توكنز أو المحاولة غداً.`
          : `تم استنفاد الحصة اليومية المخصصة للاستخدام (${maxDailyTokens.toLocaleString()} رمز/يوم). يرجى شحن رصيد توكنز أو المحاولة غداً.`
      };
    }

    return { allowed: true, remainingTokens: Math.max(0, maxDailyTokens - tokensToday) };
  } catch (err: any) {
    console.warn('Teacher subscription pre-check notice:', err.message);
    return { allowed: true };
  }
}

async function trackServerTokenUsage(uid: string, tokens: number) {
  if (!uid || tokens <= 0) return;
  try {
    const userRef = adminDb.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return;
    const userData = userDoc.data() || {};
    const todayStr = new Date().toISOString().split('T')[0];
    
    let tokensToday = userData.tokens_used_today || 0;
    const lastReset = userData.last_token_reset_date || '';
    let extraTokens = userData.extra_tokens || 0;
    
    if (lastReset !== todayStr) {
      tokensToday = 0;
    }

    const subType = (userData.subscription_type || '').toLowerCase();
    const isTrialUser = (userData.subscription_status || 'trial') === 'trial' && userData.role !== 'admin';
    const isTokenPlan = !isTrialUser && Boolean(
      userData.custom_tokens_millions ||
      subType.startsWith('token_') ||
      subType.startsWith('custom_') ||
      subType.includes('m') ||
      userData.role === 'admin'
    );

    // If teacher is on Token Charging system: directly increment tokens_used with no daily resets blocking them
    if (isTokenPlan) {
      await userRef.set({
        tokens_used: FieldValue.increment(tokens),
        tokens_used_today: tokensToday + tokens,
        last_token_reset_date: todayStr
      }, { merge: true });
      return;
    }

    let dailyLimit = 50000; // الفترة المجانية: 50 ألف توكنز يومياً
    if (isTrialUser) {
      dailyLimit = 50000;
    } else if (subType === '100' || subType === 'theory_200') dailyLimit = 25000;
    else if (subType === '200' || subType === 'science_250') dailyLimit = 50000;
    else if (subType === '500' || subType === 'unlimited' || subType === 'monthly' || subType === 'yearly' || subType === 'theory_yearly' || subType === 'science_yearly') dailyLimit = 150000;

    if (tokensToday >= dailyLimit && extraTokens > 0) {
      await userRef.set({
        tokens_used: FieldValue.increment(tokens),
        extra_tokens: Math.max(0, extraTokens - tokens),
        last_token_reset_date: todayStr
      }, { merge: true });
    } else {
      await userRef.set({
        tokens_used: FieldValue.increment(tokens),
        tokens_used_today: tokensToday + tokens,
        last_token_reset_date: todayStr
      }, { merge: true });
    }
  } catch (e: any) {
    // Silently ignore tracking errors in AI Studio sandbox due to IAM restrictions on adminDb writes
  }
}

const inMemoryQuotaStore = new Map<string, { requestsToday: number; date: string }>();

async function verifyAndTrackDailyQuota(uid: string, planId: string, isAdmin: boolean): Promise<{ allowed: boolean; remaining: number; dailyLimit: number }> {
  if (isAdmin) {
    return { allowed: true, remaining: 99999, dailyLimit: 99999 };
  }

  const p = (planId || '').toLowerCase();
  const isTokenPlan = p.startsWith('token_') || p.startsWith('custom_') || p.includes('m');

  // Teachers on charged token packages have freedom of usage without daily request bottlenecks
  if (isTokenPlan) {
    return { allowed: true, remaining: 99999, dailyLimit: 99999 };
  }

  let dailyLimit = 50; // trial/free
  if (p === '100' || p === 'theory_200') dailyLimit = 150;
  else if (p === '200' || p === 'science_250') dailyLimit = 300;
  else if (p === '500' || p === 'unlimited' || p === 'monthly' || p === 'yearly' || p === 'theory_yearly' || p === 'science_yearly') dailyLimit = 1000;

  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const userRef = adminDb.collection('users').doc(uid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() || {} : {};

    // Check if user has token package or extra tokens
    if (userData.custom_tokens_millions || (userData.extra_tokens && userData.extra_tokens > 0)) {
      return { allowed: true, remaining: 99999, dailyLimit: 99999 };
    }

    let requestsToday = userData.api_requests_today || 0;
    const lastReset = userData.last_request_reset_date || '';
    let extraTokens = userData.extra_tokens || 0;

    if (lastReset !== todayStr) {
      requestsToday = 0;
    }

    if (requestsToday >= dailyLimit) {
      if (extraTokens > 0) {
        requestsToday += 1;
        userRef.set({
          api_requests_today: requestsToday,
          last_request_reset_date: todayStr
        }, { merge: true }).catch((err: any) => console.warn('Non-blocking user quota set error:', err.message));
        return { allowed: true, remaining: 0, dailyLimit };
      } else {
        return { allowed: false, remaining: 0, dailyLimit };
      }
    }

    requestsToday += 1;
    userRef.set({
      api_requests_today: requestsToday,
      last_request_reset_date: todayStr,
    }, { merge: true }).catch((err: any) => console.warn('Non-blocking user quota set error:', err.message));

    return { allowed: true, remaining: Math.max(0, dailyLimit - requestsToday), dailyLimit };
  } catch (dbErr: any) {
    console.warn('adminDb unavailable for daily quota check (falling back to in-memory store):', dbErr.message);
    let record = inMemoryQuotaStore.get(uid);
    if (!record || record.date !== todayStr) {
      record = { requestsToday: 0, date: todayStr };
      inMemoryQuotaStore.set(uid, record);
    }
    if (record.requestsToday >= dailyLimit) {
      return { allowed: false, remaining: 0, dailyLimit };
    }
    record.requestsToday += 1;
    return { allowed: true, remaining: Math.max(0, dailyLimit - record.requestsToday), dailyLimit };
  }
}

// 10. Exponential Backoff with Jitter for 429 & 503 Handling (Strictly Max 3 retries, respects Retry-After)
async function callGeminiWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const errMessage = (err?.message || '').toLowerCase();
      const statusCode = err?.status || err?.statusCode || 0;
      const is429 = statusCode === 429 || 
                    errMessage.includes('429') || 
                    errMessage.includes('resource_exhausted') || 
                    errMessage.includes('quota') ||
                    errMessage.includes('rate limit');
      const is503 = statusCode === 503 || errMessage.includes('503') || errMessage.includes('overloaded') || errMessage.includes('unavailable');

      if ((is429 || is503) && attempt <= maxRetries) {
        // Extract Retry-After if provided
        let retryAfterMs = 0;
        const retryAfterHeader = err?.response?.headers?.get?.('retry-after') || err?.headers?.['retry-after'];
        if (retryAfterHeader) {
          const parsedSec = parseInt(retryAfterHeader, 10);
          if (!isNaN(parsedSec) && parsedSec > 0) {
            retryAfterMs = parsedSec * 1000;
          }
        }
        if (!retryAfterMs) {
          const match = errMessage.match(/retry after\s+([0-9]+)\s*s/i);
          if (match && match[1]) {
            retryAfterMs = parseInt(match[1], 10) * 1000;
          }
        }

        // Exponential backoff: 2^(attempt-1)*1000ms + random jitter (100ms..650ms)
        const jitter = Math.floor(Math.random() * 550) + 100;
        const baseDelayMs = Math.pow(2, attempt - 1) * 1000 + jitter;
        const delayMs = Math.min(10000, Math.max(retryAfterMs, baseDelayMs));

        console.warn(`[Gemini Backoff] 429/503 encountered (Attempt ${attempt}/${maxRetries}), waiting ${delayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
}

// 11. Strict Input & Payload Validation
function validateAiInput(contents: any): { valid: boolean; error?: string } {
  if (!contents) {
    return { valid: false, error: 'محتوى الطلب (contents) مطلوب.' };
  }

  if (typeof contents === 'string') {
    if (contents.length > 150000) {
      return { valid: false, error: 'حجم النص المرسل يتجاوز الحد الأقصى المسموح به (150 ألف حرف).' };
    }
    return { valid: true };
  }

  const allowedMimes = [
    'image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/x-png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'image/bmp', 'image/x-ms-bmp', 'image/tiff',
    'application/pdf',
    'text/plain', 'text/csv', 'text/html', 'text/markdown', 'application/json',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/m4a', 'audio/mpeg'
  ];

  const isMimeAllowed = (mime: string) => {
    if (!mime) return false;
    const lower = mime.toLowerCase().trim();
    if (lower.startsWith('image/')) return true;
    return allowedMimes.includes(lower);
  };

  if (Array.isArray(contents)) {
    let totalChars = 0;
    for (const item of contents) {
      if (typeof item === 'string') {
        totalChars += item.length;
      } else if (item?.parts && Array.isArray(item.parts)) {
        for (const part of item.parts) {
          if (part.text) totalChars += part.text.length;
          if (part.inlineData) {
            const mime = part.inlineData.mimeType;
            if (!isMimeAllowed(mime)) {
              return { valid: false, error: `نوع الملف غير مدعوم: ${mime}` };
            }
            if (typeof part.inlineData.data === 'string' && part.inlineData.data.length > 28 * 1024 * 1024) {
              return { valid: false, error: 'حجم الملف المرفق يتجاوز الحد الأقصى (20 ميجابايت).' };
            }
          }
        }
      }
    }
    if (totalChars > 150000) {
      return { valid: false, error: 'حجم المحتوى المرسل يتجاوز الحد الأقصى المسموح به.' };
    }
  } else if (contents.parts && Array.isArray(contents.parts)) {
    let totalChars = 0;
    for (const part of contents.parts) {
      if (part.text) totalChars += part.text.length;
      if (part.inlineData) {
        const mime = part.inlineData.mimeType;
        if (!isMimeAllowed(mime)) {
          return { valid: false, error: `نوع الملف غير مدعوم: ${mime}` };
        }
        if (typeof part.inlineData.data === 'string' && part.inlineData.data.length > 28 * 1024 * 1024) {
          return { valid: false, error: 'حجم الملف المرفق يتجاوز الحد الأقصى (20 ميجابايت).' };
        }
      }
    }
    if (totalChars > 150000) {
      return { valid: false, error: 'حجم المحتوى المرسل يتجاوز الحد الأقصى المسموح به.' };
    }
  }

  return { valid: true };
}

// Optional / Flexible Firebase User Extraction
const extractFirebaseUserOptional = async (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (token && token !== 'null' && token !== 'undefined') {
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = {
        id: decodedToken.uid,
        uid: decodedToken.uid,
        email: decodedToken.email || '',
        role: decodedToken.role || (decodedToken.admin ? 'admin' : 'user'),
        admin: decodedToken.admin === true || decodedToken.role === 'admin'
      };
    } catch (err: any) {
      console.warn('Optional token verification note:', err.message);
    }
  }
  next();
};

// Firebase App Check Middleware (Configurable Enforcement)
const verifyAppCheckOptional = async (req: any, res: any, next: any) => {
  const appCheckToken = req.headers['x-firebase-appcheck'] || req.headers['x-appcheck-token'];
  const enforceAppCheck = process.env.ENFORCE_APP_CHECK === 'true';

  if (appCheckToken && adminAppCheck) {
    try {
      const appCheckClaims = await adminAppCheck.verifyToken(appCheckToken as string);
      req.appCheckVerified = true;
      req.appCheckAppId = appCheckClaims.app_id;
    } catch (err: any) {
      console.warn('[App Check] Token verification notice:', err.message);
      if (enforceAppCheck) {
        return res.status(401).json({ error: 'رمز App Check غير صالح أو منتهي الصلاحية.' });
      }
    }
  } else if (enforceAppCheck) {
    return res.status(401).json({ error: 'مطلوب تفعيل Firebase App Check للوصول إلى هذه الخدمة.' });
  }
  next();
};


// --- Firebase ID token verification ---
// Falls back to verifying the signature locally against Google's public keys when the Admin
// verification API is unreachable. Unsigned or forged tokens are always rejected.
const FIREBASE_AUTH_PROJECT_ID = firebaseConfig.projectId || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0552360485';
const firebaseIdTokenJwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

const verifyFirebaseIdToken = async (token: string): Promise<any> => {
  try {
    return await adminAuth.verifyIdToken(token);
  } catch (adminErr: any) {
    try {
      const { payload } = await jwtVerify(token, firebaseIdTokenJwks, {
        issuer: `https://securetoken.google.com/${FIREBASE_AUTH_PROJECT_ID}`,
        audience: FIREBASE_AUTH_PROJECT_ID,
        algorithms: ['RS256']
      });
      if (!payload.sub) throw new Error('Token has no subject');
      return { ...payload, uid: payload.sub };
    } catch (localErr: any) {
      console.warn('Local ID token verification failed:', localErr?.message);
      throw adminErr;
    }
  }
};

// --- Firebase Authentication Middleware (Verified via Firebase Admin SDK) ---
const authenticateFirebaseUser = async (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: 'يرجى تسجيل الدخول للوصول إلى هذه الخدمة.' });
  }

  try {
    const decodedToken = await verifyFirebaseIdToken(token);
    const email = (decodedToken.email || '').toLowerCase().trim();
    const isAdminEmail = email === 'gergesnabil101@gmail.com';

    req.user = {
      id: decodedToken.uid,
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      role: isAdminEmail ? 'admin' : (decodedToken.role || (decodedToken.admin ? 'admin' : 'user')),
      admin: isAdminEmail || decodedToken.admin === true || decodedToken.role === 'admin'
    };

    if (isAdminEmail) {
      // Admin privileges are dynamically applied to req.user.
      // Removed direct adminDb writes as they conflict with AI Studio IAM permissions.
    }

    next();
  } catch (err: any) {
    console.warn('Firebase ID Token verification error:', err.message);
    return res.status(403).json({ error: 'جلسة العمل انتهت أو غير صالحة. يرجى تسجيل الدخول مرة أخرى.' });
  }
};

// --- Require Admin Middleware (Custom Claims with Firestore fallback) ---
const requireAdmin = async (req: any, res: any, next: any) => {
  const email = (req.user?.email || '').toLowerCase().trim();
  if (req.user && (req.user.admin || req.user.role === 'admin' || email === 'gergesnabil101@gmail.com')) {
    return next();
  }
  if (req.user?.uid) {
    try {
      const userDoc = await adminDb.collection('users').doc(req.user.uid).get();
      if (userDoc.exists && userDoc.data()?.role === 'admin') {
        req.user.admin = true;
        req.user.role = 'admin';
        return next();
      }
    } catch (err) {
      console.warn('Admin fallback check error:', err);
    }
  }
  return res.status(403).json({ error: 'غير مصرح لك. يجب أن تكون مسؤولاً.' });
};

const isScienceSubjectServer = (subjectName?: string | null, planId?: string | null): boolean => {
  const plan = planId ? String(planId).toLowerCase() : '';
  if (plan.includes('science') || plan.includes('math') || plan.includes('scientific')) return true;
  const s = (subjectName || '').toLowerCase();
  const scienceKeywords = [
    'رياضيات', 'رياضه', 'رياضة', 'ماث', 'حساب', 'جبر', 'هندسة', 'هندسه', 
    'تفاضل', 'تكامل', 'مثلثات', 'ميكانيكا', 'ديناميكا', 'استاتيكا', 
    'علوم', 'ساينس', 'فيزياء', 'فيزيا', 'كيمياء', 'كيميا', 'أحياء', 'احياء', 
    'إحصاء', 'احصاء', 'جيولوجيا', 'علمي', 'math', 'mathematics', 'science', 
    'physics', 'chemistry', 'biology', 'algebra', 'geometry', 'calculus', 'stem'
  ];
  return scienceKeywords.some(keyword => s.includes(keyword));
};

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// --- Real-time Token Usage & Live Billing Logger ---
interface ServerTokenLogRecord {
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

const inMemoryTokenLogs: ServerTokenLogRecord[] = [];
const MAX_IN_MEMORY_LOGS = 5000;
const recentServerLogSignatures = new Map<string, number>();

function cleanRecentServerLogSignatures() {
  const now = Date.now();
  for (const [sig, time] of recentServerLogSignatures.entries()) {
    if (now - time > 15000) {
      recentServerLogSignatures.delete(sig);
    }
  }
}

function logTokenUsageEvent(params: {
  userId?: string;
  userName?: string;
  userEmail?: string;
  operation: 'essay_grading' | 'doc_extraction' | 'quiz_generation' | 'image_ocr' | 'general';
  operationLabel?: string;
  model?: string;
  promptTokens: number;
  candidatesTokens: number;
  cachedTokens?: number;
  quizId?: string;
  quizTitle?: string;
  studentName?: string;
  usdToEgpRate?: number;
}) {
  const model = params.model || 'gemini-3.8-flash';
  const isPro = model.includes('pro');
  const outputMultiplier = isPro ? 6 : 5;
  const promptTokens = Math.max(0, params.promptTokens || 0);
  const candidatesTokens = Math.max(0, params.candidatesTokens || 0);
  const cachedTokens = Math.max(0, params.cachedTokens || 0);
  const totalTokens = promptTokens + (candidatesTokens * outputMultiplier);

  if (totalTokens <= 0) return;

  // Deduplication Safeguard: Prevent double logging or double deduction if triggered multiple times within 8 seconds
  cleanRecentServerLogSignatures();
  const signature = `${params.userId || params.userEmail || 'anon'}_${params.operation}_${promptTokens}_${candidatesTokens}_${params.quizId || ''}_${params.studentName || ''}`;
  const now = Date.now();
  if (recentServerLogSignatures.has(signature)) {
    const lastLogged = recentServerLogSignatures.get(signature) || 0;
    if (now - lastLogged < 8000) {
      // Duplicate event within 8s window - ignore to prevent double count
      return;
    }
  }
  recentServerLogSignatures.set(signature, now);
  
  const inRate = isPro ? 2.00 : 0.75; // Pro: $2.00 / 1M prompt, Flash: $0.75 / 1M prompt
  const outRate = isPro ? 12.00 : 1.50; // Pro: $12.00 / 1M raw output tokens, Flash: $1.50 / 1M raw output tokens
  const cachedRate = isPro ? 0.50 : 0.1875;
  const egpRate = params.usdToEgpRate || 50.0;
  
  const costUsd = (promptTokens / 1_000_000 * inRate) + 
                  (candidatesTokens / 1_000_000 * outRate) + 
                  (cachedTokens / 1_000_000 * cachedRate);
  const costEgp = costUsd * egpRate;
  const costSar = costUsd * 3.75;
  
  const opLabels: Record<string, string> = {
    essay_grading: 'تصحيح مقالي بالمعنى',
    doc_extraction: 'استخراج بنك أسئلة من مستند/PDF',
    quiz_generation: 'صياغة وتوليد اختبار ذكي',
    image_ocr: 'معالجة رموز ورسومات (OCR)',
    general: 'معالجة ذكاء اصطناعي'
  };

  const record: ServerTokenLogRecord = {
    id: `tok_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    user_id: params.userId || 'anonymous',
    user_name: params.userName || '',
    user_email: params.userEmail || '',
    operation: params.operation,
    operation_label: params.operationLabel || opLabels[params.operation] || 'استدعاء AI',
    model,
    prompt_tokens: promptTokens,
    candidates_tokens: candidatesTokens,
    cached_tokens: cachedTokens,
    total_tokens: totalTokens,
    cost_usd: costUsd,
    cost_egp: costEgp,
    cost_sar: costSar,
    quiz_id: params.quizId || '',
    quiz_title: params.quizTitle || '',
    student_name: params.studentName || ''
  };

  inMemoryTokenLogs.unshift(record);
  if (inMemoryTokenLogs.length > MAX_IN_MEMORY_LOGS) {
    inMemoryTokenLogs.pop();
  }

  // Write to Firestore securely via Admin SDK to ensure persistence across container restarts
  if (totalTokens > 0) {
    adminDb.collection('token_usage_logs').doc(record.id).set(record).catch(() => {});
  }

  if (params.userId && totalTokens > 0) {
    trackServerTokenUsage(params.userId, totalTokens).catch(() => {});
  }
}


async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Stripe webhook needs raw body - MUST be before express.json()
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).send('Stripe is not configured');
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    let event: Stripe.Event;

    try {
      if (!webhookSecret || !sig) {
        return res.status(400).send('Missing Stripe signature or webhook secret');
      }
      event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        
        if (userId) {
          const plan = session.metadata?.plan || (session.amount_total && session.amount_total > 5000 ? 'yearly' : 'monthly');
          const days = plan === 'yearly' ? 365 : 30;
          const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
          
          await adminDb.collection('users').doc(userId).set({
            subscription_end_date: endDate.toISOString(),
            subscription_type: plan,
            subscription_status: 'active',
            is_suspended: false,
            hasAccess: true
          }, { merge: true });

          console.log(`Stripe subscription activated for user ${userId}`);
        }
      }
      res.json({ received: true });
    } catch (err: any) {
      console.error('Stripe webhook error:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Basic security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Safe Env Check
  app.get('/api/check-env', (req, res) => {
    let key = process.env.CUSTOM_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY || '';
    key = key.trim().replace(/^["']|["']$/g, '');
    const isConfigured = key !== 'MY_GEMINI_API_KEY' && key !== 'TODO_KEYHERE' && key.length > 0;
    res.json({ 
      hasKey: isConfigured, 
      serverAiReady: isConfigured
    });
  });

  // Safe Config
  app.get('/api/config', (req, res) => {
    let key = process.env.CUSTOM_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY || '';
    key = key.trim().replace(/^["']|["']$/g, '');
    const isConfigured = key !== 'MY_GEMINI_API_KEY' && key !== 'TODO_KEYHERE' && key.length > 0;
    res.json({
      configured: isConfigured
    });
  });

  // --- Secure Server-Side AI Generation Endpoint ---
  const aiGenerateEndpoints = [
    '/api/ai/generate',
    '/api/ai/generate/',
    '/api/generate',
    '/api/generate/',
    '/api/ai/extract',
    '/api/ai/extract/',
    '/api/ai/extract-questions',
    '/api/ai/extract_questions',
    '/api/generate-questions',
    '/api/generate_questions',
    '/api/ai/generate-content',
    '/api/ai/generate_content'
  ];

  app.all(aiGenerateEndpoints, extractFirebaseUserOptional, verifyAppCheckOptional, async (req: any, res: any) => {
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'الطريقة غير مسموح بها (يرجى استخدام POST).' });
    }
    try {
      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
      
      // 1. IP-based Rate Limiting (30 req/min)
      if (!checkIpRateLimit(String(clientIp), 30)) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ 
          error: 'تم تجاوز الحد الأقصى للطلبات في الدقيقة من هذا العنوان. يرجى الانتظار قليلاً.',
          retryAfter: 60
        });
      }

      const { contents, config, subjectName, planId, modelOverride, operation = 'general_generate', idempotencyKey: bodyIdempotencyKey, customApiKey: bodyApiKey } = req.body;
      const idempotencyKey = (req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || bodyIdempotencyKey || '').toString().trim();
      const customApiKey = (req.headers['x-custom-api-key'] || bodyApiKey || '').toString().trim();

      // 2. Validate Operation Whitelist
      if (operation && !ALLOWED_AI_OPERATIONS.has(operation)) {
        return res.status(400).json({ error: `العملية المطلوبة (${operation}) غير مصرح بها.` });
      }

      // 3. User Authentication & Plan-based Limits
      const userId = req.user?.uid;
      const isAdmin = req.user?.admin === true || req.user?.role === 'admin';

      if (!userId) {
        // Unauthenticated access only allowed for student essay grading with strict limits
        if (operation !== 'grade_essay') {
          return res.status(401).json({ error: 'يرجى تسجيل الدخول للوصول إلى أدوات الذكاء الاصطناعي.' });
        }
        if (!checkIpRateLimit(`unauth_${clientIp}`, 10)) {
          res.setHeader('Retry-After', '60');
          return res.status(429).json({ 
            error: 'تم تجاوز حد تصحيح الأسئلة المقالية المؤقت. يرجى الانتظار دقيقة.',
            retryAfter: 60
          });
        }
      } else {
        // Authenticated user rate limit per minute based on subscription
        let userMinuteLimit = 15;
        const p = (planId || req.user.subscription_type || '').toLowerCase();
        if (isAdmin || p.startsWith('token_') || p.startsWith('custom_') || p.includes('m')) userMinuteLimit = 60;
        else if (p === '500' || p === 'unlimited' || p === 'monthly' || p === 'yearly') userMinuteLimit = 35;
        else if (p === '200') userMinuteLimit = 25;
        else if (p === '100') userMinuteLimit = 20;

        if (!checkUserRateLimit(userId, userMinuteLimit)) {
          res.setHeader('Retry-After', '30');
          return res.status(429).json({ 
            error: 'تم تجاوز عدد طلبات الذكاء الاصطناعي في الدقيقة لحسابك. يرجى الانتظار لحظات.',
            retryAfter: 30
          });
        }

        // Daily quota check and increment
        const dailyQuota = await verifyAndTrackDailyQuota(userId, p, isAdmin);
        if (!dailyQuota.allowed) {
          return res.status(429).json({ 
            error: `لقد استنفدت الحد اليومي المسموح به لخطتك (${dailyQuota.dailyLimit} طلب ذكاء اصطناعي). يرجى الترقية أو المحاولة غداً.`
          });
        }
      }

      // 4. Input Validation
      const inputValidation = validateAiInput(contents);
      if (!inputValidation.valid) {
        return res.status(400).json({ error: inputValidation.error });
      }

      // 5. Model Selection: Support Gemini 3.8 Flash (default) and Gemini Pro (gemini-3.1-pro-preview)
      let isTeacherProAccount = false;
      if (userId) {
        try {
          const uDoc = await adminDb.collection('users').doc(userId).get();
          if (uDoc.exists) {
            const uData = uDoc.data();
            isTeacherProAccount = uData?.preferred_ai_model === 'gemini_pro' ||
              uData?.preferred_ai_model === 'pro' ||
              String(uData?.subscription_type || '').includes('pro') ||
              String(uData?.custom_plan_name || '').includes('برو') ||
              String(uData?.custom_ai_engine || '').includes('pro') ||
              uData?.role === 'admin';
          }
        } catch (e) {
          // fallback
        }
      }

      let modelName = 'gemini-3.8-flash';
      if (
        isTeacherProAccount ||
        modelOverride === 'pro' || 
        modelOverride === 'gemini_pro' || 
        modelOverride === 'gemini-3.1-pro-preview' || 
        modelOverride === 'gemini-2.5-pro' ||
        String(planId || '').toLowerCase().includes('pro')
      ) {
        modelName = 'gemini-3.1-pro-preview';
      } else if (modelOverride === 'flash' || modelOverride === 'gemini-3.8-flash') {
        modelName = 'gemini-3.8-flash';
      } else if (operation === 'generate_avatar') {
        modelName = 'gemini-3.1-flash-image';
      } else if (!ALLOWED_GEMINI_MODELS.has(modelName) || modelName.includes('3.6') || modelName.includes('image')) {
        modelName = 'gemini-3.8-flash';
      }

      // 6. Idempotency Check
      if (idempotencyKey) {
        const cacheKey = `${userId || clientIp}_${idempotencyKey}`;
        const existing = idempotencyStore.get(cacheKey);
        if (existing) {
          if (existing.result) {
            res.setHeader('X-Idempotent-Replay', 'true');
            return res.status(existing.statusCode).json(existing.result);
          }
          if (existing.inFlight) {
            try {
              const inFlightResult = await existing.inFlight;
              res.setHeader('X-Idempotent-Replay', 'true');
              return res.json(inFlightResult);
            } catch (inFlightErr: any) {
              // Proceed with fresh execution if in-flight failed
            }
          }
        }
      }

      // 7. Enqueue and Execute with Exponential Backoff
      const aiExecutionTask = async () => {
        return await callGeminiWithBackoff(async () => {
          const ai = getGeminiClient(customApiKey);
          const effectiveConfig: any = { ...(config || {}) };
          if (
            operation === 'extract_questions' || 
            operation === 'generate_quiz' || 
            operation === 'extract_document' || 
            operation === 'parse_document'
          ) {
            if (!effectiveConfig.maxOutputTokens || effectiveConfig.maxOutputTokens < 8192) {
              effectiveConfig.maxOutputTokens = 8192;
            }
          }

          if (modelName === 'gemini-3.1-pro-preview' || isTeacherProAccount) {
            if (!effectiveConfig.thinkingConfig) {
              effectiveConfig.thinkingConfig = { thinkingBudget: 8192 };
            }
          }

          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents,
              config: effectiveConfig
            });
            return {
              text: response.text,
              candidates: response.candidates,
              usageMetadata: response.usageMetadata
            };
          } catch (primaryErr: any) {
            const errStr = String(primaryErr?.message || primaryErr || '');
            const isInvalidKey = errStr.includes('API_KEY_INVALID') || errStr.includes('API key not valid') || primaryErr?.status === 400;
            
            if (isInvalidKey) {
              throw new Error('مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير صالح أو منتهي الصلاحية. يرجى التحقق من المفتاح في إعدادات المنصة (Settings -> Secrets).');
            }

            console.warn(`Server AI model (${modelName}) failed, falling back to flash:`, primaryErr?.message);
            if (modelName !== 'gemini-3.8-flash') {
              const fallbackResponse = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents,
                config: effectiveConfig
              });
              return {
                text: fallbackResponse.text,
                candidates: fallbackResponse.candidates,
                usageMetadata: fallbackResponse.usageMetadata
              };
            }
            throw primaryErr;
          }
        }, 3);
      };

      const executePromise = geminiConcurrencyQueue.execute(aiExecutionTask);

      if (idempotencyKey) {
        const cacheKey = `${userId || clientIp}_${idempotencyKey}`;
        idempotencyStore.set(cacheKey, {
          inFlight: executePromise,
          statusCode: 200,
          createdAt: Date.now()
        });
      }

      const result = await executePromise;

      const pTokens = result.usageMetadata?.promptTokenCount || 0;
      const cTokens = result.usageMetadata?.candidatesTokenCount || 0;
      const isProModel = modelName.includes('pro');
      const mult = isProModel ? 6 : 5;
      const tTokens = pTokens + (cTokens * mult); // 5x for Flash, 6x for Pro
      const cachedTokens = result.usageMetadata?.cachedContentTokenCount || 0;

      if (result.usageMetadata) {
        result.usageMetadata.totalTokenCount = tTokens;
      }

      if (tTokens > 0) {
        let opCategory: any = 'general';
        if (operation === 'grade_essay') opCategory = 'essay_grading';
        else if (operation === 'extract_questions') opCategory = 'doc_extraction';
        else if (operation === 'generate_quiz') opCategory = 'quiz_generation';
        else if (operation === 'ocr_equation') opCategory = 'image_ocr';

        logTokenUsageEvent({
          userId: userId || undefined,
          userName: req.user?.name || req.user?.email || 'المعلم',
          userEmail: req.user?.email || undefined,
          operation: opCategory,
          operationLabel: operation === 'grade_essay' ? 'تصحيح مقالي بالمعنى'
            : operation === 'extract_questions' ? 'استخراج بنك أسئلة من ملف/مستند'
            : operation === 'generate_quiz' ? 'توليد اختبار ذكي'
            : operation === 'ocr_equation' ? 'معالجة رموز ومعادلات (OCR)'
            : 'عملية ذكاء اصطناعي',
          model: modelName,
          promptTokens: pTokens,
          candidatesTokens: cTokens,
          cachedTokens: cachedTokens,
          quizTitle: req.body?.quizTitle || undefined
        });
      }

      if (idempotencyKey) {
        const cacheKey = `${userId || clientIp}_${idempotencyKey}`;
        idempotencyStore.set(cacheKey, {
          result,
          statusCode: 200,
          createdAt: Date.now()
        });
      }

      return res.json({
        ...result,
        tokenUsage: {
          promptTokens: pTokens,
          candidatesTokens: cTokens,
          totalTokens: tTokens,
          cachedTokens: cachedTokens
        }
      });
    } catch (err: any) {
      return handleAiError(res, err, 'خطأ في توليد الأسئلة بواسطة الذكاء الاصطناعي');
    }
  });

  // Helper to detect if quiz content is predominantly English
  function isEnglishContent(...texts: (string | undefined | null)[]): boolean {
    const combined = texts.filter(Boolean).join(' ');
    if (!combined.trim()) return false;
    const arabicMatches = (combined.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
    const englishMatches = (combined.match(/[a-zA-Z]/g) || []).length;
    if (englishMatches > 5 && arabicMatches === 0) return true;
    return englishMatches > arabicMatches * 1.2;
  }

  function normalizeArabicTextServer(str: string): string {
    if (!str) return '';
    return str
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // Remove Arabic diacritics, Tashkeel & Tatweel
      .replace(/[إأآا]/g, 'ا') // Normalize Alef
      .replace(/ة/g, 'ه') // Normalize Ta' Marbuta
      .replace(/ى/g, 'ي') // Normalize Alef Maksura
      .replace(/[،,.;:!?؟"'\-_()]/g, ' ') // Punctuation to space
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeArabicGrammarServer(text: string): string {
    if (!text) return '';
    let s = normalizeArabicTextServer(text);

    // 1. Strip trailing reasoning/justifications after an answer (e.g. "... لأنه مفرد", "... لأنه جمع مذكر سالم")
    s = s.replace(/\s+(?:و?ذلك\s+)?(?:لانه[ا]?|لكونه[ا]?|بسبب|لعل[هة])\s+.*$/g, ' ');

    // 2. Strip leading justification prefixes (e.g. "لأنه علم مؤنث" -> "علم مؤنث", "لأنها علم مؤنث" -> "علم مؤنث")
    s = s.replace(/^(?:و?ذلك\s+)?(?:لانه[ا]?|لكونه[ا]?|بسبب|لعل[هة])\s+/g, '');

    // 3. Strip filler words (e.g. "مثلا", "ايضا", "فقط")
    s = s.replace(/(?:^|\s)(?:مثلا|ايضا|فقط)(?:$|\s)/g, ' ');

    // 4. Strip "الظاهرة", "المقدرة", "على آخره", "في آخره", "نيابة عن..."
    s = s.replace(/الظاهره(\s+علي\s+اخره)?/g, ' ');
    s = s.replace(/المقدره(\s+علي\s+اخره)?/g, ' ');
    s = s.replace(/(علي|في)?\s*اخره/g, ' ');
    s = s.replace(/نيابه\s+عن\s+[^\s]+/g, ' ');

    // 5. Strip prepositions and prepositional phrases (e.g. "بحرف الجر في", "بحرف الجر", "بـ في", "بفي")
    s = s.replace(/ب?(حرف\s+(الجر|جر))(\s+[^\s]+)?/g, ' ');
    s = s.replace(/(?:^|\s)ب(في|من|الي|عن|علي|الباء|اللام|الكاف)(?:$|\s)/g, ' ');
    s = s.replace(/(?:^|\s)بـ\s*(في|من|الي|عن|علي|الباء|اللام|الكاف)(?:$|\s)/g, ' ');
    s = s.replace(/(?:^|\s)(?:في|من|الي|عن|علي)(?:$|\s)/g, ' ');

    // 6. Standardize "الممنوع من الصرف" علل (Equivalences between المصدر and الوصف):
    // "العلمية والتأنيث" / "علمية وتأنيث" <-> "علم مؤنث"
    s = s.replace(/(?:^|\s)(?:العلميه|علميه)\s+(?:و\s*)?التانيث(?:$|\s)/g, ' علم مؤنث ');
    s = s.replace(/(?:^|\s)علم\s+مؤنث(?:\s+(?:لفظي|معنوي|لفظي\s+ومعنوي|حقيقي|مجازي))?(?:$|\s)/g, ' علم مؤنث ');

    // "العلمية والعجمة" <-> "علم أعجمي"
    s = s.replace(/(?:^|\s)(?:العلميه|علميه)\s+(?:و\s*)?العجمه(?:$|\s)/g, ' علم اعجمي ');

    // "العلمية ووزن الفعل" <-> "علم على وزن الفعل"
    s = s.replace(/(?:^|\s)(?:العلميه|علميه)\s+(?:و\s*)?وزن\s+الفعل(?:$|\s)/g, ' علم وزن الفعل ');
    s = s.replace(/(?:^|\s)علم\s+(?:علي\s+)?وزن\s+الفعل(?:$|\s)/g, ' علم وزن الفعل ');

    // "العلمية وزيادة الألف والنون" <-> "علم مزيد بالألف والنون"
    s = s.replace(/(?:^|\s)(?:العلميه|علميه)\s+(?:و\s*)?زياده\s+الالف\s+والنون(?:$|\s)/g, ' علم مزيد بالالف والنون ');
    s = s.replace(/(?:^|\s)علم\s+(?:منتهي|مختوم)\s+بالف\s+ونون(?:\s+(?:زائدتين|زائده))?(?:$|\s)/g, ' علم مزيد بالالف والنون ');

    // "العلمية والتركيب المزجي" <-> "علم مركب مزجي"
    s = s.replace(/(?:^|\s)(?:العلميه|علميه)\s+(?:و\s*)?التركيب\s+المزجي(?:$|\s)/g, ' علم مركب مزجي ');
    s = s.replace(/(?:^|\s)علم\s+مركب(?:\s+تركيبا?)?\s+مزجيا?(?:$|\s)/g, ' علم مركب مزجي ');

    // "العلمية ووزن فعل" <-> "علم على وزن فعل"
    s = s.replace(/(?:^|\s)(?:العلميه|علميه)\s+(?:و\s*)?(?:وزن\s+فعل|العدل)(?:$|\s)/g, ' علم وزن فعل ');
    s = s.replace(/(?:^|\s)علم\s+(?:علي\s+)?وزن\s+فعل(?:$|\s)/g, ' علم وزن فعل ');

    // "الوصفية ووزن أفعل" <-> "صفة على وزن أفعل"
    s = s.replace(/(?:^|\s)(?:الوصفيه|وصفيه)\s+(?:و\s*)?وزن\s+افعل(?:$|\s)/g, ' صفه وزن افعل ');
    s = s.replace(/(?:^|\s)صفه\s+(?:علي\s+)?وزن\s+افعل(?:$|\s)/g, ' صفه وزن افعل ');

    // "الوصفية ووزن فعلان" <-> "صفة على وزن فعلان"
    s = s.replace(/(?:^|\s)(?:الوصفيه|وصفيه)\s+(?:و\s*)?(?:وزن\s+فعلان|زياده\s+الالف\s+والنون)(?:$|\s)/g, ' صفه وزن فعلان ');
    s = s.replace(/(?:^|\s)صفه\s+(?:علي\s+)?وزن\s+فعلان(?:$|\s)/g, ' صفه وزن فعلان ');

    // 7. Standardize grammatical signs and markers (handling "وعلامة جره الكسرة", "الكسر", etc.)
    s = s.replace(/(و?علامه\s+(الجر|جره|اعرابه))\s+(الكسره|الكسر)/g, ' بالكسره ');
    s = s.replace(/(و?علامه\s+(الرفع|رفعه|اعرابه))\s+(الضمه|الضم)/g, ' بالضمه ');
    s = s.replace(/(و?علامه\s+(النصب|نصبه|اعرابه))\s+(الفتحه|الفتح)/g, ' بالفتحه ');
    s = s.replace(/(و?علامه\s+(الجزم|جزمه|اعرابه))\s+السكون/g, ' بالسكون ');
    s = s.replace(/(و?علامه\s+(الجر|جره|النصب|نصبه|اعرابه))\s+الياء/g, ' بالياء ');
    s = s.replace(/(و?علامه\s+(الرفع|رفعه|اعرابه))\s+الالف/g, ' بالالف ');
    s = s.replace(/(و?علامه\s+(الرفع|رفعه|اعرابه))\s+الواو/g, ' بالواو ');
    s = s.replace(/(و?علامه\s+(الرفع|رفعه|اعرابه))\s+ثبوت\s+النون/g, ' بثبوت النون ');
    s = s.replace(/(و?علامه\s+(النصب|نصبه|الجزم|جزمه|اعرابه))\s+حذف\s+النون/g, ' بحذف النون ');
    s = s.replace(/(و?علامه\s+(الجزم|جزمه|اعرابه))\s+حذف\s+حرف\s+العله/g, ' بحذف حرف العله ');

    s = s.replace(/مجرور\s+وعلامه\s+جره\s+(الكسره|الكسر)/g, 'مجرور بالكسره');
    s = s.replace(/مرفوع\s+وعلامه\s+رفعه\s+(الضمه|الضم)/g, 'مرفوع بالضمه');
    s = s.replace(/منصوب\s+وعلامه\s+نصبه\s+(الفتحه|الفتح)/g, 'منصوب بالفتحه');

    // 8. Short forms & single markers
    s = s.replace(/(?:^|\s)بالكسر(?:$|\s)/g, ' بالكسره ');
    s = s.replace(/(?:^|\s)بالضم(?:$|\s)/g, ' بالضمه ');
    s = s.replace(/(?:^|\s)بالفتح(?:$|\s)/g, ' بالفتحه ');

    // 9. Prepend "اسم " to standalone "مجرور" (e.g. "مجرور بالكسرة" -> "اسم مجرور بالكسرة")
    s = s.replace(/^(?:اسم\s+)?مجرور(\s+|$)/g, 'اسم مجرور$1');

    // 10. Standardize synonyms
    s = s.replace(/صفه\s+مجروره/g, 'نعت مجرور');
    s = s.replace(/صفه\s+مرفوعه/g, 'نعت مرفوع');
    s = s.replace(/صفه\s+منصوبه/g, 'نعت منصوب');

    return s.replace(/\s+/g, ' ').trim();
  }

  function levenshteinDistanceServer(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const d: number[][] = [];
    for (let i = 0; i <= m; i++) d[i] = [i];
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1,
          d[i][j - 1] + 1,
          d[i - 1][j - 1] + cost
        );
      }
    }
    return d[m][n];
  }

  function normalizeEquationOrTextServer(str: string): string {
    if (!str) return '';
    return str
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width spaces
      .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)') // normalize LaTeX fractions
      // LaTeX arrows with optional arguments: \xrightarrow{\Delta}, \xrightarrow[\Delta]{heat}, \xrightarrow{...}, \xrightarrow
      .replace(/\\xrightarrow(?:\[[^\]]*\])?\{[^{}]*\}/g, ' -> ')
      .replace(/\\xrightarrow\b/g, ' -> ')
      .replace(/\\(?:rightarrow|longrightarrow|to|Rightarrow|Longrightarrow|rightarrowfill)\b/g, ' -> ')
      .replace(/\\(?:uparrow|downarrow)\b/g, '')
      .replace(/\\(?:times|cdot)\b/g, '*')
      .replace(/\\div\b/g, '/')
      .replace(/\\sqrt(?:\[[^\]]*\])?\{([^{}]*)\}/g, 'sqrt($1)')
      .replace(/\\pm\b/g, 'pm')
      .replace(/\\(?:delta|Delta)\b/g, 'delta')
      .replace(/\\pi\b/g, 'pi')
      .replace(/\\theta\b/g, 'theta')
      .replace(/\\lambda\b/g, 'lambda')
      .replace(/\\text\{([^{}]*)\}/g, '$1')
      .replace(/[\$]/g, '')
      .replace(/[₀]/g, '0').replace(/[₁]/g, '1').replace(/[₂]/g, '2').replace(/[₃]/g, '3')
      .replace(/[₄]/g, '4').replace(/[₅]/g, '5').replace(/[₆]/g, '6').replace(/[₇]/g, '7')
      .replace(/[₈]/g, '8').replace(/[₉]/g, '9')
      .replace(/[⁰]/g, '0').replace(/[¹]/g, '1').replace(/[²]/g, '2').replace(/[³]/g, '3')
      .replace(/[⁴]/g, '4').replace(/[⁵]/g, '5').replace(/[⁶]/g, '6').replace(/[⁷]/g, '7')
      .replace(/[⁸]/g, '8').replace(/[⁹]/g, '9')
      .replace(/[٠]/g, '0').replace(/[١]/g, '1').replace(/[٢]/g, '2').replace(/[٣]/g, '3')
      .replace(/[٤]/g, '4').replace(/[٥]/g, '5').replace(/[٦]/g, '6').replace(/[٧]/g, '7')
      .replace(/[٨]/g, '8').replace(/[٩]/g, '9')
      .replace(/[⁺]/g, '+').replace(/[⁻]/g, '-')
      .replace(/[—–]/g, '-')
      .replace(/[٫]/g, '.')
      .replace(/[،]/g, ',')
      .replace(/[×·]/g, '*')
      .replace(/[÷]/g, '/')
      .replace(/[√]/g, 'sqrt')
      .replace(/[π]/g, 'pi')
      .replace(/[θ]/g, 'theta')
      .replace(/[λ]/g, 'lambda')
      .replace(/[Ω]/g, 'ohm')
      .replace(/[μµ]/g, 'micro')
      .replace(/[Δ]/g, 'delta')
      .replace(/(?:<[=\-—–]+>|<[=\-—–]+|[=\-—–]+>|→|⟶|↔|⇌|⇄|⇋)/g, ' -> ')
      // Normalize states of matter: (s), (l), (g), (aq), (صلب), (سائل), (غاز), (محلول), arrows ↑, ↓
      .replace(/\s*\((?:s|l|g|aq|ppt|صلب|سائل|غاز|محلول|مائي)\)/gi, '')
      .replace(/[↑↓]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function safeParseAiJsonServer(rawText: string): any {
    if (!rawText || typeof rawText !== 'string') return null;
    let text = rawText.trim();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {}

    // Strip markdown code fences (```json ... ``` or ``` ... ```)
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      return JSON.parse(text);
    } catch {}

    // Find first '{' and last '}'
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = text.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        // Clean trailing commas
        try {
          const cleaned = candidate.replace(/,\s*([\]\}])/g, '$1');
          return JSON.parse(cleaned);
        } catch {}
      }
    }

    return null;
  }

  function checkScientificObservationPartialCreditServer(
    studentText: string,
    modelText: string,
    qPoints: number,
    isEnglish: boolean
  ) {
    if (!studentText || !modelText) return null;
    const sLower = studentText.toLowerCase();
    const mLower = modelText.toLowerCase();

    // Check for gas evolution, chemical reactions observations, and indicator changes
    const observationsEn = [
      { trigger: ['hydrogen', 'h2'], keywords: ['burns', 'pop', 'ignite', 'sound', 'flame', 'evolve', 'effervescence', 'gas'], label: 'تصاعد غاز hydrogen gas واشتعاله مع pop sound' },
      { trigger: ['oxygen', 'o2'], keywords: ['glowing', 'splint', 'rekindle', 'relight', 'gas', 'evolve'], label: 'تصاعد غاز oxygen gas وازدياد توهج glowing splint' },
      { trigger: ['carbon dioxide', 'co2'], keywords: ['limewater', 'turbid', 'milky', 'effervescence', 'gas', 'fizz'], label: 'تصاعد غاز carbon dioxide وتعكير limewater' },
      { trigger: ['water', 'steam', 'moisture', 'condensation'], keywords: ['droplet', 'condense', 'tube'], label: 'ملاحظة تكثف قطرات الماء (water vapor / droplets)' },
      { trigger: ['precipitate', 'ppt'], keywords: ['white', 'blue', 'red', 'yellow', 'brown', 'black', 'form', 'deposit'], label: 'ملاحظة تكون راسب (precipitate formation)' },
      { trigger: ['color', 'turns', 'changes to'], keywords: ['blue', 'red', 'green', 'black', 'yellow', 'white', 'pink', 'colorless'], label: 'ملاحظة التغير اللوني (color change)' },
      { trigger: ['heat', 'temperature', 'exothermic'], keywords: ['release', 'produce', 'warm', 'hot', 'rise', 'vigorous'], label: 'انطلاق طاقة حرارية (heat / exothermic reaction)' }
    ];

    const observationsAr = [
      { trigger: ['هيدروجين', 'h2'], keywords: ['يشتعل', 'فرقعة', 'لهب', 'يتصاعد', 'غاز', 'فوران'], label: 'تصاعد غاز hydrogen gas واشتعاله بـ pop sound' },
      { trigger: ['أكسجين', 'o2'], keywords: ['شظية', 'توهج', 'تشتعل', 'غاز', 'يتصاعد'], label: 'تصاعد غاز oxygen gas وازدياد توهج glowing splint' },
      { trigger: ['ثاني أكسيد الكربون', 'co2'], keywords: ['ماء الجير', 'يعكر', 'تعكير', 'فوران', 'غاز'], label: 'تصاعد غاز carbon dioxide وتعكير limewater' },
      { trigger: ['راسب'], keywords: ['أبيض', 'أزرق', 'أحمر', 'أسود', 'بني', 'يتكون', 'يترسب'], label: 'تكون راسب مميز (precipitate)' },
      { trigger: ['لون', 'يتغير'], keywords: ['أزرق', 'أحمر', 'أخضر', 'أسود', 'أصفر', 'عديم', 'يزول'], label: 'ملاحظة التغير اللوني (color change)' },
      { trigger: ['حرارة', 'طارد'], keywords: ['تنطلق', 'ارتفاع', 'ساخن', 'شديد', 'تفاعل'], label: 'ملاحظة انطلاق الطاقة الحرارية (heat release)' }
    ];

    const list = isEnglish ? observationsEn : observationsAr;
    const modelHasEquation = mLower.includes('->') || mLower.includes('-->') || mLower.includes('→');

    for (const item of list) {
      const hasTrigger = item.trigger.some(t => sLower.includes(t) && mLower.includes(t));
      const hasKeyword = item.keywords.some(k => sLower.includes(k));
      if (hasTrigger && hasKeyword) {
        const partialScore = Math.max(0.25, Math.min(qPoints, Number((qPoints * 0.5).toFixed(2))));
        const deducted = Number((qPoints - partialScore).toFixed(2));
        return {
          score: partialScore,
          status: 'partial',
          feedback: isEnglish
            ? `Partial credit awarded (${partialScore}/${qPoints}): Good observation (${item.label}). Deducted (${deducted} pt) for missing complete explanation or equation.`
            : `إجابة جزئية: تم احتساب درجة جزئية (${partialScore} من ${qPoints}) لذكر ملاحظة صحيحة (${item.label}). وتم خصم (${deducted} درجة) لعدم اكتمال التفسير أو المعادلة الكيميائية.`,
          steps: [
            {
              description: item.label,
              points: partialScore,
              earned: partialScore
            },
            {
              description: isEnglish ? 'Complete explanation / equation' : 'التفسير أو المعادلة الكيميائية الكاملة المطلوبة',
              points: deducted,
              earned: 0
            }
          ]
        };
      }
    }

    // General keyword overlap: If student used significant matching keywords (length >= 4)
    const sWords = sLower.split(/[\s,.;:()\-+]+/).filter(w => w.length >= 4);
    const mWords = new Set(mLower.split(/[\s,.;:()\-+]+/).filter(w => w.length >= 4));
    const matchedWords = sWords.filter(w => mWords.has(w));

    if (matchedWords.length >= 2) {
      const partialScore = Math.max(0.5, Number((qPoints * 0.5).toFixed(2)));
      return {
        score: partialScore,
        status: 'partial',
        feedback: `إجابة جزئية صحيحة: تضمنت مفاهيم علمية مطابقة (${matchedWords.slice(0, 3).join('، ')}). راجع الإجابة النموذجية للشرح الكامل.`,
        steps: [
          {
            description: `مفاهيم علمية صحيحة تم ذكرها (${matchedWords.slice(0, 3).join(', ')})`,
            points: partialScore,
            earned: partialScore
          },
          {
            description: 'استكمال الشرح وتفاصيل الإجابة النموذجية المكتملة',
            points: Number((qPoints - partialScore).toFixed(2)),
            earned: 0
          }
        ]
      };
    }

    return null;
  }

  function tryMatchChemicalEquationServer(
    studentStr: string,
    modelStr: string,
    points: number,
    isEnglishQ: boolean
  ) {
    if (!studentStr || !modelStr) return null;
    const normS = normalizeEquationOrTextServer(studentStr);
    const normM = normalizeEquationOrTextServer(modelStr);

    const extractEqLines = (text: string): string[] => {
      return text
        .split(/\n+|;/)
        .map(l => l.trim())
        .filter(l => l.includes('->') || l.includes('=') || /^[A-Za-z0-9\(\)\s\+\*]+(?:->|=|→)[A-Za-z0-9\(\)\s\+\*]+$/.test(l));
    };

    const sEqs = extractEqLines(normS);
    const mEqs = extractEqLines(normM);

    const candidateModels = mEqs.length > 0 ? mEqs : (normM.includes('->') || normM.includes('=') ? [normM] : []);
    const candidateStudents = sEqs.length > 0 ? sEqs : (normS.includes('->') || normS.includes('=') ? [normS] : []);

    if (candidateModels.length === 0 || candidateStudents.length === 0) return null;

    for (const mEq of candidateModels) {
      const candSides = (mEq.includes('->') ? mEq.split('->') : mEq.split('=')).map(p => p.trim());
      if (candSides.length !== 2) continue;

      for (const sEq of candidateStudents) {
        let studentSides: string[] = [];
        let studentUsedEquals = false;

        if (sEq.includes('->')) {
          studentSides = sEq.split('->').map(p => p.trim());
        } else if (sEq.includes('=')) {
          studentSides = sEq.split('=').map(p => p.trim());
          studentUsedEquals = true;
        }
        if (studentSides.length !== 2) continue;

        const sortTerms = (side: string) =>
          side
            .split('+')
            .map(t => t.replace(/\s+/g, '').trim())
            .filter(Boolean)
            .sort()
            .join('+');

        const sReactants = sortTerms(studentSides[0]);
        const sProducts = sortTerms(studentSides[1]);
        const cReactants = sortTerms(candSides[0]);
        const cProducts = sortTerms(candSides[1]);

        const fixChemZero = (side: string) =>
          side
            .replace(/([A-Za-z0-9])0([A-Za-z0-9]|$)/g, '$1O$2')
            .replace(/\b0(?=[0-9])/g, 'O')
            .replace(/(?<=[(])0(?=[A-Za-z])/g, 'O');

        const sReactantsZeroFixed = sortTerms(fixChemZero(studentSides[0]));
        const sProductsZeroFixed = sortTerms(fixChemZero(studentSides[1]));

        // Exact case and coefficient match
        if (sReactants === cReactants && sProducts === cProducts) {
          if (!studentUsedEquals) {
            return {
              matched: true,
              score: points,
              isCorrect: true,
              feedback: isEnglishQ ? 'Excellent! Accurate and balanced chemical equation matching the model answer.' : 'إجابة ممتازة! معادلة كيميائية موزونة ودقيقة ومطابقة للنموذج (Balanced chemical equation).',
              steps: [{ description: isEnglishQ ? 'Balanced chemical equation' : 'معادلة كيميائية موزونة (Balanced chemical equation)', points, earned: points }]
            };
          } else {
            return {
              matched: true,
              score: points,
              isCorrect: true,
              feedback: isEnglishQ ? 'Excellent! Balanced chemical equation; (Note: Reaction arrow → is preferred over = in chemical equations).' : 'إجابة ممتازة وصحيحة بالكامل! معادلة كيميائية موزونة؛ (ملاحظة: يُفضل استخدام سهم التفاعل → بدلاً من علامة = في المعادلات الكيميائية).',
              steps: [{
                description: isEnglishQ ? 'Fully balanced chemical equation' : 'معادلة كيميائية موزونة وصحيحة بالكامل (مع التنبيه لاستخدام السهم →)',
                points,
                earned: points
              }]
            };
          }
        }

        if (sReactantsZeroFixed === cReactants && sProductsZeroFixed === cProducts) {
          return {
            matched: true,
            score: points,
            isCorrect: true,
            feedback: isEnglishQ ? "Excellent! Balanced chemical equation. (Tip: Use capital letter 'O' for oxygen instead of digit '0')." : "إجابة ممتازة! معادلة كيميائية موزونة وصحيحة. (تنبيه: يُفضل كتابة حرف O الكبير لعنصر Oxygen بدلاً من الرقم 0).",
            steps: [{ description: isEnglishQ ? 'Balanced equation' : 'معادلة كيميائية موزونة (Balanced equation)', points, earned: points }]
          };
        }

        // Case-insensitive match (minor casing slip)
        if (
          (sReactants.toLowerCase() === cReactants.toLowerCase() && sProducts.toLowerCase() === cProducts.toLowerCase()) ||
          (sReactantsZeroFixed.toLowerCase() === cReactants.toLowerCase() && sProductsZeroFixed.toLowerCase() === cProducts.toLowerCase())
        ) {
          const partialScore = points <= 1 ? 0.75 : Math.round(points * 0.75 * 100) / 100;
          const deducted = Number((points - partialScore).toFixed(2));
          return {
            matched: true,
            score: partialScore,
            isCorrect: true,
            feedback: isEnglishQ
              ? `Balanced and correct equation. Deducted (${deducted} mark) for element symbols casing (Capital Letters, e.g. Mg instead of mg).`
              : `معادلة موزونة وصحيحة. تم خصم (${deducted} درجة) فقط لمراعاة كتابة رموز العناصر بالأحرف الكبيرة (Capital Letters مثل Mg بدلاً من mg).`,
            steps: [{
              description: isEnglishQ ? 'Balanced equation (minor casing deduction)' : 'معادلة موزونة (خصم طفيف لحالة الأحرف الكبيرة)',
              points,
              earned: partialScore
            }]
          };
        }
      }
    }
    return null;
  }

  function checkSemanticEquivalenceServer(
    studentAns: string,
    modelAns: string,
    points: number,
    isEnglish: boolean
  ) {
    if (!studentAns || !modelAns) {
      return { matched: false, score: 0, isCorrect: false, feedback: '', steps: [] };
    }

    const sRaw = studentAns.toString().trim();
    const mRaw = modelAns.toString().trim();

    // Negation and contradiction detection
    const arabicNegations = ['لا', 'لم', 'لن', 'ليس', 'ليست', 'غير', 'بدون', 'دون', 'عدم'];
    const englishNegations = ['not', 'no', 'never', 'without', "didn't", "don't", "won't", "isn't", "aren't", "cannot"];

    const hasArabicNegation = (txt: string) => {
      const words = txt.split(/\s+/);
      return words.some(w => arabicNegations.includes(w.trim()));
    };
    const hasEnglishNegation = (txt: string) => {
      const words = txt.toLowerCase().split(/\s+/);
      return words.some(w => englishNegations.includes(w.trim()));
    };

    const studentHasNegation = isEnglish ? hasEnglishNegation(sRaw) : hasArabicNegation(sRaw);
    const modelHasNegation = isEnglish ? hasEnglishNegation(mRaw) : hasArabicNegation(mRaw);

    // If one has a negation and the other does not, they are likely contradictory; do not match heuristically
    if (studentHasNegation !== modelHasNegation) {
      return { matched: false, score: 0, isCorrect: false, feedback: '', steps: [] };
    }

    const arabicStopWords = new Set([
      'في', 'من', 'الي', 'إلى', 'عن', 'علي', 'على', 'مع', 'بين', 'حول', 'تحت', 'فوق',
      'هذا', 'هذه', 'ذلك', 'تلك', 'الذي', 'التي', 'الذين', 'هو', 'هي', 'هما', 'هم', 'هن',
      'انا', 'نحن', 'انت', 'انتم', 'كان', 'كانت', 'يكون', 'تكون', 'ان', 'أن', 'إن', 'بان', 'بأن',
      'قد', 'لقد', 'كل', 'جميع', 'بعض', 'غير', 'سوي', 'مثل', 'كما', 'كذلك', 'جدا', 'فقط',
      'ايضا', 'أيضا', 'تم', 'تمت', 'يتم', 'حيث', 'اذ', 'إذ', 'و', 'ف', 'ثم', 'أو', 'او'
    ]);

    const englishStopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'in', 'on', 'at',
      'to', 'for', 'with', 'by', 'about', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'from', 'up', 'down', 'of', 'off', 'over', 'under', 'again', 'then',
      'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each',
      'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
      'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', 'which',
      'that', 'who', 'whom', 'this', 'these', 'those', 'it', 'its', 'they', 'their', 'we', 'our'
    ]);

    // Strip parenthetical text & auxiliary gas test remarks from model answer to prevent penalizing unrequested details
    const stripAuxiliaryModelDetails = (text: string): string => {
      return text
        .replace(/\([^)]+\)/g, ' ') // strip optional parenthetical notes like (quicklime), (الجير الحي)
        .replace(/(?:that\s+|which\s+)?(?:turns|turned)\s+limewater\s+(?:turbid|milky|cloudy)/gi, ' ')
        .replace(/(?:which\s+|that\s+)?(?:relights|rekindles|re-lights)\s+(?:a\s+)?glowing\s+splint/gi, ' ')
        .replace(/(?:that\s+|which\s+)?(?:burns|ignites)\s+with\s+(?:a\s+)?pop\s+sound/gi, ' ')
        .replace(/causes\s+effervescence/gi, ' ')
        .replace(/(?:الذي\s+|التي\s+)?(?:يعكر|تعكر)\s+ماء\s+الجير(?:\s+الرائق)?/gi, ' ')
        .replace(/(?:الذي\s+|التي\s+)?(?:يشتعل|تشتعل)\s+بفرقعة(?:\s+مميزة)?/gi, ' ')
        .replace(/(?:الذي\s+|التي\s+)?(?:يزداد|تزيد)\s+توهج\s+(?:الشظية|عود\s+الثقاب)/gi, ' ')
        .replace(/\s+/g, ' ');
    };

    // Strip conversational wrappers & colloquial prefixes
    const cleanStudent = studentAns
      .replace(/(?:^|\s)(?:عشان|علشان|عشان\s+كده|علشان\s+كدة|بسبب|نظرا\s+(?:لان|لأن|لـ)?|لانه[ا]?|لكي|من\s+اجل|حتي|حيث\s+ان|اذ\s+ان|وذلك\s+(?:لان|بسبب)?)(?:\s+|$)/gi, ' ')
      .replace(/\s+/g, ' ');

    const cleanModel = stripAuxiliaryModelDetails(modelAns)
      .replace(/(?:^|\s)(?:عشان|علشان|عشان\s+كده|علشان\s+كدة|بسبب|نظرا\s+(?:لان|لأن|لـ)?|لانه[ا]?|لكي|من\s+اجل|حتي|حيث\s+ان|اذ\s+ان|وذلك\s+(?:لان|بسبب)?)(?:\s+|$)/gi, ' ')
      .replace(/\s+/g, ' ');

    const canonicalizeSynonyms = (text: string): string => {
      let t = normalizeArabicGrammarServer(text);
      // Chemical entities synonyms (English & Arabic)
      t = t.replace(/(?:^|\s)(?:calcium\s+carbonate|كربونات\s+الكالسيوم|caco3)(?:$|\s)/gi, ' caco3 ');
      t = t.replace(/(?:^|\s)(?:calcium\s+oxide|quicklime|اكسيد\s+الكالسيوم|الجير\s+الحي|cao)(?:$|\s)/gi, ' cao ');
      t = t.replace(/(?:^|\s)(?:carbon\s+dioxide(?:\s+gas)?|ثاني\s+اكسيد\s+الكربون|co2)(?:$|\s)/gi, ' co2 ');
      t = t.replace(/(?:^|\s)(?:copper\s+oxide|اكسيد\s+النحاس|cuo)(?:$|\s)/gi, ' cuo ');
      t = t.replace(/(?:^|\s)(?:copper\s+sulfate|كبريتات\s+النحاس|cuso4)(?:$|\s)/gi, ' cuso4 ');
      t = t.replace(/(?:^|\s)(?:copper\s+hydroxide|هيدروكسيد\s+النحاس|cu\(oh\)2)(?:$|\s)/gi, ' cuoh2 ');
      t = t.replace(/(?:^|\s)(?:water(?:\s+vapor)?|بخار\s+الماء|الماء|ماء|h2o)(?:$|\s)/gi, ' h2o ');
      t = t.replace(/(?:^|\s)(?:oxygen(?:\s+gas)?|غاز\s+الاكسجين|اكسجين|o2)(?:$|\s)/gi, ' o2 ');
      t = t.replace(/(?:^|\s)(?:hydrogen(?:\s+gas)?|غاز\s+الهيدروجين|هيدروجين|h2)(?:$|\s)/gi, ' h2 ');
      t = t.replace(/(?:^|\s)(?:magnesium\s+oxide|اكسيد\s+المغنسيوم|mgo)(?:$|\s)/gi, ' mgo ');
      t = t.replace(/(?:^|\s)(?:sodium\s+hydroxide|هيدروكسيد\s+الصوديوم|naoh)(?:$|\s)/gi, ' naoh ');
      t = t.replace(/(?:^|\s)(?:hydrochloric\s+acid|حمض\s+الهيدروكلوريك|hcl)(?:$|\s)/gi, ' hcl ');
      t = t.replace(/(?:^|\s)(?:decomposes\s+by\s+heat|thermal\s+decomposition|ينحل\s+بالحرارة|انحلال\s+حراري|يتفكك\s+بالحرارة|decomposes)(?:$|\s)/gi, ' انحلال_حراري ');

      // Synonyms for increase / rise / elevate / accelerate
      t = t.replace(/(?:^|\s)(?:يزداد|يرتفع|يكبر|يعلو|زياده|ارتفاع|صعود|تزايد|علو|يتسارع|تسارع|تضخم|مضاعفة|يتضاعف)(?:$|\s)/g, ' زيادة ');
      // Synonyms for decrease / drop / decline / decelerate
      t = t.replace(/(?:^|\s)(?:يقل|ينخفض|ينقص|يتناقص|هبوط|انخفاض|نقصان|تقليل|خفض|نقص|تباطؤ|يتباطأ|تثبيط|يقلل)(?:$|\s)/g, ' نقص ');
      // Synonyms for produce / form / secrete / emit / release / precipitate
      t = t.replace(/(?:^|\s)(?:يتكون|ينتج|يظهر|يحدث|يترسب|يفرز|انتاج|تكوين|افراز|خروج|ينبعث|يتصاعد|توليد|يتولد|تكون|راسب|انبعاث)(?:$|\s)/g, ' تكون ');
      // Synonyms for cause / help / lead to / function / role
      t = t.replace(/(?:^|\s)(?:يعمل\s+علي|يساعد\s+علي|يؤدي\s+الي|يتسبب\s+في|يسهم\s+في|يقوم\s+ب|وظيفته|اهميته|دوره|مسؤول\s+عن|مسئول\s+عن)(?:$|\s)/g, ' سبب ');
      // Synonyms for protect / maintain / preserve
      t = t.replace(/(?:^|\s)(?:يحمي|يقي|يحافظ\s+علي|حمايه|وقايه|حفظ|ابقاء|صيانة)(?:$|\s)/g, ' حماية ');
      // Synonyms for speed / fast / immediate
      t = t.replace(/(?:^|\s)(?:سريع|فوري|لحظي|بسرعه|فورا|مباشر|مباشرة)(?:$|\s)/g, ' سرعة ');
      // Synonyms for water / aqueous
      t = t.replace(/(?:^|\s)(?:الميه|المياه|الماء|ماء|مائي|محلول\s+مائي)(?:$|\s)/g, ' ماء ');
      // Synonyms for blood / bloodstream / vessels
      t = t.replace(/(?:^|\s)(?:مجرى\s+الدم|الدم|دم|وعاء\s+دموي|اوعية\s+دموية)(?:$|\s)/g, ' دم ');
      // Synonyms for sugar / glucose
      t = t.replace(/(?:^|\s)(?:سكر|جلوكوز|السكر|سكر\s+الدم)(?:$|\s)/g, ' سكر ');
      // Synonyms for heat / thermal / heating
      t = t.replace(/(?:^|\s)(?:حراره|تسخين|طاقه\s+حراريه|سخونه|حراري|انحلال\s+حراري)(?:$|\s)/g, ' حرارة ');
      // Synonyms for electricity / current / electric
      t = t.replace(/(?:^|\s)(?:كهرباء|تيار\s+كهربي|طاقة\s+كهربائية|كهربي|كهربائي)(?:$|\s)/g, ' كهرباء ');
      // Synonyms for reaction / chemical transformation
      t = t.replace(/(?:^|\s)(?:تفاعل|تحول\s+كيميائي|تغير\s+كيميائي)(?:$|\s)/g, ' تفاعل ');
      // Synonyms for catalyst / enzyme
      t = t.replace(/(?:^|\s)(?:عامل\s+حفاز|عامل\s+مساعد|انزيم|خميرة|محفز)(?:$|\s)/g, ' حفاز ');
      // Synonyms for acid / acidic
      t = t.replace(/(?:^|\s)(?:حمض|حمضي|حمضية|اقل\s+من\s+7)(?:$|\s)/g, ' حمض ');
      // Synonyms for base / alkaline
      t = t.replace(/(?:^|\s)(?:قلوي|قاعدي|قاعدة|قلوية|اكبر\s+من\s+7)(?:$|\s)/g, ' قلوي ');
      // Synonyms for neutral / neutralization
      t = t.replace(/(?:^|\s)(?:متعادل|تعادل|تفاعل\s+تعادل|يساوي\s+7)(?:$|\s)/g, ' تعادل ');
      // Synonyms for oxidation / loss of electrons
      t = t.replace(/(?:^|\s)(?:اكسدة|تاكسد|فقد\s+الكترونات)(?:$|\s)/g, ' اكسدة ');
      // Synonyms for reduction / gain of electrons
      t = t.replace(/(?:^|\s)(?:اختزال|اكتساب\s+الكترونات)(?:$|\s)/g, ' اختزال ');
      // Synonyms for photosynthesis
      t = t.replace(/(?:^|\s)(?:بناء\s+ضوئي|تمثيل\s+ضوئي)(?:$|\s)/g, ' بناء ضوئي ');
      // Synonyms for cell division
      t = t.replace(/(?:^|\s)(?:انقسام\s+خلوي|انقسام\s+ميتوزي|انقسام\s+ميوزي|انشطار)(?:$|\s)/g, ' انقسام ');
      return t;
    };

    const normS = isEnglish ? canonicalizeSynonyms(cleanStudent.toLowerCase()) : canonicalizeSynonyms(cleanStudent);
    const normM = isEnglish ? canonicalizeSynonyms(cleanModel.toLowerCase()) : canonicalizeSynonyms(cleanModel);

    // Stemming helper for Arabic
    const stemArabicWord = (w: string): string => {
      let word = normalizeArabicGrammarServer(w);
      if (word.startsWith('ال') && word.length >= 5) {
        word = word.slice(2);
      }
      if (word.length >= 5 && /^[وفبلك]/.test(word)) {
        word = word.slice(1);
      }
      if (word.length >= 5) {
        word = word.replace(/(?:ها|هم|هن|نا|كم|ات|ون|ين|ية|يه)$/, '');
      }
      return word;
    };

    const extractTokens = (t: string): string[] => {
      const rawTokens = t.split(/[\s,.;:!؟?()\[\]{}"'\-_/]+/).filter(w => w.length >= (isEnglish ? 3 : 2));
      const stopWords = isEnglish ? englishStopWords : arabicStopWords;
      return rawTokens
        .map(w => {
          let word = w;
          if (!isEnglish) {
            word = stemArabicWord(word);
          }
          return word;
        })
        .filter(w => w.length >= (isEnglish ? 3 : 2) && !stopWords.has(w));
    };

    const sTokens = extractTokens(normS);
    const mTokens = extractTokens(normM);

    if (mTokens.length === 0 || sTokens.length === 0) {
      return { matched: false, score: 0, isCorrect: false, feedback: '', steps: [] };
    }

    const sTokenSet = new Set(sTokens);
    // Exact token match or root equality - do NOT do loose substring matching on short words
    const matchedTokens = mTokens.filter(t => sTokenSet.has(t) || sTokens.some(st => (st.length >= 4 && t.length >= 4 && (st.startsWith(t) || t.startsWith(st)))));
    const uniqueModelTokens = Array.from(new Set(mTokens));
    const uniqueMatchedTokens = Array.from(new Set(matchedTokens));

    const coverageRatio = uniqueMatchedTokens.length / uniqueModelTokens.length;

    // Strict Rule 1: FULL CREDIT only if student covers 85% or more of core concepts AND answer has substantive content
    if (coverageRatio >= 0.85 && sTokens.length >= Math.min(uniqueModelTokens.length, 3)) {
      return {
        matched: true,
        score: points,
        isCorrect: true,
        feedback: isEnglish
          ? 'Excellent! Comprehensive correct answer expressing the required concept in your own style.'
          : 'إجابة ممتازة ومكتملة وصحيحة بالمعنى والمفهوم المطلوب، معبراً عنها بأسلوبك الخاص.',
        steps: [{
          description: isEnglish ? 'Full conceptual and semantic accuracy' : 'صحة واكتمال الإجابة بالمعنى والمفهوم المطلوب',
          points,
          earned: points
        }]
      };
    }

    // Strict Rule 2: INCOMPLETE ANSWER (Partial credit: 50% to 84% coverage) - NEVER give full credit!
    if (coverageRatio >= 0.50 && uniqueMatchedTokens.length >= 2) {
      const partialScore = Math.max(0.25, Math.round(points * coverageRatio * 100) / 100);
      return {
        matched: true,
        score: partialScore,
        isCorrect: false, // Incomplete answers are NOT marked as fully correct
        feedback: isEnglish
          ? `Incomplete answer: Partial credit awarded (${partialScore}/${points}) for mentioning part of the concept (${uniqueMatchedTokens.slice(0, 3).join(', ')}). The remaining required details are missing.`
          : `إجابة غير مكتملة: تم احتساب درجة جزئية (${partialScore} من ${points}) لذكر جزء من المفهوم المطلوب (${uniqueMatchedTokens.slice(0, 3).join('، ')}). وباقي جوانب الإجابة ناقصة.`,
        steps: [
          {
            description: isEnglish ? 'Correct concepts mentioned' : `مفاهيم صحيحة تم ذكرها (${uniqueMatchedTokens.slice(0, 3).join('، ')})`,
            points: partialScore,
            earned: partialScore
          },
          {
            description: isEnglish ? 'Missing concepts / details' : 'الأجزاء الناقصة وغير المستوفاة من المطلوب',
            points: Number((points - partialScore).toFixed(2)),
            earned: 0
          }
        ]
      };
    }

    // Low coverage (< 50%): Answer is incomplete or off-target; do NOT match heuristically
    return { matched: false, score: 0, isCorrect: false, feedback: '', steps: [] };
  }

  function checkEssayExactOrEquivalentServer(
    studentAns: string | undefined | null,
    modelAns: string | undefined | null,
    qPoints: number = 1,
    isEnglishQ: boolean = false,
    keywords?: string[]
  ) {
    const points = Math.max(1, Number(qPoints) || 1);
    if (!studentAns || !studentAns.toString().trim()) {
      return {
        matched: false,
        score: 0,
        isCorrect: false,
        feedback: isEnglishQ ? 'No answer was provided.' : 'لم يتم تقديم إجابة.',
        steps: []
      };
    }

    const rawStudent = studentAns.toString().trim();
    const rawModel = (modelAns || '').toString().trim();

    // Keyword-based automatic grading
    if (keywords && Array.isArray(keywords) && keywords.length > 0) {
      const normStudentForKw = normalizeArabicTextServer(rawStudent).toLowerCase();
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const matchedKeyword = keywords.find(kw => {
        const cleanKw = normalizeArabicTextServer(kw).toLowerCase().trim();
        if (!cleanKw) return false;
        if (cleanKw.length <= 3) {
          const regex = new RegExp(`\\b${escapeRegExp(cleanKw)}\\b|\\s${escapeRegExp(cleanKw)}\\s|^${escapeRegExp(cleanKw)}$|^${escapeRegExp(cleanKw)}\\s|\\s${escapeRegExp(cleanKw)}$`, 'i');
          return regex.test(normStudentForKw) || normStudentForKw.includes(cleanKw);
        }
        return normStudentForKw.includes(cleanKw);
      });

      if (matchedKeyword) {
        return {
          matched: true,
          score: points,
          isCorrect: true,
          feedback: isEnglishQ
            ? `Excellent! Correct answer verified by keyword match: "${matchedKeyword}".`
            : `إجابة صحيحة وممتازة تحتوي على الكلمة المفتاحية المعتمدة: "${matchedKeyword}".`,
          steps: [{
            description: isEnglishQ
              ? `Keyword match: "${matchedKeyword}"`
              : `مطابقة الكلمة المفتاحية: "${matchedKeyword}"`,
            points,
            earned: points
          }]
        };
      }
    }

    if (!rawModel) {
      return { matched: false, score: 0, isCorrect: false, feedback: '', steps: [] };
    }

    // 0. Try chemical equation matching first across lines/sub-parts
    const chemEqMatch = tryMatchChemicalEquationServer(rawStudent, rawModel, points, isEnglishQ);
    if (chemEqMatch && chemEqMatch.matched) {
      return chemEqMatch;
    }

    const rawNormStudent = normalizeEquationOrTextServer(rawStudent);
    const normStudent = rawNormStudent.toLowerCase();
    const cleanStudentNoSpaces = normStudent.replace(/\s+/g, '');

    // Extract all acceptable variations from the model answer (ONLY explicit OR alternatives)
    const rawCandidates = rawModel
      .split(/\s+(?:or|OR|أو|\|)\s+/i)
      .map(c => c.trim())
      .filter(Boolean);

    const candidateOptions: string[] = [];
    for (const rc of rawCandidates) {
      candidateOptions.push(rc);
      // Extract inside parentheses if present e.g. "Oxygen gas (O2)" -> "O2" and "Oxygen gas"
      if (!rc.includes('\n') && !rc.includes(',') && !rc.includes('،')) {
        const parenMatches = rc.match(/\(([^)]+)\)/g);
        if (parenMatches) {
          parenMatches.forEach(pm => {
            const inner = pm.replace(/[()]/g, '').trim();
            if (inner && inner.length >= 2) candidateOptions.push(inner);
          });
          const withoutParen = rc.replace(/\([^)]+\)/g, '').trim();
          if (withoutParen && withoutParen.length >= 2) candidateOptions.push(withoutParen);
        }
      }
    }
    if (candidateOptions.length === 0) {
      candidateOptions.push(rawModel);
    }

    for (const cand of candidateOptions) {
      const rawNormCand = normalizeEquationOrTextServer(cand);
      const normCand = rawNormCand.toLowerCase();
      const cleanCandNoSpaces = normCand.replace(/\s+/g, '');

      // 1. Exact string match - with or without spaces, casing, quotes, or outer punctuation
      const stripPunct = (s: string) => s.replace(/["'“”‘’`.,;:!؟?()\[\]{}]/g, '').trim();
      const sNoPunct = stripPunct(normStudent);
      const cNoPunct = stripPunct(normCand);
      const sCleanNoPunct = stripPunct(cleanStudentNoSpaces);
      const cCleanNoPunct = stripPunct(cleanCandNoSpaces);

      const isMatchWithoutCase =
        normStudent === normCand ||
        cleanStudentNoSpaces === cleanCandNoSpaces ||
        (sNoPunct.length > 0 && sNoPunct === cNoPunct) ||
        (sCleanNoPunct.length > 0 && sCleanNoPunct === cCleanNoPunct);

      if (isMatchWithoutCase) {
        // Check if candidate is specifically a chemical symbol or formula (like O2, CO2, H2O, Fe, NaCl, Mg, etc.)
        const rawCandStripped = stripPunct(rawNormCand).replace(/\s+/g, '');
        const rawStudentStripped = stripPunct(rawNormStudent).replace(/\s+/g, '');
        
        const isSingleWordCandidate = !cand.trim().includes(' ') && !rawNormCand.trim().includes(' ');
        const isOrdinaryEnglishWord = /^(oxygen|hydrogen|nitrogen|carbon|copper|iron|magnesium|calcium|sodium|potassium|silver|gold|water|helium|chlorine|sulfur|phosphorus|acid|gas|oxide|carbonate|chloride|sulfate|nitrate|hydroxide|true|false|yes|no|all|none)$/i.test(rawCandStripped);

        const isChemFormulaOrSymbol =
          isSingleWordCandidate &&
          !isOrdinaryEnglishWord &&
          (
            // Formulas with numbers/subscripts (e.g., O2, O₂, CO2, H2O, Fe3O4, Ca(OH)2, H2SO4)
            /[0-9₀-₉]/.test(rawCandStripped) ||
            // Short element symbols (1 to 3 chars starting with capital letter, e.g. Mg, Fe, Cu, Na, Cl, Al, O, H, N, C, S, P, K, Ca, Ba, Ag, Au, Pb, Zn, Hg, Li, Br, I)
            /^[A-Z][a-z]?$/.test(rawCandStripped) ||
            // Multi-element compound symbols without spaces (e.g. NaCl, NaOH, HCl, MgO, HgO, CaCO3, CuSO4)
            (/^[A-Z][a-z]?(?:[A-Z][a-z]?[0-9₀-₉]*)+$/.test(rawCandStripped) && rawCandStripped.length <= 12)
          );

        // If it's a chemical formula/symbol and student missed capital letters (e.g. o2 vs O2, fe vs Fe, co2 vs CO2):
        if (isChemFormulaOrSymbol && rawStudentStripped !== rawCandStripped && rawStudentStripped.toLowerCase() === rawCandStripped.toLowerCase()) {
          const partialScore = points <= 1 ? 0.75 : Math.round(points * 0.75 * 100) / 100;
          const deducted = Number((points - partialScore).toFixed(2));
          return {
            matched: true,
            score: partialScore,
            isCorrect: true,
            feedback: isEnglishQ
              ? `Correct scientific concept! Deducted (${deducted} mark) for not capitalizing chemical element symbols (e.g., ${rawCandStripped} instead of ${rawStudentStripped}).`
              : `إجابة علمية صحيحة بالمعنى والمفهوم. تم خصم (${deducted} درجة) فقط لمراعاة كتابة رموز العناصر الكيميائية بالأحرف الكبيرة (Capital Letters مثل ${rawCandStripped} بدلاً من ${rawStudentStripped}).`,
            steps: [{
              description: isEnglishQ ? 'Correct chemical symbol (minor casing deduction)' : 'رمز كيميائي صحيح (خصم طفيف لعدم استخدام الأحرف الكبيرة Capital Letters)',
              points,
              earned: partialScore
            }]
          };
        }

        return {
          matched: true,
          score: points,
          isCorrect: true,
          feedback: isEnglishQ ? 'Excellent! Exact correct answer matching the official model answer.' : 'إجابة ممتازة ودقيقة مطابقة تماماً للإجابة النموذجية المعتمدة.',
          steps: [{ description: isEnglishQ ? 'Model answer match' : 'مطابقة الإجابة النموذجية (Model answer match)', points, earned: points }]
        };
      }

      // Check if only math operators/symbols differ (e.g. student wrote 5+2 instead of 5-2)
      // Only applies if the strings were NOT identical and contain actual mathematical/chemical symbols
      const sWithoutSymbols = cleanStudentNoSpaces.replace(/[-+*=:/→⟶]/g, '');
      const cWithoutSymbols = cleanCandNoSpaces.replace(/[-+*=:/→⟶]/g, '');
      const hasMathSymbol = /[-+*=:/→⟶]/.test(cleanStudentNoSpaces) || /[-+*=:/→⟶]/.test(cleanCandNoSpaces);
      if (hasMathSymbol && sWithoutSymbols.length >= 3 && sWithoutSymbols === cWithoutSymbols && cleanStudentNoSpaces !== cleanCandNoSpaces) {
        const partialScore = points <= 1 ? 0.75 : Math.round(points * 0.75 * 100) / 100;
        const deducted = Number((points - partialScore).toFixed(2));
        return {
          matched: true,
          score: partialScore,
          isCorrect: true,
          feedback: `إجابة صحيحة ومطابقة! تم خصم (${deducted} درجة) فقط لوجود خطأ في علامة أو رمز (Sign / Symbol).`,
          steps: [{
            description: 'خطأ طفيف في علامة أو رمز (Sign / Symbol)',
            points,
            earned: partialScore
          }]
        };
      }

      // 2. Mathematical & Numerical equality (Fractions, decimals, percentages, numbers)
      const parseFractionOrNumber = (val: string): number | null => {
        const clean = val.trim().replace(/,/g, '.').replace(/%/g, '');
        if (/^-?\d+(\.\d+)?$/.test(clean)) return parseFloat(clean);
        const fracMatch = clean.match(/^(-?\d+(\.\d+)?)\s*\/\s*(\d+(\.\d+)?)$/);
        if (fracMatch) {
          const denom = parseFloat(fracMatch[3]);
          if (denom !== 0) return parseFloat(fracMatch[1]) / denom;
        }
        return null;
      };

      const sNum = parseFractionOrNumber(normStudent);
      const cNum = parseFractionOrNumber(normCand);
      if (sNum !== null && cNum !== null && Math.abs(sNum - cNum) < 0.00001) {
        return {
          matched: true,
          score: points,
          isCorrect: true,
          feedback: 'إجابة رياضية صحيحة ودقيقة (Correct numerical value).',
          steps: [{ description: 'قيمة عددية صحيحة', points, earned: points }]
        };
      }

      // 3. Arabic normalized match (handling Alef variations, Ta Marbuta, Tashkeel)
      const arStudent = normalizeArabicTextServer(rawStudent);
      const arCand = normalizeArabicTextServer(cand);
      if (arStudent && arCand && arStudent === arCand) {
        return {
          matched: true,
          score: points,
          isCorrect: true,
          feedback: 'إجابة ممتازة ودقيقة مطابقة تماماً للإجابة النموذجية المعتمدة.',
          steps: [{ description: 'مطابقة الإجابة النموذجية', points, earned: points }]
        };
      }

      // 3.5. Arabic Grammar & I'rab Equivalence (e.g. "اسم مجرور وعلامة جره الكسرة" vs "اسم مجرور بحرف الجر (في) وعلامة جره الكسرة الظاهرة لأنه مفرد", or "لأنها علم مؤنث" vs "العلمية والتأنيث")
      const gramStudent = normalizeArabicGrammarServer(rawStudent);
      const gramCand = normalizeArabicGrammarServer(cand);
      if (gramStudent && gramCand && gramStudent.length >= 4 && gramCand.length >= 4) {
        if (gramStudent === gramCand) {
          return {
            matched: true,
            score: points,
            isCorrect: true,
            feedback: 'إجابة لغوية ونحوية ممتازة وصحيحة 100% ومطابقة للمطلوب.',
            steps: [{ description: 'إجابة صحيحة ومطابقة للنموذج (نحو وصرف وإعراب)', points, earned: points }]
          };
        }
      }

      // 4. Minor Typo Tolerance (ONLY for descriptive words/sentences - NEVER for equations, formulas, or numbers)
      const hasScientificOrNumbers = /[->=+\\^_{}\$\*\/]|\d|[a-zA-Z]/.test(rawStudent) || /[->=+\\^_{}\$\*\/]|\d|[a-zA-Z]/.test(cand);
      if (!hasScientificOrNumbers && arStudent && arCand) {
        const dist = levenshteinDistanceServer(arStudent, arCand);
        if ((arCand.length >= 4 && dist === 1) || (arCand.length >= 10 && dist <= 2)) {
          return {
            matched: true,
            score: points,
            isCorrect: true,
            feedback: 'إجابة صحيحة ومطابقة علمياً مع التجاوز عن خطأ إملائي طفيف في حرف واحد.',
            steps: [{ description: 'إجابة صحيحة مع تجاوز خطأ حرف', points, earned: points }]
          };
        }
      }
    }

    return { matched: false, score: 0, isCorrect: false, feedback: '', steps: [] };
  }

  function buildGradingPromptServer(params: {
    isEnglish: boolean;
    isMathOrScience: boolean;
    question: string;
    totalPoints: number;
    reqPoints: number | null;
    modelAnswer: string;
    studentAnswer: string;
    subject?: string;
    isPro?: boolean;
  }): string {
    const { isEnglish, isMathOrScience, question, totalPoints: qPoints, reqPoints, modelAnswer, studentAnswer, subject, isPro } = params;

    const proDirective = isPro ? `
🧠 [GEMINI 3.1 PRO ULTRA DEEP REASONING & SEMANTIC GRADING MODE - نموذج برو 3.1 للتفكير العميق والتصحيح بالمعنى]:
- You are operating under the Flagship Gemini 3.1 Pro Preview model with active High Thinking Level (Deep Thinking Mode).
- CORE DIRECTIVE 1: SEMANTIC & MEANING-BASED GRADING (التصحيح بالمعنى والمفهوم):
  * Evaluate the student's answer strictly by its semantic meaning, scientific understanding, and pedagogical core — NOT by memorization or identical wording to the model answer.
  * If the student conveys the required concept, phenomenon, reason, or solution in their own words, style, or synonyms: AWARD FULL 100% MARKS with ZERO deduction!
- CORE DIRECTIVE 2: DEEP THINKING REASONING (التفكير العميق والتحليل الفاحص):
  * Apply deep logical reasoning to understand the student's train of thought, trace intermediate deductions, and recognize implicit correct comprehension.
- CORE DIRECTIVE 3: MANDATORY PARTIAL CREDIT & PROPORTIONAL DEDUCTION (احتساب جزء من الدرجة وخصم جزء بقدر الخطأ/النقص):
  * IF THE STUDENT ANSWERS PART OF THE QUESTION/ANSWER (e.g. provides one step of a multi-step solution, half the explanation, mentions one required item out of two, or states a correct observation without full justification):
    -> YOU MUST AWARD PARTIAL MARKS for the correct part of the answer!
    -> YOU MUST DEDUCT ONLY FOR THE MISSING OR INCORRECT PART!
    -> NEVER award zero (0) if the student gave a partially correct, valid, or meaningful answer!
    -> Detail each step in the 'steps' array showing points earned for correct parts and deductions for incomplete parts.
` : '';

    const proDirectiveAr = isPro ? `
🧠 [نموذج برو 3.1 - محرك التفكير العميق والتصحيح بالمعنى واحتساب الدرجة الجزئية (Gemini 3.1 Pro Ultra Deep Thinking & Semantic Grading)]:
- أنت تعمل الآن بنموذج برو 3.1 الرائد (Gemini 3.1 Pro Preview) المخصص للتعامل مع الأسئلة المقالية بأعلى درجات التفكير العميق والعدالة التربوية.
- التوجيهات الحاكمة الملزمة لنموذج برو 3.1:

  1. التصحيح بالمعنى والمفهوم وجوهر الفكرة (Semantic & Conceptual Grading):
     - التصحيح قائم كلياً على فهم المعنى والمضمون العلمي أو اللغوي المستفاد من إجابة الطالب، وليس على الحفظ الحرفي الصم لألفاظ النموذج.
     - إذا فهم الطالب الفكرة أو المبدأ أو الظاهرة وعبر عنها بأسلوبه الخاص، أو بكلمات ومرادفات أخرى، أو بصياغة مبسطة، أو بالعامية المهذبة الدالة على استيعاب المفهوم:
       -> تُعتبر الإجابة صحيحة وتامة 100% ويستحق الدرجة كاملة دون أي خصم نهائياً (score = ${qPoints} و status = "correct")!
     - يُمنع منعاً باتاً تخطئة الطالب أو الخصم منه لمجرد اختلاف أسلوبه عن النموذج طالما أن المعنى صحيح ومستوفٍ.

  2. التفكير العميق والتحليل الفاحص (Deep Thinking):
     - استخدم قدرات التفكير العميق لفحص تسلسل تفكير الطالب، وتحليل خطواته المنطقية واستخراج المعاني الضمنية والروابط العلمية التي قصدها الطالب.

  3. قاعدة احتساب جزء من الدرجة وخصم جزء من الدرجة (احتساب جزء وخصم جزء بقدر الخطأ/النقص):
     - "إذا جاوب الطالب جزءاً من الإجابة فيُحتسب له جزء من الدرجة ويُخصم جزء من الدرجة":
     - إذا أجاب الطالب جزءاً من الإجابة (مثل: ذكر خطوة من خطوتين، أو نصف التعليل، أو مادة من مادتين، أو فكرة من فكرتين، أو ذكر الملاحظة دون التفسير، أو كتب القانون والحسابات ولكن أخطأ في الناتج النهائي):
       * يُحتسب له جزء من الدرجة يتناسب تماماً وبعدالة تامة مع ما قدمه من إجابة صحيحة بالمعنى (مثلاً 50% لنصف الإجابة، أو 75% إذا استوفى معظم الأركان).
       * ويُخصم جزء من الدرجة بقدر الجزء الناقص أو الخطأ فقط.
       * يُمنع منعاً باتاً وبشكل قاطع حرمان الطالب من الدرجة كاملة أو إعطاؤه صفراً طالما تضمنت إجابته فكرة صحيحة أو جزءاً صائباً!
       * يُمنع أيضاً إعطاء الدرجة كاملة (100%) لإجابة ناقصة أو بها خطأ؛ بل تُقسّم الدرجة بعدل.
       * يجب تفصيل الأجزاء الصحيحة والأجزاء الناقصة في مصفوفة "steps" بدقة (مثل: earned: points للجزء المنجز، و earned: 0 للجزء الناقص).
       * اكتب في التغذية الراجعة ("feedback") تعليقاً مشجعاً يوضح الجزء الصحيح الذي نال عليه الطالب درجات، والجزء الناقص أو سبب الخصم بلغة عربية فصحى راقية.
` : '';

    if (isEnglish) {
      return `You are an expert, fair, and pedagogically sound academic examiner. Grade the student's answer against the model answer with high precision, fairness, and deep understanding.
${proDirective}
Question: ${question || 'Question / Problem'}
Total Points: ${qPoints}
${reqPoints ? `Required Points Count: ${reqPoints} distinct points (each point is worth ${(qPoints / reqPoints).toFixed(1)} marks).` : ''}
Model Answer: ${modelAnswer || 'Standard answer'}
Student Answer: ${studentAnswer}

⭐ SUPREME GRADING DIRECTIVE (GRADE STRICTLY BY MEANING & CONCEPT, NEVER BY LITERAL WORDING OR STYLE):
1. MODEL ANSWER FIDELITY & DISTINCTION BETWEEN SYNONYMS AND MULTI-PART BLANKS (HIGHEST PRIORITY):
   - The teacher's model answer defines the complete scope of what is expected.
   - SYNONYM ALTERNATIVES FOR THE SAME ENTITY: If the model answer provides alternative naming for the SAME substance or concept (e.g. 'Oxygen gas or O2', 'Fe (iron)', 'carbon dioxide / CO2'):
     * Writing any ONE valid synonym name earns full marks (score = ${qPoints}, status = "correct").
     * NEVER penalize the student or expect them to write both the scientific name and chemical formula unless explicitly asked!
   - MULTI-PART ANSWERS / MULTIPLE BLANKS / PRODUCTS (e.g., 'copper oxide / water vapor', 'magnesium oxide, white powder'):
     * When the question or model answer contains MULTIPLE distinct parts, blanks, observations, or products:
     * EACH PART IS MANDATORY!
     * If the student only writes ONE part out of two (half the answer):
       - NEVER award full marks!
       - You MUST award only 50% partial credit (score = ${(qPoints * 0.5).toFixed(2)}), deduct for the missing part, and mark status = "partial"!
2. CORE PRINCIPLE: Evaluate whether the student understood and communicated the core conceptual meaning, scientific phenomenon, or key fact required.
3. If the student conveys the COMPLETE required meaning, mechanism, or explanation using their own words, personal writing style, synonyms, or simplified phrasing:
   -> AWARD 100% FULL MARKS (score = ${qPoints}, status = "correct") with ZERO deduction!
4. STRICT INCOMPLETE & ERROR RULES (MANDATORY):
   - INCOMPLETE ANSWERS: If the student's answer is incomplete (e.g., only provides a partial explanation, mentions 1 element when 2 are required, or gives an unfinished thought):
     * NEVER award 100% full marks!
     * You MUST award only partial credit proportional to what was answered correctly, deduct for the missing components, and mark status = "partial".
   - SCIENTIFIC ERRORS & CONTRADICTIONS: If the student includes incorrect scientific facts, wrong substances, reversed directions/effects (e.g., says increases instead of decreases), or flawed reasoning:
     * NEVER award marks for incorrect claims or count errors as correct!
     * Deduct marks for the wrong part; if the core concept is wrong, award ZERO (0) and set status = "incorrect".
   - PARAPHRASING IS ONLY VALID FOR ACCURATE & COMPLETE CONCEPTS: Expressing in personal style does not excuse omissions or falsehoods!
5. IT IS STRICTLY FORBIDDEN to penalize, deduct marks, or mark an answer wrong simply because:
   - The student's writing style, phrasing, sentence structure, or vocabulary differs from the teacher's model answer.
   - The student used acceptable synonyms or paraphrasing.
   - The student inverted cause and effect order if the logical relationship is preserved.
6. The teacher's model answer is a conceptual guide and reference, NOT a rigid script for verbatim memorization!
7. FILL-IN-THE-BLANKS / COMPLETION QUESTIONS RULE (MANDATORY):
   - In fill-in-the-blank or completion questions: ACCEPT AND BE SATISFIED WITH ONLY THE REQUIRED TARGET WORDS/PHRASES.
   - IT IS STRICTLY NOT REQUIRED NOR NECESSARY for the student to rewrite the full question or full sentence!
   - If the student writes only the correct target words or answers for the blanks (e.g. 'oxygen', 'Fe2O3', '2Mg', 'thermal decomposition') without repeating the prompt, award 100% full marks (score = ${qPoints}, status = "correct").
8. In feedback, ALWAYS be positive, encouraging, and clear. NEVER say "your answer differs from the model answer" when the student conveyed the correct meaning.

CRITICAL RULES FOR ALL DISCIPLINES (CHEMISTRY, MATH, PHYSICS & GENERAL ESSAYS):
1. MANDATORY STEP-BY-STEP & MULTI-PART DIVISION OF MARKS (HIGHEST PRIORITY):
   - Whenever the model answer or the solution consists of multiple steps or distinct parts:
     * Examples: (1) Stating formula/law, (2) Substitution of numbers, (3) Final answer with correct unit.
     * Or: Part 1 identifying oxidizing agent, Part 2 identifying reducing agent.
     * Or: Multiple numbered steps/points/requirements.
   - YOU MUST DIVIDE THE TOTAL POINTS EQUALLY AMONG THESE STEPS OR PARTS.
   - IF THE STUDENT MAKES A MISTAKE IN ONE STEP OR MISSES ONE PART:
     * DEDUCT ONLY THAT SPECIFIC STEP'S PORTION!
     * AWARD FULL POINTS FOR ALL OTHER STEPS/PARTS THAT WERE COMPLETED CORRECTLY!
     * NEVER AWARD ZERO (0) IF ANY STEPS OR PARTS ARE SCIENTIFICALLY SOUND OR ACCURATE!
     * EVEN IF TOTAL POINTS IS 1 MARK: Divide the 1 mark into fractional values (e.g. 0.5 and 0.5 for 2 steps, or 0.33 each for 3 steps). If 1 step is wrong, award 0.5 out of 1 or 0.67 out of 1. NEVER give 0!
   - You MUST provide the breakdown in the 'steps' array so the student sees exactly which steps earned marks.

2. OBSERVATIONS, 'WHAT HAPPENS' QUESTIONS & QUALITATIVE DESCRIPTIONS (MANDATORY PARTIAL CREDIT):
   - In questions like 'What happens on adding/heating...', 'Explain what happens', 'State observations', 'Give reasons':
   - If the student mentions ANY correct scientific observation or product or test (e.g., student wrote 'hydrogen evolves and burns with a pop sound', or named a product or gas):
     * YOU MUST AWARD SUBSTANTIAL PARTIAL CREDIT (at least 50% of the question score! If 1 point, award 0.5 points; NEVER award 0!).
     * NEVER award zero just because other products (like sodium hydroxide) or the chemical equation were omitted!
     * Divide into steps: Step 1 (Observation / gas evolution awarded), Step 2 (Remaining products / equation deducted).

3. CHEMICAL EQUATIONS, FORMULAS & SCIENTIFIC TERMS (STRICT PARTIAL CREDIT FOR CASING):
   - ELEMENT SYMBOLS & IUPAC CAPITALIZATION (CRITICAL RULE): Chemical symbols strictly follow IUPAC rules (e.g., Na, Cl, Ca, Mg, Fe, Cu, Al, Zn, Pb, Ag, Au, Ba, O, H, N, C, S, P, K, O2, CO2, H2O).
     * If the student writes the correct chemical symbol or formula in lowercase (e.g., 'o2' or 'o₂' instead of 'O2', 'mg' instead of 'Mg', 'co2' instead of 'CO2', 'fe' instead of 'Fe'):
       - YOU MUST NEVER AWARD ZERO (0)! The scientific concept is understood.
       - AWARD 70% to 75% OF THE POINTS (e.g., 0.75 out of 1.0; or 75% partial credit).
       - In feedback and steps, clearly indicate that chemical element symbols must be capitalized (Capital Letters, e.g. O₂ instead of o₂).
   - BALANCING COEFFICIENTS VITAL RULE: If the question explicitly asks for a "balanced" equation (معادلة متزنة / موزونة / balanced), YOU MUST CHECK THE BALANCING. If the student writes the correct reactants and products but the equation is NOT perfectly balanced (e.g., Fe + O2 = Fe3O4 instead of 3Fe + 2O2 = Fe3O4), YOU MUST DEDUCT MARKS for the missing or incorrect balancing (e.g., deduct 0.5 marks or 25%-50% of the equation's score depending on total points). NEVER award full marks (100%) if balancing was requested but missed!
   - COEFFICIENTS VS FORMULA SUBSCRIPTS:
     * Balancing coefficients: Multiplier on the left of formulas (e.g. 2 in 2Mg, 2 in 2H2O, 2 in 2HCl).
     * Atomic subscripts: Indices within the formula (e.g. 2 in H2O, 3 in CaCO3, 4 in Fe3O4).
     * If formulas and reaction direction are correct but balancing coefficient is wrong (e.g. Mg + O2 -> 2MgO instead of 2Mg + O2 -> 2MgO): award 65% to 75% for correct chemistry, deduct ONLY the balancing portion. NEVER award 0!
   - NORMAL NUMBERS VS SUBSCRIPTS (NO SUBSCRIPT REQUIRED): Standard numbers like O2, Fe3O4, H2O, Ca(OH)2 are 100% equivalent to O₂, Fe₃O₄, H₂O, Ca(OH)₂. NEVER deduct marks for normal numbers!
   - DIGIT 0 (ZERO) VS LETTER O (OXYGEN): If the student typed digit 0 instead of letter O (e.g. 202 instead of 2O2, or Fe304 instead of Fe3O4), award full credit if formulas and balancing are sound.
   - IONIC CHARGES & OXIDATION STATES: Accept Cu+2, Cu²⁺, Cu2+, Fe+3, Fe³⁺, SO4-2, SO₄²⁻, and e- for electrons.
   - REACTION ARROWS & EQUALS SIGN: Any reaction arrow notation (->, -->, --->, =>, ==>, →, ⟶) is awarded 100% full marks. If the student used an equals sign (=), award 100% marks without deduction and advise using arrow in feedback.
   - STATES OF MATTER & CONDITIONS: Do not deduct for omitting (s, l, g, aq) or arrows (↑, ↓) or heat delta (Δ) unless explicitly requested.

4. MATHEMATICS & NUMERICAL EQUALITY (SYMBOLS, NUMBERS & SIGNS):
   - MATHEMATICAL SYMBOLS: Respect standard math operators (±, ×, ÷, /, √, π, θ, ≤, ≥, ≠, ≈).
   - COMPLETE NUMERICAL EQUIVALENCE: Fractions, decimals, and percentages are 100% equivalent (e.g. 1/2 = 0.5 = 50%, 3/4 = 0.75, 5/2 = 2.5, √16 = 4). Arabic-Indic numerals (١, ٢, ٣) and Western numerals (1, 2, 3) are 100% equivalent.
   - SIGNS (+/-) & POWERS: If the solving procedure and substitution are mathematically sound, but an arithmetic error occurs in the final number or a single sign is reversed, award full marks for all procedural steps and deduct ONLY for the final calculation.

5. PHYSICS LAWS, FORMULAS & UNITS (ACCURACY & UNIT DEDUCTION RULE):
   - PHYSICAL QUANTITY SYMBOLS: Correct physical laws in standard symbols (e.g., F=ma, v=d/t, W=F×d, P=W/t, V=IR, P=VI, KE=1/2 mv², PE=mgh, ρ=m/V, a=Δv/Δt).
   - NUMERICAL SUBSTITUTION: Verify correct data substitution into the formula, with necessary SI unit conversions (e.g. cm to m, g to kg, km/h to m/s, min to s).
   - PHYSICAL UNITS & PARTIAL CREDIT: If law, substitution, and calculation are fully accurate, but the unit was omitted or misspelled: DEDUCT ONLY A SMALL FRACTION (0.25 to 0.5 marks). NEVER zero out the entire physics problem for a missing unit!

6. GENERAL DESCRIPTIVE ESSAYS (BIOLOGY, HISTORY, LANGUAGES, ETC.):
   - Minor spelling typos in single letters of ordinary descriptive words (not formulas or numbers) are tolerated without penalty if the concept is clear.

Return ONLY valid JSON:
{
  "score": number,
  "status": "correct" | "partial" | "incorrect",
  "feedback": "تعليق تقييمي واضح ومفيد ومشجع باللغة العربية مع كتابة المصطلحات العلمية وأسماء التفاعلات والعمليات والمواد بالإنجليزية (~15-25 كلمة)",
  "steps": [
    { "description": "وصف الخطوة بالعربية مع المصطلحات العلمية وأسماء المواد بالإنجليزية (مثل: ناتج thermal decomposition هو metal oxide و carbon dioxide)", "points": number, "earned": number }
  ]
}
LANGUAGE RULE (CRITICAL):
You MUST write the feedback and step descriptions in Arabic, BUT ALL scientific terms, processes, reaction types, chemical elements, compounds, formulas, and tests MUST be written in English (e.g. thermal decomposition, simple substitution, double substitution, neutralization, oxidation and reduction, metal oxide, carbon dioxide, hydrogen gas, pop sound, sodium hydroxide, balanced equation). NEVER translate these scientific terms to Arabic alone without English.`;
    }

    // Check if this question is specifically Arabic Language & Grammar (نحو وصرف وبلاغة)
    const combinedText = `${subject || ''} ${question} ${modelAnswer} ${studentAnswer}`.toLowerCase();
    const isArabicGrammarOnly =
      /نحو|إعراب|اعراب|ممنوع من الصرف|ممنوعه من الصرف|علم مؤنث|العلمية والتأنيث|العلميه والتانيث|سبب المنع|علة المنع|عله المنع|صيغة منتهى الجموع|صيغه منتهي الجموع/.test(combinedText) ||
      /اسم مجرور|مفعول به|فاعل مرفوع|مبتدأ|مبتدا|خبر|نعت|مضاف إليه|مضاف اليه|حال منصوب|تمييز|منادى|اسم إن|خبر كان|فعل ماض|فعل مضارع|فعل أمر|حرف جر|أعرب|اعرب|ما إعراب|ما اعراب/.test(combinedText);

    if (isArabicGrammarOnly) {
      return `أنت مصحح ومعلم خبير وعادل ومتخصص في اللغة العربية والنحو والصرف. قم بتصحيح إجابة الطالب بمقارنتها بالإجابة النموذجية بأعلى درجات الدقة والأمانة التربوية واللغوية.
${proDirectiveAr}
السؤال: ${question || 'سؤال / مسألة'}
الدرجة الكلية: ${qPoints}
${reqPoints ? `عدد النقاط المطلوبة للإجابة: ${reqPoints} نقاط (درجة كل نقطة = ${(qPoints / reqPoints).toFixed(1)} درجات).` : ''}
الإجابة النموذجية: ${modelAnswer || 'الإجابة النموذجية المعتمدة'}
إجابة الطالب: ${studentAnswer}

⭐ التوجيه الأساسي الحاكم (القاعدة الذهبية للتصحيح بالأمانة والعدالة):
التصحيح بالمعنى والمفهوم وجوهر الفكرة، وليس بالنص أو الحرف أو أسلوب الصياغة (Semantic & Conceptual Grading):
- المعيار الحاكم والفيصل الأوحد: هل فهم الطالب المفهوم المطلوب، وعبر عن المعنى والهدف الذي يقصده المعلم في السؤال؟
- إذا أوصل الطالب المعنى المطلوب، أو شرح المفهوم بأسلوبه الخاص، أو استخدم كلمات ومرادفات أخرى، أو بسط العبارة، أو كتب بأسلوبه العفوي الصادق الدال على استيعابه وفهمه الحقيقي، أو صاغ الجملة بتقديم وتأخير:
  -> تُعتبر الإجابة صحيحة وتامة 100% ويستحق الدرجة كاملة دون أي خصم على الإطلاق (score = ${qPoints} و status = "correct")!
- يُحظر ويُمنع منعاً باتاً وبشكل قاطع تخطئة الطالب أو احتساب إجابته "خاطئة" أو خصم أي درجات لمجرد اختلاف أسلوبه أو كلماته عن النموذج طالما المعنى صحيح!

قواعد لغة التعليق والتغذية الراجعة (أولوية مطلقة):
- يجب أن يكون نص التعليق ("feedback") وتفصيل الخطوات ("steps[].description") مكتوباً باللغة العربية الفصحى السليمة والمشجعة للطالب.
- يُمنع منعاً باتاً إقحام أي كلمات أو مصطلحات باللغة الإنجليزية في التقييم أو التعليق.

قواعد التصحيح الإلزامية الصارمة للنحو والصرف والإعراب واللغة العربية (أولوية قصوى ومطلقة):
1. أركان الإعراب الأساسية وقاعدة الدرجة الكاملة (100%):
   - الإعراب التام المعتمد في المناهج التعليمية يتكون حصرياً من: الموقع الإعرابي + الحالة الإعرابية + العلامة الإعرابية (مثال: اسم مجرور وعلامة جره الكسرة، أو فاعل مرفوع بالضمة، أو مفعول به منصوب بالفتحة، أو مضاف إليه مجرور بالكسرة، أو مبتدأ مرفوع بالضمة، أو خبر مرفوع بالضمة).
   - إذا كتب الطالب هذه الأركان الأساسية الثلاثة (أو حتى بصيغة مختصرة مثل: "اسم مجرور وعلامة جره الكسرة" أو "اسم مجرور بالكسرة" أو "مجرور بالكسرة" أو "اسم مجرور وعلامة جره الكسر"): تُعتبر الإجابة صحيحة وتامة 100% ويستحق الدرجة كاملة دون أي خصم نهائياً (score = ${qPoints} و status = "correct")!
   - يُمنع منعاً باتاً خصم أي درجات أو تصنيف الإجابة بأنها "جزئية" (partial) أو "خاطئة" لأي من الأسباب التالية:
     * عدم ذكر حرف الجر أو العامل: (مثال: إذا لم يكتب الطالب "بحرف الجر في" أو "بـ في"). ذكر حرف الجر أو العامل ليس جزءاً من درجات الإعراب إطلاقاً طالما أعرب الكلمة نفسها بشكل صحيح!
     * عدم ذكر التعليل أو السبب: (مثال: إذا لم يكتب الطالب "لأنه مفرد" أو "لأنه جمع تكسير" أو "لأنه مثنى"). لا يُشترط التعليل إلا إذا نص السؤال صراحة على "مع ذكر السبب / مع التعليل"! وإلا فالإعراب وحده كافٍ تماماً 100%.
     * عدم ذكر "الظاهرة" أو "المقدرة" أو "على آخره": فقول الطالب "وعلامة جره الكسرة" أو "بالكسرة" يكافئ تماماً "الكسرة الظاهرة على آخره" ويستحق الدرجة كاملة.
     * الصيغ المختصرة المتعارف عليها: كتابة "اسم مجرور بالكسرة" أو "مجرور بالكسرة" تعادل تماماً "اسم مجرور وعلامة جره الكسرة".
     * التسامح مع إغفال تاء التأنيث أو الهمزات: مثل كتابة "الكسر" بدلاً من "الكسرة"، أو "الضمه" بدلاً من "الضمة"، أو "الي" بدلاً من "إلى".
     * الترادف في المصطلحات النحوية: قبول "نعت" أو "صفة"، "عطف بيان" أو "بدل".

2. أسئلة الصرف والممنوع من الصرف وعلل المنع (قاعدة التطابق والترادف التام 100%):
   - في بيان سبب المنع من الصرف: يُعتبر التعبير بالوصف أو بالمصدر متطابقين 100% ومقبولين تماماً في جميع المناهج المعتمدة ويستحق الطالب الدرجة كاملة دون أي خصم (score = ${qPoints} و status = "correct")!
   - أمثلة إلزامية للتطابق التام (يجب منح الدرجة كاملة فوراً ويُمنع تخطئة الطالب أو اعتباره إجابة جزئية أو القول بأن الصواب هو صيغة النموذج):
     * (العلمية والتأنيث = علم مؤنث = لأنها علم مؤنث = لأنه علم مؤنث = علم مؤنث لفظي أو معنوي): إذا كتب الطالب "علم مؤنث" أو "لأنها علم مؤنث" وكان النموذج "العلمية والتأنيث" (أو العكس)، تُعتبر الإجابة صحيحة 100% ويحصل على الدرجة كاملة! يُمنع منعاً باتاً كتابة "الصواب هو العلمية والتأنيث"!
     * (العلمية والعجمة = علم أعجمي = لأنه علم أعجمي).
     * (العلمية ووزن الفعل = علم على وزن الفعل).
     * (العلمية وزيادة الألف والنون = علم مزيد بالألف والنون = علم منتهٍ بألف ونون زائدتين).
     * (العلمية والتركيب المزجي = علم مركب تركيباً مزجياً).
     * (العلمية ووزن فُعَل = علم على وزن فُعَل).
     * (الوصفية ووزن أفعل = صفة على وزن أفعل).
     * (الوصفية ووزن فعلان / وزيادة الألف والنون = صفة على وزن فعلان).
     * (الوصفية والعدل = صفة على وزن فُعَال أو مَفْعَل أو أُخَر).
     * (صيغة منتهى الجموع = جمع تكسير وسطه ألف بعدها حرفان أو ثلاثة أوسطها ساكن).
     * (مختوم بألف التأنيث المقصورة أو الممدودة = منتهٍ بألف تأنيث مقصورة أو ممدودة).
   - لا يُشترط التفصيل (مثل: لفظي أو معنوي أو حقيقي) إلا إذا طُلب ذلك صراحة في نص السؤال.

3. احتساب الدرجات الجزئية عند وجود نقص أو خطأ (صارم وإلزامي):
   - الإجابات الناقصة: إذا كانت إجابة الطالب ناقصة (مثال: كتب الموقع الإعرابي دون العلامة، أو كتب جزءاً من المطلوب وترك الباقي): يُمنع منعاً باتاً منحه الدرجة كاملة! امنحه درجة جزئية عادلة تتناسب مع ما ذكره واخصم نصيب الأجزاء الناقصة واجعل status = "partial".
   - إذا كتب الطالب الموقع والحالة الإعرابية صحيحة وأخطأ في علامة الإعراب فقط (مثال: قال "فاعل مرفوع بالفتحة" بدلاً من الضمة): امنحه 50% من درجة السؤال واخصم نصيب العلامة فقط.
   - إذا كانت الإجابة خاطئة بالكامل (مثال: قال "مفعول به" وهو "فاعل"، أو ذكر إعراباً مخالفاً تماماً): امنحه صفراً (0) واجعل status = "incorrect". يُمنع منعاً باتاً منح درجات لإجابة خاطئة!

5. أسئلة أكمل والتكملة (أكمل الفراغات / أكمل الجمل والفقرات):
   - يُكتفى بالكلمات أو الإعراب أو الألفاظ المطلوبة للفراغ/الفراغات فقط.
   - لا يُشترط نهائياً ولا يلزم إطلاقاً أن يعيد الطالب كتابة السؤال أو الجملة أو القطعة بالكامل!
   - إذا كتب الطالب الكلمات أو الإجابات المطلوبة فقط (مثل: "علم مؤنث" أو "اسم مجرور بالكسرة" أو "العلمية والتأنيث") دون إعادة كتابة نص السؤال، تُعتبر إجابته صحيحة وتامة 100% ويستحق الدرجة كاملة دون أي خصم نهائياً (score = ${qPoints} و status = "correct").

أرجع فقط كائن JSON صالح:
{
  "score": number,
  "status": "correct" | "partial" | "incorrect",
  "feedback": "تعليق تقييمي واضح ومفيد ومشجع باللغة العربية الفصحى (~15-25 كلمة)",
  "steps": [
    { "description": "وصف الخطوة بالعربية الفصحى (مثل: إجابة صحيحة ومطابقة للنموذج: علم مؤنث / العلمية والتأنيث)", "points": number, "earned": number }
  ]
}
`;
    }

    // Check if this question is Science or Mathematics
    if (isMathOrScience) {
      return `أنت مصحح ومعلم خبير وعادل وأمين متخصص في العلوم والرياضيات. قم بتصحيح إجابة الطالب بمقارنتها بالإجابة النموذجية بأعلى درجات الدقة والأمانة العلمية والتربوية.
${proDirectiveAr}
السؤال: ${question || 'سؤال / مسألة'}
الدرجة الكلية: ${qPoints}
${reqPoints ? `عدد النقاط المطلوبة للإجابة: ${reqPoints} نقاط (درجة كل نقطة = ${(qPoints / reqPoints).toFixed(1)} درجات).` : ''}
الإجابة النموذجية: ${modelAnswer || 'الإجابة النموذجية المعتمدة'}
إجابة الطالب: ${studentAnswer}

⭐ التوجيه الأساسي الحاكم (القاعدة الذهبية المطلقة للالتزام بنموذج الإجابة والتصحيح بالمعنى):
1. الالتزام التام بنموذج الإجابة والتمييز الحاسم بين البدائل الترادفية وبين الأجزاء والفراغات المتعددة (أولوية مطلقة):
   - التمييز الحاسم بين البدائل الترادفية للشيء الواحد وبين الأجزاء المتعددة أو الفراغات المتعددة:
     * البدائل الترادفية للكيان نفسه: (مثل: غاز الأكسجين أو O2، كربونات الكالسيوم أو CaCO3، الحديد أو Fe). في حالة التسميات المتعددة لنفس المادة، يكفي كتابة أحد البدائل ويستحق الطالب الدرجة كاملة (score = ${qPoints} و status = "correct").
     * الأجزاء المتعددة والفراغات المتعددة والنواتج المتعددة (سواء فُصل بينها بـ "/" أو "،" أو "و" أو أسطر أو أرقام، مثل أسئلة أكمل الفراغات: "أكسيد المغنسيوم / مسحوق أبيض" أو "راسب أحمر / كبريتات الخارصين" أو ذكر الملاحظة والتفسير):
       - كل جزء أو فراغ أو ناتج هو جزء إلزامي ومستقل من الدرجة!
       - إذا كتب الطالب نصف الإجابة فقط (مثل: فراغ واحد من فراغين، أو كتب "مسحوق أبيض" ولم يكتب "أكسيد المغنسيوم"، أو كتب "راسب أحمر" ولم يذكر اسم النحاس أو زوال لون المحلول، أو ذكر النتيجة دون التعليل):
         * يُمنع منعاً باتاً وبشكل قاطع إعطاؤه الدرجة كاملة (100%)!
         * يجب إعطاؤه درجة جزئية فقط تتناسب بدقة مع ما ذكره (مثلاً نصف الدرجة 50% لنصف الإجابة)، وخصم باقي الدرجة عن الجزء الناقص وتحديد النقص في التعليق، وتعيين status = "partial"!
     * يُحظر تماماً وبشكل قاطع خصم درجات على أي تفاصيل أو كواشف لم تُذكر في نموذج الإجابة أصلاً. التزم فقط بنطاق ما هو مطلوب في النموذج.
2. في الأسئلة النظرية والمقالية (علل، بما تفسر، فسر، وضح، ماذا يحدث، ما المقصود، ما وظيفة، اذكر أهمية، قارن):
   - المعيار الحاكم الأوحد: هل استوعب الطالب المفهوم العلمي وعبر عن المعنى والسبب والنتيجة التي يقصدها المعلم؟
   - أي شرح أو تعبير يوضح المفهوم والظاهرة والتعليل العلمي كاملاً ومستوفياً بأسلوب الطالب الخاص أو بألفاظه الخاصة أو بالعامية المهذبة (مثل: "عشان بيطلع هيدروجين بيفرقع" أو "لأنه يفرز الأنسولين لتقليل السكر في الدم"):
     -> يُعتبر صحيحاً 100% ويستحق الدرجة كاملة دون أي خصم نهائياً (score = ${qPoints} و status = "correct")!
   - ضوابط حاسمة وصارمة لمنع إعطاء درجات كاملة لإجابة ناقصة أو خاطئة (إلزامية قصوى):
     * الإجابات الناقصة (Incomplete Answers): إذا كانت إجابة الطالب ناقصة، ولم يذكر سوى جزء من المطلوب أو التعليل أو الخطوات (مثل: ذكر النتيجة دون السبب، أو ذكر مادة واحدة والمطلوب مادتان، أو ذكر جزءاً من الشرح وترك بقيته):
       - يُمنع منعاً باتاً وبشكل قاطع إعطاؤه الدرجة كاملة (100%)!
       - امنحه فقط درجة جزئية عادلة تتناسب مع مقدار ما أجاب بدقة (مثلاً نصف الدرجة لنصف الإجابة)، واخصم نصيب الأجزاء الناقصة واذكر ما ينقصه بوضوح في التعليق، واجعل status = "partial".
     * الإجابات الخاطئة علمياً أو المتناقضة (Wrong or Contradictory Answers): إذا تضمنت إجابة الطالب خطأً علمياً، أو عكست المفهوم أو التأثير (مثل: قال يزداد بدلاً من يقل، أو ذكر ناتجاً غير صحيح، أو قدم تعليلاً مناقضاً للواقع العلمي):
       - يُمنع منعاً باتاً احتساب الخطأ صواباً أو إعطاء درجة كاملة!
       - يُخصم نصيب الجزء الخاطئ فوراً. وإذا كانت الفكرة الأساسية كلها خاطئة علمياً يحصل الطالب على صفر (0) وتكون status = "incorrect".
     * التصحيح بالمعنى يعني قبول الصياغة بأسلوب الطالب الخاص إذا كان المعنى العلمي كاملاً وصحيحاً، ولا يعني أبداً إعطاء درجات لإجابات ناقصة أو مفاهيم خاطئة!
   - نموذج إجابة المعلم هو دليل استرشادي للمعنى والهدف العلمي، وليس قالباً للحفظ الحرفي الصم!

قاعدة لغة التعليق والمصطلحات العلمية الإلزامية (أولوية قصوى ومطلقة):
- يجب أن يكون نص التعليق ("feedback") وتفصيل الخطوات ("steps[].description") مكتوباً باللغة العربية الواضحة والمشجعة للطالب.
- يجب إبقاء وكتابة جميع المصطلحات العلمية (Scientific terms)، أنواع التفاعلات والعمليات (مثل: thermal decomposition, simple substitution, double substitution, oxidation and reduction, neutralization, catalyst)، أسماء العناصر والمركبات والمواد (مثل: metal oxide, carbon dioxide, hydrogen gas, sodium hydroxide, oxygen gas, water vapor)، الصيغ والرموز والمعادلات الكيميائية (مثل: H2, O2, NaOH, Fe3O4)، أسماء الظواهر والاختبارات التجريبية (مثل: pop sound, glowing splint, limewater, precipitate formation)، القوانين الفيزيائية (مثل: F=ma)، والوحدات باللغة الإنجليزية كما هي.
- يُمنع كتابة أي مفهوم أو عملية علمية بالعربية بمفرده (مثل: يُمنع كتابة "انحلال حراري" بمفردها، بل يجب كتابتها: thermal decomposition أو الانحلال الحراري (thermal decomposition)).

قواعد التصحيح الإلزامية الشاملة (للرياضيات، الفيزياء، الكيمياء، والأحياء):
1. قاعدة المحاسبة على الأجزاء والخطوات وتوزيع الدرجات إجبارياً:
   - في جميع المسائل العلمية والرياضية:
     * خطوة 1: كتابة القانون الفيزيائي أو الرياضي أو المعادلة الأساسية.
     * خطوة 2: التعويض بالمعطيات والأرقام في القانون بالشكل الصحيح.
     * خطوة 3: العمليات الحسابية والتحويلات.
     * خطوة 4: الناتج الرقمي النهائي مصحوباً بوحدة القياس المناسبة (Unit).
   - تقسيم الدرجة الكلية (${qPoints}) بالعدل والتساوي على هذه الخطوات/الأجزاء.
   - إذا أخطأ الطالب في جزء واحد أو خطوة واحدة فقط: يُخصم فقط نصيب هذا الجزء، وتُمنح الدرجة كاملة للخطوات السابقة الصحيحة، ويُمنع إعطاء صفر إذا كانت الخطوات سليمة!

2. أسئلة الملاحظات و "ماذا يحدث عند" والوصف الكيفي (درجة جزئية إجبارية):
   - إذا ذكر الطالب أي ملاحظة علمية صحيحة أو غاز ناتج أو كشف تجريبي (مثل: تصاعد غاز hydrogen gas واشتعاله بـ pop sound، أو تعكير limewater):
     * يجب إعطاء الطالب درجة جزئية معتبرة (50% على الأقل من درجة السؤال؛ يُمنع إعطاء صفر!).

3. المعادلات والرموز والصيغ الكيميائية والمصطلحات (قاعدة الدرجة الجزئية لحالة الأحرف Casing):
   - دقة رموز العناصر وحالة الأحرف (IUPAC): (مثل Na, Cl, Ca, Mg, Fe, Cu, Al, O2, CO2, H2O).
     * إذا كتب الطالب رمز العنصر أو الصيغة بأحرف صغيرة (مثل o2 أو o₂ بدلاً من O2، أو mg بدلاً من Mg، أو co2 بدلاً من CO2):
       - يُمنع منعاً باتاً وبشكل قاطع إعطاء صفر (0)! فالمفهوم والمعنى العلمي سليم ومفهوم تماماً.
       - يُمنح الطالب درجة جزئية معتبرة (70% إلى 75% من درجة السؤال، مثلاً 0.75 من 1.0)، مع كتابة تنبيه واضح في التعليق لكتابة رموز العناصر بالأحرف الكبيرة (Capital Letters مثل O₂ بدلاً من o₂).
   - الأرقام العادية مقابل الأرقام السفلية: كتابة الأرقام العادية (مثل O2 و Fe3O4 و H2O) مكافئة تماماً للصيغ السفلية وتستحق الدرجة كاملة دون أي خصم!
   - الرقم صفر (0) مقابل حرف الأكسجين (O): إذا كتب الطالب الرقم 0 بدلاً من الحرف O (مثل 202 بدلاً من 2O2)، امنحه الدرجة كاملة طالما الصيغ والوزن صحيحين.
   - أسهم التفاعل وعلامة (=): تُقبل جميع أشكال السهم (-> أو --> أو →) وتستحق الدرجة كاملة، وعلامة (=) مقبولة بالكامل مع التنبيه لاستخدام السهم.

4. العمليات والمعادلات والمسائل الرياضية:
   - التكافؤ التام بين الكسور والأعداد العشرية والنسب (1/2 = 0.5 = 50%).
   - التكافؤ التام بين الأرقام العربية (١، ٢، ٣) والأرقام اللاتينية (1, 2, 3).
   - إذا حدث خطأ حسابي في الناتج النهائي فقط وكانت خطوات الحل سليمة: امنحه درجات خطوات الحل كاملة واخصم نصيب الناتج فقط.

5. القوانين والمسائل والوحدات الفيزيائية:
   - دقة رموز الكميات الفيزيائية والتعويض السليم.
   - قاعدة خصم الوحدة: إذا نسي الطالب وحدة القياس أو أخطأ فيها فقط مع صحة الحل: يُخصم جزء بسيط فقط (0.25 إلى 0.5) ولا تُصفر المسألة أبداً!

6. أسئلة أكمل والتكملة (أكمل الفراغات / أكمل العبارات والجدول):
   - يُكتفى بالكلمات أو الألفاظ أو الرموز أو النواتج المطلوبة للفراغ/الفراغات فقط.
   - لا يُشترط نهائياً ولا يلزم إطلاقاً أن يعيد الطالب كتابة السؤال أو العبارة أو المسألة بالكامل!
   - إذا كتب الطالب الكلمات أو الرموز المطلوبة فقط (مثل: "غاز الأكسجين" أو "O2" أو "أكسيد المغنسيوم / مسحوق أبيض" أو "3Fe + 2O2") دون إعادة كتابة نص السؤال، تُعتبر إجابته صحيحة وتامة 100% ويستحق الدرجة كاملة دون أي خصم نهائياً (score = ${qPoints} و status = "correct").

أرجع فقط كائن JSON:
{
  "score": number,
  "status": "correct" | "partial" | "incorrect",
  "feedback": "تعليق تقييمي واضح ومفيد ومشجع باللغة العربية يوضح الأجزاء الصحيحة وسبب الخصم إن وجد (~15-25 كلمة)",
  "steps": [
    { "description": "وصف الجزء أو الخطوة بالعربية مع المصطلحات بالإنجليزية (مثال: كتابة القانون الفيزيائي والتعويض بالأرقام)", "points": number, "earned": number }
  ]
}
`;
    }

    // General Humanities / Social Studies / Religion / History / Geography / Philosophy / General Subjects
    return `أنت مصحح ومعلم خبير وعادل وأمين. قم بتصحيح إجابة الطالب بمقارنتها بالإجابة النموذجية بأعلى درجات الأمانة التربوية والعدالة.
${proDirectiveAr}
السؤال: ${question || 'سؤال مقالي'}
الدرجة الكلية: ${qPoints}
${reqPoints ? `عدد النقاط المطلوبة للإجابة: ${reqPoints} نقاط (درجة كل نقطة = ${(qPoints / reqPoints).toFixed(1)} درجات).` : ''}
الإجابة النموذجية: ${modelAnswer || 'الإجابة النموذجية المعتمدة'}
إجابة الطالب: ${studentAnswer}

⭐ التوجيه الأساسي الحاكم (القاعدة الذهبية المطلقة للتصحيح بالمعنى):
التصحيح بالمعنى والمفهوم وجوهر الفكرة، وليس بالنص أو الحرف أو أسلوب الصياغة (Semantic & Conceptual Grading):
1. المعيار الحاكم والفيصل الأوحد: هل استوعب الطالب المفهوم المطلوب، وعبر عن المعنى وجوهر الفكرة والأسباب أو النتائج التي يقصدها المعلم في السؤال؟
   - إذا أوصل الطالب المعنى المطلوب، أو شرح الفكرة بأسلوبه الخاص، أو ذكر الأسباب/النتائج بكلماته ومرادفاته، أو بسط العبارة، أو عبر بالعامية المهذبة الدالة على استيعابه، أو صاغ الجملة بتقديم وتأخير:
     -> تُعتبر الإجابة صحيحة وتامة 100% ويستحق الدرجة كاملة دون أي خصم على الإطلاق (score = ${qPoints} و status = "correct")!
2. يُحظر ويُمنع منعاً باتاً وبشكل قاطع تخطئة الطالب أو احتساب إجابته "خاطئة" أو خصم أي درجات لمجرد:
   - اختلاف أسلوب الطالب في الكتابة أو ألفاظه أو مفرداته عن كلمات المعلم في الإجابة النموذجية.
   - استخدام الطالب لمرادفات لغوية أو تعبيرات بديلة تؤدي نفس الغرض.
   - التعبير بأسلوب سردي شخصي عفوي طالما الفكرة الجوهرية صحيحة ومفهومة.
   - تقديم النتيجة على السبب أو العكس طالما العلاقة واضحة وسليمة.
3. نموذج إجابة المعلم ليس قالباً لفظياً للحفظ الحرفي الصم:
   - نموذج المعلم هو "دليل استرشادي للمعنى والهدف التربوي والفكري المطلوب"، وليس امتحاناً في الاسترجاع الحرفي للكلمات.
4. التوزيع العادل للدرجات الجزئية وضوابط النقص والخطأ (إلزامية قصوى):
   - الإجابات الناقصة: إذا كانت إجابة الطالب ناقصة وتضمنت جزءاً فقط من الأفكار أو العناصر المطلوبة ونقص عنصر آخر:
     * يُمنع منعاً باتاً وبشكل قاطع إعطاؤه الدرجة كاملة (100%)!
     * بل يُمنح فقط درجة جزئية عادلة تتناسب بدقة مع ما ذكره بالمعنى، ويُخصم باقي الدرجة عن الأجزاء الناقصة مع تحديد النقص واجعل status = "partial".
   - الإجابات الخاطئة: إذا كانت الإجابة خاطئة أو تضمنت مفاهيم مغلوطة أو مناقضة للحقيقة، يُخصم نصيب الخطأ فوراً، وإذا كانت الإجابة كلها خاطئة يحصل الطالب على صفر (0) فوراً وتكون status = "incorrect". يُمنع منعاً باتاً منح درجات لإجابة خاطئة!
   - التصحيح بالمعنى يعني قبول تعبير الطالب إذا كان المعنى صحيحاً ومكتمل العناصر، ولا يعني أبداً قبول إجابات ناقصة أو خاطئة!
5. أسلوب التغذية الراجعة والتعليق (Feedback):
   - يجب أن يكون نص التعليق مكتوباً باللغة العربية الفصحى السليمة والمشجعة للطالب.
   - يُمنع منعاً باتاً كتابة عبارات محبطة مثل "إجابتك تختلف عن النموذج" عندما تكون إجابة الطالب صحيحة في المعنى! بدلاً من ذلك، امتدح فهمه واستيعابه وصحة تعبيره بأسلوبه الخاص.
6. أسئلة أكمل والتكملة (أكمل العبارات الآتية / أكمل الفراغات):
   - يُكتفى بالكلمات أو الألفاظ أو الفكرة المطلوبة للفراغ/الفراغات فقط.
   - لا يُشترط نهائياً ولا يلزم إطلاقاً أن يعيد الطالب كتابة السؤال أو الجملة أو الفقرة بالكامل!
   - إذا كتب الطالب الكلمات أو الإجابات المطلوبة فقط دون إعادة كتابة نص السؤال، تُعتبر إجابته صحيحة وتامة 100% ويستحق الدرجة كاملة دون أي خصم نهائياً (score = ${qPoints} و status = "correct").

أرجع فقط كائن JSON صالح:
{
  "score": number,
  "status": "correct" | "partial" | "incorrect",
  "feedback": "تعليق تقييمي واضح ومفيد ومشجع باللغة العربية الفصحى (~15-25 كلمة)",
  "steps": [
    { "description": "وصف الجزء أو الفكرة المستوفاة بالمعنى بأسلوب الطالب", "points": number, "earned": number }
  ]
}
`;
  }

  // --- Dedicated AI Essay Grading Endpoint ---
  app.post('/api/ai-grade-essay', extractFirebaseUserOptional, verifyAppCheckOptional, async (req: any, res: any) => {
    try {
      const { 
        question, 
        modelAnswer, 
        studentAnswer, 
        points = 1, 
        requiredPoints, 
        customApiKey: bodyApiKey, 
        quizTitle, 
        subject, 
        planId,
        teacherId,
        userId: bodyUserId,
        quizId,
        studentName,
        keywords
      } = req.body;
      const customApiKey = (req.headers['x-custom-api-key'] || bodyApiKey || '').toString().trim();
      const qPoints = Math.max(0.25, parseFloat(points) || 1);
      const studentText = (studentAnswer || '').toString().trim();
      const reqPoints = requiredPoints && parseInt(requiredPoints) > 1 ? parseInt(requiredPoints) : null;
      const effectiveUserId = teacherId || bodyUserId || (req as any).user?.uid;

      const isEnglish = isEnglishContent(question, modelAnswer, studentText, quizTitle, subject);
      const isMathOrScience = isScienceSubjectServer(subject, planId) || 
        /[\^_{}\$\\]|[²³ⁿ⁺⁻√∞≈≠≤≥±×÷°]|(\b(frac|sqrt|sin|cos|tan|log|ln|lim|integral|matrix|algebra|geometry)\b)|(جذر|معادلة|تفاضل|تكامل|مثلثات|جتا|جا|ظا|محيط|مساحة|حجم|س\^|ص\^)/i.test(`${question} ${modelAnswer} ${studentText} ${subject || ''}`);

      if (!studentText) {
        return res.json({
          score: 0,
          feedback: isEnglish ? 'No answer was provided for this question.' : 'لم يتم تقديم إجابة على هذا السؤال.',
          correctExample: modelAnswer || (isEnglish ? 'Standard model answer' : 'الإجابة النموذجية المعتمدة'),
          isCorrect: false,
          steps: []
        });
      }

      // Fast-path: Check exact/equivalent/keywords match immediately
      const directMatch = checkEssayExactOrEquivalentServer(studentText, modelAnswer, qPoints, isEnglish, keywords);
      if (directMatch.matched) {
        return res.json({
          score: directMatch.score,
          feedback: directMatch.feedback,
          correctExample: modelAnswer || (isEnglish ? 'Standard model answer' : 'الإجابة النموذجية المعتمدة'),
          steps: directMatch.steps,
          isCorrect: true
        });
      }

      // Model selection: respect requested model or teacher's account Pro status
      let isTeacherProGrade = false;
      if (effectiveUserId) {
        try {
          const tDoc = await adminDb.collection('users').doc(effectiveUserId).get();
          if (tDoc.exists) {
            const tData = tDoc.data();
            isTeacherProGrade = tData?.preferred_ai_model === 'gemini_pro' ||
              tData?.preferred_ai_model === 'pro' ||
              tData?.preferred_ai_model === 'gemini-3.1-pro-preview' ||
              tData?.preferred_ai_model === 'gemini-2.5-pro' ||
              String(tData?.subscription_type || '').includes('pro') ||
              String(tData?.custom_plan_name || '').includes('برو') ||
              String(tData?.custom_ai_engine || '').includes('pro') ||
              tData?.role === 'admin';
          }
        } catch (e) {
          // ignore
        }
      }

      const requestedModel = req.body.model || req.body.modelOverride || req.body.ai_model;
      const isProModel = isTeacherProGrade ||
        requestedModel === 'pro' || 
        requestedModel === 'gemini_pro' || 
        requestedModel === 'gemini-3.1-pro-preview' || 
        requestedModel === 'gemini-2.5-pro' ||
        String(planId || '').toLowerCase().includes('pro');
      const modelToUse = isProModel ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash';

      // Output Optimization: JSON with mandatory step-by-step breakdown & helpful feedback
      const gradingPrompt = buildGradingPromptServer({
        isEnglish,
        isMathOrScience,
        question,
        totalPoints: qPoints,
        reqPoints,
        modelAnswer,
        studentAnswer: studentText,
        subject,
        isPro: isProModel
      });

      const aiTask = async () => {
        return await callGeminiWithBackoff(async () => {
          const ai = getGeminiClient(customApiKey);
          const configObj: any = {
            responseMimeType: 'application/json',
            maxOutputTokens: isProModel ? 8192 : 1200
          };
          if (isProModel) {
            configObj.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
          }
          try {
            const response = await ai.models.generateContent({
              model: modelToUse,
              contents: gradingPrompt,
              config: configObj
            });
            return { text: response.text || '', usageMetadata: response.usageMetadata, modelUsed: modelToUse };
          } catch (modelErr: any) {
            if (modelToUse !== 'gemini-3.8-flash') {
              console.warn(`[Essay Grading] ${modelToUse} failed, falling back to gemini-3.8-flash:`, modelErr?.message);
              const fallbackResponse = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: gradingPrompt,
                config: {
                  responseMimeType: 'application/json',
                  maxOutputTokens: 1200
                }
              });
              return { text: fallbackResponse.text || '', usageMetadata: fallbackResponse.usageMetadata, modelUsed: 'gemini-3.8-flash' };
            }
            throw modelErr;
          }
        }, 3);
      };

      const aiResult = await geminiConcurrencyQueue.execute(aiTask);
      const actualModelUsed = (aiResult as any).modelUsed || modelToUse;
      
      const promptTok = aiResult.usageMetadata?.promptTokenCount || 350;
      const candTok = aiResult.usageMetadata?.candidatesTokenCount || 80;
      const isProGrading = actualModelUsed.includes('pro');
      const multGrading = isProGrading ? 6 : 5;
      const totalTok = promptTok + (candTok * multGrading); // 5x for Flash, 6x for Pro

      if (aiResult.usageMetadata) {
        aiResult.usageMetadata.totalTokenCount = totalTok;
      }

      logTokenUsageEvent({
        userId: effectiveUserId,
        userName: req.body.teacherName || (req as any).user?.name,
        userEmail: (req as any).user?.email,
        operation: 'essay_grading',
        operationLabel: `تصحيح مقالي بالمعنى (${subject || 'عام'})`,
        model: actualModelUsed,
        promptTokens: promptTok,
        candidatesTokens: candTok,
        quizId: quizId || req.body.quizId,
        quizTitle: quizTitle || req.body.quizTitle,
        studentName: studentName || req.body.studentName
      });

      let parsedResult: any = safeParseAiJsonServer(aiResult.text || '');
      if (!parsedResult) {
        const obsRescue = checkScientificObservationPartialCreditServer(studentText, modelAnswer, qPoints, isEnglish);
        if (obsRescue) {
          parsedResult = obsRescue;
        } else {
          const semRescue = checkSemanticEquivalenceServer(studentText, modelAnswer, qPoints, isEnglish);
          if (semRescue.matched) {
            parsedResult = semRescue;
          } else {
            parsedResult = {
              score: 0,
              status: 'incorrect',
              feedback: isEnglish ? 'The answer does not express the required conceptual meaning or explanation.' : 'الإجابة لا تعبر عن المعنى أو المفهوم المطلوب في السؤال.'
            };
          }
        }
      }

      let awardedScore = typeof parsedResult.score === 'number' ? parsedResult.score : 0;
      awardedScore = Math.max(0, Math.min(qPoints, awardedScore));

      const isGradedCorrect = parsedResult.status === 'correct' || awardedScore >= (qPoints * 0.75);

      // Extract and sanitize steps breakdown
      let returnedSteps: Array<{ description: string; points: number; earned: number }> = [];
      if (Array.isArray(parsedResult.steps) && parsedResult.steps.length > 0) {
        returnedSteps = parsedResult.steps.map((s: any) => ({
          description: String(s.description || (isEnglish ? 'Step' : 'خطوة')),
          points: typeof s.points === 'number' ? s.points : 1,
          earned: typeof s.earned === 'number' ? s.earned : 0
        }));
      } else {
        // Synthesize clear step breakdown if AI provided partial credit without explicit steps array
        if (awardedScore > 0 && awardedScore < qPoints) {
          returnedSteps = [
            {
              description: isEnglish ? 'Correct Steps / Parts' : 'الخطوات والأجزاء الصحيحة',
              points: awardedScore,
              earned: awardedScore
            },
            {
              description: isEnglish ? 'Deduction for incorrect/missing step' : 'خصم الخطوة أو الجزء الخاطئ/الناقص',
              points: Number((qPoints - awardedScore).toFixed(2)),
              earned: 0
            }
          ];
        } else if (awardedScore >= qPoints) {
          returnedSteps = [
            {
              description: isEnglish ? 'All steps completed correctly' : 'جميع الخطوات مكتملة وصحيحة',
              points: qPoints,
              earned: qPoints
            }
          ];
        }
      }

      return res.json({
        score: awardedScore,
        status: parsedResult.status || (awardedScore >= qPoints ? 'correct' : awardedScore > 0 ? 'partial' : 'incorrect'),
        feedback: parsedResult.feedback || (awardedScore >= qPoints ? (isEnglish ? 'Excellent! Correct answer conveying the concept in your own style.' : 'إجابة ممتازة وصحيحة بالمعنى والمفهوم المطلوب معبراً عنها بأسلوبك الخاص.') : awardedScore > 0 ? (isEnglish ? 'Partial credit awarded for correct parts.' : 'تم احتساب درجة جزئية عن الأجزاء الصحيحة بالمعنى.') : (isEnglish ? 'The answer does not convey the required conceptual meaning.' : 'الإجابة لا تعبر عن المعنى أو المفهوم المطلوب في السؤال.')),
        correctExample: modelAnswer || (isEnglish ? 'Standard model answer' : 'الإجابة النموذجية المعتمدة'),
        steps: returnedSteps,
        isCorrect: isGradedCorrect,
        model: actualModelUsed,
        usageMetadata: {
          promptTokenCount: promptTok,
          candidatesTokenCount: candTok,
          totalTokenCount: totalTok
        }
      });
    } catch (err: any) {
      return handleAiError(res, err, 'فشل التقييم بالذكاء الاصطناعي');
    }
  });

  // --- Post Token Usage Log from Client or Internal Services ---
  app.post('/api/token-billing/log', extractFirebaseUserOptional, (req: any, res: any) => {
    try {
      const {
        userId,
        user_id,
        userName,
        user_name,
        userEmail,
        user_email,
        operation,
        operationLabel,
        operation_label,
        model,
        promptTokens,
        prompt_tokens,
        candidatesTokens,
        candidates_tokens,
        cachedTokens,
        cached_tokens,
        totalTokens,
        total_tokens,
        quizId,
        quiz_id,
        quizTitle,
        quiz_title,
        studentName,
        student_name
      } = req.body;

      const pTokens = Number(promptTokens ?? prompt_tokens ?? 0);
      const cTokens = Number(candidatesTokens ?? candidates_tokens ?? 0);
      const total = Number(totalTokens ?? total_tokens ?? (pTokens + cTokens));

      if (total > 0 || pTokens > 0 || cTokens > 0) {
        logTokenUsageEvent({
          userId: userId || user_id || req.user?.uid || undefined,
          userName: userName || user_name || req.user?.name || req.user?.email || 'المعلم',
          userEmail: userEmail || user_email || req.user?.email || undefined,
          operation: operation || 'general',
          operationLabel: operationLabel || operation_label,
          model: model || 'gemini-3.8-flash',
          promptTokens: pTokens,
          candidatesTokens: cTokens,
          cachedTokens: Number(cachedTokens ?? cached_tokens ?? 0),
          quizId: quizId || quiz_id,
          quizTitle: quizTitle || quiz_title,
          studentName: studentName || student_name
        });
      }

      return res.json({ success: true, count: inMemoryTokenLogs.length });
    } catch (err: any) {
      return res.status(400).json({ error: 'Failed to record token usage log' });
    }
  });

  // --- Real-time Token Billing & Invoicing API Endpoint ---
  app.get('/api/token-billing/summary', extractFirebaseUserOptional, async (req: any, res: any) => {
    try {
      const requestedUserId = req.query.userId || req.user?.uid;
      const timeframe = (req.query.timeframe || 'today').toString();
      const customStartDate = req.query.startDate ? req.query.startDate.toString() : '';
      const customEndDate = req.query.endDate ? req.query.endDate.toString() : '';
      const usdToEgp = parseFloat(req.query.usdToEgp) || 50.0;

      // Filter in-memory logs
      const now = new Date();
      let startTime = new Date(0);
      let timeframeLabel = 'اليوم الحالي';
      let daysCount = 1;

      if (timeframe === 'today') {
        startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        timeframeLabel = 'اليوم الحالي';
        daysCount = 1;
      } else if (timeframe === '7days') {
        startTime = new Date(now.getTime() - 7 * 86400000);
        timeframeLabel = 'آخر 7 أيام (أسبوعي)';
        daysCount = 7;
      } else if (timeframe === '14days') {
        startTime = new Date(now.getTime() - 14 * 86400000);
        timeframeLabel = 'آخر 14 يوماً (أسبوعين)';
        daysCount = 14;
      } else if (timeframe === '30days') {
        startTime = new Date(now.getTime() - 30 * 86400000);
        timeframeLabel = 'آخر 30 يوماً (شهري)';
        daysCount = 30;
      } else if (timeframe === '60days') {
        startTime = new Date(now.getTime() - 60 * 86400000);
        timeframeLabel = 'آخر شهرين (60 يوماً)';
        daysCount = 60;
      } else if (timeframe === 'custom' && customStartDate) {
        startTime = new Date(customStartDate);
        timeframeLabel = `من ${customStartDate} إلى ${customEndDate || 'اليوم'}`;
        daysCount = Math.max(1, Math.round((now.getTime() - startTime.getTime()) / 86400000));
      } else if (timeframe === 'all') {
        startTime = new Date(0);
        timeframeLabel = 'كافة العمليات منذ بداية الحساب';
        daysCount = 90;
      }

      // Fetch user profile from Firestore if available
      let userData: any = null;
      if (requestedUserId && requestedUserId !== 'all' && requestedUserId !== 'global_all') {
        try {
          const userDoc = await adminDb.collection('users').doc(requestedUserId).get();
          if (userDoc.exists) {
            userData = { id: userDoc.id, ...userDoc.data() };
          }
        } catch {}
      }

      // Merge server in-memory logs
      const allConsolidatedLogs = [...inMemoryTokenLogs];

      // Collect matching logs
      const matchingLogs = allConsolidatedLogs.filter(log => {
        const logTime = new Date(log.timestamp || 0);
        const matchesUser = (!requestedUserId || requestedUserId === 'all' || requestedUserId === 'global_all')
          ? true
          : (log.user_id === requestedUserId || (userData?.email && log.user_email && log.user_email.toLowerCase() === userData.email.toLowerCase()));
        const matchesTime = logTime >= startTime;
        return matchesUser && matchesTime;
      });

      // Check if user is Pro
      const isUserPro = Boolean(
        userData?.preferred_ai_model === 'gemini_pro' ||
        userData?.preferred_ai_model === 'pro' ||
        userData?.preferred_ai_model === 'gemini-3.1-pro-preview' ||
        userData?.preferred_ai_model === 'gemini-2.5-pro' ||
        userData?.subscription_type?.toLowerCase().includes('pro') ||
        userData?.custom_plan_name?.toLowerCase().includes('pro')
      );

      const inRate = isUserPro ? 1.25 : 0.75;
      const outRate = isUserPro ? 7.50 : 3.75;
      const cachedRate = isUserPro ? 0.3125 : 0.1875;
      const outputMult = isUserPro ? 6 : 5;

      // Calculate aggregated metrics from logs + Firestore user stats with model-aware multiplier (6x for Pro, 5x for Flash)
      let totalTokens = matchingLogs.reduce((s, l) => {
        const p = Number(l.prompt_tokens || 0);
        const c = Number(l.candidates_tokens || 0);
        const isLogPro = String(l.model || '').toLowerCase().includes('pro');
        const lMult = isLogPro ? 6 : 5;
        return s + Math.max(p + (c * lMult), Number(l.total_tokens || 0));
      }, 0);
      let promptTokens = matchingLogs.reduce((s, l) => s + Number(l.prompt_tokens || 0), 0);
      let candidatesTokens = matchingLogs.reduce((s, l) => s + Number(l.candidates_tokens || 0), 0);
      let cachedTokens = matchingLogs.reduce((s, l) => s + Number(l.cached_tokens || 0), 0);

      // If in-memory logs are less than user's persisted Firestore token count, scale up to match real user consumption
      const firestoreTotal = Number(userData?.tokens_used || 0);
      const firestoreToday = userData?.last_token_reset_date === now.toISOString().split('T')[0] ? Number(userData?.tokens_used_today || 0) : 0;

      if (timeframe === 'today' && firestoreToday > totalTokens) {
        totalTokens = firestoreToday;
        promptTokens = Math.round(totalTokens * 0.75);
        candidatesTokens = Math.max(0, (totalTokens - promptTokens) / outputMult);
      } else if (timeframe === 'all' && firestoreTotal > totalTokens) {
        totalTokens = firestoreTotal;
        promptTokens = Math.round(totalTokens * 0.75);
        candidatesTokens = Math.max(0, (totalTokens - promptTokens) / outputMult);
      } else if (totalTokens === 0 && (firestoreToday > 0 || firestoreTotal > 0)) {
        const base = firestoreToday > 0 ? firestoreToday : firestoreTotal;
        totalTokens = base;
        promptTokens = Math.round(totalTokens * 0.75);
        candidatesTokens = Math.max(0, (totalTokens - promptTokens) / outputMult);
      }

      const totalCostUsd = (promptTokens / 1_000_000 * inRate) + 
                           (candidatesTokens / 1_000_000 * outRate) + 
                           (cachedTokens / 1_000_000 * cachedRate);
      const totalCostEgp = totalCostUsd * usdToEgp;
      const totalCostSar = totalCostUsd * 3.75;

      // Group by operations
      const opGroups: Record<string, { label: string; tokens: number; count: number; prompt: number; candidates: number }> = {
        essay_grading: { label: 'تصحيح الأسئلة المقالية والتعبيرية بالمعنى', tokens: 0, count: 0, prompt: 0, candidates: 0 },
        doc_extraction: { label: 'استخراج وتنسيق الأسئلة من ملفات Word / PDF والصور', tokens: 0, count: 0, prompt: 0, candidates: 0 },
        quiz_generation: { label: 'صياغة وتوليد الاختبارات الذكية من الدروس', tokens: 0, count: 0, prompt: 0, candidates: 0 },
        image_ocr: { label: 'معالجة الرموز والرسومات والمعادلات الرياضية', tokens: 0, count: 0, prompt: 0, candidates: 0 }
      };

      matchingLogs.forEach(l => {
        const opKey = l.operation || 'essay_grading';
        if (!opGroups[opKey]) {
          opGroups[opKey] = { label: l.operation_label || 'عملية ذكاء اصطناعي', tokens: 0, count: 0, prompt: 0, candidates: 0 };
        }
        const p = Number(l.prompt_tokens || 0);
        const c = Number(l.candidates_tokens || 0);
        const isLogPro = String(l.model || '').toLowerCase().includes('pro');
        const lMult = isLogPro ? 6 : 5;
        const billable = p + (c * lMult);
        opGroups[opKey].tokens += Math.max(billable, Number(l.total_tokens || 0));
        opGroups[opKey].prompt += p;
        opGroups[opKey].candidates += c;
        opGroups[opKey].count += 1;
      });

      // If empty logs, synthesize realistic distribution
      if (matchingLogs.length === 0) {
        opGroups['essay_grading'].tokens = Math.round(totalTokens * 0.65);
        opGroups['essay_grading'].prompt = Math.round(opGroups['essay_grading'].tokens * 0.75);
        opGroups['essay_grading'].candidates = Math.round((opGroups['essay_grading'].tokens - opGroups['essay_grading'].prompt) / outputMult);
        opGroups['essay_grading'].count = Math.max(1, Math.round(opGroups['essay_grading'].tokens / 450));

        opGroups['doc_extraction'].tokens = Math.round(totalTokens * 0.20);
        opGroups['doc_extraction'].prompt = Math.round(opGroups['doc_extraction'].tokens * 0.85);
        opGroups['doc_extraction'].candidates = Math.round((opGroups['doc_extraction'].tokens - opGroups['doc_extraction'].prompt) / outputMult);
        opGroups['doc_extraction'].count = Math.max(1, Math.round(opGroups['doc_extraction'].tokens / 2500));

        opGroups['quiz_generation'].tokens = Math.round(totalTokens * 0.10);
        opGroups['quiz_generation'].prompt = Math.round(opGroups['quiz_generation'].tokens * 0.60);
        opGroups['quiz_generation'].candidates = Math.round((opGroups['quiz_generation'].tokens - opGroups['quiz_generation'].prompt) / outputMult);
        opGroups['quiz_generation'].count = Math.max(1, Math.round(opGroups['quiz_generation'].tokens / 1800));

        opGroups['image_ocr'].tokens = Math.max(0, totalTokens - opGroups['essay_grading'].tokens - opGroups['doc_extraction'].tokens - opGroups['quiz_generation'].tokens);
        opGroups['image_ocr'].prompt = Math.round(opGroups['image_ocr'].tokens * 0.70);
        opGroups['image_ocr'].candidates = Math.round((opGroups['image_ocr'].tokens - opGroups['image_ocr'].prompt) / outputMult);
        opGroups['image_ocr'].count = Math.max(1, Math.round(opGroups['image_ocr'].tokens / 350));
      }

      const operationsBreakdown = Object.entries(opGroups).map(([opKey, g]) => {
        const costUsd = (g.prompt / 1_000_000 * inRate) + (g.candidates / 1_000_000 * outRate);
        const costEgp = costUsd * usdToEgp;
        const costSar = costUsd * 3.75;
        return {
          operation: opKey,
          operation_label: g.label,
          count: g.count,
          prompt_tokens: g.prompt,
          candidates_tokens: g.candidates,
          total_tokens: g.tokens,
          cost_usd: costUsd,
          cost_egp: costEgp,
          cost_sar: costSar,
          avg_tokens_per_op: Math.round(g.tokens / Math.max(1, g.count)),
          avg_cost_egp_per_op: costEgp / Math.max(1, g.count)
        };
      });

      const totalOpsCount = operationsBreakdown.reduce((s, op) => s + op.count, 0);
      const todayDate = new Date();
      const invoiceNumber = `INV-${todayDate.getFullYear()}${(todayDate.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

      return res.json({
        timeframe,
        timeframe_label: timeframeLabel,
        start_date: timeframe === 'custom' ? customStartDate : startTime.toISOString().split('T')[0],
        end_date: now.toISOString().split('T')[0],
        total_tokens: totalTokens,
        prompt_tokens: promptTokens,
        candidates_tokens: candidatesTokens,
        cached_tokens: cachedTokens,
        total_operations_count: totalOpsCount,
        total_cost_usd: totalCostUsd,
        total_cost_egp: totalCostEgp,
        total_cost_sar: totalCostSar,
        avg_cost_per_operation_egp: totalCostEgp / Math.max(1, totalOpsCount),
        avg_cost_per_student_egp: operationsBreakdown[0]?.cost_egp / Math.max(1, operationsBreakdown[0]?.count || 1),
        operations_breakdown: operationsBreakdown,
        daily_trends: [],
        recent_logs: matchingLogs.slice(0, 50),
        pricing_rates: {
          model_name: isUserPro ? 'Gemini 3.1 Pro (6x Outputs 👑)' : 'gemini-3.8-flash',
          input_per_million_usd: inRate,
          output_per_million_usd: outRate,
          cached_per_million_usd: cachedRate,
          usd_to_egp_rate: usdToEgp,
          usd_to_sar_rate: 3.75
        },
        invoice_number: invoiceNumber,
        invoice_issue_date: todayDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
        user_info: {
          id: requestedUserId || 'usr',
          name: userData?.name || 'المعلم الفاضل',
          email: userData?.email || 'teacher@exam-platform.com',
          phone: userData?.phone || 'غير مسجل',
          subject: userData?.subject || 'مدرس المادة',
          role: userData?.role || 'teacher',
          subscription_plan: userData?.subscription_type || 'باقة المعلم الفعالة',
          tokens_used_total: Number(userData?.tokens_used || totalTokens),
          total_plan_tokens: (userData?.custom_tokens_millions ? userData.custom_tokens_millions * 1000000 : 1000000),
          remaining_tokens: Math.max(0, (userData?.custom_tokens_millions ? userData.custom_tokens_millions * 1000000 : 1000000) - Number(userData?.tokens_used || totalTokens))
        }
      });
    } catch (err: any) {
      console.error('Token billing summary error:', err);
      return res.status(500).json({ error: 'فشل استخراج تقرير الفاتورة والتوكينز' });
    }
  });

  // --- Dedicated Teacher Avatar Generator (Authenticated) ---
  app.post('/api/ai/avatar', authenticateFirebaseUser, verifyAppCheckOptional, async (req: any, res: any) => {
    try {
      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
      if (!checkIpRateLimit(String(clientIp), 15)) {
        return res.status(429).json({ error: 'تم تجاوز حد الطلبات المسموح به. يرجى الانتظار دقيقة.' });
      }

      const { name, subject, gradeLevel, avatarData: uploadedAvatarData } = req.body;

      const avatarTask = async () => {
        return await callGeminiWithBackoff(async () => {
          const ai = getGeminiClient();
          const parts: any[] = [
            {
              text: `Create a professional, friendly, and attractive 3D cartoon style avatar of a teacher named ${name || 'المعلم'} who teaches ${subject || 'المادة'} for ${gradeLevel || 'الطلاب'}. The image should include subtle elements related to ${subject || 'التعليم'}. Clean background, high quality, vibrant colors. ${uploadedAvatarData ? "Use the provided image as a reference for the teacher's appearance." : ""}`,
            }
          ];

          if (uploadedAvatarData) {
            const base64Match = uploadedAvatarData.match(/^data:(image\/\w+);base64,(.+)$/);
            if (base64Match) {
              parts.push({
                inlineData: {
                  mimeType: base64Match[1],
                  data: base64Match[2]
                }
              });
            }
          }

          const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image',
            contents: { parts },
            config: {
              imageConfig: {
                aspectRatio: "1:1",
                imageSize: "512px"
              }
            }
          });

          let generatedAvatar = '';
          for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              generatedAvatar = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
              break;
            }
          }

          return generatedAvatar;
        }, 3);
      };

      const generatedAvatar = await geminiConcurrencyQueue.execute(avatarTask);

      if (generatedAvatar) {
        await adminDb.collection('users').doc(req.user.uid).set({
          avatar_data: generatedAvatar
        }, { merge: true });
      }

      res.json({ avatarData: generatedAvatar || uploadedAvatarData || '' });
    } catch (err: any) {
      console.warn("Avatar generation error:", err);
      const is429 = err.status === 429 || err.message?.includes('429') || err.message?.includes('Quota');
      res.status(is429 ? 429 : 500).json({ 
        error: is429 ? 'خوادم توليد الصور مشغولة حالياً، يرجى المحاولة بعد قليل.' : ('تعذر توليد الصورة الرمزية: ' + (err.message || 'خطأ غير معروف'))
      });
    }
  });

  // --- Sync Firebase Custom Claims based on Firestore Document ---
  app.post('/api/auth/sync-claims', authenticateFirebaseUser, async (req: any, res: any) => {
    try {
      let userData: any = null;
      try {
        const userDoc = await adminDb.collection('users').doc(req.user.uid).get();
        userData = userDoc.exists ? userDoc.data() : null;
      } catch (dbErr: any) {
        console.warn('adminDb query warning in sync-claims:', dbErr?.message);
      }
      
      const adminEmail = (process.env.ADMIN_EMAIL || 'gergesnabil101@gmail.com').toLowerCase().trim();
      const isConfigAdmin = req.user.email && req.user.email.toLowerCase().trim() === adminEmail;
      const isAdmin = (userData && userData.role === 'admin') || isConfigAdmin;
      
      const role = isAdmin ? 'admin' : (userData?.role || 'user');

      try {
        await adminAuth.setCustomUserClaims(req.user.uid, {
          role,
          admin: isAdmin
        });
      } catch (authErr: any) {
        console.warn('adminAuth setCustomUserClaims notice (IAM restricted):', authErr?.message);
      }

      if (isAdmin && userData && userData.role !== 'admin') {
        try {
          await adminDb.collection('users').doc(req.user.uid).set({
            role: 'admin'
          }, { merge: true });
        } catch (dbSetErr: any) {
          console.warn('adminDb update role notice:', dbSetErr?.message);
        }
      }

      res.json({
        success: true,
        uid: req.user.uid,
        role,
        admin: isAdmin
      });
    } catch (err: any) {
      console.warn('Notice in sync-claims endpoint:', err?.message);
      res.json({
        success: true,
        uid: req.user?.uid,
        role: req.user?.email === 'gergesnabil101@gmail.com' ? 'admin' : 'user',
        admin: req.user?.email === 'gergesnabil101@gmail.com'
      });
    }
  });

  // --- Admin API: Manage User Role & Claims ---
  app.post('/api/admin/set-user-role', authenticateFirebaseUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { targetUid, role } = req.body;
      if (!targetUid || !role) {
        return res.status(400).json({ error: 'targetUid and role are required' });
      }

      const isAdmin = role === 'admin';
      try {
        await adminAuth.setCustomUserClaims(targetUid, {
          role,
          admin: isAdmin
        });
      } catch (authErr: any) {
        console.warn('adminAuth setCustomUserClaims notice:', authErr?.message);
      }

      try {
        await adminDb.collection('users').doc(targetUid).set({
          role
        }, { merge: true });
      } catch (dbErr: any) {
        console.warn('adminDb set role notice:', dbErr?.message);
      }

      res.json({ success: true, targetUid, role, admin: isAdmin });
    } catch (err: any) {
      console.warn('Error setting user role:', err?.message);
      res.status(500).json({ error: 'فشل تعديل الصلاحيات: ' + err.message });
    }
  });

  // --- Admin API: Deep Audit User Token Usage ---
  app.get('/api/admin/audit-user', authenticateFirebaseUser, requireAdmin, async (req: any, res: any) => {
    try {
      const email = String(req.query.email || '').toLowerCase().trim();
      if (!email) return res.status(400).json({ error: 'email query param is required' });

      let targetUserDoc: any = null;
      let targetUserId = '';
      try {
        const uSnap = await adminDb.collection('users').where('email', '==', email).get();
        if (!uSnap.empty) {
          targetUserDoc = uSnap.docs[0].data();
          targetUserId = uSnap.docs[0].id;
        } else {
          const allU = await adminDb.collection('users').get();
          for (const d of allU.docs) {
            if ((d.data().email || '').toLowerCase().trim() === email) {
              targetUserDoc = d.data();
              targetUserId = d.id;
              break;
            }
          }
        }
      } catch (err: any) {
        return res.status(500).json({ error: 'Firestore error fetching user: ' + err.message });
      }

      if (!targetUserDoc) {
        return res.status(404).json({ error: 'User not found in Firestore users collection' });
      }

      // Quizzes
      let quizzes: any[] = [];
      try {
        const qSnap = await adminDb.collection('quizzes').where('user_id', '==', targetUserId).get();
        quizzes = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e: any) {
        console.warn('Error fetching quizzes:', e.message);
      }

      // Results for user's quizzes
      let results: any[] = [];
      try {
        for (const q of quizzes) {
          const rSnap = await adminDb.collection('results').where('quiz_id', '==', q.id).get();
          rSnap.docs.forEach(d => results.push({ id: d.id, quiz_title: q.title, ...d.data() }));
        }
      } catch (e: any) {
        console.warn('Error fetching results:', e.message);
      }

      // Token logs
      let tokenLogs: any[] = [];
      try {
        const lSnap = await adminDb.collection('token_usage_logs').where('user_id', '==', targetUserId).get();
        tokenLogs = lSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e: any) {
        console.warn('Error fetching logs by id:', e.message);
      }

      try {
        const lEmailSnap = await adminDb.collection('token_usage_logs').where('user_email', '==', email).get();
        lEmailSnap.docs.forEach(d => {
          if (!tokenLogs.some(tl => tl.id === d.id)) {
            tokenLogs.push({ id: d.id, ...d.data() });
          }
        });
      } catch (e: any) {
        console.warn('Error fetching logs by email:', e.message);
      }

      // Also include in-memory token logs from server
      const memLogs = inMemoryTokenLogs.filter(l => 
        l.user_id === targetUserId || (l.user_email && l.user_email.toLowerCase().trim() === email)
      );

      return res.json({
        userId: targetUserId,
        userData: targetUserDoc,
        quizzesCount: quizzes.length,
        quizzes: quizzes.map(q => ({
          id: q.id,
          title: q.title,
          created_at: q.created_at,
          ai_tokens_used: q.ai_tokens_used
        })),
        resultsCount: results.length,
        resultsAiTokensTotal: results.reduce((acc, r) => acc + (Number(r.ai_tokens_used) || 0), 0),
        tokenLogsCount: tokenLogs.length,
        inMemoryLogsCount: memLogs.length,
        logsTotalTokens: tokenLogs.reduce((acc, l) => acc + (Number(l.total_tokens) || 0), 0),
        tokenLogsSample: tokenLogs.slice(0, 10).map(l => ({
          timestamp: l.timestamp,
          operation: l.operation,
          operation_label: l.operation_label,
          total_tokens: l.total_tokens,
          prompt_tokens: l.prompt_tokens,
          candidates_tokens: l.candidates_tokens,
          quiz_title: l.quiz_title,
          student_name: l.student_name
        }))
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Helper: parse raw Firestore REST document format
  function parseFirestoreRestDoc(docItem: any): any {
    if (!docItem) return null;
    const nameParts = (docItem.name || '').split('/');
    const id = nameParts[nameParts.length - 1];
    const fields = docItem.fields || {};
    const obj: any = { id };

    const parseVal = (v: any): any => {
      if (!v) return null;
      if (v.stringValue !== undefined) return v.stringValue;
      if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
      if (v.doubleValue !== undefined) return parseFloat(v.doubleValue);
      if (v.booleanValue !== undefined) return v.booleanValue;
      if (v.timestampValue !== undefined) return v.timestampValue;
      if (v.nullValue !== undefined) return null;
      if (v.arrayValue !== undefined) {
        return (v.arrayValue.values || []).map((x: any) => parseVal(x));
      }
      if (v.mapValue !== undefined) {
        const out: any = {};
        for (const [k, val] of Object.entries(v.mapValue.fields || {})) {
          out[k] = parseVal(val);
        }
        return out;
      }
      return null;
    };

    for (const [key, valObj] of Object.entries(fields) as any) {
      obj[key] = parseVal(valObj);
    }
    return obj;
  }

  // --- Robust JSON-backed User Storage Helpers ---
  const USERS_JSON_PATH = path.join(process.cwd(), 'data', 'registered_users.json');

  function getRegisteredUsersJson(): any[] {
    try {
      if (!fs.existsSync(path.dirname(USERS_JSON_PATH))) {
        fs.mkdirSync(path.dirname(USERS_JSON_PATH), { recursive: true });
      }
      if (fs.existsSync(USERS_JSON_PATH)) {
        const data = fs.readFileSync(USERS_JSON_PATH, 'utf-8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Error reading registered_users.json:', e);
    }
    // Default seed including engy00nabil1@gmail.com
    return [
      {
        id: 'engy00nabil1_uid',
        uid: 'engy00nabil1_uid',
        email: 'engy00nabil1@gmail.com',
        name: 'إنجي نبيل',
        role: 'user',
        subscription_status: 'trial',
        subscription_type: '200',
        is_suspended: false,
        hasAccess: true,
        tokens_used: 0,
        tokens_used_today: 0,
        tokens_used_total: 0,
        created_at: '2026-10-02T10:00:00.000Z'
      }
    ];
  }

  function saveRegisteredUserToJson(userData: any) {
    try {
      const list = getRegisteredUsersJson();
      const uEmail = (userData.email || '').toLowerCase().trim();
      const uId = (userData.id || userData.uid || '').trim();
      const idx = list.findIndex(u => (uId && (u.id === uId || u.uid === uId)) || (uEmail && u.email && u.email.toLowerCase().trim() === uEmail));
      
      if (idx >= 0) {
        const existing = list[idx];
        // Strictly preserve the earliest valid creation date so trial period never resets to today!
        const existingCreatedAt = existing.created_at || existing.createdAt;
        const newCreatedAt = userData.created_at || userData.createdAt;
        let preservedCreatedAt = existingCreatedAt || newCreatedAt;
        if (existingCreatedAt && newCreatedAt) {
          const tOld = new Date(existingCreatedAt).getTime();
          const tNew = new Date(newCreatedAt).getTime();
          if (!isNaN(tOld) && !isNaN(tNew)) {
            preservedCreatedAt = tOld <= tNew ? existingCreatedAt : newCreatedAt;
          }
        }

        // Token usage handling:
        // If an explicit reset is requested (new cycle, plan activation, or reset_tokens flag), allow tokens_used to reset to userData.tokens_used
        const isExplicitTokenReset = userData.reset_tokens === true || 
          (userData.tokens_used !== undefined && (
            userData.tokens_used === 0 || 
            (userData.subscription_type && userData.subscription_type !== existing.subscription_type) || 
            (userData.subscription_start_date && userData.subscription_start_date !== existing.subscription_start_date)
          ));

        const finalTokensUsed = isExplicitTokenReset
          ? (Number(userData.tokens_used) || 0)
          : Math.max(Number(existing.tokens_used) || 0, Number(userData.tokens_used) || 0);

        const maxTokensTotal = Math.max(
          Number(existing.tokens_used_total) || 0,
          Number(userData.tokens_used_total) || 0,
          finalTokensUsed
        );

        // Honor explicit updates for suspension and status
        const isSuspended = userData.is_suspended !== undefined ? !!userData.is_suspended : (existing.is_suspended || false);
        const subStatus = userData.subscription_status !== undefined ? userData.subscription_status : (existing.subscription_status || 'trial');

        list[idx] = {
          ...existing,
          ...userData,
          tokens_used: finalTokensUsed,
          tokens_used_total: maxTokensTotal,
          is_suspended: isSuspended,
          subscription_status: subStatus,
          hasAccess: isSuspended ? false : (subStatus === 'active' || subStatus === 'trial'),
          created_at: preservedCreatedAt || new Date().toISOString()
        };
      } else {
        list.push(userData);
      }
      if (!fs.existsSync(path.dirname(USERS_JSON_PATH))) {
        fs.mkdirSync(path.dirname(USERS_JSON_PATH), { recursive: true });
      }
      fs.writeFileSync(USERS_JSON_PATH, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Error saving to registered_users.json:', e);
    }
  }

  // --- Persistent Deleted Users Registry & Clean Deletion Helpers ---
  const DELETED_USERS_JSON_PATH = path.join(process.cwd(), 'data', 'deleted_users.json');

  function getDeletedUsersJson(): any[] {
    try {
      if (!fs.existsSync(path.dirname(DELETED_USERS_JSON_PATH))) {
        fs.mkdirSync(path.dirname(DELETED_USERS_JSON_PATH), { recursive: true });
      }
      if (fs.existsSync(DELETED_USERS_JSON_PATH)) {
        const data = fs.readFileSync(DELETED_USERS_JSON_PATH, 'utf-8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Error reading deleted_users.json:', e);
    }
    return [];
  }

  function recordDeletedUserJson(userId: string, email?: string, name?: string) {
    try {
      const list = getDeletedUsersJson();
      const uId = (userId || '').trim();
      const uEmail = (email || '').toLowerCase().trim();
      if (!list.some(d => (uId && (d.id === uId || d.uid === uId)) || (uEmail && d.email && d.email.toLowerCase().trim() === uEmail))) {
        list.push({
          id: uId,
          uid: uId,
          email: uEmail,
          name: name || '',
          deleted_at: new Date().toISOString()
        });
        if (!fs.existsSync(path.dirname(DELETED_USERS_JSON_PATH))) {
          fs.mkdirSync(path.dirname(DELETED_USERS_JSON_PATH), { recursive: true });
        }
        fs.writeFileSync(DELETED_USERS_JSON_PATH, JSON.stringify(list, null, 2), 'utf-8');
      }
    } catch (e) {
      console.warn('Error recording deleted user:', e);
    }
  }

  function isUserDeleted(userId: string, email?: string): boolean {
    try {
      const list = getDeletedUsersJson();
      const uId = (userId || '').trim();
      const uEmail = (email || '').toLowerCase().trim();
      return list.some(d => (uId && (d.id === uId || d.uid === uId)) || (uEmail && d.email && d.email.toLowerCase().trim() === uEmail));
    } catch (e) {
      return false;
    }
  }

  function removeUserFromJson(userId: string, email?: string) {
    try {
      const list = getRegisteredUsersJson();
      const uId = (userId || '').trim();
      const uEmail = (email || '').toLowerCase().trim();
      const filtered = list.filter(u => {
        const matchId = uId && (u.id === uId || u.uid === uId);
        const matchEmail = uEmail && u.email && u.email.toLowerCase().trim() === uEmail;
        return !(matchId || matchEmail);
      });
      if (filtered.length !== list.length) {
        if (!fs.existsSync(path.dirname(USERS_JSON_PATH))) {
          fs.mkdirSync(path.dirname(USERS_JSON_PATH), { recursive: true });
        }
        fs.writeFileSync(USERS_JSON_PATH, JSON.stringify(filtered, null, 2), 'utf-8');
      }
    } catch (e) {
      console.warn('Error removing user from registered_users.json:', e);
    }
  }

  function parseSafeDateServer(val: any, fallback: Date = new Date()): Date {
    if (!val) return fallback;
    try {
      if (val instanceof Date) return isNaN(val.getTime()) ? fallback : val;
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
          const dn = new Date(num);
          if (!isNaN(dn.getTime())) return dn;
        }
      }
    } catch (e) {}
    return fallback;
  }

  // --- Master Function to Audit, Reconcile, and Sync All Accounts Across All Collections & Sources ---
  async function auditAndSyncAllPlatformUsersServer() {
    const usersMap = new Map<string, any>();
    const existingInUsersCol = new Set<string>();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    let newlyAddedToFirestore = 0;

    // Load deleted users tombstone from Firestore to guarantee 100% synchronization
    try {
      const delSnap = await adminDb.collection('deleted_users').get();
      delSnap.forEach(d => {
        const dData = d.data() || {};
        recordDeletedUserJson(d.id, dData.email, dData.name);
        removeUserFromJson(d.id, dData.email);
      });
    } catch (_) {}

    // 0. Load from JSON storage first (guaranteed persistence & fallback)
    try {
      const jsonUsers = getRegisteredUsersJson();
      jsonUsers.forEach(u => {
        const uId = u.id || u.uid;
        const uEmail = (u.email || '').toLowerCase().trim();
        if (isUserDeleted(uId, uEmail)) {
          removeUserFromJson(uId, uEmail);
          return;
        }
        if (uId) usersMap.set(uId, u);
        if (uEmail) usersMap.set(uEmail, u);
      });
    } catch (e) {
      console.warn('Notice loading registered_users.json in audit:', e);
    }

    // 1. Query Admin SDK Firestore 'users' collection
    try {
      const snap = await adminDb.collection('users').get();
      if (!snap.empty) {
        snap.docs.forEach(d => {
          const uData: any = { id: d.id, uid: d.id, ...d.data() };
          const uId = d.id;
          const uEmail = (uData.email || '').toLowerCase().trim();
          existingInUsersCol.add(uId);
          if (uEmail) existingInUsersCol.add(uEmail);

          if (uId) {
            const existing = usersMap.get(uId) || (uEmail && usersMap.get(uEmail));
            usersMap.set(uId, existing ? { ...existing, ...uData } : uData);
          }
          if (uEmail) {
            usersMap.set(uEmail, usersMap.get(uId) || uData);
          }
        });
      }
    } catch (adminDbErr: any) {
      console.warn('Admin DB users fetch notice in audit:', adminDbErr?.message);
    }

    // 2. Query Firebase Auth users only if explicit service account credentials exist
    // In client-only or sandbox environments without service account keys, adminAuth.listUsers hangs for 25000ms.
    const hasServiceAccount = Boolean(
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
      (process.env.FIREBASE_CONFIG && process.env.FIREBASE_CONFIG.includes('private_key'))
    );

    if (hasServiceAccount) {
      try {
        let nextPageToken: string | undefined = undefined;
        let loopCount = 0;
        do {
          loopCount++;
          if (loopCount > 10) break;
          const listUsersPromise = adminAuth.listUsers(1000, nextPageToken);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout of 2000ms')), 2000));
          const listUsersResult: any = await Promise.race([listUsersPromise, timeoutPromise]);
          if (Array.isArray(listUsersResult.users)) {
            listUsersResult.users.forEach((uRecord: any) => {
              const uId = uRecord.uid;
              const uEmail = (uRecord.email || '').toLowerCase().trim();
              const existing = (uId && usersMap.get(uId)) || (uEmail && usersMap.get(uEmail));

              if (!existing) {
                const synthUser = {
                  id: uId,
                  uid: uId,
                  name: uRecord.displayName || (uEmail ? uEmail.split('@')[0] : 'مشترك جديد'),
                  email: uEmail,
                  phone: uRecord.phoneNumber || '',
                  role: uEmail === 'gergesnabil101@gmail.com' ? 'admin' : 'user',
                  subscription_status: 'trial',
                  subscription_type: '200',
                  is_suspended: uRecord.disabled || false,
                  hasAccess: true,
                  created_at: uRecord.metadata?.creationTime || now.toISOString(),
                  tokens_used: 0,
                  tokens_used_today: 0,
                  tokens_used_total: 0,
                  last_token_reset_date: todayStr
                };
                usersMap.set(uId, synthUser);
                if (uEmail) usersMap.set(uEmail, synthUser);
              } else {
                // Enrich with Auth data if missing
                if (!existing.email && uEmail) existing.email = uEmail;
                if (!existing.name && uRecord.displayName) existing.name = uRecord.displayName;
                if (!existing.phone && uRecord.phoneNumber) existing.phone = uRecord.phoneNumber;
                if (!existing.created_at && uRecord.metadata?.creationTime) existing.created_at = uRecord.metadata.creationTime;
              }
            });
          }
          nextPageToken = listUsersResult.pageToken;
        } while (nextPageToken);
      } catch (authErr: any) {
        // Silently skip if auth listUsers is not available in sandbox
      }
    }

    // 3. Query public_profiles to ensure every registered teacher identity is discovered
    try {
      const pubSnap = await adminDb.collection('public_profiles').get();
      if (!pubSnap.empty) {
        pubSnap.docs.forEach(d => {
          const pData = d.data();
          const pId = d.id;
          const pEmail = (pData.email || '').toLowerCase().trim();
          const existing = (pId && usersMap.get(pId)) || (pEmail && usersMap.get(pEmail));
          if (!existing) {
            const synthUser = {
              id: pId,
              uid: pId,
              name: pData.name || 'مشترك جديد',
              email: pEmail,
              subject: pData.subject || '',
              grade_level: pData.grade_level || pData.gradeLevel || [],
              avatar_data: pData.avatar_data || '',
              role: 'user',
              subscription_status: 'trial',
              subscription_type: '200',
              is_suspended: false,
              hasAccess: true,
              created_at: pData.created_at || pData.updated_at || now.toISOString(),
              tokens_used: 0,
              tokens_used_today: 0,
              tokens_used_total: 0,
              last_token_reset_date: todayStr
            };
            if (pId) usersMap.set(pId, synthUser);
            if (pEmail) usersMap.set(pEmail, synthUser);
          } else {
            if (pData.name && !existing.name) existing.name = pData.name;
            if (pData.subject && !existing.subject) existing.subject = pData.subject;
            if (pData.grade_level && (!existing.grade_level || existing.grade_level.length === 0)) existing.grade_level = pData.grade_level;
          }
        });
      }
    } catch (pubErr: any) {
      console.warn('Admin DB public_profiles fetch notice in audit:', pubErr?.message);
    }

    // 4. Query subscription_requests to discover users who requested subscriptions
    try {
      const reqSnap = await adminDb.collection('subscription_requests').get();
      if (!reqSnap.empty) {
        reqSnap.docs.forEach(d => {
          const rData = d.data();
          const rEmail = (rData.user_email || rData.email || '').toLowerCase().trim();
          const rUid = rData.user_id || rData.userId || d.id;
          const existing = (rUid && usersMap.get(rUid)) || (rEmail && usersMap.get(rEmail));
          if (!existing && (rEmail || rUid)) {
            const synthUser = {
              id: rUid,
              uid: rUid,
              name: rData.user_name || rData.name || (rEmail ? rEmail.split('@')[0] : 'مشترك جديد'),
              email: rEmail,
              phone: rData.user_phone || rData.phone || '',
              subject: rData.user_subject || rData.subject || '',
              role: 'user',
              subscription_status: rData.status === 'approved' ? 'active' : 'trial',
              subscription_type: rData.plan || '200',
              is_suspended: false,
              hasAccess: true,
              isPendingRequestOnly: rData.status !== 'approved',
              requestId: d.id,
              created_at: rData.created_at || now.toISOString(),
              tokens_used: 0,
              tokens_used_today: 0,
              tokens_used_total: 0,
              last_token_reset_date: todayStr
            };
            if (rUid) usersMap.set(rUid, synthUser);
            if (rEmail) usersMap.set(rEmail, synthUser);
          } else if (existing) {
            if (rData.user_phone && !existing.phone) existing.phone = rData.user_phone;
            if (rData.user_subject && !existing.subject) existing.subject = rData.user_subject;
            if (rData.status === 'approved') existing.subscription_status = 'active';
          }
        });
      }
    } catch (reqErr: any) {
      console.warn('Admin DB subscription_requests fetch notice in audit:', reqErr?.message);
    }

    // 5. Query quizzes to discover any teachers who created exams
    try {
      const qSnap = await adminDb.collection('quizzes').get();
      if (!qSnap.empty) {
        qSnap.docs.forEach(d => {
          const qd = d.data();
          const qUserId = qd.user_id || qd.teacher_id;
          const qEmail = (qd.teacher_email || '').toLowerCase().trim();
          const existing = (qUserId && usersMap.get(qUserId)) || (qEmail && usersMap.get(qEmail));
          if (!existing && (qUserId || qEmail)) {
            const synthUser = {
              id: qUserId || qEmail,
              uid: qUserId || qEmail,
              name: qd.teacher_name || 'معلم (منشئ اختبارات)',
              email: qEmail,
              subject: qd.subject || '',
              grade_level: qd.grade_level ? [qd.grade_level] : [],
              role: 'user',
              subscription_status: 'trial',
              subscription_type: '200',
              is_suspended: false,
              hasAccess: true,
              created_at: qd.created_at || now.toISOString(),
              tokens_used: 0,
              tokens_used_today: 0,
              tokens_used_total: 0,
              last_token_reset_date: todayStr
            };
            if (qUserId) usersMap.set(qUserId, synthUser);
            if (qEmail) usersMap.set(qEmail, synthUser);
          }
        });
      }
    } catch (qErr: any) {
      console.warn('Admin DB quizzes fetch notice in audit:', qErr?.message);
    }

    // 6. Query results to discover any teachers referenced in exam results
    try {
      const resSnap = await adminDb.collection('results').limit(10000).get();
      if (!resSnap.empty) {
        resSnap.docs.forEach(d => {
          const rd = d.data();
          const tId = rd.teacher_id || rd.user_id;
          const tEmail = (rd.teacher_email || '').toLowerCase().trim();
          const existing = (tId && usersMap.get(tId)) || (tEmail && usersMap.get(tEmail));
          if (!existing && (tId || tEmail)) {
            const synthUser = {
              id: tId || tEmail,
              uid: tId || tEmail,
              name: rd.teacher_name || 'معلم',
              email: tEmail,
              subject: rd.subject || '',
              role: 'user',
              subscription_status: 'trial',
              subscription_type: '200',
              is_suspended: false,
              hasAccess: true,
              created_at: rd.created_at || now.toISOString(),
              tokens_used: 0,
              tokens_used_today: 0,
              tokens_used_total: 0,
              last_token_reset_date: todayStr
            };
            if (tId) usersMap.set(tId, synthUser);
            if (tEmail) usersMap.set(tEmail, synthUser);
          }
        });
      }
    } catch (rErr: any) {
      console.warn('Admin DB results scan notice in audit:', rErr?.message);
    }

    // 7. Query token_usage_logs for any active user/teacher activity
    try {
      const tokenSnap = await adminDb.collection('token_usage_logs').limit(10000).get();
      if (!tokenSnap.empty) {
        tokenSnap.docs.forEach(d => {
          const tData = d.data();
          const tEmail = (tData.user_email || '').toLowerCase().trim();
          const tUid = tData.user_id;
          const existing = (tUid && usersMap.get(tUid)) || (tEmail && usersMap.get(tEmail));
          if (!existing && (tEmail || tUid)) {
            const synthUser = {
              id: tUid || tEmail,
              uid: tUid || tEmail,
              name: tData.user_name || (tEmail ? tEmail.split('@')[0] : 'معلم نشط'),
              email: tEmail,
              role: 'user',
              subscription_status: 'trial',
              subscription_type: '200',
              is_suspended: false,
              hasAccess: true,
              created_at: tData.timestamp || now.toISOString(),
              tokens_used: 0,
              tokens_used_today: 0,
              tokens_used_total: 0,
              last_token_reset_date: todayStr
            };
            if (tUid) usersMap.set(tUid, synthUser);
            if (tEmail) usersMap.set(tEmail, synthUser);
          }
        });
      }
    } catch (tokenErr: any) {
      console.warn('Admin DB token_usage_logs fetch notice in audit:', tokenErr?.message);
    }

    // Deduplicate strictly
    const deduplicatedUsers: any[] = [];
    const seenIds = new Set<string>();
    const seenEmails = new Set<string>();

    usersMap.forEach((u) => {
      const uId = (u.id || u.uid || '').trim();
      const uEmail = (u.email || '').toLowerCase().trim();

      if (isUserDeleted(uId, uEmail)) {
        removeUserFromJson(uId, uEmail);
        return;
      }

      if (uId && seenIds.has(uId)) return;
      if (uEmail && seenEmails.has(uEmail)) return;

      if (uId) seenIds.add(uId);
      if (uEmail) seenEmails.add(uEmail);

      const createdAt = parseSafeDateServer(u.created_at || u.createdAt, now);
      u.created_at = createdAt.toISOString();

      deduplicatedUsers.push(u);
    });

    // AUTO-SYNC TO FIRESTORE:
    // For any user not yet stored in Firestore 'users' collection, save them permanently via adminDb
    for (const u of deduplicatedUsers) {
      const uId = u.id || u.uid;
      const uEmail = (u.email || '').toLowerCase().trim();
      const isMissingInFirestore = (uId && !existingInUsersCol.has(uId)) && (!uEmail || !existingInUsersCol.has(uEmail));

      if (isMissingInFirestore && uId) {
        try {
          const docPayload = {
            id: uId,
            uid: uId,
            name: u.name || (uEmail ? uEmail.split('@')[0] : 'مشترك جديد'),
            email: uEmail,
            phone: u.phone || '',
            subject: u.subject || '',
            grade_level: u.grade_level || [],
            avatar_data: u.avatar_data || '',
            role: uEmail === 'gergesnabil101@gmail.com' ? 'admin' : (u.role || 'user'),
            subscription_type: u.subscription_type || '200',
            subscription_end_date: u.subscription_end_date || null,
            subscription_status: u.subscription_status || 'trial',
            is_suspended: !!u.is_suspended,
            hasAccess: u.subscription_status === 'active' || u.subscription_status === 'trial' || !u.is_suspended,
            tokens_used: Number(u.tokens_used) || 0,
            tokens_used_today: Number(u.tokens_used_today) || 0,
            tokens_used_total: Number(u.tokens_used_total) || 0,
            created_at: u.created_at || now.toISOString(),
            last_token_reset_date: u.last_token_reset_date || todayStr
          };
          await adminDb.collection('users').doc(uId).set(docPayload, { merge: true });
          existingInUsersCol.add(uId);
          if (uEmail) existingInUsersCol.add(uEmail);
          newlyAddedToFirestore++;

          // Also populate public_profiles
          await adminDb.collection('public_profiles').doc(uId).set({
            id: uId,
            name: docPayload.name,
            email: docPayload.email,
            subject: docPayload.subject,
            grade_level: docPayload.grade_level,
            updated_at: now.toISOString()
          }, { merge: true });
        } catch (setErr: any) {
          console.warn(`Could not sync user ${uId} to Firestore in audit:`, setErr?.message);
        }
      }

      // Also ensure saved to registered_users.json
      saveRegisteredUserToJson(u);
    }

    // Sort newest on top
    deduplicatedUsers.sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });

    // Calculate category breakdown
    const TRIAL_DAYS_SERVER = 5;
    const trialList = deduplicatedUsers.filter(u => {
      const c = parseSafeDateServer(u.created_at || u.createdAt, now);
      const trialEnd = u.trial_extended_until ? parseSafeDateServer(u.trial_extended_until) : new Date(c.getTime() + TRIAL_DAYS_SERVER * 24 * 60 * 60 * 1000);
      const isPaid = u.subscription_status === 'active' || (u.subscription_end_date && new Date(u.subscription_end_date).getTime() >= now.getTime());
      return !isPaid && !u.is_suspended && (now <= trialEnd || u.isPendingRequestOnly || u.subscription_status === 'pending_approval');
    });

    const activeList = deduplicatedUsers.filter(u => {
      if (u.is_suspended || u.subscription_status === 'inactive' || u.subscription_status === 'cancelled' || u.subscription_status === 'expired') return false;
      const isPaid = u.subscription_status === 'active' || (u.subscription_end_date && new Date(u.subscription_end_date).getTime() >= now.getTime());
      return isPaid || u.role === 'admin' || (u.email && u.email.toLowerCase().trim() === 'gergesnabil101@gmail.com');
    });

    const closedList = deduplicatedUsers.filter(u => {
      if (u.is_suspended || u.subscription_status === 'inactive' || u.subscription_status === 'cancelled' || u.subscription_status === 'expired') return true;
      const isTrial = trialList.some(tu => tu.id === u.id);
      const isActive = activeList.some(au => au.id === u.id);
      return !isTrial && !isActive;
    });

    const newList = deduplicatedUsers.filter(u => {
      const c = parseSafeDateServer(u.created_at || u.createdAt, new Date(0));
      return (now.getTime() - c.getTime()) <= 7 * 24 * 60 * 60 * 1000 || u.isPendingRequestOnly || u.subscription_status === 'pending_approval';
    });

    return {
      users: deduplicatedUsers,
      totalReviewed: deduplicatedUsers.length,
      newlyAddedCount: newlyAddedToFirestore,
      categories: {
        trial: trialList.length,
        active: activeList.length,
        closed: closedList.length,
        new: newList.length
      }
    };
  }

  // --- Admin API: Fetch Users for Platform & Billing Stats with Auto-Audit ---
  app.get('/api/admin/users', authenticateFirebaseUser, requireAdmin, async (req: any, res: any) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    try {
      const result = await auditAndSyncAllPlatformUsersServer();
      return res.json({
        users: result.users,
        totalReviewed: result.totalReviewed,
        newlyAddedCount: result.newlyAddedCount,
        categories: result.categories
      });
    } catch (err: any) {
      console.error('Error in /api/admin/users:', err);
      return res.status(500).json({ error: 'Failed to retrieve users', users: getRegisteredUsersJson() });
    }
  });

  // --- Dedicated Admin API: Review, Audit, Reconcile, and Sync All Accounts ---
  app.post('/api/admin/audit-and-sync-users', authenticateFirebaseUser, requireAdmin, async (req: any, res: any) => {
    try {
      const result = await auditAndSyncAllPlatformUsersServer();
      return res.json({
        success: true,
        message: 'تم تدقيق وفحص ومراجعة كافة الحسابات بنجاح وإضافة أي حسابات مفقودة إلى قاعدة البيانات.',
        users: result.users,
        totalReviewed: result.totalReviewed,
        newlyAddedCount: result.newlyAddedCount,
        categories: result.categories
      });
    } catch (err: any) {
      console.error('Error in /api/admin/audit-and-sync-users:', err);
      return res.status(500).json({ error: 'حدث خطأ أثناء تدقيق ومزامنة الحسابات: ' + (err.message || '') });
    }
  });

  // --- User Profile Registration Endpoint (Fallback / Safe Sync) ---
  app.post('/api/auth/register-profile', authenticateFirebaseUser, async (req: any, res: any) => {
    try {
      const uid = req.user.uid;
      const { name, phone, subject, grade_level, avatar_data } = req.body;
      const email = req.user.email || req.body.email || '';
      
      const userPayload = {
        id: uid,
        uid: uid,
        email: email.trim().toLowerCase(),
        name: (name || '').trim(),
        phone: (phone || '').trim(),
        subject: subject || '',
        grade_level: grade_level || [],
        avatar_data: avatar_data || '',
        role: 'user',
        subscription_type: '200',
        subscription_end_date: null,
        subscription_status: 'trial',
        is_suspended: false,
        hasAccess: true,
        tokens_used: 0,
        tokens_used_today: 0,
        tokens_used_total: 0,
        last_token_reset_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      };
      saveRegisteredUserToJson(userPayload);

      try {
        const userRef = adminDb.collection('users').doc(uid);
        const existing = await userRef.get();
        if (!existing.exists) {
          await userRef.set(userPayload);
        } else {
          await userRef.set({
            name: (name || existing.data()?.name || '').trim(),
            phone: (phone || existing.data()?.phone || '').trim(),
            subject: subject || existing.data()?.subject || '',
            grade_level: grade_level || existing.data()?.grade_level || []
          }, { merge: true });
        }
        await adminDb.collection('public_profiles').doc(uid).set({
          id: uid,
          name: (name || '').trim(),
          email: email.trim().toLowerCase(),
          subject: subject || '',
          grade_level: grade_level || [],
          updated_at: new Date().toISOString()
        }, { merge: true });
      } catch (dbErr: any) {
        console.warn('Server Firestore adminDb sync warning:', dbErr?.message);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('Error in register-profile route:', err);
      res.json({ success: true, warning: err.message });
    }
  });

  // --- Admin Batch Sync Endpoint: Stores platform users into registered_users.json ---
  app.post('/api/admin/save-users-batch', authenticateFirebaseUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { users } = req.body;
      let savedCount = 0;
      if (Array.isArray(users)) {
        users.forEach((u: any) => {
          if (u && (u.id || u.uid || u.email)) {
            saveRegisteredUserToJson(u);
            savedCount++;
          }
        });
      }
      return res.json({ success: true, count: savedCount });
    } catch (err: any) {
      console.warn('Error in save-users-batch:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // --- Dedicated Admin API: Instantly Update Single User State (Suspension, Deactivation, Tokens, Status) ---
  app.post('/api/admin/update-user', authenticateFirebaseUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { userId, email, updates } = req.body;
      if (!userId && !email) {
        return res.status(400).json({ error: 'userId or email is required' });
      }
      const targetPayload = {
        id: userId,
        uid: userId,
        email: email,
        ...(updates || {})
      };
      saveRegisteredUserToJson(targetPayload);

      if (userId) {
        try {
          await adminDb.collection('users').doc(userId).set(updates, { merge: true });
        } catch (dbErr: any) {
          console.warn('adminDb user sync in update-user notice:', dbErr?.message);
        }
      }

      return res.json({ success: true, message: 'User updated successfully' });
    } catch (err: any) {
      console.warn('Error in /api/admin/update-user:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // --- Admin Registration Notification & Automatic Server Sync ---
  app.post('/api/admin/notify-registration', async (req: any, res: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    let caller: any = null;
    if (token && token !== 'null' && token !== 'undefined') {
      try {
        caller = await verifyFirebaseIdToken(token);
      } catch (_) {}
    }
    if (!caller) {
      return res.status(401).json({ error: 'يرجى تسجيل الدخول للوصول إلى هذه الخدمة.' });
    }
    const callerEmail = (caller.email || '').toLowerCase().trim();
    const callerIsAdmin = callerEmail === 'gergesnabil101@gmail.com' || caller.admin === true || caller.role === 'admin';
    const { uid, name, phone, subject, grade_level } = req.body;
    if (!uid || (uid !== caller.uid && !callerIsAdmin)) {
      return res.status(403).json({ error: 'غير مصرح بهذه العملية.' });
    }
    const email = callerIsAdmin ? req.body.email : (caller.email || req.body.email);
    
    if (uid && email) {
      const cleanEmail = email.trim().toLowerCase();
      const userPayload = {
        id: uid,
        uid: uid,
        email: cleanEmail,
        name: (name || '').trim(),
        phone: (phone || '').trim(),
        subject: subject || '',
        grade_level: grade_level || [],
        role: 'user',
        subscription_status: 'trial',
        subscription_type: '200',
        is_suspended: false,
        hasAccess: true,
        tokens_used: 0,
        tokens_used_today: 0,
        tokens_used_total: 0,
        last_token_reset_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      };
      saveRegisteredUserToJson(userPayload);

      try {
        const userRef = adminDb.collection('users').doc(uid);
        const existing = await userRef.get();
        if (!existing.exists) {
          await userRef.set(userPayload);
        }
        await adminDb.collection('public_profiles').doc(uid).set({
          id: uid,
          name: (name || '').trim(),
          email: cleanEmail,
          subject: subject || '',
          grade_level: grade_level || [],
          created_at: new Date().toISOString()
        }, { merge: true });
      } catch (dbErr: any) {
        console.warn('Registration Firestore sync notice:', dbErr?.message);
      }
    }

    sendAdminEmail(
      '✨ مشترك جديد في المنصة',
      `تم تسجيل مشترك جديد:\n\nالاسم: ${name || ''}\nالبريد: ${email || ''}\nالهاتف: ${phone || ''}\nالمادة: ${subject || ''}`
    );
    res.json({ success: true });
  });

  // --- Admin User Password Reset (Supports both /api/admin/reset-user-password and /api/reset-user-password) ---
  const handlePasswordResetRequest = async (req: any, res: any) => {
    try {
      const { targetUid, email, phone, newPassword } = req.body;
      if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
        return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
      }

      const cleanPass = newPassword.trim();
      let reqEmail = (email || '').toString().trim().toLowerCase();
      let updated = false;
      let updatedUid = targetUid;

      // 1. Fetch Firestore user doc if targetUid exists to get any missing fields
      let docData: any = {};
      if (targetUid) {
        try {
          const uDoc = await adminDb.collection('users').doc(targetUid).get();
          if (uDoc.exists) {
            docData = uDoc.data() || {};
          }
        } catch (docErr) {
          console.warn(`Firestore lookup notice for ${targetUid}:`, docErr);
        }
      }

      const effectiveEmail = reqEmail || (docData.email || '').toString().trim().toLowerCase();
      const effectivePhone = phone || docData.phone || '';

      // Attempt 1: Update Auth by targetUid directly
      if (targetUid) {
        try {
          await adminAuth.updateUser(targetUid, { password: cleanPass });
          updated = true;
          updatedUid = targetUid;
        } catch (uidErr: any) {
          console.warn(`Attempt 1 failed for UID ${targetUid}:`, uidErr?.message);
        }
      }

      // Attempt 2: Update Auth by docData.uid if different
      if (!updated && docData.uid && docData.uid !== targetUid) {
        try {
          await adminAuth.updateUser(docData.uid, { password: cleanPass });
          updated = true;
          updatedUid = docData.uid;
        } catch (uidErr: any) {
          console.warn(`Attempt 2 failed for doc UID ${docData.uid}:`, uidErr?.message);
        }
      }

      // Attempt 3: Lookup Auth user by email and update
      if (!updated && effectiveEmail) {
        try {
          const userRec = await adminAuth.getUserByEmail(effectiveEmail);
          await adminAuth.updateUser(userRec.uid, { password: cleanPass });
          updated = true;
          updatedUid = userRec.uid;
        } catch (emailErr: any) {
          console.warn(`Attempt 3 failed for email ${effectiveEmail}:`, emailErr?.message);
        }
      }

      // Attempt 4: User not in Auth yet -> Create new Auth account for them
      if (!updated) {
        const createEmail = effectiveEmail || (effectivePhone ? `${effectivePhone.replace(/[^0-9]/g, '')}@smart-corrector.app` : `user_${targetUid || Date.now()}@smart-corrector.app`);
        try {
          const newAuthUser = await adminAuth.createUser({
            uid: targetUid && !targetUid.includes('/') ? targetUid : undefined,
            email: createEmail,
            password: cleanPass
          });
          updated = true;
          updatedUid = newAuthUser.uid;

          // Save generated email to Firestore user doc for future logins
          if (targetUid) {
            await adminDb.collection('users').doc(targetUid).set({
              email: createEmail,
              updated_at: new Date().toISOString()
            }, { merge: true });
          }
        } catch (createErr: any) {
          console.error('Attempt 4 (account creation) failed:', createErr);
          // If email already in use, try updating by that email
          if (createErr.code === 'auth/email-already-in-use' && createEmail) {
            try {
              const existingRec = await adminAuth.getUserByEmail(createEmail);
              await adminAuth.updateUser(existingRec.uid, { password: cleanPass });
              updated = true;
              updatedUid = existingRec.uid;
            } catch (retryErr: any) {
              return res.status(500).json({ error: 'فشل تعيين كلمة المرور: ' + (retryErr.message || createErr.message) });
            }
          } else {
            return res.status(500).json({ error: 'فشل تعيين كلمة المرور: ' + (createErr.message || 'خطأ غير معروف') });
          }
        }
      }

      if (!updated) {
        return res.status(404).json({ error: 'تعذر تغيير كلمة المرور. يرجى التأكد من صحة بيانات المشترك.' });
      }

      // Sync Firestore timestamp and UID
      if (updatedUid && targetUid) {
        try {
          await adminDb.collection('users').doc(targetUid).set({
            updated_at: new Date().toISOString()
          }, { merge: true });
        } catch (dbErr) {
          console.warn('Firestore update timestamp notice:', dbErr);
        }
      }

      return res.json({ success: true, message: 'تم تغيير كلمة المرور للمستخدم بنجاح' });
    } catch (err: any) {
      console.error('Error resetting user password by admin:', err);
      res.status(500).json({ error: 'فشل تعديل كلمة المرور: ' + (err.message || 'خطأ غير معروف') });
    }
  };

  app.post('/api/admin/reset-user-password', authenticateFirebaseUser, requireAdmin, handlePasswordResetRequest);
  app.post('/api/reset-user-password', authenticateFirebaseUser, requireAdmin, handlePasswordResetRequest);

  // --- Test SMTP Connection (Admin Only) ---
  app.post('/api/test-smtp-connection', authenticateFirebaseUser, requireAdmin, async (req: any, res: any) => {
    try {
      await sendAdminEmail('🧪 تجربة إرسال بريد', 'هذه رسالة تجريبية للتأكد من عمل إعدادات البريد الإلكتروني بنجاح.');
      res.json({ success: true, message: 'تم إرسال بريد تجريبي بنجاح إلى بريد المسؤول.' });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إرسال البريد: ' + (err.message || 'خطأ غير معروف') });
    }
  });

  // --- User Profile (Firestore Single Source of Truth) ---
  app.get('/api/user/profile', authenticateFirebaseUser, async (req: any, res: any) => {
    try {
      const userDoc = await adminDb.collection('users').doc(req.user.uid).get();
      if (userDoc.exists) {
        res.json({ id: userDoc.id, ...userDoc.data() });
      } else {
        res.status(404).json({ error: 'المستخدم غير موجود' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/user/profile', authenticateFirebaseUser, async (req: any, res: any) => {
    try {
      const { name, phone, subject, grade_level, curriculum, avatar_data } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (phone !== undefined) updateData.phone = phone;
      if (subject !== undefined) updateData.subject = subject;
      if (grade_level !== undefined) updateData.grade_level = grade_level;
      if (curriculum !== undefined) updateData.curriculum = curriculum;
      if (avatar_data !== undefined) updateData.avatar_data = avatar_data;

      await adminDb.collection('users').doc(req.user.uid).set(updateData, { merge: true });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Complete Cascading User Deletion (Auth + Firestore + Quizzes + Results + Folders + Logs) ---
  const handleCascadingUserDeletion = async (req: any, res: any) => {
    try {
      const targetUserId = req.params.userId;
      if (!targetUserId) {
        return res.status(400).json({ error: 'targetUserId is required' });
      }

      const reqEmail = (req.user?.email || '').toLowerCase().trim();
      const isSelf = req.user && req.user.uid === targetUserId;
      const isAdmin = req.user && (req.user.admin === true || req.user.role === 'admin' || reqEmail === 'gergesnabil101@gmail.com');

      if (!isSelf && !isAdmin) {
        return res.status(403).json({ error: 'غير مصرح لك بحذف هذا الحساب.' });
      }

      // Extract target details from body or local storage first
      let targetEmail = (req.body?.email || '').toLowerCase().trim();
      let targetName = req.body?.name || '';

      if (!targetEmail || !targetName) {
        try {
          const regUsers = getRegisteredUsersJson();
          const found = regUsers.find((u: any) => u.id === targetUserId || u.uid === targetUserId);
          if (found) {
            if (!targetEmail) targetEmail = (found.email || '').toLowerCase().trim();
            if (!targetName) targetName = found.name || '';
          }
        } catch (_) {}
      }

      // Safe check from Firestore user doc if available
      try {
        const uDoc = await adminDb.collection('users').doc(targetUserId).get();
        if (uDoc && uDoc.exists) {
          const uData = uDoc.data() || {};
          if (!targetEmail) targetEmail = (uData.email || '').toLowerCase().trim();
          if (!targetName) targetName = uData.name || '';
        }
      } catch (_) {
        // Handled silently if adminDb IAM is restricted in sandbox
      }

      // Record in permanent deleted users registry & remove from registered_users.json immediately
      recordDeletedUserJson(targetUserId, targetEmail, targetName);
      removeUserFromJson(targetUserId, targetEmail);

      // Best effort server-side Firestore purge (fully safe and non-blocking)
      try {
        const quizDocRefs: FirebaseFirestore.DocumentReference[] = [];
        const quizIds: string[] = [];

        try {
          const qSnap1 = await adminDb.collection('quizzes').where('user_id', '==', targetUserId).get();
          qSnap1.forEach(d => { quizDocRefs.push(d.ref); quizIds.push(d.id); });
        } catch (_) {}

        try {
          const qSnap2 = await adminDb.collection('quizzes').where('teacher_id', '==', targetUserId).get();
          qSnap2.forEach(d => {
            if (!quizIds.includes(d.id)) {
              quizDocRefs.push(d.ref);
              quizIds.push(d.id);
            }
          });
        } catch (_) {}

        if (targetEmail) {
          try {
            const qSnap3 = await adminDb.collection('quizzes').where('teacher_email', '==', targetEmail).get();
            qSnap3.forEach(d => {
              if (!quizIds.includes(d.id)) {
                quizDocRefs.push(d.ref);
                quizIds.push(d.id);
              }
            });
          } catch (_) {}
        }

        const resultDocRefs: FirebaseFirestore.DocumentReference[] = [];
        const seenResultIds = new Set<string>();
        
        if (quizIds.length > 0) {
          for (let i = 0; i < quizIds.length; i += 10) {
            const chunk = quizIds.slice(i, i + 10);
            try {
              const resultsSnap = await adminDb.collection('results').where('quiz_id', 'in', chunk).get();
              resultsSnap.forEach(doc => {
                if (!seenResultIds.has(doc.id)) {
                  seenResultIds.add(doc.id);
                  resultDocRefs.push(doc.ref);
                }
              });
            } catch (_) {}
          }
        }

        try {
          const directTeacherResults = await adminDb.collection('results').where('teacher_id', '==', targetUserId).get();
          directTeacherResults.forEach(doc => {
            if (!seenResultIds.has(doc.id)) {
              seenResultIds.add(doc.id);
              resultDocRefs.push(doc.ref);
            }
          });
        } catch (_) {}

        try {
          const directUserResults = await adminDb.collection('results').where('user_id', '==', targetUserId).get();
          directUserResults.forEach(doc => {
            if (!seenResultIds.has(doc.id)) {
              seenResultIds.add(doc.id);
              resultDocRefs.push(doc.ref);
            }
          });
        } catch (_) {}

        if (targetEmail) {
          try {
            const emailResults = await adminDb.collection('results').where('teacher_email', '==', targetEmail).get();
            emailResults.forEach(doc => {
              if (!seenResultIds.has(doc.id)) {
                seenResultIds.add(doc.id);
                resultDocRefs.push(doc.ref);
              }
            });
          } catch (_) {}
        }

        const foldersRefs: FirebaseFirestore.DocumentReference[] = [];
        try {
          const foldersSnap = await adminDb.collection('folders').where('user_id', '==', targetUserId).get();
          foldersSnap.forEach(d => foldersRefs.push(d.ref));
        } catch (_) {}

        const subReqsRefs: FirebaseFirestore.DocumentReference[] = [];
        try {
          const sub1 = await adminDb.collection('subscription_requests').where('user_id', '==', targetUserId).get();
          sub1.forEach(d => subReqsRefs.push(d.ref));
        } catch (_) {}

        if (targetEmail) {
          try {
            const sub2 = await adminDb.collection('subscription_requests').where('user_email', '==', targetEmail).get();
            sub2.forEach(d => { if (!subReqsRefs.some(r => r.id === d.id)) subReqsRefs.push(d.ref); });
            const sub3 = await adminDb.collection('subscription_requests').where('email', '==', targetEmail).get();
            sub3.forEach(d => { if (!subReqsRefs.some(r => r.id === d.id)) subReqsRefs.push(d.ref); });
          } catch (_) {}
        }

        const tokenLogRefs: FirebaseFirestore.DocumentReference[] = [];
        try {
          const logs1 = await adminDb.collection('token_usage_logs').where('user_id', '==', targetUserId).get();
          logs1.forEach(d => tokenLogRefs.push(d.ref));
        } catch (_) {}

        if (targetEmail) {
          try {
            const logs2 = await adminDb.collection('token_usage_logs').where('user_email', '==', targetEmail).get();
            logs2.forEach(d => { if (!tokenLogRefs.some(r => r.id === d.id)) tokenLogRefs.push(d.ref); });
          } catch (_) {}
        }

        const studentRefs: FirebaseFirestore.DocumentReference[] = [];
        try {
          const stSnap = await adminDb.collection('students').where('teacher_id', '==', targetUserId).get();
          stSnap.forEach(d => studentRefs.push(d.ref));
        } catch (_) {}

        const allDocRefsToDelete: FirebaseFirestore.DocumentReference[] = [
          ...resultDocRefs,
          ...quizDocRefs,
          ...foldersRefs,
          ...subReqsRefs,
          ...tokenLogRefs,
          ...studentRefs,
          adminDb.collection('users').doc(targetUserId),
          adminDb.collection('public_profiles').doc(targetUserId),
        ];

        for (let i = 0; i < allDocRefsToDelete.length; i += 400) {
          const chunk = allDocRefsToDelete.slice(i, i + 400);
          try {
            const batch = adminDb.batch();
            chunk.forEach(ref => batch.delete(ref));
            await batch.commit();
          } catch (_) {}
        }

        try {
          await adminDb.collection('deleted_users').doc(targetUserId).set({
            id: targetUserId,
            email: targetEmail,
            name: targetName,
            deleted_at: new Date().toISOString()
          }, { merge: true });
        } catch (_) {}
      } catch (adminDbErr) {
        // Silently caught: client Firestore SDK handles direct deletions with authenticated user privileges
      }

      // Delete User from Firebase Authentication
      try {
        await adminAuth.deleteUser(targetUserId);
      } catch (authErr: any) {
        if (authErr?.code !== 'auth/user-not-found') {
          console.warn('Firebase Auth user deletion notice:', authErr?.message);
        }
      }

      return res.json({
        success: true,
        message: 'تم حذف الحساب وكافة البيانات المرتبطة به نهائياً وبشكل قطعي من قاعدة البيانات والمصادقة.'
      });
    } catch (err: any) {
      console.error('Cascading user deletion error:', err?.message);
      return res.status(500).json({ error: 'فشل حذف الحساب والبيانات: ' + (err?.message || '') });
    }
  };

  app.delete('/api/users/:userId', authenticateFirebaseUser, handleCascadingUserDeletion);
  app.post('/api/users/:userId/delete', authenticateFirebaseUser, handleCascadingUserDeletion);

  // --- Student Data Retention & Erasure Endpoints (Privacy & GDPR Compliance) ---

  // 1. Purge all results for a specific quiz
  app.post('/api/quizzes/:id/results/purge', authenticateFirebaseUser, async (req: any, res: any) => {
    try {
      const quizId = req.params.id;
      const quizDoc = await adminDb.collection('quizzes').doc(quizId).get();
      if (!quizDoc.exists) {
        return res.status(404).json({ error: 'الاختبار غير موجود' });
      }

      const quizData = quizDoc.data() as any;
      const isAuthor = req.user && req.user.uid === quizData.user_id;
      const isAdmin = req.user && (req.user.admin === true || req.user.role === 'admin');

      if (!isAuthor && !isAdmin) {
        return res.status(403).json({ error: 'غير مصرح لك بإدارة نتائج هذا الاختبار.' });
      }

      const resultsSnap = await adminDb.collection('results').where('quiz_id', '==', quizId).get();
      if (resultsSnap.empty) {
        return res.json({ success: true, count: 0, message: 'لا توجد نتائج لحذفها.' });
      }

      const batch = adminDb.batch();
      resultsSnap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      return res.json({
        success: true,
        count: resultsSnap.size,
        message: `تم حذف ${resultsSnap.size} من نتائج الطلاب بنجاح وفقاً لطلب المعلم.`
      });
    } catch (err: any) {
      console.error('Purge results error:', err?.message);
      return res.status(500).json({ error: 'فشل حذف نتائج الاختبار: ' + err.message });
    }
  });

  // 2. Anonymize student personal info (Phone numbers and identity) for a specific quiz
  app.post('/api/quizzes/:id/results/anonymize', authenticateFirebaseUser, async (req: any, res: any) => {
    try {
      const quizId = req.params.id;
      const quizDoc = await adminDb.collection('quizzes').doc(quizId).get();
      if (!quizDoc.exists) {
        return res.status(404).json({ error: 'الاختبار غير موجود' });
      }

      const quizData = quizDoc.data() as any;
      const isAuthor = req.user && req.user.uid === quizData.user_id;
      const isAdmin = req.user && (req.user.admin === true || req.user.role === 'admin');

      if (!isAuthor && !isAdmin) {
        return res.status(403).json({ error: 'غير مصرح لك بتعديل بيانات هذا الاختبار.' });
      }

      const resultsSnap = await adminDb.collection('results').where('quiz_id', '==', quizId).get();
      if (resultsSnap.empty) {
        return res.json({ success: true, count: 0, message: 'لا توجد نتائج للتنقيح.' });
      }

      const batch = adminDb.batch();
      let index = 1;
      resultsSnap.forEach(doc => {
        batch.update(doc.ref, {
          parent_phone: null,
          student_name: `طالب مجهول #${index++}`,
          student_answers: '[]' // Wipe detailed student answer raw payloads for privacy
        });
      });
      await batch.commit();

      return res.json({
        success: true,
        count: resultsSnap.size,
        message: `تم تنقيح وحذف أرقام الهواتف وتجهيل بيانات ${resultsSnap.size} طالب لحماية الخصوصية.`
      });
    } catch (err: any) {
      console.error('Anonymize results error:', err?.message);
      return res.status(500).json({ error: 'فشل تنقيح النتائج: ' + err.message });
    }
  });

  // 3. Purge results older than retention period (e.g. 30, 60, 90 days)
  app.post('/api/results/retention/cleanup', authenticateFirebaseUser, async (req: any, res: any) => {
    try {
      const { days = 90 } = req.body;
      const parsedDays = Math.max(1, parseInt(days) || 90);
      const cutoffDate = new Date(Date.now() - parsedDays * 24 * 60 * 60 * 1000).toISOString();

      const isAdmin = req.user && (req.user.admin === true || req.user.role === 'admin');

      let queryRef: FirebaseFirestore.Query = adminDb.collection('results');
      if (!isAdmin) {
        queryRef = queryRef.where('teacher_id', '==', req.user.uid);
      }

      const snap = await queryRef.get();
      const docsToDelete: FirebaseFirestore.DocumentReference[] = [];

      snap.forEach(doc => {
        const data = doc.data();
        if (data.created_at && data.created_at < cutoffDate) {
          docsToDelete.push(doc.ref);
        }
      });

      if (docsToDelete.length === 0) {
        return res.json({
          success: true,
          deletedCount: 0,
          message: `لا توجد نتائج أقدم من ${parsedDays} يوماً.`
        });
      }

      for (let i = 0; i < docsToDelete.length; i += 400) {
        const chunk = docsToDelete.slice(i, i + 400);
        const batch = adminDb.batch();
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
      }

      return res.json({
        success: true,
        deletedCount: docsToDelete.length,
        message: `تم تطبيق سياسة الاحتفاظ وحذف ${docsToDelete.length} نتيجة أقدم من ${parsedDays} يوماً بنجاح.`
      });
    } catch (err: any) {
      console.error('Retention cleanup error:', err?.message);
      return res.status(500).json({ error: 'فشل تطبيق سياسة الاحتفاظ بالبيانات: ' + err.message });
    }
  });

  // --- Subscriptions Approval (Admin Only, Firestore Backend) ---
  app.post('/api/subscription-requests/approve', authenticateFirebaseUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { requestId } = req.body;
      if (!requestId) {
        return res.status(400).json({ error: 'requestId is required' });
      }

      const reqDoc = await adminDb.collection('subscription_requests').doc(requestId).get();
      if (!reqDoc.exists) {
        return res.status(404).json({ error: 'طلب الاشتراك غير موجود' });
      }

      const subRequest = reqDoc.data() as any;
      const userId = subRequest.user_id;
      const plan = subRequest.plan;
      const cycle = subRequest.billing_cycle || 'monthly';
      const days = cycle === 'yearly' ? 365 : 30;

      const userDoc = await adminDb.collection('users').doc(userId).get();
      let baseDate = new Date();
      if (userDoc.exists) {
        const userData = userDoc.data() as any;
        if (userData.subscription_end_date) {
          const parsedDate = new Date(userData.subscription_end_date);
          if (parsedDate > new Date()) {
            baseDate = parsedDate;
          }
        }
      }

      const endDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

      const batch = adminDb.batch();
      batch.update(adminDb.collection('subscription_requests').doc(requestId), {
        status: 'approved'
      });

      const isUpgradeToPro = plan === 'upgrade_to_pro' || subRequest.target_model === 'gemini_pro' || subRequest.plan === 'upgrade_to_pro';
      const isExtraTokens = plan?.startsWith('extra_') || subRequest.extra_tokens || /extra|topup|شحن/i.test(plan);
      if (isUpgradeToPro) {
        batch.set(adminDb.collection('users').doc(userId), {
          preferred_ai_model: 'gemini_pro',
          hasPendingSubscription: false
        }, { merge: true });
      } else if (isExtraTokens) {
        let tokensToAdd = Number(subRequest.extra_tokens) || 1000000;
        if (plan === 'extra_2M_tokens') tokensToAdd = 2000000;
        else if (plan === 'extra_3M_tokens') tokensToAdd = 3000000;
        else if (plan === 'extra_5M_tokens') tokensToAdd = 5000000;
        else if (plan === 'extra_500k_tokens') tokensToAdd = 500000;

        batch.set(adminDb.collection('users').doc(userId), {
          extra_tokens: FieldValue.increment(tokensToAdd),
          hasPendingSubscription: false
        }, { merge: true });
      } else {
        const userUpdateData: any = {
          subscription_status: 'active',
          subscription_type: plan,
          billing_cycle: cycle,
          subscription_end_date: endDate.toISOString(),
          is_suspended: false,
          hasAccess: true,
          hasPendingSubscription: false,
          tokens_used: 0,
          tokens_used_today: 0,
          tokens_used_total: 0,
          last_token_reset_date: new Date().toISOString().split('T')[0]
        };

        const tokenMatch = plan?.match(/token[_\s-]*(\d+(?:\.\d+)?)\s*([mMkK])?/i) || plan?.match(/custom[_\s-]*token[_\s-]*(\d+(?:\.\d+)?)M/i);
        if (tokenMatch) {
          const num = parseFloat(tokenMatch[1]);
          if (num > 0) userUpdateData.custom_tokens_millions = num;
        }

        batch.set(adminDb.collection('users').doc(userId), userUpdateData, { merge: true });
      }

      await batch.commit();
      res.json({ success: true });
    } catch (err: any) {
      console.error('Subscription approval error:', err);
      res.status(500).json({ error: 'فشل تفعيل الاشتراك: ' + err.message });
    }
  });

  // --- Subscriptions Deletion (Admin Only) ---
  app.delete('/api/subscription-requests/:id', authenticateFirebaseUser, requireAdmin, async (req: any, res: any) => {
    try {
      const requestId = req.params.id;
      if (!requestId) {
        return res.status(400).json({ error: 'requestId is required' });
      }
      await adminDb.collection('subscription_requests').doc(requestId).delete();
      res.json({ success: true, message: 'تم حذف طلب الاشتراك بنجاح' });
    } catch (err: any) {
      console.error('Subscription request delete error:', err);
      res.status(500).json({ error: 'فشل حذف الطلب: ' + err.message });
    }
  });

  // --- Stripe Checkout ---
  app.post('/api/stripe/create-checkout', authenticateFirebaseUser, async (req: any, res: any) => {
    const { plan } = req.body;
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe is not configured on this server.' });
    }

    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const priceId = plan === 'yearly' ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY;
      
      if (!priceId) {
        return res.status(500).json({ error: `Price ID for ${plan} is not configured.` });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${process.env.APP_URL || 'http://localhost:3000'}?payment=success`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}?payment=cancelled`,
        client_reference_id: req.user.uid,
        metadata: { plan }
      });

      res.json({ url: session.url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Folders Management (Firestore) ---
  app.get('/api/folders', authenticateFirebaseUser, async (req: any, res: any) => {
    try {
      const snapshot = await adminDb.collection('folders')
        .where('user_id', '==', req.user.uid)
        .get();
      const folders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(folders);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/folders', authenticateFirebaseUser, async (req: any, res: any) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Folder name is required' });
      
      const folderRef = adminDb.collection('folders').doc();
      const folderData = {
        user_id: req.user.uid,
        name,
        created_at: new Date().toISOString()
      };
      await folderRef.set(folderData);
      res.json({ id: folderRef.id, ...folderData });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/folders/:id', authenticateFirebaseUser, async (req: any, res: any) => {
    try {
      const folderDoc = await adminDb.collection('folders').doc(req.params.id).get();
      if (!folderDoc.exists) return res.status(404).json({ error: 'Folder not found' });
      
      const folderData = folderDoc.data() as any;
      if (folderData.user_id !== req.user.uid && !req.user.admin) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      await adminDb.collection('folders').doc(req.params.id).delete();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Quizzes Management (Firestore) ---
  app.get('/api/user/quizzes', authenticateFirebaseUser, async (req: any, res: any) => {
    try {
      const snapshot = await adminDb.collection('quizzes')
        .where('user_id', '==', req.user.uid)
        .get();
      const quizzes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(quizzes);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Secure Quiz Creation & Update (Firestore)
  app.post('/api/quizzes', authenticateFirebaseUser, async (req: any, res: any) => {
    try {
      const userDoc = await adminDb.collection('users').doc(req.user.uid).get();
      const user = userDoc.exists ? userDoc.data() : null;

      const statusCheck = checkTeacherSubscriptionStatus(user);
      if (!statusCheck.allowed) {
        return res.status(403).json({ error: statusCheck.error || 'عذراً، حسابك غير مفعل أو انتهت الباقة. يرجى الاشتراك أو التجديد لإنشاء أو حفظ الاختبارات.' });
      }

      const isSubscribed = req.user.admin || statusCheck.status === 'active' || statusCheck.status === 'admin';
      
      const { id, title, data, folder_id, grade_level, expires_at } = req.body;
      if (!id || !title || !data) {
        return res.status(400).json({ error: 'بيانات الاختبار غير مكتملة' });
      }

      const quizRef = adminDb.collection('quizzes').doc(id);
      const existingQuizDoc = await quizRef.get();

      if (existingQuizDoc.exists) {
        const existingData = existingQuizDoc.data() as any;
        if (existingData.user_id !== req.user.uid && !req.user.admin) {
          return res.status(403).json({ error: 'غير مصرح لك بتعديل اختبار يخص مستخدم آخر' });
        }
      } else if (!isSubscribed && statusCheck.status === 'trial') {
        // Enforce 3 quiz limit for free tier
        const userQuizzesSnap = await adminDb.collection('quizzes').where('user_id', '==', req.user.uid).get();
        if (userQuizzesSnap.size >= 3) {
          return res.status(403).json({ error: 'لقد وصلت للحد الأقصى (3 اختبارات فقط) في الباقة التجريبية المجانية. يرجى الاشتراك للمتابعة.' });
        }
      }

      await quizRef.set({
        id,
        user_id: req.user.uid,
        folder_id: folder_id || null,
        title,
        data,
        grade_level: grade_level || null,
        expires_at: expires_at || null,
        created_at: existingQuizDoc.exists ? (existingQuizDoc.data()?.created_at || new Date().toISOString()) : new Date().toISOString()
      }, { merge: true });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Secure Quiz Deletion
  app.delete('/api/quizzes/:id', authenticateFirebaseUser, async (req: any, res: any) => {
    try {
      const quizRef = adminDb.collection('quizzes').doc(req.params.id);
      const quizDoc = await quizRef.get();
      
      if (!quizDoc.exists) {
        return res.status(404).json({ error: 'الاختبار غير موجود' });
      }

      const quizData = quizDoc.data() as any;
      if (quizData.user_id !== req.user.uid && !req.user.admin) {
        return res.status(403).json({ error: 'غير مصرح لك بحذف هذا الاختبار' });
      }

      // Delete results and quiz
      const resultsSnap = await adminDb.collection('results').where('quiz_id', '==', req.params.id).get();
      const batch = adminDb.batch();
      resultsSnap.forEach(d => batch.delete(d.ref));
      batch.delete(quizRef);
      await batch.commit();

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Helper function to sanitize quiz for students (strip answer keys & model answers)
  const sanitizeQuizForStudent = (quizData: any) => {
    try {
      let parsed: any = null;
      if (typeof quizData.data === 'string') {
        try {
          parsed = JSON.parse(quizData.data);
        } catch {
          parsed = {};
        }
      } else if (typeof quizData.data === 'object' && quizData.data !== null) {
        parsed = JSON.parse(JSON.stringify(quizData.data));
      } else {
        parsed = {};
      }

      const sanitizeQuestion = (q: any) => {
        const sq = { ...q };
        delete sq.correctOptionIndex;
        delete sq.correct_option;
        delete sq.correct_answers;
        delete sq.correct_answer;
        delete sq.correctAnswer;
        delete sq.correctAnswerIndex;
        delete sq.modelAnswer;
        delete sq.model_answer;
        delete sq.correctExample;
        delete sq.explanation;
        delete sq.rubric;
        delete sq.keywords;
        delete sq.idealAnswer;
        delete sq.ideal_answer;
        delete sq.grading_criteria;
        delete sq.criteria;
        return sq;
      };

      if (parsed && Array.isArray(parsed.questions)) {
        parsed.questions = parsed.questions.map(sanitizeQuestion);
      }

      const sanitizedResult = { ...quizData };
      delete sanitizedResult.correct_answers;
      delete sanitizedResult.model_answers;
      delete sanitizedResult.answers;

      if (Array.isArray(sanitizedResult.questions)) {
        sanitizedResult.questions = sanitizedResult.questions.map(sanitizeQuestion);
      }

      return {
        ...sanitizedResult,
        ...(parsed || {}),
        data: JSON.stringify(parsed)
      };
    } catch (e) {
      return quizData;
    }
  };

  // Technical report download endpoint
  app.get('/api/technical-report', (req: any, res: any) => {
    const reportPath = path.join(process.cwd(), 'public', 'technical_report.txt');
    if (fs.existsSync(reportPath)) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="technical_report.txt"');
      res.sendFile(reportPath);
    } else {
      res.status(404).send('التقرير غير موجود');
    }
  });

  // Secure route for getting a quiz (Sanitizes answers for students, exposes full data to author/admin)
  app.get(['/api/quizzes/:id', '/api/quiz/:id'], extractFirebaseUserOptional, async (req: any, res: any) => {
    try {
      const quizId = (req.params.id || '').trim();
      const quizDoc = await adminDb.collection('quizzes').doc(quizId).get();
      if (!quizDoc.exists) {
        return res.status(404).json({ error: 'الاختبار غير موجود' });
      }

      const quizData = quizDoc.data() as any;
      let teacherInfo: any = {};
      if (quizData.user_id) {
        const teacherDoc = await adminDb.collection('users').doc(quizData.user_id).get();
        if (teacherDoc.exists) {
          const t = teacherDoc.data() as any;
          teacherInfo = {
            teacher_name: t.name,
            teacher_subject: t.subject,
            teacher_grade_level: t.grade_level,
            teacher_avatar: t.avatar_data
          };
        }
      }

      const isAuthorOrAdmin = req.user && (req.user.uid === quizData.user_id || req.user.admin === true || req.user.role === 'admin');

      if (isAuthorOrAdmin) {
        let parsedAuthorQuiz: any = {};
        if (typeof quizData.data === 'string') {
          try { parsedAuthorQuiz = JSON.parse(quizData.data); } catch {}
        } else if (typeof quizData.data === 'object' && quizData.data !== null) {
          parsedAuthorQuiz = quizData.data;
        }

        return res.json({
          id: quizDoc.id,
          ...quizData,
          ...parsedAuthorQuiz,
          ...teacherInfo
        });
      }

      // Verify teacher status for student access - block if teacher's trial or subscription is expired
      if (quizData.user_id) {
        const teacherDoc = await adminDb.collection('users').doc(quizData.user_id).get();
        if (teacherDoc.exists) {
          const teacherData = teacherDoc.data() || {};
          const statusCheck = checkTeacherSubscriptionStatus(teacherData);
          if (!statusCheck.allowed) {
            return res.status(403).json({
              error: 'عذراً، هذا الاختبار غير متاح حالياً لأن الفترة التجريبية أو باقة اشتراك المعلم قد انتهت. يرجى من المعلم الاشتراك أو تجديد الباقة لتفعيل الاختبار للطلاب.',
              expired: true,
              teacherName: teacherInfo.teacher_name || teacherData.name || 'المعلم'
            });
          }
        }
      }

      // Sanitize answers for students taking the exam
      const sanitized = sanitizeQuizForStudent(quizData);
      return res.json({
        id: quizDoc.id,
        ...sanitized,
        ...teacherInfo
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public endpoint to check a teacher's subscription/trial status
  app.get(['/api/teachers/:id/status', '/api/teacher/:id/status'], async (req: any, res: any) => {
    try {
      const teacherId = (req.params.id || '').trim();
      if (!teacherId) {
        return res.status(400).json({ active: false, error: 'معرف المعلم غير صالح' });
      }
      const teacherDoc = await adminDb.collection('users').doc(teacherId).get();
      if (!teacherDoc.exists) {
        return res.status(404).json({ active: false, error: 'حساب المعلم غير موجود' });
      }
      const data = teacherDoc.data() || {};
      const statusCheck = checkTeacherSubscriptionStatus(data);
      return res.json({
        active: statusCheck.allowed,
        status: statusCheck.status,
        reason: statusCheck.error,
        teacherName: data.name || ''
      });
    } catch (err: any) {
      res.status(500).json({ active: false, error: err.message });
    }
  });

  // Bot / Turnstile Verification Endpoint
  app.post('/api/verify-bot', verifyAppCheckOptional, async (req: any, res: any) => {
    try {
      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
      const { token, turnstileToken } = req.body;
      const botToken = token || turnstileToken || req.headers['cf-turnstile-response'];
      const result = await verifyTurnstileOrBot(botToken, String(clientIp));
      if (!result.success) {
        return res.status(403).json({ success: false, error: result.error || 'فشل التحقق من الروبوت.' });
      }
      return res.json({ success: true, verified: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Dedicated Check Attempts Endpoint
  app.post(['/api/quizzes/:id/check-attempts', '/api/quiz/:id/check-attempts'], verifyAppCheckOptional, async (req: any, res: any) => {
    try {
      const quizId = req.params.id;
      const { student_name, student_phone, parent_phone, student_code } = req.body;

      let quizDoc;
      try {
        quizDoc = await adminDb.collection('quizzes').doc(quizId).get();
      } catch (docErr: any) {
        console.warn("Check attempts fetch quiz doc warning:", docErr.message);
        // Fallback to allow student entry if adminDb is temporarily unresponsive
        return res.json({
          success: true,
          attemptsCount: 0,
          maxAttempts: 1,
          hasExceeded: false,
          error: null
        });
      }

      if (!quizDoc || !quizDoc.exists) {
        return res.status(404).json({ error: 'الاختبار غير موجود.' });
      }

      const quizData = quizDoc.data() as any;

      // Check teacher subscription status safely
      if (quizData.user_id) {
        try {
          const teacherDoc = await adminDb.collection('users').doc(quizData.user_id).get();
          if (teacherDoc && teacherDoc.exists) {
            const teacherData = teacherDoc.data() || {};
            const statusCheck = checkTeacherSubscriptionStatus(teacherData);
            if (!statusCheck.allowed) {
              return res.status(403).json({
                error: statusCheck.error || 'عذراً، هذا الاختبار غير متاح حالياً لأن الفترة التجريبية أو باقة اشتراك المعلم قد انتهت. يرجى من المعلم الاشتراك أو تجديد الباقة لتفعيل الاختبار للطلاب.',
                expired: true
              });
            }
          }
        } catch (tErr: any) {
          console.warn("Check attempts fetch teacher status warning:", tErr.message);
        }
      }

      let parsedQuiz: any = {};
      try {
        parsedQuiz = typeof quizData.data === 'string' ? JSON.parse(quizData.data) : (quizData.data || {});
      } catch (e) {
        parsedQuiz = {};
      }

      // Check if student code is required for this quiz
      const requireStudentCode = Boolean(parsedQuiz.require_student_code || quizData.require_student_code);
      const studentCodesList: any[] = Array.isArray(parsedQuiz.student_codes) 
        ? parsedQuiz.student_codes 
        : (Array.isArray(quizData.student_codes) ? quizData.student_codes : []);

      if (requireStudentCode) {
        const cleanCode = (student_code || '').toString().trim().toUpperCase();
        if (!cleanCode) {
          return res.status(400).json({ 
            error: 'هذا الاختبار يتطلب إدخال كود الطالب الخاص بك لدخول الاختبار.',
            codeRequired: true 
          });
        }

        let isValidCode = false;
        try {
          const studentsSnap = await adminDb.collection('students').where('code', '==', cleanCode).get();
          if (!studentsSnap.empty) {
            isValidCode = true;
          }
        } catch (e) {
          console.warn("Check students collection by code warning:", e);
        }

        const matchedCodeObj = studentCodesList.find(c => 
          (c.code || '').toString().trim().toUpperCase() === cleanCode
        );

        if (!isValidCode && !matchedCodeObj) {
          return res.status(403).json({ 
            error: 'كود الطالب المدخل غير صحيح أو غير مسجل في قاعدة بيانات طلاب المعلم. يرجى مراجعة معلمك.',
            invalidCode: true 
          });
        }

        // Check if code has already been used in previous submissions for THIS quiz safely
        try {
          const codeResultsSnap = await adminDb.collection('results')
            .where('quiz_id', '==', quizId)
            .where('student_code', '==', cleanCode)
            .get();

          if (!codeResultsSnap.empty || (matchedCodeObj && matchedCodeObj.used)) {
            return res.status(403).json({
              error: `تم استخدام هذا الكود (${cleanCode}) مسبقاً لتقديم هذا الاختبار، ولا يمكن تكرار الدخول به. إذا واجهت مشكلة، يرجى مراجعة معلمك لإعادة تفعيل الكود.`,
              codeAlreadyUsed: true,
              hasExceeded: true
            });
          }
        } catch (codeErr: any) {
          console.warn("Check student_code results warning:", codeErr.message);
        }
      }

      const maxAttempts = (typeof parsedQuiz.maxAttempts === 'number' && parsedQuiz.maxAttempts > 0) ? parsedQuiz.maxAttempts : 1;

      const normStudentName = normalizeArabicText(student_name || '');
      const normStudentPhone = normalizePhoneNumber(student_phone || '');
      const normParentPhone = normalizePhoneNumber(parent_phone || '');

      let attemptsCount = 0;

      // Query results in adminDb safely
      try {
        const resultsSnap = await adminDb.collection('results').where('quiz_id', '==', quizId).get();
        resultsSnap.forEach((docSnap: any) => {
          const data = docSnap.data() || {};
          const rStudentName = normalizeArabicText(data.student_name || '');
          const rStudentPhone = normalizePhoneNumber(data.student_phone || data.phone || '');
          const rParentPhone = normalizePhoneNumber(data.parent_phone || data.phone || '');

          const hasInputPhone = Boolean(normStudentPhone || normParentPhone);
          const hasRecordPhone = Boolean(rStudentPhone || rParentPhone);

          const phoneMatch =
            (normStudentPhone && (normStudentPhone === rStudentPhone || normStudentPhone === rParentPhone)) ||
            (normParentPhone && (normParentPhone === rStudentPhone || normParentPhone === rParentPhone));

          const nameMatch = Boolean(normStudentName && rStudentName && normStudentName === rStudentName && normStudentName !== 'طالب' && normStudentName.length >= 3);

          if (phoneMatch || (!hasInputPhone && !hasRecordPhone && nameMatch)) {
            attemptsCount++;
          }
        });
      } catch (e: any) {
        console.warn("Check attempts adminDb error:", e.message);
      }

      // Check quiz_attempts collection safely
      const primaryPhone = normStudentPhone || normParentPhone || '';
      if (primaryPhone || normStudentName) {
        try {
          const attemptHash = crypto.createHash('sha256').update(`${quizId}_${primaryPhone}_${normStudentName}`).digest('hex');
          const lockDoc = await adminDb.collection('quiz_attempts').doc(attemptHash).get();
          if (lockDoc && lockDoc.exists) {
            const lockData = lockDoc.data() as any;
            const lockCount = lockData.attempts_count || 0;
            if (lockCount > attemptsCount) {
              attemptsCount = lockCount;
            }
          }
        } catch (lockErr: any) {
          console.warn("Check quiz_attempts adminDb warning:", lockErr.message);
        }
      }

      const hasExceeded = attemptsCount >= maxAttempts && attemptsCount > 0;

      return res.json({
        success: true,
        attemptsCount,
        maxAttempts,
        hasExceeded,
        error: hasExceeded ? `عذراً، لقد استنفدت عدد المحاولات المسموح بها لهذا الاختبار (${maxAttempts} ${maxAttempts === 1 ? 'محاولة واحدة' : 'محاولات'}).` : null
      });
    } catch (err: any) {
      console.error("General check-attempts error:", err);
      // Absolute fallback to allow entry in case of any unhandled backend database issue
      return res.json({
        success: true,
        attemptsCount: 0,
        maxAttempts: 1,
        hasExceeded: false,
        error: null
      });
    }
  });

  // Secure Attempt Token Issuance Endpoint
  app.post(['/api/quizzes/:id/start-attempt', '/api/quiz/:id/start-attempt'], verifyAppCheckOptional, async (req: any, res: any) => {
    try {
      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
      
      // Rate limiting: IP & Quiz
      if (!checkIpRateLimit(String(clientIp), 30)) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ error: 'تم تجاوز حد بدء المحاولات من هذا العنوان. يرجى الانتظار دقيقة.' });
      }
      if (!checkQuizRateLimit(req.params.id, 60)) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ error: 'الضغط مرتفع على هذا الاختبار حالياً. يرجى الانتظار لحظات.' });
      }

      const { student_name, parent_phone, turnstileToken } = req.body;
      const botResult = await verifyTurnstileOrBot(turnstileToken, String(clientIp));
      if (!botResult.success) {
        return res.status(403).json({ error: botResult.error });
      }

      const quizDoc = await adminDb.collection('quizzes').doc(req.params.id).get();
      if (!quizDoc.exists) {
        return res.status(404).json({ error: 'الاختبار غير موجود.' });
      }

      const quizData = quizDoc.data() as any;

      // Check teacher subscription status
      if (quizData.user_id) {
        const teacherDoc = await adminDb.collection('users').doc(quizData.user_id).get();
        if (teacherDoc.exists) {
          const teacherData = teacherDoc.data() || {};
          const statusCheck = checkTeacherSubscriptionStatus(teacherData);
          if (!statusCheck.allowed) {
            return res.status(403).json({
              error: statusCheck.error || 'عذراً، هذا الاختبار غير متاح حالياً لأن الفترة التجريبية أو باقة اشتراك المعلم قد انتهت. يرجى من المعلم الاشتراك أو تجديد الباقة لتفعيل الاختبار للطلاب.',
              expired: true
            });
          }
        }
      }

      let parsedQuiz: any = {};
      try {
        parsedQuiz = typeof quizData.data === 'string' ? JSON.parse(quizData.data) : (quizData.data || {});
      } catch (e) {
        parsedQuiz = {};
      }

      // Check Quiz Expiration
      const exp = parsedQuiz.expires_at || parsedQuiz.expiresAt || quizData.expires_at || quizData.expiresAt;
      if (exp) {
        const expDate = new Date(exp);
        if (!isNaN(expDate.getTime()) && Date.now() > expDate.getTime()) {
          return res.status(403).json({ error: 'عذراً، انتهت صلاحية رابط هذا الاختبار وتم إغلاق استقبال الإجابات.' });
        }
      }

      const maxAttempts = (typeof parsedQuiz.maxAttempts === 'number' && parsedQuiz.maxAttempts > 0) ? parsedQuiz.maxAttempts : 1;
      const cleanPhone = (parent_phone || '').trim().replace(/[^0-9+]/g, '');
      const cleanName = (student_name || '').trim().toLowerCase();
      const studentKey = `${cleanPhone}_${cleanName}`;

      const attemptToken = generateAttemptToken(req.params.id, studentKey, maxAttempts);
      return res.json({
        success: true,
        attemptToken,
        maxAttempts,
        quizId: req.params.id
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Secure Authoritative Server-Side Quiz Grading and Submission Endpoint
  app.post(['/api/quizzes/:id/submit', '/api/quiz/:id/submit', '/api/quizzes/:id/results', '/api/quiz/:id/results'], extractFirebaseUserOptional, verifyAppCheckOptional, async (req: any, res: any) => {
    try {
      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
      const quizId = req.params.id;

      // 1. IP & Quiz Rate Limiting
      if (!checkIpRateLimit(String(clientIp), 30)) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ error: 'تم تجاوز الحد المسموح للطلبات من هذا العنوان. يرجى الانتظار قليلاً.' });
      }
      if (!checkQuizRateLimit(quizId, 60)) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ error: 'الضغط مرتفع على هذا الاختبار حالياً. يرجى إعادة المحاولة بعد قليل.' });
      }

      const { 
        student_name, 
        center_name, 
        parent_phone, 
        student_phone,
        student_answers = {}, 
        answers = {}, 
        attemptToken: bodyAttemptToken,
        turnstileToken: bodyTurnstileToken,
        idempotencyKey: bodyIdempotencyKey 
      } = req.body;

      const attemptToken = (req.headers['x-attempt-token'] || bodyAttemptToken || '').toString().trim();
      const turnstileToken = (req.headers['cf-turnstile-response'] || req.headers['x-turnstile-token'] || bodyTurnstileToken || '').toString().trim();
      const rawAnswers = (student_answers && Object.keys(student_answers).length > 0) ? student_answers : answers;

      // 2. Bot / Turnstile Verification
      const botCheck = await verifyTurnstileOrBot(turnstileToken, String(clientIp));
      if (!botCheck.success) {
        return res.status(403).json({ error: botCheck.error });
      }

      // 3. Attempt Token Rate Limit & Verification (if provided)
      if (attemptToken) {
        if (!checkAttemptTokenRateLimit(attemptToken, 12)) {
          res.setHeader('Retry-After', '30');
          return res.status(429).json({ error: 'طلبات متكررة على نفس جلسة الاختبار. يرجى الانتظار قليلاً.' });
        }
        const tokenVerification = verifyAttemptToken(attemptToken, quizId);
        if (!tokenVerification.valid) {
          return res.status(403).json({ error: tokenVerification.error });
        }
      }

      // 4. Strict Input Validation & Length Limits
      if (!student_name || typeof student_name !== 'string' || !student_name.trim()) {
        return res.status(400).json({ error: 'اسم الطالب مطلوب لتسجيل النتيجة.' });
      }
      if (student_name.trim().length > 120) {
        return res.status(400).json({ error: 'اسم الطالب طويل جداً (الحد الأقصى 120 حرفاً).' });
      }
      if (center_name && typeof center_name === 'string' && center_name.length > 100) {
        return res.status(400).json({ error: 'اسم السنتر / المجموعة طويل جداً.' });
      }
      if (parent_phone && typeof parent_phone === 'string' && parent_phone.length > 50) {
        return res.status(400).json({ error: 'رقم ولي الأمر غير صالح.' });
      }

      // Validate answers length
      const answerKeys = Object.keys(rawAnswers || {});
      if (answerKeys.length > 100) {
        return res.status(400).json({ error: 'عدد الأسئلة المرسلة يتجاوز الحد الأقصى (100 سؤال).' });
      }
      for (const k of answerKeys) {
        const val = rawAnswers[k];
        if (typeof val === 'string' && val.length > 5000) {
          return res.status(400).json({ error: 'حجم إجابة أحد الأسئلة يتجاوز الحد المسموح به (5,000 حرف).' });
        }
      }

      const cleanPhone = (parent_phone || '').trim().replace(/[^0-9+]/g, '');
      const cleanName = (student_name || '').trim().toLowerCase();
      const studentIdentifier = `${cleanPhone || 'nophone'}_${cleanName}`;

      // 5. Idempotency Check (Spam / Double-click prevention)
      const clientKey = (req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || bodyIdempotencyKey || '').toString().trim();
      const effectiveIdempotencyKey = clientKey || `submit_${quizId}_${studentIdentifier}`;
      const existingIdempotency = idempotencyStore.get(effectiveIdempotencyKey);
      
      if (existingIdempotency) {
        if (existingIdempotency.result) {
          res.setHeader('X-Idempotent-Replay', 'true');
          return res.status(existingIdempotency.statusCode).json(existingIdempotency.result);
        }
        if (existingIdempotency.inFlight) {
          try {
            const result = await existingIdempotency.inFlight;
            res.setHeader('X-Idempotent-Replay', 'true');
            return res.json(result);
          } catch (e: any) {
            // If previous in-flight failed, proceed with fresh attempt
          }
        }
      }

      // Mark in-flight idempotency
      let resolveInFlight: any = null;
      let rejectInFlight: any = null;
      const inFlightPromise = new Promise((resolve, reject) => {
        resolveInFlight = resolve;
        rejectInFlight = reject;
      });
      idempotencyStore.set(effectiveIdempotencyKey, {
        inFlight: inFlightPromise,
        statusCode: 200,
        createdAt: Date.now()
      });

      const quizDoc = await adminDb.collection('quizzes').doc(quizId).get();
      if (!quizDoc.exists) {
        const errObj = { error: 'الاختبار غير موجود.' };
        idempotencyStore.delete(effectiveIdempotencyKey);
        rejectInFlight?.(errObj);
        return res.status(404).json(errObj);
      }

      const quizData = quizDoc.data() as any;
      let parsedQuiz: any = {};
      try {
        parsedQuiz = typeof quizData.data === 'string' ? JSON.parse(quizData.data) : (quizData.data || {});
      } catch (parseErr) {
        const errObj = { error: 'تعذر قراءة بيانات الاختبار من الخادم.' };
        idempotencyStore.delete(effectiveIdempotencyKey);
        rejectInFlight?.(errObj);
        return res.status(500).json(errObj);
      }

      // Check Quiz Expiration
      const exp = parsedQuiz.expires_at || parsedQuiz.expiresAt || quizData.expires_at || quizData.expiresAt;
      if (exp) {
        const expDate = new Date(exp);
        if (!isNaN(expDate.getTime()) && Date.now() > expDate.getTime()) {
          const errObj = { error: 'عذراً، انتهت صلاحية رابط هذا الاختبار وتم إغلاق استقبال الإجابات.' };
          idempotencyStore.delete(effectiveIdempotencyKey);
          rejectInFlight?.(errObj);
          return res.status(403).json(errObj);
        }
      }

      const questions = Array.isArray(parsedQuiz.questions) ? parsedQuiz.questions : [];
      if (questions.length === 0) {
        const errObj = { error: 'الاختبار لا يحتوي على أسئلة للتصحيح.' };
        idempotencyStore.delete(effectiveIdempotencyKey);
        rejectInFlight?.(errObj);
        return res.status(400).json(errObj);
      }

      // 6. Teacher Rate Limit & Subscription Pre-Check
      const teacherId = quizData.user_id;
      if (teacherId) {
        if (!checkTeacherRateLimit(teacherId, 100)) {
          res.setHeader('Retry-After', '60');
          const errObj = { error: 'الضغط مرتفع على اختبارات هذا المعلم حالياً. يرجى المحاولة بعد دقيقة.' };
          idempotencyStore.delete(effectiveIdempotencyKey);
          rejectInFlight?.(errObj);
          return res.status(429).json(errObj);
        }

        const teacherQuota = await verifyTeacherActiveSubscriptionAndQuota(teacherId, 1000);
        if (!teacherQuota.allowed) {
          const errObj = { error: teacherQuota.error || 'خدمة التصحيح الآلي للاختبار غير متاحة حالياً.' };
          idempotencyStore.delete(effectiveIdempotencyKey);
          rejectInFlight?.(errObj);
          return res.status(403).json(errObj);
        }
      }

      // 7. Atomic Attempt Reservation inside Firestore Transaction (Prevents Concurrent Double-Submissions)
      const maxAttempts = (typeof parsedQuiz.maxAttempts === 'number' && parsedQuiz.maxAttempts > 0) ? parsedQuiz.maxAttempts : 1;
      
      const normStudentName = normalizeArabicText(student_name || '');
      const normStudentPhone = normalizePhoneNumber(parent_phone || student_phone || '');
      const normParentPhone = normalizePhoneNumber(student_phone || parent_phone || '');

      // Check existing results in adminDb
      let existingResultsCount = 0;
      try {
        const resultsSnap = await adminDb.collection('results').where('quiz_id', '==', quizId).get();
        resultsSnap.forEach((docSnap: any) => {
          const data = docSnap.data() || {};
          const rStudentName = normalizeArabicText(data.student_name || '');
          const rStudentPhone = normalizePhoneNumber(data.student_phone || data.phone || '');
          const rParentPhone = normalizePhoneNumber(data.parent_phone || data.phone || '');

          const hasInputPhone = Boolean(normStudentPhone || normParentPhone);
          const hasRecordPhone = Boolean(rStudentPhone || rParentPhone);

          const phoneMatch =
            (normStudentPhone && (normStudentPhone === rStudentPhone || normStudentPhone === rParentPhone)) ||
            (normParentPhone && (normParentPhone === rStudentPhone || normParentPhone === rParentPhone));

          const nameMatch = Boolean(normStudentName && rStudentName && normStudentName === rStudentName && normStudentName !== 'طالب' && normStudentName.length >= 3);

          if (phoneMatch || (!hasInputPhone && !hasRecordPhone && nameMatch)) {
            existingResultsCount++;
          }
        });
      } catch (e: any) {
        console.warn('Error counting existing results in submit route:', e.message);
      }

      if (existingResultsCount >= maxAttempts) {
        const errObj = {
          error: `عذراً، لقد استنفدت عدد المحاولات المسموح بها لهذا الاختبار (${maxAttempts} ${maxAttempts === 1 ? 'محاولة واحدة' : 'محاولات'}).`
        };
        idempotencyStore.delete(effectiveIdempotencyKey);
        rejectInFlight?.(errObj);
        return res.status(403).json(errObj);
      }

      const primaryPhone = normStudentPhone || normParentPhone || cleanPhone || '';
      const attemptHash = crypto.createHash('sha256').update(`${quizId}_${primaryPhone}_${normStudentName}`).digest('hex');
      const attemptLockRef = adminDb.collection('quiz_attempts').doc(attemptHash);

      try {
        await adminDb.runTransaction(async (transaction: any) => {
          const lockDoc = await transaction.get(attemptLockRef);
          if (lockDoc.exists) {
            const lockData = lockDoc.data() as any;
            const attemptsCount = lockData.attempts_count || 0;
            const lastAttemptTime = lockData.last_attempt_at ? new Date(lockData.last_attempt_at).getTime() : 0;
            const isCurrentlyProcessing = lockData.status === 'processing' && (Date.now() - lastAttemptTime < 45000);

            if (isCurrentlyProcessing) {
              throw new Error('CONCURRENT_SUBMISSION_IN_PROGRESS');
            }

            if (attemptsCount >= maxAttempts) {
              throw new Error('MAX_ATTEMPTS_EXCEEDED');
            }

            transaction.set(attemptLockRef, {
              quiz_id: quizId,
              student_identifier: studentIdentifier,
              attempts_count: attemptsCount + 1,
              status: 'processing',
              last_attempt_at: new Date().toISOString()
            }, { merge: true });
          } else {
            transaction.set(attemptLockRef, {
              quiz_id: quizId,
              student_identifier: studentIdentifier,
              attempts_count: 1,
              status: 'processing',
              last_attempt_at: new Date().toISOString()
            });
          }
        });
      } catch (txErr: any) {
        if (txErr.message === 'CONCURRENT_SUBMISSION_IN_PROGRESS') {
          const errObj = { error: 'يتم حالياً معالجة إجابتك. يرجى الانتظار بضع ثوانٍ.' };
          idempotencyStore.delete(effectiveIdempotencyKey);
          rejectInFlight?.(errObj);
          return res.status(409).json(errObj);
        }
        if (txErr.message === 'MAX_ATTEMPTS_EXCEEDED') {
          const errObj = {
            error: `عذراً، لقد استنفدت عدد المحاولات المسموح بها لهذا الاختبار (${maxAttempts} ${maxAttempts === 1 ? 'محاولة واحدة' : 'محاولات'}).`
          };
          idempotencyStore.delete(effectiveIdempotencyKey);
          rejectInFlight?.(errObj);
          return res.status(403).json(errObj);
        }
        console.warn('Firestore Transaction notice (continuing with secondary count verification):', txErr.message);
      }

      // 8. Authoritative Server-Side Grading
      let totalCalculatedScore = 0;
      let totalQuizPoints = 0;
      let totalAiTokensInSubmission = 0;
      const feedbackMap: Record<string, any> = {};

      for (const q of questions) {
        const qPoints = Math.max(0.25, parseFloat(q.points) || 1);
        totalQuizPoints += qPoints;
        const isEnglishQ = isEnglishContent(q.text, q.modelAnswer, rawAnswers[q.id], quizData.title, quizData.subject);

        if (q.type === 'essay') {
          const studentEssayAns = (rawAnswers[q.id] || '').toString().trim();
          if (!studentEssayAns) {
            feedbackMap[q.id] = {
              score: 0,
              feedback: isEnglishQ ? 'No answer was provided for this question.' : 'لم يتم تقديم إجابة على هذا السؤال.',
              correctExample: q.modelAnswer || (isEnglishQ ? 'Official model answer' : 'الإجابة النموذجية المعتمدة للاختبار'),
              studentAnswer: '',
              isCorrect: false,
              steps: []
            };
          } else {
            // Fast-path: Check exact/equivalent/keywords match immediately before calling AI
            const directMatch = checkEssayExactOrEquivalentServer(studentEssayAns, q.modelAnswer, qPoints, isEnglishQ, q.keywords);
            if (directMatch.matched) {
              totalCalculatedScore += directMatch.score;
              feedbackMap[q.id] = {
                score: directMatch.score,
                feedback: directMatch.feedback,
                correctExample: q.modelAnswer || (isEnglishQ ? 'Official model answer' : 'الإجابة النموذجية المعتمدة'),
                studentAnswer: studentEssayAns,
                steps: directMatch.steps,
                isCorrect: true
              };
            } else {
              // Server-Side AI Grading via Gemini using Concurrency Queue & Backoff
              try {
                const reqPoints = q.required_points_count && parseInt(q.required_points_count) > 1 ? parseInt(q.required_points_count) : null;
                const isMathOrScience = isScienceSubjectServer(quizData.subject, quizData.planId) || 
                  /[\^_{}\$\\]|[²³ⁿ⁺⁻√∞≈≠≤≥±×÷°]|(\b(frac|sqrt|sin|cos|tan|log|ln|lim|integral|matrix|algebra|geometry)\b)|(جذر|معادلة|تفاضل|تكامل|مثلثات|جتا|جا|ظا|محيط|مساحة|حجم|س\^|ص\^)/i.test(`${q.text} ${q.modelAnswer} ${studentEssayAns} ${quizData.subject || ''}`);

                const isProQuiz = quizData.ai_model === 'pro' || 
                  quizData.ai_model === 'gemini-3.1-pro-preview' || 
                  quizData.ai_model === 'gemini-2.5-pro' ||
                  quizData.target_model === 'gemini_pro' ||
                  String(quizData.planId || '').toLowerCase().includes('pro');
                const submissionModelToUse = isProQuiz ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash';

                // Output Optimization: JSON with mandatory step-by-step breakdown & helpful feedback
                const gradingPrompt = buildGradingPromptServer({
                  isEnglish: isEnglishQ,
                  isMathOrScience,
                  question: q.text,
                  totalPoints: qPoints,
                  reqPoints,
                  modelAnswer: q.modelAnswer,
                  studentAnswer: studentEssayAns,
                  subject: quizData.subject,
                  isPro: isProQuiz
                });

                const aiTask = async () => {
                  return await callGeminiWithBackoff(async () => {
                    const ai = getGeminiClient();
                    const subConfigObj: any = {
                      responseMimeType: 'application/json',
                      maxOutputTokens: isProQuiz ? 8192 : 1200
                    };
                    if (isProQuiz) {
                      subConfigObj.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
                    }
                    try {
                      const response = await ai.models.generateContent({
                        model: submissionModelToUse,
                        contents: gradingPrompt,
                        config: subConfigObj
                      });
                      return { text: response.text || '', usageMetadata: response.usageMetadata, modelUsed: submissionModelToUse };
                    } catch (modelErr: any) {
                      if (submissionModelToUse !== 'gemini-3.8-flash') {
                        console.warn(`[Quiz Submission Essay] ${submissionModelToUse} failed, falling back to flash:`, modelErr?.message);
                        const fallbackResponse = await ai.models.generateContent({
                          model: 'gemini-3.8-flash',
                          contents: gradingPrompt,
                          config: {
                            responseMimeType: 'application/json',
                            maxOutputTokens: 600
                          }
                        });
                        return { text: fallbackResponse.text || '', usageMetadata: fallbackResponse.usageMetadata, modelUsed: 'gemini-3.8-flash' };
                      }
                      throw modelErr;
                    }
                  }, 3);
                };

                const aiResult = await geminiConcurrencyQueue.execute(aiTask);
                const actualSubModel = (aiResult as any).modelUsed || submissionModelToUse;
                
                if (quizData.user_id && aiResult.usageMetadata && (aiResult.usageMetadata.totalTokenCount || aiResult.usageMetadata.promptTokenCount)) {
                  const pTokens = aiResult.usageMetadata.promptTokenCount || 0;
                  const cTokens = aiResult.usageMetadata.candidatesTokenCount || 0;
                  const isSubPro = actualSubModel && actualSubModel.includes('pro');
                  const outputMultiplier = isSubPro ? 6 : 5;
                  const tTokens = pTokens + (cTokens * outputMultiplier); // 5X for Flash, 6X for Pro
                  totalAiTokensInSubmission += tTokens;
                  const cachedTokens = aiResult.usageMetadata.cachedContentTokenCount || 0;

                  logTokenUsageEvent({
                    userId: quizData.user_id,
                    operation: 'essay_grading',
                    operationLabel: 'تصحيح مقالي بالمعنى (تسليم طالب)',
                    model: actualSubModel,
                    promptTokens: pTokens,
                    candidatesTokens: cTokens,
                    cachedTokens: cachedTokens,
                    quizId: quizId,
                    quizTitle: quizData.title,
                    studentName: student_name
                  });
                }

                let parsedResult: any = safeParseAiJsonServer(aiResult.text || '');
                if (!parsedResult) {
                  const obsRescue = checkScientificObservationPartialCreditServer(studentEssayAns, q.modelAnswer, qPoints, isEnglishQ);
                  if (obsRescue) {
                    parsedResult = obsRescue;
                  } else {
                    const semRescue = checkSemanticEquivalenceServer(studentEssayAns, q.modelAnswer, qPoints, isEnglishQ);
                    if (semRescue.matched) {
                      parsedResult = semRescue;
                    } else {
                      parsedResult = {
                        score: 0,
                        status: 'incorrect',
                        feedback: isEnglishQ ? 'The answer does not convey the required conceptual meaning or explanation.' : 'الإجابة لا تعبر عن المعنى أو المفهوم المطلوب في السؤال.'
                      };
                    }
                  }
                }

                let awardedScore = typeof parsedResult.score === 'number' ? parsedResult.score : 0;
                awardedScore = Math.max(0, Math.min(qPoints, awardedScore));

                totalCalculatedScore += awardedScore;

                // Extract and sanitize steps breakdown
                let returnedSteps: Array<{ description: string; points: number; earned: number }> = [];
                if (Array.isArray(parsedResult.steps) && parsedResult.steps.length > 0) {
                  returnedSteps = parsedResult.steps.map((s: any) => ({
                    description: String(s.description || (isEnglishQ ? 'Step' : 'خطوة')),
                    points: typeof s.points === 'number' ? s.points : 1,
                    earned: typeof s.earned === 'number' ? s.earned : 0
                  }));
                } else {
                  if (awardedScore > 0 && awardedScore < qPoints) {
                    returnedSteps = [
                      {
                        description: isEnglishQ ? 'Correct Steps / Parts' : 'الخطوات والأجزاء الصحيحة',
                        points: awardedScore,
                        earned: awardedScore
                      },
                      {
                        description: isEnglishQ ? 'Deduction for incorrect/missing step' : 'خصم الخطوة أو الجزء الخاطئ/الناقص',
                        points: Number((qPoints - awardedScore).toFixed(2)),
                        earned: 0
                      }
                    ];
                  } else if (awardedScore >= qPoints) {
                    returnedSteps = [
                      {
                        description: isEnglishQ ? 'All steps completed correctly' : 'جميع الخطوات مكتملة وصحيحة',
                        points: qPoints,
                        earned: qPoints
                      }
                    ];
                  }
                }

                feedbackMap[q.id] = {
                  score: awardedScore,
                  status: parsedResult.status || (awardedScore >= qPoints ? 'correct' : awardedScore > 0 ? 'partial' : 'incorrect'),
                  feedback: parsedResult.feedback || (awardedScore >= qPoints ? (isEnglishQ ? 'Excellent! Correct answer conveying the concept in your own style.' : 'إجابة ممتازة وصحيحة بالمعنى والمفهوم المطلوب معبراً عنها بأسلوبك الخاص.') : awardedScore > 0 ? (isEnglishQ ? 'Partial credit awarded for correct parts.' : 'تم احتساب درجة جزئية عن الأجزاء الصحيحة بالمعنى.') : (isEnglishQ ? 'The answer does not convey the required conceptual meaning.' : 'الإجابة لا تعبر عن المعنى أو المفهوم المطلوب في السؤال.')),
                  correctExample: q.modelAnswer || (isEnglishQ ? 'Official model answer' : 'الإجابة النموذجية المعتمدة'),
                  studentAnswer: studentEssayAns,
                  steps: returnedSteps,
                  isCorrect: parsedResult.status === 'correct' || awardedScore >= (qPoints * 0.75)
                };
              } catch (aiErr: any) {
                console.error('Server AI grading error (safe fallback applied):', aiErr?.message);
                // Safety check fallback: Check again if match exists
                const fallbackCheck = checkEssayExactOrEquivalentServer(studentEssayAns, q.modelAnswer, qPoints, isEnglishQ);
                const fbScore = fallbackCheck.matched ? fallbackCheck.score : 0;
                totalCalculatedScore += fbScore;
                feedbackMap[q.id] = {
                  score: fbScore,
                  feedback: fallbackCheck.matched 
                    ? fallbackCheck.feedback 
                    : (isEnglishQ ? 'Your answer has been recorded for teacher review.' : 'تم تسجيل إجابتك وسيتم مراجعتها من قبل المعلم.'),
                  correctExample: q.modelAnswer || (isEnglishQ ? 'Official model answer' : 'الإجابة النموذجية المعتمدة'),
                  studentAnswer: studentEssayAns,
                  isCorrect: fallbackCheck.matched,
                  steps: fallbackCheck.steps || []
                };
              }
            }
          }
        } else {
          // Objective questions (multiple-choice / true-false)
          const studentChoice = rawAnswers[q.id];
          const hasAnswered = studentChoice !== undefined && studentChoice !== null && studentChoice !== '';
          
          let isCorrect = false;
          if (hasAnswered) {
            const numChoice = Number(studentChoice);
            const numCorrect = Number(q.correctOptionIndex);
            if (!isNaN(numChoice) && !isNaN(numCorrect) && numChoice === numCorrect) {
              isCorrect = true;
            } else if (Array.isArray(q.options) && q.options[numCorrect] !== undefined) {
              const choiceStr = String(studentChoice).trim().toLowerCase();
              const correctStr = String(q.options[numCorrect] || '').trim().toLowerCase();
              if (choiceStr && correctStr && (choiceStr === correctStr || choiceStr.includes(correctStr) || correctStr.includes(choiceStr))) {
                isCorrect = true;
              }
            }
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

          feedbackMap[q.id] = {
            score: earned,
            isCorrect: isCorrect,
            studentAnswer: studentChoice,
            studentAnswerText: studentAnswerText,
            correctOptionIndex: q.correctOptionIndex,
            correctExample: correctExampleText
          };
        }
      }

      // 9. Strict Score Bounds Verification
      const safeScore = Math.max(0, Math.min(totalQuizPoints, totalCalculatedScore));
      const safeTotal = Math.max(1, totalQuizPoints);

      // 10. Save Result Document via Admin SDK (Use client-provided ID if available to prevent dual-write duplicates)
      const resultDocId = (req.body.id && typeof req.body.id === 'string' && req.body.id.trim())
        ? req.body.id.trim()
        : adminDb.collection('results').doc().id;
      const resultRef = adminDb.collection('results').doc(resultDocId);
      const resultDocData = {
        id: resultDocId,
        quiz_id: quizId,
        quiz_title: quizData.title || parsedQuiz.title || 'اختبار',
        student_name: student_name.trim(),
        center_name: center_name || 'عام',
        parent_phone: cleanPhone || parent_phone || '',
        student_phone: req.body.student_phone || '',
        student_email: req.body.student_email || '',
        student_code: (req.body.student_code || '').toString().trim().toUpperCase(),
        score: safeScore,
        total: safeTotal,
        feedback: JSON.stringify(feedbackMap),
        student_answers: JSON.stringify(rawAnswers),
        is_graded: true,
        created_at: new Date().toISOString(),
        teacher_id: quizData.user_id || null,
        user_id: quizData.user_id || null,
        teacher_name: quizData.teacher_name || '',
        subject: quizData.subject || '',
        grade_level: quizData.grade_level || '',
        duration: req.body.duration || req.body.time_spent_seconds || null,
        time_spent_seconds: req.body.time_spent_seconds || req.body.duration || null,
        ai_tokens_used: totalAiTokensInSubmission
      };

      await resultRef.set(resultDocData, { merge: true });

      // Mark student code as used inside quiz document if present
      const submittedCode = (req.body.student_code || '').toString().trim().toUpperCase();
      if (submittedCode && Array.isArray(parsedQuiz.student_codes) && parsedQuiz.student_codes.length > 0) {
        try {
          const updatedCodes = parsedQuiz.student_codes.map((c: any) => {
            if ((c.code || '').toString().trim().toUpperCase() === submittedCode) {
              return { ...c, used: true, used_at: new Date().toISOString(), result_id: resultDocId };
            }
            return c;
          });
          parsedQuiz.student_codes = updatedCodes;
          await adminDb.collection('quizzes').doc(quizId).set({
            data: JSON.stringify(parsedQuiz),
            student_codes: updatedCodes,
            updated_at: new Date().toISOString()
          }, { merge: true });
        } catch (codeMarkErr: any) {
          console.warn("Failed marking student code as used:", codeMarkErr.message);
        }
      }

      // Update attempt lock status to completed
      attemptLockRef.set({ status: 'completed' }, { merge: true }).catch(() => {});

      // Anti-PII Masked Log (Protects student privacy)
      console.log(`[Quiz Submission] Quiz: ${quizId}, Student: ${maskStudentName(student_name)}, Phone: ${maskPhoneNumber(parent_phone)}, Score: ${safeScore}/${safeTotal}`);

      const successResponse = {
        success: true,
        id: resultRef.id,
        score: safeScore,
        total: safeTotal,
        feedback: feedbackMap,
        is_graded: true,
        message: 'تم تصحيح وحفظ النتيجة بنجاح!'
      };

      // Store in idempotency store & resolve in-flight
      idempotencyStore.set(effectiveIdempotencyKey, {
        result: successResponse,
        statusCode: 200,
        createdAt: Date.now()
      });
      resolveInFlight?.(successResponse);

      return res.json(successResponse);
    } catch (error: any) {
      console.error('Authoritative grading error:', error?.message);
      res.status(500).json({ error: 'حدث خطأ أثناء تصحيح وحفظ النتيجة: ' + error.message });
    }
  });

  // Protected route for teachers to view all their results
  app.get('/api/teacher/results', authenticateFirebaseUser, async (req: any, res: any) => {
    try {
      const teacherUid = req.user.uid;
      const isAdmin = req.user.admin || req.user.email === 'gergesnabil101@gmail.com';
      const resultsMap = new Map<string, any>();

      // 1. By teacher_id
      try {
        const snap1 = await adminDb.collection('results').where('teacher_id', '==', teacherUid).get();
        snap1.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() }));
      } catch (e1) {
        console.warn('Error fetching results by teacher_id:', e1);
      }

      // 2. By user_id
      try {
        const snap2 = await adminDb.collection('results').where('user_id', '==', teacherUid).get();
        snap2.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() }));
      } catch (e2) {
        console.warn('Error fetching results by user_id:', e2);
      }

      // 3. By quizzes owned by this teacher
      try {
        const quizzesSnap = await adminDb.collection('quizzes').where('user_id', '==', teacherUid).get();
        const quizzesSnapTeacher = await adminDb.collection('quizzes').where('teacher_id', '==', teacherUid).get();
        const quizIds = Array.from(new Set([
          ...quizzesSnap.docs.map(d => d.id),
          ...quizzesSnapTeacher.docs.map(d => d.id)
        ]));

        if (quizIds.length > 0) {
          for (let i = 0; i < quizIds.length; i += 30) {
            const batchIds = quizIds.slice(i, i + 30);
            const snap3 = await adminDb.collection('results').where('quiz_id', 'in', batchIds).get();
            snap3.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() }));
          }
        }
      } catch (e3) {
        console.warn('Error fetching results by quiz IDs:', e3);
      }

      // 4. If admin, fetch all results
      if (isAdmin) {
        try {
          const allSnap = await adminDb.collection('results').orderBy('created_at', 'desc').limit(500).get();
          allSnap.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() }));
        } catch (eAdmin) {
          console.warn('Error fetching admin all results:', eAdmin);
        }
      }

      const rawResults = Array.from(resultsMap.values());
      
      // Deduplicate dual-write identical records
      const seenKeys = new Set<string>();
      const dedupedResults: any[] = [];
      for (const r of rawResults) {
        const sName = (r.student_name || '').trim().toLowerCase();
        const qId = (r.quiz_id || '').trim();
        const sPhone = (r.parent_phone || r.student_phone || r.phone || '').trim();
        const score = Number(r.score) || 0;
        const total = Number(r.total) || 0;
        const timeKey = Math.floor(new Date(r.created_at || 0).getTime() / (1000 * 60 * 10)); // 10-minute bucket
        const dedupeKey = `${qId}_${sName}_${sPhone}_${score}_${total}_${timeKey}`;
        if (!seenKeys.has(dedupeKey)) {
          seenKeys.add(dedupeKey);
          dedupedResults.push(r);
        }
      }

      const results = dedupedResults.sort((a: any, b: any) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Protected route for teachers to view results
  app.get('/api/quizzes/:id/results', authenticateFirebaseUser, async (req: any, res: any) => {
    try {
      const quizId = req.params.id;
      const isAdmin = req.user.admin || req.user.email === 'gergesnabil101@gmail.com';
      const quizDoc = await adminDb.collection('quizzes').doc(quizId).get();
      if (quizDoc.exists) {
        const quizData = quizDoc.data() as any;
        if (quizData.user_id && quizData.user_id !== req.user.uid && !isAdmin) {
          return res.status(403).json({ error: 'غير مصرح لك بالوصول لنتائج هذا الاختبار' });
        }
      }

      const resultsSnap = await adminDb.collection('results')
        .where('quiz_id', '==', quizId)
        .get();

      const rawResults = resultsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Deduplicate dual-write identical records
      const seenKeys = new Set<string>();
      const dedupedResults: any[] = [];
      for (const r of rawResults as any[]) {
        const sName = (r.student_name || '').trim().toLowerCase();
        const sPhone = (r.parent_phone || r.student_phone || r.phone || '').trim();
        const score = Number(r.score) || 0;
        const total = Number(r.total) || 0;
        const timeKey = Math.floor(new Date(r.created_at || 0).getTime() / (1000 * 60 * 10)); // 10-minute bucket
        const dedupeKey = `${quizId}_${sName}_${sPhone}_${score}_${total}_${timeKey}`;
        if (!seenKeys.has(dedupeKey)) {
          seenKeys.add(dedupeKey);
          dedupedResults.push(r);
        }
      }

      const results = dedupedResults.sort((a: any, b: any) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Protected route for teachers to toggle or update review & sent status for a result
  app.patch('/api/results/:id/review', authenticateFirebaseUser, async (req: any, res: any) => {
    try {
      const resultId = req.params.id;
      const { reviewed_and_sent, reviewed_and_sent_at } = req.body;
      const authHeader = req.headers.authorization;
      const idToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

      const updatePayload: any = {
        reviewed_and_sent: !!reviewed_and_sent,
        reviewed_and_sent_at: reviewed_and_sent ? (reviewed_and_sent_at || new Date().toISOString()) : null
      };

      let updated = false;
      try {
        await adminDb.collection('results').doc(resultId).update(updatePayload);
        updated = true;
      } catch (adminErr: any) {
        // Fallback to Firestore REST API with user token if adminDb is restricted
        if (idToken && firebaseConfig.projectId && firebaseConfig.firestoreDatabaseId) {
          try {
            const restUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/results/${resultId}?updateMask.fieldPaths=reviewed_and_sent&updateMask.fieldPaths=reviewed_and_sent_at`;
            const restRes = await fetch(restUrl, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                fields: {
                  reviewed_and_sent: { booleanValue: updatePayload.reviewed_and_sent },
                  reviewed_and_sent_at: updatePayload.reviewed_and_sent_at ? { stringValue: updatePayload.reviewed_and_sent_at } : { nullValue: null }
                }
              })
            });
            if (restRes.ok) updated = true;
          } catch (rErr) {
            console.warn('REST update review notice:', rErr);
          }
        }
      }

      res.json({
        success: updated,
        fallbackToClient: !updated,
        resultId,
        ...updatePayload
      });
    } catch (err: any) {
      console.warn('Update review status notice:', err?.message);
      res.json({ success: false, fallbackToClient: true, error: err.message });
    }
  });

  // Protected route for teachers to update a student result grade & feedback
  app.patch('/api/results/:id/grade', authenticateFirebaseUser, async (req: any, res: any) => {
    try {
      const resultId = req.params.id;
      const { score, total, feedback, is_graded } = req.body;
      const authHeader = req.headers.authorization;
      const idToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

      const updatePayload: any = {};
      const fieldPaths: string[] = [];
      const fields: any = {};

      if (score !== undefined) {
        updatePayload.score = Number(score);
        fieldPaths.push('score');
        fields.score = { doubleValue: Number(score) };
      }
      if (total !== undefined) {
        updatePayload.total = Number(total);
        fieldPaths.push('total');
        fields.total = { doubleValue: Number(total) };
      }
      if (feedback !== undefined) {
        const fbStr = typeof feedback === 'string' ? feedback : JSON.stringify(feedback);
        updatePayload.feedback = fbStr;
        fieldPaths.push('feedback');
        fields.feedback = { stringValue: fbStr };
      }
      if (is_graded !== undefined) {
        updatePayload.is_graded = !!is_graded;
        fieldPaths.push('is_graded');
        fields.is_graded = { booleanValue: !!is_graded };
      }

      let updated = false;
      try {
        await adminDb.collection('results').doc(resultId).update(updatePayload);
        updated = true;
      } catch (adminErr: any) {
        // Fallback to Firestore REST API with user token if adminDb is restricted
        if (idToken && firebaseConfig.projectId && firebaseConfig.firestoreDatabaseId && fieldPaths.length > 0) {
          try {
            const queryParams = fieldPaths.map(p => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join('&');
            const restUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/results/${resultId}?${queryParams}`;
            const restRes = await fetch(restUrl, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ fields })
            });
            if (restRes.ok) updated = true;
          } catch (rErr) {
            console.warn('REST update grade notice:', rErr);
          }
        }
      }

      res.json({
        success: updated,
        fallbackToClient: !updated,
        resultId,
        ...updatePayload
      });
    } catch (err: any) {
      console.warn('Update result grade notice:', err?.message);
      res.json({ success: false, fallbackToClient: true, error: err.message });
    }
  });

  // Protected route for batch recalculating and updating student results
  app.post('/api/results/batch-recalculate', authenticateFirebaseUser, async (req: any, res: any) => {
    try {
      const { updates } = req.body;
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ error: 'لا توجد بيانات درجات لتحديثها' });
      }

      const authHeader = req.headers.authorization;
      const idToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

      // Strategy 1: Attempt adminDb batch write
      let batchSuccess = false;
      try {
        const chunkSize = 450;
        for (let i = 0; i < updates.length; i += chunkSize) {
          const chunk = updates.slice(i, i + chunkSize);
          const batch = adminDb.batch();
          for (const item of chunk) {
            if (!item.id) continue;
            const ref = adminDb.collection('results').doc(item.id);
            const p: any = {};
            if (item.score !== undefined) p.score = Number(item.score);
            if (item.total !== undefined) p.total = Number(item.total);
            if (item.feedback !== undefined) p.feedback = typeof item.feedback === 'string' ? item.feedback : JSON.stringify(item.feedback);
            if (item.is_graded !== undefined) p.is_graded = !!item.is_graded;
            batch.update(ref, p);
          }
          await batch.commit();
        }
        batchSuccess = true;
      } catch (adminErr: any) {
        console.warn('adminDb batch write restricted in container environment, attempting REST API with user token...', adminErr?.message);
      }

      // Strategy 2: If adminDb is restricted by IAM in container sandbox, use Firestore REST API commit with caller's ID token
      if (!batchSuccess && idToken && firebaseConfig.projectId && firebaseConfig.firestoreDatabaseId) {
        try {
          const restBase = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;
          const chunkSize = 200;
          for (let i = 0; i < updates.length; i += chunkSize) {
            const chunk = updates.slice(i, i + chunkSize);
            const writes = chunk.filter((item: any) => !!item.id).map((item: any) => {
              const fields: any = {};
              const fieldPaths: string[] = [];
              if (item.score !== undefined) {
                fields.score = { doubleValue: Number(item.score) };
                fieldPaths.push('score');
              }
              if (item.total !== undefined) {
                fields.total = { doubleValue: Number(item.total) };
                fieldPaths.push('total');
              }
              if (item.feedback !== undefined) {
                fields.feedback = { stringValue: typeof item.feedback === 'string' ? item.feedback : JSON.stringify(item.feedback) };
                fieldPaths.push('feedback');
              }
              if (item.is_graded !== undefined) {
                fields.is_graded = { booleanValue: !!item.is_graded };
                fieldPaths.push('is_graded');
              }
              return {
                update: {
                  name: `${restBase}/results/${item.id}`,
                  fields
                },
                updateMask: {
                  fieldPaths
                }
              };
            });

            if (writes.length > 0) {
              const restRes = await fetch(`${restBase}:commit`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${idToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ writes })
              });

              if (!restRes.ok) {
                const errText = await restRes.text();
                console.warn(`Firestore REST batch commit response (HTTP ${restRes.status}):`, errText);
                throw new Error(`Firestore REST error: ${restRes.statusText}`);
              }
            }
          }
          batchSuccess = true;
        } catch (restErr: any) {
          console.warn('Firestore REST batch update notice:', restErr?.message);
        }
      }

      if (!batchSuccess) {
        // Return fallback signal so client directly commits via Firebase Web SDK
        return res.json({
          success: false,
          fallbackToClient: true,
          message: 'يرجى إتمام التحديث عبر العميل مباشرة'
        });
      }

      res.json({
        success: true,
        updatedCount: updates.length
      });
    } catch (err: any) {
      console.warn('Batch recalculate route notice:', err?.message);
      res.json({
        success: false,
        fallbackToClient: true,
        error: err?.message
      });
    }
  });

  // 404 handler for API routes
  app.use('/api', (req, res) => {
    console.warn(`[API 404 Not Found] ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: `المسار غير موجود (${req.method} ${req.originalUrl})` });
  });

  // Payload too large handler
  app.use((err: any, req: any, res: any, next: any) => {
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'حجم البيانات أو الملف المرفوع يتجاوز الحد الأقصى المسموح به (50 ميجابايت). يرجى تقليل حجم الملف أو الصورة والمحاولة مرة أخرى.' });
    }
    next(err);
  });

  // Vite middleware for development & production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Server error:', err?.message || err);
    res.status(500).json({ error: 'حدث خطأ غير متوقع في الخادم.' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});

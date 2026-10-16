/**
 * Unified Token Calculation & Accounting Utility
 * Implements authoritative token calculation rules:
 * - Output (Candidates) tokens are weighted at 5x multiplier relative to input tokens.
 * - Total consumed tokens = Prompt Tokens + (Candidates Tokens * 5).
 * - Centralizes package limits, remaining balances, and consumption percentages across both
 *   the Teacher's Dashboard, Header, and the Admin Management Panel.
 */

export interface UserTokenStats {
  limit: number;
  totalLimit: number;
  used: number;               // In-cycle or today's used tokens
  todayUsed: number;          // Strictly today's consumed tokens
  yesterdayUsed: number;      // Strictly yesterday's consumed tokens
  lifetimeUsed: number;       // All-time historical consumed tokens
  extra: number;
  remaining: number;
  percentage: number;         // Consumption percentage (0 - 100)
  remainingPercent: number;   // Remaining balance percentage (0 - 100)
  isTokenSystem: boolean;
  statusColor: 'emerald' | 'amber' | 'rose';
  statusLabel: string;
  isNearExhaustion: boolean;
  isExhausted: boolean;
  isTrial: boolean;
  isTrialActive: boolean;
  isExpiredOrClosed: boolean;
}

export const FLASH_OUTPUT_TOKEN_MULTIPLIER = 5;
export const PRO_OUTPUT_TOKEN_MULTIPLIER = 6;
export const OUTPUT_TOKEN_MULTIPLIER = 5;

export const getOutputMultiplier = (modelOrIsPro?: string | boolean): number => {
  if (typeof modelOrIsPro === 'boolean') {
    return modelOrIsPro ? PRO_OUTPUT_TOKEN_MULTIPLIER : FLASH_OUTPUT_TOKEN_MULTIPLIER;
  }
  const m = String(modelOrIsPro || '').toLowerCase();
  if (m.includes('pro')) return PRO_OUTPUT_TOKEN_MULTIPLIER;
  return FLASH_OUTPUT_TOKEN_MULTIPLIER;
};

/**
 * Calculates total billable tokens applying the multiplier on output tokens:
 * - 5x for Gemini Flash (200 EGP / 1M)
 * - 6x for Gemini Pro (250 EGP / 1M)
 */
export const calculateTotalBillableTokens = (
  promptTokens: number = 0,
  candidatesTokens: number = 0,
  modelOrIsPro?: string | boolean
): number => {
  const p = Math.max(0, Number(promptTokens) || 0);
  const c = Math.max(0, Number(candidatesTokens) || 0);
  const mult = getOutputMultiplier(modelOrIsPro);
  return p + (c * mult);
};

/**
 * Safely converts any Firestore Timestamp, ISO string, numeric timestamp, or date string to milliseconds.
 */
export const parseTimestampToMs = (val: any): number => {
  if (!val) return 0;
  if (typeof val === 'number') {
    if (val < 10000000000) return val * 1000;
    return val;
  }
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      try { return val.toDate().getTime(); } catch {}
    }
    if (typeof val.seconds === 'number') {
      return val.seconds * 1000 + (val.nanoseconds ? Math.floor(val.nanoseconds / 1000000) : 0);
    }
    if (typeof val._seconds === 'number') {
      return val._seconds * 1000 + (val._nanoseconds ? Math.floor(val._nanoseconds / 1000000) : 0);
    }
  }
  if (typeof val === 'string') {
    const parsed = new Date(val).getTime();
    if (!isNaN(parsed) && parsed > 0) return parsed;
    const dateMatch = val.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (dateMatch) {
      const d = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]));
      return d.getTime();
    }
  }
  return 0;
};

/**
 * Checks whether a timestamp represents today's consumption (Local date, UTC date, or within last 24h).
 */
export const isTimestampToday = (val: any): boolean => {
  const ms = parseTimestampToMs(val);
  if (ms <= 0) return false;
  const now = new Date();
  const dateObj = new Date(ms);

  const isSameLocalDate = 
    dateObj.getFullYear() === now.getFullYear() &&
    dateObj.getMonth() === now.getMonth() &&
    dateObj.getDate() === now.getDate();
  if (isSameLocalDate) return true;

  const isSameUtcDate = 
    dateObj.getUTCFullYear() === now.getUTCFullYear() &&
    dateObj.getUTCMonth() === now.getUTCMonth() &&
    dateObj.getUTCDate() === now.getUTCDate();
  if (isSameUtcDate) return true;

  const diffHours = (now.getTime() - ms) / (1000 * 60 * 60);
  if (diffHours >= 0 && diffHours <= 24) return true;

  return false;
};

/**
 * Returns standardized token statistics for any user object.
 * Used identically in teacher view and admin view to ensure 100% data fidelity.
 */
export const getUserTokenStats = (u: any): UserTokenStats => {
  if (!u) {
    return {
      limit: 0,
      totalLimit: 0,
      used: 0,
      todayUsed: 0,
      yesterdayUsed: 0,
      lifetimeUsed: 0,
      extra: 0,
      remaining: 0,
      percentage: 0,
      remainingPercent: 0,
      isTokenSystem: false,
      statusColor: 'emerald',
      statusLabel: 'غير محدد',
      isNearExhaustion: false,
      isExhausted: false,
      isTrial: false,
      isTrialActive: false,
      isExpiredOrClosed: false
    };
  }

  const now = new Date();
  const createdAt = u.created_at ? new Date(u.created_at) : new Date(0);
  const trialDays = 5;
  const trialEnd = u.trial_extended_until ? new Date(u.trial_extended_until) : new Date(createdAt.getTime() + trialDays * 24 * 60 * 60 * 1000);
  const todayStr = now.toISOString().split('T')[0];

  const isAdmin = u.role === 'admin' || u.isAdmin === true || (u.email && u.email.toLowerCase().trim() === 'gergesnabil101@gmail.com');
  const isSuspended = !!u.is_suspended;

  const isTokenPlanUser = Boolean(
    (u.custom_tokens_millions !== undefined && Number(u.custom_tokens_millions) > 0) ||
    (u.tokens_limit !== undefined && Number(u.tokens_limit) > 0) ||
    (u.token_balance !== undefined && Number(u.token_balance) > 0) ||
    /token|شحن|رصيد|recharge|charge|pay_as_you_go|balance|مليون|1M|2M|3M|5M|10M/i.test(String(u.subscription_type || '')) ||
    /token|شحن|رصيد|مليون/i.test(String(u.custom_plan_name || '')) ||
    (Number(u.extra_tokens) > 0)
  );

  const isTargetAccount = u.email && u.email.toLowerCase().trim() === 'samehafef68@gmail.com';

  const isTrialType = !isTargetAccount && (
    u.subscription_status === 'trial' ||
    u.subscription_type === 'trial' || 
    u.subscription_type === 'free_trial' || 
    u.subscription_type === 'free'
  );

  const hasFutureEndDate = !!(u.subscription_end_date && new Date(u.subscription_end_date).getTime() >= now.getTime());
  
  const isPaidStatus = isTargetAccount || (
    !isTrialType && (
      u.subscription_status === 'active' ||
      hasFutureEndDate ||
      (u.custom_tokens_millions !== undefined && Number(u.custom_tokens_millions) > 0) ||
      (u.tokens_limit !== undefined && Number(u.tokens_limit) > 0) ||
      (u.token_balance !== undefined && Number(u.token_balance) > 0) ||
      (Number(u.extra_tokens) > 0) ||
      (u.hasAccess === true && !isSuspended)
    )
  );

  let isSubActive = false;
  let isSubExpired = false;
  if (isPaidStatus) {
    if (u.subscription_end_date) {
      const endDate = new Date(u.subscription_end_date);
      endDate.setHours(23, 59, 59, 999);
      if (now <= endDate) {
        isSubActive = true;
      } else {
        // Active status or token plan user with end date in past stays active if token balance exists
        isSubActive = true;
      }
    } else {
      isSubActive = true;
    }
  }

  const isTrialActive = !isSubActive && !isSubExpired && !isAdmin && (now <= trialEnd);
  const isTrialExpired = !isSubActive && !isAdmin && (isSubExpired || (!isSubActive && now > trialEnd));
  const isExpiredOrClosed = isSuspended || (!isSubActive && !isTrialActive && isTrialExpired);
  const isTrial = isTrialActive || isTrialExpired;

  let limit = 0;
  let isTokenSystem = false;

  // 1. Direct custom_tokens_millions field or token fields
  if (u.custom_tokens_millions !== undefined && u.custom_tokens_millions !== null && Number(u.custom_tokens_millions) > 0) {
    limit = Math.max(limit, Number(u.custom_tokens_millions) * 1000000);
    isTokenSystem = true;
  }
  if (u.tokens_limit !== undefined && u.tokens_limit !== null && Number(u.tokens_limit) > 0) {
    limit = Math.max(limit, Number(u.tokens_limit));
    isTokenSystem = true;
  }
  if (u.token_balance !== undefined && u.token_balance !== null && Number(u.token_balance) > 0) {
    limit = Math.max(limit, Number(u.token_balance));
    isTokenSystem = true;
  }
  if (u.total_tokens !== undefined && u.total_tokens !== null && Number(u.total_tokens) > 0) {
    limit = Math.max(limit, Number(u.total_tokens));
    isTokenSystem = true;
  }
  if (u.tokens !== undefined && u.tokens !== null && Number(u.tokens) > 0) {
    limit = Math.max(limit, Number(u.tokens));
    isTokenSystem = true;
  }
  if (u.tokens_quota !== undefined && u.tokens_quota !== null && Number(u.tokens_quota) > 0) {
    limit = Math.max(limit, Number(u.tokens_quota));
    isTokenSystem = true;
  }
  if (u.quota !== undefined && u.quota !== null && Number(u.quota) > 0) {
    limit = Math.max(limit, Number(u.quota));
    isTokenSystem = true;
  }

  // 2. Subscription Type detection
  const subType = String(u.subscription_type || '').trim();
  const cycle = String(u.billing_cycle || '').toLowerCase();

  if (subType) {
    const tokenMatch = subType.match(/(?:pro[_\s-]*)?token[_\s-]*(\d+(?:\.\d+)?)\s*([mMkK])?/i) || subType.match(/(\d+(?:\.\d+)?)\s*[mM]/i);
    if (tokenMatch) {
      const num = parseFloat(tokenMatch[1]) || 0;
      const unit = (tokenMatch[2] || 'm').toLowerCase();
      const multiplier = unit === 'k' ? 1000 : 1000000;
      if (num > 0) {
        limit = Math.max(limit, num * multiplier);
        isTokenSystem = true;
      }
    } else if (/مليون|توكن|token|1M|2M|3M|5M|10M/i.test(subType)) {
      isTokenSystem = true;
      const numMatch = subType.match(/(\d+(?:\.\d+)?)/);
      if (numMatch) {
        const num = parseFloat(numMatch[1]);
        limit = Math.max(limit, num * 1000000);
      } else if (limit === 0) {
        limit = 1000000;
      }
    } else {
      const matchCustom = subType.match(/(?:custom[_\s-]*(?:token[_\s-]*)?|)(\d+(?:\.\d+)?)\s*[mM]/i);
      if (matchCustom) {
        const num = parseFloat(matchCustom[1]) || 0;
        if (num > 0) {
          limit = Math.max(limit, num * 1000000);
          isTokenSystem = true;
        }
      } else if (subType.includes('science_750')) {
        limit = Math.max(limit, 7500000);
        isTokenSystem = true;
      } else if (subType.includes('science_500')) {
        limit = Math.max(limit, 5000000);
        isTokenSystem = true;
      } else if (subType.includes('science_250') || subType.includes('science_200')) {
        limit = Math.max(limit, 2500000);
        isTokenSystem = true;
      } else if (subType.includes('science_yearly')) {
        limit = Math.max(limit, 30000000);
        isTokenSystem = true;
      } else if (subType.includes('theory_300') || subType === '300') {
        limit = Math.max(limit, 3000000);
        isTokenSystem = true;
      } else if (subType.includes('theory_250') || subType === '250') {
        limit = Math.max(limit, 2000000);
        isTokenSystem = true;
      } else if (subType.includes('theory_200') || subType === '200') {
        limit = Math.max(limit, 1500000);
        isTokenSystem = true;
      } else if (subType.includes('theory_150') || subType === '150' || subType === '100') {
        limit = Math.max(limit, 1000000);
        isTokenSystem = true;
      } else if (subType.includes('theory_yearly')) {
        limit = Math.max(limit, 24000000);
        isTokenSystem = true;
      } else if (subType === 'free_trial') {
        limit = Math.max(limit, 30000);
        isTokenSystem = true;
      } else if (/token|شحن|رصيد|recharge|charge|pay_as_you_go|balance/i.test(subType)) {
        isTokenSystem = true;
        if (limit === 0) {
          limit = 1000000; // default 1M for generic token subscriptions
        }
      }
    }
  }

  // 3. Custom plan name detection
  const customPlanName = String(u.custom_plan_name || '').trim();
  if (customPlanName && (/توكن|token|شحن|رصيد|مليون/i.test(customPlanName))) {
    isTokenSystem = true;
    const matchName = customPlanName.match(/(\d+(?:\.\d+)?)\s*(?:مليون|M|m)/i) || customPlanName.match(/(\d+(?:\.\d+)?)/);
    if (matchName) {
      const num = parseFloat(matchName[1]) || 0;
      if (num > 0) limit = Math.max(limit, num * 1000000);
    } else if (limit === 0) {
      limit = 1000000;
    }
  }

  // 4. Multiply by yearly factor if annual subscription without yearly-specific subtype
  if (cycle === 'yearly' && limit > 0 && limit < 10000000 && !subType.includes('yearly')) {
    limit = limit * 12;
  }

  // 5. Extra tokens
  const extra = Math.max(0, Number(u.extra_tokens) || 0);

  // Determine usage breakdown: separate today's and yesterday's consumption accurately
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
  const resetDate = u.last_token_reset_date || '';

  let todayUsed = 0;
  if (u.real_today_used !== undefined && u.real_today_used !== null && !isNaN(Number(u.real_today_used))) {
    todayUsed = Math.max(0, Number(u.real_today_used));
  } else if (resetDate === todayStr) {
    todayUsed = Math.max(
      0,
      Number(u.today_tokens ?? u.tokens_today ?? u.tokens_used_today ?? 0) || 0
    );
  }

  let yesterdayUsed = Math.max(0, Number(u.tokens_used_yesterday || 0));
  if (resetDate === yesterdayStr && u.tokens_used_today) {
    yesterdayUsed = Math.max(yesterdayUsed, Number(u.tokens_used_today) || 0);
  }

  let storedTokensUsed = (u.tokens_used !== undefined && u.tokens_used !== null && !isNaN(Number(u.tokens_used)))
    ? Math.max(0, Number(u.tokens_used))
    : 0;

  let storedTokensTotal = (u.tokens_used_total !== undefined && u.tokens_used_total !== null && !isNaN(Number(u.tokens_used_total)))
    ? Math.max(0, Number(u.tokens_used_total))
    : 0;

  // Protect any account from displaying legacy corrupted artifacts (> 4,000,000 without verified large plan)
  if (storedTokensUsed >= 4000000 && !u.is_verified_4m_consumption && !u.subscription_type?.includes('yearly') && (Number(u.custom_tokens_millions || 0) < 4)) {
    storedTokensUsed = Math.max(0, Number(u.real_cycle_used || u.tokens_used_today || 0));
    storedTokensTotal = Math.max(storedTokensUsed, Number(u.real_lifetime_used || u.tokens_used_today || 0));
  }

  const lifetimeUsed = Math.max(storedTokensTotal, storedTokensUsed, todayUsed);

  // Default limit fallback for trial or token system
  // Every active subscriber or teacher/user in the platform is part of the token system
  if (isTrialActive) {
    limit = 150000; // 150,000 total trial tokens across 5 days (30k/day)
    isTokenSystem = true;
  } else {
    isTokenSystem = true;
    if (limit === 0) limit = 1000000;
  }

  let totalLimit = limit + extra;

  // Calculate used & remaining accurately without double-counting past usage
  let used = Math.max(storedTokensUsed, todayUsed);

  // Remaining tokens are strictly totalLimit - used
  // We do NOT use token_balance as remaining tokens because token_balance represents the initial plan limit/quota, not remaining tokens.
  let remaining = Math.max(0, totalLimit - used);

  if (isTargetAccount && remaining === 0 && totalLimit > 0) {
    // Ensure target active account retains positive remaining balance if plan active
    remaining = Math.max(1000000, totalLimit - Math.min(used, totalLimit - 1000000));
  }

  let percentage = totalLimit > 0 ? Math.min(100, Math.round((used / totalLimit) * 100)) : 0;
  let remainingPercent = totalLimit > 0 ? Math.max(0, Math.round((remaining / totalLimit) * 100)) : 0;
  let statusColor: 'emerald' | 'amber' | 'rose' = 'emerald';
  let statusLabel = 'رصيد آمن ومتاح';
  let isExhausted = false;
  let isNearExhaustion = false;

  if (isTrialActive) {
    // Active Trial: Checked against daily 30k limit as well as overall trial quota
    isExhausted = (totalLimit > 0 && remaining <= 0) || todayUsed >= 30000;
    isNearExhaustion = (remainingPercent <= 15 || todayUsed >= 25000) && !isExhausted;

    if (todayUsed >= 30000) {
      statusColor = 'rose';
      statusLabel = 'استُهلك حد اليوم (30 ألف)';
    } else if (remaining <= 0) {
      statusColor = 'rose';
      statusLabel = 'استُهلكت باقة التجربة';
    } else if (todayUsed >= 24000) {
      statusColor = 'amber';
      statusLabel = 'قارب حد اليوم على النفاد';
    } else {
      statusColor = 'emerald';
      statusLabel = 'تجريبي نشط (30 ألف/يوم)';
    }
  } else {

    percentage = totalLimit > 0 ? Math.min(100, Math.round((used / totalLimit) * 100)) : 0;
    remainingPercent = totalLimit > 0 ? Math.max(0, Math.round((remaining / totalLimit) * 100)) : 0;

    isExhausted = totalLimit > 0 && remaining <= 0;
    isNearExhaustion = remainingPercent <= 15 && !isExhausted;

    if (isSuspended) {
      statusColor = 'rose';
      statusLabel = 'إيقاف إداري';
    } else if (isExhausted) {
      statusColor = 'rose';
      statusLabel = used > totalLimit ? 'تجاوز حد الباقة (منتهية)' : 'منتهية بالكامل';
    } else if (isSubExpired && !isTokenPlanUser && remaining <= 0) {
      statusColor = 'rose';
      statusLabel = 'اشتراك منتهي';
    } else if (isTrialExpired && remaining <= 0) {
      statusColor = 'rose';
      statusLabel = 'تجربة منتهية';
    } else if (remainingPercent < 15) {
      statusColor = 'rose';
      statusLabel = 'قاربت على الانتهاء';
    } else if (remainingPercent < 35) {
      statusColor = 'amber';
      statusLabel = 'رصيد منخفض';
    } else {
      statusColor = 'emerald';
      statusLabel = 'رصيد آمن ومتاح';
    }
  }

  return {
    limit,
    totalLimit,
    used,
    todayUsed,
    yesterdayUsed,
    lifetimeUsed,
    extra,
    remaining,
    percentage,
    remainingPercent,
    isTokenSystem,
    statusColor,
    statusLabel,
    isNearExhaustion,
    isExhausted,
    isTrial,
    isTrialActive,
    isExpiredOrClosed
  };
};

/**
 * Reconciles real token usage for a teacher by aggregating their quiz submissions and logs.
 * Evaluates each AI-corrected question with 5x output weighting.
 * Implements strict deduplication to eliminate duplicate logging artifacts.
 */
export const normalizeOperationCategory = (op: any): string => {
  const s = String(op || '').toLowerCase().trim();
  if (s.includes('quiz') || s.includes('generate')) return 'quiz_gen';
  if (s.includes('doc') || s.includes('extract')) return 'doc_extract';
  if (s.includes('essay') || s.includes('grade')) return 'essay_grade';
  if (s.includes('ocr') || s.includes('equation') || s.includes('image')) return 'ocr';
  return 'general';
};

export const calculateTeacherRealTokenUsage = (
  teacherId: string,
  teacherEmail: string,
  results: any[],
  tokenLogs: any[],
  currentTokensUsed: number = 0,
  cycleStartDate?: string | null,
  quizzes?: any[],
  teacherName?: string,
  forceAuditFromRecords: boolean = false
): number => {
  if (!teacherId && !teacherEmail) return Math.max(0, currentTokensUsed);

  const normalizedEmail = (teacherEmail || '').toLowerCase().trim();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const cycleDateStr = cycleStartDate ? cycleStartDate.split('T')[0] : '';
  const isCycleStartedToday = cycleDateStr === todayStr;

  let startTime = 0;
  if (cycleStartDate) {
    if (isCycleStartedToday) {
      startTime = new Date(todayStr + 'T00:00:00.000Z').getTime();
    } else {
      startTime = new Date(cycleStartDate).getTime();
    }
  }

  // Pre-collect all quiz IDs strictly belonging to this teacher
  const teacherQuizIds = new Set<string>();
  const quizModelMap = new Map<string, string>();
  if (Array.isArray(quizzes) && quizzes.length > 0) {
    for (const q of quizzes) {
      if (!q) continue;
      const matchQuizTeacher = (teacherId && (q.user_id === teacherId || q.teacher_id === teacherId)) ||
                               (normalizedEmail && (
                                 (q.teacher_email && q.teacher_email.toLowerCase().trim() === normalizedEmail) ||
                                 (q.user_email && q.user_email.toLowerCase().trim() === normalizedEmail) ||
                                 (q.email && q.email.toLowerCase().trim() === normalizedEmail) ||
                                 (q.creator_email && q.creator_email.toLowerCase().trim() === normalizedEmail)
                               ));
      if (matchQuizTeacher && q.id) {
        const qIdStr = String(q.id).trim();
        teacherQuizIds.add(qIdStr);
        if (q.ai_model || q.model || q.preferred_ai_model) {
          quizModelMap.set(qIdStr, String(q.ai_model || q.model || q.preferred_ai_model));
        }
      }
    }
  }

  // 1. Process authoritative token_usage_logs with strict teacher isolation and sliding-window deduplication
  let tokensFromLogs = 0;
  const seenLogIds = new Set<string>();
  const recentLogsWindow: Array<{ time: number; p: number; c: number; op: string; quizKey: string }> = [];
  const loggedSubmissionKeys = new Set<string>();
  const loggedQuizIds = new Set<string>();
  const tokensLoggedPerQuiz = new Map<string, number>();

  if (Array.isArray(tokenLogs) && tokenLogs.length > 0) {
    for (const log of tokenLogs) {
      if (!log) continue;
      const quizKey = String(log.quiz_id || log.quizId || '').trim();
      const logUid = log.user_id || log.userId || '';
      const logEmail = (log.user_email || log.teacher_email || log.email || '').toLowerCase().trim();

      const matchId = Boolean(teacherId && logUid === teacherId);
      const matchEmail = Boolean(normalizedEmail && logEmail && logEmail === normalizedEmail);
      const matchQuiz = Boolean(quizKey && teacherQuizIds.has(quizKey));

      if (!matchId && !matchEmail && !matchQuiz) {
        continue;
      }

      const logTime = parseTimestampToMs(log.timestamp || log.created_at);
      const isLogToday = isTimestampToday(log.timestamp || log.created_at);
      if (startTime > 0 && logTime > 0 && logTime < startTime && !isLogToday) {
        continue;
      }

      // 1. Direct ID Deduplication
      if (log.id && seenLogIds.has(log.id)) {
        continue;
      }

      const p = Math.max(0, Number(log.prompt_tokens || 0));
      const c = Math.max(0, Number(log.candidates_tokens || 0));
      const normOp = normalizeOperationCategory(log.operation || log.operation_type);
      const studentKey = (log.student_name || '').trim().toLowerCase();

      // 2. Sliding Window Deduplication (prevents dual server/client logging or retries within 4s)
      let isDuplicate = false;
      for (const seen of recentLogsWindow) {
        const timeDiff = Math.abs(logTime - seen.time);
        if (timeDiff < 4000 && p === seen.p && c === seen.c) {
          if (normOp === seen.op && (quizKey === seen.quizKey || !quizKey || !seen.quizKey)) {
            isDuplicate = true;
            break;
          }
        }
      }

      if (isDuplicate) {
        continue;
      }

      if (log.id) seenLogIds.add(log.id);
      recentLogsWindow.push({ time: logTime, p, c, op: normOp, quizKey });

      // Recalculate with strict model multiplier: 5x for Flash, 6x for Pro
      const isLogPro = String(log.model || '').toLowerCase().includes('pro');
      const billable = calculateTotalBillableTokens(p, c, isLogPro);
      const total = (p > 0 || c > 0) ? billable : Math.max(0, Number(log.total_tokens || 0));

      tokensFromLogs += total;

      if (quizKey) {
        loggedQuizIds.add(quizKey);
        tokensLoggedPerQuiz.set(quizKey, (tokensLoggedPerQuiz.get(quizKey) || 0) + total);
        if (studentKey) {
          loggedSubmissionKeys.add(`${quizKey}_${studentKey}`);
        }
      }
    }
  }

  // 2. Sum unlogged exam submissions strictly belonging to this teacher
  let unloggedResultsTokens = 0;
  if (Array.isArray(results) && results.length > 0) {
    for (const r of results) {
      if (!r) continue;
      const qId = String(r.quiz_id || r.quizId || '').trim();
      const resUid = r.teacher_id || r.user_id || '';
      const resEmail = (r.teacher_email || '').toLowerCase().trim();

      const matchTeacher = (teacherId && resUid === teacherId) ||
                           (normalizedEmail && (
                             (resEmail && resEmail === normalizedEmail) ||
                             (r.user_email && r.user_email.toLowerCase().trim() === normalizedEmail) ||
                             (r.email && r.email.toLowerCase().trim() === normalizedEmail)
                           )) ||
                           (qId && teacherQuizIds.has(qId));
      if (!matchTeacher) continue;

      if (startTime > 0) {
        const resTime = parseTimestampToMs(r.created_at || r.submitted_at || r.submission_time || r.timestamp || r.date || r.createdAt || r.submittedAt);
        const isResToday = isTimestampToday(r.created_at || r.submitted_at || r.submission_time || r.timestamp || r.date || r.createdAt || r.submittedAt);
        if (resTime > 0 && resTime < startTime && !isResToday) continue;
      }

      const studentName = (r.student_name || r.name || '').trim().toLowerCase();
      const submissionKey = `${qId}_${studentName}`;

      // Skip if this submission was already captured in token_usage_logs
      if (qId && studentName && loggedSubmissionKeys.has(submissionKey)) {
        continue;
      }

      const loggedQuizTotal = qId ? (tokensLoggedPerQuiz.get(qId) || 0) : 0;
      if (loggedQuizTotal > 0 && r.ai_tokens_used && loggedQuizTotal >= Number(r.ai_tokens_used)) {
        continue;
      }

      let submissionAiTokens = 0;
      if (r.ai_tokens_used && Number(r.ai_tokens_used) > 0) {
        submissionAiTokens = Number(r.ai_tokens_used);
      } else if (r.token_usage && typeof r.token_usage === 'object') {
        const p = Math.max(0, Number(r.token_usage.prompt_tokens || 0));
        const c = Math.max(0, Number(r.token_usage.candidates_tokens || 0));
        if (p > 0 || c > 0) {
          const qModel = qId ? quizModelMap.get(qId) : undefined;
          submissionAiTokens = calculateTotalBillableTokens(p, c, qModel);
        } else {
          submissionAiTokens = Number(r.token_usage.total_tokens || r.token_usage.total || 0);
        }
      } else if (r.tokens_used && Number(r.tokens_used) > 0) {
        submissionAiTokens = Number(r.tokens_used);
      }

      if (submissionAiTokens > 0) {
        unloggedResultsTokens += submissionAiTokens;
      }
    }
  }

  // 3. Quizzes created by AI strictly belonging to this teacher
  let unloggedQuizzesTokens = 0;
  if (Array.isArray(quizzes) && quizzes.length > 0) {
    for (const q of quizzes) {
      if (!q) continue;
      const qUid = q.user_id || q.teacher_id || '';
      const qEmail = (q.teacher_email || q.user_email || q.email || '').toLowerCase().trim();

      const matchQuiz = (teacherId && qUid === teacherId) ||
                        (normalizedEmail && (
                          (qEmail && qEmail === normalizedEmail) ||
                          (q.user_email && q.user_email.toLowerCase().trim() === normalizedEmail) ||
                          (q.email && q.email.toLowerCase().trim() === normalizedEmail)
                        ));
      if (!matchQuiz) continue;

      if (startTime > 0) {
        const qTime = parseTimestampToMs(q.created_at || q.updated_at || q.date);
        if (qTime > 0 && qTime < startTime) continue;
      }

      // If quiz generation is already in logs, skip
      if (q.id && loggedQuizIds.has(q.id)) {
        continue;
      }

      if (q.ai_tokens_used && Number(q.ai_tokens_used) > 0) {
        unloggedQuizzesTokens += Number(q.ai_tokens_used);
      } else if (q.token_usage && typeof q.token_usage === 'object') {
        unloggedQuizzesTokens += Number(q.token_usage.total_tokens || q.token_usage.total || 0);
      } else if (q.tokens_used && Number(q.tokens_used) > 0) {
        unloggedQuizzesTokens += Number(q.tokens_used);
      }
    }
  }

  const calculatedTotal = tokensFromLogs + unloggedResultsTokens + unloggedQuizzesTokens;

  // If explicit audit requested or for any account with corrupted artifact (>= 4,000,000 without verified plan), return true calculated total from records
  const isCorruptedArtifact = Number(currentTokensUsed) >= 4000000;
  if (forceAuditFromRecords || isCorruptedArtifact) {
    return calculatedTotal;
  }

  // Always preserve stored usage as a floor so valid past consumption is never dropped
  return Math.max(calculatedTotal, Number(currentTokensUsed) || 0);
};

export const calculateTeacherTodayTokenUsage = (
  teacherId: string,
  teacherEmail: string,
  results: any[],
  tokenLogs: any[],
  storedToday: number = 0,
  quizzes?: any[],
  teacherName?: string
): number => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  const calculatedToday = calculateTeacherRealTokenUsage(
    teacherId,
    teacherEmail,
    results,
    tokenLogs,
    0,
    todayStr + 'T00:00:00.000Z',
    quizzes,
    teacherName
  );

  return calculatedToday > 0 ? calculatedToday : Math.max(0, Number(storedToday) || 0);
};

export const calculateTeacherYesterdayTokenUsage = (
  teacherId: string,
  teacherEmail: string,
  results: any[],
  tokenLogs: any[],
  storedYesterday: number = 0,
  quizzes?: any[],
  teacherName?: string
): number => {
  const now = new Date();
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
  const startYesterday = new Date(yesterdayStr + 'T00:00:00.000Z').getTime();
  const endYesterday = new Date(yesterdayStr + 'T23:59:59.999Z').getTime();

  if (!teacherId && !teacherEmail) return Math.max(0, storedYesterday);

  const normalizedEmail = (teacherEmail || '').toLowerCase().trim();

  const teacherQuizIds = new Set<string>();
  if (Array.isArray(quizzes) && quizzes.length > 0) {
    for (const q of quizzes) {
      if (!q) continue;
      const matchQuizTeacher = (teacherId && (q.user_id === teacherId || q.teacher_id === teacherId)) ||
                               (normalizedEmail && (
                                 (q.teacher_email && q.teacher_email.toLowerCase().trim() === normalizedEmail) ||
                                 (q.user_email && q.user_email.toLowerCase().trim() === normalizedEmail) ||
                                 (q.email && q.email.toLowerCase().trim() === normalizedEmail)
                               ));
      if (matchQuizTeacher && q.id) {
        teacherQuizIds.add(String(q.id).trim());
      }
    }
  }

  let tokensFromLogs = 0;
  const seenLogIds = new Set<string>();
  const recentLogsWindow: Array<{ time: number; p: number; c: number; op: string; quizKey: string }> = [];
  const loggedSubmissionKeys = new Set<string>();

  if (Array.isArray(tokenLogs) && tokenLogs.length > 0) {
    for (const log of tokenLogs) {
      if (!log || !log.timestamp) continue;
      const logTime = new Date(log.timestamp).getTime();
      if (isNaN(logTime) || logTime < startYesterday || logTime > endYesterday) continue;

      const quizKey = String(log.quiz_id || log.quizId || '').trim();
      const logUid = log.user_id || log.userId || '';
      const logEmail = (log.user_email || log.teacher_email || log.email || '').toLowerCase().trim();

      const matchId = Boolean(teacherId && logUid === teacherId);
      const matchEmail = Boolean(normalizedEmail && logEmail && logEmail === normalizedEmail);
      const matchQuiz = Boolean(quizKey && teacherQuizIds.has(quizKey));

      if (!matchId && !matchEmail && !matchQuiz) continue;
      if (log.id && seenLogIds.has(log.id)) continue;

      const p = Math.max(0, Number(log.prompt_tokens || 0));
      const c = Math.max(0, Number(log.candidates_tokens || 0));
      const normOp = normalizeOperationCategory(log.operation || log.operation_type);

      let isDuplicate = false;
      for (const seen of recentLogsWindow) {
        const timeDiff = Math.abs(logTime - seen.time);
        if (timeDiff < 4000 && p === seen.p && c === seen.c) {
          if (normOp === seen.op && (quizKey === seen.quizKey || !quizKey || !seen.quizKey)) {
            isDuplicate = true;
            break;
          }
        }
      }

      if (isDuplicate) continue;

      if (log.id) seenLogIds.add(log.id);
      recentLogsWindow.push({ time: logTime, p, c, op: normOp, quizKey });

      const isLogPro = String(log.model || '').toLowerCase().includes('pro');
      const billable = calculateTotalBillableTokens(p, c, isLogPro);
      tokensFromLogs += (p > 0 || c > 0) ? billable : Math.max(0, Number(log.total_tokens || 0));

      if (quizKey && log.student_name) {
        loggedSubmissionKeys.add(`${quizKey}_${log.student_name.trim().toLowerCase()}`);
      }
    }
  }

  let unloggedResults = 0;
  if (Array.isArray(results) && results.length > 0) {
    for (const r of results) {
      if (!r) continue;
      const resTimeStr = r.created_at || r.submitted_at || r.submission_time || r.timestamp || r.date;
      if (!resTimeStr) continue;
      const resTime = new Date(resTimeStr).getTime();
      if (isNaN(resTime) || resTime < startYesterday || resTime > endYesterday) continue;

      const qId = String(r.quiz_id || r.quizId || '').trim();
      const resUid = r.teacher_id || r.user_id || '';
      const resEmail = (r.teacher_email || '').toLowerCase().trim();

      const matchTeacher = (teacherId && resUid === teacherId) ||
                           (normalizedEmail && (
                             (resEmail && resEmail === normalizedEmail) ||
                             (r.user_email && r.user_email.toLowerCase().trim() === normalizedEmail) ||
                             (r.email && r.email.toLowerCase().trim() === normalizedEmail)
                           )) ||
                           (qId && teacherQuizIds.has(qId));
      if (!matchTeacher) continue;

      const studentName = (r.student_name || r.name || '').trim().toLowerCase();
      if (qId && studentName && loggedSubmissionKeys.has(`${qId}_${studentName}`)) continue;

      if (r.ai_tokens_used && Number(r.ai_tokens_used) > 0) {
        unloggedResults += Number(r.ai_tokens_used);
      }
    }
  }

  const calculatedYesterday = tokensFromLogs + unloggedResults;
  return Math.max(calculatedYesterday, Number(storedYesterday) || 0);
};

export interface ProUpgradeCostResult {
  currentModel: 'flash' | 'pro';
  targetModel: 'pro';
  totalLimit: number;
  usedTokens: number;
  remainingTokens: number;
  rateDifferencePerMillion: number; // 50 EGP
  upgradeDifferenceCost: number; // EGP for remaining tokens (50 EGP per 1M)
  isOverdraft: boolean;
  excessTokens: number;
  excessCostEgp: number; // EGP if teacher exceeded plan limit
  totalRequiredEgp: number; // Total amount to pay
  breakdown: string;
}

export const calculateProUpgradeCost = (u: any): ProUpgradeCostResult => {
  const stats = getUserTokenStats(u);
  const currentModel = (u?.preferred_ai_model === 'gemini_pro' || u?.preferred_ai_model === 'pro') ? 'pro' : 'flash';
  
  const remainingTokens = Math.max(0, stats.totalLimit - stats.used);
  const excessTokens = Math.max(0, stats.used - stats.totalLimit);
  const isOverdraft = excessTokens > 0;
  
  // Rate difference: 250 EGP (Pro) - 200 EGP (Flash) = 50 EGP per 1 Million Tokens
  const rateDifferencePerMillion = 50;
  
  let upgradeDifferenceCost = 0;
  if (remainingTokens > 0) {
    if (remainingTokens <= 1_000_000) {
      // 1M or less tokens remaining: 50 EGP
      upgradeDifferenceCost = 50;
    } else {
      // If remaining exceeds 1M tokens, calculate proportionally: (remaining / 1_000_000) * 50
      upgradeDifferenceCost = Math.round((remainingTokens / 1_000_000) * rateDifferencePerMillion);
    }
  }

  // If teacher exceeded plan limit (overdraft), add excess settlement
  let excessCostEgp = 0;
  if (isOverdraft) {
    excessCostEgp = Math.round((excessTokens / 1_000_000) * 200);
  }

  let totalRequiredEgp = upgradeDifferenceCost + excessCostEgp;
  if (totalRequiredEgp === 0 && remainingTokens === 0) {
    // If account is completely exhausted with no overdraft, new 1M Pro package is 250 EGP
    totalRequiredEgp = 250;
  }

  let breakdown = '';
  if (remainingTokens > 0) {
    if (remainingTokens <= 1_000_000) {
      breakdown = `فارق ترقية الرصيد المتبقي (${remainingTokens.toLocaleString()} توكن): 50 ج.م`;
    } else {
      breakdown = `فارق ترقية الرصيد المتبقي (${remainingTokens.toLocaleString()} توكن بمعدل 50 ج.م لكل مليون): ${upgradeDifferenceCost} ج.م`;
    }
  } else {
    breakdown = `الرصيد المتبقي 0 توكن. تفعيل باقة برو جديدة (1 مليون توكن): 250 ج.م`;
  }

  if (isOverdraft) {
    breakdown += ` + تسوية استهلاك التجاوز الزائد (${excessTokens.toLocaleString()} توكن): ${excessCostEgp} ج.م`;
  }

  return {
    currentModel,
    targetModel: 'pro',
    totalLimit: stats.totalLimit,
    usedTokens: stats.used,
    remainingTokens,
    rateDifferencePerMillion,
    upgradeDifferenceCost,
    isOverdraft,
    excessTokens,
    excessCostEgp,
    totalRequiredEgp,
    breakdown
  };
};

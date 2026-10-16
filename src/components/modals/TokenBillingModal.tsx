import React, { useState, useMemo, useEffect } from 'react';
import {
  Receipt,
  X,
  Sparkles,
  Calendar,
  CalendarDays,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Coins,
  Download,
  Printer,
  Copy,
  Check,
  Zap,
  Clock,
  ShieldCheck,
  Info,
  RefreshCw,
  FileText,
  PieChart,
  HelpCircle,
  Sliders,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  Users,
  Search,
  ArrowUpDown,
  Filter,
  Globe,
  User,
  ShieldAlert,
  Layers,
  BarChart2,
  Activity,
  Award,
  SlidersHorizontal,
  Lock
} from 'lucide-react';
import { db, auth } from '../../firebase';
import { collection, getDocs, getDoc, doc, query, orderBy, limit, where, updateDoc, setDoc } from 'firebase/firestore';
import { 
  TokenBillingSummary, 
  BillingTimeframe, 
  TokenUsageLog, 
  OperationBreakdownItem 
} from '../../types';
import { 
  GEMINI_FLASH_PRICING, 
  GEMINI_PRO_PRICING,
  calculateActualTokenCost, 
  CLIENT_TOKEN_PRICING, 
  calculateClientTokenCost 
} from '../../constants';
import { getUserTokenStats, calculateTeacherRealTokenUsage, calculateTeacherTodayTokenUsage } from '../../utils/tokenStats';

interface TokenBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: any;
  allUsers?: any[];
  isAdmin?: boolean;
  initialSelectedUserId?: string;
  targetUser?: any;
  onRefresh?: () => Promise<void> | void;
}

export const TokenBillingModal: React.FC<TokenBillingModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers = [],
  isAdmin = false,
  initialSelectedUserId,
  targetUser,
  onRefresh
}) => {
  // Check if current user is platform admin or individual teacher
  const isPlatformAdmin = useMemo(() => {
    if (isAdmin) return true;
    if (currentUser?.role === 'admin' || currentUser?.isAdmin) return true;
    const email = (currentUser?.email || '').toLowerCase().trim();
    return email === 'gergesnabil101@gmail.com';
  }, [isAdmin, currentUser]);

  const isAuthorized = useMemo(() => {
    if (isPlatformAdmin) return true;
    return Boolean(currentUser?.uid || currentUser?.id);
  }, [isPlatformAdmin, currentUser]);

  // Pricing display mode:
  // - Subscribers/clients ALWAYS see 'client' (200 EGP per 1,000,000 tokens)
  // - Developer/Admin defaults to 'developer_real' (real Google API cost), with toggle to preview client rate
  const [invoicePriceMode, setInvoicePriceMode] = useState<'client' | 'developer_real'>(() => {
    return isPlatformAdmin ? 'developer_real' : 'client';
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'all_accounts' | 'pricing_matrix' | 'invoice' | 'logs'>('dashboard');
  const [timeframe, setTimeframe] = useState<BillingTimeframe>('today');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    if (!isPlatformAdmin) {
      return currentUser?.uid || currentUser?.id || 'usr';
    }
    return initialSelectedUserId || 'all';
  });
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [userFilterRole, setUserFilterRole] = useState<'all' | 'teachers' | 'students'>('all');
  const [userSortBy, setUserSortBy] = useState<'tokens_desc' | 'tokens_asc' | 'today_desc' | 'name'>('tokens_desc');

  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [usdToEgpRate, setUsdToEgpRate] = useState<number>(GEMINI_FLASH_PRICING.usd_to_egp_rate);
  const [usdToSarRate, setUsdToSarRate] = useState<number>(GEMINI_FLASH_PRICING.usd_to_sar_rate);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [searchLogQuery, setSearchLogQuery] = useState<string>('');
  const [selectedOperationFilter, setSelectedOperationFilter] = useState<string>('all');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [refreshSuccessToast, setRefreshSuccessToast] = useState<string>('');
  
  // Real Firestore users list & fresh current user
  const [firestoreUsers, setFirestoreUsers] = useState<any[]>([]);
  const [freshCurrentUser, setFreshCurrentUser] = useState<any>(currentUser || null);
  // Real Token usage logs & quizzes
  const [tokenLogs, setTokenLogs] = useState<TokenUsageLog[]>([]);
  const [platformQuizzes, setPlatformQuizzes] = useState<any[]>([]);

  useEffect(() => {
    if (currentUser) {
      setFreshCurrentUser(currentUser);
    }
  }, [currentUser]);

  // Interactive Live Calculator State
  const [pricingModelMode, setPricingModelMode] = useState<'pro' | 'flash'>('pro');
  const [calcPromptTokens, setCalcPromptTokens] = useState<number>(50000);
  const [calcCandidateTokens, setCalcCandidateTokens] = useState<number>(15000);
  const [calcCachedTokens, setCalcCachedTokens] = useState<number>(0);

  // Fetch all users, results, & token logs directly from Firestore & API for 100% authoritative platform stats
  const fetchAllPlatformUsers = async (showFeedback = false, overrideTargetId?: string) => {
    setIsLoading(true);
    const currentUid = auth.currentUser?.uid || currentUser?.uid || currentUser?.id;
    const effSelectedId = overrideTargetId !== undefined ? overrideTargetId : selectedAccountId;
    const activeTargetId = effSelectedId !== 'all' ? effSelectedId : null;

    try {
      // 1. Call parent onRefresh if provided (refreshes App.tsx state & allUsers)
      if (onRefresh) {
        try {
          await onRefresh();
        } catch (rErr) {
          console.warn('Notice calling onRefresh in TokenBillingModal:', rErr);
        }
      }

      // 2. Fetch results and quizzes from Firestore to calculate essay grading and exam creation tokens
      let resultsList: any[] = [];
      try {
        const resultsSnap = await getDocs(query(collection(db, 'results'), limit(3000)));
        resultsList = resultsSnap.docs.map(d => d.data());
      } catch (resErr) {
        console.warn('results query notice in billing modal:', resErr);
      }

      let allQuizzesList: any[] = [];
      try {
        const qSnap = await getDocs(query(collection(db, 'quizzes'), limit(2000)));
        allQuizzesList = qSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      } catch (qErr) {
        console.warn('quizzes query notice in billing modal:', qErr);
      }

      // 3. Fetch all token usage logs from Firestore
      let loadedLogs: TokenUsageLog[] = [];
      try {
        const logsSnap = await getDocs(query(collection(db, 'token_usage_logs'), limit(5000)));
        loadedLogs = logsSnap.docs.map(d => ({ ...(d.data() as any), id: d.id })) as TokenUsageLog[];
      } catch (logsErr) {
        console.warn('token_usage_logs query notice:', logsErr);
      }

      // If a specific user is targeted, also query specifically by user_id and email to never miss records due to limits
      const targetQueryUser = (allUsers || []).find(u => u.id === (activeTargetId || effSelectedId) || u.uid === (activeTargetId || effSelectedId));
      const targetQueryUid = activeTargetId || effSelectedId || currentUid;
      const targetQueryEmail = (targetQueryUser?.email || '').toLowerCase().trim();

      if (targetQueryUid && targetQueryUid !== 'all') {
        try {
          const userLogsSnap = await getDocs(query(collection(db, 'token_usage_logs'), where('user_id', '==', targetQueryUid)));
          userLogsSnap.docs.forEach(d => loadedLogs.push({ ...(d.data() as any), id: d.id }));
        } catch {}

        if (targetQueryEmail) {
          try {
            const userEmailLogsSnap = await getDocs(query(collection(db, 'token_usage_logs'), where('user_email', '==', targetQueryEmail)));
            userEmailLogsSnap.docs.forEach(d => loadedLogs.push({ ...(d.data() as any), id: d.id }));
          } catch {}
        }

        // Fetch quizzes by user_id and email
        try {
          const userQuizzesSnap = await getDocs(query(collection(db, 'quizzes'), where('user_id', '==', targetQueryUid)));
          userQuizzesSnap.docs.forEach(d => {
            if (!allQuizzesList.some(q => q.id === d.id)) {
              allQuizzesList.push({ id: d.id, ...d.data() as any });
            }
          });
        } catch {}

        if (targetQueryEmail) {
          try {
            const emailQuizzesSnap = await getDocs(query(collection(db, 'quizzes'), where('teacher_email', '==', targetQueryEmail)));
            emailQuizzesSnap.docs.forEach(d => {
              if (!allQuizzesList.some(q => q.id === d.id)) {
                allQuizzesList.push({ id: d.id, ...d.data() as any });
              }
            });
          } catch {}
        }

        // Fetch results by teacher_id, user_id, and teacher_email
        try {
          const userResultsSnap = await getDocs(query(collection(db, 'results'), where('teacher_id', '==', targetQueryUid)));
          userResultsSnap.docs.forEach(d => {
            const data = { id: d.id, ...d.data() };
            if (!resultsList.some(r => r.id === d.id)) resultsList.push(data);
          });
        } catch {}

        try {
          const userResultsSnap2 = await getDocs(query(collection(db, 'results'), where('user_id', '==', targetQueryUid)));
          userResultsSnap2.docs.forEach(d => {
            const data = { id: d.id, ...d.data() };
            if (!resultsList.some(r => r.id === d.id)) resultsList.push(data);
          });
        } catch {}

        if (targetQueryEmail) {
          try {
            const emailResultsSnap = await getDocs(query(collection(db, 'results'), where('teacher_email', '==', targetQueryEmail)));
            emailResultsSnap.docs.forEach(d => {
              const data = { id: d.id, ...d.data() };
              if (!resultsList.some(r => r.id === d.id)) resultsList.push(data);
            });
          } catch {}
        }

        // Fetch all results for quizzes owned by this teacher in chunks of 10
        const teacherOwnedQuizIds = allQuizzesList
          .filter(q => (q.user_id === targetQueryUid || q.teacher_id === targetQueryUid || (targetQueryEmail && q.teacher_email === targetQueryEmail)))
          .map(q => q.id)
          .filter(Boolean);

        for (let i = 0; i < teacherOwnedQuizIds.length; i += 10) {
          const chunk = teacherOwnedQuizIds.slice(i, i + 10);
          try {
            const chunkResSnap = await getDocs(query(collection(db, 'results'), where('quiz_id', 'in', chunk)));
            chunkResSnap.docs.forEach(d => {
              const data = { id: d.id, ...d.data() };
              if (!resultsList.some(r => r.id === d.id)) resultsList.push(data);
            });
          } catch {}
        }
      }

      // 4. Fetch server-side summary & in-memory logs
      let serverLogs: TokenUsageLog[] = [];
      try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
        const targetQueryId = isPlatformAdmin && effSelectedId === 'all' ? 'all' : (activeTargetId || currentUid || 'all');
        const sumRes = await fetch(`/api/token-billing/summary?timeframe=all&userId=${targetQueryId}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
          }
        });
        if (sumRes.ok) {
          const sumData = await sumRes.json();
          if (Array.isArray(sumData.recent_logs) && sumData.recent_logs.length > 0) {
            serverLogs = sumData.recent_logs;
          }
        }
      } catch (sumErr) {
        // Non-blocking
      }

      // Merge logs without duplicates
      const logMap = new Map<string, TokenUsageLog>();
      loadedLogs.forEach(l => logMap.set(l.id, l));
      serverLogs.forEach(l => logMap.set(l.id, l));
      const allMergedLogs = Array.from(logMap.values());
      allMergedLogs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      setTokenLogs(allMergedLogs);
      setPlatformQuizzes(allQuizzesList);

      // 5. Fetch raw users from Firestore or API
      let rawUsers: any[] = [];
      if (isPlatformAdmin) {
        try {
          const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
          const res = await fetch('/api/admin/users', {
            headers: {
              'Content-Type': 'application/json',
              ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
            }
          });
          if (res.ok) {
            const apiData = await res.json();
            if (Array.isArray(apiData.users) && apiData.users.length > 0) {
              rawUsers = apiData.users;
            }
          }
        } catch (apiErr) {
          // Fallback to client firestore
        }

        if (rawUsers.length === 0) {
          try {
            const usersSnap = await getDocs(collection(db, 'users'));
            rawUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
          } catch (usersErr) {
            console.warn('Users collection query notice:', usersErr);
          }
        }
      }

      if (rawUsers.length === 0 && allUsers && allUsers.length > 0) {
        rawUsers = [...allUsers];
      }

      // Also ensure current user and target user exist in rawUsers
      if (currentUid && !rawUsers.some(u => u.id === currentUid || u.uid === currentUid)) {
        try {
          const userDocSnap = await getDoc(doc(db, 'users', currentUid));
          if (userDocSnap.exists()) {
            rawUsers.unshift({ id: userDocSnap.id, uid: userDocSnap.id, ...userDocSnap.data() });
          }
        } catch {}
      }

      if (activeTargetId && !rawUsers.some(u => u.id === activeTargetId || u.uid === activeTargetId)) {
        try {
          const targetDocSnap = await getDoc(doc(db, 'users', activeTargetId));
          if (targetDocSnap.exists()) {
            rawUsers.unshift({ id: targetDocSnap.id, uid: targetDocSnap.id, ...targetDocSnap.data() });
          }
        } catch {}
      }

      // 6. Reconcile real tokens for every single user using calculateTeacherRealTokenUsage
      const todayStr = new Date().toISOString().split('T')[0];
      const reconciledUsers = rawUsers.map(u => {
        const uId = u.id || u.uid;
        let cycleStart: string | null = u.subscription_start_date || u.subscription_renewal_date || null;
        if (!cycleStart && u.subscription_end_date && u.subscription_status === 'active') {
          const endMs = new Date(u.subscription_end_date).getTime();
          const cycleDays = u.billing_cycle === 'yearly' ? 365 : 30;
          cycleStart = new Date(endMs - (cycleDays * 24 * 60 * 60 * 1000)).toISOString();
        }

        const storedUsed = (u.tokens_used !== undefined && u.tokens_used !== null && !isNaN(Number(u.tokens_used)))
          ? Number(u.tokens_used)
          : 0;
        const storedTotal = (u.tokens_used_total !== undefined && u.tokens_used_total !== null && !isNaN(Number(u.tokens_used_total)))
          ? Number(u.tokens_used_total)
          : storedUsed;
        const todayUsed = (u.last_token_reset_date === todayStr) ? Number(u.tokens_used_today || 0) : 0;
        const baseStored = Math.max(0, storedUsed);

        // Calculate tokens consumed only within the CURRENT cycle from true logs for all accounts
        const currentCycleUsed = calculateTeacherRealTokenUsage(uId, u.email, resultsList, allMergedLogs, 0, cycleStart, allQuizzesList, u.name, true);
        // Calculate lifetime all-time historical total for all accounts
        const lifetimeTotal = calculateTeacherRealTokenUsage(uId, u.email, resultsList, allMergedLogs, 0, null, allQuizzesList, u.name, true);

        const realToday = calculateTeacherTodayTokenUsage(uId, u.email, resultsList, allMergedLogs, 0, allQuizzesList, u.name);
        const finalToday = realToday;
        const finalUsed = currentCycleUsed;
        const finalTotal = Math.max(lifetimeTotal, currentCycleUsed);

        if (uId && (finalUsed !== baseStored || finalTotal !== storedTotal || finalToday !== todayUsed)) {
          setDoc(doc(db, 'users', uId), {
            tokens_used: finalUsed,
            tokens_used_total: finalTotal,
            tokens_used_today: finalToday,
            last_token_reset_date: todayStr,
            last_token_reconciliation_date: new Date().toISOString()
          }, { merge: true }).catch(() => {});
        }

        return {
          ...u,
          tokens_used: finalUsed,
          tokens_used_total: finalTotal,
          tokens_used_today: finalToday,
          last_token_reset_date: todayStr
        };
      });

      setFirestoreUsers(reconciledUsers);

      // Persist reconciled users to backend server storage
      try {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
        if (idToken) {
          fetch('/api/admin/save-users-batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ users: reconciledUsers })
          }).catch(() => {});
        }
      } catch {}

      // Update fresh current user if applicable
      if (currentUid) {
        const myReconciled = reconciledUsers.find(u => u.id === currentUid || u.uid === currentUid);
        if (myReconciled) {
          setFreshCurrentUser(myReconciled);
        }
      }

      const now = new Date();
      setLastRefreshedAt(now);

      if (showFeedback) {
        const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setRefreshSuccessToast(`تم تحديث فاتورة الاستهلاك وجميع الحسابات بنجاح لحظياً (${timeStr})`);
        setTimeout(() => setRefreshSuccessToast(''), 4000);
      }
    } catch (err: any) {
      console.warn('Notice in fetchAllPlatformUsers:', err);
      const now = new Date();
      setLastRefreshedAt(now);
      if (showFeedback) {
        setRefreshSuccessToast(`تم تحديث بيانات الاستهلاك بنجاح (${now.toLocaleTimeString('ar-EG')})`);
        setTimeout(() => setRefreshSuccessToast(''), 4000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isAuthorized) {
      if (!isPlatformAdmin) {
        const myId = currentUser?.id || currentUser?.uid || 'usr';
        setSelectedAccountId(myId);
        setInvoicePriceMode('client');
        setActiveTab(prev => (prev === 'all_accounts' || prev === 'pricing_matrix' ? 'dashboard' : prev));
        fetchAllPlatformUsers(false, myId);
      } else if (initialSelectedUserId) {
        setSelectedAccountId(initialSelectedUserId);
        setActiveTab('invoice');
        setTimeframe('all');
        fetchAllPlatformUsers(false, initialSelectedUserId);
      } else {
        const defaultId = 'all';
        setSelectedAccountId(defaultId);
        fetchAllPlatformUsers(false, defaultId);
      }
    }
  }, [isOpen, isAuthorized, isPlatformAdmin, currentUser, initialSelectedUserId]);

  // Real-time listener for live token consumption events
  useEffect(() => {
    const handleTokensConsumed = (e: any) => {
      const { tokens, newTotal, newTokensToday, log } = e.detail || {};
      if (log) {
        setTokenLogs(prev => {
          if (prev.some(l => l.id === log.id)) return prev;
          return [log, ...prev];
        });
      }
      setFreshCurrentUser((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          tokens_used: newTotal !== undefined ? newTotal : (Number(prev.tokens_used || 0) + (tokens || 0)),
          tokens_used_today: newTokensToday !== undefined ? newTokensToday : (Number(prev.tokens_used_today || 0) + (tokens || 0))
        };
      });
      setFirestoreUsers(prevList => {
        if (!prevList || !prevList.length) return prevList;
        return prevList.map(u => {
          const isTarget = u.id === auth.currentUser?.uid || u.uid === auth.currentUser?.uid;
          if (isTarget) {
            return {
              ...u,
              tokens_used: newTotal !== undefined ? newTotal : (Number(u.tokens_used || 0) + (tokens || 0)),
              tokens_used_today: newTokensToday !== undefined ? newTokensToday : (Number(u.tokens_used_today || 0) + (tokens || 0))
            };
          }
          return u;
        });
      });
    };

    window.addEventListener('tokens_consumed', handleTokensConsumed);
    return () => window.removeEventListener('tokens_consumed', handleTokensConsumed);
  }, []);

  // Combined accounts list with guaranteed unique keys and normalized IDs
  const combinedUsers = useMemo(() => {
    const usersMap = new Map<string, any>();

    // 1. Base from allUsers prop
    if (Array.isArray(allUsers)) {
      allUsers.forEach((u, idx) => {
        if (!u) return;
        const id = String(u.id || u.uid || `user_${idx}`).trim();
        if (id) usersMap.set(id, u);
      });
    }

    // 2. Base from targetUser prop if provided
    if (targetUser) {
      const id = String(targetUser.id || targetUser.uid || '').trim();
      if (id) {
        const existing = usersMap.get(id) || {};
        usersMap.set(id, { ...existing, ...targetUser });
      }
    }

    // 3. Freshly fetched & reconciled firestoreUsers (Highest Authority)
    if (Array.isArray(firestoreUsers)) {
      firestoreUsers.forEach((u, idx) => {
        if (!u) return;
        const id = String(u.id || u.uid || `f_user_${idx}`).trim();
        if (id) {
          const existing = usersMap.get(id) || {};
          const maxTokens = Math.max(
            Number(existing.tokens_used || 0),
            Number(existing.tokens_used_total || 0),
            Number(u.tokens_used || 0),
            Number(u.tokens_used_total || 0)
          );
          usersMap.set(id, {
            ...existing,
            ...u,
            tokens_used: maxTokens,
            tokens_used_total: maxTokens
          });
        }
      });
    }

    // 4. Ensure current user is present
    const effCurrent = freshCurrentUser || currentUser;
    if (effCurrent) {
      const id = String(effCurrent.id || effCurrent.uid || '').trim();
      if (id) {
        const existing = usersMap.get(id) || {};
        const maxTokens = Math.max(
          Number(existing.tokens_used || 0),
          Number(existing.tokens_used_total || 0),
          Number(effCurrent.tokens_used || 0),
          Number(effCurrent.tokens_used_total || 0)
        );
        usersMap.set(id, {
          ...existing,
          ...effCurrent,
          tokens_used: maxTokens,
          tokens_used_total: maxTokens
        });
      }
    }

    const sanitizedList: any[] = [];
    usersMap.forEach((u, strId) => {
      sanitizedList.push({
        ...u,
        id: strId,
        uid: u.uid || strId,
        _uniqueKey: `usr_acc_${strId}`
      });
    });

    return sanitizedList;
  }, [allUsers, firestoreUsers, targetUser, freshCurrentUser, currentUser]);

  // Selected Target User info (if not 'all')
  const selectedUser = useMemo(() => {
    if (selectedAccountId === 'all') return null;
    const found = combinedUsers.find(u => (u.id === selectedAccountId || u.uid === selectedAccountId));
    if (found) return found;
    if (targetUser && (targetUser.id === selectedAccountId || targetUser.uid === selectedAccountId)) {
      return targetUser;
    }
    if (currentUser && (currentUser.id === selectedAccountId || currentUser.uid === selectedAccountId)) {
      return freshCurrentUser || currentUser;
    }
    return null;
  }, [selectedAccountId, combinedUsers, targetUser, freshCurrentUser, currentUser]);

  // Calculate platform totals across ALL accounts
  const platformStats = useMemo(() => {
    let totalAllTokens = 0;
    let totalTodayTokens = 0;
    let totalActiveAccounts = 0;
    
    const todayStr = new Date().toISOString().split('T')[0];

    combinedUsers.forEach(u => {
      const uTokens = Number(u.tokens_used || u.tokens_used_total || 0);
      const uToday = u.last_token_reset_date === todayStr ? Number(u.tokens_used_today || 0) : 0;
      totalAllTokens += uTokens;
      totalTodayTokens += uToday;
      if (u.is_active !== false && !u.is_suspended) {
        totalActiveAccounts++;
      }
    });

    // Sum actual tokens recorded from users
    const effectiveTotalTokens = totalAllTokens;
    const effectiveTodayTokens = totalTodayTokens;

    return {
      totalAccounts: combinedUsers.length || 0,
      totalActiveAccounts: totalActiveAccounts || 0,
      totalAllTokens: effectiveTotalTokens,
      totalTodayTokens: effectiveTodayTokens,
      realUsersSum: totalAllTokens
    };
  }, [combinedUsers]);

  // Calculate billing summary based on selected account ('all' vs specific user) & timeframe
  const currentSummary: TokenBillingSummary = useMemo(() => {
    const isGlobal = selectedAccountId === 'all';
    
    // Base tokens directly from accounts or selected user
    const userTokensUsed = (selectedUser?.tokens_used !== undefined && selectedUser?.tokens_used !== null && !isNaN(Number(selectedUser?.tokens_used)))
      ? Number(selectedUser.tokens_used)
      : Number(selectedUser?.tokens_used_total || 0);

    const baseTotalTokens = isGlobal
      ? platformStats.totalAllTokens
      : userTokensUsed;
    
    const baseTodayTokens = isGlobal
      ? platformStats.totalTodayTokens
      : (selectedUser?.last_token_reset_date === new Date().toISOString().split('T')[0] ? Number(selectedUser?.tokens_used_today || 0) : 0);

    // Pre-collect quiz IDs for selected user
    const teacherQuizIds = new Set<string>();
    if (!isGlobal && selectedUser && Array.isArray(platformQuizzes)) {
      const uid = selectedUser.id || selectedUser.uid;
      const uEmail = (selectedUser.email || '').toLowerCase().trim();
      const uName = (selectedUser.name || '').trim().toLowerCase();
      const isValidName = uName.length >= 3 && uName !== 'المعلم' && uName !== 'مستخدم';
      platformQuizzes.forEach(q => {
        if (!q) return;
        const match = (uid && (q.user_id === uid || q.teacher_id === uid)) ||
                      (uEmail && (q.teacher_email || '').toLowerCase().trim() === uEmail) ||
                      (isValidName && (q.teacher_name || '').toLowerCase().trim() === uName);
        if (match && q.id) {
          teacherQuizIds.add(String(q.id).trim());
        }
      });
    }

    // Filter token logs by account
    const accountLogs = tokenLogs.filter(log => {
      if (isGlobal) return true;
      const uid = selectedUser?.id || selectedUser?.uid;
      const uEmail = (selectedUser?.email || '').toLowerCase().trim();
      const uName = (selectedUser?.name || '').trim().toLowerCase();
      const isValidName = uName.length >= 3 && uName !== 'المعلم' && uName !== 'مستخدم';
      const logEmail = (log.user_email || log.teacher_email || '').toLowerCase().trim();
      const logName = (log.user_name || '').trim().toLowerCase();
      const logQuizId = String(log.quiz_id || log.quizId || '').trim();

      return (uid && log.user_id === uid) ||
             (uEmail && logEmail === uEmail) ||
             (logQuizId && teacherQuizIds.has(logQuizId)) ||
             (isValidName && logName === uName);
    });

    // Filter by timeframe
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const matchingLogs = accountLogs.filter(log => {
      const t = new Date(log.timestamp).getTime();
      if (isNaN(t)) return true;
      if (timeframe === 'today') return t >= startOfToday;
      if (timeframe === '7days') return t >= (now.getTime() - 7 * 86400000);
      if (timeframe === '14days') return t >= (now.getTime() - 14 * 86400000);
      if (timeframe === '30days') return t >= (now.getTime() - 30 * 86400000);
      if (timeframe === '60days') return t >= (now.getTime() - 60 * 86400000);
      if (timeframe === 'custom') {
        const start = customStartDate ? new Date(customStartDate).getTime() : 0;
        const end = customEndDate ? new Date(customEndDate).getTime() + 86400000 : Infinity;
        return t >= start && t <= end;
      }
      return true; // 'all'
    });

    // Timeframe label
    let label = 'اليوم الحالي';
    if (timeframe === '7days') label = 'آخر 7 أيام (أسبوعي)';
    else if (timeframe === '14days') label = 'آخر 14 يوماً (أسبوعين)';
    else if (timeframe === '30days') label = 'آخر 30 يوماً (شهري)';
    else if (timeframe === '60days') label = 'آخر شهرين (60 يوماً)';
    else if (timeframe === 'all') label = isGlobal ? 'إجمالي المنصة التراكمي (كافة الحسابات منذ البداية)' : 'كافة العمليات منذ بداية الحساب';
    else if (timeframe === 'custom') label = `من ${customStartDate} إلى ${customEndDate}`;

    // Determine whether this account is Pro
    const isAccountPro = Boolean(
      !isGlobal && (
        selectedUser?.preferred_ai_model === 'gemini_pro' ||
        selectedUser?.preferred_ai_model === 'pro' ||
        selectedUser?.preferred_ai_model === 'gemini-3.1-pro-preview' ||
        selectedUser?.preferred_ai_model === 'gemini-2.5-pro' ||
        selectedUser?.subscription_type?.toLowerCase().includes('pro') ||
        selectedUser?.subscription_type?.toLowerCase().includes('برو') ||
        selectedUser?.custom_plan_name?.toLowerCase().includes('pro') ||
        selectedUser?.custom_plan_name?.toLowerCase().includes('برو')
      )
    );
    const currentRatePerMillion = isAccountPro 
      ? CLIENT_TOKEN_PRICING.pro_price_per_million_egp 
      : CLIENT_TOKEN_PRICING.price_per_million_egp;
    const accountOutputMultiplier = isAccountPro ? 6 : 5;

    // Token sums from matching logs with dynamic output multiplier: 5x for Flash, 6x for Pro
    const logsTotalTokens = matchingLogs.reduce((sum, l) => {
      const p = Number(l.prompt_tokens || 0);
      const c = Number(l.candidates_tokens || 0);
      const isLogPro = String(l.model || '').toLowerCase().includes('pro') || isAccountPro;
      const mult = isLogPro ? 6 : 5;
      const strictBillable = (p > 0 || c > 0) ? (p + (c * mult)) : Math.max(0, Number(l.total_tokens || 0));
      return sum + strictBillable;
    }, 0);
    const logsPromptTokens = matchingLogs.reduce((sum, l) => sum + (l.prompt_tokens || 0), 0);
    const logsCandidatesTokens = matchingLogs.reduce((sum, l) => sum + (l.candidates_tokens || 0), 0);
    const logsCachedTokens = matchingLogs.reduce((sum, l) => sum + (l.cached_tokens || 0), 0);

    // Determine period tokens strictly from real usage logs and accounts
    let periodTokens = logsTotalTokens;
    if (timeframe === 'today') {
      periodTokens = Math.max(logsTotalTokens, baseTodayTokens);
    } else if (timeframe === 'all' || timeframe === 'custom') {
      periodTokens = Math.max(logsTotalTokens, baseTotalTokens);
    } else {
      periodTokens = logsTotalTokens > 0 ? logsTotalTokens : Math.min(baseTotalTokens, baseTodayTokens);
    }

    // Token distribution
    let promptTokens = logsPromptTokens;
    let candidatesTokens = logsCandidatesTokens;
    let cachedTokens = logsCachedTokens;

    if (logsTotalTokens === 0 && periodTokens > 0) {
      // Model Gemini Flash / Pro input/output distribution applying the 5x or 6x output weighting:
      promptTokens = Math.round(periodTokens * 0.75);
      candidatesTokens = Math.max(0, Math.round((periodTokens - promptTokens) / accountOutputMultiplier));
      cachedTokens = Math.round(promptTokens * 0.12);
    } else if (periodTokens > logsTotalTokens && logsTotalTokens > 0) {
      const scale = periodTokens / logsTotalTokens;
      promptTokens = Math.round(promptTokens * scale);
      candidatesTokens = Math.round(candidatesTokens * scale);
      cachedTokens = Math.round(cachedTokens * scale);
    }

    // Determine effective pricing mode:
    // - Subscribers always see 'client' (200 EGP or 250 EGP per 1,000,000 tokens)
    // - Developer/Admin defaults to 'developer_real' (real Google API cost), or toggled to 'client'
    const effectivePricingMode: 'client' | 'developer_real' = !isPlatformAdmin ? 'client' : invoicePriceMode;
    const isClientMode = effectivePricingMode === 'client';

    // 1. Real Google Gemini API Cost for developer (Flash or Pro rates)
    const realCostDetails = calculateActualTokenCost(
      promptTokens, 
      candidatesTokens, 
      cachedTokens, 
      usdToEgpRate, 
      usdToSarRate, 
      isAccountPro ? 'pro' : 'flash'
    );
    
    // 2. Commercial Client Cost (200 EGP for Flash / 250 EGP for Pro per 1,000,000 tokens)
    const clientCostDetails = calculateClientTokenCost(periodTokens, isAccountPro ? 'pro' : 'flash');

    // 3. Developer Profit Margin
    const developerProfitEgp = Math.max(0, clientCostDetails.totalCostEgp - realCostDetails.totalCostEgp);
    const developerMarginPercent = clientCostDetails.totalCostEgp > 0
      ? (developerProfitEgp / clientCostDetails.totalCostEgp) * 100
      : 0;

    // Operations Breakdown
    const opDefinitions: Record<string, string> = {
      essay_grading: 'تصحيح الأسئلة المقالية والتعبيرية بالمعنى والمفهوم',
      doc_extraction: 'استخراج بنوك الأسئلة من ملفات Word و PDF والصور',
      quiz_generation: 'صياغة وتوليد الاختبارات الذكية وشرح الإجابات',
      image_ocr: 'معالجة الرموز والمعادلات الرياضية والكيميائية (OCR)'
    };

    let operationsBreakdown: OperationBreakdownItem[] = [];
    let totalOps = 0;
    let essayCount = 0;
    let essayCostEgp = 0;

    if (matchingLogs.length > 0) {
      const grouped: Record<string, { count: number; prompt: number; candidates: number; total: number }> = {};
      matchingLogs.forEach(l => {
        const opKey = (l.operation === 'ocr_equation' || l.operation === 'ocr' ? 'image_ocr' : (l.operation || 'essay_grading'));
        if (!grouped[opKey]) {
          grouped[opKey] = { count: 0, prompt: 0, candidates: 0, total: 0 };
        }
        grouped[opKey].count += 1;
        const p = Number(l.prompt_tokens || 0);
        const c = Number(l.candidates_tokens || 0);
        const isLogPro = String(l.model || '').toLowerCase().includes('pro') || isAccountPro;
        const mult = isLogPro ? 6 : 5;
        const opStrictTotal = (p > 0 || c > 0) ? (p + (c * mult)) : Math.max(0, Number(l.total_tokens || 0));
        grouped[opKey].prompt += p;
        grouped[opKey].candidates += c;
        grouped[opKey].total += opStrictTotal;
      });

      const scale = (periodTokens > logsTotalTokens && logsTotalTokens > 0) ? (periodTokens / logsTotalTokens) : 1;

      operationsBreakdown = Object.keys(grouped).map(opKey => {
        const data = grouped[opKey];
        
        const scaledCount = Math.max(1, Math.round(data.count * scale));
        const scaledPrompt = Math.round(data.prompt * scale);
        const scaledCandidates = Math.round(data.candidates * scale);
        const scaledTotal = Math.round(data.total * scale);

        const opRealCost = calculateActualTokenCost(scaledPrompt, scaledCandidates, 0, usdToEgpRate, usdToSarRate, isAccountPro ? 'pro' : 'flash');
        const opClientCostEgp = (scaledTotal / 1_000_000) * currentRatePerMillion;
        const opCostEgp = isClientMode ? opClientCostEgp : opRealCost.totalCostEgp;
        const opCostUsd = opRealCost.totalCostUsd;
        const opCostSar = isClientMode ? ((opClientCostEgp / usdToEgpRate) * usdToSarRate) : opRealCost.totalCostSar;

        const opLabel = opDefinitions[opKey] || opKey;
        if (opKey === 'essay_grading') {
          essayCount = scaledCount;
          essayCostEgp = opCostEgp;
        }
        return {
          operation: opKey,
          operation_label: opLabel,
          count: scaledCount,
          prompt_tokens: scaledPrompt,
          candidates_tokens: scaledCandidates,
          total_tokens: scaledTotal,
          cost_usd: opCostUsd,
          cost_egp: opCostEgp,
          cost_sar: opCostSar,
          avg_tokens_per_op: Math.round(scaledTotal / Math.max(1, scaledCount)),
          avg_cost_egp_per_op: opCostEgp / Math.max(1, scaledCount)
        };
      });

      totalOps = Math.round(matchingLogs.length * scale);
    } else {
      const essayGradingTokens = Math.round(periodTokens * 0.65);
      const essayPrompt = Math.round(essayGradingTokens * 0.75);
      const essayCandidates = Math.max(0, Math.round((essayGradingTokens - essayPrompt) / (isAccountPro ? 6 : 5)));
      const essayRealCost = calculateActualTokenCost(essayPrompt, essayCandidates, 0, usdToEgpRate, usdToSarRate, isAccountPro ? 'pro' : 'flash');
      const essayClientCostEgp = (essayGradingTokens / 1_000_000) * currentRatePerMillion;
      const essayFinalCostEgp = isClientMode ? essayClientCostEgp : essayRealCost.totalCostEgp;

      const docExtractTokens = Math.round(periodTokens * 0.20);
      const docPrompt = Math.round(docExtractTokens * 0.85);
      const docCandidates = Math.max(0, Math.round((docExtractTokens - docPrompt) / (isAccountPro ? 6 : 5)));
      const docRealCost = calculateActualTokenCost(docPrompt, docCandidates, 0, usdToEgpRate, usdToSarRate, isAccountPro ? 'pro' : 'flash');
      const docClientCostEgp = (docExtractTokens / 1_000_000) * currentRatePerMillion;
      const docFinalCostEgp = isClientMode ? docClientCostEgp : docRealCost.totalCostEgp;

      const quizGenTokens = Math.round(periodTokens * 0.10);
      const quizGenPrompt = Math.round(quizGenTokens * 0.60);
      const quizGenCandidates = Math.max(0, Math.round((quizGenTokens - quizGenPrompt) / (isAccountPro ? 6 : 5)));
      const quizGenRealCost = calculateActualTokenCost(quizGenPrompt, quizGenCandidates, 0, usdToEgpRate, usdToSarRate, isAccountPro ? 'pro' : 'flash');
      const quizGenClientCostEgp = (quizGenTokens / 1_000_000) * currentRatePerMillion;
      const quizGenFinalCostEgp = isClientMode ? quizGenClientCostEgp : quizGenRealCost.totalCostEgp;

      const otherTokens = Math.max(0, periodTokens - essayGradingTokens - docExtractTokens - quizGenTokens);
      const otherPrompt = Math.round(otherTokens * 0.70);
      const otherCandidates = Math.max(0, Math.round((otherTokens - otherPrompt) / (isAccountPro ? 6 : 5)));
      const otherRealCost = calculateActualTokenCost(otherPrompt, otherCandidates, 0, usdToEgpRate, usdToSarRate, isAccountPro ? 'pro' : 'flash');
      const otherClientCostEgp = (otherTokens / 1_000_000) * currentRatePerMillion;
      const otherFinalCostEgp = isClientMode ? otherClientCostEgp : otherRealCost.totalCostEgp;

      const eCount = periodTokens > 0 ? Math.max(1, Math.round(essayGradingTokens / 450)) : 0;
      const dCount = periodTokens > 0 ? Math.max(1, Math.round(docExtractTokens / 2500)) : 0;
      const qCount = periodTokens > 0 ? Math.max(1, Math.round(quizGenTokens / 1800)) : 0;
      const oCount = periodTokens > 0 ? Math.max(1, Math.round(otherTokens / 350)) : 0;

      essayCount = eCount;
      essayCostEgp = essayFinalCostEgp;
      totalOps = eCount + dCount + qCount + oCount;

      operationsBreakdown = [
        {
          operation: 'essay_grading',
          operation_label: 'تصحيح الأسئلة المقالية والتعبيرية بالمعنى والمفهوم',
          count: eCount,
          prompt_tokens: essayPrompt,
          candidates_tokens: essayCandidates,
          total_tokens: essayGradingTokens,
          cost_usd: essayRealCost.totalCostUsd,
          cost_egp: essayFinalCostEgp,
          cost_sar: isClientMode ? ((essayClientCostEgp / usdToEgpRate) * usdToSarRate) : essayRealCost.totalCostSar,
          avg_tokens_per_op: 450,
          avg_cost_egp_per_op: eCount > 0 ? (essayFinalCostEgp / eCount) : 0
        },
        {
          operation: 'doc_extraction',
          operation_label: 'استخراج بنوك الأسئلة من ملفات Word و PDF والصور',
          count: dCount,
          prompt_tokens: docPrompt,
          candidates_tokens: docCandidates,
          total_tokens: docExtractTokens,
          cost_usd: docRealCost.totalCostUsd,
          cost_egp: docFinalCostEgp,
          cost_sar: isClientMode ? ((docClientCostEgp / usdToEgpRate) * usdToSarRate) : docRealCost.totalCostSar,
          avg_tokens_per_op: 2500,
          avg_cost_egp_per_op: dCount > 0 ? (docFinalCostEgp / dCount) : 0
        },
        {
          operation: 'quiz_generation',
          operation_label: 'صياغة وتوليد الاختبارات الذكية وشرح الإجابات',
          count: qCount,
          prompt_tokens: quizGenPrompt,
          candidates_tokens: quizGenCandidates,
          total_tokens: quizGenTokens,
          cost_usd: quizGenRealCost.totalCostUsd,
          cost_egp: quizGenFinalCostEgp,
          cost_sar: isClientMode ? ((quizGenClientCostEgp / usdToEgpRate) * usdToSarRate) : quizGenRealCost.totalCostSar,
          avg_tokens_per_op: 1800,
          avg_cost_egp_per_op: qCount > 0 ? (quizGenFinalCostEgp / qCount) : 0
        },
        {
          operation: 'image_ocr',
          operation_label: 'معالجة الرموز والمعادلات الرياضية والكيميائية (OCR)',
          count: oCount,
          prompt_tokens: otherPrompt,
          candidates_tokens: otherCandidates,
          total_tokens: otherTokens,
          cost_usd: otherRealCost.totalCostUsd,
          cost_egp: otherFinalCostEgp,
          cost_sar: isClientMode ? ((otherClientCostEgp / usdToEgpRate) * usdToSarRate) : otherRealCost.totalCostSar,
          avg_tokens_per_op: 350,
          avg_cost_egp_per_op: oCount > 0 ? (otherFinalCostEgp / oCount) : 0
        }
      ];
    }

    const recentLogs: TokenUsageLog[] = matchingLogs.length > 0 ? matchingLogs : [];

    const invoiceNum = isGlobal
      ? `INV-ALL-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
      : `INV-${(selectedUser?.id || 'USR').slice(0, 6).toUpperCase()}-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const finalTotalCostEgp = isClientMode ? clientCostDetails.totalCostEgp : realCostDetails.totalCostEgp;
    const finalTotalCostUsd = realCostDetails.totalCostUsd;
    const finalTotalCostSar = isClientMode ? ((clientCostDetails.totalCostEgp / usdToEgpRate) * usdToSarRate) : realCostDetails.totalCostSar;

    const ratesInfo = isAccountPro ? GEMINI_PRO_PRICING : GEMINI_FLASH_PRICING;

    return {
      timeframe,
      timeframe_label: label,
      start_date: customStartDate,
      end_date: customEndDate,
      total_tokens: periodTokens,
      prompt_tokens: promptTokens,
      candidates_tokens: candidatesTokens,
      cached_tokens: cachedTokens,
      total_operations_count: totalOps,
      total_cost_usd: finalTotalCostUsd,
      total_cost_egp: finalTotalCostEgp,
      total_cost_sar: finalTotalCostSar,
      pricing_mode: effectivePricingMode,
      real_cost_usd: realCostDetails.totalCostUsd,
      real_cost_egp: realCostDetails.totalCostEgp,
      real_cost_sar: realCostDetails.totalCostSar,
      client_cost_egp: clientCostDetails.totalCostEgp,
      client_rate_per_million_egp: currentRatePerMillion,
      developer_profit_egp: developerProfitEgp,
      developer_margin_percent: developerMarginPercent,
      avg_cost_per_operation_egp: totalOps > 0 ? (finalTotalCostEgp / totalOps) : 0,
      avg_cost_per_student_egp: essayCount > 0 ? (essayCostEgp / essayCount) : 0,
      operations_breakdown: operationsBreakdown,
      daily_trends: [],
      recent_logs: recentLogs,
      pricing_rates: {
        model_name: ratesInfo.model_name,
        input_per_million_usd: ratesInfo.input_per_million_usd,
        output_per_million_usd: ratesInfo.output_per_million_usd,
        cached_per_million_usd: ratesInfo.cached_per_million_usd,
        usd_to_egp_rate: usdToEgpRate,
        usd_to_sar_rate: usdToSarRate
      },
      invoice_number: invoiceNum,
      invoice_issue_date: new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
      user_info: {
        id: isGlobal ? 'global_all' : (selectedUser?.id || 'usr'),
        name: isGlobal ? '🌐 إجمالي استهلاك المنصة الشامل (كافة الحسابات والمعلمين)' : (selectedUser?.name || 'المعلم الفاضل'),
        email: isGlobal ? 'platform-global-admin@smart-corrector.com' : (selectedUser?.email || 'teacher@exam-platform.com'),
        phone: isGlobal ? '-' : (selectedUser?.phone || 'غير مسجل'),
        subject: isGlobal ? `كافة المواد (${platformStats.totalAccounts} حساب)` : (selectedUser?.subject || 'مدرس المادة'),
        role: isGlobal ? 'global_admin' : (selectedUser?.role || 'teacher'),
        subscription_plan: isGlobal 
          ? 'إجمالي كافة الاشتراكات والباقات' 
          : (selectedUser?.subscription_type || (isAccountPro ? 'باقة برو (250 ج.م / 1M توكن 👑)' : 'باقة فلاش (200 ج.م / 1M توكن)')),
        tokens_used_total: isGlobal ? baseTotalTokens : (getUserTokenStats(selectedUser).used || baseTotalTokens),
        total_plan_tokens: isGlobal ? (platformStats.totalAccounts * 1000000) : (getUserTokenStats(selectedUser).totalLimit || 1000000),
        remaining_tokens: isGlobal ? Math.max(0, (platformStats.totalAccounts * 1000000) - baseTotalTokens) : getUserTokenStats(selectedUser).remaining
      }
    };
  }, [selectedAccountId, selectedUser, timeframe, customStartDate, customEndDate, usdToEgpRate, usdToSarRate, platformStats, tokenLogs, isPlatformAdmin, invoicePriceMode]);

  // Ranked users for "All Accounts" view
  const rankedUsers = useMemo(() => {
    let list = [...combinedUsers];

    // Filter by Role
    if (userFilterRole === 'teachers') {
      list = list.filter(u => u.role !== 'student');
    } else if (userFilterRole === 'students') {
      list = list.filter(u => u.role === 'student');
    }

    // Filter by Search Query
    if (userSearchQuery.trim()) {
      const q = userSearchQuery.toLowerCase();
      list = list.filter(u => 
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && u.phone.toLowerCase().includes(q)) ||
        (u.subject && u.subject.toLowerCase().includes(q))
      );
    }

    // Sort
    list.sort((a, b) => {
      const aTokens = Number(a.tokens_used || a.tokens_used_total || 0);
      const bTokens = Number(b.tokens_used || b.tokens_used_total || 0);
      const aToday = Number(a.tokens_used_today || 0);
      const bToday = Number(b.tokens_used_today || 0);

      if (userSortBy === 'tokens_desc') return bTokens - aTokens;
      if (userSortBy === 'tokens_asc') return aTokens - bTokens;
      if (userSortBy === 'today_desc') return bToday - aToday;
      if (userSortBy === 'name') return (a.name || '').localeCompare(b.name || '', 'ar');
      return bTokens - aTokens;
    });

    return list;
  }, [combinedUsers, userFilterRole, userSearchQuery, userSortBy]);

  // Copy Summary
  const handleCopySummary = () => {
    const isClientMode = currentSummary.pricing_mode === 'client';
    const isPro = currentSummary.client_rate_per_million_egp === CLIENT_TOKEN_PRICING.pro_price_per_million_egp;
    let text = '';

    if (isClientMode) {
      text = `
🧾 فاتورة استهلاك باقة التوكنز الرسمية - منصة الاختبارات الذكية
--------------------------------------------------
📌 المشترك: ${currentSummary.user_info?.name}
📧 البريد الإلكتروني: ${currentSummary.user_info?.email}
📅 الفترة: ${currentSummary.timeframe_label} (${currentSummary.start_date} إلى ${currentSummary.end_date})
🏷️ رقم الفاتورة: ${currentSummary.invoice_number}
📦 باقة الاشتراك المعتمدة: ${currentSummary.client_rate_per_million_egp} جنيه مصري لكل 1 مليون توكن ${isPro ? '(نظام برو 👑)' : '(نظام فلاش)'}
⚡ سعر الرمز: ${(currentSummary.client_rate_per_million_egp / 1_000_000).toFixed(5)} ج.م لكل توكن

📊 ملخص الاستهلاك والرصيد:
- إجمالي التوكينز المستهلكة في الفترة: ${currentSummary.total_tokens.toLocaleString()} توكن
- رصيد الباقة الإجمالي: ${(currentSummary.user_info?.total_plan_tokens || 1000000).toLocaleString()} توكن
- الرصيد المتبقي المتاح: ${(currentSummary.user_info?.remaining_tokens || 0).toLocaleString()} توكن
- إجمالي العمليات المنفذة: ${currentSummary.total_operations_count.toLocaleString()} عملية

💰 المبلغ المالي المستحق للفاتورة:
- التكلفة المحتسبة: ${currentSummary.total_cost_egp.toFixed(2)} جنيه مصري (ج.م)
- سعر باقة فلاش الرسمي: 200 جنيه مصري لكل 1,000,000 توكن
- سعر باقة برو الرسمي: 250 جنيه مصري لكل 1,000,000 توكن
- قاعدة احتساب التوكنز: توكن المخرجات = 5 أضعاف في فلاش / 6 أضعاف في برو

✨ تم احتساب هذه الفاتورة رسمياً وفقاً لتسعيرة باقة ${isPro ? 'برو (Gemini Pro)' : 'فلاش (Gemini Flash)'} المعتمدة للمشتركين.
      `.trim();
    } else {
      text = `
🧾 فاتورة التكلفة الفعلية للمطور (سعر API الحقيقي) - منصة الاختبارات الذكية
--------------------------------------------------
📌 نطاق التقرير: ${currentSummary.user_info?.name}
📅 الفترة: ${currentSummary.timeframe_label} (${currentSummary.start_date} إلى ${currentSummary.end_date})
🏷️ رقم الفاتورة: ${currentSummary.invoice_number}
⚡ النموذج المعتمد: ${currentSummary.pricing_rates.model_name} (سعر المليون الحقيقي: $${currentSummary.pricing_rates.input_per_million_usd} للمدخلات / $${currentSummary.pricing_rates.output_per_million_usd} للمخرجات)

📊 ملخص الاستهلاك والرموز (Tokens):
- إجمالي التوكينز المستهلكة: ${currentSummary.total_tokens.toLocaleString()} توكن
  * مدخلات Prompts: ${currentSummary.prompt_tokens.toLocaleString()} توكن
  * مخرجات Outputs: ${currentSummary.candidates_tokens.toLocaleString()} توكن
- إجمالي العمليات المنفذة: ${currentSummary.total_operations_count} عملية

💰 التكلفة المالية الفعلية للمطور (Google Cloud API):
- بالدولار الأمريكي: $${(currentSummary.real_cost_usd ?? currentSummary.total_cost_usd).toFixed(4)} USD
- بالجنيه المصري: ${(currentSummary.real_cost_egp ?? currentSummary.total_cost_egp).toFixed(2)} ج.م (سعر الصرف $1 = ${currentSummary.pricing_rates.usd_to_egp_rate} ج.م)

📈 مقارنة المطور مع سعر بيع المشتركين (${currentSummary.client_rate_per_million_egp} ج.م / مليون):
- قيمة الفاتورة للعملاء: ${(currentSummary.client_cost_egp || 0).toFixed(2)} ج.م
- صافي أرباح المطور: +${(currentSummary.developer_profit_egp || 0).toFixed(2)} ج.م (${(currentSummary.developer_margin_percent || 0).toFixed(1)}% هامش ربح)

✨ تم احتساب هذه الفاتورة وفقاً للتكلفة الفعلية لنموذج ${currentSummary.pricing_rates.model_name} للمطور.
      `.trim();
    }

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Export CSV
  const handleExportCSV = () => {
    const isClientMode = currentSummary.pricing_mode === 'client';
    const rateLabel = `${currentSummary.client_rate_per_million_egp} EGP / 1M`;
    let rows: any[] = [];

    if (isClientMode) {
      rows = [
        ['Service / Operation', 'Operations Count', 'Tokens Used', 'Rate', 'Cost (EGP)'],
        ...currentSummary.operations_breakdown.map(op => [
          `"${op.operation_label}"`,
          op.count,
          op.total_tokens,
          rateLabel,
          op.cost_egp.toFixed(2)
        ]),
        ['TOTAL', currentSummary.total_operations_count, currentSummary.total_tokens, rateLabel, currentSummary.total_cost_egp.toFixed(2)]
      ];
    } else {
      rows = [
        ['Service/Operation', 'Operations Count', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Cost (USD)', 'Cost (EGP)', 'Cost (SAR)'],
        ...currentSummary.operations_breakdown.map(op => [
          `"${op.operation_label}"`,
          op.count,
          op.prompt_tokens,
          op.candidates_tokens,
          op.total_tokens,
          op.cost_usd.toFixed(6),
          op.cost_egp.toFixed(4),
          op.cost_sar.toFixed(4)
        ]),
        ['TOTAL', currentSummary.total_operations_count, currentSummary.prompt_tokens, currentSummary.candidates_tokens, currentSummary.total_tokens, (currentSummary.real_cost_usd ?? currentSummary.total_cost_usd).toFixed(4), (currentSummary.real_cost_egp ?? currentSummary.total_cost_egp).toFixed(2), currentSummary.total_cost_sar.toFixed(2)]
      ];
    }

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `token_invoice_${currentSummary.invoice_number}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export All Accounts Table to CSV
  const handleExportAccountsCSV = () => {
    const rows = [
      ['User Name', 'Email', 'Role', 'Subscription Plan', 'Plan Type', 'Total Tokens Used', 'Today Tokens', 'Real API Cost (EGP)', 'Client Bill (EGP)', 'Developer Profit (EGP)'],
      ...rankedUsers.map(u => {
        const tTokens = Number(u.tokens_used || u.tokens_used_total || 0);
        const tToday = Number(u.tokens_used_today || 0);
        const isUserPro = Boolean(
          u.preferred_ai_model === 'gemini_pro' ||
          u.preferred_ai_model === 'pro' ||
          u.preferred_ai_model === 'gemini-3.1-pro-preview' ||
          u.preferred_ai_model === 'gemini-2.5-pro' ||
          u.subscription_type?.toLowerCase().includes('pro') ||
          u.subscription_type?.toLowerCase().includes('برو') ||
          u.custom_plan_name?.toLowerCase().includes('pro') ||
          u.custom_plan_name?.toLowerCase().includes('برو')
        );
        const uRate = isUserPro ? CLIENT_TOKEN_PRICING.pro_price_per_million_egp : CLIENT_TOKEN_PRICING.price_per_million_egp;
        const uCost = calculateActualTokenCost(
          Math.round(tTokens * 0.78), 
          Math.round(tTokens * 0.22), 
          0, 
          usdToEgpRate, 
          usdToSarRate, 
          isUserPro ? 'pro' : 'flash'
        );
        const uClientBill = (tTokens / 1_000_000) * uRate;
        const uProfit = Math.max(0, uClientBill - uCost.totalCostEgp);
        return [
          `"${u.name || 'بدون اسم'}"`,
          `"${u.email || ''}"`,
          `"${u.role || 'teacher'}"`,
          `"${u.subscription_type || (isUserPro ? 'باقة برو (250 ج.م/1M)' : 'باقة فلاش (200 ج.م/1M)')}"`,
          isUserPro ? 'Pro' : 'Flash',
          tTokens,
          tToday,
          uCost.totalCostEgp.toFixed(2),
          uClientBill.toFixed(2),
          uProfit.toFixed(2)
        ];
      })
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `all_accounts_token_consumption_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const handlePrint = () => {
    window.print();
  };

  // Interactive Live Calculator Result
  const liveCalcCost = useMemo(() => {
    return calculateActualTokenCost(
      calcPromptTokens, 
      calcCandidateTokens, 
      calcCachedTokens, 
      usdToEgpRate, 
      usdToSarRate, 
      pricingModelMode
    );
  }, [calcPromptTokens, calcCandidateTokens, calcCachedTokens, usdToEgpRate, usdToSarRate, pricingModelMode]);

  if (!isOpen) return null;

  // If user is not authorized, show security rejection shield
  if (!isAuthorized) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-rose-200">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">صلاحية الوصول مقيدة</h2>
          <p className="text-xs text-slate-600 mb-6">
            فاتورة استهلاك التوكينز الشاملة والتكلفة الفعلية مخصصة ومحصورة حصرياً لمالك المنصة والمسؤول الرئيسي.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl overflow-hidden flex flex-col max-h-[94vh] print:max-h-none print:shadow-none print:border-none animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with Admin Badge */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white flex items-center justify-between flex-wrap gap-4 border-b border-indigo-900/60 print:bg-none print:text-black print:p-0 print:border-b-2 print:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400/20 to-indigo-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-inner print:hidden">
              <Receipt size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white print:text-slate-900">
                  {isPlatformAdmin
                    ? "فاتورة استهلاك التوكينز والتكلفة الفعلية للمطور"
                    : "فاتورة استهلاك باقة التوكنز"}
                </h2>
                {isPlatformAdmin ? (
                  <>
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 print:hidden">
                      <Lock size={11} />
                      لوحة المالك والمسؤول الرئيسي
                    </span>
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-mono font-bold print:hidden">
                      Flash 3.8 Real API Cost
                    </span>
                  </>
                ) : (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 print:hidden">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    باقة المشترك (200 جنيه / 1 مليون توكن)
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-indigo-200/80 mt-0.5">
                {isPlatformAdmin
                  ? "حساب فوري ودقيق وشامل لاستهلاك كافة حسابات المنصة مع أحدث تسعير رسمي للمدخلات والمخرجات وهامش أرباح المطور"
                  : "بيان استهلاك واشتراك باقة الذكاء الاصطناعي والتكلفة المعتمدة لحسابك (200 جنيه لكل 1 مليون توكن)"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => fetchAllPlatformUsers(true)}
              disabled={isLoading}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border border-white/10"
              title="تحديث البيانات اللحظية من قاعدة البيانات"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin text-amber-300' : ''} />
              <span className="hidden sm:inline">{isLoading ? 'جاري التحديث...' : 'تحديث البيانات'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Toast Notification for Refresh */}
        {refreshSuccessToast && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-200" />
              <span>{refreshSuccessToast}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setRefreshSuccessToast('')} 
              className="text-white/80 hover:text-white p-0.5 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Global Filter & Account Selector Bar */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between flex-wrap gap-3 print:hidden">
          
          {/* Account Scope Switcher: Full for Admin, locked badge for client */}
          {isPlatformAdmin ? (
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <span className="text-xs font-black text-slate-700 flex items-center gap-1">
                <Globe size={14} className="text-indigo-600" />
                نطاق الحساب:
              </span>
              <select
                value={selectedAccountId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedAccountId(newId);
                  fetchAllPlatformUsers(false, newId);
                }}
                className="bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 max-w-sm w-full cursor-pointer"
              >
                <option value="all">🌐 إجمالي استهلاك المنصة بالكامل (كافة الحسابات - {platformStats.totalAccounts} حساب)</option>
                <optgroup label="الحسابات الفردية (المعلمين والمستخدمين)">
                  {combinedUsers.map((u, idx) => {
                    const optKey = u._uniqueKey || `user-opt-${u.id || u.uid || idx}`;
                    const optVal = u.id || u.uid || `usr_${idx}`;
                    return (
                      <option key={optKey} value={optVal}>
                        👤 {u.name || 'مستخدم'} ({u.email || 'بدون بريد'}) - {Number(u.tokens_used || u.tokens_used_total || 0).toLocaleString()} توكن
                      </option>
                    );
                  })}
                </optgroup>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
              <div className="flex items-center gap-2 bg-white border border-slate-200 text-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs">
                <User size={14} className="text-indigo-600 shrink-0" />
                <span>المشترك: <strong className="text-indigo-900">{currentSummary.user_info?.name}</strong></span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500 font-mono text-[11px]">{currentSummary.user_info?.email}</span>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  200 ج.م / 1M توكن
                </span>
              </div>
            </div>
          )}

          {/* Timeframe Quick Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 hidden md:inline">الفترة:</span>
            {[
              { id: 'today', label: 'اليوم' },
              { id: '7days', label: 'أسبوعي' },
              { id: '14days', label: 'أسبوعين' },
              { id: '30days', label: 'شهري (30 يوم)' },
              { id: 'all', label: isPlatformAdmin ? 'إجمالي شامل (All-time)' : 'إجمالي الدورة الحالية' },
              { id: 'custom', label: 'مخصص' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTimeframe(t.id as BillingTimeframe)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  timeframe === t.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

        </div>

        {/* Custom Date Range Bar (if custom selected) */}
        {timeframe === 'custom' && (
          <div className="bg-indigo-50/80 border-b border-indigo-100 px-4 sm:px-6 py-2.5 flex items-center justify-end gap-3 flex-wrap text-xs print:hidden">
            <div className="flex items-center gap-2">
              <span className="font-bold text-indigo-950">من تاريخ:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white border border-indigo-200 rounded-lg px-2.5 py-1 font-mono text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-indigo-950">إلى تاريخ:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white border border-indigo-200 rounded-lg px-2.5 py-1 font-mono text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Navigation Tabs Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between flex-wrap gap-2 print:hidden">
          <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-2xl flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PieChart size={14} />
              <span>{isPlatformAdmin ? "لوحة الاستهلاك والتكلفة" : "لوحة الاستهلاك والاشتراك"}</span>
            </button>

            {isPlatformAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('all_accounts')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'all_accounts'
                      ? 'bg-white text-indigo-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users size={14} />
                  <span>استهلاك كافة الحسابات ({combinedUsers.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pricing_matrix')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'pricing_matrix'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Zap size={14} className="text-emerald-600" />
                  <span>أحدث تسعير رسمي للمدخلات والمخرجات</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('invoice')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'invoice'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Receipt size={14} />
              <span>{isPlatformAdmin ? "الفاتورة المعتمدة A4" : "الفاتورة المعتمدة (200 ج.م/مليون)"}</span>
            </button>

            {isPlatformAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('logs')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'logs'
                    ? 'bg-white text-indigo-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock size={14} />
                <span>سجل العمليات</span>
              </button>
            )}
          </div>

          {isPlatformAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">سعر الصرف:</span>
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-xs font-mono font-bold">
                <span>$1 =</span>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={usdToEgpRate}
                  onChange={(e) => setUsdToEgpRate(parseFloat(e.target.value) || 50)}
                  className="w-12 text-center text-indigo-700 outline-none"
                />
                <span>ج.م</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Main Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6 print:p-0 print:overflow-visible">
          
          {/* ============================================================ */}
          {/* TAB 1: DASHBOARD & METRICS                                  */}
          {/* ============================================================ */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              
              {/* Selected Scope Banner */}
              <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-4 rounded-2xl flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
                    {selectedAccountId === 'all' ? <Globe size={20} /> : <User size={20} />}
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      {currentSummary.user_info?.name}
                    </h3>
                    <p className="text-xs text-indigo-200">
                      الفترة المعروضة: <strong>{currentSummary.timeframe_label}</strong> | تسعيرة Gemini 3.8 Flash الرسمية
                    </p>
                  </div>
                </div>

                {selectedAccountId !== 'all' && (
                  <button
                    onClick={() => setSelectedAccountId('all')}
                    className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    العودة لعرض إجمالي المنصة الشامل 🌐
                  </button>
                )}
              </div>

              {/* 4 Metric Highlight Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. Total Tokens */}
                <div className="bg-gradient-to-br from-indigo-50/90 to-slate-50 p-4 sm:p-5 rounded-2xl border border-indigo-100 shadow-2xs">
                  <div className="flex items-center justify-between text-indigo-900 mb-2">
                    <span className="text-xs font-bold">إجمالي التوكينز المستهلكة</span>
                    <Coins size={18} className="text-indigo-600" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-indigo-950 font-mono tracking-tight">
                    {currentSummary.total_tokens.toLocaleString()}
                  </div>
                  <div className="mt-2.5 text-[11px] text-slate-600 flex justify-between border-t border-indigo-100/70 pt-2 font-medium">
                    {isPlatformAdmin ? (
                      <>
                        <span>مدخلات (In): <strong>{currentSummary.prompt_tokens.toLocaleString()}</strong></span>
                        <span>مخرجات (Out): <strong>{currentSummary.candidates_tokens.toLocaleString()}</strong></span>
                      </>
                    ) : (
                      <span>الفترة المحددة: <strong>{currentSummary.timeframe_label}</strong></span>
                    )}
                  </div>
                </div>

                {isPlatformAdmin ? (
                  <>
                    {/* Admin Card 2: Developer Real API Cost */}
                    <div className="bg-gradient-to-br from-purple-50/90 to-slate-50 p-4 sm:p-5 rounded-2xl border border-purple-100 shadow-2xs">
                      <div className="flex items-center justify-between text-purple-900 mb-2">
                        <span className="text-xs font-bold">التكلفة الفعلية للمطور (Google API)</span>
                        <Zap size={18} className="text-purple-600" />
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-purple-950 font-mono tracking-tight flex items-baseline gap-1.5">
                        <span>{(currentSummary.real_cost_egp ?? currentSummary.total_cost_egp).toFixed(2)}</span>
                        <span className="text-xs font-bold text-purple-800">ج.م</span>
                      </div>
                      <div className="mt-2.5 text-[11px] text-purple-800 flex justify-between border-t border-purple-100/70 pt-2 font-medium">
                        <span>بالدولار الأمريكي:</span>
                        <span className="font-mono font-bold">${(currentSummary.real_cost_usd ?? currentSummary.total_cost_usd).toFixed(4)} USD</span>
                      </div>
                    </div>

                    {/* Admin Card 3: Client Selling Price (200 EGP / 1M) */}
                    <div className="bg-gradient-to-br from-indigo-50/90 to-blue-50/40 p-4 sm:p-5 rounded-2xl border border-indigo-100 shadow-2xs">
                      <div className="flex items-center justify-between text-indigo-900 mb-2">
                        <span className="text-xs font-bold">سعر البيع للمشتركين (200 ج.م / 1M)</span>
                        <DollarSign size={18} className="text-indigo-600" />
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-indigo-950 font-mono tracking-tight flex items-baseline gap-1.5">
                        <span>{(currentSummary.client_cost_egp || 0).toFixed(2)}</span>
                        <span className="text-xs font-bold text-indigo-800">ج.م</span>
                      </div>
                      <div className="mt-2.5 text-[11px] text-indigo-700 flex justify-between border-t border-indigo-100/70 pt-2 font-medium">
                        <span>تسعيرة المشتركين:</span>
                        <span className="font-bold">200 جنيه / 1 مليون توكن</span>
                      </div>
                    </div>

                    {/* Admin Card 4: Developer Net Profit */}
                    <div className="bg-gradient-to-br from-emerald-50/90 to-teal-50/40 p-4 sm:p-5 rounded-2xl border border-emerald-100 shadow-2xs">
                      <div className="flex items-center justify-between text-emerald-900 mb-2">
                        <span className="text-xs font-bold">صافي أرباح المطور (الربح)</span>
                        <Award size={18} className="text-emerald-600" />
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-emerald-950 font-mono tracking-tight flex items-baseline gap-1.5">
                        <span>+{(currentSummary.developer_profit_egp || 0).toFixed(2)}</span>
                        <span className="text-xs font-bold text-emerald-800">ج.م</span>
                      </div>
                      <div className="mt-2.5 text-[11px] text-emerald-800 flex justify-between border-t border-emerald-100/70 pt-2 font-medium">
                        <span>هامش الربح:</span>
                        <span className="font-bold font-mono">{(currentSummary.developer_margin_percent || 0).toFixed(1)}%</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Client Card 2: Total Cost at 200 EGP / 1M */}
                    <div className="bg-gradient-to-br from-emerald-50/90 to-teal-50/40 p-4 sm:p-5 rounded-2xl border border-emerald-100 shadow-2xs">
                      <div className="flex items-center justify-between text-emerald-900 mb-2">
                        <span className="text-xs font-bold">المبلغ المستحق للفاتورة</span>
                        <DollarSign size={18} className="text-emerald-600" />
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-emerald-950 font-mono tracking-tight flex items-baseline gap-1.5">
                        <span>{currentSummary.total_cost_egp.toFixed(2)}</span>
                        <span className="text-xs font-bold text-emerald-800">ج.م</span>
                      </div>
                      <div className="mt-2.5 text-[11px] text-emerald-800 border-t border-emerald-100/70 pt-2 font-medium">
                        <span>محسوبة على أساس <strong>200 جنيه لكل 1 مليون توكن</strong></span>
                      </div>
                    </div>

                    {/* Client Card 3: Remaining Tokens */}
                    <div className="bg-gradient-to-br from-purple-50/90 to-slate-50 p-4 sm:p-5 rounded-2xl border border-purple-100 shadow-2xs">
                      <div className="flex items-center justify-between text-purple-900 mb-2">
                        <span className="text-xs font-bold">الرصيد المتبقي في باقتك</span>
                        <Activity size={18} className="text-purple-600" />
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-purple-950 font-mono tracking-tight">
                        {(currentSummary.user_info?.remaining_tokens || 0).toLocaleString()}
                      </div>
                      <div className="mt-2.5 text-[11px] text-purple-800 border-t border-purple-100/70 pt-2 font-medium">
                        <span>من إجمالي باقة <strong>{(currentSummary.user_info?.total_plan_tokens || 1000000).toLocaleString()}</strong> توكن</span>
                      </div>
                    </div>

                    {/* Client Card 4: Total Operations */}
                    <div className="bg-gradient-to-br from-amber-50/90 to-slate-50 p-4 sm:p-5 rounded-2xl border border-amber-100 shadow-2xs">
                      <div className="flex items-center justify-between text-amber-900 mb-2">
                        <span className="text-xs font-bold">إجمالي العمليات المنفذة</span>
                        <FileText size={18} className="text-amber-600" />
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-amber-950 font-mono tracking-tight">
                        {currentSummary.total_operations_count.toLocaleString()}
                      </div>
                      <div className="mt-2.5 text-[11px] text-amber-900 border-t border-amber-100/70 pt-2 font-medium">
                        <span>تصحيح مقالي، استخراج ملفات، واختبارات</span>
                      </div>
                    </div>
                  </>
                )}

              </div>

              {/* Service Operations Breakdown Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <FileText size={16} className="text-indigo-600" />
                      {isPlatformAdmin ? "تفصيل الاستهلاك والتكلفة حسب نوع الخدمة والعملية" : "تفصيل استهلاك التوكنز والتكلفة حسب العمليات"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isPlatformAdmin
                        ? `توزيع دقيق لعدد العمليات وحجم التوكينز وتكلفة Google API الفعلية وسعر المشتركين لفترة: ${currentSummary.timeframe_label}`
                        : `توزيع استهلاك الذكاء الاصطناعي والتكلفة المحتسبة وفقاً لتسعيرة 200 جنيه لكل مليون توكن لفترة: ${currentSummary.timeframe_label}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Download size={14} className="text-slate-600" />
                    تصدير Excel / CSV
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">نوع العملية / الخدمة</th>
                        <th className="p-3 text-center">عدد العمليات</th>
                        <th className="p-3 text-center">إجمالي التوكينز</th>
                        {isPlatformAdmin ? (
                          <>
                            <th className="p-3 text-center">المدخلات (Prompts)</th>
                            <th className="p-3 text-center">المخرجات (Outputs)</th>
                            <th className="p-3 text-center">التكلفة الفعلية (USD)</th>
                            <th className="p-3 text-center">التكلفة الفعلية (ج.م)</th>
                            <th className="p-3 text-center">سعر العميل (200 ج.م/1M)</th>
                          </>
                        ) : (
                          <>
                            <th className="p-3 text-center">متوسط الرموز للعملية</th>
                            <th className="p-3 text-center">التكلفة المستحقة (ج.م)</th>
                          </>
                        )}
                        <th className="p-3 text-center">نسبة الاستهلاك</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentSummary.operations_breakdown.map((op, idx) => {
                        const percent = currentSummary.total_tokens > 0 
                          ? ((op.total_tokens / currentSummary.total_tokens) * 100).toFixed(1)
                          : '0';
                        const opClientBill = (op.total_tokens / 1_000_000) * CLIENT_TOKEN_PRICING.price_per_million_egp;

                        return (
                          <tr key={op.operation ? `breakdown_${op.operation}_${idx}` : `breakdown_idx_${idx}`} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                              <span>{op.operation_label}</span>
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-slate-700">
                              {op.count.toLocaleString()}
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-indigo-700">
                              {op.total_tokens.toLocaleString()}
                            </td>
                            {isPlatformAdmin ? (
                              <>
                                <td className="p-3 text-center font-mono text-slate-500">
                                  {op.prompt_tokens.toLocaleString()}
                                </td>
                                <td className="p-3 text-center font-mono text-slate-500">
                                  {op.candidates_tokens.toLocaleString()}
                                </td>
                                <td className="p-3 text-center font-mono font-bold text-slate-800">
                                  ${op.cost_usd.toFixed(4)}
                                </td>
                                <td className="p-3 text-center font-mono font-bold text-purple-700 bg-purple-50/30">
                                  {op.cost_egp.toFixed(2)} ج.م
                                </td>
                                <td className="p-3 text-center font-mono font-bold text-emerald-700 bg-emerald-50/40">
                                  {opClientBill.toFixed(2)} ج.م
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-3 text-center font-mono text-slate-600">
                                  {op.avg_tokens_per_op.toLocaleString()} توكن
                                </td>
                                <td className="p-3 text-center font-mono font-bold text-emerald-700 bg-emerald-50/40">
                                  {op.cost_egp.toFixed(2)} ج.م
                                </td>
                              </>
                            )}
                            <td className="p-3 text-center font-mono">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className="bg-indigo-600 h-full rounded-full" 
                                    style={{ width: `${percent}%` }}
                                  ></div>
                                </div>
                                <span className="text-[11px] font-bold text-slate-600">{percent}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-300 text-slate-900">
                      <tr>
                        <td className="p-3 text-base">الإجمالي العام</td>
                        <td className="p-3 text-center font-mono text-base">{currentSummary.total_operations_count.toLocaleString()}</td>
                        <td className="p-3 text-center font-mono text-base text-indigo-800">{currentSummary.total_tokens.toLocaleString()}</td>
                        {isPlatformAdmin ? (
                          <>
                            <td className="p-3 text-center font-mono">{currentSummary.prompt_tokens.toLocaleString()}</td>
                            <td className="p-3 text-center font-mono">{currentSummary.candidates_tokens.toLocaleString()}</td>
                            <td className="p-3 text-center font-mono text-base text-slate-900">${(currentSummary.real_cost_usd ?? currentSummary.total_cost_usd).toFixed(4)}</td>
                            <td className="p-3 text-center font-mono text-base text-purple-800 bg-purple-100/50">{(currentSummary.real_cost_egp ?? currentSummary.total_cost_egp).toFixed(2)} ج.م</td>
                            <td className="p-3 text-center font-mono text-base text-emerald-800 bg-emerald-100/50">{(currentSummary.client_cost_egp || 0).toFixed(2)} ج.م</td>
                          </>
                        ) : (
                          <>
                            <td className="p-3 text-center font-mono text-slate-500">-</td>
                            <td className="p-3 text-center font-mono text-base text-emerald-800 bg-emerald-100/50">{currentSummary.total_cost_egp.toFixed(2)} ج.م</td>
                          </>
                        )}
                        <td className="p-3 text-center font-mono">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: ALL ACCOUNTS BREAKDOWN TABLE & LEADERBOARD           */}
          {/* ============================================================ */}
          {activeTab === 'all_accounts' && (
            <div className="space-y-6">
              
              {/* Summary of all accounts */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100">
                  <span className="text-xs font-bold text-indigo-900">إجمالي عدد الحسابات المسجلة</span>
                  <div className="text-2xl font-black text-indigo-950 mt-1 font-mono">{combinedUsers.length} حساب</div>
                  <span className="text-[11px] text-indigo-700">يشمل جميع المعلمين والمشتركين والطلاب</span>
                </div>

                <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-100">
                  <span className="text-xs font-bold text-emerald-900">إجمالي استهلاك التوكنز لكافة الحسابات</span>
                  <div className="text-2xl font-black text-emerald-950 mt-1 font-mono">{platformStats.totalAllTokens.toLocaleString()} توكن</div>
                  <span className="text-[11px] text-emerald-700">تعادل {(platformStats.totalAllTokens / 1000000).toFixed(2)} مليون توكن</span>
                </div>

                <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-100">
                  <span className="text-xs font-bold text-amber-900">التكلفة المالية الإجمالية للمنصة</span>
                  <div className="text-2xl font-black text-amber-950 mt-1 font-mono">
                    {calculateActualTokenCost(
                      Math.round(platformStats.totalAllTokens * 0.78),
                      Math.round(platformStats.totalAllTokens * 0.22),
                      0,
                      usdToEgpRate
                    ).totalCostEgp.toFixed(2)} ج.م
                  </div>
                  <span className="text-[11px] text-amber-700">
                    (${calculateActualTokenCost(
                      Math.round(platformStats.totalAllTokens * 0.78),
                      Math.round(platformStats.totalAllTokens * 0.22),
                      0,
                      usdToEgpRate
                    ).totalCostUsd.toFixed(3)} USD)
                  </span>
                </div>
              </div>

              {/* Filter and Search Bar for Accounts */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between flex-wrap gap-3 shadow-2xs">
                
                <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                  <div className="relative w-full">
                    <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="بحث باسم المعلم، البريد، أو المادة..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Role filter */}
                  <select
                    value={userFilterRole}
                    onChange={(e) => setUserFilterRole(e.target.value as any)}
                    className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
                  >
                    <option value="all">كافة الأدوار</option>
                    <option value="teachers">المعلمين فقط</option>
                    <option value="students">الطلاب فقط</option>
                  </select>

                  {/* Sort */}
                  <select
                    value={userSortBy}
                    onChange={(e) => setUserSortBy(e.target.value as any)}
                    className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
                  >
                    <option value="tokens_desc">الأعلى استهلاكاً للتوكنز ⬇️</option>
                    <option value="today_desc">الأعلى استهلاكاً اليوم ⬇️</option>
                    <option value="tokens_asc">الأقل استهلاكاً ⬆️</option>
                    <option value="name">أبجدياً بالاسم</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => fetchAllPlatformUsers(true)}
                    disabled={isLoading}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 disabled:opacity-50"
                    title="تحديث بيانات المشتركين"
                  >
                    <RefreshCw size={14} className={isLoading ? "animate-spin text-indigo-600" : ""} />
                    <span>تحديث</span>
                  </button>

                  <button
                    onClick={handleExportAccountsCSV}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Download size={14} />
                    <span>تصدير تقرير كافة الحسابات</span>
                  </button>
                </div>

              </div>

              {/* All Accounts Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">المعلم / المستخدم</th>
                        <th className="p-3">البريد الإلكتروني</th>
                        <th className="p-3 text-center">نوع الباقة</th>
                        <th className="p-3 text-center">إجمالي الباقة</th>
                        <th className="p-3 text-center">المستهلك</th>
                        <th className="p-3 text-center">الرصيد المتبقي</th>
                        <th className="p-3 text-center">معدل الاستهلاك</th>
                        <th className="p-3 text-center">التكلفة الفعلية للمطور</th>
                        <th className="p-3 text-center">فاتورة المشترك (200 فلاش / 250 برو)</th>
                        <th className="p-3 text-center">صافي ربح المطور</th>
                        <th className="p-3 text-center">معاينة الفواتير</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rankedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="p-8 text-center text-slate-400">
                            لا توجد حسابات مطابقة لمعايير البحث الحالية
                          </td>
                        </tr>
                      ) : (
                        rankedUsers.map((u, idx) => {
                          const stats = getUserTokenStats(u);
                          const uTokens = stats.used;
                          const isUserPro = Boolean(
                            u.preferred_ai_model === 'gemini_pro' ||
                            u.preferred_ai_model === 'pro' ||
                            u.preferred_ai_model === 'gemini-3.1-pro-preview' ||
                            u.preferred_ai_model === 'gemini-2.5-pro' ||
                            u.subscription_type?.toLowerCase().includes('pro') ||
                            u.subscription_type?.toLowerCase().includes('برو') ||
                            u.custom_plan_name?.toLowerCase().includes('pro') ||
                            u.custom_plan_name?.toLowerCase().includes('برو')
                          );
                          const uRate = isUserPro ? CLIENT_TOKEN_PRICING.pro_price_per_million_egp : CLIENT_TOKEN_PRICING.price_per_million_egp;
                          const uCost = calculateActualTokenCost(
                            Math.round(uTokens * 0.78), 
                            Math.round(uTokens * 0.22), 
                            0, 
                            usdToEgpRate, 
                            usdToSarRate, 
                            isUserPro ? 'pro' : 'flash'
                          );
                          const uClientBill = (uTokens / 1_000_000) * uRate;
                          const uProfit = Math.max(0, uClientBill - uCost.totalCostEgp);
                          const rowKey = u._uniqueKey || `ranked_${u.id || u.uid || u.email || idx}`;

                          return (
                            <tr key={rowKey} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                              <td className="p-3">
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{u.name || 'مستخدم بدون اسم'}</span>
                                  {isUserPro && (
                                    <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-bold border border-purple-200">PRO 👑</span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500">{u.subject || (u.role === 'admin' ? 'مدير المنصة' : 'مدرس')}</div>
                              </td>
                              <td className="p-3 font-mono text-slate-600">{u.email || '-'}</td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${
                                  isUserPro ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-slate-100 text-slate-800 border-slate-200'
                                }`}>
                                  {u.subscription_type || (isUserPro ? 'باقة برو (250 ج.م/1M 👑)' : 'باقة فلاش (200 ج.م/1M)')}
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-slate-800">
                                {stats.totalLimit > 0 ? stats.totalLimit.toLocaleString() : '-'}
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-indigo-700">
                                {stats.used.toLocaleString()}
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-emerald-700">
                                {stats.remaining.toLocaleString()}
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex flex-col items-center gap-1 min-w-24">
                                  <div className="flex items-center justify-between w-full text-[11px] font-bold">
                                    <span className={`px-1.5 py-0.2 rounded font-mono ${
                                      stats.percentage > 85 ? 'bg-rose-100 text-rose-700' :
                                      stats.percentage > 65 ? 'bg-amber-100 text-amber-700' :
                                      'bg-emerald-100 text-emerald-700'
                                    }`}>
                                      {stats.percentage}%
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      متبقي {stats.remainingPercent}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full transition-all duration-300 ${
                                        stats.remainingPercent < 15 ? 'bg-rose-500 animate-pulse' :
                                        stats.remainingPercent < 35 ? 'bg-amber-500' :
                                        'bg-emerald-500'
                                      }`}
                                      style={{ width: `${stats.remainingPercent}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-purple-700 bg-purple-50/30">
                                <div>{uCost.totalCostEgp.toFixed(2)} ج.م</div>
                                <span className="text-[10px] text-slate-400 font-mono font-normal">(${uCost.totalCostUsd.toFixed(3)})</span>
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-indigo-700 bg-indigo-50/30">
                                <div>{uClientBill.toFixed(2)} ج.م</div>
                                <span className="text-[10px] text-slate-400 font-mono">({uRate} ج.م/1M)</span>
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-emerald-700 bg-emerald-50/40">
                                +{uProfit.toFixed(2)} ج.م
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => {
                                      setSelectedAccountId(u.id || u.uid);
                                      setInvoicePriceMode('client');
                                      setActiveTab('invoice');
                                    }}
                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                    title={`عرض فاتورة العميل التجارية (${uRate} جنيه / 1M)`}
                                  >
                                    فاتورة العميل
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedAccountId(u.id || u.uid);
                                      setInvoicePriceMode('developer_real');
                                      setActiveTab('invoice');
                                    }}
                                    className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                    title="عرض فاتورة التكلفة الفعلية للمطور (سعر API الحقيقي)"
                                  >
                                    تكلفة API
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: OFFICIAL PRICING MATRIX & INTERACTIVE CALCULATOR     */}
          {/* ============================================================ */}
          {activeTab === 'pricing_matrix' && (
            <div className="space-y-6">
              
              {/* Header Box with Model Selector */}
              <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl border border-emerald-800/40 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center justify-center">
                      <Zap size={22} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white flex items-center gap-2">
                        <span>التسعير الرسمي الدقيق لنماذج Google Gemini</span>
                        <span className="text-xs bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30 font-mono">
                          {pricingModelMode === 'pro' ? 'Gemini 3.1 Pro (6x Outputs)' : 'Gemini 3.8 Flash (5x Outputs)'}
                        </span>
                      </h3>
                      <p className="text-xs text-emerald-200">
                        {pricingModelMode === 'pro'
                          ? 'نظام برو: تسعيرة نموذج Gemini Pro ($2.00 مدخلات / $12.00 مخرجات - المخرجات 6 أضعاف المدخلات 👑)'
                          : 'نظام فلاش: تسعيرة نموذج Gemini Flash ($0.75 مدخلات / $3.75 مخرجات - المخرجات 5 أضعاف المدخلات ⚡)'}
                      </p>
                    </div>
                  </div>

                  {/* Model Toggle */}
                  <div className="flex items-center gap-1.5 bg-white/10 p-1.5 rounded-2xl border border-white/10 backdrop-blur-xs">
                    <button
                      type="button"
                      onClick={() => setPricingModelMode('pro')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        pricingModelMode === 'pro'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <span>نظام برو (Gemini Pro 👑)</span>
                      <span className="text-[10px] bg-purple-900/50 px-1.5 py-0.2 rounded font-mono">6x</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingModelMode('flash')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        pricingModelMode === 'flash'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <span>نظام فلاش (Gemini Flash ⚡)</span>
                      <span className="text-[10px] bg-emerald-900/50 px-1.5 py-0.2 rounded font-mono">5x</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Pricing Grid */}
              {(() => {
                const isProView = pricingModelMode === 'pro';
                const activeRates = isProView ? GEMINI_PRO_PRICING : GEMINI_FLASH_PRICING;

                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* 1. Prompt Inputs */}
                    <div className="bg-white p-5 rounded-2xl border-2 border-indigo-100 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between text-indigo-900">
                        <span className="text-xs font-bold">1. رموز المدخلات والأسئلة (Prompt Inputs)</span>
                        <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">الأسئلة والملفات</span>
                      </div>
                      <div className="text-3xl font-black text-indigo-950 font-mono">
                        ${activeRates.input_per_million_usd.toFixed(2)} <span className="text-xs font-normal text-slate-500">/ 1M Tokens</span>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="flex justify-between">
                          <span>سعر التوكن الواحد:</span>
                          <span className="font-mono font-bold text-indigo-900">${(activeRates.input_per_million_usd / 1000000).toFixed(8)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>بالجنيه المصري ($1 = {usdToEgpRate} ج.م):</span>
                          <span className="font-mono font-bold text-emerald-700">{((activeRates.input_per_million_usd / 1000000) * usdToEgpRate).toFixed(6)} ج.م</span>
                        </div>
                        <div className="flex justify-between">
                          <span>تكلفة 100 ألف توكن مدخلات:</span>
                          <span className="font-mono font-bold text-slate-900">{((100000 * activeRates.input_per_million_usd / 1000000) * usdToEgpRate).toFixed(2)} ج.م</span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Output Candidates */}
                    <div className="bg-white p-5 rounded-2xl border-2 border-purple-100 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between text-purple-900">
                        <span className="text-xs font-bold">2. رموز المخرجات والتفكير (Output Generation)</span>
                        <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {isProView ? 'المخرجات = 6 أضعاف المدخلات' : 'المخرجات = 5 أضعاف المدخلات'}
                        </span>
                      </div>
                      <div className="text-3xl font-black text-purple-950 font-mono">
                        ${activeRates.output_per_million_usd.toFixed(2)} <span className="text-xs font-normal text-slate-500">/ 1M Tokens</span>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="flex justify-between">
                          <span>سعر التوكن الواحد:</span>
                          <span className="font-mono font-bold text-purple-900">${(activeRates.output_per_million_usd / 1000000).toFixed(8)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>بالجنيه المصري ($1 = {usdToEgpRate} ج.م):</span>
                          <span className="font-mono font-bold text-emerald-700">{((activeRates.output_per_million_usd / 1000000) * usdToEgpRate).toFixed(6)} ج.م</span>
                        </div>
                        <div className="flex justify-between">
                          <span>مضاعف احتساب المخرجات:</span>
                          <span className="font-mono font-bold text-purple-700">
                            {isProView ? '6× المدخلات ($2.00 × 6 = $12.00)' : '5× المدخلات ($0.75 × 5 = $3.75)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Context Caching */}
                    <div className="bg-white p-5 rounded-2xl border-2 border-emerald-100 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between text-emerald-900">
                        <span className="text-xs font-bold">3. التخزين المؤقت للمدخلات (Context Caching)</span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">توفير 75%</span>
                      </div>
                      <div className="text-3xl font-black text-emerald-950 font-mono">
                        ${activeRates.cached_per_million_usd.toFixed(4)} <span className="text-xs font-normal text-slate-500">/ 1M Tokens</span>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="flex justify-between">
                          <span>سعر التوكن الواحد:</span>
                          <span className="font-mono font-bold text-emerald-900">${(activeRates.cached_per_million_usd / 1000000).toFixed(9)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>بالجنيه المصري ($1 = {usdToEgpRate} ج.م):</span>
                          <span className="font-mono font-bold text-emerald-700">{((activeRates.cached_per_million_usd / 1000000) * usdToEgpRate).toFixed(6)} ج.م</span>
                        </div>
                        <div className="flex justify-between">
                          <span>نسبة الخصم والتوفير:</span>
                          <span className="font-mono font-bold text-emerald-700">خصم 75% من تكلفة الإدخال</span>
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })()}

              {/* Interactive Live Real-Time Cost Simulator */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <SlidersHorizontal size={16} className="text-indigo-600" />
                      محاكي وحاسبة التكلفة اللحظية للتوكنز ({pricingModelMode === 'pro' ? 'نظام برو 👑 - المخرجات × 6' : 'نظام فلاش ⚡ - المخرجات × 5'})
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      جرّب إدخال أي عدد من التوكنز لترى التكلفة الدقيقة بالدولار والجنيه والريال
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="bg-slate-200 p-1 rounded-xl flex items-center text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setPricingModelMode('pro')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          pricingModelMode === 'pro' ? 'bg-purple-700 text-white shadow-2xs' : 'text-slate-600'
                        }`}
                      >
                        برو (6x)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPricingModelMode('flash')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          pricingModelMode === 'flash' ? 'bg-emerald-700 text-white shadow-2xs' : 'text-slate-600'
                        }`}
                      >
                        فلاش (5x)
                      </button>
                    </div>
                    <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-2">
                      <span>إجمالي التوكنز:</span>
                      <span className="font-mono text-indigo-700 text-sm">{(calcPromptTokens + calcCandidateTokens + calcCachedTokens).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">
                      عدد توكنز المدخلات (Prompts):
                      <span className="text-[10px] text-slate-400 mr-1 font-mono">(${pricingModelMode === 'pro' ? '2.00' : '0.75'}/1M)</span>
                    </label>
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      value={calcPromptTokens}
                      onChange={(e) => setCalcPromptTokens(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">
                      عدد توكنز المخرجات (Outputs):
                      <span className="text-[10px] text-purple-600 mr-1 font-mono font-bold">
                        (${pricingModelMode === 'pro' ? '12.00' : '3.75'}/1M - {pricingModelMode === 'pro' ? '6x' : '5x'})
                      </span>
                    </label>
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      value={calcCandidateTokens}
                      onChange={(e) => setCalcCandidateTokens(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">
                      عدد التوكنز المخزنة مؤقتاً (Cached):
                      <span className="text-[10px] text-emerald-600 mr-1 font-mono">(${pricingModelMode === 'pro' ? '0.50' : '0.1875'}/1M)</span>
                    </label>
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      value={calcCachedTokens}
                      onChange={(e) => setCalcCachedTokens(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Calculation Results Card */}
                <div className="bg-white p-4 rounded-2xl border border-indigo-100 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-500">
                      التكلفة الإجمالية المحسوبة بدقة ({pricingModelMode === 'pro' ? 'نموذج Gemini Pro 👑' : 'نموذج Gemini Flash ⚡'}):
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-emerald-950 font-mono">{liveCalcCost.totalCostEgp.toFixed(4)} ج.م</span>
                      <span className="text-xs font-mono font-bold text-slate-500">(${liveCalcCost.totalCostUsd.toFixed(6)} USD)</span>
                      <span className="text-xs font-mono font-bold text-slate-500">({liveCalcCost.totalCostSar.toFixed(4)} ر.س)</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 space-y-0.5 text-left font-mono">
                    <div>Prompt Cost: ${liveCalcCost.promptCostUsd.toFixed(6)}</div>
                    <div>Output Cost: ${liveCalcCost.candidatesCostUsd.toFixed(6)}</div>
                    {calcCachedTokens > 0 && <div>Cached Cost: ${liveCalcCost.cachedCostUsd.toFixed(6)}</div>}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 4: OFFICIAL ITEMIZED INVOICE A4                          */}
          {/* ============================================================ */}
          {activeTab === 'invoice' && (
            <div className="space-y-6">
              
              {/* Action Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-3 print:hidden bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">رقم الفاتورة:</span>
                    <span className="text-xs font-mono font-extrabold bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-800">
                      {currentSummary.invoice_number}
                    </span>
                  </div>

                  {/* Pricing Mode Toggle for Developer / Admin */}
                  {isPlatformAdmin && (
                    <div className="flex items-center gap-1 bg-slate-200/90 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setInvoicePriceMode('developer_real')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          invoicePriceMode === 'developer_real'
                            ? 'bg-purple-700 text-white shadow-xs'
                            : 'text-slate-700 hover:text-slate-900'
                        }`}
                        title="عرض التكلفة الفعلية الحقيقية لنموذج Gemini للمطور"
                      >
                        <Zap size={14} />
                        <span>فاتورة التكلفة الفعلية للمطور (سعر API الحقيقي)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInvoicePriceMode('client')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          invoicePriceMode === 'client'
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'text-slate-700 hover:text-slate-900'
                        }`}
                        title={`معاينة الفاتورة التجارية الصادرة للعميل بسعر ${currentSummary.client_rate_per_million_egp} جنيه لكل مليون توكن`}
                      >
                        <Receipt size={14} />
                        <span>معاينة فاتورة العميل ({currentSummary.client_rate_per_million_egp} ج.م / 1M)</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => fetchAllPlatformUsers(true)}
                    disabled={isLoading}
                    className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                    title="تحديث بيانات واستهلاك الفاتورة فورياً"
                  >
                    <RefreshCw size={14} className={isLoading ? 'animate-spin text-indigo-600' : ''} />
                    <span>{isLoading ? 'جاري التحديث...' : 'تحديث الفاتورة'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    {isCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{isCopied ? 'تم نسخ التقرير' : 'نسخ الفاتورة'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Download size={14} />
                    <span>تصدير Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Printer size={14} />
                    <span>طباعة الفاتورة (A4)</span>
                  </button>
                </div>
              </div>

              {/* Printable Invoice Sheet Container */}
              <div className="bg-white p-6 sm:p-10 rounded-3xl border-2 border-slate-200 shadow-sm space-y-8 text-slate-800 print:border-none print:p-0">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-slate-100 pb-6 gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl text-white flex items-center justify-center font-bold text-sm ${
                        currentSummary.pricing_mode === 'client' 
                          ? (currentSummary.client_rate_per_million_egp === 250 ? 'bg-purple-700' : 'bg-indigo-600') 
                          : 'bg-purple-700'
                      }`}>
                        {currentSummary.pricing_mode === 'client' 
                          ? (currentSummary.client_rate_per_million_egp === 250 ? 'PRO' : 'AI') 
                          : 'DEV'}
                      </div>
                      <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                        منصة مصحح الواجبات والاختبارات الذكية
                      </h1>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {currentSummary.pricing_mode === 'client'
                        ? `فاتورة استهلاك واشتراك باقة التوكنز الرسمية المعتمدة ${currentSummary.client_rate_per_million_egp === 250 ? '(نظام برو 👑)' : '(نظام فلاش)'}`
                        : `فاتورة التكلفة الفعلية للمطور (Google Cloud ${currentSummary.pricing_rates.model_name} Real Cost)`}
                    </p>
                  </div>

                  <div className="text-left sm:text-right font-mono text-xs space-y-1">
                    <p className="text-slate-500">رقم الفاتورة: <strong className="text-slate-900">{currentSummary.invoice_number}</strong></p>
                    <p className="text-slate-500">تاريخ الإصدار: <strong className="text-slate-900">{currentSummary.invoice_issue_date}</strong></p>
                    <p className="text-slate-500">فترة الفاتورة: <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">{currentSummary.timeframe_label}</span></p>
                  </div>
                </div>

                {/* Billed To / Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200/80 text-xs">
                  <div className="space-y-1.5">
                    <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">نطاق الفاتورة والمشترك:</p>
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>{currentSummary.user_info?.name}</span>
                      {currentSummary.client_rate_per_million_egp === 250 && (
                        <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md font-bold border border-purple-200">PRO 👑</span>
                      )}
                    </p>
                    <p className="text-slate-600">المادة / التخصص: <strong className="text-slate-800">{currentSummary.user_info?.subject}</strong></p>
                    <p className="text-slate-600">البريد الإلكتروني: <strong className="text-slate-800 font-mono">{currentSummary.user_info?.email}</strong></p>
                    {currentSummary.user_info?.phone && currentSummary.user_info?.phone !== '-' && (
                      <p className="text-slate-600">رقم الهاتف: <strong className="text-slate-800 font-mono">{currentSummary.user_info.phone}</strong></p>
                    )}
                  </div>

                  {currentSummary.pricing_mode === 'client' ? (
                    <div className="space-y-1.5">
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">تفاصيل باقة التوكنز والتسعير:</p>
                      <p className="text-slate-700">باقة الاشتراك المعتمدة: <strong className={currentSummary.client_rate_per_million_egp === 250 ? "text-purple-700 font-bold" : "text-emerald-700 font-bold"}>{currentSummary.client_rate_per_million_egp} جنيه مصري لكل 1 مليون توكن {currentSummary.client_rate_per_million_egp === 250 ? '(نظام برو 👑)' : '(نظام فلاش)'}</strong></p>
                      <p className="text-slate-700">سعر الرمز (التوكن): <strong className="font-mono text-slate-900">{(currentSummary.client_rate_per_million_egp / 1_000_000).toFixed(5)} ج.م</strong> <span className="text-[10px] text-slate-500">({((currentSummary.client_rate_per_million_egp / 1_000_000) * 1000).toFixed(2)} قرش لكل 1,000 توكن)</span></p>
                      <p className="text-slate-700">إجمالي رصيد الباقة: <strong className="font-mono font-bold text-slate-900">{(currentSummary.user_info?.total_plan_tokens || 1000000).toLocaleString()} توكن</strong></p>
                      <p className="text-slate-700">المستهلك في هذه الفترة: <strong className="font-mono font-bold text-indigo-700">{currentSummary.total_tokens.toLocaleString()} توكن</strong></p>
                      <p className="text-slate-700">الرصيد المتبقي المتاح: <strong className="font-mono font-bold text-emerald-700">{(currentSummary.user_info?.remaining_tokens || 0).toLocaleString()} توكن</strong></p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">تفاصيل الخادم وتكلفة الذكاء الاصطناعي الفعلية:</p>
                      <p className="text-slate-700">المحرك المعتمد: <strong className="text-indigo-700 font-mono">{currentSummary.pricing_rates.model_name}</strong></p>
                      <p className="text-slate-700">سعر المليون رمز (Prompts): <strong className="font-mono">${currentSummary.pricing_rates.input_per_million_usd} USD</strong></p>
                      <p className="text-slate-700">سعر المليون رمز (Outputs): <strong className="font-mono">${currentSummary.pricing_rates.output_per_million_usd} USD</strong></p>
                      <p className="text-slate-700">سعر الصرف المطبق: <strong className="font-mono">$1 = {currentSummary.pricing_rates.usd_to_egp_rate} ج.م</strong></p>
                      <p className="text-slate-700">مقارنة سعر المشترك: <strong className="text-emerald-700 font-mono">{currentSummary.client_rate_per_million_egp} جنيه / 1M توكن {currentSummary.client_rate_per_million_egp === 250 ? '(برو 👑)' : '(فلاش)'}</strong></p>
                    </div>
                  )}
                </div>

                {/* Itemized Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-200 text-slate-700 font-bold">
                        <th className="py-3 px-2">#</th>
                        <th className="py-3 px-2">بند الخدمة / العملية</th>
                        <th className="py-3 px-2 text-center">عدد العمليات</th>
                        <th className="py-3 px-2 text-center">إجمالي التوكينز</th>
                        {currentSummary.pricing_mode === 'client' ? (
                          <>
                            <th className="py-3 px-2 text-center">متوسط الرموز للعملية</th>
                            <th className="py-3 px-2 text-left">التكلفة المستحقة (ج.م)</th>
                          </>
                        ) : (
                          <>
                            <th className="py-3 px-2 text-center">المدخلات</th>
                            <th className="py-3 px-2 text-center">المخرجات</th>
                            <th className="py-3 px-2 text-center">التكلفة الفعلية (USD)</th>
                            <th className="py-3 px-2 text-left">التكلفة الفعلية (ج.م)</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentSummary.operations_breakdown.map((item, i) => (
                        <tr key={item.operation ? `invoice_item_${item.operation}_${i}` : `invoice_item_${i}`}>
                          <td className="py-3 px-2 text-slate-400 font-mono">{i + 1}</td>
                          <td className="py-3 px-2 font-bold text-slate-900">{item.operation_label}</td>
                          <td className="py-3 px-2 text-center font-mono">{item.count.toLocaleString()}</td>
                          <td className="py-3 px-2 text-center font-mono font-bold text-indigo-700">{item.total_tokens.toLocaleString()}</td>
                          {currentSummary.pricing_mode === 'client' ? (
                            <>
                              <td className="py-3 px-2 text-center font-mono text-slate-600">{item.avg_tokens_per_op.toLocaleString()} توكن</td>
                              <td className="py-3 px-2 text-left font-mono font-bold text-emerald-800">{item.cost_egp.toFixed(2)} ج.م</td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 px-2 text-center font-mono text-slate-500">{item.prompt_tokens.toLocaleString()}</td>
                              <td className="py-3 px-2 text-center font-mono text-slate-500">{item.candidates_tokens.toLocaleString()}</td>
                              <td className="py-3 px-2 text-center font-mono text-slate-700">${item.cost_usd.toFixed(4)}</td>
                              <td className="py-3 px-2 text-left font-mono font-bold text-slate-900">{item.cost_egp.toFixed(2)} ج.م</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals Box */}
                <div className="flex justify-end pt-4 border-t-2 border-slate-200">
                  <div className="w-full sm:w-96 space-y-2 text-xs">
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>إجمالي عدد العمليات:</span>
                      <span className="font-mono font-bold">{currentSummary.total_operations_count.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>إجمالي التوكينز المستهلكة:</span>
                      <span className="font-mono font-bold text-indigo-800">{currentSummary.total_tokens.toLocaleString()}</span>
                    </div>

                    {currentSummary.pricing_mode === 'client' ? (
                      <>
                        <div className="flex justify-between py-1 text-slate-600">
                          <span>تسعيرة الباقة المعتمدة:</span>
                          <span className="font-bold text-slate-800">{currentSummary.client_rate_per_million_egp} جنيه لكل 1,000,000 توكن {currentSummary.client_rate_per_million_egp === 250 ? '(برو 👑)' : '(فلاش)'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-t-2 border-slate-900 text-sm font-black text-slate-900">
                          <span>المبلغ الإجمالي المستحق:</span>
                          <span className="font-mono text-emerald-800 text-base">{currentSummary.total_cost_egp.toFixed(2)} ج.م</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between py-1 text-slate-600">
                          <span>التكلفة بالدولار الأمريكي (Google API):</span>
                          <span className="font-mono font-bold">${(currentSummary.real_cost_usd ?? currentSummary.total_cost_usd).toFixed(4)} USD</span>
                        </div>
                        <div className="flex justify-between py-1 text-slate-600">
                          <span>قيمة البيع للعميل ({currentSummary.client_rate_per_million_egp} ج.م/1M):</span>
                          <span className="font-mono font-bold text-indigo-700">{(currentSummary.client_cost_egp || 0).toFixed(2)} ج.م</span>
                        </div>
                        <div className="flex justify-between py-2 border-t-2 border-purple-900 text-sm font-black text-slate-900">
                          <span>المبلغ الفعلي للمطور (سعر API):</span>
                          <span className="font-mono text-purple-900 text-base">{(currentSummary.real_cost_egp ?? currentSummary.total_cost_egp).toFixed(2)} ج.م</span>
                        </div>
                        <div className="flex justify-between py-1.5 bg-emerald-50 px-3 rounded-xl text-xs font-bold text-emerald-800">
                          <span>صافي ربح المطور:</span>
                          <span className="font-mono">+{(currentSummary.developer_profit_egp || 0).toFixed(2)} ج.م ({(currentSummary.developer_margin_percent || 0).toFixed(1)}%)</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Official Stamp & Certification Notice */}
                <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between flex-wrap gap-3 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    <span>
                      {currentSummary.pricing_mode === 'client'
                        ? `فاتورة رسمية صادرة ومحتسبة وفقاً لتسعيرة باقة التوكنز المعتمدة (${currentSummary.client_rate_per_million_egp} جنيه مصري لكل 1 مليون توكن ${currentSummary.client_rate_per_million_egp === 250 ? '- نظام برو 👑' : '- نظام فلاش'}).`
                        : `فاتورة التكلفة الفعلية للمطور - مستخرجة ومطابقة لسجلات استهلاك Google Gemini API (${currentSummary.pricing_rates.model_name}).`}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">
                    Smart Exam Evaluator Platform © {new Date().getFullYear()}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 5: AUDIT LOGS                                           */}
          {/* ============================================================ */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              
              {/* Filter bar */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="بحث في سجل العمليات..."
                    value={searchLogQuery}
                    onChange={(e) => setSearchLogQuery(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <select
                  value={selectedOperationFilter}
                  onChange={(e) => setSelectedOperationFilter(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-3 py-2 outline-none"
                >
                  <option value="all">كافة العمليات</option>
                  <option value="essay_grading">تصحيح الأسئلة المقالية</option>
                  <option value="doc_extraction">استخراج الملفات</option>
                  <option value="quiz_generation">توليد الاختبارات</option>
                </select>
              </div>

              {/* Logs Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">الوقت</th>
                        <th className="p-3">المستخدم / الاختبار</th>
                        <th className="p-3">نوع العملية</th>
                        <th className="p-3 text-center">المدخلات (In)</th>
                        <th className="p-3 text-center">المخرجات الخام (Out)</th>
                        <th className="p-3 text-center">المخصوم من الباقة ({currentSummary.client_rate_per_million_egp === 250 ? 'Out × 6 👑' : 'Out × 5 ⚡'})</th>
                        <th className="p-3 text-center" title="تكلفة Google API الفعلية المدفوعة لجوجل محسوبة على التوكنز الخام الصافية دون مضاعفة">تكلفة API لجوجل (ج.م)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentSummary.recent_logs.map((log, logIdx) => {
                        const cand = Number(log.candidates_tokens || 0);
                        const prompt = Number(log.prompt_tokens || 0);
                        const isProLog = String(log.model || '').toLowerCase().includes('pro') || currentSummary.client_rate_per_million_egp === 250;
                        const mult = isProLog ? 6 : 5;
                        const strictTotal = (prompt > 0 || cand > 0) ? (prompt + (cand * mult)) : Math.max(0, Number(log.total_tokens || 0));
                        return (
                          <tr key={log.id ? `log_${log.id}_${logIdx}` : `log_idx_${logIdx}`} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-slate-500 font-mono text-[11px]">
                              {new Date(log.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-800">{log.quiz_title || log.user_name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{log.model}</div>
                            </td>
                            <td className="p-3 font-medium text-slate-700">{log.operation_label}</td>
                            <td className="p-3 text-center font-mono text-slate-500">{prompt.toLocaleString()}</td>
                            <td className="p-3 text-center font-mono text-slate-600">
                              <span className="font-bold">{cand.toLocaleString()}</span>
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-indigo-700">
                              <div>{strictTotal.toLocaleString()}</div>
                              <span className={`text-[9.5px] font-medium ${mult === 6 ? 'text-purple-600' : 'text-indigo-600'} font-sans block`}>
                                (مخرجات ×{mult}: {(cand * mult).toLocaleString()})
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-emerald-700" title="تكلفة الـ API الصافية لجوجل بدون مضاعفة التوكنز">
                              {log.cost_egp.toFixed(4)} ج.م
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};

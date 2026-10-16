import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, 
  X, 
  CheckCircle2, 
  Clock, 
  RotateCcw,
  BookOpen,
  FlaskConical,
  Coins,
  Sliders,
  Sparkles,
  Calculator,
  Zap,
  Users,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
  UserX,
  Crown
} from 'lucide-react';
import { SUBSCRIPTION_PLANS, TOKEN_PRESET_PLANS, PRO_TOKEN_PRESET_PLANS, TOKEN_PRICE_PER_MILLION, getPlanById, getProEquivalentPlan } from '../../constants';
import { formatPlanLabel } from '../../App';
import { getUserTokenStats } from '../../utils/tokenStats';

interface AdminUserPlanModalProps {
  user: any | null;
  onClose: () => void;
  onActivate: (params: {
    userId: string;
    planId: string;
    cycle: 'monthly' | 'yearly' | '3months' | '6months' | 'custom';
    customDays?: number;
    extendFromCurrentEnd: boolean;
    extraTokensToAdd: number;
    resetTokensUsed: boolean;
    preserveRemainingTokens?: boolean;
    clearPreviousExtraTokens?: boolean;
    customPlanDetails?: {
      name?: string;
      tokensInMillions?: number;
      monthlyPrice?: number;
      yearlyPrice?: number;
      essayLimit?: number;
      modelPreference?: string;
      notes?: string;
    };
    overrideTokensUsed?: number;
    overrideTokensTotal?: number;
  }) => Promise<void>;
  onDeactivate?: (user: any) => void;
}

export const AdminUserPlanModal: React.FC<AdminUserPlanModalProps> = ({
  user,
  onClose,
  onActivate,
  onDeactivate,
}) => {
  if (!user) return null;

  // Detect initial category from user subject or current plan
  const sub = (user.subject || '').toLowerCase();
  const isScience = /رياضيات|علوم|فيزياء|كيمياء|أحياء|علمي|math|science|physics|chemistry|biology/i.test(sub);
  const currentPlan = getPlanById(user.subscription_type);
  
  const [activeTab, setActiveTab] = useState<'theory' | 'science' | 'tokens' | 'custom'>(() => {
    if (user.subscription_type?.startsWith('custom_') || user.custom_plan_name) return 'custom';
    if (user.subscription_type?.startsWith('token_')) return 'tokens';
    if (currentPlan?.category === 'science' || isScience) return 'science';
    return 'theory';
  });

  const [chosenPlan, setChosenPlan] = useState<string>(() => {
    if (user.subscription_type) return user.subscription_type;
    return isScience ? 'science_250' : 'theory_250';
  });

  const [tokenModelChoice, setTokenModelChoice] = useState<'flash' | 'pro'>(() => {
    if (user.preferred_ai_model === 'gemini_pro' || user.preferred_ai_model === 'pro' || String(user.subscription_type || '').includes('pro')) return 'pro';
    return 'flash';
  });

  // Duration & cycle
  const [chosenCycle, setChosenCycle] = useState<'monthly' | 'yearly' | '3months' | '6months' | 'custom'>('monthly');
  const [customDays, setCustomDays] = useState<number>(30);
  const [extendFromCurrentEnd, setExtendFromCurrentEnd] = useState<boolean>(false);
  const [extraTokensToAdd, setExtraTokensToAdd] = useState<number>(0);
  const [resetTokensUsed, setResetTokensUsed] = useState<boolean>(true);
  const [preserveRemainingTokens, setPreserveRemainingTokens] = useState<boolean>(false);
  const proEquiv = useMemo(() => {
    return getProEquivalentPlan(user.subscription_type, user.custom_plan_name, user.custom_tokens_millions);
  }, [user]);
  const [clearPreviousExtraTokens, setClearPreviousExtraTokens] = useState<boolean>(() => {
    // If activating a 1M+ custom or token plan, suggest clearing leftover old extra tokens by default
    return Boolean(user.extra_tokens && user.extra_tokens > 0 && user.extra_tokens <= 30000);
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Manual overrides state
  const [overrideTokensUsed, setOverrideTokensUsed] = useState<string>('');
  const [overrideTokensTotal, setOverrideTokensTotal] = useState<string>('');

  // Custom Plan State
  const [customTokensMillions, setCustomTokensMillions] = useState<number>(() => {
    if (user.custom_tokens_millions) return user.custom_tokens_millions;
    const match = (user.subscription_type || '').match(/(\d+(?:\.\d+)?)M/);
    return match ? parseFloat(match[1]) : 4;
  });
  const [customPlanTitle, setCustomPlanTitle] = useState<string>(() => {
    return user.custom_plan_name || `باقة مخصصة (${user.name || 'للمعلم'})`;
  });
  const [customMonthlyPrice, setCustomMonthlyPrice] = useState<number>(() => {
    return user.custom_monthly_price || 300;
  });
  const [customYearlyPrice, setCustomYearlyPrice] = useState<number>(() => {
    return user.custom_yearly_price || 3000;
  });
  const [customEssayLimit, setCustomEssayLimit] = useState<number>(() => {
    return user.custom_essay_limit !== undefined ? user.custom_essay_limit : 15;
  });
  const [customAiModel, setCustomAiModel] = useState<string>(() => {
    return user.custom_ai_engine || 'gemini-3.8-flash';
  });
  const [customNotes, setCustomNotes] = useState<string>(user.custom_notes || '');

  // Built-in Smart Estimator / Calculator for Custom Plan
  const [showCalcAssistant, setShowCalcAssistant] = useState<boolean>(false);
  const [calcStudents, setCalcStudents] = useState<number>(150);
  const [calcWeeklyQuizzes, setCalcWeeklyQuizzes] = useState<number>(1);
  const [calcWeeklyEssays, setCalcWeeklyEssays] = useState<number>(2);
  const [calcMonthlyExams, setCalcMonthlyExams] = useState<number>(1);
  const [calcMonthlyEssays, setCalcMonthlyEssays] = useState<number>(4);
  const [calcSubjectCategory, setCalcSubjectCategory] = useState<'science' | 'theory'>(isScience ? 'science' : 'theory');

  // Recalculate default prices when millions change
  useEffect(() => {
    const unitPrice = TOKEN_PRICE_PER_MILLION || 200;
    const calculatedMonthly = Math.round(customTokensMillions * unitPrice);
    const calculatedYearly = Math.round(calculatedMonthly * 10);
    setCustomMonthlyPrice(calculatedMonthly);
    setCustomYearlyPrice(calculatedYearly);
  }, [customTokensMillions]);

  // Handle Tab Switch
  useEffect(() => {
    if (activeTab === 'theory' && !chosenPlan.startsWith('theory_')) {
      setChosenPlan('theory_250');
    } else if (activeTab === 'science' && !chosenPlan.startsWith('science_')) {
      setChosenPlan('science_250');
    } else if (activeTab === 'tokens') {
      if (tokenModelChoice === 'pro' && !chosenPlan.startsWith('pro_token_')) {
        setChosenPlan('pro_token_1M');
      } else if (tokenModelChoice === 'flash' && !chosenPlan.startsWith('token_')) {
        setChosenPlan('token_1M');
      }
    } else if (activeTab === 'custom') {
      setChosenPlan(`custom_token_${customTokensMillions}M`);
    }
  }, [activeTab, tokenModelChoice]);

  // Handle explicit token model choice switch
  const handleTokenModelSwitch = (choice: 'flash' | 'pro') => {
    setTokenModelChoice(choice);
    if (choice === 'pro') {
      if (!chosenPlan.startsWith('pro_')) {
        const m = chosenPlan.match(/token_(\d+M)/);
        setChosenPlan(m ? `pro_token_${m[1]}` : 'pro_token_1M');
      }
    } else {
      if (chosenPlan.startsWith('pro_token_')) {
        setChosenPlan(chosenPlan.replace('pro_token_', 'token_'));
      }
    }
  };

  // Keep chosenPlan synced in custom tab
  useEffect(() => {
    if (activeTab === 'custom') {
      setChosenPlan(`custom_token_${customTokensMillions}M`);
    }
  }, [customTokensMillions, activeTab]);

  // Calculated Tokens from Smart Assistant
  const calculatedEstimator = useMemo(() => {
    const tokensPerEssay = calcSubjectCategory === 'science' ? 500 : 400;
    const weeklyAnswersPerStudent = Math.max(0, calcWeeklyQuizzes) * 4 * Math.max(0, calcWeeklyEssays);
    const monthlyAnswersPerStudent = Math.max(0, calcMonthlyExams) * Math.max(0, calcMonthlyEssays);
    const totalAnswersPerStudent = weeklyAnswersPerStudent + monthlyAnswersPerStudent;
    const totalAnswers = Math.max(1, calcStudents) * totalAnswersPerStudent;
    const rawTokens = totalAnswers * tokensPerEssay;
    const exactMillions = rawTokens / 1_000_000;
    const recommendedMillions = Math.max(1, Math.ceil(exactMillions * 2) / 2); // rounded to nearest 0.5M
    return {
      totalAnswers,
      rawTokens,
      exactMillions,
      recommendedMillions,
      weeklyAnswersPerStudent,
      monthlyAnswersPerStudent,
      suggestedMonthlyPrice: Math.round(recommendedMillions * (TOKEN_PRICE_PER_MILLION || 200))
    };
  }, [calcStudents, calcWeeklyQuizzes, calcWeeklyEssays, calcMonthlyExams, calcMonthlyEssays, calcSubjectCategory]);

  const applyCalculatedToCustomPlan = () => {
    setCustomTokensMillions(calculatedEstimator.recommendedMillions);
    setCustomEssayLimit(Math.max(calcWeeklyEssays, calcMonthlyEssays, 2));
    setCustomAiModel('gemini-3.8-flash');
    setCustomPlanTitle(`باقة مخصصة - ${calculatedEstimator.recommendedMillions} مليون توكن (${calcStudents} طالب)`);
    setShowCalcAssistant(false);
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const isProPlanSelected = chosenPlan.startsWith('pro_') || 
        (activeTab === 'tokens' && tokenModelChoice === 'pro') ||
        (activeTab === 'custom' && (customAiModel.includes('pro') || customPlanTitle.includes('برو')));
      
      let finalPlanId = activeTab === 'custom' ? `custom_token_${customTokensMillions}M` : chosenPlan;
      if (isProPlanSelected && activeTab === 'tokens' && !finalPlanId.startsWith('pro_')) {
        const m = finalPlanId.match(/token_(\d+M)/);
        finalPlanId = m ? `pro_token_${m[1]}` : `pro_${finalPlanId}`;
      }

      const customPlanDetails = activeTab === 'custom' ? {
        name: customPlanTitle || `باقة مخصصة (${customTokensMillions}M توكن)`,
        tokensInMillions: customTokensMillions,
        monthlyPrice: customMonthlyPrice,
        yearlyPrice: customYearlyPrice,
        essayLimit: customEssayLimit,
        modelPreference: customAiModel.includes('pro') ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash',
        notes: customNotes
      } : (isProPlanSelected ? { modelPreference: 'gemini_pro' } : undefined);

      await onActivate({
        userId: user.id || user.uid,
        planId: finalPlanId,
        cycle: chosenCycle,
        customDays: chosenCycle === 'custom' ? customDays : undefined,
        extendFromCurrentEnd,
        extraTokensToAdd,
        resetTokensUsed,
        preserveRemainingTokens,
        clearPreviousExtraTokens,
        customPlanDetails,
        overrideTokensUsed: overrideTokensUsed.trim() !== '' ? Number(overrideTokensUsed) : undefined,
        overrideTokensTotal: overrideTokensTotal.trim() !== '' ? Number(overrideTokensTotal) : undefined
      });
      onClose();
    } catch (err) {
      console.error('Activation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCurrentActive = user.subscription_status === 'active' && user.subscription_end_date && new Date(user.subscription_end_date) > new Date();

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl text-right overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[92vh] my-auto"
        
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 text-white p-2.5 rounded-2xl shadow-md shadow-indigo-200">
              <CreditCard size={22} />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                <span>تفعيل / ترقية باقة المشترك</span>
                <span className="text-[11px] bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-2 py-0.5 rounded-full font-bold">
                  النظام المطور
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                تفعيل الباقات القياسية أو إنشاء باقة مخصصة بالكامل بالتوكنز والمميزات المطلوبة
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* User Info Card */}
          <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/60 to-slate-50 p-4 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-900 text-base">{user.name || 'بدون اسم'}</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                  {user.role === 'admin' ? 'مسؤول' : 'معلم'}
                </span>
                {user.subject && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800">
                    {user.subject}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 font-mono mt-1" dir="ltr">{user.email}</p>
              {user.phone && (
                <p className="text-xs text-slate-500 font-mono mt-0.5" dir="ltr">هاتف: {user.phone}</p>
              )}
            </div>

            <div className="text-right sm:text-left shrink-0 bg-white/85 p-3 rounded-xl border border-indigo-100 text-xs shadow-xs">
              <div className="text-slate-500 mb-0.5">الباقة الحالية:</div>
              <div className="font-black text-indigo-900">
                {user.custom_plan_name || formatPlanLabel(user.subscription_type, user.billing_cycle)}
              </div>
              <div className="mt-1 text-[11px]">
                {isCurrentActive ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    سارية حتى: {new Date(user.subscription_end_date).toLocaleDateString('ar-EG')}
                  </span>
                ) : (
                  <span className="text-amber-600 font-bold flex items-center gap-1">
                    <Clock size={12} />
                    غير مفعلة / منتهية
                  </span>
                )}
              </div>
              {(() => {
                const stats = getUserTokenStats(user);
                return (
                  <div className="text-[10px] text-slate-500 mt-1 font-mono">
                    <div>المستهلك: <strong className="text-slate-800 font-bold">{stats.used.toLocaleString()}</strong> توكن ({stats.percentage}%)</div>
                    <div>المتبقي: <strong className="text-emerald-700 font-bold">{stats.remaining.toLocaleString()}</strong> / {stats.totalLimit.toLocaleString()}</div>
                    {stats.extra > 0 ? <div className="text-emerald-600 font-semibold mt-0.5">إضافي: +{stats.extra.toLocaleString()}</div> : null}
                  </div>
                );
              })()}

              {isCurrentActive && onDeactivate && user.role !== 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDeactivate(user);
                  }}
                  className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 py-1 px-2 rounded-lg transition-colors cursor-pointer"
                  title="إلغاء التفعيل مع الحفاظ على كافة البيانات والاختبارات"
                >
                  <UserX size={13} />
                  <span>إلغاء التفعيل (حفظ البيانات)</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Pro Upgrade Banner with Remaining Tokens Guarantee */}
          <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white p-3.5 rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-purple-400/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-purple-950 flex items-center justify-center shrink-0 shadow-md">
                <Crown size={22} className="fill-purple-950 text-purple-950" />
              </div>
              <div>
                <div className="font-black text-xs sm:text-sm flex items-center gap-2">
                  <span>ترقية المعلم لنظام برو (Gemini Pro) بنفس الباقة</span>
                  <span className="text-[10px] bg-amber-300 text-purple-950 px-2 py-0.2 rounded-full font-black shadow-2xs">
                    حفظ المتبقي ({getUserTokenStats(user).remaining.toLocaleString()}) 👑
                  </span>
                </div>
                <div className="text-[11px] text-purple-100 mt-0.5">
                  الترقية لنظام Gemini Pro مع الحفاظ التام على كامل التوكنز المتبقية ({getUserTokenStats(user).remaining.toLocaleString()} توكن) دون تصفير
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setChosenPlan(proEquiv.proPlanId);
                if (proEquiv.category === 'tokens') {
                  setActiveTab('tokens');
                  setTokenModelChoice('pro');
                } else if (proEquiv.category === 'theory') {
                  setActiveTab('theory');
                } else if (proEquiv.category === 'science') {
                  setActiveTab('science');
                } else {
                  setActiveTab('custom');
                  setCustomAiModel('gemini-3.1-pro-preview');
                }
                setResetTokensUsed(false);
                setPreserveRemainingTokens(true);
              }}
              className="bg-amber-400 hover:bg-amber-300 text-purple-950 px-3.5 py-2 rounded-xl font-black text-xs transition-all shadow-md shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Crown size={15} className="fill-purple-950" />
              <span>تحديد الترقية لـ Pro والمتبقي 👑</span>
            </button>
          </div>

          {/* Quick 1M Tokens Shortcut Banner */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white p-3.5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                <Zap size={20} className="text-amber-300 fill-amber-300" />
              </div>
              <div>
                <div className="font-black text-xs sm:text-sm">تجديد فوري لباقة 1 مليون توكن (الأكثر طلباً)</div>
                <div className="text-[11px] text-emerald-100">تفعيل شهر كامل (200 ج.م) وتصفير الاستهلاك للبدء فوراً برصيد 1,000,000 توكن أخضر</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTab('tokens');
                setChosenPlan('token_1M');
                setChosenCycle('monthly');
                setResetTokensUsed(true);
              }}
              className="bg-white text-emerald-800 hover:bg-emerald-50 px-3 py-1.5 rounded-xl font-black text-xs transition-all shadow-xs shrink-0 cursor-pointer flex items-center justify-center gap-1"
            >
              <Check size={14} className="text-emerald-700" />
              <span>تحديد باقة 1M توكن بنقرة واحدة</span>
            </button>
          </div>

          {/* System Upgrade & Category Tabs */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="block text-xs font-black text-slate-800">
                1. اختر النظام المطلوب للترقية أو التفعيل (التنقل بين الأنظمة):
              </label>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center gap-1 shadow-2xs">
                <Sparkles size={11} />
                <span>النظام المختار للترقية: {
                  activeTab === 'theory' ? 'المواد النظرية' :
                  activeTab === 'science' ? 'المواد العلمية' :
                  activeTab === 'tokens' ? (tokenModelChoice === 'pro' ? 'توكنز (جيميناي برو 👑)' : 'توكنز (فلاش ⚡)') :
                  'باقة مخصصة ✨'
                }</span>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setActiveTab('theory')}
                className={`py-2 px-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'theory'
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60 font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen size={15} className={activeTab === 'theory' ? 'text-indigo-600' : 'text-slate-400'} />
                <span>المواد النظرية</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('science')}
                className={`py-2 px-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'science'
                    ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/60 font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FlaskConical size={15} className={activeTab === 'science' ? 'text-emerald-600' : 'text-slate-400'} />
                <span>المواد العلمية</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('tokens')}
                className={`py-2 px-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'tokens'
                    ? 'bg-white text-purple-700 shadow-sm border border-slate-200/60 font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Coins size={15} className={activeTab === 'tokens' ? 'text-purple-600' : 'text-slate-400'} />
                <span>باقات التوكنز</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('custom')}
                className={`py-2 px-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 relative overflow-hidden ${
                  activeTab === 'custom'
                    ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-md font-black'
                    : 'bg-white text-purple-700 hover:bg-purple-50/50 border border-purple-200/60 font-black'
                }`}
              >
                <Sparkles size={15} className={activeTab === 'custom' ? 'text-amber-300 animate-pulse' : 'text-purple-600'} />
                <span>الباقة المخصصة ✨</span>
              </button>
            </div>
          </div>

          {/* Plan Options Selector / Custom Studio */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-2">
              2. {activeTab === 'custom' ? 'تخصيص وإعداد الباقة المخصصة:' : 'حدد الباقة المراد تفعيلها:'}
            </label>

            {/* TAB 1: THEORY */}
            {activeTab === 'theory' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {SUBSCRIPTION_PLANS.filter(p => p.category === 'theory').map(p => {
                  const isSelected = chosenPlan === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setChosenPlan(p.id)}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected 
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-500/20' 
                          : 'border-slate-200 hover:border-indigo-300 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black text-slate-800">{p.name}</span>
                          {p.popular && (
                            <span className="text-[10px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded-full">
                              الأكثر طلباً
                            </span>
                          )}
                        </div>
                        <div className="text-base font-black text-indigo-700 mb-1">
                          {p.monthlyPrice} <span className="text-xs text-slate-500 font-medium">ج.م / شهر</span>
                        </div>
                        <div className="text-[11px] text-slate-500 leading-tight">
                          {p.essayText}
                        </div>
                      </div>
                      <div className="mt-2 text-[10px] font-bold text-indigo-600">
                        السنوي: {p.yearlyPrice} ج.م
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 2: SCIENCE */}
            {activeTab === 'science' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {SUBSCRIPTION_PLANS.filter(p => p.category === 'science').map(p => {
                  const isSelected = chosenPlan === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setChosenPlan(p.id)}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected 
                          ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20' 
                          : 'border-slate-200 hover:border-emerald-300 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black text-slate-800">{p.name}</span>
                          {p.popular && (
                            <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded-full">
                              موصى بها
                            </span>
                          )}
                        </div>
                        <div className="text-base font-black text-emerald-700 mb-1">
                          {p.monthlyPrice} <span className="text-xs text-slate-500 font-medium">ج.م / شهر</span>
                        </div>
                        <div className="text-[11px] text-slate-500 leading-tight">
                          {p.essayText}
                        </div>
                      </div>
                      <div className="mt-2 text-[10px] font-bold text-emerald-600">
                        السنوي: {p.yearlyPrice} ج.م
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 3: TOKENS PRESETS */}
            {activeTab === 'tokens' && (
              <div className="space-y-3">
                {/* Model Selector Switcher for Token Plans */}
                <div className="flex items-center justify-between bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setTokenModelChoice('flash');
                      if (chosenPlan.startsWith('pro_')) {
                        setChosenPlan('token_1M');
                      }
                    }}
                    className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      tokenModelChoice === 'flash'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <Zap size={14} />
                    <span>باقات فلاش 3.8 (200 ج.م / 1M)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTokenModelChoice('pro');
                      if (!chosenPlan.startsWith('pro_')) {
                        setChosenPlan('pro_token_1M');
                      }
                    }}
                    className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      tokenModelChoice === 'pro'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    <Sparkles size={14} />
                    <span>باقات جيميناي برو (250 ج.م / 1M)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {(tokenModelChoice === 'pro' ? PRO_TOKEN_PRESET_PLANS : TOKEN_PRESET_PLANS).map(p => {
                    const isSelected = chosenPlan === p.id;
                    const isPro = tokenModelChoice === 'pro';
                    return (
                      <div
                        key={p.id}
                        onClick={() => setChosenPlan(p.id)}
                        className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected 
                            ? (isPro ? 'border-indigo-600 bg-indigo-50/60 shadow-md ring-2 ring-indigo-500/20' : 'border-purple-600 bg-purple-50/50 shadow-md ring-2 ring-purple-500/20')
                            : 'border-slate-200 hover:border-indigo-300 bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-black text-slate-800">{p.name}</span>
                            {p.popular && (
                              <span className={`text-[10px] text-white font-bold px-1.5 py-0.5 rounded-full ${isPro ? 'bg-indigo-600' : 'bg-purple-600'}`}>
                                مميزة
                              </span>
                            )}
                          </div>
                          <div className={`text-base font-black mb-1 ${isPro ? 'text-indigo-700' : 'text-purple-700'}`}>
                            {p.monthlyPrice} <span className="text-xs text-slate-500 font-medium">ج.م / شهر</span>
                          </div>
                          <div className="text-[11px] text-slate-500 leading-tight">
                            {p.description}
                          </div>
                        </div>
                        <div className={`mt-2 text-[10px] font-bold ${isPro ? 'text-indigo-600' : 'text-purple-600'}`}>
                          السنوي: {p.yearlyPrice} ج.م
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 4: CUSTOM PLAN STUDIO (الباقة المخصصة) */}
            {activeTab === 'custom' && (
              <div className="space-y-4 bg-gradient-to-b from-purple-50/40 via-indigo-50/30 to-white p-4 sm:p-5 rounded-3xl border-2 border-purple-200 shadow-sm">
                {/* Assistant Toggle Button */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-purple-100">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-600 text-white rounded-xl shadow-xs">
                      <Sliders size={18} />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-slate-900">محرر الباقة المخصصة بالذكاء الاصطناعي</h4>
                      <p className="text-[11px] text-slate-500">حدد سعة التوكنز والأسئلة المقالية والسعر المتفق عليه</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCalcAssistant(!showCalcAssistant)}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-white text-purple-700 border border-purple-200 hover:bg-purple-50 rounded-xl transition-all shadow-2xs"
                  >
                    <Calculator size={14} className="text-purple-600" />
                    <span>{showCalcAssistant ? 'إخفاء حاسبة الاحتياج' : 'حاسبة الاحتياج السريعة'}</span>
                  </button>
                </div>

                {/* Built-in Smart Estimator Drawer */}
                {showCalcAssistant && (
                  <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-xs space-y-3 animate-in fade-in zoom-in-98 duration-150">
                    <div className="flex items-center justify-between text-xs font-black text-purple-950 pb-1 border-b border-slate-100">
                      <span className="flex items-center gap-1">
                        <Calculator size={14} className="text-purple-600" />
                        حساب التوكنز بدقة بناءً على عدد الطلاب والامتحانات
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">إجمالي الطلاب:</label>
                        <input
                          type="number"
                          min="1"
                          value={calcStudents}
                          onChange={(e) => setCalcStudents(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono outline-none focus:border-purple-600 text-center"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">كويزات أسبوعية:</label>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={calcWeeklyQuizzes}
                          onChange={(e) => setCalcWeeklyQuizzes(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono outline-none focus:border-purple-600 text-center"
                        />
                      </div>

                      <div className="bg-indigo-50/50 p-1 rounded-xl border border-indigo-200">
                        <label className="block text-[10px] font-black text-indigo-950 mb-0.5 text-center">مقالي بالأسبوعي:</label>
                        <input
                          type="number"
                          min="0"
                          value={calcWeeklyEssays}
                          onChange={(e) => setCalcWeeklyEssays(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full p-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-black font-mono outline-none focus:border-indigo-600 text-center text-indigo-950"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">امتحانات شهرية:</label>
                        <input
                          type="number"
                          min="0"
                          max="5"
                          value={calcMonthlyExams}
                          onChange={(e) => setCalcMonthlyExams(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono outline-none focus:border-purple-600 text-center"
                        />
                      </div>

                      <div className="bg-purple-50/50 p-1 rounded-xl border border-purple-200">
                        <label className="block text-[10px] font-black text-purple-950 mb-0.5 text-center">مقالي بالشهري:</label>
                        <input
                          type="number"
                          min="0"
                          value={calcMonthlyEssays}
                          onChange={(e) => setCalcMonthlyEssays(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full p-1.5 bg-white border border-purple-300 rounded-lg text-xs font-black font-mono outline-none focus:border-purple-600 text-center text-purple-950"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">نوع المادة:</label>
                        <select
                          value={calcSubjectCategory}
                          onChange={(e) => setCalcSubjectCategory(e.target.value as any)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-purple-600"
                        >
                          <option value="theory">مواد نظرية (400 توكن)</option>
                          <option value="science">مواد علمية (500 توكن)</option>
                        </select>
                      </div>
                    </div>

                    <div className="bg-purple-50/70 p-3 rounded-xl border border-purple-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="text-slate-600">الاحتياج المحسوب: </span>
                        <span className="font-bold font-mono text-purple-900">{calculatedEstimator.rawTokens.toLocaleString()} توكن </span>
                        <span className="text-purple-700 font-bold">({calculatedEstimator.recommendedMillions} مليون توكن/شهر)</span>
                      </div>
                      <button
                        type="button"
                        onClick={applyCalculatedToCustomPlan}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-1"
                      >
                        <Check size={14} />
                        <span>تطبيق الحسبة للباقة المخصصة</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 1. Quick Presets for Custom Tokens */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-black text-slate-800">
                      سعة التوكنز الشهرية للباقة المخصصة:
                    </label>
                    <span className="text-xs font-bold text-purple-700 font-mono">
                      {customTokensMillions} مليون توكن ({Math.round(customTokensMillions * 2000).toLocaleString()} إجابة مقالية/شهر)
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {[1, 2, 3, 4, 5, 7.5, 10, 15, 20, 30, 50].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCustomTokensMillions(num)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all border ${
                          customTokensMillions === num
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs scale-105'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-purple-50 hover:border-purple-300'
                        }`}
                      >
                        {num}M
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-purple-200">
                    <input
                      type="range"
                      min="0.5"
                      max="50"
                      step="0.5"
                      value={customTokensMillions}
                      onChange={(e) => setCustomTokensMillions(parseFloat(e.target.value) || 1)}
                      className="w-full accent-purple-600 cursor-pointer"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min="0.5"
                        max="100"
                        step="0.5"
                        value={customTokensMillions}
                        onChange={(e) => setCustomTokensMillions(Math.max(0.5, parseFloat(e.target.value) || 0.5))}
                        className="w-16 p-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-center font-mono outline-none focus:border-purple-600"
                      />
                      <span className="text-xs font-bold text-slate-500">مليون</span>
                    </div>
                  </div>
                </div>

                {/* 2. Custom Title & Features Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      اسم ومسمى الباقة المخصصة:
                    </label>
                    <input
                      type="text"
                      value={customPlanTitle}
                      onChange={(e) => setCustomPlanTitle(e.target.value)}
                      placeholder="مثال: باقة VIP سنتر الأوائل"
                      className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-purple-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      الحد الأقصى للأسئلة المقالية بالامتحان:
                    </label>
                    <select
                      value={customEssayLimit}
                      onChange={(e) => setCustomEssayLimit(parseInt(e.target.value) || 0)}
                      className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-purple-600"
                    >
                      <option value={5}>5 أسئلة مقالية لكل اختبار</option>
                      <option value={10}>10 أسئلة مقالية لكل اختبار</option>
                      <option value={15}>15 سؤال مقالي لكل اختبار</option>
                      <option value={25}>25 سؤال مقالي لكل اختبار</option>
                      <option value={50}>50 سؤال مقالي لكل اختبار</option>
                      <option value={999}>غير محدود (Unlimited)</option>
                    </select>
                  </div>
                </div>

                {/* 3. Pricing & AI Engine */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      السعر الشهري للباقة (ج.م):
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={customMonthlyPrice}
                      onChange={(e) => setCustomMonthlyPrice(parseInt(e.target.value) || 0)}
                      className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-xs font-bold font-mono outline-none focus:border-purple-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      السعر السنوي للباقة (ج.م):
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={customYearlyPrice}
                      onChange={(e) => setCustomYearlyPrice(parseInt(e.target.value) || 0)}
                      className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-xs font-bold font-mono outline-none focus:border-purple-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      محرك الذكاء الاصطناعي:
                    </label>
                    <select
                      value={customAiModel}
                      onChange={(e) => setCustomAiModel(e.target.value)}
                      className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-purple-600"
                    >
                      <option value="gemini-3.8-flash">Gemini 3.8 Flash (المحرك فائق السرعة والموفر)</option>
                      <option value="gemini-3.1-pro-preview">Gemini Pro (محرك برو الاستدلال العميق والأكاديمي 👑)</option>
                    </select>
                  </div>
                </div>

                {/* 4. Live Custom Plan Summary Card */}
                <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white p-3.5 rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-black text-sm">{customPlanTitle || 'باقة مخصصة'}</span>
                      <span className="bg-white/20 backdrop-blur-xs text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {customTokensMillions}M توكن شهرياً
                      </span>
                    </div>
                    <p className="text-xs text-purple-100">
                      {customEssayLimit >= 999 ? 'أسئلة مقالية غير محدودة' : `${customEssayLimit} أسئلة مقالية لكل اختبار`} | تصحيح فوري بالذكاء الاصطناعي
                    </p>
                  </div>

                  <div className="text-right sm:text-left shrink-0 bg-black/20 p-2 rounded-xl text-xs">
                    <span className="font-black text-sm text-amber-300 font-mono">
                      {chosenCycle === 'yearly' ? `${customYearlyPrice} ج.م / سنة` : `${customMonthlyPrice} ج.م / شهر`}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Duration & Cycle Selection */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-2">
              3. مدة ودورة التفعيل:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setChosenCycle('monthly')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  chosenCycle === 'monthly'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                شهر واحد (30 يوم فقط)
              </button>

              <button
                type="button"
                onClick={() => setChosenCycle('3months')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  chosenCycle === '3months'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                3 أشهر (90 يوم)
              </button>

              <button
                type="button"
                onClick={() => setChosenCycle('6months')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  chosenCycle === '6months'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                6 أشهر (180 يوم)
              </button>

              <button
                type="button"
                onClick={() => setChosenCycle('yearly')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  chosenCycle === 'yearly'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                سنة كاملة (365 يوم 🔥)
              </button>
            </div>

            {/* Smart Extension Checkbox */}
            {isCurrentActive && (
              <label className="mt-3 flex items-center gap-2 cursor-pointer bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200 text-xs font-semibold text-emerald-800">
                <input
                  type="checkbox"
                  checked={extendFromCurrentEnd}
                  onChange={(e) => setExtendFromCurrentEnd(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>
                  تمديد تراكمي: إضافة الـ 30 يوماً بعد تاريخ الانتهاء الحالي ({new Date(user.subscription_end_date).toLocaleDateString('ar-EG')}) بدلاً من البدء من اليوم (30 يوماً).
                </span>
              </label>
            )}
          </div>

          {/* Extra Features & Token Top-ups */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Zap size={14} className="text-amber-500" />
              <span>إجراءات إضافية وتوكنز استثنائية (اختياري):</span>
            </div>

            {user.extra_tokens > 0 && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-900">الرصيد الإضافي السابق المسجل: </span>
                    <span className="font-mono font-black text-amber-800">+{user.extra_tokens.toLocaleString()} توكن</span>
                    <p className="text-[10px] text-amber-700">إذا كنت تجدد اشتراكاً شهرياً مستقلاً ولا تريد ظهور باقة إضافية فوقها، اختر تصفيره.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setClearPreviousExtraTokens(!clearPreviousExtraTokens)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all shrink-0 cursor-pointer ${
                    clearPreviousExtraTokens
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-white border border-amber-300 text-amber-900 hover:bg-amber-100'
                  }`}
                >
                  {clearPreviousExtraTokens ? '✓ تم التحديد: سيتم تصفيره (0 توكن)' : 'تصفير الرصيد الإضافي السابق'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  إضافة رصيد توكنز إضافي فوري (Extra Tokens):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={extraTokensToAdd || ''}
                    placeholder="مثال: 50000 توكن"
                    onChange={(e) => setExtraTokensToAdd(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold font-mono outline-none focus:border-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={() => setExtraTokensToAdd(10000)}
                    className="px-2.5 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-xl text-[11px] font-bold shrink-0"
                  >
                    +10K
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtraTokensToAdd(50000)}
                    className="px-2.5 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-xl text-[11px] font-bold shrink-0"
                  >
                    +50K
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtraTokensToAdd(1000000)}
                    className="px-2.5 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl text-[11px] font-black shrink-0 border border-emerald-300 shadow-2xs"
                  >
                    +1M 👑
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtraTokensToAdd(2000000)}
                    className="px-2.5 py-2 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-xl text-[11px] font-black shrink-0 border border-purple-300 shadow-2xs"
                  >
                    +2M ✨
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtraTokensToAdd(5000000)}
                    className="px-2.5 py-2 bg-pink-100 hover:bg-pink-200 text-pink-800 rounded-xl text-[11px] font-black shrink-0 border border-pink-300 shadow-2xs"
                  >
                    +5M 🔥
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="block text-[11px] font-bold text-slate-700">
                  التعامل مع الاستهلاك والتوكنز المتبقية:
                </label>
                <div className="space-y-1.5">
                  <label className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    preserveRemainingTokens
                      ? 'border-emerald-500 bg-emerald-50/80 text-emerald-950 ring-2 ring-emerald-400/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="tokenHandlingMode"
                      checked={preserveRemainingTokens}
                      onChange={() => {
                        setPreserveRemainingTokens(true);
                        setResetTokensUsed(false);
                      }}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="font-bold flex items-center gap-1.5 text-xs text-emerald-900">
                        <ShieldCheck size={14} className="text-emerald-600" />
                        <span>الحفاظ على التوكنز المتبقية للمعلم ({getUserTokenStats(user).remaining.toLocaleString()} توكن) 🛡️</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        نقل الرصيد المتبقي كما هو بدون أي نقصان لحساب المعلم الجديد.
                      </p>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    !preserveRemainingTokens && resetTokensUsed
                      ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 ring-2 ring-indigo-400/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="tokenHandlingMode"
                      checked={!preserveRemainingTokens && resetTokensUsed}
                      onChange={() => {
                        setPreserveRemainingTokens(false);
                        setResetTokensUsed(true);
                      }}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold flex items-center gap-1.5 text-xs text-indigo-950">
                        <RotateCcw size={14} className="text-indigo-600" />
                        <span>تصفير الاستهلاك والبدء برصيد كامل جديد (100% رصيد أخضر جديد) 🔄</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        بدء دورة اشتراكية جديدة برصيد كامل غير مستهلك.
                      </p>
                    </div>
                  </label>

                  {/* Advanced Token Control Overrides */}
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <details className="group bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                      <summary className="px-3.5 py-2.5 text-xs font-bold text-slate-700 cursor-pointer flex items-center justify-between hover:bg-slate-100/80 transition-colors select-none">
                        <span className="flex items-center gap-1.5 text-slate-800">
                          <Sliders size={14} className="text-indigo-600" />
                          <span>التحكم المتقدم وتعديل الاستهلاك يدوياً (خيارات إدارية) ⚙️</span>
                        </span>
                        <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <div className="p-4 border-t border-slate-200 bg-white space-y-3.5">
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          استخدم هذه الحقول لتعديل رصيد استهلاك المعلم الحالي أو التراكمي مباشرة لتصحيح أي خطأ في العرض. اترك الحقول فارغة إذا كنت لا تريد تعديلها.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-slate-700 text-right">تعديل الاستهلاك الحالي للدورة (توكن):</label>
                            <input
                              type="number"
                              placeholder={`الحالي: ${Number(user.tokens_used || 0).toLocaleString()}`}
                              value={overrideTokensUsed}
                              onChange={(e) => setOverrideTokensUsed(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none text-right"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-slate-700 text-right">تعديل إجمالي الاستهلاك التراكمي (توكن):</label>
                            <input
                              type="number"
                              placeholder={`الحالي: ${Number(user.tokens_used_total || 0).toLocaleString()}`}
                              value={overrideTokensTotal}
                              onChange={(e) => setOverrideTokensTotal(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none text-right"
                            />
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer"
          >
            إلغاء
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md hover:shadow-indigo-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 size={18} />
            <span>{isSubmitting ? 'جارٍ التفعيل...' : 'تأكيد وحفظ تفعيل الباقة'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

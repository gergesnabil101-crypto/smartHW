import React, { useState } from 'react';
import { 
  Crown, 
  X, 
  CheckCircle2, 
  Clock, 
  Zap, 
  ShieldCheck, 
  Sparkles, 
  ArrowLeft, 
  BookOpen, 
  User, 
  Calendar, 
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { getUserTokenStats } from '../../utils/tokenStats';
import { getProEquivalentPlan } from '../../constants';
import { formatPlanLabel } from '../../App';

interface TeacherProUpgradeModalProps {
  user: any | null;
  onClose: () => void;
  onConfirm: (params: {
    targetUser: any;
    proPlanId: string;
    extendMonth: boolean;
    extraTokens: number;
  }) => Promise<void>;
  isLoading?: boolean;
}

export const TeacherProUpgradeModal: React.FC<TeacherProUpgradeModalProps> = ({
  user,
  onClose,
  onConfirm,
  isLoading = false
}) => {
  if (!user) return null;

  const stats = getUserTokenStats(user);
  const remainingTokens = Math.max(0, stats.remaining || 0);
  const isAlreadyPro = user.preferred_ai_model === 'gemini_pro' || user.preferred_ai_model === 'pro' || String(user.subscription_type || '').includes('pro');

  const proEquiv = getProEquivalentPlan(
    user.subscription_type,
    user.custom_plan_name,
    user.custom_tokens_millions
  );

  const [chosenPlanId, setChosenPlanId] = useState<string>(proEquiv.proPlanId);
  const [extendOption, setExtendOption] = useState<'keep_current' | 'extend_month'>('keep_current');
  const [bonusTokens, setBonusTokens] = useState<number>(0);

  const currentEndDate = user.subscription_end_date ? new Date(user.subscription_end_date) : null;
  const isCurrentActive = currentEndDate && currentEndDate > new Date() && user.subscription_status === 'active';

  const handleConfirm = async () => {
    await onConfirm({
      targetUser: user,
      proPlanId: chosenPlanId,
      extendMonth: extendOption === 'extend_month',
      extraTokens: bonusTokens
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[130] flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl text-right overflow-hidden border border-purple-200/80 flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-indigo-800 text-white p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-2xl -translate-x-12 -translate-y-12 pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-950 rounded-2xl shadow-lg shadow-amber-500/30">
                <Crown size={26} className="text-amber-950 fill-amber-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-black tracking-tight">
                    ترقية المعلم لنظام برو (Gemini Pro)
                  </h3>
                  <span className="bg-amber-400/90 text-amber-950 font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-xs">
                    بنفس الباقة 👑
                  </span>
                </div>
                <p className="text-xs text-purple-200 mt-1">
                  الترقية للنظام الأكاديمي والاستدلال العلمي الدقيق مع نقل التوكنز المتبقية للمعلم كما هي دون تصفير.
                </p>
              </div>
            </div>
            <button 
              type="button"
              onClick={onClose}
              className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* Teacher Profile Overview */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-black text-sm shrink-0 border border-purple-200">
                {user.avatar_data ? (
                  <img src={user.avatar_data} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  (user.name || 'م').charAt(0)
                )}
              </div>
              <div>
                <div className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span>{user.name || 'بدون اسم'}</span>
                  {user.subject && (
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                      {user.subject}
                    </span>
                  )}
                  {isAlreadyPro && (
                    <span className="text-[10px] font-black text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full">
                      مفعل برو بالفعل
                    </span>
                  )}
                </div>
                <div className="text-slate-500 font-mono text-[11px] mt-0.5" dir="ltr">{user.email}</div>
              </div>
            </div>

            <div className="text-right sm:text-left text-[11px]">
              <div className="text-slate-500">حالة الاشتراك الحالي:</div>
              <div className="font-bold text-slate-800">
                {isCurrentActive ? (
                  <span className="text-emerald-700 flex items-center gap-1 font-bold">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    نشط حتى {currentEndDate.toLocaleDateString('ar-EG')}
                  </span>
                ) : (
                  <span className="text-amber-700 flex items-center gap-1 font-bold">
                    <Clock size={13} className="text-amber-600" />
                    منتهي أو غير مفعل
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Golden Remaining Tokens Guarantee Banner */}
          <div className="bg-gradient-to-r from-emerald-500 via-teal-600 to-indigo-600 text-white p-4 rounded-2xl shadow-md space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm sm:text-base">
                <ShieldCheck size={20} className="text-amber-300" />
                <span>الرصيد المتبقي المحفوظ بالكامل للمعلم</span>
              </div>
              <span className="bg-white/20 backdrop-blur-xs font-mono font-black text-xs px-2.5 py-1 rounded-lg">
                100% مضمون
              </span>
            </div>

            <div className="flex items-center justify-between bg-black/15 p-3 rounded-xl border border-white/20">
              <div>
                <div className="text-emerald-100 text-[11px]">الرصيد المتبقي الحالي في الحساب:</div>
                <div className="text-2xl font-black font-mono tracking-tight text-white mt-0.5">
                  {remainingTokens.toLocaleString()} <span className="text-xs font-normal text-emerald-200">توكن</span>
                </div>
              </div>
              <div className="text-left font-mono text-[11px] text-emerald-100">
                <div>من إجمالي: {stats.totalLimit.toLocaleString()}</div>
                <div>المستهلك سابقاً: {stats.used.toLocaleString()}</div>
              </div>
            </div>

            <div className="text-[11px] text-emerald-100 leading-relaxed flex items-start gap-1.5 pt-1">
              <Sparkles size={14} className="text-amber-300 shrink-0 mt-0.5" />
              <span>
                <strong>ضمان الترقية:</strong> سيتم تحويل المعلم فوراً لنظام <strong>Gemini Pro</strong> مع نقل الرصيد المتبقي ({remainingTokens.toLocaleString()} توكن) كما هو دون تصفير أو هدر، وسيظهر بالكامل في رصيد المعلم الأخضر.
              </span>
            </div>
          </div>

          {/* Plan Comparison Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Current Plan */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="text-slate-500 font-bold flex items-center justify-between">
                <span>الباقة الحالية للمعلم:</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-700 font-bold">الحالية</span>
              </div>
              <div className="font-black text-slate-900 text-sm">
                {user.custom_plan_name || formatPlanLabel(user.subscription_type, user.billing_cycle)}
              </div>
              <div className="text-slate-600 text-[11px]">
                المحرك السابق: {user.preferred_ai_model === 'gemini_pro' ? 'Gemini Pro' : 'Gemini 3.8 Flash (الافتراضي)'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                سعة الباقة: {stats.limit.toLocaleString()} توكن
              </div>
            </div>

            {/* Upgraded Pro Plan */}
            <div className="p-3.5 bg-purple-50/70 rounded-2xl border-2 border-purple-300 space-y-2 relative overflow-hidden">
              <div className="text-purple-700 font-black flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Crown size={14} className="text-amber-500 fill-amber-500" />
                  <span>الباقة بعد الترقية لـ Pro:</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-600 text-white font-black shadow-2xs">
                  نظام برو المطور
                </span>
              </div>
              <div className="font-black text-purple-950 text-sm">
                {proEquiv.name}
              </div>
              <div className="text-purple-800 text-[11px] font-bold">
                المحرك الجديد: Gemini Pro (استدلال أكاديمي وتفكير عميق وتصحيح خطوات)
              </div>
              <div className="text-[10px] text-purple-700 font-mono">
                سعة الباقة: {(proEquiv.tokensInMillions * 1000000).toLocaleString()} توكن (مع حفظ المتبقي)
              </div>
            </div>
          </div>

          {/* Subscription Validity Period Option */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
            <label className="block text-xs font-black text-slate-800">
              مدة وصلاحية الاشتراك بعد الترقية:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label 
                className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                  extendOption === 'keep_current'
                    ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-100/50'
                }`}
              >
                <input 
                  type="radio" 
                  name="extendOption"
                  checked={extendOption === 'keep_current'}
                  onChange={() => setExtendOption('keep_current')}
                  className="mt-0.5 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="font-bold text-slate-900">
                    الاحتفاظ بتاريخ الانتهاء الحالي
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {isCurrentActive 
                      ? `يبقى سارياً حتى ${currentEndDate.toLocaleDateString('ar-EG')} (ترقية النظام فقط)`
                      : 'سيبدأ تفعيلاً لمدة 30 يوماً من اليوم (حساب غير نشط سابقاً)'}
                  </div>
                </div>
              </label>

              <label 
                className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                  extendOption === 'extend_month'
                    ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-100/50'
                }`}
              >
                <input 
                  type="radio" 
                  name="extendOption"
                  checked={extendOption === 'extend_month'}
                  onChange={() => setExtendOption('extend_month')}
                  className="mt-0.5 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="font-bold text-slate-900">
                    تمديد شهر إضافي كامل (+30 يوماً)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {isCurrentActive 
                      ? `تمديد تراكمي: يضاف شهر كامل بعد تاريخ الانتهاء الحالي`
                      : 'تفعيل كامل لمدة 30 يوماً جديدة تبدأ من اليوم'}
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Optional Bonus Tokens */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 flex items-center gap-1">
                <Zap size={13} className="text-amber-500" />
                منح توكنز إضافية كهدية مع الترقية (اختياري):
              </span>
              {bonusTokens > 0 && (
                <span className="font-mono font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md text-[11px]">
                  +{bonusTokens.toLocaleString()} توكن هدية
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[0, 10000, 25000, 50000, 100000, 500000].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setBonusTokens(amt)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                    bonusTokens === amt
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {amt === 0 ? 'بدون إضافي (0)' : `+${(amt / 1000)}K`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            <span>الرصيد النهائي المتاح للمعلم بعد الترقية: </span>
            <strong className="text-emerald-700 font-mono font-black text-sm">
              {(remainingTokens + bonusTokens).toLocaleString()} توكن (Gemini Pro)
            </strong>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl font-bold border border-slate-200 transition-colors w-full sm:w-auto cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-700 via-indigo-600 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white rounded-xl font-black shadow-md hover:shadow-purple-500/25 transition-all flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer disabled:opacity-50"
            >
              <Crown size={16} className="text-amber-300 fill-amber-300" />
              <span>
                {isLoading 
                  ? 'جارٍ الترقية...' 
                  : `تأكيد الترقية لـ Pro ونقل المتبقي (${remainingTokens.toLocaleString()} توكن) 👑`
                }
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

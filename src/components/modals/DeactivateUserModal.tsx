import React from 'react';
import { UserX, ShieldCheck, CheckCircle2, AlertCircle, Sparkles, Database } from 'lucide-react';
import { formatPlanLabel } from '../../App';

interface DeactivateUserModalProps {
  user: any | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}

export const DeactivateUserModal: React.FC<DeactivateUserModalProps> = ({
  user,
  onClose,
  onConfirm,
  isLoading = false
}) => {
  if (!user) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full text-right shadow-2xl border border-amber-100 animate-in zoom-in-95 duration-200 my-auto"
        
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3.5 mb-5">
          <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl shrink-0 border border-amber-200 shadow-xs">
            <UserX size={26} />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
              إلغاء تفعيل حساب المشترك
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              إيقاف صلاحيات الاشتراك النشط دون حذف أي بيانات
            </p>
          </div>
        </div>

        {/* User Info Preview */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-4 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">المعلم / المشترك:</span>
            <span className="font-black text-slate-900 text-sm">{user.name || 'بدون اسم'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">البريد الإلكتروني:</span>
            <span className="font-mono text-slate-700" dir="ltr">{user.email}</span>
          </div>
          {user.subject && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">المادة:</span>
              <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">{user.subject}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-slate-500">الباقة الحالية:</span>
            <span className="font-bold text-amber-800">
              {user.custom_plan_name || formatPlanLabel(user.subscription_type, user.billing_cycle)}
            </span>
          </div>
        </div>

        {/* Guarantee Banner */}
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 p-4 rounded-2xl border border-emerald-200 mb-5 space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-900 font-black text-xs">
            <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
            <span>ضمان الحفاظ الكامل على كافة البيانات (بدون أي حذف):</span>
          </div>
          <ul className="text-xs text-slate-700 space-y-1.5 pr-2">
            <li className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <span>لن يتم حذف حساب المعلم أو بريده أو كلمة مروره.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <span>جميع الاختبارات والأسئلة ونماذج الإجابة ستبقى محفوظة بالكامل.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <span>بيانات الطلاب ودرجاتهم وإجاباتهم مصانة 100% في قاعدة البيانات.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <span>يمكنك إعادة تفعيل الحساب في أي وقت بنقرة واحدة عبر زر "تفعيل باقة".</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors font-bold text-xs sm:text-sm cursor-pointer"
          >
            تراجع / إبقاء الحساب
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl transition-all shadow-md shadow-amber-600/20 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <UserX size={16} />
            <span>{isLoading ? 'جارٍ الإلغاء...' : 'تأكيد إلغاء التفعيل'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

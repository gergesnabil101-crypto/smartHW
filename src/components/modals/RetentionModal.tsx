import React from 'react';
import { ShieldCheck, ShieldAlert, Trash2, RefreshCw, Loader2, X, FileText, CheckCircle2 } from 'lucide-react';
import { Quiz } from '../../types';

interface RetentionModalProps {
  isOpen: boolean;
  onClose: () => void;
  quiz?: Quiz | null;
  retentionDays: number;
  setRetentionDays: (days: number) => void;
  isProcessingRetention: boolean;
  retentionSuccessMessage: string;
  onAnonymizeQuiz: (quizId: string) => void;
  onPurgeQuiz: (quizId: string) => void;
  onRetentionCleanup: () => void;
  onOpenPrivacyPolicy: () => void;
}

export const RetentionModal: React.FC<RetentionModalProps> = ({
  isOpen,
  onClose,
  quiz,
  retentionDays,
  setRetentionDays,
  isProcessingRetention,
  retentionSuccessMessage,
  onAnonymizeQuiz,
  onPurgeQuiz,
  onRetentionCleanup,
  onOpenPrivacyPolicy,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200" 
         
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <ShieldCheck size={22} />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-800">إدارة الاحتفاظ بالبيانات والخصوصية</h3>
          </div>
          <button 
            onClick={onClose} 
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
                  onClick={() => onAnonymizeQuiz(quiz.id)}
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
                  onClick={() => onPurgeQuiz(quiz.id)}
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
                onClick={onRetentionCleanup}
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
              onClose();
              onOpenPrivacyPolicy();
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline"
          >
            قراءة نص السياسة الكاملة
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Loader2, FileText, Users } from 'lucide-react';
import { Quiz } from '../../types';

interface DeleteQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  quiz: Quiz | null;
  onConfirmDelete: (quizId: string) => Promise<void> | void;
}

export const DeleteQuizModal: React.FC<DeleteQuizModalProps> = ({
  isOpen,
  onClose,
  quiz,
  onConfirmDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !quiz) return null;

  const handleConfirm = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onConfirmDelete(quiz.id);
      onClose();
    } catch (err) {
      console.error("Failed to delete quiz:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Determine question count
  let questionCount = 0;
  try {
    if (Array.isArray(quiz.questions)) {
      questionCount = quiz.questions.length;
    } else if (typeof quiz.data === 'string') {
      const parsed = JSON.parse(quiz.data);
      questionCount = Array.isArray(parsed?.questions) ? parsed.questions.length : 0;
    }
  } catch {
    questionCount = 0;
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={() => !isDeleting && onClose()}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200 border border-rose-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning Icon & Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold shrink-0 border border-rose-200 shadow-sm">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">حذف الاختبار بالكامل</h3>
              <p className="text-xs text-rose-600 font-semibold">إجراء نهائي لا يمكن التراجع عنه</p>
            </div>
          </div>
          <button
            disabled={isDeleting}
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-xl transition-colors disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quiz Info Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={16} className="text-indigo-600 shrink-0" />
            <span className="font-bold text-slate-800 text-sm truncate">
              {quiz.title || 'اختبار بدون عنوان'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>عدد الأسئلة: <strong className="text-slate-700">{questionCount}</strong></span>
            {quiz.created_at && (
              <span>تاريخ الإنشاء: <strong className="text-slate-700">{new Date(quiz.created_at).toLocaleDateString('ar-EG')}</strong></span>
            )}
          </div>
        </div>

        {/* Description Warning */}
        <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-3.5 mb-5 text-xs text-rose-800 leading-relaxed space-y-1.5">
          <p className="font-bold">⚠️ تنبيه هام:</p>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-700">
            <li>سيتم حذف هذا الاختبار نهائياً مع كافة أسئلته وإعداداته.</li>
            <li>سيتم مسح جميع سجلات ودرجات وحلول الطلاب الخاصة بهذا الاختبار.</li>
            <li>لن يكون رابط الاختبار متاحاً للطلاب بعد الحذف.</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            إلغاء وتراجع
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleConfirm}
            className="flex-1 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white py-3 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>جاري الحذف...</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>نعم، احذف الاختبار</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

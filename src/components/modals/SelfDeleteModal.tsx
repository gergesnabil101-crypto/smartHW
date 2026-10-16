import React from 'react';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';

interface SelfDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

export const SelfDeleteModal: React.FC<SelfDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
}) => {
  if (!isOpen) return null;

  return (
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
            disabled={isDeleting}
            onClick={onClose}
            className="flex-1 py-3 px-4 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors font-bold text-sm"
          >
            تراجع
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:bg-red-300"
          >
            {isDeleting ? (
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
  );
};

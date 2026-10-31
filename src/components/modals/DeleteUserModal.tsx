import React from 'react';
import { Trash2 } from 'lucide-react';

interface DeleteUserModalProps {
  userToDelete: { id: string; name?: string } | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteUserModal: React.FC<DeleteUserModalProps> = ({
  userToDelete,
  onClose,
  onConfirm,
}) => {
  if (!userToDelete) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full text-right" >
        <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Trash2 className="text-red-500" size={24} />
          تأكيد حذف المستخدم والبيانات التابعة
        </h3>
        <p className="text-slate-600 mb-6 leading-relaxed text-sm">
          هل أنت متأكد من حذف حساب <span className="font-bold text-slate-800">"{userToDelete.name || 'المستخدم'}"</span> نهائياً؟ 
          <br />
          <span className="text-red-600 text-xs font-bold mt-2 block bg-red-50 p-2.5 rounded-xl border border-red-100">
            ⚠️ سيتم تنفيذ حذف متكامل يشمل حساب Firebase Auth ومستند المستخدم وكافة اختباراته ونتائجه ومجلداته نهائياً.
          </span>
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors font-bold text-sm"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-bold text-sm"
          >
            تأكيد الحذف المتكامل
          </button>
        </div>
      </div>
    </div>
  );
};

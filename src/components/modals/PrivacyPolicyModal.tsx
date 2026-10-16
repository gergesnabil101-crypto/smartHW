import React from 'react';
import { ShieldCheck, Shield, X } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200" 
         
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <ShieldCheck size={22} />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-800">سياسة الخصوصية وحماية بيانات الطلاب</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            title="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto text-slate-700 text-sm leading-relaxed">
          <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100 flex items-start gap-3">
            <Shield className="text-indigo-600 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-bold text-indigo-900 mb-1">التزام الأمان والخصوصية (Zero Leakage)</h4>
              <p className="text-xs text-indigo-800 leading-relaxed">
                نحن نلتزم بأعلى معايير حماية البيانات وسرية معلومات الطلاب والمعلمين، ونضمن عدم مشاركة أو بيع أي بيانات لأي طرف ثالث تحت أي ظرف.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
              <h5 className="font-bold text-slate-800 text-sm mb-1.5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">1</span>
                الغرض من جمع البيانات
              </h5>
              <p className="text-xs text-slate-600 leading-relaxed">
                تُجمع أسماء الطلاب وأرقام هواتف أولياء الأمور حصرياً لتمكين المعلم من رصد الدرجات، التحقق من عدد المحاولات، وإرسال تقارير الأداء المباشرة لولي الأمر عبر واتساب.
              </p>
            </div>

            <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
              <h5 className="font-bold text-slate-800 text-sm mb-1.5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">2</span>
                مدة الاحتفاظ بالبيانات (Retention Period)
              </h5>
              <p className="text-xs text-slate-600 leading-relaxed">
                تحتفظ المنصة بالنتائج وسجلات الدرجات خلال الفصل أو العام الدراسي، ويستطيع المعلم في أي وقت تنقيح وحذف النتائج يدوياً أو تفعيل الحذف التلقائي للنتائج بعد 30، 60، أو 90 يوماً.
              </p>
            </div>

            <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
              <h5 className="font-bold text-slate-800 text-sm mb-1.5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">3</span>
                حق الحذف وتجهيل الهوية (Right to Erasure)
              </h5>
              <p className="text-xs text-slate-600 leading-relaxed">
                يمتلك المعلم الأدوات الكاملة لمسح أرقام هواتف الطلاب فور انتهاء الاختبار، أو تجهيل هوية الطلاب مع الاحتفاظ بالإحصائيات العامة، أو حذف جميع السجلات بضغطة زر واحدة.
              </p>
            </div>

            <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
              <h5 className="font-bold text-slate-800 text-sm mb-1.5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">4</span>
                أمان السجلات ونماذج الإجابة
              </h5>
              <p className="text-xs text-slate-600 leading-relaxed">
                لا يتم إرسال نماذج الإجابات أو الإجابات الصحيحة إلى هواتف الطلاب أثناء الامتحان، ويتم التصحيح والتحقق من الهوية على خوادم آمنة مع تشفير كافة الاتصالات ببروتوكولات TLS القياسية.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors"
          >
            فهمت ذلك
          </button>
        </div>
      </div>
    </div>
  );
};

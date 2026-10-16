import React from 'react';
import { MessageCircle, X } from 'lucide-react';

interface BatchSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  sendingQueue: any[];
  currentSendIndex: number;
  onSendNext: () => void;
  onSkip: () => void;
}

export const BatchSendModal: React.FC<BatchSendModalProps> = ({
  isOpen,
  onClose,
  sendingQueue,
  currentSendIndex,
  onSendNext,
  onSkip,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" 
        
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
          <h3 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
            <MessageCircle className="text-emerald-500" size={22} />
            إرسال النتائج عبر واتساب
          </h3>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {currentSendIndex < sendingQueue.length ? (
            <div className="text-center space-y-5">
              <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                <span>طالب {currentSendIndex + 1} من {sendingQueue.length}</span>
                <span>{Math.round((currentSendIndex / sendingQueue.length) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300" 
                  style={{ width: `${(currentSendIndex / sendingQueue.length) * 100}%` }}
                />
              </div>
              
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-right">
                <p className="text-xs text-slate-400 mb-1">الطالب الحالي في قائمة الإرسال:</p>
                <p className="text-lg font-black text-slate-800">{sendingQueue[currentSendIndex].student_name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  رقم ولي الأمر: <span className="font-bold text-slate-700">{sendingQueue[currentSendIndex].parent_phone || 'غير مسجل'}</span>
                </p>
                <p className="text-emerald-600 font-bold mt-2 text-sm">
                  الدرجة: {sendingQueue[currentSendIndex].score} من {sendingQueue[currentSendIndex].total}
                </p>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed text-right">
                سيتم فتح نافذة واتساب جديدة مع رسالة تقرير مفصلة. اضغط "إرسال" هناك ثم عُد إلى هذه النافذة للطالب التالي.
              </p>

              <button
                onClick={onSendNext}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
              >
                <MessageCircle size={18} />
                فتح واتساب وإرسال التقرير
              </button>
              
              <button
                onClick={onSkip}
                className="w-full text-slate-400 hover:text-slate-600 py-2 text-xs font-bold transition-colors"
              >
                تخطي هذا الطالب والانتقال للتالي
              </button>
            </div>
          ) : (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <MessageCircle size={28} />
              </div>
              <h4 className="text-lg font-bold text-slate-800">اكتمل إرسال جميع الرسائل!</h4>
              <p className="text-xs text-slate-500">تم المرور على جميع الطلاب في قائمة الإرسال بنجاح.</p>
              <button
                onClick={onClose}
                className="w-full bg-slate-900 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-black transition-colors"
              >
                إغلاق
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

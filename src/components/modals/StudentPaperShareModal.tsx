import React, { useState } from 'react';
import { 
  X, MessageCircle, Image as ImageIcon, Download, 
  Send, User, Phone, CheckCircle2, Award, Sparkles, Loader2, FileCheck2
} from 'lucide-react';
import { 
  formatWhatsAppPhone, 
  buildStudentWhatsAppMessage, 
  buildParentResultOnlyWhatsAppMessage,
  downloadStudentPaperImage 
} from '../../utils/studentPaperExport';

interface StudentPaperShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: any;
  quiz: any;
  teacherInfo?: any;
  onMarkSent?: (resultId: string) => void;
}

export const StudentPaperShareModal: React.FC<StudentPaperShareModalProps> = ({
  isOpen,
  onClose,
  result,
  quiz,
  teacherInfo,
  onMarkSent
}) => {
  if (!isOpen || !result) return null;

  const defaultStudentPhone = result.student_phone || result.phone || '';
  const defaultParentPhone = result.parent_phone || '';

  const [target, setTarget] = useState<'student' | 'parent'>(defaultParentPhone ? 'parent' : 'student');
  const [phoneNumber, setPhoneNumber] = useState<string>(
    (defaultParentPhone ? defaultParentPhone : defaultStudentPhone) || ''
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [downloadProgressText, setDownloadProgressText] = useState<string>('');

  const studentName = (result.student_name || 'طالب').trim();
  const quizTitle = (quiz?.title || result.quiz_title || 'الاختبار').trim();
  const score = result.score ?? 0;
  const total = result.total ?? (quiz?.questions?.length || 0);
  const pct = Math.round((score / (total || 1)) * 100);

  const handleTargetChange = (newTarget: 'student' | 'parent') => {
    setTarget(newTarget);
    if (newTarget === 'student') {
      setPhoneNumber(defaultStudentPhone || phoneNumber);
    } else {
      setPhoneNumber(defaultParentPhone || phoneNumber);
    }
  };

  // Send RESULT ONLY via WhatsApp (no detailed answers)
  const handleSendResultOnlyWhatsApp = async () => {
    if (!phoneNumber.trim()) {
      alert(target === 'student' ? 'يرجى إدخال أو التأكد من رقم هاتف الطالب.' : 'يرجى إدخال رقم هاتف ولي الأمر.');
      return;
    }

    const formattedPhone = formatWhatsAppPhone(phoneNumber);
    if (!formattedPhone) {
      alert('رقم الهاتف المدخل غير صالح للاستخدام في واتساب.');
      return;
    }

    if (onMarkSent && result.id) {
      onMarkSent(result.id);
    }

    const message = target === 'parent'
      ? buildParentResultOnlyWhatsAppMessage(result, quiz, teacherInfo)
      : buildStudentWhatsAppMessage(
          { ...result, student_phone: phoneNumber },
          quiz,
          teacherInfo,
          'student',
          false
        );

    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    onClose();
  };

  // Send EXAM IMAGE via WhatsApp (with student/parent greeting)
  const handleSendImageWhatsApp = async () => {
    if (!phoneNumber.trim()) {
      alert(target === 'student' ? 'يرجى إدخال أو التأكد من رقم هاتف الطالب.' : 'يرجى إدخال رقم هاتف ولي الأمر.');
      return;
    }

    const formattedPhone = formatWhatsAppPhone(phoneNumber);
    if (!formattedPhone) {
      alert('رقم الهاتف المدخل غير صالح للاستخدام في واتساب.');
      return;
    }

    setIsProcessing(true);
    setDownloadProgressText('جاري تجهيز وتحميل صورة ورقة الاختبار...');

    try {
      // 1. Generate & download the student sheet image
      await downloadStudentPaperImage(result, quiz, teacherInfo);

      // 2. Mark sent in system
      if (onMarkSent && result.id) {
        onMarkSent(result.id);
      }

      // 3. Open WhatsApp chat with accompanying message
      const message = buildStudentWhatsAppMessage(
        { ...result, student_phone: target === 'student' ? phoneNumber : result.student_phone, parent_phone: target === 'parent' ? phoneNumber : result.parent_phone },
        quiz,
        teacherInfo,
        target,
        true
      );

      const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
      onClose();
    } catch (err) {
      console.error('Failed to prepare paper image export:', err);
      alert('حدث خطأ أثناء إنشاء صورة ورقة الاختبار، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsProcessing(false);
      setDownloadProgressText('');
    }
  };

  const handleDirectDownloadImage = async () => {
    setIsProcessing(true);
    setDownloadProgressText('جاري إنشاء وتحميل صورة ورقة الاختبار (PNG)...');
    try {
      await downloadStudentPaperImage(result, quiz, teacherInfo);
    } catch (err) {
      console.error('Download error:', err);
      alert('حدث خطأ أثناء تحميل الصورة، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsProcessing(false);
      setDownloadProgressText('');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center font-bold text-white shadow-inner">
              <MessageCircle size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                إرسال نتيجة الطالب عبر واتساب
              </h3>
              <p className="text-xs text-emerald-100">
                خيارات إرسال النتيجة أو إرفاق صورة الاختبار للطالب وولي الأمر
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Student Info Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-slate-800 text-sm">{studentName}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {quizTitle} • {result.center_name || 'بدون سنتر'}
              </div>
            </div>
            <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-center shrink-0">
              <div className="text-[10px] text-slate-400 font-bold">الدرجة</div>
              <div className={`text-base font-black ${
                pct >= 75 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-rose-600'
              }`}>
                {score} / {total}
              </div>
            </div>
          </div>

          {/* Target Tabs */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">
              جهة الإرسال عبر واتساب:
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleTargetChange('parent')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  target === 'parent'
                    ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Phone size={14} className={target === 'parent' ? 'text-indigo-600' : 'text-slate-400'} />
                <span>ولي الأمر</span>
              </button>

              <button
                type="button"
                onClick={() => handleTargetChange('student')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  target === 'student'
                    ? 'bg-white text-emerald-700 shadow-xs border border-emerald-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User size={14} className={target === 'student' ? 'text-emerald-600' : 'text-slate-400'} />
                <span>الطالب نفسه</span>
              </button>
            </div>
          </div>

          {/* Phone Number Input */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">
              رقم هاتف الواتساب ({target === 'parent' ? 'ولي الأمر' : 'الطالب'}):
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="مثال: 01012345678 أو 201012345678"
                dir="ltr"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
              <Phone size={16} className="absolute left-3.5 top-3 text-slate-400" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              سيتم تهيئة الرقم تلقائياً لصيغة واتساب الدولية المعتمدة.
            </p>
          </div>

          {/* Action Options */}
          <div className="pt-2 space-y-2.5">
            {target === 'parent' ? (
              <>
                {/* 1. Parent Result Only Option (Recommended) */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleSendResultOnlyWhatsApp}
                  className="w-full p-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl flex items-center justify-between text-right transition-all shadow-md hover:shadow-lg cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <FileCheck2 size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-bold flex items-center gap-1.5">
                        <span>إرسال النتيجة فقط لولي الأمر</span>
                        <span className="bg-indigo-500/80 text-[10px] px-2 py-0.5 rounded-full font-bold">الأساسي</span>
                      </div>
                      <p className="text-[11px] text-indigo-100 mt-0.5">
                        إرسال الدرجة، النسبة، والتقدير العام فقط دون الإجابات والحلول التفصيلية
                      </p>
                    </div>
                  </div>
                  <Send size={18} className="shrink-0" />
                </button>

                {/* 2. Parent Exam Image Option */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleSendImageWhatsApp}
                  className="w-full p-3.5 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl flex items-center justify-between text-right transition-all shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <ImageIcon size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-bold flex items-center gap-1.5 text-emerald-900">
                        <span>إرسال صورة الاختبار لواتساب ولي الأمر</span>
                      </div>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        تحميل صورة ورقة الاختبار وفتح واتساب لإرفاقها لولي الأمر للمتابعة
                      </p>
                    </div>
                  </div>
                  <MessageCircle size={18} className="text-emerald-600 shrink-0" />
                </button>
              </>
            ) : (
              <>
                {/* 1. Student Exam Image Option (Recommended for Student Review) */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleSendImageWhatsApp}
                  className="w-full p-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl flex items-center justify-between text-right transition-all shadow-md hover:shadow-lg cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <ImageIcon size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-bold flex items-center gap-1.5">
                        <span>إرسال صورة ورقة الإجابة لواتساب الطالب</span>
                      </div>
                      <p className="text-[11px] text-emerald-100 mt-0.5">
                        تحميل صورة ورقة الإجابة والحلول وفتح واتساب لمراجعتها
                      </p>
                    </div>
                  </div>
                  <Send size={18} className="shrink-0" />
                </button>

                {/* 2. Student Result Only Option */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleSendResultOnlyWhatsApp}
                  className="w-full p-3.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-2xl flex items-center justify-between text-right transition-all shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                      <Award size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-bold flex items-center gap-1.5">
                        <span>إرسال النتيجة فقط لواتساب الطالب</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        إرسال رسالة نصية بالدرجة والنسبة دون صورة ورقة الإجابة
                      </p>
                    </div>
                  </div>
                  <MessageCircle size={18} className="text-slate-400 shrink-0" />
                </button>
              </>
            )}

            {/* Direct Download Image button */}
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleDirectDownloadImage}
              className="w-full p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer"
            >
              <Download size={14} className="text-teal-600" />
              <span>تحميل صورة ورقة الاختبار (PNG) على هذا الجهاز</span>
            </button>
          </div>

          {/* Processing Status indicator */}
          {isProcessing && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-center gap-2 text-indigo-700 text-xs font-bold animate-pulse">
              <Loader2 size={16} className="animate-spin" />
              <span>{downloadProgressText || 'جاري تجهيز صورة الورقة...'}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

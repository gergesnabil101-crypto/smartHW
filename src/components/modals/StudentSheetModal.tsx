import React from 'react';
import { 
  FileText, CheckCircle2, XCircle, Award, RefreshCw, CheckCircle, 
  User, Sparkles, Settings, Check, X 
} from 'lucide-react';
import { MathText } from '../MathText';
import { 
  checkEssayExactOrEquivalent, 
  isEnglishContent, 
  extractQuestionFeedback, 
  extractQuestionStudentAnswer, 
  isQuestionAnswerCorrect,
  normalizeArabicText
} from '../../utils/essayEvaluator';

interface StudentSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentResult: any;
  quizData: any;
  isLoading: boolean;
  onUpdateGrade: (questionId: string, grade: number) => void;
  onOpenGradingModal: (result: any) => void;
}

export const StudentSheetModal: React.FC<StudentSheetModalProps> = ({
  isOpen,
  onClose,
  studentResult,
  quizData,
  isLoading,
  onUpdateGrade,
  onOpenGradingModal,
}) => {
  if (!isOpen || !studentResult) return null;

  let feedbackObj: Record<string, any> = {};
  try {
    feedbackObj = typeof studentResult.feedback === 'string'
      ? JSON.parse(studentResult.feedback || '{}')
      : (studentResult.feedback || {});
  } catch {
    feedbackObj = {};
  }

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" 
         
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <FileText size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-slate-800">
                  {studentResult.student_name}
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">
                  {studentResult.center_name || 'بدون مجموعة'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                ورقة الإجابة والتصحيح التفصيلي للاختبار
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-left bg-indigo-50/80 px-3.5 py-1.5 rounded-2xl border border-indigo-100">
              <span className="text-xs text-indigo-600 font-bold block">الدرجة الإجمالية</span>
              <span className="text-base sm:text-lg font-black text-indigo-900">
                {studentResult.score} <span className="text-xs font-bold text-indigo-400">/ {studentResult.total}</span>
              </span>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <RefreshCw size={28} className="animate-spin text-indigo-600" />
              <span className="text-sm font-bold">جاري تحميل تفاصيل ورقة الإجابة...</span>
            </div>
          ) : !quizData || !quizData.questions || quizData.questions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText size={40} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">لا توجد أسئلة مسجلة لهذا الاختبار.</p>
            </div>
          ) : (
            <>
              {quizData.questions.map((q: any, idx: number) => {
                const isMCQ = q.type === 'multiple-choice' || (!q.type && q.options && q.options.length > 0);
                const isEssay = q.type === 'essay';
                const isTrueFalse = q.type === 'true-false';
                const isEnglishQ = isEnglishContent(q.text, ...(q.options || []), q.modelAnswer);

                const qFeedback = extractQuestionFeedback(feedbackObj, q, idx);
                const studentAns = extractQuestionStudentAnswer(studentResult, feedbackObj, q, idx);

                const exactCheck = isEssay ? checkEssayExactOrEquivalent(studentAns, q.modelAnswer, q.points || 1, isEnglishQ, q.keywords) : { matched: false, score: 0, feedback: '', steps: [] };

                const isQuestionCorrect = isEssay 
                  ? ((qFeedback.score !== undefined ? Number(qFeedback.score) : exactCheck.score) >= (q.points || 1) * 0.75)
                  : isQuestionAnswerCorrect(q, studentAns);

                const pointsAwarded = isEssay
                  ? (qFeedback.score !== undefined ? Number(qFeedback.score) : (exactCheck.matched ? exactCheck.score : 0))
                  : (isQuestionCorrect ? (q.points || 1) : 0);

                return (
                  <div 
                    key={q.id || idx}
                    dir={isEnglishQ ? "ltr" : "rtl"}
                    className={`rounded-2xl p-4 sm:p-5 border transition-all ${
                      isEssay
                        ? 'bg-slate-50/70 border-slate-200'
                        : isQuestionCorrect 
                        ? 'bg-emerald-50/40 border-emerald-200' 
                        : 'bg-rose-50/40 border-rose-200'
                    } ${isEnglishQ ? 'text-left' : 'text-right'}`}
                  >
                    {/* Question Title & Points Header */}
                    <div className="flex justify-between items-start gap-4 mb-3 pb-3 border-b border-slate-200/70">
                      <div className="flex items-start gap-2.5 flex-1">
                        <span className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm shrink-0 shadow-sm">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                              isEssay 
                                ? 'bg-purple-100 text-purple-700' 
                                : isTrueFalse 
                                ? 'bg-amber-100 text-amber-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {isEssay 
                                ? (isEnglishQ ? 'Essay Question' : 'سؤال مقالي') 
                                : isTrueFalse 
                                ? (isEnglishQ ? 'True / False' : 'صح أم خطأ') 
                                : (isEnglishQ ? 'Multiple Choice' : 'اختيار من متعدد')}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-400">
                              ({q.points || 1} {isEnglishQ ? ((q.points || 1) === 1 ? 'pt' : 'pts') : ((q.points || 1) > 2 ? 'درجات' : 'درجة')})
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm sm:text-base leading-relaxed" dir={isEnglishQ ? "ltr" : "rtl"}>
                            <MathText text={q.text} />
                          </h4>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {isEssay ? (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 shadow-sm">
                            {pointsAwarded} / {q.points || 1} {isEnglishQ ? 'pts' : 'درجة'}
                          </span>
                        ) : isQuestionCorrect ? (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-sm">
                            <CheckCircle size={13} />
                            <span>{q.points || 1} / {q.points || 1} {isEnglishQ ? 'pts' : 'درجة'}</span>
                          </span>
                        ) : (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 shadow-sm">
                            <XCircle size={13} />
                            <span>0 / {q.points || 1} {isEnglishQ ? 'pts' : 'درجة'}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Multiple Choice Options Display */}
                    {isMCQ && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3" dir={isEnglishQ ? "ltr" : "rtl"}>
                        {q.options?.map((opt: string, optIdx: number) => {
                          const isSelectedByStudent = (
                            studentAns !== undefined && studentAns !== null &&
                            (Number(studentAns) === Number(optIdx) ||
                             normalizeArabicText(String(studentAns)) === normalizeArabicText(opt))
                          );
                          const isThisOptionCorrect = (
                            Number(q.correctOptionIndex) === Number(optIdx) ||
                            normalizeArabicText(String(q.correctAnswer || '')) === normalizeArabicText(opt)
                          );
                          const isOptEng = isEnglishContent(opt) || isEnglishQ;

                          let cardStyle = "bg-white border-slate-200 text-slate-700";
                          let badge = null;

                          if (isSelectedByStudent && isThisOptionCorrect) {
                            cardStyle = "bg-emerald-100/90 border-emerald-500 text-emerald-900 font-bold ring-2 ring-emerald-400/30";
                            badge = (
                              <span className="text-[11px] bg-emerald-600 text-white px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shrink-0">
                                <CheckCircle size={12} />
                                {isEnglishQ ? "Student's Correct Answer" : "إجابة الطالب الصحيحة"}
                              </span>
                            );
                          } else if (isSelectedByStudent && !isThisOptionCorrect) {
                            cardStyle = "bg-rose-100/90 border-rose-500 text-rose-900 font-bold ring-2 ring-rose-400/30";
                            badge = (
                              <span className="text-[11px] bg-rose-600 text-white px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shrink-0">
                                <XCircle size={12} />
                                {isEnglishQ ? "Student's Wrong Answer" : "إجابة الطالب الخاطئة"}
                              </span>
                            );
                          } else if (isThisOptionCorrect) {
                            cardStyle = "bg-emerald-50 border-emerald-400 text-emerald-800 font-semibold";
                            badge = (
                              <span className="text-[11px] bg-emerald-100 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shrink-0">
                                <CheckCircle size={12} />
                                {isEnglishQ ? "Model Correct Answer" : "الإجابة الصحيحة المعتمدة"}
                              </span>
                            );
                          }

                          return (
                            <div 
                              key={optIdx} 
                              dir={isOptEng ? "ltr" : "rtl"}
                              className={`p-3 rounded-xl border text-sm flex items-center justify-between gap-2 ${cardStyle} transition-all`}
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <span className="w-6 h-6 rounded-lg bg-white/80 border border-current/20 flex items-center justify-center text-xs font-bold shrink-0">
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <div className={isOptEng ? "text-left" : "text-right"} dir={isOptEng ? "ltr" : "rtl"}>
                                  <MathText text={opt} />
                                </div>
                              </div>
                              {badge}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* True/False Display */}
                    {isTrueFalse && (
                      <div className="grid grid-cols-2 gap-3 mt-3" dir={isEnglishQ ? "ltr" : "rtl"}>
                        {[
                          { label: isEnglishQ ? 'True' : 'صح', val: 0, textVal: isEnglishQ ? 'true' : 'صح' },
                          { label: isEnglishQ ? 'False' : 'خطأ', val: 1, textVal: isEnglishQ ? 'false' : 'خطأ' }
                        ].map((item) => {
                          const isSelectedByStudent = (
                            studentAns !== undefined && studentAns !== null &&
                            (Number(studentAns) === Number(item.val) ||
                             String(studentAns).trim().toLowerCase() === item.textVal ||
                             (item.val === 0 && (String(studentAns).trim() === '1' || String(studentAns).toLowerCase() === 't')) ||
                             (item.val === 1 && (String(studentAns).trim() === '0' || String(studentAns).toLowerCase() === 'f')))
                          );
                          const isThisOptionCorrect = (
                            Number(q.correctOptionIndex) === Number(item.val) ||
                            String(q.correctAnswer || '').trim().toLowerCase() === item.textVal
                          );

                          let cardStyle = "bg-white border-slate-200 text-slate-700";
                          let badge = null;

                          if (isSelectedByStudent && isThisOptionCorrect) {
                            cardStyle = "bg-emerald-100 border-emerald-500 text-emerald-900 font-bold ring-2 ring-emerald-400/30";
                            badge = <span className="text-[11px] bg-emerald-600 text-white px-2 py-0.5 rounded-md font-bold">{isEnglishQ ? "Student Correct ✓" : "إجابة الطالب الصحيحة ✓"}</span>;
                          } else if (isSelectedByStudent && !isThisOptionCorrect) {
                            cardStyle = "bg-rose-100 border-rose-500 text-rose-900 font-bold ring-2 ring-rose-400/30";
                            badge = <span className="text-[11px] bg-rose-600 text-white px-2 py-0.5 rounded-md font-bold">{isEnglishQ ? "Student Incorrect ✗" : "إجابة الطالب الخاطئة ✗"}</span>;
                          } else if (isThisOptionCorrect) {
                            cardStyle = "bg-emerald-50 border-emerald-400 text-emerald-800 font-semibold";
                            badge = <span className="text-[11px] bg-emerald-100 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded-md font-bold">{isEnglishQ ? "Correct Answer ✓" : "الإجابة الصحيحة ✓"}</span>;
                          }

                          return (
                            <div key={item.val} className={`p-3 rounded-xl border text-sm flex items-center justify-between gap-2 ${cardStyle}`}>
                              <span className="font-bold text-base">{item.label}</span>
                              {badge}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Essay Question Display */}
                    {isEssay && (() => {
                      const displayFeedback = (qFeedback.score !== undefined && qFeedback.feedback)
                        ? qFeedback.feedback
                        : (exactCheck.matched ? exactCheck.feedback : (qFeedback.feedback || ''));
                      const displaySteps = (qFeedback.score !== undefined && Array.isArray(qFeedback.steps) && qFeedback.steps.length > 0) 
                        ? qFeedback.steps 
                        : (exactCheck.matched && exactCheck.steps ? exactCheck.steps : (Array.isArray(qFeedback.steps) ? qFeedback.steps : []));

                      return (
                      <div className="space-y-3 mt-3">
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-bold text-slate-500 flex items-center gap-1">
                              <User size={13} className="text-indigo-600" />
                              {isEnglishQ ? "Student's Answer:" : "إجابة الطالب:"}
                            </p>
                            {exactCheck.matched && exactCheck.score >= (q.points || 1) && (
                              <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Sparkles size={12} className="text-emerald-600" />
                                {isEnglishQ ? "Exact Model Match" : "إجابة مطابقة للنموذج"}
                              </span>
                            )}
                          </div>
                          <div className="text-slate-800 text-sm whitespace-pre-wrap leading-relaxed font-medium" dir={isEnglishQ ? "ltr" : "rtl"}>
                            {studentAns ? (
                              <MathText text={studentAns} />
                            ) : (
                              isEnglishQ ? 'No answer written by student' : 'لم يكتب الطالب إجابة لهذا السؤال'
                            )}
                          </div>
                        </div>

                        <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200">
                          <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1">
                            <CheckCircle size={13} />
                            {isEnglishQ ? "Official Model Answer:" : "الإجابة النموذجية الصحيحة:"}
                          </p>
                          <div className="text-emerald-900 text-sm whitespace-pre-wrap leading-relaxed font-medium" dir={isEnglishQ ? "ltr" : "rtl"}>
                            <MathText text={qFeedback.correctExample || q.modelAnswer || (isEnglishQ ? 'Official benchmark model answer' : 'الإجابة النموذجية المعتمدة للاختبار')} />
                          </div>
                        </div>

                        {displayFeedback && (
                          <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                            <p className="text-xs font-bold text-indigo-700 mb-1 flex items-center gap-1">
                              <Sparkles size={13} />
                              {isEnglishQ ? "Examiner Feedback:" : "ملاحظات المصحح:"}
                            </p>
                            <p className="text-xs text-indigo-900 leading-relaxed" dir={isEnglishQ ? "ltr" : "rtl"}>
                              {displayFeedback}
                            </p>
                          </div>
                        )}

                        {/* Step-by-Step Mark Distribution Breakdown */}
                        {Array.isArray(displaySteps) && displaySteps.length > 0 && (
                          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                            <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                              <CheckCircle size={13} className="text-indigo-600" />
                              {isEnglishQ ? "Step-by-step Marks Breakdown:" : "توزيع الدرجات على خطوات وأجزاء الإجابة:"}
                            </p>
                            <div className="space-y-1.5">
                              {displaySteps.map((step: any, sIdx: number) => (
                                <div key={sIdx} className="flex items-center justify-between text-xs border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                                  <span className="text-slate-700 font-medium flex-1 text-right" dir="auto">
                                    <MathText text={step.description} />
                                  </span>
                                  <span className={`font-bold shrink-0 mr-3 px-2 py-0.5 rounded text-[11px] ${step.earned === step.points ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : step.earned > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                    {step.earned} / {step.points} {isEnglishQ ? 'pts' : 'درجة'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Teacher Grade Adjustment Control */}
                        <div className="bg-slate-100/80 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 flex-wrap" >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600">تعديل درجة هذا السؤال:</span>
                            <input
                              type="number"
                              min="0"
                              max={q.points || 1}
                              step="0.25"
                              defaultValue={pointsAwarded}
                              id={`grade_input_${q.id}`}
                              className="w-20 px-2.5 py-1 text-center font-bold text-sm bg-white border border-slate-300 rounded-lg focus:border-indigo-600 outline-none"
                            />
                            <span className="text-xs text-slate-500">من {q.points || 1}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const inputEl = document.getElementById(`grade_input_${q.id}`) as HTMLInputElement;
                                if (inputEl) {
                                  inputEl.value = (q.points || 1).toString();
                                }
                                onUpdateGrade(q.id, q.points || 1);
                              }}
                              className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors border border-indigo-200"
                            >
                              منح كامل ({q.points || 1})
                            </button>
                            <button
                              onClick={() => {
                                const inputEl = document.getElementById(`grade_input_${q.id}`) as HTMLInputElement;
                                if (inputEl) {
                                  const val = parseFloat(inputEl.value);
                                  if (!isNaN(val)) {
                                    onUpdateGrade(q.id, val);
                                  }
                                }
                              }}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <Check size={13} />
                              حفظ التعديل
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                    })()}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              onClose();
              onOpenGradingModal(studentResult);
            }}
            className="text-xs sm:text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
          >
            <Settings size={15} />
            <span>فتح نافذة التصحيح الشامل</span>
          </button>

          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-bold px-6 py-2 rounded-xl transition-colors"
          >
            إغلاق ورقة الإجابة
          </button>
        </div>
      </div>
    </div>
  );
};

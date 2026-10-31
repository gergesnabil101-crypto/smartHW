import React, { useState } from 'react';
import { Move, Copy, Folder as FolderIcon, X, Search, ArrowRightLeft, Check, Loader2, FileText } from 'lucide-react';
import { Folder, Quiz } from '../../types';

interface MoveQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizId: string | null;
  folders: Folder[];
  onMoveQuiz: (quizId: string, folderId: string | null) => void;
}

export const MoveQuizModal: React.FC<MoveQuizModalProps> = ({
  isOpen,
  onClose,
  quizId,
  folders,
  onMoveQuiz,
}) => {
  if (!isOpen || !quizId) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Move size={18} className="text-indigo-600" />
            <span>نقل الاختبار إلى مجلد</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
          <button
            onClick={() => {
              onMoveQuiz(quizId, null);
              onClose();
            }}
            className="w-full text-right p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors text-sm font-bold text-slate-700 flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
            بدون مجلد (الرئيسية)
          </button>
          
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => {
                onMoveQuiz(quizId, folder.id);
                onClose();
              }}
              className="w-full text-right p-3 rounded-xl hover:bg-indigo-50 border border-slate-100 transition-colors text-sm font-bold text-slate-700 flex items-center gap-2"
            >
              <FolderIcon size={16} className="text-indigo-600" />
              {folder.name}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full bg-slate-100 text-slate-700 py-2.5 rounded-xl hover:bg-slate-200 font-bold text-xs transition-colors cursor-pointer"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
};

interface MoveQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionId: string | null;
  questionText?: string;
  currentQuizId: string;
  quizzes: Quiz[];
  onMoveQuestion?: (questionId: string, targetQuizId: string) => void;
  onAction?: (questionId: string, targetQuizId: string, action: 'copy' | 'move') => Promise<void> | void;
}

export const MoveQuestionModal: React.FC<MoveQuestionModalProps> = ({
  isOpen,
  onClose,
  questionId,
  questionText,
  currentQuizId,
  quizzes,
  onMoveQuestion,
  onAction,
}) => {
  const [activeAction, setActiveAction] = useState<'copy' | 'move'>('copy');
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTargetId, setProcessingTargetId] = useState<string | null>(null);

  if (!isOpen || !questionId) return null;

  const targetQuizzes = quizzes.filter(q => q.id !== currentQuizId);
  const filteredQuizzes = targetQuizzes.filter(q => {
    const title = (q.title || '').toLowerCase();
    const query = searchTerm.toLowerCase().trim();
    return !query || title.includes(query);
  });

  const handleExecute = async (targetQuizId: string, actionType: 'copy' | 'move') => {
    if (isProcessing) return;
    setIsProcessing(true);
    setProcessingTargetId(targetQuizId);
    try {
      if (onAction) {
        await onAction(questionId, targetQuizId, actionType);
      } else if (onMoveQuestion) {
        await onMoveQuestion(questionId, targetQuizId);
      }
      onClose();
    } catch (err) {
      console.error('Error copying/moving question:', err);
    } finally {
      setIsProcessing(false);
      setProcessingTargetId(null);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={() => !isProcessing && onClose()}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-5 sm:p-6 animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${
              activeAction === 'copy' ? 'bg-indigo-600' : 'bg-emerald-600'
            }`}>
              {activeAction === 'copy' ? <Copy size={18} /> : <Move size={18} />}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">
                {activeAction === 'copy' ? 'نسخ السؤال إلى اختبار آخر' : 'نقل السؤال إلى اختبار آخر'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {activeAction === 'copy' 
                  ? 'سيتم إضافة نسخة من السؤال للاختبار المختار مع بقائه هنا' 
                  : 'سيتم نقل السؤال للاختبار المختار وحذفه من هذا الاختبار'}
              </p>
            </div>
          </div>
          <button 
            disabled={isProcessing}
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Question Preview Snippet */}
        {questionText && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-3 text-xs text-slate-700">
            <span className="font-bold text-slate-500 block mb-1">نص السؤال المستهدف:</span>
            <p className="line-clamp-2 italic font-medium">"{questionText}"</p>
          </div>
        )}

        {/* Action Toggle Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl mb-3">
          <button
            type="button"
            onClick={() => setActiveAction('copy')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeAction === 'copy'
                ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Copy size={14} />
            <span>نسخ (إبقاء نسخة هنا)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveAction('move')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeAction === 'move'
                ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Move size={14} />
            <span>نقل (حذف من هنا)</span>
          </button>
        </div>

        {/* Search Input if more than 3 quizzes */}
        {targetQuizzes.length > 3 && (
          <div className="relative mb-3">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="ابحث عن اسم الاختبار المطلوب..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        )}

        {/* Quizzes List */}
        <div className="space-y-2 overflow-y-auto max-h-64 mb-4 pr-1">
          {filteredQuizzes.map(q => {
            let qCount = 0;
            try {
              if (Array.isArray(q.questions)) {
                qCount = q.questions.length;
              } else if (typeof q.data === 'string') {
                const parsed = JSON.parse(q.data);
                qCount = Array.isArray(parsed?.questions) ? parsed.questions.length : 0;
              }
            } catch {
              qCount = 0;
            }

            const isCurrentProcessing = isProcessing && processingTargetId === q.id;

            return (
              <div
                key={q.id}
                className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/80 transition-all flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileText size={15} className="text-slate-400 shrink-0" />
                    <span className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                      {q.title || 'اختبار بدون عنوان'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                    <span className="bg-slate-200/70 px-1.5 py-0.5 rounded-md font-mono">
                      {qCount} {qCount === 1 ? 'سؤال' : 'أسئلة'}
                    </span>
                    {q.created_at && (
                      <span className="text-[10px] text-slate-400">
                        {new Date(q.created_at).toLocaleDateString('ar-EG')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Direct Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleExecute(q.id, 'copy')}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="نسخ السؤال إلى هذا الاختبار مع الإبقاء عليه هنا"
                  >
                    {isCurrentProcessing && activeAction === 'copy' ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Copy size={13} />
                    )}
                    <span>نسخ</span>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleExecute(q.id, 'move')}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="نقل السؤال إلى هذا الاختبار وحذفه من هنا"
                  >
                    {isCurrentProcessing && activeAction === 'move' ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Move size={13} />
                    )}
                    <span>نقل</span>
                  </button>
                </div>
              </div>
            );
          })}

          {filteredQuizzes.length === 0 && (
            <div className="text-center py-8 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-slate-500 font-bold text-xs mb-1">
                {searchTerm ? 'لا توجد اختبارات مطابقة لبحثك' : 'لا توجد اختبارات أخرى متاحة'}
              </p>
              <p className="text-[11px] text-slate-400">
                {searchTerm ? 'جرب البحث بكلمات أخرى.' : 'يمكنك إنشاء اختبار جديد أولاً من لوحة التحكم لتتمكن من نسخ أو نقل الأسئلة إليه.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            الاختبار الحالي لن يتأثر عند اختيار "نسخ".
          </span>
          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-4 rounded-xl font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

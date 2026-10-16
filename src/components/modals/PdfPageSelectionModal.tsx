import React, { useState, useMemo } from 'react';
import { 
  FileText, X, Check, Sparkles, CheckSquare, Square, 
  Layers, Filter, ArrowLeft, ArrowRight
} from 'lucide-react';

interface PdfPageSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  totalPages: number;
  onConfirm: (selectedPages: number[]) => void;
}

export const PdfPageSelectionModal: React.FC<PdfPageSelectionModalProps> = ({
  isOpen,
  onClose,
  fileName,
  totalPages,
  onConfirm,
}) => {
  if (!isOpen || totalPages <= 0) return null;

  const [selectionMode, setSelectionMode] = useState<'all' | 'range' | 'custom'>('all');
  const [rangeFrom, setRangeFrom] = useState<number>(1);
  const [rangeTo, setRangeTo] = useState<number>(Math.min(totalPages, 10));
  const [selectedSet, setSelectedSet] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    for (let i = 1; i <= Math.min(totalPages, 50); i++) {
      initial.add(i);
    }
    return initial;
  });
  const [customInputText, setCustomInputText] = useState<string>('');

  // Calculate final selected pages based on active mode
  const finalSelectedPages = useMemo(() => {
    if (selectionMode === 'all') {
      const all: number[] = [];
      for (let i = 1; i <= totalPages; i++) all.push(i);
      return all;
    }
    if (selectionMode === 'range') {
      const start = Math.max(1, Math.min(rangeFrom, totalPages));
      const end = Math.max(start, Math.min(rangeTo, totalPages));
      const range: number[] = [];
      for (let i = start; i <= end; i++) range.push(i);
      return range;
    }
    // Custom mode
    const customList = (Array.from(selectedSet) as number[]).filter((p: number) => p >= 1 && p <= totalPages);
    customList.sort((a: number, b: number) => a - b);
    return customList;
  }, [selectionMode, rangeFrom, rangeTo, selectedSet, totalPages]);

  const togglePage = (pageNum: number) => {
    setSelectedSet(prev => {
      const next = new Set(prev);
      if (next.has(pageNum)) {
        next.delete(pageNum);
      } else {
        next.add(pageNum);
      }
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set<number>();
    for (let i = 1; i <= totalPages; i++) all.add(i);
    setSelectedSet(all);
  };

  const deselectAll = () => {
    setSelectedSet(new Set());
  };

  const selectOdd = () => {
    const odd = new Set<number>();
    for (let i = 1; i <= totalPages; i += 2) odd.add(i);
    setSelectedSet(odd);
  };

  const selectEven = () => {
    const even = new Set<number>();
    for (let i = 2; i <= totalPages; i += 2) even.add(i);
    setSelectedSet(even);
  };

  const applyCustomTextInput = (text: string) => {
    setCustomInputText(text);
    if (!text.trim()) return;

    const newSet = new Set<number>();
    const parts = text.split(/[,،\s]+/);

    parts.forEach(part => {
      const trimmed = part.trim();
      if (!trimmed) return;

      // Check for range like "1-5" or "1:5"
      if (trimmed.includes('-') || trimmed.includes(':')) {
        const [rawStart, rawEnd] = trimmed.split(/[-:]/);
        const s = parseInt(rawStart, 10);
        const e = parseInt(rawEnd, 10);
        if (!isNaN(s) && !isNaN(e)) {
          const from = Math.max(1, Math.min(s, e));
          const to = Math.min(totalPages, Math.max(s, e));
          for (let i = from; i <= to; i++) newSet.add(i);
        }
      } else {
        const single = parseInt(trimmed, 10);
        if (!isNaN(single) && single >= 1 && single <= totalPages) {
          newSet.add(single);
        }
      }
    });

    if (newSet.size > 0) {
      setSelectedSet(newSet);
    }
  };

  const handleStartExtraction = () => {
    if (finalSelectedPages.length === 0) {
      alert('يرجى تحديد صفحة واحدة على الأقل من الملف للاستخراج.');
      return;
    }
    onConfirm(finalSelectedPages);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[95] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center font-bold text-white shadow-inner">
              <FileText size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                تحديد صفحات ملف PDF للاستخراج
              </h3>
              <p className="text-xs text-indigo-100 line-clamp-1">
                {fileName} • إجمالي الصفحات: {totalPages} صفحة
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
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Mode Selector Tabs */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-2 block">
              اختر طريقة تحديد الصفحات:
            </label>
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => setSelectionMode('all')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  selectionMode === 'all'
                    ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers size={14} />
                <span>جميع الصفحات ({totalPages})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectionMode('range')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  selectionMode === 'range'
                    ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowRight size={14} />
                <span>نطاق صفحات</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectionMode('custom')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  selectionMode === 'custom'
                    ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckSquare size={14} />
                <span>تحديد مخصص</span>
              </button>
            </div>
          </div>

          {/* Mode 1: All Pages Note */}
          {selectionMode === 'all' && (
            <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-xs text-indigo-900 leading-relaxed">
              <p className="font-bold mb-1">سيتم استخراج الأسئلة من جميع صفحات الملف بالتسلسل:</p>
              <p className="text-indigo-700">من الصفحة 1 إلى الصفحة {totalPages} (إجمالي {totalPages} صفحة).</p>
            </div>
          )}

          {/* Mode 2: Page Range Inputs */}
          {selectionMode === 'range' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-600 mb-1 block">من صفحة:</label>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1)))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-center font-bold text-sm text-slate-800 focus:border-indigo-600 outline-none"
                  />
                </div>

                <span className="text-slate-400 font-bold text-sm mt-5">إلى</span>

                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-600 mb-1 block">إلى صفحة:</label>
                  <input
                    type="number"
                    min={rangeFrom}
                    max={totalPages}
                    value={rangeTo}
                    onChange={(e) => setRangeTo(Math.max(rangeFrom, Math.min(totalPages, parseInt(e.target.value) || rangeFrom)))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-center font-bold text-sm text-slate-800 focus:border-indigo-600 outline-none"
                  />
                </div>
              </div>

              <div className="text-xs text-slate-500 text-center font-medium">
                سيتم استخراج {Math.max(0, rangeTo - rangeFrom + 1)} صفحة ({rangeFrom} إلى {rangeTo})
              </div>
            </div>
          )}

          {/* Mode 3: Custom / Interactive Grid */}
          {selectionMode === 'custom' && (
            <div className="space-y-3">
              {/* Quick Actions Bar */}
              <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                <span className="font-bold text-slate-600">اختر الصفحات المطلوبة:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-colors cursor-pointer"
                  >
                    الكل
                  </button>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-colors cursor-pointer"
                  >
                    إلغاء التحديد
                  </button>
                  <button
                    type="button"
                    onClick={selectOdd}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-colors cursor-pointer"
                  >
                    فردي
                  </button>
                  <button
                    type="button"
                    onClick={selectEven}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-colors cursor-pointer"
                  >
                    زوجي
                  </button>
                </div>
              </div>

              {/* Text Input Shortcut */}
              <div>
                <input
                  type="text"
                  placeholder="أو اكتب أرقام الصفحات (مثال: 1, 3, 5-8)"
                  value={customInputText}
                  onChange={(e) => applyCustomTextInput(e.target.value)}
                  dir="ltr"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 placeholder:text-right"
                />
              </div>

              {/* Interactive Page Grid */}
              <div className="max-h-48 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                    const isSelected = selectedSet.has(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePage(p)}
                        className={`h-11 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs scale-[1.02] ring-2 ring-indigo-300'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{p}</span>
                        <span className="text-[9px] opacity-75 font-normal">ص</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Selection Summary Pill */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-700">الصفحات المختارة للاستخراج:</span>
            </div>
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-xl text-xs font-black">
              {finalSelectedPages.length} من {totalPages} صفحة
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleStartExtraction}
            disabled={finalSelectedPages.length === 0}
            className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles size={16} />
            <span>بدء استخراج الأسئلة ({finalSelectedPages.length} صفحة)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

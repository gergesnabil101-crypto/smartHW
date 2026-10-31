import React from 'react';
import { ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage?: number;
  onPageChange: (page: number) => void;
  itemName?: string;
  theme?: 'amber' | 'indigo' | 'emerald' | 'slate';
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage = 20,
  onPageChange,
  itemName = 'عنصر',
  theme = 'indigo',
}) => {
  if (totalItems === 0) return null;

  const validTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), validTotalPages);

  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(safeCurrentPage * itemsPerPage, totalItems);

  // Theme color styles
  const themeStyles = {
    indigo: {
      activeBtn: 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300 font-black',
      inactiveBtn: 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 bg-white border border-slate-200',
      badge: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      accentText: 'text-indigo-600',
      navBtn: 'hover:bg-indigo-50 hover:text-indigo-700 border-slate-200 text-slate-700',
    },
    amber: {
      activeBtn: 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-300 font-black',
      inactiveBtn: 'text-slate-700 hover:bg-amber-50 hover:text-amber-800 bg-white border border-slate-200',
      badge: 'bg-amber-50 text-amber-900 border-amber-200',
      accentText: 'text-amber-700',
      navBtn: 'hover:bg-amber-50 hover:text-amber-800 border-slate-200 text-slate-700',
    },
    emerald: {
      activeBtn: 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300 font-black',
      inactiveBtn: 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 bg-white border border-slate-200',
      badge: 'bg-emerald-50 text-emerald-900 border-emerald-200',
      accentText: 'text-emerald-700',
      navBtn: 'hover:bg-emerald-50 hover:text-emerald-800 border-slate-200 text-slate-700',
    },
    slate: {
      activeBtn: 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-400 font-black',
      inactiveBtn: 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 bg-white border border-slate-200',
      badge: 'bg-slate-100 text-slate-800 border-slate-200',
      accentText: 'text-slate-900',
      navBtn: 'hover:bg-slate-100 hover:text-slate-900 border-slate-200 text-slate-700',
    },
  }[theme];

  // Helper for generating page numbers with smart ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (validTotalPages <= 7) {
      for (let i = 1; i <= validTotalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) {
        pages.push('dots-prev');
      }

      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(validTotalPages - 1, safeCurrentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (safeCurrentPage < validTotalPages - 2) {
        pages.push('dots-next');
      }
      pages.push(validTotalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200 rounded-b-2xl text-xs" >
      {/* Items count & summary */}
      <div className="flex items-center gap-2 text-slate-600 font-medium">
        <span>
          عرض <strong className="text-slate-900 font-mono font-bold">{totalItems === 0 ? 0 : startIndex + 1}</strong> إلى{' '}
          <strong className="text-slate-900 font-mono font-bold">{endIndex}</strong> من إجمالي{' '}
          <strong className="text-slate-900 font-mono font-bold">{totalItems}</strong> {itemName}
        </span>
        <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${themeStyles.badge}`}>
          صفحة {safeCurrentPage} من {validTotalPages}
        </span>
      </div>

      {/* Pagination controls */}
      {validTotalPages > 1 && (
        <div className="flex items-center gap-1 flex-wrap justify-center">
          {/* First Page button */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={safeCurrentPage === 1}
            className={`p-1.5 rounded-lg border bg-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${themeStyles.navBtn}`}
            title="الصفحة الأولى"
          >
            <ChevronsRight size={15} />
          </button>

          {/* Previous Page button */}
          <button
            type="button"
            onClick={() => onPageChange(safeCurrentPage - 1)}
            disabled={safeCurrentPage === 1}
            className={`px-2.5 py-1.5 rounded-lg border bg-white font-bold flex items-center gap-1 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${themeStyles.navBtn}`}
            title="الصفحة السابقة"
          >
            <ChevronRight size={15} />
            <span className="hidden sm:inline">السابق</span>
          </button>

          {/* Numeric Page Buttons */}
          <div className="flex items-center gap-1">
            {getPageNumbers().map((item, idx) => {
              if (typeof item === 'string') {
                return (
                  <span key={`${item}-${idx}`} className="px-1.5 text-slate-400 font-mono select-none">
                    ...
                  </span>
                );
              }

              const isActive = item === safeCurrentPage;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange(item)}
                  className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    isActive ? themeStyles.activeBtn : themeStyles.inactiveBtn
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>

          {/* Next Page button */}
          <button
            type="button"
            onClick={() => onPageChange(safeCurrentPage + 1)}
            disabled={safeCurrentPage === validTotalPages}
            className={`px-2.5 py-1.5 rounded-lg border bg-white font-bold flex items-center gap-1 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${themeStyles.navBtn}`}
            title="الصفحة التالية"
          >
            <span className="hidden sm:inline">التالي</span>
            <ChevronLeft size={15} />
          </button>

          {/* Last Page button */}
          <button
            type="button"
            onClick={() => onPageChange(validTotalPages)}
            disabled={safeCurrentPage === validTotalPages}
            className={`p-1.5 rounded-lg border bg-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${themeStyles.navBtn}`}
            title="الصفحة الأخيرة"
          >
            <ChevronsLeft size={15} />
          </button>

          {/* Quick jump selector if more than 5 pages */}
          {validTotalPages > 5 && (
            <div className="mr-1 hidden md:flex items-center gap-1 text-[11px] text-slate-500">
              <span>انتقال إلى:</span>
              <select
                value={safeCurrentPage}
                onChange={(e) => onPageChange(Number(e.target.value))}
                className="p-1 border border-slate-200 rounded-md bg-white text-slate-800 font-bold outline-none cursor-pointer"
              >
                {Array.from({ length: validTotalPages }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

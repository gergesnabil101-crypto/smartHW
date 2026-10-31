import React, { useState } from 'react';
import { 
  X, 
  KeyRound, 
  Plus, 
  Trash2, 
  Sparkles, 
  Copy, 
  Check, 
  Download, 
  Users, 
  RefreshCw, 
  ShieldCheck, 
  FileSpreadsheet,
  AlertCircle,
  Lock,
  Unlock
} from 'lucide-react';
import { exportToCSV, exportToExcelHTML } from '../../utils/excelExport';

export interface StudentCodeEntry {
  code: string;
  student_name: string;
  center_name?: string;
  student_phone?: string;
  parent_phone?: string;
  student_grade?: string;
  used?: boolean;
  used_at?: string;
  result_id?: string;
}

interface StudentCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizTitle: string;
  requireStudentCode: boolean;
  onToggleRequireCode: (required: boolean) => void;
  studentCodes: StudentCodeEntry[];
  onUpdateStudentCodes: (codes: StudentCodeEntry[]) => void;
  centersList?: string[];
  gradeLevel?: string;
}

export function StudentCodesModal({
  isOpen,
  onClose,
  quizTitle,
  requireStudentCode,
  onToggleRequireCode,
  studentCodes,
  onUpdateStudentCodes,
  centersList = [],
  gradeLevel = ''
}: StudentCodesModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Single Add State
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newCenter, setNewCenter] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // Bulk Add State
  const [bulkText, setBulkText] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkCenter, setBulkCenter] = useState('');

  // Random Code Generator helper
  const generateRandomCode = (prefix = 'ST') => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}-${rand}`;
  };

  if (!isOpen) return null;

  const handleAddSingle = () => {
    if (!newName.trim()) {
      alert('يرجى إدخال اسم الطالب');
      return;
    }
    const finalCode = (newCode.trim() || generateRandomCode()).toUpperCase();

    // Check duplicate code
    if (studentCodes.some(c => c.code.toUpperCase() === finalCode)) {
      alert(`الكود "${finalCode}" مستخدم بالفعل لطالب آخر في هذا الاختبار.`);
      return;
    }

    const newEntry: StudentCodeEntry = {
      code: finalCode,
      student_name: newName.trim(),
      center_name: newCenter.trim() || undefined,
      student_phone: newPhone.trim() || undefined,
      used: false
    };

    onUpdateStudentCodes([...studentCodes, newEntry]);
    setNewName('');
    setNewCode('');
    setNewPhone('');
  };

  const handleBulkAdd = () => {
    if (!bulkText.trim()) {
      alert('يرجى لصق قائمة بأسماء الطلاب (كل اسم في سطر منفصل).');
      return;
    }

    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    const existingCodes = new Set(studentCodes.map(c => c.code.toUpperCase()));
    const addedEntries: StudentCodeEntry[] = [];

    lines.forEach((line) => {
      // Line could be "Name" or "Name, Code" or "Name - Code"
      let name = line;
      let code = '';
      if (line.includes(',') || line.includes('\t') || line.includes('-')) {
        const parts = line.split(/[\t,-]/).map(p => p.trim());
        if (parts.length >= 2) {
          name = parts[0];
          code = parts[1].toUpperCase();
        }
      }

      if (!code) {
        do {
          code = generateRandomCode();
        } while (existingCodes.has(code));
      }

      if (!existingCodes.has(code)) {
        existingCodes.add(code);
        addedEntries.push({
          code,
          student_name: name,
          center_name: bulkCenter.trim() || undefined,
          used: false
        });
      }
    });

    onUpdateStudentCodes([...studentCodes, ...addedEntries]);
    setBulkText('');
    setShowBulkAdd(false);
  };

  const handleDeleteCode = (codeToDelete: string) => {
    if (confirm(`هل أنت متأكد من حذف كود الطالب (${codeToDelete})؟`)) {
      onUpdateStudentCodes(studentCodes.filter(c => c.code !== codeToDelete));
    }
  };

  const handleResetCodeUsage = (codeToReset: string) => {
    onUpdateStudentCodes(studentCodes.map(c => {
      if (c.code === codeToReset) {
        return { ...c, used: false, used_at: undefined, result_id: undefined };
      }
      return c;
    }));
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCopyAllCodes = () => {
    const text = studentCodes.map(c => `${c.student_name}: ${c.code}${c.center_name ? ` (${c.center_name})` : ''}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleExportCodesExcel = () => {
    const data = studentCodes.map(c => ({
      'كود الطالب': c.code,
      'اسم الطالب': c.student_name,
      'السنتر / المجموعة': c.center_name || '-',
      'رقم الهاتف': c.student_phone || '-',
      'حالة الاستخدام': c.used ? 'تم الدخول والتسليم' : 'لم يُستخدم بعد',
      'تاريخ الاستخدام': c.used_at ? new Date(c.used_at).toLocaleString('ar-EG') : '-'
    }));
    exportToExcelHTML(data, `أكواد_الطلاب_${quizTitle.replace(/\s+/g, '_')}`);
  };

  const filteredCodes = studentCodes.filter(c => 
    c.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.center_name && c.center_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const usedCount = studentCodes.filter(c => c.used).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200 text-right" dir="rtl">
        
        {/* Header */}
        <div className="bg-gradient-to-l from-indigo-900 via-indigo-800 to-indigo-950 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-amber-300 border border-white/10 shadow-inner">
              <KeyRound size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">إدارة أكواد دخول الطلاب</h3>
                <span className="text-[11px] bg-amber-400 text-indigo-950 px-2 py-0.5 rounded-full font-black">
                  خاصية متقدمة
                </span>
              </div>
              <p className="text-xs text-indigo-200 truncate max-w-md mt-0.5">
                {quizTitle}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Activation Banner / Switch */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${requireStudentCode ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
              {requireStudentCode ? <Lock size={20} /> : <Unlock size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800">
                  تفعيل الدخول الإلزامي بكود الطالب:
                </span>
                <span className={`text-xs font-black px-2 py-0.5 rounded-md ${requireStudentCode ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-700'}`}>
                  {requireStudentCode ? 'مفعل (إلزامي)' : 'معطل (دخول عادي بالاسم)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                عند التفعيل، لن يتمكن أي طالب من دخول الاختبار إلا بكوده الخاص، ويُمنع تكرار الدخول بنفس الكود أكثر من مرة.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onToggleRequireCode(!requireStudentCode)}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center gap-2 ${
              requireStudentCode 
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {requireStudentCode ? 'إيقاف شرط الكود' : 'تفعيل شرط الكود الآن'}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Quick Stats & Controls */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-2xl">
              <span className="text-[11px] text-indigo-600 font-bold block">إجمالي الأكواد</span>
              <span className="text-xl font-black text-indigo-900">{studentCodes.length}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl">
              <span className="text-[11px] text-emerald-600 font-bold block">تم استخدامها (سلموا)</span>
              <span className="text-xl font-black text-emerald-900">{usedCount}</span>
            </div>
            <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl">
              <span className="text-[11px] text-amber-600 font-bold block">أكواد شاغرة (لم يدخلوا)</span>
              <span className="text-xl font-black text-amber-900">{studentCodes.length - usedCount}</span>
            </div>
            <div className="bg-purple-50 border border-purple-100 p-3 rounded-2xl flex flex-col justify-center items-center gap-1">
              <button
                onClick={handleExportCodesExcel}
                disabled={studentCodes.length === 0}
                className="w-full text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center justify-center gap-1 disabled:opacity-40"
              >
                <Download size={13} />
                <span>تصدير Excel</span>
              </button>
              <button
                onClick={handleCopyAllCodes}
                disabled={studentCodes.length === 0}
                className="w-full text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center justify-center gap-1 disabled:opacity-40"
              >
                {copiedAll ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                <span>{copiedAll ? 'تم النسخ!' : 'نسخ القائمة'}</span>
              </button>
            </div>
          </div>

          {/* Add Student Section */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Plus size={16} className="text-indigo-600" />
                <span>إضافة كود لطالب جديد</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowBulkAdd(!showBulkAdd)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline flex items-center gap-1"
              >
                <FileSpreadsheet size={13} />
                <span>{showBulkAdd ? 'إضافة فردية' : 'إضافة جماعية (نسخ ولصق أسماء)'}</span>
              </button>
            </div>

            {!showBulkAdd ? (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">اسم الطالب *</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="مثال: يوسف أحمد محمود"
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 text-xs outline-none"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    الكود <span className="text-[10px] text-slate-400">(فارغ = توليد تلقائي)</span>
                  </label>
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    placeholder="ST-XXXX"
                    dir="ltr"
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 text-xs font-mono font-bold outline-none uppercase"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">السنتر / المجموعة</label>
                  {centersList.length > 0 ? (
                    <select
                      value={newCenter}
                      onChange={(e) => setNewCenter(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 text-xs outline-none bg-white"
                    >
                      <option value="">عام / بدون تحديد</option>
                      {centersList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={newCenter}
                      onChange={(e) => setNewCenter(e.target.value)}
                      placeholder="اسم السنتر أو المجموعة"
                      className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 text-xs outline-none"
                    />
                  )}
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddSingle}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-1 shadow-xs"
                  >
                    <Plus size={14} />
                    <span>إضافة</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-950">
                    الصق قائمة أسماء الطلاب (اسم في كل سطر)، وسيقوم النظام بتوليد أكواد فريدة لهم تلقائياً:
                  </span>
                  <div className="w-48">
                    {centersList.length > 0 ? (
                      <select
                        value={bulkCenter}
                        onChange={(e) => setBulkCenter(e.target.value)}
                        className="w-full p-1.5 rounded-lg border border-indigo-200 text-xs bg-white"
                      >
                        <option value="">تطبيق على سنتر...</option>
                        {centersList.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : null}
                  </div>
                </div>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="محمد أحمد علي&#10;سارة محمود إبراهيم&#10;خالد وليد حسن"
                  rows={4}
                  className="w-full p-3 rounded-xl border border-indigo-200 text-xs outline-none bg-white font-sans"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkAdd(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkAdd}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
                  >
                    <Sparkles size={14} />
                    <span>توليد الأكواد وإضافتها فوراً</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search & Code List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-bold text-slate-800">قائمة أكواد الطلاب لهذا الاختبار</h4>
              <div className="w-64">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث بالاسم أو الكود..."
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none bg-white"
                />
              </div>
            </div>

            {studentCodes.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-500">
                <KeyRound size={32} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-bold">لم تقم بإضافة أكواد لهذا الاختبار بعد</p>
                <p className="text-xs text-slate-400 mt-1">
                  أضف طلابك بالأعلى لإنشاء أكواد خاصة بهم ومنع تكرار دخولهم.
                </p>
              </div>
            ) : filteredCodes.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                لا توجد نتائج تطابق بحثك.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">اسم الطالب</th>
                        <th className="p-3">الكود الفريد</th>
                        <th className="p-3">السنتر</th>
                        <th className="p-3">حالة الاستخدام</th>
                        <th className="p-3 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCodes.map((entry, idx) => (
                        <tr key={entry.code} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-3 font-bold text-slate-800">{entry.student_name}</td>
                          <td className="p-3 font-mono font-black text-indigo-700 tracking-wide">
                            <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                              <span>{entry.code}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyCode(entry.code)}
                                className="text-indigo-400 hover:text-indigo-800"
                                title="نسخ الكود"
                              >
                                {copiedCode === entry.code ? (
                                  <Check size={12} className="text-emerald-600" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="p-3 text-slate-500">{entry.center_name || '-'}</td>
                          <td className="p-3">
                            {entry.used ? (
                              <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                                <Lock size={10} />
                                <span>تم الاستخدام</span>
                              </span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                                <Unlock size={10} />
                                <span>جاهز للدخول</span>
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {entry.used && (
                                <button
                                  type="button"
                                  onClick={() => handleResetCodeUsage(entry.code)}
                                  className="text-amber-600 hover:text-amber-800 p-1 rounded-md hover:bg-amber-50"
                                  title="إلغاء قفل الكود والسماح للطالب بإعادة المحاولة"
                                >
                                  <RefreshCw size={13} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteCode(entry.code)}
                                className="text-rose-500 hover:text-rose-700 p-1 rounded-md hover:bg-rose-50"
                                title="حذف الكود"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <ShieldCheck size={15} className="text-indigo-600" />
            <span>يتم حفظ الأكواد وحالتها تلقائياً مع الاختبار.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-xl text-xs transition-colors shadow-xs"
          >
            تم الحفظ والعودة
          </button>
        </div>

      </div>
    </div>
  );
}

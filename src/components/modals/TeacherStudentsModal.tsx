import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { X, Users, RefreshCw, Loader2, Download, Search, KeyRound, Sparkles, MessageCircle, Check, Copy, Trash2 } from 'lucide-react';
import { db } from '../../firebase';
import { exportToExcelHTML } from '../../utils/excelExport';

interface TeacherStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizzes: any[];
  teacherId?: string;
  teacherName?: string;
  teacherSubject?: string;
}

export function TeacherStudentsModal({ isOpen, onClose, quizzes, teacherId, teacherName, teacherSubject }: TeacherStudentsModalProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const generateRandomCode = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `ST-${rand}`;
  };

  const fetchStudents = async () => {
    setIsLoading(true);
    setError('');
    try {
      const studentMap = new Map<string, any>();
      let fetchedFromStudents = false;

      if (teacherId) {
        try {
          const studentsQ = query(collection(db, 'students'), where('teacher_id', '==', teacherId));
          const snap = await getDocs(studentsQ);
          if (!snap.empty) {
            snap.forEach(d => {
              const r = d.data();
              studentMap.set(r.id, {
                id: r.id,
                name: r.name || 'طالب',
                phone: r.phone || '',
                parent_phone: r.parent_phone || '-',
                email: r.email || '-',
                center_name: r.center_name || '-',
                grade_level: r.grade_level || '-',
                code: r.code || '',
                exams_taken: r.exams_taken || 1,
                last_date: r.last_date || new Date().toISOString()
              });
            });
            fetchedFromStudents = true;
          }
        } catch (e) {
          console.warn("Direct students query notice, falling back to results:", e);
        }
      }

      if (!fetchedFromStudents && quizzes && quizzes.length > 0) {
        const quizIds = quizzes.map(q => q.id);
        const chunks = [];
        for (let i = 0; i < quizIds.length; i += 10) {
          chunks.push(quizIds.slice(i, i + 10));
        }
        
        for (const chunk of chunks) {
          const resultsQ = query(collection(db, 'results'), where('quiz_id', 'in', chunk));
          const snap = await getDocs(resultsQ);
          snap.forEach(d => {
            const r = d.data();
            const studentPhone = (r.student_phone || r.phone || '').trim();
            const studentName = (r.student_name || 'طالب').trim();
            const key = studentPhone ? `${studentName}_${studentPhone}` : `${studentName}_${r.created_at || Math.random()}`;
            
            if (!studentMap.has(key)) {
              studentMap.set(key, {
                id: key,
                name: studentName,
                phone: studentPhone,
                parent_phone: r.parent_phone || '-',
                email: r.student_email || '-',
                center_name: r.center_name || '-',
                grade_level: r.grade_level || '-',
                code: r.student_code || '',
                exams_taken: 1,
                last_date: r.created_at || new Date().toISOString()
              });
            } else {
              const existing = studentMap.get(key);
              existing.exams_taken += 1;
              existing.last_date = r.created_at > existing.last_date ? r.created_at : existing.last_date;
              if (existing.email === '-' && r.student_email) existing.email = r.student_email;
              if (!existing.code && r.student_code) existing.code = r.student_code;
            }
          });
        }
      }
      
      const list = Array.from(studentMap.values());
      list.sort((a, b) => new Date(b.last_date).getTime() - new Date(a.last_date).getTime());
      setStudents(list);
    } catch (err: any) {
      console.error(err);
      setError('حدث خطأ أثناء تحميل بيانات الطلاب. تأكد من اتصالك بالإنترنت.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStudents();
    }
  }, [isOpen, quizzes]);

  const handleGenerateOrUpdateCode = async (student: any, customCode?: string) => {
    const codeToSet = (customCode || generateRandomCode()).trim().toUpperCase();
    try {
      const studentDocId = student.id.replace(/[\/.\s#$\[\]]/g, '_');
      const studentData = {
        id: student.id,
        name: student.name || 'طالب',
        phone: student.phone || '',
        parent_phone: student.parent_phone || '',
        center_name: student.center_name || '',
        grade_level: student.grade_level || '',
        subject: student.subject || '',
        teacher_name: student.teacher_name || '',
        teacher_id: teacherId || student.teacher_id || null,
        exams_taken: student.exams_taken || 1,
        last_score: student.last_score || null,
        total_score: student.total_score || null,
        last_date: student.last_date || new Date().toISOString(),
        code: codeToSet
      };
      await setDoc(doc(db, 'students', studentDocId), studentData, { merge: true });
      setStudents(prev => prev.map(s => s.id === student.id ? { ...s, code: codeToSet } : s));
    } catch (e: any) {
      console.error("Error saving student code:", e);
      alert('حدث خطأ أثناء حفظ كود الطالب: ' + (e?.message || ''));
    }
  };

  const handleDeleteStudent = async (student: any) => {
    if (!window.confirm(`هل أنت متأكد من حذف حساب الطالب "${student.name}"؟`)) {
      return;
    }
    try {
      const studentDocId = student.id.replace(/[\/.\s#$\[\]]/g, '_');
      await deleteDoc(doc(db, 'students', studentDocId));
      setStudents(prev => prev.filter(s => s.id !== student.id));
    } catch (e: any) {
      console.error("Error deleting student:", e);
      setStudents(prev => prev.filter(s => s.id !== student.id));
    }
  };

  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  const handleToggleSelectAll = () => {
    if (selectedStudentIds.size === filteredStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const handleToggleSelectStudent = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedStudentIds(next);
  };

  const handleDeleteSelectedStudents = async () => {
    if (selectedStudentIds.size === 0) return;
    if (!window.confirm(`هل أنت متأكد من حذف (${selectedStudentIds.size}) طالب المحددين نهائياً؟`)) {
      return;
    }
    try {
      const idsToDelete = Array.from(selectedStudentIds);
      for (const id of idsToDelete) {
        try {
          const studentDocId = String(id).replace(/[\/.\s#$\[\]]/g, '_');
          await deleteDoc(doc(db, 'students', studentDocId));
        } catch (_) {}
      }
      setStudents(prev => prev.filter(s => !selectedStudentIds.has(s.id)));
      setSelectedStudentIds(new Set());
      alert('✅ تم حذف الطلاب المحددين بنجاح.');
    } catch (e: any) {
      console.error("Error deleting selected students:", e);
      alert('حدث خطأ أثناء حذف الطلاب المحددين.');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSendWhatsApp = (student: any) => {
    const phone = (student.phone || '').replace(/[^0-9]/g, '');
    if (!phone) {
      alert('رقم هاتف الطالب غير متوفر أو غير صحيح.');
      return;
    }
    let code = student.code;
    if (!code) {
      code = generateRandomCode();
      handleGenerateOrUpdateCode(student, code);
    }
    const tName = teacherName || student.teacher_name || '';
    const tSubject = teacherSubject || student.subject || '';
    const teacherInfoStr = tName ? ` (أستاذ: ${tName}${tSubject ? ` - ${tSubject}` : ''})` : (tSubject ? ` (${tSubject})` : '');
    const msg = `مرحباً بك يا ${student.name} 📚\nكود دخولك الموحد لجميع اختبارات برنامج مصحح الوجبات الذكي${teacherInfoStr} هو: *${code}*.\nيرجى الاحتفاظ بهذا الكود وعدم مشاركته، وستحتاجه لدخول كل اختبار. بالتوفيق!`;
    const formattedPhone = phone.startsWith('0') ? `2${phone}` : phone;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone.includes(searchTerm) ||
    s.parent_phone.includes(searchTerm) ||
    (s.code && s.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleExport = () => {
    if (filteredStudents.length === 0) return;
    const exportData = filteredStudents.map((s, idx) => ({
      'م': idx + 1,
      'اسم الطالب': s.name,
      'كود الطالب الموحد': s.code || '-',
      'تليفون الطالب': s.phone,
      'تليفون ولي الأمر': s.parent_phone,
      'البريد الإلكتروني': s.email !== '-' ? s.email : '',
      'المرحلة الدراسية': s.grade_level,
      'السنتر / المجموعة': s.center_name,
      'عدد الاختبارات': s.exams_taken
    }));
    exportToExcelHTML(exportData, 'قاعدة بيانات طلابي', 'My_Students.xls');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-md">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-800">قاعدة بيانات طلابي وأكواد الدخول الموحدة</h2>
              <p className="text-sm text-slate-500 font-medium mt-1">أنشئ أكواد موحدة للطلاب وأرسلها عبر الواتساب، وتتبع مشاركتهم في الاختبارات</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200/60 rounded-full transition-colors">
            <X size={24} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
            <div className="relative w-full sm:w-96">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="ابحث بالاسم، الكود، رقم الهاتف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-sm"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {selectedStudentIds.size > 0 && (
                <button
                  onClick={handleDeleteSelectedStudents}
                  className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm cursor-pointer"
                >
                  <Trash2 size={18} />
                  <span>حذف المحددين ({selectedStudentIds.size})</span>
                </button>
              )}
              <button
                onClick={fetchStudents}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors flex-1 sm:flex-none cursor-pointer"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                تحديث
              </button>
              <button
                onClick={handleExport}
                disabled={filteredStudents.length === 0}
                className="flex items-center justify-center gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 disabled:opacity-50 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors flex-1 sm:flex-none cursor-pointer"
              >
                <Download size={18} />
                تصدير Excel
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 text-sm font-bold border border-red-200">
              {error}
            </div>
          )}

          <div className="flex-1 overflow-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 shadow-sm">
                <tr>
                  <th className="p-4 font-black text-slate-700 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={filteredStudents.length > 0 && selectedStudentIds.size === filteredStudents.length}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-4 font-black text-slate-700">م</th>
                  <th className="p-4 font-black text-slate-700">اسم الطالب</th>
                  <th className="p-4 font-black text-slate-700">كود الطالب الموحد</th>
                  <th className="p-4 font-black text-slate-700">إجراءات واتساب</th>
                  <th className="p-4 font-black text-slate-700">رقم الطالب</th>
                  <th className="p-4 font-black text-slate-700">رقم ولي الأمر</th>
                  <th className="p-4 font-black text-slate-700">السنتر / المجموعة</th>
                  <th className="p-4 font-black text-slate-700">عدد الاختبارات</th>
                  <th className="p-4 font-black text-slate-700">حذف الحساب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-slate-500 font-bold">
                      <Loader2 size={32} className="animate-spin mx-auto mb-3 text-indigo-500" />
                      جاري تحميل بيانات الطلاب...
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-slate-500 font-bold">
                      لا يوجد طلاب مسجلين حتى الآن. يظهر الطلاب تلقائياً بمجرد مشاركتهم في اختباراتك.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student, index) => (
                    <tr key={`${student.id || 'std'}-${index}`} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.has(student.id)}
                          onChange={() => handleToggleSelectStudent(student.id)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-4 font-bold text-slate-500">{index + 1}</td>
                      <td className="p-4 font-bold text-slate-900">{student.name}</td>
                      <td className="p-4">
                        {student.code ? (
                          <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
                            <KeyRound size={13} className="text-indigo-600" />
                            <span className="font-mono font-black text-indigo-900">{student.code}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(student.code)}
                              className="text-indigo-400 hover:text-indigo-700 mr-1"
                              title="نسخ الكود"
                            >
                              {copiedCode === student.code ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleGenerateOrUpdateCode(student)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 shadow-xs transition-colors"
                          >
                            <Sparkles size={13} />
                            <span>إضافة كود</span>
                          </button>
                        )}
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => handleSendWhatsApp(student)}
                          className="bg-[#25D366] hover:bg-[#22bf5b] text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-transform active:scale-95"
                          title="إرسال الكود عبر الواتساب للطالب"
                        >
                          <MessageCircle size={15} />
                          <span>إرسال واتساب</span>
                        </button>
                      </td>
                      <td className="p-4 font-mono text-slate-600" dir="ltr">{student.phone}</td>
                      <td className="p-4 font-mono text-slate-600" dir="ltr">{student.parent_phone}</td>
                      <td className="p-4 text-slate-600 font-medium">
                        <span className="bg-slate-100 px-2.5 py-1 rounded-md text-xs">{student.center_name}</span>
                      </td>
                      <td className="p-4">
                        <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-md text-xs font-bold">
                          {student.exams_taken} اختبار
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => handleDeleteStudent(student)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 font-bold p-2 rounded-xl text-xs flex items-center justify-center transition-colors shadow-xs"
                          title="حذف حساب الطالب"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

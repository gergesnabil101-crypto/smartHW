import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  X, 
  Sparkles, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  CreditCard, 
  Info, 
  Atom, 
  BookOpen, 
  HelpCircle, 
  TrendingUp, 
  Zap, 
  Users, 
  CalendarDays, 
  Check, 
  ArrowRight,
  ShieldCheck,
  Layers
} from 'lucide-react';
import { TOKEN_PRICE_PER_MILLION } from '../../constants';

interface GradeRow {
  id: string;
  name: string;
  groupsCount: number;
  studentsPerGroup: number;
  sessionsPerWeek: number;
}

interface TokenCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (planDetails: {
    planId: string;
    tokensInMillions: number;
    monthlyPrice: number;
    yearlyPrice: number;
    detailsSummary: string;
  }) => void;
  initialSubject?: string;
}

export const TokenCalculatorModal: React.FC<TokenCalculatorModalProps> = ({
  isOpen,
  onClose,
  onSelectPlan,
  initialSubject = ''
}) => {
  // 1. Subject Category
  const isInitiallyScience = /رياضيات|علوم|فيزياء|كيمياء|أحياء|علمي|math|science|physics|chemistry|biology/i.test(initialSubject);
  const [subjectType, setSubjectType] = useState<'science' | 'theory'>(isInitiallyScience ? 'science' : 'theory');

  // AI Model: Flash 3.8 (200 EGP / 1M) vs Pro (250 EGP / 1M)
  const [selectedModel, setSelectedModel] = useState<'flash' | 'pro'>('flash');

  // Mode: Detailed (By Stages) vs Quick (Total numbers)
  const [calcMode, setCalcMode] = useState<'quick' | 'detailed'>('quick');

  // Quick Mode States
  const [quickTotalStudents, setQuickTotalStudents] = useState<number>(150);
  const [quickWeeklyQuizzes, setQuickWeeklyQuizzes] = useState<number>(1);
  const [quickWeeklyEssayCount, setQuickWeeklyEssayCount] = useState<number>(2);
  const [quickMonthlyExams, setQuickMonthlyExams] = useState<number>(1);
  const [quickMonthlyEssayCount, setQuickMonthlyEssayCount] = useState<number>(5);
  const [quickMcqCount, setQuickMcqCount] = useState<number>(10);

  // Detailed Mode States (Grade Levels)
  const [grades, setGrades] = useState<GradeRow[]>([
    { id: '1', name: 'الصف الأول الثانوي', groupsCount: 2, studentsPerGroup: 30, sessionsPerWeek: 2 },
    { id: '2', name: 'الصف الثاني الثانوي', groupsCount: 2, studentsPerGroup: 25, sessionsPerWeek: 2 },
    { id: '3', name: 'الصف الثالث الثانوي', groupsCount: 3, studentsPerGroup: 35, sessionsPerWeek: 3 },
  ]);
  const [detailedWeeklyQuizzes, setDetailedWeeklyQuizzes] = useState<number>(1);
  const [detailedWeeklyEssayCount, setDetailedWeeklyEssayCount] = useState<number>(2);
  const [detailedMonthlyExams, setDetailedMonthlyExams] = useState<number>(1);
  const [detailedMonthlyEssayCount, setDetailedMonthlyEssayCount] = useState<number>(5);
  const [detailedMcqCount, setDetailedMcqCount] = useState<number>(10);

  // Tokens factor per question type
  // Output tokens multiplier: 5x for Flash, 7x for Pro
  const outputMult = selectedModel === 'pro' ? 7 : 5;
  const tokensPerEssay = subjectType === 'science' 
    ? (450 + 100 * outputMult) 
    : (350 + 80 * outputMult);

  // Calculations
  const calculation = useMemo(() => {
    let totalStudents = 0;
    let totalGroups = 0;

    if (calcMode === 'quick') {
      totalStudents = Math.max(1, quickTotalStudents);
      totalGroups = Math.ceil(totalStudents / 25);
    } else {
      grades.forEach(g => {
        totalStudents += (Math.max(1, g.groupsCount) * Math.max(1, g.studentsPerGroup));
        totalGroups += Math.max(1, g.groupsCount);
      });
    }

    const weeklyQuizzes = calcMode === 'quick' ? quickWeeklyQuizzes : detailedWeeklyQuizzes;
    const weeklyEssayCount = calcMode === 'quick' ? quickWeeklyEssayCount : detailedWeeklyEssayCount;
    const monthlyExams = calcMode === 'quick' ? quickMonthlyExams : detailedMonthlyExams;
    const monthlyEssayCount = calcMode === 'quick' ? quickMonthlyEssayCount : detailedMonthlyEssayCount;
    const mcqCountPerQuiz = calcMode === 'quick' ? quickMcqCount : detailedMcqCount;

    // Monthly tests count per student
    const totalWeeklyTestsMonthly = weeklyQuizzes * 4;
    const totalMonthlyTests = monthlyExams;
    const totalTestsPerStudentMonthly = totalWeeklyTestsMonthly + totalMonthlyTests;

    // Total essay grading occurrences per month:
    // (Students * weekly quizzes in month * weekly essay questions) + (Students * monthly exams * monthly essay questions)
    const weeklyEssayAnswersMonthly = totalStudents * totalWeeklyTestsMonthly * weeklyEssayCount;
    const monthlyEssayAnswersMonthly = totalStudents * totalMonthlyTests * monthlyEssayCount;
    const totalEssayAnswersMonthly = weeklyEssayAnswersMonthly + monthlyEssayAnswersMonthly;

    // Total MCQ questions (0 tokens - 100% free)
    const totalMcqAnswersMonthly = totalStudents * totalTestsPerStudentMonthly * mcqCountPerQuiz;

    // Total tokens
    const rawTokens = totalEssayAnswersMonthly * tokensPerEssay;
    
    // Convert to millions (minimum 1.0M, rounded up to 1 decimal place or nice step)
    const exactMillions = rawTokens / 1_000_000;
    const recommendedMillions = Math.max(1, Math.ceil(exactMillions * 10) / 10);
    
    // Nearest standard packages: 1M, 2M, 3M, 5M, 8M, 10M, or exact
    let suggestedTier = 1;
    if (recommendedMillions <= 1) suggestedTier = 1;
    else if (recommendedMillions <= 2) suggestedTier = 2;
    else if (recommendedMillions <= 3) suggestedTier = 3;
    else if (recommendedMillions <= 5) suggestedTier = 5;
    else if (recommendedMillions <= 8) suggestedTier = 8;
    else if (recommendedMillions <= 10) suggestedTier = 10;
    else suggestedTier = Math.ceil(recommendedMillions);

    const pricePerMillion = selectedModel === 'pro' ? 250 : (TOKEN_PRICE_PER_MILLION || 200);
    const monthlyPrice = Math.round(suggestedTier * pricePerMillion);
    const yearlyPrice = Math.round(monthlyPrice * 10); // 2 months discount free
    const yearlySavings = Math.round(monthlyPrice * 2);

    const costPerStudentMonthly = totalStudents > 0 ? (monthlyPrice / totalStudents).toFixed(2) : '0';
    const costPerStudentPerExam = (totalStudents > 0 && totalTestsPerStudentMonthly > 0) 
      ? (monthlyPrice / (totalStudents * totalTestsPerStudentMonthly)).toFixed(2) 
      : '0';

    return {
      totalStudents,
      totalGroups,
      totalWeeklyTestsMonthly,
      totalMonthlyTests,
      weeklyEssayCount,
      monthlyEssayCount,
      weeklyEssayAnswersMonthly,
      monthlyEssayAnswersMonthly,
      totalTestsPerStudentMonthly,
      totalEssayAnswersMonthly,
      totalMcqAnswersMonthly,
      exactMillions: exactMillions.toFixed(2),
      suggestedTier,
      monthlyPrice,
      yearlyPrice,
      yearlySavings,
      pricePerMillion,
      costPerStudentMonthly,
      costPerStudentPerExam,
      selectedModel
    };
  }, [
    calcMode,
    quickTotalStudents,
    quickWeeklyQuizzes,
    quickWeeklyEssayCount,
    quickMonthlyExams,
    quickMonthlyEssayCount,
    quickMcqCount,
    grades,
    detailedWeeklyQuizzes,
    detailedWeeklyEssayCount,
    detailedMonthlyExams,
    detailedMonthlyEssayCount,
    detailedMcqCount,
    subjectType,
    tokensPerEssay,
    selectedModel
  ]);

  if (!isOpen) return null;

  const handleAddGrade = () => {
    setGrades([
      ...grades,
      {
        id: Date.now().toString(),
        name: `مرحلة جديدة ${grades.length + 1}`,
        groupsCount: 2,
        studentsPerGroup: 30,
        sessionsPerWeek: 2
      }
    ]);
  };

  const handleRemoveGrade = (id: string) => {
    if (grades.length <= 1) {
      alert('يجب أن تحتوي الحاسبة على مرحلة واحدة على الأقل.');
      return;
    }
    setGrades(grades.filter(g => g.id !== id));
  };

  const handleUpdateGrade = (id: string, field: keyof GradeRow, val: any) => {
    setGrades(grades.map(g => g.id === id ? { ...g, [field]: val } : g));
  };

  const handleConfirmPlan = () => {
    const summary = `باقة التوكنز الذكية (${calculation.suggestedTier} مليون توكن/شهر) - لعدد ${calculation.totalStudents} طالب و${calculation.totalTestsPerStudentMonthly} اختبارات شهرياً (${calculation.totalEssayAnswersMonthly} إجابة مقالية)`;
    
    onSelectPlan({
      planId: `custom_token_${calculation.suggestedTier}M`,
      tokensInMillions: calculation.suggestedTier,
      monthlyPrice: calculation.monthlyPrice,
      yearlyPrice: calculation.yearlyPrice,
      detailsSummary: summary
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[110] flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl p-4 sm:p-7 max-w-4xl w-full shadow-2xl text-right overflow-y-auto max-h-[92vh] border border-slate-100 my-auto animate-in zoom-in-95 duration-200"
        
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-5 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 text-white p-2.5 rounded-2xl shadow-md">
                <Calculator size={22} />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 flex flex-wrap items-center gap-2">
                  حاسبة التوكنز والاشتراك التقديري
                  <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-black">
                    {calculation.pricePerMillion} ج.م / مليون توكن ({selectedModel === 'pro' ? 'برو' : 'فلاش 3.8'})
                  </span>
                  <span className="bg-purple-100 text-purple-800 text-[11px] px-2.5 py-0.5 rounded-full font-black border border-purple-200">
                    مضاعف المخرجات: × {selectedModel === 'pro' ? '6' : '5'} بصرامة
                  </span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  حدد عدد طلابك ومعدل اختباراتك المقالية، وسيقوم النظام باحتساب حجم التوكنز الفعلي والباقة الأوفر لك بدقة.
                </p>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        {/* Top Control Bar: Model, Subject Type & Calculation Depth Mode */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {/* AI Model Toggle */}
          <div className="bg-slate-50 p-2 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[11px] font-bold text-slate-500">محرك الذكاء الاصطناعي:</span>
              <span className="text-[10px] font-black text-indigo-700">{calculation.pricePerMillion} ج.م / 1M</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedModel('flash')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                  selectedModel === 'flash'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/60'
                }`}
                title="فلاش 3.8: 200 ج.م لكل مليون توكن"
              >
                <Zap size={14} />
                <span>فلاش 3.8 (200 ج.م)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedModel('pro')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                  selectedModel === 'pro'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/60'
                }`}
                title="جيميناي برو: 250 ج.م لكل مليون توكن"
              >
                <Sparkles size={14} />
                <span>برو (250 ج.م)</span>
              </button>
            </div>
          </div>

          {/* Subject Type Toggle */}
          <div className="bg-slate-50 p-2 rounded-2xl border border-slate-200/80">
            <span className="block text-[11px] font-bold text-slate-500 mb-1.5 px-1">تخصص المادة الدراسية:</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setSubjectType('science')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                  subjectType === 'science'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                <Atom size={14} />
                <span>علمي / رياضيات</span>
              </button>

              <button
                type="button"
                onClick={() => setSubjectType('theory')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                  subjectType === 'theory'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                <BookOpen size={14} />
                <span>نظري / لغات</span>
              </button>
            </div>
          </div>

          {/* Calc Depth Mode: Quick vs Detailed */}
          <div className="bg-slate-50 p-2 rounded-2xl border border-slate-200/80">
            <span className="block text-[11px] font-bold text-slate-500 mb-1.5 px-1">طريقة الإدخال:</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setCalcMode('quick')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                  calcMode === 'quick'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                <Zap size={14} />
                <span>حساب سريع</span>
              </button>

              <button
                type="button"
                onClick={() => setCalcMode('detailed')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                  calcMode === 'detailed'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                <Layers size={14} />
                <span>تفصيل بالمراحل</span>
              </button>
            </div>
          </div>
        </div>

        {/* Input Controls Section */}
        <div className="space-y-5 mb-6">
          {calcMode === 'quick' ? (
            /* QUICK MODE INPUTS */
            <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-4">
              {/* Total Students Slider & Quick Select */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                    <Users size={16} className="text-indigo-600" />
                    <span>إجمالي عدد طلابك في جميع المراحل والمجموعات:</span>
                  </label>
                  <span className="bg-indigo-100 text-indigo-800 text-sm sm:text-base font-black px-3 py-0.5 rounded-xl">
                    {quickTotalStudents} طالب
                  </span>
                </div>

                <input 
                  type="range"
                  min="20"
                  max="1500"
                  step="10"
                  value={quickTotalStudents}
                  onChange={(e) => setQuickTotalStudents(parseInt(e.target.value) || 20)}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />

                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {[50, 100, 200, 350, 500, 800, 1200].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setQuickTotalStudents(cnt)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                        quickTotalStudents === cnt 
                          ? 'bg-indigo-600 text-white border-indigo-600' 
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cnt} طالب
                    </button>
                  ))}
                </div>
              </div>

              {/* Tests & Questions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-200">
                {/* Weekly Quizzes */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    كويزات أسبوعية:
                  </label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      min="0" 
                      max="7" 
                      value={quickWeeklyQuizzes}
                      onChange={(e) => setQuickWeeklyQuizzes(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-800 text-center"
                    />
                    <span className="text-xs text-slate-500 font-medium shrink-0">/ أسبوع</span>
                  </div>
                </div>

                {/* Essay Questions per Weekly Quiz */}
                <div className="bg-white p-3 rounded-xl border-2 border-indigo-400/80 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-black text-indigo-950">
                      مقالي في الأسبوعي:
                    </label>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded font-bold">كويز</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      min="0" 
                      max="30" 
                      value={quickWeeklyEssayCount}
                      onChange={(e) => setQuickWeeklyEssayCount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-indigo-50/50 border border-indigo-300 rounded-lg px-2 py-1.5 text-sm font-black text-indigo-950 text-center"
                    />
                    <span className="text-xs text-slate-500 font-medium shrink-0">سؤال</span>
                  </div>
                </div>

                {/* Monthly Comprehensive Exams */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    امتحانات شهرية:
                  </label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      min="0" 
                      max="5" 
                      value={quickMonthlyExams}
                      onChange={(e) => setQuickMonthlyExams(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-800 text-center"
                    />
                    <span className="text-xs text-slate-500 font-medium shrink-0">/ شهر</span>
                  </div>
                </div>

                {/* Essay Questions per Monthly Exam */}
                <div className="bg-white p-3 rounded-xl border-2 border-purple-400/80 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-black text-purple-950">
                      مقالي في الشهري:
                    </label>
                    <span className="text-[10px] bg-purple-50 text-purple-700 px-1 py-0.5 rounded font-bold">شامل</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      min="0" 
                      max="50" 
                      value={quickMonthlyEssayCount}
                      onChange={(e) => setQuickMonthlyEssayCount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-purple-50/50 border border-purple-300 rounded-lg px-2 py-1.5 text-sm font-black text-purple-950 text-center"
                    />
                    <span className="text-xs text-slate-500 font-medium shrink-0">سؤال</span>
                  </div>
                </div>

                {/* MCQ Questions per test (Free) */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-600">
                      أسئلة الاختياري:
                    </label>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-black">0 توكن</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      min="0" 
                      max="100" 
                      value={quickMcqCount}
                      onChange={(e) => setQuickMcqCount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-800 text-center"
                    />
                    <span className="text-xs text-slate-500 font-medium shrink-0">سؤال</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* DETAILED GRADE-LEVELS MODE */
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                    <Layers size={16} className="text-indigo-600" />
                    تفاصيل المراحل والمجموعات الدراسية:
                  </span>
                  <button
                    type="button"
                    onClick={handleAddGrade}
                    className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-colors"
                  >
                    <Plus size={14} />
                    <span>إضافة مرحلة</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {grades.map((grade, gIdx) => {
                    const stageTotalStudents = grade.groupsCount * grade.studentsPerGroup;
                    return (
                      <div key={grade.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center gap-3">
                        <div className="flex-1 w-full md:w-auto">
                          <input 
                            type="text" 
                            value={grade.name}
                            onChange={(e) => handleUpdateGrade(grade.id, 'name', e.target.value)}
                            placeholder="اسم المرحلة / الصف"
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold text-slate-800"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2 w-full md:w-auto shrink-0">
                          <div>
                            <span className="block text-[10px] text-slate-500 font-bold mb-0.5">عدد المجموعات</span>
                            <input 
                              type="number" 
                              min="1" 
                              value={grade.groupsCount}
                              onChange={(e) => handleUpdateGrade(grade.id, 'groupsCount', Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-center"
                            />
                          </div>

                          <div>
                            <span className="block text-[10px] text-slate-500 font-bold mb-0.5">طلاب المجموعة</span>
                            <input 
                              type="number" 
                              min="1" 
                              value={grade.studentsPerGroup}
                              onChange={(e) => handleUpdateGrade(grade.id, 'studentsPerGroup', Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-center"
                            />
                          </div>

                          <div>
                            <span className="block text-[10px] text-slate-500 font-bold mb-0.5">إجمالي الطلاب</span>
                            <div className="w-20 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg px-2 py-1 text-xs font-black text-center">
                              {stageTotalStudents}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveGrade(grade.id)}
                          className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          title="حذف المرحلة"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detailed Test Config */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">كويزات أسبوعية:</label>
                  <input 
                    type="number" min="0" value={detailedWeeklyQuizzes}
                    onChange={(e) => setDetailedWeeklyQuizzes(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-center"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-xl border-2 border-indigo-400">
                  <label className="block text-[11px] font-black text-indigo-950 mb-1">مقالي في الأسبوعي:</label>
                  <input 
                    type="number" min="0" value={detailedWeeklyEssayCount}
                    onChange={(e) => setDetailedWeeklyEssayCount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-indigo-50 border border-indigo-300 rounded-lg p-1.5 text-xs font-black text-indigo-950 text-center"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">امتحانات شهرية:</label>
                  <input 
                    type="number" min="0" value={detailedMonthlyExams}
                    onChange={(e) => setDetailedMonthlyExams(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-center"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-xl border-2 border-purple-400">
                  <label className="block text-[11px] font-black text-purple-950 mb-1">مقالي في الشهري:</label>
                  <input 
                    type="number" min="0" value={detailedMonthlyEssayCount}
                    onChange={(e) => setDetailedMonthlyEssayCount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-purple-50 border border-purple-300 rounded-lg p-1.5 text-xs font-black text-purple-950 text-center"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">أسئلة اختياري (مجانية):</label>
                  <input 
                    type="number" min="0" value={detailedMcqCount}
                    onChange={(e) => setDetailedMcqCount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-center"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Calculation Output Card (Results & Recommendation) */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-indigo-500/30 relative overflow-hidden mb-5">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            {/* KPI Badges Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-6">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
                <span className="block text-[10px] text-indigo-200 font-bold mb-0.5">إجمالي الطلاب</span>
                <span className="text-lg sm:text-xl font-black text-white">{calculation.totalStudents} طالب</span>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
                <span className="block text-[10px] text-indigo-200 font-bold mb-0.5">اختبارات شهرياً</span>
                <span className="text-lg sm:text-xl font-black text-white">{calculation.totalTestsPerStudentMonthly} اختبار/طالب</span>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
                <span className="block text-[10px] text-indigo-200 font-bold mb-0.5">إجابات مقالية مصححة</span>
                <span className="text-lg sm:text-xl font-black text-emerald-300">{calculation.totalEssayAnswersMonthly.toLocaleString()} إجابة</span>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
                <span className="block text-[10px] text-indigo-200 font-bold mb-0.5">استهلاك التوكنز الفعلي</span>
                <span className="text-lg sm:text-xl font-black text-amber-300">{calculation.exactMillions}M توكن</span>
              </div>
            </div>

            {/* Recommendation & Price Card */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 sm:p-5 border border-white/20 flex flex-col md:flex-row items-center justify-between gap-5">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full font-black border border-emerald-400/30 mb-2">
                  <Sparkles size={13} />
                  <span>الباقة المقترحة لاحتياجك الفعلي:</span>
                </div>
                <h4 className="text-2xl sm:text-3xl font-black text-white">
                  باقة {calculation.suggestedTier} مليون توكن شهرياً
                </h4>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  تكفي وتغطي تصحيح حتى <strong className="text-white">{(calculation.suggestedTier * 1_000_000 / tokensPerEssay).toLocaleString()} سؤال مقالي كامل</strong> بدقة الذكاء الاصطناعي الفائقة.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-indigo-200">
                  <span className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                    <CheckCircle2 size={13} className="text-emerald-400" />
                    تكلفة الطالب شهرياً: <strong>{calculation.costPerStudentMonthly} ج.م فقط</strong>
                  </span>
                  <span className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                    <CheckCircle2 size={13} className="text-emerald-400" />
                    تكلفة تصحيح الامتحان للطالب: <strong>{calculation.costPerStudentPerExam} ج.م</strong>
                  </span>
                </div>
              </div>

              {/* Price Tag & CTA */}
              <div className="text-center md:text-left shrink-0 w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-white/10">
                <div className="text-3xl sm:text-4xl font-black text-emerald-400 flex items-baseline justify-center md:justify-end gap-1.5">
                  <span>{calculation.monthlyPrice}</span>
                  <span className="text-base text-slate-300 font-bold">ج.م / شهر</span>
                </div>
                <div className="text-xs text-indigo-200 mt-1 font-medium">
                  أو {calculation.yearlyPrice} ج.م سنوياً (وفر شهرين مجاناً)
                </div>

                <button
                  type="button"
                  onClick={handleConfirmPlan}
                  className="mt-3.5 w-full md:w-auto px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-sm sm:text-base rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
                >
                  <CreditCard size={18} />
                  <span>تأكيد واختيار هذه الباقة</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Value Proposition & Reassurance Footer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 text-xs">
            <span className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              الأسئلة الاختيارية مجانية 100%
            </span>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              تصحيح أسئلة الاختيار من متعدد وصح وخطأ يتم محلياً دون أي خصم من رصيد التوكنز.
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 text-xs">
            <span className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
              <Zap size={14} className="text-indigo-600 shrink-0" />
              مرونة وتجديد في أي وقت
            </span>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              يمكنك شحن رصيد إضافي (Top-up) أو ترقية باقتك متى زاد عدد طلابك بكل سهولة.
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 text-xs">
            <span className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
              <ShieldCheck size={14} className="text-purple-600 shrink-0" />
              تصحيح فائق الدقة بالخطوات
            </span>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              يقوم الذكاء الاصطناعي بتوزيع الدرجات على خطوات الحل والمعادلات مع تغذية راجعة كاملة.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Subscription plans — ported from the web app's src/constants.ts (single source of truth there)
export interface PlanOption {
  id: string;
  name: string;
  group: 'theory' | 'science' | 'tokens' | 'pro_tokens';
  monthlyPrice: number;
  yearlyPrice: number;
  popular?: boolean;
  features: string[];
}

export const PLANS: PlanOption[] = [
  // المواد النظرية واللغات
  { id: 'theory_200', name: 'الباقة الأساسية', group: 'theory', monthlyPrice: 200, yearlyPrice: 2000,
    features: ['أسئلة اختيار وصح/خطأ غير محدودة', 'تصحيح فوري لكل الطلاب', 'طلاب واختبارات ومجلدات بلا حدود', 'تقارير نتائج تفصيلية', 'بدون أسئلة مقالية'] },
  { id: 'theory_250', name: 'الباقة المتقدمة', group: 'theory', monthlyPrice: 250, yearlyPrice: 2500, popular: true,
    features: ['كل مميزات الأساسية', 'حتى 5 أسئلة مقالية لكل اختبار', 'تصحيح AI مع درجات الخطوات', 'استخراج أسئلة من Word وصور', 'إرسال واتساب جماعي'] },
  { id: 'theory_300', name: 'الباقة الاحترافية', group: 'theory', monthlyPrice: 300, yearlyPrice: 3000,
    features: ['كل مميزات المتقدمة', 'حتى 15 سؤال مقالي لكل اختبار', 'استخراج غير محدود من PDF ممسوح', 'مراجعة شاملة للإجابات المقالية'] },

  // المواد العلمية والرياضيات
  { id: 'science_250', name: 'الأساسية العلمية', group: 'science', monthlyPrice: 250, yearlyPrice: 2500,
    features: ['أسئلة علمية ورياضية', 'نموذج Gemini Pro للاستدلال العلمي', 'معادلات ورموز فيزيائية وكيميائية', 'قص الرسومات الهندسية تلقائياً', 'طلاب واختبارات بلا حدود'] },
  { id: 'science_500', name: 'المتقدمة العلمية', group: 'science', monthlyPrice: 500, yearlyPrice: 5000, popular: true,
    features: ['كل مميزات الأساسية العلمية', 'حتى 5 مسائل/أسئلة مقالية مع خطوات الحل', 'توزيع الدرجات على خطوات الحل', 'استخراج فائق للرسومات البيانية'] },
  { id: 'science_750', name: 'الاحترافية العلمية', group: 'science', monthlyPrice: 750, yearlyPrice: 7500,
    features: ['كل مميزات المتقدمة العلمية', 'حتى 15 مسألة مقالية لكل اختبار', 'استخراج عالي الدقة من الكتب الممسوحة', 'أولوية معالجة ودعم فني خاص'] },

  // باقات توكنز — فلاش (200 ج/مليون)
  { id: 'token_1M', name: 'باقة 1 مليون توكن', group: 'tokens', monthlyPrice: 200, yearlyPrice: 2000,
    features: ['تكفي ~2,000 إجابة مقالية شهرياً', 'نموذج فلاش فائق السرعة'] },
  { id: 'token_2M', name: 'باقة 2 مليون توكن', group: 'tokens', monthlyPrice: 400, yearlyPrice: 4000, popular: true,
    features: ['تكفي ~4,000 إجابة مقالية شهرياً', 'نموذج فلاش فائق السرعة'] },
  { id: 'token_3M', name: 'باقة 3 مليون توكن', group: 'tokens', monthlyPrice: 600, yearlyPrice: 6000,
    features: ['تكفي ~6,000 إجابة مقالية شهرياً', 'نموذج فلاش فائق السرعة'] },
  { id: 'token_5M', name: 'باقة 5 مليون توكن', group: 'tokens', monthlyPrice: 1000, yearlyPrice: 10000,
    features: ['تكفي ~10,000 إجابة مقالية شهرياً', 'نموذج فلاش فائق السرعة'] },
  { id: 'token_10M', name: 'باقة 10 مليون توكن (مراكز)', group: 'tokens', monthlyPrice: 2000, yearlyPrice: 20000,
    features: ['تكفي +20,000 إجابة مقالية شهرياً', 'نموذج فلاش فائق السرعة'] },

  // باقات توكنز — برو (250 ج/مليون)
  { id: 'pro_token_1M', name: '1 مليون توكن برو 👑', group: 'pro_tokens', monthlyPrice: 250, yearlyPrice: 2500,
    features: ['استدلال وتفكير عميق (Gemini Pro)', 'تكفي ~1,600 إجابة مقالية شهرياً'] },
  { id: 'pro_token_2M', name: '2 مليون توكن برو 👑', group: 'pro_tokens', monthlyPrice: 500, yearlyPrice: 5000, popular: true,
    features: ['استدلال وتفكير عميق (Gemini Pro)', 'تكفي ~3,200 إجابة مقالية شهرياً'] },
  { id: 'pro_token_3M', name: '3 مليون توكن برو 👑', group: 'pro_tokens', monthlyPrice: 750, yearlyPrice: 7500,
    features: ['استدلال وتفكير عميق (Gemini Pro)', 'تكفي ~4,800 إجابة مقالية شهرياً'] },
  { id: 'pro_token_5M', name: '5 مليون توكن برو 👑', group: 'pro_tokens', monthlyPrice: 1250, yearlyPrice: 12500,
    features: ['استدلال وتفكير عميق (Gemini Pro)', 'تكفي ~8,000 إجابة مقالية شهرياً'] },
  { id: 'pro_token_10M', name: '10 مليون توكن برو 👑 (مراكز)', group: 'pro_tokens', monthlyPrice: 2500, yearlyPrice: 25000,
    features: ['استدلال وتفكير عميق (Gemini Pro)', 'تكفي +16,000 إجابة مقالية شهرياً'] },
];

export const PLAN_GROUPS: { key: PlanOption['group']; title: string }[] = [
  { key: 'theory', title: 'باقات المواد النظرية واللغات' },
  { key: 'science', title: 'باقات المواد العلمية والرياضيات' },
  { key: 'tokens', title: 'باقات التوكنز — فلاش ⚡' },
  { key: 'pro_tokens', title: 'باقات التوكنز — برو 👑' },
];

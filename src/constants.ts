import { SubscriptionPlan } from './types';

export const TRIAL_DAYS = 5; // عدد الأيام التجريبية للمشتركين الجدد
export const TRIAL_DAILY_TOKENS = 30000; // الحد اليومي لاستخدام التوكنز في الفترة المجانية (30 ألف توكنز)

export const GRADE_LEVELS = [
  { label: 'الصف الأول الابتدائي', value: 'primary_1', group: 'المرحلة الابتدائية' },
  { label: 'الصف الثاني الابتدائي', value: 'primary_2', group: 'المرحلة الابتدائية' },
  { label: 'الصف الثالث الابتدائي', value: 'primary_3', group: 'المرحلة الابتدائية' },
  { label: 'الصف الرابع الابتدائي', value: 'primary_4', group: 'المرحلة الابتدائية' },
  { label: 'الصف الخامس الابتدائي', value: 'primary_5', group: 'المرحلة الابتدائية' },
  { label: 'الصف السادس الابتدائي', value: 'primary_6', group: 'المرحلة الابتدائية' },
  { label: 'الصف الأول الإعدادي', value: 'prep_1', group: 'المرحلة الإعدادية' },
  { label: 'الصف الثاني الإعدادي', value: 'prep_2', group: 'المرحلة الإعدادية' },
  { label: 'الصف الثالث الإعدادي', value: 'prep_3', group: 'المرحلة الإعدادية' },
  { label: 'الصف الأول الثانوي', value: 'sec_1', group: 'المرحلة الثانوية' },
  { label: 'الصف الثاني الثانوي', value: 'sec_2', group: 'المرحلة الثانوية' },
  { label: 'الصف الثالث الثانوي', value: 'sec_3', group: 'المرحلة الثانوية' },
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  // باقات المواد النظرية واللغات (200 / 250 / 300 ج.م)
  {
    id: 'theory_200',
    legacyId: '200',
    category: 'theory',
    categoryName: 'المواد النظرية واللغات',
    categoryShort: 'مواد نظرية ولغات',
    name: 'الباقة الأساسية',
    fullName: 'الباقة الأساسية - مواد نظرية ولغات',
    monthlyPrice: 200,
    yearlyPrice: 2000,
    yearlyDiscount: 400,
    popular: false,
    color: 'slate',
    badge: 'الأساسية',
    features: [
      'أسئلة اختيار من متعدد وصح وخطأ غير محدودة',
      'تصحيح إلكتروني فوري وشامل لجميع الطلاب',
      'عدد غير محدود من الطلاب والامتحانات والفولدرات',
      'تقارير نتائج وإحصائيات تفصيلية للدرجات',
      'مخصصة للمواد النظرية واللغات'
    ],
    essayLimit: 0,
    essayText: 'لا تشمل أسئلة مقالية',
    targetAudience: 'اللغة العربية، الإنجليزية، الدراسات، اللغات، التاريخ، الفلسفة...'
  },
  {
    id: 'theory_250',
    legacyId: '250',
    category: 'theory',
    categoryName: 'المواد النظرية واللغات',
    categoryShort: 'مواد نظرية ولغات',
    name: 'الباقة المتقدمة',
    fullName: 'الباقة المتقدمة - مواد نظرية ولغات',
    monthlyPrice: 250,
    yearlyPrice: 2500,
    yearlyDiscount: 500,
    popular: true,
    color: 'indigo',
    badge: 'الأكثر طلباً ⭐',
    features: [
      'جميع مميزات الباقة الأساسية',
      'دعم حتى 5 أسئلة مقالية لكل اختبار',
      'تصحيح ذكي فوري بالذكاء الاصطناعي مع تقدير درجات الخطوات',
      'استخراج الأسئلة من مستندات Word وصور المذكرات',
      'شهادات تقدير فورية للطلاب وإرسال واتساب جماعي',
      'مدعومة بنموذج Gemini Flash فائق السرعة والدقة للمواد النظرية واللغات'
    ],
    essayLimit: 5,
    essayText: '5 أسئلة مقالية لكل اختبار',
    targetAudience: 'المعلم المتميز في المواد الأدبية واللغات'
  },
  {
    id: 'theory_300',
    legacyId: '300',
    category: 'theory',
    categoryName: 'المواد النظرية واللغات',
    categoryShort: 'مواد نظرية ولغات',
    name: 'الباقة الاحترافية',
    fullName: 'الباقة الاحترافية - مواد نظرية ولغات',
    monthlyPrice: 300,
    yearlyPrice: 3000,
    yearlyDiscount: 600,
    popular: false,
    color: 'purple',
    badge: 'الاحترافية الشاملة',
    features: [
      'جميع مميزات الباقة المتقدمة',
      'دعم حتى 15 سؤال مقالي وتعبيري لكل اختبار',
      'استخراج متقدم وغير محدود من ملفات PDF الممسوحة ضوئياً',
      'تصحيح ومراجعة شاملة لإجابات الطلاب المقالية والتعبيرية',
      'معالجة فائقة السرعة بنموذج Gemini Flash'
    ],
    essayLimit: 15,
    essayText: '15 سؤال مقالي لكل اختبار',
    targetAudience: 'مراكز التدريب والمدرسين ذوي الكثافات العالية'
  },

  // باقات المواد العلمية والرياضيات (250 / 500 / 750 ج.م)
  {
    id: 'science_250',
    category: 'science',
    categoryName: 'المواد العلمية والرياضيات (عربي / لغات)',
    categoryShort: 'مواد علمية ورياضيات',
    name: 'الباقة الأساسية العلمية',
    fullName: 'الباقة الأساسية - مواد علمية ورياضيات',
    monthlyPrice: 250,
    yearlyPrice: 2500,
    yearlyDiscount: 500,
    popular: false,
    color: 'emerald',
    badge: 'الأساسية العلمية',
    features: [
      'أسئلة اختيار من متعدد وصح وخطأ للمسائل العلمية والرياضية',
      'مدعومة بنموذج Gemini Pro المتخصص في التفكير العلمي والاستدلال الرياضي',
      'دعم الرموز والمعادلات الرياضية والكيميائية والفيزيائية',
      'استخراج وقص الرسومات الهندسية والأشكال التوضيحية تلقائياً',
      'دعم كامل لمدارس اللغات والمدارس العربية (Math, Science, Physics, Chemistry, Biology)',
      'عدد غير محدود من الطلاب والامتحانات'
    ],
    essayLimit: 0,
    essayText: 'لا تشمل مسائل مقالية',
    targetAudience: 'معلمي الرياضيات والعلوم والفيزياء والكيمياء والأحياء (عربي ولغات)'
  },
  {
    id: 'science_500',
    category: 'science',
    categoryName: 'المواد العلمية والرياضيات (عربي / لغات)',
    categoryShort: 'مواد علمية ورياضيات',
    name: 'الباقة المتقدمة العلمية',
    fullName: 'الباقة المتقدمة - مواد علمية ورياضيات',
    monthlyPrice: 500,
    yearlyPrice: 5000,
    yearlyDiscount: 1000,
    popular: true,
    color: 'teal',
    badge: 'الأكثر تميزاً ⭐',
    features: [
      'جميع مميزات الباقة الأساسية العلمية',
      'مدعومة بنموذج Gemini Pro عالي الدقة لحل المسائل وتوزيع الدرجات على الخطوات',
      'دعم حتى 5 مسائل حسابية / أسئلة مقالية مع خطوات الحل لكل اختبار',
      'تصحيح ذكي فائق الدقة للمسائل الرياضية وتوزيع الدرجات على خطوات الحل',
      'استخراج وقص تلقائي فائق للرسومات البيانية والدوائر والأشكال الهندسية',
      'دعم متقدم للغات والمصطلحات الإنجليزية والفرنسية والرموز العلمية'
    ],
    essayLimit: 5,
    essayText: '5 مسائل / أسئلة مقالية مع خطوات الحل',
    targetAudience: 'معلمي المواد العلمية والرياضيات للمرحلتين الإعدادية والثانوية'
  },
  {
    id: 'science_750',
    category: 'science',
    categoryName: 'المواد العلمية والرياضيات (عربي / لغات)',
    categoryShort: 'مواد علمية ورياضيات',
    name: 'الباقة الاحترافية العلمية',
    fullName: 'الباقة الاحترافية - مواد علمية ورياضيات',
    monthlyPrice: 750,
    yearlyPrice: 7500,
    yearlyDiscount: 1500,
    popular: false,
    color: 'cyan',
    badge: 'الاحترافية العلمية الشاملة',
    features: [
      'جميع مميزات الباقة المتقدمة العلمية',
      'دعم حتى 15 مسألة رياضية / علمية مقالية لكل اختبار',
      'استخراج عالي الدقة من الكتب والمذكرات الممسوحة ضوئياً وملفات PDF',
      'معالجة الرموز والرسومات والأشكال المعقدة',
      'أولوية معالجة وسرعة فائقة في التصحيح',
      'دعم فني خاص وتدريب على النظام'
    ],
    essayLimit: 15,
    essayText: '15 مسألة / سؤال مقالي لكل اختبار',
    targetAudience: 'كبار معلمي ومراكز الثانوية العامة للعلوم والرياضيات'
  }
];

export const TOKEN_PRICE_PER_MILLION = 200; // Default 200 EGP per 1 Million Tokens (Flash)
export const FLASH_PRICE_PER_MILLION = 200; // 200 EGP per 1 Million Tokens (Gemini 3.8 Flash)
export const PRO_PRICE_PER_MILLION = 250;   // 250 EGP per 1 Million Tokens (Gemini Pro)

export type AiModelType = 'flash' | 'pro';

export interface AiModelConfig {
  id: string;
  type: AiModelType;
  name: string;
  shortName: string;
  badge: string;
  description: string;
  pricePerMillion: number;
  outputMultiplier: number;
  speed: string;
  features: string[];
}

export const AI_MODELS: Record<AiModelType, AiModelConfig> = {
  flash: {
    id: 'gemini-3.8-flash',
    type: 'flash',
    name: 'Gemini 3.8 Flash',
    shortName: 'فلاش 3.8',
    badge: 'فلاش 3.8 (الأسرع والأوفر)',
    description: 'النموذج الافتراضي فائق السرعة وموفر في استهلاك الرصيد، مثالي لجميع المواد والتصحيح اللحظي.',
    pricePerMillion: FLASH_PRICE_PER_MILLION, // 200 EGP
    outputMultiplier: 5,
    speed: 'فائق السرعة ولحظي',
    features: [
      'تسعيرة موفرة: 200 جنيه لكل 1 مليون توكن',
      'سرعة فائقة واستجابة فورية للطلاب',
      'ممتاز لجميع الاختبارات الدورية وتوليد الأسئلة',
      'معدل احتساب المخرجات: 5 أضعاف توكن المدخلات'
    ]
  },
  pro: {
    id: 'gemini-3.1-pro-preview',
    type: 'pro',
    name: 'Gemini Pro',
    shortName: 'جيميناي برو',
    badge: 'جيميناي برو (استدلال وتفكير عميق)',
    description: 'نموذج الاستدلال الأكاديمي المتقدم، مثالي للمسائل الرياضية والفيزيائية المعقدة والتحليل العلمي الدقيق.',
    pricePerMillion: PRO_PRICE_PER_MILLION, // 250 EGP
    outputMultiplier: 6,
    speed: 'متوسط (تحليل واستدلال معمّق)',
    features: [
      'تسعيرة احترافية: 250 جنيه لكل 1 مليون توكن',
      'دقة استثنائية في المسائل المركبة والخطوات متعددة المراحل',
      'فهم عميق للتراكيب النحوية والبلاغية والرموز العلمية الدقيقة',
      'معدل احتساب المخرجات: 6 أضعاف توكن المدخلات'
    ]
  }
};

export const getModelPricePerMillion = (modelType?: AiModelType | string): number => {
  if (modelType === 'pro' || modelType === 'gemini-3.1-pro-preview' || modelType === 'gemini-2.5-pro') {
    return PRO_PRICE_PER_MILLION;
  }
  return FLASH_PRICE_PER_MILLION;
};

export interface TokenPlan {
  id: string;
  millions: number;
  monthlyPrice: number;
  yearlyPrice: number;
  name: string;
  description: string;
  popular?: boolean;
}

export const TOKEN_PRESET_PLANS: TokenPlan[] = [
  {
    id: 'token_1M',
    millions: 1,
    monthlyPrice: 200,
    yearlyPrice: 2000,
    name: 'باقة 1 مليون توكن',
    description: 'تكفي حتى 2,000 إجابة مقالية مصححة شهرياً'
  },
  {
    id: 'token_2M',
    millions: 2,
    monthlyPrice: 400,
    yearlyPrice: 4000,
    name: 'باقة 2 مليون توكن',
    description: 'تكفي حتى 4,000 إجابة مقالية مصححة شهرياً',
    popular: true
  },
  {
    id: 'token_3M',
    millions: 3,
    monthlyPrice: 600,
    yearlyPrice: 6000,
    name: 'باقة 3 مليون توكن',
    description: 'تكفي حتى 6,000 إجابة مقالية مصححة شهرياً'
  },
  {
    id: 'token_5M',
    millions: 5,
    monthlyPrice: 1000,
    yearlyPrice: 10000,
    name: 'باقة 5 مليون توكن',
    description: 'تكفي حتى 10,000 إجابة مقالية مصححة شهرياً'
  },
  {
    id: 'token_10M',
    millions: 10,
    monthlyPrice: 2000,
    yearlyPrice: 20000,
    name: 'باقة 10 مليون توكن (سناتر ومراكز كبرى)',
    description: 'تكفي حتى 20,000+ إجابة مقالية مصححة شهرياً'
  }
];

export const PRO_TOKEN_PRESET_PLANS: TokenPlan[] = [
  {
    id: 'pro_token_1M',
    millions: 1,
    monthlyPrice: 250,
    yearlyPrice: 2500,
    name: 'باقة 1 مليون توكن (برو)',
    description: 'استدلال وتفكير عميق، تكفي حتى 1,600 إجابة مقالية مصححة شهرياً (المخرجات × 6)'
  },
  {
    id: 'pro_token_2M',
    millions: 2,
    monthlyPrice: 500,
    yearlyPrice: 5000,
    name: 'باقة 2 مليون توكن (برو)',
    description: 'استدلال وتفكير عميق، تكفي حتى 3,200 إجابة مقالية مصححة شهرياً (المخرجات × 6)',
    popular: true
  },
  {
    id: 'pro_token_3M',
    millions: 3,
    monthlyPrice: 750,
    yearlyPrice: 7500,
    name: 'باقة 3 مليون توكن (برو)',
    description: 'استدلال وتفكير عميق، تكفي حتى 4,800 إجابة مقالية مصححة شهرياً (المخرجات × 6)'
  },
  {
    id: 'pro_token_5M',
    millions: 5,
    monthlyPrice: 1250,
    yearlyPrice: 12500,
    name: 'باقة 5 مليون توكن (برو)',
    description: 'استدلال وتفكير عميق، تكفي حتى 8,000 إجابة مقالية مصححة شهرياً (المخرجات × 6)'
  },
  {
    id: 'pro_token_10M',
    millions: 10,
    monthlyPrice: 2500,
    yearlyPrice: 25000,
    name: 'باقة 10 مليون توكن (برو سناتر ومراكز كبرى)',
    description: 'استدلال وتفكير عميق، تكفي حتى 16,000+ إجابة مقالية مصححة شهرياً (المخرجات × 6)'
  }
];

export const getPlanById = (planId: string | null | undefined): SubscriptionPlan | null => {
  if (!planId) return null;
  const cleanId = planId.replace(/^pro_/, '');
  return SUBSCRIPTION_PLANS.find(p => p.id === planId || p.legacyId === planId || p.id === cleanId || p.legacyId === cleanId) || null;
};

export const getPlansByCategory = (category: 'theory' | 'science'): SubscriptionPlan[] => {
  return SUBSCRIPTION_PLANS.filter(p => p.category === category);
};

export interface ProEquivalentInfo {
  proPlanId: string;
  name: string;
  tokensInMillions: number;
  monthlyPrice: number;
  yearlyPrice: number;
  isCustom: boolean;
  category: 'tokens' | 'theory' | 'science' | 'custom';
}

/**
 * Maps any existing teacher package/plan to its direct Pro system equivalent
 * preserving the exact token limit / tier and model configuration.
 */
export const getProEquivalentPlan = (
  planId: string | null | undefined, 
  customPlanName?: string, 
  customMillions?: number
): ProEquivalentInfo => {
  const pId = String(planId || '').trim();
  
  // 1. Pro tokens preset plans
  if (pId.startsWith('pro_token_')) {
    const existing = PRO_TOKEN_PRESET_PLANS.find(p => p.id === pId);
    if (existing) {
      return {
        proPlanId: existing.id,
        name: existing.name,
        tokensInMillions: existing.millions,
        monthlyPrice: existing.monthlyPrice,
        yearlyPrice: existing.yearlyPrice,
        isCustom: false,
        category: 'tokens'
      };
    }
  }

  // 2. Flash tokens preset plans -> upgrade to corresponding Pro preset
  if (pId.startsWith('token_')) {
    const proId = pId.replace('token_', 'pro_token_');
    const existingPro = PRO_TOKEN_PRESET_PLANS.find(p => p.id === proId);
    if (existingPro) {
      return {
        proPlanId: existingPro.id,
        name: existingPro.name,
        tokensInMillions: existingPro.millions,
        monthlyPrice: existingPro.monthlyPrice,
        yearlyPrice: existingPro.yearlyPrice,
        isCustom: false,
        category: 'tokens'
      };
    }
  }

  // 3. Custom plans or custom millions
  if (pId.startsWith('custom_') || (customMillions !== undefined && customMillions > 0)) {
    const match = pId.match(/(\d+(?:\.\d+)?)M/i);
    const millions = customMillions || (match ? parseFloat(match[1]) : 4);
    const monthlyPrice = Math.round(millions * PRO_PRICE_PER_MILLION);
    const yearlyPrice = Math.round(monthlyPrice * 10);
    return {
      proPlanId: pId.startsWith('pro_') ? pId : `pro_${pId}`,
      name: customPlanName ? `${customPlanName} (نظام برو 👑)` : `باقة مخصصة برو (${millions}M توكن 👑)`,
      tokensInMillions: millions,
      monthlyPrice,
      yearlyPrice,
      isCustom: true,
      category: 'custom'
    };
  }

  // 4. Theory plans -> keep same tier / quota with Pro
  if (pId.includes('theory_300') || pId === '300') {
    return {
      proPlanId: 'pro_theory_300',
      name: 'الباقة الاحترافية (نظام برو 👑)',
      tokensInMillions: 3,
      monthlyPrice: 350,
      yearlyPrice: 3500,
      isCustom: false,
      category: 'theory'
    };
  }
  if (pId.includes('theory_250') || pId === '250') {
    return {
      proPlanId: 'pro_theory_250',
      name: 'الباقة المتقدمة (نظام برو 👑)',
      tokensInMillions: 2,
      monthlyPrice: 300,
      yearlyPrice: 3000,
      isCustom: false,
      category: 'theory'
    };
  }
  if (pId.includes('theory_200') || pId === '200') {
    return {
      proPlanId: 'pro_theory_200',
      name: 'الباقة الأساسية (نظام برو 👑)',
      tokensInMillions: 1.5,
      monthlyPrice: 250,
      yearlyPrice: 2500,
      isCustom: false,
      category: 'theory'
    };
  }

  // 5. Science plans (already Gemini Pro)
  if (pId.includes('science_')) {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === pId || p.id === pId.replace(/^pro_/, ''));
    return {
      proPlanId: pId.startsWith('pro_') ? pId : `pro_${pId}`,
      name: `${plan?.name || 'باقة علمية'} (نظام برو 👑)`,
      tokensInMillions: pId.includes('750') ? 7.5 : pId.includes('500') ? 5 : 2.5,
      monthlyPrice: plan?.monthlyPrice || 500,
      yearlyPrice: plan?.yearlyPrice || 5000,
      isCustom: false,
      category: 'science'
    };
  }

  // Default fallback (e.g. for free_trial or general account) -> Pro 1M tokens
  return {
    proPlanId: 'pro_token_1M',
    name: 'باقة 1 مليون توكن (برو 👑)',
    tokensInMillions: 1,
    monthlyPrice: 250,
    yearlyPrice: 2500,
    isCustom: false,
    category: 'tokens'
  };
};

// Official Google Gemini Flash Pricing Constants (Per 1 Million Tokens)
export const GEMINI_FLASH_PRICING = {
  model_name: 'Gemini 3.8 Flash (النموذج القياسي الأحدث)',
  input_per_million_usd: 0.75, // $0.75 per 1M prompt tokens for Gemini 3.8 Flash
  output_per_million_usd: 3.75, // $3.75 per 1M candidate/output tokens for Gemini 3.8 Flash
  cached_per_million_usd: 0.1875, // $0.1875 per 1M cached prompt tokens (75% discount)
  usd_to_egp_rate: 50.0, // Default USD to EGP conversion rate
  usd_to_sar_rate: 3.75, // Default USD to SAR conversion rate
  tier_references: {
    gemini_3_8_flash: { input: 0.75, output: 3.75, name: 'Gemini 3.8 Flash (النموذج القياسي الأحدث)' },
    gemini_3_flash_lite: { input: 0.25, output: 1.50, name: 'Gemini 3 Flash-Lite' },
    gemini_1_5_flash: { input: 0.075, output: 0.30, name: 'Gemini 1.5 Flash (Legacy)' },
  }
};

// Official Google Gemini Pro Pricing Constants (Per 1 Million Raw Tokens)
export const GEMINI_PRO_PRICING = {
  model_name: 'Gemini 3.1 Pro (محرك برو الاستدلال والتفكير العميق 👑)',
  input_per_million_usd: 2.00, // $2.00 per 1M prompt tokens for Gemini 3.1 Pro
  output_per_million_usd: 12.00, // $12.00 per 1M raw candidate/output tokens (سعر المخرجات الرسمي الصافي للنموذج)
  cached_per_million_usd: 0.50, // $0.50 per 1M cached prompt tokens (خصم 75%)
  output_multiplier: 6, // مضاعف خصم رصيد باقة المعلم: كل 1 توكن مخرجات يُخصم كـ 6 توكنز من رصيد باقة الـ 250 ج.م
  usd_to_egp_rate: 50.0,
  usd_to_sar_rate: 3.75,
  tier_references: {
    gemini_3_1_pro: { input: 2.00, output: 12.00, name: 'Gemini 3.1 Pro (المدخلات $2.00/مليون - المخرجات $12.00/مليون - الخصم من الباقة ×6)' },
    gemini_2_5_pro: { input: 2.00, output: 12.00, name: 'Gemini 2.5 Pro (المدخلات $2.00/مليون - المخرجات $12.00/مليون - الخصم من الباقة ×6)' },
  }
};

export const calculateActualTokenCost = (
  promptTokens: number,
  candidatesTokens: number,
  cachedTokens = 0,
  usdToEgp = GEMINI_FLASH_PRICING.usd_to_egp_rate,
  usdToSar = GEMINI_FLASH_PRICING.usd_to_sar_rate,
  modelType?: AiModelType | string
) => {
  const isPro = String(modelType || '').toLowerCase().includes('pro');
  const rates = isPro ? GEMINI_PRO_PRICING : GEMINI_FLASH_PRICING;

  const promptCostUsd = (promptTokens / 1_000_000) * rates.input_per_million_usd;
  const candidatesCostUsd = (candidatesTokens / 1_000_000) * rates.output_per_million_usd;
  const cachedCostUsd = (cachedTokens / 1_000_000) * rates.cached_per_million_usd;
  const totalCostUsd = promptCostUsd + candidatesCostUsd + cachedCostUsd;

  return {
    promptCostUsd,
    candidatesCostUsd,
    cachedCostUsd,
    totalCostUsd,
    totalCostEgp: totalCostUsd * usdToEgp,
    totalCostSar: totalCostUsd * usdToSar,
    costPerThousandTokensEgp: (totalCostUsd / Math.max(1, promptTokens + candidatesTokens)) * 1000 * usdToEgp,
    modelName: rates.model_name
  };
};

// Client Commercial Pricing: 1 Million Tokens = 200 EGP (Flash) or 250 EGP (Pro)
export const CLIENT_TOKEN_PRICING = {
  price_per_million_egp: FLASH_PRICE_PER_MILLION, // 200 EGP
  pro_price_per_million_egp: PRO_PRICE_PER_MILLION, // 250 EGP
  price_per_token_egp: FLASH_PRICE_PER_MILLION / 1_000_000,
  price_per_thousand_tokens_egp: (FLASH_PRICE_PER_MILLION / 1_000_000) * 1000,
};

export const calculateClientTokenCost = (totalTokens: number, modelType?: AiModelType | string) => {
  const safeTokens = Math.max(0, totalTokens || 0);
  const rate = getModelPricePerMillion(modelType);
  const totalCostEgp = (safeTokens / 1_000_000) * rate;
  return {
    totalTokens: safeTokens,
    totalCostEgp,
    pricePerMillionEgp: rate,
    pricePerTokenEgp: rate / 1_000_000,
    pricePerThousandTokensEgp: (rate / 1_000_000) * 1000,
  };
};



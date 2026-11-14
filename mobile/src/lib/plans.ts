// Subscription plans — ported from the web app's src/constants.ts (single source of truth there)
export interface PlanOption {
  id: string;
  name: string;
  group: 'tokens' | 'pro_tokens';
  monthlyPrice: number;
  yearlyPrice: number;
  popular?: boolean;
  features: string[];
}

export const PLANS: PlanOption[] = [
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
  { key: 'tokens', title: 'باقات التوكنز — فلاش ⚡ (200 ج / مليون)' },
  { key: 'pro_tokens', title: 'باقات التوكنز — برو 👑 (250 ج / مليون)' },
];

/** Display labels for supported billing currencies (ISO code → Arabic label). */
export const CURRENCIES: Record<string, string> = {
  EGP: 'ج.م',
  SAR: 'ر.س',
  AED: 'د.إ',
  KWD: 'د.ك',
  QAR: 'ر.ق',
  BHD: 'د.ب',
  OMR: 'ر.ع',
  JOD: 'د.أ',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export const currencyLabel = (cfg?: { currency?: string; currency_label?: string } | null): string => {
  if (cfg?.currency_label) return cfg.currency_label;
  return CURRENCIES[String(cfg?.currency || 'EGP').toUpperCase()] || CURRENCIES.EGP;
};

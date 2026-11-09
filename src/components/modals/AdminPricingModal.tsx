import React, { useEffect, useState } from 'react';
import { Settings, X, Save, Coins, Loader2, RefreshCw } from 'lucide-react';
import { auth } from '../../firebase';
import { TOKEN_PRESET_PLANS, PRO_TOKEN_PRESET_PLANS, TokenPlan } from '../../constants';

interface PricingConfig {
  flash_output_multiplier?: number;
  pro_output_multiplier?: number;
  flash_price_per_million?: number;
  pro_price_per_million?: number;
  plan_prices?: Record<string, { monthly?: number; yearly?: number }>;
}

interface AdminPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ALL_TOKEN_PLANS: TokenPlan[] = [...TOKEN_PRESET_PLANS, ...PRO_TOKEN_PRESET_PLANS];

export const AdminPricingModal: React.FC<AdminPricingModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flashMult, setFlashMult] = useState('5');
  const [proMult, setProMult] = useState('7');
  const [flashPrice, setFlashPrice] = useState('200');
  const [proPrice, setProPrice] = useState('250');
  const [planPrices, setPlanPrices] = useState<Record<string, { monthly: string; yearly: string }>>({});

  const getHeaders = async () => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await getHeaders();
      const res = await fetch('/api/config/pricing', { headers });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || `خطأ في الخادم (${res.status})`);
      }
      const data = await res.json();
      const cfg: PricingConfig = data?.pricing || {};
      if (cfg.flash_output_multiplier != null) setFlashMult(String(cfg.flash_output_multiplier));
      if (cfg.pro_output_multiplier != null) setProMult(String(cfg.pro_output_multiplier));
      if (cfg.flash_price_per_million != null) setFlashPrice(String(cfg.flash_price_per_million));
      if (cfg.pro_price_per_million != null) setProPrice(String(cfg.pro_price_per_million));
      const pp: Record<string, { monthly: string; yearly: string }> = {};
      for (const p of ALL_TOKEN_PLANS) {
        const o = cfg.plan_prices?.[p.id];
        pp[p.id] = { monthly: String(o?.monthly ?? p.monthlyPrice), yearly: String(o?.yearly ?? p.yearlyPrice) };
      }
      setPlanPrices(pp);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل إعدادات التسعير.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen]);

  const save = async () => {
    const num = (s: string) => {
      const n = Number(s);
      return isFinite(n) && n > 0 ? n : null;
    };
    const fm = num(flashMult);
    const pm = num(proMult);
    const fp = num(flashPrice);
    const pp = num(proPrice);
    if (!fm || !pm) {
      alert('مضاعف التوكنز يجب أن يكون رقماً موجباً.');
      return;
    }
    if (!fp || !pp) {
      alert('سعر المليون يجب أن يكون رقماً موجباً.');
      return;
    }
    const prices: Record<string, { monthly?: number; yearly?: number }> = {};
    for (const [id, v] of Object.entries(planPrices)) {
      const m = num(v.monthly);
      const y = num(v.yearly);
      if (!m || !y) {
        alert(`راجع أسعار الباقة: ${id}`);
        return;
      }
      prices[id] = { monthly: m, yearly: y };
    }

    setSaving(true);
    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          flash_output_multiplier: fm,
          pro_output_multiplier: pm,
          flash_price_per_million: fp,
          pro_price_per_million: pp,
          plan_prices: prices
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `خطأ في الخادم (${res.status})`);
      alert('تم حفظ إعدادات التسعير وهامش الربح بنجاح.');
    } catch (e: any) {
      alert(e?.message || 'فشل حفظ إعدادات التسعير.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputCls =
    'w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none transition-all text-center';
  const labelCls = 'text-[11px] font-bold text-slate-500 mb-1 block text-right';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[125] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 text-right overflow-hidden my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-indigo-950 text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-2xl border border-white/15">
              <Settings size={24} className="text-amber-300" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black">إعدادات التسعير ومضاعفات التوكنز</h3>
              <p className="text-[11px] text-slate-300 mt-0.5">
                مضاعف التوكنز هو هامش الربح: عدد التوكنز المحتسبة على العميل مقابل كل توكن مخرجات يستهلكه النموذج فعلياً.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          {loading ? (
            <div className="py-14 flex flex-col items-center gap-3 text-slate-500">
              <Loader2 size={28} className="animate-spin text-indigo-600" />
              <span className="text-xs font-bold">جاري تحميل الإعدادات الحالية...</span>
            </div>
          ) : error ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm font-bold text-rose-600">{error}</p>
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
              >
                <RefreshCw size={14} />
                إعادة المحاولة
              </button>
            </div>
          ) : (
            <>
              {/* Token multipliers */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Coins size={17} className="text-amber-600" />
                  <span className="font-black text-slate-800 text-sm">هامش ربح التوكنز (المضاعف)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>مضاعف فلاش (لكل توكن مخرجات)</label>
                    <input type="number" min="1" step="0.5" value={flashMult} onChange={(e) => setFlashMult(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>مضاعف برو</label>
                    <input type="number" min="1" step="0.5" value={proMult} onChange={(e) => setProMult(e.target.value)} className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Price per million */}
              <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Coins size={17} className="text-indigo-600" />
                  <span className="font-black text-slate-800 text-sm">سعر المليون توكن (جنيه مصري)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>سعر المليون — فلاش</label>
                    <input type="number" min="1" value={flashPrice} onChange={(e) => setFlashPrice(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>سعر المليون — برو</label>
                    <input type="number" min="1" value={proPrice} onChange={(e) => setProPrice(e.target.value)} className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Per-plan prices */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Save size={16} className="text-slate-600" />
                  <span className="font-black text-slate-800 text-sm">أسعار الباقات (شهري / سنوي)</span>
                </div>
                <div className="space-y-3">
                  {ALL_TOKEN_PLANS.map((p) => (
                    <div key={p.id} className="border-t border-slate-200 first:border-t-0 pt-3 first:pt-0">
                      <div className="text-xs font-bold text-slate-700 mb-1.5 truncate">{p.name}</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>شهري (ج.م)</label>
                          <input
                            type="number"
                            min="1"
                            value={planPrices[p.id]?.monthly ?? String(p.monthlyPrice)}
                            onChange={(e) =>
                              setPlanPrices((s) => ({
                                ...s,
                                [p.id]: { ...(s[p.id] || { yearly: String(p.yearlyPrice) }), monthly: e.target.value }
                              }))
                            }
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>سنوي (ج.م)</label>
                          <input
                            type="number"
                            min="1"
                            value={planPrices[p.id]?.yearly ?? String(p.yearlyPrice)}
                            onChange={(e) =>
                              setPlanPrices((s) => ({
                                ...s,
                                [p.id]: { ...(s[p.id] || { monthly: String(p.monthlyPrice) }), yearly: e.target.value }
                              }))
                            }
                            className={inputCls}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500">تُحفظ القيم في Firestore وتسري على الفوترة فوراً.</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl font-bold border border-slate-200 transition-colors text-xs sm:text-sm"
            >
              إغلاق
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || loading || !!error}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-700 to-indigo-800 hover:from-indigo-800 hover:to-indigo-900 text-white rounded-xl font-black shadow-md transition-all flex items-center gap-2 text-xs sm:text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{saving ? 'جاري الحفظ...' : 'حفظ إعدادات التسعير'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

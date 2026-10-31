import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  CreditCard, 
  Smartphone, 
  Upload, 
  CheckCircle2, 
  MessageCircle, 
  Copy, 
  Check, 
  AlertTriangle,
  Zap,
  ArrowLeft,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { calculateProUpgradeCost, ProUpgradeCostResult } from '../../utils/tokenStats';

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onUpgradeSuccess?: () => void;
  onRequestSubmit?: (data: {
    amount: number;
    screenshot: string;
    details: string;
    remainingTokens: number;
    excessTokens: number;
  }) => Promise<void>;
}

export const ProUpgradeModal: React.FC<ProUpgradeModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpgradeSuccess,
  onRequestSubmit
}) => {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen) return null;

  const costResult: ProUpgradeCostResult = calculateProUpgradeCost(user);
  const {
    remainingTokens,
    excessTokens,
    isOverdraft,
    upgradeDifferenceCost,
    excessCostEgp,
    totalRequiredEgp,
    breakdown
  } = costResult;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('الرجاء اختيار ملف صورة صالح (JPG, PNG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      if (!result) return;

      // Compress preview to avoid large payload
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          setScreenshot(canvas.toDataURL('image/jpeg', 0.65));
        } else {
          setScreenshot(result);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!screenshot) {
      alert('يرجى رفع صورة إيصال التحويل أولاً لتأكيد طلب الترقية');
      return;
    }

    if (onRequestSubmit) {
      setIsSubmitting(true);
      try {
        await onRequestSubmit({
          amount: totalRequiredEgp,
          screenshot,
          details: breakdown,
          remainingTokens,
          excessTokens
        });
        if (onUpgradeSuccess) onUpgradeSuccess();
        onClose();
      } catch (err: any) {
        alert(err.message || 'حدث خطأ أثناء إرسال طلب الترقية');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const whatsappMessage = encodeURIComponent(
    `السلام عليكم، أنا المعلم: ${user?.name || 'معلم'}\nأرغب في الترقية إلى نموذج جيميناي برو (Gemini Pro).\nرصيدي المتبقي: ${remainingTokens.toLocaleString()} توكن.\nفارق التكلفة المطلوب: ${totalRequiredEgp} جنيه مصري.\nيرجى مراجعة وتفعيل الحساب.`
  );

  return (
    <div 
      className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[120] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-indigo-100 overflow-hidden text-right my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-indigo-900 text-white p-5 sm:p-6 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 left-4 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all cursor-pointer"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-inner">
              <Sparkles className="text-amber-300 w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 text-indigo-100 px-2.5 py-0.5 rounded-full inline-block mb-1">
                ترقية نظام الذكاء الاصطناعي
              </span>
              <h2 className="text-xl sm:text-2xl font-black">الترقية إلى Gemini Pro</h2>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-indigo-100 mt-2 leading-relaxed">
            الترقية تمنحك دقة متناهية واستدلالاً أكاديمياً عميقاً في تصحيح المسائل العلمية والرياضية والخطوات المعقدة.
          </p>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Comparison Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
              <div className="text-[11px] font-bold text-slate-500 mb-1 flex items-center justify-center gap-1">
                <Zap size={14} className="text-amber-500" />
                <span>نموذج فلاش الحالي</span>
              </div>
              <p className="text-xs font-semibold text-slate-700">Gemini 3.8 Flash</p>
              <p className="text-sm font-black text-slate-900 mt-1">200 ج.م <span className="text-[10px] text-slate-500 font-normal">/ مليون توكن</span></p>
            </div>

            <div className="bg-purple-50/80 border-2 border-purple-300 rounded-2xl p-3 text-center relative overflow-hidden shadow-xs">
              <div className="absolute top-0 right-0 bg-purple-600 text-[9px] font-black text-white px-2 py-0.5 rounded-bl-lg">
                المستهدف
              </div>
              <div className="text-[11px] font-bold text-purple-700 mb-1 flex items-center justify-center gap-1">
                <Sparkles size={14} className="text-purple-600" />
                <span>نموذج برو المتقدم</span>
              </div>
              <p className="text-xs font-semibold text-purple-900">Gemini 3.1 Pro</p>
              <p className="text-sm font-black text-purple-700 mt-1">250 ج.م <span className="text-[10px] text-purple-500 font-normal">/ مليون توكن</span></p>
            </div>
          </div>

          {/* Pricing Rule Alert */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <div className="space-y-1">
              <p className="font-bold">قاعدة احتساب فارق الترقية المعتمدة:</p>
              <p className="text-amber-800 leading-relaxed">
                يتم سداد <strong>50 جنيه مصري</strong> فارق السعر عن كل <strong>1,000,000 توكن</strong> متبقٍ في باقتك الحالية. وإذا زاد الرصيد المتبقي عن مليون يتم احتساب الفارق النسبي بدقة حسب قدر التجاوز.
              </p>
            </div>
          </div>

          {/* Calculation Summary Box */}
          <div className="bg-gradient-to-br from-indigo-50/90 to-purple-50/90 border border-indigo-200 rounded-2xl p-4.5 space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-indigo-100">
              <span className="text-slate-600">الرصيد المتبقي في باقتك الحالية:</span>
              <span className="font-mono font-bold text-indigo-950 text-sm">
                {remainingTokens.toLocaleString()} توكن
              </span>
            </div>

            {remainingTokens > 0 ? (
              <div className="flex items-center justify-between text-xs pb-2 border-b border-indigo-100">
                <span className="text-slate-600">
                  فارق ترقية الرصيد المتبقي 
                  {remainingTokens > 1_000_000 && <span className="text-[10px] text-indigo-600 block">(أكثر من مليون توكن: {Math.round(remainingTokens / 10000) / 100} مليون)</span>}
                </span>
                <span className="font-bold text-indigo-900 text-sm">
                  {upgradeDifferenceCost} جنيه مصري
                </span>
              </div>
            ) : null}

            {isOverdraft && (
              <div className="flex items-center justify-between text-xs pb-2 border-b border-rose-200 text-rose-800 bg-rose-50/60 p-2 rounded-xl">
                <span className="font-medium">
                  تسوية استهلاك الباقة الزائد ({excessTokens.toLocaleString()} توكن):
                </span>
                <span className="font-bold text-rose-700 text-sm">
                  {excessCostEgp} جنيه مصري
                </span>
              </div>
            )}

            <div className="pt-1 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">إجمالي فارق الترقية المطلوب:</span>
                <span className="text-[11px] text-slate-500">شامل ترقية الرصيد المتبقي للنموذج الأقوى</span>
              </div>
              <div className="text-left">
                <span className="text-2xl sm:text-3xl font-black text-purple-700">
                  {totalRequiredEgp}
                </span>
                <span className="text-xs font-bold text-purple-900 mr-1.5">ج.م فقط</span>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <CreditCard size={16} className="text-indigo-600" />
              <span>طرق سداد فارق الترقية:</span>
            </p>

            <div className="space-y-2">
              {/* InstaPay Direct */}
              <a 
                href="https://ipn.eg/S/gergesnabil101/instapay/8Gfhxe" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-white p-3 rounded-xl border border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all group"
              >
                <div className="flex flex-col text-right">
                  <span className="text-[10px] text-slate-500">اضغط للتحويل المباشر عبر</span>
                  <span className="text-xs sm:text-sm font-bold text-indigo-700">إنستا باي (InstaPay)</span>
                </div>
                <div className="flex items-center gap-1.5 text-indigo-600 text-xs font-bold group-hover:translate-x-[-3px] transition-transform">
                  <span>فتح الرابط</span>
                  <ArrowLeft size={16} />
                </div>
              </a>

              {/* Vodafone Cash */}
              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                <div className="flex flex-col text-right">
                  <span className="text-[10px] text-slate-500">فودافون كاش:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm" dir="ltr">01021558746</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard('01021558746', 'voda')}
                  className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1 transition-colors"
                >
                  {copiedField === 'voda' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copiedField === 'voda' ? 'تم النسخ' : 'نسخ'}</span>
                </button>
              </div>

              {/* InstaPay Username */}
              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                <div className="flex flex-col text-right">
                  <span className="text-[10px] text-slate-500">معرّف إنستاباي:</span>
                  <span className="font-mono font-bold text-slate-900 text-xs" dir="ltr">gergesnabil101@instapay</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard('gergesnabil101@instapay', 'insta')}
                  className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1 transition-colors"
                >
                  {copiedField === 'insta' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copiedField === 'insta' ? 'تم النسخ' : 'نسخ'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Upload Receipt */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-700">
              بعد التحويل، ارفع صورة إيصال الدفع لتأكيد الترقية فوراً:
            </p>

            {screenshot ? (
              <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 text-center space-y-2">
                <div className="relative inline-block mx-auto">
                  <img 
                    src={screenshot} 
                    alt="Receipt" 
                    className="max-h-36 rounded-xl object-contain border border-emerald-200 shadow-xs" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setScreenshot(null)}
                    className="absolute -top-2 -right-2 bg-rose-600 text-white p-1 rounded-full shadow-md hover:bg-rose-700"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-800">
                  <CheckCircle2 size={16} />
                  <span>تم تجهيز صورة الإيصال بنجاح</span>
                </div>
              </div>
            ) : (
              <label className="block w-full border-2 border-dashed border-indigo-200 hover:border-indigo-500 rounded-2xl p-4 text-center cursor-pointer bg-indigo-50/20 hover:bg-indigo-50/50 transition-all">
                <input 
                  type="file" 
                  accept="image/png,image/jpeg,image/webp,image/*" 
                  onChange={handleImageUpload} 
                  className="hidden" 
                />
                <div className="flex flex-col items-center gap-1.5">
                  <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                    <Upload size={20} />
                  </div>
                  <span className="text-xs font-bold text-indigo-700">اضغط لرفع صورة إيصال التحويل</span>
                  <span className="text-[10px] text-slate-400">يدعم صيغ الصور المختلفة JPG, PNG</span>
                </div>
              </label>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={!screenshot || isSubmitting}
              className={`w-full py-3.5 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                screenshot && !isSubmitting
                  ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white hover:opacity-95'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              }`}
            >
              <Sparkles size={18} />
              <span>{isSubmitting ? 'جاري إرسال الطلب...' : 'تأكيد وإرسال طلب الترقية'}</span>
            </button>

            <a
              href={`https://wa.me/201223819680?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-2xl font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 flex items-center justify-center gap-2 text-xs sm:text-sm transition-all"
            >
              <MessageCircle size={16} />
              <span>إرسال تفاصيل الترقية عبر واتساب مباشرة</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// The start of the Plans Modal
const startTag = '{showPlansModal && (';
const startIdx = code.indexOf(startTag);

// We need to find the place where `const match = selectedPlan.match(/token_(\\d+)M/);` is
const endTag = 'const match = selectedPlan?.match(/token_(\\d+)M/);';
let endIdx = code.indexOf('const match = selectedPlan.match(/token_(\\d+)M/);');
if(endIdx === -1) {
  endIdx = code.indexOf('const match = selectedPlan?.match(/token_(\\d+)M/);');
}

if (startIdx === -1 || endIdx === -1) {
  console.log('Could not find start or end index', startIdx, endIdx);
  process.exit(1);
}

const replacement = `{showPlansModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4" onClick={() => setShowPlansModal(false)}>
          <div 
            className="bg-white rounded-3xl p-4 sm:p-8 max-w-5xl w-full shadow-2xl text-right overflow-y-auto max-h-[95vh] animate-in zoom-in-95 duration-200 border border-slate-100"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="bg-indigo-600 text-white p-2 rounded-xl">
                    <CreditCard size={20} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-800">باقات وخطط الاشتراك</h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-500">اختر باقة التوكنز المناسبة لمادتك وتخصصك.</p>
              </div>
              <button onClick={() => setShowPlansModal(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Interactive Token Calculator Banner */}
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-emerald-500/10 border border-indigo-200/80 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 text-right">
                <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-md shrink-0">
                  <Calculator size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-black text-slate-900 text-sm sm:text-base">
                      حاسبة التوكنز والطلاب الذكية
                    </h4>
                    <span className="bg-indigo-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">جديد 75 ج.م / مليون توكن</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    احسب بالضبط استهلاكك الشهري بناءً على عدد طلابك، ومجموعاتك، وعدد الأسئلة المقالية في اختباراتك.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPlansModal(false);
                  setShowTokenCalculator(true);
                }}
                className="w-full md:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <Calculator size={16} />
                <span>فتح الحاسبة التقديرية</span>
              </button>
            </div>

            {/* Sub-header & Billing Cycle Toggle */}
            <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200/70 mb-6 gap-3">
              <div className="text-xs sm:text-sm text-slate-600 font-medium flex items-center gap-2">
                <span>⚡ باقات توكنز مرنة: <b>سعر المليون توكن = 75 ج.م فقط (تكفي حوالي 2,000 إجابة مقالية مصححة)</b></span>
              </div>
              <div className="bg-white p-1 rounded-xl border border-slate-200 flex items-center shadow-sm shrink-0">
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={\`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all \${
                    billingCycle === 'yearly'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }\`}
                >
                  سنوي (خصم شهرين 🔥)
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={\`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all \${
                    billingCycle === 'monthly'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }\`}
                >
                  شهري
                </button>
              </div>
            </div>

            {/* Plan Cards Grid */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {TOKEN_PRESET_PLANS.map((plan) => {
                  const isPopular = plan.popular;
                  const price = billingCycle === 'monthly' ? \`\${plan.monthlyPrice} ج.م\` : \`\${plan.yearlyPrice} ج.م\`;
                  const priceSub = billingCycle === 'monthly' ? '/ شهر' : \`/ سنة (وفر \${plan.monthlyPrice * 2} ج.م)\`;

                  return (
                    <div
                      key={plan.id}
                      className={\`rounded-2xl p-5 sm:p-6 transition-all flex flex-col relative \${
                        isPopular
                          ? 'border-2 border-purple-600 bg-gradient-to-b from-purple-50/60 via-white to-white shadow-xl shadow-purple-100/60 -translate-y-1'
                          : 'border-2 border-slate-200 hover:border-slate-300 bg-white hover:shadow-lg'
                      }\`}
                    >
                      {isPopular && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-3.5 py-1 rounded-full text-xs font-black shadow-md flex items-center gap-1">
                          <Sparkles size={13} />
                          الأكثر طلباً وتوفيراً
                        </div>
                      )}
                      <div className="mb-4">
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg inline-block mb-2 bg-purple-50 text-purple-700 border border-purple-200/60">
                          {plan.millions} مليون توكن شهرياً
                        </span>
                        <h4 className="text-xl font-black text-slate-900">{plan.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">{plan.description}</p>
                      </div>
                      <div className="mb-4 pb-4 border-b border-slate-100">
                        <div className="text-3xl font-black text-purple-700 flex items-baseline gap-1">
                          {price}
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5">
                          {priceSub}
                        </div>
                      </div>
                      
                      {/* Features List */}
                      <ul className="space-y-2.5 mb-6 flex-1 text-xs sm:text-sm">
                        <li className="flex items-start gap-2 text-slate-700 leading-snug">
                          <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-purple-600" />
                          <span>رصيد <b>{plan.millions} مليون توكن</b> شهرياً</span>
                        </li>
                        <li className="flex items-start gap-2 text-slate-700 leading-snug">
                          <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-purple-600" />
                          <span>تصحيح مقالي فائق الدقة بالذكاء الاصطناعي</span>
                        </li>
                        <li className="flex items-start gap-2 text-slate-700 leading-snug">
                          <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-purple-600" />
                          <span>الأسئلة الاختيارية (MCQ) مجانية تماماً</span>
                        </li>
                        <li className="flex items-start gap-2 text-slate-700 leading-snug">
                          <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-purple-600" />
                          <span>إنشاء اختبارات غير محدود وشهادات تقدير</span>
                        </li>
                      </ul>
                      
                      {/* CTA Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPlan(plan.id);
                          setCustomPlanDetails({
                            planId: plan.id,
                            tokensInMillions: plan.millions,
                            monthlyPrice: plan.monthlyPrice,
                            yearlyPrice: plan.yearlyPrice,
                            detailsSummary: \`\${plan.name} (\${plan.millions}M توكن)\`
                          });
                          setShowPlansModal(false);
                          setShowPaymentModal(true);
                        }}
                        className={\`w-full py-3 px-4 rounded-xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 cursor-pointer \${
                          isPopular
                            ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:shadow-purple-500/20'
                            : 'bg-slate-900 hover:bg-black text-white'
                        }\`}
                      >
                        <span>اشتراك في باقة {plan.millions}M توكن</span>
                      </button>
                    </div>
                  );
                })}

                {/* Custom Calculator Card */}
                <div className="rounded-2xl p-5 sm:p-6 transition-all flex flex-col relative border-2 border-dashed border-indigo-300 bg-gradient-to-b from-indigo-50/40 via-white to-white hover:border-indigo-500 hover:shadow-lg">
                  <div className="mb-4">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg inline-block mb-2 bg-indigo-50 text-indigo-700 border border-indigo-200">
                      مخصصة بالكامل
                    </span>
                    <h4 className="text-xl font-black text-slate-900">باقة مخصصة لاحتياجك</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">حدد عدد طلابك ومراحلهم واختباراتك بدقة</p>
                  </div>
                  <div className="mb-4 pb-4 border-b border-slate-100">
                    <div className="text-2xl font-black text-indigo-600 flex items-baseline gap-1">
                      75 ج.م / مليون
                    </div>
                    <div className="text-xs text-slate-500 font-medium mt-0.5">
                      حسب ما تحتاجه بالضبط بدون زيادة أو هدر
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mb-6 flex-1 leading-relaxed">
                    أدخل عدد المراحل الدراسية، وعدد المجموعات، ومتوسط الطلاب، وعدد الأسئلة المقالية في اختباراتك لنحسب لك التكلفة وخطة التوكنز المثالية فوراً.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPlansModal(false);
                      setShowTokenCalculator(true);
                    }}
                    className="w-full py-3 px-4 rounded-xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md cursor-pointer"
                  >
                    <Calculator size={18} />
                    <span>افتح الحاسبة وحدد باقتك</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (() => {
        let planName = '';
        let planPrice = '';
        if (customPlanDetails && customPlanDetails.planId === selectedPlan) {
          planName = customPlanDetails.detailsSummary;
          planPrice = billingCycle === 'monthly' ? \`\${customPlanDetails.monthlyPrice} ج.م\` : \`\${customPlanDetails.yearlyPrice} ج.م\`;
        } else if (selectedPlan?.startsWith('token_') || selectedPlan?.includes('M')) {
          `;

code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
fs.writeFileSync('src/App.tsx', code);
console.log('Successfully replaced modals');

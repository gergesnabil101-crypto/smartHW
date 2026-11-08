# نقطة استئناف المشروع — 2026-11-08

## 🚧 دفعة اليوم (تم التنفيذ — يُستكمل غداً: فحص + نشر + تجربة)

**إصلاحات الدفعة الكبيرة (طلبات المستخدم الأخيرة):**
- **أيام الاشتراك**: server.ts — الموافقة على التجديد صارت `endDate = الآن + days` (لا ترحيل على باقي قديم) — يحل مشكلة 107/53 يوم. **يحتاج نشر Cloud Run**
- **توليد AI «غير مصرح»**: AiGenerateSheet بيبعت `operation: 'generate_quiz'` (كان `quiz_generation`) — يطابق القائمة البيضاء للسيرفر
- **تصحيح المقالي للطالب**: take/[id].tsx بيخزن `res.feedback` ويعرض تفاصيل التصحيح لكل سؤال (الدرجة/الملاحظات/الإجابة النموذجية)
- **تحميل QR**: ShareSheet فيه `getRef`+`toDataURL` → `expo-file-system/legacy` → `Sharing.shareAsync` (زر ⬇ تحميل QR)
- **الباقات**: plans.ts — توكنز فقط (5 فلاش 200ج/مليون + 5 برو 250ج/مليون)، حذف النظرية/العلمية من الموبايل (الويب محفوظ)
- **دفع Google Play**: `app.json` فيه `extra.paymentsMode:'iap'` — subscription.tsx يخفي مسار الإيصال في نسخة المتجر ويعرض زر «اشترك عبر Google Play» (IAP نفسه لم يُربط بمنتجات Play Console بعد)
- **أدمن**: users.tsx — زرا 👋 ترحيب واتساب و💬 تواصل لكل مشترك + زر ⚙️ إعدادات التسعير في الرأس
- **الطلاب**: students.tsx — بحث بالسنتر/المجموعة موجود + 💬 واتساب + 🗑 حذف (docId فقط — المشتقون من النتائج لا يُحذفون) + تحديث placeholder البحث
- **التسعير**: server.ts — `GET /api/config/pricing` + `POST /api/admin/pricing` (تخزين `platform_config/pricing`) + mobile `admin/pricing.tsx` (مضاعف فلاش/برو = هامش الربح + سعر المليون + أسعار الباقات شهري/سنوي) + خدمات `getPricing/adminUpdatePricing`

## ⚠️ متبقي لهذه الدفعة (ابدأ من هنا غداً)

1. **فحص**: `npx tsc --noEmit` في mobile + build سريع لـ server.ts
2. **نشر السيرفر** على Cloud Run (تغييرات أيام الاشتراك + التسعير)
3. **subscription.tsx**: جلب `plan_prices` من `getPricing()` وعرض الأسعار المخصصة (اختياري — حالياً يعرض ثوابت plans.ts)
4. **تجربة Expo Go**: توليد AI / عرض تصحيح مقالي / تحميل QR / واتساب أدمن / تسعير أدمن
5. **IAP حقيقي**: ربط منتجات Play Console (expo-in-app-purchases + development build — Expo Go لا يدعمه)

## الحالة ✅ مكتمل ومرفوع سابقاً (main @ 2c92f2f — Cloud Run rev 00007-jm8)

- Backend على Cloud Run: `mosahah-api-609470896445.europe-west1.run.app` — `hasKey:true, serverAiReady:true`
- التجديد (موافقة/Stripe/يدوي) يصفّر الاستهلاك + extra_tokens
- تطبيق Expo كامل: auth + dashboard + محرر (مدة/انتهاء/أكواد/تفعيل) + مشاركة QR/واتساب + استخراج AI من ملف/صورة + بروفايل
- النتائج لكل اختبار عبر زر 📊 → `/results?quizId=` (CSV + PDF + واتساب باسم الدرس والمدرس)
- تبويب «الطلاب»: 🔑 كود ثابت لكل طالب + 📱 إرساله واتساب
- أدمن `/admin/users`: 3 تبويبات + استهلاك توكنز + أيام متبقية + تعليق/تصفير/توكنز/حذف شامل

## متبقي ⏳ للنشر

1. حساب Expo (expo.dev/signup — مجاني) مطلوب لـ tunnel + EAS build
2. `eas build -p android --profile production` → AAB → Play Console ($25)
3. IAP: منتجات اشتراك في Play Console + expo-in-app-purchases (development build)

## أوامر سريعة

- تشغيل dev server: `cd mobile && CI=true npx expo start --port 8081` (وضع CI لأن watch mode بيفشل)
- نشر السيرفر: `"$LOCALAPPDATA/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd" run deploy mosahah-api --source . --region europe-west1 --project gen-lang-client-0552360485`
- مشكلة Metro 500: امسح `.expo/cache` + `node_modules/.cache` + تأكد مفيش node قديم على 8081

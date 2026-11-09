# نقطة استئناف المشروع — 2026-11-09

## ✅ دفعة 2026-11-09 (منشورة — Cloud Run rev 00008-92t)

- **أيام الاشتراك**: التجديد `endDate = الآن + days` — لا ترحيل (حل مشكلة 107/53 يوم)
- **التسعير للأدمن**: `/admin/pricing` (مضاعف فلاش/برو = هامش الربح + سعر المليون + أسعار الباقات) → `POST /api/admin/pricing` يخزن `platform_config/pricing` — زر ⚙️ في رأس `/admin/users`
- **طلبات الاشتراك**: شاشة `/admin/requests` — طلبات pending مع صورة الإيصال (تكبير بالضغط) + اسم الباقة + زر ✅ تفعيل تلقائي → `/api/subscription-requests/approve` + 🗑 رفض → DELETE — زر 📋 في رأس `/admin/users`
- **ترقية فلاش→برو**: subscription.tsx — بطاقة ترقية تحسب فارق السعر على التوكنز المتبقية (50ج/مليون افتراضي) + إيصال → `plan:'upgrade_to_pro'` + `custom_details` JSON (متوافق مع قواعد Firestore — `billing_cycle:'monthly'` وحقول whitelisted فقط) — الموافقة تضبط `preferred_ai_model:'gemini_pro'`
- **دقة الرموز العلمية**: برومبت الاستخراج في AiGenerateSheet عزّز دقة الأرقام السفلية/العلوية/LaTeX/الحروف اليونانية/الوحدات + قاعدة موحدة في برومبتات التصحيح الثلاثة بالسيرفر: «لا صفر لإجابة جزئية + تقسيم الدرجة على الأجزاء + توضيح التقسيم في feedback/steps»
- **PDF**: fallback لـ `Print.printAsync` (حوار الطباعة → Save as PDF) عند فشل `printToFileAsync` + رسالة الخطأ الحقيقية
- **PDF/النتائج**: فلتر السنتر/المجموعة المنسدل كان موجوداً مسبقاً في results.tsx ✔
- **أدمن المستخدمين**: 👋 ترحيب + 💬 تواصل واتساب لكل مشترك
- **الطلاب**: بحث بالسنتر + 💬 واتساب + 🗑 حذف
- **AI «غير مصرح»**: `generate_quiz` بدل `quiz_generation` ✔
- **مقالي**: الطالب يشوف التصحيح المفصل (feedback/steps) ✔
- **QR**: زر ⬇ تحميل ✔
- **الباقات**: توكنز فقط + `paymentsMode:'iap'` لنسخة المتجر

## ⚠️ متبقي للدفعة

1. `npx tsc --noEmit` (جارٍ — الجهاز بطيء) + commit/push
2. **تجربة Expo Go**: Metro شغال على `:8081` وضع CI — جرب: توليد AI / تصحيح مقالي / QR تحميل / PDF / طلبات الأدمن / التسعير / الترقية
3. **subscription.tsx**: عرض أسعار `plan_prices` المخصصة من getPricing (حالياً يعرض ثوابت plans.ts — التسعير المخصص محفوظ في السيرفر فقط)
4. **IAP حقيقي**: منتجات Play Console + expo-in-app-purchases (development build)

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

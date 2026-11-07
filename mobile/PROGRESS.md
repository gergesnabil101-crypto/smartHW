# نقطة استئناف المشروع — 2026-11-07

## 🚧 عمل جارٍ (WIP — لم يُتحقق منه بعد)

**إعدادات التسعير وهامش ربح التوكنز (قابل للإدارة):**
- server.ts: أضيف PricingConfig + كاش `platform_config/pricing` + `getOutputMultiplier()` وتم استبدال كل مواضع `? 7 : 5` (7 مواضع) بالدالة القابلة للإعداد
- **لم يُنفَّذ بعد:** endpoint `GET /api/config/pricing` + `POST /api/admin/pricing` — نزّلهم قرب `/api/admin/update-user` (~سطر 4520)
- **لم يُنفَّذ بعد:** شاشة أدمن `/admin/pricing` في الموبايل + جلب الأسعار في subscription.tsx + `paymentsMode` في app.json
- server.ts لم يُفحص tsc ولم يُنشر — المنشور لسه 00007-jm8

**شاشة الباقات (mobile):**
- `src/lib/plans.ts` — 16 باقة (نظرية/علمية/توكنز فلاش/توكنز برو) بالأسعار
- `src/app/subscription.tsx` — اختيار شهري/سنوي + نافذة دفع برفع صورة إيصال → `subscription_requests` (نفس تدفق الويب) — مسجل في root Stack، مدخل من زر 💳 في البروفايل
- **ملاحظة Play:** مسار الإيصال يدوي غير متوافق مع سياسة Google — هيتعطل في نسخة المتجر عبر `extra.paymentsMode` لما نضيف IAP

**مشكلة Metro:** كان 500 بسبب كاش تالف + zombie process على 8081 — اتقتلت وMetro اتشغل بـ `expo start -c`. لو تكرر: امسح `.expo/cache` و`node_modules/.cache` وتأكد من مفيش node قديم على البورت

## الحالة ✅ مكتمل ومرفوع سابقاً (main @ 2c92f2f — Cloud Run rev 00007-jm8)

- Backend على Cloud Run شغال بالكامل: `mosahah-api-609470896445.europe-west1.run.app`
  - كل env vars اتبعتت من `.env.production.yaml` عبر gcloud (حساب gergesnabil101@gmail.com مسجل)
  - `hasKey:true, serverAiReady:true` — Gemini يعمل (gemini-3.8-flash)
  - التجديد (موافقة/Stripe/يدوي) يصفّر الاستهلاك + extra_tokens — لا ترحيل للرصيد
- تطبيق Expo: auth + dashboard + محرر اختبار (مدة/انتهاء/أكواد/تفعيل) + مشاركة QR/واتساب + نقل مجلد + استخراج AI من ملف/صورة + بروفايل كامل + آيكون حقيقي
- **النتائج لكل اختبار فقط** عبر زر 📊 → `/results?quizId=` (Stack جذري): CSV + PDF (expo-print) + واتساب لولي الأمر (اسم الدرس + اسم المدرس) + إعادة حساب
- **تبويب «الطلاب»** بدل النتائج: قائمة تلقائية + 🔑 كود ثابت لكل طالب (يُتحقق منه عالمياً عبر `students.code` في كل الاختبارات) + 📱 إرسال الكود واتساب
- **أدمن `/admin/users`**: 3 تبويبات (تجريبي/مفعّل/مغلق) + استهلاك توكنز + ⏳ أيام متبقية + إخفاء الرصيد عند الانتهاء + أزرار: تعليق/تفعيل • 🔄 تصفير • ➕ توكنز استثنائية • 🗑 حذف شامل (`/api/users/:id/delete`)
- tsc نظيف بعد كل التعديلات

## متبقي ⏳

1. تجربة Expo Go على الموبايل — عنوان الشبكة الحالي `192.168.1.38:8081` (يتغير بإعادة تشغيل الراوتر؛ لو فشل الاتصال شغّل `npx expo start --tunnel` بعد تسجيل دخول Expo)
2. حساب Expo (expo.dev/signup — مجاني) مطلوب لـ tunnel + EAS build
3. `eas build -p android --profile production` → AAB → Play Console ($25)
4. IAP للاشتراكات — مؤجل لما يتطلبه Play

## أوامر سريعة

- تشغيل dev server: `cd mobile && npx expo start --port 8081`
- توليد QR: `node -e "require('qrcode').toFile('app-qr.png','exp://IP:8081',{width:400},console.log)"`
- رفع env vars للسيرفر: `python %LOCALAPPDATA%\google-cloud-sdk\lib\gcloud.py run services update mosahah-api --region europe-west1 --project gen-lang-client-0552360485 --env-vars-file .env.production.yaml`

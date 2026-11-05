# نقطة استئناف المشروع — 2026-11-05

## الحالة ✅ مكتمل ومرفوع (main @ 5a4487a — Cloud Run rev 00007-jm8)

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

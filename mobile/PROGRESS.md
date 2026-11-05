# نقطة استئناف المشروع — 2026-11-05

## الحالة ✅ مكتمل ومرفوع (main @ ed3437d)

- Backend على Cloud Run شغال بالكامل: `mosahah-api-609470896445.europe-west1.run.app`
  - كل env vars اتبعتت من `.env.production.yaml` عبر gcloud (حساب gergesnabil101@gmail.com مسجل)
  - `hasKey:true, serverAiReady:true` — Gemini يعمل (gemini-3.8-flash)
- تطبيق Expo: auth + dashboard + محرر اختبار (مدة/انتهاء/أكواد/تفعيل) + مشاركة QR/واتساب + نقل مجلد + نتائج (CSV/واتساب/إعادة حساب/فلتر طلابي) + استخراج AI من ملف/صورة + بروفايل كامل + صفحة أدمن `/admin/users`
- آي picon حقيقي + حراسة مصادقة على كل الشاشات + تطبيع بيانات `data`/JSON strings
- tsc نظيف (آخر فحص ناجح قبل الأدمن؛ تعديل الأدمن بسيط)

## متبقي ⏳

1. تجربة Expo Go على الموبايل — عنوان الشبكة الحالي `192.168.1.141:8081` (يتغير بإعادة تشغيل الراوتر؛ لو فشل الاتصال شغّل `npx expo start --tunnel` بعد تسجيل دخول Expo)
2. حساب Expo (expo.dev/signup — مجاني) مطلوب لـ tunnel + EAS build
3. `eas build -p android --profile production` → AAB → Play Console ($25)
4. IAP للاشتراكات — مؤجل لما يتطلبه Play

## أوامر سريعة

- تشغيل dev server: `cd mobile && npx expo start --port 8081`
- توليد QR: `node -e "require('qrcode').toFile('app-qr.png','exp://IP:8081',{width:400},console.log)"`
- رفع env vars للسيرفر: `python %LOCALAPPDATA%\google-cloud-sdk\lib\gcloud.py run services update mosahah-api --region europe-west1 --project gen-lang-client-0552360485 --env-vars-file .env.production.yaml`

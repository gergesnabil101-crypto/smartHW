# حالة تطوير تطبيق الموبايل — نقطة الاستئناف (2026-11-02)

آخر commit على GitHub: `main` في repo `gergesnabil101-crypto/smartHW`

## ما تم إنجازه ✅

- تطبيق Expo كامل في `mobile/` — كل الشاشات (دخول/تسجيل/لوحة معلم/محرر اختبار/توليد AI/طالب+مؤقت/نتائج+إعادة تصحيح مقالي/بروفايل)
- `npx tsc --noEmit` نظيف صفر أخطاء + `expo export` نجح (bundle 4.8MB)
- رفع على GitHub: دمج تاريخ المستودع القديم مع المحلي — main محدث
- Dockerfile جاهز + `DEPLOY.md` + دعم `GOOGLE_APPLICATION_CREDENTIALS_JSON` في server.ts
- اكتشاف مهم: رابط `ais-pre-*.run.app` محمي بـ auth bridge — لا يصلح كـ API للموبايل. الحل الوحيد: نشر Cloud Run مستقل على نفس مشروع `gen-lang-client-0552360485`

## جاري حالياً ⏳

تجهيز gcloud على الجهاز:
- SDK منزّل ومفكوك في `C:\Users\GERGE\AppData\Local\google-cloud-sdk` (شغّل عبر `bin/gcloud` بعد إضافته للـ PATH)
- Python 3.12 كان بينزل بـ winget (Shell fc35e9) — تحقق `python --version` أولاً، وإن لزم أعد تشغيل install.bat داخل مجلد الـ SDK

## خطوات الغد بالترتيب

1. تحقق python يعمل، ثم `gcloud auth login` (يفتح متصفح — المستخدم يسجل بحسابه)
2. `gcloud config set project gen-lang-client-0552360485` + تفعيل services (run, cloudbuild, artifactregistry)
3. ملف `.env.production` بالأسرار (GEMINI_API_KEY, JWT_SECRET...) — يطلبها من المستخدم أو ينسخها من AI Studio secrets
4. `gcloud run deploy mosahah-api --source . --region europe-west1 --allow-unauthenticated` (الدليل الكامل في DEPLOY.md)
5. ضع الرابط الناتج في `mobile/app.json > extra.apiBaseUrl` + `.env`
6. تجربة فعلية على Expo Go (سيرفر dev شغال: `npx expo start` → exp://192.168.1.38:8081)
7. أيقونة التطبيق + بناء AAB عبر EAS (يحتاج حساب expo + Play Console من المستخدم)

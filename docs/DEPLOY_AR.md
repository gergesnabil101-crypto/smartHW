# النشر المباشر من GitHub إلى Cloud Run

بعد تجهيز هذا المسار، أي تعديل يُدمج في فرع `main` يُنشر تلقائياً، أو يُنشر يدوياً من تبويب
**Actions ← Deploy to Cloud Run ← Run workflow**. لا حاجة للنسخ واللصق في AI Studio.

## المطلوب مرة واحدة (في Google Cloud)
1. مشروع Google Cloud: نفس مشروع Firebase الحالي `gen-lang-client-0552360485`.
2. تفعيل الخدمات: Cloud Run، Cloud Build، Artifact Registry.
3. حساب خدمة (Service Account) للنشر بالأدوار: Cloud Run Admin، Cloud Build Editor،
   Service Account User، Artifact Registry Writer. ثم إنشاء مفتاح JSON له.
4. أول نشر يُنشئ خدمة جديدة (مثلاً `smarthw`) بجانب خدمة AI Studio الحالية، فلا يتأثر المدرسون.
   بعد التأكد أن الخدمة الجديدة تعمل، نحوّل الرابط/التطبيق إليها.

## المطلوب مرة واحدة (في GitHub ← Settings ← Secrets and variables ← Actions)
- Secret باسم `GCP_SA_KEY`: محتوى ملف JSON الخاص بحساب الخدمة.
- Variables: `GCP_PROJECT_ID`، `GCP_REGION` (مثل `europe-west2`)، `CLOUD_RUN_SERVICE` (مثل `smarthw`).

## متغيرات التشغيل (على خدمة Cloud Run نفسها، تبويب Variables & Secrets)
- `GEMINI_API_KEY` (مفتاح جديد، بعد إلغاء المفتاح المكشوف).
- اختيارياً: `STRIPE_SECRET_KEY`، `STRIPE_WEBHOOK_SECRET`، إعدادات البريد `SMTP_*`.
- Firebase Admin يعمل تلقائياً بحساب الخدمة الافتراضي للـ Cloud Run (لا يحتاج مفتاحاً)،
  بشرط أن يكون له دور **Cloud Datastore User** على المشروع.

## ملاحظات
- ملف `firebase-applet-config.json` يحتوي إعدادات Firebase العامة للواجهة (ليست أسراراً).
- قواعد Firestore (`firestore.rules`) تُنشر بأمر منفصل: `npx firebase-tools deploy --only firestore:rules`.

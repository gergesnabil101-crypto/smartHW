# نشر الـ Backend على Cloud Run — دليل خطوة بخطوة

## لماذا هذه الخطوة ضرورية؟

رابط AI Studio الحالي (`ais-pre-*.run.app`) محمي بطبقة دخول خاصة بجوجل —
مصمم للمعاينة داخل المتصفح فقط. **التطبيق المحمول لا يستطيع الوصول إليه.**
لازم ننشر نفس `server.ts` على خدمة Cloud Run مستقلة تحت مشروعك —
نفس الكود، نفس قاعدة بيانات Firestore، نفس الأسرار.

---

## الخطوة 1: تثبيت Google Cloud CLI

- حمّل من: https://cloud.google.com/sdk/docs/install
- بعد التثبيت افتح PowerShell أو CMD جديد ونفّذ:

```bash
gcloud auth login
```
سيفتح المتصفح — سجل دخول بنفس حساب جوجل المالك لمشروع Firebase
(`gen-lang-client-0552360485`).

## الخطوة 2: اختيار المشروع وتفعيل الخدمات

```bash
gcloud config set project gen-lang-client-0552360485
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

> ملاحظة: Cloud Run يحتاج تفعيل الفوترة (Billing) على المشروع — لو مش مفعلة
> هيطلبها منك في أول deploy. الاستهلاك ضمن الطبقة المجانية غالباً كافي للبداية.

## الخطوة 3: إعداد الأسرار (Secrets)

السيرفر يحتاج نفس متغيرات البيئة الموجودة في AI Studio. أنشئ الملف
`.env.production` محلياً (لن يُرفع — مستبعد في .gitignore):

```env
GEMINI_API_KEY=<نفس المفتاح في AI Studio>
JWT_SECRET=<كلمة سر قوية عشوائية>
APP_URL=<سنعبيه بعد أول deploy>
STRIPE_SECRET_KEY=<لو بتستخدم Stripe>
STRIPE_PRICE_MONTHLY=
STRIPE_PRICE_YEARLY=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
ADMIN_EMAIL=gergesnabil101@gmail.com
ENFORCE_APP_CHECK=false
```

## الخطوة 4: النشر (أمر واحد)

من مجلد المشروع:

```bash
gcloud run deploy mosahah-api --source . --region europe-west1 --allow-unauthenticated --port 8080 --memory 1Gi --timeout 300 --set-env-file .env.production
```

- `--source .` يبني الـ Dockerfile الموجود تلقائياً على Cloud Build
- `--allow-unauthenticated` لأن التطبيق + الطلاب يصلون بدون حسابات جوجل —
  الحماية الفعلية عندنا من Firebase Auth tokens (موجودة في الكود)
- أول بناء ياخد ~5-10 دقائق

## الخطوة 5: خد الرابط وحدّث APP_URL

بعد النجاح هيطبع:
```
Service URL: https://mosahah-api-XXXXXXXXXX-ew.a.run.app
```

1. حدّث `APP_URL` في `.env.production` بهذا الرابط وأعد نفس أمر النشر
   (مهم للروابط الذاتية داخل الإيميلات والمشاركة)
2. حط الرابط في تطبيق الموبايل:
   - `mobile/app.json` → `extra.apiBaseUrl`
   - و/أو `mobile/.env` → `EXPO_PUBLIC_API_URL`

## الخطوة 6: تحقق

```bash
curl https://mosahah-api-XXXX.run.app/api/health
```
المفروض يرجع JSON مش صفحة تحويل.

---

## خطة بديلة: Render.com (بدون gcloud)

لو Cloud Run صعب، Render أسهل من ناحية الواجهة لكن يحتاج ملف اعتماد Firebase:
1. من Firebase Console → Project Settings → Service Accounts → Generate new private key
2. نزّل الـ JSON — ستحط محتواه كمتغير `GOOGLE_APPLICATION_CREDENTIALS_JSON`
   (سنعدّل `server.ts` ليقرأه: `initializeApp({credential: cert(JSON.parse(env))})`)
3. على Render: New Web Service → اربط GitHub → يكتشف Dockerfile تلقائياً
4. حط نفس متغيرات البيئة في لوحة Render

> Cloud Run أفضل لأن نفس المشروع = صلاحيات Firestore تلقائية بدون ملفات اعتماد.

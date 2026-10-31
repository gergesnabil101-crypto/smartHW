# مصحح الواجبات الذكي — تطبيق الموبايل

تطبيق React Native (Expo) أصلي لنظام Android (ولاحقاً iOS) يعمل على نفس
الـ Backend الخاص بالموقع (`server.ts`) — نفس دقة التصحيح، نفس البيانات.

## المعمارية

```
app/                    شاشات التطبيق (expo-router — file-based routing)
  (auth)/               تسجيل الدخول / إنشاء حساب / استعادة كلمة مرور
  (teacher)/            تبويبات المعلم: اختباراتي / النتائج / حسابي
    quiz/[id].tsx       محرر الاختبار (يدوي + توليد AI)
    result/[id].tsx     تفاصيل نتيجة الطالب + إعادة تصحيح مقالي
  take/[id].tsx         تدفق الطالب: بياناته → حل → تسليم (رابط عميق)
src/
  config.ts             إعدادات الاتصال بالسيرفر
  lib/
    api.ts              عميل HTTP موحّد: توكن Firebase + Idempotency + App Check
    services.ts         دوال مطابقة لكل endpoint في السيرفر
    firebase.ts         تهيئة Auth + Firestore مع استمرارية الجلسة
    appCheck.ts         نقطة ربط Firebase App Check (Play Integrity)
  components/           مكوّنات UI صغيرة (Screen, Button, Input, Card, MathText...)
  features/builder/     محرر السؤال + مولّد الأسئلة بالـ AI
  store/AuthContext.tsx حالة المصادقة والبروفايل
  theme/                ألوان وخطوط — تصميم عربي RTL
  types/                نفس عقود بيانات الويب (Quiz/Question/Result...)
```

## التشغيل محلياً

```bash
cd mobile
npm install

# أنشئ ملف .env من .env.example واضبط رابط السيرفر المنشور
set EXPO_PUBLIC_API_URL=https://your-backend.run.app

npx expo start        # ثم امسح QR بتطبيق Expo Go، أو:
npm run android       # بناء على محاكي/جهاز Android موصول
```

## البناء لجوجل بلاي

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile production   # ينتج AAB موقّع
eas submit --platform android --profile production  # رفع تلقائي (اختياري)
```

- معرّف الحزمة: `com.gergesnabil.mosahah` (يُغيّر من `app.json` قبل أول نشر)
- الـ scheme للروابط العميقة: `mosahah://take/<quizId>`
- روابط الطلاب من الويب (`https://host/?id=<quizId>`) تفتح التطبيق عبر `?id`

## الأمان

- HTTPS فقط (`usesCleartextTraffic: false`) — أي رابط http سيُرفض
- كل أسرار الذكاء/المدفوعات على السيرفر فقط — صفر secrets في التطبيق
- مصادقة Firebase + `Authorization: Bearer <idToken>` في كل طلب محمي
- كل عمليات الكتابة ترسل `Idempotency-Key` لمنع التكرار
- صلاحيات Android مقيّدة بالإنترنت فقط (الكاميرا/الصور تُفعّل عند إضافة رفع الصور)
- لتفعيل Firebase App Check (Play Integrity) راجع `src/lib/appCheck.ts`

## الاختلافات المؤجلة عن نسخة الويب

| الميزة | الحالة |
|---|---|
| استخراج أسئلة من PDF/Word/صور | مؤجل — يحتاج رفع ملفات + معالجة سيرفرية |
| لوحة الأدمن (إدارة المستخدمين) | مؤجل — متاح عبر الويب |
| إرسال واتساب / شهادات | مؤجل — يحتاج Twilio على السيرفر |
| اشتراكات داخل التطبيق (IAP) | مؤجل — RevenueCat / Play Billing |
| App Check إجباري | جاهز للربط — يحتاج @react-native-firebase/app-check |

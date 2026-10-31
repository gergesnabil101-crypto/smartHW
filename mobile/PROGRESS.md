# حالة تطوير تطبيق الموبايل — نقطة الاستئناف

آخر commit: `2e659c4`

## ما تم إنجازه

- مشروع Expo SDK 58 (React Native 0.88, React 19.3) في `mobile/` — TypeScript صارم
- معمارية معيارية كاملة (لا ملفات ضخمة): `src/app/` للشاشات + `src/lib/` للخدمات + `src/components/` + `src/features/`
- الشاشات المكتملة: دخول/تسجيل/استعادة كلمة مرور — لوحة المعلم (اختبارات + مجلدات) — محرر اختبار كامل مع توليد AI — تدفق الطالب كاملاً مع مؤقت وتسليم — قائمة النتائج — تفاصيل نتيجة مع إعادة تصحيح مقالي وتعديل يدوي — البروفايل
- طبقة خدمات `src/lib/services.ts` تطابق كل endpoints السيرفر (~50 endpoint مُرسم)
- أمان: HTTPS فقط، Bearer token تلقائي، Idempotency-Key، stub جاهز لـ App Check، صلاحيات Android مقيدة
- `eas.json` جاهز لبناء AAB — معرف الحزمة `com.gergesnabil.mosahah`

## معلومات تقنية مهمة

- **التصحيح سيرفري بالكامل**: `POST /api/quizzes/:id/submit` يصحح MCQ/صح-خطأ ويصحح المقالي بـ Gemini — التطبيق يرسل `student_answers` خام فقط. رد: `{success, id, score, total, feedback}`
- `feedback` محفوظ كـ JSON string بمفتاح question id → `{score, feedback, isCorrect, steps}`
- الطالب يحتاج `check-attempts` ثم `start-attempt` (يرجع attemptToken) ثم `submit`
- إعداد الـ API: `extra.apiBaseUrl` في `app.json` أو env `EXPO_PUBLIC_API_URL` — **لم يُضبط رابط السيرفر بعد**

## مهام الغد (بالترتيب)

1. `npx tsc --noEmit` في mobile/ — كان بطيئاً جداً ولم يكتمل؛ شغّله أولاً وأصلح أي أخطاء
2. `npx expo lint` + `npx expo-doctor`
3. ضبط رابط الـ backend الفعلي في `app.json > extra.apiBaseUrl` + `.env`
4. تجربة التطبيق فعلياً (`npx expo start` + Expo Go أو emulator)
5. رفع على GitHub (يحتاج رابط المستودع من المستخدم)
6. توليد أيقونة التطبيق الحقيقية بدل الافتراضية
7. مؤجل: استخراج PDF/صور — لوحة أدمن — واتساب/شهادات — IAP — App Check إجباري

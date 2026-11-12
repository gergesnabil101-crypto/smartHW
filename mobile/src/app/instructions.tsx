import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { colors, typography } from '../theme';

const Section = ({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) => (
  <Card>
    <View style={styles.secHead}>
      <Text style={styles.secEmoji}>{emoji}</Text>
      <Text style={typography.h3}>{title}</Text>
    </View>
    {children}
  </Card>
);

const Line = ({ children }: { children: string }) => (
  <Text style={styles.line}>• {children}</Text>
);

/** Teacher onboarding guide — explains Flash vs Pro, token billing, and expiry rules. */
export default function InstructionsScreen() {
  return (
    <Screen>
      <Text style={[typography.h2, styles.title]}>📖 تعليمات استخدام المنصة</Text>

      <Section emoji="⚡" title="نظام فلاش (Flash)">
        <Line>النموذج الاقتصادي الأسرع — مثالي للاستخدام اليومي والحصص الكثيفة.</Line>
        <Line>توليد أسئلة سريع + استخراج أسئلة من الصور والملفات.</Line>
        <Line>تصحيح شامل للأسئلة الموضوعية والمقالية بالمعنى.</Line>
        <Line>سعر المليون توكن أقل من برو — أنسب اختيار لتصحيح الواجبات المتكرر.</Line>
      </Section>

      <Section emoji="👑" title="نظام برو (Pro)">
        <Line>نموذج تفكير أعمق — دقة أعلى في الرياضيات والفيزياء والكيمياء والمعادلات المعقدة.</Line>
        <Line>فهم أفضل للرموز العلمية والصيغ الرياضية (LaTeX) وقراءة أدق للصور الصعبة.</Line>
        <Line>تصحيح مقالي أعمق مع ملاحظات تفصيلية وإجابة نموذجية.</Line>
        <Line>سعر المليون توكن أعلى — مناسب للمواد العلمية والمراحل المتقدمة.</Line>
      </Section>

      <Section emoji="⚠️" title="قواعد الاشتراك المهمة">
        <Line>مدة الاشتراك الشهري 30 يوماً من تاريخ التفعيل (السنوي 365 يوماً).</Line>
        <Line>عند انتهاء المدة ينتهي اشتراكك فوراً حتى لو تبقّى رصيد توكنز.</Line>
        <Line>الرصيد المتبقي لا يُرحَّل — عند التجديد يبدأ رصيدك من الصفر بباقة جديدة.</Line>
        <Line>فعّل الباقة التي تستهلكها فعلياً خلال المدة حتى لا تخسر الرصيد الفائض.</Line>
      </Section>

      <Section emoji="🧮" title="كيف يُحسب استهلاك التوكنز؟">
        <Line>المدخلات: نص السؤال + صور الأوراق + تعليمات التصحيح المُرسلة للذكاء الاصطناعي.</Line>
        <Line>المخرجات: إجابة الذكاء الاصطناعي (التصحيح، الملاحظات، الإجابة النموذجية، الأسئلة المولدة).</Line>
        <Line>المخرجات أغلى من المدخلات لأنها «إنتاج» — لذلك يُحتسب سعرها بمعامل مضاعف يحدده مدير المنصة.</Line>
        <Line>كل عملية (توليد/استخراج/تصحيح) تستهلك من رصيدك حسب حجم المحتوى المعالج.</Line>
        <Line>يمكنك متابعة رصيدك اليومي والإجمالي من شاشة «الباقات والاشتراكات».</Line>
      </Section>

      <Section emoji="💡" title="نصائح لاستهلاك أمثل">
        <Line>نظّم ورقة الأسئلة جيداً قبل التصوير — الوضوح يقلل إعادة المحاولات ويوفر التوكنز.</Line>
        <Line>استخدم فلاش للتصحيح اليومي، وبرو عند الحاجة لدقة استثنائية في المسائل العلمية.</Line>
        <Line>للترقية من فلاش إلى برو تدفع فرق السعر فقط حسب التوكنز المتبقية — من شاشة الباقات.</Line>
      </Section>

      <Text style={[typography.caption, styles.footer]}>لأي استفسار تواصل مع إدارة المنصة عبر واتساب من شاشة الاشتراك.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { textAlign: 'right', marginBottom: 12 },
  secHead: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 6 },
  secEmoji: { fontSize: 20 },
  line: { fontSize: 13, lineHeight: 22, color: colors.textSecondary, textAlign: 'right', writingDirection: 'rtl', marginBottom: 3 },
  footer: { textAlign: 'center', marginVertical: 16 },
});

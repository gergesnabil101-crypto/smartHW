import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { aiGenerate } from '../../lib/services';
import { useAuth } from '../../store/AuthContext';
import type { Question } from '../../types';
import { colors, radius, typography } from '../../theme';

interface Props {
  subject?: string;
  onQuestions: (qs: Question[]) => void;
  onClose: () => void;
}

let counter = 0;
const newId = () => `q_${Date.now()}_${counter++}`;

function parseQuestionsJson(raw: string): Question[] {
  const cleaned = (raw || '').replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  try {
    const arr = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((q) => q && typeof q.text === 'string' && q.text.trim())
      .map((q) => ({
        id: newId(),
        text: String(q.text).trim(),
        type: ['multiple-choice', 'true-false', 'essay'].includes(q.type) ? q.type : 'multiple-choice',
        options: Array.isArray(q.options) ? q.options.map(String) : [],
        correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0,
        modelAnswer: q.modelAnswer ? String(q.modelAnswer) : undefined,
        points: 1,
      }));
  } catch {
    return [];
  }
}

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      text: { type: 'STRING' },
      type: { type: 'STRING' },
      options: { type: 'ARRAY', items: { type: 'STRING' } },
      correctAnswer: { type: 'STRING' },
      correctOptionIndex: { type: 'INTEGER' },
      modelAnswer: { type: 'STRING' },
    },
    required: ['text', 'type', 'options', 'correctAnswer', 'correctOptionIndex', 'modelAnswer'],
  },
};

const EXTRACTION_INSTRUCTIONS = `أنت خبير تربوي ومعد اختبارات أول. حوّل محتوى هذا الملف/الصورة إلى بنك أسئلة دقيق لاختبار تعليمي، مع حل كل مسألة بدقة علمية تامة.

قواعد إلزامية:
1. استخرج كل سؤال وتمرين ومسألة في الملف من أوله لآخره دون استثناء — ممنوع الاكتفاء بعينة.
   - انتبه للصفحات متعددة الأعمدة: اقرأ كل الأعمدة بالكامل.
   - الأسئلة الفرعية (أ، ب، ج) تُستخرج كل منها كسؤال مستقل.
2. دقة فائقة في قراءة الرموز العلمية والرياضية والفيزيائية والكيميائية (أولوية قصوى):
   - الأرقام السفلية والعلوية والأسس: H₂O لا تُقرأ H2O خطأً والعكس — ميّز بين الرقم السفلي في الصيغة ($H_{2}O$) والمعامل قبلها ($2H_{2}O$).
   - المعادلات والمتباينات والكسور والجذور والتكاملات والزوايا: اكتبها بتنسيق LaTeX القياسي داخل $...$ (مثل $\\frac{a}{b}$, $\\sqrt{x}$, $x^{2}$, $v^{\\circ}$, $\\Delta$, $\\theta$, $\\pi$, $\\alpha$, $\\Omega$, $\\mu$).
   - وحدات القياس الفيزيائية والرموز العلمية والحروف اليونانية ورموز العناصر بحالة أحرفها الصحيحة (Na لا Na، Fe لا FE).
   - الأرقام العشرية والفواصل بدقة تامة (0.5 لا تصبح 5).
3. أي كلمة تحتها خط في الأصل يجب إحاطتها بوسم <u>الكلمة</u> في نص السؤال أو الخيارات.
4. حل كل مسألة بنفسك بدقة علمية عالية: حدد الإجابة الصحيحة (correctOptionIndex مطابق لنص correctAnswer)، واكتب الإجابة النموذجية وخطوات الحل في modelAnswer مع الحفاظ على دقة الرموز العلمية والرياضية نفسها (LaTeX داخل $...$). ممنوع التخمين أو وضع 0 افتراضياً دون حل.
5. الأنواع: 'multiple-choice' (4 خيارات)، 'true-false' (["True","False"] إنجليزي أو ["صح","خطأ"] عربي)، 'essay' (options: []).
6. حافظ على لغة المستند الأصلية — ممنوع الترجمة.
7. أخرج JSON فقط كمصفوفة كائنات بالحقول: text, type, options, correctAnswer, correctOptionIndex, modelAnswer.`;

function buildPrompt(topic: string, count: number, essayCount: number, subject?: string): string {
  return `أنت خبير تربوي ومعد اختبارات أول. أنشئ اختباراً تعليمياً عن الموضوع التالي: "${topic}"${subject ? ` في مادة ${subject}` : ''}.

المطلوب:
- ${count - essayCount} سؤال اختيار من متعدد ('type': 'multiple-choice') بأربعة خيارات لكل سؤال مع تحديد correctOptionIndex الصحيح بعد التأكد من الحل.
${essayCount > 0 ? `- ${essayCount} سؤال مقالي ('type': 'essay') مع إجابة نموذجية شاملة في modelAnswer تتضمن خطوات الحل.` : ''}
- استخدم تدوين LaTeX القياسي (محاطاً بـ $...$) لكل المعادلات والرموز الرياضية والفيزيائية والكيميائية — بدقة فائقة في الأرقام السفلية ($H_{2}O$) والعلوية والأسس والكسور والحروف اليونانية والوحدات.
- اكتب في 'modelAnswer' لكل سؤال الإجابة النموذجية مع التفسير وخطوات الحل بنفس دقة الرموز العلمية.
- اكتب في 'correctAnswer' نص الخيار الصحيح المطابق تماماً للخيار في 'options'.
- حافظ على نفس لغة الموضوع المطلوب.
- أخرج JSON فقط كمصفوفة كائنات بدون أي نص إضافي.`;
}

type Mode = 'topic' | 'file';
interface PickedFile { name: string; mimeType: string; base64: string }

/** Modal sheet: generate questions from a topic, or extract them from a file/image. */
export function AiGenerateSheet({ subject, onQuestions, onClose }: Props) {
  const { profile } = useAuth();
  const [mode, setMode] = useState<Mode>('topic');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState('5');
  const [essayCount, setEssayCount] = useState('0');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const finish = (raw: string | undefined) => {
    const questions = parseQuestionsJson(raw || '');
    if (questions.length === 0) {
      setError('لم يتم استخراج أسئلة صالحة. جرب ملفاً أو صياغة أوضح.');
      return;
    }
    onQuestions(questions);
    onClose();
  };

  const aiConfig = { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, maxOutputTokens: 8192 };
  const aiMeta = {
    subjectName: subject || profile?.subject,
    planId: profile?.subscription_type,
  };

  const generate = async () => {
    if (!topic.trim()) return setError('اكتب موضوع الاختبار أولاً.');
    const n = Math.min(30, Math.max(1, parseInt(count) || 5));
    const e = Math.min(n, Math.max(0, parseInt(essayCount) || 0));
    setBusy(true);
    setError('');
    try {
      const res = await aiGenerate<{ text?: string }>({
        contents: { parts: [{ text: buildPrompt(topic.trim(), n, e, subject) }] },
        operation: 'generate_quiz',
        ...aiMeta,
        config: aiConfig,
      });
      finish(res?.text);
    } catch (err: any) {
      setError(err?.message || 'فشل التوليد. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  };

  const pickDocument = async () => {
    setError('');
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*', 'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      copyToCacheDirectory: true,
      base64: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    if (!a.base64) return setError('تعذر قراءة الملف. جرب ملفاً أصغر.');
    setFile({ name: a.name || 'file', mimeType: a.mimeType || 'application/pdf', base64: a.base64 });
  };

  const pickImage = async () => {
    setError('');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, base64: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    if (!a.base64) return setError('تعذر قراءة الصورة.');
    setFile({ name: a.fileName || 'image.jpg', mimeType: a.mimeType || 'image/jpeg', base64: a.base64 });
  };

  const extract = async () => {
    if (!file) return setError('اختر ملفاً أو صورة أولاً.');
    setBusy(true);
    setError('');
    try {
      const res = await aiGenerate<{ text?: string }>({
        contents: { parts: [
          { inlineData: { mimeType: file.mimeType, data: file.base64 } },
          { text: EXTRACTION_INSTRUCTIONS },
        ] },
        operation: 'extract_questions',
        ...aiMeta,
        config: aiConfig,
      });
      finish(res?.text);
    } catch (err: any) {
      setError(err?.message || 'فشل الاستخراج. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text style={typography.h3}>توليد أسئلة بالذكاء الاصطناعي</Text>
      <View style={styles.modeRow}>
        <Pressable onPress={() => setMode('topic')} style={[styles.modeChip, mode === 'topic' && styles.modeChipOn]}>
          <Text style={[styles.modeText, mode === 'topic' && styles.modeTextOn]}>من موضوع</Text>
        </Pressable>
        <Pressable onPress={() => setMode('file')} style={[styles.modeChip, mode === 'file' && styles.modeChipOn]}>
          <Text style={[styles.modeText, mode === 'file' && styles.modeTextOn]}>من ملف / صورة</Text>
        </Pressable>
      </View>

      {mode === 'topic' ? (
        <View>
          <Text style={[typography.caption, { marginBottom: 12 }]}>
            اكتب الموضوع وسيتم توليد أسئلة مع الإجابات النموذجية — راجعها قبل الحفظ.
          </Text>
          <Input label="الموضوع" value={topic} onChangeText={setTopic} multiline placeholder="مثال: قوانين نيوتن للحركة — الصف الثالث الإعدادي" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Input label="عدد الأسئلة" value={count} onChangeText={setCount} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="منها مقالي" value={essayCount} onChangeText={setEssayCount} keyboardType="numeric" />
            </View>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Button title={busy ? 'جاري التوليد...' : 'توليد الأسئلة'} onPress={generate} loading={busy} style={{ flex: 1 }} />
            <Button title="إلغاء" variant="ghost" onPress={onClose} disabled={busy} />
          </View>
        </View>
      ) : (
        <View>
          <Text style={[typography.caption, { marginBottom: 12 }]}>
            ارفع ملف PDF أو Word أو صورة ورقة أسئلة — سيستخرج الذكاء كل الأسئلة ويحلها.
          </Text>
          <View style={styles.row}>
            <Button title="📄 اختيار ملف" variant="secondary" onPress={pickDocument} style={{ flex: 1 }} />
            <Button title="🖼 اختيار صورة" variant="secondary" onPress={pickImage} style={{ flex: 1 }} />
          </View>
          {file ? (
            <View style={styles.fileBox}>
              <Text style={typography.body} numberOfLines={1}>📎 {file.name}</Text>
              <Pressable onPress={() => setFile(null)}><Text style={styles.removeFile}>إزالة</Text></Pressable>
            </View>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Button title={busy ? 'جاري الاستخراج...' : 'استخراج الأسئلة'} onPress={extract} loading={busy} disabled={!file} style={{ flex: 1 }} />
            <Button title="إلغاء" variant="ghost" onPress={onClose} disabled={busy} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: 'row-reverse', gap: 8, marginVertical: 12 },
  modeChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  modeChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  modeTextOn: { color: '#fff' },
  row: { flexDirection: 'row', gap: 10 },
  error: { color: colors.danger, textAlign: 'right', writingDirection: 'rtl', marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  fileBox: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 10, marginTop: 10 },
  removeFile: { color: colors.danger, fontWeight: '700', fontSize: 12 },
});

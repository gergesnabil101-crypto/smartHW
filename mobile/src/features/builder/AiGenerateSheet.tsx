import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { aiGenerate } from '../../lib/services';
import { useAuth } from '../../store/AuthContext';
import type { Question } from '../../types';
import { colors, typography } from '../../theme';

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

function buildPrompt(topic: string, count: number, essayCount: number, subject?: string): string {
  return `أنت خبير تربوي ومعد اختبارات أول. أنشئ اختباراً تعليمياً عن الموضوع التالي: "${topic}"${subject ? ` في مادة ${subject}` : ''}.

المطلوب:
- ${count - essayCount} سؤال اختيار من متعدد ('type': 'multiple-choice') بأربعة خيارات لكل سؤال مع تحديد correctOptionIndex الصحيح بعد التأكد من الحل.
${essayCount > 0 ? `- ${essayCount} سؤال مقالي ('type': 'essay') مع إجابة نموذجية شاملة في modelAnswer تتضمن خطوات الحل.` : ''}
- استخدم تدوين LaTeX القياسي (محاطاً بـ $...$) للمعادلات والرموز العلمية.
- اكتب في 'modelAnswer' لكل سؤال الإجابة النموذجية مع التفسير وخطوات الحل.
- اكتب في 'correctAnswer' نص الخيار الصحيح المطابق تماماً للخيار في 'options'.
- حافظ على نفس لغة الموضوع المطلوب.
- أخرج JSON فقط كمصفوفة كائنات بدون أي نص إضافي.`;
}

/** Modal sheet: generate questions from a topic prompt via the server AI endpoint. */
export function AiGenerateSheet({ subject, onQuestions, onClose }: Props) {
  const { profile } = useAuth();
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState('5');
  const [essayCount, setEssayCount] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!topic.trim()) return setError('اكتب موضوع الاختبار أولاً.');
    const n = Math.min(30, Math.max(1, parseInt(count) || 5));
    const e = Math.min(n, Math.max(0, parseInt(essayCount) || 0));
    setBusy(true);
    setError('');
    try {
      const res = await aiGenerate<{ text?: string }>({
        contents: { parts: [{ text: buildPrompt(topic.trim(), n, e, subject) }] },
        operation: 'quiz_generation',
        subjectName: subject || profile?.subject,
        planId: profile?.subscription_type,
        config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, maxOutputTokens: 8192 },
      });
      const questions = parseQuestionsJson(res?.text || '');
      if (questions.length === 0) {
        setError('لم يتم توليد أسئلة صالحة. حاول بصياغة أوضح للموضوع.');
        return;
      }
      onQuestions(questions);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'فشل التوليد. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text style={typography.h3}>توليد أسئلة بالذكاء الاصطناعي</Text>
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
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row-reverse', gap: 10 },
  error: { color: colors.danger, textAlign: 'right', writingDirection: 'rtl', marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
});

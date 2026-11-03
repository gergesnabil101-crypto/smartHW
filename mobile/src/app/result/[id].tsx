import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../store/AuthContext';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Loading, ErrorState } from '../../components/Feedback';
import { MathText } from '../../components/MathText';
import { getQuizForEdit, gradeEssay, gradeResult, listQuizResults, listTeacherResults, reviewResult } from '../../lib/services';
import type { Quiz, StudentResult } from '../../types';
import { colors, radius, typography } from '../../theme';

interface QuestionFeedback {
  score?: number;
  feedback?: string;
  isCorrect?: boolean;
  steps?: unknown[];
}

function parseFeedback(raw: unknown): Record<string, QuestionFeedback> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, QuestionFeedback>;
  try {
    const parsed = JSON.parse(String(raw));
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export default function ResultDetailScreen() {
  const { id, quizId } = useLocalSearchParams<{ id: string; quizId?: string }>();
  const { user, initialized } = useAuth();
  const [result, setResult] = useState<StudentResult | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, QuestionFeedback>>({});
  const [manualScores, setManualScores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [regradingId, setRegradingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const list = quizId ? await listQuizResults(quizId) : await listTeacherResults();
      const found = (list || []).find((r) => String(r.id) === String(id));
      if (!found) {
        setError('لم يتم العثور على هذه النتيجة.');
        return;
      }
      setResult(found);
      setFeedbackMap(parseFeedback(found.feedback));
      const qid = found.quiz_id || quizId;
      if (qid) {
        const q = await getQuizForEdit(qid);
        setQuiz(q);
      }
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل النتيجة.');
    }
  }, [id, quizId]);

  useEffect(() => { load(); }, [load]);

  const totalScore = useMemo(() => {
    if (!quiz) return Number(result?.score) || 0;
    return quiz.questions.reduce((sum, q) => sum + (Number(feedbackMap[q.id]?.score) || 0), 0);
  }, [quiz, feedbackMap, result]);

  const regradeEssay = async (questionId: string) => {
    if (!quiz || !result) return;
    const q = quiz.questions.find((x) => x.id === questionId);
    if (!q) return;
    const answers = (result.student_answers || result.answers || {}) as Record<string, unknown>;
    const studentAnswer = String(answers[questionId] ?? '');
    setRegradingId(questionId);
    try {
      const graded = await gradeEssay({
        question: q.text,
        modelAnswer: q.modelAnswer,
        studentAnswer,
        points: Number(q.points) || 1,
        requiredPoints: q.required_points_count,
        keywords: q.keywords,
        quizTitle: quiz.title,
        subject: quiz.subject,
        teacherId: result.teacher_id || result.user_id,
        quizId: quiz.id,
        studentName: result.student_name,
      });
      setFeedbackMap((prev) => ({
        ...prev,
        [questionId]: { score: graded.score, feedback: graded.feedback, isCorrect: graded.isCorrect, steps: graded.steps },
      }));
    } catch (e: any) {
      Alert.alert('فشل التصحيح', e?.message || 'حاول مرة أخرى.');
    } finally {
      setRegradingId(null);
    }
  };

  const save = async () => {
    if (!result?.id || !quiz) return;
    setSaving(true);
    try {
      const merged = { ...feedbackMap };
      for (const [qid, val] of Object.entries(manualScores)) {
        if (val === '') continue;
        const num = Number(val);
        if (isNaN(num)) continue;
        merged[qid] = { ...(merged[qid] || {}), score: num };
      }
      const newScore = quiz.questions.reduce((s, q) => s + (Number(merged[q.id]?.score) || 0), 0);
      const total = quiz.questions.reduce((s, q) => s + (Number(q.points) || 1), 0);
      await gradeResult(result.id, {
        score: newScore,
        total,
        feedback: merged,
        is_graded: true,
      });
      setFeedbackMap(merged);
      setManualScores({});
      setResult({ ...result, score: newScore, total, is_graded: true });
      Alert.alert('تم', 'تم حفظ الدرجات بنجاح.');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل حفظ الدرجات.');
    } finally {
      setSaving(false);
    }
  };

  const markReviewed = async () => {
    if (!result?.id) return;
    try {
      await reviewResult(result.id, { reviewed_and_sent: true, reviewed_and_sent_at: new Date().toISOString() });
      setResult({ ...result, reviewed_and_sent: true });
      Alert.alert('تم', 'تم تعليم النتيجة كمراجعة وجاهزة للإرسال.');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'تعذر التحديث.');
    }
  };

  if (initialized && !user) return <Redirect href="/(auth)/login" />;
  if (error) return <Screen><ErrorState message={error} onRetry={load} /></Screen>;
  if (!result) return <Screen><Loading text="جاري تحميل النتيجة..." /></Screen>;

  const answers = (result.student_answers || result.answers || {}) as Record<string, unknown>;

  return (
    <Screen>
      <Card>
        <Text style={typography.h2}>{result.student_name}</Text>
        <Text style={typography.bodySecondary}>{result.quiz_title || quiz?.title || ''}</Text>
        <Text style={typography.caption}>
          {result.center_name ? `السنتر: ${result.center_name} • ` : ''}
          الدرجة الحالية: {totalScore} / {result.total}
        </Text>
        {result.reviewed_and_sent ? <Text style={styles.reviewedTag}>✓ تمت المراجعة</Text> : null}
      </Card>

      {quiz?.questions.map((q, i) => {
        const fb = feedbackMap[q.id];
        const ans = answers[q.id];
        const isEssay = q.type === 'essay';
        const chosenIdx = typeof ans === 'number' ? ans : null;
        return (
          <Card key={q.id}>
            <Text style={typography.h3}>سؤال {i + 1} — {Number(q.points) || 1} درجة</Text>
            <MathText text={q.text} style={styles.qText} />

            <Text style={typography.label}>إجابة الطالب:</Text>
            {isEssay ? (
              <Text style={[typography.body, styles.answerBox]}>{String(ans ?? '—')}</Text>
            ) : (
              <Text style={[typography.body, styles.answerBox]}>
                {chosenIdx !== null ? (q.options?.[chosenIdx] ?? String(chosenIdx)) : '—'}
                {fb?.isCorrect ? '  ✓' : ''}
              </Text>
            )}

            {fb?.feedback ? (
              <View style={styles.feedbackBox}>
                <Text style={styles.feedbackLabel}>ملاحظات التصحيح</Text>
                <Text style={typography.bodySecondary}>{fb.feedback}</Text>
              </View>
            ) : null}

            <View style={styles.scoreRow}>
              <Text style={typography.label}>الدرجة: {fb?.score ?? '—'}</Text>
              <View style={styles.manualWrap}>
                <Input
                  placeholder="تعديل"
                  value={manualScores[q.id] ?? ''}
                  onChangeText={(t) => setManualScores((p) => ({ ...p, [q.id]: t }))}
                  keyboardType="numeric"
                  style={styles.manualInput}
                />
              </View>
            </View>

            {isEssay ? (
              <Button
                title={regradingId === q.id ? 'جاري التصحيح...' : 'إعادة تصحيح بالذكاء الاصطناعي'}
                variant="secondary"
                onPress={() => regradeEssay(q.id)}
                loading={regradingId === q.id}
                disabled={regradingId !== null}
              />
            ) : null}
          </Card>
        );
      })}

      <View style={styles.footer}>
        <Button title="حفظ الدرجات" onPress={save} loading={saving} style={{ flex: 1 }} />
        <Button
          title={result.reviewed_and_sent ? 'تمت المراجعة ✓' : 'تعليم كمراجعة'}
          variant="secondary"
          onPress={markReviewed}
          disabled={!!result.reviewed_and_sent}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  reviewedTag: { color: colors.success, fontWeight: '700', marginTop: 6, textAlign: 'right', writingDirection: 'rtl' },
  qText: { marginVertical: 8 },
  answerBox: {
    backgroundColor: colors.bg, borderRadius: radius.md, padding: 10,
    borderWidth: 1, borderColor: colors.border, marginTop: 4,
  },
  feedbackBox: {
    backgroundColor: colors.warningSoft, borderRadius: radius.md,
    padding: 10, marginTop: 10, borderWidth: 1, borderColor: '#fde68a',
  },
  feedbackLabel: { fontSize: 12, fontWeight: '700', color: colors.warning, marginBottom: 4, textAlign: 'right', writingDirection: 'rtl' },
  scoreRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  manualWrap: { width: 90 },
  manualInput: { textAlign: 'center' },
  footer: { flexDirection: 'row', gap: 10, marginVertical: 16 },
});

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Loading, ErrorState } from '../../components/Feedback';
import { QuestionCard } from '../../components/QuestionCard';
import { checkAttempts, getQuizPublic, startAttempt, submitQuiz } from '../../lib/services';
import { LIMITS } from '../../config';
import type { Quiz } from '../../types';
import { colors, radius, typography } from '../../theme';

type Phase = 'intro' | 'quiz' | 'done';

export default function TakeQuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loadError, setLoadError] = useState('');
  const [phase, setPhase] = useState<Phase>('intro');
  const [submitting, setSubmitting] = useState(false);

  // Student info
  const [studentName, setStudentName] = useState('');
  const [centerName, setCenterName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [formError, setFormError] = useState('');

  // Attempt state
  const [attemptToken, setAttemptToken] = useState('');
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const startTimeRef = useRef<number>(0);
  const [result, setResult] = useState<{ score?: number; total?: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    getQuizPublic(id)
      .then(setQuiz)
      .catch((e) => setLoadError(e?.message || 'تعذر تحميل الاختبار.'));
  }, [id]);

  const timeLimitMin = useMemo(() => (quiz?.time_limit ? Number(quiz.time_limit) : null), [quiz]);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Countdown timer — auto-submits when the quiz time limit expires
  useEffect(() => {
    if (phase !== 'quiz' || !timeLimitMin) return;
    setSecondsLeft(timeLimitMin * 60);
    const iv = setInterval(() => {
      setSecondsLeft((s) => {
        if (s === null) return s;
        if (s <= 1) {
          clearInterval(iv);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [phase, timeLimitMin]);

  const submittedRef = useRef(false);
  useEffect(() => {
    if (secondsLeft === 0 && !submittedRef.current) {
      submittedRef.current = true;
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const start = async () => {
    setFormError('');
    if (!quiz) return;
    if (!studentName.trim() || studentName.trim().length > LIMITS.studentNameMax) {
      return setFormError('أدخل اسم الطالب كاملاً.');
    }
    try {
      setSubmitting(true);
      const check = await checkAttempts(quiz.id, {
        student_name: studentName.trim(),
        parent_phone: parentPhone.trim(),
        student_phone: studentPhone.trim(),
        student_code: quiz.require_student_code ? studentCode.trim() : undefined,
      });
      if (check.allowed === false) {
        setFormError(check.error || 'غير مسموح لك بأداء هذا الاختبار.');
        return;
      }
      const started = await startAttempt(quiz.id, {
        student_name: studentName.trim(),
        student_code: quiz.require_student_code ? studentCode.trim() : undefined,
      });
      if (started.error) {
        setFormError(started.error);
        return;
      }
      setAttemptToken(started.attemptToken || '');
      startTimeRef.current = Date.now();
      setPhase('quiz');
    } catch (e: any) {
      setFormError(e?.message || 'تعذر بدء الاختبار. حاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    if (!quiz || submitting) return;
    const unanswered = quiz.questions.filter((q) => answers[q.id] === undefined || answers[q.id] === '').length;
    if (unanswered > 0 && secondsLeft !== 0) {
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert('أسئلة بدون إجابة', `لديك ${unanswered} سؤال بدون إجابة. هل تريد التسليم؟`, [
          { text: 'رجوع', style: 'cancel', onPress: () => resolve(false) },
          { text: 'تسليم', style: 'destructive', onPress: () => resolve(true) },
        ]);
      });
      if (!proceed) return;
    }
    setSubmitting(true);
    try {
      const res = await submitQuiz(quiz.id, {
        student_name: studentName.trim(),
        center_name: centerName.trim(),
        parent_phone: parentPhone.trim(),
        student_phone: studentPhone.trim(),
        student_code: studentCode.trim() || undefined,
        student_answers: answers,
        attemptToken: attemptToken || undefined,
        time_spent_seconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
      });
      if (res.error) {
        Alert.alert('خطأ', res.error);
        return;
      }
      setResult({ score: res.score, total: res.total });
      setPhase('done');
    } catch (e: any) {
      Alert.alert('فشل التسليم', e?.message || 'تحقق من الإنترنت وحاول مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return <Screen><ErrorState message={loadError} onRetry={() => router.replace(`/take/${id}`)} /></Screen>;
  }
  if (!quiz) {
    return <Screen><Loading text="جاري تحميل الاختبار..." /></Screen>;
  }

  if (phase === 'done') {
    const showScore = quiz.showResultsToStudent !== false && result?.score !== undefined;
    return (
      <Screen>
        <View style={styles.doneWrap}>
          <Text style={styles.doneEmoji}>✅</Text>
          <Text style={typography.h1}>تم تسليم إجاباتك بنجاح</Text>
          {showScore ? (
            <Card style={styles.scoreCard}>
              <Text style={styles.scoreText}>
                {result!.score} / {result!.total}
              </Text>
              <Text style={typography.bodySecondary}>درجتك في «{quiz.title}»</Text>
            </Card>
          ) : (
            <Text style={typography.bodySecondary}>سيتم إعلان النتيجة من معلمك بعد المراجعة.</Text>
          )}
        </View>
      </Screen>
    );
  }

  if (phase === 'intro') {
    return (
      <Screen>
        <Text style={[typography.h1, styles.center]}>{quiz.title}</Text>
        {quiz.teacher_name ? <Text style={[typography.bodySecondary, styles.center]}>المعلم: {quiz.teacher_name}</Text> : null}
        <Text style={[typography.caption, styles.center]}>
          {quiz.questions.length} سؤال{timeLimitMin ? ` • ${timeLimitMin} دقيقة` : ''}
        </Text>

        <Card style={{ marginTop: 16 }}>
          <Input label="اسم الطالب" value={studentName} onChangeText={setStudentName} maxLength={LIMITS.studentNameMax} />
          <Input label="اسم السنتر / المجموعة (اختياري)" value={centerName} onChangeText={setCenterName} maxLength={LIMITS.centerNameMax} />
          <Input label="رقم ولي الأمر (اختياري)" value={parentPhone} onChangeText={setParentPhone} keyboardType="phone-pad" maxLength={LIMITS.phoneMax} />
          <Input label="رقم الطالب (اختياري)" value={studentPhone} onChangeText={setStudentPhone} keyboardType="phone-pad" maxLength={LIMITS.phoneMax} />
          {quiz.require_student_code ? (
            <Input label="كود الطالب" value={studentCode} onChangeText={setStudentCode} autoCapitalize="characters" />
          ) : null}
          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          <Button title="بدء الاختبار" onPress={start} loading={submitting} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={[typography.h2, styles.center]}>{quiz.title}</Text>
      {secondsLeft !== null ? (
        <Text style={[styles.timer, secondsLeft <= 60 && styles.timerUrgent]}>
          ⏱ {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
        </Text>
      ) : null}
      {quiz.questions.map((q, i) => (
        <QuestionCard
          key={q.id}
          question={q}
          index={i}
          value={answers[q.id] ?? null}
          onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
        />
      ))}
      <Button title="تسليم الإجابات" onPress={submit} loading={submitting} style={styles.submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center', marginTop: 8 },
  error: { color: colors.danger, textAlign: 'right', writingDirection: 'rtl', marginBottom: 10 },
  submit: { marginVertical: 16 },
  doneWrap: { alignItems: 'center', marginTop: 60, gap: 12 },
  doneEmoji: { fontSize: 56 },
  timer: { textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.textSecondary, marginTop: 8 },
  timerUrgent: { color: colors.danger },
  scoreCard: { alignItems: 'center', padding: 24, alignSelf: 'stretch' },
  scoreText: { fontSize: 40, fontWeight: '800', color: colors.primary },
});

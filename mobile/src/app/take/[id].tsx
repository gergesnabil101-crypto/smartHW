import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ScreenCapture from 'expo-screen-capture';
import { Screen } from '../../components/Screen';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Loading, ErrorState } from '../../components/Feedback';
import { QuestionCard } from '../../components/QuestionCard';
import { checkAttempts, getQuizPublic, startAttempt, submitQuiz } from '../../lib/services';
import { db } from '../../lib/firebase';
import { LIMITS } from '../../config';
import type { Quiz } from '../../types';
import { colors, radius, typography } from '../../theme';

interface Notif { id: string; title: string; message: string; targetType?: string; targetValue?: string; created_at?: string }

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
  const [result, setResult] = useState<{ score?: number; total?: number; feedback?: Record<string, any> } | null>(null);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [exporting, setExporting] = useState(false);

  // Anti-cheat counters (refs so auto-submit always reads the latest values)
  const leftAppRef = useRef(0);
  const shotsRef = useRef(0);
  const [leftAppCount, setLeftAppCount] = useState(0);

  useEffect(() => {
    if (!id) return;
    getQuizPublic(id)
      .then(setQuiz)
      .catch((e) => setLoadError(e?.message || 'تعذر تحميل الاختبار.'));
  }, [id]);

  // Platform announcements for students — filtered exactly like the legacy web take-intro view
  useEffect(() => {
    if (!quiz) return;
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'notifications'));
        const grade = Array.isArray(quiz.grade_level) ? quiz.grade_level[0] : quiz.grade_level;
        const list: Notif[] = [];
        snap.forEach((d) => {
          const n = { id: d.id, ...(d.data() as any) } as Notif;
          const v = String(n.targetValue || '').trim();
          const ok =
            !n.targetType || n.targetType === 'all' ||
            (n.targetType === 'grade' && (!v || v === 'الكل' || v === grade)) ||
            (n.targetType === 'subject' && (!v || v === 'الكل' || v === quiz.subject)) ||
            (n.targetType === 'teacher' && (!v || v === 'الكل' || v === quiz.teacher_name));
          if (ok) list.push(n);
        });
        list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        setNotifs(list);
      } catch { /* announcements are best-effort */ }
    })();
  }, [quiz]);

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
      submit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  // Anti-cheat: block screenshots and count app-background exits during the quiz
  useEffect(() => {
    if (phase !== 'quiz') return;
    ScreenCapture.preventScreenCaptureAsync('quiz').catch(() => {});
    const shotSub = ScreenCapture.addScreenshotListener(() => {
      shotsRef.current += 1;
      Alert.alert('محاولة لقطة شاشة ⚠️', 'أخذ لقطات شاشة أثناء الاختبار مسجّل وسيظهر للمعلم.');
    });
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      leftAppRef.current += 1;
      setLeftAppCount(leftAppRef.current);
      if (leftAppRef.current >= 3 && !submittedRef.current) {
        submittedRef.current = true;
        Alert.alert('تم تسليم الاختبار تلقائياً', 'تجاوزت حد الخروج من التطبيق أثناء الاختبار.');
        submit(true);
      } else {
        Alert.alert(
          'تحذير من الغش ⚠️',
          `خروجك من التطبيق أثناء الاختبار مسجّل وسيظهر للمعلم (${leftAppRef.current}/3).\nعند الخروج الثالث سيتم تسليم الاختبار تلقائياً.`
        );
      }
    });
    return () => {
      shotSub?.remove();
      appSub?.remove();
      ScreenCapture.allowScreenCaptureAsync('quiz').catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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

  const submit = async (force = false) => {
    if (!quiz || submitting) return;
    const unanswered = quiz.questions.filter((q) => answers[q.id] === undefined || answers[q.id] === '').length;
    if (unanswered > 0 && secondsLeft !== 0 && !force) {
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
        left_app_count: leftAppRef.current,
        screenshot_attempts: shotsRef.current,
      });
      if (res.error) {
        Alert.alert('خطأ', res.error);
        return;
      }
      setResult({ score: res.score, total: res.total, feedback: res.feedback });
      setPhase('done');
    } catch (e: any) {
      Alert.alert('فشل التسليم', e?.message || 'تحقق من الإنترنت وحاول مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  // Student-facing PDF: the quiz with their answers + grading notes
  const exportMyResult = async () => {
    if (!quiz || !result) return;
    setExporting(true);
    try {
      const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const answerText = (q: any, a: number | string | undefined) => {
        if (a === undefined || a === '') return '<i>بدون إجابة</i>';
        if (typeof a === 'number') return esc(q.options?.[a] ?? `اختيار ${a + 1}`);
        return esc(a);
      };
      const qHtml = quiz.questions.map((q, i) => {
        const fb = result.feedback?.[q.id];
        const score = fb ? Number(fb.score ?? 0) : null;
        const pts = Number(q.points) || 1;
        const ok = fb?.isCorrect === true || fb?.status === 'correct' || score === pts;
        const color = score === null ? '#64748b' : ok ? '#16a34a' : (score as number) > 0 ? '#d97706' : '#dc2626';
        const steps = Array.isArray(fb?.steps)
          ? fb.steps.map((s: any) => `<li>${esc(typeof s === 'string' ? s : s?.text || s?.description || '')}</li>`).join('')
          : '';
        return `<div class="q">
          <div class="qhead"><b>س${i + 1}.</b> ${esc(q.text)} ${score !== null ? `<span class="pts" style="color:${color}">(${score} / ${pts})</span>` : ''}</div>
          <div class="ans"><b>إجابتك:</b> ${answerText(q, answers[q.id])}</div>
          ${fb?.feedback ? `<div class="fb"><b>ملاحظات التصحيح:</b> ${esc(fb.feedback)}</div>` : ''}
          ${steps ? `<ul class="steps">${steps}</ul>` : ''}
          ${fb?.correctExample ? `<div class="model"><b>الإجابة النموذجية:</b> ${esc(fb.correctExample)}</div>` : ''}
        </div>`;
      }).join('');
      const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>
        body{font-family:Arial,'Segoe UI';direction:rtl;padding:24px;color:#0f172a}
        h1{font-size:20px} .meta{color:#475569;font-size:13px;margin:4px 0}
        .score{font-size:26px;font-weight:800;color:#4f46e5;margin:12px 0}
        .q{border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin:12px 0}
        .qhead{font-size:15px;line-height:1.7} .ans,.fb,.model{font-size:13px;margin-top:8px;color:#334155}
        .fb{background:#f8fafc;padding:8px;border-radius:8px}
        .model{color:#16a34a} .steps{font-size:12px;color:#475569;margin:6px 0;padding-right:18px}
        .pts{font-size:12px;font-weight:700}
        .foot{margin-top:24px;font-size:11px;color:#94a3b8;text-align:center}
      </style></head><body>
        <h1>${esc(quiz.title)}</h1>
        <div class="meta">الطالب: ${esc(studentName)}${centerName ? ` • السنتر: ${esc(centerName)}` : ''}${quiz.teacher_name ? ` • المعلم: ${esc(quiz.teacher_name)}` : ''}</div>
        <div class="meta">التاريخ: ${new Date().toLocaleString('ar-EG')}</div>
        <div class="score">الدرجة: ${result.score ?? '—'} / ${result.total ?? '—'}</div>
        ${qHtml}
        <div class="foot">تم إنشاء هذا التقرير عبر تطبيق مصحح الواجبات الذكي</div>
      </body></html>`;
      const file = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'نتيجة الاختبار' });
      } else {
        await Print.printAsync({ html });
      }
    } catch {
      Alert.alert('فشل التصدير', 'تعذر إنشاء ملف PDF — حاول مرة أخرى.');
    } finally {
      setExporting(false);
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
          {showScore ? (
            <Button title="📄 تحميل الاختبار مع إجاباتي والتصحيح" variant="secondary" onPress={exportMyResult} loading={exporting} style={{ alignSelf: 'stretch', marginTop: 16 }} />
          ) : null}
          {showScore && result?.feedback ? (
            <View style={{ alignSelf: 'stretch', marginTop: 16, gap: 10 }}>
              {quiz.questions
                .filter((q) => result.feedback && result.feedback[q.id])
                .map((q) => {
                  const fb = result.feedback![q.id];
                  const ok = fb.isCorrect === true || fb.status === 'correct';
                  const partial = !ok && Number(fb.score) > 0;
                  return (
                    <Card key={q.id} style={{ borderRightWidth: 4, borderRightColor: ok ? colors.success : partial ? colors.warning : colors.danger }}>
                      <Text style={[typography.h3, { textAlign: 'right' }]} numberOfLines={3}>{q.text}</Text>
                      <Text style={[typography.caption, { textAlign: 'right', marginTop: 4 }]}>
                        الدرجة: {Number(fb.score ?? 0)} / {q.points || 1} — {ok ? 'صحيحة ✅' : partial ? 'صحيحة جزئياً 🟡' : 'تحتاج مراجعة ❌'}
                      </Text>
                      {fb.feedback ? (
                        <Text style={[typography.body, { textAlign: 'right', marginTop: 8 }]}>{String(fb.feedback)}</Text>
                      ) : null}
                      {Array.isArray(fb.steps) && fb.steps.length > 0 ? (
                        <View style={{ marginTop: 8 }}>
                          {fb.steps.map((s: any, i: number) => (
                            <Text key={i} style={[typography.caption, { textAlign: 'right' }]}>
                              • {typeof s === 'string' ? s : s?.text || s?.description || JSON.stringify(s)}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                      {fb.correctExample ? (
                        <Text style={[typography.caption, { textAlign: 'right', marginTop: 8, color: colors.success }]}>
                          الإجابة النموذجية: {String(fb.correctExample)}
                        </Text>
                      ) : null}
                    </Card>
                  );
                })}
            </View>
          ) : null}
        </View>
      </Screen>
    );
  }

  if (phase === 'intro') {
    return (
      <Screen>
        {notifs.length ? (
          <View style={{ gap: 8, marginBottom: 12 }}>
            {notifs.map((n) => (
              <View key={n.id} style={styles.notifCard}>
                <Text style={styles.notifTitle}>🔔 {n.title}</Text>
                <Text style={styles.notifMsg}>{n.message}</Text>
                <Text style={styles.notifMeta}>إشعار من إدارة المنصة{n.created_at ? ` • ${new Date(n.created_at).toLocaleDateString('ar-EG')}` : ''}</Text>
              </View>
            ))}
          </View>
        ) : null}
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
      {leftAppCount > 0 ? (
        <Text style={styles.cheatWarn}>⚠️ خروج من التطبيق مسجّل: {leftAppCount}/3</Text>
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
  notifCard: { backgroundColor: '#b45309', borderRadius: radius.md, padding: 12 },
  notifTitle: { color: '#fff', fontWeight: '800', fontSize: 14, textAlign: 'right' },
  notifMsg: { color: '#fef3c7', fontSize: 12, lineHeight: 20, textAlign: 'right', writingDirection: 'rtl', marginTop: 4 },
  notifMeta: { color: '#fde68a', fontSize: 10, textAlign: 'right', marginTop: 6 },
  cheatWarn: { textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.danger, marginTop: 4 },
});

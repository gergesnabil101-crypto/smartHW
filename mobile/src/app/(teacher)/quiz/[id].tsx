import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Screen } from '../../../components/Screen';
import { Card } from '../../../components/Card';
import { Input } from '../../../components/Input';
import { Button } from '../../../components/Button';
import { Loading, ErrorState } from '../../../components/Feedback';
import { QuestionEditor } from '../../../features/builder/QuestionEditor';
import { AiGenerateSheet } from '../../../features/builder/AiGenerateSheet';
import { api } from '../../../lib/api';
import { saveQuiz } from '../../../lib/services';
import { API_BASE_URL, LIMITS } from '../../../config';
import { GRADE_LEVELS } from '../../../constants';
import { useAuth } from '../../../store/AuthContext';
import type { Question, Quiz } from '../../../types';
import { colors, radius, typography } from '../../../theme';

let qCounter = 0;
const newQuestionId = () => `q_${Date.now()}_${qCounter++}`;

const emptyQuestion = (): Question => ({
  id: newQuestionId(),
  text: '',
  type: 'multiple-choice',
  options: ['', '', '', ''],
  correctOptionIndex: 0,
  points: 1,
});

export default function QuizEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const { user } = useAuth();

  const [quiz, setQuiz] = useState<Quiz | null>(isNew ? {
    id: `quiz_${Date.now()}`,
    title: '',
    questions: [],
    showResultsToStudent: true,
    is_active: true,
  } : null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [showAi, setShowAi] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async () => {
    if (isNew) return;
    try {
      const q = await api.get<Quiz>(`/api/quizzes/${encodeURIComponent(id!)}`);
      setQuiz(q);
    } catch (e: any) {
      setLoadError(e?.message || 'تعذر تحميل الاختبار.');
    }
  }, [id, isNew]);

  useEffect(() => { load(); }, [load]);

  const update = (patch: Partial<Quiz>) => setQuiz((q) => (q ? { ...q, ...patch } : q));

  const upsertQuestion = (q: Question) => {
    setQuiz((prev) => {
      if (!prev) return prev;
      const idx = prev.questions.findIndex((x) => x.id === q.id);
      const questions = idx >= 0
        ? prev.questions.map((x) => (x.id === q.id ? q : x))
        : [...prev.questions, q];
      return { ...prev, questions };
    });
    setEditing(null);
  };

  const removeQuestion = (qid: string) => {
    setQuiz((prev) => prev ? { ...prev, questions: prev.questions.filter((x) => x.id !== qid) } : prev);
  };

  const shareUrl = useMemo(() => (quiz && !isNew ? `${API_BASE_URL}/?id=${quiz.id}` : ''), [quiz, isNew]);

  const copyLink = async () => {
    await Clipboard.setStringAsync(shareUrl);
    Alert.alert('تم النسخ', 'تم نسخ رابط الاختبار — أرسله لطلابك.');
  };

  const save = async () => {
    if (!quiz) return;
    if (!quiz.title.trim()) return Alert.alert('العنوان مطلوب', 'أدخل عنوان الاختبار قبل الحفظ.');
    if (quiz.questions.length === 0) return Alert.alert('لا توجد أسئلة', 'أضف سؤالاً واحداً على الأقل.');
    const invalid = quiz.questions.find((q) => !q.text.trim());
    if (invalid) return Alert.alert('سؤال ناقص', 'يوجد سؤال بدون نص — أكمله أو احذفه.');
    setSaving(true);
    try {
      await saveQuiz({
        id: quiz.id,
        title: quiz.title.trim(),
        data: quiz,
        folder_id: quiz.folder_id || null,
        grade_level: quiz.grade_level || null,
        expires_at: quiz.expires_at || null,
      });
      Alert.alert('تم الحفظ', 'تم حفظ الاختبار بنجاح.', [
        { text: 'حسناً', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('فشل الحفظ', e?.message || 'حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <Screen><ErrorState message={loadError} onRetry={load} /></Screen>;
  if (!quiz) return <Screen><Loading text="جاري تحميل الاختبار..." /></Screen>;

  return (
    <Screen scroll={false}>
      <FlatList
        data={quiz.questions}
        keyExtractor={(q) => q.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Input
              label="عنوان الاختبار"
              value={quiz.title}
              onChangeText={(t) => update({ title: t })}
              placeholder="مثال: اختبار الوحدة الأولى — قوانين نيوتن"
              maxLength={LIMITS.quizTitleMax}
            />
            <Input
              label="المادة"
              value={quiz.subject || ''}
              onChangeText={(t) => update({ subject: t })}
              placeholder="مثال: فيزياء"
            />

            <Pressable onPress={() => setShowSettings((s) => !s)} style={styles.settingsToggle}>
              <Text style={styles.settingsToggleText}>{showSettings ? '▾ إخفاء الإعدادات' : '▸ إعدادات إضافية'}</Text>
            </Pressable>
            {showSettings ? (
              <Card>
                <Text style={typography.label}>الصف الدراسي</Text>
                <View style={styles.chipsWrap}>
                  {GRADE_LEVELS.map((g) => {
                    const selected = Array.isArray(quiz.grade_level)
                      ? quiz.grade_level.includes(g.value)
                      : quiz.grade_level === g.value;
                    return (
                      <Pressable
                        key={g.value}
                        onPress={() => {
                          const cur = Array.isArray(quiz.grade_level) ? quiz.grade_level : quiz.grade_level ? [quiz.grade_level] : [];
                          update({ grade_level: selected ? cur.filter((v) => v !== g.value) : [...cur, g.value] });
                        }}
                        style={[styles.chip, selected && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextActive]}>{g.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Input
                  label="الحد الأقصى للمحاولات (فارغ = بلا حد)"
                  value={quiz.maxAttempts ? String(quiz.maxAttempts) : ''}
                  onChangeText={(t) => update({ maxAttempts: t ? parseInt(t) : undefined })}
                  keyboardType="numeric"
                />
                <Pressable
                  style={styles.switchRow}
                  onPress={() => update({ showResultsToStudent: quiz.showResultsToStudent === false })}
                >
                  <Text style={typography.body}>إظهار النتيجة للطالب بعد التسليم</Text>
                  <View style={[styles.switch, quiz.showResultsToStudent !== false && styles.switchOn]}>
                    <View style={[styles.knob, quiz.showResultsToStudent !== false && styles.knobOn]} />
                  </View>
                </Pressable>
              </Card>
            ) : null}

            {!isNew ? (
              <Pressable onPress={copyLink} style={styles.linkBox}>
                <Text style={styles.linkLabel}>🔗 رابط الطلاب — اضغط للنسخ</Text>
                <Text style={styles.linkText} numberOfLines={1}>{shareUrl}</Text>
              </Pressable>
            ) : null}

            <View style={styles.addRow}>
              <Button title="+ سؤال" onPress={() => setEditing(emptyQuestion())} style={{ flex: 1 }} />
              <Button title="✨ توليد بالذكاء" variant="secondary" onPress={() => setShowAi(true)} style={{ flex: 1 }} />
            </View>

            <Text style={[typography.h3, { marginTop: 8, marginBottom: 4 }]}>
              الأسئلة ({quiz.questions.length})
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Card onPress={() => setEditing(item)}>
            <View style={styles.qRow}>
              <Text style={typography.body} numberOfLines={2}>
                {index + 1}. {item.text || '(سؤال فارغ)'}
              </Text>
              <Pressable onPress={() => removeQuestion(item.id)} hitSlop={8}>
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            </View>
            <Text style={typography.caption}>
              {item.type === 'essay' ? 'مقالي' : item.type === 'true-false' ? 'صح/خطأ' : 'اختيارات'} • {item.points || 1} درجة
            </Text>
          </Card>
        )}
        ListFooterComponent={
          <Button title={saving ? 'جاري الحفظ...' : 'حفظ الاختبار'} onPress={save} loading={saving} style={{ marginVertical: 16 }} />
        }
      />

      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        <Screen>
          {editing ? <QuestionEditor initial={editing} onSave={upsertQuestion} onCancel={() => setEditing(null)} /> : null}
        </Screen>
      </Modal>

      <Modal visible={showAi} animationType="slide" onRequestClose={() => setShowAi(false)}>
        <Screen>
          <AiGenerateSheet
            subject={quiz.subject}
            onQuestions={(qs) => setQuiz((prev) => prev ? { ...prev, questions: [...prev.questions, ...qs] } : prev)}
            onClose={() => setShowAi(false)}
          />
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  settingsToggle: { paddingVertical: 8 },
  settingsToggleText: { color: colors.primary, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  chipsWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginVertical: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.textSecondary },
  chipTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  switch: { width: 44, height: 24, borderRadius: 12, backgroundColor: colors.border, padding: 2, justifyContent: 'center' },
  switchOn: { backgroundColor: colors.primary },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: 'flex-start' },
  knobOn: { alignSelf: 'flex-end' },
  linkBox: { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 12, marginBottom: 12 },
  linkLabel: { fontSize: 13, fontWeight: '700', color: colors.primary, textAlign: 'right', writingDirection: 'rtl' },
  linkText: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  addRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  qRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8 },
  removeText: { color: colors.danger, fontSize: 16, fontWeight: '700', padding: 4 },
});

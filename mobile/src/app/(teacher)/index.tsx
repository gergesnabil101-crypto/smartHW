import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Loading, EmptyState, ErrorState } from '../../components/Feedback';
import { listMyQuizzes, listFolders, createFolder, deleteQuiz, deleteFolder, saveQuiz } from '../../lib/services';
import { ShareSheet } from '../../features/quizzes/ShareSheet';
import { API_BASE_URL } from '../../config';
import type { Quiz, Folder } from '../../types';
import { colors, radius, typography } from '../../theme';

export default function DashboardScreen() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [folderModal, setFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [savingFolder, setSavingFolder] = useState(false);
  const [shareQuiz, setShareQuiz] = useState<Quiz | null>(null);
  const [moveQuiz, setMoveQuiz] = useState<Quiz | null>(null);
  const [busyQuizId, setBusyQuizId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [q, f] = await Promise.all([listMyQuizzes(), listFolders()]);
      setQuizzes(Array.isArray(q) ? q : []);
      setFolders(Array.isArray(f) ? f : []);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل الاختبارات.');
      setQuizzes([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const visibleQuizzes = useMemo(() => {
    if (!quizzes) return [];
    return activeFolder ? quizzes.filter((q) => q.folder_id === activeFolder) : quizzes;
  }, [quizzes, activeFolder]);

  const confirmDeleteQuiz = (quiz: Quiz) => {
    Alert.alert('حذف الاختبار', `هل أنت متأكد من حذف "${quiz.title}"؟ لا يمكن التراجع.`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteQuiz(quiz.id);
            setQuizzes((prev) => prev?.filter((q) => q.id !== quiz.id) || []);
          } catch (e: any) {
            Alert.alert('خطأ', e?.message || 'فشل حذف الاختبار.');
          }
        },
      },
    ]);
  };

  const patchQuiz = async (quiz: Quiz, patch: Partial<Quiz>) => {
    const next = { ...quiz, ...patch };
    setQuizzes((prev) => prev?.map((q) => (q.id === quiz.id ? next : q)) || []);
    setBusyQuizId(quiz.id);
    try {
      await saveQuiz({
        id: next.id,
        title: next.title,
        data: next,
        folder_id: next.folder_id || null,
        grade_level: next.grade_level || null,
        expires_at: next.expires_at || null,
      });
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل تحديث الاختبار.');
      await load();
    } finally {
      setBusyQuizId(null);
    }
  };

  const submitFolder = async () => {
    if (!folderName.trim()) return;
    setSavingFolder(true);
    try {
      await createFolder(folderName.trim());
      setFolderName('');
      setFolderModal(false);
      await load();
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل إنشاء المجلد.');
    } finally {
      setSavingFolder(false);
    }
  };

  if (quizzes === null && !error) {
    return <Screen><Loading text="جاري تحميل اختباراتك..." /></Screen>;
  }

  return (
    <Screen scroll={false}>
      {/* Folder filter row */}
      <View style={styles.folderRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.folderRow}>
          {[{ id: null, name: 'الكل' } as any, ...folders].map((item) => (
            <Pressable
              key={String(item.id ?? 'all')}
              onPress={() => setActiveFolder(item.id)}
              onLongPress={() => {
                if (!item.id) return;
                Alert.alert('حذف المجلد', `حذف مجلد "${item.name}"؟ (الاختبارات بداخله لن تُحذف)`, [
                  { text: 'إلغاء', style: 'cancel' },
                  { text: 'حذف', style: 'destructive', onPress: () => deleteFolder(item.id).then(load).catch(() => null) },
                ]);
              }}
              style={[styles.folderChip, activeFolder === item.id && styles.folderChipActive]}
            >
              <Text style={[styles.folderChipText, activeFolder === item.id && styles.folderChipTextActive]}>
                {item.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {error ? <ErrorState message={error} onRetry={load} /> : null}

      <FlatList
        data={visibleQuizzes}
        keyExtractor={(q) => q.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            title="لا توجد اختبارات بعد"
            hint="اضغط «اختبار جديد» لإنشاء أول اختبار لك"
          />
        }
        renderItem={({ item }) => {
          const expired = !!item.expires_at && new Date(item.expires_at as any).getTime() < Date.now();
          const inactive = item.is_active === false;
          return (
            <Card onPress={() => router.push({ pathname: '/quiz/[id]', params: { id: item.id } })}>
              <View style={styles.quizRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={typography.h3} numberOfLines={1}>{item.title}</Text>
                    {expired ? <Text style={styles.badgeExpired}>منتهي</Text> : null}
                    {inactive ? <Text style={styles.badgeInactive}>معطّل</Text> : null}
                  </View>
                  <Text style={typography.caption}>
                    {item.questions?.length || 0} سؤال{item.subject ? ` • ${item.subject}` : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.actionsRow}>
                <Pressable onPress={() => setShareQuiz(item)} style={styles.actionBtn}>
                  <Text style={styles.actionText}>🔗 مشاركة</Text>
                </Pressable>
                <Pressable onPress={() => router.push({ pathname: '/(teacher)/results', params: { quizId: item.id } })} style={styles.actionBtn}>
                  <Text style={styles.actionText}>📊 النتائج</Text>
                </Pressable>
                <Pressable onPress={() => setMoveQuiz(item)} style={styles.actionBtn}>
                  <Text style={styles.actionText}>📁 نقل</Text>
                </Pressable>
                <Pressable
                  onPress={() => patchQuiz(item, { is_active: !inactive })}
                  disabled={busyQuizId === item.id}
                  style={styles.actionBtn}
                >
                  <Text style={styles.actionText}>{inactive ? '▶️ تفعيل' : '⏸ تعطيل'}</Text>
                </Pressable>
                <Pressable onPress={() => confirmDeleteQuiz(item)} style={styles.actionBtn} hitSlop={6}>
                  <Text style={styles.actionDelete}>🗑 حذف</Text>
                </Pressable>
              </View>
            </Card>
          );
        }}
      />

      <View style={styles.actions}>
        <Button title="+ اختبار جديد" onPress={() => router.push({ pathname: '/quiz/[id]', params: { id: 'new' } })} style={{ flex: 1 }} />
        <Button title="+ مجلد" variant="secondary" onPress={() => setFolderModal(true)} />
      </View>
      <Text style={styles.buildTag}>v1.2</Text>

      {/* Share sheet */}
      <Modal visible={!!shareQuiz} transparent animationType="fade" onRequestClose={() => setShareQuiz(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={typography.h3}>مشاركة «{shareQuiz?.title}»</Text>
            {shareQuiz ? (
              <ShareSheet quizTitle={shareQuiz.title} shareUrl={`${API_BASE_URL}/?id=${shareQuiz.id}`} />
            ) : null}
            <Button title="إغلاق" variant="ghost" onPress={() => setShareQuiz(null)} />
          </View>
        </View>
      </Modal>

      {/* Move to folder */}
      <Modal visible={!!moveQuiz} transparent animationType="fade" onRequestClose={() => setMoveQuiz(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={typography.h3}>نقل «{moveQuiz?.title}» إلى مجلد</Text>
            <Pressable
              style={styles.folderOption}
              onPress={() => { patchQuiz(moveQuiz!, { folder_id: undefined }); setMoveQuiz(null); }}
            >
              <Text style={typography.body}>بدون مجلد</Text>
            </Pressable>
            {folders.map((f) => (
              <Pressable
                key={f.id}
                style={styles.folderOption}
                onPress={() => { patchQuiz(moveQuiz!, { folder_id: f.id }); setMoveQuiz(null); }}
              >
                <Text style={typography.body}>📁 {f.name}</Text>
              </Pressable>
            ))}
            <Button title="إلغاء" variant="ghost" onPress={() => setMoveQuiz(null)} />
          </View>
        </View>
      </Modal>

      <Modal visible={folderModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={typography.h3}>مجلد جديد</Text>
            <Input
              label="اسم المجلد"
              value={folderName}
              onChangeText={setFolderName}
              placeholder="مثال: اختبارات شهر أكتوبر"
            />
            <View style={styles.modalActions}>
              <Button title="إنشاء" onPress={submitFolder} loading={savingFolder} style={{ flex: 1 }} />
              <Button title="إلغاء" variant="ghost" onPress={() => setFolderModal(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  folderRowWrap: { flexShrink: 0, minHeight: 48 },
  folderRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', flexDirection: 'row' },
  folderChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  folderChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  folderChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  folderChipTextActive: { color: '#fff' },
  list: { padding: 16, flexGrow: 1 },
  quizRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  titleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  badgeExpired: { fontSize: 10, fontWeight: '700', color: colors.danger, backgroundColor: colors.dangerSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  badgeInactive: { fontSize: 10, fontWeight: '700', color: colors.warning, backgroundColor: colors.warningSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  actionsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4, marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  actionBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.sm },
  actionText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  actionDelete: { fontSize: 12, fontWeight: '600', color: colors.danger },
  folderOption: { paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, gap: 10 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  buildTag: { position: 'absolute', bottom: 2, left: 20, fontSize: 9, color: colors.textMuted },
});

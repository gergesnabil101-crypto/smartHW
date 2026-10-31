import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Loading, EmptyState, ErrorState } from '../../components/Feedback';
import { listMyQuizzes, listFolders, createFolder, deleteQuiz, deleteFolder } from '../../lib/services';
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
      <FlatList
        horizontal
        data={[{ id: null, name: 'الكل' } as any, ...folders]}
        keyExtractor={(f) => String(f.id ?? 'all')}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.folderRow}
        renderItem={({ item }) => (
          <Pressable
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
        )}
      />

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
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/(teacher)/quiz/${item.id}`)}>
            <View style={styles.quizRow}>
              <View style={{ flex: 1 }}>
                <Text style={typography.h3} numberOfLines={1}>{item.title}</Text>
                <Text style={typography.caption}>
                  {item.questions?.length || 0} سؤال{item.subject ? ` • ${item.subject}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => confirmDeleteQuiz(item)} hitSlop={10}>
                <Text style={styles.deleteText}>حذف</Text>
              </Pressable>
            </View>
          </Card>
        )}
      />

      <View style={styles.actions}>
        <Button title="+ اختبار جديد" onPress={() => router.push('/(teacher)/quiz/new')} style={{ flex: 1 }} />
        <Button title="+ مجلد" variant="secondary" onPress={() => setFolderModal(true)} />
      </View>

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
  folderRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
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
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, gap: 10 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
});

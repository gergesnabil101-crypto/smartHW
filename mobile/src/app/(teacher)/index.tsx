import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs } from 'firebase/firestore';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Loading, EmptyState, ErrorState } from '../../components/Feedback';
import { listMyQuizzes, listFolders, createFolder, deleteQuiz, deleteFolder, saveQuiz } from '../../lib/services';
import { db } from '../../lib/firebase';
import { useAuth } from '../../store/AuthContext';
import { useLang } from '../../i18n';
import { ShareSheet } from '../../features/quizzes/ShareSheet';
import { API_BASE_URL } from '../../config';
import type { Quiz, Folder } from '../../types';
import { colors, radius, typography } from '../../theme';

const DISMISSED_KEY = 'teacher_notif_dismissed';
interface TeacherNotif { id: string; title: string; message: string; targetType?: string; targetValue?: string; created_at?: string }

export default function DashboardScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useLang();
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const [teacherNotifs, setTeacherNotifs] = useState<TeacherNotif[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
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
      refreshProfile?.(); // keep the token balance bar fresh after AI usage
      const [q, f] = await Promise.all([listMyQuizzes(), listFolders()]);
      setQuizzes(Array.isArray(q) ? q : []);
      setFolders(Array.isArray(f) ? f : []);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل الاختبارات.');
      setQuizzes([]);
    }
  }, []);

  // Notifications addressed to teachers (broadcast 'teachers' or direct 'teacher_direct' to me)
  const loadNotifs = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'notifications'));
      const meName = String(profile?.name || user?.displayName || '').trim();
      const meEmail = String(user?.email || '').trim().toLowerCase();
      const list: TeacherNotif[] = [];
      snap.forEach((d) => {
        const n = { id: d.id, ...(d.data() as any) } as TeacherNotif;
        const v = String(n.targetValue || '').trim();
        if (n.targetType === 'teachers') list.push(n);
        else if (n.targetType === 'teacher_direct' && (v === meName || v.toLowerCase() === meEmail)) list.push(n);
      });
      list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      const raw = await AsyncStorage.getItem(DISMISSED_KEY).catch(() => null);
      const done = new Set<string>(raw ? JSON.parse(raw) : []);
      setDismissed(done);
      setTeacherNotifs(list.filter((n) => !done.has(n.id)));
    } catch { /* notifications are best-effort */ }
  }, [user?.uid, profile?.name]);

  const dismissNotif = async (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    setTeacherNotifs((l) => l.filter((n) => n.id !== id));
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(next))).catch(() => null);
  };

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadNotifs(); }, [loadNotifs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Token balance bar — teacher sees remaining quota at a glance
  const tokenBar = useMemo(() => {
    const millions =
      Number(profile?.custom_tokens_millions) ||
      Number(String(profile?.subscription_type || '').match(/(\d+)\s*M/i)?.[1] || 0);
    const quota = millions * 1e6 + Number(profile?.extra_tokens || 0);
    if (quota <= 0) return null;
    const used = Number(profile?.tokens_used || 0);
    const left = Math.max(0, quota - used);
    const pct = Math.min(1, used / quota);
    const color = pct > 0.9 ? colors.danger : pct > 0.7 ? colors.warning : colors.success;
    return (
      <View style={styles.tokenBar}>
        <View style={styles.tokenBarHead}>
          <Text style={styles.tokenBarTitle}>{t('tokenBalance')}</Text>
          <Text style={styles.tokenBarText}>
            {t('remaining')} {left.toLocaleString('en')} {t('of')} {quota.toLocaleString('en')}
          </Text>
        </View>
        <View style={styles.tokenTrack}>
          <View style={[styles.tokenFill, { width: `${Math.max(2, Math.round(pct * 100))}%`, backgroundColor: color }]} />
        </View>
      </View>
    );
  }, [profile, t]);

  const visibleQuizzes = useMemo(() => {
    if (!quizzes) return [];
    return activeFolder ? quizzes.filter((q) => q.folder_id === activeFolder) : quizzes;
  }, [quizzes, activeFolder]);

  const confirmDeleteQuiz = (quiz: Quiz) => {
    Alert.alert(t('delete'), `${quiz.title} — ${t('deleteQuizQ')}`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
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
    return <Screen><Loading text={t('loadingQuizzes')} /></Screen>;
  }

  return (
    <Screen scroll={false}>
      {/* Folder filter row */}
      <View style={styles.folderRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.folderRow}>
          {[{ id: null, name: t('all') } as any, ...folders].map((item) => (
            <Pressable
              key={String(item.id ?? 'all')}
              onPress={() => setActiveFolder(item.id)}
              onLongPress={() => {
                if (!item.id) return;
                Alert.alert(t('delete'), `${item.name} — ${t('deleteFolderQ')}`, [
                  { text: t('cancel'), style: 'cancel' },
                  { text: t('delete'), style: 'destructive', onPress: () => deleteFolder(item.id).then(load).catch(() => null) },
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

      {tokenBar}
      {error ? <ErrorState message={error} onRetry={load} /> : null}

      <FlatList
        data={visibleQuizzes}
        keyExtractor={(q) => q.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          teacherNotifs.length ? (
            <View style={{ marginBottom: 10, gap: 8 }}>
              {teacherNotifs.map((n) => (
                <View key={n.id} style={styles.notifCard}>
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.notifTitle}>🔔 {n.title}</Text>
                    <Pressable onPress={() => dismissNotif(n.id)} hitSlop={8}>
                      <Text style={styles.notifClose}>✕</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.notifMsg}>{n.message}</Text>
                  <Text style={styles.notifMeta}>{t('notifFromAdmin')}{n.created_at ? ` • ${new Date(n.created_at).toLocaleDateString('ar-EG')}` : ''}</Text>
                </View>
              ))}
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyState
            title={t('noQuizzesYet')}
            hint={t('createFirstQuiz')}
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
                    {expired ? <Text style={styles.badgeExpired}>{t('badgeExpired')}</Text> : null}
                    {inactive ? <Text style={styles.badgeInactive}>{t('badgeDisabled')}</Text> : null}
                  </View>
                  <Text style={typography.caption}>
                    {item.questions?.length || 0} {t('questionsUnit')}{item.subject ? ` • ${item.subject}` : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.actionsRow}>
                <Pressable onPress={() => setShareQuiz(item)} style={styles.actionBtn}>
                  <Text style={styles.actionText}>{t('share')}</Text>
                </Pressable>
                <Pressable onPress={() => router.push({ pathname: '/results', params: { quizId: item.id } })} style={styles.actionBtn}>
                  <Text style={styles.actionText}>{t('results')}</Text>
                </Pressable>
                <Pressable onPress={() => setMoveQuiz(item)} style={styles.actionBtn}>
                  <Text style={styles.actionText}>{t('move')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => patchQuiz(item, { is_active: !inactive })}
                  disabled={busyQuizId === item.id}
                  style={styles.actionBtn}
                >
                  <Text style={styles.actionText}>{inactive ? t('enable') : t('disable')}</Text>
                </Pressable>
                <Pressable onPress={() => confirmDeleteQuiz(item)} style={styles.actionBtn} hitSlop={6}>
                  <Text style={styles.actionDelete}>{t('deleteAction')}</Text>
                </Pressable>
              </View>
            </Card>
          );
        }}
      />

      <View style={styles.actions}>
        <Button title={t('newQuiz')} onPress={() => router.push({ pathname: '/quiz/[id]', params: { id: 'new' } })} style={{ flex: 1 }} />
        <Button title={t('newFolder')} variant="secondary" onPress={() => setFolderModal(true)} />
      </View>
      <Text style={styles.buildTag}>v1.2</Text>

      {/* Share sheet */}
      <Modal visible={!!shareQuiz} transparent animationType="fade" onRequestClose={() => setShareQuiz(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={typography.h3}>{t('shareTitle')} — {shareQuiz?.title}</Text>
            {shareQuiz ? (
              <ShareSheet quizTitle={shareQuiz.title} shareUrl={`${API_BASE_URL}/?id=${shareQuiz.id}`} />
            ) : null}
            <Button title={t('close')} variant="ghost" onPress={() => setShareQuiz(null)} />
          </View>
        </View>
      </Modal>

      {/* Move to folder */}
      <Modal visible={!!moveQuiz} transparent animationType="fade" onRequestClose={() => setMoveQuiz(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={typography.h3}>{t('moveToFolder')} — {moveQuiz?.title}</Text>
            <Pressable
              style={styles.folderOption}
              onPress={() => { patchQuiz(moveQuiz!, { folder_id: undefined }); setMoveQuiz(null); }}
            >
              <Text style={typography.body}>{t('noFolder')}</Text>
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
            <Button title={t('cancel')} variant="ghost" onPress={() => setMoveQuiz(null)} />
          </View>
        </View>
      </Modal>

      <Modal visible={folderModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={typography.h3}>{t('newFolderTitle')}</Text>
            <Input
              label={t('folderName')}
              value={folderName}
              onChangeText={setFolderName}
              placeholder={t('folderNameHint')}
            />
            <View style={styles.modalActions}>
              <Button title={t('create')} onPress={submitFolder} loading={savingFolder} style={{ flex: 1 }} />
              <Button title={t('cancel')} variant="ghost" onPress={() => setFolderModal(false)} />
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
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: radius.full, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  folderChipActive: { backgroundColor: colors.primary, borderColor: colors.primary, elevation: 3, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  folderChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  folderChipTextActive: { color: '#fff' },
  list: { padding: 16, flexGrow: 1 },
  quizRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  titleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  badgeExpired: { fontSize: 10, fontWeight: '700', color: colors.danger, backgroundColor: colors.dangerSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  badgeInactive: { fontSize: 10, fontWeight: '700', color: colors.warning, backgroundColor: colors.warningSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  actionsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4, marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.surfaceTint, borderWidth: 1, borderColor: colors.borderSoft },
  actionText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  actionDelete: { fontSize: 12, fontWeight: '700', color: colors.danger },
  folderOption: { paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, gap: 10 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  buildTag: { position: 'absolute', bottom: 2, left: 20, fontSize: 9, color: colors.textMuted },
  notifCard: { backgroundColor: '#b45309', borderRadius: radius.md, padding: 12 },
  notifTitle: { color: '#fff', fontWeight: '800', fontSize: 14, textAlign: 'right', flex: 1 },
  notifMsg: { color: '#fef3c7', fontSize: 12, lineHeight: 20, textAlign: 'right', writingDirection: 'rtl', marginTop: 4 },
  notifMeta: { color: '#fde68a', fontSize: 10, textAlign: 'right', marginTop: 6 },
  notifClose: { color: '#fff', fontWeight: '800', fontSize: 14, paddingHorizontal: 6 },
  tokenBar: { marginHorizontal: 16, marginBottom: 4, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12 },
  tokenBarHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  tokenBarTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  tokenBarText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  tokenTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, marginTop: 8, overflow: 'hidden', alignSelf: 'stretch' },
  tokenFill: { height: '100%', borderRadius: 4 },
});

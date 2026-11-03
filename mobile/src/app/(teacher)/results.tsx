import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../store/AuthContext';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Loading, EmptyState, ErrorState } from '../../components/Feedback';
import { listTeacherResults, batchRecalculate } from '../../lib/services';
import type { StudentResult } from '../../types';
import { colors, radius, typography } from '../../theme';

export default function ResultsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { quizId } = useLocalSearchParams<{ quizId?: string }>();
  const [results, setResults] = useState<StudentResult[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await listTeacherResults();
      setResults(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل النتائج.');
      setResults([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // The API returns every teacher's results for admin accounts — default to
  // the signed-in teacher's own students, with a toggle to see all.
  const ownsOther = useMemo(
    () => (results || []).some((r) => r.teacher_id && r.teacher_id !== user?.uid && r.user_id !== user?.uid),
    [results, user]
  );

  const filtered = useMemo(() => {
    let list = results || [];
    if (quizId) list = list.filter((r) => r.quiz_id === quizId);
    if (!showAll && user?.uid) {
      list = list.filter((r) => !r.teacher_id && !r.user_id ? true : r.teacher_id === user.uid || r.user_id === user.uid);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      `${r.student_name} ${r.quiz_title} ${r.center_name ?? ''}`.toLowerCase().includes(q)
    );
  }, [results, search, showAll, user, quizId]);

  if (results === null && !error) {
    return <Screen><Loading text="جاري تحميل النتائج..." /></Screen>;
  }

  return (
    <Screen scroll={false}>
      <View style={styles.searchWrap}>
        <Input placeholder="ابحث باسم الطالب أو الاختبار..." value={search} onChangeText={setSearch} />
        {ownsOther ? (
          <View style={styles.filterRow}>
            <Pressable onPress={() => setShowAll(false)} style={[styles.filterChip, !showAll && styles.filterChipActive]}>
              <Text style={[styles.filterText, !showAll && styles.filterTextActive]}>طلابي فقط</Text>
            </Pressable>
            <Pressable onPress={() => setShowAll(true)} style={[styles.filterChip, showAll && styles.filterChipActive]}>
              <Text style={[styles.filterText, showAll && styles.filterTextActive]}>كل النتائج</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      <FlatList
        data={filtered}
        keyExtractor={(r) => String(r.id)}
        refreshing={refreshing}
        onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title="لا توجد نتائج" hint="نتائج الطلاب ستظهر هنا بعد تسليمهم للاختبارات" />}
        renderItem={({ item }) => {
          const pct = item.total ? Math.round((Number(item.score) / Number(item.total)) * 100) : 0;
          return (
            <Card onPress={() => router.push({ pathname: '/result/[id]', params: { id: String(item.id), quizId: item.quiz_id || '' } })}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.h3} numberOfLines={1}>{item.student_name}</Text>
                  <Text style={typography.caption} numberOfLines={1}>
                    {item.quiz_title || 'اختبار'} • {formatDate(item.created_at)}
                  </Text>
                </View>
                <View style={[styles.scoreBadge, pct >= 50 ? styles.scorePass : styles.scoreFail]}>
                  <Text style={styles.scoreText}>{item.score}/{item.total}</Text>
                  <Text style={styles.pctText}>{pct}%</Text>
                </View>
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

function formatDate(d: string | number | undefined): string {
  if (!d) return '';
  const date = new Date(d);
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  searchWrap: { padding: 16, paddingBottom: 4 },
  filterRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  filterTextActive: { color: '#fff' },
  list: { padding: 16, flexGrow: 1 },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  scoreBadge: { borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', minWidth: 64 },
  scorePass: { backgroundColor: colors.successSoft },
  scoreFail: { backgroundColor: colors.dangerSoft },
  scoreText: { fontWeight: '800', fontSize: 15, color: colors.text },
  pctText: { fontSize: 11, color: colors.textMuted },
});
